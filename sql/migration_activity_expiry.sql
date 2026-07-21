-- Migration: self-expiring activities
-- Run this ONCE in the Supabase SQL editor on a project that already has
-- schema.sql applied. Safe to run once; re-running will error on the
-- duplicate column/job (that's fine — it means it's already applied).
--
-- Activities now auto-delete a configurable number of days after the event
-- (default 1). expires_at is computed and set by the app at create/edit
-- time; this migration just adds the columns and the cleanup job.

alter table activities add column expire_after_days integer not null default 1 check (expire_after_days >= 0);
alter table activities add column expires_at timestamptz;

-- If this next line errors with a permissions message, enable "pg_cron"
-- first under Database -> Extensions in the Supabase dashboard, then re-run
-- just the two statements below.
create extension if not exists pg_cron;

select cron.schedule(
  'delete-expired-activities',
  '0 * * * *',
  $$ delete from public.activities where expires_at is not null and expires_at <= now(); $$
);
