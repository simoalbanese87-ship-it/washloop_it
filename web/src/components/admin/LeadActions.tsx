"use client";

import { convertLeadToCustomer, deleteLead } from "@/lib/actions/leads";

/** Azioni su una richiesta di disponibilità: diventa cliente, oppure sparisce.
 *  Gemello di DeleteUserButton: stessa conferma nativa, stessi colori. La
 *  conferma sulla conversione c'è perché crea un account vero e manda una mail
 *  con le credenziali — non è un'azione silenziosa. */
export function LeadActions({ leadId, name, back }: { leadId: string; name: string; back: string }) {
  return (
    <div className="flex flex-none items-center gap-3">
      <form
        action={convertLeadToCustomer}
        onSubmit={(e) => {
          if (!confirm(`Creare un cliente da "${name}"?\n\nViene creato un account con password temporanea e inviata la mail di benvenuto. L'abbonamento resta da attivare.`)) {
            e.preventDefault();
          }
        }}
      >
        <input type="hidden" name="lead_id" value={leadId} />
        <input type="hidden" name="back" value={back} />
        <button type="submit" className="font-display text-xs font-bold text-blue hover:underline">
          Crea cliente →
        </button>
      </form>

      <form
        action={deleteLead}
        onSubmit={(e) => {
          if (!confirm(`Eliminare la richiesta di "${name}"? L'azione è irreversibile.`)) e.preventDefault();
        }}
      >
        <input type="hidden" name="lead_id" value={leadId} />
        <input type="hidden" name="back" value={back} />
        <button type="submit" className="font-display text-xs font-bold text-[#C0392B] hover:underline">
          Elimina
        </button>
      </form>
    </div>
  );
}
