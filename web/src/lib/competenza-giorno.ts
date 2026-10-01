/** A quale giorno appartiene un compenso della lavanderia.
 *
 *  Non è il giorno in cui scriviamo la riga: la riga dei sacchi nasce alla
 *  riconsegna, quella dei capi speciali quando la lavanderia li registra, e una
 *  correzione può arrivare settimane dopo. Tre date diverse per lo stesso
 *  lavoro.
 *
 *  È **la presa in carico**, cioè il ritiro: il giorno in cui la roba entra in
 *  lavanderia è il giorno in cui nasce il costo, e un ordine ritirato il 29
 *  settembre appartiene a settembre anche se torna al cliente il 2 ottobre.
 *  Prima si usava la riconsegna, e quei tre ordini finivano nel proforma di
 *  ottobre: la lavanderia li aveva lavorati a settembre.
 *
 *  Il vantaggio non è solo contabile: sacchi e capi speciali dello stesso
 *  ordine cadono sempre nello stesso mese, qualunque sia la data in cui le due
 *  righe vengono scritte. */
export function giornoDiCompetenza(
  ritiroIso: string | null,
  riconsegnaIso: string | null,
  creatoIso: string | null,
  oggiIso: string,
): string {
  // La riconsegna resta come ripiego: un ordine senza fascia di ritiro è raro
  // ma esiste, e una riga di compenso senza periodo non si può controllare
  // affatto — che è peggio di un periodo approssimato.
  const quando = ritiroIso ?? riconsegnaIso ?? creatoIso ?? oggiIso;
  return quando.slice(0, 10);
}
