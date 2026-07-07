insert into storage.buckets (id, name, public) values ('equipment-photos', 'equipment-photos', true)
on conflict (id) do nothing;
create policy "photos_public_read" on storage.objects for select using (bucket_id = 'equipment-photos');
create policy "photos_auth_upload" on storage.objects for insert to authenticated with check (bucket_id = 'equipment-photos');
create policy "photos_owner_delete" on storage.objects for delete to authenticated using (bucket_id = 'equipment-photos' and owner = auth.uid());
