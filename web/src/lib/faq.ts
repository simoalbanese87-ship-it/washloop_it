import { LEGAL } from "@/lib/legal";

/** Le domande frequenti, in un posto solo.
 *
 *  Stavano dentro la pagina di marketing come costante locale. Ora servono a
 *  due lettori: la pagina e l'assistente, che risponde ai clienti basandosi
 *  ESCLUSIVAMENTE su questi testi. Tenerle in due copie avrebbe significato
 *  che prima o poi l'assistente avrebbe risposto con informazioni vecchie. */
export const FAQ: { q: string; a: string }[] = [
  { q: "Quanti sacchi e ritiri sono inclusi?", a: "Dipende dal piano: Small 1 sacco a settimana, Medium 2, Large 3. Il ritiro è sempre una volta a settimana. In ogni sacco sono comprese fino a 3 camicie stirate; dalla quarta in poi ogni camicia si addebita a listino." },
  { q: "Ho più camicie di quelle comprese. Cosa succede?", a: "Le camicie oltre quelle comprese nel sacco si addebitano a listino, una per una: le vedi nell'ordine prima che vengano lavorate, e non serve un secondo sacco." },
  { q: "Mi serve più spazio di quello del mio piano.", a: "Si passa al piano successivo, che costa meno di qualunque aggiunta a consumo: dall'area personale, alla voce Abbonamento. Se ti serve solo per una volta, scrivici e lo vediamo insieme." },
  { q: "E i capi da lavanderia o delicati?", a: "Mettili in un sacco separato apposito: li lavoriamo a prezzo di listino, fuori dal volume dell'abbonamento." },
  { q: "Posso mettere in pausa l'abbonamento?", a: "Sì. Vai in vacanza? Metti in pausa per un mese intero dall'app, e lo riprendi quando vuoi. Paghi solo quando usi davvero il servizio." },
  { q: "Cosa succede se un capo si rovina?", a: "Abbiamo una policy danni trasparente: ogni capo è tracciato e fotografato. In caso di problema ti rimborsiamo secondo termini chiari, scritti nero su bianco." },
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
      "Non esistono sacchi extra a pagamento: chi ha bisogno di piu' spazio passa al piano successivo.",
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
    `- Contatti: ${LEGAL.email}, telefono ${LEGAL.phone}.`,
  ].join("\n");
}
