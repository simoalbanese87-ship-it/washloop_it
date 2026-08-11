/** Backfill coordinate indirizzi.
 *
 *  Uso (dalla cartella web/):
 *    URL=https://<ref>.supabase.co KEY=<service_role> node scripts/backfill-geo.mjs
 *
 *  Perché serve: gli indirizzi salvati prima dell'introduzione del geocoding non
 *  hanno lat/lng. Il percorso ottimizzato li mette in coda e la mappa del rider
 *  non li mostra affatto. Nominatim chiede max ~1 richiesta al secondo.
 */
import { createClient } from "@supabase/supabase-js";
const svc = createClient(process.env.URL, process.env.KEY, { auth: { persistSession: false } });
const attesa = (ms) => new Promise((r) => setTimeout(r, ms));

const { data: rows, error: errSel } = await svc.from("addresses").select("id, street, civico, cap").is("lat", null);
if (errSel) { console.error("query fallita:", errSel.message); process.exit(1); }
console.log(`indirizzi senza coordinate: ${rows?.length ?? 0}`);

let ok = 0, ko = 0;
for (const a of rows ?? []) {
  // Gli indirizzi vecchi hanno CAP e città già dentro `street`: se li
  // riappendiamo la query diventa "Milano, 20100, Milano" e Nominatim non
  // trova nulla. Teniamo solo i pezzi che non sono CAP o città.
  const pezzi = String(a.street ?? "")
    .split(",")
    .map((p) => p.trim())
    .filter((p) => p && !/^\d{5}$/.test(p) && !/^milan/i.test(p) && !/^italia$/i.test(p));
  const via = [pezzi.join(" ").replace(/\s+/g, " ").trim(), a.civico].filter(Boolean).join(" ").trim();
  const q = [via, (a.cap ?? "").trim(), "Milano", "Italia"].filter(Boolean).join(", ");
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=it&q=${encodeURIComponent(q)}`;
  try {
    const res = await fetch(url, { headers: { "User-Agent": "WashLoop/1.0 (https://washloop.it)", "Accept-Language": "it" } });
    const data = await res.json();
    const first = Array.isArray(data) ? data[0] : null;
    if (first?.lat && first?.lon) {
      await svc.from("addresses").update({ lat: parseFloat(first.lat), lng: parseFloat(first.lon) }).eq("id", a.id);
      console.log(`  ✓ ${q.slice(0, 46)} → ${first.lat}, ${first.lon}`);
      ok++;
    } else {
      console.log(`  ✗ ${q.slice(0, 46)} → nessun risultato`);
      ko++;
    }
  } catch (e) {
    console.log(`  ✗ ${q.slice(0, 46)} → ${e.message}`);
    ko++;
  }
  await attesa(1100); // rispetta la policy OSM
}
const { count } = await svc.from("addresses").select("id", { count: "exact", head: true }).is("lat", null);
console.log(`\ngeocodificati ${ok}, falliti ${ko} · restano senza coordinate: ${count}`);
