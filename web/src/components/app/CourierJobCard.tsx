"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { courierAdvance } from "@/lib/actions/orders";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/app/StatusBadge";
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

type Action = { label: string; to: OrderStatus };

function nextActions(status: OrderStatus): Action[] {
  switch (status) {
    case "pickup_scheduled":
      return [{ label: "Segna ritirato", to: "picked_up" }];
    case "delivery_scheduled":
      return [{ label: "Parti per la consegna", to: "out_for_delivery" }];
    case "out_for_delivery":
      return [{ label: "Segna consegnato", to: "delivered" }];
    default:
      return [];
  }
}

export function CourierJobCard({ job }: { job: Job }) {
  const [proofUrl, setProofUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const actions = nextActions(job.status);

  async function onPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const supabase = createClient();
    const path = `${job.id}/${Date.now()}-${file.name}`;
    const { error } = await supabase.storage.from("proofs").upload(path, file, { upsert: true });
    if (!error) {
      const { data } = supabase.storage.from("proofs").getPublicUrl(path);
      setProofUrl(data.publicUrl);
    }
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
          <div className="flex flex-wrap gap-2">
            {actions.map((a) => (
              <form key={a.to} action={courierAdvance}>
                <input type="hidden" name="order_id" value={job.id} />
                <input type="hidden" name="status" value={a.to} />
                <input type="hidden" name="proof_url" value={proofUrl} />
                <Button type="submit" size="md">
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
