/** Da dove arriva un contatto, detto a parole.
 *
 *  Nel database la provenienza è una parola sola e tecnica — `custom`,
 *  `landing`, `funnel` — e in pannello compariva così com'era: «da custom».
 *  Chi legge l'elenco deve indovinare, e indovinare ogni volta la stessa cosa
 *  è il modo in cui una richiesta importante passa per una come le altre.
 *
 *  Due stringhe per ciascuna, perché le domande sono due: **che cos'è** (il
 *  nome, quello che si vede a colpo d'occhio) e **da dove è entrato** (la
 *  pagina, che serve quando si richiama e si vuole sapere cosa aveva letto).
 *
 *  Modulo puro: è un vocabolario, e un vocabolario si prova senza database. */

export type Provenienza = { nome: string; dove: string };

export const PROVENIENZE: Record<string, Provenienza> = {
  // Il modulo «Su misura» in fondo a /prezzi: chi non sta nei due abbonamenti
  // e chiede di essere richiamato. Sono i più caldi che abbiamo.
  custom: { nome: "Su misura", dove: "modulo «Raccontaci cosa ti serve» su /prezzi" },
  // La pagina che chiede il CAP: lista d'attesa e verifica copertura.
  landing: { nome: "Verifica CAP", dove: "pagina /disponibilita" },
  // Importati dal funnel esterno, roba di giugno-luglio 2026.
  funnel: { nome: "Vecchio funnel", dove: "importati dal funnel esterno" },
  // Chi si è registrato da solo e ha un account.
  sito: { nome: "Registrato dal sito", dove: "ha aperto un account da solo" },
};

/** Il nome breve, quello da mettere in un elenco. Una provenienza che non
 *  conosciamo si mostra com'è scritta invece di sparire: una riga senza
 *  provenienza fa pensare che non ne abbia una. */
export function provenienzaNome(v: string | null | undefined): string | null {
  if (!v) return null;
  return PROVENIENZE[v]?.nome ?? v;
}

/** La riga lunga: «Su misura — modulo … su /prezzi». */
export function provenienzaDove(v: string | null | undefined): string | null {
  if (!v) return null;
  const p = PROVENIENZE[v];
  return p ? `${p.nome} — ${p.dove}` : v;
}

/** Le provenienze che meritano di saltare all'occhio in elenco. Una richiesta
 *  su misura è una persona che ha scritto cosa le serve e aspetta una
 *  telefonata: non è un indirizzo lasciato di passaggio. */
export function provenienzaInEvidenza(v: string | null | undefined): boolean {
  return v === "custom";
}
