import Link from "next/link";
import { Card, PageTitle } from "@/components/app/AppShell";

export const dynamic = "force-dynamic";

/** Hub delle pagine che si aprono una volta ogni tanto.
 *
 *  Il menu è passato da quattordici voci a sei: tutto quello che si configura e
 *  non si usa ogni giorno vive qui. Nessuna pagina è stata spostata o
 *  rinominata — cambiano solo i percorsi per arrivarci, e i vecchi indirizzi
 *  continuano a funzionare. */

const GRUPPI: { titolo: string; nota: string; voci: { href: string; label: string; sub: string }[] }[] = [
  {
    titolo: "Operatività",
    nota: "Quello che serve per far girare il servizio.",
    voci: [
      { href: "/admin/etichette", label: "Etichette", sub: "Tag QR per i sacchi: stampa e consegna" },
      { href: "/admin/team", label: "Team", sub: "Accessi di rider, lavanderia e sales" },
      { href: "/admin/lavanderia", label: "Soldi alla lavanderia", sub: "Quanto le devi, per quali ordini, cosa hai pagato" },
    ],
  },
  {
    titolo: "Configurazione",
    nota: "Le regole del servizio. Si toccano di rado.",
    voci: [
      { href: "/admin/catalogo", label: "Catalogo", sub: "Piani, prezzi, lavanderie, zone, deposito e fasce orarie" },
      { href: "/admin/listino", label: "Listino capi speciali", sub: "Quanto paghiamo alla lavanderia, quanto paga il cliente, quanto resta" },
      { href: "/admin/sicurezza", label: "Sicurezza e stato", sub: "Configurazione, protezioni e se il servizio può girare domani" },
    ],
  },
  {
    titolo: "Marketing",
    nota: "Comunicazione e crescita.",
    voci: [
      { href: "/admin/email", label: "Email inviate", sub: "Log delle consegne (Brevo)" },
      { href: "/admin/crescita", label: "Crescita", sub: "Guide e checklist SEO, social e acquisizione" },
    ],
  },
];

export default function ImpostazioniPage() {
  return (
    <>
      <PageTitle
        kicker="Impostazioni"
        title="Configurazione e strumenti"
        sub="Tutto ciò che non si usa ogni giorno, in un posto solo."
      />

      <div className="space-y-6">
        {GRUPPI.map((g) => (
          <Card key={g.titolo}>
            <h2 className="font-display text-base font-extrabold text-navy">{g.titolo}</h2>
            <p className="mt-1 text-sm font-medium text-muted">{g.nota}</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {g.voci.map((v) => (
                <Link
                  key={v.href}
                  href={v.href}
                  className="rounded-[16px] border border-line bg-ice px-4 py-3 transition-colors hover:border-navy/25"
                >
                  <div className="font-display text-sm font-extrabold text-navy">{v.label} →</div>
                  <div className="mt-0.5 text-xs font-medium text-muted">{v.sub}</div>
                </Link>
              ))}
            </div>
          </Card>
        ))}
      </div>
    </>
  );
}
