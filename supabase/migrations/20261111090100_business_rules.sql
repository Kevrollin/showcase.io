-- ════════════════════════════════════════════════════════════════════════════
-- Business rules enforced in the database (never only in the UI):
--   · ownership is derived from auth.uid() and cannot be reassigned
--   · slugs are normalised, generated and de-duplicated
--   · plan limits (businesses, published storefronts, items, images)
--   · storage paths must live inside the owner's folder
-- ════════════════════════════════════════════════════════════════════════════

alter table public.businesses alter column onboarding_step set default 1;

-- Plan limits for a given account (falls back to the free plan).
create or replace function private.plan_for(p_user_id uuid)
returns public.plans
language sql
stable
security definer
set search_path = ''
as $$
  select pl.*
  from public.plans pl
  where pl.id = coalesce(
    (select pr.plan_id from public.profiles pr where pr.id = p_user_id),
    'free'
  );
$$;

-- ─── businesses ─────────────────────────────────────────────────────────────

create or replace function private.businesses_before_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_plan       public.plans;
  v_base       text;
  v_candidate  text;
  v_suffix     integer := 1;
  v_count      integer;
  v_prefix     text;
begin
  if tg_op = 'INSERT' then
    -- Never trust a client-supplied owner.
    if auth.uid() is not null then
      new.owner_id := auth.uid();
    end if;
    if new.owner_id is null then
      raise exception using errcode = '42501', message = 'NOT_AUTHENTICATED';
    end if;
  else
    -- Ownership and identity are immutable.
    new.owner_id := old.owner_id;
    new.id := old.id;
    new.created_at := old.created_at;
  end if;

  -- Serialise writes per owner so concurrent requests cannot exceed limits.
  perform pg_advisory_xact_lock(hashtextextended('business-owner:' || new.owner_id::text, 0));
  v_plan := private.plan_for(new.owner_id);

  if tg_op = 'INSERT' then
    select count(*) into v_count from public.businesses b where b.owner_id = new.owner_id;
    if v_count >= v_plan.max_businesses then
      raise exception using errcode = 'P0001', message = 'PLAN_LIMIT_BUSINESSES',
        detail = format('Your plan allows %s business(es).', v_plan.max_businesses);
    end if;
  end if;

  new.name := btrim(new.name);

  -- Slug: normalise an explicit slug, or generate a unique one from the name.
  if new.slug is null or btrim(new.slug) = '' then
    v_base := left(private.slugify(new.name), 40);
    v_base := trim(both '-' from v_base);
    if char_length(v_base) < 3 then
      v_base := trim(both '-' from (v_base || '-store'));
    end if;
    if private.is_reserved_slug(v_base) then
      v_base := v_base || '-store';
    end if;
    v_candidate := v_base;
    while exists (select 1 from public.businesses b where b.slug = v_candidate and b.id <> new.id) loop
      v_suffix := v_suffix + 1;
      v_candidate := v_base || '-' || v_suffix;
    end loop;
    new.slug := v_candidate;
  else
    new.slug := lower(btrim(new.slug));
  end if;

  -- Publishing rules.
  if new.status = 'published' and (tg_op = 'INSERT' or old.status is distinct from 'published') then
    select count(*) into v_count
    from public.businesses b
    where b.owner_id = new.owner_id and b.status = 'published' and b.id <> new.id;
    if v_count >= v_plan.max_published_businesses then
      raise exception using errcode = 'P0001', message = 'PLAN_LIMIT_PUBLISHED',
        detail = format('Your plan allows %s published storefront(s).', v_plan.max_published_businesses);
    end if;
    new.published_at := coalesce(new.published_at, now());
  end if;
  if tg_op = 'UPDATE' and new.published_at is distinct from old.published_at and new.status <> 'published' then
    new.published_at := old.published_at;
  end if;

  -- Media paths must point inside "{owner_id}/{business_id}/brand/".
  v_prefix := new.owner_id::text || '/' || new.id::text || '/brand/';
  if (new.logo_path is not null and left(new.logo_path, char_length(v_prefix)) <> v_prefix)
     or (new.cover_path is not null and left(new.cover_path, char_length(v_prefix)) <> v_prefix)
     or (new.share_image_path is not null and left(new.share_image_path, char_length(v_prefix)) <> v_prefix) then
    raise exception using errcode = '22023', message = 'INVALID_MEDIA_PATH';
  end if;

  return new;
end;
$$;

create trigger businesses_before_write
  before insert or update on public.businesses
  for each row execute function private.businesses_before_write();

-- ─── catalogue_items ────────────────────────────────────────────────────────

create or replace function private.catalogue_items_before_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner      uuid;
  v_plan       public.plans;
  v_count      integer;
  v_base       text;
  v_candidate  text;
  v_suffix     integer := 1;
begin
  if tg_op = 'UPDATE' then
    new.id := old.id;
    new.business_id := old.business_id;
    new.created_at := old.created_at;
  end if;

  new.title := btrim(new.title);
  if new.description is not null then
    new.description := nullif(btrim(new.description), '');
  end if;

  if tg_op = 'INSERT' then
    select b.owner_id into v_owner from public.businesses b where b.id = new.business_id;
    if v_owner is not null then
      perform pg_advisory_xact_lock(hashtextextended('business-items:' || new.business_id::text, 0));
      v_plan := private.plan_for(v_owner);
      select count(*) into v_count from public.catalogue_items i where i.business_id = new.business_id;
      if v_count >= v_plan.max_items_per_business then
        raise exception using errcode = 'P0001', message = 'PLAN_LIMIT_ITEMS',
          detail = format('Your plan allows %s items per storefront.', v_plan.max_items_per_business);
      end if;
    end if;
  end if;

  -- Slug: generated once from the title and kept stable so shared links keep working.
  if tg_op = 'INSERT' and (new.slug is null or btrim(new.slug) = '') then
    v_base := trim(both '-' from left(private.slugify(new.title), 60));
    if v_base = '' then
      v_base := 'item';
    end if;
    v_candidate := v_base;
    while exists (
      select 1 from public.catalogue_items i
      where i.business_id = new.business_id and i.slug = v_candidate and i.id <> new.id
    ) loop
      v_suffix := v_suffix + 1;
      v_candidate := v_base || '-' || v_suffix;
    end loop;
    new.slug := v_candidate;
  elsif new.slug is not null then
    new.slug := lower(btrim(new.slug));
  end if;

  return new;
end;
$$;

create trigger catalogue_items_before_write
  before insert or update on public.catalogue_items
  for each row execute function private.catalogue_items_before_write();

-- ─── catalogue_images ───────────────────────────────────────────────────────

create or replace function private.catalogue_images_before_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner   uuid;
  v_plan    public.plans;
  v_count   integer;
  v_prefix  text;
begin
  if tg_op = 'UPDATE' then
    new.id := old.id;
    new.business_id := old.business_id;
    new.item_id := old.item_id;
    new.storage_path := old.storage_path;
    new.thumb_path := old.thumb_path;
    new.created_at := old.created_at;
    return new;
  end if;

  select b.owner_id into v_owner from public.businesses b where b.id = new.business_id;
  if v_owner is null then
    -- Let the foreign key report the problem.
    return new;
  end if;

  v_prefix := v_owner::text || '/' || new.business_id::text || '/' || new.item_id::text || '/';
  if left(new.storage_path, char_length(v_prefix)) <> v_prefix
     or (new.thumb_path is not null and left(new.thumb_path, char_length(v_prefix)) <> v_prefix) then
    raise exception using errcode = '22023', message = 'INVALID_MEDIA_PATH';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('item-images:' || new.item_id::text, 0));
  v_plan := private.plan_for(v_owner);
  select count(*) into v_count from public.catalogue_images im where im.item_id = new.item_id;
  if v_count >= v_plan.max_images_per_item then
    raise exception using errcode = 'P0001', message = 'PLAN_LIMIT_IMAGES',
      detail = format('Your plan allows %s images per item.', v_plan.max_images_per_item);
  end if;

  return new;
end;
$$;

create trigger catalogue_images_before_write
  before insert or update on public.catalogue_images
  for each row execute function private.catalogue_images_before_write();
