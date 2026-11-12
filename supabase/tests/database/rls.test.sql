-- pgTAP security tests for a real Supabase stack:  supabase test db
-- Assertions only look at this file's own fixtures, so they also pass on a
-- project that already has real storefronts (npm run db:test:remote).
-- (The same rules are covered in more depth by tests/db/*.test.ts on PGlite.)
begin;
create extension if not exists pgtap with schema extensions;
select plan(22);

-- ─── Fixtures (as superuser) ────────────────────────────────────────────────
insert into auth.users (id, email, raw_user_meta_data) values
  ('11111111-1111-4111-8111-111111111111', 'alice@test.local', '{"full_name":"Alice"}'),
  ('22222222-2222-4222-8222-222222222222', 'bob@test.local', '{"full_name":"Bob"}');

insert into public.businesses (id, owner_id, name, slug, business_type, status) values
  ('aaaaaaaa-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', 'Alice Threads', 'alice-threads', 'products', 'published'),
  ('bbbbbbbb-0000-4000-8000-000000000001', '22222222-2222-4222-8222-222222222222', 'Bob Prints', 'bob-prints', 'services', 'draft');

insert into public.catalogue_items (id, business_id, item_type, title, price, price_mode, is_published) values
  ('aaaaaaaa-1111-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000001', 'product', 'Visible Tee', 800, 'fixed', true),
  ('aaaaaaaa-1111-4000-8000-000000000002', 'aaaaaaaa-0000-4000-8000-000000000001', 'product', 'Hidden Tee', 800, 'fixed', false),
  ('bbbbbbbb-1111-4000-8000-000000000001', 'bbbbbbbb-0000-4000-8000-000000000001', 'service', 'Draft Poster', null, 'quote', true);

select is((select count(*)::int from public.profiles where id in ('11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222')), 2, 'profiles are created for new users');

-- ─── Anonymous visitors ─────────────────────────────────────────────────────
set local role anon;
set local request.jwt.claims = '{"role":"anon"}';

select results_eq(
  $$ select name from public.businesses where id in ('aaaaaaaa-0000-4000-8000-000000000001', 'bbbbbbbb-0000-4000-8000-000000000001') $$,
  $$ values ('Alice Threads'::text) $$, 'anon sees only published businesses');
select results_eq(
  $$ select title from public.catalogue_items where business_id in ('aaaaaaaa-0000-4000-8000-000000000001', 'bbbbbbbb-0000-4000-8000-000000000001') $$,
  $$ values ('Visible Tee'::text) $$, 'anon sees only published items of published businesses');
select throws_ok($$ select owner_id from public.businesses $$, '42501', null, 'anon cannot read owner_id');
select throws_ok($$ insert into public.businesses (name, business_type) values ('Anon', 'products') $$, '42501', null, 'anon cannot create businesses');
select is((public.get_storefront('alice-threads') ->> 'name'), 'Alice Threads', 'get_storefront returns a published storefront');
select is(public.get_storefront('bob-prints'), null, 'get_storefront hides drafts');
select is((select count(*)::int from public.get_storefront_items('alice-threads')), 1, 'get_storefront_items returns only published items');
select is(public.get_storefront_item('alice-threads', 'hidden-tee'), null, 'unpublished items are not reachable by slug');
select throws_ok($$ select public.is_slug_available('anything') $$, '42501', null, 'anon cannot probe slugs');

-- ─── Bob (owner of a draft) ─────────────────────────────────────────────────
reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated"}';

select is((select count(*)::int from public.businesses where id = 'bbbbbbbb-0000-4000-8000-000000000001'), 1, 'owners read their own draft');
select is((select count(*)::int from public.catalogue_items where id = 'aaaaaaaa-1111-4000-8000-000000000002'), 0, 'other users cannot read unpublished items');
update public.businesses set name = 'Hacked' where id = 'aaaaaaaa-0000-4000-8000-000000000001';
select is((select name from public.businesses where id = 'aaaaaaaa-0000-4000-8000-000000000001'), 'Alice Threads', 'other users cannot update a business');
delete from public.catalogue_items where id = 'aaaaaaaa-1111-4000-8000-000000000001';
select is((select count(*)::int from public.catalogue_items where id = 'aaaaaaaa-1111-4000-8000-000000000001'), 1, 'other users cannot delete items');
select throws_ok(
  $$ insert into public.catalogue_items (business_id, item_type, title, price_mode) values ('aaaaaaaa-0000-4000-8000-000000000001', 'product', 'Injected', 'contact') $$,
  '42501', null, 'other users cannot add items to a business');
select throws_ok(
  $$ insert into storage.objects (bucket_id, name) values ('catalog-media', '11111111-1111-4111-8111-111111111111/aaaaaaaa-0000-4000-8000-000000000001/brand/logo-x.webp') $$,
  '42501', null, 'other users cannot upload into someone else''s folder');
select lives_ok(
  $$ insert into storage.objects (bucket_id, name) values ('catalog-media', '22222222-2222-4222-8222-222222222222/bbbbbbbb-0000-4000-8000-000000000001/brand/logo-x.webp') $$,
  'owners can upload into their own folder');
select throws_ok(
  $$ insert into storage.objects (bucket_id, name) values ('catalog-media', '22222222-2222-4222-8222-222222222222/bbbbbbbb-0000-4000-8000-000000000001/brand/evil.svg') $$,
  '42501', null, 'non-image object names are rejected');
select throws_ok($$ update public.profiles set plan_id = 'free' $$, '42501', null, 'users cannot change their plan');
select throws_ok(
  $$ insert into public.businesses (name, business_type) values ('Second', 'products') $$,
  'P0001', 'PLAN_LIMIT_BUSINESSES', 'free plan allows one business');
select is(public.is_slug_available('alice-threads'), false, 'taken slugs are reported as unavailable');
select is(public.is_slug_available('dashboard'), false, 'reserved slugs are unavailable');

select * from finish();
rollback;
