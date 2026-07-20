import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { Logo } from "@/components/Logo";
import { PrintButton } from "@/components/app/PrintButton";
import { createClient } from "@/lib/supabase/server";
import { fmtDateTime } from "@/lib/format";
import type { OrderStatus } from "@/lib/orders";

type Order = {
  id: string;
  status: OrderStatus;
  bags: number;
  eta_ready_at: string | null;
  customer: { full_name: string | null; phone: string | null; client_code: string | null } | null;
  addresses: { street: string; zones: { name: string } | null } | null;
  laundries: { name: string } | null;
};

export default async function EtichettaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: order } = await supabase
    .from("orders")
    .select("id, status, bags, eta_ready_at, customer:profiles!orders_customer_id_fkey(full_name, phone, client_code), addresses(street, zones(name)), laundries(name)")
    .eq("id", id)
    .maybeSingle<Order>();

  if (!order) notFound();

  // Il QR sulla borsa codifica il CODICE CLIENTE (fisso, riusabile ritiro+consegna):
  // è quello che scansiona il rider. La modalità la deduce la webapp dallo stato.
  const clientCode = order.customer?.client_code ?? null;
  const qr = await QRCode.toDataURL(clientCode ?? `WL-${order.id.slice(0, 4).toUpperCase()}`, { margin: 1, width: 260 });

  return (
    <div className="mx-auto max-w-md">
      <style>{`@media print { header, .no-print { display: none !important; } body { background: #fff !important; } main { padding: 0 !important; } .label-card { box-shadow: none !important; border: 1px solid #1b2d5e !important; } }`}</style>

      <div className="mb-4 flex items-center justify-between no-print">
        <a href={`/admin/ordini/${order.id}`} className="font-display text-sm font-bold text-muted hover:text-navy">← Torna all&apos;ordine</a>
        <PrintButton />
      </div>

      {/* Etichetta */}
      <div className="label-card rounded-[18px] border border-line bg-white p-6 shadow-[var(--shadow-sm)]">
        <div className="flex items-center justify-between">
          <Logo size={26} />
          <span className="font-mono text-sm font-bold text-navy">{clientCode ?? `#${order.id.slice(0, 8).toUpperCase()}`}</span>
        </div>

        <div className="my-5 flex items-center gap-5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qr} alt="QR codice cliente" className="h-32 w-32" />
          <div className="space-y-1">
            <div className="font-display text-xl font-black text-navy">{order.customer?.full_name ?? "Cliente"}</div>
            {order.customer?.phone && <div className="text-sm font-semibold text-muted">{order.customer.phone}</div>}
            <div className="text-sm font-medium text-muted">{order.addresses?.street}</div>
            <div className="text-sm font-medium text-muted">{order.addresses?.zones?.name ?? "—"}</div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 border-t border-line pt-4 text-center">
          <div>
            <div className="font-display text-2xl font-black text-navy">{order.bags}</div>
            <div className="text-[11px] font-semibold uppercase tracking-wide text-muted">Buste</div>
          </div>
          <div>
            <div className="font-display text-sm font-extrabold text-navy">{order.laundries?.name ?? "—"}</div>
            <div className="text-[11px] font-semibold uppercase tracking-wide text-muted">Lavanderia</div>
          </div>
          <div>
            <div className="font-display text-sm font-extrabold text-navy">{order.eta_ready_at ? fmtDateTime(order.eta_ready_at) : "—"}</div>
            <div className="text-[11px] font-semibold uppercase tracking-wide text-muted">Pronto</div>
          </div>
        </div>
      </div>
    </div>
  );
}
