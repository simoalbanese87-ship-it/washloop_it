import Link from "next/link";

/** «Porta un amico», sempre a vista nella home dell'app.
 *
 *  Il programma esisteva dal 6 ottobre 2026 ma si trovava solo scendendo nel
 *  profilo: un invito che bisogna cercare non lo manda nessuno. Qui sta nella
 *  prima schermata, sotto le azioni rapide, senza bottone per chiuderlo —
 *  perché non è un avviso che passa, è una cosa che si può fare sempre.
 *
 *  Il disegno è quello della riga «Installa l'app» che gli sta accanto: stessa
 *  altezza, stessa pastiglia, stessa freccia. Due righe diverse nello stesso
 *  punto si leggerebbero come due cose scollegate. */

export const RegaloIcon = () => (
  <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="8" width="18" height="13" rx="2" /><path d="M12 8v13M3 13h18" />
    <path d="M12 8S10.5 3 8 3a2.5 2.5 0 0 0 0 5zM12 8s1.5-5 4-5a2.5 2.5 0 0 1 0 5z" />
  </svg>
);

export function BannerInvita() {
  return (
    <Link
      href="/app/invita"
      className="flex items-center gap-3 rounded-[18px] border border-cyan/40 bg-gradient-to-br from-cyan/10 to-blue/5 px-4 py-3.5 transition-colors active:bg-ice"
    >
      <span className="grid h-11 w-11 flex-none place-items-center rounded-[13px] bg-gradient-to-br from-blue to-cyan text-white">
        <span className="scale-125"><RegaloIcon /></span>
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-display text-[15px] font-extrabold text-navy">Porta un amico</span>
        <span className="block text-xs font-medium text-muted">Una settimana in regalo per ogni amico che attiva un abbonamento</span>
      </span>
      <span className="flex-none font-display text-lg font-black text-navy/30">→</span>
    </Link>
  );
}
