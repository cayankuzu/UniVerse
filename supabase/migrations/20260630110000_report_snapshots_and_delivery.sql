alter table public.reports
  add column if not exists reporter_snapshot jsonb not null default '{}'::jsonb,
  add column if not exists target_snapshot jsonb not null default '{}'::jsonb,
  add column if not exists mail_delivery_status text not null default 'pending',
  add column if not exists mail_delivery_error text,
  add column if not exists mail_delivered_at timestamptz;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'reports_mail_delivery_status_check'
  ) then
    alter table public.reports
      add constraint reports_mail_delivery_status_check
      check (mail_delivery_status in ('pending', 'sent', 'failed', 'skipped'));
  end if;
end;
$$;
