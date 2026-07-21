-- Migration: availability windows ("I'm generally free")
-- Run this ONCE in the Supabase SQL editor on a project that already has
-- schema.sql applied. Safe to run once; re-running errors on the
-- duplicate column (that's fine -- it means it's already applied).
--
-- A single current "I'm free" status per person (setting a new one
-- replaces the old), visible to accepted friends only (enforced client-
-- side, same pattern as city/bio -- no RLS changes needed, "profiles:
-- select all" / "profiles: update own" already cover any column here).

alter table profiles add column available_day text;
alter table profiles add column available_time_of_day text;
alter table profiles add column available_until timestamptz;
