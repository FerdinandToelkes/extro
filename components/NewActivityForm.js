"use client";

import { useState } from "react";

const TIMEFRAMES = ["Today", "Tomorrow", "Weekend"];
const CATEGORIES = ["Sport", "Café", "Culture", "Leisure", "Food", "Other"];

export default function NewActivityForm({
  circles,
  profiles,
  friendIds,
  meId,
  onCreate,
  onClose,
  initial = null,
  mergeCandidates = [],
  onMergeWith,
}) {
  const isEditing = Boolean(initial);
  const [text, setText] = useState(initial?.text ?? "");
  const [category, setCategory] = useState(initial?.category ?? CATEGORIES[0]);
  const [timeframe, setTimeframe] = useState(initial?.timeframe ?? TIMEFRAMES[0]);
  const [location, setLocation] = useState(initial?.location ?? "");
  const [expireAfterDays, setExpireAfterDays] = useState(initial?.expireAfterDays ?? 1);
  const [visType, setVisType] = useState(
    initial?.visiblePeopleIds?.length ? "people" : "circle"
  );
  const [selectedCircles, setSelectedCircles] = useState(initial?.visibleCircleIds ?? []);
  const [selectedPeople, setSelectedPeople] = useState(initial?.visiblePeopleIds ?? []);
  const [submitting, setSubmitting] = useState(false);

  const friends = profiles.filter((p) => p.id !== meId && friendIds.includes(p.id));

  const toggle = (arr, setArr, val) =>
    setArr(arr.includes(val) ? arr.filter((v) => v !== val) : [...arr, val]);

  const submit = async () => {
    if (!text.trim() || submitting) return;
    setSubmitting(true);
    try {
      await onCreate({
        text: text.trim(),
        category,
        timeframe,
        location: location.trim(),
        expireAfterDays,
        circleIds: visType === "circle" ? selectedCircles : [],
        peopleIds: visType === "people" ? selectedPeople : [],
      });
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  const chip = (active) =>
    `font-display text-[13px] font-semibold px-3.5 py-1.5 rounded-full border cursor-pointer ${
      active ? "border-indigo bg-indigo/10 text-indigo" : "border-border bg-white text-inksoft"
    }`;

  return (
    <div className="bg-white border border-border rounded-2xl p-5 mb-5">
      <label className="block font-mono text-[11px] text-inksoft uppercase tracking-wide mb-1.5">
        What are you in the mood for?
      </label>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="e.g., I'm in the mood for a walk…"
        rows={2}
        className="w-full resize-none border border-border rounded-lg px-3 py-2.5 font-body text-[15px] mb-4 outline-none"
      />

      <label className="block font-mono text-[11px] text-inksoft uppercase tracking-wide mb-1.5">
        When
      </label>
      <div className="flex gap-2 mb-4 flex-wrap">
        {TIMEFRAMES.map((tf) => (
          <button key={tf} className={chip(timeframe === tf)} onClick={() => setTimeframe(tf)}>
            {tf}
          </button>
        ))}
      </div>

      <label className="block font-mono text-[11px] text-inksoft uppercase tracking-wide mb-1.5">
        Category
      </label>
      <div className="flex gap-2 mb-4 flex-wrap">
        {CATEGORIES.map((c) => (
          <button key={c} className={chip(category === c)} onClick={() => setCategory(c)}>
            {c}
          </button>
        ))}
      </div>

      <label className="block font-mono text-[11px] text-inksoft uppercase tracking-wide mb-1.5">
        Location <span className="normal-case tracking-normal text-gray-400">(optional)</span>
      </label>
      <input
        value={location}
        onChange={(e) => setLocation(e.target.value)}
        placeholder="e.g., near the main square, Mauerpark…"
        className="w-full border border-border rounded-lg px-3 py-2 font-body text-sm mb-4 outline-none"
      />

      <label className="block font-mono text-[11px] text-inksoft uppercase tracking-wide mb-1.5">
        Auto-delete{" "}
        <span className="normal-case tracking-normal text-gray-400">
          (days after the event)
        </span>
      </label>
      <input
        type="number"
        min={0}
        value={expireAfterDays}
        onChange={(e) => setExpireAfterDays(Math.max(0, Number(e.target.value) || 0))}
        className="w-20 border border-border rounded-lg px-3 py-2 font-body text-sm mb-4 outline-none"
      />

      <label className="block font-mono text-[11px] text-inksoft uppercase tracking-wide mb-1.5">
        Visible to
      </label>
      <div className="flex gap-2 mb-2.5">
        <button className={chip(visType === "circle")} onClick={() => setVisType("circle")}>
          Friend Circles
        </button>
        <button className={chip(visType === "people")} onClick={() => setVisType("people")}>
          Individual People
        </button>
      </div>
      {visType === "circle" ? (
        <div className="flex gap-2 mb-4 flex-wrap">
          {circles.length === 0 && (
            <span className="text-[13px] text-gray-400 font-body">
              No friend circles yet – create one under &quot;Circles&quot;.
            </span>
          )}
          {circles.map((c) => (
            <button
              key={c.id}
              className={chip(selectedCircles.includes(c.id))}
              onClick={() => toggle(selectedCircles, setSelectedCircles, c.id)}
            >
              {c.name}
            </button>
          ))}
        </div>
      ) : (
        <div className="flex gap-2 mb-4 flex-wrap">
          {friends.length === 0 && (
            <span className="text-[13px] text-gray-400 font-body">
              No friends yet – add some under &quot;Friends&quot;.
            </span>
          )}
          {friends.map((f) => (
            <button
              key={f.id}
              className={chip(selectedPeople.includes(f.id))}
              onClick={() => toggle(selectedPeople, setSelectedPeople, f.id)}
            >
              {f.name}
            </button>
          ))}
        </div>
      )}

      {isEditing && mergeCandidates.length > 0 && (
        <>
          <label className="block font-mono text-[11px] text-inksoft uppercase tracking-wide mb-1.5">
            Possible merges{" "}
            <span className="normal-case tracking-normal text-gray-400">
              (same category &amp; timeframe as this one)
            </span>
          </label>
          <div className="flex flex-col gap-2 mb-4">
            {mergeCandidates.map((c) => (
              <div
                key={c.id}
                className="flex items-center justify-between gap-2 border border-border rounded-lg px-3 py-2"
              >
                <span className="text-[13px] text-inksoft font-body">
                  <b className="font-display text-ink">
                    {profiles.find((p) => p.id === c.authorId)?.name}:
                  </b>{" "}
                  {c.text}
                </span>
                <button
                  onClick={() => onMergeWith(c)}
                  className="font-display font-semibold text-[12px] px-3 py-1 rounded-full bg-indigo text-white shrink-0"
                >
                  Merge
                </button>
              </div>
            ))}
          </div>
        </>
      )}

      <div className="flex gap-2.5 mt-4">
        <button
          onClick={submit}
          disabled={submitting}
          className="font-display font-semibold text-sm px-5 py-2 rounded-full bg-ink text-white disabled:opacity-50"
        >
          {submitting ? "…" : isEditing ? "Save Changes" : "Publish"}
        </button>
        <button
          onClick={onClose}
          className="font-display font-semibold text-sm px-5 py-2 rounded-full border border-border bg-white text-inksoft"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
