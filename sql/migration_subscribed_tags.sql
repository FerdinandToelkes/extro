-- Migration: recurring interests (tag subscriptions)
-- Run this ONCE in the Supabase SQL editor on a project that already has
-- schema.sql applied. Safe to run once; re-running errors on the
-- duplicate column (that's fine -- it means it's already applied).
--
-- Tags (same vocabulary as activities.tags) a person wants surfaced and
-- highlighted on their own feed. No RLS changes -- same reasoning as
-- every other profile column: "profiles: select all" / "profiles: update
-- own" already cover it.

alter table profiles add column subscribed_tags text[] not null default '{}';
