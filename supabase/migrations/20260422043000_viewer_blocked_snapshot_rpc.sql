create or replace function public.viewer_blocked_snapshot(viewer_id uuid default null)
returns table (
  direction text,
  user_id uuid,
  username text
)
language sql
stable
security definer
set search_path = public
as $$
  with resolved_viewer as (
    select coalesce($1, auth.uid()) as id
    where coalesce($1, auth.uid()) is not null
      and (
        auth.uid() = coalesce($1, auth.uid())
        or auth.role() = 'service_role'
      )
  )
  select
    'outgoing'::text as direction,
    blocked_profile.user_id,
    blocked_profile.username
  from resolved_viewer viewer
  join public.blocks block_row
    on block_row.blocker_id = viewer.id
  join public.profiles blocked_profile
    on blocked_profile.user_id = block_row.blocked_id
  union all
  select
    'incoming'::text as direction,
    blocker_profile.user_id,
    blocker_profile.username
  from resolved_viewer viewer
  join public.blocks block_row
    on block_row.blocked_id = viewer.id
  join public.profiles blocker_profile
    on blocker_profile.user_id = block_row.blocker_id;
$$;
grant execute on function public.viewer_blocked_snapshot(uuid) to authenticated;
