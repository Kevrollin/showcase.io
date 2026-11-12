/**
 * PGlite-based database harness.
 *
 * Boots a real PostgreSQL (WASM) instance, installs a minimal Supabase shim
 * (API roles, auth.users + auth.uid(), storage schema) and then applies the
 * project's real migrations from supabase/migrations in order. Tests switch
 * between `anon`, `authenticated` (with a JWT `sub`) and superuser exactly the
 * way PostgREST does: SET LOCAL ROLE + request.jwt.claims inside a transaction.
 *
 * Storage API behaviour (MIME/size limits) is not emulated — only the SQL
 * policies on storage.objects, which is what decides ownership.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PGlite, type Extensions, type Transaction } from '@electric-sql/pglite';

const SUPABASE_SHIM = /* sql */ `
  create role anon nologin noinherit;
  create role authenticated nologin noinherit;
  create role service_role nologin noinherit bypassrls;

  create schema auth;
  create table auth.users (
    id uuid primary key default gen_random_uuid(),
    email text unique,
    encrypted_password text,
    raw_user_meta_data jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now()
  );
  create table auth.identities (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users (id) on delete cascade,
    provider_id text not null,
    provider text not null,
    identity_data jsonb not null default '{}'::jsonb,
    email text,
    last_sign_in_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (provider_id, provider)
  );
  create table auth.sessions (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users (id) on delete cascade,
    created_at timestamptz not null default now()
  );
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(
      coalesce(
        nullif(current_setting('request.jwt.claim.sub', true), ''),
        (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
      ),
      ''
    )::uuid
  $$;
  create function auth.jwt() returns jsonb language sql stable as $$
    select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb
  $$;
  grant usage on schema auth to anon, authenticated, service_role;
  grant execute on function auth.uid() to anon, authenticated, service_role;
  grant execute on function auth.jwt() to anon, authenticated, service_role;

  create schema storage;
  create table storage.buckets (
    id text primary key,
    name text not null,
    public boolean not null default false,
    file_size_limit bigint,
    allowed_mime_types text[],
    created_at timestamptz not null default now()
  );
  create table storage.objects (
    id uuid primary key default gen_random_uuid(),
    bucket_id text references storage.buckets (id),
    name text not null,
    owner uuid,
    metadata jsonb,
    created_at timestamptz not null default now(),
    unique (bucket_id, name)
  );
  alter table storage.objects enable row level security;
  grant usage on schema storage to anon, authenticated, service_role;
  grant select, insert, update, delete on storage.objects to anon, authenticated, service_role;
  grant select on storage.buckets to anon, authenticated, service_role;

  grant usage on schema public to anon, authenticated, service_role;
`;

const MIGRATIONS_DIR = join(process.cwd(), 'supabase', 'migrations');

export function migrationFiles(): string[] {
  return readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort();
}

export async function createTestDatabase(options: { extensions?: Extensions; beforeMigrations?: string } = {}): Promise<PGlite> {
  const db = await PGlite.create({ extensions: options.extensions });
  await db.exec(SUPABASE_SHIM);
  if (options.beforeMigrations) await db.exec(options.beforeMigrations);
  for (const file of migrationFiles()) {
    const sql = readFileSync(join(MIGRATIONS_DIR, file), 'utf8');
    try {
      await db.exec(sql);
    } catch (error) {
      throw new Error(`Migration ${file} failed: ${(error as Error).message}`, { cause: error });
    }
  }
  return db;
}

export interface TestUser {
  id: string;
  email: string;
}

export async function createUser(db: PGlite, email: string, fullName = 'Test User'): Promise<TestUser> {
  const result = await db.query<{ id: string }>(
    `insert into auth.users (email, raw_user_meta_data) values ($1, $2) returning id`,
    [email, JSON.stringify({ full_name: fullName })],
  );
  const row = result.rows[0];
  if (!row) throw new Error('user insert failed');
  return { id: row.id, email };
}

type Actor = TestUser | 'anon';

/**
 * Run `fn` as an API role, exactly like PostgREST: inside a transaction with
 * SET LOCAL ROLE and request.jwt.claims. Errors roll the transaction back and
 * are re-thrown.
 */
export async function as<T>(db: PGlite, actor: Actor, fn: (tx: Transaction) => Promise<T>, extraClaims: Record<string, unknown> = {}): Promise<T> {
  return db.transaction(async (tx) => {
    const claims = actor === 'anon' ? { role: 'anon' } : { sub: actor.id, role: 'authenticated', ...extraClaims };
    await tx.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify(claims)]);
    await tx.exec(`set local role ${actor === 'anon' ? 'anon' : 'authenticated'}`);
    return fn(tx);
  });
}

/** Convenience: returns rows of a query run as `actor`. */
export async function rowsAs<R>(db: PGlite, actor: Actor, sql: string, params: unknown[] = []): Promise<R[]> {
  return as(db, actor, async (tx) => (await tx.query<R>(sql, params)).rows);
}

/** Returns the number of rows affected by a write run as `actor`. */
export async function affectedAs(db: PGlite, actor: Actor, sql: string, params: unknown[] = []): Promise<number> {
  return as(db, actor, async (tx) => (await tx.query(sql, params)).affectedRows ?? 0);
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
