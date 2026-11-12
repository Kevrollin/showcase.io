/**
 * Creates a disposable, already-confirmed user on the LINKED Supabase project
 * for the real-backend end-to-end test (`npm run test:e2e:real`), which deletes
 * the account again when it finishes. Needed when email confirmation is ON.
 *
 * Runs SQL as the project's postgres role through the Supabase CLI (you must be
 * logged in and linked). No service-role key is used or stored.
 *
 * Usage:  npm run e2e:user
 */
import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const id = randomBytes(4).toString('hex');
const email = `e2e-${id}@example.com`;
// Letters + digits, satisfies the project's password policy.
const password = `E2e${randomBytes(9).toString('base64url')}9`;

const sql = `
do $$
declare v_id uuid := gen_random_uuid();
begin
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change
  ) values (
    '00000000-0000-0000-0000-000000000000', v_id, 'authenticated', 'authenticated', '${email}',
    extensions.crypt('${password}', extensions.gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}', '{"full_name":"E2E Seller"}', now(), now(),
    '', '', '', ''
  );
  insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  values (gen_random_uuid(), v_id, v_id::text,
          jsonb_build_object('sub', v_id::text, 'email', '${email}', 'email_verified', true),
          'email', now(), now(), now());
end $$;
select email, email_confirmed_at is not null as confirmed from auth.users where email = '${email}';
`;

const dir = mkdtempSync(join(tmpdir(), 'showcase-e2e-'));
const file = join(dir, 'create-user.sql');
writeFileSync(file, sql);
try {
  const result = spawnSync('npx', ['supabase', 'db', 'query', '--remote', '--yes', '-o', 'table', '-f', file], {
    stdio: ['ignore', 'pipe', 'inherit'],
    encoding: 'utf8',
    shell: process.platform === 'win32',
  });
  if (result.status !== 0 || !result.stdout.includes(email)) {
    console.error(result.stdout);
    console.error('Could not create the test user.');
    process.exit(1);
  }
} finally {
  rmSync(dir, { recursive: true, force: true });
}

console.log('Disposable test user created (the real-backend E2E test deletes it when it finishes):\n');
console.log(`E2E_USER_EMAIL=${email}`);
console.log(`E2E_USER_PASSWORD=${password}`);
