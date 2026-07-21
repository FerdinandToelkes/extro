-- Migration: fix "Merge" on overlapping activities
-- Run this ONCE in the Supabase SQL editor on a project that already has
-- schema.sql applied. Safe to run once; re-running just replaces the
-- function definition (harmless).
--
-- Previously, merging created a THIRD activity while leaving both
-- originals in place, and dropped anyone who'd already responded to
-- either one. This adds a security-definer function that properly
-- consolidates: it carries over everyone's strongest response
-- (joined > interested > maybe) and deletes both source activities —
-- including the one merger doesn't own, which plain RLS blocks a normal
-- client call from doing.

create or replace function public.merge_activities(
  p_source_ids uuid[],
  p_text text,
  p_category text,
  p_timeframe text,
  p_location text,
  p_expire_after_days integer,
  p_expires_at timestamptz,
  p_circle_ids uuid[],
  p_people_ids uuid[]
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

  insert into activities (author_id, text, category, timeframe, location, expire_after_days, expires_at)
  values (v_caller, p_text, p_category, p_timeframe, p_location, p_expire_after_days, p_expires_at)
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
  uuid[], text, text, text, text, integer, timestamptz, uuid[], uuid[]
) to authenticated;
