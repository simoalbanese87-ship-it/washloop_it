// Setup lavanderia reale + account partner di test, usando il Management API token.
// Nessun segreto è scritto nel file: token via env.
//   SUPABASE_ACCESS_TOKEN="sbp_..." node scripts/setup-laundry.mjs
import { createClient } from "@supabase/supabase-js";

const TOKEN = process.env.SUPABASE_ACCESS_TOKEN;
const REF = process.env.SUPABASE_PROJECT_REF || "rcleyqbntxaiwutdhdpx";
if (!TOKEN) { console.error("Manca SUPABASE_ACCESS_TOKEN"); process.exit(1); }

const LAUNDRY_NAME = "Centro Pulitura Bergamo di Narisi Giuseppe & C. Snc";
const EMAIL = process.env.LAUNDRY_EMAIL || "lavanderia.test@washloop.it";
const PASSWORD = process.env.LAUNDRY_PASSWORD || "WashLav!2026-" + Math.random().toString(36).slice(2, 8);

async function main() {
  // 1) Service role key via Management API
  const r = await fetch(`https://api.supabase.com/v1/projects/${REF}/api-keys?reveal=true`, {
    headers: { Authorization: `Bearer ${TOKEN}` },
  });
  if (!r.ok) throw new Error("api-keys: " + r.status + " " + (await r.text()));
  const keys = await r.json();
  const svc = keys.find((k) => k.name === "service_role" || k.type === "secret");
  if (!svc?.api_key) throw new Error("service_role key non trovata. Keys: " + keys.map((k) => k.name).join(", "));
  const serviceKey = svc.api_key;
  const url = `https://${REF}.supabase.co`;
  console.log("Service key recuperata ✓");

  const sb = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

  // 2) Lavanderia reale (idempotente)
  let { data: laundry } = await sb.from("laundries").select("id").eq("name", LAUNDRY_NAME).maybeSingle();
  if (!laundry) {
    const { data: zone } = await sb.from("zones").select("id").eq("active", true).order("name").limit(1).maybeSingle();
    const { data: ins, error } = await sb.from("laundries").insert({ name: LAUNDRY_NAME, zone_id: zone?.id ?? null, active: true }).select("id").single();
    if (error) throw error;
    laundry = ins;
    console.log("Lavanderia creata ✓", laundry.id);
  } else {
    console.log("Lavanderia già presente ✓", laundry.id);
  }

  // 3) Utente partner (auth)
  let userId, createdNow = true;
  const { data: created, error: cErr } = await sb.auth.admin.createUser({
    email: EMAIL, password: PASSWORD, email_confirm: true, user_metadata: { full_name: "Lavanderia WashLoop" },
  });
  if (cErr) {
    createdNow = false;
    const { data: list } = await sb.auth.admin.listUsers({ page: 1, perPage: 200 });
    const found = list?.users?.find((u) => u.email === EMAIL);
    if (!found) throw cErr;
    userId = found.id;
    console.log("Utente già esistente ✓ (password invariata)", userId);
  } else {
    userId = created.user.id;
    console.log("Utente creato ✓", userId);
  }

  // 4) Profilo → partner + laundry_id
  const { error: pErr } = await sb.from("profiles").update({ role: "partner", laundry_id: laundry.id, full_name: "Lavanderia WashLoop" }).eq("id", userId);
  if (pErr) throw pErr;
  console.log("Profilo elevato a partner ✓");

  console.log("\n=== ACCOUNT LAVANDERIA (TEST) ===");
  console.log("Email:    ", EMAIL);
  console.log("Password: ", createdNow ? PASSWORD : "(invariata — utente già esistente)");
  console.log("Portale:  /laundry");
}

main().catch((e) => { console.error("ERRORE:", e.message || e); process.exit(1); });
