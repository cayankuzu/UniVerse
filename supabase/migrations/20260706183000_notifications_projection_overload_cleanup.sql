grant execute on function public.notifications_projection(
  uuid,
  text,
  text,
  integer,
  timestamptz,
  text,
  uuid
) to authenticated;

alter function public.notifications_projection(
  uuid,
  text,
  text,
  integer,
  timestamptz,
  text,
  uuid
)
  set statement_timeout = '10s';

drop function if exists public.notifications_projection(
  uuid,
  text,
  text,
  integer,
  timestamptz,
  text
);
