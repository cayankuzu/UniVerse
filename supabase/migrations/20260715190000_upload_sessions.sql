create table if not exists public.upload_sessions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  mutation_id text not null,
  folder text not null check (folder in ('albums', 'avatars', 'covers', 'events', 'profiles')),
  expected_count integer not null check (expected_count between 1 and 9),
  state text not null default 'created' check (
    state in ('created', 'uploading', 'uploaded', 'quarantined', 'finalized', 'cancelled', 'failed', 'expired')
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '24 hours',
  finalized_at timestamptz,
  cancelled_at timestamptz,
  failure_reason text,
  unique (owner_id, mutation_id)
);

create table if not exists public.upload_session_items (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.upload_sessions(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  media_index integer not null check (media_index between 0 and 8),
  expected_size_bytes bigint check (expected_size_bytes is null or expected_size_bytes > 0),
  expected_content_type text not null,
  expected_checksum text,
  object_path text not null,
  observed_size_bytes bigint check (observed_size_bytes is null or observed_size_bytes > 0),
  observed_content_type text,
  state text not null default 'ticketed' check (
    state in ('ticketed', 'uploaded', 'quarantined', 'valid', 'scan_failed', 'finalized', 'cancelled', 'failed', 'expired')
  ),
  scan_state text not null default 'pending' check (scan_state in ('pending', 'passed', 'failed', 'skipped')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (session_id, media_index),
  unique (object_path)
);

create index if not exists upload_sessions_owner_state_idx
  on public.upload_sessions(owner_id, state, expires_at);

create index if not exists upload_session_items_session_state_idx
  on public.upload_session_items(session_id, state);

create or replace function public.touch_upload_session_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists upload_sessions_touch_updated_at on public.upload_sessions;
create trigger upload_sessions_touch_updated_at
before update on public.upload_sessions
for each row execute function public.touch_upload_session_updated_at();

drop trigger if exists upload_session_items_touch_updated_at on public.upload_session_items;
create trigger upload_session_items_touch_updated_at
before update on public.upload_session_items
for each row execute function public.touch_upload_session_updated_at();

alter table public.upload_sessions enable row level security;
alter table public.upload_session_items enable row level security;

drop policy if exists upload_sessions_owner_read on public.upload_sessions;
create policy upload_sessions_owner_read
on public.upload_sessions for select
using ((select auth.uid()) = owner_id);

drop policy if exists upload_session_items_owner_read on public.upload_session_items;
create policy upload_session_items_owner_read
on public.upload_session_items for select
using ((select auth.uid()) = owner_id);

create or replace function public.expire_stale_upload_sessions(max_age interval default interval '24 hours')
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  expired_count integer := 0;
begin
  update public.upload_sessions
  set state = 'expired',
      failure_reason = coalesce(failure_reason, 'ttl_expired')
  where state in ('created', 'uploading', 'uploaded', 'quarantined')
    and (expires_at < now() or updated_at < now() - max_age);

  get diagnostics expired_count = row_count;

  update public.upload_session_items item
  set state = 'expired'
  from public.upload_sessions session
  where item.session_id = session.id
    and session.state = 'expired'
    and item.state not in ('finalized', 'cancelled', 'expired');

  return expired_count;
end;
$$;

revoke all on function public.expire_stale_upload_sessions(interval) from public;
grant execute on function public.expire_stale_upload_sessions(interval) to service_role;
