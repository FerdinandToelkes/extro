"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  getCurrentProfile,
  listCirclesWithMembers,
  listFriendRequests,
  listProfilesByIds,
  listVisibleAvailability,
  setAvailabilitySlot,
  clearAvailabilitySlot,
} from "../../lib/queries";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const TIMES_OF_DAY = ["Morning", "Afternoon", "Evening", "Anytime"];

export default function CalendarPage() {
  const router = useRouter();
  const [me, setMe] = useState(null);
  const [circles, setCircles] = useState([]);
  const [friends, setFriends] = useState([]);
  const [slots, setSlots] = useState([]);
  const [profilesById, setProfilesById] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [editingDay, setEditingDay] = useState(null);
  const [editTimeOfDay, setEditTimeOfDay] = useState(TIMES_OF_DAY[0]);
  const [editVisType, setEditVisType] = useState("circle");
  const [editSelectedCircles, setEditSelectedCircles] = useState([]);
  const [editSelectedPeople, setEditSelectedPeople] = useState([]);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const profile = await getCurrentProfile();
    if (!profile) {
      router.replace("/login");
      return;
    }
    setMe(profile);

    const [circs, reqs, visibleSlots] = await Promise.all([
      listCirclesWithMembers(),
      listFriendRequests(),
      listVisibleAvailability(),
    ]);
    setCircles(circs);

    const friendIds = reqs.filter((r) => r.status === "accepted").map((r) => r.otherId);
    const personIds = [...new Set(visibleSlots.map((s) => s.personId))];
    const [friendProfiles, slotProfiles] = await Promise.all([
      listProfilesByIds(friendIds),
      listProfilesByIds(personIds),
    ]);
    setFriends(friendProfiles);
    setProfilesById(Object.fromEntries(slotProfiles.map((p) => [p.id, p])));
    setSlots(visibleSlots);
    setLoading(false);
  };

  useEffect(() => {
    (async () => {
      await load();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggle = (arr, setArr, val) =>
    setArr(arr.includes(val) ? arr.filter((v) => v !== val) : [...arr, val]);

  const chip = (active) =>
    `font-display text-[13px] font-semibold px-3.5 py-1.5 rounded-full border cursor-pointer ${
      active ? "border-indigo bg-indigo/10 text-indigo" : "border-border bg-white text-inksoft"
    }`;

  const openEditor = (day) => {
    const existing = slots.find((s) => s.dayOfWeek === day && s.personId === me.id);
    setEditingDay(day);
    setEditTimeOfDay(existing?.timeOfDay ?? TIMES_OF_DAY[0]);
    setEditVisType(existing?.visiblePeopleIds?.length ? "people" : "circle");
    setEditSelectedCircles(existing?.visibleCircleIds ?? []);
    setEditSelectedPeople(existing?.visiblePeopleIds ?? []);
    setError("");
  };

  const saveSlot = async () => {
    setSaving(true);
    setError("");
    try {
      await setAvailabilitySlot({
        dayOfWeek: editingDay,
        timeOfDay: editTimeOfDay,
        circleIds: editVisType === "circle" ? editSelectedCircles : [],
        peopleIds: editVisType === "people" ? editSelectedPeople : [],
      });
      setEditingDay(null);
      await load();
    } catch (err) {
      setError(err.message || String(err));
    } finally {
      setSaving(false);
    }
  };

  const clearSlot = async (day) => {
    setError("");
    try {
      await clearAvailabilitySlot(day);
      if (editingDay === day) setEditingDay(null);
      await load();
    } catch (err) {
      setError(err.message || String(err));
    }
  };

  if (loading) return null;

  return (
    <div className="min-h-screen bg-bg font-body">
      <div className="max-w-[620px] mx-auto px-4 pt-7 pb-16">
        <Link href="/" className="font-mono text-[11px] text-indigo">
          ← Back to Feed
        </Link>
        <h1 className="font-display font-bold text-2xl text-ink mt-2 mb-1">Calendar</h1>
        <p className="font-body text-[13px] text-inksoft mb-5">
          Share when you&apos;re generally free — up to one slot per day, each
          visible only to the circles or people you pick.
        </p>

        {error && (
          <div className="flex items-start justify-between gap-3 bg-coral/10 border border-coral/40 rounded-xl px-4 py-2.5 mb-4 font-body text-[13px] text-coral">
            <span>{error}</span>
            <button onClick={() => setError("")} className="font-mono text-[13px] leading-none">
              ×
            </button>
          </div>
        )}

        {DAYS.map((day) => {
          const mySlot = slots.find((s) => s.dayOfWeek === day && s.personId === me.id);
          const others = slots.filter((s) => s.dayOfWeek === day && s.personId !== me.id);

          return (
            <div key={day} className="bg-white border border-border rounded-2xl p-4 mb-3">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="font-display font-bold text-ink">{day}</span>
                {mySlot ? (
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[11px] text-sage">You: {mySlot.timeOfDay}</span>
                    <button
                      onClick={() => openEditor(day)}
                      className="font-mono text-[11px] text-inksoft border border-border rounded-full px-2.5 py-0.5 hover:bg-bg"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => clearSlot(day)}
                      className="font-mono text-[11px] text-coral border border-coral/40 rounded-full px-2.5 py-0.5 hover:bg-coral/10"
                    >
                      Clear
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => openEditor(day)}
                    className="font-mono text-[11px] text-indigo border border-indigo/40 rounded-full px-3 py-1"
                  >
                    + Share
                  </button>
                )}
              </div>

              {editingDay === day && (
                <div className="border border-border rounded-lg p-3 mt-3 flex flex-col gap-3">
                  <div className="flex gap-2 flex-wrap">
                    {TIMES_OF_DAY.map((t) => (
                      <button key={t} className={chip(editTimeOfDay === t)} onClick={() => setEditTimeOfDay(t)}>
                        {t}
                      </button>
                    ))}
                  </div>

                  <div className="flex gap-2">
                    <button className={chip(editVisType === "circle")} onClick={() => setEditVisType("circle")}>
                      Friend Circles
                    </button>
                    <button className={chip(editVisType === "people")} onClick={() => setEditVisType("people")}>
                      Individual People
                    </button>
                  </div>

                  {editVisType === "circle" ? (
                    <div className="flex gap-2 flex-wrap">
                      {circles.length === 0 && (
                        <span className="text-[13px] text-gray-400 font-body">
                          No friend circles yet — create one under &quot;Circles&quot;.
                        </span>
                      )}
                      {circles.map((c) => (
                        <button
                          key={c.id}
                          className={chip(editSelectedCircles.includes(c.id))}
                          onClick={() => toggle(editSelectedCircles, setEditSelectedCircles, c.id)}
                        >
                          {c.name}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="flex gap-2 flex-wrap">
                      {friends.length === 0 && (
                        <span className="text-[13px] text-gray-400 font-body">
                          No friends yet — add some under &quot;Friends&quot;.
                        </span>
                      )}
                      {friends.map((f) => (
                        <button
                          key={f.id}
                          className={chip(editSelectedPeople.includes(f.id))}
                          onClick={() => toggle(editSelectedPeople, setEditSelectedPeople, f.id)}
                        >
                          {f.name}
                        </button>
                      ))}
                    </div>
                  )}

                  <div className="flex gap-2">
                    <button
                      onClick={saveSlot}
                      disabled={saving}
                      className="font-display font-semibold text-sm px-4 py-1.5 rounded-full bg-ink text-white disabled:opacity-50"
                    >
                      {saving ? "…" : "Save"}
                    </button>
                    <button
                      onClick={() => setEditingDay(null)}
                      className="font-display font-semibold text-sm px-4 py-1.5 rounded-full border border-border bg-white text-inksoft"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              <div className="flex flex-wrap gap-2 mt-3">
                {others.length === 0 ? (
                  <span className="text-[13px] text-gray-400">No one else sharing yet.</span>
                ) : (
                  others.map((s) => (
                    <Link
                      key={s.id}
                      href={`/profile/${s.personId}`}
                      className="font-body text-[13px] text-ink border border-border rounded-full px-3 py-1 hover:underline"
                    >
                      {profilesById[s.personId]?.name} — {s.timeOfDay}
                    </Link>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
