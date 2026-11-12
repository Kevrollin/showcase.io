-- ════════════════════════════════════════════════════════════════════════════
-- Row Level Security, privileges and ownership helpers.
--
-- Model:
--   anon           → published storefront data only, public columns only
--   authenticated  → full access to own rows; published data of others (read)
--   service_role   → bypasses RLS (never used by the frontend)
--
-- Privileges are granted explicitly so behaviour does not depend on the
-- project's default privileges.
-- ════════════════════════════════════════════════════════════════════════════

-- ─── Ownership / visibility helpers (SECURITY DEFINER avoids RLS recursion) ─

create or replace function private.is_business_owner(p_business_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.businesses b
    where b.id = p_business_id and b.owner_id = auth.uid()
  );
$$;

create or replace function private.is_business_published(p_business_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.businesses b
    where b.id = p_business_id and b.status = 'published'
  );
$$;

create or replace function private.is_item_public(p_item_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.catalogue_items i
    join public.businesses b on b.id = i.business_id
    where i.id = p_item_id and i.is_published and b.status = 'published'
  );
$$;

revoke all on function private.is_business_owner(uuid) from public, anon, authenticated;
revoke all on function private.is_business_published(uuid) from public, anon, authenticated;
revoke all on function private.is_item_public(uuid) from public, anon, authenticated;
grant execute on function private.is_business_owner(uuid) to anon, authenticated, service_role;
grant execute on function private.is_business_published(uuid) to anon, authenticated, service_role;
grant execute on function private.is_item_public(uuid) to anon, authenticated, service_role;

-- Trigger/internal functions are not callable by API roles.
revoke all on function private.plan_for(uuid) from public, anon, authenticated;
revoke all on function private.handle_new_user() from public, anon, authenticated;
revoke all on function private.businesses_before_write() from public, anon, authenticated;
revoke all on function private.catalogue_items_before_write() from public, anon, authenticated;
revoke all on function private.catalogue_images_before_write() from public, anon, authenticated;
revoke all on function private.set_updated_at() from public, anon, authenticated;
grant execute on function private.is_reserved_slug(text) to anon, authenticated, service_role;
grant execute on function private.is_valid_slug(text) to anon, authenticated, service_role;
grant execute on function private.slugify(text) to anon, authenticated, service_role;

-- ─── Enable RLS everywhere ──────────────────────────────────────────────────

alter table public.plans enable row level security;
alter table public.profiles enable row level security;
alter table public.businesses enable row level security;
alter table public.categories enable row level security;
alter table public.catalogue_items enable row level security;
alter table public.catalogue_images enable row level security;

-- ─── Table privileges ───────────────────────────────────────────────────────

revoke all on table public.plans, public.profiles, public.businesses,
  public.categories, public.catalogue_items, public.catalogue_images
  from anon, authenticated;

grant all on table public.plans, public.profiles, public.businesses,
  public.categories, public.catalogue_items, public.catalogue_images
  to service_role;

-- plans: read-only for signed-in users.
grant select on table public.plans to authenticated;

-- profiles: owners may read their profile and change only their name.
grant select on table public.profiles to authenticated;
grant update (full_name) on table public.profiles to authenticated;

-- Owners manage their storefront data (row access is limited by policies below).
grant select, insert, update, delete on table public.businesses to authenticated;
grant select, insert, update, delete on table public.categories to authenticated;
grant select, insert, update, delete on table public.catalogue_items to authenticated;
grant select, insert, update, delete on table public.catalogue_images to authenticated;

-- Anonymous visitors: public columns only. owner_id, onboarding state and
-- timestamps are deliberately not readable.
grant select (
  id, name, slug, description, tagline, business_type, category, location_label,
  whatsapp_number, phone_number, contact_email, instagram_url, tiktok_url,
  facebook_url, website_url, logo_path, cover_path, share_image_path,
  theme_id, accent_color, status
) on table public.businesses to anon;

grant select (id, business_id, name, sort_order) on table public.categories to anon;

grant select (
  id, business_id, category_id, item_type, title, slug, description, price,
  currency, price_mode, availability_status, is_featured, is_published,
  sort_order, created_at
) on table public.catalogue_items to anon;

grant select (
  id, business_id, item_id, storage_path, thumb_path, width, height, alt_text, sort_order
) on table public.catalogue_images to anon;

-- ─── plans ──────────────────────────────────────────────────────────────────

create policy "plans are readable by signed-in users"
  on public.plans for select to authenticated
  using (true);

-- ─── profiles ───────────────────────────────────────────────────────────────

create policy "users read their own profile"
  on public.profiles for select to authenticated
  using (id = (select auth.uid()));

create policy "users update their own profile"
  on public.profiles for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- ─── businesses ─────────────────────────────────────────────────────────────

create policy "anyone reads published businesses"
  on public.businesses for select to anon
  using (status = 'published');

create policy "owners read own businesses; signed-in users read published ones"
  on public.businesses for select to authenticated
  using (owner_id = (select auth.uid()) or status = 'published');

create policy "users create businesses they own"
  on public.businesses for insert to authenticated
  with check (owner_id = (select auth.uid()));

create policy "owners update own businesses"
  on public.businesses for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

create policy "owners delete own businesses"
  on public.businesses for delete to authenticated
  using (owner_id = (select auth.uid()));

-- ─── categories ─────────────────────────────────────────────────────────────

create policy "anyone reads categories of published businesses"
  on public.categories for select to anon
  using (private.is_business_published(business_id));

create policy "owners and visitors read categories"
  on public.categories for select to authenticated
  using (private.is_business_owner(business_id) or private.is_business_published(business_id));

create policy "owners create categories"
  on public.categories for insert to authenticated
  with check (private.is_business_owner(business_id));

create policy "owners update categories"
  on public.categories for update to authenticated
  using (private.is_business_owner(business_id))
  with check (private.is_business_owner(business_id));

create policy "owners delete categories"
  on public.categories for delete to authenticated
  using (private.is_business_owner(business_id));

-- ─── catalogue_items ────────────────────────────────────────────────────────

create policy "anyone reads published items of published businesses"
  on public.catalogue_items for select to anon
  using (is_published and private.is_business_published(business_id));

create policy "owners read all own items; visitors read published ones"
  on public.catalogue_items for select to authenticated
  using (
    private.is_business_owner(business_id)
    or (is_published and private.is_business_published(business_id))
  );

create policy "owners create items"
  on public.catalogue_items for insert to authenticated
  with check (private.is_business_owner(business_id));

create policy "owners update items"
  on public.catalogue_items for update to authenticated
  using (private.is_business_owner(business_id))
  with check (private.is_business_owner(business_id));

create policy "owners delete items"
  on public.catalogue_items for delete to authenticated
  using (private.is_business_owner(business_id));

-- ─── catalogue_images ───────────────────────────────────────────────────────

create policy "anyone reads images of public items"
  on public.catalogue_images for select to anon
  using (private.is_item_public(item_id));

create policy "owners read own images; visitors read public ones"
  on public.catalogue_images for select to authenticated
  using (private.is_business_owner(business_id) or private.is_item_public(item_id));

create policy "owners add images"
  on public.catalogue_images for insert to authenticated
  with check (private.is_business_owner(business_id));

create policy "owners update images"
  on public.catalogue_images for update to authenticated
  using (private.is_business_owner(business_id))
  with check (private.is_business_owner(business_id));

create policy "owners delete images"
  on public.catalogue_images for delete to authenticated
  using (private.is_business_owner(business_id));
