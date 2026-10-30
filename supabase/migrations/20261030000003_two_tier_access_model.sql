-- ============================================================================
-- 20261030000003_two_tier_access_model.sql
--
-- Purpose : the access model the plant asked for, enforced in the database
--           rather than in the UI:
--
--             ADMINISTRATOR  manages official equipment data and documents:
--                            the test-date register, the engineering document
--                            register and the private document bucket. Only an
--                            administrator approves or closes a maintenance
--                            record, and only an administrator deletes an alert.
--
--             PLANT USER     every other signed-in account (operator,
--                            technician, engineer, any role except auditor)
--                            creates alerts and maintenance/test records, adds
--                            notes and photographs, and reads the drawings.
--
--             AUDITOR        reads; never writes.
--
--           Before this migration, writes were gated on public.can_write(),
--           which let every engineer and technician change official test dates
--           and upload documents, and let no operator raise an alert at all.
--
-- Deploy  : AFTER 20261030000002_storage_buckets_and_policies.sql.
-- Idempotent: yes — every policy is dropped before it is created.
-- No data is modified or deleted.
--
-- ROLLBACK: see the commented block at the end of this file.
-- ============================================================================

begin;

-- ---------------------------------------------------------------------------
-- 1. The plant-user predicate
-- ---------------------------------------------------------------------------
create or replace function public.is_plant_user()
returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  -- Fails closed: an account with no profile row is treated as not a plant user.
  select auth.uid() is not null
     and coalesce((select role_key <> 'auditor' from public.profiles where id = auth.uid()), false)
$$;

comment on function public.is_plant_user() is
  'Signed-in account that may create operational records (anyone but an auditor).';

-- public.can_write() and public.can_approve() remain defined for compatibility
-- but no policy in this schema uses them any more: the model is two-tier now.

-- ---------------------------------------------------------------------------
-- 2. Maintenance approvals belong to the administrator
--
-- The lifecycle itself is unchanged (DRAFT -> SUBMITTED -> REVIEWED ->
-- APPROVED -> CLOSED). Who may take the review, approval, rejection and closure
-- steps changes: those are official decisions, so they are administrator-only.
-- ---------------------------------------------------------------------------
create or replace function public.guard_maintenance_transition()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare
  allowed boolean;
begin
  if new.status = old.status then return new; end if;

  allowed := case
    when old.status = 'IMPORTED'  then new.status in ('SUBMITTED')
    when old.status = 'DRAFT'     then new.status in ('SUBMITTED')
    when old.status = 'SUBMITTED' then new.status in ('REVIEWED','REJECTED')
    when old.status = 'REVIEWED'  then new.status in ('APPROVED','REJECTED','SUBMITTED')
    when old.status = 'REJECTED'  then new.status in ('DRAFT','SUBMITTED')
    when old.status = 'APPROVED'  then new.status in ('CLOSED')
    when old.status = 'CLOSED'    then new.status in ('APPROVED')   -- reopen, review required
    else false
  end;

  if not allowed then
    raise exception 'Maintenance status cannot move from % to %.', old.status, new.status;
  end if;

  -- Review, approval, rejection and closure are administrator decisions.
  if new.status in ('REVIEWED','APPROVED','REJECTED','CLOSED') and not public.is_admin() then
    raise exception 'Only an administrator can review, approve or close a maintenance record.';
  end if;

  -- Nobody approves their own work, administrator or not.
  if new.status in ('REVIEWED','APPROVED') and old.performed_by = auth.uid() then
    raise exception 'You cannot review or approve a record you performed.';
  end if;

  if new.status = 'SUBMITTED' then new.submitted_at := coalesce(new.submitted_at, now()); end if;
  if new.status in ('REVIEWED','APPROVED','REJECTED') then
    new.reviewed_by := auth.uid();
    new.reviewed_at := now();
  end if;
  if new.status = 'CLOSED' then new.closed_at := coalesce(new.closed_at, now()); end if;

  return new;
end $$;

drop trigger if exists guard_maintenance_transition on public.maintenance_logs;
create trigger guard_maintenance_transition
  before update on public.maintenance_logs
  for each row execute function public.guard_maintenance_transition();

-- ---------------------------------------------------------------------------
-- 3. One row per stored object, so the migration can be re-run safely
-- ---------------------------------------------------------------------------
-- Not partial: a partial unique index cannot be used by INSERT ... ON CONFLICT,
-- and the migration script relies on that upsert to be re-runnable.
create unique index if not exists eng_docs_storage_path_key
  on public.engineering_documents (storage_path);

-- ---------------------------------------------------------------------------
-- 4. Alerts — every plant user raises one; the author or an administrator
--    amends it; only an administrator deletes one.
-- ---------------------------------------------------------------------------
drop policy if exists "alerts_insert_staff" on public.alerts;
create policy "alerts_insert_plant" on public.alerts
  for insert to authenticated
  with check (public.is_plant_user() and created_by = auth.uid());

drop policy if exists "alerts_update_staff" on public.alerts;
create policy "alerts_update_author_or_admin" on public.alerts
  for update to authenticated
  using (created_by = auth.uid() or public.is_admin())
  with check (created_by = auth.uid() or public.is_admin());

drop policy if exists "fast_alerts_insert_staff" on public.fast_alerts;
create policy "fast_alerts_insert_plant" on public.fast_alerts
  for insert to authenticated
  with check (public.is_plant_user() and created_by = auth.uid());

drop policy if exists "fast_alerts_update_staff" on public.fast_alerts;
create policy "fast_alerts_update_author_or_admin" on public.fast_alerts
  for update to authenticated
  using (created_by = auth.uid() or public.is_admin())
  with check (created_by = auth.uid() or public.is_admin());

-- ---------------------------------------------------------------------------
-- 5. Maintenance and test records — every plant user records their own work
-- ---------------------------------------------------------------------------
drop policy if exists "logs_insert_own" on public.maintenance_logs;
create policy "logs_insert_own" on public.maintenance_logs
  for insert to authenticated
  with check (
    public.is_plant_user()
    and performed_by = auth.uid()
    and status in ('DRAFT','SUBMITTED')
  );

drop policy if exists "logs_update_own_or_reviewer" on public.maintenance_logs;
create policy "logs_update_own_or_admin" on public.maintenance_logs
  for update to authenticated
  using (performed_by = auth.uid() or public.is_admin())
  with check (performed_by = auth.uid() or public.is_admin());

-- ---------------------------------------------------------------------------
-- 6. Equipment notes — the author's own note
-- ---------------------------------------------------------------------------
drop policy if exists "notes_insert_own" on public.equipment_notes;
create policy "notes_insert_own" on public.equipment_notes
  for insert to authenticated
  with check (public.is_plant_user() and created_by = auth.uid());

drop policy if exists "notes_update_own" on public.equipment_notes;
create policy "notes_update_own" on public.equipment_notes
  for update to authenticated
  using (created_by = auth.uid() or public.is_admin())
  with check (created_by = auth.uid() or public.is_admin());

-- ---------------------------------------------------------------------------
-- 7. Equipment photographs — the uploader's own file
-- ---------------------------------------------------------------------------
drop policy if exists "images_insert_own" on public.equipment_images;
create policy "images_insert_own" on public.equipment_images
  for insert to authenticated
  with check (public.is_plant_user() and uploaded_by = auth.uid());

drop policy if exists "images_delete_own_or_admin" on public.equipment_images;
create policy "images_delete_own_or_admin" on public.equipment_images
  for delete to authenticated
  using (uploaded_by = auth.uid() or public.is_admin());

-- ---------------------------------------------------------------------------
-- 8. The test-date register is official equipment data: administrator only
-- ---------------------------------------------------------------------------
drop policy if exists "test_dates_write_engineering" on public.equipment_test_dates;
create policy "test_dates_write_admin" on public.equipment_test_dates
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- 9. Engineering documents — read by the plant, managed by the administrator
-- ---------------------------------------------------------------------------
drop policy if exists "eng_docs_read_restricted" on public.engineering_documents;
create policy "eng_docs_read_restricted" on public.engineering_documents
  for select to authenticated
  using (classification = 'RESTRICTED' and public.is_plant_user());

drop policy if exists "eng_docs_write_engineering" on public.engineering_documents;
create policy "eng_docs_write_admin" on public.engineering_documents
  for insert to authenticated
  with check (public.is_admin());

drop policy if exists "eng_docs_verify" on public.engineering_documents;
create policy "eng_docs_verify_admin" on public.engineering_documents
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- No DELETE policy exists and DELETE is revoked: a document row is never
-- removed by a client.

-- ---------------------------------------------------------------------------
-- 10. Storage — the same two tiers
-- ---------------------------------------------------------------------------
drop policy if exists "restricted_docs_read" on storage.objects;
create policy "restricted_docs_read" on storage.objects
  for select to authenticated
  using (bucket_id = 'restricted-documents' and public.is_plant_user());

drop policy if exists "restricted_docs_write" on storage.objects;
create policy "restricted_docs_write" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'restricted-documents'
    and public.is_admin()
    and coalesce((metadata->>'size')::bigint, 0) between 1 and 60 * 1024 * 1024
    and coalesce(metadata->>'mimetype', '') in ('application/pdf', 'image/jpeg', 'image/png', 'image/webp')
  );

drop policy if exists "photos_owner_write" on storage.objects;
create policy "photos_owner_write" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'equipment-photos'
    and public.is_plant_user()
    and coalesce((metadata->>'size')::bigint, 0) between 1 and 10 * 1024 * 1024
    and coalesce(metadata->>'mimetype', '') in ('image/jpeg', 'image/png', 'image/webp')
    and (storage.foldername(name))[2] = auth.uid()::text
  );

drop policy if exists "alert_photos_owner_write" on storage.objects;
create policy "alert_photos_owner_write" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'alert-photos'
    and public.is_plant_user()
    and coalesce((metadata->>'size')::bigint, 0) between 1 and 10 * 1024 * 1024
    and coalesce(metadata->>'mimetype', '') in ('image/jpeg', 'image/png', 'image/webp')
  );

drop policy if exists "photos_authenticated_read" on storage.objects;
create policy "photos_authenticated_read" on storage.objects
  for select to authenticated
  using (bucket_id = 'equipment-photos' and public.is_plant_user());

drop policy if exists "alert_photos_authenticated_read" on storage.objects;
create policy "alert_photos_authenticated_read" on storage.objects
  for select to authenticated
  using (bucket_id = 'alert-photos' and public.is_plant_user());

commit;

-- ============================================================================
-- ROLLBACK
--
-- Restores the previous (pre-two-tier) policy set. Nothing here deletes data.
--
-- begin;
--   -- Storage
--   drop policy if exists "alert_photos_authenticated_read" on storage.objects;
--   drop policy if exists "photos_authenticated_read"       on storage.objects;
--   drop policy if exists "alert_photos_owner_write"        on storage.objects;
--   drop policy if exists "photos_owner_write"              on storage.objects;
--   drop policy if exists "restricted_docs_write"           on storage.objects;
--   drop policy if exists "restricted_docs_read"            on storage.objects;
--   create policy "photos_authenticated_read" on storage.objects
--     for select to authenticated using (bucket_id = 'equipment-photos' and auth.role() = 'authenticated');
--   create policy "photos_owner_write" on storage.objects
--     for insert to authenticated with check (
--       bucket_id = 'equipment-photos'
--       and public.can_write()
--       and coalesce((metadata->>'size')::bigint, 0) between 1 and 10 * 1024 * 1024
--       and coalesce(metadata->>'mimetype', '') in ('image/jpeg','image/png','image/webp')
--       and (storage.foldername(name))[2] = auth.uid()::text);
--   create policy "alert_photos_authenticated_read" on storage.objects
--     for select to authenticated using (bucket_id = 'alert-photos' and auth.role() = 'authenticated');
--   create policy "alert_photos_owner_write" on storage.objects
--     for insert to authenticated with check (
--       bucket_id = 'alert-photos'
--       and public.can_write()
--       and coalesce((metadata->>'size')::bigint, 0) between 1 and 10 * 1024 * 1024
--       and coalesce(metadata->>'mimetype', '') in ('image/jpeg','image/png','image/webp'));
--   create policy "restricted_docs_read" on storage.objects
--     for select to authenticated using (bucket_id = 'restricted-documents' and auth.role() = 'authenticated');
--   create policy "restricted_docs_write" on storage.objects
--     for insert to authenticated with check (
--       bucket_id = 'restricted-documents'
--       and public.can_write()
--       and coalesce((metadata->>'size')::bigint, 0) between 1 and 60 * 1024 * 1024
--       and coalesce(metadata->>'mimetype', '') in ('application/pdf','image/jpeg','image/png','image/webp'));
--
--   -- Documents, test dates, notes, images, logs, alerts
--   drop policy if exists "eng_docs_verify_admin"        on public.engineering_documents;
--   drop policy if exists "eng_docs_write_admin"         on public.engineering_documents;
--   drop policy if exists "eng_docs_read_restricted"     on public.engineering_documents;
--   create policy "eng_docs_read_restricted" on public.engineering_documents
--     for select to authenticated
--     using (classification = 'RESTRICTED' and public.can_write() and public.current_role_key() <> 'auditor');
--   create policy "eng_docs_write_engineering" on public.engineering_documents
--     for insert to authenticated with check (public.can_write());
--   create policy "eng_docs_verify" on public.engineering_documents
--     for update to authenticated using (public.can_approve()) with check (public.can_approve());
--
--   drop policy if exists "test_dates_write_admin"       on public.equipment_test_dates;
--   create policy "test_dates_write_engineering" on public.equipment_test_dates
--     for all to authenticated using (public.can_write()) with check (public.can_write());
--
--   drop policy if exists "images_delete_own_or_admin"   on public.equipment_images;
--   drop policy if exists "images_insert_own"            on public.equipment_images;
--   create policy "images_insert_own" on public.equipment_images
--     for insert to authenticated with check (auth.uid() = uploaded_by and public.can_write());
--   create policy "images_delete_own_or_admin" on public.equipment_images
--     for delete to authenticated using (auth.uid() = uploaded_by or public.is_admin());
--
--   drop policy if exists "notes_update_own"             on public.equipment_notes;
--   drop policy if exists "notes_insert_own"             on public.equipment_notes;
--   create policy "notes_insert_own" on public.equipment_notes
--     for insert to authenticated with check (created_by = auth.uid() and public.can_write());
--   create policy "notes_update_own" on public.equipment_notes
--     for update to authenticated
--     using (created_by = auth.uid() or public.is_admin())
--     with check (created_by = auth.uid() or public.is_admin());
--
--   drop policy if exists "logs_update_own_or_admin"     on public.maintenance_logs;
--   drop policy if exists "logs_insert_own"              on public.maintenance_logs;
--   create policy "logs_insert_own" on public.maintenance_logs
--     for insert to authenticated
--     with check (auth.uid() = performed_by and public.can_write() and status in ('DRAFT','SUBMITTED'));
--   create policy "logs_update_own_or_reviewer" on public.maintenance_logs
--     for update to authenticated
--     using (auth.uid() = performed_by or public.can_approve())
--     with check (auth.uid() = performed_by or public.can_approve());
--
--   drop policy if exists "fast_alerts_update_author_or_admin" on public.fast_alerts;
--   drop policy if exists "fast_alerts_insert_plant"           on public.fast_alerts;
--   create policy "fast_alerts_insert_staff" on public.fast_alerts
--     for insert to authenticated with check (public.can_write() and created_by = auth.uid());
--   create policy "fast_alerts_update_staff" on public.fast_alerts
--     for update to authenticated using (public.can_write()) with check (public.can_write());
--
--   drop policy if exists "alerts_update_author_or_admin" on public.alerts;
--   drop policy if exists "alerts_insert_plant"           on public.alerts;
--   create policy "alerts_insert_staff" on public.alerts
--     for insert to authenticated with check (public.can_write() and created_by = auth.uid());
--   create policy "alerts_update_staff" on public.alerts
--     for update to authenticated using (public.can_write()) with check (public.can_write());
--
--   -- The lifecycle trigger reverts to the engineering-role approval rule
--   -- (re-run 20261030000001 to restore public.guard_maintenance_transition).
--   -- The unique index is left in place: it only prevents duplicate rows.
--   -- drop index if exists public.eng_docs_storage_path_key;
-- commit;
-- ============================================================================
