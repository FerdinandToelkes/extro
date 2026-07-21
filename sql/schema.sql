-- Extro: Activities feed — Database schema for Supabase
-- Copy this into the SQL editor in Supabase to create the database schema.

create extension if not exists "pgcrypto";

-- Profile (one row per registered user)
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null default 'Unknown',
  avatar_initials text,
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
  insert into public.profiles (id, name, avatar_initials)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    upper(left(coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)), 2))
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

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

create policy "activities: select all" on activities for select to authenticated using (true);
create policy "activities: insert own" on activities for insert to authenticated with check (auth.uid() = author_id);
create policy "activities: update own" on activities for update to authenticated using (auth.uid() = author_id) with check (auth.uid() = author_id);
create policy "activities: delete own" on activities for delete to authenticated using (auth.uid() = author_id);

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

create policy "joins: select all" on activity_joins for select to authenticated using (true);
create policy "joins: insert own" on activity_joins for insert to authenticated with check (auth.uid() = person_id);
create policy "joins: delete own" on activity_joins for delete to authenticated using (auth.uid() = person_id);

create policy "messages: select all" on activity_messages for select to authenticated using (true);
create policy "messages: insert own" on activity_messages for insert to authenticated with check (auth.uid() = author_id);
