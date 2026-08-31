create table if not exists public.cloudflare_origin_request_nonces (
  nonce uuid primary key,
  request_timestamp timestamptz not null,
  expires_at timestamptz not null,
  request_id text,
  route_id text not null,
  created_at timestamptz not null default timezone('utc', now()),
  constraint cloudflare_origin_request_nonces_expiry_check
    check (expires_at > request_timestamp),
  constraint cloudflare_origin_request_nonces_request_id_check
    check (request_id is null or char_length(request_id) between 1 and 128),
  constraint cloudflare_origin_request_nonces_route_id_check
    check (char_length(route_id) between 1 and 128)
);

comment on table public.cloudflare_origin_request_nonces is
  'Short-lived replay claims for signed Cloudflare-to-Supabase origin requests.';

alter table public.cloudflare_origin_request_nonces enable row level security;
alter table public.cloudflare_origin_request_nonces force row level security;

revoke all on table public.cloudflare_origin_request_nonces from public;
revoke all on table public.cloudflare_origin_request_nonces from anon;
revoke all on table public.cloudflare_origin_request_nonces from authenticated;
grant select, insert, delete on table public.cloudflare_origin_request_nonces to service_role;

create index if not exists idx_cloudflare_origin_request_nonces_expires_at
  on public.cloudflare_origin_request_nonces (expires_at);

create or replace function public.claim_cloudflare_origin_request_nonce(
  p_nonce uuid,
  p_request_timestamp timestamptz,
  p_expires_at timestamptz,
  p_request_id text,
  p_route_id text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  inserted_count integer := 0;
begin
  if p_nonce is null
     or p_request_timestamp is null
     or p_expires_at is null
     or p_expires_at <= p_request_timestamp
     or p_request_id is null
     or char_length(p_request_id) not between 1 and 128
     or p_route_id is null
     or char_length(p_route_id) not between 1 and 128 then
    return false;
  end if;

  delete from public.cloudflare_origin_request_nonces
  where expires_at <= timezone('utc', now());

  insert into public.cloudflare_origin_request_nonces (
    nonce,
    request_timestamp,
    expires_at,
    request_id,
    route_id
  )
  values (
    p_nonce,
    p_request_timestamp,
    p_expires_at,
    p_request_id,
    p_route_id
  )
  on conflict (nonce) do nothing;

  get diagnostics inserted_count = row_count;
  return inserted_count = 1;
end;
$$;

revoke all on function public.claim_cloudflare_origin_request_nonce(
  uuid,
  timestamptz,
  timestamptz,
  text,
  text
) from public;
revoke all on function public.claim_cloudflare_origin_request_nonce(
  uuid,
  timestamptz,
  timestamptz,
  text,
  text
) from anon;
revoke all on function public.claim_cloudflare_origin_request_nonce(
  uuid,
  timestamptz,
  timestamptz,
  text,
  text
) from authenticated;
grant execute on function public.claim_cloudflare_origin_request_nonce(
  uuid,
  timestamptz,
  timestamptz,
  text,
  text
) to service_role;
