create or replace function public.notifications_projection(
  viewer_id uuid,
  filter_name text,
  cursor text default null,
  limit_count integer default 30,
  since timestamptz default null,
  delta_token text default null,
  notification_id uuid default null
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
          when notification_id is null
            and n.type = 'follow_request'::public.notification_type
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
        and (notification_id is null or n.id = notification_id)
        and n.type not in (
          'join_request'::public.notification_type,
          'join_accepted'::public.notification_type,
          'join_rejected'::public.notification_type
        )
        and (filter_name = 'all' or n.type::text = filter_name)
        and (
          notification_id is not null
          or resolved_since is null
          or coalesce(n.last_activity_at, n.created_at) >= resolved_since
        )
        and (
          notification_id is not null
          or cursor_timestamp is null
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
        case
          when r.photo_id is not null then coalesce(
            nullif(btrim(ap.title), ''),
            nullif(btrim(ap.caption), ''),
            nullif(btrim(e.title), '')
          )
          when r.event_id is not null then nullif(btrim(e.title), '')
          else null
        end as content_title,
        case
          when r.photo_id is not null
            and nullif(btrim(e.title), '') is not null
            and nullif(btrim(e.title), '') is distinct from coalesce(
              nullif(btrim(ap.title), ''),
              nullif(btrim(ap.caption), ''),
              nullif(btrim(e.title), '')
            )
            then nullif(btrim(e.title), '')
          else null
        end as content_subtitle,
        latest_follow.latest_follow_deleted_at,
        latest_follow.latest_follow_responded_at,
        latest_follow.latest_follow_status
      from page_rows r
      left join public.profiles actor on actor.user_id = r.actor_id
      left join public.events e on e.id = r.event_id
      left join public.album_photos ap on ap.id = r.photo_id
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
            'contentTitle', r.content_title,
            'contentSubtitle', r.content_subtitle,
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
          when notification_id is not null or o.id is null then null
          else to_char(timezone('utc', o.activity_at), 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') || '|' || o.id::text
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
