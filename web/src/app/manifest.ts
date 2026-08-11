import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    // `id` fisso: senza, l'identità dell'app è la start_url. Cambiarla domani
    // creerebbe una seconda icona a chi ha già installato. Da mettere adesso
    // che la base installata è zero.
    id: "/?app",
    name: "WashLoop — Lavanderia a domicilio",
    short_name: "WashLoop",
    description: "Ritiriamo, laviamo, stiriamo e ti riconsegniamo il guardaroba a casa. Milano.",
    start_url: "/app",
    scope: "/",
    display: "standalone",
    // Bianco e non navy: la app è chiara, con lo splash navy si vedeva un lampo
    // bianco all'avvio.
    background_color: "#ffffff",
    theme_color: "#1b2d5e",
    lang: "it",
    dir: "ltr",
    orientation: "portrait",
    categories: ["lifestyle", "utilities"],
    icons: [
      // PNG e non solo SVG: diversi launcher Android non rendono l'SVG, e Chrome
      // non lo usa affatto nelle notifiche push.
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      // Maskable dedicata: fondo pieno e marchio dentro l'80% centrale, così la
      // maschera circolare di Android non taglia le bolle.
      { src: "/icon-512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
    ],
    shortcuts: [
      { name: "Prenota un ritiro", short_name: "Prenota", url: "/app/prenota" },
      { name: "I miei ordini", short_name: "Ordini", url: "/app/ordini" },
      { name: "Abbonamento", short_name: "Abbonamento", url: "/app/abbonamento" },
    ],
  };
}
