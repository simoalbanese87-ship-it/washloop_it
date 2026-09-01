import { fmtFull } from "@/lib/format";
import {
  SEGNALAZIONE_AL_CLIENTE,
  SEGNALAZIONE_LABEL,
  SEGNALAZIONE_TONO,
  type TipoSegnalazione,
} from "@/lib/segnalazioni";

export type Segnalazione = {
  id: string;
  kind: TipoSegnalazione;
  capo: string | null;
  testo: string;
  photo_url: string | null;
  created_at: string;
  published_at: string | null;
  resolved_at: string | null;
  resolution: string | null;
};

const COLORE: Record<"neutro" | "attenzione" | "grave", { bordo: string; testo: string; sfondo: string }> = {
  neutro: { bordo: "border-line", testo: "text-navy", sfondo: "bg-ice" },
  attenzione: { bordo: "border-[#C9881F]/35", testo: "text-[#C9881F]", sfondo: "bg-[#C9881F]/[0.07]" },
  grave: { bordo: "border-[#C0392B]/35", testo: "text-[#C0392B]", sfondo: "bg-[#C0392B]/[0.06]" },
};

/** Una segnalazione, resa uguale ovunque.
 *
 *  `perCliente` cambia una cosa sola ma importante: al cliente si dice prima
 *  cosa significa (di chi è la responsabilità, cosa succede adesso) e poi si
 *  riportano le parole della lavanderia fra virgolette. Dentro l'azienda si
 *  legge il referto e basta — chi lavora sa già interpretarlo. */
export function SegnalazioneRiga({
  s,
  fotoUrl,
  perCliente = false,
  children,
}: {
  s: Segnalazione;
  /** URL firmata della foto, già risolta lato server (il bucket è privato). */
  fotoUrl?: string | null;
  perCliente?: boolean;
  /** Azioni (pubblica, chiudi): solo il pannello ops le passa. */
  children?: React.ReactNode;
}) {
  const c = COLORE[SEGNALAZIONE_TONO[s.kind]];
  return (
    <div className={`rounded-[14px] border ${c.bordo} ${c.sfondo} p-3.5`}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <span className={`font-display text-sm font-extrabold ${c.testo}`}>{SEGNALAZIONE_LABEL[s.kind]}</span>
        <span className="font-display text-xs font-bold text-muted">{fmtFull(s.created_at)}</span>
      </div>

      {s.capo && <div className="mt-1 font-display text-sm font-extrabold text-navy">{s.capo}</div>}

      {perCliente ? (
        <>
          <p className="mt-1 text-sm font-medium text-navy/80">{SEGNALAZIONE_AL_CLIENTE[s.kind]}</p>
          <p className="mt-2 text-sm font-medium italic text-muted">«{s.testo}»</p>
        </>
      ) : (
        <p className="mt-1 text-sm font-medium text-navy/80">{s.testo}</p>
      )}

      {fotoUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={fotoUrl} alt="Foto della segnalazione" className="mt-3 max-h-64 w-auto rounded-[10px] border border-line" />
      )}

      {/* Lo stato lo vede solo chi lavora: al cliente «non ancora pubblicata»
          non vuol dire niente, e per definizione non è una riga che può vedere. */}
      {!perCliente && (
        <div className="mt-2 flex flex-wrap gap-2 text-xs font-bold">
          <span className={s.published_at ? "text-[#1F8A5B]" : "text-[#C9881F]"}>
            {s.published_at ? "Cliente avvisato" : "Cliente non ancora avvisato"}
          </span>
          {s.resolved_at && <span className="text-muted">· chiusa {fmtFull(s.resolved_at)}</span>}
        </div>
      )}

      {s.resolution && !perCliente && (
        <p className="mt-1 text-xs font-medium text-muted">Esito: {s.resolution}</p>
      )}

      {children}
    </div>
  );
}
