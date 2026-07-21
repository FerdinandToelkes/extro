-- Migration: hour-based expiry + optional exact event time
-- Run this ONCE in the Supabase SQL editor on a project that already has
-- schema.sql applied. Safe to run once; re-running errors on the rename
-- (already renamed) and the duplicate column (that's fine -- it means
-- it's already applied).
--
-- expire_after_days becomes expire_after_hours (existing values are
-- multiplied by 24 to preserve their original meaning -- "1 day" becomes
-- "24 hours", not "1 hour"). New optional event_at lets you specify an
-- exact event moment (advanced setting) that overrides the fuzzy
-- When-chip-based midnight calculation used for auto-delete timing; the
-- When chip itself still drives display/matching either way.

alter table activities rename column expire_after_days to expire_after_hours;
update activities set expire_after_hours = expire_after_hours * 24;
alter table activities alter column expire_after_hours set default 24;

alter table activities add column event_at timestamptz;

-- merge_activities is gaining a renamed parameter, which Postgres treats
-- as a different function signature -- CREATE OR REPLACE alone would leave
-- the old signature behind as an orphaned overload instead of replacing
-- it, so drop it explicitly first (same issue as migration_activity_tags.sql).
drop function if exists public.merge_activities(
  uuid[], text, text, text, text, integer, timestamptz, uuid[], uuid[], text[]
);

create or replace function public.merge_activities(
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
