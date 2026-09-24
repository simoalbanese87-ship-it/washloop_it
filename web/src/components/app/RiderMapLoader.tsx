"use client";

import dynamic from "next/dynamic";
import type { Stop, Depot } from "./RiderMap";

/** Wrapper client: carica la mappa solo lato browser (Leaflet usa `window`).
 *  ssr:false è consentito qui perché è un client component. */
const RiderMap = dynamic(() => import("./RiderMap"), {
  ssr: false,
  loading: () => (
    <div className="grid h-[340px] place-items-center rounded-[16px] bg-ice text-sm font-medium text-muted">Carico la mappa…</div>
  ),
});

export function RiderMapLoader({ stops, depot = null }: { stops: Stop[]; depot?: Depot }) {
  return <RiderMap stops={stops} depot={depot} />;
}
