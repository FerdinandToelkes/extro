-- Migration: edit/delete own activities + optional location sharing
-- Run this ONCE in the Supabase SQL editor on a project that already has the
-- original schema.sql applied. Safe to run once; re-running will error on the
-- duplicate column / policies (that's fine — it means it's already applied).

-- 1. Optional approximate location on activities
alter table activities add column if not exists location text;

-- 2. Allow authors to update and delete their own activities
create policy "activities: update own" on activities
  for update to authenticated
  using (auth.uid() = author_id)
  with check (auth.uid() = author_id);

create policy "activities: delete own" on activities
  for delete to authenticated
  using (auth.uid() = author_id);

-- 3. Allow authors to clear/replace an activity's visibility rows when editing
create policy "vis_circles: delete own activity" on activity_visibility_circles
  for delete to authenticated
  using (
    exists (select 1 from activities a where a.id = activity_id and a.author_id = auth.uid())
  );

create policy "vis_people: delete own activity" on activity_visibility_people
  for delete to authenticated
  using (
    exists (select 1 from activities a where a.id = activity_id and a.author_id = auth.uid())
  );
