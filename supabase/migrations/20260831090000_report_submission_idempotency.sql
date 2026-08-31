alter table public.reports
  add column if not exists client_mutation_id text,
  add column if not exists client_mutation_fingerprint text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'reports_client_mutation_shape_check'
      and conrelid = 'public.reports'::regclass
  ) then
    alter table public.reports
      add constraint reports_client_mutation_shape_check
      check (
        (
          client_mutation_id is null
          and client_mutation_fingerprint is null
        )
        or
        (
          client_mutation_id ~ '^[A-Za-z0-9._:-]{8,120}$'
          and client_mutation_fingerprint ~ '^[a-f0-9]{64}$'
        )
      );
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'reports_reporter_client_mutation_key'
      and conrelid = 'public.reports'::regclass
  ) then
    alter table public.reports
      add constraint reports_reporter_client_mutation_key
      unique (reporter_id, client_mutation_id);
  end if;
end;
$$;

comment on column public.reports.client_mutation_id is
  'Optional client-generated key used to deduplicate report submissions per reporter.';
comment on column public.reports.client_mutation_fingerprint is
  'SHA-256 of the normalized report request bound to client_mutation_id.';
