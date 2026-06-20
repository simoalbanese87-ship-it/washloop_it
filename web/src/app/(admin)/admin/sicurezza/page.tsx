import { Card, PageTitle } from "@/components/app/AppShell";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Status = "ok" | "warn" | "fail";
type Check = { label: string; status: Status; detail: string };

const has = (v?: string) => !!(v && v.replace(/\s+/g, "").length > 0);

function StatusDot({ s }: { s: Status }) {
  const map: Record<Status, string> = { ok: "bg-[#1F8A5B]", warn: "bg-[#E08A00]", fail: "bg-[#C0392B]" };
  return <span className={`mt-1.5 inline-block h-2.5 w-2.5 shrink-0 rounded-full ${map[s]}`} />;
}

function CheckRow({ c }: { c: Check }) {
  return (
    <div className="flex items-start gap-3 border-b border-line py-3 last:border-0">
      <StatusDot s={c.status} />
      <div>
        <div className="font-display text-sm font-bold text-navy">{c.label}</div>
        <div className="text-sm font-medium text-muted">{c.detail}</div>
      </div>
    </div>
  );
}

export default async function SicurezzaPage() {
  // --- Check di configurazione (server-side, solo booleani: nessun segreto esposto) ---
  const env: Check[] = [
    { label: "Supabase service role key", status: has(process.env.SUPABASE_SERVICE_ROLE_KEY) ? "ok" : "fail", detail: has(process.env.SUPABASE_SERVICE_ROLE_KEY) ? "Configurata" : "Mancante: operazioni server bloccate" },
    { label: "Stripe secret key", status: has(process.env.STRIPE_SECRET_KEY) ? "ok" : "fail", detail: has(process.env.STRIPE_SECRET_KEY) ? "Configurata" : "Mancante: pagamenti non operativi" },
    { label: "Stripe webhook secret", status: has(process.env.STRIPE_WEBHOOK_SECRET) ? "ok" : "fail", detail: has(process.env.STRIPE_WEBHOOK_SECRET) ? "Configurato" : "Mancante: sync abbonamenti a rischio" },
    { label: "Email SMTP", status: has(process.env.SMTP_HOST) && has(process.env.SMTP_USER) && has(process.env.SMTP_PASS) ? "ok" : "warn", detail: has(process.env.SMTP_HOST) ? "Configurato" : "Non configurato: le email vengono saltate" },
    { label: "URL sito in HTTPS", status: (process.env.NEXT_PUBLIC_SITE_URL ?? "").startsWith("https://") ? "ok" : "warn", detail: process.env.NEXT_PUBLIC_SITE_URL || "Non impostato" },
  ];

  // --- Audit del database (richiede la function security_audit, migration 0010) ---
  const supabase = await createClient();
  const { data: audit, error } = await supabase.rpc("security_audit");

  const db: Check[] = [];
  let auditAvailable = false;
  if (!error && audit) {
    auditAvailable = true;
    const a = audit as {
      tables_without_rls: string[];
      tables_without_policy: string[];
      role_counts: Record<string, number>;
      profiles_total: number;
      profiles_without_client_code: number;
    };
    const noRls = a.tables_without_rls ?? [];
    const noPol = a.tables_without_policy ?? [];
    db.push({
      label: "Row Level Security su tutte le tabelle",
      status: noRls.length === 0 ? "ok" : "fail",
      detail: noRls.length === 0 ? "Tutte le tabelle hanno RLS attiva" : `RLS DISATTIVA su: ${noRls.join(", ")}`,
    });
    db.push({
      label: "Policy presenti dove RLS è attiva",
      status: noPol.length === 0 ? "ok" : "warn",
      detail: noPol.length === 0 ? "Nessuna tabella senza policy" : `RLS senza policy su: ${noPol.join(", ")}`,
    });
    db.push({
      label: "Codice cliente anonimo su tutti i profili",
      status: (a.profiles_without_client_code ?? 0) === 0 ? "ok" : "warn",
      detail: `${a.profiles_without_client_code}/${a.profiles_total} profili senza codice (privacy lavanderia)`,
    });
    const roles = a.role_counts ?? {};
    db.push({
      label: "Account per ruolo",
      status: "ok",
      detail: `admin: ${roles.admin ?? 0} · partner: ${roles.partner ?? 0} · courier: ${roles.courier ?? 0} · customer: ${roles.customer ?? 0}`,
    });
  }

  const all = [...env, ...db];
  const fails = all.filter((c) => c.status === "fail").length;
  const warns = all.filter((c) => c.status === "warn").length;
  const overall: Status = fails > 0 ? "fail" : warns > 0 ? "warn" : "ok";
  const overallText =
    overall === "ok" ? "Tutti i controlli superati" : overall === "warn" ? `${warns} avvisi da verificare` : `${fails} problemi critici · ${warns} avvisi`;

  return (
    <>
      <PageTitle kicker="Admin" title="Sicurezza" sub="Stato di configurazione e protezione del sistema. Aggiornato a ogni apertura." />

      <Card className={`mb-6 ${overall === "ok" ? "bg-[#1F8A5B]/8" : overall === "warn" ? "bg-[#E08A00]/8" : "bg-[#C0392B]/8"}`}>
        <div className="flex items-center gap-3">
          <StatusDot s={overall} />
          <span className="font-display text-lg font-extrabold text-navy">{overallText}</span>
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="mb-2 font-display text-base font-extrabold text-navy">Configurazione & segreti</h2>
          {env.map((c) => <CheckRow key={c.label} c={c} />)}
        </Card>

        <Card>
          <h2 className="mb-2 font-display text-base font-extrabold text-navy">Database & privacy</h2>
          {auditAvailable ? (
            db.map((c) => <CheckRow key={c.label} c={c} />)
          ) : (
            <div className="py-3">
              <p className="text-sm font-semibold text-[#C0392B]">Audit DB non disponibile.</p>
              <p className="mt-1 text-sm font-medium text-muted">
                Applica la migration <code>0010_security_audit.sql</code> (Supabase SQL Editor) per abilitare i controlli su RLS, policy e privacy.
              </p>
            </div>
          )}
        </Card>
      </div>

      <p className="mt-6 text-xs font-medium text-muted">
        Nota: questa pagina mostra solo metadati di configurazione (presenza/assenza), mai i valori dei segreti.
      </p>
    </>
  );
}
