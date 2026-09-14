/** Il conto per competenza: quanto vale una settimana di lavoro.
 *
 *  Perché accanto alla cassa, e non al posto suo
 *  ---------------------------------------------
 *  La Home dice quanto è **arrivato** su Stripe. È il numero che serve per
 *  sapere se si può pagare la lavanderia, e non mente mai. Ma non dice se il
 *  servizio sta in piedi: un canone incassato il 29 copre quattro settimane di
 *  ritiri, e il mese in cui nessuno ritira niente ha lo stesso identico
 *  incasso di quello pieno.
 *
 *  Qui il ricavo si attribuisce a **quando il servizio è stato reso**. Una
 *  settimana senza ritiri vale zero, anche se quella settimana abbiamo
 *  incassato: è il senso stretto della competenza, e fa vedere le settimane in
 *  cui prendiamo soldi senza lavorare — che sono quelle in cui un cliente sta
 *  per accorgersi di pagare per niente.
 *
 *  Sta in un file senza `server-only` perché è il punto in cui si sbaglia un
 *  conto e nessuno se ne accorge: va collaudato da solo. */

/** Un ritiro, ridotto a ciò che serve per il conto. */
export type RitiroPerCompetenza = {
  /** Chi l'ha fatto: il canone si divide per i ritiri **di quel cliente**. */
  clienteId: string;
  /** Lunedì della settimana, YYYY-MM-DD in fuso di Roma. */
  settimana: string;
  /** Mese di competenza, YYYY-MM: è la finestra su cui si spalma il canone. */
  mese: string;
  /** Sacchi davvero arrivati. È quello che paghiamo alla lavanderia. */
  sacchi: number;
};

export type CanoneCliente = {
  clienteId: string;
  /** Canone mensile in centesimi, IVA inclusa. */
  canoneCents: number;
  /** Sacchi a settimana previsti dal piano. `null` sugli abbonamenti su misura,
   *  dove il piano non c'è: lì un «previsto» non esiste e inventarlo
   *  falserebbe il confronto. */
  sacchiPrevisti: number | null;
};

export type SettimanaCompetenza = {
  settimana: string;
  ritiri: number;
  sacchi: number;
  /** Quota di canone maturata: la parte di abbonamento che quei ritiri hanno
   *  «guadagnato». */
  ricavoCanoneCents: number;
  /** Capi extra addebitati in quella settimana, al netto di storni e regali. */
  ricavoExtraCents: number;
  /** Quanto abbiamo pagato alla lavanderia per quella settimana. */
  costoCents: number;
};

/** Il lunedì della settimana di una data, in fuso di Roma. */
export function lunediDi(iso: string): string {
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

/** Quanto canone matura ogni ritiro di un cliente in un mese.
 *
 *  Il canone è mensile, il servizio settimanale: la quota di un ritiro è il
 *  canone diviso i ritiri **effettivi** di quel cliente in quel mese. Con
 *  quattro ritiri da 160 € si maturano 40 € a ritiro; con due, 80 € — perché
 *  quei due ritiri hanno dovuto valere tutto il canone.
 *
 *  Zero ritiri: il canone non matura, e non si divide per zero. Quel mese il
 *  cliente ha pagato per un servizio che non ha usato, ed è un'informazione,
 *  non un errore di calcolo. */
export function quotaPerRitiro(canoneCents: number, ritiriDelMese: number): number {
  if (ritiriDelMese <= 0) return 0;
  return Math.round(canoneCents / ritiriDelMese);
}

/** Il costo che ci aspetteremmo in una settimana, se ogni cliente con un piano
 *  usasse tutti i suoi sacchi.
 *
 *  Si calcola **solo sui clienti con un piano**: su un abbonamento su misura i
 *  sacchi previsti non esistono, e metterci un numero a caso trasformerebbe il
 *  confronto in un'opinione. Chi resta fuori va detto, non nascosto. */
export function costoPrevistoCents(canoni: CanoneCliente[], compensoSaccoCents: number): {
  cents: number;
  conPiano: number;
  senzaPiano: number;
} {
  let cents = 0;
  let conPiano = 0;
  let senzaPiano = 0;
  for (const c of canoni) {
    if (c.sacchiPrevisti == null) { senzaPiano++; continue; }
    conPiano++;
    cents += c.sacchiPrevisti * compensoSaccoCents;
  }
  return { cents, conPiano, senzaPiano };
}

/** Aggrega i ritiri per settimana, spalmando il canone di ciascun cliente sui
 *  suoi ritiri del mese. */
export function settimaneDiCompetenza(
  ritiri: RitiroPerCompetenza[],
  canoni: CanoneCliente[],
  extraPerSettimana: Map<string, number>,
  costoPerSettimana: Map<string, number>,
): SettimanaCompetenza[] {
  const canonePerCliente = new Map(canoni.map((c) => [c.clienteId, c.canoneCents]));

  // Quanti ritiri ha fatto ogni cliente in ogni mese: è il divisore del canone.
  const ritiriPerClienteMese = new Map<string, number>();
  for (const r of ritiri) {
    const k = `${r.clienteId}|${r.mese}`;
    ritiriPerClienteMese.set(k, (ritiriPerClienteMese.get(k) ?? 0) + 1);
  }

  const perSettimana = new Map<string, SettimanaCompetenza>();
  const prendi = (settimana: string): SettimanaCompetenza => {
    let s = perSettimana.get(settimana);
    if (!s) {
      s = {
        settimana,
        ritiri: 0,
        sacchi: 0,
        ricavoCanoneCents: 0,
        ricavoExtraCents: extraPerSettimana.get(settimana) ?? 0,
        costoCents: costoPerSettimana.get(settimana) ?? 0,
      };
      perSettimana.set(settimana, s);
    }
    return s;
  };

  for (const r of ritiri) {
    const s = prendi(r.settimana);
    s.ritiri += 1;
    s.sacchi += r.sacchi;
    const canone = canonePerCliente.get(r.clienteId) ?? 0;
    const quanti = ritiriPerClienteMese.get(`${r.clienteId}|${r.mese}`) ?? 0;
    s.ricavoCanoneCents += quotaPerRitiro(canone, quanti);
  }

  // Le settimane con soldi ma senza ritiri devono comparire lo stesso: un extra
  // addebitato o un compenso maturato in una settimana vuota è precisamente la
  // cosa che si va a cercare qui.
  for (const k of extraPerSettimana.keys()) prendi(k);
  for (const k of costoPerSettimana.keys()) prendi(k);

  return [...perSettimana.values()].sort((a, b) => b.settimana.localeCompare(a.settimana));
}

/** Ricavo meno costo. Il costo alla lavanderia è imponibile, il ricavo al
 *  cliente è IVA inclusa: prima di sottrarre si scorpora, altrimenti il
 *  margine risulta più grande di quello che è. */
export function margineCents(s: SettimanaCompetenza, aliquota = 22): number {
  const lordo = s.ricavoCanoneCents + s.ricavoExtraCents;
  const imponibile = Math.round(lordo / (1 + aliquota / 100));
  return imponibile - s.costoCents;
}
