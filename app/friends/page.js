"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  getCurrentProfile,
  listProfilesByIds,
  listFriendRequests,
  findProfileByUsername,
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

function PersonRow({ profile, rel, meId, onChange }) {
  return (
    <div className="flex items-center justify-between gap-2 border border-border rounded-lg px-3 py-2">
      <Link
        href={`/profile/${profile.id}`}
        className="font-display font-semibold text-sm text-ink hover:underline"
      >
        {profile.name}
      </Link>

      {profile.id === meId && (
        <span className="font-mono text-[11px] text-gray-400">That&apos;s you!</span>
      )}

      {profile.id !== meId && !rel && (
        <button
          onClick={async () => {
            await sendFriendRequest(meId, profile.id);
            await onChange();
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
              await onChange();
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
              await onChange();
            }}
            className="font-display font-semibold text-[12px] text-white bg-indigo rounded-full px-3 py-1"
          >
            Accept
          </button>
          <button
            onClick={async () => {
              await removeFriendRequest(rel.id);
              await onChange();
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
              await onChange();
            }}
            className="font-mono text-[11px] text-inksoft border border-border rounded-full px-3 py-1"
          >
            Remove
          </button>
        </div>
      )}
    </div>
  );
}

export default function FriendsPage() {
  const router = useRouter();
  const [me, setMe] = useState(null);
  const [contacts, setContacts] = useState([]);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchUsername, setSearchUsername] = useState("");
  const [searchResult, setSearchResult] = useState(null);
  const [searchError, setSearchError] = useState("");
  const [searching, setSearching] = useState(false);

  const load = async () => {
    const profile = await getCurrentProfile();
    if (!profile) {
      router.replace("/login");
      return;
    }
    setMe(profile);
    const reqs = await listFriendRequests();
    setRequests(reqs);
    setContacts(await listProfilesByIds(reqs.map((r) => r.otherId)));
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

  const handleSearch = async () => {
    if (!searchUsername.trim() || searching) return;
    setSearching(true);
    setSearchError("");
    setSearchResult(null);
    try {
      const found = await findProfileByUsername(searchUsername.trim());
      if (!found) setSearchError("No user found with that username.");
      else setSearchResult(found);
    } catch (err) {
      setSearchError(err.message || String(err));
    } finally {
      setSearching(false);
    }
  };

  if (loading) return null;

  const relationFor = (id) => requests.find((r) => r.otherId === id);
  const people = contacts
    .map((p) => ({ profile: p, rel: relationFor(p.id) }))
    .sort((a, b) => relationRank(a.rel) - relationRank(b.rel));

  return (
    <div className="min-h-screen bg-bg font-body">
      <div className="max-w-[620px] mx-auto px-4 pt-7 pb-16">
        <Link href="/" className="font-mono text-[11px] text-indigo">
          ← Back to Feed
        </Link>
        <h1 className="font-display font-bold text-2xl text-ink mt-2 mb-5">Friends</h1>

        <div className="bg-white border border-border rounded-2xl p-5 mb-6">
          <label className="block font-mono text-[11px] text-inksoft uppercase tracking-wide mb-2">
            Find someone new
          </label>
          <p className="text-[12px] text-gray-400 font-body mb-2">
            Search by exact username — there&apos;s no directory to browse.
          </p>
          <div className="flex gap-2">
            <input
              value={searchUsername}
              onChange={(e) => setSearchUsername(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              placeholder="username"
              className="flex-1 border border-border rounded-lg px-3 py-2 font-body text-sm outline-none"
            />
            <button
              onClick={handleSearch}
              disabled={searching}
              className="font-display font-semibold text-sm px-4 py-2 rounded-full bg-ink text-white disabled:opacity-50"
            >
              {searching ? "…" : "Search"}
            </button>
          </div>
          {searchError && <p className="font-body text-[13px] text-coral mt-2">{searchError}</p>}
          {searchResult && (
            <div className="mt-3">
              <PersonRow
                profile={searchResult}
                rel={relationFor(searchResult.id)}
                meId={me.id}
                onChange={load}
              />
            </div>
          )}
        </div>

        <div className="bg-white border border-border rounded-2xl p-5 mb-6">
          <label className="block font-mono text-[11px] text-inksoft uppercase tracking-wide mb-2">
            Your requests &amp; friends
          </label>
          <div className="flex flex-col gap-2">
            {people.length === 0 && (
              <span className="text-[13px] text-gray-400">
                No requests or friends yet — search for someone above.
              </span>
            )}
            {people.map(({ profile: p, rel }) => (
              <PersonRow key={p.id} profile={p} rel={rel} meId={me.id} onChange={load} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
