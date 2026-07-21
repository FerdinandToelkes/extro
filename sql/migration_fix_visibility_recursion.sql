-- Hotfix: undo the circular RLS policy from migration_visibility_rls.sql
-- Run this ONCE, right now, if you already ran migration_visibility_rls.sql
-- and are stuck on a loading screen / seeing "infinite recursion detected
-- in policy for relation activities" errors.
--
-- What happened: "activities: select visible" checks
-- activity_visibility_circles/activity_visibility_people to decide if an
-- activity is visible to you. migration_visibility_rls.sql *also* gated
-- those two tables' own select policies on "does a visible activity exist"
-- -- which checks activities again -- creating a cycle Postgres refuses to
-- evaluate. This just reverts those two select policies back to `select
-- all` (their original, safe state); "activities", "activity_messages",
-- and "activity_joins" stay properly locked down, since none of those
-- three participate in the cycle.

drop policy if exists "vis_circles: select visible activity" on activity_visibility_circles;
create policy "vis_circles: select all" on activity_visibility_circles for select to authenticated using (true);

drop policy if exists "vis_people: select visible activity" on activity_visibility_people;
create policy "vis_people: select all" on activity_visibility_people for select to authenticated using (true);
