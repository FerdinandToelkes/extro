-- Migration: graduated activity responses (Join / Interested / Maybe)
-- Run this ONCE in the Supabase SQL editor on a project that already has
-- schema.sql applied. Safe to run once; re-running will error on the
-- duplicate column/policy (that's fine — it means it's already applied).
--
-- Replaces the binary "I'm in" toggle with three response levels. Existing
-- rows in activity_joins default to 'joined', preserving today's meaning.

alter table activity_joins add column status text not null default 'joined' check (status in ('joined', 'interested', 'maybe'));

create policy "joins: update own" on activity_joins for update to authenticated using (auth.uid() = person_id) with check (auth.uid() = person_id);
