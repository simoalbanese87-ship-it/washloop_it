import type { Metadata } from "next";
import { PaginaZona, type DatiZona } from "@/components/marketing/PaginaZona";
import { OG_IMMAGINE } from "@/lib/og";

/* ============================================================
   Assago, Buccinasco, Rozzano

   Fuori città, e in una pagina a sé per un motivo pratico: chi cerca
   «lavanderia a domicilio buccinasco» non scriverà mai «milano», e una pagina
   che parla di Milano non lo intercetta. Qui il contenuto proprio è la casa con
   il giardino e la macchina da prendere per andare in tintoria.
   ============================================================ */

const URL_PAGINA = "https://washloop.it/lavanderia-a-domicilio-assago-buccinasco-rozzano";

export const metadata: Metadata = {
  title: "Lavanderia a domicilio ad Assago, Buccinasco e Rozzano",
  description:
    "Ritiro del bucato a casa ad Assago, Buccinasco e Rozzano: martedì mattina, riconsegna il venerdì pomeriggio. CAP 20089 e 20090, ritiro e consegna inclusi.",
  alternates: { canonical: "/lavanderia-a-domicilio-assago-buccinasco-rozzano" },
  openGraph: {
    title: "Lavanderia a domicilio ad Assago, Buccinasco e Rozzano — WashLoop",
    description: "Senza prendere la macchina per portare il bucato: ritiriamo a casa il martedì e riconsegniamo il venerdì.",
    url: URL_PAGINA,
    type: "website",
    locale: "it_IT",
    images: [OG_IMMAGINE],
  },
};

const ZONA: DatiZona = {
  nome: "Assago, Buccinasco e Rozzano",
  url: URL_PAGINA,
  kicker: "Assago · Buccinasco · Rozzano",
  titolo: ["Lavanderia a domicilio ad Assago, Buccinasco e Rozzano.", "Senza prendere la macchina."],
  intro:
    "Ritiriamo il bucato a casa tua il martedì mattina, lo laviamo e lo stiriamo in lavanderia professionale e te lo riportiamo piegato il venerdì pomeriggio. Fuori Milano, ma dentro il giro: Assago, Buccinasco e Rozzano hanno lo stesso prezzo e gli stessi giorni della città.",
  cap: ["20089", "20090"],
  luoghi: ["Assago", "Milanofiori", "Buccinasco", "Romano Banco", "Rozzano", "Quinto de' Stampi"],
  specifico: {
    titolo: "Il problema qui è la distanza, non lo spazio.",
    paragrafi: [
      "Ad Assago, a Buccinasco e a Rozzano lo spazio per stendere di solito c'è: c'è il giardino, c'è il box, c'è una lavanderia vera in casa. Quello che non c'è è la tintoria sotto il portone. Per portare un piumone o quattro camicie bisogna prendere la macchina, trovare parcheggio, tornare dopo tre giorni a riprenderle: due viaggi per ogni lavaggio.",
      "Il nostro giro arriva fin qui con gli stessi giorni e lo stesso prezzo di Milano — 160 € al mese per un sacco a settimana, ritiro e riconsegna compresi. Non c'è nessun supplemento perché sei fuori città: il costo del viaggio è già dentro l'abbonamento, ed è una delle ragioni per cui l'abbonamento esiste.",
      "Nelle case con cancello e vialetto il ritiro si fa dove dici tu: al cancello, sulla porta, in portineria se il complesso ne ha una. Scrivilo una volta nelle note dell'indirizzo e vale per tutti i martedì successivi.",
      "Per chi lavora a Milanofiori vale la pena saperlo: il ritiro è a casa, non in ufficio, ma la fascia del martedì mattina parte alle 8:30 — prima di mettersi in macchina.",
    ],
  },
  faq: [
    {
      q: "Costa di più perché sono fuori Milano?",
      a: "No. Ad Assago, Buccinasco e Rozzano il prezzo è lo stesso della città: 160 € al mese per un sacco a settimana, con ritiro e riconsegna inclusi. Non ci sono supplementi di zona né minimi d'ordine.",
    },
    {
      q: "Quali CAP coprite?",
      a: "20090 per Assago e Buccinasco, 20089 per Rozzano. Sono gli unici comuni fuori Milano in cui passiamo oggi: se abiti in un altro e ci lasci il CAP, è da lì che decidiamo dove allargare.",
    },
    {
      q: "Potete ritirare al cancello o in portineria?",
      a: "Sì. Scrivi nelle note dell'indirizzo dove preferisci — cancello, porta di casa, portineria del complesso — e il rider si regola di conseguenza, senza doverti chiamare ogni volta.",
    },
    {
      q: "Ho una lavatrice grande: conviene lo stesso?",
      a: "Se il problema è lavare, no, e preferiamo dirlo. Conviene se il problema è stirare e piegare, o se quello che ti pesa sono i capi grossi — piumoni, copriletti, coperte — che in una lavatrice di casa non entrano e che altrimenti finiscono in macchina fino alla tintoria. Quelli si possono anche mandare singolarmente, a listino, senza abbonamento.",
    },
  ],
};

export default function LavanderiaAssagoBuccinascoRozzano() {
  return <PaginaZona zona={ZONA} />;
}
