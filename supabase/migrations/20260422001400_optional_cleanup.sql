-- Canonical baseline migration.
-- Optional account-lifecycle helpers that are safe to keep separate from the
-- schema bootstrap.

create or replace function public.delete_own_account()
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  viewer_id uuid;
  owned_event_ids uuid[] := '{}'::uuid[];
  related_photo_ids uuid[] := '{}'::uuid[];
  asset_paths text[] := '{}'::text[];
begin
  viewer_id := auth.uid();
  if viewer_id is null then
    raise exception 'Unauthorized';
  end if;

  select coalesce(array_agg(e.id), '{}'::uuid[])
    into owned_event_ids
  from public.events e
  where e.club_id = viewer_id;

  select coalesce(array_agg(ap.id), '{}'::uuid[])
    into related_photo_ids
  from public.album_photos ap
  where ap.user_id = viewer_id
     or ap.event_id = any(owned_event_ids);

  select coalesce(array_agg(path), '{}'::text[])
    into asset_paths
  from (
    select nullif(btrim(p.profile_image_path), '') as path
    from public.profiles p
    where p.user_id = viewer_id

    union

    select nullif(btrim(p.cover_image_path), '')
    from public.profiles p
    where p.user_id = viewer_id

    union

    select nullif(btrim(e.cover_image_path), '')
    from public.events e
    where e.club_id = viewer_id

    union

    select nullif(btrim(ap.storage_path), '')
    from public.album_photos ap
    where ap.user_id = viewer_id
       or ap.event_id = any(owned_event_ids)

    union

    select nullif(btrim(media_path), '')
    from public.album_photos ap
    cross join lateral unnest(coalesce(ap.media_paths, array[]::text[])) as media_path
    where ap.user_id = viewer_id
       or ap.event_id = any(owned_event_ids)

    union

    select nullif(btrim(ma.object_path), '')
    from public.media_assets ma
    where ma.owner_id = viewer_id
       or ma.object_path in (
         select ap.storage_path
         from public.album_photos ap
         where ap.user_id = viewer_id
            or ap.event_id = any(owned_event_ids)
       )
  ) paths
  where path is not null;

  delete from public.notifications
  where actor_id = viewer_id
     or target_profile_id = viewer_id
     or event_id = any(owned_event_ids)
     or photo_id = any(related_photo_ids);

  delete from public.client_telemetry_events
  where user_id = viewer_id;

  delete from public.media_assets
  where owner_id = viewer_id
     or object_path = any(asset_paths);

  delete from storage.objects
  where bucket_id = 'make-e3557d40-media'
    and (
      owner = viewer_id
      or name = any(asset_paths)
      or name like '%/' || viewer_id::text || '/%'
    );

  delete from auth.users
  where id = viewer_id;

  return true;
end;
$$;
grant execute on function public.delete_own_account() to authenticated;
