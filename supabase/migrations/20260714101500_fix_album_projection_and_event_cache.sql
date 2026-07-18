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
    row_data.likes_count,
    row_data.comments_count,
    row_data.liked,
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

do $$
declare
  target_event record;
begin
  for target_event in (
    select distinct event_id
    from (
      select ap.event_id
      from public.album_photos ap
      where ap.event_id is not null
      union
      select cache.event_id
      from public.event_album_summary_cache cache
    ) ids
  ) loop
    perform public.rebuild_event_album_summary_cache(target_event.event_id);
  end loop;
end;
$$;
