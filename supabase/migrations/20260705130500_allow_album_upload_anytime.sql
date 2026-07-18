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
    and (
      is_owner
      or (
        viewer_is_attendee
        and coalesce(viewer_account_type, 'student'::public.account_type) <> 'club'::public.account_type
      )
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

grant execute on function public.get_event_capabilities(uuid) to authenticated, anon;
