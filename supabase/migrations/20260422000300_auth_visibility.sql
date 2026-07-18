-- Canonical baseline migration.
-- Sources:
--   - 20260304170000_visibility_and_onboarding_rules.sql
--   - 20260306143000_capability_authorization_refactor.sql
--   - 20260309213000_private_club_search_and_home_album_relation_fix.sql
--   - 20260313234000_clubs_always_public_follow_direct.sql
--   - 20260313235500_club_follow_cleanup_and_event_participation_guardrails.sql
--   - 20260314183000_optimize_rls_policies_and_direct_access.sql

alter table public.profiles enable row level security;
alter table public.blocks enable row level security;
alter table public.follows enable row level security;
alter table public.club_memberships enable row level security;
alter table public.events enable row level security;
alter table public.event_attendees enable row level security;
alter table public.event_likes enable row level security;
alter table public.event_comments enable row level security;
alter table public.album_photos enable row level security;
alter table public.album_photo_likes enable row level security;
alter table public.album_photo_comments enable row level security;
alter table public.notifications enable row level security;
alter table public.reports enable row level security;
create or replace function public.resolve_profile_id(target_username text)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select p.user_id
  from public.profiles p
  where p.username = lower(trim(target_username))
  limit 1;
$$;
create or replace function public.is_blocked_pair(a uuid, b uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.blocks bl
    where (bl.blocker_id = a and bl.blocked_id = b)
       or (bl.blocker_id = b and bl.blocked_id = a)
  );
$$;
create or replace function public.is_accepted_follower(viewer_id uuid, target_id uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.follows f
    where f.follower_id = viewer_id
      and f.following_id = target_id
      and f.status = 'accepted'
  );
$$;
create or replace function public.force_club_profiles_public()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.account_type = 'club'::public.account_type then
    new.is_private := false;
  end if;

  return new;
end;
$$;
drop trigger if exists profiles_force_club_public on public.profiles;
create trigger profiles_force_club_public
before insert or update of account_type, is_private on public.profiles
for each row execute function public.force_club_profiles_public();
create or replace function public.can_view_profile(target_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  viewer_id uuid;
  target_private boolean;
  target_account_type public.account_type;
begin
  viewer_id := auth.uid();

  select p.is_private, p.account_type
  into target_private, target_account_type
  from public.profiles p
  where p.user_id = target_id
    and p.deleted_at is null;

  if target_account_type = 'club'::public.account_type then
    target_private := false;
  end if;

  if target_private is null then
    return false;
  end if;

  if viewer_id is not null and public.is_blocked_pair(viewer_id, target_id) then
    return false;
  end if;

  if viewer_id is null then
    return target_private = false;
  end if;

  if viewer_id = target_id then
    return true;
  end if;

  if target_private = false then
    return true;
  end if;

  if public.is_accepted_follower(viewer_id, target_id) then
    return true;
  end if;

  if target_account_type = 'club'::public.account_type then
    return exists (
      select 1
      from public.club_memberships cm
      where cm.club_id = target_id
        and cm.member_id = viewer_id
        and cm.status = 'accepted'::public.membership_status
        and cm.deleted_at is null
    );
  end if;

  return exists (
    select 1
    from public.club_memberships cm
    where cm.club_id = viewer_id
      and cm.member_id = target_id
      and cm.status = 'accepted'::public.membership_status
      and cm.deleted_at is null
  );
end;
$$;
create or replace function public.get_profile_capabilities(target_profile_id uuid)
returns table(
  can_view_header boolean,
  can_view_content boolean,
  can_view_followers boolean,
  can_view_following boolean,
  can_view_members boolean,
  can_view_joined_clubs boolean,
  locked_reason_code text,
  locked_reason_text text
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  viewer_id uuid;
  target_account_type public.account_type;
  target_is_private boolean;
  target_hide_members boolean;
  target_hide_joined_clubs boolean;
  viewer_follows_target boolean := false;
  viewer_is_target_member boolean := false;
  target_is_viewer_member boolean := false;
  viewer_blocked_target boolean := false;
  target_blocked_viewer boolean := false;
  header_visible boolean := false;
  content_visible boolean := false;
  followers_visible boolean := false;
  following_visible boolean := false;
  members_visible boolean := false;
  joined_clubs_visible boolean := false;
  reason_code text := null;
  reason_text text := null;
begin
  viewer_id := auth.uid();

  select
    p.account_type,
    p.is_private,
    coalesce(p.hide_members_list, false),
    coalesce(p.hide_joined_clubs, false)
  into
    target_account_type,
    target_is_private,
    target_hide_members,
    target_hide_joined_clubs
  from public.profiles p
  where p.user_id = target_profile_id
    and p.deleted_at is null;

  if target_account_type is null then
    return query
    select false, false, false, false, false, false, 'NOT_FOUND', 'Profil bulunamadi.';
    return;
  end if;

  if target_account_type = 'club'::public.account_type then
    target_is_private := false;
  end if;

  if viewer_id is not null then
    select
      exists (
        select 1
        from public.blocks bl
        where bl.blocker_id = viewer_id
          and bl.blocked_id = target_profile_id
      ),
      exists (
        select 1
        from public.blocks bl
        where bl.blocker_id = target_profile_id
          and bl.blocked_id = viewer_id
      )
    into
      viewer_blocked_target,
      target_blocked_viewer;
  end if;

  if target_blocked_viewer then
    return query
    select false, false, false, false, false, false, 'BLOCKED', 'Bu profile erisemiyorsunuz.';
    return;
  end if;

  if viewer_blocked_target then
    return query
    select true, false, false, false, false, false, 'BLOCKED_BY_VIEWER', 'Bu kullaniciyi engellediniz.';
    return;
  end if;

  header_visible := true;

  if viewer_id = target_profile_id then
    return query
    select true, true, true, true, true, true, null::text, null::text;
    return;
  end if;

  if viewer_id is not null then
    viewer_follows_target := public.is_accepted_follower(viewer_id, target_profile_id);

    if target_account_type = 'club'::public.account_type then
      viewer_is_target_member := exists (
        select 1
        from public.club_memberships cm
        where cm.club_id = target_profile_id
          and cm.member_id = viewer_id
          and cm.status = 'accepted'
          and cm.deleted_at is null
      );
    end if;

    if exists (
      select 1
      from public.profiles p
      where p.user_id = viewer_id
        and p.account_type = 'club'
        and p.deleted_at is null
    ) then
      target_is_viewer_member := exists (
        select 1
        from public.club_memberships cm
        where cm.club_id = viewer_id
          and cm.member_id = target_profile_id
          and cm.status = 'accepted'
          and cm.deleted_at is null
      );
    end if;
  end if;

  if target_is_private = false then
    content_visible := true;
  elsif viewer_id is not null and (
    viewer_follows_target
    or viewer_is_target_member
    or target_is_viewer_member
  ) then
    content_visible := true;
  end if;

  if not content_visible then
    if target_account_type = 'club' then
      reason_code := 'FOLLOW_REQUIRED';
      reason_text := 'Bu kulubun icerigini gormek icin kulubu takip etmeniz veya uye olmaniz gerekiyor.';
    else
      reason_code := 'PRIVATE_PROFILE';
      reason_text := 'Bu kullanicinin hesabi gizli.';
    end if;
  end if;

  followers_visible := content_visible;
  following_visible := content_visible;

  if target_account_type = 'club' then
    members_visible := viewer_id = target_profile_id or viewer_is_target_member;
  else
    joined_clubs_visible := viewer_id = target_profile_id or (
      content_visible and not target_hide_joined_clubs
    );
  end if;

  return query
  select
    header_visible,
    content_visible,
    followers_visible,
    following_visible,
    members_visible,
    joined_clubs_visible,
    reason_code,
    reason_text;
end;
$$;
create or replace function public.normalize_access_label(raw_value text)
returns text
language sql
immutable
set search_path = public
as $$
  select regexp_replace(
    translate(lower(trim(coalesce(raw_value, ''))), 'ıüğşöç', 'iugsoc'),
    '\s+',
    ' ',
    'g'
  );
$$;
create or replace function public.resolve_event_attendance_scope(access_label text)
returns text
language plpgsql
immutable
set search_path = public
as $$
declare
  normalized_label text := public.normalize_access_label(access_label);
begin
  if normalized_label like '%universite%' then
    return 'university_only';
  end if;

  if normalized_label like '%uye%'
    or normalized_label like '%takipci%'
    or normalized_label like '%member%'
    or normalized_label like '%follower%' then
    return 'followers_only';
  end if;

  return 'public';
end;
$$;
create or replace function public.get_event_capabilities(target_event_id uuid)
returns table(
  can_discover_event boolean,
  can_open_event_detail boolean,
  can_attend_event boolean,
  can_view_attendees boolean,
  can_open_event_album boolean,
  can_upload_event_album boolean,
  is_ended_or_locked boolean,
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
  viewer_account_type public.account_type;
  viewer_university text := '';
  event_visibility public.event_visibility;
  event_club_id uuid;
  event_access_label text := '';
  club_account_type public.account_type;
  club_is_private boolean;
  club_university text := '';
  attendance_scope text := 'public';
  event_has_ended boolean;
  viewer_follows_club boolean := false;
  viewer_is_attendee boolean := false;
  is_owner boolean := false;
  can_discover boolean := false;
  can_open_detail boolean := false;
  can_attend boolean := false;
  can_view_attendees_local boolean := false;
  can_open_album boolean := false;
  can_upload_album boolean := false;
  is_same_university boolean := false;
  requires_follow boolean := false;
  reason_code text := null;
  reason_text text := null;
begin
  select
    e.visibility,
    e.club_id,
    coalesce(e.access_label, ''),
    p.account_type,
    coalesce(p.is_private, false),
    coalesce(p.university, ''),
    (coalesce(e.is_cancelled, false) or e.ends_at <= timezone('utc', now()))
  into
    event_visibility,
    event_club_id,
    event_access_label,
    club_account_type,
    club_is_private,
    club_university,
    event_has_ended
  from public.events e
  join public.profiles p on p.user_id = e.club_id
  where e.id = target_event_id
    and e.deleted_at is null
    and p.deleted_at is null;

  if event_visibility is null then
    return query
    select false, false, false, false, false, false, false, 'NOT_FOUND', 'Etkinlik bulunamadi.';
    return;
  end if;

  if club_account_type = 'club'::public.account_type then
    club_is_private := false;
  end if;

  if viewer_id is not null then
    select
      p.account_type,
      coalesce(p.university, '')
    into
      viewer_account_type,
      viewer_university
    from public.profiles p
    where p.user_id = viewer_id
      and p.deleted_at is null;
  end if;

  if viewer_id is not null and public.is_blocked_pair(viewer_id, event_club_id) then
    return query
    select false, false, false, false, false, false, event_has_ended, 'BLOCKED', 'Bu etkinlige erisemiyorsunuz.';
    return;
  end if;

  is_owner := viewer_id is not null and viewer_id = event_club_id;
  attendance_scope := public.resolve_event_attendance_scope(event_access_label);
  requires_follow := event_visibility = 'members_only'::public.event_visibility or attendance_scope = 'followers_only';
  is_same_university := nullif(trim(club_university), '') is not null
    and nullif(trim(viewer_university), '') is not null
    and lower(trim(viewer_university)) = lower(trim(club_university));

  if viewer_id is not null then
    viewer_follows_club := public.is_accepted_follower(viewer_id, event_club_id);
    viewer_is_attendee := exists (
      select 1
      from public.event_attendees ea
      where ea.event_id = target_event_id
        and ea.user_id = viewer_id
    );
  end if;

  if is_owner then
    can_discover := true;
    can_open_detail := true;
  elsif club_is_private then
    can_discover := viewer_id is not null and viewer_follows_club;
    can_open_detail := can_discover or viewer_is_attendee;
  else
    can_discover := true;
    can_open_detail := true;
  end if;

  can_view_attendees_local := can_open_detail and (
    not requires_follow
    or viewer_follows_club
    or is_owner
    or viewer_is_attendee
  );

  can_open_album := can_open_detail and (
    not requires_follow
    or viewer_follows_club
    or is_owner
    or viewer_is_attendee
  );

  can_attend := can_open_detail
    and not event_has_ended
    and viewer_id is not null
    and not is_owner
    and coalesce(viewer_account_type, 'student'::public.account_type) <> 'club'::public.account_type
    and (
      case
        when requires_follow then viewer_follows_club
        when attendance_scope = 'university_only' then is_same_university
        else true
      end
    );

  can_upload_album := can_open_album
    and viewer_id is not null
    and coalesce(viewer_account_type, 'student'::public.account_type) <> 'club'::public.account_type
    and (
      viewer_is_attendee
      or is_owner
    );

  if not can_open_detail then
    if club_is_private or requires_follow then
      reason_code := 'FOLLOW_REQUIRED';
      reason_text := 'Bu etkinligi gormek icin once kulubu takip etmelisiniz.';
    end if;
  elsif event_has_ended then
    reason_code := 'EVENT_ENDED';
    reason_text := 'Bu etkinlik sona erdi.';
  elsif viewer_id is null then
    reason_code := 'UNAUTHORIZED';
    reason_text := 'Etkinlige katilmak icin giris yapmalisiniz.';
  elsif coalesce(viewer_account_type, 'student'::public.account_type) = 'club'::public.account_type then
    reason_code := 'CLUB_ACCOUNT_NOT_ALLOWED';
    reason_text := 'Kulup hesaplari etkinliklere katilamaz.';
  elsif requires_follow and not viewer_follows_club and not is_owner and not viewer_is_attendee then
    reason_code := 'FOLLOW_REQUIRED';
    reason_text := 'Bu etkinlige katilmak icin once kulubu takip etmelisiniz.';
  elsif attendance_scope = 'university_only' and not is_same_university and not is_owner and not viewer_is_attendee then
    reason_code := 'UNIVERSITY_REQUIRED';
    reason_text := 'Bu etkinlige sadece kulubun universitesindeki kullanicilar katilabilir.';
  end if;

  return query
  select
    can_discover,
    can_open_detail,
    can_attend,
    can_view_attendees_local,
    can_open_album,
    can_upload_album,
    event_has_ended,
    reason_code,
    reason_text;
end;
$$;
create or replace function public.get_album_capabilities(
  target_photo_id uuid,
  album_context text default 'feed'
)
returns table(
  can_discover_album boolean,
  can_open_album boolean,
  can_open_album_event_detail boolean,
  can_interact_album boolean,
  locked_reason_code text,
  locked_reason_text text
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  viewer_id uuid;
  target_event_id uuid;
  uploader_id uuid;
  event_club_id uuid;
  uploader_is_private boolean;
  club_is_private boolean;
  album_show_on_profile boolean;
  album_show_on_user_profile boolean;
  album_show_on_club_profile boolean;
  normalized_context text;
  viewer_owns_photo boolean := false;
  viewer_follows_uploader boolean := false;
  event_discoverable boolean := false;
  event_openable boolean := false;
  event_album_openable boolean := false;
  can_view_uploader_profile boolean := false;
  can_view_club_profile boolean := false;
  discoverable boolean := false;
  openable boolean := false;
  open_detail boolean := false;
  interactable boolean := false;
  reason_code text := null;
  reason_text text := null;
begin
  viewer_id := auth.uid();
  normalized_context := lower(coalesce(trim(album_context), 'feed'));

  select
    ap.event_id,
    ap.user_id,
    coalesce(ap.show_on_profile, false),
    coalesce(ap.show_on_user_profile, ap.show_on_profile, false),
    coalesce(ap.show_on_club_profile, ap.show_on_profile, false),
    uploader.is_private,
    e.club_id,
    club.is_private
  into
    target_event_id,
    uploader_id,
    album_show_on_profile,
    album_show_on_user_profile,
    album_show_on_club_profile,
    uploader_is_private,
    event_club_id,
    club_is_private
  from public.album_photos ap
  join public.profiles uploader on uploader.user_id = ap.user_id
  join public.events e on e.id = ap.event_id
  join public.profiles club on club.user_id = e.club_id
  where ap.id = target_photo_id
    and ap.deleted_at is null
    and uploader.deleted_at is null
    and e.deleted_at is null
    and club.deleted_at is null;

  if target_event_id is null then
    return query
    select false, false, false, false, 'NOT_FOUND', 'Album bulunamadi.';
    return;
  end if;

  if viewer_id is not null and (
    public.is_blocked_pair(viewer_id, uploader_id)
    or public.is_blocked_pair(viewer_id, event_club_id)
  ) then
    return query
    select false, false, false, false, 'BLOCKED', 'Bu albume erisemiyorsunuz.';
    return;
  end if;

  viewer_owns_photo := viewer_id is not null and viewer_id = uploader_id;
  viewer_follows_uploader := (
    viewer_id is not null
    and viewer_id <> uploader_id
    and public.is_accepted_follower(viewer_id, uploader_id)
  );

  select
    caps.can_discover_event,
    caps.can_open_event_detail,
    caps.can_open_event_album,
    caps.locked_reason_code,
    caps.locked_reason_text
  into
    event_discoverable,
    event_openable,
    event_album_openable,
    reason_code,
    reason_text
  from public.get_event_capabilities(target_event_id) caps;

  if normalized_context = 'profile' then
    can_view_uploader_profile :=
      album_show_on_user_profile
      and public.can_view_profile(uploader_id);
    can_view_club_profile :=
      album_show_on_club_profile
      and public.can_view_profile(event_club_id);

    discoverable :=
      (
        album_show_on_user_profile
        and can_view_uploader_profile
        and event_discoverable
      )
      or (
        album_show_on_club_profile
        and can_view_club_profile
        and event_discoverable
      );
    openable := discoverable and event_album_openable;
    open_detail := discoverable and event_openable;

    if not discoverable and reason_code is null then
      reason_code := 'PROFILE_HIDDEN';
      reason_text := 'Bu album ilgili profil sekmesinde gosterilmiyor.';
    end if;
  elsif normalized_context = 'search' then
    discoverable :=
      album_show_on_profile
      and not uploader_is_private
      and not club_is_private
      and event_discoverable;
    openable := discoverable and event_album_openable;
    open_detail := discoverable and event_openable;

    if not discoverable and reason_code is null then
      if uploader_is_private or club_is_private then
        reason_code := 'SEARCH_HIDDEN';
        reason_text := 'Gizli hesap veya gizli kulup albumleri arama listesinde gosterilmez.';
      else
        reason_code := 'PROFILE_HIDDEN';
        reason_text := 'Bu album arama listesinde gosterilmiyor.';
      end if;
    end if;
  elsif normalized_context = 'event_album' then
    discoverable :=
      event_album_openable
      and (
        album_show_on_club_profile
        or (
          album_show_on_user_profile
          and not uploader_is_private
        )
      );
    openable := discoverable;
    open_detail := discoverable and event_openable;

    if not discoverable and reason_code is null then
      if uploader_is_private and album_show_on_user_profile and not album_show_on_club_profile then
        reason_code := 'EVENT_ALBUM_HIDDEN';
        reason_text := 'Gizli hesapta sadece kendim secilen albumler etkinlik albumunde gosterilmez.';
      else
        reason_code := 'PROFILE_HIDDEN';
        reason_text := 'Bu album etkinlik albumunde gosterilmiyor.';
      end if;
    end if;
  else
    discoverable :=
      event_discoverable
      and (
        album_show_on_club_profile
        or (
          album_show_on_user_profile
          and (
            not uploader_is_private
            or viewer_owns_photo
            or viewer_follows_uploader
          )
        )
      );
    openable := discoverable and event_album_openable;
    open_detail := discoverable and event_openable;

    if not discoverable and reason_code is null then
      if uploader_is_private and album_show_on_user_profile and not album_show_on_club_profile then
        reason_code := 'FOLLOW_REQUIRED';
        reason_text := 'Bu albumu gormek icin kullaniciyi takip etmelisiniz.';
      else
        reason_code := 'PROFILE_HIDDEN';
        reason_text := 'Bu album bu yuzeyde gosterilmiyor.';
      end if;
    end if;
  end if;

  interactable := openable;

  return query
  select
    discoverable,
    openable,
    open_detail,
    interactable,
    reason_code,
    reason_text;
end;
$$;
create or replace function public.can_discover_event(target_event_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select caps.can_discover_event from public.get_event_capabilities(target_event_id) caps),
    false
  );
$$;
create or replace function public.can_open_event_detail(target_event_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select caps.can_open_event_detail from public.get_event_capabilities(target_event_id) caps),
    false
  );
$$;
create or replace function public.can_attend_event(target_event_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select caps.can_attend_event from public.get_event_capabilities(target_event_id) caps),
    false
  );
$$;
create or replace function public.can_view_event_attendees(target_event_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select caps.can_view_attendees from public.get_event_capabilities(target_event_id) caps),
    false
  );
$$;
create or replace function public.can_open_event_album(target_event_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select caps.can_open_event_album from public.get_event_capabilities(target_event_id) caps),
    false
  );
$$;
create or replace function public.can_upload_event_album(target_event_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select caps.can_upload_event_album from public.get_event_capabilities(target_event_id) caps),
    false
  );
$$;
create or replace function public.can_view_event(target_event_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.can_discover_event(target_event_id);
$$;
create or replace function public.can_discover_album(
  target_photo_id uuid,
  album_context text default 'feed'
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select caps.can_discover_album from public.get_album_capabilities(target_photo_id, album_context) caps),
    false
  );
$$;
create or replace function public.can_open_album(
  target_photo_id uuid,
  album_context text default 'feed'
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select caps.can_open_album from public.get_album_capabilities(target_photo_id, album_context) caps),
    false
  );
$$;
create or replace function public.can_interact_album(
  target_photo_id uuid,
  album_context text default 'feed'
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select caps.can_interact_album from public.get_album_capabilities(target_photo_id, album_context) caps),
    false
  );
$$;
create or replace function public.can_view_album(target_photo_id uuid, album_context text default 'feed')
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.can_discover_album(target_photo_id, album_context);
$$;
drop policy if exists "profiles_select" on public.profiles;
create policy "profiles_select"
on public.profiles
for select
using (public.can_view_profile(user_id));
drop policy if exists "profiles_insert_self" on public.profiles;
create policy "profiles_insert_self"
on public.profiles
for insert
with check ((select auth.uid()) = user_id);
drop policy if exists "profiles_update_self" on public.profiles;
create policy "profiles_update_self"
on public.profiles
for update
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);
drop policy if exists "profiles_delete_self" on public.profiles;
create policy "profiles_delete_self"
on public.profiles
for delete
using ((select auth.uid()) = user_id);
drop policy if exists "blocks_select_self" on public.blocks;
create policy "blocks_select_self"
on public.blocks
for select
using ((select auth.uid()) = blocker_id);
drop policy if exists "blocks_insert_self" on public.blocks;
create policy "blocks_insert_self"
on public.blocks
for insert
with check ((select auth.uid()) = blocker_id);
drop policy if exists "blocks_delete_self" on public.blocks;
create policy "blocks_delete_self"
on public.blocks
for delete
using ((select auth.uid()) = blocker_id);
drop policy if exists "follows_select_participants" on public.follows;
create policy "follows_select_participants"
on public.follows
for select
using (
  deleted_at is null
  and (
    (select auth.uid()) in (follower_id, following_id)
    or (
      status = 'accepted'
      and (
        coalesce((select caps.can_view_followers from public.get_profile_capabilities(following_id) caps), false)
        or coalesce((select caps.can_view_following from public.get_profile_capabilities(follower_id) caps), false)
      )
    )
  )
);
drop policy if exists "follows_insert_follower" on public.follows;
create policy "follows_insert_follower"
on public.follows
for insert
with check (
  (select auth.uid()) = follower_id
  and not exists (
    select 1 from public.blocks b
    where (b.blocker_id = follower_id and b.blocked_id = following_id)
       or (b.blocker_id = following_id and b.blocked_id = follower_id)
  )
);
drop policy if exists "follows_update_following" on public.follows;
create policy "follows_update_following"
on public.follows
for update
using ((select auth.uid()) = following_id)
with check ((select auth.uid()) = following_id);
drop policy if exists "follows_delete_participants" on public.follows;
create policy "follows_delete_participants"
on public.follows
for delete
using ((select auth.uid()) in (follower_id, following_id));
drop policy if exists "club_memberships_select_participants" on public.club_memberships;
create policy "club_memberships_select_participants"
on public.club_memberships
for select
using (
  deleted_at is null
  and (
    (select auth.uid()) in (club_id, member_id)
    or (
      status = 'accepted'
      and (
        coalesce((select caps.can_view_members from public.get_profile_capabilities(club_id) caps), false)
        or coalesce((select caps.can_view_joined_clubs from public.get_profile_capabilities(member_id) caps), false)
      )
    )
  )
);
drop policy if exists "club_memberships_insert_member" on public.club_memberships;
create policy "club_memberships_insert_member"
on public.club_memberships
for insert
with check ((select auth.uid()) = member_id);
drop policy if exists "club_memberships_update_participants" on public.club_memberships;
create policy "club_memberships_update_participants"
on public.club_memberships
for update
using ((select auth.uid()) in (club_id, member_id))
with check ((select auth.uid()) in (club_id, member_id));
drop policy if exists "club_memberships_delete_participants" on public.club_memberships;
create policy "club_memberships_delete_participants"
on public.club_memberships
for delete
using ((select auth.uid()) in (club_id, member_id));
drop policy if exists "events_select_visible" on public.events;
create policy "events_select_visible"
on public.events
for select
using (public.can_view_event(id));
drop policy if exists "events_insert_owner_club" on public.events;
create policy "events_insert_owner_club"
on public.events
for insert
with check ((select auth.uid()) = club_id);
drop policy if exists "events_update_owner" on public.events;
create policy "events_update_owner"
on public.events
for update
using ((select auth.uid()) = club_id)
with check ((select auth.uid()) = club_id);
drop policy if exists "events_delete_owner" on public.events;
create policy "events_delete_owner"
on public.events
for delete
using ((select auth.uid()) = club_id);
drop policy if exists "event_attendees_select_visible_event" on public.event_attendees;
create policy "event_attendees_select_visible_event"
on public.event_attendees
for select
using (public.can_view_event(event_id));
drop policy if exists "event_attendees_insert_self" on public.event_attendees;
create policy "event_attendees_insert_self"
on public.event_attendees
for insert
with check ((select auth.uid()) = user_id and public.can_attend_event(event_id));
drop policy if exists "event_attendees_delete_self" on public.event_attendees;
create policy "event_attendees_delete_self"
on public.event_attendees
for delete
using ((select auth.uid()) = user_id and public.can_attend_event(event_id));
drop policy if exists "event_likes_select_visible_event" on public.event_likes;
create policy "event_likes_select_visible_event"
on public.event_likes
for select
using (public.can_view_event(event_id));
drop policy if exists "event_likes_insert_self" on public.event_likes;
create policy "event_likes_insert_self"
on public.event_likes
for insert
with check ((select auth.uid()) = user_id and public.can_open_event_detail(event_id));
drop policy if exists "event_likes_delete_self" on public.event_likes;
create policy "event_likes_delete_self"
on public.event_likes
for delete
using ((select auth.uid()) = user_id);
drop policy if exists "event_comments_select_visible_event" on public.event_comments;
create policy "event_comments_select_visible_event"
on public.event_comments
for select
using (public.can_view_event(event_id));
drop policy if exists "event_comments_insert_self" on public.event_comments;
create policy "event_comments_insert_self"
on public.event_comments
for insert
with check ((select auth.uid()) = user_id and public.can_open_event_detail(event_id));
drop policy if exists "event_comments_update_self" on public.event_comments;
create policy "event_comments_update_self"
on public.event_comments
for update
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);
drop policy if exists "event_comments_delete_self" on public.event_comments;
create policy "event_comments_delete_self"
on public.event_comments
for delete
using ((select auth.uid()) = user_id);
drop policy if exists "album_photos_select_visible_event" on public.album_photos;
create policy "album_photos_select_visible_event"
on public.album_photos
for select
using (public.can_view_album(id, 'feed'));
drop policy if exists "album_photos_insert_self" on public.album_photos;
create policy "album_photos_insert_self"
on public.album_photos
for insert
with check ((select auth.uid()) = user_id and public.can_upload_event_album(event_id));
drop policy if exists "album_photos_update_self" on public.album_photos;
create policy "album_photos_update_self"
on public.album_photos
for update
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);
drop policy if exists "album_photos_delete_self" on public.album_photos;
create policy "album_photos_delete_self"
on public.album_photos
for delete
using ((select auth.uid()) = user_id);
drop policy if exists "album_photo_likes_select_visible_photo" on public.album_photo_likes;
create policy "album_photo_likes_select_visible_photo"
on public.album_photo_likes
for select
using (exists (select 1 from public.album_photos ap where ap.id = photo_id and public.can_view_event(ap.event_id)));
drop policy if exists "album_photo_likes_insert_self" on public.album_photo_likes;
create policy "album_photo_likes_insert_self"
on public.album_photo_likes
for insert
with check ((select auth.uid()) = user_id and public.can_interact_album(photo_id, 'feed'));
drop policy if exists "album_photo_likes_delete_self" on public.album_photo_likes;
create policy "album_photo_likes_delete_self"
on public.album_photo_likes
for delete
using ((select auth.uid()) = user_id);
drop policy if exists "album_photo_comments_select_visible_photo" on public.album_photo_comments;
create policy "album_photo_comments_select_visible_photo"
on public.album_photo_comments
for select
using (exists (select 1 from public.album_photos ap where ap.id = photo_id and public.can_view_event(ap.event_id)));
drop policy if exists "album_photo_comments_insert_self" on public.album_photo_comments;
create policy "album_photo_comments_insert_self"
on public.album_photo_comments
for insert
with check ((select auth.uid()) = user_id and public.can_interact_album(photo_id, 'feed'));
drop policy if exists "album_photo_comments_update_self" on public.album_photo_comments;
create policy "album_photo_comments_update_self"
on public.album_photo_comments
for update
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);
drop policy if exists "album_photo_comments_delete_self" on public.album_photo_comments;
create policy "album_photo_comments_delete_self"
on public.album_photo_comments
for delete
using ((select auth.uid()) = user_id);
drop policy if exists "notifications_select_owner" on public.notifications;
create policy "notifications_select_owner"
on public.notifications
for select
using ((select auth.uid()) = user_id);
drop policy if exists "notifications_update_owner" on public.notifications;
create policy "notifications_update_owner"
on public.notifications
for update
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);
drop policy if exists "reports_select_reporter" on public.reports;
create policy "reports_select_reporter"
on public.reports
for select
using ((select auth.uid()) = reporter_id);
drop policy if exists "reports_insert_reporter" on public.reports;
create policy "reports_insert_reporter"
on public.reports
for insert
with check ((select auth.uid()) = reporter_id);
drop policy if exists "reports_update_reporter" on public.reports;
create policy "reports_update_reporter"
on public.reports
for update
using ((select auth.uid()) = reporter_id)
with check ((select auth.uid()) = reporter_id);
grant execute on function public.resolve_profile_id(text) to authenticated, anon;
grant execute on function public.is_accepted_follower(uuid, uuid) to authenticated, anon;
grant execute on function public.is_blocked_pair(uuid, uuid) to authenticated, anon;
grant execute on function public.can_view_profile(uuid) to authenticated, anon;
grant execute on function public.get_profile_capabilities(uuid) to authenticated;
grant execute on function public.normalize_access_label(text) to authenticated, anon;
grant execute on function public.resolve_event_attendance_scope(text) to authenticated, anon;
grant execute on function public.get_event_capabilities(uuid) to authenticated;
grant execute on function public.get_album_capabilities(uuid, text) to authenticated;
grant execute on function public.can_discover_event(uuid) to authenticated, anon;
grant execute on function public.can_open_event_detail(uuid) to authenticated, anon;
grant execute on function public.can_attend_event(uuid) to authenticated, anon;
grant execute on function public.can_view_event_attendees(uuid) to authenticated, anon;
grant execute on function public.can_open_event_album(uuid) to authenticated, anon;
grant execute on function public.can_upload_event_album(uuid) to authenticated, anon;
grant execute on function public.can_view_event(uuid) to authenticated, anon;
grant execute on function public.can_discover_album(uuid, text) to authenticated, anon;
grant execute on function public.can_open_album(uuid, text) to authenticated, anon;
grant execute on function public.can_interact_album(uuid, text) to authenticated, anon;
grant execute on function public.can_view_album(uuid, text) to authenticated, anon;
