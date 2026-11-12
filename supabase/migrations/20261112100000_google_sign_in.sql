-- ════════════════════════════════════════════════════════════════════════════
-- "Continue with Google" support.
--
-- 1. Profiles for OAuth users: Google supplies the display name in user
--    metadata; fall back to `name` when `full_name` is absent.
--
-- 2. Account-linking safeguard. Supabase automatically links an OAuth identity
--    to an existing user with the same (verified) email address. This project
--    runs with email confirmation OFF, so an email/password account is
--    "verified" without anyone proving they own the address. Without a guard, an
--    attacker could pre-register victim@gmail.com with a password; when the real
--    owner later uses Google, their Google identity would be linked into the
--    attacker's account and the attacker's password would keep working
--    (a pre-account-takeover attack).
--
--    public.secure_linked_sign_in() is called by the app right after an OAuth
--    sign-in. If an OAuth identity was attached to an account whose email/password
--    identity existed BEFORE it (and this link hasn't been secured yet), it
--    removes the unproven password and ends every other session. The person who
--    just proved ownership through Google keeps access and can set a new
--    password in Settings. Each link is secured exactly once.
-- ════════════════════════════════════════════════════════════════════════════

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name)
  values (
    new.id,
    nullif(left(btrim(coalesce(
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'name',
      ''
    )), 120), '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

revoke all on function private.handle_new_user() from public, anon, authenticated;

create table private.secured_identity_links (
  identity_id  uuid primary key,
  user_id      uuid not null references auth.users (id) on delete cascade,
  secured_at   timestamptz not null default now()
);

comment on table private.secured_identity_links is 'OAuth identities whose link to a pre-existing email/password account has been secured (password removed, other sessions ended).';

revoke all on table private.secured_identity_links from public, anon, authenticated;

create or replace function public.secure_linked_sign_in()
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid      uuid := auth.uid();
  v_session  text := nullif(auth.jwt() ->> 'session_id', '');
  v_secured  integer;
begin
  if v_uid is null then
    raise exception using errcode = '42501', message = 'NOT_AUTHENTICATED';
  end if;

  -- Serialise concurrent calls for the same user.
  perform pg_advisory_xact_lock(hashtextextended('secure-links:' || v_uid::text, 0));

  with candidates as (
    select i.id
    from auth.identities i
    where i.user_id = v_uid
      and i.provider <> 'email'
      and exists (
        select 1 from auth.identities e
        where e.user_id = v_uid and e.provider = 'email' and e.created_at < i.created_at
      )
      and not exists (select 1 from private.secured_identity_links s where s.identity_id = i.id)
  ),
  recorded as (
    insert into private.secured_identity_links (identity_id, user_id)
    select id, v_uid from candidates
    returning 1
  )
  select count(*) into v_secured from recorded;

  if v_secured = 0 then
    return false;
  end if;

  update auth.users set encrypted_password = null where id = v_uid;
  delete from auth.sessions s
  where s.user_id = v_uid and (v_session is null or s.id::text <> v_session);
  return true;
end;
$$;

comment on function public.secure_linked_sign_in() is 'Called after an OAuth sign-in: secures accounts where an OAuth identity was linked to a pre-existing, unverified email/password identity.';

revoke all on function public.secure_linked_sign_in() from public, anon, authenticated;
grant execute on function public.secure_linked_sign_in() to authenticated, service_role;
