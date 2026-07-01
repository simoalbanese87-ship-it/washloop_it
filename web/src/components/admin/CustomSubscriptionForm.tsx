"use client";

import { useState } from "react";
import { createCustomSubscriptionLink } from "@/lib/actions/admin-customer";

const input = "h-10 w-full rounded-[12px] border border-line bg-ice px-3 text-sm font-medium text-navy outline-none focus:border-blue";

/** Form admin: crea un abbonamento personalizzato (prezzo custom, mensile) e
 *  mostra il link Stripe Checkout da inviare al cliente. */
export function CustomSubscriptionForm({ customerId }: { customerId: string }) {
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
    const res = await createCustomSubscriptionLink({ customer_id: customerId, description, amount_eur: amount });
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
    } catch { /* clipboard non disponibile: l'utente può selezionare a mano */ }
  }

  return (
    <div className="mt-4 rounded-[16px] border border-line bg-ice/60 p-4">
      <h3 className="font-display text-sm font-extrabold text-navy">Crea abbonamento personalizzato</h3>
      <p className="mt-1 text-xs font-medium text-muted">
        Importo mensile a piacere. Genera un link di pagamento da inviare al cliente: paga, salva la carta e si rinnova da solo ogni mese.
      </p>
      <form onSubmit={submit} className="mt-3 grid gap-2 sm:grid-cols-[2fr_1fr_auto] sm:items-end">
        <label className="text-xs font-bold text-muted">Descrizione (facoltativa)
          <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="es. Abbonamento su misura" className={input} />
        </label>
        <label className="text-xs font-bold text-muted">Importo €/mese
          <input value={amount} onChange={(e) => setAmount(e.target.value)} type="number" step="0.01" min="0" required placeholder="es. 45,00" className={input} />
        </label>
        <button
          type="submit"
          disabled={loading}
          className="rounded-full bg-gradient-to-br from-blue to-cyan px-5 py-2 font-display text-sm font-extrabold text-white disabled:opacity-60"
        >
          {loading ? "Genero…" : "Genera link →"}
        </button>
      </form>

      {error && <p className="mt-2 text-xs font-semibold text-[#C0392B]">{error}</p>}

      {url && (
        <div className="mt-3 rounded-[12px] border border-line bg-white p-3">
          <div className="text-xs font-bold text-muted">Link di pagamento — invialo al cliente</div>
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
