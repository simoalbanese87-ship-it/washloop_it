"use client";

import { archiviaLead, convertLeadToCustomer, deleteLead } from "@/lib/actions/leads";

/** Azioni su una richiesta di disponibilità: diventa cliente, oppure sparisce.
 *  Gemello di DeleteUserButton: stessa conferma nativa, stessi colori. La
 *  conferma sulla conversione c'è perché crea un account vero e manda una mail
 *  con le credenziali — non è un'azione silenziosa. */
export function LeadActions({ leadId, name, back, archiviato = false }: { leadId: string; name: string; back: string; archiviato?: boolean }) {
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
        {/* Un bottone e non un link: su un lead questo è IL gesto — gli apre
            l'account, e senza account la riga non si apre, non ha «Accedi
            come» e non le si può creare un ritiro. */}
        <button type="submit" className="whitespace-nowrap rounded-full bg-gradient-to-br from-blue to-cyan px-3 py-1.5 font-display text-xs font-extrabold text-white">
          Crea cliente →
        </button>
      </form>

      {/* Archiviare viene prima di eliminare, ed è il gesto che si vuole quasi
          sempre: la riga resta, con il CAP, la provenienza e la nota. Eliminare
          serve per i doppioni veri, e per quelli c'è ancora il rosso. */}
      <form action={archiviaLead}>
        <input type="hidden" name="lead_id" value={leadId} />
        <input type="hidden" name="back" value={back} />
        {archiviato && <input type="hidden" name="riattiva" value="1" />}
        <button type="submit" className="font-display text-xs font-bold text-navy/55 hover:text-navy">
          {archiviato ? "Riattiva" : "Archivia"}
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
