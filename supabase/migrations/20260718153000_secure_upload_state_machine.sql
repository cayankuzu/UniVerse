-- Fail-closed media validation and atomic album publication.
-- Existing published media is grandfathered explicitly; every new album write
-- must be backed by one verified upload session.

alter table public.upload_sessions
  add column if not exists album_photo_id uuid references public.album_photos(id) on delete set null,
  add column if not exists scan_started_at timestamptz,
  add column if not exists scan_completed_at timestamptz;

create unique index if not exists upload_sessions_album_photo_uidx
  on public.upload_sessions(album_photo_id)
  where album_photo_id is not null;

alter table public.upload_session_items
  add column if not exists observed_checksum text,
  add column if not exists scan_provider text,
  add column if not exists scan_result jsonb,
  add column if not exists scan_started_at timestamptz,
  add column if not exists scan_completed_at timestamptz;

alter table public.media_assets
  add column if not exists checksum_sha256 text,
  add column if not exists scan_state text not null default 'passed',
  add column if not exists scan_provider text,
  add column if not exists scan_completed_at timestamptz;

alter table public.album_photos
  add column if not exists upload_session_id uuid references public.upload_sessions(id) on delete restrict;

create unique index if not exists album_photos_upload_session_uidx
  on public.album_photos(upload_session_id)
  where upload_session_id is not null;

-- Rows published before this migration cannot be rescanned retroactively.
-- Make the grandfathering decision explicit and keep every unfinished item
-- quarantined until the scanner provides a new verdict.
update public.upload_session_items
set scan_state = case
      when state = 'finalized' then 'passed'
      else 'pending'
    end,
    scan_provider = case
      when state = 'finalized' then coalesce(scan_provider, 'legacy-grandfathered')
      else scan_provider
    end,
    state = case
      when state = 'finalized' then state
      else 'quarantined'
    end
where scan_state = 'skipped';

alter table public.upload_sessions
  drop constraint if exists upload_sessions_state_check;
alter table public.upload_sessions
  add constraint upload_sessions_state_check check (
    state in (
      'created', 'uploading', 'quarantined', 'uploaded', 'finalized',
      'cancelled', 'failed', 'expired'
    )
  );

alter table public.upload_session_items
  drop constraint if exists upload_session_items_scan_state_check;
alter table public.upload_session_items
  drop constraint if exists upload_session_items_expected_checksum_check,
  drop constraint if exists upload_session_items_observed_checksum_check;
alter table public.upload_session_items
  add constraint upload_session_items_scan_state_check check (
    scan_state in ('pending', 'passed', 'failed')
  ),
  add constraint upload_session_items_expected_checksum_check check (
    expected_checksum is null or expected_checksum ~ '^[a-fA-F0-9]{64}$'
  ),
  add constraint upload_session_items_observed_checksum_check check (
    observed_checksum is null or observed_checksum ~ '^[a-f0-9]{64}$'
  );

alter table public.media_assets
  drop constraint if exists media_assets_scan_state_check;
alter table public.media_assets
  drop constraint if exists media_assets_checksum_sha256_check;
alter table public.media_assets
  add constraint media_assets_scan_state_check check (
    scan_state in ('pending', 'passed', 'failed')
  ),
  add constraint media_assets_checksum_sha256_check check (
    checksum_sha256 is null or checksum_sha256 ~ '^[a-f0-9]{64}$'
  );

create index if not exists media_assets_scan_state_idx
  on public.media_assets(scan_state, created_at desc);

create table if not exists public.storage_cleanup_jobs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  bucket_id text not null default 'make-e3557d40-media',
  object_path text not null,
  reason text not null,
  status text not null default 'pending' check (status in ('pending', 'processing', 'completed', 'dead_letter')),
  attempt_count integer not null default 0 check (attempt_count between 0 and 20),
  next_attempt_at timestamptz not null default now(),
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);

create unique index if not exists storage_cleanup_jobs_pending_path_uidx
  on public.storage_cleanup_jobs(bucket_id, object_path)
  where status in ('pending', 'processing');

create index if not exists storage_cleanup_jobs_ready_idx
  on public.storage_cleanup_jobs(status, next_attempt_at, created_at)
  where status in ('pending', 'processing');

alter table public.storage_cleanup_jobs enable row level security;

create or replace function public.enqueue_storage_cleanup_job(
  target_owner_id uuid,
  target_object_path text,
  target_reason text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  existing_job_id uuid;
  next_job_id uuid;
  normalized_path text := trim(coalesce(target_object_path, ''));
begin
  if target_owner_id is null or normalized_path = '' then
    raise exception 'Storage cleanup target is required';
  end if;
  if split_part(normalized_path, '/', 2) <> target_owner_id::text then
    raise exception 'Storage cleanup target owner mismatch';
  end if;

  select job.id
  into existing_job_id
  from public.storage_cleanup_jobs job
  where job.bucket_id = 'make-e3557d40-media'
    and job.object_path = normalized_path
    and job.status in ('pending', 'processing')
  order by job.created_at desc
  limit 1
  for update;

  if existing_job_id is not null then
    update public.storage_cleanup_jobs
    set next_attempt_at = least(next_attempt_at, now()),
        reason = left(trim(coalesce(target_reason, reason)), 160),
        updated_at = now()
    where id = existing_job_id;
    return existing_job_id;
  end if;

  insert into public.storage_cleanup_jobs(owner_id, object_path, reason)
  values (target_owner_id, normalized_path, left(trim(coalesce(target_reason, 'cleanup_required')), 160))
  returning id into next_job_id;
  return next_job_id;
end;
$$;

revoke all on table public.storage_cleanup_jobs from public, anon, authenticated;
grant select, insert, update, delete on table public.storage_cleanup_jobs to service_role;
revoke all on function public.enqueue_storage_cleanup_job(uuid, text, text) from public;
grant execute on function public.enqueue_storage_cleanup_job(uuid, text, text) to service_role;

create or replace function public.claim_storage_cleanup_jobs(
  target_owner_id uuid,
  max_jobs integer default 20
)
returns table(id uuid, object_path text, attempt_count integer)
language sql
security definer
set search_path = public
as $$
  with candidates as (
    select job.id
    from public.storage_cleanup_jobs job
    where job.owner_id = target_owner_id
      and job.status in ('pending', 'processing')
      and job.next_attempt_at <= now()
      and job.attempt_count < 20
    order by job.next_attempt_at, job.created_at
    limit least(greatest(max_jobs, 1), 50)
    for update skip locked
  )
  update public.storage_cleanup_jobs job
  set attempt_count = job.attempt_count + 1,
      next_attempt_at = now() + interval '10 minutes',
      status = 'processing',
      updated_at = now()
  from candidates
  where job.id = candidates.id
  returning job.id, job.object_path, job.attempt_count;
$$;

revoke all on function public.claim_storage_cleanup_jobs(uuid, integer) from public;
grant execute on function public.claim_storage_cleanup_jobs(uuid, integer) to service_role;

create or replace function public.cancel_upload_session_records(
  target_session_id uuid,
  target_owner_id uuid,
  target_reason text default 'user_cancelled'
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  session_state text;
begin
  select state into session_state
  from public.upload_sessions
  where id = target_session_id and owner_id = target_owner_id
  for update;

  if session_state is null then
    raise exception 'Upload session not found';
  end if;
  if session_state = 'finalized' then
    raise exception 'Published upload session cannot be cancelled';
  end if;

  update public.upload_session_items
  set state = 'cancelled'
  where session_id = target_session_id
    and owner_id = target_owner_id
    and state <> 'finalized';

  update public.upload_sessions
  set cancelled_at = coalesce(cancelled_at, now()),
      failure_reason = left(trim(coalesce(target_reason, 'user_cancelled')), 160),
      state = 'cancelled'
  where id = target_session_id and owner_id = target_owner_id;
  return true;
end;
$$;

revoke all on function public.cancel_upload_session_records(uuid, uuid, text) from public;
grant execute on function public.cancel_upload_session_records(uuid, uuid, text) to service_role;

create or replace function public.record_upload_scan_result(
  target_object_path text,
  target_owner_id uuid,
  target_passed boolean,
  target_observed_content_type text,
  target_observed_size_bytes bigint,
  target_observed_checksum text,
  target_scan_provider text,
  target_scan_result jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  item_row public.upload_session_items%rowtype;
  next_session_state text;
begin
  if target_owner_id is null or nullif(trim(coalesce(target_object_path, '')), '') is null then
    raise exception 'Upload scan target is required';
  end if;
  if target_observed_size_bytes is null or target_observed_size_bytes <= 0 then
    raise exception 'Observed upload size is required';
  end if;
  if target_passed and nullif(trim(coalesce(target_observed_checksum, '')), '') is null then
    raise exception 'Observed upload checksum is required';
  end if;
  if nullif(trim(coalesce(target_scan_provider, '')), '') is null then
    raise exception 'Upload scan provider is required';
  end if;

  select item.*
  into item_row
  from public.upload_session_items item
  where item.object_path = trim(target_object_path)
    and item.owner_id = target_owner_id
  for update;

  if item_row.id is null then
    raise exception 'Upload session item not found';
  end if;

  if item_row.state in ('cancelled', 'expired') then
    raise exception 'Upload session item is no longer active';
  end if;

  if target_passed
    and item_row.expected_size_bytes is not null
    and item_row.expected_size_bytes <> target_observed_size_bytes then
    target_passed := false;
    target_scan_result := coalesce(target_scan_result, '{}'::jsonb)
      || jsonb_build_object('reason', 'size_mismatch');
  end if;

  if target_passed
    and nullif(trim(coalesce(item_row.expected_checksum, '')), '') is not null
    and lower(trim(item_row.expected_checksum)) <> lower(trim(target_observed_checksum)) then
    target_passed := false;
    target_scan_result := coalesce(target_scan_result, '{}'::jsonb)
      || jsonb_build_object('reason', 'checksum_mismatch');
  end if;

  update public.upload_session_items
  set observed_content_type = lower(trim(target_observed_content_type)),
      observed_size_bytes = target_observed_size_bytes,
      observed_checksum = nullif(lower(trim(coalesce(target_observed_checksum, ''))), ''),
      scan_provider = trim(target_scan_provider),
      scan_result = coalesce(target_scan_result, '{}'::jsonb),
      scan_completed_at = now(),
      scan_state = case when target_passed then 'passed' else 'failed' end,
      state = case when target_passed then 'valid' else 'scan_failed' end
  where id = item_row.id;

  update public.media_assets
  set checksum_sha256 = nullif(lower(trim(coalesce(target_observed_checksum, ''))), ''),
      mime_type = lower(trim(target_observed_content_type)),
      scan_completed_at = now(),
      scan_provider = trim(target_scan_provider),
      scan_state = case when target_passed then 'passed' else 'failed' end,
      size_bytes = target_observed_size_bytes
  where object_path = trim(target_object_path)
    and owner_id = target_owner_id;

  if target_passed then
    select case
      when not exists (
        select 1
        from public.upload_session_items sibling
        where sibling.session_id = item_row.session_id
          and (sibling.scan_state <> 'passed' or sibling.state not in ('valid', 'finalized'))
      ) then 'uploaded'
      else 'quarantined'
    end
    into next_session_state;
  else
    next_session_state := 'failed';
  end if;

  update public.upload_sessions
  set failure_reason = case
        when target_passed then null
        else coalesce(nullif(target_scan_result->>'reason', ''), 'media_scan_failed')
      end,
      scan_completed_at = case when next_session_state in ('uploaded', 'failed') then now() else null end,
      scan_started_at = coalesce(scan_started_at, now()),
      state = next_session_state
  where id = item_row.session_id
    and state not in ('finalized', 'cancelled', 'expired');

  return jsonb_build_object(
    'passed', target_passed,
    'sessionId', item_row.session_id,
    'state', next_session_state
  );
end;
$$;

revoke all on function public.record_upload_scan_result(
  text, uuid, boolean, text, bigint, text, text, jsonb
) from public;
grant execute on function public.record_upload_scan_result(
  text, uuid, boolean, text, bigint, text, text, jsonb
) to service_role;

create or replace function public.finalize_verified_album_upload()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  matched_session public.upload_sessions%rowtype;
  normalized_media_paths text[];
  normalized_path_count integer;
begin
  if tg_op = 'UPDATE'
    and new.storage_path is not distinct from old.storage_path
    and new.media_paths is not distinct from old.media_paths then
    return new;
  end if;

  select coalesce(array_agg(trim(path) order by path_order), '{}'::text[])
  into normalized_media_paths
  from unnest(coalesce(new.media_paths, array[new.storage_path])) with ordinality as media(path, path_order)
  where nullif(trim(coalesce(path, '')), '') is not null;

  normalized_path_count := coalesce(array_length(normalized_media_paths, 1), 0);
  if normalized_path_count = 0 or normalized_path_count > 9 then
    raise exception 'Album media paths are invalid';
  end if;
  if normalized_path_count <> (
    select count(distinct path)
    from unnest(normalized_media_paths) as path
  ) then
    raise exception 'Album media paths must be unique';
  end if;
  if not (trim(coalesce(new.storage_path, '')) = any(normalized_media_paths)) then
    raise exception 'Album primary media path is invalid';
  end if;

  select session.*
  into matched_session
  from public.upload_sessions session
  where session.owner_id = new.user_id
    and session.folder = 'albums'
    and session.state in ('uploaded', 'finalized')
    and session.expires_at > now()
    and session.expected_count = normalized_path_count
    and (new.upload_session_id is null or session.id = new.upload_session_id)
    and not exists (
      select 1
      from public.upload_session_items item
      where item.session_id = session.id
        and (
          item.scan_state <> 'passed'
          or item.state not in ('valid', 'finalized')
          or item.object_path <> all(normalized_media_paths)
        )
    )
    and not exists (
      select 1
      from unnest(normalized_media_paths) requested_path
      where not exists (
        select 1
        from public.upload_session_items item
        where item.session_id = session.id
          and item.object_path = requested_path
      )
    )
  order by session.created_at desc
  limit 1
  for update;

  if matched_session.id is null then
    raise exception 'Verified album upload session is required';
  end if;
  if matched_session.album_photo_id is not null
    and matched_session.album_photo_id <> new.id then
    raise exception 'Upload session has already been published';
  end if;

  new.media_paths := normalized_media_paths;
  new.upload_session_id := matched_session.id;

  update public.upload_session_items
  set state = 'finalized'
  where session_id = matched_session.id
    and state = 'valid';

  update public.upload_sessions
  set failure_reason = null,
      finalized_at = coalesce(finalized_at, now()),
      state = 'finalized'
  where id = matched_session.id;

  return new;
end;
$$;

revoke all on function public.finalize_verified_album_upload() from public;

drop trigger if exists album_photos_require_verified_upload on public.album_photos;
create trigger album_photos_require_verified_upload
before insert or update of storage_path, media_paths on public.album_photos
for each row execute function public.finalize_verified_album_upload();

create or replace function public.link_published_album_upload_session()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.upload_session_id is null then
    raise exception 'Published album upload session is required';
  end if;

  if tg_op = 'UPDATE' and old.upload_session_id is distinct from new.upload_session_id then
    update public.upload_sessions
    set album_photo_id = null
    where id = old.upload_session_id
      and album_photo_id = new.id;
  end if;

  update public.upload_sessions
  set album_photo_id = new.id
  where id = new.upload_session_id
    and owner_id = new.user_id
    and state = 'finalized'
    and (album_photo_id is null or album_photo_id = new.id);

  if not found then
    raise exception 'Published album upload session could not be linked';
  end if;
  return new;
end;
$$;

revoke all on function public.link_published_album_upload_session() from public;

drop trigger if exists album_photos_link_verified_upload on public.album_photos;
create trigger album_photos_link_verified_upload
after insert or update of upload_session_id on public.album_photos
for each row execute function public.link_published_album_upload_session();

comment on trigger album_photos_require_verified_upload on public.album_photos is
  'Atomically publishes only media that passed the fail-closed upload scanner.';
