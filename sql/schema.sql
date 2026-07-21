-- Extro: Activities feed — Database schema for Supabase
-- Copy this into the SQL editor in Supabase to create the database schema.

create extension if not exists "pgcrypto";

-- Profile (one row per registered user)
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null default 'Unknown',
  avatar_initials text,
  -- Optional, free text. City doubles as a feed filter ("same city as me");
  -- bio is just a short display tagline, not used anywhere else yet.
  city text,
  bio text,
  -- Unique, lowercase handle -- required at signup going forward, the only
  -- way to find someone to friend (no directory browsing). NULL is allowed
  -- for accounts that predate this column.
  username text unique check (username ~ '^[a-z0-9_]{3,20}$'),
  created_at timestamptz default now()
);

-- Friend Circles
create table circles (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references profiles(id) on delete cascade,
  name text not null,
  created_at timestamptz default now()
);

create table circle_members (
  circle_id uuid references circles(id) on delete cascade,
  member_id uuid references profiles(id) on delete cascade,
  primary key (circle_id, member_id)
);

-- Friend requests (pending -> accepted; decline/cancel/unfriend just delete the row)
create table friend_requests (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid references profiles(id) on delete cascade,
  addressee_id uuid references profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at timestamptz default now(),
  check (requester_id <> addressee_id)
);

-- One relationship row per pair regardless of who requested whom
create unique index friend_requests_unique_pair on friend_requests (
  least(requester_id, addressee_id), greatest(requester_id, addressee_id)
);

-- Activities
create table activities (
  id uuid primary key default gen_random_uuid(),
  author_id uuid references profiles(id) on delete cascade,
  text text not null,
  category text not null,
  timeframe text not null,
  location text,
  -- Optional free-browsing tags, separate from `category` -- purely for
  -- discovery/filtering, not used by overlap detection or merge matching.
  tags text[] not null default '{}',
  -- Optional exact event moment (advanced setting) -- when set, overrides
  -- the fuzzy When-chip-based midnight calculation for expiry purposes.
  -- The When chip itself is unaffected and still drives display/matching.
  event_at timestamptz,
  -- How many hours after the event this activity auto-deletes (see the
  -- cron job below); expires_at is computed client-side at create/edit time.
  expire_after_hours integer not null default 24 check (expire_after_hours >= 0),
  expires_at timestamptz,
  created_at timestamptz default now()
);

create table activity_visibility_circles (
  activity_id uuid references activities(id) on delete cascade,
  circle_id uuid references circles(id) on delete cascade,
  primary key (activity_id, circle_id)
);

create table activity_visibility_people (
  activity_id uuid references activities(id) on delete cascade,
  person_id uuid references profiles(id) on delete cascade,
  primary key (activity_id, person_id)
);

create table activity_joins (
  activity_id uuid references activities(id) on delete cascade,
  person_id uuid references profiles(id) on delete cascade,
  status text not null default 'joined' check (status in ('joined', 'interested', 'maybe')),
  joined_at timestamptz default now(),
  primary key (activity_id, person_id)
);

create table activity_messages (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid references activities(id) on delete cascade,
  author_id uuid references profiles(id) on delete cascade,
  text text not null,
  created_at timestamptz default now()
);

-- Create profile automatically when someone registers (Magic-Link-Login)
create function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, name, avatar_initials, username)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    upper(left(coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)), 2)),
    nullif(lower(new.raw_user_meta_data->>'username'), '')
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Lets an unauthenticated signup form (and the profile-edit form) check
-- whether a username is free before submitting. Returns only a boolean --
-- never exposes any profile data. security definer so it can run for the
-- anon role (no session exists yet during signup).
create function public.is_username_available(p_username text, p_exclude_id uuid default null)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select not exists (
    select 1 from profiles
    where username = lower(p_username)
      and (p_exclude_id is null or id <> p_exclude_id)
  );
$$;

grant execute on function public.is_username_available(text, uuid) to anon, authenticated;

-- Returns a friend's accepted friends -- but only if the caller is
-- themselves an accepted friend of that person (or it's their own id).
-- This intentionally does NOT extend "friend_requests: select own" to
-- cover this case, because that policy would need to query
-- friend_requests from within its own select policy to decide -- the
-- exact self-referential shape that causes "infinite recursion detected
-- in policy" (a table's RLS policy querying that same table triggers the
-- policy again, recursively; Postgres detects the cycle and refuses,
-- regardless of whether it's one table referencing itself or several
-- tables referencing each other). Keeping this as a separate, narrowly
-- scoped security-definer function avoids touching that policy at all.
create function public.list_friends_of(p_target_id uuid)
returns table (id uuid, name text, avatar_initials text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller uuid := auth.uid();
  v_authorized boolean;
begin
  if v_caller is null then
    raise exception 'not authenticated';
  end if;

  if v_caller = p_target_id then
    v_authorized := true;
  else
    select exists (
      select 1 from friend_requests
      where status = 'accepted'
        and ((requester_id = v_caller and addressee_id = p_target_id)
          or (requester_id = p_target_id and addressee_id = v_caller))
    ) into v_authorized;
  end if;

  if not v_authorized then
    return;
  end if;

  return query
    select p.id, p.name, p.avatar_initials
    from profiles p
    where p.id in (
      select case when fr.requester_id = p_target_id then fr.addressee_id else fr.requester_id end
      from friend_requests fr
      where fr.status = 'accepted'
        and (fr.requester_id = p_target_id or fr.addressee_id = p_target_id)
    );
end;
$$;

grant execute on function public.list_friends_of(uuid) to authenticated;

-- Merge overlapping activities from different authors into one, carrying
-- over everyone's existing responses. Runs as security definer because the
-- caller only owns one side of the merge but the merge must delete BOTH
-- source rows, including the other author's — plain RLS ("activities:
-- delete own") would block that from a normal client call.
create function public.merge_activities(
  p_source_ids uuid[],
  p_text text,
  p_category text,
  p_timeframe text,
  p_location text,
  p_expire_after_hours integer,
  p_expires_at timestamptz,
  p_circle_ids uuid[],
  p_people_ids uuid[],
  p_tags text[]
)
returns activities
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller uuid := auth.uid();
  v_distinct_signatures integer;
  v_is_participant boolean;
  v_new activities;
begin
  if v_caller is null then
    raise exception 'not authenticated';
  end if;

  select count(distinct (category, timeframe)) into v_distinct_signatures
  from activities where id = any(p_source_ids);
  if v_distinct_signatures <> 1 then
    raise exception 'source activities must share the same category and timeframe';
  end if;

  select exists (
    select 1 from activities where id = any(p_source_ids) and author_id = v_caller
    union
    select 1 from activity_joins where activity_id = any(p_source_ids) and person_id = v_caller
  ) into v_is_participant;
  if not v_is_participant then
    raise exception 'not a participant in any source activity';
  end if;

  insert into activities (author_id, text, category, timeframe, location, expire_after_hours, expires_at, tags)
  values (v_caller, p_text, p_category, p_timeframe, p_location, p_expire_after_hours, p_expires_at, p_tags)
  returning * into v_new;

  insert into activity_visibility_circles (activity_id, circle_id)
  select v_new.id, c from unnest(p_circle_ids) as c;

  insert into activity_visibility_people (activity_id, person_id)
  select v_new.id, p from unnest(p_people_ids) as p;

  -- the merger is always joined on the resulting activity
  insert into activity_joins (activity_id, person_id, status)
  values (v_new.id, v_caller, 'joined');

  -- carry over everyone else's strongest response across the sources
  insert into activity_joins (activity_id, person_id, status)
  select v_new.id, ranked.person_id, ranked.status
  from (
    select person_id, status,
           row_number() over (
             partition by person_id
             order by case status when 'joined' then 3 when 'interested' then 2 else 1 end desc
           ) as rn
    from activity_joins
    where activity_id = any(p_source_ids)
  ) ranked
  where rn = 1
  on conflict (activity_id, person_id) do nothing;

  delete from activities where id = any(p_source_ids);

  return v_new;
end;
$$;

grant execute on function public.merge_activities(
  uuid[], text, text, text, text, integer, timestamptz, uuid[], uuid[], text[]
) to authenticated;

-- Enable realtime for live updates
alter publication supabase_realtime add table activities, activity_joins, activity_messages, friend_requests;

-- Row Level Security
alter table profiles enable row level security;
alter table circles enable row level security;
alter table circle_members enable row level security;
alter table friend_requests enable row level security;
alter table activities enable row level security;
alter table activity_visibility_circles enable row level security;
alter table activity_visibility_people enable row level security;
alter table activity_joins enable row level security;
alter table activity_messages enable row level security;

-- MVP Policy: All registered users (i.e., only your invited friends,
-- since only those who have the link and access to the email can sign up) may
-- read everything, but can only create, edit, or delete their own posts.
-- This should be refined for a later, broader rollout.

create policy "profiles: select all" on profiles for select to authenticated using (true);
create policy "profiles: update own" on profiles for update to authenticated using (auth.uid() = id);

create policy "circles: select all" on circles for select to authenticated using (true);
create policy "circles: insert own" on circles for insert to authenticated with check (auth.uid() = owner_id);

create policy "circle_members: select all" on circle_members for select to authenticated using (true);
create policy "circle_members: insert own circle" on circle_members for insert to authenticated with check (
  exists (select 1 from circles c where c.id = circle_id and c.owner_id = auth.uid())
);

create policy "friend_requests: select own" on friend_requests for select to authenticated using (
  auth.uid() = requester_id or auth.uid() = addressee_id
);
create policy "friend_requests: insert own" on friend_requests for insert to authenticated with check (
  auth.uid() = requester_id
);
create policy "friend_requests: update as addressee" on friend_requests for update to authenticated using (
  auth.uid() = addressee_id
) with check (
  auth.uid() = addressee_id
);
create policy "friend_requests: delete own" on friend_requests for delete to authenticated using (
  auth.uid() = requester_id or auth.uid() = addressee_id
);

-- Visible only to the author, individually-shared people, or members of a
-- shared circle -- mirrors isVisibleToMe() in app/page.js, but enforced
-- here so it can't be bypassed by calling the API directly.
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
create policy "activities: insert own" on activities for insert to authenticated with check (auth.uid() = author_id);
create policy "activities: update own" on activities for update to authenticated using (auth.uid() = author_id) with check (auth.uid() = author_id);
create policy "activities: delete own" on activities for delete to authenticated using (auth.uid() = author_id);

-- select stays open on these two: "activities: select visible" itself
-- checks these tables to decide if an activity is visible, so gating
-- their select the same way would create a circular RLS dependency
-- (Postgres errors with "infinite recursion detected in policy"). Reading
-- a bare activity_id/circle_id or activity_id/person_id pairing here,
-- without being able to read the corresponding activity's actual content
-- (which activities' own policy above already locks down), is a much
-- smaller leak than the original activities: select all was.
create policy "vis_circles: select all" on activity_visibility_circles for select to authenticated using (true);
create policy "vis_circles: insert own activity" on activity_visibility_circles for insert to authenticated with check (
  exists (select 1 from activities a where a.id = activity_id and a.author_id = auth.uid())
);
create policy "vis_circles: delete own activity" on activity_visibility_circles for delete to authenticated using (
  exists (select 1 from activities a where a.id = activity_id and a.author_id = auth.uid())
);

create policy "vis_people: select all" on activity_visibility_people for select to authenticated using (true);
create policy "vis_people: insert own activity" on activity_visibility_people for insert to authenticated with check (
  exists (select 1 from activities a where a.id = activity_id and a.author_id = auth.uid())
);
create policy "vis_people: delete own activity" on activity_visibility_people for delete to authenticated using (
  exists (select 1 from activities a where a.id = activity_id and a.author_id = auth.uid())
);

create policy "joins: select visible activity" on activity_joins for select to authenticated using (
  exists (select 1 from activities a where a.id = activity_joins.activity_id)
);
create policy "joins: insert own" on activity_joins for insert to authenticated with check (auth.uid() = person_id);
create policy "joins: update own" on activity_joins for update to authenticated using (auth.uid() = person_id) with check (auth.uid() = person_id);
create policy "joins: delete own" on activity_joins for delete to authenticated using (auth.uid() = person_id);

create policy "messages: select visible activity" on activity_messages for select to authenticated using (
  exists (select 1 from activities a where a.id = activity_messages.activity_id)
);
create policy "messages: insert own" on activity_messages for insert to authenticated with check (auth.uid() = author_id);

-- Self-expiring activities: an hourly job permanently deletes activities
-- past their expiry (joins/messages/visibility rows cascade automatically).
-- If this errors with a permissions message, enable "pg_cron" first under
-- Database -> Extensions in the Supabase dashboard, then re-run just this
-- block.
create extension if not exists pg_cron;

select cron.schedule(
  'delete-expired-activities',
  '0 * * * *',
  $$ delete from public.activities where expires_at is not null and expires_at <= now(); $$
);
