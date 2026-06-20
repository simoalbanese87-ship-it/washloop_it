// Read-only: verifica che il flusso prenota sia testabile / funzionante in prod.
//   SUPABASE_ACCESS_TOKEN="sbp_..." node scripts/check-booking-data.mjs
import { createClient } from "@supabase/supabase-js";

const TOKEN = process.env.SUPABASE_ACCESS_TOKEN;
const REF = process.env.SUPABASE_PROJECT_REF || "rcleyqbntxaiwutdhdpx";
if (!TOKEN) { console.error("Manca SUPABASE_ACCESS_TOKEN"); process.exit(1); }

const r = await fetch(`https://api.supabase.com/v1/projects/${REF}/api-keys?reveal=true`, { headers: { Authorization: `Bearer ${TOKEN}` } });
const keys = await r.json();
const serviceKey = (keys.find((k) => k.name === "service_role" || k.type === "secret"))?.api_key;
const sb = createClient(`https://${REF}.supabase.co`, serviceKey, { auth: { persistSession: false } });

const nowIso = new Date().toISOString();

const { data: laundries } = await sb.from("laundries").select("id, name, zone_id, active");
console.log("\n== LAVANDERIE ==");
for (const l of laundries) console.log(`${l.active ? "●" : "○"} ${l.name}  zone=${l.zone_id ?? "—"}  ${l.id}`);

const { data: slots } = await sb.from("slots").select("id, kind, starts_at, laundry_id").eq("kind", "pickup").gte("starts_at", nowIso).order("starts_at").limit(200);
console.log(`\n== SLOT PICKUP FUTURI: ${slots?.length ?? 0} ==`);
const byLaundry = {};
for (const s of slots ?? []) byLaundry[s.laundry_id ?? "null"] = (byLaundry[s.laundry_id ?? "null"] || 0) + 1;
for (const [lid, n] of Object.entries(byLaundry)) {
  const name = laundries.find((l) => l.id === lid)?.name ?? lid;
  console.log(`  ${n} slot → ${name}`);
}

// cliente.test
const { data: list } = await sb.auth.admin.listUsers({ page: 1, perPage: 200 });
const cli = list?.users?.find((u) => u.email === "cliente.test@washloop.it");
console.log("\n== cliente.test@washloop.it ==", cli ? cli.id : "NON TROVATO");
if (cli) {
  const { data: prof } = await sb.from("profiles").select("role, full_name").eq("id", cli.id).maybeSingle();
  const { data: addr } = await sb.from("addresses").select("street, zone_id").eq("user_id", cli.id);
  const { data: sub } = await sb.from("subscriptions").select("status").eq("user_id", cli.id).order("created_at", { ascending: false }).limit(1).maybeSingle();
  console.log("  role:", prof?.role, "| sub:", sub?.status, "| indirizzi:", addr?.length);
  for (const a of addr ?? []) {
    const zl = laundries.filter((l) => l.active && (!a.zone_id || l.zone_id === a.zone_id));
    const eff = zl[0];
    const n = (slots ?? []).filter((s) => s.laundry_id === eff?.id).length;
    console.log(`  indirizzo "${a.street}" zone=${a.zone_id ?? "—"} → lavanderia routing="${eff?.name ?? "NESSUNA"}" slot disponibili=${n}`);
  }
}
