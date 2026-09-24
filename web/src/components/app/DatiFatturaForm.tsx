"use client";

import { useState } from "react";
import { salvaDatiFattura } from "@/lib/actions/fatturazione-cliente";

export type DatiFattura = {
  vuole: boolean;
  nome: string | null;
  indirizzo: string | null;
  cap: string | null;
  citta: string | null;
  codiceFiscale: string | null;
  partitaIva: string | null;
  sdi: string | null;
  pec: string | null;
};

const input = "h-11 w-full rounded-[14px] border border-line bg-ice px-3.5 text-sm font-medium text-navy outline-none focus:border-blue";

/** "Ti serve la fattura?" — modulo mostrato solo a chi risponde di sì.
 *
 *  Di norma mandiamo la ricevuta, che copre la maggior parte dei clienti e non
 *  richiede alcun dato in più. I campi fiscali compaiono soltanto dopo la
 *  spunta: chiederli a tutti sarebbe attrito inutile e dati raccolti senza
 *  motivo. */
export function DatiFatturaForm({ iniziale }: { iniziale: DatiFattura }) {
  const [vuole, setVuole] = useState(iniziale.vuole);
  const [azienda, setAzienda] = useState(!!iniziale.partitaIva);
  const [salvo, setSalvo] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; testo: string } | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSalvo(true);
    setMsg(null);
    const res = await salvaDatiFattura(new FormData(e.currentTarget));
    setSalvo(false);
    setMsg(
      res.ok
        ? { ok: true, testo: vuole ? "Salvato: riceverai la fattura a ogni rinnovo." : "Salvato: continuerai a ricevere la ricevuta." }
        : { ok: false, testo: res.error ?? "Non riuscito, riprova." },
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <label className="flex cursor-pointer items-start gap-3">
        <input
          type="checkbox"
          name="vuole"
          checked={vuole}
          onChange={(e) => setVuole(e.target.checked)}
          className="mt-0.5 h-5 w-5 flex-none accent-[#2b7fd4]"
        />
        <span className="text-sm font-medium text-navy">
          <strong className="font-extrabold">Ho bisogno della fattura.</strong>{" "}
          <span className="text-muted">
            Senza spunta ricevi comunque la ricevuta di pagamento via email, che per un privato basta.
          </span>
        </span>
      </label>

      {vuole && (
        <div className="space-y-3 rounded-[14px] border border-line bg-ice/60 p-3">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setAzienda(false)}
              className={`flex-1 rounded-full px-3 py-2 font-display text-xs font-bold ${!azienda ? "bg-navy text-white" : "border border-line bg-white text-navy"}`}
            >
              Privato
            </button>
            <button
              type="button"
              onClick={() => setAzienda(true)}
              className={`flex-1 rounded-full px-3 py-2 font-display text-xs font-bold ${azienda ? "bg-navy text-white" : "border border-line bg-white text-navy"}`}
            >
              Azienda / P.IVA
            </button>
          </div>

          <input name="billing_name" defaultValue={iniziale.nome ?? ""} placeholder={azienda ? "Ragione sociale" : "Nome e cognome"} className={input} />

          {azienda ? (
            <>
              <input name="vat" defaultValue={iniziale.partitaIva ?? ""} placeholder="Partita IVA (11 cifre)" inputMode="numeric" className={input} />
              <div className="grid gap-3 sm:grid-cols-2">
                <input name="sdi" defaultValue={iniziale.sdi ?? ""} placeholder="Codice destinatario SDI" className={input} />
                <input name="pec" type="email" defaultValue={iniziale.pec ?? ""} placeholder="PEC" className={input} />
              </div>
              <p className="text-xs font-medium text-muted">
                Indica il codice SDI oppure la PEC: è dove l&apos;Agenzia delle Entrate consegna la fattura.
              </p>
            </>
          ) : (
            <input name="tax_code" defaultValue={iniziale.codiceFiscale ?? ""} placeholder="Codice fiscale" className={`${input} uppercase`} />
          )}

          <input name="billing_address" defaultValue={iniziale.indirizzo ?? ""} placeholder="Indirizzo di fatturazione (se diverso dal ritiro)" className={input} />
          <div className="grid gap-3 sm:grid-cols-2">
            <input name="billing_cap" defaultValue={iniziale.cap ?? ""} placeholder="CAP" inputMode="numeric" className={input} />
            <input name="billing_city" defaultValue={iniziale.citta ?? ""} placeholder="Città" className={input} />
          </div>
        </div>
      )}

      {msg && (
        <p className={`text-sm font-semibold ${msg.ok ? "text-[#1F8A5B]" : "text-[#C0392B]"}`}>{msg.testo}</p>
      )}

      <button
        type="submit"
        disabled={salvo}
        className="rounded-full border-2 border-navy/25 px-5 py-2.5 font-display text-sm font-extrabold text-navy disabled:opacity-50"
      >
        {salvo ? "Salvo…" : "Salva"}
      </button>

      <p className="text-xs font-medium text-muted">
        Vale dai prossimi rinnovi. Per una fattura su un mese già pagato scrivici: ci pensiamo noi.
      </p>
    </form>
  );
}
