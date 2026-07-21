-- Migration: unique usernames + friends-of-a-friend
-- Run this ONCE in the Supabase SQL editor on a project that already has
-- schema.sql applied. Safe to run once; re-running errors on the
-- duplicate column (that's fine -- it means it's already applied); the
-- two functions use CREATE OR REPLACE so those are safe to re-run too.
--
-- Adds a unique, lowercase, required-at-signup username (existing accounts
-- keep username = null until they set one via /profile -- NULL doesn't
-- violate uniqueness or the format check). Also adds two narrowly-scoped
-- security-definer functions: one lets the signup form check username
-- availability before an account even exists, the other lets a profile
-- page show a friend's friends WITHOUT extending any existing RLS policy
-- (extending "friend_requests: select own" to cover this would require
-- that policy to query friend_requests from within itself, which is the
-- exact self-referential shape that caused the "infinite recursion
-- detected in policy" outage from the visibility-enforcement migration --
-- a table's policy querying that same table re-triggers the policy
-- recursively and Postgres refuses the whole query).

alter table profiles add column username text unique check (username ~ '^[a-z0-9_]{3,20}$');

create or replace function public.handle_new_user()
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

create or replace function public.is_username_available(p_username text, p_exclude_id uuid default null)
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

create or replace function public.list_friends_of(p_target_id uuid)
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
