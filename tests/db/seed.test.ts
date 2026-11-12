import { readFileSync } from 'node:fs';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { describe, expect, it } from 'vitest';
import { createTestDatabase, rowsAs } from './harness';

// Columns and tables of the real auth schema that supabase/seed.sql writes to.
const AUTH_EXTRAS = /* sql */ `
  create schema if not exists extensions;
  create extension if not exists pgcrypto with schema extensions;
  alter table auth.users
    add column instance_id uuid, add column aud text, add column role text,
    add column email_confirmed_at timestamptz,
    add column raw_app_meta_data jsonb, add column updated_at timestamptz,
    add column confirmation_token text, add column email_change text,
    add column email_change_token_new text, add column recovery_token text;
`;

describe('supabase/seed.sql', () => {
  it('creates a working demo storefront', async () => {
    const db = await createTestDatabase({ extensions: { pgcrypto }, beforeMigrations: AUTH_EXTRAS });
    await db.exec(readFileSync('supabase/seed.sql', 'utf8'));

    const storefront = await rowsAs<{ s: { name: string; item_count: number } }>(db, 'anon', `select public.get_storefront('kelvin-designs') as s`);
    expect(storefront[0]?.s.name).toBe('Kelvin Designs');
    // The unpublished "Wedding stationery" item is not counted.
    expect(storefront[0]?.s.item_count).toBe(5);

    const password = await db.query<{ ok: boolean }>(
      `select encrypted_password = extensions.crypt('demo-password-1', encrypted_password) as ok from auth.users where email = 'demo@showcase.test'`,
    );
    expect(password.rows[0]?.ok).toBe(true);
    await db.close();
  });
});
