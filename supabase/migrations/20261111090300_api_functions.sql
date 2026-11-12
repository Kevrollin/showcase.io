-- ════════════════════════════════════════════════════════════════════════════
-- API functions (exposed through PostgREST as /rest/v1/rpc/<name>).
--
-- Public storefront readers are SECURITY INVOKER: they run as the caller, so
-- RLS and column privileges still decide what is visible. They only bundle the
-- data into a single round-trip and pick the public fields.
-- ════════════════════════════════════════════════════════════════════════════

-- ─── Public storefront ──────────────────────────────────────────────────────

create or replace function public.get_storefront(p_slug text)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select jsonb_build_object(
    'id', b.id,
    'name', b.name,
    'slug', b.slug,
    'description', b.description,
    'tagline', b.tagline,
    'business_type', b.business_type,
    'category', b.category,
    'location_label', b.location_label,
    'whatsapp_number', b.whatsapp_number,
    'phone_number', b.phone_number,
    'contact_email', b.contact_email,
    'instagram_url', b.instagram_url,
    'tiktok_url', b.tiktok_url,
    'facebook_url', b.facebook_url,
    'website_url', b.website_url,
    'logo_path', b.logo_path,
    'cover_path', b.cover_path,
    'share_image_path', b.share_image_path,
    'theme_id', b.theme_id,
    'accent_color', b.accent_color,
    'item_count', (
      select count(*) from public.catalogue_items i
      where i.business_id = b.id and i.is_published
    ),
    'item_types', coalesce((
      select jsonb_object_agg(t.item_type, t.n)
      from (
        select i.item_type, count(*) as n
        from public.catalogue_items i
        where i.business_id = b.id and i.is_published
        group by i.item_type
      ) t
    ), '{}'::jsonb),
    'categories', coalesce((
      select jsonb_agg(jsonb_build_object('id', c.id, 'name', c.name, 'item_count', c.n)
                       order by c.sort_order, c.name)
      from (
        select c.id, c.name, c.sort_order, count(i.id) as n
        from public.categories c
        join public.catalogue_items i on i.category_id = c.id and i.is_published
        where c.business_id = b.id
        group by c.id, c.name, c.sort_order
      ) c
    ), '[]'::jsonb)
  )
  from public.businesses b
  where b.slug = lower(btrim(p_slug)) and b.status = 'published';
$$;

comment on function public.get_storefront(text) is 'Public storefront header + filter metadata. Returns NULL for unknown or unpublished slugs.';

create or replace function public.get_storefront_items(
  p_slug         text,
  p_search       text default null,
  p_category_id  uuid default null,
  p_item_type    text default null,
  p_limit        integer default 24,
  p_offset       integer default 0
)
returns table (
  id                   uuid,
  slug                 text,
  title                text,
  summary              text,
  item_type            text,
  category_id          uuid,
  price                numeric,
  currency             text,
  price_mode           text,
  availability_status  text,
  is_featured          boolean,
  image                jsonb,
  image_count          integer,
  total_count          bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  with b as (
    select b.id from public.businesses b
    where b.slug = lower(btrim(p_slug)) and b.status = 'published'
  ),
  q as (
    select nullif(btrim(coalesce(p_search, '')), '') as term
  ),
  pattern as (
    select '%' || replace(replace(replace(q.term, '\', '\\'), '%', '\%'), '_', '\_') || '%' as p
    from q
  )
  select
    i.id,
    i.slug,
    i.title,
    left(i.description, 240) as summary,
    i.item_type,
    i.category_id,
    i.price,
    i.currency,
    i.price_mode,
    i.availability_status,
    i.is_featured,
    (
      select jsonb_build_object(
        'path', im.storage_path, 'thumb_path', im.thumb_path,
        'width', im.width, 'height', im.height, 'alt', im.alt_text
      )
      from public.catalogue_images im
      where im.item_id = i.id
      order by im.sort_order, im.id
      limit 1
    ) as image,
    (select count(*)::integer from public.catalogue_images im where im.item_id = i.id) as image_count,
    count(*) over () as total_count
  from public.catalogue_items i
  join b on b.id = i.business_id
  cross join pattern
  where i.is_published
    and (p_category_id is null or i.category_id = p_category_id)
    and (p_item_type is null or i.item_type = p_item_type)
    and (pattern.p is null or i.title ilike pattern.p or i.description ilike pattern.p)
  order by i.is_featured desc, i.sort_order, i.created_at desc, i.id
  limit least(greatest(coalesce(p_limit, 24), 1), 60)
  offset greatest(coalesce(p_offset, 0), 0);
$$;

comment on function public.get_storefront_items(text, text, uuid, text, integer, integer) is 'Paginated, filterable list of published items for a published storefront.';

create or replace function public.get_storefront_item(p_slug text, p_item_slug text)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select jsonb_build_object(
    'id', i.id,
    'slug', i.slug,
    'title', i.title,
    'description', i.description,
    'item_type', i.item_type,
    'category_id', i.category_id,
    'category_name', (select c.name from public.categories c where c.id = i.category_id),
    'price', i.price,
    'currency', i.currency,
    'price_mode', i.price_mode,
    'availability_status', i.availability_status,
    'is_featured', i.is_featured,
    'images', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', im.id, 'path', im.storage_path, 'thumb_path', im.thumb_path,
        'width', im.width, 'height', im.height, 'alt', im.alt_text
      ) order by im.sort_order, im.id)
      from public.catalogue_images im
      where im.item_id = i.id
    ), '[]'::jsonb)
  )
  from public.catalogue_items i
  join public.businesses b on b.id = i.business_id
  where b.slug = lower(btrim(p_slug))
    and b.status = 'published'
    and i.slug = lower(btrim(p_item_slug))
    and i.is_published;
$$;

-- ─── Owner helpers ──────────────────────────────────────────────────────────

-- Slug availability needs to see other users' drafts, so it is SECURITY DEFINER
-- and returns only a boolean.
create or replace function public.is_slug_available(p_slug text, p_business_id uuid default null)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_valid_slug(lower(btrim(p_slug)))
     and not private.is_reserved_slug(lower(btrim(p_slug)))
     and not exists (
       select 1 from public.businesses b
       where b.slug = lower(btrim(p_slug))
         and (p_business_id is null or b.id <> p_business_id)
     );
$$;

-- Reorder helpers run as the caller; RLS limits the update to the caller's rows.
create or replace function public.reorder_items(p_business_id uuid, p_item_ids uuid[])
returns void
language sql
security invoker
set search_path = ''
as $$
  update public.catalogue_items i
  set sort_order = (x.ord - 1)::integer
  from unnest(p_item_ids) with ordinality as x(id, ord)
  where i.id = x.id and i.business_id = p_business_id;
$$;

create or replace function public.reorder_categories(p_business_id uuid, p_category_ids uuid[])
returns void
language sql
security invoker
set search_path = ''
as $$
  update public.categories c
  set sort_order = (x.ord - 1)::integer
  from unnest(p_category_ids) with ordinality as x(id, ord)
  where c.id = x.id and c.business_id = p_business_id;
$$;

create or replace function public.reorder_images(p_item_id uuid, p_image_ids uuid[])
returns void
language sql
security invoker
set search_path = ''
as $$
  update public.catalogue_images im
  set sort_order = (x.ord - 1)::integer
  from unnest(p_image_ids) with ordinality as x(id, ord)
  where im.id = x.id and im.item_id = p_item_id;
$$;

-- Deletes the caller's own auth user (cascades to profile → businesses → …).
-- The client removes the caller's Storage objects first (Storage rows cannot be
-- deleted from SQL); see SECURITY.md → "Account deletion".
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception using errcode = '42501', message = 'NOT_AUTHENTICATED';
  end if;
  delete from auth.users u where u.id = v_uid;
end;
$$;

-- ─── Function privileges ────────────────────────────────────────────────────

revoke all on function public.get_storefront(text) from public, anon, authenticated;
revoke all on function public.get_storefront_items(text, text, uuid, text, integer, integer) from public, anon, authenticated;
revoke all on function public.get_storefront_item(text, text) from public, anon, authenticated;
revoke all on function public.is_slug_available(text, uuid) from public, anon, authenticated;
revoke all on function public.reorder_items(uuid, uuid[]) from public, anon, authenticated;
revoke all on function public.reorder_categories(uuid, uuid[]) from public, anon, authenticated;
revoke all on function public.reorder_images(uuid, uuid[]) from public, anon, authenticated;
revoke all on function public.delete_my_account() from public, anon, authenticated;

grant execute on function public.get_storefront(text) to anon, authenticated, service_role;
grant execute on function public.get_storefront_items(text, text, uuid, text, integer, integer) to anon, authenticated, service_role;
grant execute on function public.get_storefront_item(text, text) to anon, authenticated, service_role;
grant execute on function public.is_slug_available(text, uuid) to authenticated, service_role;
grant execute on function public.reorder_items(uuid, uuid[]) to authenticated, service_role;
grant execute on function public.reorder_categories(uuid, uuid[]) to authenticated, service_role;
grant execute on function public.reorder_images(uuid, uuid[]) to authenticated, service_role;
grant execute on function public.delete_my_account() to authenticated;
