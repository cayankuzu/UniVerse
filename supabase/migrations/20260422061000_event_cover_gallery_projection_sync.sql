alter table public.events
  add column if not exists cover_image_paths text[] not null default '{}'::text[];
create or replace function public.normalize_event_cover_image_paths(
  primary_path text,
  gallery_paths text[] default null
)
returns text[]
language sql
immutable
as $$
  with candidate_paths as (
    select nullif(trim(coalesce(primary_path, '')), '') as path, 0::bigint as ord
    union all
    select nullif(trim(item), '') as path, ordinality::bigint as ord
    from unnest(coalesce(gallery_paths, '{}'::text[])) with ordinality as items(item, ordinality)
  ),
  deduped_paths as (
    select path, min(ord) as first_ord
    from candidate_paths
    where path is not null
    group by path
  )
  select coalesce(
    array(
      select path
      from deduped_paths
      order by first_ord
      limit 3
    ),
    '{}'::text[]
  );
$$;
update public.events
set cover_image_paths = public.normalize_event_cover_image_paths(cover_image_path, cover_image_paths)
where cover_image_paths is distinct from public.normalize_event_cover_image_paths(cover_image_path, cover_image_paths);
create or replace function public.get_event_cover_image_paths(target_event_id uuid)
returns text[]
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select public.normalize_event_cover_image_paths(e.cover_image_path, e.cover_image_paths)
      from public.events e
      where e.id = target_event_id
        and e.deleted_at is null
      limit 1
    ),
    '{}'::text[]
  );
$$;
create or replace function public.append_event_cover_gallery(
  base_event jsonb,
  target_event_id uuid
)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(base_event, '{}'::jsonb)
    || jsonb_build_object(
      'cover_image_paths', to_jsonb(resolved.paths),
      'images', to_jsonb(resolved.paths)
    )
  from (
    select public.get_event_cover_image_paths(target_event_id) as paths
  ) resolved;
$$;
create or replace function public.enrich_event_projection_item(
  item jsonb,
  target_field text default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  normalized_target_field text := nullif(trim(coalesce(target_field, '')), '');
  target_event_id uuid;
  target_payload jsonb;
begin
  if item is null then
    return '{}'::jsonb;
  end if;

  if normalized_target_field is null then
    target_event_id := nullif(item ->> 'id', '')::uuid;
    if target_event_id is null then
      return item;
    end if;
    return public.append_event_cover_gallery(item, target_event_id);
  end if;

  target_payload := item -> normalized_target_field;
  target_event_id := nullif(coalesce(target_payload ->> 'id', ''), '')::uuid;
  if target_event_id is null or target_payload is null then
    return item;
  end if;

  return item || jsonb_build_object(
    normalized_target_field,
    public.append_event_cover_gallery(target_payload, target_event_id)
  );
end;
$$;
create or replace function public.enrich_event_projection_items(
  items jsonb,
  target_field text default null
)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select jsonb_agg(public.enrich_event_projection_item(value, target_field) order by ordinality)
      from jsonb_array_elements(coalesce(items, '[]'::jsonb)) with ordinality as expanded(value, ordinality)
    ),
    '[]'::jsonb
  );
$$;
create or replace function public.enrich_event_projection_envelope(
  envelope jsonb,
  target_field text default null
)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with normalized as (
    select coalesce(envelope, '{}'::jsonb) as payload
  )
  select payload
    || jsonb_build_object(
      'items',
      public.enrich_event_projection_items(payload -> 'items', target_field),
      'updated_items',
      public.enrich_event_projection_items(payload -> 'updated_items', target_field)
    )
  from normalized;
$$;
create or replace function public.can_view_media_object(
  target_object_path text,
  viewer_id uuid default auth.uid()
)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  normalized_path text := btrim(coalesce(target_object_path, ''));
  resolved_viewer_id uuid := viewer_id;
  asset_owner_id uuid;
  asset_visibility public.media_visibility;
  target_profile_id uuid;
  target_event_id uuid;
  target_event_club_id uuid;
  target_event_visibility public.event_visibility;
  target_club_is_private boolean := false;
  target_photo_id uuid;
  target_uploader_id uuid;
  target_uploader_is_private boolean := false;
  album_show_on_profile boolean := false;
  album_show_on_user_profile boolean := false;
  album_show_on_club_profile boolean := false;
  viewer_follows_club boolean := false;
  viewer_follows_uploader boolean := false;
  viewer_is_event_attendee boolean := false;
  viewer_owns_photo boolean := false;
  can_view_uploader_profile boolean := false;
  can_view_club_profile boolean := false;
  event_discoverable boolean := false;
  event_album_openable boolean := false;
begin
  if normalized_path = '' then
    return false;
  end if;

  select ma.owner_id, ma.visibility
    into asset_owner_id, asset_visibility
  from public.media_assets ma
  where ma.bucket_id = 'make-e3557d40-media'
    and ma.object_path = normalized_path
  limit 1;

  if asset_owner_id is not null and resolved_viewer_id is not null and asset_owner_id = resolved_viewer_id then
    return true;
  end if;

  if asset_visibility = 'public'::public.media_visibility then
    return true;
  end if;

  select p.user_id
    into target_profile_id
  from public.profiles p
  where p.deleted_at is null
    and (p.profile_image_path = normalized_path or p.cover_image_path = normalized_path)
  limit 1;

  if target_profile_id is not null then
    if resolved_viewer_id is not null and public.is_blocked_pair(resolved_viewer_id, target_profile_id) then
      return false;
    end if;
    return true;
  end if;

  select e.id, e.club_id, e.visibility, club.is_private
    into target_event_id, target_event_club_id, target_event_visibility, target_club_is_private
  from public.events e
  join public.profiles club on club.user_id = e.club_id
  where e.deleted_at is null
    and club.deleted_at is null
    and normalized_path = any(public.normalize_event_cover_image_paths(e.cover_image_path, e.cover_image_paths))
  limit 1;

  if target_event_id is not null then
    if resolved_viewer_id is not null and public.is_blocked_pair(resolved_viewer_id, target_event_club_id) then
      return false;
    end if;

    if resolved_viewer_id is not null and resolved_viewer_id = target_event_club_id then
      return true;
    end if;

    if resolved_viewer_id is not null then
      viewer_follows_club := public.is_accepted_follower(resolved_viewer_id, target_event_club_id);
      select exists (
        select 1 from public.event_attendees ea where ea.event_id = target_event_id and ea.user_id = resolved_viewer_id
      ) into viewer_is_event_attendee;
    end if;

    if coalesce(target_club_is_private, false) then
      return coalesce(viewer_follows_club or viewer_is_event_attendee, false);
    end if;

    return true;
  end if;

  select ap.id, ap.user_id, ap.event_id, e.club_id, e.visibility, uploader.is_private, club.is_private,
         coalesce(ap.show_on_profile, false),
         coalesce(ap.show_on_user_profile, ap.show_on_profile, false),
         coalesce(ap.show_on_club_profile, ap.show_on_profile, false)
    into target_photo_id, target_uploader_id, target_event_id, target_event_club_id,
         target_event_visibility, target_uploader_is_private, target_club_is_private,
         album_show_on_profile, album_show_on_user_profile, album_show_on_club_profile
  from public.album_photos ap
  join public.events e on e.id = ap.event_id
  join public.profiles uploader on uploader.user_id = ap.user_id
  join public.profiles club on club.user_id = e.club_id
  where ap.deleted_at is null and e.deleted_at is null and uploader.deleted_at is null and club.deleted_at is null
    and (ap.storage_path = normalized_path or normalized_path = any(coalesce(ap.media_paths, array[ap.storage_path])))
  limit 1;

  if target_photo_id is null then
    return false;
  end if;

  if resolved_viewer_id is not null and (
    public.is_blocked_pair(resolved_viewer_id, target_uploader_id)
    or public.is_blocked_pair(resolved_viewer_id, target_event_club_id)
  ) then
    return false;
  end if;

  viewer_owns_photo := resolved_viewer_id is not null and resolved_viewer_id = target_uploader_id;
  if viewer_owns_photo or (resolved_viewer_id is not null and resolved_viewer_id = target_event_club_id) then
    return true;
  end if;

  if resolved_viewer_id is not null then
    viewer_follows_club := public.is_accepted_follower(resolved_viewer_id, target_event_club_id);
    viewer_follows_uploader := resolved_viewer_id <> target_uploader_id and public.is_accepted_follower(resolved_viewer_id, target_uploader_id);
    select exists (
      select 1 from public.event_attendees ea where ea.event_id = target_event_id and ea.user_id = resolved_viewer_id
    ) into viewer_is_event_attendee;
  end if;

  if coalesce(target_club_is_private, false) then
    event_discoverable := coalesce(viewer_follows_club or viewer_is_event_attendee, false);
  else
    event_discoverable := true;
  end if;

  event_album_openable := event_discoverable and (
    target_event_visibility <> 'members_only'::public.event_visibility
    or viewer_follows_club
    or viewer_is_event_attendee
  );

  can_view_uploader_profile := album_show_on_user_profile and (
    not coalesce(target_uploader_is_private, false)
    or viewer_owns_photo
    or viewer_follows_uploader
  );

  can_view_club_profile := album_show_on_club_profile and (
    not coalesce(target_club_is_private, false)
    or viewer_follows_club
  );

  if event_discoverable and (
    album_show_on_club_profile
    or (album_show_on_user_profile and (not coalesce(target_uploader_is_private, false) or viewer_follows_uploader))
  ) then
    return true;
  end if;

  if event_discoverable and album_show_on_profile and not coalesce(target_uploader_is_private, false) then
    return true;
  end if;

  if event_album_openable and (
    album_show_on_club_profile or (album_show_on_user_profile and not coalesce(target_uploader_is_private, false))
  ) then
    return true;
  end if;

  if event_discoverable and (can_view_uploader_profile or can_view_club_profile) then
    return true;
  end if;

  return false;
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
  p_cover_image_paths text[],
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
  normalized_mutation_id text := public.normalize_client_mutation_id($19);
  normalized_cover_image_paths text[] := public.normalize_event_cover_image_paths(
    p_cover_image_path,
    p_cover_image_paths
  );
begin
  if request_viewer_id is null then
    raise exception 'Unauthorized';
  end if;

  existing_response := public.read_client_mutation_receipt(
    'create_event_with_patch',
    normalized_mutation_id
  );
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
    cover_image_path,
    cover_image_paths
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
    normalized_cover_image_paths[1],
    normalized_cover_image_paths
  )
  returning * into created_event;

  return public.write_client_mutation_receipt(
    'create_event_with_patch',
    normalized_mutation_id,
    to_jsonb(created_event)
  );
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
  normalized_cover_image_path text := nullif(trim(coalesce(p_cover_image_path, '')), '');
begin
  return public.create_event_with_patch(
    p_title,
    p_description,
    p_starts_at,
    p_ends_at,
    p_location_name,
    p_address,
    p_event_type,
    p_category,
    p_categories,
    p_fee_label,
    p_access_label,
    p_capacity,
    p_target_audience,
    p_level,
    p_materials,
    normalized_cover_image_path,
    case
      when normalized_cover_image_path is null then null
      else array[normalized_cover_image_path]
    end,
    p_visibility,
    client_mutation_id
  );
end;
$$;
create or replace function public.event_detail_projection_v2(
  viewer_id uuid default null,
  target_event_id uuid default null,
  since timestamptz default null
)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select public.enrich_event_projection_envelope(
    public.event_detail_projection(viewer_id, target_event_id, since),
    'event'
  );
$$;
create or replace function public.event_detail_projection_v2(
  viewer_id uuid,
  target_event_id uuid,
  since timestamptz,
  delta_token text
)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select public.enrich_event_projection_envelope(
    public.event_detail_projection(
      viewer_id,
      target_event_id,
      since,
      delta_token
    ),
    'event'
  );
$$;
create or replace function public.home_feed_projection_v2(
  viewer_id uuid default null,
  cursor text default null,
  limit_count integer default 30,
  since timestamptz default null,
  source_filter text default 'all',
  type_filter text default 'all',
  entity_filter text default 'all',
  sort_mode text default 'newest'
)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select public.enrich_event_projection_envelope(
    public.home_feed_projection(
      viewer_id,
      cursor,
      limit_count,
      since,
      source_filter,
      type_filter,
      entity_filter,
      sort_mode
    ),
    'event'
  );
$$;
create or replace function public.home_feed_projection_v2(
  viewer_id uuid,
  cursor text,
  limit_count integer,
  since timestamptz,
  source_filter text,
  type_filter text,
  entity_filter text,
  sort_mode text,
  delta_token text
)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select public.enrich_event_projection_envelope(
    public.home_feed_projection(
      viewer_id,
      cursor,
      limit_count,
      since,
      source_filter,
      type_filter,
      entity_filter,
      sort_mode,
      delta_token
    ),
    'event'
  );
$$;
create or replace function public.profile_content_projection_v2(
  viewer_id uuid default null,
  target_username text default null,
  tab_name text default 'album',
  cursor text default null,
  limit_count integer default 24,
  since timestamptz default null
)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select case
    when lower(trim(coalesce(tab_name, 'album'))) = 'events'
      then public.enrich_event_projection_envelope(
        public.profile_content_projection(
          viewer_id,
          target_username,
          tab_name,
          cursor,
          limit_count,
          since
        ),
        null
      )
    else public.profile_content_projection(
      viewer_id,
      target_username,
      tab_name,
      cursor,
      limit_count,
      since
    )
  end;
$$;
create or replace function public.profile_content_projection_v2(
  viewer_id uuid,
  target_username text,
  tab_name text,
  cursor text,
  limit_count integer,
  since timestamptz,
  delta_token text
)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select case
    when lower(trim(coalesce(tab_name, 'album'))) = 'events'
      then public.enrich_event_projection_envelope(
        public.profile_content_projection(
          viewer_id,
          target_username,
          tab_name,
          cursor,
          limit_count,
          since,
          delta_token
        ),
        null
      )
    else public.profile_content_projection(
      viewer_id,
      target_username,
      tab_name,
      cursor,
      limit_count,
      since,
      delta_token
    )
  end;
$$;
create or replace function public.search_results_projection_v2(
  viewer_id uuid default null,
  kind_name text default 'events',
  query_text text default '',
  category_filter text default null,
  university_filter text default null,
  fee_filter text default null,
  visibility_filter text default null,
  sort_mode text default 'newest',
  cursor text default null,
  limit_count integer default 20,
  since timestamptz default null
)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select case
    when lower(trim(coalesce(kind_name, 'events'))) = 'events'
      then public.enrich_event_projection_envelope(
        public.search_results_projection(
          viewer_id,
          kind_name,
          query_text,
          category_filter,
          university_filter,
          fee_filter,
          visibility_filter,
          sort_mode,
          cursor,
          limit_count,
          since
        ),
        null
      )
    else public.search_results_projection(
      viewer_id,
      kind_name,
      query_text,
      category_filter,
      university_filter,
      fee_filter,
      visibility_filter,
      sort_mode,
      cursor,
      limit_count,
      since
    )
  end;
$$;
create or replace function public.search_results_projection_v2(
  viewer_id uuid,
  kind_name text,
  query_text text,
  category_filter text,
  university_filter text,
  fee_filter text,
  visibility_filter text,
  sort_mode text,
  cursor text,
  limit_count integer,
  since timestamptz,
  delta_token text
)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select case
    when lower(trim(coalesce(kind_name, 'events'))) = 'events'
      then public.enrich_event_projection_envelope(
        public.search_results_projection(
          viewer_id,
          kind_name,
          query_text,
          category_filter,
          university_filter,
          fee_filter,
          visibility_filter,
          sort_mode,
          cursor,
          limit_count,
          since,
          delta_token
        ),
        null
      )
    else public.search_results_projection(
      viewer_id,
      kind_name,
      query_text,
      category_filter,
      university_filter,
      fee_filter,
      visibility_filter,
      sort_mode,
      cursor,
      limit_count,
      since,
      delta_token
    )
  end;
$$;
create or replace function public.profile_screen_projection(
  viewer_id uuid default null,
  target_username text default null,
  tab_name text default 'album',
  cursor text default null,
  limit_count integer default 24,
  since timestamptz default null,
  delta_token text default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  resolved_viewer_id uuid := auth.uid();
  resolved_since timestamptz := public.resolve_projection_since(since, delta_token);
  overview_payload jsonb := public.profile_overview_projection(
    resolved_viewer_id,
    target_username,
    resolved_since
  );
  overview_item jsonb := overview_payload -> 'items' -> 0;
  should_fetch_content boolean := coalesce(
    nullif(overview_item -> 'capabilities' ->> 'canViewContent', '')::boolean,
    false
  ) or tab_name = 'members';
  content_payload jsonb := public.build_projection_envelope(
    items := '[]'::jsonb,
    server_time := timezone('utc', now()),
    delta_token := timezone('utc', now())
  );
begin
  if overview_item is null then
    return public.build_projection_envelope(
      items := '[]'::jsonb,
      server_time := timezone('utc', now()),
      delta_token := timezone('utc', now())
    );
  end if;

  if should_fetch_content then
    content_payload := public.profile_content_projection_v2(
      resolved_viewer_id,
      target_username,
      tab_name,
      cursor,
      limit_count,
      since,
      delta_token
    );
  end if;

  return jsonb_build_object(
    'items',
    jsonb_build_array(
      jsonb_build_object(
        'id', coalesce(overview_item ->> 'id', lower(trim(coalesce(target_username, '')))),
        'username', coalesce(overview_item ->> 'username', lower(trim(coalesce(target_username, '')))),
        'overview', overview_item,
        'contentItems', coalesce(content_payload -> 'items', '[]'::jsonb)
      )
    ),
    'updated_items', '[]'::jsonb,
    'deleted_ids', coalesce(content_payload -> 'deleted_ids', '[]'::jsonb),
    'next_cursor', content_payload -> 'next_cursor',
    'server_time', coalesce(
      content_payload -> 'server_time',
      overview_payload -> 'server_time',
      to_jsonb(timezone('utc', now()))
    ),
    'delta_token', coalesce(
      content_payload -> 'delta_token',
      overview_payload -> 'delta_token',
      to_jsonb(timezone('utc', now()))
    )
  );
end;
$$;
create or replace function public.app_warmup_projection(
  viewer_id uuid default null,
  viewer_username text default null,
  search_scope text default null,
  search_kind_name text default null,
  search_query_text text default null,
  search_category_filter text default null,
  search_university_filter text default null,
  search_fee_filter text default null,
  search_sort_mode text default 'newest'
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
set statement_timeout = '3s'
as $$
declare
  resolved_viewer_id uuid := auth.uid();
  resolved_viewer_username text := nullif(lower(trim(coalesce(viewer_username, ''))), '');
  emitted_at timestamptz := timezone('utc', now());
  home_payload jsonb;
  badge_count integer := 0;
  viewer_relationship_snapshot_payload jsonb := null;
begin
  if resolved_viewer_username is null and resolved_viewer_id is not null then
    select nullif(lower(trim(p.username)), '')
    into resolved_viewer_username
    from public.profiles p
    where p.user_id = resolved_viewer_id
    limit 1;
  end if;

  home_payload := public.home_feed_projection_v2(
    resolved_viewer_id,
    null,
    8,
    null,
    'all',
    'all',
    'all',
    'newest',
    null
  );

  if resolved_viewer_id is not null or resolved_viewer_username is not null then
    viewer_relationship_snapshot_payload := public.relationship_snapshot_projection(
      resolved_viewer_id,
      resolved_viewer_username
    );
  end if;

  select count(*)
  into badge_count
  from public.notifications n
  where n.user_id = resolved_viewer_id
    and n.is_read = false
    and n.deleted_at is null;

  return jsonb_build_object(
    'generatedAt', emitted_at,
    'homeScope', 'all:all:all:newest',
    'profileUsername', coalesce(resolved_viewer_username, ''),
    'home', home_payload,
    'notificationBadge', jsonb_build_object(
      'id', 'notifications',
      'unreadCount', coalesce(badge_count, 0)
    ),
    'notifications', jsonb_build_object(
      'items', '[]'::jsonb,
      'nextCursor', null,
      'serverTime', emitted_at,
      'deltaToken', emitted_at
    ),
    'viewerRelationshipSnapshot', viewer_relationship_snapshot_payload
  );
end;
$$;
grant execute on function public.create_event_with_patch(
  text,
  text,
  timestamptz,
  timestamptz,
  text,
  text,
  text,
  text,
  text[],
  text,
  text,
  integer,
  text,
  text,
  text,
  text,
  public.event_visibility,
  text
) to authenticated;
grant execute on function public.create_event_with_patch(
  text,
  text,
  timestamptz,
  timestamptz,
  text,
  text,
  text,
  text,
  text[],
  text,
  text,
  integer,
  text,
  text,
  text,
  text,
  text[],
  public.event_visibility,
  text
) to authenticated;
grant execute on function public.event_detail_projection_v2(uuid, uuid, timestamptz) to authenticated;
grant execute on function public.event_detail_projection_v2(uuid, uuid, timestamptz, text) to authenticated;
grant execute on function public.home_feed_projection_v2(uuid, text, integer, timestamptz, text, text, text, text) to authenticated;
grant execute on function public.home_feed_projection_v2(uuid, text, integer, timestamptz, text, text, text, text, text) to authenticated;
grant execute on function public.profile_content_projection_v2(uuid, text, text, text, integer, timestamptz) to authenticated;
grant execute on function public.profile_content_projection_v2(uuid, text, text, text, integer, timestamptz, text) to authenticated;
grant execute on function public.search_results_projection_v2(uuid, text, text, text, text, text, text, text, text, integer, timestamptz) to authenticated;
grant execute on function public.search_results_projection_v2(uuid, text, text, text, text, text, text, text, text, integer, timestamptz, text) to authenticated;
