-- Migration: bug fixes found in a full code review
-- Run this ONCE in the Supabase SQL editor on a project that already has
-- schema.sql applied. Safe to run once; re-running will error on the
-- duplicate policy/function (that's fine — it means it's already applied).

-- 1. Tighten overly-permissive insert policies.
-- The original schema let any signed-in user insert circle_members rows for
-- ANY circle, and activity_visibility_circles / activity_visibility_people
-- rows for ANY activity — not just their own. In practice that means anyone
-- could add themselves to a friend circle they weren't invited to, or grant
-- themselves visibility into a private activity, by calling the Supabase
-- API directly (bypassing the app's UI). This restricts inserts to the
-- circle owner / activity author, matching the existing delete policies.

drop policy if exists "circle_members: insert" on circle_members;
create policy "circle_members: insert own circle" on circle_members for insert to authenticated with check (
  exists (select 1 from circles c where c.id = circle_id and c.owner_id = auth.uid())
);

drop policy if exists "vis_circles: insert" on activity_visibility_circles;
create policy "vis_circles: insert own activity" on activity_visibility_circles for insert to authenticated with check (
  exists (select 1 from activities a where a.id = activity_id and a.author_id = auth.uid())
);

drop policy if exists "vis_people: insert" on activity_visibility_people;
create policy "vis_people: insert own activity" on activity_visibility_people for insert to authenticated with check (
  exists (select 1 from activities a where a.id = activity_id and a.author_id = auth.uid())
);

-- 2. Fix the avatar-initials fallback to use the email's local part (before
-- the @), matching the fallback already used for `name`, instead of the full
-- email address. Previously, a user who signs up without a display name and
-- has a 1-character email local part (e.g. "a@example.com") would get an
-- "@" baked into their avatar initials.
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, name, avatar_initials)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    upper(left(coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)), 2))
  );
  return new;
end;
$$ language plpgsql security definer;
