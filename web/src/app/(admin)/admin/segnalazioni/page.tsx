import Link from "next/link";
import { Card, PageTitle } from "@/components/app/AppShell";
import { SegnalazioneRiga, type Segnalazione } from "@/components/app/SegnalazioneRiga";
import { createServiceClient } from "@/lib/supabase/server";
import { signedProofUrl } from "@/lib/orders";
import { etichetteFasce } from "@/lib/riprogramma";

export const dynamic = "force-dynamic";

type Riga = Segnalazione & {
  order_id: string;
  orders: {
    status: string;
    profiles: { full_name: string | null; client_code: string | null; is_test: boolean | null } | null;
  } | null;
};

/** Le segnalazioni aperte, tutte insieme.
 *
 *  Esiste perché il riquadro in home deve poter aprire qualcosa: un numero che
 *  non porta da nessuna parte si guarda una volta e poi si smette di guardarlo.
 *
 *  L'ordinamento non è cronologico. Prima quelle che il cliente ancora non sa —
 *  cioè i danni in lavorazione in attesa che decidiamo cosa proporre — perché
 *  quelle sono le uniche in cui il ritardo lo paga lui. */
export default async function SegnalazioniAperte({
  searchParams,
}: {
  searchParams: Promise<{ prova?: string; tutte?: string }>;
}) {
  const { prova, tutte } = await searchParams;
  const includiProva = prova === "1";
  const mostraChiuse = tutte === "1";
  const svc = createServiceClient();

  let q = svc
    .from("order_issues")
    .select(
      "id, order_id, kind, capo, testo, photo_url, created_at, published_at, resolved_at, resolution, pronto_stimato, riconsegna_da, riconsegna_a, orders!inner(status, profiles!orders_customer_id_fkey!inner(full_name, client_code, is_test))",
    )
    .order("created_at", { ascending: false })
    .limit(100);
  if (!mostraChiuse) q = q.is("resolved_at", null);
  if (!includiProva) q = q.eq("orders.profiles.is_test", false);

  const { data } = await q.returns<Riga[]>();
  const fasce = await etichetteFasce(svc, (data ?? []).flatMap((r) => [r.riconsegna_da, r.riconsegna_a]));
  const righe = await Promise.all(
    (data ?? []).map(async (r) => ({
      ...r,
      fotoUrl: await signedProofUrl(svc, r.photo_url),
      riconsegnaDa: r.riconsegna_da ? (fasce.get(r.riconsegna_da) ?? null) : null,
      riconsegnaA: r.riconsegna_a ? (fasce.get(r.riconsegna_a) ?? null) : null,
    })),
  );

  // Da comunicare prima di tutto, poi il resto per data.
  righe.sort((a, b) => Number(!!a.published_at) - Number(!!b.published_at));
  const daComunicare = righe.filter((r) => !r.published_at).length;

  return (
    <>
      <PageTitle
        kicker="Lavanderia"
        title="Segnalazioni sui capi"
        sub={
          righe.length === 0
            ? mostraChiuse
              ? "Nessuna segnalazione."
              : "Nessuna segnalazione aperta."
            : `${righe.length} ${righe.length === 1 ? "segnalazione" : "segnalazioni"}${daComunicare > 0 ? ` · ${daComunicare} che il cliente ancora non sa` : ""}`
        }
      />

      <div className="mb-4 flex flex-wrap gap-3">
        <Link
          href={mostraChiuse ? "/admin/segnalazioni" : "/admin/segnalazioni?tutte=1"}
          className="font-display text-xs font-bold text-navy/55 hover:text-navy"
        >
          {mostraChiuse ? "← Solo quelle aperte" : "Mostra anche quelle chiuse →"}
        </Link>
        <Link
          href={includiProva ? "/admin/segnalazioni" : "/admin/segnalazioni?prova=1"}
          className="font-display text-xs font-bold text-navy/55 hover:text-navy"
        >
          {includiProva ? "Nascondi i dati di prova" : "Mostra i dati di prova"}
        </Link>
      </div>

      {righe.length === 0 ? (
        <Card>
          <p className="text-sm font-medium text-muted">
            Quando la lavanderia segnala un capo macchiato, rovinato o danneggiato in lavorazione, compare qui.
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {righe.map((r) => (
            <SegnalazioneRiga key={r.id} s={r} fotoUrl={r.fotoUrl}>
              <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-line/70 pt-3">
                <span className="font-display text-sm font-extrabold text-navy">
                  {r.orders?.profiles?.full_name ?? "Cliente"}
                </span>
                <span className="rounded-full bg-ice px-2.5 py-1 font-display text-xs font-bold text-navy">
                  {r.orders?.profiles?.client_code ?? "—"}
                </span>
                <Link
                  href={`/admin/ordini/${r.order_id}`}
                  className="ml-auto font-display text-sm font-extrabold text-blue hover:underline"
                >
                  Apri l&apos;ordine →
                </Link>
              </div>
            </SegnalazioneRiga>
          ))}
        </div>
      )}
    </>
  );
}
