import Link from "next/link";
import { Card, PageTitle } from "@/components/app/AppShell";
import { createServiceClient } from "@/lib/supabase/server";
import { eurCents } from "@/lib/format";
import { aggiungiIva, scorpora, ALIQUOTA_IVA } from "@/lib/iva";
import { aggiornaVoceListino } from "@/lib/actions/admin";

export const dynamic = "force-dynamic";

type Voce = {
  id: string;
  name: string;
  category_id: string | null;
  comp_lav_cents: number;
  price_cli_cents: number;
  active: boolean;
  sort: number | null;
  incluse_per_sacco: number | null;
};
type Categoria = { id: string; name: string; emoji: string | null; sort: number | null };

/** Il listino dei capi speciali, dal lato di chi gestisce.
 *
 *  La lavanderia il suo listino ce l'ha (nel loro portale), il cliente vede i
 *  prezzi in app: l'unico a non avere un posto dove guardarli era chi deve
 *  rispondere «quanto costa una giacca?» — e finiva a cercarli in banca dati.
 *
 *  Qui stanno le tre cifre insieme, che sono quelle che contano e che è facile
 *  confondere: quanto paghiamo alla lavanderia (imponibile, com'è nel
 *  contratto), quanto paga il cliente (IVA inclusa, com'è su Stripe) e quanto
 *  ci resta. Tenerle su tre righe diverse è il modo in cui si sbaglia un
 *  prezzo — è già successo con la camicia. */
export default async function ListinoAdmin({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; warn?: string }>;
}) {
  const { ok, warn } = await searchParams;
  const svc = createServiceClient();
  const [{ data: voci }, { data: categorie }] = await Promise.all([
    svc
      .from("special_items")
      .select("id, name, category_id, comp_lav_cents, price_cli_cents, active, sort, incluse_per_sacco")
      .order("name")
      .returns<Voce[]>(),
    svc.from("special_categories").select("id, name, emoji, sort").order("sort").returns<Categoria[]>(),
  ]);

  const tutte = voci ?? [];
  const attive = tutte.filter((v) => v.active);
  const spente = tutte.filter((v) => !v.active);
  const nomeCat = new Map((categorie ?? []).map((c) => [c.id, `${c.emoji ?? ""} ${c.name}`.trim()]));

  // Margine: quanto resta a WashLoop su ogni capo, al netto dell'IVA da
  // entrambi i lati. Il prezzo cliente è ivato, il compenso lavanderia no.
  const margine = (v: Voce) => scorpora(v.price_cli_cents).imponibile - v.comp_lav_cents;
  const campo = "w-24 rounded-[8px] border border-line bg-white px-2 py-1.5 text-sm font-semibold text-navy outline-none focus:border-blue";

  return (
    <>
      <Link href="/admin/impostazioni" className="font-display text-sm font-bold text-blue hover:underline">
        ← Impostazioni
      </Link>
      <PageTitle
        kicker="Catalogo"
        title="Listino capi speciali"
        sub={`${attive.length} voci attive${spente.length ? ` · ${spente.length} spente` : ""} · quanto paghiamo, quanto incassiamo, quanto resta`}
      />

      <Card className="mb-4">
        <p className="text-sm font-medium text-muted">
          <strong className="text-navy">Alla lavanderia</strong> paghiamo l&apos;imponibile: è la colonna
          «prezzo IVA esclusa per calcolo lavanderia» del contratto, e l&apos;IVA si aggiunge sul proforma.{" "}
          <strong className="text-navy">Il cliente</strong> paga il prezzo con l&apos;IVA già dentro, che è
          quello che vede in app e che va su Stripe. Il margine qui sotto è calcolato al netto dell&apos;IVA
          da entrambi i lati.
        </p>
      </Card>

      {ok && <div className="mb-4 rounded-[14px] bg-[#1F8A5B]/10 px-4 py-3 text-sm font-semibold text-[#1F8A5B]">{ok}</div>}
      {warn && <div className="mb-4 rounded-[14px] bg-[#C9881F]/12 px-4 py-3 text-sm font-semibold text-[#C9881F]">{warn}</div>}

      <Card className="!p-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-left text-sm">
            <thead>
              <tr className="border-b border-line font-display text-[11px] font-extrabold uppercase tracking-wider text-navy/50">
                <th className="px-4 py-3">Capo</th>
                <th className="px-4 py-3">Alla lavanderia<br /><span className="font-medium normal-case">€ imponibile</span></th>
                <th className="px-4 py-3">…con IVA</th>
                <th className="px-4 py-3">Al cliente<br /><span className="font-medium normal-case">€ IVA inclusa</span></th>
                <th className="px-4 py-3">Incluse<br /><span className="font-medium normal-case">per sacco</span></th>
                <th className="px-4 py-3 text-right">Margine</th>
                <th className="px-4 py-3">Attivo</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {tutte.map((v) => {
                const m = margine(v);
                return (
                  <tr key={v.id} className={`border-b border-line/60 last:border-0 ${v.active ? "" : "bg-ice/60"}`}>
                    <td className="px-4 py-2">
                      <div className="font-display font-bold text-navy">{v.name}</div>
                      <div className="text-[11px] font-medium text-muted">{nomeCat.get(v.category_id ?? "") ?? "—"}</div>
                    </td>
                    <td className="px-4 py-2">
                      <input
                        form={`f-${v.id}`}
                        name="comp_lav_eur"
                        type="number"
                        step="0.01"
                        min="0"
                        defaultValue={(v.comp_lav_cents / 100).toFixed(2)}
                        className={campo}
                      />
                    </td>
                    <td className="px-4 py-2 text-xs font-medium text-muted">{eurCents(aggiungiIva(v.comp_lav_cents).lordo)}</td>
                    <td className="px-4 py-2">
                      <input
                        form={`f-${v.id}`}
                        name="price_cli_eur"
                        type="number"
                        step="0.01"
                        min="0"
                        defaultValue={(v.price_cli_cents / 100).toFixed(2)}
                        className={campo}
                      />
                    </td>
                    <td className="px-4 py-2">
                      <input
                        form={`f-${v.id}`}
                        name="incluse_per_sacco"
                        type="number"
                        min="0"
                        defaultValue={v.incluse_per_sacco ?? 0}
                        className={`${campo} w-16`}
                      />
                    </td>
                    <td className={`px-4 py-2 text-right font-display font-extrabold ${m > 0 ? "text-[#1F8A5B]" : "text-[#C0392B]"}`}>
                      {eurCents(m)}
                    </td>
                    <td className="px-4 py-2">
                      <input form={`f-${v.id}`} type="checkbox" name="active" defaultChecked={v.active} className="h-4 w-4 accent-[#2b7fd4]" />
                    </td>
                    <td className="px-4 py-2">
                      <form id={`f-${v.id}`} action={aggiornaVoceListino}>
                        <input type="hidden" name="item_id" value={v.id} />
                        <button type="submit" className="font-display text-sm font-bold text-blue hover:underline">
                          Salva
                        </button>
                      </form>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <p className="mt-3 rounded-[12px] bg-[#C9881F]/10 px-3 py-2 text-xs font-semibold text-[#C9881F]">
        Cambiare un prezzo vale per i capi da qui in avanti. Gli addebiti già registrati NON cambiano: ogni
        riga conserva il prezzo del momento in cui è stata inserita, così nessun cliente si ritrova
        addebitato un importo deciso dopo.
      </p>

      {spente.length > 0 && (
        <Card className="mt-4">
          <h2 className="font-display text-base font-extrabold text-navy">Non addebitabili ({spente.length})</h2>
          <p className="mt-1 text-sm font-medium text-muted">
            Voci spente: non compaiono né nel listino della lavanderia né in quello del cliente, quindi
            nessuno può addebitarle. O sono comprese nel sacco, o le abbiamo tolte dal servizio.
          </p>
          <ul className="mt-3 flex flex-wrap gap-2">
            {spente.map((v) => (
              <li key={v.id} className="rounded-full bg-ice px-3 py-1.5 font-display text-xs font-bold text-navy/70">
                {v.name}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs font-medium text-muted">
            Sono nella tabella qui sopra, con la riga in grigio: per rimetterle a listino basta la spunta
            «Attivo».
          </p>
        </Card>
      )}

      <p className="mt-4 text-xs font-medium text-muted">
        Questa pagina è la fonte da leggere prima di rispondere a un cliente o di controllare un proforma.
        «Incluse per sacco» è la franchigia dell&apos;abbonamento: 3 sulla camicia, come promesso in home e
        nelle FAQ. Il sistema la sottrae da solo quando la lavanderia registra i capi.
      </p>
    </>
  );
}
