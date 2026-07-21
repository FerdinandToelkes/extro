-- Migration: profile fields (city, bio)
-- Run this ONCE in the Supabase SQL editor on a project that already has
-- schema.sql applied. Safe to run once; re-running errors on the
-- duplicate column (that's fine -- it means it's already applied).
--
-- No RLS changes needed -- "profiles: select all" / "profiles: update own"
-- already cover any column on this table, including these two.

alter table profiles add column city text;
alter table profiles add column bio text;
