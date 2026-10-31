import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { cassaTraLe } from "@/lib/cassa";
import { romeLocalToISO } from "@/lib/format";

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
  incassato_at: string | null;
  created_at: string;
  rimborsato_at: string | null;
  rimborsato_cents: number | null;
  profiles: { full_name: string | null; client_code: string | null } | null;
};

// Le colonne del rimborso ci sono anche quando non si scarica nessun
// rimborso: un file che cambia forma a seconda del filtro è un file che il
// commercialista deve ricontrollare ogni volta. «Netto» è quello che è
// rimasto davvero in cassa, ed è la colonna su cui si fattura.
const HEADERS = [
  "Data", "Riferimento", "Cliente", "Codice cliente", "Documento",
  "Imponibile €", "IVA 22% €", "Totale €", "Rimborsato €", "Netto €", "Incasso Stripe",
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
  const mostraRimborsate = searchParams.get("rimborsate") === "1";
  const giorno = (d: string | null) => (d && /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : null);

  const svc = createServiceClient();
  let q = svc
    .from("invoices")
    .select("stripe_invoice_id, amount_cents, stato, fic_number, incassato_at, created_at, rimborsato_at, rimborsato_cents, profiles(full_name, client_code)")
    .order("incassato_at", { ascending: true });

  const d = giorno(dal);
  const a = giorno(al);
  // Per la data dei soldi e con i confini italiani, come la pagina da cui si
  // scarica: un file che non torna con quello che si vede a schermo è un file
  // che qualcuno ricontrollerà a mano.
  const dalIso = d ? romeLocalToISO(`${d}T00:00`) : null;
  const giornoDopo = (giorno: string) => {
    const x = new Date(`${giorno}T12:00:00.000Z`);
    x.setUTCDate(x.getUTCDate() + 1);
    return x.toISOString().slice(0, 10);
  };
  // `al` è inclusivo: si arriva a fine giornata.
  const alIso = a ? romeLocalToISO(`${giornoDopo(a)}T00:00`) : null;
  if (dalIso) q = q.gte("incassato_at", dalIso);
  if (alIso) q = q.lt("incassato_at", alIso);
  if (tipo === "ricevuta") q = q.eq("stato", "saltata");
  if (tipo === "fattura") q = q.eq("stato", "emessa");
  if (tipo === "richiesta") q = q.in("stato", ["da_emettere", "errore"]);

  const { data } = await q.returns<Riga[]>();
  // Si nascondono solo quelle rese **per intero**, come in pagina. Prima
  // sparivano anche le parziali: una ricevuta da 60 € con 4 € resi usciva dal
  // file insieme ai suoi 56 € ancora incassati.
  const resaPerIntero = (r: Riga) => (r.rimborsato_cents ?? 0) >= r.amount_cents;
  const righe = (data ?? []).filter((r) => mostraRimborsate || !resaPerIntero(r));

  const lordoTot = righe.reduce((t, r) => t + r.amount_cents, 0);
  const rimborsatoTot = righe.reduce((t, r) => t + (r.rimborsato_cents ?? 0), 0);
  // Il totale è la cassa del periodo, calcolata una volta sola per tutti in
  // `cassa.ts`: comprende anche i rimborsi usciti ora su ricevute di prima,
  // che riga per riga non si vedrebbero.
  const totale = (await cassaTraLe(svc, dalIso, alIso)).nettoCents;
  // Scorporo: gli importi Stripe sono lordi, l'imponibile è il lordo / 1,22.
  // Si scorpora il **netto**, non il lordo: su un incasso restituito non si
  // deve nessuna IVA.
  const imponibileTot = Math.round(totale / 1.22);

  const lines = [
    HEADERS.map(csv).join(","),
    ...righe.map((r) => {
      const rimborsato = r.rimborsato_cents ?? 0;
      const netto = r.amount_cents - rimborsato;
      const imponibile = Math.round(netto / 1.22);
      const documento = r.fic_number
        ? `Fattura n. ${r.fic_number}`
        : r.stato === "da_emettere"
          ? "Fattura richiesta"
          : rimborsato >= r.amount_cents
            ? "Ricevuta — rimborsata per intero"
            : "Ricevuta";
      return [
        fmtData(r.incassato_at ?? r.created_at),
        r.stripe_invoice_id ?? "",
        r.profiles?.full_name ?? "",
        r.profiles?.client_code ?? "",
        documento,
        num(imponibile),
        num(netto - imponibile),
        num(r.amount_cents),
        num(rimborsato),
        num(netto),
        "Stripe",
      ].map(csv).join(",");
    }),
    // Totale in fondo: è la prima cosa che il commercialista guarda.
    ["TOTALE", "", "", "", `${righe.length} incassi`, num(imponibileTot), num(totale - imponibileTot), num(lordoTot), num(rimborsatoTot), num(totale), ""].map(csv).join(","),
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
