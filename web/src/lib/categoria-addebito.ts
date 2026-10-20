/** Un movimento del registro cliente entra nei ricavi, o no.
 *
 *  La stessa domanda si faceva in tre posti — la pagina Competenza, i numeri
 *  della Home, il dettaglio delle metriche — con tre `if` scritti a mano, e due
 *  dei tre si fermavano a «non è un rimborso». Bastava per i capi, non per gli
 *  aggiustamenti di canone: il conguaglio di 72,00 € di Federica è un
 *  `charge`, quindi passava, e veniva contato **sopra** il canone che la
 *  competenza già spalma per settimana.
 *
 *  Tre `if` diversi divergono al primo caso nuovo. Qui ce n'è uno solo, con i
 *  test.
 *
 *  Il valore mancante vale `servizio`: le righe scritte prima della 0102 non
 *  hanno la colonna piena nel tipo, e trattarle come «non ricavo» farebbe
 *  sparire incassi veri. */

export type CategoriaAddebito = "servizio" | "canone" | "capo";

export type RigaAddebito = {
  kind: string;
  status: string;
  categoria?: string | null;
};

export function categoriaDi(r: RigaAddebito): CategoriaAddebito {
  return r.categoria === "canone" || r.categoria === "capo" ? r.categoria : "servizio";
}

/** È un aggiustamento del canone — rimborso o conguaglio di un cambio piano?
 *
 *  Sta fuori dai ricavi di competenza perché quei soldi la quota settimanale
 *  li conta già. Non è un movimento da nascondere, però: dove si elencano i
 *  movimenti va mostrato lo stesso, a zero, con la sua spiegazione. Un
 *  movimento da 110 € che non compare da nessuna parte è peggio di uno
 *  spiegato. */
export function eAggiustamentoDiCanone(r: RigaAddebito): boolean {
  return r.status !== "void" && categoriaDi(r) === "canone";
}

/** Entra nei ricavi di competenza?
 *
 *  Fuori stanno: gli annullati (`void`), gli aggiustamenti di canone (già
 *  contati dalla quota), le gemelle dei capi (i capi si leggono da
 *  `order_specials`) e i rimborsi.
 *
 *  I rimborsi di servizio restano fuori **per ora**, come prima: farli entrare
 *  significa celle negative nella settimana in cui è avvenuto il rimborso, non
 *  in quella dell'addebito, e `customer_charges` non ha un riferimento al
 *  movimento rimborsato. È una decisione sua, non un dettaglio di questa
 *  funzione, e quando verrà presa si cambia qui — in un posto solo. */
export function eRicavoDiCompetenza(r: RigaAddebito): boolean {
  if (r.status === "void") return false;
  if (r.kind === "refund") return false;
  return categoriaDi(r) === "servizio";
}
