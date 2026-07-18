-- Canonical baseline migration.
-- Sources:
--   - 20260307130000_phase2_projection_infrastructure.sql
--   - 20260311164000_projection_delta_and_profile_screen_bootstrap.sql
--   - 20260312133000_secondary_projection_cursor_and_index_closure.sql
--   - 20260312143000_projection_envelope_architecture_helper.sql
--   - 20260326160000_idempotent_create_and_counters.sql
--   - 20260326200000_secondary_projection_hot_path_followup.sql

create table if not exists public.event_engagement_counters (
  event_id uuid primary key references public.events(id) on delete cascade,
  likes_count bigint not null default 0,
  attendees_count bigint not null default 0,
  comments_count bigint not null default 0,
  updated_at timestamptz not null default timezone('utc', now())
);
create table if not exists public.album_engagement_counters (
  photo_id uuid primary key references public.album_photos(id) on delete cascade,
  likes_count bigint not null default 0,
  comments_count bigint not null default 0,
  updated_at timestamptz not null default timezone('utc', now())
);
create table if not exists public.event_album_summary_cache (
  event_id uuid primary key references public.events(id) on delete cascade,
  album_count bigint not null default 0,
  updated_at timestamptz not null default timezone('utc', now())
);
alter table public.event_engagement_counters enable row level security;
alter table public.album_engagement_counters enable row level security;
alter table public.event_album_summary_cache enable row level security;
drop policy if exists "event_engagement_counters_select_visible_event"
  on public.event_engagement_counters;
create policy "event_engagement_counters_select_visible_event"
on public.event_engagement_counters
for select
using (public.can_view_event(event_id));
drop policy if exists "album_engagement_counters_select_visible_photo"
  on public.album_engagement_counters;
create policy "album_engagement_counters_select_visible_photo"
on public.album_engagement_counters
for select
using (
  exists (
    select 1
    from public.album_photos ap
    where ap.id = photo_id
      and ap.deleted_at is null
      and public.can_view_event(ap.event_id)
  )
);
drop policy if exists "event_album_summary_cache_select_visible_event"
  on public.event_album_summary_cache;
create policy "event_album_summary_cache_select_visible_event"
on public.event_album_summary_cache
for select
using (public.can_view_event(event_id));
create or replace function public.bump_projection_row()
returns trigger
language plpgsql
as $$
begin
  new.last_activity_at := timezone('utc', now());
  new.sync_version := coalesce(old.sync_version, 0) + 1;
  return new;
end;
$$;
create or replace function public.touch_profile_projection_row(target_user_id uuid)
returns void
language sql
as $$
  update public.profiles
  set
    last_activity_at = timezone('utc', now()),
    sync_version = coalesce(sync_version, 0) + 1
  where user_id = target_user_id;
$$;
create or replace function public.touch_event_projection_row(target_event_id uuid)
returns void
language sql
as $$
  update public.events
  set
    last_activity_at = timezone('utc', now()),
    sync_version = coalesce(sync_version, 0) + 1
  where id = target_event_id;
$$;
create or replace function public.touch_album_projection_row(target_photo_id uuid)
returns void
language sql
as $$
  update public.album_photos
  set
    last_activity_at = timezone('utc', now()),
    sync_version = coalesce(sync_version, 0) + 1
  where id = target_photo_id;
$$;
create or replace function public.touch_event_from_album_projection_row(target_photo_id uuid)
returns void
language sql
as $$
  with target_event as (
    select event_id
    from public.album_photos
    where id = target_photo_id
  )
  update public.events
  set
    last_activity_at = timezone('utc', now()),
    sync_version = coalesce(sync_version, 0) + 1
  where id in (select event_id from target_event);
$$;
create or replace function public.sync_touch_event_projection()
returns trigger
language plpgsql
as $$
declare
  target_event_id uuid;
begin
  target_event_id := case when tg_op = 'DELETE' then old.event_id else new.event_id end;
  perform public.touch_event_projection_row(target_event_id);
  return coalesce(new, old);
end;
$$;
create or replace function public.sync_touch_album_projection()
returns trigger
language plpgsql
as $$
declare
  target_photo_id uuid;
begin
  target_photo_id := case when tg_op = 'DELETE' then old.photo_id else new.photo_id end;
  perform public.touch_album_projection_row(target_photo_id);
  perform public.touch_event_from_album_projection_row(target_photo_id);
  return coalesce(new, old);
end;
$$;
create or replace function public.sync_touch_profile_projection()
returns trigger
language plpgsql
as $$
begin
  if tg_table_name = 'follows' then
    perform public.touch_profile_projection_row(case when tg_op = 'DELETE' then old.follower_id else new.follower_id end);
    perform public.touch_profile_projection_row(case when tg_op = 'DELETE' then old.following_id else new.following_id end);
  elsif tg_table_name = 'club_memberships' then
    perform public.touch_profile_projection_row(case when tg_op = 'DELETE' then old.club_id else new.club_id end);
    perform public.touch_profile_projection_row(case when tg_op = 'DELETE' then old.member_id else new.member_id end);
  elsif tg_table_name = 'notifications' then
    perform public.touch_profile_projection_row(case when tg_op = 'DELETE' then old.user_id else new.user_id end);
  end if;
  return coalesce(new, old);
end;
$$;
create or replace function public.display_projection_time(value timestamptz)
returns text
language sql
immutable
as $$
  select to_char(value at time zone 'UTC', 'DD.MM.YYYY HH24:MI');
$$;
create or replace function public.resolve_projection_since(
  since timestamptz default null,
  delta_token text default null
)
returns timestamptz
language sql
stable
set search_path = public
as $$
  select coalesce(
    case
      when nullif(trim(coalesce(delta_token, '')), '') is null then null
      else nullif(trim(coalesce(delta_token, '')), '')::timestamptz
    end,
    since
  );
$$;
create or replace function public.build_projection_cursor(cursor_timestamp timestamptz, cursor_identity text)
returns text
language sql
stable
as $$
  select case
    when cursor_timestamp is null or nullif(cursor_identity, '') is null then null
    else to_char(timezone('utc', cursor_timestamp), 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') || '|' || cursor_identity
  end;
$$;
create or replace function public.build_projection_envelope(
  items jsonb,
  updated_items jsonb default '[]'::jsonb,
  deleted_ids jsonb default '[]'::jsonb,
  next_cursor text default null,
  server_time timestamptz default timezone('utc', now()),
  delta_token timestamptz default timezone('utc', now())
)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'items', coalesce(items, '[]'::jsonb),
    'updated_items', coalesce(updated_items, '[]'::jsonb),
    'deleted_ids', coalesce(deleted_ids, '[]'::jsonb),
    'next_cursor', next_cursor,
    'server_time', coalesce(server_time, timezone('utc', now())),
    'delta_token', coalesce(delta_token, timezone('utc', now()))
  );
$$;
create or replace function public.touch_event_engagement_counter(
  target_event_id uuid,
  like_delta bigint default 0,
  attendee_delta bigint default 0,
  comment_delta bigint default 0
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if target_event_id is null then
    return;
  end if;

  insert into public.event_engagement_counters (event_id)
  values (target_event_id)
  on conflict (event_id) do nothing;

  update public.event_engagement_counters
  set
    likes_count = greatest(0, likes_count + coalesce(like_delta, 0)),
    attendees_count = greatest(0, attendees_count + coalesce(attendee_delta, 0)),
    comments_count = greatest(0, comments_count + coalesce(comment_delta, 0)),
    updated_at = timezone('utc', now())
  where event_id = target_event_id;
end;
$$;
create or replace function public.touch_album_engagement_counter(
  target_photo_id uuid,
  like_delta bigint default 0,
  comment_delta bigint default 0
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if target_photo_id is null then
    return;
  end if;

  insert into public.album_engagement_counters (photo_id)
  values (target_photo_id)
  on conflict (photo_id) do nothing;

  update public.album_engagement_counters
  set
    likes_count = greatest(0, likes_count + coalesce(like_delta, 0)),
    comments_count = greatest(0, comments_count + coalesce(comment_delta, 0)),
    updated_at = timezone('utc', now())
  where photo_id = target_photo_id;
end;
$$;
create or replace function public.sync_event_like_counter()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    perform public.touch_event_engagement_counter(new.event_id, 1, 0, 0);
    return new;
  end if;

  if tg_op = 'DELETE' then
    perform public.touch_event_engagement_counter(old.event_id, -1, 0, 0);
    return old;
  end if;

  return null;
end;
$$;
create or replace function public.sync_event_attendance_counter()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    perform public.touch_event_engagement_counter(new.event_id, 0, 1, 0);
    return new;
  end if;

  if tg_op = 'DELETE' then
    perform public.touch_event_engagement_counter(old.event_id, 0, -1, 0);
    return old;
  end if;

  return null;
end;
$$;
create or replace function public.sync_event_comment_counter()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    perform public.touch_event_engagement_counter(new.event_id, 0, 0, 1);
    return new;
  end if;

  if tg_op = 'DELETE' then
    perform public.touch_event_engagement_counter(old.event_id, 0, 0, -1);
    return old;
  end if;

  return null;
end;
$$;
create or replace function public.sync_album_like_counter()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    perform public.touch_album_engagement_counter(new.photo_id, 1, 0);
    return new;
  end if;

  if tg_op = 'DELETE' then
    perform public.touch_album_engagement_counter(old.photo_id, -1, 0);
    return old;
  end if;

  return null;
end;
$$;
create or replace function public.sync_album_comment_counter()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    perform public.touch_album_engagement_counter(new.photo_id, 0, 1);
    return new;
  end if;

  if tg_op = 'DELETE' then
    perform public.touch_album_engagement_counter(old.photo_id, 0, -1);
    return old;
  end if;

  return null;
end;
$$;
create or replace function public.rebuild_event_album_summary_cache(target_event_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  next_album_count bigint := 0;
begin
  if target_event_id is null then
    return;
  end if;

  select
    coalesce(count(*), 0)::bigint
  into next_album_count
  from public.album_photos ap
  where ap.event_id = target_event_id
    and ap.deleted_at is null
    and (
      coalesce(ap.show_on_club_profile, ap.show_on_profile, false)
      or coalesce(ap.show_on_user_profile, ap.show_on_profile, false)
    );

  if next_album_count <= 0 then
    delete from public.event_album_summary_cache
    where event_id = target_event_id;
    return;
  end if;

  insert into public.event_album_summary_cache (
    event_id,
    album_count,
    updated_at
  )
  values (
    target_event_id,
    next_album_count,
    timezone('utc', now())
  )
  on conflict (event_id) do update
  set
    album_count = excluded.album_count,
    updated_at = excluded.updated_at;
end;
$$;
create or replace function public.sync_event_album_summary_cache()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    perform public.rebuild_event_album_summary_cache(old.event_id);
    return old;
  end if;

  if tg_op = 'UPDATE' and old.event_id is distinct from new.event_id then
    perform public.rebuild_event_album_summary_cache(old.event_id);
  end if;

  perform public.rebuild_event_album_summary_cache(new.event_id);
  return new;
end;
$$;
drop trigger if exists sync_event_likes_counter on public.event_likes;
create trigger sync_event_likes_counter
after insert or delete on public.event_likes
for each row execute function public.sync_event_like_counter();
drop trigger if exists sync_event_attendance_counter on public.event_attendees;
create trigger sync_event_attendance_counter
after insert or delete on public.event_attendees
for each row execute function public.sync_event_attendance_counter();
drop trigger if exists sync_event_comments_counter on public.event_comments;
create trigger sync_event_comments_counter
after insert or delete on public.event_comments
for each row execute function public.sync_event_comment_counter();
drop trigger if exists sync_album_likes_counter on public.album_photo_likes;
create trigger sync_album_likes_counter
after insert or delete on public.album_photo_likes
for each row execute function public.sync_album_like_counter();
drop trigger if exists sync_album_comments_counter on public.album_photo_comments;
create trigger sync_album_comments_counter
after insert or delete on public.album_photo_comments
for each row execute function public.sync_album_comment_counter();
drop trigger if exists profiles_projection_row_update on public.profiles;
create trigger profiles_projection_row_update
before update on public.profiles
for each row execute function public.bump_projection_row();
drop trigger if exists events_projection_row_update on public.events;
create trigger events_projection_row_update
before update on public.events
for each row execute function public.bump_projection_row();
drop trigger if exists album_photos_projection_row_update on public.album_photos;
create trigger album_photos_projection_row_update
before update on public.album_photos
for each row execute function public.bump_projection_row();
drop trigger if exists notifications_projection_row_update on public.notifications;
create trigger notifications_projection_row_update
before update on public.notifications
for each row execute function public.bump_projection_row();
drop trigger if exists follows_projection_row_update on public.follows;
create trigger follows_projection_row_update
before update on public.follows
for each row execute function public.bump_projection_row();
drop trigger if exists club_memberships_projection_row_update on public.club_memberships;
create trigger club_memberships_projection_row_update
before update on public.club_memberships
for each row execute function public.bump_projection_row();
drop trigger if exists event_attendees_projection_touch on public.event_attendees;
create trigger event_attendees_projection_touch
after insert or update or delete on public.event_attendees
for each row execute function public.sync_touch_event_projection();
drop trigger if exists event_likes_projection_touch on public.event_likes;
create trigger event_likes_projection_touch
after insert or update or delete on public.event_likes
for each row execute function public.sync_touch_event_projection();
drop trigger if exists event_comments_projection_touch on public.event_comments;
create trigger event_comments_projection_touch
after insert or update or delete on public.event_comments
for each row execute function public.sync_touch_event_projection();
drop trigger if exists album_photos_projection_touch_event on public.album_photos;
create trigger album_photos_projection_touch_event
after insert or update or delete on public.album_photos
for each row execute function public.sync_touch_event_projection();
drop trigger if exists album_photo_likes_projection_touch on public.album_photo_likes;
create trigger album_photo_likes_projection_touch
after insert or update or delete on public.album_photo_likes
for each row execute function public.sync_touch_album_projection();
drop trigger if exists album_photo_comments_projection_touch on public.album_photo_comments;
create trigger album_photo_comments_projection_touch
after insert or update or delete on public.album_photo_comments
for each row execute function public.sync_touch_album_projection();
drop trigger if exists follows_projection_touch_profile on public.follows;
create trigger follows_projection_touch_profile
after insert or update or delete on public.follows
for each row execute function public.sync_touch_profile_projection();
drop trigger if exists memberships_projection_touch_profile on public.club_memberships;
create trigger memberships_projection_touch_profile
after insert or update or delete on public.club_memberships
for each row execute function public.sync_touch_profile_projection();
drop trigger if exists notifications_projection_touch_profile on public.notifications;
create trigger notifications_projection_touch_profile
after insert or update or delete on public.notifications
for each row execute function public.sync_touch_profile_projection();
drop trigger if exists sync_event_album_summary_cache on public.album_photos;
create trigger sync_event_album_summary_cache
after insert or update of event_id, deleted_at, show_on_profile, show_on_club_profile, show_on_user_profile or delete
on public.album_photos
for each row
execute function public.sync_event_album_summary_cache();
create or replace view public.event_summary as
select
  e.id as event_id,
  coalesce(counters.likes_count, 0)::bigint as likes_count,
  coalesce(counters.comments_count, 0)::bigint as comments_count,
  coalesce(counters.attendees_count, 0)::bigint as attendees_count,
  coalesce(album_cache.album_count, 0)::bigint as album_count,
  e.last_activity_at,
  e.sync_version
from public.events e
left join public.event_engagement_counters counters on counters.event_id = e.id
left join public.event_album_summary_cache album_cache on album_cache.event_id = e.id;
create or replace view public.album_summary as
select
  ap.id as photo_id,
  coalesce(counters.likes_count, 0)::bigint as likes_count,
  coalesce(counters.comments_count, 0)::bigint as comments_count,
  greatest(coalesce(array_length(ap.media_paths, 1), 1), 1)::integer as images_count,
  ap.last_activity_at,
  ap.sync_version
from public.album_photos ap
left join public.album_engagement_counters counters on counters.photo_id = ap.id
where ap.deleted_at is null;
create or replace view public.profile_summary as
select
  p.user_id,
  coalesce(followers.followers_count, 0)::bigint as followers_count,
  coalesce(following.following_count, 0)::bigint as following_count,
  coalesce(members.members_count, 0)::bigint as members_count,
  coalesce(events.events_count, 0)::bigint as events_count,
  coalesce(albums.albums_count, 0)::bigint as albums_count,
  coalesce(clubs.clubs_count, 0)::bigint as clubs_count,
  coalesce(unread.unread_notifications_count, 0)::bigint as unread_notifications_count,
  coalesce(follow_requests.pending_follow_requests_count, 0)::bigint as pending_follow_requests_count,
  coalesce(member_requests.pending_membership_requests_count, 0)::bigint as pending_membership_requests_count,
  p.last_activity_at,
  p.sync_version
from public.profiles p
left join (
  select following_id as user_id, count(*) as followers_count
  from public.follows
  where status = 'accepted' and deleted_at is null
  group by following_id
) followers on followers.user_id = p.user_id
left join (
  select follower_id as user_id, count(*) as following_count
  from public.follows
  where status = 'accepted' and deleted_at is null
  group by follower_id
) following on following.user_id = p.user_id
left join (
  select club_id as user_id, count(*) as members_count
  from public.club_memberships
  where status = 'accepted' and deleted_at is null
  group by club_id
) members on members.user_id = p.user_id
left join (
  select club_id as user_id, count(*) as events_count
  from public.events
  where deleted_at is null
  group by club_id
) events on events.user_id = p.user_id
left join (
  select user_id, count(*) as albums_count
  from public.album_photos
  where deleted_at is null
  group by user_id
) albums on albums.user_id = p.user_id
left join (
  select member_id as user_id, count(*) as clubs_count
  from public.club_memberships
  where status = 'accepted' and deleted_at is null
  group by member_id
) clubs on clubs.user_id = p.user_id
left join (
  select user_id, count(*) as unread_notifications_count
  from public.notifications
  where is_read = false and deleted_at is null
  group by user_id
) unread on unread.user_id = p.user_id
left join (
  select following_id as user_id, count(*) as pending_follow_requests_count
  from public.follows
  where status = 'pending' and deleted_at is null
  group by following_id
) follow_requests on follow_requests.user_id = p.user_id
left join (
  select club_id as user_id, count(*) as pending_membership_requests_count
  from public.club_memberships
  where status = 'pending' and deleted_at is null
  group by club_id
) member_requests on member_requests.user_id = p.user_id;
create or replace function public.get_event_view_row(target_event_id uuid)
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
  )
  select
    e.id,
    e.club_id as club_user_id,
    p.username as club_username,
    coalesce(p.club_name, p.name, p.username) as club_name,
    coalesce(p.profile_image_path, '') as club_image,
    p.university,
    e.title,
    e.description,
    e.cover_image_path,
    e.starts_at,
    e.ends_at,
    e.location_name,
    e.address,
    e.event_type,
    e.category,
    e.categories,
    e.fee_label,
    e.access_label,
    e.capacity,
    e.target_audience,
    e.level,
    e.materials,
    e.visibility,
    e.created_at,
    coalesce(counters.likes_count, 0)::bigint as likes_count,
    exists (
      select 1
      from public.event_likes el
      join viewer v on v.uid is not null
      where el.event_id = e.id
        and el.user_id = v.uid
    ) as liked,
    coalesce(counters.attendees_count, 0)::bigint as attendees_count,
    exists (
      select 1
      from public.event_attendees ea
      join viewer v on v.uid is not null
      where ea.event_id = e.id
        and ea.user_id = v.uid
    ) as joined,
    coalesce(counters.comments_count, 0)::bigint as comments_count,
    p.is_private as club_is_private,
    case
      when e.visibility = 'members_only' then 'members_only'
      when p.is_private then 'followers_only'
      else 'public'
    end as effective_visibility,
    caps.can_discover_event as discoverable,
    caps.can_open_event_detail as openable,
    caps.can_attend_event as joinable,
    caps.can_view_attendees as attendees_viewable,
    caps.can_open_event_album as album_openable,
    caps.can_upload_event_album as album_uploadable,
    caps.is_ended_or_locked as ended,
    caps.locked_reason_code,
    caps.locked_reason_text
  from public.events e
  join public.profiles p on p.user_id = e.club_id
  left join public.event_engagement_counters counters on counters.event_id = e.id
  cross join lateral public.get_event_capabilities(e.id) caps
  where e.id = target_event_id;
$$;
create or replace function public.get_album_view_row(
  target_photo_id uuid,
  album_context text default 'feed'
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
  with viewer as (
    select auth.uid() as uid
  )
  select
    ap.id as photo_id,
    ap.event_id,
    ap.storage_path,
    ap.media_paths,
    greatest(coalesce(array_length(ap.media_paths, 1), 1), 1)::integer as photo_count,
    ap.caption,
    ap.title,
    ap.show_on_profile,
    ap.created_at,
    ap.user_id as uploader_id,
    uploader.username as uploader_username,
    coalesce(uploader.name, uploader.club_name, uploader.username) as uploader_name,
    coalesce(uploader.university, '') as uploader_university,
    coalesce(uploader.profile_image_path, '') as uploader_image,
    uploader.is_private as uploader_is_private,
    e.club_id,
    club.username as club_username,
    coalesce(club.club_name, club.name, club.username) as club_name,
    club.is_private as club_is_private,
    e.title as event_title,
    e.visibility as event_visibility,
    case
      when e.visibility = 'members_only' then 'members_only'
      else 'public'
    end as effective_visibility,
    coalesce(counters.likes_count, 0)::bigint as likes_count,
    coalesce(counters.comments_count, 0)::bigint as comments_count,
    exists (
      select 1
      from public.album_photo_likes apl
      join viewer v on v.uid is not null
      where apl.photo_id = ap.id
        and apl.user_id = v.uid
    ) as liked,
    caps.can_discover_album as discoverable,
    caps.can_open_album as openable,
    caps.can_open_album_event_detail as open_event_detail,
    caps.can_interact_album as interactable,
    caps.locked_reason_code,
    caps.locked_reason_text
  from public.album_photos ap
  join public.events e on e.id = ap.event_id
  join public.profiles uploader on uploader.user_id = ap.user_id
  join public.profiles club on club.user_id = e.club_id
  left join public.album_engagement_counters counters on counters.photo_id = ap.id
  cross join lateral public.get_album_capabilities(ap.id, album_context) caps
  where ap.id = target_photo_id;
$$;
create index if not exists idx_events_visibility_last_activity_id
  on public.events (visibility, last_activity_at desc, id desc);
create index if not exists idx_events_club_last_activity_id
  on public.events (club_id, last_activity_at desc, id desc);
create index if not exists idx_album_photos_event_last_activity_id
  on public.album_photos (event_id, last_activity_at desc, id desc);
create index if not exists idx_album_photos_owner_last_activity_id
  on public.album_photos (user_id, last_activity_at desc, id desc);
create index if not exists idx_notifications_user_read_last_activity_id
  on public.notifications (user_id, is_read, last_activity_at desc, id desc);
create index if not exists idx_follows_follower_status_last_activity_id
  on public.follows (follower_id, status, last_activity_at desc, following_id);
create index if not exists idx_follows_following_status_last_activity_id
  on public.follows (following_id, status, last_activity_at desc, follower_id);
create index if not exists idx_memberships_club_status_last_activity_id
  on public.club_memberships (club_id, status, last_activity_at desc, member_id);
create index if not exists idx_memberships_member_status_last_activity_id
  on public.club_memberships (member_id, status, last_activity_at desc, club_id);
create index if not exists idx_event_comments_event_created_id
  on public.event_comments (event_id, created_at desc, id desc);
create index if not exists idx_album_comments_photo_created_id
  on public.album_photo_comments (photo_id, created_at desc, id desc);
create index if not exists idx_notifications_actor_id
  on public.notifications (actor_id);
create index if not exists idx_notifications_event_id
  on public.notifications (event_id);
create index if not exists idx_notifications_target_profile_id
  on public.notifications (target_profile_id);
create index if not exists idx_event_comments_user_id
  on public.event_comments (user_id);
create index if not exists idx_event_comments_parent_id
  on public.event_comments (parent_id);
create index if not exists idx_album_photo_comments_user_id
  on public.album_photo_comments (user_id);
create index if not exists idx_album_photo_comments_parent_id
  on public.album_photo_comments (parent_id);
create index if not exists idx_reports_target_user_id
  on public.reports (target_user_id);
create index if not exists idx_reports_target_event_id
  on public.reports (target_event_id);
create index if not exists idx_reports_reviewed_by
  on public.reports (reviewed_by);
create index if not exists idx_blocks_blocker_created_blocked
  on public.blocks (blocker_id, created_at desc, blocked_id);
create index if not exists idx_event_likes_event_created_user
  on public.event_likes (event_id, created_at desc, user_id);
create index if not exists idx_event_attendees_event_joined_user
  on public.event_attendees (event_id, joined_at desc, user_id);
alter view public.event_summary
  set (security_invoker = true);
alter view public.album_summary
  set (security_invoker = true);
alter view public.profile_summary
  set (security_invoker = true);
