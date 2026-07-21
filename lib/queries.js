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

/* ---------- Friend requests ---------- */

export async function listFriendRequests() {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];
  const { data, error } = await supabase
    .from("friend_requests")
    .select("id, requester_id, addressee_id, status")
    .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`);
  if (error) throw error;
  return data.map((r) => ({
    id: r.id,
    otherId: r.requester_id === user.id ? r.addressee_id : r.requester_id,
    status: r.status,
    direction: r.requester_id === user.id ? "outgoing" : "incoming",
  }));
}

export async function sendFriendRequest(meId, otherId) {
  const { data: incoming, error: lookupError } = await supabase
    .from("friend_requests")
    .select("id, status")
    .eq("requester_id", otherId)
    .eq("addressee_id", meId)
    .maybeSingle();
  if (lookupError) throw lookupError;

  if (incoming && incoming.status === "pending") {
    return acceptFriendRequest(incoming.id);
  }
  const { error } = await supabase
    .from("friend_requests")
    .insert({ requester_id: meId, addressee_id: otherId });
  if (error) throw error;
}

export async function acceptFriendRequest(requestId) {
  const { error } = await supabase
    .from("friend_requests")
    .update({ status: "accepted" })
    .eq("id", requestId);
  if (error) throw error;
}

export async function removeFriendRequest(requestId) {
  const { error } = await supabase.from("friend_requests").delete().eq("id", requestId);
  if (error) throw error;
}

export function subscribeToFriendRequests(onChange) {
  const channel = supabase
    .channel("friend-requests")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "friend_requests" },
      onChange
    )
    .subscribe();

  return () => supabase.removeChannel(channel);
}

/* ---------- Activities ---------- */

// Approximates the actual event date from the casual timeframe chip, then
// adds the configurable window to get the moment this activity should
// disappear. Runs in the browser, using the visitor's local calendar day —
// this app has no server-side timezone handling anywhere else either.
function computeExpiresAt(timeframe, expireAfterDays) {
  const eventDate = new Date();
  eventDate.setHours(0, 0, 0, 0);
  if (timeframe === "Tomorrow") {
    eventDate.setDate(eventDate.getDate() + 1);
  } else if (timeframe === "Weekend") {
    const day = eventDate.getDay();
    if (day !== 6 && day !== 0) {
      eventDate.setDate(eventDate.getDate() + (6 - day));
    }
  }
  eventDate.setDate(eventDate.getDate() + expireAfterDays);
  return eventDate.toISOString();
}

export async function listActivitiesFull() {
  const { data, error } = await supabase
    .from("activities")
    .select(
      `id, text, category, timeframe, location, author_id, created_at,
       expire_after_days, expires_at,
       activity_visibility_circles(circle_id),
       activity_visibility_people(person_id),
       activity_joins(person_id, status),
       activity_messages(id, author_id, text, created_at)`
    )
    .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data.map((a) => ({
    id: a.id,
    text: a.text,
    category: a.category,
    timeframe: a.timeframe,
    location: a.location,
    authorId: a.author_id,
    createdAt: a.created_at,
    expireAfterDays: a.expire_after_days,
    expiresAt: a.expires_at,
    visibleCircleIds: a.activity_visibility_circles.map((v) => v.circle_id),
    visiblePeopleIds: a.activity_visibility_people.map((v) => v.person_id),
    responses: a.activity_joins.map((j) => ({ personId: j.person_id, status: j.status })),
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
  location,
  expireAfterDays = 1,
  circleIds,
  peopleIds,
}) {
  const { data: activity, error } = await supabase
    .from("activities")
    .insert({
      author_id: authorId,
      text,
      category,
      timeframe,
      location: location || null,
      expire_after_days: expireAfterDays,
      expires_at: computeExpiresAt(timeframe, expireAfterDays),
    })
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
    .insert({ activity_id: activity.id, person_id: authorId, status: "joined" });

  return activity;
}

export async function updateActivity({
  activityId,
  text,
  category,
  timeframe,
  location,
  expireAfterDays = 1,
  circleIds,
  peopleIds,
}) {
  const { error } = await supabase
    .from("activities")
    .update({
      text,
      category,
      timeframe,
      location: location || null,
      expire_after_days: expireAfterDays,
      expires_at: computeExpiresAt(timeframe, expireAfterDays),
    })
    .eq("id", activityId);
  if (error) throw error;

  // Replace visibility rows so edits to the audience take effect.
  await supabase.from("activity_visibility_circles").delete().eq("activity_id", activityId);
  await supabase.from("activity_visibility_people").delete().eq("activity_id", activityId);

  if (circleIds?.length) {
    const { error: cErr } = await supabase
      .from("activity_visibility_circles")
      .insert(circleIds.map((circle_id) => ({ activity_id: activityId, circle_id })));
    if (cErr) throw cErr;
  }
  if (peopleIds?.length) {
    const { error: pErr } = await supabase
      .from("activity_visibility_people")
      .insert(peopleIds.map((person_id) => ({ activity_id: activityId, person_id })));
    if (pErr) throw pErr;
  }
}

export async function deleteActivity(activityId) {
  // Child rows (joins, messages, visibility) are removed via ON DELETE CASCADE.
  const { error } = await supabase.from("activities").delete().eq("id", activityId);
  if (error) throw error;
}

export async function setActivityResponse(activityId, personId, status) {
  const { data: existing, error: lookupError } = await supabase
    .from("activity_joins")
    .select("status")
    .eq("activity_id", activityId)
    .eq("person_id", personId)
    .maybeSingle();
  if (lookupError) throw lookupError;

  if (existing?.status === status) {
    const { error } = await supabase
      .from("activity_joins")
      .delete()
      .eq("activity_id", activityId)
      .eq("person_id", personId);
    if (error) throw error;
  } else if (existing) {
    const { error } = await supabase
      .from("activity_joins")
      .update({ status })
      .eq("activity_id", activityId)
      .eq("person_id", personId);
    if (error) throw error;
  } else {
    const { error } = await supabase
      .from("activity_joins")
      .insert({ activity_id: activityId, person_id: personId, status });
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
