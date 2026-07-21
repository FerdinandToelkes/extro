"use client";

import { useState } from "react";
import Link from "next/link";

const DAYS = ["Today", "Tomorrow", "Weekend"];
const TIMES_OF_DAY = ["Morning", "Afternoon", "Evening", "Anytime"];

function isActive(profile) {
  return Boolean(profile?.available_until) && new Date(profile.available_until) > new Date();
}

export default function AvailabilityBar({ me, friends, onShare, onClear }) {
  const [day, setDay] = useState(DAYS[0]);
  const [timeOfDay, setTimeOfDay] = useState(TIMES_OF_DAY[0]);
  const [saving, setSaving] = useState(false);

  const chip = (active) =>
    `font-display text-[13px] font-semibold px-3.5 py-1.5 rounded-full border cursor-pointer ${
      active ? "border-indigo bg-indigo/10 text-indigo" : "border-border bg-white text-inksoft"
    }`;

  const myActive = isActive(me);
  const activeFriends = friends.filter(isActive);

  const share = async () => {
    setSaving(true);
    try {
      await onShare(day, timeOfDay);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white border border-border rounded-2xl p-4 mb-5">
      <label className="block font-mono text-[11px] text-inksoft uppercase tracking-wide mb-2">
        Availability
      </label>

      {myActive ? (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-body text-[14px] text-ink">
            You&apos;re sharing: {me.available_day} · {me.available_time_of_day}
          </span>
          <button
            onClick={onClear}
            className="font-mono text-[11px] text-inksoft border border-border rounded-full px-3 py-1"
          >
            Clear
          </button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex gap-1.5 flex-wrap">
            {DAYS.map((d) => (
              <button key={d} className={chip(day === d)} onClick={() => setDay(d)}>
                {d}
              </button>
            ))}
          </div>
          <div className="flex gap-1.5 flex-wrap">
            {TIMES_OF_DAY.map((t) => (
              <button key={t} className={chip(timeOfDay === t)} onClick={() => setTimeOfDay(t)}>
                {t}
              </button>
            ))}
          </div>
          <button
            onClick={share}
            disabled={saving}
            className="font-display font-semibold text-[13px] px-4 py-1.5 rounded-full bg-ink text-white disabled:opacity-50"
          >
            {saving ? "…" : "Share"}
          </button>
        </div>
      )}

      {activeFriends.length > 0 && (
        <div className="flex flex-col gap-1.5 mt-3 pt-3 border-t border-dashed border-border">
          <span className="font-mono text-[10.5px] text-gray-400 uppercase tracking-wide">
            Friends who are free
          </span>
          <div className="flex flex-wrap gap-2">
            {activeFriends.map((f) => (
              <Link
                key={f.id}
                href={`/profile/${f.id}`}
                className="font-body text-[13px] text-ink border border-border rounded-full px-3 py-1 hover:underline"
              >
                🟢 {f.name} — {f.available_day} · {f.available_time_of_day}
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
