"use client";

export function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="no-print h-11 rounded-[40px] bg-grad px-6 font-display text-sm font-extrabold text-white"
    >
      🖨 Stampa etichetta
    </button>
  );
}
