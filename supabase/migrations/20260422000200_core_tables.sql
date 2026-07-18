-- Canonical baseline migration.
-- Sources:
--   - 20260304090500_core_tables.sql
--   - 20260304091000_functions_indexes_and_views.sql
--   - 20260304130000_kv_store_table.sql
--   - 20260304170000_visibility_and_onboarding_rules.sql
--   - 20260305100500_master_visibility_feed_refactor.sql
--   - 20260307130000_phase2_projection_infrastructure.sql
--   - 20260308213000_social_visibility_db_first_simplification.sql
--   - 20260308234500_album_profile_surface_visibility.sql
--   - 20260309183000_request_notifications_persist_and_lock.sql
--   - 20260311153000_hard_delete_account_cleanup.sql
--   - 20260312023000_mobile_security_mvp_hardening.sql
--   - 20260326110000_server_rate_limits_and_reports_hardening.sql

create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  username citext not null unique,
  account_type public.account_type not null,
  email citext not null unique,
  university text not null,
  categories text[] not null default '{}'::text[],
  is_private boolean not null default false,
  hide_email boolean not null default false,
  hide_members_list boolean not null default false,
  hide_joined_clubs boolean not null default false,
  profile_image_path text,
  cover_image_path text,
  onboarding_completed_at timestamptz,
  notification_preferences jsonb not null default '{"push": true, "email": true}'::jsonb,
  name text,
  department text,
  grade_year text,
  bio text,
  club_name text,
  description text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  last_activity_at timestamptz not null default timezone('utc', now()),
  sync_version bigint not null default 1,
  deleted_at timestamptz,
  updated_by uuid references public.profiles(user_id) on delete set null,
  constraint profiles_username_format check (username ~ '^[a-z0-9_.]{3,24}$'),
  constraint profiles_account_name_rule check (
    (account_type = 'student' and name is not null and club_name is null) or
    (account_type = 'club' and club_name is not null and name is null)
  )
);
create table if not exists public.blocks (
  blocker_id uuid not null references public.profiles(user_id) on delete cascade,
  blocked_id uuid not null references public.profiles(user_id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (blocker_id, blocked_id),
  constraint blocks_no_self check (blocker_id <> blocked_id)
);
create table if not exists public.follows (
  id uuid primary key default gen_random_uuid(),
  follower_id uuid not null references public.profiles(user_id) on delete cascade,
  following_id uuid not null references public.profiles(user_id) on delete cascade,
  status public.follow_status not null default 'pending',
  created_at timestamptz not null default timezone('utc', now()),
  responded_at timestamptz,
  last_activity_at timestamptz not null default timezone('utc', now()),
  sync_version bigint not null default 1,
  deleted_at timestamptz,
  constraint follows_no_self check (follower_id <> following_id)
);
create table if not exists public.club_memberships (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.profiles(user_id) on delete cascade,
  member_id uuid not null references public.profiles(user_id) on delete cascade,
  status public.membership_status not null default 'pending',
  role text not null default 'member',
  request_message text,
  created_at timestamptz not null default timezone('utc', now()),
  responded_at timestamptz,
  last_activity_at timestamptz not null default timezone('utc', now()),
  sync_version bigint not null default 1,
  deleted_at timestamptz,
  constraint club_memberships_no_self check (club_id <> member_id)
);
create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.profiles(user_id) on delete cascade,
  title text not null,
  description text not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  location_name text not null,
  address text not null,
  event_type text not null default 'general',
  category text not null,
  categories text[] not null default '{}'::text[],
  fee_label text not null default 'ucretsiz',
  access_label text not null default 'herkese acik',
  capacity integer,
  target_audience text,
  level text,
  materials text,
  visibility public.event_visibility not null default 'public',
  cover_image_path text,
  is_cancelled boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  last_activity_at timestamptz not null default timezone('utc', now()),
  sync_version bigint not null default 1,
  deleted_at timestamptz,
  updated_by uuid references public.profiles(user_id) on delete set null,
  constraint events_time_range check (ends_at >= starts_at),
  constraint events_capacity_positive check (capacity is null or capacity > 0),
  constraint events_title_len check (length(trim(title)) between 3 and 120),
  constraint events_desc_len check (length(trim(description)) between 10 and 4000)
);
create table if not exists public.event_attendees (
  event_id uuid not null references public.events(id) on delete cascade,
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  joined_at timestamptz not null default timezone('utc', now()),
  primary key (event_id, user_id)
);
create table if not exists public.event_likes (
  event_id uuid not null references public.events(id) on delete cascade,
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (event_id, user_id)
);
create table if not exists public.event_comments (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  parent_id uuid references public.event_comments(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint event_comments_body_len check (length(trim(body)) between 1 and 1500)
);
create table if not exists public.album_photos (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  storage_path text not null unique,
  media_paths text[] not null default array[]::text[],
  caption text not null default '',
  title text,
  show_on_profile boolean not null default false,
  show_on_user_profile boolean not null default false,
  show_on_club_profile boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  last_activity_at timestamptz not null default timezone('utc', now()),
  sync_version bigint not null default 1,
  deleted_at timestamptz,
  constraint album_photos_caption_len check (length(caption) <= 800),
  constraint album_photos_media_paths_not_empty check (coalesce(array_length(media_paths, 1), 0) > 0)
);
create table if not exists public.album_photo_likes (
  photo_id uuid not null references public.album_photos(id) on delete cascade,
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (photo_id, user_id)
);
create table if not exists public.album_photo_comments (
  id uuid primary key default gen_random_uuid(),
  photo_id uuid not null references public.album_photos(id) on delete cascade,
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  parent_id uuid references public.album_photo_comments(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint album_photo_comments_body_len check (length(trim(body)) between 1 and 1500)
);
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  actor_id uuid references public.profiles(user_id) on delete cascade,
  type public.notification_type not null,
  message text not null,
  detail text,
  event_id uuid references public.events(id) on delete cascade,
  target_profile_id uuid references public.profiles(user_id) on delete cascade,
  photo_id uuid references public.album_photos(id) on delete cascade,
  is_read boolean not null default false,
  request_status text,
  request_resolved_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  last_activity_at timestamptz not null default timezone('utc', now()),
  sync_version bigint not null default 1,
  deleted_at timestamptz,
  constraint notifications_request_status_check check (request_status is null or request_status in ('pending', 'accepted', 'rejected'))
);
create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(user_id) on delete cascade,
  target_type public.report_target_type not null,
  target_user_id uuid references public.profiles(user_id) on delete cascade,
  target_event_id uuid references public.events(id) on delete cascade,
  target_photo_id uuid references public.album_photos(id) on delete cascade,
  target_event_comment_id uuid references public.event_comments(id) on delete cascade,
  target_album_comment_id uuid references public.album_photo_comments(id) on delete cascade,
  reason text not null,
  detail text,
  status public.report_status not null default 'open',
  reviewed_by uuid references public.profiles(user_id) on delete set null,
  reviewed_at timestamptz,
  resolution_note text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint reports_target_consistency check (
    (
      target_type::text = 'user'
      and target_user_id is not null
      and target_event_id is null
      and target_photo_id is null
      and target_event_comment_id is null
      and target_album_comment_id is null
    ) or (
      target_type::text = 'event'
      and target_user_id is null
      and target_event_id is not null
      and target_photo_id is null
      and target_event_comment_id is null
      and target_album_comment_id is null
    ) or (
      target_type::text = 'album'
      and target_user_id is null
      and target_event_id is null
      and target_photo_id is not null
      and target_event_comment_id is null
      and target_album_comment_id is null
    ) or (
      target_type::text = 'event_comment'
      and target_user_id is null
      and target_event_id is null
      and target_photo_id is null
      and target_event_comment_id is not null
      and target_album_comment_id is null
    ) or (
      target_type::text = 'album_comment'
      and target_user_id is null
      and target_event_id is null
      and target_photo_id is null
      and target_event_comment_id is null
      and target_album_comment_id is not null
    )
  )
);
create table if not exists public.media_assets (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(user_id) on delete cascade,
  bucket_id text not null,
  object_path text not null unique,
  mime_type text,
  size_bytes bigint,
  visibility public.media_visibility not null default 'private',
  created_at timestamptz not null default timezone('utc', now())
);
create table if not exists public.kv_store_e3557d40 (
  key text primary key,
  value jsonb not null
);
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;
create or replace function public.ensure_event_owner_is_club()
returns trigger
language plpgsql
as $$
declare
  owner_type public.account_type;
begin
  select p.account_type
  into owner_type
  from public.profiles p
  where p.user_id = new.club_id
    and p.deleted_at is null;

  if owner_type is null then
    raise exception 'Club profile not found';
  end if;

  if owner_type <> 'club'::public.account_type then
    raise exception 'Only club accounts can create events';
  end if;

  return new;
end;
$$;
drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();
drop trigger if exists set_events_updated_at on public.events;
create trigger set_events_updated_at
before update on public.events
for each row execute function public.set_updated_at();
drop trigger if exists set_event_comments_updated_at on public.event_comments;
create trigger set_event_comments_updated_at
before update on public.event_comments
for each row execute function public.set_updated_at();
drop trigger if exists set_album_photos_updated_at on public.album_photos;
create trigger set_album_photos_updated_at
before update on public.album_photos
for each row execute function public.set_updated_at();
drop trigger if exists set_album_photo_comments_updated_at on public.album_photo_comments;
create trigger set_album_photo_comments_updated_at
before update on public.album_photo_comments
for each row execute function public.set_updated_at();
drop trigger if exists set_reports_updated_at on public.reports;
create trigger set_reports_updated_at
before update on public.reports
for each row execute function public.set_updated_at();
drop trigger if exists ensure_event_owner_is_club on public.events;
create trigger ensure_event_owner_is_club
before insert or update on public.events
for each row execute function public.ensure_event_owner_is_club();
create unique index if not exists follows_active_pair_unique
  on public.follows (follower_id, following_id)
  where deleted_at is null;
create unique index if not exists club_memberships_active_pair_unique
  on public.club_memberships (club_id, member_id)
  where deleted_at is null;
create index if not exists idx_profiles_account_type on public.profiles (account_type);
create index if not exists idx_profiles_university on public.profiles (university);
create index if not exists idx_profiles_categories on public.profiles using gin (categories);
create index if not exists idx_blocks_blocked_id on public.blocks (blocked_id);
create index if not exists idx_notifications_photo_id on public.notifications (photo_id);
create index if not exists idx_reports_target_type_status on public.reports (target_type, status);
create index if not exists idx_reports_reporter_created_at on public.reports (reporter_id, created_at desc);
create index if not exists idx_media_assets_owner on public.media_assets (owner_id, created_at desc);
create index if not exists idx_media_assets_bucket on public.media_assets (bucket_id);
