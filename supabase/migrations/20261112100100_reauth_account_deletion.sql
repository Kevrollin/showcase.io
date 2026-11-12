-- ════════════════════════════════════════════════════════════════════════════
-- Account deletion requires a recent sign-in, enforced server-side.
--
-- Supabase access tokens carry an `amr` claim: the methods used to sign in and
-- WHEN (unix seconds). It is kept across token refreshes, so it reflects the
-- last real authentication, not the last refresh. Requiring it to be recent
-- means a stolen or long-lived session cannot delete the account; the user must
-- re-enter their password (email users) or re-confirm with Google (OAuth users)
-- first, which the Settings page does.
-- ════════════════════════════════════════════════════════════════════════════

create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_authenticated_at bigint;
begin
  if v_uid is null then
    raise exception using errcode = '42501', message = 'NOT_AUTHENTICATED';
  end if;

  select max((entry ->> 'timestamp')::bigint)
  into v_authenticated_at
  from jsonb_array_elements(
    case when jsonb_typeof(auth.jwt() -> 'amr') = 'array' then auth.jwt() -> 'amr' else '[]'::jsonb end
  ) as entry
  where (entry ->> 'timestamp') ~ '^\d+$';

  if v_authenticated_at is null or extract(epoch from now()) - v_authenticated_at > 15 * 60 then
    raise exception using errcode = '42501', message = 'REAUTHENTICATION_REQUIRED';
  end if;

  delete from auth.users u where u.id = v_uid;
end;
$$;

revoke all on function public.delete_my_account() from public, anon, authenticated;
grant execute on function public.delete_my_account() to authenticated;
