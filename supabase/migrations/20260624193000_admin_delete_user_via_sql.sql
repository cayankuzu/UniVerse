create schema if not exists extensions;
create extension if not exists http with schema extensions;
create schema if not exists private_api;
grant usage on schema private_api to service_role;
create or replace function private_api.admin_delete_user_by_id(
  target_user_id uuid,
  service_role_key text,
  storage_api_url text default 'https://kfvdbfoufybltybsxlhh.supabase.co',
  primary_media_bucket_id text default 'make-e3557d40-media'
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  resolved_storage_api_url text := nullif(btrim(storage_api_url), '');
  resolved_service_role_key text := coalesce(
    nullif(btrim(service_role_key), ''),
    nullif(current_setting('app.service_role_key', true), ''),
    nullif(current_setting('app.push_dispatch_apikey', true), '')
  );
  profile_username text;
  profile_email text;
  profile_account_type text;
  owned_event_ids uuid[] := '{}'::uuid[];
  related_photo_ids uuid[] := '{}'::uuid[];
  foreign_album_rows_in_owned_events integer := 0;
  asset_paths text[] := '{}'::text[];
  storage_object_names text[] := '{}'::text[];
  storage_batch text[] := '{}'::text[];
  storage_bucket_id text;
  storage_batch_start integer;
  storage_delete_status integer;
  storage_delete_content text;
  storage_objects_to_delete_count integer := 0;
  deleted_storage_object_count integer := 0;
  remaining_storage_object_count integer := 0;
  deleted_auth_row_count integer := 0;
  connect_timeout_milliseconds integer := 5000;
  request_timeout_milliseconds integer := 120000;
begin
  if target_user_id is null then
    raise exception 'target_user_id is required';
  end if;

  if not exists (
    select 1
    from auth.users
    where id = target_user_id
  ) then
    raise exception 'User not found: %', target_user_id;
  end if;

  select
    lower(nullif(btrim(p.username::text), '')),
    lower(nullif(btrim(p.email::text), '')),
    lower(nullif(btrim(p.account_type::text), ''))
  into profile_username, profile_email, profile_account_type
  from public.profiles p
  where p.user_id = target_user_id;

  select coalesce(array_agg(e.id), '{}'::uuid[])
    into owned_event_ids
  from public.events e
  where e.club_id = target_user_id;

  if profile_account_type = 'club' and coalesce(array_length(owned_event_ids, 1), 0) > 0 then
    select count(*)
      into foreign_album_rows_in_owned_events
    from public.album_photos ap
    where ap.event_id = any(owned_event_ids)
      and ap.user_id <> target_user_id
      and ap.deleted_at is null;

    if foreign_album_rows_in_owned_events > 0 then
      raise exception
        'Cannot safely delete club user % from this SQL helper: % album row(s) uploaded by other users are attached to the club''s events. With the current schema, hard-deleting the club would also remove those rows. Use a dedicated preservation migration/flow before deleting this club.',
        target_user_id,
        foreign_album_rows_in_owned_events;
    end if;
  end if;

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

    select nullif(btrim(event_media_path.path), '')
    from public.events e
    cross join lateral unnest(coalesce(e.cover_image_paths, array[]::text[])) as event_media_path(path)
    where e.club_id = target_user_id

    union

    select nullif(btrim(ap.storage_path), '')
    from public.album_photos ap
    where ap.user_id = target_user_id
       or ap.event_id = any(owned_event_ids)

    union

    select nullif(btrim(media_path.path), '')
    from public.album_photos ap
    cross join lateral unnest(coalesce(ap.media_paths, array[]::text[])) as media_path(path)
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

  select count(*)
    into storage_objects_to_delete_count
  from storage.objects so
  where so.owner::text = target_user_id::text
     or (
       so.bucket_id = coalesce(primary_media_bucket_id, '')
       and (
         so.name = any(asset_paths)
         or so.name like '%/' || target_user_id::text || '/%'
         or so.name like target_user_id::text || '/%'
       )
     );

  if storage_objects_to_delete_count > 0 then
    if resolved_storage_api_url is null then
      raise exception 'storage_api_url is required to delete storage objects.';
    end if;

    if resolved_service_role_key is null then
      raise exception
        'service_role_key is required because this user still owns storage objects. Paste the project SB_SECRET_KEY or SUPABASE_SERVICE_ROLE_KEY at the top of the script, or preconfigure app.service_role_key, then rerun.';
    end if;

    perform extensions.http_reset_curlopt();
    perform extensions.http_set_curlopt(
      'CURLOPT_CONNECTTIMEOUT_MS',
      connect_timeout_milliseconds::text
    );
    perform extensions.http_set_curlopt(
      'CURLOPT_TIMEOUT_MS',
      request_timeout_milliseconds::text
    );

    begin
      for storage_bucket_id in
        select distinct so.bucket_id
        from storage.objects so
        where so.owner::text = target_user_id::text
           or (
             so.bucket_id = coalesce(primary_media_bucket_id, '')
             and (
               so.name = any(asset_paths)
               or so.name like '%/' || target_user_id::text || '/%'
               or so.name like target_user_id::text || '/%'
             )
           )
      loop
        select coalesce(array_agg(so.name order by so.name), '{}'::text[])
          into storage_object_names
        from storage.objects so
        where so.bucket_id = storage_bucket_id
          and (
            so.owner::text = target_user_id::text
            or (
              so.bucket_id = coalesce(primary_media_bucket_id, '')
              and (
                so.name = any(asset_paths)
                or so.name like '%/' || target_user_id::text || '/%'
                or so.name like target_user_id::text || '/%'
              )
            )
          );

        if coalesce(array_length(storage_object_names, 1), 0) = 0 then
          continue;
        end if;

        deleted_storage_object_count :=
          deleted_storage_object_count + coalesce(array_length(storage_object_names, 1), 0);

        for storage_batch_start in 1..coalesce(array_length(storage_object_names, 1), 0) by 1000 loop
          storage_batch := storage_object_names[
            storage_batch_start:least(
              storage_batch_start + 999,
              coalesce(array_length(storage_object_names, 1), 0)
            )
          ];

          select response.status, response.content
            into storage_delete_status, storage_delete_content
          from extensions.http(
            (
              'DELETE',
              rtrim(resolved_storage_api_url, '/') || '/storage/v1/object/' || storage_bucket_id,
              array[
                ('Authorization', 'Bearer ' || resolved_service_role_key)::extensions.http_header,
                ('apikey', resolved_service_role_key)::extensions.http_header
              ]::extensions.http_header[],
              'application/json',
              jsonb_build_object('prefixes', storage_batch)::text
            )::extensions.http_request
          ) as response;

          if storage_delete_status < 200 or storage_delete_status >= 300 then
            raise exception
              'Storage API delete failed for bucket % (%): %',
              storage_bucket_id,
              coalesce(storage_delete_status, 0),
              coalesce(storage_delete_content, '');
          end if;
        end loop;
      end loop;
    exception
      when others then
        perform extensions.http_reset_curlopt();
        raise;
    end;

    perform extensions.http_reset_curlopt();

    select count(*)
      into remaining_storage_object_count
    from storage.objects so
    where so.owner::text = target_user_id::text
       or (
         so.bucket_id = coalesce(primary_media_bucket_id, '')
         and (
           so.name = any(asset_paths)
           or so.name like '%/' || target_user_id::text || '/%'
           or so.name like target_user_id::text || '/%'
         )
       );

    if remaining_storage_object_count > 0 then
      raise exception
        'Storage cleanup incomplete. Remaining object count for user %: %',
        target_user_id,
        remaining_storage_object_count;
    end if;
  end if;

  delete from public.notifications
  where user_id = target_user_id
     or actor_id = target_user_id
     or target_profile_id = target_user_id
     or event_id = any(owned_event_ids)
     or photo_id = any(related_photo_ids);

  delete from public.notification_summary_cache
  where user_id = target_user_id;

  delete from public.client_mutation_receipts
  where viewer_id = target_user_id;

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
  where key = any(array_remove(array[
    'profile:' || target_user_id::text,
    'following:' || target_user_id::text,
    'followers:' || target_user_id::text,
    'follow_requests_sent:' || target_user_id::text,
    'follow_requests_received:' || target_user_id::text,
    'blocked:' || target_user_id::text,
    'notifications:' || target_user_id::text,
    'photos:' || target_user_id::text,
    case when profile_username is not null then 'idx:username:' || profile_username else null end,
    case when profile_email is not null then 'idx:email:' || profile_email else null end,
    case when profile_username is not null then 'clubevents:' || profile_username else null end
  ]::text[], null));

  delete from auth.users
  where id = target_user_id;

  get diagnostics deleted_auth_row_count = row_count;

  if deleted_auth_row_count <> 1 then
    raise exception 'auth.users delete failed for %', target_user_id;
  end if;

  if exists (
    select 1
    from auth.users
    where id = target_user_id
  ) then
    raise exception 'auth.users still contains % after delete', target_user_id;
  end if;

  return jsonb_build_object(
    'deleted_storage_object_count', deleted_storage_object_count,
    'owned_event_count', coalesce(array_length(owned_event_ids, 1), 0),
    'related_photo_count', coalesce(array_length(related_photo_ids, 1), 0),
    'status', 'ok',
    'target_user_id', target_user_id
  );
end;
$$;
revoke all on function private_api.admin_delete_user_by_id(uuid, text, text, text) from public;
revoke all on function private_api.admin_delete_user_by_id(uuid, text, text, text) from anon;
revoke all on function private_api.admin_delete_user_by_id(uuid, text, text, text) from authenticated;
grant execute on function private_api.admin_delete_user_by_id(uuid, text, text, text) to service_role;
create or replace function public.admin_delete_user_by_id(
  target_user_id uuid,
  service_role_key text,
  storage_api_url text default 'https://kfvdbfoufybltybsxlhh.supabase.co',
  primary_media_bucket_id text default 'make-e3557d40-media'
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private_api.admin_delete_user_by_id(
    target_user_id,
    service_role_key,
    storage_api_url,
    primary_media_bucket_id
  );
$$;
revoke all on function public.admin_delete_user_by_id(uuid, text, text, text) from public;
revoke all on function public.admin_delete_user_by_id(uuid, text, text, text) from anon;
revoke all on function public.admin_delete_user_by_id(uuid, text, text, text) from authenticated;
grant execute on function public.admin_delete_user_by_id(uuid, text, text, text) to service_role;
