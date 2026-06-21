import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { stripe } from "@/lib/stripe";
import { fmtDate } from "@/lib/format";

const ChevLeft = () => (
  <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"><path d="m15 6-6 6 6 6" /></svg>
);
const DocIcon = () => (
  <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M14 3v5h5" /><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /></svg>
);

const STATUS_LABEL: Record<string, string> = {
  paid: "Pagata",
  open: "Da pagare",
  void: "Annullata",
  draft: "Bozza",
  uncollectible: "Non riscossa",
};

export default async function FatturePage() {
  const supabase = await createClient();
  const { data: sub } = await supabase
    .from("subscriptions")
    .select("stripe_customer_id")
    .not("stripe_customer_id", "is", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<{ stripe_customer_id: string | null }>();

  let invoices: { id: string; number: string | null; created: number; total: number; status: string | null; url: string | null }[] = [];
  if (sub?.stripe_customer_id) {
    try {
      const res = await stripe().invoices.list({ customer: sub.stripe_customer_id, limit: 24 });
      invoices = res.data.map((i) => ({
        id: i.id,
        number: i.number,
        created: i.created,
        total: i.total,
        status: i.status,
        url: i.hosted_invoice_url ?? i.invoice_pdf ?? null,
      }));
    } catch {
      invoices = [];
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Link href="/app/profilo" aria-label="Indietro" className="grid h-11 w-11 place-items-center rounded-full bg-white text-navy shadow-[0_1px_0_rgba(27,45,94,0.04),0_10px_24px_-18px_rgba(27,45,94,0.5)]">
          <ChevLeft />
        </Link>
        <h1 className="font-display text-lg font-black tracking-[-0.02em] text-navy">Fatture</h1>
      </div>

      {invoices.length === 0 ? (
        <div className="rounded-[18px] border border-line bg-white px-4 py-8 text-center text-sm font-medium text-muted">
          Nessuna fattura ancora. Compaiono qui dopo il primo addebito dell&apos;abbonamento.
        </div>
      ) : (
        <section className="overflow-hidden rounded-[18px] border border-line bg-white">
          {invoices.map((inv) => {
            const Wrap = inv.url ? "a" : "div";
            return (
              <Wrap
                key={inv.id}
                {...(inv.url ? { href: inv.url, target: "_blank", rel: "noopener noreferrer" } : {})}
                className="flex items-center gap-3 border-b border-line px-4 py-3.5 last:border-0 transition-colors active:bg-ice"
              >
                <span className="grid h-11 w-11 flex-none place-items-center rounded-[13px] bg-ice text-blue"><DocIcon /></span>
                <span className="min-w-0 flex-1">
                  <span className="block font-display text-sm font-bold text-navy">{inv.number ?? "Fattura"}</span>
                  <span className="block text-xs font-medium text-muted">{fmtDate(new Date(inv.created * 1000))} · {STATUS_LABEL[inv.status ?? ""] ?? inv.status}</span>
                </span>
                <span className="font-display text-sm font-extrabold text-navy">€{(inv.total / 100).toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </Wrap>
            );
          })}
        </section>
      )}
      <p className="text-center text-xs font-medium text-muted">Le fatture includono l&apos;abbonamento e gli eventuali servizi extra del mese.</p>
    </div>
  );
}
