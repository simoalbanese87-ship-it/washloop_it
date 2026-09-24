/** Le bolle animate sui fondi navy.
 *
 *  Stavano dentro la home come funzione locale. Da quando le pagine con l'hero
 *  scuro sono tre, tenerle lì avrebbe voluto dire copiarle: e una copia di uno
 *  sfondo è una copia che prima o poi diverge da sola, con due pagine dello
 *  stesso sito che si muovono in modo diverso senza che nessuno l'abbia deciso. */
export function Bubbles() {
  const b = [
    { w: 320, r: -60, t: -80, o: 0.12, d: "0s" },
    { w: 180, r: 200, t: 60, o: 0.09, d: "1.5s" },
    { w: 90, r: 160, t: 240, o: 0.11, d: "0.8s" },
    { w: 60, l: 80, b: 120, o: 0.1, d: "2.2s" },
    { w: 200, l: -50, b: -60, o: 0.07, d: "1s" },
  ];
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {b.map((x, i) => (
        <span
          key={i}
          className="wl-bubble"
          style={{ width: x.w, height: x.w, right: x.r, left: x.l, top: x.t, bottom: x.b, opacity: x.o, animationDelay: x.d }}
        />
      ))}
    </div>
  );
}
