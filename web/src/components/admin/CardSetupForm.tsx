"use client";

import { useState } from "react";
import { createCardSetupLink } from "@/lib/actions/admin-customer";

/** Il link che registra la carta senza addebitare niente.
 *
 *  Per un cliente a consumo non c'è un primo lavoro da pagare: c'è una carta da
 *  avere in mano per quando ci saranno dei capi. Chiedere soldi per qualcosa
 *  che non abbiamo ancora fatto è il modo peggiore di cominciare. */
export function CardSetupForm({ customerId }: { customerId: string }) {
  const [loading, setLoading] = useState(false);
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function genera() {
    setLoading(true);
    setError(null);
    setUrl(null);
    setCopied(false);
    const res = await createCardSetupLink({ customer_id: customerId });
    setLoading(false);
    if ("error" in res) setError(res.error);
    else setUrl(res.url);
  }

  async function copia() {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* clipboard non disponibile: si seleziona a mano */ }
  }

  return (
    <div className="mt-4 rounded-[16px] border border-line bg-ice/60 p-4">
      <h3 className="font-display text-sm font-extrabold text-navy">Registra la carta, senza addebito</h3>
      <p className="mt-1 text-xs font-medium text-muted">
        Il cliente inserisce la carta su Stripe e <strong className="text-navy">non paga niente</strong>: è
        un&apos;autorizzazione a zero, quella che si usa prima di un servizio a consumo. Appena la registra,
        <strong className="text-navy"> il suo account si attiva da solo</strong> e può prenotare: non c&apos;è altro da
        premere. Da lì in poi i capi che lascia nel sacco si addebitano sulla carta.
      </p>
      <button
        type="button"
        onClick={genera}
        disabled={loading}
        className="mt-3 rounded-full bg-gradient-to-br from-blue to-cyan px-5 py-2 font-display text-sm font-extrabold text-white disabled:opacity-60"
      >
        {loading ? "Genero…" : "Genera link per la carta →"}
      </button>

      {error && <p className="mt-2 text-xs font-semibold text-[#C0392B]">{error}</p>}

      {url && (
        <div className="mt-3 rounded-[12px] border border-line bg-white p-3">
          <div className="text-xs font-bold text-muted">Link — invialo al cliente</div>
          <div className="mt-1 break-all rounded-[8px] bg-ice px-2 py-1.5 text-xs font-medium text-navy">{url}</div>
          <div className="mt-2 flex gap-2">
            <button type="button" onClick={copia} className="rounded-full border border-line px-4 py-1.5 font-display text-xs font-bold text-navy hover:bg-ice">
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
