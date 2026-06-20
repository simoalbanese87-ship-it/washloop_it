// One-off: crea la lavanderia reale (se manca) + un account partner di test
// che vede gli ordini su /laundry. Eseguire con:
//   node --env-file=.env.local scripts/create-laundry-account.mjs
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error("Mancano NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const LAUNDRY_NAME = "Centro Pulitura Bergamo di Narisi Giuseppe & C. Snc";
const EMAIL = "lavanderia.test@washloop.it";
const PASSWORD = process.env.LAUNDRY_PASSWORD || "WashLav!2026-" + Math.random().toString(36).slice(2, 8);

const sb = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

async function main() {
  // 1) Lavanderia reale (idempotente)
  let { data: laundry } = await sb.from("laundries").select("id, name").eq("name", LAUNDRY_NAME).maybeSingle();
  if (!laundry) {
    const { data: zone } = await sb.from("zones").select("id").eq("active", true).order("name").limit(1).maybeSingle();
    const { data: ins, error } = await sb
      .from("laundries")
      .insert({ name: LAUNDRY_NAME, zone_id: zone?.id ?? null, active: true })
      .select("id, name")
      .single();
    if (error) throw error;
    laundry = ins;
    console.log("Lavanderia creata:", laundry.id);
  } else {
    console.log("Lavanderia già presente:", laundry.id);
  }

  // 2) Utente partner (auth) — crea o recupera
  let userId;
  const { data: created, error: cErr } = await sb.auth.admin.createUser({
    email: EMAIL,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: "Lavanderia WashLoop" },
  });
  if (cErr) {
    // probabilmente esiste già: lo cerco
    const { data: list } = await sb.auth.admin.listUsers({ page: 1, perPage: 200 });
    const found = list?.users?.find((u) => u.email === EMAIL);
    if (!found) throw cErr;
    userId = found.id;
    console.log("Utente già esistente:", userId, "(password invariata)");
  } else {
    userId = created.user.id;
    console.log("Utente creato:", userId);
  }

  // 3) Profilo → role partner + laundry_id (il trigger ha già creato la riga profilo)
  const { error: pErr } = await sb
    .from("profiles")
    .update({ role: "partner", laundry_id: laundry.id, full_name: "Lavanderia WashLoop" })
    .eq("id", userId);
  if (pErr) throw pErr;

  console.log("\n=== ACCOUNT LAVANDERIA (TEST) ===");
  console.log("Email:    ", EMAIL);
  if (!cErr) console.log("Password: ", PASSWORD);
  console.log("Ruolo:    partner →  /laundry");
  console.log("Lavanderia:", LAUNDRY_NAME, "(" + laundry.id + ")");
}

main().catch((e) => { console.error("ERRORE:", e.message || e); process.exit(1); });
