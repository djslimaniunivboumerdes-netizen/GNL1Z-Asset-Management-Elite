create table if not exists public.equipment_images (
  id uuid primary key default gen_random_uuid(),
  tag text not null,
  file_path text not null,
  file_name text,
  mime_type text,
  size_bytes integer,
  uploaded_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists equipment_images_tag_idx on public.equipment_images(tag);
alter table public.equipment_images enable row level security;
create policy "images_read_all" on public.equipment_images for select using (true);
create policy "images_insert_auth" on public.equipment_images for insert to authenticated with check (auth.uid() = uploaded_by);
create policy "images_delete_own" on public.equipment_images for delete to authenticated using (auth.uid() = uploaded_by);
