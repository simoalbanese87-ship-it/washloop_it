"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/Button";
import { riderCaricaConsegna } from "@/lib/actions/orders";

/** Una consegna di oggi ancora dentro la lavanderia.
 *
 *  Scheda apposta e non `CourierJobCard`: qui non si naviga da nessuna parte —
 *  la fermata è la lavanderia, non casa del cliente — non si allega una foto
 *  prova e non si scansiona niente. C'è un gesto solo: ho caricato i sacchi.
 *
 *  Il bottone non è una scorciatoia: l'ordine fa gli stessi passaggi che farebbe
 *  premendo «pronto» di là, incasso dei capi extra compreso. */
type Stato = { error: string } | null;

async function carica(_prev: Stato, formData: FormData): Promise<Stato> {
  const res = await riderCaricaConsegna(formData);
  return res ?? null;
}

export type DaCaricare = {
  id: string;
  cliente: string;
  indirizzo: string;
  zona: string;
  quando: string | null;
  bags: number;
  statoTesto: string;
};

export function ConsegnaDaCaricare({ job }: { job: DaCaricare }) {
  const [stato, formAction] = useActionState<Stato, FormData>(carica, null);

  return (
    <div className="rounded-[18px] border border-[#C9881F]/35 bg-[#C9881F]/8 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="font-display text-base font-extrabold text-navy">{job.cliente}</div>
          <div className="text-sm font-medium text-muted">
            {job.indirizzo} · {job.zona}
          </div>
          {job.quando && <div className="mt-0.5 text-sm font-bold text-blue">{job.quando}</div>}
        </div>
        <span className="rounded-full bg-[#C9881F]/15 px-2.5 py-0.5 font-display text-[11px] font-extrabold uppercase tracking-wide text-[#C9881F]">
          {job.statoTesto}
        </span>
      </div>

      <div className="mt-2 text-sm font-semibold text-navy/70">
        {job.bags} {job.bags === 1 ? "borsa" : "borse"}
      </div>

      {stato?.error && (
        <p role="alert" className="mt-3 rounded-[10px] bg-[#C0392B]/10 px-3 py-2 text-xs font-semibold text-[#C0392B]">
          {stato.error}
        </p>
      )}

      <form action={formAction} className="mt-3">
        <input type="hidden" name="order_id" value={job.id} />
        <Button type="submit" size="md">
          Ho caricato i sacchi →
        </Button>
      </form>
    </div>
  );
}
