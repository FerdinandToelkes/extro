-- Circle privacy + all-friends activity visibility + DB-enforced mutual-
-- friend circle membership. See plan: circle_privacy_and_all_friends.

-- ---------------------------------------------------------------------------
-- 1. Circles are visible only to their owner and members (was: select all).
-- ---------------------------------------------------------------------------
drop policy "circles: select all" on circles;
create policy "circles: select member" on circles for select to authenticated using (
  owner_id = auth.uid()
  or exists (
    select 1 from circle_members cm
    where cm.circle_id = circles.id and cm.member_id = auth.uid()
  )
);
-- circle_members select stays open on purpose: gating it on `circles` (which
-- now checks circle_members) would create a circular RLS dependency and
-- Postgres would error "infinite recursion detected in policy". Reading a
-- bare (circle_id, member_id) pairing without the circle's name -- which the
-- policy above now protects -- is an acceptable minor leak, same trade-off
-- as the vis_circles/vis_people tables.

-- ---------------------------------------------------------------------------
-- 2. "All my friends" activity visibility.
-- ---------------------------------------------------------------------------
alter table activities add column visible_to_all_friends boolean not null default false;

drop policy "activities: select visible" on activities;
create policy "activities: select visible" on activities for select to authenticated using (
  author_id = auth.uid()
  or (
    visible_to_all_friends
    and exists (
      select 1 from friend_requests fr
      where fr.status = 'accepted'
        and (
          (fr.requester_id = activities.author_id and fr.addressee_id = auth.uid())
          or (fr.addressee_id = activities.author_id and fr.requester_id = auth.uid())
        )
    )
  )
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
-- No recursion: friend_requests' own "select own" policy already lets the
-- viewer read rows they're a party to (which is exactly what this checks),
-- and friend_requests references no other table.

-- ---------------------------------------------------------------------------
-- 3. DB-enforced mutual-friend circle membership.
--
-- Everyone in a circle must be an accepted friend of everyone else. The
-- clique check has to read friendships between OTHER members, which
-- "friend_requests: select own" would hide from the caller -- so these run
-- as security definer (bypassing RLS), same pattern as merge_activities /
-- list_friends_of. Direct client inserts into circles/circle_members are
-- removed below so these functions are the only way to build a circle.
-- ---------------------------------------------------------------------------
create function public.create_circle(p_name text, p_member_ids uuid[])
returns circles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid := auth.uid();
  v_all uuid[];
  v_a uuid;
  v_b uuid;
  v_circle circles;
begin
  if v_owner is null then
    raise exception 'not authenticated';
  end if;

  -- Owner + distinct members (owner is always a member).
  select array(select distinct e from unnest(v_owner || coalesce(p_member_ids, '{}'::uuid[])) as e)
    into v_all;

  -- Every unordered pair must be an accepted friendship.
  foreach v_a in array v_all loop
    foreach v_b in array v_all loop
      if v_a < v_b and not exists (
        select 1 from friend_requests fr
        where fr.status = 'accepted'
          and ((fr.requester_id = v_a and fr.addressee_id = v_b)
            or (fr.requester_id = v_b and fr.addressee_id = v_a))
      ) then
        raise exception 'all circle members must be mutual friends';
      end if;
    end loop;
  end loop;

  insert into circles (owner_id, name) values (v_owner, p_name) returning * into v_circle;
  insert into circle_members (circle_id, member_id)
    select v_circle.id, e from unnest(v_all) as e;

  return v_circle;
end;
$$;
grant execute on function public.create_circle(text, uuid[]) to authenticated;

create function public.add_circle_member(p_circle_id uuid, p_member_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid := auth.uid();
begin
  if v_owner is null then
    raise exception 'not authenticated';
  end if;

  if not exists (select 1 from circles c where c.id = p_circle_id and c.owner_id = v_owner) then
    raise exception 'only the circle owner can add members';
  end if;

  -- New member must be an accepted friend of every current member.
  if exists (
    select 1 from circle_members cm
    where cm.circle_id = p_circle_id
      and cm.member_id <> p_member_id
      and not exists (
        select 1 from friend_requests fr
        where fr.status = 'accepted'
          and ((fr.requester_id = p_member_id and fr.addressee_id = cm.member_id)
            or (fr.requester_id = cm.member_id and fr.addressee_id = p_member_id))
      )
  ) then
    raise exception 'new member must be a mutual friend of everyone in the circle';
  end if;

  insert into circle_members (circle_id, member_id)
    values (p_circle_id, p_member_id)
    on conflict do nothing;
end;
$$;
grant execute on function public.add_circle_member(uuid, uuid) to authenticated;

-- Remove the direct-insert bypass so the validated functions are the only
-- way to create circles / add members. (Delete + leave policies stay.)
drop policy "circles: insert own" on circles;
drop policy "circle_members: insert own circle" on circle_members;
