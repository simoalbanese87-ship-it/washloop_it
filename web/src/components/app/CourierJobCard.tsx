"use client";

import { useActionState, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { courierAdvance } from "@/lib/actions/orders";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/app/StatusBadge";
import { RiderScanner } from "@/components/app/RiderScanner";
import { ACCESS_MODE_LABEL, type OrderStatus, type AccessMode } from "@/lib/orders";

export type Job = {
  id: string;
  status: OrderStatus;
  customer: string;
  address: string;
  zone: string;
  phone: string | null;
  bags: number;
  when: string | null;
  accessMode: AccessMode;
  accessNote: string | null;
};

type Action = { label: string; to: OrderStatus; variant?: "primary" | "ghost-navy" };

function nextActions(status: OrderStatus): Action[] {
  switch (status) {
    case "pickup_scheduled":
      return [{ label: "Segna ritirato", to: "picked_up" }];
    case "delivery_scheduled":
      return [{ label: "Parti per la consegna", to: "out_for_delivery" }];
    case "out_for_delivery":
      // "Cliente assente" è la via d'uscita che prima non esisteva: senza,
      // l'ordine restava in consegna per sempre e nessuno se ne accorgeva.
      return [
        { label: "Segna consegnato", to: "delivered" },
        { label: "Cliente assente", to: "delivery_failed", variant: "ghost-navy" },
      ];
    case "delivery_failed":
      return [{ label: "Riprova la consegna", to: "out_for_delivery" }];
    default:
      return [];
  }
}

/** L'azione ritorna un messaggio invece di lanciare: dentro una form action un
 *  throw diventa la schermata di errore di Next, e il rider perde la foto. */
type AdvanceState = { error: string } | null;
async function advance(_prev: AdvanceState, formData: FormData): Promise<AdvanceState> {
  const res = await courierAdvance(formData);
  return res ?? null;
}

export function CourierJobCard({ job }: { job: Job }) {
  const [proofUrl, setProofUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [state, formAction] = useActionState<AdvanceState, FormData>(advance, null);
  const actions = nextActions(job.status);

  async function onPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const supabase = createClient();
    const path = `${job.id}/${Date.now()}-${file.name}`;
    const { error } = await supabase.storage.from("proofs").upload(path, file, { upsert: true });
    // Il bucket ora è privato: salviamo il path, non un URL pubblico. Chi ha
    // diritto di vedere la foto ottiene un link firmato a scadenza.
    if (error) setUploadError("Foto non caricata. Riprova o procedi senza.");
    else { setUploadError(""); setProofUrl(path); }
    setUploading(false);
  }

  return (
    <div className="rounded-[20px] border border-line bg-white p-5 shadow-[var(--shadow-sm)]">
      <div className="flex items-start justify-between">
        <div>
          <div className="font-display text-base font-extrabold text-navy">{job.customer}</div>
          <div className="mt-0.5 text-sm font-medium text-muted">
            {job.address} · {job.zone}
          </div>
          {job.when && <div className="mt-0.5 text-xs font-semibold text-blue">{job.when}</div>}
        </div>
        <StatusBadge status={job.status} />
      </div>

      <div className="mt-2 inline-flex rounded-full bg-ice px-2.5 py-1 font-display text-xs font-extrabold text-navy">
        🛎️ {ACCESS_MODE_LABEL[job.accessMode]}{job.accessNote ? ` · ${job.accessNote}` : ""}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3 text-sm font-medium text-muted">
        <span>{job.bags} {job.bags === 1 ? "busta" : "buste"}</span>
        {job.phone && (
          <a href={`tel:${job.phone}`} className="font-bold text-blue hover:underline">
            📞 {job.phone}
          </a>
        )}
        <a
          href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${job.address}, ${job.zone}, Milano`)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="font-bold text-blue hover:underline"
        >
          🧭 Naviga
        </a>
      </div>

      {actions.length > 0 && (
        <div className="mt-4 space-y-3 border-t border-line pt-4">
          <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-navy/70">
            <input type="file" accept="image/*" capture="environment" onChange={onPhoto} className="hidden" />
            <span className="rounded-[12px] border border-line bg-ice px-3 py-2">
              {uploading ? "Carico…" : proofUrl ? "✓ Foto allegata" : "📷 Allega foto prova"}
            </span>
          </label>
          {uploadError && (
            <p className="rounded-[10px] bg-[#C9881F]/12 px-3 py-2 text-xs font-semibold text-[#C9881F]">{uploadError}</p>
          )}
          {state?.error && (
            <p role="alert" className="rounded-[10px] bg-[#C0392B]/10 px-3 py-2 text-xs font-semibold text-[#C0392B]">
              {state.error}
            </p>
          )}
          {/* Scanner legato a QUESTA tappa: il QR porta il codice cliente, non
              quello dell'ordine, quindi se il cliente ha più ordini aperti solo
              partendo da qui si sa di quale si tratta. */}
          {(job.status === "pickup_scheduled" || job.status === "delivery_scheduled" || job.status === "out_for_delivery") && (
            <RiderScanner orderId={job.id} label="Scansiona le borse" compact />
          )}

          <div className="flex flex-wrap gap-2">
            {actions.map((a) => (
              <form key={a.to} action={formAction}>
                <input type="hidden" name="order_id" value={job.id} />
                <input type="hidden" name="status" value={a.to} />
                <input type="hidden" name="proof_url" value={proofUrl} />
                <Button type="submit" size="md" variant={a.variant ?? "primary"}>
                  {a.label} →
                </Button>
              </form>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
