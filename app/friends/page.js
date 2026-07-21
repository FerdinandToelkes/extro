"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  getCurrentProfile,
  listAllProfiles,
  listFriendRequests,
  sendFriendRequest,
  acceptFriendRequest,
  removeFriendRequest,
  subscribeToFriendRequests,
} from "../../lib/queries";

const RELATION_RANK = { incoming: 0, accepted: 1, outgoing: 2, none: 3 };

function relationRank(rel) {
  if (!rel) return RELATION_RANK.none;
  if (rel.status === "accepted") return RELATION_RANK.accepted;
  return RELATION_RANK[rel.direction];
}

export default function FriendsPage() {
  const router = useRouter();
  const [me, setMe] = useState(null);
  const [profiles, setProfiles] = useState([]);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const profile = await getCurrentProfile();
    if (!profile) {
      router.replace("/login");
      return;
    }
    setMe(profile);
    setProfiles(await listAllProfiles());
    setRequests(await listFriendRequests());
    setLoading(false);
  };

  useEffect(() => {
    (async () => {
      await load();
    })();
    const unsub = subscribeToFriendRequests(() => load());
    return unsub;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) return null;

  const relationFor = (id) => requests.find((r) => r.otherId === id);
  const people = profiles
    .filter((p) => p.id !== me.id)
    .map((p) => ({ profile: p, rel: relationFor(p.id) }))
    .sort((a, b) => relationRank(a.rel) - relationRank(b.rel));

  return (
    <div className="min-h-screen bg-bg font-body">
      <div className="max-w-[620px] mx-auto px-4 pt-7 pb-16">
        <Link href="/" className="font-mono text-[11px] text-indigo">
          ← Back to Feed
        </Link>
        <h1 className="font-display font-bold text-2xl text-ink mt-2 mb-5">
          Friends
        </h1>

        <div className="bg-white border border-border rounded-2xl p-5 mb-6">
          <label className="block font-mono text-[11px] text-inksoft uppercase tracking-wide mb-2">
            People
          </label>
          <div className="flex flex-col gap-2">
            {people.length === 0 && (
              <span className="text-[13px] text-gray-400">
                No one else is signed up yet — share the app link with friends.
              </span>
            )}
            {people.map(({ profile: p, rel }) => (
              <div
                key={p.id}
                className="flex items-center justify-between gap-2 border border-border rounded-lg px-3 py-2"
              >
                <Link
                  href={`/profile/${p.id}`}
                  className="font-display font-semibold text-sm text-ink hover:underline"
                >
                  {p.name}
                </Link>

                {!rel && (
                  <button
                    onClick={async () => {
                      await sendFriendRequest(me.id, p.id);
                      await load();
                    }}
                    className="font-mono text-[11px] text-indigo border border-indigo/40 rounded-full px-3 py-1"
                  >
                    Add Friend
                  </button>
                )}

                {rel?.status === "pending" && rel.direction === "outgoing" && (
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[11px] text-gray-400">Requested</span>
                    <button
                      onClick={async () => {
                        await removeFriendRequest(rel.id);
                        await load();
                      }}
                      className="font-mono text-[11px] text-inksoft border border-border rounded-full px-3 py-1"
                    >
                      Cancel
                    </button>
                  </div>
                )}

                {rel?.status === "pending" && rel.direction === "incoming" && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={async () => {
                        await acceptFriendRequest(rel.id);
                        await load();
                      }}
                      className="font-display font-semibold text-[12px] text-white bg-indigo rounded-full px-3 py-1"
                    >
                      Accept
                    </button>
                    <button
                      onClick={async () => {
                        await removeFriendRequest(rel.id);
                        await load();
                      }}
                      className="font-mono text-[11px] text-coral border border-coral/40 rounded-full px-3 py-1"
                    >
                      Decline
                    </button>
                  </div>
                )}

                {rel?.status === "accepted" && (
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[11px] text-sage">Friends ✓</span>
                    <button
                      onClick={async () => {
                        await removeFriendRequest(rel.id);
                        await load();
                      }}
                      className="font-mono text-[11px] text-inksoft border border-border rounded-full px-3 py-1"
                    >
                      Remove
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
