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

export async function getProfileById(id) {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function listProfilesByIds(ids) {
  if (!ids?.length) return [];
  const { data, error } = await supabase.from("profiles").select("*").in("id", ids);
  if (error) throw error;
  return data;
}

// Exact, case-insensitive match only -- deliberately no partial/prefix
// search, which would recreate a browsable mini-directory.
export async function findProfileByUsername(username) {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("username", username.trim().toLowerCase())
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function isUsernameAvailable(username, excludeId) {
  const { data, error } = await supabase.rpc("is_username_available", {
    p_username: username,
    p_exclude_id: excludeId ?? null,
  });
  if (error) throw error;
  return data;
}

export async function listFriendsOf(targetId) {
  const { data, error } = await supabase.rpc("list_friends_of", { p_target_id: targetId });
  if (error) throw error;
  return data;
}

export async function updateMyProfile({ name, city, bio, username, subscribedTags = [] }) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");

  const normalizedUsername = username ? username.trim().toLowerCase() : null;
  if (normalizedUsername) {
    const available = await isUsernameAvailable(normalizedUsername, user.id);
    if (!available) throw new Error("That username is already taken.");
  }

  const { error } = await supabase
    .from("profiles")
    .update({
      name,
      city: city || null,
      bio: bio || null,
      username: normalizedUsername,
      subscribed_tags: subscribedTags,
    })
    .eq("id", user.id);
  if (error) throw error;
}

/* ---------- Availability ---------- */

// RLS already filters to slots visible to the caller (see the
// "availability_slots: select visible" policy in the DB schema), so unlike
// activities there's no client-side visibility recomputation here.
export async function listVisibleAvailability() {
  const { data, error } = await supabase.from("availability_slots").select(
    `id, person_id, day_of_week, time_of_day,
     availability_visibility_circles(circle_id),
     availability_visibility_people(person_id)`
  );
  if (error) throw error;
  return data.map((s) => ({
    id: s.id,
    personId: s.person_id,
    dayOfWeek: s.day_of_week,
    timeOfDay: s.time_of_day,
    visibleCircleIds: s.availability_visibility_circles.map((v) => v.circle_id),
    visiblePeopleIds: s.availability_visibility_people.map((v) => v.person_id),
  }));
}

export async function listMyAvailabilitySlots() {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];
  const { data, error } = await supabase
    .from("availability_slots")
    .select(
      `id, day_of_week, time_of_day,
       availability_visibility_circles(circle_id),
       availability_visibility_people(person_id)`
    )
    .eq("person_id", user.id);
  if (error) throw error;
  return data.map((s) => ({
    id: s.id,
    dayOfWeek: s.day_of_week,
    timeOfDay: s.time_of_day,
    visibleCircleIds: s.availability_visibility_circles.map((v) => v.circle_id),
    visiblePeopleIds: s.availability_visibility_people.map((v) => v.person_id),
  }));
}

// One slot per day of the week -- sharing the same day again replaces it
// (upsert on the person_id+day_of_week unique constraint).
export async function setAvailabilitySlot({ dayOfWeek, timeOfDay, circleIds, peopleIds }) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");

  const { data: slot, error } = await supabase
    .from("availability_slots")
    .upsert(
      { person_id: user.id, day_of_week: dayOfWeek, time_of_day: timeOfDay },
      { onConflict: "person_id,day_of_week" }
    )
    .select()
    .single();
  if (error) throw error;

  // Replace visibility rows so edits to the audience take effect.
  await supabase.from("availability_visibility_circles").delete().eq("slot_id", slot.id);
  await supabase.from("availability_visibility_people").delete().eq("slot_id", slot.id);

  if (circleIds?.length) {
    const { error: cErr } = await supabase
      .from("availability_visibility_circles")
      .insert(circleIds.map((circle_id) => ({ slot_id: slot.id, circle_id })));
    if (cErr) throw cErr;
  }
  if (peopleIds?.length) {
    const { error: pErr } = await supabase
      .from("availability_visibility_people")
      .insert(peopleIds.map((person_id) => ({ slot_id: slot.id, person_id })));
    if (pErr) throw pErr;
  }
}

export async function clearAvailabilitySlot(dayOfWeek) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");
  const { error } = await supabase
    .from("availability_slots")
    .delete()
    .eq("person_id", user.id)
    .eq("day_of_week", dayOfWeek);
  if (error) throw error;
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

export async function addCircleMember(circleId, memberId) {
  const { error } = await supabase
    .from("circle_members")
    .insert({ circle_id: circleId, member_id: memberId });
  if (error) throw error;
}

export async function removeCircleMember(circleId, memberId) {
  const { error } = await supabase
    .from("circle_members")
    .delete()
    .eq("circle_id", circleId)
    .eq("member_id", memberId);
  if (error) throw error;
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

// If an exact event time is given (advanced setting), expiry is just that
// moment plus the configurable window. Otherwise approximates the event
// date from the casual timeframe chip (the When chip itself still drives
// display/matching either way) and adds the window from midnight. Runs in
// the browser, using the visitor's local calendar day — this app has no
// server-side timezone handling anywhere else either.
function computeExpiresAt(timeframe, expireAfterHours, eventAt) {
  if (eventAt) {
    return new Date(new Date(eventAt).getTime() + expireAfterHours * 3600_000).toISOString();
  }
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
  return new Date(eventDate.getTime() + expireAfterHours * 3600_000).toISOString();
}

export async function listActivitiesFull() {
  const { data, error } = await supabase
    .from("activities")
    .select(
      `id, text, category, timeframe, location, author_id, created_at,
       event_at, expire_after_hours, expires_at, tags,
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
    eventAt: a.event_at,
    expireAfterHours: a.expire_after_hours,
    expiresAt: a.expires_at,
    tags: a.tags,
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
  expireAfterHours = 24,
  eventAt,
  tags = [],
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
      event_at: eventAt || null,
      expire_after_hours: expireAfterHours,
      expires_at: computeExpiresAt(timeframe, expireAfterHours, eventAt),
      tags,
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

// Consolidates overlapping activities from different authors into one,
// carrying over everyone's existing responses. Runs server-side via a
// security-definer function (defined in the DB schema) since the caller only
// owns one side of the merge but the operation must delete both sources.
export async function mergeActivities({
  sourceActivityIds,
  text,
  category,
  timeframe,
  location,
  expireAfterHours = 24,
  tags = [],
  circleIds,
  peopleIds,
}) {
  const { data, error } = await supabase.rpc("merge_activities", {
    p_source_ids: sourceActivityIds,
    p_text: text,
    p_category: category,
    p_timeframe: timeframe,
    p_location: location || null,
    p_expire_after_hours: expireAfterHours,
    p_expires_at: computeExpiresAt(timeframe, expireAfterHours),
    p_circle_ids: circleIds ?? [],
    p_people_ids: peopleIds ?? [],
    p_tags: tags,
  });
  if (error) throw error;
  return data;
}

export async function updateActivity({
  activityId,
  text,
  category,
  timeframe,
  location,
  expireAfterHours = 24,
  eventAt,
  tags = [],
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
      event_at: eventAt || null,
      expire_after_hours: expireAfterHours,
      expires_at: computeExpiresAt(timeframe, expireAfterHours, eventAt),
      tags,
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
