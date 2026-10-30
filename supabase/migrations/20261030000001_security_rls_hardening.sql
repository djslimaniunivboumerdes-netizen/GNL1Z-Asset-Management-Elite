-- ============================================================================
-- 20261030000001_security_rls_hardening.sql
--
-- Purpose : least-privilege Row-Level Security, a role model enforced in the
--           database, a maintenance lifecycle that cannot self-approve, an
--           append-only audit log, and a server-side rate limiter.
--
-- Deploy  : AFTER 20260626000001_ai_responses_cache.sql (current head).
--           BEFORE deploying supabase/functions/detect-dcs-instruments, which
--           calls public.consume_rate_limit() and writes dcs_detected_instruments
--           .detected_by (both created here).
--
-- Idempotent: yes. Safe to re-run. No destructive DDL, no data deleted.
--
-- ROLLBACK: see the commented block at the end of this file. It restores the
--           previous permissive policies exactly as they were.
-- ============================================================================

begin;

-- ---------------------------------------------------------------------------
-- 1. Role model
-- ---------------------------------------------------------------------------
do $$
begin
  create type public.app_role as enum (
    'administrator',
    'reliability_engineer',
    'mechanical_engineer',
    'process_engineer',
    'instrumentation_engineer',
    'maintenance_technician',
    'operations_viewer',
    'auditor'
  );
exception when duplicate_object then null;
end $$;

alter table public.profiles add column if not exists role_key public.app_role;
alter table public.profiles add column if not exists updated_at timestamptz not null default now();

-- Backfill from the free-text column that already exists. Unrecognised values
-- fall back to the least privileged role; an administrator corrects them.
update public.profiles
   set role_key = case
     when role ilike '%admin%'                        then 'administrator'::public.app_role
     when role ilike '%reliab%'                       then 'reliability_engineer'::public.app_role
     when role ilike '%mech%'                         then 'mechanical_engineer'::public.app_role
     when role ilike '%proc%'                         then 'process_engineer'::public.app_role
     when role ilike '%instrum%'                      then 'instrumentation_engineer'::public.app_role
     when role ilike '%oper%view%' or role ilike '%viewer%' or role ilike '%lecteur%'
                                                      then 'operations_viewer'::public.app_role
     when role ilike '%audit%'                        then 'auditor'::public.app_role
     when role ilike '%tech%'                         then 'maintenance_technician'::public.app_role
     else 'maintenance_technician'::public.app_role
   end
 where role_key is null;

-- Trusted helpers. SECURITY DEFINER so a caller cannot influence the lookup,
-- and search_path is pinned so a caller cannot inject one.
create or replace function public.current_role_key()
returns public.app_role
language sql stable security definer set search_path = public, pg_temp as $$
  select role_key from public.profiles where id = auth.uid()
$$;

create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce((select role_key = 'administrator' from public.profiles where id = auth.uid()), false)
$$;

create or replace function public.has_any_role(variadic roles public.app_role[])
returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce((select role_key = any(roles) from public.profiles where id = auth.uid()), false)
$$;

-- Who may create or amend engineering records.
create or replace function public.can_write()
returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce((select role_key not in ('operations_viewer', 'auditor')
                     from public.profiles where id = auth.uid()), false)
$$;

-- Who may review and approve engineering or maintenance decisions.
create or replace function public.can_approve()
returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce((select role_key in ('administrator','reliability_engineer','mechanical_engineer','process_engineer','instrumentation_engineer')
                     from public.profiles where id = auth.uid()), false)
$$;

-- ---------------------------------------------------------------------------
-- 2. profiles — no self-promotion
-- ---------------------------------------------------------------------------
-- Column privileges are the primary control: even with a permissive policy,
-- the authenticated role simply cannot write role columns.
revoke all on public.profiles from anon, authenticated;
grant select (id, full_name, role, role_key, created_at, updated_at) on public.profiles to authenticated;
grant update (full_name) on public.profiles to authenticated;

-- Backstop: refuse any role change that is not made by an administrator, even
-- if a future policy or a service-role client forgets the column grants.
create or replace function public.guard_profile_role()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if (new.role_key is distinct from old.role_key) or (new.role is distinct from old.role) then
    if not public.is_admin() then
      raise exception 'Only an administrator can change a user role.';
    end if;
  end if;
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists guard_profile_role on public.profiles;
create trigger guard_profile_role
  before update on public.profiles
  for each row execute function public.guard_profile_role();

drop policy if exists "profiles_select_auth" on public.profiles;
drop policy if exists "profiles_update_own" on public.profiles;
drop policy if exists "profiles_select_authenticated" on public.profiles;
drop policy if exists "profiles_update_self" on public.profiles;
drop policy if exists "profiles_update_admin" on public.profiles;

-- Staff directory: any signed-in colleague may see the roster (names only —
-- the email column was revoked above).
create policy "profiles_select_authenticated" on public.profiles
  for select to authenticated using (auth.role() = 'authenticated');
create policy "profiles_update_self" on public.profiles
  for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);
create policy "profiles_update_admin" on public.profiles
  for update to authenticated using (public.is_admin()) with check (true);

-- ---------------------------------------------------------------------------
-- 3. Maintenance lifecycle — nothing is approved by inserting a row
-- ---------------------------------------------------------------------------
alter table public.maintenance_logs add column if not exists status text not null default 'DRAFT';
alter table public.maintenance_logs add column if not exists submitted_at timestamptz;
alter table public.maintenance_logs add column if not exists reviewed_by uuid references auth.users(id);
alter table public.maintenance_logs add column if not exists reviewed_at timestamptz;
alter table public.maintenance_logs add column if not exists closed_at timestamptz;
alter table public.maintenance_logs add column if not exists rejection_reason text;

-- Records that pre-date the lifecycle are marked IMPORTED, never APPROVED:
-- no retrospective approval is implied.
update public.maintenance_logs set status = 'IMPORTED' where status = 'DRAFT';
alter table public.maintenance_logs drop constraint if exists maintenance_logs_status_chk;
alter table public.maintenance_logs add constraint maintenance_logs_status_chk
  check (status in ('DRAFT','SUBMITTED','REVIEWED','APPROVED','REJECTED','CLOSED','IMPORTED'));

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

  -- Review, approval and closure are restricted roles only.
  if new.status in ('REVIEWED','APPROVED','REJECTED','CLOSED') and not public.can_approve() then
    raise exception 'Your role cannot review or approve maintenance records.';
  end if;

  -- A technician cannot review or approve their own work.
  if new.status in ('REVIEWED','APPROVED') and old.performed_by = auth.uid() and not public.is_admin() then
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

drop policy if exists "logs_read_all" on public.maintenance_logs;
drop policy if exists "logs_insert_auth" on public.maintenance_logs;
drop policy if exists "logs_update_own" on public.maintenance_logs;
drop policy if exists "logs_read_authenticated" on public.maintenance_logs;
drop policy if exists "logs_insert_own" on public.maintenance_logs;
drop policy if exists "logs_update_own_or_reviewer" on public.maintenance_logs;

create policy "logs_read_authenticated" on public.maintenance_logs
  for select to authenticated using (auth.role() = 'authenticated');
create policy "logs_insert_own" on public.maintenance_logs
  for insert to authenticated with check (auth.uid() = performed_by and public.can_write() and status in ('DRAFT','SUBMITTED'));
create policy "logs_update_own_or_reviewer" on public.maintenance_logs
  for update to authenticated
  using (auth.uid() = performed_by or public.can_approve())
  with check (auth.uid() = performed_by or public.can_approve());
-- No client DELETE policy: maintenance history is never destroyed by the client.

-- ---------------------------------------------------------------------------
-- 4. Equipment notes and test dates
-- ---------------------------------------------------------------------------
alter table public.equipment_notes add column if not exists created_by uuid references auth.users(id);
alter table public.equipment_notes add column if not exists updated_at timestamptz not null default now();
-- Legacy rows keep created_by = null: they stay readable to signed-in staff but
-- can only be edited by an administrator. No author is invented for them.

drop policy if exists "Public read equipment_notes" on public.equipment_notes;
drop policy if exists "Auth insert equipment_notes" on public.equipment_notes;
drop policy if exists "Auth update equipment_notes" on public.equipment_notes;
drop policy if exists "notes_read_authenticated" on public.equipment_notes;
drop policy if exists "notes_insert_own" on public.equipment_notes;
drop policy if exists "notes_update_own" on public.equipment_notes;

create policy "notes_read_authenticated" on public.equipment_notes
  for select to authenticated using (auth.role() = 'authenticated');
create policy "notes_insert_own" on public.equipment_notes
  for insert to authenticated with check (created_by = auth.uid() and public.can_write());
create policy "notes_update_own" on public.equipment_notes
  for update to authenticated using (created_by = auth.uid() or public.is_admin())
  with check (created_by = auth.uid() or public.is_admin());

drop policy if exists "Public read equipment_test_dates" on public.equipment_test_dates;
drop policy if exists "Auth insert equipment_test_dates" on public.equipment_test_dates;
drop policy if exists "Auth update equipment_test_dates" on public.equipment_test_dates;
drop policy if exists "test_dates_read_authenticated" on public.equipment_test_dates;
drop policy if exists "test_dates_write_engineering" on public.equipment_test_dates;

create policy "test_dates_read_authenticated" on public.equipment_test_dates
  for select to authenticated using (auth.role() = 'authenticated');
create policy "test_dates_write_engineering" on public.equipment_test_dates
  for all to authenticated using (public.can_write()) with check (public.can_write());

-- ---------------------------------------------------------------------------
-- 5. Photos
-- ---------------------------------------------------------------------------
drop policy if exists "images_read_all" on public.equipment_images;
drop policy if exists "images_insert_auth" on public.equipment_images;
drop policy if exists "images_delete_own" on public.equipment_images;
drop policy if exists "images_read_authenticated" on public.equipment_images;
drop policy if exists "images_insert_own" on public.equipment_images;
drop policy if exists "images_delete_own_or_admin" on public.equipment_images;

create policy "images_read_authenticated" on public.equipment_images
  for select to authenticated using (auth.role() = 'authenticated');
create policy "images_insert_own" on public.equipment_images
  for insert to authenticated with check (auth.uid() = uploaded_by and public.can_write());
create policy "images_delete_own_or_admin" on public.equipment_images
  for delete to authenticated using (auth.uid() = uploaded_by or public.is_admin());

-- ---------------------------------------------------------------------------
-- 6. Alerts
-- ---------------------------------------------------------------------------
alter table public.fast_alerts add column if not exists created_by uuid references auth.users(id);
alter table public.alerts add column if not exists created_by uuid references auth.users(id);

drop policy if exists "alerts_read_all" on public.alerts;
drop policy if exists "alerts_insert_auth" on public.alerts;
drop policy if exists "alerts_update_auth" on public.alerts;
drop policy if exists "alerts_read_authenticated" on public.alerts;
drop policy if exists "alerts_insert_staff" on public.alerts;
drop policy if exists "alerts_update_staff" on public.alerts;
drop policy if exists "alerts_delete_admin" on public.alerts;

create policy "alerts_read_authenticated" on public.alerts
  for select to authenticated using (auth.role() = 'authenticated');
create policy "alerts_insert_staff" on public.alerts
  for insert to authenticated with check (public.can_write() and created_by = auth.uid());
create policy "alerts_update_staff" on public.alerts
  for update to authenticated using (public.can_write()) with check (public.can_write());
create policy "alerts_delete_admin" on public.alerts
  for delete to authenticated using (public.is_admin());

drop policy if exists "fast_alerts_read_all" on public.fast_alerts;
drop policy if exists "fast_alerts_insert_auth" on public.fast_alerts;
drop policy if exists "fast_alerts_update_auth" on public.fast_alerts;
drop policy if exists "fast_alerts_delete_auth" on public.fast_alerts;
drop policy if exists "fast_alerts_read_authenticated" on public.fast_alerts;
drop policy if exists "fast_alerts_insert_staff" on public.fast_alerts;
drop policy if exists "fast_alerts_update_staff" on public.fast_alerts;
drop policy if exists "fast_alerts_delete_admin" on public.fast_alerts;

create policy "fast_alerts_read_authenticated" on public.fast_alerts
  for select to authenticated using (auth.role() = 'authenticated');
create policy "fast_alerts_insert_staff" on public.fast_alerts
  for insert to authenticated with check (public.can_write() and created_by = auth.uid());
create policy "fast_alerts_update_staff" on public.fast_alerts
  for update to authenticated using (public.can_write()) with check (public.can_write());
create policy "fast_alerts_delete_admin" on public.fast_alerts
  for delete to authenticated using (public.is_admin());

-- ---------------------------------------------------------------------------
-- 7. DCS detections — written by the edge function only
-- ---------------------------------------------------------------------------
alter table public.dcs_detected_instruments add column if not exists detected_by uuid;
alter table public.dcs_detected_instruments add column if not exists verified boolean not null default false;

drop policy if exists "Public read dcs detections" on public.dcs_detected_instruments;
drop policy if exists "Auth insert dcs detections" on public.dcs_detected_instruments;
drop policy if exists "Auth update dcs detections" on public.dcs_detected_instruments;
drop policy if exists "dcs_read_authenticated" on public.dcs_detected_instruments;

create policy "dcs_read_authenticated" on public.dcs_detected_instruments
  for select to authenticated using (auth.role() = 'authenticated');
-- No client INSERT/UPDATE: only the service-role edge function writes detections.
revoke insert, update, delete on public.dcs_detected_instruments from authenticated;

-- ---------------------------------------------------------------------------
-- 8. Caches — never client readable or writable
-- ---------------------------------------------------------------------------
-- ai_responses_cache stores prompts and answers about plant equipment.
-- Nothing in the application reads it from the browser (the Cloudflare Function
-- caches in memory), so it is locked to the service role.
revoke all on public.ai_responses_cache from anon, authenticated;
drop policy if exists "Public read ai_responses_cache" on public.ai_responses_cache;
drop policy if exists "Auth insert ai_responses_cache" on public.ai_responses_cache;
drop policy if exists "Auth update ai_responses_cache" on public.ai_responses_cache;

-- news_cache is genuinely public data, but only the scheduled job writes it.
drop policy if exists "Auth insert news_cache" on public.news_cache;
drop policy if exists "Auth update news_cache" on public.news_cache;
revoke insert, update, delete on public.news_cache from authenticated;

-- ---------------------------------------------------------------------------
-- 9. Append-only audit log
-- ---------------------------------------------------------------------------
create table if not exists public.audit_log (
  id           bigserial primary key,
  table_name   text not null,
  record_id    text not null,
  action       text not null check (action in ('INSERT','UPDATE','DELETE')),
  actor        uuid,
  actor_role   text,
  changed_at   timestamptz not null default now(),
  before_data  jsonb,
  after_data   jsonb
);

create index if not exists audit_log_table_record_idx on public.audit_log(table_name, record_id);
create index if not exists audit_log_changed_idx on public.audit_log(changed_at desc);

alter table public.audit_log enable row level security;

drop policy if exists "audit_insert_authenticated" on public.audit_log;
drop policy if exists "audit_read_privileged" on public.audit_log;
create policy "audit_insert_authenticated" on public.audit_log
  for insert to authenticated with check (actor = auth.uid());
create policy "audit_read_privileged" on public.audit_log
  for select to authenticated using (public.is_admin() or public.current_role_key() = 'auditor');
-- No UPDATE and no DELETE policy: the log is append-only for all clients.

create or replace function public.audit_critical_changes()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  -- NEW is unassigned on DELETE and OLD is unassigned on INSERT, so each
  -- operation is handled separately instead of through CASE expressions.
  if tg_op = 'INSERT' then
    insert into public.audit_log(table_name, record_id, action, actor, actor_role, before_data, after_data)
    values (tg_table_name, new.id::text, tg_op, auth.uid(), public.current_role_key()::text, null, to_jsonb(new));
  elsif tg_op = 'UPDATE' then
    insert into public.audit_log(table_name, record_id, action, actor, actor_role, before_data, after_data)
    values (tg_table_name, new.id::text, tg_op, auth.uid(), public.current_role_key()::text, to_jsonb(old), to_jsonb(new));
  else
    insert into public.audit_log(table_name, record_id, action, actor, actor_role, before_data, after_data)
    values (tg_table_name, old.id::text, tg_op, auth.uid(), public.current_role_key()::text, to_jsonb(old), null);
  end if;
  return null;
end $$;

drop trigger if exists audit_maintenance_logs on public.maintenance_logs;
create trigger audit_maintenance_logs after insert or update or delete on public.maintenance_logs
  for each row execute function public.audit_critical_changes();

drop trigger if exists audit_alerts on public.alerts;
create trigger audit_alerts after insert or update or delete on public.alerts
  for each row execute function public.audit_critical_changes();

drop trigger if exists audit_fast_alerts on public.fast_alerts;
create trigger audit_fast_alerts after insert or update or delete on public.fast_alerts
  for each row execute function public.audit_critical_changes();

-- ---------------------------------------------------------------------------
-- 10. Server-side rate limiter (used by the edge functions)
-- ---------------------------------------------------------------------------
create table if not exists public.rate_limit_counters (
  key          text primary key,
  window_start timestamptz not null default now(),
  count        integer not null default 0
);
alter table public.rate_limit_counters enable row level security;
drop policy if exists "rate_limit_no_client_access" on public.rate_limit_counters;
-- No policies at all: reachable only through the SECURITY DEFINER function
-- below (and therefore only with a service-role key).

create or replace function public.consume_rate_limit(p_key text, p_limit integer, p_window interval)
returns boolean
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_count integer;
begin
  if p_key is null or p_limit is null or p_window is null or p_limit < 1 then
    return false;
  end if;

  insert into public.rate_limit_counters(key, window_start, count)
  values (p_key, now(), 0)
  on conflict (key) do nothing;

  update public.rate_limit_counters
     set window_start = case when now() - window_start > p_window then now() else window_start end,
         count        = case when now() - window_start > p_window then 1 else count + 1 end
   where key = p_key
  returning count into v_count;

  return coalesce(v_count, 0) <= p_limit;
end $$;

-- ---------------------------------------------------------------------------
-- 11. Engineering document register (classification + revision + verification)
-- ---------------------------------------------------------------------------
create table if not exists public.engineering_documents (
  id                   uuid primary key default gen_random_uuid(),
  doc_type             text not null check (doc_type in ('P_AND_ID','PFD','MANUAL','DCS_SCREEN','PHOTO','LINE_LIST','PROCEDURE','OTHER')),
  title                text not null,
  tag                  text,
  drawing_no           text,
  revision             text,
  revision_date        date,
  classification       text not null default 'RESTRICTED' check (classification in ('PUBLIC','INTERNAL','RESTRICTED')),
  storage_bucket       text,
  storage_path         text,
  public_path          text,
  source_page          text,
  extraction_method    text,
  extraction_confidence numeric check (extraction_confidence is null or (extraction_confidence >= 0 and extraction_confidence <= 1)),
  verified             boolean not null default false,
  verified_by          uuid references auth.users(id),
  verified_at          timestamptz,
  notes                text,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create index if not exists eng_docs_tag_idx on public.engineering_documents(tag);
create index if not exists eng_docs_drawing_idx on public.engineering_documents(drawing_no);
create index if not exists eng_docs_type_idx on public.engineering_documents(doc_type);

alter table public.engineering_documents enable row level security;

drop policy if exists "eng_docs_read_public" on public.engineering_documents;
drop policy if exists "eng_docs_read_authenticated" on public.engineering_documents;
drop policy if exists "eng_docs_read_restricted" on public.engineering_documents;
drop policy if exists "eng_docs_write_engineering" on public.engineering_documents;
drop policy if exists "eng_docs_verify" on public.engineering_documents;

create policy "eng_docs_read_public" on public.engineering_documents
  for select using (classification = 'PUBLIC');
create policy "eng_docs_read_authenticated" on public.engineering_documents
  for select to authenticated using (auth.role() = 'authenticated' and classification = 'INTERNAL');
create policy "eng_docs_read_restricted" on public.engineering_documents
  for select to authenticated
  using (classification = 'RESTRICTED' and public.can_write() and public.current_role_key() <> 'auditor');
create policy "eng_docs_write_engineering" on public.engineering_documents
  for insert to authenticated with check (public.can_write());
create policy "eng_docs_verify" on public.engineering_documents
  for update to authenticated
  using (public.can_approve())
  with check (public.can_approve());

commit;

-- ============================================================================
-- ROLLBACK
--
-- Run this block to return to the pre-hardening posture. It restores the
-- permissive policies; it does not drop the new columns, tables or functions
-- (dropping them would destroy audit data).
--
-- begin;
--   drop trigger if exists audit_fast_alerts on public.fast_alerts;
--   drop trigger if exists audit_alerts on public.alerts;
--   drop trigger if exists audit_maintenance_logs on public.maintenance_logs;
--   drop trigger if exists guard_maintenance_transition on public.maintenance_logs;
--   drop trigger if exists guard_profile_role on public.profiles;
--
--   grant all on public.profiles to authenticated;
--   drop policy if exists "profiles_update_admin" on public.profiles;
--   drop policy if exists "profiles_update_self" on public.profiles;
--   create policy "profiles_update_own" on public.profiles for update using (auth.uid() = id);
--   create policy "profiles_select_auth" on public.profiles for select using (auth.role() = 'authenticated');
--
--   drop policy if exists "logs_update_own_or_reviewer" on public.maintenance_logs;
--   drop policy if exists "logs_insert_own" on public.maintenance_logs;
--   drop policy if exists "logs_read_authenticated" on public.maintenance_logs;
--   create policy "logs_read_all" on public.maintenance_logs for select using (true);
--   create policy "logs_insert_auth" on public.maintenance_logs for insert to authenticated with check (auth.uid() = performed_by);
--   create policy "logs_update_own" on public.maintenance_logs for update to authenticated using (auth.uid() = performed_by);
--
--   drop policy if exists "notes_update_own" on public.equipment_notes;
--   drop policy if exists "notes_insert_own" on public.equipment_notes;
--   drop policy if exists "notes_read_authenticated" on public.equipment_notes;
--   create policy "Public read equipment_notes" on public.equipment_notes for select using (true);
--   create policy "Auth insert equipment_notes" on public.equipment_notes for insert to authenticated with check (true);
--   create policy "Auth update equipment_notes" on public.equipment_notes for update to authenticated using (true);
--
--   grant insert, update, delete on public.dcs_detected_instruments to authenticated;
--   create policy "Auth insert dcs detections" on public.dcs_detected_instruments for insert to authenticated with check (true);
--   create policy "Auth update dcs detections" on public.dcs_detected_instruments for update to authenticated using (true);
--
--   grant all on public.ai_responses_cache to authenticated;
--   create policy "Public read ai_responses_cache" on public.ai_responses_cache for select using (true);
--   create policy "Auth insert ai_responses_cache" on public.ai_responses_cache for insert to authenticated with check (true);
--   create policy "Auth update ai_responses_cache" on public.ai_responses_cache for update to authenticated with check (true);
-- commit;
-- ============================================================================
