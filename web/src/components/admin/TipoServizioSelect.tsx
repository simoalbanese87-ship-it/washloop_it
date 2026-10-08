"use client";

import { impostaTipoServizio } from "@/lib/actions/leads";
import {
  TIPI_SERVIZIO,
  TIPO_SERVIZIO_LABEL,
  TIPO_SERVIZIO_TONO,
  TIPO_SERVIZIO_VUOTO,
  type TipoServizio,
} from "@/lib/tipo-servizio";

/** Tipo di servizio, modificabile al volo. Stesso schema di `LeadStatusSelect`:
 *  un <form> con la server action e `requestSubmit()` al cambio — niente stato
 *  client, niente fetch, ci pensa il revalidate.
 *
 *  Il valore vuoto è una scelta legittima e sta in cima: finché nessuno ha
 *  parlato con quel cliente, «da compilare» è l'unica cosa vera che si può
 *  scrivere. */
export function TipoServizioSelect({
  profileId,
  value,
  back,
  className = "",
}: {
  profileId: string;
  value: TipoServizio | null;
  back: string;
  className?: string;
}) {
  const tono = value ? TIPO_SERVIZIO_TONO[value] : "bg-navy/5 text-navy/55";
  return (
    <form action={impostaTipoServizio} className={className}>
      <input type="hidden" name="profile_id" value={profileId} />
      <input type="hidden" name="back" value={back} />
      <select
        name="tipo_servizio"
        defaultValue={value ?? ""}
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
        aria-label="Tipo di servizio"
        className={`h-8 cursor-pointer rounded-full border-0 px-3 font-display text-[11px] font-bold outline-none ${tono}`}
      >
        <option value="">{TIPO_SERVIZIO_VUOTO}</option>
        {TIPI_SERVIZIO.map((t) => (
          <option key={t} value={t}>
            {TIPO_SERVIZIO_LABEL[t]}
          </option>
        ))}
      </select>
    </form>
  );
}
