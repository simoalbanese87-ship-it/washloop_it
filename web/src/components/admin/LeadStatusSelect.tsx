"use client";

import { setLeadContactStatus } from "@/lib/actions/leads";
import { CONTACT_STATUS, CONTACT_STATUS_LABEL, CONTACT_STATUS_TONE, type ContactStatus } from "@/lib/lead-status";

/** Stato del contatto, modificabile al volo. Stesso schema del select rider in
 *  OrdersBoard: un <form> con la server action e `requestSubmit()` al change —
 *  niente stato client, niente fetch, il revalidate rinfresca la pagina.
 *  `back` serve a tornare sulla pagina giusta col banner di conferma. */
export function LeadStatusSelect({
  leadId,
  value,
  back,
  className = "",
}: {
  leadId: string;
  value: ContactStatus;
  back: string;
  className?: string;
}) {
  return (
    <form action={setLeadContactStatus} className={className}>
      <input type="hidden" name="lead_id" value={leadId} />
      <input type="hidden" name="back" value={back} />
      <select
        name="contact_status"
        defaultValue={value}
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
        aria-label="Stato del contatto"
        className={`h-8 cursor-pointer rounded-full border-0 px-3 font-display text-[11px] font-bold outline-none ${CONTACT_STATUS_TONE[value]}`}
      >
        {CONTACT_STATUS.map((s) => (
          <option key={s} value={s}>
            {CONTACT_STATUS_LABEL[s]}
          </option>
        ))}
      </select>
    </form>
  );
}
