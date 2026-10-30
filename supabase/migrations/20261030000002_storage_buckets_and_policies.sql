-- ============================================================================
-- 20261030000002_storage_buckets_and_policies.sql
--
-- Purpose : make every storage bucket explicit (they were created by hand in
--           the dashboard, so they existed only in one project's state),
--           enforce file size and MIME limits at the bucket level, restrict
--           writes, and add the private bucket for classified plant documents.
--
-- Deploy  : AFTER 20261030000001_security_rls_hardening.sql (uses public.can_write).
--
-- Idempotent: yes (insert ... on conflict do update; drop policy if exists).
-- No objects are deleted.
--
-- NOTE ON equipment-images: it stays public-read in this migration because the
-- DCS panel pages reference it through static public URLs (src/data/dcs_panels.ts).
-- Making it private requires that call site to move to signed URLs first; see
-- docs/SECURITY.md — "Accepted risk R-02: public DCS panel images".
-- ============================================================================

begin;

-- ---------------------------------------------------------------------------
-- 1. Buckets
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'equipment-photos',
  'equipment-photos',
  false,                       -- private: plant photographs, served by signed URL
  10 * 1024 * 1024,            -- 10 MB
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'equipment-images',
  'equipment-images',
  true,                        -- public today; see the note above (risk R-02)
  25 * 1024 * 1024,
  array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
on conflict (id) do update
  set file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Classified plant documents: P&IDs, PFDs, manuals, procedures.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'restricted-documents',
  'restricted-documents',
  false,
  60 * 1024 * 1024,
  array['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'alert-photos',
  'alert-photos',
  false,                       -- private: incident photographs
  10 * 1024 * 1024,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- ---------------------------------------------------------------------------
-- 2. equipment-photos — private, owner-scoped writes
-- ---------------------------------------------------------------------------
drop policy if exists "photos_public_read" on storage.objects;
drop policy if exists "photos_auth_upload" on storage.objects;
drop policy if exists "photos_owner_delete" on storage.objects;
drop policy if exists "photos_authenticated_read" on storage.objects;
drop policy if exists "photos_owner_write" on storage.objects;

-- Signed-in staff may read; anonymous visitors may not.
create policy "photos_authenticated_read" on storage.objects
  for select to authenticated
  using (bucket_id = 'equipment-photos' and auth.role() = 'authenticated');

-- New uploads are written under <tag>/<user_id>/<file>, so the path itself
-- proves ownership. Size and type are constrained here as well as on the bucket.
create policy "photos_owner_write" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'equipment-photos'
    and public.can_write()
    and coalesce((metadata->>'size')::bigint, 0) between 1 and 10 * 1024 * 1024
    and coalesce(metadata->>'mimetype', '') in ('image/jpeg', 'image/png', 'image/webp')
    and (storage.foldername(name))[2] = auth.uid()::text
  );

create policy "photos_owner_delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'equipment-photos' and (owner = auth.uid() or public.is_admin()));

-- ---------------------------------------------------------------------------
-- 3. equipment-images — public read today, writes locked down
-- ---------------------------------------------------------------------------
drop policy if exists "equipment_images_public_read" on storage.objects;
drop policy if exists "equipment_images_admin_write" on storage.objects;

create policy "equipment_images_public_read" on storage.objects
  for select using (bucket_id = 'equipment-images');

-- Only administrators may change the shared image library.
create policy "equipment_images_admin_write" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'equipment-images' and public.is_admin());
create policy "equipment_images_admin_update" on storage.objects
  for update to authenticated
  using (bucket_id = 'equipment-images' and public.is_admin())
  with check (bucket_id = 'equipment-images' and public.is_admin());
create policy "equipment_images_admin_delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'equipment-images' and public.is_admin());

-- ---------------------------------------------------------------------------
-- 3b. alert-photos — private, owner-scoped
-- ---------------------------------------------------------------------------
drop policy if exists "alert_photos_authenticated_read" on storage.objects;
drop policy if exists "alert_photos_owner_write" on storage.objects;
drop policy if exists "alert_photos_admin_delete" on storage.objects;

create policy "alert_photos_authenticated_read" on storage.objects
  for select to authenticated
  using (bucket_id = 'alert-photos' and auth.role() = 'authenticated');

create policy "alert_photos_owner_write" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'alert-photos'
    and public.can_write()
    and coalesce((metadata->>'size')::bigint, 0) between 1 and 10 * 1024 * 1024
    and coalesce(metadata->>'mimetype', '') in ('image/jpeg', 'image/png', 'image/webp')
  );

create policy "alert_photos_admin_delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'alert-photos' and public.is_admin());

-- ---------------------------------------------------------------------------
-- 4. restricted-documents — signed-URL only, never anonymous
-- ---------------------------------------------------------------------------
drop policy if exists "restricted_docs_read" on storage.objects;
drop policy if exists "restricted_docs_write" on storage.objects;
drop policy if exists "restricted_docs_delete" on storage.objects;

create policy "restricted_docs_read" on storage.objects
  for select to authenticated
  using (bucket_id = 'restricted-documents' and auth.role() = 'authenticated');

create policy "restricted_docs_write" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'restricted-documents'
    and public.can_write()
    and coalesce((metadata->>'size')::bigint, 0) between 1 and 60 * 1024 * 1024
    and coalesce(metadata->>'mimetype', '') in ('application/pdf', 'image/jpeg', 'image/png', 'image/webp')
  );

create policy "restricted_docs_delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'restricted-documents' and public.is_admin());

commit;

-- ============================================================================
-- ROLLBACK
--
-- begin;
--   drop policy if exists "alert_photos_admin_delete" on storage.objects;
--   drop policy if exists "alert_photos_owner_write" on storage.objects;
--   drop policy if exists "alert_photos_authenticated_read" on storage.objects;
--   drop policy if exists "restricted_docs_delete" on storage.objects;
--   drop policy if exists "restricted_docs_write"   on storage.objects;
--   drop policy if exists "restricted_docs_read"    on storage.objects;
--   drop policy if exists "equipment_images_admin_delete" on storage.objects;
--   drop policy if exists "equipment_images_admin_update" on storage.objects;
--   drop policy if exists "equipment_images_admin_write"  on storage.objects;
--   drop policy if exists "equipment_images_public_read"  on storage.objects;
--   drop policy if exists "photos_owner_delete"     on storage.objects;
--   drop policy if exists "photos_owner_write"      on storage.objects;
--   drop policy if exists "photos_authenticated_read" on storage.objects;
--   create policy "photos_public_read"  on storage.objects for select using (bucket_id = 'equipment-photos');
--   create policy "photos_auth_upload"  on storage.objects for insert to authenticated with check (bucket_id = 'equipment-photos');
--   create policy "photos_owner_delete" on storage.objects for delete to authenticated using (bucket_id = 'equipment-photos' and owner = auth.uid());
--   -- Buckets are left in place on purpose: dropping a bucket deletes its objects.
-- commit;
-- ============================================================================
