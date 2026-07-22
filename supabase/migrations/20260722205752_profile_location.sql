-- Replace the free-text `city` with a validated location (city/state) chosen
-- from real-place autocomplete. `location_key` (lowercased label) is what the
-- "nearby" feed filter matches on; `location_label` is what's displayed.
alter table profiles add column location_label text;
alter table profiles add column location_key text;

-- Carry existing free-text cities over best-effort as their own place.
update profiles
  set location_label = city,
      location_key = lower(trim(city))
  where city is not null and trim(city) <> '';

alter table profiles drop column city;
