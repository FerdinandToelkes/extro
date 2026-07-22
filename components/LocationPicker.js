"use client";

import { useEffect, useRef, useState } from "react";
import { searchPlaces } from "../lib/location";

// Validated location input: type to autocomplete real cities/states, then
// pick one. Only a picked suggestion counts as a location -- free text isn't
// saved. `value` is the current label; `onChange({ label, key })` fires on
// select or clear (clear passes empty strings).
export default function LocationPicker({ value, onChange }) {
  const [query, setQuery] = useState(value ?? "");
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  // Once a real place is chosen, the input reflects it and isn't "dirty".
  const [dirty, setDirty] = useState(false);
  const boxRef = useRef(null);

  useEffect(() => {
    if (!dirty) return;
    const q = query.trim();
    const t = setTimeout(async () => {
      if (q.length < 2) {
        setResults([]);
        setLoading(false);
        return;
      }
      setLoading(true);
      const places = await searchPlaces(q);
      setResults(places);
      setOpen(true);
      setLoading(false);
    }, 250);
    return () => clearTimeout(t);
  }, [query, dirty]);

  useEffect(() => {
    const onDocClick = (e) => {
      if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const pick = (place) => {
    setQuery(place.label);
    setDirty(false);
    setResults([]);
    setOpen(false);
    onChange({ label: place.label, key: place.key });
  };

  const clear = () => {
    setQuery("");
    setDirty(false);
    setResults([]);
    setOpen(false);
    onChange({ label: "", key: "" });
  };

  return (
    <div className="relative" ref={boxRef}>
      <div className="flex gap-2">
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setDirty(true);
          }}
          onFocus={() => results.length && setOpen(true)}
          placeholder="Start typing a city or state…"
          className="w-full border border-border rounded-lg px-3 py-2 font-body text-sm outline-none"
        />
        {value && (
          <button
            type="button"
            onClick={clear}
            className="font-mono text-[11px] text-inksoft border border-border rounded-full px-3"
          >
            Clear
          </button>
        )}
      </div>

      {open && (loading || results.length > 0) && (
        <div className="absolute left-0 right-0 mt-1 bg-white border border-border rounded-lg shadow-lg z-40 overflow-hidden">
          {loading && results.length === 0 ? (
            <div className="px-3 py-2 font-body text-[13px] text-gray-400">Searching…</div>
          ) : (
            results.map((place) => (
              <button
                key={place.key}
                type="button"
                onClick={() => pick(place)}
                className="w-full text-left px-3 py-2 font-body text-[13.5px] text-ink hover:bg-bg border-b border-border last:border-0"
              >
                {place.label}
              </button>
            ))
          )}
        </div>
      )}
      {dirty && query.trim().length >= 2 && !loading && results.length === 0 && (
        <p className="text-[11px] text-gray-400 font-mono mt-1">
          Pick a suggestion — only real places can be saved.
        </p>
      )}
    </div>
  );
}
