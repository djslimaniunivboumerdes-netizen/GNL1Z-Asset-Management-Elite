create table if not exists public.maintenance_logs (
  id uuid primary key default gen_random_uuid(),
  tag text not null,
  performed_by uuid references auth.users(id) on delete set null,
  technician_name text,
  test_date date not null,
  test_type text not null default 'PREVENTIVE',
  test_pressure_shell numeric,
  test_pressure_tube numeric,
  result text not null default 'PENDING',
  notes text,
  attachment_paths text[] not null default '{}',
  created_at timestamptz not null default now()
);
create index if not exists maintenance_logs_tag_idx on public.maintenance_logs(tag);
create index if not exists maintenance_logs_date_idx on public.maintenance_logs(test_date desc);
alter table public.maintenance_logs enable row level security;
create policy "logs_read_all" on public.maintenance_logs for select using (true);
create policy "logs_insert_auth" on public.maintenance_logs for insert to authenticated with check (auth.uid() = performed_by);
create policy "logs_update_own" on public.maintenance_logs for update to authenticated using (auth.uid() = performed_by);
