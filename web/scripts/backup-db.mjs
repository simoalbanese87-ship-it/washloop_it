/** Backup del database su file, senza dipendenze e senza pg_dump.
 *
 *  Uso (dalla cartella web/):
 *    node scripts/backup-db.mjs                    → salva in ./backup/
 *    node scripts/backup-db.mjs /percorso/cartella
 *
 *  Legge SUPABASE_PROJECT_REF e SUPABASE_ACCESS_TOKEN da .env.local.
 *
 *  Perché serve: il progetto Supabase è sul piano gratuito, che NON dà backup
 *  ripristinabili né point-in-time recovery. Se il database si corrompe o
 *  qualcuno cancella una tabella, senza questi file non si torna indietro.
 *  Non sostituisce il piano Pro: è la rete minima nel frattempo.
 *
 *  Cosa salva: tutte le tabelle dello schema `public`, una per file JSON, più
 *  gli utenti di autenticazione (email e ruolo, MAI le password: sono hash che
 *  Supabase non espone). Il ripristino è documentato in RESTORE.md, generato
 *  insieme al backup.
 */
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";

const envPath = path.join(process.cwd(), ".env.local");
const env = {};
if (fs.existsSync(envPath)) {
  for (const riga of fs.readFileSync(envPath, "utf8").split("\n")) {
    const m = riga.match(/^([A-Z_]+)=(.*)$/);
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}
const REF = process.env.SUPABASE_PROJECT_REF || env.SUPABASE_PROJECT_REF;
const TOKEN = process.env.SUPABASE_ACCESS_TOKEN || env.SUPABASE_ACCESS_TOKEN;
if (!REF || !TOKEN) {
  console.error("Mancano SUPABASE_PROJECT_REF / SUPABASE_ACCESS_TOKEN (in .env.local o come variabili).");
  process.exit(1);
}

async function sql(query) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });
  const out = await res.json();
  if (!res.ok || out?.message) throw new Error(out?.message ?? `HTTP ${res.status}`);
  return out;
}

const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const dest = path.join(process.argv[2] || path.join(process.cwd(), "backup"), stamp);
fs.mkdirSync(dest, { recursive: true });

const tabelle = (await sql(
  "select tablename from pg_tables where schemaname='public' order by tablename;",
)).map((r) => r.tablename);

console.log(`Backup di ${tabelle.length} tabelle → ${dest}\n`);

let totale = 0;
const riepilogo = [];
for (const t of tabelle) {
  // json_agg in un colpo solo: le tabelle qui sono piccole (DB ~13 MB).
  const [{ righe }] = await sql(`select coalesce(json_agg(t), '[]'::json) as righe from "${t}" t;`);
  const n = Array.isArray(righe) ? righe.length : 0;
  fs.writeFileSync(path.join(dest, `${t}.json`), JSON.stringify(righe, null, 1));
  riepilogo.push({ tabella: t, righe: n });
  totale += n;
  process.stdout.write(`  ${t.padEnd(24)} ${String(n).padStart(6)} righe\n`);
}

// Utenti auth: email e metadata. Le password sono hash e non sono esportabili.
const utenti = await sql(
  "select id, email, created_at, last_sign_in_at, raw_user_meta_data from auth.users order by created_at;",
);
fs.writeFileSync(path.join(dest, "_auth_users.json"), JSON.stringify(utenti, null, 1));
console.log(`  ${"auth.users".padEnd(24)} ${String(utenti.length).padStart(6)} righe`);

fs.writeFileSync(
  path.join(dest, "RESTORE.md"),
  `# Ripristino — backup del ${new Date().toISOString()}

Progetto Supabase: \`${REF}\` · ${totale} righe in ${tabelle.length} tabelle.

## Cosa c'è qui dentro
Un file JSON per tabella, più \`_auth_users.json\` con gli account.

## Cosa NON c'è
- **Le password**: sono hash che Supabase non espone. Al ripristino gli utenti
  vanno reinvitati o devono usare "password dimenticata".
- **I file dello Storage** (foto prova): stanno nel bucket \`proofs\`, non qui.

## Come si ripristina
1. Ricrea lo schema applicando in ordine le migration di \`web/supabase/migrations/\`.
2. Reinserisci i dati rispettando le dipendenze: prima \`plans\`, \`zones\`,
   \`zone_caps\`, \`laundries\`, \`depots\`; poi \`profiles\` (richiede gli utenti auth);
   poi \`addresses\`, \`subscriptions\`, \`slots\`; infine \`orders\` e tutto ciò che
   vi si appoggia.
3. Gli utenti auth vanno ricreati con l'API admin di Supabase usando gli id
   originali, altrimenti le foreign key di \`profiles\` non tornano.

## Attenzione
Questo backup è una rete di sicurezza, non un piano di continuità. Il piano
gratuito di Supabase non offre backup ripristinabili né point-in-time recovery:
per un servizio che incassa, il piano Pro è la scelta giusta.
`,
);

console.log(`\nSalvate ${totale} righe. Istruzioni di ripristino in ${path.join(dest, "RESTORE.md")}`);
