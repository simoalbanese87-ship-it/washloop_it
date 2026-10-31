"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { NavItem, NavSub } from "./AppShell";

/** La barra in alto, con i sottomenu dove servono.
 *
 *  Il problema che risolve
 *  -----------------------
 *  Le pagine che si aprono di rado vivono tutte sotto `/admin/impostazioni`,
 *  che è un elenco a tendina lungo una pagina intera: per arrivare al Cantiere
 *  SEO bisognava aprire Impostazioni, scorrere fino in fondo e cercare la voce.
 *  Tre passaggi per una pagina che si guarda ogni settimana.
 *
 *  Ora la voce della barra apre il suo elenco al passaggio del mouse: la
 *  pagina intermedia resta — è ancora utile per leggere le descrizioni — ma
 *  non è più obbligatoria.
 *
 *  Perché in CSS e non con un `useState`
 *  -------------------------------------
 *  `group-hover` e `focus-within` fanno tutto senza stato: niente menu che
 *  resta aperto dopo aver cambiato pagina, niente clic fuori da intercettare,
 *  e soprattutto funziona anche da tastiera — chi arriva con il tab apre il
 *  menu senza mouse. Il ponte invisibile sopra il pannello (`pt-3` dentro un
 *  contenitore senza margini) serve perché il mouse ci passi sopra senza che
 *  il menu si chiuda a metà strada.
 *
 *  Sul telefono non ci sono tendine: la barra è già una riga che scorre, e un
 *  menu a comparsa su un touch è un bersaglio che si apre per sbaglio. Lì le
 *  sottovoci compaiono in una seconda riga, ma solo della sezione in cui ci si
 *  trova: sono quelle che servono mentre ci si è dentro. */

function voceAttiva(pathname: string, href: string): boolean {
  const base = href.split("?")[0];
  if (base === "/app" || base === "/admin") return pathname === base;
  return pathname === base || pathname.startsWith(`${base}/`);
}

/** La sezione in cui ci si trova: quella con la voce o la sottovoce più
 *  specifica che corrisponde all'indirizzo aperto. */
function sezioneCorrente(nav: NavItem[], pathname: string): NavItem | null {
  let scelta: NavItem | null = null;
  let lunghezza = -1;
  for (const item of nav) {
    const candidati = [item.href, ...(item.sub ?? []).flatMap((g) => g.voci.map((v) => v.href))];
    for (const href of candidati) {
      const base = href.split("?")[0];
      if (voceAttiva(pathname, href) && base.length > lunghezza) {
        scelta = item;
        lunghezza = base.length;
      }
    }
  }
  return scelta;
}

function Tendina({ gruppi }: { gruppi: NavSub[] }) {
  const aGruppi = gruppi.length > 1 || !!gruppi[0]?.titolo;
  return (
    <div className="invisible absolute left-1/2 top-full z-50 -translate-x-1/2 pt-3 opacity-0 transition-opacity group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100">
      <div
        className={`rounded-[18px] border border-line bg-white p-2 shadow-[0_12px_32px_rgba(11,31,58,0.14)] ${
          aGruppi ? "grid w-[34rem] grid-cols-2 gap-x-2" : "w-60"
        }`}
      >
        {gruppi.map((g) => (
          <div key={g.titolo ?? "voci"} className="p-1">
            {g.titolo && (
              <div className="px-3 pb-1 pt-2 font-display text-[10px] font-extrabold uppercase tracking-[0.18em] text-navy/35">
                {g.titolo}
              </div>
            )}
            {g.voci.map((v) => (
              <Link
                key={v.href}
                href={v.href}
                className="block rounded-[12px] px-3 py-2 font-display text-sm font-bold text-navy/70 transition-colors hover:bg-ice hover:text-navy"
              >
                {v.label}
              </Link>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function NavLinks({ nav, variant }: { nav: NavItem[]; variant: "desktop" | "mobile" }) {
  const pathname = usePathname();

  if (variant === "mobile") {
    const sezione = sezioneCorrente(nav, pathname);
    const sottovoci = (sezione?.sub ?? []).flatMap((g) => g.voci);
    return (
      <>
        <nav className="flex gap-4 overflow-x-auto border-t border-line px-5 py-2.5 md:hidden">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`whitespace-nowrap font-display text-sm font-bold transition-colors ${
                item === sezione ? "text-navy" : "text-navy/55 hover:text-navy"
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        {sottovoci.length > 0 && (
          <nav className="flex gap-3 overflow-x-auto border-t border-line bg-ice px-5 py-2 md:hidden">
            {sottovoci.map((v) => (
              <Link
                key={v.href}
                href={v.href}
                className={`whitespace-nowrap font-display text-xs font-bold transition-colors ${
                  voceAttiva(pathname, v.href) ? "text-navy" : "text-navy/50 hover:text-navy"
                }`}
              >
                {v.label}
              </Link>
            ))}
          </nav>
        )}
      </>
    );
  }

  const sezione = sezioneCorrente(nav, pathname);
  return (
    <nav className="hidden items-center gap-6 md:flex">
      {nav.map((item) => {
        const attiva = item === sezione;
        const cls = `whitespace-nowrap font-display text-sm font-bold transition-colors ${
          attiva ? "text-navy" : "text-navy/55 hover:text-navy"
        }`;
        if (!item.sub?.length) {
          return (
            <Link key={item.href} href={item.href} className={cls}>
              {item.label}
            </Link>
          );
        }
        return (
          <div key={item.href} className="group relative">
            <Link href={item.href} className={`${cls} flex items-center gap-1`}>
              {item.label}
              <span aria-hidden className="text-[9px] text-navy/35 transition-transform group-hover:translate-y-px">
                ▼
              </span>
            </Link>
            <Tendina gruppi={item.sub} />
          </div>
        );
      })}
    </nav>
  );
}
