-- Migration: weekly availability calendar + circle membership management
-- Run this ONCE in the Supabase SQL editor on a project that already has
-- schema.sql applied. Safe to run once; re-running errors on the
-- duplicate table/policy (that's fine -- it means it's already applied).
--
-- Supersedes sql/migration_availability.sql from last turn -- if you ran
-- that one, this migration drops its 3 columns and replaces the whole
-- single-status design with a proper weekly table. If you never ran the
-- old one, the "drop column if exists" lines are harmless no-ops.
--
-- Part A: availability_slots -- up to 7 slots per person (one per day of
-- the week, enforced by a unique constraint, not a manual count check),
-- each independently shareable with circles or individual people, exactly
-- like activities. Mirrors that table's RLS shape, including keeping the
-- two "vis_*" child tables open (select all) rather than checking back
-- into availability_slots -- gating both directions is exactly what
-- caused "infinite recursion detected in policy" for activities earlier.
--
-- Part B: circle_members previously had no DELETE policy at all -- this
-- is why membership has been add-only-at-creation up to now, not just a
-- missing UI. Adds owner-can-remove-anyone and leave-your-own-membership.

alter table profiles drop column if exists available_day;
alter table profiles drop column if exists available_time_of_day;
alter table profiles drop column if exists available_until;

create table availability_slots (
  id uuid primary key default gen_random_uuid(),
  person_id uuid references profiles(id) on delete cascade,
  day_of_week text not null check (day_of_week in ('Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday')),
  time_of_day text not null check (time_of_day in ('Morning','Afternoon','Evening','Anytime')),
  created_at timestamptz default now(),
  unique (person_id, day_of_week)
);

create table availability_visibility_circles (
  slot_id uuid references availability_slots(id) on delete cascade,
  circle_id uuid references circles(id) on delete cascade,
  primary key (slot_id, circle_id)
);

create table availability_visibility_people (
  slot_id uuid references availability_slots(id) on delete cascade,
  person_id uuid references profiles(id) on delete cascade,
  primary key (slot_id, person_id)
);

alter table availability_slots enable row level security;
alter table availability_visibility_circles enable row level security;
alter table availability_visibility_people enable row level security;

create policy "availability_slots: select visible" on availability_slots for select to authenticated using (
  person_id = auth.uid()
  or exists (
    select 1 from availability_visibility_people vp
    where vp.slot_id = availability_slots.id and vp.person_id = auth.uid()
  )
  or exists (
    select 1 from availability_visibility_circles vc
    join circle_members cm on cm.circle_id = vc.circle_id
    where vc.slot_id = availability_slots.id and cm.member_id = auth.uid()
  )
);
create policy "availability_slots: insert own" on availability_slots for insert to authenticated with check (auth.uid() = person_id);
create policy "availability_slots: update own" on availability_slots for update to authenticated using (auth.uid() = person_id) with check (auth.uid() = person_id);
create policy "availability_slots: delete own" on availability_slots for delete to authenticated using (auth.uid() = person_id);

create policy "avail_vis_circles: select all" on availability_visibility_circles for select to authenticated using (true);
create policy "avail_vis_circles: insert own slot" on availability_visibility_circles for insert to authenticated with check (
  exists (select 1 from availability_slots s where s.id = slot_id and s.person_id = auth.uid())
);
create policy "avail_vis_circles: delete own slot" on availability_visibility_circles for delete to authenticated using (
  exists (select 1 from availability_slots s where s.id = slot_id and s.person_id = auth.uid())
);

create policy "avail_vis_people: select all" on availability_visibility_people for select to authenticated using (true);
create policy "avail_vis_people: insert own slot" on availability_visibility_people for insert to authenticated with check (
  exists (select 1 from availability_slots s where s.id = slot_id and s.person_id = auth.uid())
);
create policy "avail_vis_people: delete own slot" on availability_visibility_people for delete to authenticated using (
  exists (select 1 from availability_slots s where s.id = slot_id and s.person_id = auth.uid())
);

create policy "circle_members: delete by owner" on circle_members for delete to authenticated using (
  exists (select 1 from circles c where c.id = circle_id and c.owner_id = auth.uid())
);
create policy "circle_members: leave own membership" on circle_members for delete to authenticated using (
  auth.uid() = member_id
);
