import type { ReactNode } from "react";

/** Un blocco che si apre, con il titolo e un numero già in vista.
 *
 *  `<details>` nativo e non un accordion in JavaScript: funziona da tastiera,
 *  si stampa aperto, e non costa niente da scaricare. Il numero nel titolo
 *  serve a non doverlo aprire quasi mai.
 *
 *  Era scritto dentro la scheda cliente e usato solo lì; da quando serve anche
 *  al conto settimanale vive qui, perché due copie che divergono su un
 *  dettaglio di stile sono due componenti diversi che sembrano uguali. */
export function Fisarmonica({
  titolo,
  conteggio,
  nota,
  apertaSubito = false,
  children,
}: {
  titolo: ReactNode;
  conteggio?: number | string;
  nota?: ReactNode;
  apertaSubito?: boolean;
  children: ReactNode;
}) {
  return (
    <details open={apertaSubito} className="group mt-3 rounded-[18px] border border-line bg-white">
      <summary className="flex cursor-pointer list-none items-center gap-3 px-5 py-3.5">
        <span className="font-display text-base font-extrabold text-navy">{titolo}</span>
        {conteggio !== undefined && (
          <span className="rounded-full bg-ice px-2.5 py-0.5 font-display text-xs font-extrabold text-navy/70">{conteggio}</span>
        )}
        {nota && <span className="truncate text-xs font-medium text-muted">{nota}</span>}
        <span className="ml-auto font-display text-xs font-bold text-blue">
          <span className="group-open:hidden">Apri</span>
          <span className="hidden group-open:inline">Chiudi</span>
        </span>
      </summary>
      <div className="border-t border-line px-5 py-4">{children}</div>
    </details>
  );
}
