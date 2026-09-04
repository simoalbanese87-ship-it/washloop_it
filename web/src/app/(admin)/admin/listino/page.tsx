import Link from "next/link";
import { Card, PageTitle } from "@/components/app/AppShell";
import { createServiceClient } from "@/lib/supabase/server";
import { eurCents } from "@/lib/format";
import { aggiungiIva, scorpora, ALIQUOTA_IVA } from "@/lib/iva";

export const dynamic = "force-dynamic";

type Voce = {
  id: string;
  name: string;
  category_id: string | null;
  comp_lav_cents: number;
  price_cli_cents: number;
  active: boolean;
  sort: number | null;
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
export default async function ListinoAdmin() {
  const svc = createServiceClient();
  const [{ data: voci }, { data: categorie }] = await Promise.all([
    svc
      .from("special_items")
      .select("id, name, category_id, comp_lav_cents, price_cli_cents, active, sort")
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

      <Card className="!p-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b border-line font-display text-[11px] font-extrabold uppercase tracking-wider text-navy/50">
                <th className="px-4 py-3">Capo</th>
                <th className="px-4 py-3">Categoria</th>
                <th className="px-4 py-3 text-right">Alla lavanderia<br /><span className="font-medium normal-case">imponibile</span></th>
                <th className="px-4 py-3 text-right">…con IVA {ALIQUOTA_IVA}%</th>
                <th className="px-4 py-3 text-right">Al cliente<br /><span className="font-medium normal-case">IVA inclusa</span></th>
                <th className="px-4 py-3 text-right">Margine<br /><span className="font-medium normal-case">netto</span></th>
              </tr>
            </thead>
            <tbody>
              {attive.map((v) => {
                const m = margine(v);
                return (
                  <tr key={v.id} className="border-b border-line/60 last:border-0">
                    <td className="px-4 py-2.5 font-display font-bold text-navy">{v.name}</td>
                    <td className="px-4 py-2.5 text-xs font-medium text-muted">{nomeCat.get(v.category_id ?? "") ?? "—"}</td>
                    <td className="px-4 py-2.5 text-right font-semibold text-navy">{eurCents(v.comp_lav_cents)}</td>
                    <td className="px-4 py-2.5 text-right text-muted">{eurCents(aggiungiIva(v.comp_lav_cents).lordo)}</td>
                    <td className="px-4 py-2.5 text-right font-semibold text-navy">{eurCents(v.price_cli_cents)}</td>
                    <td className={`px-4 py-2.5 text-right font-display font-extrabold ${m > 0 ? "text-[#1F8A5B]" : "text-[#C0392B]"}`}>
                      {eurCents(m)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

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
                {v.name} · era {eurCents(v.price_cli_cents)}
              </li>
            ))}
          </ul>
        </Card>
      )}

      <p className="mt-4 text-xs font-medium text-muted">
        I prezzi si modificano dal database o si riallineano al contratto: questa pagina è la fonte da
        leggere prima di rispondere a un cliente o di controllare un proforma.
      </p>
    </>
  );
}
