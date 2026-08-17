"use client";

import { useActionState, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { courierAdvance } from "@/lib/actions/orders";
import { riderSegnaTagConsegnati } from "@/lib/actions/tags";
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
  /** Codice del cliente: è quello stampato sul tag del sacco. */
  clientCode: string | null;
  /** Il cliente ha già ricevuto i suoi tag QR? */
  tagConsegnati: boolean;
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
          {/* Tag del sacco. Compare solo finché il cliente non li ha ricevuti:
              il primo passaggio è quello in cui il rider incolla i cartellini,
              e la spunta va fatta lì, non ricordata e riferita all'admin dopo. */}
          {!job.tagConsegnati && job.clientCode && (
            <TagConsegna orderId={job.id} clientCode={job.clientCode} />
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

/** "Ho lasciato i tag": un tocco solo, davanti al portone.
 *
 *  Due tag di default perché è la dotazione standard (uno sul sacco in giro, uno
 *  su quello a casa); se ne lascia un numero diverso lo corregge l'admin dal
 *  pannello — chiedere una quantità al rider mentre ha le mani occupate
 *  significherebbe che la spunta non la fa nessuno. */
function TagConsegna({ orderId, clientCode }: { orderId: string; clientCode: string }) {
  const [inCorso, setInCorso] = useState(false);
  const [fatto, setFatto] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);

  if (fatto) {
    return (
      <p className="rounded-[10px] bg-[#1F8A5B]/10 px-3 py-2 text-xs font-bold text-[#1F8A5B]">
        Tag {clientCode} segnati come consegnati ✓
      </p>
    );
  }

  return (
    <div className="rounded-[12px] border border-dashed border-navy/25 bg-ice px-3 py-2.5">
      <div className="font-display text-xs font-extrabold text-navy">Questo cliente non ha ancora i tag</div>
      <p className="mt-0.5 text-[11px] font-medium text-muted">
        Attacca i cartellini <span className="font-mono font-bold">{clientCode}</span> sui sacchi, poi conferma.
      </p>
      {errore && <p className="mt-1.5 text-[11px] font-semibold text-[#C0392B]">{errore}</p>}
      <button
        type="button"
        disabled={inCorso}
        onClick={async () => {
          setInCorso(true);
          setErrore(null);
          const res = await riderSegnaTagConsegnati(orderId, 2);
          setInCorso(false);
          if (res.ok) setFatto(true);
          else setErrore(res.error ?? "Non riuscito, riprova");
        }}
        className="mt-2 inline-flex items-center gap-1.5 rounded-full border-2 border-navy/25 px-3.5 py-1.5 font-display text-xs font-extrabold text-navy disabled:opacity-50"
      >
        {inCorso ? "Salvo…" : "Tag consegnati (2)"}
      </button>
    </div>
  );
}
