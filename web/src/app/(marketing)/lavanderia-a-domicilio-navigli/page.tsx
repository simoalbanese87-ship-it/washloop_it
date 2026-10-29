import type { Metadata } from "next";
import { PaginaZona, type DatiZona } from "@/components/marketing/PaginaZona";
import { OG_IMMAGINE } from "@/lib/og";

/* ============================================================
   Navigli, Ticinese, Porta Genova

   Perché una pagina a sé
   ----------------------
   Su «lavanderia a domicilio milano» competono tintorie con dieci anni di
   recensioni. Su «lavanderia a domicilio navigli» non compete quasi nessuno, e
   chi cerca così abita a quattro strade dal giro del martedì.

   La regola che questa pagina deve rispettare per non essere spazzatura: tolto
   il nome del quartiere, non deve poter stare in piedi su un'altra zona. Qui il
   contenuto suo sono le scale senza ascensore e i monolocali senza attacco
   lavatrice — che ai Navigli sono la regola e a Buccinasco no.
   ============================================================ */

const URL_PAGINA = "https://washloop.it/lavanderia-a-domicilio-navigli";

export const metadata: Metadata = {
  title: "Lavanderia a domicilio ai Navigli e in Ticinese",
  description:
    "Ritiro del bucato sotto casa ai Navigli, in Ticinese e a Porta Genova: martedì mattina, riconsegna il venerdì. CAP 20123, 20136, 20144.",
  alternates: { canonical: "/lavanderia-a-domicilio-navigli" },
  openGraph: {
    title: "Lavanderia a domicilio ai Navigli — WashLoop",
    description: "Ritiro sotto casa il martedì mattina, riconsegna il venerdì pomeriggio. Senza portare niente giù per le scale.",
    url: URL_PAGINA,
    type: "website",
    locale: "it_IT",
    images: [OG_IMMAGINE],
  },
};

const ZONA: DatiZona = {
  nome: "Navigli e Ticinese",
  url: URL_PAGINA,
  kicker: "Navigli · Ticinese · Porta Genova",
  titolo: ["Lavanderia a domicilio ai Navigli.", "Il bucato non fa le scale."],
  intro:
    "Ritiriamo il sacco sulla porta di casa il martedì mattina, laviamo e stiriamo in lavanderia professionale e te lo riportiamo piegato il venerdì pomeriggio. In Ticinese, lungo la Darsena, a Porta Genova e nelle vie intorno a corso Genova.",
  cap: ["20123", "20136", "20144"],
  luoghi: ["Navigli", "Darsena", "Ticinese", "Porta Genova", "Corso Genova", "Sant'Ambrogio", "Tortona", "Solari"],
  specifico: {
    titolo: "Qui il problema non è lavare: è portare.",
    paragrafi: [
      "Nelle case di ringhiera e nei palazzi di fine Ottocento che riempiono il Ticinese l'ascensore spesso non c'è, e quando c'è è grande come una cabina telefonica. La lavanderia self-service più vicina può stare a dieci minuti a piedi: dieci minuti con due borsoni, due volte, nella stessa serata.",
      "In molti monolocali e bilocali della zona l'attacco della lavatrice è in bagno, quando c'è, e un carico di lenzuola non ci entra comunque. È il motivo per cui qui l'abbonamento lo prendono soprattutto persone che da sole in casa ci stanno poco: il sacco esce la mattina del martedì e rientra già piegato il venerdì.",
      "Il ritiro è sotto casa, non in strada e non in un punto di raccolta: il rider sale e lo prende sulla porta. Alla riconsegna non devi esserci — ti arriva prima un'email con giorno e fascia.",
      "Sul traffico della movida non facciamo affidamento: il giro del martedì parte alle 8:30, quando i Navigli sono ancora vuoti.",
    ],
  },
  faq: [
    {
      q: "Passate anche nelle case di ringhiera senza ascensore?",
      a: "Sì. Il rider sale fino alla tua porta e porta giù lui il sacco: è esattamente il pezzo di lavoro che stai pagando. Se il portone ha un citofono con codice o un cancello interno, scrivilo nelle note dell'indirizzo e lo trova senza chiamarti.",
    },
    {
      q: "Abito in un monolocale senza lavatrice: conviene l'abbonamento?",
      a: "Dipende da quanto bucato fai. Un sacco a settimana — un borsone pieno, lavato e stirato — costa 160 € al mese, ritiro e riconsegna inclusi. Confrontalo con quello che spendi oggi fra gettoni, detersivo e tempo: su /prezzi trovi il conto fatto per esteso, senza arrotondamenti a nostro favore.",
    },
    {
      q: "Quali CAP coprite ai Navigli?",
      a: "20123, 20136 e 20144 coprono Ticinese, Darsena, Porta Genova, corso Genova, Sant'Ambrogio, Tortona e Solari. Ritiriamo comunque in tutta Milano città: se il tuo CAP è un altro, il modulo qui sopra te lo dice subito.",
    },
    {
      q: "E se vivo in un affitto breve o cambio casa spesso?",
      a: "L'indirizzo si cambia dall'app, e l'abbonamento si mette in pausa per un mese intero quando non serve. Non c'è vincolo di durata: si disdice quando vuoi e il mese già pagato resta valido fino alla fine.",
    },
  ],
};

export default function LavanderiaNavigli() {
  return <PaginaZona zona={ZONA} />;
}
