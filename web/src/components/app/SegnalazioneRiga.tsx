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
  pronto_stimato: string | null;
  /** Gli id delle due fasce, come arrivano dal database. */
  riconsegna_da: string | null;
  riconsegna_a: string | null;
  /** Le stesse due fasce già scritte in italiano. Le risolve la pagina con
   *  `etichetteFasce`: la riga da sola non può leggere la tabella degli slot. */
  riconsegnaDa?: string | null;
  riconsegnaA?: string | null;
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

      {/* Lo spostamento della riconsegna. Non è un dettaglio in coda: quando
          c'è, è la parte del messaggio che cambia la giornata a qualcuno. */}
      {s.riconsegnaA && (
        <p className="mt-2 rounded-[10px] bg-white/70 px-3 py-2 text-sm font-semibold text-navy">
          {perCliente ? "Per questo il tuo bucato arriva " : "Riconsegna spostata a "}
          <strong>{s.riconsegnaA}</strong>
          {s.riconsegnaDa ? `, invece di ${s.riconsegnaDa}.` : "."}
        </p>
      )}
      {!s.riconsegnaA && s.pronto_stimato && !perCliente && (
        <p className="mt-2 text-xs font-bold text-muted">
          La lavanderia ha chiesto più tempo (pronto entro {fmtFull(s.pronto_stimato)}), la riconsegna prevista reggeva.
        </p>
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
