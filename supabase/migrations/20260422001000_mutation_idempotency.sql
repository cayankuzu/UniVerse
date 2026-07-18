-- Canonical baseline migration.
-- Sources:
--   - 20260307183000_phase3_mutation_patch_envelopes.sql
--   - 20260310030000_follow_only_remove_membership_system.sql
--   - 20260312120000_client_mutation_idempotency.sql
--   - 20260313213000_social_mutation_wrapper_reliability.sql
--   - 20260313235900_explicit_follow_status_rpc.sql
--   - 20260317133000_update_profile_patch_rpc.sql
--   - 20260326160000_idempotent_create_and_counters.sql
--   - 20260326173000_comment_like_and_album_likers_projection.sql

create table if not exists public.client_mutation_receipts (
  viewer_id uuid not null,
  operation text not null,
  client_mutation_id text not null,
  response jsonb not null,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (viewer_id, operation, client_mutation_id)
);
create index if not exists idx_client_mutation_receipts_created_at
  on public.client_mutation_receipts (created_at desc);
alter table public.client_mutation_receipts enable row level security;
drop policy if exists "client_mutation_receipts_no_direct_access" on public.client_mutation_receipts;
create policy "client_mutation_receipts_no_direct_access"
on public.client_mutation_receipts
as restrictive
for all
to anon, authenticated
using (false)
with check (false);
create or replace function public.build_mutation_patch_envelope(
  patches jsonb default '[]'::jsonb,
  deleted_ids jsonb default '[]'::jsonb
)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'patches', coalesce(patches, '[]'::jsonb),
    'deleted_ids', coalesce(deleted_ids, '[]'::jsonb),
    'server_time', timezone('utc', now())
  );
$$;
create or replace function public.normalize_client_mutation_id(raw_value text)
returns text
language sql
immutable
set search_path = public
as $$
  select nullif(left(trim(coalesce(raw_value, '')), 120), '');
$$;
create or replace function public.read_client_mutation_receipt(
  operation_name text,
  client_mutation_id text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  request_viewer_id uuid := auth.uid();
  normalized_operation text := nullif(trim(coalesce(operation_name, '')), '');
  normalized_mutation_id text := public.normalize_client_mutation_id(client_mutation_id);
  existing_response jsonb;
begin
  if request_viewer_id is null then
    raise exception 'unauthorized';
  end if;

  if normalized_operation is null or normalized_mutation_id is null then
    return null;
  end if;

  perform pg_advisory_xact_lock(
    hashtext(request_viewer_id::text),
    hashtext(normalized_operation || ':' || normalized_mutation_id)
  );

  select r.response
    into existing_response
  from public.client_mutation_receipts r
  where r.viewer_id = request_viewer_id
    and r.operation = normalized_operation
    and r.client_mutation_id = normalized_mutation_id;

  return existing_response;
end;
$$;
create or replace function public.write_client_mutation_receipt(
  operation_name text,
  client_mutation_id text,
  response_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  request_viewer_id uuid := auth.uid();
  normalized_operation text := nullif(trim(coalesce(operation_name, '')), '');
  normalized_mutation_id text := public.normalize_client_mutation_id(client_mutation_id);
  stored_response jsonb;
begin
  if request_viewer_id is null then
    raise exception 'unauthorized';
  end if;

  if normalized_operation is null or normalized_mutation_id is null then
    return coalesce(response_payload, '{}'::jsonb);
  end if;

  perform pg_advisory_xact_lock(
    hashtext(request_viewer_id::text),
    hashtext(normalized_operation || ':' || normalized_mutation_id)
  );

  insert into public.client_mutation_receipts (
    viewer_id,
    operation,
    client_mutation_id,
    response
  )
  values (
    request_viewer_id,
    normalized_operation,
    normalized_mutation_id,
    coalesce(response_payload, '{}'::jsonb)
  )
  on conflict (viewer_id, operation, client_mutation_id) do nothing;

  select r.response
    into stored_response
  from public.client_mutation_receipts r
  where r.viewer_id = request_viewer_id
    and r.operation = normalized_operation
    and r.client_mutation_id = normalized_mutation_id;

  return coalesce(stored_response, coalesce(response_payload, '{}'::jsonb));
end;
$$;
create or replace function public.toggle_follow_with_patch(target_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.toggle_follow(target_user_id);
  return public.build_mutation_patch_envelope();
end;
$$;
create or replace function public.toggle_follow_with_patch(
  target_user_id uuid,
  client_mutation_id text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  existing_response jsonb;
  response_payload jsonb;
begin
  existing_response := public.read_client_mutation_receipt('toggle_follow_with_patch', client_mutation_id);
  if existing_response is not null then
    return existing_response;
  end if;

  perform public.toggle_follow(target_user_id);
  response_payload := public.build_mutation_patch_envelope();

  return public.write_client_mutation_receipt(
    'toggle_follow_with_patch',
    client_mutation_id,
    response_payload
  );
end;
$$;
create or replace function public.toggle_club_membership_with_patch(target_club_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.toggle_club_membership(target_club_id);
  return public.build_mutation_patch_envelope();
end;
$$;
create or replace function public.respond_follow_request_with_patch(requester_id uuid, action text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.respond_follow_request(requester_id, action);
  return public.build_mutation_patch_envelope();
end;
$$;
create or replace function public.respond_follow_request_with_patch(
  requester_id uuid,
  action text,
  client_mutation_id text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  existing_response jsonb;
  normalized_action text := lower(trim(coalesce(action, '')));
  response_payload jsonb;
begin
  existing_response := public.read_client_mutation_receipt(
    'respond_follow_request_with_patch:' || normalized_action,
    client_mutation_id
  );
  if existing_response is not null then
    return existing_response;
  end if;

  perform public.respond_follow_request(requester_id, action);
  response_payload := public.build_mutation_patch_envelope();

  return public.write_client_mutation_receipt(
    'respond_follow_request_with_patch:' || normalized_action,
    client_mutation_id,
    response_payload
  );
end;
$$;
create or replace function public.respond_membership_request_with_patch(
  club_id uuid,
  requester_id uuid,
  action text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.respond_membership_request(club_id, requester_id, action);
  return public.build_mutation_patch_envelope();
end;
$$;
create or replace function public.remove_club_member_with_patch(club_id uuid, member_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.remove_club_member(club_id, member_id);
  return public.build_mutation_patch_envelope();
end;
$$;
create or replace function public.mark_notification_read_with_patch(target_notification_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.mark_notification_read(target_notification_id);
  return public.build_mutation_patch_envelope(
    jsonb_build_array(
      jsonb_build_object(
        'entity', 'notifications',
        'id', target_notification_id::text,
        'changes', jsonb_build_object('read', true)
      )
    )
  );
end;
$$;
create or replace function public.mark_notification_read_with_patch(
  target_notification_id uuid,
  client_mutation_id text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  existing_response jsonb;
  response_payload jsonb;
begin
  existing_response := public.read_client_mutation_receipt('mark_notification_read_with_patch', client_mutation_id);
  if existing_response is not null then
    return existing_response;
  end if;

  response_payload := public.mark_notification_read_with_patch(target_notification_id);
  return public.write_client_mutation_receipt(
    'mark_notification_read_with_patch',
    client_mutation_id,
    response_payload
  );
end;
$$;
create or replace function public.mark_notifications_read_all_with_patch()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.mark_notifications_read_all();
  return public.build_mutation_patch_envelope();
end;
$$;
create or replace function public.mark_notifications_read_all_with_patch(client_mutation_id text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  existing_response jsonb;
  response_payload jsonb;
begin
  existing_response := public.read_client_mutation_receipt('mark_notifications_read_all_with_patch', client_mutation_id);
  if existing_response is not null then
    return existing_response;
  end if;

  response_payload := public.mark_notifications_read_all_with_patch();
  return public.write_client_mutation_receipt(
    'mark_notifications_read_all_with_patch',
    client_mutation_id,
    response_payload
  );
end;
$$;
create or replace function public.block_user_with_patch(target_username text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  viewer_id uuid := auth.uid();
  target_user_id uuid;
begin
  if viewer_id is null then
    raise exception 'unauthorized';
  end if;

  select p.user_id
    into target_user_id
  from public.profiles p
  where lower(trim(p.username)) = lower(trim(coalesce(target_username, '')))
  limit 1;

  if target_user_id is null then
    raise exception 'profile-not-found';
  end if;

  if not exists (
    select 1
    from public.blocks b
    where b.blocker_id = viewer_id and b.blocked_id = target_user_id
  ) then
    insert into public.blocks (blocker_id, blocked_id)
    values (viewer_id, target_user_id);
  end if;

  return public.build_mutation_patch_envelope();
end;
$$;
create or replace function public.block_user_with_patch(
  target_username text,
  client_mutation_id text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  existing_response jsonb;
  response_payload jsonb;
begin
  existing_response := public.read_client_mutation_receipt('block_user_with_patch', client_mutation_id);
  if existing_response is not null then
    return existing_response;
  end if;

  response_payload := public.block_user_with_patch(target_username);
  return public.write_client_mutation_receipt(
    'block_user_with_patch',
    client_mutation_id,
    response_payload
  );
end;
$$;
create or replace function public.unblock_user_with_patch(target_username text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  viewer_id uuid := auth.uid();
  target_user_id uuid;
begin
  if viewer_id is null then
    raise exception 'unauthorized';
  end if;

  select p.user_id
    into target_user_id
  from public.profiles p
  where lower(trim(p.username)) = lower(trim(coalesce(target_username, '')))
  limit 1;

  if target_user_id is not null then
    delete from public.blocks
    where blocker_id = viewer_id and blocked_id = target_user_id;
  end if;

  return public.build_mutation_patch_envelope();
end;
$$;
create or replace function public.unblock_user_with_patch(
  target_username text,
  client_mutation_id text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  existing_response jsonb;
  response_payload jsonb;
begin
  existing_response := public.read_client_mutation_receipt('unblock_user_with_patch', client_mutation_id);
  if existing_response is not null then
    return existing_response;
  end if;

  response_payload := public.unblock_user_with_patch(target_username);
  return public.write_client_mutation_receipt(
    'unblock_user_with_patch',
    client_mutation_id,
    response_payload
  );
end;
$$;
create or replace function public.set_follow_status_with_patch(
  target_user_id uuid,
  desired_status text,
  client_mutation_id text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  existing_response jsonb;
  normalized_desired text := lower(trim(coalesce(desired_status, '')));
  response_payload jsonb;
begin
  existing_response := public.read_client_mutation_receipt(
    'set_follow_status_with_patch:' || normalized_desired,
    client_mutation_id
  );
  if existing_response is not null then
    return existing_response;
  end if;

  perform public.set_follow_status(target_user_id, desired_status);
  response_payload := public.build_mutation_patch_envelope();

  return public.write_client_mutation_receipt(
    'set_follow_status_with_patch:' || normalized_desired,
    client_mutation_id,
    response_payload
  );
end;
$$;
create or replace function public.toggle_event_like(target_event_id uuid)
returns table(liked boolean, likes_count bigint)
language plpgsql
security definer
set search_path = public
as $$
declare
  viewer_id uuid;
  already_liked boolean;
begin
  viewer_id := auth.uid();
  if viewer_id is null then
    raise exception 'Unauthorized';
  end if;

  if not public.can_view_event(target_event_id) then
    raise exception 'Event is not visible to current user';
  end if;

  select exists (
    select 1
    from public.event_likes
    where event_id = target_event_id
      and user_id = viewer_id
  ) into already_liked;

  if already_liked then
    delete from public.event_likes
    where event_id = target_event_id
      and user_id = viewer_id;
    liked := false;
  else
    insert into public.event_likes (event_id, user_id)
    values (target_event_id, viewer_id)
    on conflict do nothing;
    liked := true;
  end if;

  select coalesce(counters.likes_count, 0)::bigint
  into likes_count
  from public.event_engagement_counters counters
  where counters.event_id = target_event_id;

  likes_count := coalesce(likes_count, 0);
  return next;
end;
$$;
create or replace function public.toggle_event_like(
  target_event_id uuid,
  client_mutation_id text
)
returns table(liked boolean, likes_count bigint)
language plpgsql
security definer
set search_path = public
as $$
declare
  existing_response jsonb;
begin
  existing_response := public.read_client_mutation_receipt('toggle_event_like', client_mutation_id);
  if existing_response is not null then
    liked := coalesce((existing_response ->> 'liked')::boolean, false);
    likes_count := coalesce((existing_response ->> 'likes_count')::bigint, 0);
    return next;
    return;
  end if;

  select result.liked, result.likes_count
    into liked, likes_count
  from public.toggle_event_like(target_event_id) result;

  perform public.write_client_mutation_receipt(
    'toggle_event_like',
    client_mutation_id,
    jsonb_build_object(
      'liked', liked,
      'likes_count', likes_count
    )
  );

  return next;
end;
$$;
create or replace function public.toggle_event_attendance(target_event_id uuid)
returns table(joined boolean, attendees_count bigint)
language plpgsql
security definer
set search_path = public
as $$
declare
  viewer_id uuid;
  already_joined boolean;
begin
  viewer_id := auth.uid();
  if viewer_id is null then
    raise exception 'Unauthorized';
  end if;

  if not public.can_view_event(target_event_id) then
    raise exception 'Event is not visible to current user';
  end if;

  select exists (
    select 1
    from public.event_attendees
    where event_id = target_event_id
      and user_id = viewer_id
  ) into already_joined;

  if already_joined then
    delete from public.event_attendees
    where event_id = target_event_id
      and user_id = viewer_id;
    joined := false;
  else
    insert into public.event_attendees (event_id, user_id)
    values (target_event_id, viewer_id)
    on conflict do nothing;
    joined := true;
  end if;

  select coalesce(counters.attendees_count, 0)::bigint
  into attendees_count
  from public.event_engagement_counters counters
  where counters.event_id = target_event_id;

  attendees_count := coalesce(attendees_count, 0);
  return next;
end;
$$;
create or replace function public.toggle_event_attendance(
  target_event_id uuid,
  client_mutation_id text
)
returns table(joined boolean, attendees_count bigint)
language plpgsql
security definer
set search_path = public
as $$
declare
  existing_response jsonb;
begin
  existing_response := public.read_client_mutation_receipt('toggle_event_attendance', client_mutation_id);
  if existing_response is not null then
    joined := coalesce((existing_response ->> 'joined')::boolean, false);
    attendees_count := coalesce((existing_response ->> 'attendees_count')::bigint, 0);
    return next;
    return;
  end if;

  select result.joined, result.attendees_count
    into joined, attendees_count
  from public.toggle_event_attendance(target_event_id) result;

  perform public.write_client_mutation_receipt(
    'toggle_event_attendance',
    client_mutation_id,
    jsonb_build_object(
      'joined', joined,
      'attendees_count', attendees_count
    )
  );

  return next;
end;
$$;
create or replace function public.toggle_album_photo_like(target_photo_id uuid)
returns table(liked boolean, likes_count bigint)
language plpgsql
security definer
set search_path = public
as $$
declare
  viewer_id uuid;
  already_liked boolean;
begin
  viewer_id := auth.uid();
  if viewer_id is null then
    raise exception 'Unauthorized';
  end if;

  select exists (
    select 1
    from public.album_photo_likes
    where photo_id = target_photo_id
      and user_id = viewer_id
  ) into already_liked;

  if already_liked then
    delete from public.album_photo_likes
    where photo_id = target_photo_id
      and user_id = viewer_id;
    liked := false;
  else
    insert into public.album_photo_likes (photo_id, user_id)
    values (target_photo_id, viewer_id)
    on conflict (photo_id, user_id) do nothing;
    liked := true;
  end if;

  select coalesce(counters.likes_count, 0)::bigint
  into likes_count
  from public.album_engagement_counters counters
  where counters.photo_id = target_photo_id;

  likes_count := coalesce(likes_count, 0);
  return next;
end;
$$;
create or replace function public.create_event_with_patch(
  p_title text,
  p_description text,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_location_name text,
  p_address text,
  p_event_type text,
  p_category text,
  p_categories text[],
  p_fee_label text,
  p_access_label text,
  p_capacity integer,
  p_target_audience text,
  p_level text,
  p_materials text,
  p_cover_image_path text,
  p_visibility public.event_visibility,
  client_mutation_id text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  existing_response jsonb;
  request_viewer_id uuid := auth.uid();
  created_event public.events%rowtype;
begin
  if request_viewer_id is null then
    raise exception 'Unauthorized';
  end if;

  existing_response := public.read_client_mutation_receipt('create_event_with_patch', client_mutation_id);
  if existing_response is not null then
    return existing_response;
  end if;

  insert into public.events (
    club_id,
    title,
    description,
    starts_at,
    ends_at,
    location_name,
    address,
    event_type,
    category,
    categories,
    fee_label,
    access_label,
    capacity,
    target_audience,
    level,
    materials,
    visibility,
    cover_image_path
  )
  values (
    request_viewer_id,
    trim(coalesce(p_title, '')),
    trim(coalesce(p_description, '')),
    p_starts_at,
    p_ends_at,
    trim(coalesce(p_location_name, '')),
    trim(coalesce(p_address, '')),
    nullif(trim(coalesce(p_event_type, '')), ''),
    trim(coalesce(p_category, '')),
    coalesce(p_categories, '{}'::text[]),
    trim(coalesce(p_fee_label, '')),
    trim(coalesce(p_access_label, '')),
    p_capacity,
    nullif(trim(coalesce(p_target_audience, '')), ''),
    nullif(trim(coalesce(p_level, '')), ''),
    nullif(trim(coalesce(p_materials, '')), ''),
    coalesce(p_visibility, 'public'::public.event_visibility),
    nullif(trim(coalesce(p_cover_image_path, '')), '')
  )
  returning * into created_event;

  return public.write_client_mutation_receipt(
    'create_event_with_patch',
    client_mutation_id,
    to_jsonb(created_event)
  );
end;
$$;
create or replace function public.create_event_comment_with_patch(
  target_event_id uuid,
  comment_body text,
  parent_comment_id uuid default null,
  client_mutation_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  existing_response jsonb;
  request_viewer_id uuid := auth.uid();
  created_comment public.event_comments%rowtype;
  parent_event_id uuid;
begin
  if request_viewer_id is null then
    raise exception 'Unauthorized';
  end if;

  existing_response := public.read_client_mutation_receipt('create_event_comment_with_patch', client_mutation_id);
  if existing_response is not null then
    return existing_response;
  end if;

  if parent_comment_id is not null then
    select ec.event_id
    into parent_event_id
    from public.event_comments ec
    where ec.id = parent_comment_id;

    if parent_event_id is null or parent_event_id <> target_event_id then
      raise exception 'Yanit verilen yorum bulunamadi.';
    end if;
  end if;

  insert into public.event_comments (
    event_id,
    user_id,
    parent_id,
    body
  )
  values (
    target_event_id,
    request_viewer_id,
    parent_comment_id,
    trim(coalesce(comment_body, ''))
  )
  returning * into created_comment;

  return public.write_client_mutation_receipt(
    'create_event_comment_with_patch',
    client_mutation_id,
    to_jsonb(created_comment)
  );
end;
$$;
create or replace function public.create_album_photo_with_patch(
  target_event_id uuid,
  target_storage_path text,
  target_media_paths text[] default null,
  target_caption text default null,
  target_title text default null,
  target_show_on_profile boolean default false,
  target_show_on_user_profile boolean default false,
  target_show_on_club_profile boolean default false,
  client_mutation_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  existing_response jsonb;
  request_viewer_id uuid := auth.uid();
  created_photo public.album_photos%rowtype;
  normalized_media_paths text[];
  normalized_storage_path text;
begin
  if request_viewer_id is null then
    raise exception 'Unauthorized';
  end if;

  existing_response := public.read_client_mutation_receipt('create_album_photo_with_patch', client_mutation_id);
  if existing_response is not null then
    return existing_response;
  end if;

  select coalesce(
    array_agg(item) filter (where item is not null and trim(item) <> ''),
    '{}'::text[]
  )
  into normalized_media_paths
  from unnest(coalesce(target_media_paths, array[target_storage_path])) as item;

  normalized_storage_path := coalesce(
    nullif(trim(coalesce(target_storage_path, '')), ''),
    normalized_media_paths[1]
  );

  if normalized_storage_path is null then
    raise exception 'Fotograf secilmedi';
  end if;

  if coalesce(array_length(normalized_media_paths, 1), 0) = 0 then
    normalized_media_paths := array[normalized_storage_path];
  end if;

  insert into public.album_photos (
    event_id,
    user_id,
    storage_path,
    media_paths,
    caption,
    title,
    show_on_profile,
    show_on_user_profile,
    show_on_club_profile
  )
  values (
    target_event_id,
    request_viewer_id,
    normalized_storage_path,
    normalized_media_paths,
    trim(coalesce(target_caption, '')),
    nullif(trim(coalesce(target_title, '')), ''),
    coalesce(target_show_on_profile, false),
    coalesce(target_show_on_user_profile, false),
    coalesce(target_show_on_club_profile, false)
  )
  returning * into created_photo;

  return public.write_client_mutation_receipt(
    'create_album_photo_with_patch',
    client_mutation_id,
    to_jsonb(created_photo)
  );
end;
$$;
create or replace function public.create_album_comment_with_patch(
  target_photo_id uuid,
  comment_body text,
  parent_comment_id uuid default null,
  client_mutation_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  existing_response jsonb;
  request_viewer_id uuid := auth.uid();
  created_comment public.album_photo_comments%rowtype;
  parent_photo_id uuid;
begin
  if request_viewer_id is null then
    raise exception 'Unauthorized';
  end if;

  existing_response := public.read_client_mutation_receipt('create_album_comment_with_patch', client_mutation_id);
  if existing_response is not null then
    return existing_response;
  end if;

  if parent_comment_id is not null then
    select apc.photo_id
    into parent_photo_id
    from public.album_photo_comments apc
    where apc.id = parent_comment_id;

    if parent_photo_id is null or parent_photo_id <> target_photo_id then
      raise exception 'Yanit verilen yorum bulunamadi.';
    end if;
  end if;

  insert into public.album_photo_comments (
    photo_id,
    user_id,
    parent_id,
    body
  )
  values (
    target_photo_id,
    request_viewer_id,
    parent_comment_id,
    trim(coalesce(comment_body, ''))
  )
  returning * into created_comment;

  return public.write_client_mutation_receipt(
    'create_album_comment_with_patch',
    client_mutation_id,
    to_jsonb(created_comment)
  );
end;
$$;
create or replace function public.set_event_comment_like(
  target_comment_id uuid,
  desired_liked boolean,
  client_mutation_id text default null
)
returns table(liked boolean, likes_count bigint)
language plpgsql
security definer
set search_path = public
as $$
declare
  existing_response jsonb;
  normalized_client_mutation_id text := nullif(trim(coalesce(client_mutation_id, '')), '');
  request_viewer_id uuid := auth.uid();
  target_event_id uuid;
begin
  if request_viewer_id is null then
    raise exception 'Unauthorized';
  end if;

  select ec.event_id
  into target_event_id
  from public.event_comments ec
  where ec.id = target_comment_id;

  if target_event_id is null then
    raise exception 'Comment not found';
  end if;

  if not public.can_view_event(target_event_id) then
    raise exception 'Comment is not visible to current user';
  end if;

  if normalized_client_mutation_id is not null then
    existing_response := public.read_client_mutation_receipt(
      'set_event_comment_like',
      normalized_client_mutation_id
    );
    if existing_response is not null then
      liked := coalesce((existing_response ->> 'liked')::boolean, false);
      likes_count := coalesce((existing_response ->> 'likes_count')::bigint, 0);
      return next;
      return;
    end if;
  end if;

  if coalesce(desired_liked, false) then
    insert into public.event_comment_likes (comment_id, user_id)
    values (target_comment_id, request_viewer_id)
    on conflict (comment_id, user_id) do nothing;
  else
    delete from public.event_comment_likes
    where comment_id = target_comment_id
      and user_id = request_viewer_id;
  end if;

  select
    exists (
      select 1
      from public.event_comment_likes ecl
      where ecl.comment_id = target_comment_id
        and ecl.user_id = request_viewer_id
    ),
    count(*)::bigint
  into liked, likes_count
  from public.event_comment_likes
  where comment_id = target_comment_id;

  if normalized_client_mutation_id is not null then
    perform public.write_client_mutation_receipt(
      'set_event_comment_like',
      normalized_client_mutation_id,
      jsonb_build_object(
        'liked', liked,
        'likes_count', likes_count
      )
    );
  end if;

  return next;
end;
$$;
create or replace function public.set_album_comment_like(
  target_comment_id uuid,
  desired_liked boolean,
  client_mutation_id text default null
)
returns table(liked boolean, likes_count bigint)
language plpgsql
security definer
set search_path = public
as $$
declare
  existing_response jsonb;
  normalized_client_mutation_id text := nullif(trim(coalesce(client_mutation_id, '')), '');
  request_viewer_id uuid := auth.uid();
  target_event_id uuid;
begin
  if request_viewer_id is null then
    raise exception 'Unauthorized';
  end if;

  select ap.event_id
  into target_event_id
  from public.album_photo_comments apc
  join public.album_photos ap on ap.id = apc.photo_id
  where apc.id = target_comment_id;

  if target_event_id is null then
    raise exception 'Comment not found';
  end if;

  if not public.can_view_event(target_event_id) then
    raise exception 'Comment is not visible to current user';
  end if;

  if normalized_client_mutation_id is not null then
    existing_response := public.read_client_mutation_receipt(
      'set_album_comment_like',
      normalized_client_mutation_id
    );
    if existing_response is not null then
      liked := coalesce((existing_response ->> 'liked')::boolean, false);
      likes_count := coalesce((existing_response ->> 'likes_count')::bigint, 0);
      return next;
      return;
    end if;
  end if;

  if coalesce(desired_liked, false) then
    insert into public.album_photo_comment_likes (comment_id, user_id)
    values (target_comment_id, request_viewer_id)
    on conflict (comment_id, user_id) do nothing;
  else
    delete from public.album_photo_comment_likes
    where comment_id = target_comment_id
      and user_id = request_viewer_id;
  end if;

  select
    exists (
      select 1
      from public.album_photo_comment_likes apcl
      where apcl.comment_id = target_comment_id
        and apcl.user_id = request_viewer_id
    ),
    count(*)::bigint
  into liked, likes_count
  from public.album_photo_comment_likes
  where comment_id = target_comment_id;

  if normalized_client_mutation_id is not null then
    perform public.write_client_mutation_receipt(
      'set_album_comment_like',
      normalized_client_mutation_id,
      jsonb_build_object(
        'liked', liked,
        'likes_count', likes_count
      )
    );
  end if;

  return next;
end;
$$;
create or replace function public.update_profile_patch(target_patch jsonb default '{}'::jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  viewer_id uuid := auth.uid();
  now_utc timestamptz := timezone('utc', now());
  patch jsonb := coalesce(target_patch, '{}'::jsonb);
  profile_row public.profiles%rowtype;
  next_username text;
  next_email text;
  next_university text;
  next_categories text[];
  next_is_private boolean;
  next_hide_email boolean;
  next_profile_image_path text;
  next_cover_image_path text;
  next_department text;
  next_grade_year text;
  next_bio text;
  next_description text;
  next_name text;
  next_club_name text;
begin
  if viewer_id is null then
    raise exception 'Unauthorized';
  end if;

  select *
  into profile_row
  from public.profiles
  where user_id = viewer_id
    and deleted_at is null
  for update;

  if not found then
    raise exception 'Profile not found';
  end if;

  next_username := case
    when patch ? 'username' then lower(trim(coalesce(patch->>'username', '')))
    else lower(trim(coalesce(profile_row.username, '')))
  end;

  if patch ? 'username' then
    if next_username = '' or char_length(next_username) < 3 or next_username !~ '^[a-z0-9_]+$' then
      raise exception 'Kullanici adi gecersiz';
    end if;

    if exists (
      select 1
      from public.profiles
      where user_id <> viewer_id
        and deleted_at is null
        and lower(username) = next_username
    ) then
      raise exception 'Bu kullanici adi zaten alinmis';
    end if;
  end if;

  next_email := case
    when patch ? 'email' then lower(trim(coalesce(patch->>'email', '')))
    else lower(trim(coalesce(profile_row.email, '')))
  end;

  if patch ? 'email' then
    if next_email = '' then
      raise exception 'E-posta zorunludur';
    end if;

    if exists (
      select 1
      from public.profiles
      where user_id <> viewer_id
        and deleted_at is null
        and lower(email) = next_email
    ) then
      raise exception 'Bu e-posta adresi zaten kullaniliyor';
    end if;
  end if;

  next_university := case
    when patch ? 'university' then coalesce(nullif(trim(coalesce(patch->>'university', '')), ''), 'Belirtilmedi')
    else coalesce(nullif(trim(coalesce(profile_row.university, '')), ''), 'Belirtilmedi')
  end;

  next_categories := case
    when patch ? 'categories' then coalesce(
      array(
        select jsonb_array_elements_text(
          case
            when jsonb_typeof(patch->'categories') = 'array' then patch->'categories'
            else '[]'::jsonb
          end
        )
      ),
      array[]::text[]
    )
    else coalesce(profile_row.categories, array[]::text[])
  end;

  next_is_private := case
    when profile_row.account_type = 'club' then false
    when patch ? 'isPrivate' then coalesce((patch->>'isPrivate')::boolean, false)
    else coalesce(profile_row.is_private, false)
  end;

  next_hide_email := case
    when patch ? 'hideEmail' then coalesce((patch->>'hideEmail')::boolean, false)
    else coalesce(profile_row.hide_email, false)
  end;

  next_profile_image_path := case
    when patch ? 'profileImage' then nullif(trim(coalesce(patch->>'profileImage', '')), '')
    else profile_row.profile_image_path
  end;

  next_cover_image_path := case
    when patch ? 'coverImage' then nullif(trim(coalesce(patch->>'coverImage', '')), '')
    else profile_row.cover_image_path
  end;

  next_department := case
    when patch ? 'department' then nullif(trim(coalesce(patch->>'department', '')), '')
    else profile_row.department
  end;

  next_grade_year := case
    when patch ? 'gradeYear' then nullif(trim(coalesce(patch->>'gradeYear', '')), '')
    else profile_row.grade_year
  end;

  next_bio := case
    when patch ? 'bio' then nullif(trim(coalesce(patch->>'bio', '')), '')
    else profile_row.bio
  end;

  next_description := case
    when patch ? 'description' then nullif(trim(coalesce(patch->>'description', '')), '')
    else profile_row.description
  end;

  if profile_row.account_type = 'club' then
    next_name := null;
    next_club_name := case
      when patch ? 'clubName' then nullif(trim(coalesce(patch->>'clubName', '')), '')
      else profile_row.club_name
    end;
  else
    next_club_name := null;
    next_name := case
      when patch ? 'name' then nullif(trim(coalesce(patch->>'name', '')), '')
      else profile_row.name
    end;
  end if;

  update public.profiles
  set
    username = next_username,
    email = next_email,
    university = next_university,
    categories = next_categories,
    is_private = next_is_private,
    hide_email = next_hide_email,
    profile_image_path = next_profile_image_path,
    cover_image_path = next_cover_image_path,
    department = next_department,
    grade_year = next_grade_year,
    bio = next_bio,
    description = next_description,
    name = next_name,
    club_name = next_club_name,
    updated_at = now_utc,
    updated_by = viewer_id,
    last_activity_at = now_utc,
    sync_version = greatest(coalesce(profile_row.sync_version, 1) + 1, 2)
  where user_id = viewer_id
    and deleted_at is null;
end;
$$;
grant execute on function public.build_mutation_patch_envelope(jsonb, jsonb) to authenticated;
grant execute on function public.normalize_client_mutation_id(text) to authenticated;
grant execute on function public.read_client_mutation_receipt(text, text) to authenticated;
grant execute on function public.write_client_mutation_receipt(text, text, jsonb) to authenticated;
grant execute on function public.toggle_follow_with_patch(uuid) to authenticated;
grant execute on function public.toggle_follow_with_patch(uuid, text) to authenticated;
grant execute on function public.toggle_club_membership_with_patch(uuid) to authenticated;
grant execute on function public.respond_follow_request_with_patch(uuid, text) to authenticated;
grant execute on function public.respond_follow_request_with_patch(uuid, text, text) to authenticated;
grant execute on function public.respond_membership_request_with_patch(uuid, uuid, text) to authenticated;
grant execute on function public.remove_club_member_with_patch(uuid, uuid) to authenticated;
grant execute on function public.mark_notification_read_with_patch(uuid) to authenticated;
grant execute on function public.mark_notification_read_with_patch(uuid, text) to authenticated;
grant execute on function public.mark_notifications_read_all_with_patch() to authenticated;
grant execute on function public.mark_notifications_read_all_with_patch(text) to authenticated;
grant execute on function public.block_user_with_patch(text) to authenticated;
grant execute on function public.block_user_with_patch(text, text) to authenticated;
grant execute on function public.unblock_user_with_patch(text) to authenticated;
grant execute on function public.unblock_user_with_patch(text, text) to authenticated;
grant execute on function public.set_follow_status_with_patch(uuid, text, text) to authenticated;
grant execute on function public.toggle_event_like(uuid) to authenticated;
grant execute on function public.toggle_event_like(uuid, text) to authenticated;
grant execute on function public.toggle_event_attendance(uuid) to authenticated;
grant execute on function public.toggle_event_attendance(uuid, text) to authenticated;
grant execute on function public.toggle_album_photo_like(uuid) to authenticated;
grant execute on function public.create_event_with_patch(text, text, timestamptz, timestamptz, text, text, text, text, text[], text, text, integer, text, text, text, text, public.event_visibility, text) to authenticated;
grant execute on function public.create_event_comment_with_patch(uuid, text, uuid, text) to authenticated;
grant execute on function public.create_album_photo_with_patch(uuid, text, text[], text, text, boolean, boolean, boolean, text) to authenticated;
grant execute on function public.create_album_comment_with_patch(uuid, text, uuid, text) to authenticated;
grant execute on function public.set_event_comment_like(uuid, boolean, text) to authenticated;
grant execute on function public.set_album_comment_like(uuid, boolean, text) to authenticated;
grant execute on function public.update_profile_patch(jsonb) to authenticated;
