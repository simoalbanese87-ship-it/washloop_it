/** Il conto economico settimanale, cliente per cliente.
 *
 *  Due numeri che prima non si potevano mettere vicini: quanto vale una
 *  settimana di servizio per un cliente, e quanto ci è costata quella stessa
 *  settimana per quel cliente. Finora la pagina Competenza li teneva aggregati
 *  per settimana e con un costo unico indifferenziato: si vedeva il margine del
 *  giro, non quello di una persona.
 *
 *  La regola del canone
 *  --------------------
 *  Il canone mensile si divide per **le settimane di servizio del mese**, non
 *  per i ritiri che il cliente ha fatto. È la differenza che Simone ha messo a
 *  fuoco: un mese con cinque martedì vale cinque settimane, e ciascuna vale
 *  meno. Dividendo per i ritiri effettivi, un cliente che salta una settimana
 *  farebbe valere di più quelle in cui c'è stato — cioè esattamente il
 *  contrario di quello che è successo.
 *
 *  La quota si imputa **solo nelle settimane in cui c'è stata una presa in
 *  carico**: una settimana senza ritiro resta vuota, non vale zero spalmato.
 *  Chi è arrivato a metà mese ha le prime caselle vuote, e si vede.
 *
 *  Il canone del momento
 *  ---------------------
 *  Un cliente può aver cambiato piano a metà mese: si usa il canone in vigore
 *  in quella settimana, non l'ultimo. Senza, le settimane prima del cambio
 *  verrebbero valutate a un prezzo che allora non pagava.
 *
 *  Funzione pura: è il punto in cui si sbaglia un conto e nessuno se ne
 *  accorge, e va collaudata senza database. */

export type Settimana = string;

/** Il lunedì della settimana di una data, in ora di Roma.
 *
 *  Il fuso conta: `2026-09-20T22:30:00Z` è domenica in UTC ma è già lunedì 21 a
 *  Roma, e la riga finirebbe nella settimana sbagliata. */
export function lunediDi(iso: string): Settimana {
  const giorno = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Rome",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));
  const d = new Date(`${giorno}T12:00:00Z`);
  // getUTCDay: 0 = domenica. Si riporta a lunedì.
  const scarto = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - scarto);
  return d.toISOString().slice(0, 10);
}

/** Un canone in vigore da una certa data. Più righe per cliente = cambi piano. */
export type CanoneStorico = { clienteId: string; canoneCents: number; daIso: string };

export type ClienteConto = { clienteId: string; nome: string };
export type OrdineConto = { clienteId: string; settimana: Settimana; sacchi: number };
export type PayoutConto = { clienteId: string; settimana: Settimana; kind: string; amountCents: number };
export type ExtraConto = { clienteId: string; settimana: Settimana; prezzoCents: number };

export type Cella = {
  ritiri: number;
  sacchi: number;
  ricavoCanoneCents: number;
  ricavoExtraCents: number;
  costoSaccoCents: number;
  costoExtraCents: number;
};

export type RigaCliente = {
  clienteId: string;
  nome: string;
  celle: Record<Settimana, Cella>;
  totale: Cella;
};

const cellaVuota = (): Cella => ({
  ritiri: 0,
  sacchi: 0,
  ricavoCanoneCents: 0,
  ricavoExtraCents: 0,
  costoSaccoCents: 0,
  costoExtraCents: 0,
});

/** Le colonne del mese: i lunedì delle settimane in cui si ritira.
 *
 *  Si ricavano dalle fasce di ritiro vere e non dal calendario: se un mese ha
 *  cinque martedì ma la quinta settimana è chiusa, quella settimana non esiste
 *  e non deve dividere il canone. */
export function settimaneDelMese(giorniDiRitiroIso: string[], mese: string): Settimana[] {
  const dentro = giorniDiRitiroIso.filter((iso) => meseDi(iso) === mese);
  return [...new Set(dentro.map((iso) => lunediDi(iso)))].sort();
}

/** Anno-mese in ora di Roma. */
export function meseDi(iso: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Rome", year: "numeric", month: "2-digit" })
    .format(new Date(iso))
    .slice(0, 7);
}

/** Quanto vale una settimana di canone. */
export function quotaSettimanale(canoneCents: number, quanteSettimane: number): number {
  if (quanteSettimane <= 0) return 0;
  return Math.round(canoneCents / quanteSettimane);
}

/** Il canone in vigore per quel cliente in quella settimana: l'ultimo che è
 *  cominciato entro la fine della settimana. Zero se allora non era cliente. */
export function canoneDellaSettimana(storico: CanoneStorico[], clienteId: string, settimana: Settimana): number {
  const fine = new Date(`${settimana}T12:00:00Z`);
  fine.setUTCDate(fine.getUTCDate() + 6);
  const limite = fine.getTime();
  let scelto: CanoneStorico | null = null;
  for (const c of storico) {
    if (c.clienteId !== clienteId) continue;
    const da = Date.parse(c.daIso);
    if (!Number.isFinite(da) || da > limite) continue;
    if (!scelto || Date.parse(c.daIso) > Date.parse(scelto.daIso)) scelto = c;
  }
  return scelto?.canoneCents ?? 0;
}

export function contoDelMese(input: {
  clienti: ClienteConto[];
  settimane: Settimana[];
  canoni: CanoneStorico[];
  ordini: OrdineConto[];
  payouts: PayoutConto[];
  extra: ExtraConto[];
}): RigaCliente[] {
  const { clienti, settimane, canoni, ordini, payouts, extra } = input;
  const righe = new Map<string, RigaCliente>();
  for (const c of clienti) {
    righe.set(c.clienteId, { clienteId: c.clienteId, nome: c.nome, celle: {}, totale: cellaVuota() });
  }
  const dentro = new Set(settimane);
  const cella = (clienteId: string, settimana: Settimana): Cella | null => {
    const r = righe.get(clienteId);
    if (!r || !dentro.has(settimana)) return null;
    r.celle[settimana] ??= cellaVuota();
    return r.celle[settimana];
  };

  // I ritiri per primi: sono loro a decidere in quali settimane il canone matura.
  for (const o of ordini) {
    const c = cella(o.clienteId, o.settimana);
    if (!c) continue;
    c.ritiri += 1;
    c.sacchi += Math.max(0, o.sacchi);
  }
  for (const r of righe.values()) {
    for (const settimana of Object.keys(r.celle)) {
      if (r.celle[settimana].ritiri === 0) continue;
      r.celle[settimana].ricavoCanoneCents = quotaSettimanale(
        canoneDellaSettimana(canoni, r.clienteId, settimana),
        settimane.length,
      );
    }
  }

  for (const e of extra) {
    const c = cella(e.clienteId, e.settimana);
    if (c) c.ricavoExtraCents += e.prezzoCents;
  }
  for (const p of payouts) {
    const c = cella(p.clienteId, p.settimana);
    if (!c) continue;
    if (p.kind === "bag") c.costoSaccoCents += p.amountCents;
    else c.costoExtraCents += p.amountCents;
  }

  for (const r of righe.values()) {
    for (const s of Object.values(r.celle)) {
      r.totale.ritiri += s.ritiri;
      r.totale.sacchi += s.sacchi;
      r.totale.ricavoCanoneCents += s.ricavoCanoneCents;
      r.totale.ricavoExtraCents += s.ricavoExtraCents;
      r.totale.costoSaccoCents += s.costoSaccoCents;
      r.totale.costoExtraCents += s.costoExtraCents;
    }
  }

  // Chi nel mese non ha niente non si mostra: una riga di zeri in una tabella
  // larga è rumore, e questa pagina serve a leggere un mese in un colpo d'occhio.
  return [...righe.values()]
    .filter((r) => Object.keys(r.celle).length > 0)
    .sort((a, b) => b.totale.ricavoCanoneCents + b.totale.ricavoExtraCents - (a.totale.ricavoCanoneCents + a.totale.ricavoExtraCents));
}

/** I totali di colonna, nell'ordine delle settimane. */
export function totaliPerSettimana(righe: RigaCliente[], settimane: Settimana[]): Cella[] {
  return settimane.map((s) => {
    const t = cellaVuota();
    for (const r of righe) {
      const c = r.celle[s];
      if (!c) continue;
      t.ritiri += c.ritiri;
      t.sacchi += c.sacchi;
      t.ricavoCanoneCents += c.ricavoCanoneCents;
      t.ricavoExtraCents += c.ricavoExtraCents;
      t.costoSaccoCents += c.costoSaccoCents;
      t.costoExtraCents += c.costoExtraCents;
    }
    return t;
  });
}

export const ricaviDi = (c: Cella) => c.ricavoCanoneCents + c.ricavoExtraCents;
export const costiDi = (c: Cella) => c.costoSaccoCents + c.costoExtraCents;
