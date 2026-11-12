import type { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { as, createTestDatabase, rowsAs, type TestUser } from './harness';

let db: PGlite;

async function user(email: string, meta: Record<string, string>, password: string | null): Promise<TestUser> {
  const r = await db.query<{ id: string }>(
    `insert into auth.users (email, raw_user_meta_data, encrypted_password) values ($1, $2, $3) returning id`,
    [email, JSON.stringify(meta), password],
  );
  return { id: r.rows[0]!.id, email };
}

async function identity(u: TestUser, provider: 'email' | 'google', createdAt: string): Promise<string> {
  const r = await db.query<{ id: string }>(
    `insert into auth.identities (user_id, provider_id, provider, email, created_at) values ($1, $2, $3, $4, $5) returning id`,
    [u.id, provider === 'email' ? u.id : `google-${u.email}`, provider, u.email, createdAt],
  );
  return r.rows[0]!.id;
}

async function session(u: TestUser): Promise<string> {
  const r = await db.query<{ id: string }>(`insert into auth.sessions (user_id) values ($1) returning id`, [u.id]);
  return r.rows[0]!.id;
}

const secure = (u: TestUser, sessionId: string) =>
  as(db, u, async (tx) => (await tx.query<{ secured: boolean }>(`select public.secure_linked_sign_in() as secured`)).rows[0]!.secured, {
    session_id: sessionId,
  });

beforeAll(async () => {
  db = await createTestDatabase();
});

afterAll(async () => {
  await db.close();
});

describe('profiles for Google users', () => {
  it('use Google’s name when full_name is missing', async () => {
    const u = await user('ada@gmail.com', { name: 'Ada Wanjiku', picture: 'https://example.com/a.png' }, null);
    const rows = await db.query<{ full_name: string }>(`select full_name from public.profiles where id = $1`, [u.id]);
    expect(rows.rows[0]?.full_name).toBe('Ada Wanjiku');
  });
});

describe('secure_linked_sign_in (pre-account-takeover guard)', () => {
  it('locks out a password set before Google was linked, keeping only the current session', async () => {
    // An account created with email + password (possibly by someone who doesn't own the email)…
    const victim = await user('victim@gmail.com', { full_name: 'Attacker' }, '$2a$10$attackerhash');
    await identity(victim, 'email', '2026-11-01T10:00:00Z');
    const attackerSession = await session(victim);
    // …later the real owner signs in with Google and Supabase links the identity.
    await identity(victim, 'google', '2026-11-05T10:00:00Z');
    const ownerSession = await session(victim);

    expect(await secure(victim, ownerSession)).toBe(true);

    const pw = await db.query<{ encrypted_password: string | null }>(`select encrypted_password from auth.users where id = $1`, [victim.id]);
    expect(pw.rows[0]?.encrypted_password).toBeNull();
    const sessions = await db.query<{ id: string }>(`select id from auth.sessions where user_id = $1`, [victim.id]);
    expect(sessions.rows.map((s) => s.id)).toEqual([ownerSession]);
    expect(sessions.rows.map((s) => s.id)).not.toContain(attackerSession);
  });

  it('secures each link only once, so a password set afterwards is kept', async () => {
    const u = await user('once@gmail.com', {}, '$2a$10$old');
    await identity(u, 'email', '2026-11-01T10:00:00Z');
    await identity(u, 'google', '2026-11-05T10:00:00Z');
    const s = await session(u);
    expect(await secure(u, s)).toBe(true);

    // The owner sets a new password in Settings, then signs in with Google again.
    await db.query(`update auth.users set encrypted_password = '$2a$10$new' where id = $1`, [u.id]);
    expect(await secure(u, s)).toBe(false);
    const pw = await db.query<{ encrypted_password: string }>(`select encrypted_password from auth.users where id = $1`, [u.id]);
    expect(pw.rows[0]?.encrypted_password).toBe('$2a$10$new');
  });

  it('does nothing for accounts that started with Google', async () => {
    const u = await user('google-first@gmail.com', { full_name: 'G' }, null);
    await identity(u, 'google', '2026-11-01T10:00:00Z');
    const s1 = await session(u);
    const s2 = await session(u);
    expect(await secure(u, s1)).toBe(false);
    const sessions = await db.query(`select id from auth.sessions where user_id = $1`, [u.id]);
    expect(sessions.rows).toHaveLength(2);
    void s2;
  });

  it('does nothing for email/password-only accounts', async () => {
    const u = await user('plain@example.com', {}, '$2a$10$hash');
    await identity(u, 'email', '2026-11-01T10:00:00Z');
    const s = await session(u);
    expect(await secure(u, s)).toBe(false);
    const pw = await db.query<{ encrypted_password: string }>(`select encrypted_password from auth.users where id = $1`, [u.id]);
    expect(pw.rows[0]?.encrypted_password).toBe('$2a$10$hash');
  });

  it('only ever touches the caller’s own account', async () => {
    const other = await user('bystander@gmail.com', {}, '$2a$10$bystander');
    await identity(other, 'email', '2026-11-01T10:00:00Z');
    await identity(other, 'google', '2026-11-05T10:00:00Z');
    const caller = await user('caller@example.com', {}, null);
    const s = await session(caller);
    expect(await secure(caller, s)).toBe(false);
    const pw = await db.query<{ encrypted_password: string }>(`select encrypted_password from auth.users where id = $1`, [other.id]);
    expect(pw.rows[0]?.encrypted_password).toBe('$2a$10$bystander');
  });

  it('is not callable anonymously and its bookkeeping table is private', async () => {
    await expect(rowsAs(db, 'anon', `select public.secure_linked_sign_in()`)).rejects.toThrow(/permission denied/);
    const u = await user('peek@example.com', {}, null);
    await expect(rowsAs(db, u, `select * from private.secured_identity_links`)).rejects.toThrow(/permission denied/);
  });
});
