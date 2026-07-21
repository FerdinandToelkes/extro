-- Migration: enforce activity visibility at the database level
-- Run this ONCE in the Supabase SQL editor on a project that already has
-- schema.sql applied. Safe to run once; DROP POLICY will error if a policy
-- was already dropped/renamed (that's fine -- it means it's already applied).
--
-- Previously "activities: select all" (and the matching policy on
-- activity_messages/activity_joins) used `using (true)`, so any signed-in
-- user could read every activity -- including its chat and who'd
-- responded -- directly via the Supabase API, regardless of circle/
-- individual visibility. This replaces those with policies that mirror the
-- isVisibleToMe() check already used in the app (app/page.js), enforced
-- here so it can't be bypassed by calling the API directly.
--
-- Note: activity_visibility_circles/activity_visibility_people stay
-- `select all` -- the policy below checks those two tables to decide
-- whether an activity is visible, so gating their own select the same way
-- would make Postgres reject the whole thing with "infinite recursion
-- detected in policy" (found the hard way -- see
-- sql/migration_fix_visibility_recursion.sql if you already hit that).

drop policy "activities: select all" on activities;
create policy "activities: select visible" on activities for select to authenticated using (
  author_id = auth.uid()
  or exists (
    select 1 from activity_visibility_people vp
    where vp.activity_id = activities.id and vp.person_id = auth.uid()
  )
  or exists (
    select 1 from activity_visibility_circles vc
    join circle_members cm on cm.circle_id = vc.circle_id
    where vc.activity_id = activities.id and cm.member_id = auth.uid()
  )
);

drop policy "joins: select all" on activity_joins;
create policy "joins: select visible activity" on activity_joins for select to authenticated using (
  exists (select 1 from activities a where a.id = activity_joins.activity_id)
);

drop policy "messages: select all" on activity_messages;
create policy "messages: select visible activity" on activity_messages for select to authenticated using (
  exists (select 1 from activities a where a.id = activity_messages.activity_id)
);
