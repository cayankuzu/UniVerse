-- Canonical baseline migration.
-- Consolidated final read-model and projection surface layer.

create or replace function public.get_profile_summary(target_profile_id uuid)
returns table(
  user_id uuid,
  username text,
  account_type public.account_type,
  email text,
  university text,
  categories text[],
  profile_image_path text,
  cover_image_path text,
  is_private boolean,
  hide_email boolean,
  hide_members_list boolean,
  hide_joined_clubs boolean,
  created_at timestamptz,
  followers_count bigint,
  following_count bigint,
  members_count bigint,
  albums_count bigint,
  events_count bigint,
  clubs_count bigint,
  name text,
  department text,
  grade_year text,
  bio text,
  club_name text,
  description text
)
language sql
stable
security definer
set search_path = public
as $$
  with caps as (
    select *
    from public.get_profile_capabilities(target_profile_id)
  )
  select
    p.user_id,
    p.username,
    p.account_type,
    p.email,
    p.university,
    p.categories,
    p.profile_image_path,
    p.cover_image_path,
    p.is_private,
    coalesce(p.hide_email, false) as hide_email,
    false as hide_members_list,
    false as hide_joined_clubs,
    p.created_at,
    (
      select count(*)::bigint
      from public.follows f
      where f.following_id = p.user_id
        and f.status = 'accepted'::public.follow_status
        and f.deleted_at is null
    ) as followers_count,
    (
      select count(*)::bigint
      from public.follows f
      where f.follower_id = p.user_id
        and f.status = 'accepted'::public.follow_status
        and f.deleted_at is null
    ) as following_count,
    0::bigint as members_count,
    case
      when p.account_type = 'club' then (
        select count(*)::bigint
        from public.album_photos ap
        join public.events e on e.id = ap.event_id
        where e.club_id = p.user_id
          and e.deleted_at is null
          and ap.deleted_at is null
      )
      else (
        select count(*)::bigint
        from public.album_photos ap
        where ap.user_id = p.user_id
          and ap.deleted_at is null
      )
    end as albums_count,
    case
      when p.account_type = 'club' then (
        select count(*)::bigint
        from public.events e
        where e.club_id = p.user_id
          and e.deleted_at is null
      )
      else (
        select count(*)::bigint
        from public.event_attendees ea
        where ea.user_id = p.user_id
      )
    end as events_count,
    0::bigint as clubs_count,
    p.name,
    p.department,
    p.grade_year,
    p.bio,
    p.club_name,
    p.description
  from public.profiles p
  join caps on caps.can_view_header
  where p.user_id = target_profile_id
    and p.deleted_at is null;
$$;
create or replace function public.list_visible_events(filter_mode text default 'all')
returns table(
  id uuid,
  club_user_id uuid,
  club_username text,
  club_name text,
  club_image text,
  university text,
  title text,
  description text,
  cover_image_path text,
  starts_at timestamptz,
  ends_at timestamptz,
  location_name text,
  address text,
  event_type text,
  category text,
  categories text[],
  fee_label text,
  access_label text,
  capacity integer,
  target_audience text,
  level text,
  materials text,
  visibility public.event_visibility,
  created_at timestamptz,
  likes_count bigint,
  liked boolean,
  attendees_count bigint,
  joined boolean,
  comments_count bigint,
  club_is_private boolean,
  effective_visibility text,
  discoverable boolean,
  openable boolean,
  joinable boolean,
  attendees_viewable boolean,
  album_openable boolean,
  album_uploadable boolean,
  ended boolean,
  locked_reason_code text,
  locked_reason_text text
)
language sql
stable
security definer
set search_path = public
as $$
  with viewer as (
    select auth.uid() as uid
  ),
  follows_filter as (
    select f.following_id as club_id
    from public.follows f
    join viewer v on v.uid is not null and f.follower_id = v.uid
    where f.status = 'accepted'::public.follow_status
      and f.deleted_at is null
  )
  select row_data.*
  from public.events e
  cross join lateral public.get_event_view_row(e.id) row_data
  where e.deleted_at is null
    and row_data.discoverable
    and (
      filter_mode = 'all'
      or (
        filter_mode in ('following', 'member')
        and (
          e.club_id in (select club_id from follows_filter)
          or e.club_id = (select uid from viewer)
        )
      )
      or (filter_mode in ('myEvents', 'own') and e.club_id = (select uid from viewer))
    )
  order by row_data.created_at desc;
$$;
create or replace function public.list_home_feed_events_for_viewer(target_viewer_id uuid default null)
returns table(
  id uuid,
  club_user_id uuid,
  club_username text,
  club_name text,
  club_image text,
  university text,
  title text,
  description text,
  cover_image_path text,
  starts_at timestamptz,
  ends_at timestamptz,
  location_name text,
  address text,
  event_type text,
  category text,
  categories text[],
  fee_label text,
  access_label text,
  capacity integer,
  target_audience text,
  level text,
  materials text,
  visibility public.event_visibility,
  created_at timestamptz,
  likes_count bigint,
  liked boolean,
  attendees_count bigint,
  joined boolean,
  comments_count bigint,
  club_is_private boolean,
  effective_visibility text,
  discoverable boolean,
  openable boolean,
  joinable boolean,
  attendees_viewable boolean,
  album_openable boolean,
  album_uploadable boolean,
  ended boolean,
  locked_reason_code text,
  locked_reason_text text,
  feed_actor_type text,
  feed_actor_username text,
  feed_source text
)
language sql
stable
security definer
set search_path = public
as $$
  with viewer as (
    select coalesce(target_viewer_id, auth.uid()) as uid
  ),
  viewer_profile as (
    select p.user_id, p.username, p.account_type
    from public.profiles p
    join viewer v on v.uid = p.user_id
    where p.deleted_at is null
  ),
  accepted_follows as (
    select f.following_id
    from public.follows f
    join viewer v on v.uid is not null and f.follower_id = v.uid
    where f.status = 'accepted'::public.follow_status
      and f.deleted_at is null
  ),
  followed_profiles as (
    select p.user_id, p.username, p.account_type
    from public.profiles p
    where p.user_id in (select following_id from accepted_follows)
      and p.deleted_at is null
  ),
  following_clubs as (
    select fp.user_id as club_id, fp.username
    from followed_profiles fp
    where fp.account_type = 'club'
  ),
  following_students as (
    select fp.user_id as student_id, fp.username
    from followed_profiles fp
    where fp.account_type = 'student'
  ),
  own_club_events as (
    select
      row_data.*,
      'club'::text as feed_actor_type,
      vp.username as feed_actor_username,
      'own'::text as feed_source,
      1 as priority
    from viewer_profile vp
    join public.events e on e.club_id = vp.user_id
    cross join lateral public.get_event_view_row(e.id) row_data
    where vp.account_type = 'club'
      and e.deleted_at is null
      and row_data.openable
  ),
  following_club_events as (
    select
      row_data.*,
      'club'::text as feed_actor_type,
      fc.username as feed_actor_username,
      'following_club'::text as feed_source,
      2 as priority
    from following_clubs fc
    join public.events e on e.club_id = fc.club_id
    cross join lateral public.get_event_view_row(e.id) row_data
    where e.deleted_at is null
      and row_data.discoverable
  ),
  following_student_events as (
    select distinct on (row_data.id, fs.student_id)
      row_data.*,
      'student'::text as feed_actor_type,
      fs.username as feed_actor_username,
      'following_student'::text as feed_source,
      3 as priority
    from following_students fs
    join public.event_attendees ea on ea.user_id = fs.student_id
    join public.events e on e.id = ea.event_id
    cross join lateral public.get_event_view_row(e.id) row_data
    where e.deleted_at is null
      and row_data.discoverable
    order by row_data.id, fs.student_id, row_data.created_at desc
  ),
  candidates as (
    select * from own_club_events
    union all
    select * from following_club_events
    union all
    select * from following_student_events
  ),
  deduped as (
    select distinct on (c.id)
      c.*
    from candidates c
    order by c.id, c.priority asc, c.created_at desc
  )
  select
    d.id,
    d.club_user_id,
    d.club_username,
    d.club_name,
    d.club_image,
    d.university,
    d.title,
    d.description,
    d.cover_image_path,
    d.starts_at,
    d.ends_at,
    d.location_name,
    d.address,
    d.event_type,
    d.category,
    d.categories,
    d.fee_label,
    d.access_label,
    d.capacity,
    d.target_audience,
    d.level,
    d.materials,
    d.visibility,
    d.created_at,
    d.likes_count,
    d.liked,
    d.attendees_count,
    d.joined,
    d.comments_count,
    d.club_is_private,
    d.effective_visibility,
    d.discoverable,
    d.openable,
    d.joinable,
    d.attendees_viewable,
    d.album_openable,
    d.album_uploadable,
    d.ended,
    d.locked_reason_code,
    d.locked_reason_text,
    d.feed_actor_type,
    d.feed_actor_username,
    d.feed_source
  from deduped d
  order by d.created_at desc;
$$;
create or replace function public.list_home_feed_events()
returns table(
  id uuid,
  club_user_id uuid,
  club_username text,
  club_name text,
  club_image text,
  university text,
  title text,
  description text,
  cover_image_path text,
  starts_at timestamptz,
  ends_at timestamptz,
  location_name text,
  address text,
  event_type text,
  category text,
  categories text[],
  fee_label text,
  access_label text,
  capacity integer,
  target_audience text,
  level text,
  materials text,
  visibility public.event_visibility,
  created_at timestamptz,
  likes_count bigint,
  liked boolean,
  attendees_count bigint,
  joined boolean,
  comments_count bigint,
  club_is_private boolean,
  effective_visibility text,
  discoverable boolean,
  openable boolean,
  joinable boolean,
  attendees_viewable boolean,
  album_openable boolean,
  album_uploadable boolean,
  ended boolean,
  locked_reason_code text,
  locked_reason_text text,
  feed_actor_type text,
  feed_actor_username text,
  feed_source text
)
language sql
stable
security definer
set search_path = public
as $$
  select *
  from public.list_home_feed_events_for_viewer(auth.uid());
$$;
create or replace function public.list_profile_visible_events(target_profile_id uuid)
returns table(
  id uuid,
  club_user_id uuid,
  club_username text,
  club_name text,
  club_image text,
  university text,
  title text,
  description text,
  cover_image_path text,
  starts_at timestamptz,
  ends_at timestamptz,
  location_name text,
  address text,
  event_type text,
  category text,
  categories text[],
  fee_label text,
  access_label text,
  capacity integer,
  target_audience text,
  level text,
  materials text,
  visibility public.event_visibility,
  created_at timestamptz,
  likes_count bigint,
  liked boolean,
  attendees_count bigint,
  joined boolean,
  comments_count bigint,
  club_is_private boolean,
  effective_visibility text,
  discoverable boolean,
  openable boolean,
  joinable boolean,
  attendees_viewable boolean,
  album_openable boolean,
  album_uploadable boolean,
  ended boolean,
  locked_reason_code text,
  locked_reason_text text
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  viewer_id uuid := auth.uid();
  target_account_type public.account_type;
  target_is_private boolean := false;
  can_view_target boolean := false;
begin
  select
    p.account_type,
    coalesce(p.is_private, false)
  into
    target_account_type,
    target_is_private
  from public.profiles p
  where p.user_id = target_profile_id
    and p.deleted_at is null;

  if target_account_type is null then
    return;
  end if;

  can_view_target := viewer_id = target_profile_id or public.can_view_profile(target_profile_id);

  if not can_view_target then
    return;
  end if;

  if target_account_type = 'club' then
    return query
    select
      row_data.id,
      row_data.club_user_id,
      row_data.club_username,
      row_data.club_name,
      row_data.club_image,
      row_data.university,
      row_data.title,
      row_data.description,
      row_data.cover_image_path,
      row_data.starts_at,
      row_data.ends_at,
      row_data.location_name,
      row_data.address,
      row_data.event_type,
      row_data.category,
      row_data.categories,
      row_data.fee_label,
      row_data.access_label,
      row_data.capacity,
      row_data.target_audience,
      row_data.level,
      row_data.materials,
      row_data.visibility,
      row_data.created_at,
      row_data.likes_count,
      row_data.liked,
      row_data.attendees_count,
      row_data.joined,
      row_data.comments_count,
      row_data.club_is_private,
      case
        when row_data.visibility = 'members_only' then 'members_only'
        when target_is_private then 'followers_only'
        else 'public'
      end as effective_visibility,
      true as discoverable,
      row_data.openable,
      row_data.joinable,
      row_data.attendees_viewable,
      row_data.album_openable,
      row_data.album_uploadable,
      row_data.ended,
      row_data.locked_reason_code,
      row_data.locked_reason_text
    from public.events e
    cross join lateral public.get_event_view_row(e.id) row_data
    where e.club_id = target_profile_id
      and e.deleted_at is null
    order by row_data.created_at desc;
    return;
  end if;

  return query
  select
    row_data.id,
    row_data.club_user_id,
    row_data.club_username,
    row_data.club_name,
    row_data.club_image,
    row_data.university,
    row_data.title,
    row_data.description,
    row_data.cover_image_path,
    row_data.starts_at,
    row_data.ends_at,
    row_data.location_name,
    row_data.address,
    row_data.event_type,
    row_data.category,
    row_data.categories,
    row_data.fee_label,
    row_data.access_label,
    row_data.capacity,
    row_data.target_audience,
    row_data.level,
    row_data.materials,
    row_data.visibility,
    row_data.created_at,
    row_data.likes_count,
    row_data.liked,
    row_data.attendees_count,
    row_data.joined,
    row_data.comments_count,
    row_data.club_is_private,
    case
      when row_data.visibility = 'members_only' then 'members_only'
      when target_is_private then 'followers_only'
      else 'public'
    end as effective_visibility,
    true as discoverable,
    row_data.openable,
    row_data.joinable,
    row_data.attendees_viewable,
    row_data.album_openable,
    row_data.album_uploadable,
    row_data.ended,
    row_data.locked_reason_code,
    row_data.locked_reason_text
  from public.events e
  join public.event_attendees ea
    on ea.event_id = e.id
   and ea.user_id = target_profile_id
  cross join lateral public.get_event_view_row(e.id) row_data
  where e.deleted_at is null
  order by row_data.created_at desc;
end;
$$;
create or replace function public.list_club_visible_events(target_username text)
returns table(
  id uuid,
  club_user_id uuid,
  club_username text,
  club_name text,
  club_image text,
  university text,
  title text,
  description text,
  cover_image_path text,
  starts_at timestamptz,
  ends_at timestamptz,
  location_name text,
  address text,
  event_type text,
  category text,
  categories text[],
  fee_label text,
  access_label text,
  capacity integer,
  target_audience text,
  level text,
  materials text,
  visibility public.event_visibility,
  created_at timestamptz,
  likes_count bigint,
  liked boolean,
  attendees_count bigint,
  joined boolean,
  comments_count bigint,
  club_is_private boolean,
  effective_visibility text,
  discoverable boolean,
  openable boolean,
  joinable boolean,
  attendees_viewable boolean,
  album_openable boolean,
  album_uploadable boolean,
  ended boolean,
  locked_reason_code text,
  locked_reason_text text
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  normalized_target_username text := lower(trim(coalesce(target_username, '')));
  target_profile_id uuid;
begin
  select p.user_id
  into target_profile_id
  from public.profiles p
  where lower(trim(coalesce(p.username, ''))) = normalized_target_username
    and p.account_type = 'club'
    and p.deleted_at is null
  limit 1;

  if target_profile_id is null then
    return;
  end if;

  return query
  select profile_rows.*
  from public.list_profile_visible_events(target_profile_id) profile_rows
  where profile_rows.club_username = normalized_target_username
  order by profile_rows.created_at desc;
end;
$$;
create or replace function public.get_visible_event(target_event_id uuid)
returns table(
  id uuid,
  club_user_id uuid,
  club_username text,
  club_name text,
  club_image text,
  university text,
  title text,
  description text,
  cover_image_path text,
  starts_at timestamptz,
  ends_at timestamptz,
  location_name text,
  address text,
  event_type text,
  category text,
  categories text[],
  fee_label text,
  access_label text,
  capacity integer,
  target_audience text,
  level text,
  materials text,
  visibility public.event_visibility,
  created_at timestamptz,
  likes_count bigint,
  liked boolean,
  attendees_count bigint,
  joined boolean,
  comments_count bigint,
  club_is_private boolean,
  effective_visibility text,
  discoverable boolean,
  openable boolean,
  joinable boolean,
  attendees_viewable boolean,
  album_openable boolean,
  album_uploadable boolean,
  ended boolean,
  locked_reason_code text,
  locked_reason_text text
)
language sql
stable
security definer
set search_path = public
as $$
  select *
  from public.get_event_view_row(target_event_id) e
  where e.openable;
$$;
create or replace function public.list_visible_albums(
  album_context text default 'feed',
  target_profile_id uuid default null,
  target_event_ids uuid[] default null
)
returns table(
  photo_id uuid,
  event_id uuid,
  storage_path text,
  media_paths text[],
  photo_count integer,
  caption text,
  title text,
  show_on_profile boolean,
  created_at timestamptz,
  uploader_id uuid,
  uploader_username text,
  uploader_name text,
  uploader_university text,
  uploader_image text,
  uploader_is_private boolean,
  club_id uuid,
  club_username text,
  club_name text,
  club_is_private boolean,
  event_title text,
  event_visibility public.event_visibility,
  effective_visibility text,
  likes_count bigint,
  comments_count bigint,
  liked boolean,
  discoverable boolean,
  openable boolean,
  open_event_detail boolean,
  interactable boolean,
  locked_reason_code text,
  locked_reason_text text
)
language sql
stable
security definer
set search_path = public
as $$
  select row_data.*
  from public.album_photos ap
  join public.events e on e.id = ap.event_id
  cross join lateral public.get_album_view_row(ap.id, album_context) row_data
  where ap.deleted_at is null
    and e.deleted_at is null
    and (target_profile_id is null or ap.user_id = target_profile_id)
    and (target_event_ids is null or ap.event_id = any(target_event_ids))
    and (
      lower(coalesce(trim(album_context), 'feed')) = 'profile'
      or coalesce(ap.show_on_profile, false)
    )
    and row_data.discoverable
  order by row_data.created_at desc;
$$;
create or replace function public.list_profile_visible_albums(target_profile_id uuid)
returns table(
  photo_id uuid,
  event_id uuid,
  storage_path text,
  media_paths text[],
  photo_count integer,
  caption text,
  title text,
  show_on_profile boolean,
  created_at timestamptz,
  uploader_id uuid,
  uploader_username text,
  uploader_name text,
  uploader_university text,
  uploader_image text,
  uploader_is_private boolean,
  club_id uuid,
  club_username text,
  club_name text,
  club_is_private boolean,
  event_title text,
  event_visibility public.event_visibility,
  effective_visibility text,
  likes_count bigint,
  comments_count bigint,
  liked boolean,
  discoverable boolean,
  openable boolean,
  open_event_detail boolean,
  interactable boolean,
  locked_reason_code text,
  locked_reason_text text
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  viewer_id uuid := auth.uid();
  target_account_type public.account_type;
  target_is_private boolean := false;
  can_view_target boolean := false;
begin
  select
    p.account_type,
    coalesce(p.is_private, false)
  into
    target_account_type,
    target_is_private
  from public.profiles p
  where p.user_id = target_profile_id
    and p.deleted_at is null;

  if target_account_type is null then
    return;
  end if;

  can_view_target := viewer_id = target_profile_id or public.can_view_profile(target_profile_id);

  if not can_view_target then
    return;
  end if;

  return query
  select
    row_data.photo_id,
    row_data.event_id,
    row_data.storage_path,
    row_data.media_paths,
    row_data.photo_count,
    row_data.caption,
    row_data.title,
    row_data.show_on_profile,
    row_data.created_at,
    row_data.uploader_id,
    row_data.uploader_username,
    row_data.uploader_name,
    row_data.uploader_university,
    row_data.uploader_image,
    row_data.uploader_is_private,
    row_data.club_id,
    row_data.club_username,
    row_data.club_name,
    row_data.club_is_private,
    row_data.event_title,
    row_data.event_visibility,
    case
      when row_data.event_visibility = 'members_only' then 'members_only'
      when target_is_private then 'followers_only'
      else 'public'
    end as effective_visibility,
    true as discoverable,
    row_data.openable,
    row_data.open_event_detail,
    row_data.interactable,
    row_data.locked_reason_code,
    row_data.locked_reason_text
  from public.album_photos ap
  join public.events e
    on e.id = ap.event_id
   and e.deleted_at is null
  cross join lateral public.get_album_view_row(ap.id, 'profile') row_data
  where ap.deleted_at is null
    and (
      (
        target_account_type = 'club'
        and e.club_id = target_profile_id
        and (
          coalesce(ap.show_on_club_profile, ap.show_on_profile, false)
          or (
            ap.user_id = target_profile_id
            and coalesce(ap.show_on_user_profile, ap.show_on_profile, false)
          )
        )
      )
      or (
        target_account_type <> 'club'
        and ap.user_id = target_profile_id
        and coalesce(ap.show_on_user_profile, ap.show_on_profile, false)
      )
    )
  order by row_data.created_at desc;
end;
$$;
create or replace function public.notification_badge_projection(
  viewer_id uuid default null,
  since timestamptz default null
)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with resolved_viewer as (
    select coalesce(viewer_id, auth.uid()) as uid
  )
  select public.build_projection_envelope(
    items := coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', 'notifications',
            'unreadCount', coalesce(cache.unread_count, 0)
          )
        )
        from resolved_viewer rv
        left join public.notification_summary_cache cache on cache.user_id = rv.uid
      ),
      '[]'::jsonb
    ),
    next_cursor := null,
    server_time := timezone('utc', now()),
    delta_token := timezone('utc', now())
  );
$$;
create or replace function public.notification_badge_projection(
  viewer_id uuid,
  since timestamptz,
  delta_token text
)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select public.notification_badge_projection(
    auth.uid(),
    public.resolve_projection_since(since, delta_token)
  );
$$;
create or replace function public.notifications_projection(
  viewer_id uuid,
  filter_name text,
  cursor text default null,
  limit_count integer default 30,
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
  page_limit integer := least(greatest(limit_count, 1), 15);
  lookahead_limit integer := least(greatest(page_limit * 8, 120), 240);
  cursor_timestamp timestamptz := case
    when cursor is null or split_part(cursor, '|', 1) = '' then null
    else split_part(cursor, '|', 1)::timestamptz
  end;
  cursor_identity text := nullif(split_part(cursor, '|', 2), '');
  resolved_since timestamptz := public.resolve_projection_since(since, delta_token);
  emitted_at timestamptz := timezone('utc', now());
begin
  return (
    with resolved_viewer as (
      select auth.uid() as uid
    ),
    candidate_rows as (
      select
        n.id,
        n.type,
        n.actor_id,
        n.message,
        n.detail,
        n.event_id,
        n.target_profile_id,
        n.is_read,
        n.created_at,
        coalesce(n.last_activity_at, n.created_at) as activity_at,
        n.photo_id,
        n.request_status,
        n.request_resolved_at,
        case
          when n.type = 'follow_request'::public.notification_type
            then concat_ws(
              '|',
              coalesce(n.actor_id::text, ''),
              coalesce(n.target_profile_id::text, ''),
              n.type::text
            )
          else n.id::text
        end as request_key
      from public.notifications n
      join resolved_viewer rv on rv.uid = n.user_id
      where n.deleted_at is null
        and n.type not in (
          'join_request'::public.notification_type,
          'join_accepted'::public.notification_type,
          'join_rejected'::public.notification_type
        )
        and (filter_name = 'all' or n.type::text = filter_name)
        and (resolved_since is null or coalesce(n.last_activity_at, n.created_at) >= resolved_since)
        and (
          cursor_timestamp is null
          or coalesce(n.last_activity_at, n.created_at) < cursor_timestamp
          or (
            coalesce(n.last_activity_at, n.created_at) = cursor_timestamp
            and n.id::text < coalesce(cursor_identity, '')
          )
        )
      order by coalesce(n.last_activity_at, n.created_at) desc, n.id desc
      limit lookahead_limit
    ),
    deduped_rows as (
      select distinct on (candidate_rows.request_key)
        candidate_rows.*
      from candidate_rows
      order by candidate_rows.request_key, candidate_rows.activity_at desc, candidate_rows.id desc
    ),
    ordered_rows as (
      select *
      from deduped_rows
      order by activity_at desc, id desc
      limit page_limit + 1
    ),
    page_rows as (
      select *
      from ordered_rows
      order by activity_at desc, id desc
      limit page_limit
    ),
    overflow_row as (
      select *
      from ordered_rows
      order by activity_at desc, id desc
      offset page_limit
      limit 1
    ),
    page_metadata as (
      select
        r.*,
        actor.username as actor_username,
        coalesce(actor.name, actor.club_name, actor.username) as actor_name,
        coalesce(actor.profile_image_path, '') as actor_image,
        e.title as event_title,
        latest_follow.latest_follow_deleted_at,
        latest_follow.latest_follow_responded_at,
        latest_follow.latest_follow_status
      from page_rows r
      left join public.profiles actor on actor.user_id = r.actor_id
      left join public.events e on e.id = r.event_id
      left join resolved_viewer rv on true
      left join lateral (
        select
          f.deleted_at as latest_follow_deleted_at,
          f.responded_at as latest_follow_responded_at,
          f.status::text as latest_follow_status
        from public.follows f
        where r.type = 'follow_request'::public.notification_type
          and f.follower_id = r.actor_id
          and f.following_id = rv.uid
        order by coalesce(f.last_activity_at, f.responded_at, f.created_at) desc, f.created_at desc, f.id desc
        limit 1
      ) latest_follow on true
    )
    select public.build_projection_envelope(
      items := coalesce(
        jsonb_agg(
          jsonb_build_object(
            'id', r.id,
            'type', r.type,
            'fromUserId', coalesce(r.actor_id::text, ''),
            'fromUsername', coalesce(r.actor_username, ''),
            'fromName', coalesce(r.actor_name, ''),
            'fromImage', coalesce(r.actor_image, ''),
            'message', r.message,
            'detail', r.detail,
            'eventTitle', r.event_title,
            'eventId', r.event_id,
            'photoId', r.photo_id,
            'targetType',
              case
                when r.target_profile_id is not null then 'profile'
                when r.photo_id is not null then 'album'
                when r.event_id is not null then 'event'
                else 'profile'
              end,
            'read', r.is_read,
            'requestStatus',
              case
                when r.type = 'follow_request'::public.notification_type
                  and r.latest_follow_status = 'accepted'
                  then 'accepted'
                when r.type = 'follow_request'::public.notification_type
                  and r.latest_follow_status = 'pending'
                  and r.latest_follow_deleted_at is null
                  then 'pending'
                when r.type = 'follow_request'::public.notification_type
                  and r.latest_follow_status = 'pending'
                  and r.latest_follow_deleted_at is not null
                  then 'rejected'
                else r.request_status
              end,
            'requestResolvedAt',
              case
                when r.type = 'follow_request'::public.notification_type
                  and r.latest_follow_status = 'accepted'
                  then coalesce(r.latest_follow_responded_at, r.request_resolved_at)
                when r.type = 'follow_request'::public.notification_type
                  and r.latest_follow_status = 'pending'
                  and r.latest_follow_deleted_at is null
                  then null
                when r.type = 'follow_request'::public.notification_type
                  and r.latest_follow_status = 'pending'
                  and r.latest_follow_deleted_at is not null
                  then coalesce(r.latest_follow_responded_at, r.request_resolved_at)
                else r.request_resolved_at
              end,
            'createdAt', r.created_at,
            'time', public.display_projection_time(r.created_at)
          )
          order by r.activity_at desc, r.id desc
        ),
        '[]'::jsonb
      ),
      next_cursor := (
        select case
          when o.id is null then null
          else to_char(timezone('utc', o.activity_at), 'YYYY-MM-DD\"T\"HH24:MI:SS.MS\"Z\"') || '|' || o.id::text
        end
        from overflow_row o
      ),
      server_time := emitted_at,
      delta_token := emitted_at
    )
    from page_metadata r
  );
end;
$$;
create or replace function public.blocked_users_projection(
  viewer_id uuid,
  cursor text,
  limit_count integer,
  since timestamptz,
  delta_token text
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  effective_viewer_id uuid := coalesce(viewer_id, auth.uid());
  effective_limit integer := least(greatest(coalesce(limit_count, 60), 1), 120);
  emitted_at timestamptz := timezone('utc', now());
begin
  if effective_viewer_id is null then
    return public.build_projection_envelope(
      items := '[]'::jsonb,
      server_time := emitted_at,
      delta_token := emitted_at
    );
  end if;

  return (
    with blocked_rows as (
      select
        b.blocked_id,
        b.created_at as blocked_at,
        p.username,
        p.account_type,
        p.university,
        p.profile_image_path,
        p.is_private,
        coalesce(p.name, p.club_name, p.username::text, 'Kullanici') as display_name
      from public.blocks b
      join public.profiles p on p.user_id = b.blocked_id
      where b.blocker_id = effective_viewer_id
        and p.deleted_at is null
      order by b.created_at desc, b.blocked_id desc
      limit effective_limit
    )
    select public.build_projection_envelope(
      items := coalesce(
        jsonb_agg(
          jsonb_build_object(
            'id', blocked_id,
            'userId', blocked_id,
            'user_id', blocked_id,
            'username', username::text,
            'name', display_name,
            'accountType', account_type::text,
            'account_type', account_type::text,
            'university', university,
            'image', coalesce(profile_image_path, ''),
            'profileImage', coalesce(profile_image_path, ''),
            'profile_image_path', coalesce(profile_image_path, ''),
            'isPrivate', coalesce(is_private, false),
            'is_private', coalesce(is_private, false),
            'blockedAt', blocked_at,
            'blocked_at', blocked_at
          )
          order by blocked_at desc, blocked_id desc
        ),
        '[]'::jsonb
      ),
      next_cursor := null,
      server_time := emitted_at,
      delta_token := emitted_at
    )
    from blocked_rows
  );
end;
$$;
create or replace function public.relationship_list_projection(
  viewer_id uuid,
  target_username text,
  kind_name text,
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
  with resolved_viewer as (
    select coalesce(viewer_id, auth.uid()) as uid
  ),
  resolved_params as (
    select
      least(greatest(coalesce(limit_count, 60), 1), 120) as effective_limit,
      public.resolve_projection_since(since, delta_token) as resolved_since
  ),
  target_profile as (
    select p.user_id
    from public.profiles p
    where p.username = target_username
      and p.deleted_at is null
  ),
  caps as (
    select *
    from public.get_profile_capabilities((select user_id from target_profile))
  ),
  base_rows as (
    select
      case when kind_name = 'followers' then f.follower_id else f.following_id end as relation_user_id,
      f.created_at,
      f.last_activity_at
    from public.follows f
    join target_profile tp on (
      (kind_name = 'followers' and f.following_id = tp.user_id) or
      (kind_name <> 'followers' and f.follower_id = tp.user_id)
    )
    cross join resolved_params rp
    where f.status = 'accepted'::public.follow_status
      and f.deleted_at is null
      and (
        (kind_name = 'followers' and coalesce((select can_view_followers from caps), false)) or
        (kind_name <> 'followers' and coalesce((select can_view_following from caps), false))
      )
      and (rp.resolved_since is null or f.last_activity_at >= rp.resolved_since)
    order by f.last_activity_at desc, relation_user_id desc
    limit (select effective_limit from resolved_params)
  ),
  rows as (
    select
      br.relation_user_id,
      br.created_at,
      p.username,
      coalesce(p.name, p.club_name, p.username::text) as display_name,
      coalesce(p.profile_image_path, '') as image,
      coalesce(p.cover_image_path, '') as cover_image,
      coalesce(p.university, '') as university,
      p.account_type,
      p.is_private,
      p.department,
      p.grade_year,
      coalesce(p.categories, '{}'::text[]) as categories,
      p.bio,
      p.description,
      case
        when viewer_follow.status = 'accepted'::public.follow_status then 'following'
        when viewer_follow.status = 'pending'::public.follow_status then 'requested'
        else 'none'
      end as viewer_follow_status
    from base_rows br
    join public.profiles p on p.user_id = br.relation_user_id
    left join resolved_viewer rv on true
    left join public.follows viewer_follow
      on viewer_follow.follower_id = rv.uid
     and viewer_follow.following_id = br.relation_user_id
     and viewer_follow.deleted_at is null
  )
  select public.build_projection_envelope(
    items := coalesce(jsonb_agg(
      jsonb_build_object(
        'id', r.relation_user_id,
        'userId', r.relation_user_id,
        'username', r.username::text,
        'name', r.display_name,
        'image', r.image,
        'profileImage', r.image,
        'coverImage', r.cover_image,
        'university', r.university,
        'accountType', r.account_type::text,
        'account_type', r.account_type::text,
        'time', public.display_projection_time(r.created_at),
        'isPrivate', r.is_private,
        'department', r.department,
        'year', r.grade_year,
        'category', case when coalesce(array_length(r.categories, 1), 0) > 0 then r.categories[1] else null end,
        'categories', to_jsonb(r.categories),
        'bio', r.bio,
        'description', r.description,
        'viewerFollowStatus', r.viewer_follow_status
      )
      order by r.created_at desc, r.relation_user_id desc
    ), '[]'::jsonb),
    next_cursor := null,
    server_time := timezone('utc', now()),
    delta_token := timezone('utc', now())
  )
  from rows r;
$$;
create or replace function public.event_detail_projection(
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
  with event_row as (
    select *
    from public.get_event_view_row(target_event_id)
  ),
  album_counts as (
    select
      ap.event_id,
      count(*)::integer as album_count
    from public.album_photos ap
    where ap.event_id = target_event_id
      and ap.deleted_at is null
      and (
        coalesce(ap.show_on_club_profile, ap.show_on_profile, false)
        or coalesce(ap.show_on_user_profile, ap.show_on_profile, false)
      )
    group by ap.event_id
  )
  select public.build_projection_envelope(
    items := coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id', e.id,
          'albumCount', coalesce(ac.album_count, 0),
          'event', to_jsonb(e) || jsonb_build_object(
            'albumCount', coalesce(ac.album_count, 0)
          )
        )
      ),
      '[]'::jsonb
    ),
    server_time := timezone('utc', now()),
    delta_token := timezone('utc', now())
  )
  from event_row e
  left join album_counts ac on ac.event_id = e.id
  where e.openable
    and (since is null or e.created_at >= since);
$$;
create or replace function public.event_detail_projection(
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
  select public.event_detail_projection(
    auth.uid(),
    target_event_id,
    public.resolve_projection_since(since, delta_token)
  );
$$;
create or replace function public.album_event_projection(
  viewer_id uuid default null,
  target_event_id uuid default null,
  cursor text default null,
  limit_count integer default 20,
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
  page_limit integer := least(greatest(coalesce(limit_count, 20), 1), 60);
  resolved_since timestamptz := public.resolve_projection_since(since, delta_token);
  cursor_timestamp timestamptz := case
    when cursor is null or split_part(cursor, '|', 1) = '' then null
    else split_part(cursor, '|', 1)::timestamptz
  end;
  cursor_identity text := nullif(split_part(cursor, '|', 2), '');
begin
  return (
    with ordered_rows as (
      select
        r.created_at as row_ts,
        r.photo_id::text as row_id,
        to_jsonb(r) || jsonb_build_object(
          'id', r.photo_id,
          'photoId', r.photo_id,
          'show_on_user_profile', coalesce(ap.show_on_user_profile, false),
          'show_on_club_profile', coalesce(ap.show_on_club_profile, false)
        ) as item_json
      from public.list_visible_albums('event_album', null, array[target_event_id]) r
      join public.album_photos ap on ap.id = r.photo_id
      where target_event_id is not null
        and ap.deleted_at is null
        and (resolved_since is null or greatest(ap.updated_at, ap.created_at) >= resolved_since)
        and (
          cursor_timestamp is null
          or r.created_at < cursor_timestamp
          or (r.created_at = cursor_timestamp and r.photo_id::text < coalesce(cursor_identity, ''))
        )
      order by r.created_at desc, r.photo_id desc
      limit page_limit + 1
    ),
    page_rows as (
      select *
      from ordered_rows
      order by row_ts desc, row_id desc
      limit page_limit
    ),
    overflow_row as (
      select *
      from ordered_rows
      order by row_ts desc, row_id desc
      offset page_limit
      limit 1
    ),
    last_page_row as (
      select *
      from page_rows
      order by row_ts asc, row_id asc
      limit 1
    )
    select public.build_projection_envelope(
      items := coalesce(jsonb_agg(r.item_json order by r.row_ts desc, r.row_id desc), '[]'::jsonb),
      updated_items := '[]'::jsonb,
      deleted_ids := '[]'::jsonb,
      next_cursor := (
        select case
          when exists (select 1 from overflow_row) then public.build_projection_cursor(lp.row_ts, lp.row_id)
          else null
        end
        from last_page_row lp
      ),
      server_time := timezone('utc', now()),
      delta_token := timezone('utc', now())
    )
    from page_rows r
  );
end;
$$;
create or replace function public.event_comments_projection(
  viewer_id uuid default null,
  target_event_id uuid default null,
  cursor text default null,
  limit_count integer default 40,
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
  resolved_viewer_id uuid := coalesce(auth.uid(), viewer_id);
  page_limit integer := least(greatest(coalesce(limit_count, 40), 1), 80);
  resolved_since timestamptz := public.resolve_projection_since(since, delta_token);
  cursor_timestamp timestamptz := case
    when cursor is null or split_part(cursor, '|', 1) = '' then null
    else split_part(cursor, '|', 1)::timestamptz
  end;
  cursor_identity text := nullif(split_part(cursor, '|', 2), '');
begin
  return (
    with visible_event as (
      select target_event_id as event_id
      where target_event_id is not null
        and public.can_view_event(target_event_id)
    ),
    ordered_rows as (
      select
        ec.created_at as row_ts,
        ec.id::text as row_id,
        jsonb_build_object(
          'id', ec.id,
          'userId', ec.user_id,
          'username', p.username,
          'name', coalesce(p.name, p.club_name, p.username),
          'image', coalesce(p.profile_image_path, ''),
          'profileImage', coalesce(p.profile_image_path, ''),
          'university', coalesce(p.university, ''),
          'text', ec.body,
          'body', ec.body,
          'parentId', ec.parent_id,
          'createdAt', ec.created_at,
          'updatedAt', ec.updated_at,
          'time', public.display_projection_time(ec.created_at),
          'likesCount', coalesce((
            select count(*)::int
            from public.event_comment_likes ecl
            where ecl.comment_id = ec.id
          ), 0),
          'likedByViewer', case
            when resolved_viewer_id is null then false
            else exists (
              select 1
              from public.event_comment_likes ecl_viewer
              where ecl_viewer.comment_id = ec.id
                and ecl_viewer.user_id = resolved_viewer_id
            )
          end
        ) as item_json
      from visible_event ve
      join public.event_comments ec on ec.event_id = ve.event_id
      join public.profiles p on p.user_id = ec.user_id
      left join public.event_comments parent_comment on parent_comment.id = ec.parent_id
      where (resolved_since is null or greatest(ec.updated_at, ec.created_at) >= resolved_since)
        and (
          resolved_viewer_id is null
          or (
            not public.is_blocked_pair(resolved_viewer_id, ec.user_id)
            and (
              parent_comment.id is null
              or not public.is_blocked_pair(resolved_viewer_id, parent_comment.user_id)
            )
          )
        )
        and (
          cursor_timestamp is null
          or ec.created_at > cursor_timestamp
          or (ec.created_at = cursor_timestamp and ec.id::text > coalesce(cursor_identity, ''))
        )
      order by ec.created_at asc, ec.id asc
      limit page_limit + 1
    ),
    page_rows as (
      select *
      from ordered_rows
      order by row_ts asc, row_id asc
      limit page_limit
    ),
    overflow_row as (
      select *
      from ordered_rows
      order by row_ts asc, row_id asc
      offset page_limit
      limit 1
    ),
    last_page_row as (
      select *
      from page_rows
      order by row_ts desc, row_id desc
      limit 1
    )
    select public.build_projection_envelope(
      items := coalesce(jsonb_agg(r.item_json order by r.row_ts asc, r.row_id asc), '[]'::jsonb),
      updated_items := '[]'::jsonb,
      deleted_ids := '[]'::jsonb,
      next_cursor := (
        select case
          when exists (select 1 from overflow_row) then public.build_projection_cursor(lp.row_ts, lp.row_id)
          else null
        end
        from last_page_row lp
      ),
      server_time := timezone('utc', now()),
      delta_token := timezone('utc', now())
    )
    from page_rows r
  );
end;
$$;
create or replace function public.event_likers_projection(
  viewer_id uuid default null,
  target_event_id uuid default null,
  cursor text default null,
  limit_count integer default 40,
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
  resolved_viewer_id uuid := coalesce(auth.uid(), viewer_id);
  page_limit integer := least(greatest(coalesce(limit_count, 40), 1), 80);
  resolved_since timestamptz := public.resolve_projection_since(since, delta_token);
  cursor_timestamp timestamptz := case
    when cursor is null or split_part(cursor, '|', 1) = '' then null
    else split_part(cursor, '|', 1)::timestamptz
  end;
  cursor_identity text := nullif(split_part(cursor, '|', 2), '');
begin
  return (
    with visible_event as (
      select target_event_id as event_id
      where target_event_id is not null
        and public.can_view_event(target_event_id)
    ),
    ordered_rows as (
      select
        el.created_at as row_ts,
        p.user_id::text as row_id,
        jsonb_build_object(
          'id', p.user_id,
          'userId', p.user_id,
          'username', p.username,
          'name', coalesce(p.name, p.club_name, p.username),
          'image', coalesce(p.profile_image_path, ''),
          'profileImage', coalesce(p.profile_image_path, ''),
          'coverImage', coalesce(p.cover_image_path, ''),
          'university', coalesce(p.university, ''),
          'isPrivate', coalesce(p.is_private, false),
          'createdAt', p.created_at,
          'department', p.department,
          'year', p.grade_year,
          'category', nullif(coalesce(p.categories[1], ''), ''),
          'categories', to_jsonb(coalesce(p.categories, '{}'::text[])),
          'description', coalesce(p.description, ''),
          'bio', coalesce(p.bio, ''),
          'accountType', p.account_type,
          'account_type', p.account_type
        ) as item_json
      from visible_event ve
      join public.event_likes el on el.event_id = ve.event_id
      join public.profiles p on p.user_id = el.user_id
      where (resolved_since is null or el.created_at >= resolved_since)
        and (resolved_viewer_id is null or not public.is_blocked_pair(resolved_viewer_id, p.user_id))
        and (
          cursor_timestamp is null
          or el.created_at < cursor_timestamp
          or (el.created_at = cursor_timestamp and p.user_id::text < coalesce(cursor_identity, ''))
        )
      order by el.created_at desc, p.user_id desc
      limit page_limit + 1
    ),
    page_rows as (
      select *
      from ordered_rows
      order by row_ts desc, row_id desc
      limit page_limit
    ),
    overflow_row as (
      select *
      from ordered_rows
      order by row_ts desc, row_id desc
      offset page_limit
      limit 1
    ),
    last_page_row as (
      select *
      from page_rows
      order by row_ts asc, row_id asc
      limit 1
    )
    select public.build_projection_envelope(
      items := coalesce(jsonb_agg(r.item_json order by r.row_ts desc, r.row_id desc), '[]'::jsonb),
      updated_items := '[]'::jsonb,
      deleted_ids := '[]'::jsonb,
      next_cursor := (
        select case
          when exists (select 1 from overflow_row) then public.build_projection_cursor(lp.row_ts, lp.row_id)
          else null
        end
        from last_page_row lp
      ),
      server_time := timezone('utc', now()),
      delta_token := timezone('utc', now())
    )
    from page_rows r
  );
end;
$$;
create or replace function public.event_attendees_projection(
  viewer_id uuid default null,
  target_event_id uuid default null,
  cursor text default null,
  limit_count integer default 40,
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
  resolved_viewer_id uuid := coalesce(auth.uid(), viewer_id);
  page_limit integer := least(greatest(coalesce(limit_count, 40), 1), 80);
  resolved_since timestamptz := public.resolve_projection_since(since, delta_token);
  cursor_timestamp timestamptz := case
    when cursor is null or split_part(cursor, '|', 1) = '' then null
    else split_part(cursor, '|', 1)::timestamptz
  end;
  cursor_identity text := nullif(split_part(cursor, '|', 2), '');
begin
  return (
    with visible_event as (
      select target_event_id as event_id
      where target_event_id is not null
        and public.can_view_event_attendees(target_event_id)
    ),
    ordered_rows as (
      select
        ea.joined_at as row_ts,
        p.user_id::text as row_id,
        jsonb_build_object(
          'id', p.user_id,
          'userId', p.user_id,
          'username', p.username,
          'name', coalesce(p.name, p.club_name, p.username),
          'image', coalesce(p.profile_image_path, ''),
          'profileImage', coalesce(p.profile_image_path, ''),
          'coverImage', coalesce(p.cover_image_path, ''),
          'university', coalesce(p.university, ''),
          'isPrivate', coalesce(p.is_private, false),
          'createdAt', p.created_at,
          'department', p.department,
          'year', p.grade_year,
          'category', nullif(coalesce(p.categories[1], ''), ''),
          'categories', to_jsonb(coalesce(p.categories, '{}'::text[])),
          'description', coalesce(p.description, ''),
          'bio', coalesce(p.bio, ''),
          'accountType', p.account_type,
          'account_type', p.account_type
        ) as item_json
      from visible_event ve
      join public.event_attendees ea on ea.event_id = ve.event_id
      join public.profiles p on p.user_id = ea.user_id
      where (resolved_since is null or ea.joined_at >= resolved_since)
        and (resolved_viewer_id is null or not public.is_blocked_pair(resolved_viewer_id, p.user_id))
        and (
          cursor_timestamp is null
          or ea.joined_at < cursor_timestamp
          or (ea.joined_at = cursor_timestamp and p.user_id::text < coalesce(cursor_identity, ''))
        )
      order by ea.joined_at desc, p.user_id desc
      limit page_limit + 1
    ),
    page_rows as (
      select *
      from ordered_rows
      order by row_ts desc, row_id desc
      limit page_limit
    ),
    overflow_row as (
      select *
      from ordered_rows
      order by row_ts desc, row_id desc
      offset page_limit
      limit 1
    ),
    last_page_row as (
      select *
      from page_rows
      order by row_ts asc, row_id asc
      limit 1
    )
    select public.build_projection_envelope(
      items := coalesce(jsonb_agg(r.item_json order by r.row_ts desc, r.row_id desc), '[]'::jsonb),
      updated_items := '[]'::jsonb,
      deleted_ids := '[]'::jsonb,
      next_cursor := (
        select case
          when exists (select 1 from overflow_row) then public.build_projection_cursor(lp.row_ts, lp.row_id)
          else null
        end
        from last_page_row lp
      ),
      server_time := timezone('utc', now()),
      delta_token := timezone('utc', now())
    )
    from page_rows r
  );
end;
$$;
create or replace function public.album_comments_projection(
  viewer_id uuid default null,
  photo_id uuid default null,
  cursor text default null,
  limit_count integer default 40,
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
  resolved_viewer_id uuid := coalesce(auth.uid(), viewer_id);
  page_limit integer := least(greatest(coalesce(limit_count, 40), 1), 80);
  resolved_since timestamptz := public.resolve_projection_since(since, delta_token);
  cursor_timestamp timestamptz := case
    when cursor is null or split_part(cursor, '|', 1) = '' then null
    else split_part(cursor, '|', 1)::timestamptz
  end;
  cursor_identity text := nullif(split_part(cursor, '|', 2), '');
begin
  return (
    with visible_photo as (
      select av.photo_id
      from public.get_album_view_row(album_comments_projection.photo_id, 'feed') av
      where av.openable
    ),
    ordered_rows as (
      select
        apc.created_at as row_ts,
        apc.id::text as row_id,
        jsonb_build_object(
          'id', apc.id,
          'userId', apc.user_id,
          'username', p.username,
          'name', coalesce(p.name, p.club_name, p.username),
          'image', coalesce(p.profile_image_path, ''),
          'profileImage', coalesce(p.profile_image_path, ''),
          'university', coalesce(p.university, ''),
          'text', apc.body,
          'body', apc.body,
          'parentId', apc.parent_id,
          'createdAt', apc.created_at,
          'updatedAt', apc.updated_at,
          'time', public.display_projection_time(apc.created_at),
          'likesCount', coalesce((
            select count(*)::int
            from public.album_photo_comment_likes apcl
            where apcl.comment_id = apc.id
          ), 0),
          'likedByViewer', case
            when resolved_viewer_id is null then false
            else exists (
              select 1
              from public.album_photo_comment_likes apcl_viewer
              where apcl_viewer.comment_id = apc.id
                and apcl_viewer.user_id = resolved_viewer_id
            )
          end
        ) as item_json
      from visible_photo vp
      join public.album_photo_comments apc on apc.photo_id = vp.photo_id
      join public.profiles p on p.user_id = apc.user_id
      left join public.album_photo_comments parent_comment on parent_comment.id = apc.parent_id
      where (resolved_since is null or greatest(apc.updated_at, apc.created_at) >= resolved_since)
        and (
          resolved_viewer_id is null
          or (
            not public.is_blocked_pair(resolved_viewer_id, apc.user_id)
            and (
              parent_comment.id is null
              or not public.is_blocked_pair(resolved_viewer_id, parent_comment.user_id)
            )
          )
        )
        and (
          cursor_timestamp is null
          or apc.created_at > cursor_timestamp
          or (apc.created_at = cursor_timestamp and apc.id::text > coalesce(cursor_identity, ''))
        )
      order by apc.created_at asc, apc.id asc
      limit page_limit + 1
    ),
    page_rows as (
      select *
      from ordered_rows
      order by row_ts asc, row_id asc
      limit page_limit
    ),
    overflow_row as (
      select *
      from ordered_rows
      order by row_ts asc, row_id asc
      offset page_limit
      limit 1
    ),
    last_page_row as (
      select *
      from page_rows
      order by row_ts desc, row_id desc
      limit 1
    )
    select public.build_projection_envelope(
      items := coalesce(jsonb_agg(r.item_json order by r.row_ts asc, r.row_id asc), '[]'::jsonb),
      updated_items := '[]'::jsonb,
      deleted_ids := '[]'::jsonb,
      next_cursor := (
        select case
          when exists (select 1 from overflow_row) then public.build_projection_cursor(lp.row_ts, lp.row_id)
          else null
        end
        from last_page_row lp
      ),
      server_time := timezone('utc', now()),
      delta_token := timezone('utc', now())
    )
    from page_rows r
  );
end;
$$;
create or replace function public.event_comment_likers_projection(
  viewer_id uuid default null,
  target_comment_id uuid default null,
  cursor text default null,
  limit_count integer default 40,
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
  resolved_viewer_id uuid := coalesce(auth.uid(), viewer_id);
  page_limit integer := least(greatest(coalesce(limit_count, 40), 1), 80);
  resolved_since timestamptz := public.resolve_projection_since(since, delta_token);
  cursor_timestamp timestamptz := case
    when cursor is null or split_part(cursor, '|', 1) = '' then null
    else split_part(cursor, '|', 1)::timestamptz
  end;
  cursor_identity text := nullif(split_part(cursor, '|', 2), '');
begin
  return (
    with visible_comment as (
      select ec.id as comment_id
      from public.event_comments ec
      where ec.id = target_comment_id
        and public.can_view_event(ec.event_id)
    ),
    ordered_rows as (
      select
        ecl.created_at as row_ts,
        p.user_id::text as row_id,
        jsonb_build_object(
          'id', p.user_id,
          'userId', p.user_id,
          'username', p.username,
          'name', coalesce(p.name, p.club_name, p.username),
          'image', coalesce(p.profile_image_path, ''),
          'profileImage', coalesce(p.profile_image_path, ''),
          'coverImage', coalesce(p.cover_image_path, ''),
          'university', coalesce(p.university, ''),
          'isPrivate', coalesce(p.is_private, false),
          'createdAt', p.created_at,
          'department', p.department,
          'year', p.grade_year,
          'category', nullif(coalesce(p.categories[1], ''), ''),
          'categories', to_jsonb(coalesce(p.categories, '{}'::text[])),
          'description', coalesce(p.description, ''),
          'bio', coalesce(p.bio, ''),
          'accountType', p.account_type,
          'account_type', p.account_type
        ) as item_json
      from visible_comment vc
      join public.event_comment_likes ecl on ecl.comment_id = vc.comment_id
      join public.profiles p on p.user_id = ecl.user_id
      where (resolved_since is null or ecl.created_at >= resolved_since)
        and (resolved_viewer_id is null or not public.is_blocked_pair(resolved_viewer_id, p.user_id))
        and (
          cursor_timestamp is null
          or ecl.created_at < cursor_timestamp
          or (ecl.created_at = cursor_timestamp and p.user_id::text < coalesce(cursor_identity, ''))
        )
      order by ecl.created_at desc, p.user_id desc
      limit page_limit + 1
    ),
    page_rows as (
      select *
      from ordered_rows
      order by row_ts desc, row_id desc
      limit page_limit
    ),
    overflow_row as (
      select *
      from ordered_rows
      order by row_ts desc, row_id desc
      offset page_limit
      limit 1
    ),
    last_page_row as (
      select *
      from page_rows
      order by row_ts asc, row_id asc
      limit 1
    )
    select public.build_projection_envelope(
      items := coalesce(jsonb_agg(r.item_json order by r.row_ts desc, r.row_id desc), '[]'::jsonb),
      updated_items := '[]'::jsonb,
      deleted_ids := '[]'::jsonb,
      next_cursor := (
        select case
          when exists (select 1 from overflow_row) then public.build_projection_cursor(lp.row_ts, lp.row_id)
          else null
        end
        from last_page_row lp
      ),
      server_time := timezone('utc', now()),
      delta_token := timezone('utc', now())
    )
    from page_rows r
  );
end;
$$;
create or replace function public.album_comment_likers_projection(
  viewer_id uuid default null,
  target_comment_id uuid default null,
  cursor text default null,
  limit_count integer default 40,
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
  resolved_viewer_id uuid := coalesce(auth.uid(), viewer_id);
  page_limit integer := least(greatest(coalesce(limit_count, 40), 1), 80);
  resolved_since timestamptz := public.resolve_projection_since(since, delta_token);
  cursor_timestamp timestamptz := case
    when cursor is null or split_part(cursor, '|', 1) = '' then null
    else split_part(cursor, '|', 1)::timestamptz
  end;
  cursor_identity text := nullif(split_part(cursor, '|', 2), '');
begin
  return (
    with visible_comment as (
      select apc.id as comment_id
      from public.album_photo_comments apc
      join public.get_album_view_row(apc.photo_id, 'feed') av on true
      where apc.id = target_comment_id
        and av.openable
    ),
    ordered_rows as (
      select
        apcl.created_at as row_ts,
        p.user_id::text as row_id,
        jsonb_build_object(
          'id', p.user_id,
          'userId', p.user_id,
          'username', p.username,
          'name', coalesce(p.name, p.club_name, p.username),
          'image', coalesce(p.profile_image_path, ''),
          'profileImage', coalesce(p.profile_image_path, ''),
          'coverImage', coalesce(p.cover_image_path, ''),
          'university', coalesce(p.university, ''),
          'isPrivate', coalesce(p.is_private, false),
          'createdAt', p.created_at,
          'department', p.department,
          'year', p.grade_year,
          'category', nullif(coalesce(p.categories[1], ''), ''),
          'categories', to_jsonb(coalesce(p.categories, '{}'::text[])),
          'description', coalesce(p.description, ''),
          'bio', coalesce(p.bio, ''),
          'accountType', p.account_type,
          'account_type', p.account_type
        ) as item_json
      from visible_comment vc
      join public.album_photo_comment_likes apcl on apcl.comment_id = vc.comment_id
      join public.profiles p on p.user_id = apcl.user_id
      where (resolved_since is null or apcl.created_at >= resolved_since)
        and (resolved_viewer_id is null or not public.is_blocked_pair(resolved_viewer_id, p.user_id))
        and (
          cursor_timestamp is null
          or apcl.created_at < cursor_timestamp
          or (apcl.created_at = cursor_timestamp and p.user_id::text < coalesce(cursor_identity, ''))
        )
      order by apcl.created_at desc, p.user_id desc
      limit page_limit + 1
    ),
    page_rows as (
      select *
      from ordered_rows
      order by row_ts desc, row_id desc
      limit page_limit
    ),
    overflow_row as (
      select *
      from ordered_rows
      order by row_ts desc, row_id desc
      offset page_limit
      limit 1
    ),
    last_page_row as (
      select *
      from page_rows
      order by row_ts asc, row_id asc
      limit 1
    )
    select public.build_projection_envelope(
      items := coalesce(jsonb_agg(r.item_json order by r.row_ts desc, r.row_id desc), '[]'::jsonb),
      updated_items := '[]'::jsonb,
      deleted_ids := '[]'::jsonb,
      next_cursor := (
        select case
          when exists (select 1 from overflow_row) then public.build_projection_cursor(lp.row_ts, lp.row_id)
          else null
        end
        from last_page_row lp
      ),
      server_time := timezone('utc', now()),
      delta_token := timezone('utc', now())
    )
    from page_rows r
  );
end;
$$;
create or replace function public.profile_overview_projection(
  viewer_id uuid default null,
  target_username text default null,
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
  normalized_target_username text := lower(trim(coalesce(target_username, '')));
  target_profile_id uuid;
begin
  select p.user_id
    into target_profile_id
  from public.profiles p
  where lower(trim(coalesce(p.username, ''))) = normalized_target_username
    and p.deleted_at is null
  limit 1;

  return (
    with summary as (
      select *
      from public.get_profile_summary(target_profile_id)
    ),
    caps as (
      select *
      from public.get_profile_capabilities(target_profile_id)
    ),
    follow_state as (
      select s.status
      from public.get_follow_state(target_profile_id, normalized_target_username) s
      limit 1
    )
    select public.build_projection_envelope(
      items := coalesce(jsonb_agg(
        jsonb_build_object(
          'id', s.username,
          'username', s.username,
          'followStatus', coalesce((select status from follow_state), 'none'),
          'membershipStatus', 'none',
          'capabilities', jsonb_build_object(
            'canViewHeader', coalesce((select can_view_header from caps), false),
            'canViewContent', coalesce((select can_view_content from caps), false),
            'canViewFollowers', coalesce((select can_view_followers from caps), false),
            'canViewFollowing', coalesce((select can_view_following from caps), false),
            'canViewMembers', false,
            'canViewJoinedClubs', false,
            'lockedReasonCode', (select locked_reason_code from caps),
            'lockedReasonText', (select locked_reason_text from caps)
          ),
          'profile', jsonb_build_object(
            'id', s.user_id,
            'userId', s.user_id,
            'username', s.username,
            'accountType', s.account_type,
            'account_type', s.account_type,
            'email', coalesce(s.email, ''),
            'university', coalesce(s.university, ''),
            'categories', coalesce(s.categories, '{}'::text[]),
            'profileImage', coalesce(s.profile_image_path, ''),
            'profile_image_path', coalesce(s.profile_image_path, ''),
            'coverImage', coalesce(s.cover_image_path, ''),
            'cover_image_path', coalesce(s.cover_image_path, ''),
            'isPrivate', s.is_private,
            'hideEmail', s.hide_email,
            'hideMembersList', false,
            'hideJoinedClubs', false,
            'createdAt', s.created_at,
            'followersCount', coalesce(s.followers_count, 0),
            'followingCount', coalesce(s.following_count, 0),
            'membersCount', 0,
            'albumsCount', coalesce(s.albums_count, 0),
            'eventsCount', coalesce(s.events_count, 0),
            'clubsCount', 0,
            'name', s.name,
            'department', s.department,
            'gradeYear', s.grade_year,
            'bio', s.bio,
            'clubName', s.club_name,
            'description', s.description
          )
        )
        order by s.username
      ), '[]'::jsonb),
      updated_items := '[]'::jsonb,
      deleted_ids := '[]'::jsonb,
      next_cursor := null,
      server_time := timezone('utc', now()),
      delta_token := timezone('utc', now())
    )
    from summary s
  );
end;
$$;
create or replace function public.profile_content_projection(
  viewer_id uuid default null,
  target_username text default null,
  tab_name text default 'album',
  cursor text default null,
  limit_count integer default 24,
  since timestamptz default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  resolved_viewer_id uuid := coalesce(viewer_id, auth.uid());
  normalized_target_username text := lower(trim(coalesce(target_username, '')));
  target_profile_id uuid;
  target_account_type public.account_type;
  target_is_private boolean := false;
  can_view_target boolean := false;
  page_limit integer := least(greatest(limit_count, 1), 12);
  lookahead_limit integer := least(greatest(page_limit * 4, 16), 32);
  cursor_timestamp timestamptz := case
    when cursor is null or split_part(cursor, '|', 1) = '' then null
    else split_part(cursor, '|', 1)::timestamptz
  end;
  cursor_identity text := nullif(split_part(cursor, '|', 2), '');
  emitted_at timestamptz := timezone('utc', now());
begin
  select
    p.user_id,
    p.account_type,
    coalesce(p.is_private, false)
  into
    target_profile_id,
    target_account_type,
    target_is_private
  from public.profiles p
  where lower(trim(coalesce(p.username, ''))) = normalized_target_username
    and p.deleted_at is null
  limit 1;

  if target_profile_id is null then
    return public.build_projection_envelope(
      items := '[]'::jsonb,
      server_time := emitted_at,
      delta_token := emitted_at
    );
  end if;

  can_view_target := resolved_viewer_id = target_profile_id or public.can_view_profile(target_profile_id);

  if tab_name = 'events' then
    if target_account_type = 'club' then
      return (
        with candidate_rows as (
          select
            e.id,
            e.created_at
          from public.events e
          where e.deleted_at is null
            and e.club_id = target_profile_id
            and (since is null or e.created_at >= since)
            and (
              cursor_timestamp is null
              or e.created_at < cursor_timestamp
              or (
                e.created_at = cursor_timestamp
                and e.id::text < coalesce(cursor_identity, '')
              )
            )
          order by e.created_at desc, e.id desc
          limit lookahead_limit
        ),
        hydrated_rows as (
          select
            ev.created_at as row_ts,
            ev.id::text as row_id,
            to_jsonb(ev) || jsonb_build_object(
              'albumCount',
              coalesce(summary.album_count, 0)
            ) as item_json
          from candidate_rows c
          join lateral public.get_event_view_row(c.id) ev on true
          left join public.event_summary summary on summary.event_id = c.id
          where ev.discoverable
        ),
        ordered_rows as (
          select *
          from hydrated_rows
          order by row_ts desc, row_id desc
          limit page_limit + 1
        ),
        page_rows as (
          select *
          from ordered_rows
          order by row_ts desc, row_id desc
          limit page_limit
        ),
        overflow_row as (
          select *
          from ordered_rows
          order by row_ts desc, row_id desc
          offset page_limit
          limit 1
        ),
        last_page_row as (
          select *
          from page_rows
          order by row_ts asc, row_id asc
          limit 1
        )
        select public.build_projection_envelope(
          items := coalesce(
            jsonb_agg(r.item_json order by r.row_ts desc, r.row_id desc),
            '[]'::jsonb
          ),
          next_cursor := (
            select case
              when exists (select 1 from overflow_row) then public.build_projection_cursor(lp.row_ts, lp.row_id)
              else null
            end
            from last_page_row lp
          ),
          server_time := emitted_at,
          delta_token := emitted_at
        )
        from page_rows r
      );
    end if;

    if resolved_viewer_id = target_profile_id then
      return (
        with candidate_rows as (
          select
            e.id,
            e.created_at
          from public.event_attendees ea
          join public.events e
            on e.id = ea.event_id
           and e.deleted_at is null
          where ea.user_id = target_profile_id
            and not public.is_blocked_pair(resolved_viewer_id, e.club_id)
            and (since is null or e.created_at >= since)
            and (
              cursor_timestamp is null
              or e.created_at < cursor_timestamp
              or (
                e.created_at = cursor_timestamp
                and e.id::text < coalesce(cursor_identity, '')
              )
            )
          order by e.created_at desc, e.id desc
          limit lookahead_limit
        ),
        hydrated_rows as (
          select
            ev.created_at as row_ts,
            ev.id::text as row_id,
            to_jsonb(ev) || jsonb_build_object(
              'albumCount',
              coalesce(summary.album_count, 0)
            ) as item_json
          from candidate_rows c
          join lateral public.get_event_view_row(c.id) ev on true
          left join public.event_summary summary on summary.event_id = c.id
        ),
        ordered_rows as (
          select *
          from hydrated_rows
          order by row_ts desc, row_id desc
          limit page_limit + 1
        ),
        page_rows as (
          select *
          from ordered_rows
          order by row_ts desc, row_id desc
          limit page_limit
        ),
        overflow_row as (
          select *
          from ordered_rows
          order by row_ts desc, row_id desc
          offset page_limit
          limit 1
        ),
        last_page_row as (
          select *
          from page_rows
          order by row_ts asc, row_id asc
          limit 1
        )
        select public.build_projection_envelope(
          items := coalesce(
            jsonb_agg(r.item_json order by r.row_ts desc, r.row_id desc),
            '[]'::jsonb
          ),
          next_cursor := (
            select case
              when exists (select 1 from overflow_row) then public.build_projection_cursor(lp.row_ts, lp.row_id)
              else null
            end
            from last_page_row lp
          ),
          server_time := emitted_at,
          delta_token := emitted_at
        )
        from page_rows r
      );
    end if;

    if not can_view_target then
      return public.build_projection_envelope(
        items := '[]'::jsonb,
        server_time := emitted_at,
        delta_token := emitted_at
      );
    end if;

    return (
      with candidate_rows as (
        select
          e.id,
          e.created_at
        from public.event_attendees ea
        join public.events e
          on e.id = ea.event_id
         and e.deleted_at is null
        where ea.user_id = target_profile_id
          and (since is null or e.created_at >= since)
          and (
            cursor_timestamp is null
            or e.created_at < cursor_timestamp
            or (
              e.created_at = cursor_timestamp
              and e.id::text < coalesce(cursor_identity, '')
            )
          )
        order by e.created_at desc, e.id desc
        limit lookahead_limit
      ),
      hydrated_rows as (
        select
          ev.created_at as row_ts,
          ev.id::text as row_id,
          to_jsonb(ev) || jsonb_build_object(
            'albumCount',
            coalesce(summary.album_count, 0)
          ) as item_json
        from candidate_rows c
        join lateral public.get_event_view_row(c.id) ev on true
        left join public.event_summary summary on summary.event_id = c.id
        where ev.discoverable
      ),
      ordered_rows as (
        select *
        from hydrated_rows
        order by row_ts desc, row_id desc
        limit page_limit + 1
      ),
      page_rows as (
        select *
        from ordered_rows
        order by row_ts desc, row_id desc
        limit page_limit
      ),
      overflow_row as (
        select *
        from ordered_rows
        order by row_ts desc, row_id desc
        offset page_limit
        limit 1
      ),
      last_page_row as (
        select *
        from page_rows
        order by row_ts asc, row_id asc
        limit 1
      )
      select public.build_projection_envelope(
        items := coalesce(
          jsonb_agg(r.item_json order by r.row_ts desc, r.row_id desc),
          '[]'::jsonb
        ),
        next_cursor := (
          select case
            when exists (select 1 from overflow_row) then public.build_projection_cursor(lp.row_ts, lp.row_id)
            else null
          end
          from last_page_row lp
        ),
        server_time := emitted_at,
        delta_token := emitted_at
      )
      from page_rows r
    );
  elsif tab_name = 'album' then
    if not can_view_target then
      return public.build_projection_envelope(
        items := '[]'::jsonb,
        server_time := emitted_at,
        delta_token := emitted_at
      );
    end if;

    if target_account_type = 'club' then
      return (
        with candidate_rows as (
          select
            ap.id as photo_id,
            ap.created_at
          from public.album_photos ap
          join public.events e
            on e.id = ap.event_id
           and e.deleted_at is null
          where ap.deleted_at is null
            and e.club_id = target_profile_id
            and (
              coalesce(ap.show_on_club_profile, ap.show_on_profile, false)
              or (
                ap.user_id = target_profile_id
                and coalesce(ap.show_on_user_profile, ap.show_on_profile, false)
              )
            )
            and (since is null or ap.created_at >= since)
            and (
              cursor_timestamp is null
              or ap.created_at < cursor_timestamp
              or (
                ap.created_at = cursor_timestamp
                and ap.id::text < coalesce(cursor_identity, '')
              )
            )
          order by ap.created_at desc, ap.id desc
          limit lookahead_limit
        ),
        hydrated_rows as (
          select
            av.created_at as row_ts,
            av.photo_id::text as row_id,
            to_jsonb(av) || jsonb_build_object(
              'discoverable', true,
              'effective_visibility',
                case
                  when av.event_visibility = 'members_only' then 'members_only'
                  when target_is_private then 'followers_only'
                  else 'public'
                end,
              'show_on_user_profile', coalesce(ap.show_on_user_profile, ap.show_on_profile, false),
              'show_on_club_profile', coalesce(ap.show_on_club_profile, ap.show_on_profile, false)
            ) as item_json
          from candidate_rows c
          join public.album_photos ap
            on ap.id = c.photo_id
           and ap.deleted_at is null
          join lateral public.get_album_view_row(c.photo_id, 'profile') av on true
          where av.openable
            or av.uploader_id = resolved_viewer_id
            or av.club_id = resolved_viewer_id
        ),
        ordered_rows as (
          select *
          from hydrated_rows
          order by row_ts desc, row_id desc
          limit page_limit + 1
        ),
        page_rows as (
          select *
          from ordered_rows
          order by row_ts desc, row_id desc
          limit page_limit
        ),
        overflow_row as (
          select *
          from ordered_rows
          order by row_ts desc, row_id desc
          offset page_limit
          limit 1
        ),
        last_page_row as (
          select *
          from page_rows
          order by row_ts asc, row_id asc
          limit 1
        )
        select public.build_projection_envelope(
          items := coalesce(
            jsonb_agg(r.item_json order by r.row_ts desc, r.row_id desc),
            '[]'::jsonb
          ),
          next_cursor := (
            select case
              when exists (select 1 from overflow_row) then public.build_projection_cursor(lp.row_ts, lp.row_id)
              else null
            end
            from last_page_row lp
          ),
          server_time := emitted_at,
          delta_token := emitted_at
        )
        from page_rows r
      );
    end if;

    return (
      with candidate_rows as (
        select
          ap.id as photo_id,
          ap.created_at
        from public.album_photos ap
        where ap.deleted_at is null
          and ap.user_id = target_profile_id
          and coalesce(ap.show_on_user_profile, ap.show_on_profile, false)
          and (since is null or ap.created_at >= since)
          and (
            cursor_timestamp is null
            or ap.created_at < cursor_timestamp
            or (
              ap.created_at = cursor_timestamp
              and ap.id::text < coalesce(cursor_identity, '')
            )
          )
        order by ap.created_at desc, ap.id desc
        limit lookahead_limit
      ),
      hydrated_rows as (
        select
          av.created_at as row_ts,
          av.photo_id::text as row_id,
          to_jsonb(av) || jsonb_build_object(
            'discoverable', true,
            'effective_visibility',
              case
                when av.event_visibility = 'members_only' then 'members_only'
                when target_is_private then 'followers_only'
                else 'public'
              end,
            'show_on_user_profile', coalesce(ap.show_on_user_profile, ap.show_on_profile, false),
            'show_on_club_profile', coalesce(ap.show_on_club_profile, ap.show_on_profile, false)
          ) as item_json
        from candidate_rows c
        join public.album_photos ap
          on ap.id = c.photo_id
         and ap.deleted_at is null
        join lateral public.get_album_view_row(c.photo_id, 'profile') av on true
        where av.openable
          or av.uploader_id = resolved_viewer_id
          or av.club_id = resolved_viewer_id
      ),
      ordered_rows as (
        select *
        from hydrated_rows
        order by row_ts desc, row_id desc
        limit page_limit + 1
      ),
      page_rows as (
        select *
        from ordered_rows
        order by row_ts desc, row_id desc
        limit page_limit
      ),
      overflow_row as (
        select *
        from ordered_rows
        order by row_ts desc, row_id desc
        offset page_limit
        limit 1
      ),
      last_page_row as (
        select *
        from page_rows
        order by row_ts asc, row_id asc
        limit 1
      )
      select public.build_projection_envelope(
        items := coalesce(
          jsonb_agg(r.item_json order by r.row_ts desc, r.row_id desc),
          '[]'::jsonb
        ),
        next_cursor := (
          select case
            when exists (select 1 from overflow_row) then public.build_projection_cursor(lp.row_ts, lp.row_id)
            else null
          end
          from last_page_row lp
        ),
        server_time := emitted_at,
        delta_token := emitted_at
      )
      from page_rows r
    );
  elsif tab_name = 'members' then
    return public.club_members_projection(
      resolved_viewer_id,
      target_username,
      cursor,
      page_limit,
      since,
      false
    );
  else
    return (
      with rows as (
        select
          p.user_id as id,
          p.username,
          coalesce(p.name, p.club_name, p.username) as name,
          coalesce(p.profile_image_path, '') as image,
          coalesce(p.cover_image_path, '') as cover_image,
          coalesce(p.university, '') as university,
          p.account_type,
          p.department,
          p.grade_year,
          coalesce(p.categories, '{}'::text[]) as categories,
          p.bio,
          p.description,
          p.is_private,
          cm.created_at
        from public.club_memberships cm
        join public.profiles p on p.user_id = cm.club_id
        where cm.member_id = target_profile_id
          and cm.status = 'accepted'
          and cm.deleted_at is null
          and p.deleted_at is null
        order by cm.created_at desc, p.user_id desc
        limit page_limit
      )
      select public.build_projection_envelope(
        items := coalesce(
          jsonb_agg(
            jsonb_build_object(
              'id', r.id,
              'username', r.username,
              'name', r.name,
              'image', r.image,
              'coverImage', r.cover_image,
              'university', r.university,
              'accountType', r.account_type,
              'department', r.department,
              'year', r.grade_year,
              'category', case when coalesce(array_length(r.categories, 1), 0) > 0 then r.categories[1] else null end,
              'categories', to_jsonb(r.categories),
              'bio', r.bio,
              'description', r.description,
              'isPrivate', r.is_private
            )
            order by r.created_at desc, r.id desc
          ),
          '[]'::jsonb
        ),
        server_time := emitted_at,
        delta_token := emitted_at
      )
      from rows r
    );
  end if;
end;
$$;
create or replace function public.profile_content_projection(
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
  select public.profile_content_projection(
    auth.uid(),
    target_username,
    tab_name,
    cursor,
    limit_count,
    public.resolve_projection_since(since, delta_token)
  );
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
    content_payload := public.profile_content_projection(
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
create or replace function public.home_feed_projection(
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
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  page_limit integer := least(greatest(limit_count, 1), 12);
  candidate_limit integer := 96;
  hydration_limit integer := 48;
  cursor_timestamp timestamptz := case
    when cursor is null or split_part(cursor, '|', 1) = '' then null
    else split_part(cursor, '|', 1)::timestamptz
  end;
  cursor_identity text := nullif(split_part(cursor, '|', 2), '');
  oldest_first boolean := lower(trim(coalesce(sort_mode, 'newest'))) = 'oldest';
  emitted_at timestamptz := timezone('utc', now());
begin
  if cursor_timestamp is null and since is null then
    candidate_limit := least(greatest(page_limit * 4, 24), 48);
    hydration_limit := least(greatest(page_limit * 2 + 4, 14), 24);
  else
    candidate_limit := least(greatest(page_limit * 6, 48), 96);
    hydration_limit := least(greatest(page_limit * 4, 24), 48);
  end if;

  return (
    with resolved_viewer as (
      select coalesce(viewer_id, auth.uid()) as uid
    ),
    viewer_profile as (
      select p.user_id, p.username, p.account_type
      from public.profiles p
      join resolved_viewer rv on rv.uid = p.user_id
      where p.deleted_at is null
    ),
    accepted_follows as (
      select f.following_id
      from public.follows f
      join resolved_viewer rv on rv.uid is not null and f.follower_id = rv.uid
      where f.status = 'accepted'
        and f.deleted_at is null
    ),
    followed_profiles as (
      select p.user_id, p.username, p.account_type
      from public.profiles p
      where p.user_id in (select following_id from accepted_follows)
        and p.deleted_at is null
    ),
    followed_clubs as (
      select fp.user_id as club_id
      from followed_profiles fp
      where fp.account_type = 'club'
    ),
    followed_students as (
      select fp.user_id as student_id
      from followed_profiles fp
      where fp.account_type = 'student'
    ),
    own_event_candidates as (
      select
        e.id,
        e.created_at,
        'own'::text as source_kind,
        'club'::text as actor_kind,
        1 as priority
      from viewer_profile vp
      join public.events e
        on vp.account_type = 'club'
       and e.club_id = vp.user_id
      where e.deleted_at is null
        and type_filter in ('all', 'events')
        and (since is null or e.created_at >= since)
        and (
          cursor_timestamp is null
          or (
            not oldest_first
            and (
              e.created_at < cursor_timestamp
              or (e.created_at = cursor_timestamp and e.id::text < coalesce(cursor_identity, ''))
            )
          )
          or (
            oldest_first
            and (
              e.created_at > cursor_timestamp
              or (e.created_at = cursor_timestamp and e.id::text > coalesce(cursor_identity, ''))
            )
          )
        )
      order by
        case when oldest_first then e.created_at end asc nulls last,
        case when not oldest_first then e.created_at end desc nulls last,
        case when oldest_first then e.id::text end asc nulls last,
        case when not oldest_first then e.id::text end desc nulls last
      limit candidate_limit
    ),
    followed_club_event_candidates as (
      select
        e.id,
        e.created_at,
        'following'::text as source_kind,
        'club'::text as actor_kind,
        2 as priority
      from followed_clubs fc
      join public.events e on e.club_id = fc.club_id
      where e.deleted_at is null
        and type_filter in ('all', 'events')
        and (since is null or e.created_at >= since)
        and (
          cursor_timestamp is null
          or (
            not oldest_first
            and (
              e.created_at < cursor_timestamp
              or (e.created_at = cursor_timestamp and e.id::text < coalesce(cursor_identity, ''))
            )
          )
          or (
            oldest_first
            and (
              e.created_at > cursor_timestamp
              or (e.created_at = cursor_timestamp and e.id::text > coalesce(cursor_identity, ''))
            )
          )
        )
      order by
        case when oldest_first then e.created_at end asc nulls last,
        case when not oldest_first then e.created_at end desc nulls last,
        case when oldest_first then e.id::text end asc nulls last,
        case when not oldest_first then e.id::text end desc nulls last
      limit candidate_limit
    ),
    followed_student_event_source as (
      select distinct on (e.id)
        e.id,
        e.created_at,
        'following'::text as source_kind,
        'student'::text as actor_kind,
        3 as priority
      from followed_students fs
      join public.event_attendees ea on ea.user_id = fs.student_id
      join public.events e on e.id = ea.event_id
      where e.deleted_at is null
        and type_filter in ('all', 'events')
        and (since is null or e.created_at >= since)
        and (
          cursor_timestamp is null
          or (
            not oldest_first
            and (
              e.created_at < cursor_timestamp
              or (e.created_at = cursor_timestamp and e.id::text < coalesce(cursor_identity, ''))
            )
          )
          or (
            oldest_first
            and (
              e.created_at > cursor_timestamp
              or (e.created_at = cursor_timestamp and e.id::text > coalesce(cursor_identity, ''))
            )
          )
        )
      order by e.id, e.created_at desc
    ),
    followed_student_event_candidates as (
      select *
      from followed_student_event_source
      order by
        case when oldest_first then created_at end asc nulls last,
        case when not oldest_first then created_at end desc nulls last,
        case when oldest_first then id::text end asc nulls last,
        case when not oldest_first then id::text end desc nulls last
      limit candidate_limit
    ),
    raw_event_candidates as (
      select * from own_event_candidates
      union all
      select * from followed_club_event_candidates
      union all
      select * from followed_student_event_candidates
    ),
    deduped_event_candidates as (
      select distinct on (raw_event_candidates.id)
        raw_event_candidates.*
      from raw_event_candidates
      order by raw_event_candidates.id, raw_event_candidates.priority asc, raw_event_candidates.created_at desc
    ),
    filtered_event_candidates as (
      select *
      from deduped_event_candidates
      where (
          source_filter is null
          or source_filter in ('all', '')
          or (source_filter = 'own' and source_kind = 'own')
          or (source_filter = 'following' and source_kind = 'following')
        )
        and (
          entity_filter is null
          or entity_filter in ('all', '')
          or (entity_filter = 'clubs' and actor_kind = 'club')
          or (entity_filter = 'students' and actor_kind = 'student')
        )
      order by
        case when oldest_first then created_at end asc nulls last,
        case when not oldest_first then created_at end desc nulls last,
        case when oldest_first then id::text end asc nulls last,
        case when not oldest_first then id::text end desc nulls last
      limit candidate_limit
    ),
    own_album_candidates as (
      select
        ap.id as photo_id,
        ap.created_at,
        'own'::text as source_kind,
        case
          when vp.account_type = 'club' then 'club'
          else 'student'
        end as actor_kind,
        1 as priority
      from viewer_profile vp
      join public.album_photos ap on ap.user_id = vp.user_id
      join public.events e on e.id = ap.event_id
      where ap.deleted_at is null
        and e.deleted_at is null
        and case
          when vp.account_type = 'club'
            then coalesce(ap.show_on_club_profile, ap.show_on_profile, false)
          else coalesce(ap.show_on_user_profile, ap.show_on_profile, false)
        end
        and type_filter in ('all', 'albums')
        and (since is null or ap.created_at >= since)
        and (
          cursor_timestamp is null
          or (
            not oldest_first
            and (
              ap.created_at < cursor_timestamp
              or (ap.created_at = cursor_timestamp and ap.id::text < coalesce(cursor_identity, ''))
            )
          )
          or (
            oldest_first
            and (
              ap.created_at > cursor_timestamp
              or (ap.created_at = cursor_timestamp and ap.id::text > coalesce(cursor_identity, ''))
            )
          )
        )
      order by
        case when oldest_first then ap.created_at end asc nulls last,
        case when not oldest_first then ap.created_at end desc nulls last,
        case when oldest_first then ap.id::text end asc nulls last,
        case when not oldest_first then ap.id::text end desc nulls last
      limit candidate_limit
    ),
    followed_club_album_candidates as (
      select
        ap.id as photo_id,
        ap.created_at,
        'following'::text as source_kind,
        'club'::text as actor_kind,
        2 as priority
      from followed_clubs fc
      join public.album_photos ap on ap.user_id = fc.club_id
      join public.events e on e.id = ap.event_id
      where ap.deleted_at is null
        and e.deleted_at is null
        and coalesce(ap.show_on_club_profile, ap.show_on_profile, false)
        and type_filter in ('all', 'albums')
        and (since is null or ap.created_at >= since)
        and (
          cursor_timestamp is null
          or (
            not oldest_first
            and (
              ap.created_at < cursor_timestamp
              or (ap.created_at = cursor_timestamp and ap.id::text < coalesce(cursor_identity, ''))
            )
          )
          or (
            oldest_first
            and (
              ap.created_at > cursor_timestamp
              or (ap.created_at = cursor_timestamp and ap.id::text > coalesce(cursor_identity, ''))
            )
          )
        )
      order by
        case when oldest_first then ap.created_at end asc nulls last,
        case when not oldest_first then ap.created_at end desc nulls last,
        case when oldest_first then ap.id::text end asc nulls last,
        case when not oldest_first then ap.id::text end desc nulls last
      limit candidate_limit
    ),
    followed_student_album_candidates as (
      select
        ap.id as photo_id,
        ap.created_at,
        'following'::text as source_kind,
        'student'::text as actor_kind,
        3 as priority
      from followed_students fs
      join public.album_photos ap on ap.user_id = fs.student_id
      join public.events e on e.id = ap.event_id
      where ap.deleted_at is null
        and e.deleted_at is null
        and coalesce(ap.show_on_user_profile, ap.show_on_profile, false)
        and type_filter in ('all', 'albums')
        and (since is null or ap.created_at >= since)
        and (
          cursor_timestamp is null
          or (
            not oldest_first
            and (
              ap.created_at < cursor_timestamp
              or (ap.created_at = cursor_timestamp and ap.id::text < coalesce(cursor_identity, ''))
            )
          )
          or (
            oldest_first
            and (
              ap.created_at > cursor_timestamp
              or (ap.created_at = cursor_timestamp and ap.id::text > coalesce(cursor_identity, ''))
            )
          )
        )
      order by
        case when oldest_first then ap.created_at end asc nulls last,
        case when not oldest_first then ap.created_at end desc nulls last,
        case when oldest_first then ap.id::text end asc nulls last,
        case when not oldest_first then ap.id::text end desc nulls last
      limit candidate_limit
    ),
    raw_album_candidates as (
      select * from own_album_candidates
      union all
      select * from followed_club_album_candidates
      union all
      select * from followed_student_album_candidates
    ),
    deduped_album_candidates as (
      select distinct on (raw_album_candidates.photo_id)
        raw_album_candidates.*
      from raw_album_candidates
      order by raw_album_candidates.photo_id, raw_album_candidates.priority asc, raw_album_candidates.created_at desc
    ),
    filtered_album_candidates as (
      select *
      from deduped_album_candidates
      where (
          source_filter is null
          or source_filter in ('all', '')
          or (source_filter = 'own' and source_kind = 'own')
          or (source_filter = 'following' and source_kind = 'following')
        )
        and (
          entity_filter is null
          or entity_filter in ('all', '')
          or (entity_filter = 'clubs' and actor_kind = 'club')
          or (entity_filter = 'students' and actor_kind = 'student')
        )
      order by
        case when oldest_first then created_at end asc nulls last,
        case when not oldest_first then created_at end desc nulls last,
        case when oldest_first then photo_id::text end asc nulls last,
        case when not oldest_first then photo_id::text end desc nulls last
      limit candidate_limit
    ),
    candidate_rows as (
      select
        fec.created_at as sort_date,
        concat('event:', fec.id::text) as item_id,
        'event'::text as kind,
        fec.id as event_id,
        null::uuid as photo_id,
        fec.source_kind,
        fec.actor_kind
      from filtered_event_candidates fec
      union all
      select
        fac.created_at as sort_date,
        concat('album:', fac.photo_id::text) as item_id,
        'album'::text as kind,
        null::uuid as event_id,
        fac.photo_id,
        fac.source_kind,
        fac.actor_kind
      from filtered_album_candidates fac
    ),
    ordered_candidate_rows as (
      select *
      from candidate_rows
      order by
        case when oldest_first then sort_date end asc nulls last,
        case when not oldest_first then sort_date end desc nulls last,
        case when oldest_first then item_id end asc nulls last,
        case when not oldest_first then item_id end desc nulls last
      limit candidate_limit
    ),
    hydration_candidate_rows as (
      select *
      from ordered_candidate_rows
      order by
        case when oldest_first then sort_date end asc nulls last,
        case when not oldest_first then sort_date end desc nulls last,
        case when oldest_first then item_id end asc nulls last,
        case when not oldest_first then item_id end desc nulls last
      limit hydration_limit
    ),
    selected_event_candidates as (
      select *
      from hydration_candidate_rows
      where kind = 'event'
    ),
    selected_album_candidates as (
      select *
      from hydration_candidate_rows
      where kind = 'album'
    ),
    event_album_counts as (
      select
        ap.event_id,
        count(*)::integer as album_count
      from public.album_photos ap
      join selected_event_candidates sec on sec.event_id = ap.event_id
      where ap.deleted_at is null
        and (
          coalesce(ap.show_on_club_profile, ap.show_on_profile, false)
          or coalesce(ap.show_on_user_profile, ap.show_on_profile, false)
        )
      group by ap.event_id
    ),
    event_rows as (
      select
        sec.sort_date,
        sec.item_id,
        jsonb_build_object(
          'id', sec.item_id,
          'kind', 'event',
          'sortDate', sec.sort_date,
          'source', sec.source_kind,
          'actor', sec.actor_kind,
          'event', to_jsonb(ev) || jsonb_build_object(
            'albumCount', coalesce(eac.album_count, 0)
          )
        ) as item
      from selected_event_candidates sec
      join lateral public.get_event_view_row(sec.event_id) ev on true
      left join event_album_counts eac on eac.event_id = sec.event_id
      where case
        when sec.source_kind = 'own' then ev.openable
        else ev.discoverable
      end
    ),
    album_rows as (
      select
        sac.sort_date,
        sac.item_id,
        jsonb_build_object(
          'id', sac.item_id,
          'kind', 'album',
          'sortDate', sac.sort_date,
          'source', sac.source_kind,
          'actor', sac.actor_kind,
          'album', to_jsonb(av) || jsonb_build_object(
            'show_on_user_profile', coalesce(ap.show_on_user_profile, ap.show_on_profile, false),
            'show_on_club_profile', coalesce(ap.show_on_club_profile, ap.show_on_profile, false)
          )
        ) as item
      from selected_album_candidates sac
      join public.album_photos ap on ap.id = sac.photo_id and ap.deleted_at is null
      join lateral public.get_album_view_row(sac.photo_id, 'feed') av on true
      left join resolved_viewer rv on true
      where av.openable
        or av.uploader_id = rv.uid
        or av.club_id = rv.uid
    ),
    hydrated_rows as (
      select * from event_rows
      union all
      select * from album_rows
    ),
    ordered_rows as (
      select *
      from hydrated_rows
      order by
        case when oldest_first then sort_date end asc nulls last,
        case when not oldest_first then sort_date end desc nulls last,
        case when oldest_first then item_id end asc nulls last,
        case when not oldest_first then item_id end desc nulls last
      limit page_limit + 1
    ),
    page_rows as (
      select *
      from ordered_rows
      order by
        case when oldest_first then sort_date end asc nulls last,
        case when not oldest_first then sort_date end desc nulls last,
        case when oldest_first then item_id end asc nulls last,
        case when not oldest_first then item_id end desc nulls last
      limit page_limit
    ),
    overflow_row as (
      select *
      from ordered_rows
      order by
        case when oldest_first then sort_date end asc nulls last,
        case when not oldest_first then sort_date end desc nulls last,
        case when oldest_first then item_id end asc nulls last,
        case when not oldest_first then item_id end desc nulls last
      offset page_limit
      limit 1
    )
    select public.build_projection_envelope(
      items := coalesce(
        jsonb_agg(
          r.item
          order by
            case when oldest_first then r.sort_date end asc nulls last,
            case when not oldest_first then r.sort_date end desc nulls last,
            case when oldest_first then r.item_id end asc nulls last,
            case when not oldest_first then r.item_id end desc nulls last
        ),
        '[]'::jsonb
      ),
      next_cursor := (
        select case
          when o.item_id is null then null
          else to_char(timezone('utc', o.sort_date), 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') || '|' || o.item_id
        end
        from overflow_row o
      ),
      server_time := emitted_at,
      delta_token := emitted_at
    )
    from page_rows r
  );
end;
$$;
create or replace function public.home_feed_projection(
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
  select public.home_feed_projection(
    auth.uid(),
    cursor,
    limit_count,
    public.resolve_projection_since(since, delta_token),
    source_filter,
    type_filter,
    entity_filter,
    sort_mode
  );
$$;
create or replace function public.search_results_projection(
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
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  normalized_query text := lower(trim(coalesce(query_text, '')));
  prefix_pattern text := lower(trim(coalesce(query_text, ''))) || '%';
  prefix_tsquery tsquery := public.build_prefix_search_tsquery(query_text);
  page_limit integer := least(greatest(limit_count, 1), 12);
  candidate_limit integer := least(greatest(page_limit * 8, 96), 192);
  cursor_timestamp timestamptz := case
    when cursor is null or split_part(cursor, '|', 1) = '' then null
    else split_part(cursor, '|', 1)::timestamptz
  end;
  cursor_identity text := nullif(split_part(cursor, '|', 2), '');
  oldest_first boolean := lower(trim(coalesce(sort_mode, 'newest'))) = 'oldest';
  emitted_at timestamptz := timezone('utc', now());
begin
  if kind_name = 'events' then
    return (
      with resolved_viewer as (
        select coalesce(viewer_id, auth.uid()) as uid
      ),
      accepted_follows as (
        select f.following_id
        from public.follows f
        join resolved_viewer rv on rv.uid is not null and f.follower_id = rv.uid
        where f.status = 'accepted'
          and f.deleted_at is null
      ),
      event_candidates as (
        select
          e.id,
          e.created_at
        from public.events e
        join public.profiles club
          on club.user_id = e.club_id
         and club.deleted_at is null
        cross join resolved_viewer rv
        where e.deleted_at is null
          and coalesce(club.is_private, false) = false
          and (rv.uid is null or e.club_id <> rv.uid)
          and not exists (
            select 1
            from accepted_follows af
            where af.following_id = e.club_id
          )
          and (
            normalized_query = '' or
            (
              prefix_tsquery is not null and
              to_tsvector(
                'simple',
                coalesce(e.title, '') || ' ' ||
                coalesce(e.description, '') || ' ' ||
                coalesce(e.location_name, '')
              ) @@ prefix_tsquery
            ) or
            lower(coalesce(e.title, '')) like prefix_pattern or
            lower(coalesce(e.location_name, '')) like prefix_pattern or
            lower(coalesce(club.username, '')) like prefix_pattern or
            lower(coalesce(club.club_name, club.name, '')) like prefix_pattern
          )
          and (category_filter is null or e.category = category_filter)
          and (university_filter is null or club.university = university_filter)
          and (
            fee_filter is null or fee_filter = '' or
            (fee_filter = 'free' and lower(coalesce(e.fee_label, '')) like '%ucretsiz%') or
            (fee_filter = 'paid' and lower(coalesce(e.fee_label, '')) not like '%ucretsiz%')
          )
          and (
            visibility_filter is null or visibility_filter = '' or
            e.visibility::text = visibility_filter
          )
          and (since is null or e.created_at >= since)
          and (
            cursor_timestamp is null
            or (
              not oldest_first
              and (
                e.created_at < cursor_timestamp
                or (e.created_at = cursor_timestamp and e.id::text < coalesce(cursor_identity, ''))
              )
            )
            or (
              oldest_first
              and (
                e.created_at > cursor_timestamp
                or (e.created_at = cursor_timestamp and e.id::text > coalesce(cursor_identity, ''))
              )
            )
          )
        order by
          case when oldest_first then e.created_at end asc nulls last,
          case when not oldest_first then e.created_at end desc nulls last,
          case when oldest_first then e.id::text end asc nulls last,
          case when not oldest_first then e.id::text end desc nulls last
        limit candidate_limit
      ),
      event_album_counts as (
        select
          ap.event_id,
          count(*)::integer as album_count
        from public.album_photos ap
        join event_candidates ec on ec.id = ap.event_id
        where ap.deleted_at is null
          and coalesce(ap.show_on_club_profile, ap.show_on_profile, false)
        group by ap.event_id
      ),
      visible_event_rows as (
        select
          ev.created_at,
          ec.id::text as row_id,
          to_jsonb(ev) || jsonb_build_object(
            'albumCount', coalesce(eac.album_count, 0)
          ) as item_json
        from event_candidates ec
        join lateral public.get_event_view_row(ec.id) ev on true
        left join event_album_counts eac on eac.event_id = ec.id
        where ev.discoverable
          and coalesce(ev.club_is_private, false) = false
      ),
      ordered_rows as (
        select *
        from visible_event_rows r
        order by
          case when oldest_first then r.created_at end asc nulls last,
          case when not oldest_first then r.created_at end desc nulls last,
          case when oldest_first then r.row_id end asc nulls last,
          case when not oldest_first then r.row_id end desc nulls last
        limit page_limit + 1
      ),
      page_rows as (
        select *
        from ordered_rows r
        order by
          case when oldest_first then r.created_at end asc nulls last,
          case when not oldest_first then r.created_at end desc nulls last,
          case when oldest_first then r.row_id end asc nulls last,
          case when not oldest_first then r.row_id end desc nulls last
        limit page_limit
      ),
      overflow_row as (
        select *
        from ordered_rows r
        order by
          case when oldest_first then r.created_at end asc nulls last,
          case when not oldest_first then r.created_at end desc nulls last,
          case when oldest_first then r.row_id end asc nulls last,
          case when not oldest_first then r.row_id end desc nulls last
        offset page_limit
        limit 1
      )
      select public.build_projection_envelope(
        items := coalesce(
          jsonb_agg(
            r.item_json
            order by
              case when oldest_first then r.created_at end asc nulls last,
              case when not oldest_first then r.created_at end desc nulls last,
              case when oldest_first then r.row_id end asc nulls last,
              case when not oldest_first then r.row_id end desc nulls last
          ),
          '[]'::jsonb
        ),
        next_cursor := (
          select case
            when o.row_id is null then null
            else to_char(timezone('utc', o.created_at), 'YYYY-MM-DD\"T\"HH24:MI:SS.MS\"Z\"') || '|' || o.row_id
          end
          from overflow_row o
        ),
        server_time := emitted_at,
        delta_token := emitted_at
      )
      from page_rows r
    );
  elsif kind_name = 'albums' then
    return (
      with resolved_viewer as (
        select coalesce(viewer_id, auth.uid()) as uid
      ),
      accepted_follows as (
        select f.following_id
        from public.follows f
        join resolved_viewer rv on rv.uid is not null and f.follower_id = rv.uid
        where f.status = 'accepted'
          and f.deleted_at is null
      ),
      ordered_rows as (
        select
          a.created_at,
          a.photo_id::text as row_id,
          to_jsonb(a) || jsonb_build_object(
            'show_on_user_profile', coalesce(ap.show_on_user_profile, ap.show_on_profile, false),
            'show_on_club_profile', coalesce(ap.show_on_club_profile, ap.show_on_profile, false)
          ) as item_json
        from public.list_visible_albums('search', null, null) a
        join public.album_photos ap on ap.id = a.photo_id
        cross join resolved_viewer rv
        where ap.deleted_at is null
          and coalesce(a.club_is_private, false) = false
          and (rv.uid is null or (a.uploader_id <> rv.uid and a.club_id <> rv.uid))
          and not exists (
            select 1
            from accepted_follows af
            where af.following_id in (a.uploader_id, a.club_id)
          )
          and (
            normalized_query = '' or
            (
              prefix_tsquery is not null and
              to_tsvector(
                'simple',
                coalesce(a.title, '') || ' ' ||
                coalesce(a.caption, '') || ' ' ||
                coalesce(a.event_title, '') || ' ' ||
                coalesce(a.uploader_username, '') || ' ' ||
                coalesce(a.club_username, '')
              ) @@ prefix_tsquery
            ) or
            lower(coalesce(a.title, '')) like prefix_pattern or
            lower(coalesce(a.caption, '')) like prefix_pattern or
            lower(coalesce(a.event_title, '')) like prefix_pattern or
            lower(coalesce(a.uploader_username, '')) like prefix_pattern or
            lower(coalesce(a.club_username, '')) like prefix_pattern
          )
          and (since is null or a.created_at >= since)
          and (
            cursor_timestamp is null
            or (
              not oldest_first
              and (
                a.created_at < cursor_timestamp
                or (a.created_at = cursor_timestamp and a.photo_id::text < coalesce(cursor_identity, ''))
              )
            )
            or (
              oldest_first
              and (
                a.created_at > cursor_timestamp
                or (a.created_at = cursor_timestamp and a.photo_id::text > coalesce(cursor_identity, ''))
              )
            )
          )
        order by
          case when oldest_first then a.created_at end asc nulls last,
          case when not oldest_first then a.created_at end desc nulls last,
          case when oldest_first then a.photo_id::text end asc nulls last,
          case when not oldest_first then a.photo_id::text end desc nulls last
        limit page_limit + 1
      ),
      page_rows as (
        select *
        from ordered_rows r
        order by
          case when oldest_first then r.created_at end asc nulls last,
          case when not oldest_first then r.created_at end desc nulls last,
          case when oldest_first then r.row_id end asc nulls last,
          case when not oldest_first then r.row_id end desc nulls last
        limit page_limit
      ),
      overflow_row as (
        select *
        from ordered_rows r
        order by
          case when oldest_first then r.created_at end asc nulls last,
          case when not oldest_first then r.created_at end desc nulls last,
          case when oldest_first then r.row_id end asc nulls last,
          case when not oldest_first then r.row_id end desc nulls last
        offset page_limit
        limit 1
      )
      select public.build_projection_envelope(
        items := coalesce(
          jsonb_agg(
            r.item_json
            order by
              case when oldest_first then r.created_at end asc nulls last,
              case when not oldest_first then r.created_at end desc nulls last,
              case when oldest_first then r.row_id end asc nulls last,
              case when not oldest_first then r.row_id end desc nulls last
          ),
          '[]'::jsonb
        ),
        next_cursor := (
          select case
            when o.row_id is null then null
            else to_char(timezone('utc', o.created_at), 'YYYY-MM-DD\"T\"HH24:MI:SS.MS\"Z\"') || '|' || o.row_id
          end
          from overflow_row o
        ),
        server_time := emitted_at,
        delta_token := emitted_at
      )
      from page_rows r
    );
  else
    return (
      with resolved_viewer as (
        select coalesce(viewer_id, auth.uid()) as uid
      ),
      accepted_follows as (
        select f.following_id
        from public.follows f
        join resolved_viewer rv on rv.uid is not null and f.follower_id = rv.uid
        where f.status = 'accepted'
          and f.deleted_at is null
      ),
      ordered_rows as (
        select
          p.created_at,
          p.user_id::text as row_id,
          p.user_id as id,
          p.username,
          coalesce(p.name, p.club_name, p.username) as name,
          coalesce(p.profile_image_path, '') as image,
          coalesce(p.cover_image_path, '') as "coverImage",
          coalesce(p.university, '') as university,
          p.is_private as "isPrivate",
          p.created_at as "createdAt",
          p.department,
          p.grade_year as year,
          case when array_length(p.categories, 1) > 0 then p.categories[1] else null end as category,
          coalesce(p.categories, '{}'::text[]) as categories,
          coalesce(p.description, p.bio, '') as description,
          coalesce(p.bio, p.description, '') as bio
        from public.profiles p
        cross join resolved_viewer rv
        where p.account_type = case when kind_name = 'clubs' then 'club'::public.account_type else 'student'::public.account_type end
          and p.deleted_at is null
          and (rv.uid is null or p.user_id <> rv.uid)
          and not exists (
            select 1
            from accepted_follows af
            where af.following_id = p.user_id
          )
          and (
            normalized_query = '' or
            (
              prefix_tsquery is not null and
              to_tsvector(
                'simple',
                coalesce(p.username, '') || ' ' ||
                coalesce(p.name, '') || ' ' ||
                coalesce(p.club_name, '') || ' ' ||
                coalesce(p.description, '') || ' ' ||
                coalesce(p.bio, '')
              ) @@ prefix_tsquery
            ) or
            lower(coalesce(p.username, '')) like prefix_pattern or
            lower(coalesce(p.name, '')) like prefix_pattern or
            lower(coalesce(p.club_name, '')) like prefix_pattern
          )
          and (category_filter is null or kind_name <> 'clubs' or category_filter = any(coalesce(p.categories, '{}'::text[])))
          and (university_filter is null or p.university = university_filter)
          and (since is null or p.last_activity_at >= since)
          and (
            cursor_timestamp is null
            or (
              not oldest_first
              and (
                p.created_at < cursor_timestamp
                or (p.created_at = cursor_timestamp and p.user_id::text < coalesce(cursor_identity, ''))
              )
            )
            or (
              oldest_first
              and (
                p.created_at > cursor_timestamp
                or (p.created_at = cursor_timestamp and p.user_id::text > coalesce(cursor_identity, ''))
              )
            )
          )
        order by
          case when oldest_first then p.created_at end asc nulls last,
          case when not oldest_first then p.created_at end desc nulls last,
          case when oldest_first then p.user_id::text end asc nulls last,
          case when not oldest_first then p.user_id::text end desc nulls last
        limit page_limit + 1
      ),
      page_rows as (
        select *
        from ordered_rows r
        order by
          case when oldest_first then r.created_at end asc nulls last,
          case when not oldest_first then r.created_at end desc nulls last,
          case when oldest_first then r.row_id end asc nulls last,
          case when not oldest_first then r.row_id end desc nulls last
        limit page_limit
      ),
      overflow_row as (
        select *
        from ordered_rows r
        order by
          case when oldest_first then r.created_at end asc nulls last,
          case when not oldest_first then r.created_at end desc nulls last,
          case when oldest_first then r.row_id end asc nulls last,
          case when not oldest_first then r.row_id end desc nulls last
        offset page_limit
        limit 1
      )
      select public.build_projection_envelope(
        items := coalesce(
          jsonb_agg(
            jsonb_build_object(
              'id', r.id,
              'username', r.username,
              'name', r.name,
              'image', r.image,
              'coverImage', r."coverImage",
              'university', r.university,
              'isPrivate', r."isPrivate",
              'createdAt', r."createdAt",
              'department', r.department,
              'year', r.year,
              'category', r.category,
              'categories', r.categories,
              'description', r.description,
              'bio', r.bio
            )
            order by
              case when oldest_first then r.created_at end asc nulls last,
              case when not oldest_first then r.created_at end desc nulls last,
              case when oldest_first then r.row_id end asc nulls last,
              case when not oldest_first then r.row_id end desc nulls last
          ),
          '[]'::jsonb
        ),
        next_cursor := (
          select case
            when o.row_id is null then null
            else to_char(timezone('utc', o.created_at), 'YYYY-MM-DD\"T\"HH24:MI:SS.MS\"Z\"') || '|' || o.row_id
          end
          from overflow_row o
        ),
        server_time := emitted_at,
        delta_token := emitted_at
      )
      from page_rows r
    );
  end if;
end;
$$;
create or replace function public.search_results_projection(
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
  select public.search_results_projection(
    auth.uid(),
    kind_name,
    query_text,
    category_filter,
    university_filter,
    fee_filter,
    visibility_filter,
    sort_mode,
    cursor,
    limit_count,
    public.resolve_projection_since(since, delta_token)
  );
$$;
create or replace function public.club_members_projection(
  viewer_id uuid default null,
  target_username text default null,
  cursor text default null,
  limit_count integer default 80,
  since timestamptz default null,
  include_requests boolean default true
)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with target_profile as (
    select p.user_id
    from public.profiles p
    where lower(trim(coalesce(p.username, ''))) = lower(trim(coalesce(target_username, '')))
      and p.deleted_at is null
    limit 1
  ),
  caps as (
    select *
    from public.get_profile_capabilities((select user_id from target_profile))
  ),
  request_rows as (
    select
      cm.member_id as item_id,
      'request'::text as kind,
      p.username,
      coalesce(p.name, p.club_name, p.username) as display_name,
      coalesce(p.profile_image_path, '') as image,
      coalesce(p.cover_image_path, '') as cover_image,
      coalesce(p.university, '') as university,
      p.account_type,
      p.is_private,
      p.department,
      p.grade_year,
      coalesce(p.categories, '{}'::text[]) as categories,
      p.bio,
      p.description,
      cm.request_message as message,
      cm.created_at as activity_at,
      null::text as role
    from public.club_memberships cm
    join target_profile tp on tp.user_id = cm.club_id
    join public.profiles p on p.user_id = cm.member_id and p.deleted_at is null
    where include_requests
      and cm.status = 'pending'::public.membership_status
      and cm.deleted_at is null
      and coalesce((select can_view_members from caps), false)
      and (since is null or cm.last_activity_at >= since)
  ),
  member_rows as (
    select
      cm.member_id as item_id,
      'member'::text as kind,
      p.username,
      coalesce(p.name, p.club_name, p.username) as display_name,
      coalesce(p.profile_image_path, '') as image,
      coalesce(p.cover_image_path, '') as cover_image,
      coalesce(p.university, '') as university,
      p.account_type,
      p.is_private,
      p.department,
      p.grade_year,
      coalesce(p.categories, '{}'::text[]) as categories,
      p.bio,
      p.description,
      cm.request_message as message,
      cm.created_at as activity_at,
      cm.role
    from public.club_memberships cm
    join target_profile tp on tp.user_id = cm.club_id
    join public.profiles p on p.user_id = cm.member_id and p.deleted_at is null
    where cm.status = 'accepted'::public.membership_status
      and cm.deleted_at is null
      and coalesce((select can_view_members from caps), false)
      and (since is null or cm.last_activity_at >= since)
  ),
  merged_rows as (
    select *
    from request_rows
    union all
    select *
    from member_rows
  ),
  rows as (
    select *
    from merged_rows
    order by kind asc, activity_at desc, item_id desc
    limit least(greatest(coalesce(limit_count, 80), 1), 120)
  )
  select public.build_projection_envelope(
    items := coalesce(jsonb_agg(
      jsonb_build_object(
        'id', r.item_id,
        'kind', r.kind,
        'userId', r.item_id,
        'username', r.username,
        'name', r.display_name,
        'image', r.image,
        'profileImage', r.image,
        'coverImage', r.cover_image,
        'university', r.university,
        'accountType', r.account_type,
        'account_type', r.account_type,
        'isPrivate', r.is_private,
        'department', r.department,
        'year', r.grade_year,
        'category', case when coalesce(array_length(r.categories, 1), 0) > 0 then r.categories[1] else null end,
        'categories', to_jsonb(r.categories),
        'bio', r.bio,
        'description', r.description,
        'message', r.message,
        'requestedAt', case when r.kind = 'request' then public.display_projection_time(r.activity_at) else null end,
        'joinedAt', case when r.kind = 'member' then public.display_projection_time(r.activity_at) else null end,
        'role', r.role
      )
      order by r.kind asc, r.activity_at desc, r.item_id desc
    ), '[]'::jsonb),
    updated_items := '[]'::jsonb,
    deleted_ids := '[]'::jsonb,
    next_cursor := null,
    server_time := timezone('utc', now()),
    delta_token := timezone('utc', now())
  )
  from rows r;
$$;
create or replace function public.club_members_projection(
  viewer_id uuid,
  target_username text,
  cursor text,
  limit_count integer,
  since timestamptz,
  include_requests boolean,
  delta_token text
)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select public.club_members_projection(
    viewer_id,
    target_username,
    cursor,
    limit_count,
    public.resolve_projection_since(since, delta_token),
    include_requests
  );
$$;
create or replace function public.album_photo_likers_projection(
  viewer_id uuid default null,
  target_photo_id uuid default null,
  cursor text default null,
  limit_count integer default 40,
  since timestamptz default null
)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with rows as (
    select
      p.user_id as id,
      p.username,
      coalesce(p.name, p.club_name, p.username) as name,
      coalesce(p.profile_image_path, '') as image,
      coalesce(p.cover_image_path, '') as coverImage,
      coalesce(p.university, '') as university,
      p.is_private as isPrivate,
      p.created_at as createdAt,
      p.department,
      p.grade_year as year,
      nullif(coalesce(p.categories[1], ''), '') as category,
      p.categories,
      p.description,
      p.bio,
      p.account_type as accountType
    from public.album_photo_likes apl
    join public.album_photos ap on ap.id = apl.photo_id
    join public.profiles p on p.user_id = apl.user_id
    where apl.photo_id = target_photo_id
      and public.can_view_event(ap.event_id)
      and (since is null or apl.created_at >= since)
    order by apl.created_at desc, p.user_id asc
    limit greatest(limit_count, 1)
  )
  select jsonb_build_object(
    'items', coalesce(jsonb_agg(to_jsonb(r) order by r.createdAt desc, r.id asc), '[]'::jsonb),
    'updated_items', '[]'::jsonb,
    'deleted_ids', '[]'::jsonb,
    'next_cursor', null,
    'server_time', timezone('utc', now()),
    'delta_token', timezone('utc', now())
  )
  from rows r;
$$;
create or replace function public.relationship_snapshot_projection(
  viewer_id uuid default null,
  viewer_username text default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  resolved_viewer_id uuid := auth.uid();
  resolved_viewer_username text := nullif(lower(trim(coalesce(viewer_username, ''))), '');
  snapshot_payload jsonb;
begin
  if resolved_viewer_id is null and resolved_viewer_username is not null then
    select p.user_id
    into resolved_viewer_id
    from public.profiles p
    where p.deleted_at is null
      and lower(trim(p.username)) = resolved_viewer_username
    limit 1;
  end if;

  if resolved_viewer_username is null and resolved_viewer_id is not null then
    select nullif(lower(trim(p.username)), '')
    into resolved_viewer_username
    from public.profiles p
    where p.deleted_at is null
      and p.user_id = resolved_viewer_id
    limit 1;
  end if;

  with following_profiles as (
    select distinct
      nullif(lower(trim(p.username)), '') as username,
      case when p.account_type = 'club' then 'club' else 'student' end as account_type,
      case when p.account_type = 'club' then false else coalesce(p.is_private, false) end as is_private
    from public.follows f
    join public.profiles p
      on p.user_id = f.following_id
     and p.deleted_at is null
    where resolved_viewer_id is not null
      and f.follower_id = resolved_viewer_id
      and f.status = 'accepted'
      and f.deleted_at is null
  ),
  normalized_following as (
    select username, account_type, is_private
    from following_profiles
    where username is not null
    order by username
  )
  select jsonb_build_object(
    'id', coalesce(resolved_viewer_id::text, resolved_viewer_username, 'guest'),
    'viewerId', coalesce(resolved_viewer_id::text, ''),
    'viewerUsername', coalesce(resolved_viewer_username, ''),
    'following',
      coalesce(
        (
          select jsonb_agg(
            jsonb_build_object(
              'username', username,
              'accountType', account_type,
              'isPrivate', is_private
            )
            order by username
          )
          from normalized_following
        ),
        '[]'::jsonb
      ),
    'followingUsernames',
      coalesce(
        (select jsonb_agg(username order by username) from normalized_following),
        '[]'::jsonb
      ),
    'followingClubUsernames',
      coalesce(
        (
          select jsonb_agg(username order by username)
          from normalized_following
          where account_type = 'club'
        ),
        '[]'::jsonb
      ),
    'followingStudentUsernames',
      coalesce(
        (
          select jsonb_agg(username order by username)
          from normalized_following
          where account_type = 'student'
        ),
        '[]'::jsonb
      ),
    'clubPrivacyMap',
      coalesce(
        (select jsonb_object_agg(username, to_jsonb(is_private)) from normalized_following),
        '{}'::jsonb
      )
  )
  into snapshot_payload;

  return snapshot_payload;
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
begin
  if resolved_viewer_username is null and resolved_viewer_id is not null then
    select nullif(lower(trim(p.username)), '')
    into resolved_viewer_username
    from public.profiles p
    where p.user_id = resolved_viewer_id
    limit 1;
  end if;

  home_payload := public.home_feed_projection(
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
    )
  );
end;
$$;
grant execute on function public.get_profile_summary(uuid) to authenticated;
grant execute on function public.list_visible_events(text) to authenticated;
grant execute on function public.list_home_feed_events_for_viewer(uuid) to authenticated;
grant execute on function public.list_home_feed_events() to authenticated;
grant execute on function public.list_profile_visible_events(uuid) to authenticated;
grant execute on function public.list_club_visible_events(text) to authenticated;
grant execute on function public.get_visible_event(uuid) to authenticated;
grant execute on function public.list_visible_albums(text, uuid, uuid[]) to authenticated;
grant execute on function public.list_profile_visible_albums(uuid) to authenticated;
grant execute on function public.notification_badge_projection(uuid, timestamptz) to authenticated;
grant execute on function public.notification_badge_projection(uuid, timestamptz, text) to authenticated;
grant execute on function public.notifications_projection(uuid, text, text, integer, timestamptz, text) to authenticated;
grant execute on function public.profile_overview_projection(uuid, text, timestamptz, text) to authenticated;
grant execute on function public.profile_content_projection(uuid, text, text, text, integer, timestamptz, text) to authenticated;
grant execute on function public.profile_screen_projection(uuid, text, text, text, integer, timestamptz, text) to authenticated;
grant execute on function public.home_feed_projection(uuid, text, integer, timestamptz, text, text, text, text) to authenticated;
grant execute on function public.home_feed_projection(uuid, text, integer, timestamptz, text, text, text, text, text) to authenticated;
grant execute on function public.search_results_projection(uuid, text, text, text, text, text, text, text, text, integer, timestamptz) to authenticated;
grant execute on function public.search_results_projection(uuid, text, text, text, text, text, text, text, text, integer, timestamptz, text) to authenticated;
grant execute on function public.relationship_list_projection(uuid, text, text, text, integer, timestamptz, text) to authenticated;
grant execute on function public.blocked_users_projection(uuid, text, integer, timestamptz, text) to authenticated;
grant execute on function public.event_detail_projection(uuid, uuid, timestamptz) to authenticated;
grant execute on function public.event_detail_projection(uuid, uuid, timestamptz, text) to authenticated;
grant execute on function public.album_event_projection(uuid, uuid, text, integer, timestamptz, text) to authenticated;
grant execute on function public.event_comments_projection(uuid, uuid, text, integer, timestamptz, text) to authenticated;
grant execute on function public.event_likers_projection(uuid, uuid, text, integer, timestamptz, text) to authenticated;
grant execute on function public.event_attendees_projection(uuid, uuid, text, integer, timestamptz, text) to authenticated;
grant execute on function public.album_comments_projection(uuid, uuid, text, integer, timestamptz, text) to authenticated;
grant execute on function public.event_comment_likers_projection(uuid, uuid, text, integer, timestamptz, text) to authenticated;
grant execute on function public.album_comment_likers_projection(uuid, uuid, text, integer, timestamptz, text) to authenticated;
grant execute on function public.club_members_projection(uuid, text, text, integer, timestamptz, boolean, text) to authenticated;
grant execute on function public.album_photo_likers_projection(uuid, uuid, text, integer, timestamptz) to authenticated;
grant execute on function public.relationship_snapshot_projection(uuid, text) to authenticated;
grant execute on function public.app_warmup_projection(uuid, text, text, text, text, text, text, text, text) to authenticated;
