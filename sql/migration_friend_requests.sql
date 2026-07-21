-- Migration: friend requests
-- Run this ONCE in the Supabase SQL editor on a project that already has
-- schema.sql applied. Safe to run once; re-running will error on the
-- duplicate table/policy (that's fine — it means it's already applied).
--
-- Adds a request/accept flow: adding someone to a circle, or sharing an
-- activity with them individually, now requires an accepted friend request
-- (previously anyone registered could be added with no consent step).

create table friend_requests (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid references profiles(id) on delete cascade,
  addressee_id uuid references profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at timestamptz default now(),
  check (requester_id <> addressee_id)
);

create unique index friend_requests_unique_pair on friend_requests (
  least(requester_id, addressee_id), greatest(requester_id, addressee_id)
);

alter table friend_requests enable row level security;

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

alter publication supabase_realtime add table friend_requests;
