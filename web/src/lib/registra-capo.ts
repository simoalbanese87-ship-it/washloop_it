import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { conteggiaCapo, type ContoCapo } from "@/lib/capi-compresi";
import { dirittoPerCapo, saldoCapiCompresi } from "@/lib/capi-compresi-abbonamento";
import { franchigiaPerSacco, sacchiPerFranchigia } from "@/lib/franchigia";
import { haAbbonamentoAttivo } from "@/lib/abbonamento-sacchi";
import { dataServizio } from "@/lib/periodo-servizio";

/** Registrare un capo su un ordine: una strada sola.
 *
 *  Ce n'erano due. La lavanderia passava da `addSpecial`, che applica la
 *  franchigia e scrive `qty_totale`; l'ops passava da `addSpecialAdmin`, che
 *  non applicava niente e addebitava tutto. Due strade per lo stesso fatto
 *  divergono alla prima regola nuova — e questa è una regola nuova: i capi
 *  compresi nel canone li deve togliere il sistema, non la memoria di chi
 *  registra.
 *
 *  Qui dentro c'è tutto il conto e nessun messaggio a schermo: chi chiama
 *  decide che cosa dire e dove tornare, perché il portale e il pannello
 *  parlano a due persone diverse. */

export type EsitoRegistrazione = {
  specialId: string;
  conto: ContoCapo;
  item: { id: string; name: string; comp_lav_cents: number; price_cli_cents: number };
  /** Su quanti sacchi è stato fatto il conto della franchigia. */
  sacchi: number;
  /** I sacchi sono ancora una stima: la lavanderia non li ha confermati. */
  sacchiDaConfermare: boolean;
};

export async function registraCapoSpeciale(
  svc: SupabaseClient,
  input: {
    orderId: string;
    itemId: string;
    qty: number;
    addedBy: string;
    /** La lavanderia che riceverà il compenso. */
    laundryId: string | null;
    dichiaratoDalCliente?: boolean;
  },
): Promise<EsitoRegistrazione> {
  const qty = Math.max(1, Math.trunc(input.qty) || 1);

  const { data: item, error: itemErr } = await svc
    .from("special_items")
    .select("id, name, category_id, comp_lav_cents, price_cli_cents, active, incluse_per_sacco")
    .eq("id", input.itemId)
    .single<{
      id: string;
      name: string;
      category_id: string | null;
      comp_lav_cents: number;
      price_cli_cents: number;
      active: boolean;
      incluse_per_sacco: number | null;
    }>();
  if (itemErr || !item) throw new Error("Capo non a listino");
  if (!item.active) throw new Error("Capo non più disponibile");

  const [{ data: ordine }, { count: scansionati }] = await Promise.all([
    svc
      .from("orders")
      .select("customer_id, bags, bags_arrivati")
      .eq("id", input.orderId)
      .maybeSingle<{ customer_id: string; bags: number | null; bags_arrivati: number | null }>(),
    svc.from("order_bags").select("id", { count: "exact", head: true }).eq("order_id", input.orderId),
  ]);

  const conAbbonamento = ordine ? await haAbbonamentoAttivo(svc, ordine.customer_id) : false;
  const sacchi = sacchiPerFranchigia(ordine?.bags_arrivati, scansionati, ordine?.bags);

  // Quante dello stesso capo sono già state registrate su questo ordine: si
  // contano i TOTALI, non gli addebitati, o due registrazioni separate
  // userebbero la franchigia due volte.
  const { data: precedenti } = await svc
    .from("order_specials")
    .select("qty, qty_totale")
    .eq("order_id", input.orderId)
    .eq("item_id", item.id)
    .returns<{ qty: number; qty_totale: number | null }[]>();
  const giaSullOrdine = (precedenti ?? []).reduce((t, r) => t + (r.qty_totale ?? r.qty), 0);

  // Il piatto del canone, in questo ciclo e su tutti gli ordini. Qui NON si
  // esclude l'ordine corrente: le sue registrazioni precedenti hanno consumato
  // davvero, e `conteggiaCapo` deve saperlo.
  const saldo = ordine?.customer_id ? await saldoCapiCompresi(svc, ordine.customer_id) : null;
  const diritto = saldo ? dirittoPerCapo(saldo, item) : null;

  const conto = conteggiaCapo({
    trovate: qty,
    inclusePerSacco: franchigiaPerSacco(item.incluse_per_sacco, conAbbonamento),
    sacchi,
    giaConteggiateSullOrdine: giaSullOrdine,
    canoneSpettanti: diritto ? diritto.spettanti : null,
    canoneGiaUsate: diritto ? diritto.usate : 0,
  });

  // La riga si scrive sempre, anche con `qty = 0`: non è un addebito da zero
  // euro, è la traccia che quel capo è stato trovato e che la franchigia è
  // stata usata. Senza, la volta dopo il conto ripartirebbe da capo.
  const { data: inserted, error } = await svc
    .from("order_specials")
    .insert({
      order_id: input.orderId,
      item_id: item.id,
      item_name: item.name, // snapshot
      qty: conto.daAddebitare,
      qty_totale: qty,
      qty_inclusa: conto.incluseSacco,
      qty_inclusa_canone: conto.incluseCanone,
      comp_lav_cents: item.comp_lav_cents, // snapshot col. D
      price_cli_cents: item.price_cli_cents, // snapshot col. E (mai al partner)
      added_by: input.addedBy,
      ...(input.dichiaratoDalCliente ? { dichiarato_dal_cliente: true } : {}),
    })
    .select("id")
    .single<{ id: string }>();
  if (error || !inserted) throw new Error(error?.message ?? "Errore inserimento capo");

  // Il compenso alla lavanderia segue il **lavoro**, non l'addebito.
  //
  // Un capo compreso nel canone il cliente non lo paga, ma la lavanderia l'ha
  // lavorato: il regalo lo facciamo noi. È la regola del capo regalato (0068).
  // Le unità comprese nel sacco restano invece fuori: quel compenso è già
  // dentro la riga `kind='bag'` che paghiamo comunque.
  if (conto.daPagare > 0 && input.laundryId) {
    await svc.from("laundry_payouts").insert({
      laundry_id: input.laundryId,
      order_id: input.orderId,
      special_id: inserted.id,
      kind: "special",
      amount_cents: item.comp_lav_cents * conto.daPagare,
      status: "pending",
      servizio_il: await dataServizio(svc, input.orderId),
    });
  }

  return {
    specialId: inserted.id,
    conto,
    item,
    sacchi,
    sacchiDaConfermare: ordine?.bags_arrivati == null,
  };
}
