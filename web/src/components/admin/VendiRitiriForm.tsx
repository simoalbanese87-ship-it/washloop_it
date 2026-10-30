"use client";

import { useState } from "react";
import { createOneOffPaymentLink } from "@/lib/actions/admin-customer";

const input = "h-10 w-full rounded-[12px] border border-line bg-ice px-3 text-sm font-medium text-navy outline-none focus:border-blue";

const eur = (c: number) => (c / 100).toLocaleString("it-IT", { style: "currency", currency: "EUR" });

/** Form admin: vende **ritiri**, non tempo.
 *
 *  È la risposta a «1 settimana = 1 sacco, e poi si chiude». Un abbonamento di
 *  una settimana non si chiude: dentro i sette giorni il cliente prenota quante
 *  volte vuole, perché il cancello guardava solo se l'abbonamento era vivo. E
 *  un gettone che non scade dentro un abbonamento a termine non esiste: al
 *  settimo giorno Stripe chiude tutto e il ritiro pagato resta lì.
 *
 *  Quindi qui non nasce nessun abbonamento. Il cliente paga una volta, si
 *  ritrova N ritiri che non scadono, e ne consuma uno ogni volta che prenota.
 *  Niente rinnovo da fermare, niente disdetta da ricordarsi. */
export function VendiRitiriForm({
  customerId,
  /** Il prezzo a listino del servizio di questo cliente, se lo conosciamo:
   *  parte da lì invece che da vuoto, ma resta modificabile — il prezzo si
   *  concorda al telefono, e quello concordato vince. */
  prezzoListinoCents,
  servizioNome,
}: {
  customerId: string;
  prezzoListinoCents?: number | null;
  servizioNome?: string | null;
}) {
  const [quanti, setQuanti] = useState("1");
  const [prezzo, setPrezzo] = useState(prezzoListinoCents != null ? (prezzoListinoCents / 100).toFixed(2) : "");
  const [loading, setLoading] = useState(false);
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const n = Math.trunc(Number(quanti)) || 0;
  const unitario = Math.round(Number(prezzo) * 100);
  const totaleCents = n > 0 && Number.isFinite(unitario) && unitario > 0 ? n * unitario : 0;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setUrl(null);
    setCopied(false);
    const res = await createOneOffPaymentLink({
      customer_id: customerId,
      // La descrizione è la riga che il cliente legge in grande sul checkout:
      // deve dire quanti ritiri sta comprando, perché è quello che compra.
      description: `WashLoop · ${n === 1 ? "1 ritiro" : `${n} ritiri`}${servizioNome ? ` · ${servizioNome}` : ""}`,
      amount_eur: (totaleCents / 100).toFixed(2),
      gettoni: n,
    });
    setLoading(false);
    if ("error" in res) setError(res.error);
    else setUrl(res.url);
  }

  async function copy() {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* clipboard non disponibile: si seleziona a mano */ }
  }

  return (
    <div className="mt-4 rounded-[16px] border border-line bg-ice/60 p-4">
      <h3 className="font-display text-sm font-extrabold text-navy">Vendi ritiri</h3>
      <p className="mt-1 text-xs font-medium text-muted">
        Paga una volta e si ritrova dei <strong className="text-navy">ritiri in cassa</strong>: uno si consuma ogni
        volta che prenota, e quelli che avanzano <strong className="text-navy">non scadono</strong>. Nessun
        abbonamento, nessun rinnovo da fermare. Quando li finisce non prenota più, e nella sua area trova come
        comprarne altri o passare all&apos;abbonamento.
      </p>
      <form onSubmit={submit} className="mt-3 grid gap-2">
        <label className="text-xs font-bold text-muted">Quanti ritiri
          <input value={quanti} onChange={(e) => setQuanti(e.target.value)} type="number" step="1" min="1" max="24" required className={input} />
        </label>
        <label className="text-xs font-bold text-muted">Prezzo per ritiro €
          <input value={prezzo} onChange={(e) => setPrezzo(e.target.value)} type="number" step="0.01" min="0" required placeholder="es. 30,50" className={input} />
        </label>
        {prezzoListinoCents != null && (
          <p className="text-[11px] font-semibold text-muted">
            A listino{servizioNome ? ` ${servizioNome.toLowerCase()}` : ""} è {eur(prezzoListinoCents)} a ritiro.
          </p>
        )}
        {totaleCents > 0 && (
          <p className="rounded-[10px] bg-blue/8 px-2.5 py-1.5 text-[11px] font-semibold text-blue">
            Paga <strong>{eur(totaleCents)}</strong> una volta sola e riceve {n === 1 ? "1 ritiro" : `${n} ritiri`}.
          </p>
        )}
        <button
          type="submit"
          disabled={loading || totaleCents <= 0}
          className="mt-1 rounded-full bg-blue px-5 py-2 font-display text-sm font-extrabold text-white hover:brightness-110 disabled:opacity-60"
        >
          {loading ? "Genero…" : "Genera link →"}
        </button>
      </form>

      {error && <p className="mt-2 text-xs font-semibold text-[#C0392B]">{error}</p>}

      {url && (
        <div className="mt-3 rounded-[12px] border border-line bg-white p-3">
          <div className="text-xs font-bold text-muted">Link — invialo al cliente</div>
          <div className="mt-1 break-all rounded-[8px] bg-ice px-2 py-1.5 text-xs font-medium text-navy">{url}</div>
          <div className="mt-2 flex gap-2">
            <button type="button" onClick={copy} className="rounded-full border border-line px-4 py-1.5 font-display text-xs font-bold text-navy hover:bg-ice">
              {copied ? "Copiato ✓" : "Copia link"}
            </button>
            <a href={url} target="_blank" rel="noopener noreferrer" className="rounded-full border border-line px-4 py-1.5 font-display text-xs font-bold text-blue hover:bg-ice">
              Apri anteprima ↗
            </a>
          </div>
          <p className="mt-2 text-[11px] font-medium text-muted">
            I ritiri si accreditano quando paga, non adesso.
          </p>
        </div>
      )}
    </div>
  );
}
