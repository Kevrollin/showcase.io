-- ════════════════════════════════════════════════════════════════════════════
-- Fixes from the Supabase database advisors on the first production push.
-- ════════════════════════════════════════════════════════════════════════════

-- Performance (unindexed_foreign_keys): cover the composite foreign key
-- catalogue_images(business_id, item_id) → catalogue_items(business_id, id)
-- so cascading deletes and joins don't scan. It also serves business_id
-- lookups, which makes the single-column index redundant.
create index if not exists catalogue_images_business_item_idx
  on public.catalogue_images (business_id, item_id);
drop index if exists public.catalogue_images_business_idx;

-- Security (anon/authenticated_security_definer_function_executable):
-- new Supabase projects ship public.rls_auto_enable(), an event-trigger
-- function that turns RLS on for new tables. It is SECURITY DEFINER and, by
-- default, exposed as /rest/v1/rpc/rls_auto_enable. Event triggers do not need
-- EXECUTE for API roles, so remove API access. Guarded because local stacks
-- and older projects don't have the function.
do $$
begin
  if exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'rls_auto_enable'
  ) then
    revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
  end if;
end $$;

-- The remaining advisor notices are intentional and documented in SECURITY.md:
--   · public.delete_my_account()  — SECURITY DEFINER so a user can delete their
--     own auth account; it only ever deletes auth.uid().
--   · public.is_slug_available()  — SECURITY DEFINER so it can see other users'
--     drafts; returns only a boolean and is not available to anon.
