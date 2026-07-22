"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  getCurrentProfile,
  listProfilesByIds,
  listCirclesWithMembers,
  listFriendRequests,
  listFriendsOf,
  createCircle,
  addCircleMember,
  removeCircleMember,
  deleteCircle,
} from "../../lib/queries";

export default function CirclesPage() {
  const router = useRouter();
  const [me, setMe] = useState(null);
  const [friends, setFriends] = useState([]);
  const [circles, setCircles] = useState([]);
  const [memberProfilesById, setMemberProfilesById] = useState({});
  const [friendsOfById, setFriendsOfById] = useState({});
  const [name, setName] = useState("");
  const [selected, setSelected] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedCircleId, setExpandedCircleId] = useState(null);
  const [error, setError] = useState("");
  const nameInputRef = useRef(null);

  const load = async () => {
    const profile = await getCurrentProfile();
    if (!profile) {
      router.replace("/login");
      return;
    }
    setMe(profile);
    const reqs = await listFriendRequests();
    const friendIds = reqs.filter((r) => r.status === "accepted").map((r) => r.otherId);
    const circs = await listCirclesWithMembers();
    setCircles(circs);
    const allMemberIds = [...new Set(circs.flatMap((c) => c.memberIds))];
    const [friendProfiles, memberProfiles] = await Promise.all([
      listProfilesByIds(friendIds),
      listProfilesByIds(allMemberIds),
    ]);
    setFriends(friendProfiles);
    setMemberProfilesById(Object.fromEntries(memberProfiles.map((p) => [p.id, p])));
    // Each friend's own friend set, so we can enforce the "everyone in a
    // circle is a mutual friend of everyone else" rule in the pickers.
    const fof = await Promise.all(
      friendProfiles.map((f) =>
        listFriendsOf(f.id).then((list) => [f.id, new Set(list.map((x) => x.id))])
      )
    );
    setFriendsOfById(Object.fromEntries(fof));
    setLoading(false);
  };

  useEffect(() => {
    (async () => {
      await load();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Would `candidateId` be a mutual friend of everyone already in `memberIds`?
  // The owner (me) is a friend of every candidate shown, so skip me; the
  // candidate trivially matches itself.
  const isFriendsWithAll = (candidateId, memberIds) =>
    memberIds.every(
      (m) => m === me.id || m === candidateId || friendsOfById[m]?.has(candidateId)
    );

  // Groups of your friends who are all mutual friends with each other (and
  // with you) but aren't already a circle -- greedy maximal cliques seeded
  // from each friend, deduped, size >= 3 (you + 2), minus existing circles.
  const suggestions = useMemo(() => {
    if (!me) return [];
    const friendIds = friends.map((f) => f.id);
    // You are friends with all your friends by definition; two friends are
    // connected only if each appears in the other's friend set.
    const connected = (a, b) =>
      a === b || a === me.id || b === me.id || Boolean(friendsOfById[a]?.has(b));
    const existingKeys = new Set(
      circles.map((c) => [...c.memberIds].sort().join(","))
    );
    const seen = new Set();
    const out = [];
    for (const seed of friendIds) {
      const clique = [me.id, seed];
      for (const cand of friendIds) {
        if (clique.includes(cand)) continue;
        if (clique.every((m) => connected(m, cand))) clique.push(cand);
      }
      const key = [...clique].sort().join(",");
      if (seen.has(key) || existingKeys.has(key)) continue;
      seen.add(key);
      if (clique.length < 3) continue;
      out.push(clique.filter((id) => id !== me.id));
    }
    return out;
  }, [me, friends, friendsOfById, circles]);

  const prefillFromSuggestion = (memberIds) => {
    setSelected(memberIds);
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
    nameInputRef.current?.focus();
  };

  const nameOf = (id) => (id === me.id ? "You" : friends.find((f) => f.id === id)?.name ?? "…");

  const toggle = (id) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const run = async (fn) => {
    setError("");
    try {
      await fn();
      await load();
    } catch (err) {
      setError(err.message || String(err));
    }
  };

  const submit = async () => {
    if (!name.trim()) return;
    await run(async () => {
      await createCircle(name.trim(), selected);
      setName("");
      setSelected([]);
    });
  };

  const handleAddMember = (circleId, memberId) =>
    run(() => addCircleMember(circleId, memberId));

  const handleRemoveMember = (circleId, memberId) =>
    run(() => removeCircleMember(circleId, memberId));

  const handleDeleteCircle = (circle) => {
    if (!window.confirm(`Delete the circle "${circle.name}"? This can't be undone.`)) return;
    return run(async () => {
      if (expandedCircleId === circle.id) setExpandedCircleId(null);
      await deleteCircle(circle.id);
    });
  };

  if (loading) return null;

  return (
    <div className="min-h-screen bg-bg font-body">
      <div className="max-w-[620px] mx-auto px-4 pt-7 pb-16">
        <Link href="/" className="font-mono text-[11px] text-indigo">
          ← Back to Feed
        </Link>
        <h1 className="font-display font-bold text-2xl text-ink mt-2 mb-5">
          Circles
        </h1>

        {error && (
          <div className="flex items-start justify-between gap-3 bg-coral/10 border border-coral/40 rounded-xl px-4 py-2.5 mb-4 font-body text-[13px] text-coral">
            <span>{error}</span>
            <button onClick={() => setError("")} className="font-mono text-[13px] leading-none">
              ×
            </button>
          </div>
        )}

        <div className="bg-white border border-border rounded-2xl p-5 mb-6">
          <label className="block font-mono text-[11px] text-inksoft uppercase tracking-wide mb-1.5">
            New Circle
          </label>
          <input
            ref={nameInputRef}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., Sports"
            className="w-full border border-border rounded-lg px-3 py-2 font-body text-sm mb-3 outline-none"
          />
          <label className="block font-mono text-[11px] text-inksoft uppercase tracking-wide mb-1.5">
            Members ({friends.length} available)
          </label>
          <p className="font-body text-[12px] text-gray-400 mb-2">
            Everyone in a circle must be mutual friends — options that
            aren&apos;t friends with someone you&apos;ve picked are disabled.
          </p>
          <div className="flex gap-2 flex-wrap mb-4">
            {friends.map((p) => {
              const isSelected = selected.includes(p.id);
              const allowed = isSelected || isFriendsWithAll(p.id, selected);
              return (
                <button
                  key={p.id}
                  disabled={!allowed}
                  onClick={() => toggle(p.id)}
                  className={`font-display text-[13px] font-semibold px-3.5 py-1.5 rounded-full border ${
                    isSelected
                      ? "border-indigo bg-indigo/10 text-indigo"
                      : allowed
                      ? "border-border bg-white text-inksoft"
                      : "border-border bg-white text-gray-300 cursor-not-allowed"
                  }`}
                >
                  {p.name}
                </button>
              );
            })}
            {friends.length === 0 && (
              <span className="text-[13px] text-gray-400">
                No friends yet —{" "}
                <Link href="/friends" className="text-indigo">
                  add some on the Friends page
                </Link>
                .
              </span>
            )}
          </div>
          <button
            onClick={submit}
            className="font-display font-semibold text-sm px-5 py-2 rounded-full bg-ink text-white"
          >
            Create Circle
          </button>
        </div>

        {suggestions.length > 0 && (
          <div className="mb-6">
            <h2 className="font-mono text-[11px] text-inksoft uppercase tracking-wide mb-2">
              Suggested circles
            </h2>
            <div className="flex flex-col gap-2">
              {suggestions.map((memberIds) => (
                <div
                  key={memberIds.join(",")}
                  className="bg-indigo/5 border border-indigo/30 rounded-xl px-4 py-3 flex items-center justify-between gap-3"
                >
                  <span className="font-body text-[13px] text-ink">
                    {["You", ...memberIds.map(nameOf)].join(" · ")}
                    <span className="text-gray-400"> are all friends</span>
                  </span>
                  <button
                    onClick={() => prefillFromSuggestion(memberIds)}
                    className="font-display font-semibold text-[12px] px-3 py-1 rounded-full bg-indigo text-white shrink-0"
                  >
                    Create this circle
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex flex-col gap-2">
          {circles.map((c) => {
            const isOwner = c.owner_id === me.id;
            const isExpanded = expandedCircleId === c.id;
            const addableFriends = friends.filter(
              (f) => !c.memberIds.includes(f.id) && isFriendsWithAll(f.id, c.memberIds)
            );

            return (
              <div key={c.id} className="bg-white border border-border rounded-xl px-4 py-3">
                <div className="flex items-center justify-between">
                  <span className="font-display font-semibold text-ink">{c.name}</span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs text-inksoft">
                      {c.memberIds.length} Members
                    </span>
                    <button
                      onClick={() => setExpandedCircleId(isExpanded ? null : c.id)}
                      className="font-mono text-[11px] text-indigo border border-indigo/40 rounded-full px-2.5 py-0.5"
                    >
                      {isExpanded ? "Close" : "Manage"}
                    </button>
                  </div>
                </div>

                {isExpanded && (
                  <div className="mt-3 pt-3 border-t border-dashed border-border flex flex-col gap-2">
                    {c.memberIds.map((mid) => (
                      <div key={mid} className="flex items-center justify-between gap-2">
                        <span className="font-body text-[13px] text-ink">
                          {memberProfilesById[mid]?.name}
                          {mid === c.owner_id ? " (owner)" : ""}
                        </span>
                        {mid !== c.owner_id && (isOwner || mid === me.id) && (
                          <button
                            onClick={() => handleRemoveMember(c.id, mid)}
                            className="font-mono text-[11px] text-coral border border-coral/40 rounded-full px-2.5 py-0.5"
                          >
                            {mid === me.id ? "Leave" : "Remove"}
                          </button>
                        )}
                      </div>
                    ))}

                    {isOwner && (
                      <div className="mt-2">
                        <label className="block font-mono text-[10.5px] text-gray-400 uppercase tracking-wide mb-1.5">
                          Add member
                        </label>
                        <div className="flex gap-2 flex-wrap">
                          {addableFriends.length === 0 && (
                            <span className="text-[12px] text-gray-400">
                              No friends who are mutual friends with everyone here yet.
                            </span>
                          )}
                          {addableFriends.map((f) => (
                            <button
                              key={f.id}
                              onClick={() => handleAddMember(c.id, f.id)}
                              className="font-display text-[12px] font-semibold px-3 py-1 rounded-full border border-border bg-white text-inksoft"
                            >
                              + {f.name}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {isOwner && (
                      <div className="mt-3 pt-3 border-t border-dashed border-border">
                        <button
                          onClick={() => handleDeleteCircle(c)}
                          className="font-mono text-[11px] text-coral border border-coral/40 rounded-full px-3 py-1 hover:bg-coral/10"
                        >
                          Delete circle
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
