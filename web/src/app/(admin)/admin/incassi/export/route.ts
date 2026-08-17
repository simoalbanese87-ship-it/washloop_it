import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";

/** Registro incassi in CSV: è il file che si manda al commercialista.
 *
 *  Finora la ricevuta esisteva solo come email al cliente: di quello che era
 *  stato incassato non restava nessun elenco consultabile, e a fine mese si
 *  sarebbe dovuto ricostruire dal pannello Stripe riga per riga.
 *
 *  Una riga per incasso, con l'IVA scorporata: gli importi che passano da
 *  Stripe sono IVA inclusa, mentre in contabilità servono separati. L'ultima
 *  riga è il totale del periodo.
 *
 *  Solo admin: contiene nomi, email e importi. */

type Riga = {
  stripe_invoice_id: string | null;
  amount_cents: number;
  stato: string;
  fic_number: string | null;
  created_at: string;
  profiles: { full_name: string | null; client_code: string | null } | null;
};

const HEADERS = [
  "Data", "Riferimento", "Cliente", "Codice cliente", "Documento",
  "Imponibile €", "IVA 22% €", "Totale €", "Incasso Stripe",
];

/** Campo CSV: virgolette raddoppiate e formule neutralizzate (un nome che
 *  inizia con "=" non deve eseguirsi aprendo il file in Excel). */
function csv(v: string | null | undefined): string {
  const s = (v ?? "").toString();
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return `"${safe.replace(/"/g, '""')}"`;
}

/** Numeri in formato italiano: la virgola decimale, altrimenti Excel italiano
 *  legge 12.20 come dodicimiladuecento. */
const num = (cents: number) => (cents / 100).toFixed(2).replace(".", ",");

function fmtData(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("it-IT", { timeZone: "Europe/Rome", day: "2-digit", month: "2-digit", year: "numeric" });
  } catch {
    return iso;
  }
}

export async function GET(req: Request) {
  const me = await getCurrentProfile();
  if (!me || me.role !== "admin") return new NextResponse("Non autorizzato", { status: 403 });

  const { searchParams } = new URL(req.url);
  // Stessi filtri della pagina: si scarica esattamente quello che si vede.
  const dal = searchParams.get("dal");
  const al = searchParams.get("al");
  const tipo = searchParams.get("tipo");
  const giorno = (d: string | null) => (d && /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : null);

  const svc = createServiceClient();
  let q = svc
    .from("invoices")
    .select("stripe_invoice_id, amount_cents, stato, fic_number, created_at, profiles(full_name, client_code)")
    .order("created_at", { ascending: true });

  const d = giorno(dal);
  const a = giorno(al);
  if (d) q = q.gte("created_at", `${d}T00:00:00.000Z`);
  // `al` è inclusivo: si arriva a fine giornata.
  if (a) q = q.lt("created_at", new Date(new Date(`${a}T00:00:00.000Z`).getTime() + 86_400_000).toISOString());
  if (tipo === "ricevuta") q = q.eq("stato", "saltata");
  if (tipo === "fattura") q = q.eq("stato", "emessa");
  if (tipo === "richiesta") q = q.in("stato", ["da_emettere", "errore"]);

  const { data } = await q.returns<Riga[]>();
  const righe = data ?? [];

  const totale = righe.reduce((t, r) => t + r.amount_cents, 0);
  // Scorporo: gli importi Stripe sono lordi, l'imponibile è il lordo / 1,22.
  const imponibileTot = Math.round(totale / 1.22);

  const lines = [
    HEADERS.map(csv).join(","),
    ...righe.map((r) => {
      const imponibile = Math.round(r.amount_cents / 1.22);
      const documento = r.fic_number ? `Fattura n. ${r.fic_number}` : r.stato === "da_emettere" ? "Fattura richiesta" : "Ricevuta";
      return [
        fmtData(r.created_at),
        r.stripe_invoice_id ?? "",
        r.profiles?.full_name ?? "",
        r.profiles?.client_code ?? "",
        documento,
        num(imponibile),
        num(r.amount_cents - imponibile),
        num(r.amount_cents),
        "Stripe",
      ].map(csv).join(",");
    }),
    // Totale in fondo: è la prima cosa che il commercialista guarda.
    ["TOTALE", "", "", "", `${righe.length} incassi`, num(imponibileTot), num(totale - imponibileTot), num(totale), ""].map(csv).join(","),
  ];

  // BOM: senza, Excel su Mac sbaglia gli accenti.
  const body = "﻿" + lines.join("\r\n") + "\r\n";
  const periodo = d && a ? `${d}_${a}` : d ? `dal-${d}` : a ? `fino-${a}` : "tutti";
  const nome = `washloop-incassi-${tipo ?? "tutti"}-${periodo}.csv`;

  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${nome}"`,
      "Cache-Control": "no-store",
    },
  });
}
