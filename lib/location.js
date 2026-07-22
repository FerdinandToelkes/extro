// Real-place autocomplete via Photon (Komoot's free, keyless OpenStreetMap
// geocoder). Restricted to city + state/region granularity on purpose -- we
// never store anything more exact than that. Returns coarse place labels only.

const PHOTON_URL = "https://photon.komoot.io/api/";

// Build a human label like "Berlin, New Hampshire, United States" /
// "Berlin, Germany" / "Bavaria, Germany" from a Photon feature's properties.
function labelFor(p) {
  const parts = [p.name];
  if (p.state && p.state !== p.name) parts.push(p.state);
  if (p.country) parts.push(p.country);
  return parts.filter(Boolean).join(", ");
}

// Searches real cities and states matching `query`. Returns
// `[{ label, key }]` (key is the lowercased label, used for "nearby"
// matching). Returns [] on empty query or any network error.
export async function searchPlaces(query) {
  const q = query.trim();
  if (q.length < 2) return [];
  const params = new URLSearchParams({ q, limit: "6", lang: "en" });
  // Repeated `layer` params restrict results to cities and states.
  const url = `${PHOTON_URL}?${params.toString()}&layer=city&layer=state`;
  try {
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = await res.json();
    const seen = new Set();
    const out = [];
    for (const f of data.features ?? []) {
      const p = f.properties ?? {};
      if (!p.name || !p.country) continue;
      const label = labelFor(p);
      const key = label.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ label, key });
    }
    return out;
  } catch {
    return [];
  }
}
