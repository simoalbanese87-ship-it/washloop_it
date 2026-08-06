import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { CONTACT_STATUS_LABEL, isContactStatus } from "@/lib/lead-status";

/** Export CSV delle richieste dalla landing /disponibilita.
 *  Rispetta gli stessi filtri della pagina (?q=, ?zona=): scarichi quello che vedi.
 *  Solo admin: la rotta espone dati personali, quindi il ruolo va ricontrollato
 *  qui e non solo nel layout. */

type Row = {
  full_name: string;
  email: string;
  phone: string | null;
  cap: string | null;
  plan: string | null;
  covered: boolean;
  contact_status: string;
  created_at: string;
  utm: { source?: string | null; medium?: string | null; campaign?: string | null } | null;
  zones: { name: string } | null;
};

const HEADERS = [
  "Data", "Nome e cognome", "Email", "Telefono", "CAP", "Zona", "Copertura", "Piano", "Stato contatto",
  "UTM source", "UTM medium", "UTM campaign",
];

/** Campo CSV: virgolette raddoppiate. Il prefisso apostrofo neutralizza le
 *  formule (=, +, -, @): un nome come "=cmd" non deve eseguirsi in Excel. */
function csv(value: string | null | undefined): string {
  const v = (value ?? "").toString();
  const safe = /^[=+\-@\t\r]/.test(v) ? `'${v}` : v;
  return `"${safe.replace(/"/g, '""')}"`;
}

function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString("it-IT", { timeZone: "Europe/Rome", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
  } catch {
    return iso;
  }
}

export async function GET(req: Request) {
  const me = await getCurrentProfile();
  if (!me || me.role !== "admin") return new NextResponse("Non autorizzato", { status: 403 });

  const { searchParams } = new URL(req.url);
  const needle = (searchParams.get("q") ?? "").trim().toLowerCase();
  const zona = searchParams.get("zona");
  const stato = searchParams.get("stato");

  const svc = createServiceClient();
  const { data } = await svc
    .from("leads")
    .select("full_name, email, phone, cap, plan, covered, contact_status, created_at, utm, zones(name)")
    .order("created_at", { ascending: false })
    .returns<Row[]>();

  const rows = (data ?? []).filter((l) => {
    if (zona === "in" && !l.covered) return false;
    if (zona === "fuori" && l.covered) return false;
    if (stato && l.contact_status !== stato) return false;
    if (!needle) return true;
    return `${l.full_name} ${l.email} ${l.phone ?? ""} ${l.cap ?? ""} ${l.zones?.name ?? ""}`.toLowerCase().includes(needle);
  });

  const lines = [
    HEADERS.map(csv).join(","),
    ...rows.map((l) =>
      [
        fmtDate(l.created_at),
        l.full_name,
        l.email,
        l.phone,
        l.cap,
        l.zones?.name ?? "",
        l.covered ? "In zona" : "Fuori zona",
        l.plan ? `Piano ${l.plan}` : "",
        isContactStatus(l.contact_status) ? CONTACT_STATUS_LABEL[l.contact_status] : l.contact_status,
        l.utm?.source ?? "",
        l.utm?.medium ?? "",
        l.utm?.campaign ?? "",
      ].map(csv).join(","),
    ),
  ];

  // BOM: senza, Excel su Mac sbaglia gli accenti (Disponibilità → DisponibilitÃ ).
  const body = "﻿" + lines.join("\r\n") + "\r\n";
  const today = new Date().toISOString().slice(0, 10);

  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="washloop-disponibilita-${today}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
