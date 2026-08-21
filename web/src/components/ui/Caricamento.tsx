/** Schermata di attesa mostrata durante il cambio pagina.
 *
 *  Next la mostra da sola appena si clicca un link, prima ancora che il server
 *  risponda: è il segnale che il comando è stato preso. Senza, fra il clic e la
 *  pagina nuova non si muove niente e si finisce per cliccare due volte. */
export function Caricamento({ testo = "Carico…" }: { testo?: string }) {
  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3">
      <span
        aria-hidden
        className="inline-block h-8 w-8 animate-spin rounded-full border-[3px] border-navy/20 border-t-navy"
      />
      <p className="font-display text-sm font-bold text-navy/60">{testo}</p>
      <span className="sr-only" role="status">
        Caricamento in corso
      </span>
    </div>
  );
}
