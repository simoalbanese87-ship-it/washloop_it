import type { Metadata } from "next";
import { Logo } from "@/components/Logo";

export const metadata: Metadata = {
  title: "Sei offline",
  robots: { index: false, follow: false },
};

/** Mostrata dal service worker quando la rete non c'è e la pagina richiesta non
 *  è in cache. Prima al suo posto compariva la landing marketing: dentro l'app
 *  installata era straniante, sembrava di essere finiti su un altro sito.
 *
 *  Deve funzionare senza rete: nessuna immagine esterna, nessun dato, nessun JS
 *  oltre al pulsante di ricarica. */
export default function OfflinePage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-navy px-5 text-center text-white">
      <div className="max-w-sm">
        <Logo variant="white" size={30} className="mx-auto" />

        <div className="mx-auto mt-10 flex h-16 w-16 items-center justify-center rounded-full bg-white/10 text-cyan">
          <svg width={30} height={30} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M2 2l20 20" />
            <path d="M8.5 16.5a5 5 0 0 1 7 0" />
            <path d="M5 12.9a10 10 0 0 1 4-2.6" />
            <path d="M15 10.3a10 10 0 0 1 4 2.6" />
            <path d="M2 8.8a16 16 0 0 1 5-3.3" />
            <path d="M17 5.5a16 16 0 0 1 5 3.3" />
            <circle cx="12" cy="20" r="1" fill="currentColor" stroke="none" />
          </svg>
        </div>

        <h1 className="mt-7 font-display text-3xl font-black tracking-[-0.02em]">Sei offline</h1>
        <p className="mt-3 text-base font-medium leading-relaxed text-white/65">
          Non riusciamo a raggiungere WashLoop. Controlla la connessione: appena torna, riprendi da dove eri.
        </p>

        <a
          href="/app"
          className="mt-8 inline-flex min-h-[52px] items-center justify-center rounded-[40px] bg-white px-7 font-display text-base font-extrabold text-navy"
        >
          Riprova
        </a>

        <p className="mt-8 text-sm font-semibold text-white/40">
          Se stai lavorando a un ritiro, i dati già inviati sono al sicuro.
        </p>
      </div>
    </main>
  );
}
