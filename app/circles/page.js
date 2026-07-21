"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  getCurrentProfile,
  listProfilesByIds,
  listCirclesWithMembers,
  listFriendRequests,
  createCircle,
  addCircleMember,
  removeCircleMember,
} from "../../lib/queries";

export default function CirclesPage() {
  const router = useRouter();
  const [me, setMe] = useState(null);
  const [friends, setFriends] = useState([]);
  const [circles, setCircles] = useState([]);
  const [memberProfilesById, setMemberProfilesById] = useState({});
  const [name, setName] = useState("");
  const [selected, setSelected] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedCircleId, setExpandedCircleId] = useState(null);

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
    setLoading(false);
  };

  useEffect(() => {
    (async () => {
      await load();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggle = (id) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const submit = async () => {
    if (!name.trim()) return;
    await createCircle(name.trim(), selected, me.id);
    setName("");
    setSelected([]);
    await load();
  };

  const handleAddMember = async (circleId, memberId) => {
    await addCircleMember(circleId, memberId);
    await load();
  };

  const handleRemoveMember = async (circleId, memberId) => {
    await removeCircleMember(circleId, memberId);
    await load();
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

        <div className="bg-white border border-border rounded-2xl p-5 mb-6">
          <label className="block font-mono text-[11px] text-inksoft uppercase tracking-wide mb-1.5">
            New Circle
          </label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., Sports"
            className="w-full border border-border rounded-lg px-3 py-2 font-body text-sm mb-3 outline-none"
          />
          <label className="block font-mono text-[11px] text-inksoft uppercase tracking-wide mb-1.5">
            Members ({friends.length} available)
          </label>
          <div className="flex gap-2 flex-wrap mb-4">
            {friends.map((p) => (
              <button
                key={p.id}
                onClick={() => toggle(p.id)}
                className={`font-display text-[13px] font-semibold px-3.5 py-1.5 rounded-full border ${
                  selected.includes(p.id)
                    ? "border-indigo bg-indigo/10 text-indigo"
                    : "border-border bg-white text-inksoft"
                }`}
              >
                {p.name}
              </button>
            ))}
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

        <div className="flex flex-col gap-2">
          {circles.map((c) => {
            const isOwner = c.owner_id === me.id;
            const isExpanded = expandedCircleId === c.id;
            const addableFriends = friends.filter((f) => !c.memberIds.includes(f.id));

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
                              No more friends to add.
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
