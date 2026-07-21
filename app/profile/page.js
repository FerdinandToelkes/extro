"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getCurrentProfile, updateMyProfile } from "../../lib/queries";

const USERNAME_RE = /^[a-z0-9_]{3,20}$/;
const USERNAME_HINT = "3-20 characters: lowercase letters, numbers, underscore.";

export default function ProfilePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [city, setCity] = useState("");
  const [bio, setBio] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      const profile = await getCurrentProfile();
      if (!profile) {
        router.replace("/login");
        return;
      }
      setName(profile.name ?? "");
      setUsername(profile.username ?? "");
      setCity(profile.city ?? "");
      setBio(profile.bio ?? "");
      setLoading(false);
    })();
  }, [router]);

  const submit = async () => {
    if (!name.trim() || saving) return;
    const normalizedUsername = username.trim().toLowerCase();
    if (normalizedUsername && !USERNAME_RE.test(normalizedUsername)) {
      setError(`Username: ${USERNAME_HINT}`);
      return;
    }
    setSaving(true);
    setSaved(false);
    setError("");
    try {
      await updateMyProfile({
        name: name.trim(),
        username: normalizedUsername,
        city: city.trim(),
        bio: bio.trim(),
      });
      setSaved(true);
    } catch (err) {
      setError(err.message || String(err));
    } finally {
      setSaving(false);
    }
  };

  if (loading) return null;

  return (
    <div className="min-h-screen bg-bg font-body">
      <div className="max-w-[620px] mx-auto px-4 pt-7 pb-16">
        <Link href="/" className="font-mono text-[11px] text-indigo">
          ← Back to Feed
        </Link>
        <h1 className="font-display font-bold text-2xl text-ink mt-2 mb-5">My Profile</h1>

        <div className="bg-white border border-border rounded-2xl p-5 mb-5 flex flex-col gap-4">
          <div>
            <label className="block font-mono text-[11px] text-inksoft uppercase tracking-wide mb-1.5">
              Name
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full border border-border rounded-lg px-3 py-2 font-body text-sm outline-none"
            />
          </div>

          <div>
            <label className="block font-mono text-[11px] text-inksoft uppercase tracking-wide mb-1.5">
              Username{" "}
              <span className="normal-case tracking-normal text-gray-400">
                (unique — the only way friends can find you to add you)
              </span>
            </label>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="e.g., alice_b"
              className="w-full border border-border rounded-lg px-3 py-2 font-body text-sm outline-none"
            />
            <p className="text-[11px] text-gray-400 font-mono mt-1">{USERNAME_HINT}</p>
          </div>

          <div>
            <label className="block font-mono text-[11px] text-inksoft uppercase tracking-wide mb-1.5">
              City{" "}
              <span className="normal-case tracking-normal text-gray-400">
                (optional — lets you filter the feed to people in the same city)
              </span>
            </label>
            <input
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="e.g., Berlin"
              className="w-full border border-border rounded-lg px-3 py-2 font-body text-sm outline-none"
            />
          </div>

          <div>
            <label className="block font-mono text-[11px] text-inksoft uppercase tracking-wide mb-1.5">
              Bio <span className="normal-case tracking-normal text-gray-400">(optional)</span>
            </label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="e.g., into climbing and board games"
              rows={2}
              className="w-full resize-none border border-border rounded-lg px-3 py-2 font-body text-sm outline-none"
            />
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={submit}
              disabled={saving}
              className="font-display font-semibold text-sm px-5 py-2 rounded-full bg-ink text-white disabled:opacity-50"
            >
              {saving ? "…" : "Save"}
            </button>
            {saved && <span className="font-body text-sm text-sage">Saved!</span>}
            {error && <span className="font-body text-sm text-coral">{error}</span>}
          </div>
        </div>
      </div>
    </div>
  );
}
