-- Keep startup work intentionally small: one first-fold home projection and one
-- unread counter. Profile/search data is loaded only after an explicit intent.
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
  emitted_at timestamptz := timezone('utc', now());
  home_payload jsonb;
  badge_count integer := 0;
begin
  home_payload := public.home_feed_projection_v2(
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
    'home', home_payload,
    'notificationBadge', jsonb_build_object(
      'id', 'notifications',
      'unreadCount', coalesce(badge_count, 0)
    )
  );
end;
$$;

grant execute on function public.app_warmup_projection(
  uuid,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text
) to authenticated;
