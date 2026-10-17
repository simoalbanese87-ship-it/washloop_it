import { LEGAL } from "@/lib/legal";

/** Le domande frequenti, in un posto solo.
 *
 *  Stavano dentro la pagina di marketing come costante locale. Ora servono a
 *  due lettori: la pagina e l'assistente, che risponde ai clienti basandosi
 *  ESCLUSIVAMENTE su questi testi. Tenerle in due copie avrebbe significato
 *  che prima o poi l'assistente avrebbe risposto con informazioni vecchie. */
export const FAQ: { q: string; a: string }[] = [
  { q: "Che differenza c'è fra Solo stiro e Lava e stira?", a: "Chi fa il lavoro, e quando. Con il Solo stiro lavi tu in casa e noi stiriamo: ritiro il mercoledì, riconsegna il venerdì, 48 ore. Con Lava e stira ci diamo tutto noi — lavaggio, asciugatura, stiratura e piegatura — con ritiro il martedì e riconsegna entro 3 giorni feriali." },
  { q: "Quanti sacchi e ritiri sono inclusi?", a: "Un sacco a settimana, con un ritiro fisso a settimana. In ogni sacco di lavanderia sono comprese fino a 3 camicie stirate; dalla quarta in poi ogni camicia si addebita a listino. Se ti serve di più, costruiamo un abbonamento su misura: scrivici." },
  { q: "Quanto è grande il sacco? Quanto ci sta?", a: "Il sacco è da 30 litri: è un carico di lavatrice pieno, quello che caricheresti in casa in una volta. Non devi contare i capi né pesare niente — si contano i sacchi, non i pezzi. Dentro va tutto quello che finirebbe in lavatrice: magliette, camicie, pantaloni, biancheria, asciugamani, lenzuola." },
  { q: "Ho più camicie di quelle comprese. Cosa succede?", a: "Le camicie oltre quelle comprese nel sacco si addebitano a listino, una per una: le vedi nell'ordine prima che vengano lavorate, e non serve un secondo sacco." },
  { q: "Mi serve più spazio, o ritiri più spesso.", a: "Si fa un abbonamento su misura: ci dici quanti ritiri ti servono al mese e come, e costruiamo la soluzione insieme. Dalla pagina dei prezzi, con «Su misura», lasci un recapito e ti richiamiamo nella fascia oraria che scegli." },
  { q: "Posso cambiare la frequenza dei ritiri?", a: "Sì. Il ritiro settimanale si sposta o si salta dall'app, quando vuoi. Se invece ti serve stabilmente un ritmo diverso — per esempio due volte al mese — si concorda un abbonamento su misura, e in app vedi quanti passaggi ti restano e entro quando." },
  { q: "E i capi da lavanderia o delicati?", a: "Mettili in un sacco separato apposito: li lavoriamo a prezzo di listino, fuori dal volume dell'abbonamento." },
  { q: "Vado in vacanza: posso sospendere l'abbonamento?", a: "Sì. Scrivici prima di partire e mettiamo l'abbonamento in pausa: durante la pausa non si paga nulla e non si prenotano ritiri. Al rientro lo riattiviamo e riparti da dove eri. La pausa non è una disdetta: il tuo sacco e i tuoi cartellini restano a casa tua." },
  { q: "Cosa succede se un capo si rovina?", a: "Abbiamo una policy danni trasparente: ogni capo è tracciato e fotografato. In caso di problema ti rimborsiamo secondo termini chiari, scritti nero su bianco." },
  { q: "Posso invitare un amico?", a: "Sì, e conviene: ogni cliente ha un link personale (lo trova nella sua area, alla voce «Porta un amico»). Quando un amico attiva un abbonamento con quel link, regaliamo una settimana del piano a chi ha invitato, scalata in automatico dalla fattura successiva. Vale sul primo acquisto dell'amico, non sui rinnovi, e non c'è limite al numero di amici." },
  { q: "Come funzionano il ritiro e la riconsegna?", a: "Il giorno è fisso e la fascia oraria la scegli tu. Lasci il sacco fuori dalla porta (o lo consegni di persona, come preferisci) e il rider lo ritira: non entriamo in casa e non teniamo le tue chiavi. La riconsegna te la fissiamo noi e ti avvisiamo con giorno e ora, via email e con una notifica." },
  { q: "Il sacco è mio?", a: "Sì: il sacco con il tuo codice resta tuo per tutto il tempo che sei cliente, e lo riprendiamo solo se smetti. Il bucato pulito torna invece in una scatola rigida che gira: la lasci fuori vuota al ritiro successivo e il rider se la riporta." },
  { q: "Quali zone coprite a Milano?", a: "Milano città, più Rozzano, Assago e Buccinasco. Inserisci il tuo CAP: ti diciamo subito se sei in zona, oppure ti avvisiamo appena apriamo da te. L'elenco dei CAP serviti qui sotto è quello vero, aggiornato." },
];

/** I prezzi veri, come li legge l'assistente.
 *
 *  Scritti a mano nelle FAQ avevano gia' smesso di coincidere: il 3 ottobre
 *  l'assistente ha detto a una cliente che un sacco extra costa 45 EUR, cifra
 *  che non esiste in nessuna tabella e che nessun codice addebita. Non se l'era
 *  inventata: l'aveva letta qui dentro.
 *
 *  Stessa cura gia' usata per le zone, e per lo stesso motivo: un numero
 *  scritto due volte e' un numero che prima o poi diverge. */
export type ListinoAssistente = {
  piani: { nome: string; prezzoMeseCents: number; sacchiSettimana: number }[];
  capi: { nome: string; prezzoCents: number; inclusePerSacco: number }[];
};

const eur = (c: number) => (c / 100).toLocaleString("it-IT", { minimumFractionDigits: 2 }) + " €";

export function prezziPerAssistente(l: ListinoAssistente): string {
  const righe: string[] = [];
  if (l.piani.length) {
    righe.push(
      "PIANI E PREZZI ADESSO (fonte: il nostro sistema, aggiornati):",
      ...l.piani.map(
        (p) =>
          `- ${p.nome}: ${eur(p.prezzoMeseCents)} al mese per ${p.sacchiSettimana === 1 ? "1 sacco" : `${p.sacchiSettimana} sacchi`} a settimana, ritiro e riconsegna inclusi.`,
      ),
      "Non esistono sacchi extra a pagamento: chi ha bisogno di piu' spazio, o di piu' ritiri, concorda un abbonamento su misura — dalla pagina dei prezzi, voce «Su misura», lasciando un recapito per essere richiamato.",
    );
  }
  if (l.capi.length) {
    righe.push(
      "",
      "LISTINO DEI CAPI FUORI ABBONAMENTO (prezzi al cliente, IVA inclusa):",
      ...l.capi.map(
        (c) =>
          `- ${c.nome}: ${eur(c.prezzoCents)}${c.inclusePerSacco > 0 ? ` (le prime ${c.inclusePerSacco} per sacco sono comprese nell'abbonamento)` : ""}`,
      ),
    );
  }
  return righe.length ? `\n\n${righe.join("\n")}` : "";
}

/** Il contesto che l'assistente può usare. Volutamente ristretto: FAQ, dati
 *  legali dell'azienda e regole di copertura. Niente prezzi personalizzati,
 *  niente dati di clienti, niente ordini. */
export function contestoAssistente(): string {
  const faq = FAQ.map((f, i) => `${i + 1}. D: ${f.q}\n   R: ${f.a}`).join("\n");
  return [
    "DOMANDE FREQUENTI UFFICIALI WASHLOOP:",
    faq,
    "",
    "ALTRE INFORMAZIONI UTILI:",
    "- WashLoop ritira, lava, stira e riconsegna a domicilio a Milano.",
    "- La riconsegna la programma WashLoop: il cliente non sceglie la fascia, viene avvisato per email con giorno e ora.",
    "- Il sacco ha un'etichetta con QR e codice cliente (WL-####), che il rider scansiona a ritiro e consegna.",
    "- A ogni pagamento parte una ricevuta via email. La fattura si ottiene solo su richiesta, dall'area personale, alla voce «Ricevuta e fattura».",
    "- I servizi in vendita sono due: Lava e stira (ritiro il martedi', riconsegna entro 3 giorni feriali) e Solo stiro (capi gia' lavati dal cliente, ritiro il mercoledi', riconsegna il venerdi', 48 ore). Chi ha bisogno di qualcosa di diverso — piu' ritiri, un ritmo suo, volumi alti — concorda un abbonamento su misura.",
    "- Il sacco e' da 30 litri e resta del cliente finche' e' cliente. Il pulito torna in una scatola rigida che gira: si lascia fuori vuota al ritiro successivo.",
    "- Il rider non entra in casa e non tiene chiavi: il sacco si lascia fuori dalla porta o si consegna di persona.",
    `- Contatti: ${LEGAL.email}, telefono ${LEGAL.phone}.`,
  ].join("\n");
}
