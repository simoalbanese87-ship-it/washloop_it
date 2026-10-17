/** Quali compiti servono a questo cliente, adesso.
 *
 *  Sta in un modulo puro perché è la parte che può sbagliare in silenzio. Un
 *  compito che non nasce non dà errore: manca, e lo scopri dal cliente che
 *  resta senza sacco. Un rientro che nasce quando non deve è peggio: il rider
 *  si presenta a riprendersi il materiale di una persona che paga ancora.
 *
 *  Le tre distinzioni che contano
 *  -----------------------------
 *  **Pausa.** Chi mette in pausa tiene il materiale. L'abbonamento riprende,
 *  il sacco serve ancora, e andare a riprenderselo è il modo più rapido di
 *  trasformare una pausa in una disdetta. Mai un rientro su `paused`.
 *
 *  **Disdetta programmata.** Il cliente ha pagato fino al rinnovo e fino a lì
 *  il servizio gli spetta. Il rientro nasce subito — così non dipende da
 *  nessuno che se ne ricordi fra tre settimane — ma si vede dal giorno dopo la
 *  fine, che è `visibileDal`.
 *
 *  **Chiusura.** L'abbonamento è finito: il rientro si vede oggi.
 *
 *  E la quarta, che è un ripensamento: chi riprende l'abbonamento dopo aver
 *  disdetto ha un rientro aperto che adesso è sbagliato. Va annullato, ed è il
 *  difetto più probabile di tutto questo giro — per questo `daAnnullare` è
 *  parte della stessa risposta e non una funzione a parte che qualcuno deve
 *  ricordarsi di chiamare. */

export type TipoCompito = "dotazione" | "rientro";

export type StatoCliente = {
  /** Lo stato dell'abbonamento come lo scriviamo noi: active, trialing, paused, canceled… */
  stato: string | null;
  /** Disdetta a fine periodo: su Stripe è `cancel_at_period_end`. */
  disdettaProgrammata: boolean;
  /** Fine del periodo pagato, ISO. Serve solo alla disdetta programmata. */
  finePeriodoIso: string | null;
  /** Ha già i cartellini QR? (profiles.tags_delivered_at) */
  tagConsegnatiAt: string | null;
  /** Ha già il suo sacco? (profiles.borsa_consegnata_at) */
  borsaConsegnataAt: string | null;
  /** Il materiale è già rientrato? (profiles.materiale_rientrato_at) */
  materialeRientratoAt: string | null;
};

export type CompitoDaCreare = {
  tipo: TipoCompito;
  /** Giorno da cui il rider lo vede, in formato `YYYY-MM-DD`. */
  visibileDal: string;
  /** Entro quando, `YYYY-MM-DD`. */
  scadeIl: string;
};

export type Decisione = {
  daCreare: CompitoDaCreare[];
  /** Compiti aperti che adesso sono sbagliati e vanno chiusi senza farli. */
  daAnnullare: TipoCompito[];
};

/** Quanti giorni si danno per portare il materiale a chi comincia. Tre: è il
 *  primo ritiro che aspetta, non una scadenza amministrativa. */
const GIORNI_DOTAZIONE = 3;
/** E per riprenderselo. Sette: si passa quando si passa da quelle parti. */
const GIORNI_RIENTRO = 7;

const ATTIVI = ["active", "trialing"];

/** Il giorno civile in formato `YYYY-MM-DD`, in ora di Roma.
 *
 *  In UTC, dalle 23 alle 24 di un giorno d'estate italiana siamo già al giorno
 *  dopo: un rientro «da domani» calcolato alle 23:30 sarebbe comparso oggi. */
export function giornoRoma(ms: number): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Rome",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(ms));
}

/** Somma giorni a un giorno civile, restando un giorno civile. */
export function piuGiorni(giorno: string, giorni: number): string {
  const t = Date.parse(`${giorno}T12:00:00Z`);
  if (!Number.isFinite(t)) return giorno;
  return new Date(t + giorni * 86_400_000).toISOString().slice(0, 10);
}

/** Gli manca qualcosa di quello che gli dobbiamo dare?
 *
 *  Il materiale rientrato conta come «non ce l'ha». È il cliente che chiude e
 *  dopo qualche mese torna: le date della prima consegna restano scritte —
 *  dicono quando è successo, e servono a sapere da quanto è in strada — ma il
 *  sacco gliel'abbiamo ripreso, e ricominciare senza glielo lascerebbe senza.
 *  L'invariante è questa: `materiale_rientrato_at` valorizzato significa che
 *  oggi non ha niente di nostro, e la spunta della dotazione lo riazzera. */
export function serveDotazione(s: StatoCliente): boolean {
  if (s.materialeRientratoAt) return true;
  return !s.tagConsegnatiAt || !s.borsaConsegnataAt;
}

/** Ha in mano qualcosa che è nostro, e non ce l'ha ancora ridato? */
export function haMaterialeNostro(s: StatoCliente): boolean {
  if (s.materialeRientratoAt) return false;
  return !!s.tagConsegnatiAt || !!s.borsaConsegnataAt;
}

export function decidiCompiti(s: StatoCliente, adessoMs: number): Decisione {
  const oggi = giornoRoma(adessoMs);
  const daCreare: CompitoDaCreare[] = [];
  const daAnnullare: TipoCompito[] = [];
  const stato = s.stato ?? "";

  // Pausa: non si crea niente e non si annulla niente. Chi è in pausa tiene il
  // materiale e la dotazione eventualmente aperta resta aperta — se non ha
  // ancora ricevuto il sacco, glielo dobbiamo comunque.
  if (stato === "paused") return { daCreare, daAnnullare };

  if (ATTIVI.includes(stato) && !s.disdettaProgrammata) {
    // Cliente che lavora: gli serve quello che non ha, e il rientro — se c'era
    // da una disdetta poi ritirata — non ha più senso.
    if (serveDotazione(s)) {
      daCreare.push({ tipo: "dotazione", visibileDal: oggi, scadeIl: piuGiorni(oggi, GIORNI_DOTAZIONE) });
    }
    daAnnullare.push("rientro");
    return { daCreare, daAnnullare };
  }

  if (ATTIVI.includes(stato) && s.disdettaProgrammata) {
    // Ha disdetto ma è ancora servito. Il rientro nasce ora e si vede dopo.
    // La dotazione aperta non si annulla: se gli manca il sacco e paga ancora,
    // il sacco gli serve ancora.
    if (haMaterialeNostro(s)) {
      const fine = s.finePeriodoIso ? giornoRoma(Date.parse(s.finePeriodoIso)) : oggi;
      // `piuGiorni(fine, 1)`: il giorno della fine il servizio c'è ancora.
      const visibileDal = Number.isFinite(Date.parse(`${fine}T12:00:00Z`)) ? piuGiorni(fine, 1) : oggi;
      daCreare.push({ tipo: "rientro", visibileDal, scadeIl: piuGiorni(visibileDal, GIORNI_RIENTRO) });
    }
    return { daCreare, daAnnullare };
  }

  if (stato === "canceled") {
    // Finito. Il materiale si riprende, e la dotazione non fatta non si fa più:
    // portare il sacco a chi ha chiuso è il giro più inutile della giornata.
    if (haMaterialeNostro(s)) {
      daCreare.push({ tipo: "rientro", visibileDal: oggi, scadeIl: piuGiorni(oggi, GIORNI_RIENTRO) });
    }
    daAnnullare.push("dotazione");
    return { daCreare, daAnnullare };
  }

  // Stati di passaggio di Stripe — `incomplete`, `past_due`, `unpaid` — e
  // qualunque cosa non conosciamo: non si decide niente. Un pagamento che non
  // è ancora andato a buon fine non è una disdetta, e non è un inizio.
  return { daCreare, daAnnullare };
}
