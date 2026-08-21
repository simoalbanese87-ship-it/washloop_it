import { LEGAL } from "@/lib/legal";

/** Le domande frequenti, in un posto solo.
 *
 *  Stavano dentro la pagina di marketing come costante locale. Ora servono a
 *  due lettori: la pagina e l'assistente, che risponde ai clienti basandosi
 *  ESCLUSIVAMENTE su questi testi. Tenerle in due copie avrebbe significato
 *  che prima o poi l'assistente avrebbe risposto con informazioni vecchie. */
export const FAQ: { q: string; a: string }[] = [
  { q: "Quanti sacchi e ritiri sono inclusi?", a: "Dipende dal piano: Small 1 sacco a settimana, Medium 2, Large 3. Il ritiro è sempre una volta a settimana. Ogni sacchetto contiene fino a 3 camicie." },
  { q: "Posso consegnare più sacchi insieme?", a: "Sì. Puoi cumulare i sacchi del tuo abbonamento nell'arco del mese: se una settimana non consegni, la successiva porti due sacchi insieme. Basta avvisare il driver il giorno prima." },
  { q: "Mi serve un sacco extra. Quanto costa?", a: "Puoi aggiungere sacchi oltre quelli del piano a €45 l'uno. Li gestisci direttamente dall'app." },
  { q: "E i capi da lavanderia o delicati?", a: "Mettili in un sacco separato apposito: li lavoriamo a prezzo di listino, fuori dal volume dell'abbonamento." },
  { q: "Posso mettere in pausa l'abbonamento?", a: "Sì. Vai in vacanza? Metti in pausa per un mese intero dall'app, e lo riprendi quando vuoi. Paghi solo quando usi davvero il servizio." },
  { q: "Cosa succede se un capo si rovina?", a: "Abbiamo una policy danni trasparente: ogni capo è tracciato e fotografato. In caso di problema ti rimborsiamo secondo termini chiari, scritti nero su bianco." },
  { q: "Quali zone coprite a Milano?", a: "Stiamo partendo da Milano Sud-Ovest, hinterland compreso: Rozzano, Assago e Buccinasco sono già serviti. Inserisci il tuo CAP: ti diciamo subito se sei in zona, oppure ti avvisiamo appena apriamo da te." },
];

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
