-- In-app notification center. Notifications are written server-side by
-- security-definer triggers (never by clients) and read live over realtime.

create table notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid references profiles(id) on delete cascade,
  actor_id uuid references profiles(id) on delete cascade,
  type text not null check (type in ('friend_request','friend_accepted','activity_response','activity_message')),
  activity_id uuid references activities(id) on delete cascade,
  read_at timestamptz,
  created_at timestamptz default now()
);

-- Collapse repeated chat messages into a single unread row per (recipient,
-- activity) -- a busy chat becomes one "new messages" item, not ten.
create unique index notifications_message_collapse
  on notifications (recipient_id, activity_id) where type = 'activity_message';
create index notifications_recipient_created on notifications (recipient_id, created_at desc);

alter table notifications enable row level security;

-- Recipient-only. There is deliberately no INSERT policy: only the definer
-- triggers below write rows (they bypass RLS as the postgres owner).
create policy "notifications: select own" on notifications for select to authenticated using (
  recipient_id = auth.uid()
);
create policy "notifications: update own" on notifications for update to authenticated using (
  recipient_id = auth.uid()
) with check (recipient_id = auth.uid());
create policy "notifications: delete own" on notifications for delete to authenticated using (
  recipient_id = auth.uid()
);

alter publication supabase_realtime add table notifications;

-- ---------------------------------------------------------------------------
-- Friend requests: notify the addressee on a new request, and the original
-- requester when it's accepted.
-- ---------------------------------------------------------------------------
create function public.notify_friend_request()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' and new.status = 'pending'
     and new.addressee_id <> new.requester_id then
    insert into notifications (recipient_id, actor_id, type)
      values (new.addressee_id, new.requester_id, 'friend_request');
  elsif tg_op = 'UPDATE' and old.status = 'pending' and new.status = 'accepted'
        and new.requester_id <> new.addressee_id then
    insert into notifications (recipient_id, actor_id, type)
      values (new.requester_id, new.addressee_id, 'friend_accepted');
  end if;
  return new;
end;
$$;

create trigger notify_friend_request
  after insert or update on friend_requests
  for each row execute function public.notify_friend_request();

-- ---------------------------------------------------------------------------
-- Activity responses: notify the activity's author when someone else responds
-- (the creator's own auto-join is skipped by the author<>responder guard).
-- ---------------------------------------------------------------------------
create function public.notify_activity_response()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_author uuid;
begin
  select author_id into v_author from activities where id = new.activity_id;
  if v_author is not null and v_author <> new.person_id then
    insert into notifications (recipient_id, actor_id, type, activity_id)
      values (v_author, new.person_id, 'activity_response', new.activity_id);
  end if;
  return new;
end;
$$;

create trigger notify_activity_response
  after insert on activity_joins
  for each row execute function public.notify_activity_response();

-- ---------------------------------------------------------------------------
-- Activity messages: notify everyone in the activity (author + responders)
-- except the sender, collapsing repeats per activity into one unread row.
-- ---------------------------------------------------------------------------
create function public.notify_activity_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into notifications (recipient_id, actor_id, type, activity_id)
  select r.uid, new.author_id, 'activity_message', new.activity_id
  from (
    select author_id as uid from activities where id = new.activity_id
    union
    select person_id as uid from activity_joins where activity_id = new.activity_id
  ) r
  where r.uid is not null and r.uid <> new.author_id
  on conflict (recipient_id, activity_id) where type = 'activity_message'
  do update set actor_id = excluded.actor_id, created_at = now(), read_at = null;
  return new;
end;
$$;

create trigger notify_activity_message
  after insert on activity_messages
  for each row execute function public.notify_activity_message();
