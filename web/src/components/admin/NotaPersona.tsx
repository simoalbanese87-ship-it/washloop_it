import { salvaNotaPersona } from "@/lib/actions/leads";
import { anteprimaNota, NOTA_MAX } from "@/lib/nota-persona";
import { BottoneInvio } from "@/components/ui/BottoneInvio";

/** La nota su una persona, dentro la tabella di /admin/persone.
 *
 *  Chiusa mostra l'inizio di quello che c'è scritto — o un invito, se non c'è
 *  niente. Aperta è una textarea con il bottone.
 *
 *  Perché un `<details>` e non una textarea sempre aperta: nove textarea in
 *  fila spingono la riga dell'anagrafica fuori dallo schermo, ed è quella che
 *  si scorre quando si cerca chi richiamare.
 *
 *  Perché un bottone e non il salvataggio al blur: `requestSubmit()` al change
 *  funziona su un `<select>`, dove il valore è chiuso e un clic è una scelta
 *  finita. Su un testo lungo salverebbe mezze frasi ogni volta che si clicca
 *  altrove. Il gesto qui deve essere esplicito.
 *
 *  Nessun `"use client"`: è markup più un `<form>` con la server action, e
 *  `BottoneInvio` — che è già client — copre lo stato di invio. */
export function NotaPersona({
  profileId,
  leadId,
  nota,
  back,
}: {
  profileId?: string | null;
  leadId?: string | null;
  nota: string | null;
  back: string;
}) {
  const anteprima = anteprimaNota(nota, 70);
  return (
    <details className="group">
      <summary className="cursor-pointer list-none">
        {anteprima ? (
          <span className="block max-w-[220px] text-xs font-medium leading-snug text-navy/80 group-open:hidden" title={nota ?? undefined}>
            {anteprima}
          </span>
        ) : (
          <span className="font-display text-xs font-bold text-blue group-open:hidden">+ nota</span>
        )}
        <span className="hidden font-display text-xs font-bold text-muted group-open:inline">Nota</span>
      </summary>
      <form action={salvaNotaPersona} className="mt-1.5 w-[260px] space-y-1.5">
        {profileId ? (
          <input type="hidden" name="profile_id" value={profileId} />
        ) : (
          <input type="hidden" name="lead_id" value={leadId ?? ""} />
        )}
        <input type="hidden" name="back" value={back} />
        <textarea
          name="nota"
          rows={4}
          maxLength={NOTA_MAX}
          defaultValue={nota ?? ""}
          placeholder="Cosa ci siamo detti al telefono…"
          className="w-full rounded-[10px] border border-line bg-white px-2.5 py-2 text-xs font-medium leading-relaxed text-navy outline-none focus:border-blue"
        />
        <BottoneInvio attesa="Salvo…" className="font-display text-xs font-bold text-blue hover:underline">
          Salva la nota
        </BottoneInvio>
      </form>
    </details>
  );
}
