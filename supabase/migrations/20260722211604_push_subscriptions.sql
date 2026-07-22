-- Web Push device subscriptions. One row per browser/device a user enables
-- push on. The send route (Vercel) reads these with the service-role key to
-- deliver pushes; users can only see/manage their own rows.
create table push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade,
  endpoint text unique not null,
  subscription jsonb not null,
  created_at timestamptz default now()
);

alter table push_subscriptions enable row level security;

create policy "push_subs: select own" on push_subscriptions for select to authenticated using (
  user_id = auth.uid()
);
create policy "push_subs: insert own" on push_subscriptions for insert to authenticated with check (
  user_id = auth.uid()
);
create policy "push_subs: update own" on push_subscriptions for update to authenticated using (
  user_id = auth.uid()
) with check (user_id = auth.uid());
create policy "push_subs: delete own" on push_subscriptions for delete to authenticated using (
  user_id = auth.uid()
);
