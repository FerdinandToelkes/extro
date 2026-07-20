"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabaseClient";
import {
  getCurrentProfile,
  listAllProfiles,
  listCirclesWithMembers,
  listActivitiesFull,
  createActivity,
  toggleJoin,
  sendMessage,
  subscribeToActivityChanges,
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

export default function FeedPage() {
  const router = useRouter();
  const [me, setMe] = useState(null);
  const [profiles, setProfiles] = useState([]);
  const [circles, setCircles] = useState([]);
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [dismissed, setDismissed] = useState([]);

  const loadAll = useCallback(async () => {
    const [profs, circs, acts] = await Promise.all([
      listAllProfiles(),
      listCirclesWithMembers(),
      listActivitiesFull(),
    ]);
    setProfiles(profs);
    setCircles(circs);
    setActivities(acts);
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

    const unsub = subscribeToActivityChanges(() => loadAll());
    const { data: authSub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) router.replace("/login");
    });
    return () => {
      unsub();
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

  const handleJoin = async (activityId, currentlyJoined) => {
    await toggleJoin(activityId, me.id, currentlyJoined);
    await loadAll();
  };

  const handleSendMessage = async (activityId, text) => {
    await sendMessage(activityId, me.id, text);
    await loadAll();
  };

  const handleCreate = async ({ text, category, timeframe, circleIds, peopleIds }) => {
    await createActivity({
      authorId: me.id,
      text,
      category,
      timeframe,
      circleIds,
      peopleIds,
    });
    await loadAll();
  };

  const handleMerge = async (group) => {
    const key = group.map((a) => a.id).sort().join("-");
    const authorNames = [...new Set(group.map((a) => profilesById[a.authorId]?.name))];
    const circleIds = [...new Set(group.flatMap((a) => a.visibleCircleIds))];
    const peopleIds = [...new Set(group.flatMap((a) => a.visiblePeopleIds))];
    await createActivity({
      authorId: me.id,
      text: `${group[0].text} (zusammengelegt: ${authorNames.join(", ")})`,
      category: group[0].category,
      timeframe: group[0].timeframe,
      circleIds,
      peopleIds,
    });
    setDismissed((prev) => [...prev, key]);
    await loadAll();
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.replace("/login");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg font-body text-inksoft">
        Lädt…
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg font-body">
      <div className="max-w-[620px] mx-auto px-4 pt-7 pb-16">
        <div className="flex justify-between items-start mb-5">
          <div>
            <div className="font-mono text-[11px] text-gray-400 uppercase tracking-wide mb-1">
              {visibleActivities.length} offene Aktivitäten in deinem Kreis
            </div>
            <h1 className="font-display font-bold text-[28px] text-ink m-0">
              Wonach steht dir der Sinn?
            </h1>
          </div>
          <button
            onClick={handleLogout}
            className="font-mono text-[11px] text-inksoft border border-border rounded-full px-3 py-1.5 h-fit"
          >
            Abmelden
          </button>
        </div>

        <div className="flex gap-2 mb-5 flex-wrap">
          {circles.map((c) => (
            <div
              key={c.id}
              className="font-mono text-[11.5px] text-inksoft bg-white border border-border rounded-full px-3 py-1"
            >
              {c.name} · {c.memberIds.length}
            </div>
          ))}
          <a
            href="/circles"
            className="font-mono text-[11.5px] text-indigo border border-indigo/40 rounded-full px-3 py-1"
          >
            + Kreis verwalten
          </a>
        </div>

        {showForm ? (
          <NewActivityForm
            circles={circles}
            profiles={profiles}
            meId={me.id}
            onCreate={handleCreate}
            onClose={() => setShowForm(false)}
          />
        ) : (
          <button
            onClick={() => setShowForm(true)}
            className="w-full text-left font-body text-[14.5px] text-gray-400 bg-white border border-dashed border-gray-300 rounded-2xl px-4.5 py-3.5 mb-5"
          >
            + Ich hätte mal wieder Lust auf …
          </button>
        )}

        {overlaps.map((group) => (
          <OverlapBanner
            key={group.map((a) => a.id).join("-")}
            group={group}
            profilesById={profilesById}
            onMerge={handleMerge}
          />
        ))}

        {visibleActivities.map((a) => (
          <ActivityCard
            key={a.id}
            activity={a}
            profilesById={profilesById}
            circlesById={circlesById}
            meId={me.id}
            onJoin={handleJoin}
            onSendMessage={handleSendMessage}
          />
        ))}
      </div>
    </div>
  );
}
