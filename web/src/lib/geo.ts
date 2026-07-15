import "server-only";

/** Geocoding via Nominatim (OpenStreetMap): gratis, nessuna API key.
 *  Policy OSM: max ~1 req/s, User-Agent identificativo obbligatorio. Best-effort:
 *  ritorna null se non trova o su errore (non deve mai bloccare il salvataggio). */
export async function geocodeAddress(input: {
  street?: string | null;
  civico?: string | null;
  cap?: string | null;
  city?: string | null;
}): Promise<{ lat: number; lng: number } | null> {
  const q = [
    [input.street, input.civico].filter(Boolean).join(" ").trim(),
    (input.cap ?? "").trim(),
    (input.city ?? "").trim() || "Milano",
    "Italia",
  ].filter(Boolean).join(", ");
  if (!q.replace(/[, ]/g, "")) return null;

  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=it&q=${encodeURIComponent(q)}`;
    const res = await fetch(url, {
      headers: { "User-Agent": "WashLoop/1.0 (https://washloop.it)", "Accept-Language": "it" },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { lat?: string; lon?: string }[];
    const first = Array.isArray(data) ? data[0] : null;
    if (!first?.lat || !first?.lon) return null;
    const lat = parseFloat(first.lat), lng = parseFloat(first.lon);
    return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
  } catch {
    return null;
  }
}
