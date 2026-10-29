import type { Metadata } from "next";
import { PaginaZona, type DatiZona } from "@/components/marketing/PaginaZona";
import { OG_IMMAGINE } from "@/lib/og";

/* ============================================================
   Barona, Lorenteggio, Famagosta, Giambellino

   La zona dove il bucato è di una famiglia, non di una persona: lenzuola,
   asciugamani, tute da calcio. Cambia il volume, e quindi cambia il consiglio —
   ed è questo che rende la pagina diversa da quella dei Navigli, dove il
   problema sono le scale.
   ============================================================ */

const URL_PAGINA = "https://washloop.it/lavanderia-a-domicilio-barona-lorenteggio";

export const metadata: Metadata = {
  title: "Lavanderia a domicilio in Barona e Lorenteggio",
  description:
    "Ritiro del bucato sotto casa in Barona, Lorenteggio, Famagosta e Giambellino: martedì mattina, riconsegna il venerdì. CAP 20141, 20142, 20143, 20146.",
  alternates: { canonical: "/lavanderia-a-domicilio-barona-lorenteggio" },
  openGraph: {
    title: "Lavanderia a domicilio in Barona e Lorenteggio — WashLoop",
    description: "Il bucato di tutta la famiglia ritirato sotto casa il martedì e riportato piegato il venerdì.",
    url: URL_PAGINA,
    type: "website",
    locale: "it_IT",
    images: [OG_IMMAGINE],
  },
};

const ZONA: DatiZona = {
  nome: "Barona e Lorenteggio",
  url: URL_PAGINA,
  kicker: "Barona · Lorenteggio · Famagosta · Giambellino",
  titolo: ["Lavanderia a domicilio in Barona e Lorenteggio.", "Tre lavatrici in meno a settimana."],
  intro:
    "Ritiriamo il sacco sotto casa il martedì mattina, laviamo e stiriamo in lavanderia professionale e lo riportiamo piegato il venerdì pomeriggio. In Barona, lungo il Lorenteggio, a Famagosta, al Giambellino e nelle vie intorno a piazzale Brescia.",
  cap: ["20141", "20142", "20143", "20146"],
  luoghi: ["Barona", "Lorenteggio", "Giambellino", "Famagosta", "Inganni", "Bande Nere", "Romolo"],
  specifico: {
    titolo: "Qui il bucato non è di una persona sola.",
    paragrafi: [
      "Nei palazzi degli anni Sessanta e Settanta fra la Barona e il Lorenteggio ci abitano famiglie, e il bucato di una famiglia non è fatto di camicie: è fatto di lenzuola, asciugamani, tute, accappatoi. Roba che occupa, che va stesa da qualche parte e che d'inverno non asciuga.",
      "È la ragione per cui qui il conto va fatto diversamente che in centro. Un sacco WashLoop è un borsone pieno — quello che caricheresti in lavatrice — e comprende fino a 3 camicie stirate; tutto il resto che sta dentro viene lavato, asciugato e piegato senza contarlo capo per capo. Se la settimana ne produce due, si prende il secondo sacco: costa meno di due lavaggi separati e sparisce dal balcone.",
      "Il ritiro è sulla porta di casa. Nei palazzi con portineria lasciamo il sacco al portiere solo se ce lo dici tu: di nostra iniziativa non lo facciamo, perché un sacco di vestiti lasciato a qualcuno che non l'aspetta è un sacco che prima o poi non si trova più.",
      "Qui l'alternativa vera non è la tintoria: è la lavanderia a gettoni di via, dove un carico da 16 kg più l'asciugatrice vuole un'ora e mezza della tua domenica. Il nostro giro passa il martedì mattina e ti restituisce quella domenica.",
    ],
  },
  faq: [
    {
      q: "Quanto ci sta in un sacco?",
      a: "Un borsone pieno: quello che caricheresti in una lavatrice di casa in un colpo solo. Lenzuola, asciugamani, magliette, tute. Non contiamo i capi uno a uno — contano solo le camicie da stirare, fino a 3 per sacchetto, e i capi da lavasecco che vanno a listino.",
    },
    {
      q: "Lavate anche lenzuola e asciugamani?",
      a: "Sì, ed è la roba per cui il servizio ha più senso: occupa, pesa e in casa non asciuga. Entra nel sacco come tutto il resto, senza supplementi.",
    },
    {
      q: "Quali CAP coprite in Barona e Lorenteggio?",
      a: "20141, 20142, 20143 e 20146, cioè Barona, Famagosta, Giambellino, Lorenteggio, Inganni e le vie intorno a Bande Nere e Romolo. Ritiriamo comunque in tutta Milano città: il modulo qui sopra te lo conferma in un secondo.",
    },
    {
      q: "Il rider può lasciare il sacco al portiere?",
      a: "Solo se ce lo chiedi tu e il portiere è d'accordo: lo scrivi una volta nelle note dell'indirizzo e vale per tutti i ritiri successivi. Senza quell'indicazione il sacco viene consegnato a te, o riprogrammato.",
    },
  ],
};

export default function LavanderiaBaronaLorenteggio() {
  return <PaginaZona zona={ZONA} />;
}
