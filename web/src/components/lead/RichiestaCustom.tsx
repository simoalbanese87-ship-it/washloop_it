"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { richiestaCustom, type LeadFormState } from "@/lib/actions/leads";

/** «Su misura»: il modulo per chi non sta nei due abbonamenti.
 *
 *  Perché esiste
 *  -------------
 *  Fino al 17 ottobre 2026 chi aveva un'esigenza particolare — due ritiri al
 *  mese invece di quattro, un ufficio, volumi grossi — non aveva nessun posto
 *  dove dirlo: o si abbonava a qualcosa che non gli serviva, o scriveva una
 *  email e sperava. Intanto gli abbonamenti su misura sono già **metà** di
 *  quelli attivi: la cosa esisteva, mancava solo la porta.
 *
 *  Cosa chiede, e cosa no
 *  ----------------------
 *  Nome, telefono, CAP, due righe su cosa serve e quando richiamare. **L'email
 *  è facoltativa**: il canale qui è il telefono, e un campo obbligatorio in più
 *  su un modulo che chiede già un impegno è gente che se ne va a metà.
 *
 *  La fascia oraria non è un appuntamento preso — nessuno blocca un calendario
 *  dall'altra parte — ed è scritto in chiaro sotto al campo: promettere l'ora
 *  esatta e poi chiamare a un'altra è peggio che non promettere niente.
 */

const campo =
  "min-h-[52px] w-full rounded-[14px] border border-line bg-white px-4 text-base font-semibold text-navy outline-none transition-colors placeholder:text-navy/35 focus:border-blue";

const FASCE = [
  "Mattina (9–13)",
  "Pomeriggio (14–18)",
  "Sera (18–20)",
  "Quando capita",
];

function Invia() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="min-h-[52px] w-full rounded-full bg-gradient-to-br from-blue to-cyan px-7 font-display text-base font-extrabold text-white shadow-[0_16px_36px_-16px_rgba(43,127,212,0.7)] transition-opacity disabled:opacity-50 sm:w-auto"
    >
      {pending ? "Invio…" : "Richiedi una proposta →"}
    </button>
  );
}

export function RichiestaCustom() {
  const [stato, azione] = useActionState<LeadFormState, FormData>(richiestaCustom, { error: null });

  return (
    <div className="overflow-hidden rounded-[24px] border-2 border-dashed border-navy/25 bg-white">
      <div className="grid gap-8 p-7 md:grid-cols-[1fr_1.1fr] md:items-start md:p-9">
        <div>
          <div className="font-display text-xs font-extrabold uppercase tracking-[0.2em] text-blue">Su misura</div>
          <h3 className="mt-2 font-display text-2xl font-black tracking-[-0.02em] text-navy">
            Raccontaci cosa ti serve.
          </h3>
          <p className="mt-3 text-sm font-medium leading-relaxed text-muted">
            Due ritiri al mese invece di quattro, volumi grandi, un ufficio, una casa vacanze, un ritmo tutto
            tuo. Ti richiamiamo nella fascia che scegli e costruiamo l&apos;abbonamento insieme: se ti torna,
            lo attivi con un link.
          </p>
          <ul className="mt-5 space-y-2 text-sm font-medium text-navy/75">
            {[
              "Nessun impegno: è una telefonata",
              "Il prezzo te lo diciamo prima, scritto",
              "Vale anche fuori dalle zone che copriamo oggi",
            ].map((r) => (
              <li key={r} className="flex gap-2">
                <span className="text-blue">·</span>
                <span>{r}</span>
              </li>
            ))}
          </ul>
        </div>

        <form action={azione} className="space-y-3">
          {/* Esca per i bot: invisibile a chi legge, irresistibile per chi
              compila moduli in automatico. Stessa di tutti gli altri form. */}
          <input
            type="text"
            name="azienda"
            tabIndex={-1}
            autoComplete="off"
            aria-hidden
            className="pointer-events-none absolute left-[-9999px] h-0 w-0 opacity-0"
          />

          <div className="grid gap-3 sm:grid-cols-2">
            <input name="full_name" required minLength={2} placeholder="Nome e cognome" className={campo} autoComplete="name" />
            <input name="phone" required type="tel" placeholder="Telefono" className={campo} autoComplete="tel" />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <input name="cap" required inputMode="numeric" maxLength={5} placeholder="CAP" className={campo} autoComplete="postal-code" />
            <input name="email" type="email" placeholder="Email (facoltativa)" className={campo} autoComplete="email" />
          </div>

          <textarea
            name="esigenza"
            required
            minLength={10}
            rows={3}
            placeholder="Es. siamo in due, ci basta un ritiro ogni due settimane. Oppure: ufficio con 15 persone, tovaglie e camici."
            className="w-full rounded-[14px] border border-line bg-white px-4 py-3 text-base font-semibold text-navy outline-none transition-colors placeholder:text-navy/35 focus:border-blue"
          />

          <div>
            <label htmlFor="quando-richiamare" className="block text-xs font-bold text-muted">
              Quando ti richiamiamo?
            </label>
            <select id="quando-richiamare" name="quando" defaultValue={FASCE[0]} className={`${campo} mt-1`}>
              {FASCE.map((f) => (
                <option key={f} value={f}>{f}</option>
              ))}
            </select>
            <p className="mt-1.5 text-[11px] font-medium text-muted">
              È un&apos;indicazione per noi, non un appuntamento fissato: ti cerchiamo in quella fascia, nei
              giorni feriali.
            </p>
          </div>

          <label className="flex items-start gap-2.5 text-[13px] font-medium leading-snug text-muted">
            <input type="checkbox" name="privacy" required className="mt-0.5 h-4 w-4 flex-none accent-[#2b7fd4]" />
            <span>
              Ho letto la <a href="/privacy" className="font-bold text-blue hover:underline">privacy policy</a> e
              acconsento al trattamento dei miei dati per essere ricontattato su questa richiesta.
            </span>
          </label>

          {stato.error && (
            <p className="rounded-[12px] bg-[#C0392B]/8 px-3 py-2 text-sm font-semibold text-[#C0392B]">{stato.error}</p>
          )}

          <Invia />
        </form>
      </div>
    </div>
  );
}
