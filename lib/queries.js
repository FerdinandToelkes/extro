"use client";

import { supabase } from "./supabaseClient";

/* ---------- Profile & Friends ---------- */

export async function getCurrentProfile() {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();
  if (error) throw error;
  return data;
}

export async function listAllProfiles() {
  const { data, error } = await supabase.from("profiles").select("*");
  if (error) throw error;
  return data;
}

/* ---------- Circles ---------- */

export async function listCirclesWithMembers() {
  const { data, error } = await supabase
    .from("circles")
    .select("id, name, owner_id, circle_members(member_id)");
  if (error) throw error;
  return data.map((c) => ({
    ...c,
    memberIds: c.circle_members.map((m) => m.member_id),
  }));
}

export async function createCircle(name, memberIds, ownerId) {
  const { data: circle, error } = await supabase
    .from("circles")
    .insert({ name, owner_id: ownerId })
    .select()
    .single();
  if (error) throw error;

  const rows = [ownerId, ...memberIds.filter((id) => id !== ownerId)].map(
    (member_id) => ({ circle_id: circle.id, member_id })
  );
  const { error: memberError } = await supabase
    .from("circle_members")
    .insert(rows);
  if (memberError) throw memberError;

  return circle;
}

/* ---------- Activities ---------- */

export async function listActivitiesFull() {
  const { data, error } = await supabase
    .from("activities")
    .select(
      `id, text, category, timeframe, author_id, created_at,
       activity_visibility_circles(circle_id),
       activity_visibility_people(person_id),
       activity_joins(person_id),
       activity_messages(id, author_id, text, created_at)`
    )
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data.map((a) => ({
    id: a.id,
    text: a.text,
    category: a.category,
    timeframe: a.timeframe,
    authorId: a.author_id,
    createdAt: a.created_at,
    visibleCircleIds: a.activity_visibility_circles.map((v) => v.circle_id),
    visiblePeopleIds: a.activity_visibility_people.map((v) => v.person_id),
    joined: a.activity_joins.map((j) => j.person_id),
    chat: a.activity_messages.sort(
      (x, y) => new Date(x.created_at) - new Date(y.created_at)
    ),
  }));
}

export async function createActivity({
  authorId,
  text,
  category,
  timeframe,
  circleIds,
  peopleIds,
}) {
  const { data: activity, error } = await supabase
    .from("activities")
    .insert({ author_id: authorId, text, category, timeframe })
    .select()
    .single();
  if (error) throw error;

  if (circleIds?.length) {
    await supabase
      .from("activity_visibility_circles")
      .insert(circleIds.map((circle_id) => ({ activity_id: activity.id, circle_id })));
  }
  if (peopleIds?.length) {
    await supabase
      .from("activity_visibility_people")
      .insert(peopleIds.map((person_id) => ({ activity_id: activity.id, person_id })));
  }
  // Creator automatically joins their own activity
  await supabase
    .from("activity_joins")
    .insert({ activity_id: activity.id, person_id: authorId });

  return activity;
}

export async function toggleJoin(activityId, personId, currentlyJoined) {
  if (currentlyJoined) {
    const { error } = await supabase
      .from("activity_joins")
      .delete()
      .eq("activity_id", activityId)
      .eq("person_id", personId);
    if (error) throw error;
  } else {
    const { error } = await supabase
      .from("activity_joins")
      .insert({ activity_id: activityId, person_id: personId });
    if (error) throw error;
  }
}

export async function sendMessage(activityId, authorId, text) {
  const { error } = await supabase
    .from("activity_messages")
    .insert({ activity_id: activityId, author_id: authorId, text });
  if (error) throw error;
}

/* ---------- Realtime ---------- */

export function subscribeToActivityChanges(onChange) {
  const channel = supabase
    .channel("activity-feed")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "activities" },
      onChange
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "activity_joins" },
      onChange
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "activity_messages" },
      onChange
    )
    .subscribe();

  return () => supabase.removeChannel(channel);
}
