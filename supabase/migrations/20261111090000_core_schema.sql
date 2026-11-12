-- ════════════════════════════════════════════════════════════════════════════
-- Showcase — core schema
--   plans · profiles · businesses · categories · catalogue_items · catalogue_images
-- No extensions are required (gen_random_uuid() is core since PG13).
-- ════════════════════════════════════════════════════════════════════════════

-- Helper functions live in a schema that PostgREST does not expose.
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to anon, authenticated, service_role;

-- ─── Pure helpers ───────────────────────────────────────────────────────────

-- Words that may never be used as a storefront slug.
create or replace function private.is_reserved_slug(p_slug text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select lower(coalesce(p_slug, '')) = any (array[
    'about', 'account', 'admin', 'api', 'app', 'assets', 'auth', 'billing',
    'blog', 'contact', 'dashboard', 'docs', 'edit', 'favicon', 'help', 'home',
    'login', 'logout', 'new', 'null', 'onboarding', 'pricing', 'privacy',
    'register', 'reset-password', 'root', 's', 'settings', 'showcase', 'signin',
    'signup', 'static', 'status', 'support', 'terms', 'undefined', 'www'
  ]);
$$;

-- Lowercase, ASCII-only, hyphen-separated slug. Returns '' when nothing usable remains.
create or replace function private.slugify(p_value text)
returns text
language sql
immutable
set search_path = ''
as $$
  select trim(both '-' from
    regexp_replace(
      regexp_replace(lower(coalesce(p_value, '')), '[''’`]', '', 'g'),
      '[^a-z0-9]+', '-', 'g'
    )
  );
$$;

create or replace function private.is_valid_slug(p_slug text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(
    p_slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(p_slug) between 3 and 48,
    false
  );
$$;

create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ─── plans ──────────────────────────────────────────────────────────────────
-- Single source of truth for tier limits. Enforced by triggers below.

create table public.plans (
  id                        text primary key check (id ~ '^[a-z0-9_]{2,32}$'),
  name                      text not null check (char_length(name) between 1 and 60),
  max_businesses            integer not null check (max_businesses >= 0),
  max_published_businesses  integer not null check (max_published_businesses >= 0),
  max_items_per_business    integer not null check (max_items_per_business >= 0),
  max_images_per_item       integer not null check (max_images_per_item between 1 and 50),
  created_at                timestamptz not null default now()
);

comment on table public.plans is 'Account tiers and their limits. Change limits here — never in the frontend.';

insert into public.plans (id, name, max_businesses, max_published_businesses, max_items_per_business, max_images_per_item)
values ('free', 'Free', 1, 1, 300, 8);

-- ─── profiles ───────────────────────────────────────────────────────────────

create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  full_name   text check (full_name is null or char_length(full_name) <= 120),
  plan_id     text not null default 'free' references public.plans (id),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index profiles_plan_id_idx on public.profiles (plan_id);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function private.set_updated_at();

-- Create a profile for every new auth user.
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
    nullif(left(btrim(coalesce(new.raw_user_meta_data ->> 'full_name', '')), 120), '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

-- ─── businesses ─────────────────────────────────────────────────────────────

create table public.businesses (
  id                       uuid primary key default gen_random_uuid(),
  owner_id                 uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  name                     text not null check (char_length(btrim(name)) between 2 and 80),
  slug                     text not null,
  description              text check (description is null or char_length(description) <= 500),
  tagline                  text check (tagline is null or char_length(tagline) <= 80),
  business_type            text not null check (business_type in ('products', 'services', 'portfolio', 'mixed')),
  category                 text check (category is null or char_length(category) between 1 and 60),
  location_label           text check (location_label is null or char_length(location_label) <= 80),
  whatsapp_number          text check (whatsapp_number is null or whatsapp_number ~ '^\+[1-9][0-9]{7,14}$'),
  phone_number             text check (phone_number is null or phone_number ~ '^\+[1-9][0-9]{7,14}$'),
  contact_email            text check (contact_email is null or (char_length(contact_email) <= 254 and contact_email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$')),
  instagram_url            text check (instagram_url is null or (char_length(instagram_url) <= 200 and instagram_url ~ '^https://(www\.)?instagram\.com/[A-Za-z0-9._]+/?$')),
  tiktok_url               text check (tiktok_url is null or (char_length(tiktok_url) <= 200 and tiktok_url ~ '^https://(www\.)?tiktok\.com/@[A-Za-z0-9._]+/?$')),
  facebook_url             text check (facebook_url is null or (char_length(facebook_url) <= 200 and facebook_url ~ '^https://((www|m)\.)?(facebook|fb)\.com/[^[:space:]]+$')),
  website_url              text check (website_url is null or (char_length(website_url) <= 200 and website_url ~ '^https?://[^[:space:]]+\.[^[:space:]]+$')),
  logo_path                text check (logo_path is null or char_length(logo_path) <= 300),
  cover_path               text check (cover_path is null or char_length(cover_path) <= 300),
  share_image_path         text check (share_image_path is null or char_length(share_image_path) <= 300),
  theme_id                 text not null default 'minimal' check (theme_id in ('minimal', 'creative', 'shop', 'studio')),
  accent_color             text not null default 'navy' check (accent_color in ('navy', 'forest', 'terracotta', 'ocean', 'gold', 'charcoal', 'rose', 'teal')),
  status                   text not null default 'draft' check (status in ('draft', 'published', 'unpublished')),
  published_at             timestamptz,
  onboarding_step          smallint not null default 2 check (onboarding_step between 1 and 6),
  onboarding_completed_at  timestamptz,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),
  constraint businesses_slug_format check (private.is_valid_slug(slug)),
  constraint businesses_slug_not_reserved check (not private.is_reserved_slug(slug))
);

comment on column public.businesses.slug is 'Public storefront path /s/{slug}. Always lowercase, so the unique index is case-insensitive.';
comment on column public.businesses.status is 'draft = never published, published = live, unpublished = temporarily hidden.';

create unique index businesses_slug_key on public.businesses (slug);
create index businesses_owner_id_idx on public.businesses (owner_id);

create trigger businesses_set_updated_at
  before update on public.businesses
  for each row execute function private.set_updated_at();

-- ─── categories ─────────────────────────────────────────────────────────────

create table public.categories (
  id           uuid primary key default gen_random_uuid(),
  business_id  uuid not null references public.businesses (id) on delete cascade,
  name         text not null check (char_length(btrim(name)) between 1 and 40),
  sort_order   integer not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  -- Target of the composite FK from catalogue_items (category must belong to the same business).
  constraint categories_business_id_id_key unique (business_id, id)
);

create unique index categories_business_name_key on public.categories (business_id, lower(btrim(name)));
create index categories_business_sort_idx on public.categories (business_id, sort_order);

create trigger categories_set_updated_at
  before update on public.categories
  for each row execute function private.set_updated_at();

-- ─── catalogue_items ────────────────────────────────────────────────────────

create table public.catalogue_items (
  id                   uuid primary key default gen_random_uuid(),
  business_id          uuid not null references public.businesses (id) on delete cascade,
  category_id          uuid,
  item_type            text not null check (item_type in ('product', 'service', 'portfolio')),
  title                text not null check (char_length(btrim(title)) between 1 and 100),
  slug                 text not null check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 80),
  description          text check (description is null or char_length(description) <= 2000),
  price                numeric(12, 2) check (price is null or (price >= 0 and price < 10000000000)),
  currency             text not null default 'KES' check (currency in ('KES')),
  price_mode           text not null default 'fixed' check (price_mode in ('fixed', 'starting_from', 'quote', 'contact', 'none')),
  availability_status  text not null default 'available' check (availability_status in ('available', 'unavailable', 'preorder')),
  is_featured          boolean not null default false,
  is_published         boolean not null default true,
  sort_order           integer not null default 0,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  -- A price is required exactly when the mode displays one.
  constraint catalogue_items_price_matches_mode check ((price_mode in ('fixed', 'starting_from')) = (price is not null)),
  constraint catalogue_items_business_id_id_key unique (business_id, id),
  constraint catalogue_items_business_slug_key unique (business_id, slug),
  -- Deleting a category moves its items to "uncategorised" instead of deleting them.
  constraint catalogue_items_category_fkey foreign key (business_id, category_id)
    references public.categories (business_id, id) on delete set null (category_id)
);

create index catalogue_items_public_idx on public.catalogue_items (business_id, is_published, is_featured desc, sort_order, created_at desc);
create index catalogue_items_category_idx on public.catalogue_items (business_id, category_id);

create trigger catalogue_items_set_updated_at
  before update on public.catalogue_items
  for each row execute function private.set_updated_at();

-- ─── catalogue_images ───────────────────────────────────────────────────────

create table public.catalogue_images (
  id            uuid primary key default gen_random_uuid(),
  business_id   uuid not null,
  item_id       uuid not null,
  storage_path  text not null check (char_length(storage_path) <= 300),
  thumb_path    text check (thumb_path is null or char_length(thumb_path) <= 300),
  width         integer check (width is null or width between 1 and 10000),
  height        integer check (height is null or height between 1 and 10000),
  byte_size     integer check (byte_size is null or byte_size > 0),
  alt_text      text check (alt_text is null or char_length(alt_text) <= 200),
  sort_order    integer not null default 0,
  created_at    timestamptz not null default now(),
  constraint catalogue_images_storage_path_key unique (storage_path),
  -- The image's business must be the item's business.
  constraint catalogue_images_item_fkey foreign key (business_id, item_id)
    references public.catalogue_items (business_id, id) on delete cascade
);

create index catalogue_images_item_sort_idx on public.catalogue_images (item_id, sort_order);
create index catalogue_images_business_idx on public.catalogue_images (business_id);
