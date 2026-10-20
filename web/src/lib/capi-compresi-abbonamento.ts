import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ordiniDelCiclo } from "@/lib/ciclo-ordini";
import {
  canoneUsateDaRighe,
  fraseCapiCompresi,
  periodoDelCanone,
  type DirittoCapo,
  type Periodo,
} from "@/lib/capi-compresi";

/** Il saldo dei capi compresi nel canone, letto dal database.
 *
 *  Gemella di `saldoPassaggi`: qui c'è solo la lettura, la regola sta nel
 *  modulo puro `capi-compresi.ts` che ha i test.
 *
 *  **Va chiamata col service client.** Decide cosa si addebita a un cliente che
 *  paga: con la sessione dell'utente una policy che nega non dà errore, torna
 *  una lista vuota — e un piatto pieno per sbaglio vuol dire capi regalati
 *  senza che nessuno l'abbia deciso. */

export type Diritto = {
  id: string;
  /** Il capo preciso, quando l'accordo è su quello. */
  itemId: string | null;
  /** Oppure la categoria: «un capo fra i cappotti». */
  categoryId: string | null;
  nome: string;
  spettanti: number;
  usate: number;
  /** Quante ne restano in questo ciclo. */
  residue: number;
};

export type SaldoCapiCompresi = {
  subscriptionId: string;
  periodo: Periodo;
  diritti: Diritto[];
  /** La frase pronta, o `null` se non ci sono diritti configurati. */
  frase: string | null;
};

type SubRiga = {
  id: string;
  status: string;
  current_period_end: string | null;
  activated_at: string | null;
};

type RigaDiritto = {
  id: string;
  item_id: string | null;
  category_id: string | null;
  qty_per_ciclo: number;
  special_items: { name: string } | { name: string }[] | null;
  special_categories: { name: string } | { name: string }[] | null;
};

const uno = <T,>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? v[0] ?? null : v ?? null);

export async function saldoCapiCompresi(
  svc: SupabaseClient,
  customerId: string,
  opts?: {
    /** Un ordine da **non** contare fra quelli che hanno già consumato.
     *
     *  Serve al ricalcolo: rifacendo il conto di un ordine, le unità che
     *  quell'ordine aveva assorbito risulterebbero già usate, il piatto
     *  sembrerebbe vuoto e il cliente si vedrebbe addebitare capi che il
     *  canone comprende. È il doppio conteggio più facile da introdurre qui. */
    escludiOrdine?: string;
  },
): Promise<SaldoCapiCompresi | null> {
  const { data: sub } = await svc
    .from("subscriptions")
    .select("id, status, current_period_end, activated_at")
    .eq("user_id", customerId)
    .in("status", ["active", "trialing"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<SubRiga>();
  if (!sub) return null;

  const { data: righe } = await svc
    .from("capi_compresi")
    .select("id, item_id, category_id, qty_per_ciclo, special_items(name), special_categories(name)")
    .eq("subscription_id", sub.id)
    .returns<RigaDiritto[]>();

  const periodo = periodoDelCanone(sub, new Date());
  if (!righe || righe.length === 0) {
    return { subscriptionId: sub.id, periodo, diritti: [], frase: null };
  }

  const ordini = (await ordiniDelCiclo(svc, customerId, periodo)).filter((id) => id !== opts?.escludiOrdine);

  // Le unità già assorbite dal canone in questo ciclo, capo per capo. Si
  // leggono dalle righe degli ordini — che sono il fatto — e non da un
  // contatore, come i passaggi della 0096.
  const usatePerItem = new Map<string, number>();
  if (ordini.length > 0) {
    const { data: consumi } = await svc
      .from("order_specials")
      .select("item_id, qty_inclusa_canone, annullato_at")
      .in("order_id", ordini)
      .gt("qty_inclusa_canone", 0)
      .returns<{ item_id: string | null; qty_inclusa_canone: number | null; annullato_at: string | null }[]>();
    for (const c of consumi ?? []) {
      if (!c.item_id) continue;
      usatePerItem.set(c.item_id, (usatePerItem.get(c.item_id) ?? 0) + canoneUsateDaRighe([c]));
    }
  }

  // Per un diritto di categoria le unità consumate possono stare su capi
  // diversi: serve sapere a quale categoria appartiene ciascuno.
  const categoriaDi = new Map<string, string>();
  const itemIds = [...usatePerItem.keys()];
  if (itemIds.length > 0) {
    const { data: capi } = await svc
      .from("special_items")
      .select("id, category_id")
      .in("id", itemIds)
      .returns<{ id: string; category_id: string | null }[]>();
    for (const c of capi ?? []) if (c.category_id) categoriaDi.set(c.id, c.category_id);
  }

  const diritti: Diritto[] = righe.map((r) => {
    const usate = r.item_id
      ? usatePerItem.get(r.item_id) ?? 0
      : [...usatePerItem.entries()]
          .filter(([itemId]) => categoriaDi.get(itemId) === r.category_id)
          .reduce((t, [, n]) => t + n, 0);
    const spettanti = Math.max(0, Math.trunc(r.qty_per_ciclo));
    return {
      id: r.id,
      itemId: r.item_id,
      categoryId: r.category_id,
      nome: r.item_id
        ? uno(r.special_items)?.name ?? "Capo"
        : `Un capo fra ${uno(r.special_categories)?.name ?? "la categoria"}`,
      spettanti,
      usate,
      residue: Math.max(0, spettanti - usate),
    };
  });

  const perFrase: DirittoCapo[] = diritti.map((d) => ({ nome: d.nome, spettanti: d.spettanti, usate: d.usate }));
  return {
    subscriptionId: sub.id,
    periodo,
    diritti,
    frase: fraseCapiCompresi(perFrase, sub.current_period_end),
  };
}

/** Quante unità di QUEL capo comprende ancora il canone di questo cliente.
 *
 *  È la domanda che si fa al momento di registrare un capo: prima il diritto
 *  sulla voce di listino, poi quello sulla sua categoria. `null` quando non c'è
 *  nessun diritto che lo copre — che è diverso da «zero rimaste», e chi chiama
 *  deve poterli distinguere per dirlo a schermo. */
export function dirittoPerCapo(
  saldo: SaldoCapiCompresi | null,
  item: { id: string; category_id?: string | null },
): Diritto | null {
  if (!saldo) return null;
  return (
    saldo.diritti.find((d) => d.itemId === item.id) ??
    saldo.diritti.find((d) => d.categoryId && d.categoryId === item.category_id) ??
    null
  );
}
