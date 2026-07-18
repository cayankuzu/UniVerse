-- Keep account deletion hard and explicit. This migration does not add schema;
-- it only tightens the existing account lifecycle RPC.

create or replace function public.delete_own_account()
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  target_user_id uuid;
  profile_username text;
  profile_email text;
  owned_event_ids uuid[] := '{}'::uuid[];
  related_photo_ids uuid[] := '{}'::uuid[];
  asset_paths text[] := '{}'::text[];
begin
  target_user_id := auth.uid();
  if target_user_id is null then
    raise exception 'Unauthorized';
  end if;

  select
    lower(nullif(btrim(p.username::text), '')),
    lower(nullif(btrim(p.email::text), ''))
  into profile_username, profile_email
  from public.profiles p
  where p.user_id = target_user_id;

  select coalesce(array_agg(e.id), '{}'::uuid[])
    into owned_event_ids
  from public.events e
  where e.club_id = target_user_id;

  select coalesce(array_agg(ap.id), '{}'::uuid[])
    into related_photo_ids
  from public.album_photos ap
  where ap.user_id = target_user_id
     or ap.event_id = any(owned_event_ids);

  select coalesce(array_agg(path), '{}'::text[])
    into asset_paths
  from (
    select nullif(btrim(p.profile_image_path), '') as path
    from public.profiles p
    where p.user_id = target_user_id

    union

    select nullif(btrim(p.cover_image_path), '')
    from public.profiles p
    where p.user_id = target_user_id

    union

    select nullif(btrim(e.cover_image_path), '')
    from public.events e
    where e.club_id = target_user_id

    union

    select nullif(btrim(ap.storage_path), '')
    from public.album_photos ap
    where ap.user_id = target_user_id
       or ap.event_id = any(owned_event_ids)

    union

    select nullif(btrim(media_path), '')
    from public.album_photos ap
    cross join lateral unnest(coalesce(ap.media_paths, array[]::text[])) as media_path
    where ap.user_id = target_user_id
       or ap.event_id = any(owned_event_ids)

    union

    select nullif(btrim(ma.object_path), '')
    from public.media_assets ma
    where ma.owner_id = target_user_id
       or ma.object_path in (
         select ap.storage_path
         from public.album_photos ap
         where ap.user_id = target_user_id
            or ap.event_id = any(owned_event_ids)
       )
  ) paths
  where path is not null;

  delete from public.notifications
  where user_id = target_user_id
     or actor_id = target_user_id
     or target_profile_id = target_user_id
     or event_id = any(owned_event_ids)
     or photo_id = any(related_photo_ids);

  delete from public.client_mutation_receipts
  where client_mutation_receipts.viewer_id = target_user_id;

  delete from public.push_device_tokens
  where user_id = target_user_id;

  delete from public.client_telemetry_events
  where user_id = target_user_id;

  delete from public.security_detection_signals
  where user_id = target_user_id
     or subject_key = 'user:' || target_user_id::text
     or resource_id = target_user_id::text;

  delete from public.security_audit_logs
  where user_id = target_user_id
     or resource_id = target_user_id::text;

  delete from public.server_rate_limits
  where subject in (target_user_id::text, 'user:' || target_user_id::text);

  delete from public.media_assets
  where owner_id = target_user_id
     or object_path = any(asset_paths);

  delete from public.kv_store_e3557d40
  where key in (
    'profile:' || target_user_id::text,
    'following:' || target_user_id::text,
    'followers:' || target_user_id::text,
    'follow_requests_sent:' || target_user_id::text,
    'follow_requests_received:' || target_user_id::text,
    'blocked:' || target_user_id::text,
    'notifications:' || target_user_id::text,
    'photos:' || target_user_id::text,
    'idx:username:' || coalesce(profile_username, ''),
    'idx:email:' || coalesce(profile_email, ''),
    'clubevents:' || coalesce(profile_username, '')
  );

  delete from storage.objects
  where bucket_id = 'make-e3557d40-media'
    and (
      owner = target_user_id
      or name = any(asset_paths)
      or name like '%/' || target_user_id::text || '/%'
    );

  delete from auth.users
  where id = target_user_id;

  return true;
end;
$$;
grant execute on function public.delete_own_account() to authenticated;
