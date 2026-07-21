"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  getCurrentProfile,
  listAllProfiles,
  listCirclesWithMembers,
  listFriendRequests,
  createCircle,
} from "../../lib/queries";

export default function CirclesPage() {
  const router = useRouter();
  const [me, setMe] = useState(null);
  const [profiles, setProfiles] = useState([]);
  const [circles, setCircles] = useState([]);
  const [requests, setRequests] = useState([]);
  const [name, setName] = useState("");
  const [selected, setSelected] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const profile = await getCurrentProfile();
    if (!profile) {
      router.replace("/login");
      return;
    }
    setMe(profile);
    setProfiles(await listAllProfiles());
    setCircles(await listCirclesWithMembers());
    setRequests(await listFriendRequests());
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

  if (loading) return null;

  const friendIds = requests.filter((r) => r.status === "accepted").map((r) => r.otherId);

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
            Members ({friendIds.length} available)
          </label>
          <div className="flex gap-2 flex-wrap mb-4">
            {profiles
              .filter((p) => friendIds.includes(p.id))
              .map((p) => (
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
            {friendIds.length === 0 && (
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
          {circles.map((c) => (
            <div
              key={c.id}
              className="bg-white border border-border rounded-xl px-4 py-3 flex items-center justify-between"
            >
              <span className="font-display font-semibold text-ink">{c.name}</span>
              <span className="font-mono text-xs text-inksoft">
                {c.memberIds.length} Members
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
