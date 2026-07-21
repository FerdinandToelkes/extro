"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import {
  getCurrentProfile,
  getProfileById,
  listFriendRequests,
  listFriendsOf,
  sendFriendRequest,
  acceptFriendRequest,
  removeFriendRequest,
  subscribeToFriendRequests,
} from "../../../lib/queries";
import Avatar from "../../../components/Avatar";

export default function ViewProfilePage() {
  const router = useRouter();
  const { id } = useParams();
  const [me, setMe] = useState(null);
  const [profile, setProfile] = useState(null);
  const [rel, setRel] = useState(null);
  const [friends, setFriends] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const meProfile = await getCurrentProfile();
    if (!meProfile) {
      router.replace("/login");
      return;
    }
    if (id === meProfile.id) {
      router.replace("/profile");
      return;
    }
    setMe(meProfile);
    const [target, requests] = await Promise.all([getProfileById(id), listFriendRequests()]);
    setProfile(target);
    const foundRel = requests.find((r) => r.otherId === id) ?? null;
    setRel(foundRel);
    setFriends(foundRel?.status === "accepted" ? await listFriendsOf(id) : []);
    setLoading(false);
  };

  useEffect(() => {
    (async () => {
      await load();
    })();
    const unsub = subscribeToFriendRequests(() => load());
    return unsub;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (loading) return null;

  if (!profile) {
    return (
      <div className="min-h-screen bg-bg font-body">
        <div className="max-w-[620px] mx-auto px-4 pt-7 pb-16">
          <Link href="/" className="font-mono text-[11px] text-indigo">
            ← Back to Feed
          </Link>
          <p className="mt-4 font-body text-sm text-gray-400">Profile not found.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg font-body">
      <div className="max-w-[620px] mx-auto px-4 pt-7 pb-16">
        <Link href="/" className="font-mono text-[11px] text-indigo">
          ← Back to Feed
        </Link>

        <div className="bg-white border border-border rounded-2xl p-5 mt-4 flex items-start gap-4">
          <Avatar profile={profile} size={56} />
          <div className="flex-1 min-w-0">
            <h1 className="font-display font-bold text-xl text-ink">{profile.name}</h1>
            {profile.username && (
              <div className="font-mono text-[11px] text-gray-400">@{profile.username}</div>
            )}
            {profile.city && (
              <div className="font-mono text-[11.5px] text-inksoft mt-1">📍 {profile.city}</div>
            )}
            {profile.bio && <p className="font-body text-sm text-inksoft mt-2">{profile.bio}</p>}

            {profile.available_until && new Date(profile.available_until) > new Date() && (
              <div className="font-body text-[13px] text-sage mt-2">
                🟢 Free: {profile.available_day} · {profile.available_time_of_day}
              </div>
            )}

            <div className="mt-4">
              {!rel && (
                <button
                  onClick={async () => {
                    await sendFriendRequest(me.id, profile.id);
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
          </div>
        </div>

        <div className="bg-white border border-border rounded-2xl p-5 mt-4">
          <label className="block font-mono text-[11px] text-inksoft uppercase tracking-wide mb-2">
            Friends
          </label>
          {rel?.status === "accepted" ? (
            friends.length === 0 ? (
              <span className="text-[13px] text-gray-400">No friends yet.</span>
            ) : (
              <div className="flex flex-wrap gap-2">
                {friends.map((f) => (
                  <Link
                    key={f.id}
                    href={`/profile/${f.id}`}
                    className="font-display text-[13px] font-semibold text-ink border border-border rounded-full px-3 py-1 hover:underline"
                  >
                    {f.name}
                  </Link>
                ))}
              </div>
            )
          ) : (
            <span className="text-[13px] text-gray-400">
              Become friends with {profile.name} to see their friends.
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
