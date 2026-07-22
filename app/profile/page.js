"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getCurrentProfile, updateMyProfile, deleteMyAccount } from "../../lib/queries";
import { TAGS } from "../../lib/tags";

const USERNAME_RE = /^[a-z0-9_]{3,20}$/;
const USERNAME_HINT = "3-20 characters: lowercase letters, numbers, underscore.";

// A username can only be changed once every 6 months. Given when it last
// changed, returns the Date it can next change (or null if never changed).
function nextUsernameChange(changedAt) {
  if (!changedAt) return null;
  const d = new Date(changedAt);
  d.setMonth(d.getMonth() + 6);
  return d;
}

export default function ProfilePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [city, setCity] = useState("");
  const [bio, setBio] = useState("");
  const [subscribedTags, setSubscribedTags] = useState([]);
  const [usernameChangedAt, setUsernameChangedAt] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [deleting, setDeleting] = useState(false);

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
      setSubscribedTags(profile.subscribed_tags ?? []);
      setUsernameChangedAt(profile.username_changed_at ?? null);
      setLoading(false);
    })();
  }, [router]);

  const nextChange = nextUsernameChange(usernameChangedAt);
  const usernameLocked = Boolean(nextChange && nextChange > new Date());

  const toggleTag = (t) =>
    setSubscribedTags((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));

  const chip = (active) =>
    `font-display text-[13px] font-semibold px-3.5 py-1.5 rounded-full border cursor-pointer ${
      active ? "border-indigo bg-indigo/10 text-indigo" : "border-border bg-white text-inksoft"
    }`;

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
        subscribedTags,
      });
      setSaved(true);
      // Re-read the authoritative cooldown stamp (the DB trigger only stamps
      // it when the username actually changed).
      const fresh = await getCurrentProfile();
      setUsernameChangedAt(fresh?.username_changed_at ?? null);
    } catch (err) {
      setError(err.message || String(err));
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (
      !window.confirm(
        "Delete your account permanently? This removes your profile, activities, groups you own, friendships, and availability. This cannot be undone."
      )
    )
      return;
    setDeleting(true);
    setError("");
    try {
      await deleteMyAccount();
      router.replace("/login");
    } catch (err) {
      setError(err.message || String(err));
      setDeleting(false);
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
              disabled={usernameLocked}
              className="w-full border border-border rounded-lg px-3 py-2 font-body text-sm outline-none disabled:bg-bg disabled:text-inksoft"
            />
            {usernameLocked ? (
              <p className="text-[11px] text-gray-400 font-mono mt-1">
                A username can only be changed once every 6 months. You can change it
                again on{" "}
                {nextChange.toLocaleDateString(undefined, {
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                })}
                .
              </p>
            ) : (
              <p className="text-[11px] text-gray-400 font-mono mt-1">{USERNAME_HINT}</p>
            )}
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

          <div>
            <label className="block font-mono text-[11px] text-inksoft uppercase tracking-wide mb-1.5">
              My Interests{" "}
              <span className="normal-case tracking-normal text-gray-400">
                (matching activities get highlighted on your feed)
              </span>
            </label>
            <div className="flex gap-2 flex-wrap max-h-32 overflow-y-auto border border-border rounded-lg p-2">
              {TAGS.map((t) => (
                <button key={t} className={chip(subscribedTags.includes(t))} onClick={() => toggleTag(t)}>
                  {t}
                </button>
              ))}
            </div>
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

        <div className="bg-white border border-coral/30 rounded-2xl p-5">
          <label className="block font-mono text-[11px] text-coral uppercase tracking-wide mb-1.5">
            Danger zone
          </label>
          <p className="font-body text-[13px] text-inksoft mb-3">
            Permanently delete your account and everything tied to it — your profile,
            activities, groups you own, friendships, and availability. This can&apos;t
            be undone.
          </p>
          <button
            onClick={handleDeleteAccount}
            disabled={deleting}
            className="font-display font-semibold text-sm px-5 py-2 rounded-full border border-coral text-coral hover:bg-coral/10 disabled:opacity-50"
          >
            {deleting ? "Deleting…" : "Delete my account"}
          </button>
        </div>
      </div>
    </div>
  );
}
