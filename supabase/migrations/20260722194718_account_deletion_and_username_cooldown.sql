-- Username-change cooldown (6 months) + self-service account deletion.

-- ---------------------------------------------------------------------------
-- 1. Username can only be changed once every 6 months.
--
-- Enforced with a BEFORE UPDATE trigger so it can't be bypassed via the API.
-- First change is free (legacy rows have a NULL stamp) and sets the clock;
-- the uniqueness of the new username is still guaranteed by the existing
-- `username` UNIQUE constraint. Unchanged saves (the profile form always
-- re-sends the current username) are a no-op thanks to `is distinct from`.
-- ---------------------------------------------------------------------------
alter table profiles add column username_changed_at timestamptz;

create function public.enforce_username_cooldown()
returns trigger
language plpgsql
as $$
begin
  if new.username is distinct from old.username then
    if old.username is not null
       and old.username_changed_at is not null
       and old.username_changed_at > now() - interval '6 months' then
      raise exception 'username can only be changed once every 6 months';
    end if;
    new.username_changed_at := now();
  end if;
  return new;
end;
$$;

create trigger enforce_username_cooldown
  before update on profiles
  for each row execute function public.enforce_username_cooldown();

-- ---------------------------------------------------------------------------
-- 2. Self-service account deletion.
--
-- Deleting the auth.users row cascades to profiles (FK on delete cascade) and
-- from there to every child table (circles, activities, friend_requests,
-- availability, etc. -- all reference profiles on delete cascade). Runs as
-- security definer since auth.users isn't writable by the anon/authenticated
-- roles directly; same pattern as create_circle / merge_activities.
-- ---------------------------------------------------------------------------
create function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;
  delete from auth.users where id = v_uid;
end;
$$;
grant execute on function public.delete_my_account() to authenticated;
