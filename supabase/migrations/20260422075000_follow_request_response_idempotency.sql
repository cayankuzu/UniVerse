create or replace function public.respond_follow_request(requester_id uuid, action text)
returns table(status text)
language plpgsql
security definer
set search_path = public
as $$
declare
  viewer_id uuid := auth.uid();
  pending_row_id uuid;
  latest_status public.follow_status;
  latest_deleted_at timestamptz;
  normalized_action text := lower(trim(coalesce(action, '')));
  resolution_text text;
  now_utc timestamptz := timezone('utc', now());
begin
  if viewer_id is null then
    raise exception 'Unauthorized';
  end if;

  if normalized_action not in ('accept', 'reject') then
    raise exception 'Invalid action';
  end if;

  select f.id
    into pending_row_id
  from public.follows f
  where f.follower_id = requester_id
    and f.following_id = viewer_id
    and f.status = 'pending'::public.follow_status
    and f.deleted_at is null
  order by f.created_at desc, f.id desc
  limit 1;

  if pending_row_id is null then
    select f.status, f.deleted_at
      into latest_status, latest_deleted_at
    from public.follows f
    where f.follower_id = requester_id
      and f.following_id = viewer_id
    order by f.created_at desc, f.id desc
    limit 1;

    if latest_status = 'accepted'::public.follow_status and latest_deleted_at is null then
      resolution_text := case
        when normalized_action = 'accept' then 'Takip istegi zaten kabul edildi.'
        else 'Takip istegi daha once kabul edildi.'
      end;

      perform public.resolve_request_notification(
        viewer_id,
        requester_id,
        'follow_request'::public.notification_type,
        requester_id,
        'accepted',
        resolution_text,
        now_utc
      );
      status := 'following';
      return next;
    end if;

    if normalized_action = 'reject' then
      resolution_text := case
        when latest_status is null then 'Takip istegi artik aktif degil.'
        else 'Takip istegi zaten reddedildi.'
      end;

      perform public.resolve_request_notification(
        viewer_id,
        requester_id,
        'follow_request'::public.notification_type,
        requester_id,
        'rejected',
        resolution_text,
        now_utc
      );
      status := 'none';
      return next;
    end if;

    if latest_status is not null then
      perform public.resolve_request_notification(
        viewer_id,
        requester_id,
        'follow_request'::public.notification_type,
        requester_id,
        'rejected',
        'Takip istegi daha once reddedildi.',
        now_utc
      );
      status := 'none';
      return next;
    end if;

    raise exception 'Follow request not found';
  end if;

  if normalized_action = 'accept' then
    update public.follows
    set
      status = 'accepted'::public.follow_status,
      responded_at = now_utc,
      last_activity_at = now_utc,
      sync_version = greatest(coalesce(sync_version, 1) + 1, 2)
    where id = pending_row_id;

    perform public.resolve_request_notification(
      viewer_id,
      requester_id,
      'follow_request'::public.notification_type,
      requester_id,
      'accepted',
      'Takip istegini kabul ettin.',
      now_utc
    );

    status := 'following';
    return next;
  end if;

  perform public.resolve_request_notification(
    viewer_id,
    requester_id,
    'follow_request'::public.notification_type,
    requester_id,
    'rejected',
    'Takip istegini reddettin.',
    now_utc
  );

  update public.follows
  set
    responded_at = now_utc,
    deleted_at = now_utc,
    last_activity_at = now_utc,
    sync_version = greatest(coalesce(sync_version, 1) + 1, 2)
  where id = pending_row_id;

  status := 'none';
  return next;
end;
$$;
