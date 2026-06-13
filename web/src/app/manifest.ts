import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "WashLoop — Lavanderia a domicilio",
    short_name: "WashLoop",
    description: "Ritiriamo, laviamo, stiriamo e ti riconsegniamo il guardaroba a casa. Milano.",
    start_url: "/app",
    scope: "/",
    display: "standalone",
    background_color: "#142046",
    theme_color: "#1b2d5e",
    lang: "it",
    orientation: "portrait",
    categories: ["lifestyle", "utilities"],
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "maskable" },
    ],
  };
}
