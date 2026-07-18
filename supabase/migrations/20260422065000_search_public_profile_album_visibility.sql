-- Make search album discovery honor the surface-specific album visibility flags.
-- New uploads can have show_on_user_profile/show_on_club_profile set while the
-- legacy show_on_profile flag is false, which made public profile albums miss
-- the search albums projection.

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
      (album_show_on_user_profile or album_show_on_club_profile)
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
      or coalesce(ap.show_on_user_profile, ap.show_on_profile, false)
      or coalesce(ap.show_on_club_profile, ap.show_on_profile, false)
    )
    and row_data.discoverable
  order by row_data.created_at desc;
$$;
grant execute on function public.get_album_capabilities(uuid, text) to authenticated, anon;
grant execute on function public.list_visible_albums(text, uuid, uuid[]) to authenticated, anon;
