-- ════════════════════════════════════════════════════════════════════════════
-- Storage: bucket "catalog-media"
--
-- Object layout (all segments are UUIDs except "brand"):
--   {owner_id}/{business_id}/brand/{logo|cover|share}-{uuid}.{webp|jpg|png}
--   {owner_id}/{business_id}/{item_id}/{image_id}[-thumb].{webp|jpg|png}
--
-- Reads: the bucket is public, so published images are served from the CDN via
--        /storage/v1/object/public/catalog-media/<path> without RLS. Paths are
--        unguessable UUIDs and are only discoverable through RLS-protected rows.
-- Writes: authenticated owners only, inside a folder they own (policies below).
-- The MIME allow-list and size limit are enforced by the Storage API.
-- ════════════════════════════════════════════════════════════════════════════

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'catalog-media',
  'catalog-media',
  true,
  2097152, -- 2 MB hard cap; the browser pipeline targets 300–700 KB
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

-- Returns true when the caller may write the object at p_name.
-- plpgsql guarantees the format check runs before any uuid cast.
create or replace function private.can_write_media_object(p_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid       uuid := auth.uid();
  v_parts     text[];
  v_business  uuid;
  v_folder    text;
  c_uuid      constant text := '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
begin
  if v_uid is null or p_name is null then
    return false;
  end if;

  if p_name !~ ('^' || c_uuid || '/' || c_uuid || '/(brand|' || c_uuid || ')/[a-z0-9-]{1,80}\.(webp|jpg|jpeg|png)$') then
    return false;
  end if;

  v_parts := string_to_array(p_name, '/');
  if v_parts[1] <> v_uid::text then
    return false;
  end if;

  v_business := v_parts[2]::uuid;
  if not exists (select 1 from public.businesses b where b.id = v_business and b.owner_id = v_uid) then
    return false;
  end if;

  v_folder := v_parts[3];
  if v_folder <> 'brand' and not exists (
    select 1 from public.catalogue_items i where i.id = v_folder::uuid and i.business_id = v_business
  ) then
    return false;
  end if;

  return true;
end;
$$;

-- Read/delete only require the object to sit under the caller's own folder, so
-- files can still be cleaned up after their item or business row is deleted.
create or replace function private.owns_media_object(p_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null
     and p_name is not null
     and split_part(p_name, '/', 1) = auth.uid()::text
     and p_name !~ '(^|/)\.\.?(/|$)';
$$;

revoke all on function private.can_write_media_object(text) from public, anon, authenticated;
revoke all on function private.owns_media_object(text) from public, anon, authenticated;
grant execute on function private.can_write_media_object(text) to authenticated, service_role;
grant execute on function private.owns_media_object(text) to authenticated, service_role;

-- Owners can list/read their own objects through the API (needed for remove/copy).
create policy "catalog-media: owners read own objects"
  on storage.objects for select to authenticated
  using (bucket_id = 'catalog-media' and private.owns_media_object(name));

create policy "catalog-media: owners upload into own folders"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'catalog-media' and private.can_write_media_object(name));

create policy "catalog-media: owners update own objects"
  on storage.objects for update to authenticated
  using (bucket_id = 'catalog-media' and private.can_write_media_object(name))
  with check (bucket_id = 'catalog-media' and private.can_write_media_object(name));

create policy "catalog-media: owners delete own objects"
  on storage.objects for delete to authenticated
  using (bucket_id = 'catalog-media' and private.owns_media_object(name));
