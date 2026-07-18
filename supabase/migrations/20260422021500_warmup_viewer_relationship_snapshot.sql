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
