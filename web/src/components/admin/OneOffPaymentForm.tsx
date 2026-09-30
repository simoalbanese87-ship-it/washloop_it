"use client";

import { useState } from "react";
import { createOneOffPaymentLink } from "@/lib/actions/admin-customer";

const input = "h-10 w-full rounded-[12px] border border-line bg-ice px-3 text-sm font-medium text-navy outline-none focus:border-blue";

/** Form admin: un link che incassa **una volta sola**, senza creare abbonamenti.
 *
 *  Sta accanto a quello dell'abbonamento personalizzato perché la domanda che
 *  si fa chi è qui è una sola — «gli mando un link per farmi pagare» — e la
 *  differenza fra i due casi va vista, non ricordata: uno si rinnova ogni mese,
 *  l'altro no. */
export function OneOffPaymentForm({ customerId }: { customerId: string }) {
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setUrl(null);
    setCopied(false);
    const res = await createOneOffPaymentLink({ customer_id: customerId, description, amount_eur: amount });
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
      <h3 className="font-display text-sm font-extrabold text-navy">Pagamento una tantum</h3>
      <p className="mt-1 text-xs font-medium text-muted">
        Si incassa <strong className="text-navy">una volta sola</strong>: nessun abbonamento, nessun rinnovo. Per chi
        vuole provare una settimana pagando. Se poi resta, l&apos;abbonamento glielo attivi tu qui sopra — la carta
        resta salvata, quindi non deve ridigitarla.
      </p>
      <form onSubmit={submit} className="mt-3 grid gap-2">
        <label className="text-xs font-bold text-muted">Cosa sta pagando
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="es. Prova 1 settimana · 1 sacco"
            className={input}
          />
        </label>
        <label className="text-xs font-bold text-muted">Importo €
          <input value={amount} onChange={(e) => setAmount(e.target.value)} type="number" step="0.01" min="0" required placeholder="es. 40,00" className={input} />
        </label>
        <button
          type="submit"
          disabled={loading}
          className="mt-1 rounded-full border-2 border-navy/25 px-5 py-2 font-display text-sm font-extrabold text-navy hover:bg-navy/5 disabled:opacity-60"
        >
          {loading ? "Genero…" : "Genera link di pagamento →"}
        </button>
      </form>

      {error && <p className="mt-2 text-xs font-semibold text-[#C0392B]">{error}</p>}

      {url && (
        <div className="mt-3 rounded-[12px] border border-line bg-white p-3">
          <div className="text-xs font-bold text-muted">Link una tantum — invialo al cliente</div>
          <div className="mt-1 break-all rounded-[8px] bg-ice px-2 py-1.5 text-xs font-medium text-navy">{url}</div>
          <div className="mt-2 flex gap-2">
            <button type="button" onClick={copy} className="rounded-full border border-line px-4 py-1.5 font-display text-xs font-bold text-navy hover:bg-ice">
              {copied ? "Copiato ✓" : "Copia link"}
            </button>
            <a href={url} target="_blank" rel="noopener noreferrer" className="rounded-full border border-line px-4 py-1.5 font-display text-xs font-bold text-blue hover:bg-ice">
              Apri anteprima ↗
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
