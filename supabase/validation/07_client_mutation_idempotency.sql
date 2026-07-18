-- Client mutation idempotency validation pack
-- Returns only mismatches for sampled replay scenarios. Empty result means sampled replay passed.

begin;

set local statement_timeout = '30s';

create temporary table validation_results (
  check_name text not null,
  expected text not null,
  actual text not null,
  context jsonb not null
);

insert into validation_results (check_name, expected, actual, context)
with sample as (
  select
    e.id as event_id,
    viewer.user_id as viewer_id
  from public.events e
  join public.profiles viewer
    on viewer.user_id <> e.club_id
   and viewer.deleted_at is null
  where e.club_id is not null
    and e.deleted_at is null
    and e.visibility = 'public'
    and not public.is_blocked_pair(viewer.user_id, e.club_id)
    and not exists (
      select 1
      from public.event_likes l
      where l.event_id = e.id
        and l.user_id = viewer.user_id
    )
  order by e.created_at desc nulls last, e.id desc, viewer.created_at desc nulls last
  limit 1
),
first_call as (
  select result.liked, result.likes_count
  from sample,
  lateral (select set_config('request.jwt.claim.sub', sample.viewer_id::text, true)) cfg,
  lateral (
    select *
    from public.toggle_event_like(sample.event_id, 'validation-event-like-replay')
  ) result
),
after_first as (
  select count(l.user_id)::bigint as like_count
  from sample
  cross join first_call
  left join public.event_likes l
    on l.event_id = sample.event_id
   and l.user_id = sample.viewer_id
),
second_call as (
  select result.liked, result.likes_count
  from sample,
  lateral (select set_config('request.jwt.claim.sub', sample.viewer_id::text, true)) cfg,
  lateral (
    select *
    from public.toggle_event_like(sample.event_id, 'validation-event-like-replay')
  ) result
),
after_second as (
  select count(l.user_id)::bigint as like_count
  from sample
  cross join second_call
  left join public.event_likes l
    on l.event_id = sample.event_id
   and l.user_id = sample.viewer_id
)
select
  'toggle_event_like_replay_preserves_state',
  after_first.like_count::text,
  after_second.like_count::text,
  jsonb_build_object(
    'event_id', sample.event_id,
    'viewer_id', sample.viewer_id
  )
from sample, first_call, second_call, after_first, after_second
where after_first.like_count is distinct from after_second.like_count;

insert into validation_results (check_name, expected, actual, context)
with sample as (
  select
    e.id as event_id,
    viewer.user_id as viewer_id
  from public.events e
  join public.profiles viewer
    on viewer.user_id <> e.club_id
   and viewer.deleted_at is null
  where e.club_id is not null
    and e.deleted_at is null
    and e.visibility = 'public'
    and not public.is_blocked_pair(viewer.user_id, e.club_id)
    and not exists (
      select 1
      from public.event_likes l
      where l.event_id = e.id
        and l.user_id = viewer.user_id
    )
  order by e.created_at desc nulls last, e.id desc, viewer.created_at desc nulls last
  limit 1
),
first_call as (
  select result.liked, result.likes_count
  from sample,
  lateral (select set_config('request.jwt.claim.sub', sample.viewer_id::text, true)) cfg,
  lateral (
    select *
    from public.toggle_event_like(sample.event_id, 'validation-event-like-replay')
  ) result
),
second_call as (
  select result.liked, result.likes_count
  from sample,
  lateral (select set_config('request.jwt.claim.sub', sample.viewer_id::text, true)) cfg,
  lateral (
    select *
    from public.toggle_event_like(sample.event_id, 'validation-event-like-replay')
  ) result
),
receipt_rows as (
  select
    count(r.*)::bigint as receipt_count,
    max(sample.viewer_id::text) as viewer_id,
    bool_or(first_call.liked is not null) as first_call_evaluated,
    bool_or(second_call.liked is not null) as second_call_evaluated
  from sample
  cross join first_call
  cross join second_call
  left join public.client_mutation_receipts r
    on r.viewer_id = sample.viewer_id
   and r.operation = 'toggle_event_like'
   and r.client_mutation_id = 'validation-event-like-replay'
)
select
  'toggle_event_like_replay_receipt_count',
  '1',
  receipt_rows.receipt_count::text,
  jsonb_build_object(
    'viewer_id', receipt_rows.viewer_id,
    'client_mutation_id', 'validation-event-like-replay',
    'first_call_evaluated', coalesce(receipt_rows.first_call_evaluated, false),
    'second_call_evaluated', coalesce(receipt_rows.second_call_evaluated, false)
  )
from sample, first_call, second_call, receipt_rows
where receipt_rows.receipt_count <> 1;

do $$
declare
  sample_notification_id uuid;
  sample_viewer_id uuid;
  first_response jsonb;
  second_response jsonb;
  receipt_count bigint := 0;
begin
  select n.id, n.user_id
    into sample_notification_id, sample_viewer_id
  from public.notifications n
  order by n.is_read asc, n.created_at desc nulls last, n.id desc
  limit 1;

  if sample_notification_id is null or sample_viewer_id is null then
    return;
  end if;

  perform set_config('request.jwt.claim.sub', sample_viewer_id::text, true);

  first_response := public.mark_notification_read_with_patch(
    sample_notification_id,
    'validation-notification-read-replay'
  );
  second_response := public.mark_notification_read_with_patch(
    sample_notification_id,
    'validation-notification-read-replay'
  );

  select count(*)::bigint
    into receipt_count
  from public.client_mutation_receipts r
  where r.viewer_id = sample_viewer_id
    and r.operation = 'mark_notification_read_with_patch'
    and r.client_mutation_id = 'validation-notification-read-replay';

  if receipt_count <> 1 then
    insert into validation_results (check_name, expected, actual, context)
    values (
      'mark_notification_read_replay_receipt_count',
      '1',
      receipt_count::text,
      jsonb_build_object(
        'viewer_id', sample_viewer_id,
        'client_mutation_id', 'validation-notification-read-replay',
        'first_call_evaluated', first_response is not null,
        'second_call_evaluated', second_response is not null
      )
    );
  end if;
end $$;

select
  check_name,
  expected,
  actual,
  context
from validation_results
order by check_name;

rollback;
