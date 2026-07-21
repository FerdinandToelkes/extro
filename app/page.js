"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "../lib/supabaseClient";
import {
  getCurrentProfile,
  listAllProfiles,
  listCirclesWithMembers,
  listActivitiesFull,
  listFriendRequests,
  createActivity,
  mergeActivities,
  updateActivity,
  deleteActivity,
  setActivityResponse,
  sendMessage,
  subscribeToActivityChanges,
  subscribeToFriendRequests,
} from "../lib/queries";
import ActivityCard from "../components/ActivityCard";
import OverlapBanner from "../components/OverlapBanner";
import NewActivityForm from "../components/NewActivityForm";

function isVisibleToMe(activity, meId, circles) {
  if (activity.authorId === meId) return true;
  if (activity.visiblePeopleIds.includes(meId)) return true;
  return activity.visibleCircleIds.some((cid) => {
    const circle = circles.find((c) => c.id === cid);
    return circle && circle.memberIds.includes(meId);
  });
}

function findOverlaps(activities) {
  const groups = {};
  activities.forEach((a) => {
    const key = `${a.timeframe}|${a.category}`;
    (groups[key] ||= []).push(a);
  });
  return Object.values(groups).filter(
    (g) => g.length >= 2 && new Set(g.map((a) => a.authorId)).size >= 2
  );
}

function normalizeCity(city) {
  return (city || "").trim().toLowerCase();
}

export default function FeedPage() {
  const router = useRouter();
  const [me, setMe] = useState(null);
  const [profiles, setProfiles] = useState([]);
  const [circles, setCircles] = useState([]);
  const [activities, setActivities] = useState([]);
  const [friendRequests, setFriendRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [dismissed, setDismissed] = useState([]);
  const [error, setError] = useState("");
  const [activeTags, setActiveTags] = useState([]);
  const [activeCategories, setActiveCategories] = useState([]);
  const [sameCityOnly, setSameCityOnly] = useState(false);

  const loadAll = useCallback(async () => {
    const [profs, circs, acts, reqs] = await Promise.all([
      listAllProfiles(),
      listCirclesWithMembers(),
      listActivitiesFull(),
      listFriendRequests(),
    ]);
    setProfiles(profs);
    setCircles(circs);
    setActivities(acts);
    setFriendRequests(reqs);
  }, []);

  useEffect(() => {
    (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        router.replace("/login");
        return;
      }
      const profile = await getCurrentProfile();
      setMe(profile);
      await loadAll();
      setLoading(false);
    })();

    const unsubActivities = subscribeToActivityChanges(() => loadAll());
    const unsubFriends = subscribeToFriendRequests(() => loadAll());
    const { data: authSub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) router.replace("/login");
    });
    return () => {
      unsubActivities();
      unsubFriends();
      authSub.subscription.unsubscribe();
    };
  }, [loadAll, router]);

  const profilesById = useMemo(
    () => Object.fromEntries(profiles.map((p) => [p.id, p])),
    [profiles]
  );
  const circlesById = useMemo(
    () => Object.fromEntries(circles.map((c) => [c.id, c])),
    [circles]
  );

  const visibleActivities = useMemo(
    () => (me ? activities.filter((a) => isVisibleToMe(a, me.id, circles)) : []),
    [activities, me, circles]
  );

  const overlaps = useMemo(() => {
    const found = findOverlaps(visibleActivities);
    return found.filter(
      (g) => !dismissed.includes(g.map((a) => a.id).sort().join("-"))
    );
  }, [visibleActivities, dismissed]);

  const allTags = useMemo(
    () => [...new Set(visibleActivities.flatMap((a) => a.tags))].sort(),
    [visibleActivities]
  );

  const allCategories = useMemo(
    () => [...new Set(visibleActivities.map((a) => a.category))].sort(),
    [visibleActivities]
  );

  const filteredActivities = useMemo(
    () =>
      visibleActivities.filter((a) => {
        if (activeCategories.length > 0 && !activeCategories.includes(a.category)) return false;
        if (activeTags.length > 0 && !a.tags.some((t) => activeTags.includes(t))) return false;
        if (sameCityOnly) {
          const authorCity = normalizeCity(profilesById[a.authorId]?.city);
          if (!authorCity || authorCity !== normalizeCity(me?.city)) return false;
        }
        return true;
      }),
    [visibleActivities, activeCategories, activeTags, sameCityOnly, profilesById, me]
  );

  const toggleActiveTag = (t) =>
    setActiveTags((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));

  const toggleActiveCategory = (c) =>
    setActiveCategories((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]));

  const mergeCandidates = useMemo(() => {
    if (!editing) return [];
    return visibleActivities.filter(
      (a) =>
        a.id !== editing.id &&
        a.category === editing.category &&
        a.timeframe === editing.timeframe &&
        a.authorId !== editing.authorId
    );
  }, [visibleActivities, editing]);

  const friendIds = useMemo(
    () => friendRequests.filter((r) => r.status === "accepted").map((r) => r.otherId),
    [friendRequests]
  );
  const incomingRequestCount = useMemo(
    () => friendRequests.filter((r) => r.status === "pending" && r.direction === "incoming").length,
    [friendRequests]
  );

  const handleRespond = async (activityId, status) => {
    setError("");
    try {
      await setActivityResponse(activityId, me.id, status);
      await loadAll();
    } catch (err) {
      setError(err.message || String(err));
    }
  };

  const handleSendMessage = async (activityId, text) => {
    setError("");
    try {
      await sendMessage(activityId, me.id, text);
      await loadAll();
    } catch (err) {
      setError(err.message || String(err));
    }
  };

  const handleCreate = async ({
    text,
    category,
    timeframe,
    location,
    expireAfterHours,
    eventAt,
    tags,
    circleIds,
    peopleIds,
  }) => {
    setError("");
    try {
      await createActivity({
        authorId: me.id,
        text,
        category,
        timeframe,
        location,
        expireAfterHours,
        eventAt,
        tags,
        circleIds,
        peopleIds,
      });
      await loadAll();
    } catch (err) {
      setError(err.message || String(err));
      throw err;
    }
  };

  const handleUpdate = async ({
    text,
    category,
    timeframe,
    location,
    expireAfterHours,
    eventAt,
    tags,
    circleIds,
    peopleIds,
  }) => {
    setError("");
    try {
      await updateActivity({
        activityId: editing.id,
        text,
        category,
        timeframe,
        location,
        expireAfterHours,
        eventAt,
        tags,
        circleIds,
        peopleIds,
      });
      await loadAll();
    } catch (err) {
      setError(err.message || String(err));
      throw err;
    }
  };

  const handleEdit = (activity) => {
    setShowForm(false);
    setEditing(activity);
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleDelete = async (activityId) => {
    setError("");
    try {
      await deleteActivity(activityId);
      await loadAll();
    } catch (err) {
      setError(err.message || String(err));
    }
  };

  const handleMerge = async (group) => {
    setError("");
    const key = group.map((a) => a.id).sort().join("-");
    const authorNames = [...new Set(group.map((a) => profilesById[a.authorId]?.name))];
    const circleIds = [...new Set(group.flatMap((a) => a.visibleCircleIds))];
    const peopleIds = [...new Set(group.flatMap((a) => a.visiblePeopleIds))];
    try {
      await mergeActivities({
        sourceActivityIds: group.map((a) => a.id),
        text: `${group[0].text} (merged: ${authorNames.join(", ")})`,
        category: group[0].category,
        timeframe: group[0].timeframe,
        location: group.find((a) => a.location)?.location || "",
        expireAfterHours: group[0].expireAfterHours,
        tags: [...new Set(group.flatMap((a) => a.tags))],
        circleIds,
        peopleIds,
      });
      setDismissed((prev) => [...prev, key]);
      await loadAll();
      return true;
    } catch (err) {
      setError(err.message || String(err));
      return false;
    }
  };

  const handleDismissOverlap = (group) => {
    const key = group.map((a) => a.id).sort().join("-");
    setDismissed((prev) => [...prev, key]);
  };

  const handleMergeWith = async (candidate) => {
    const ok = await handleMerge([editing, candidate]);
    if (ok) setEditing(null);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.replace("/login");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg font-body text-inksoft">
        Loading…
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg font-body">
      <div className="max-w-[620px] mx-auto px-4 pt-7 pb-16">
        <div className="flex justify-between items-start mb-5">
          <div>
            <div className="font-mono text-[11px] text-gray-400 uppercase tracking-wide mb-1">
              {filteredActivities.length} open activities in your circles
            </div>
            <h1 className="font-display font-bold text-[28px] text-ink m-0">
              What are you in the mood for?
            </h1>
          </div>
          <button
            onClick={handleLogout}
            className="font-mono text-[11px] text-inksoft border border-border rounded-full px-3 py-1.5 h-fit"
          >
            Sign Out
          </button>
        </div>

        {error && (
          <div className="flex items-start justify-between gap-3 bg-coral/10 border border-coral/40 rounded-xl px-4 py-2.5 mb-4 font-body text-[13px] text-coral">
            <span>{error}</span>
            <button onClick={() => setError("")} className="font-mono text-[13px] leading-none">
              ×
            </button>
          </div>
        )}

        <div className="flex gap-2 mb-5 flex-wrap">
          {circles.map((c) => (
            <div
              key={c.id}
              className="font-mono text-[11.5px] text-inksoft bg-white border border-border rounded-full px-3 py-1"
            >
              {c.name} · {c.memberIds.length}
            </div>
          ))}
          <Link
            href="/circles"
            className="font-mono text-[11.5px] text-indigo border border-indigo/40 rounded-full px-3 py-1"
          >
            + Manage Circles
          </Link>
          <Link
            href="/friends"
            className="font-mono text-[11.5px] text-indigo border border-indigo/40 rounded-full px-3 py-1"
          >
            + Manage Friends{incomingRequestCount > 0 ? ` · ${incomingRequestCount}` : ""}
          </Link>
          <Link
            href="/profile"
            className="font-mono text-[11.5px] text-indigo border border-indigo/40 rounded-full px-3 py-1"
          >
            + My Profile
          </Link>
        </div>

        {editing ? (
          <NewActivityForm
            key={editing.id}
            circles={circles}
            profiles={profiles}
            friendIds={friendIds}
            meId={me.id}
            initial={editing}
            mergeCandidates={mergeCandidates}
            onMergeWith={handleMergeWith}
            onCreate={handleUpdate}
            onClose={() => setEditing(null)}
          />
        ) : showForm ? (
          <NewActivityForm
            circles={circles}
            profiles={profiles}
            friendIds={friendIds}
            meId={me.id}
            onCreate={handleCreate}
            onClose={() => setShowForm(false)}
          />
        ) : (
          <button
            onClick={() => setShowForm(true)}
            className="w-full text-center font-body text-[14.5px] text-gray-400 bg-white border border-dashed border-gray-300 rounded-2xl px-4.5 py-3.5 mb-5"
          >
            + Create New Activity
          </button>
        )}

        {overlaps.map((group) => (
          <OverlapBanner
            key={group.map((a) => a.id).join("-")}
            group={group}
            profilesById={profilesById}
            onMerge={handleMerge}
            onDismiss={handleDismissOverlap}
          />
        ))}

        {allCategories.length > 0 && (
          <div className="flex gap-2 mb-2 flex-wrap items-center">
            <span className="font-mono text-[10.5px] text-gray-400 uppercase tracking-wide">
              Category
            </span>
            {allCategories.map((c) => (
              <button
                key={c}
                onClick={() => toggleActiveCategory(c)}
                className={`font-mono text-[11.5px] rounded-full px-3 py-1 border ${
                  activeCategories.includes(c)
                    ? "border-indigo bg-indigo/10 text-indigo"
                    : "border-border bg-white text-inksoft"
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        )}

        {allTags.length > 0 && (
          <div className="flex gap-2 mb-2 flex-wrap items-center">
            <span className="font-mono text-[10.5px] text-gray-400 uppercase tracking-wide">
              Tags
            </span>
            {allTags.map((t) => (
              <button
                key={t}
                onClick={() => toggleActiveTag(t)}
                className={`font-mono text-[11.5px] rounded-full px-3 py-1 border ${
                  activeTags.includes(t)
                    ? "border-indigo bg-indigo/10 text-indigo"
                    : "border-border bg-white text-inksoft"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        )}

        {me?.city ? (
          <div className="flex gap-2 mb-4 flex-wrap">
            <button
              onClick={() => setSameCityOnly((v) => !v)}
              className={`font-mono text-[11.5px] rounded-full px-3 py-1 border ${
                sameCityOnly
                  ? "border-indigo bg-indigo/10 text-indigo"
                  : "border-border bg-white text-inksoft"
              }`}
            >
              📍 Same city ({me.city})
            </button>
          </div>
        ) : (
          <div className="mb-4">
            <Link href="/profile" className="font-mono text-[11px] text-gray-400">
              Set your city on your profile to filter by nearby activities.
            </Link>
          </div>
        )}

        {filteredActivities.map((a) => (
          <ActivityCard
            key={a.id}
            activity={a}
            profilesById={profilesById}
            circlesById={circlesById}
            meId={me.id}
            onRespond={handleRespond}
            onSendMessage={handleSendMessage}
            onEdit={handleEdit}
            onDelete={handleDelete}
          />
        ))}
      </div>
    </div>
  );
}
