"use client";

import "leaflet/dist/leaflet.css";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";

/** Mappa fermate del rider (Leaflet + OpenStreetMap, gratis, no API key).
 *  Marker numerati per tipo (Ritiro blu / Consegna verde) — colore + numero +
 *  testo nel popup, non solo colore. Ordine = per orario slot (nessuna
 *  ottimizzazione di percorso). */

export type Stop = {
  id: string;
  kind: "pickup" | "delivery";
  n: number;
  name: string;
  address: string;
  lat: number;
  lng: number;
  when: string | null;
};

const COLOR = { pickup: "#2b7fd4", delivery: "#1F8A5B" } as const;
const KIND_LABEL = { pickup: "Ritiro", delivery: "Consegna" } as const;

function pinIcon(n: number, kind: Stop["kind"]) {
  const c = COLOR[kind];
  return L.divIcon({
    className: "",
    html: `<div style="width:28px;height:28px;border-radius:50% 50% 50% 0;background:${c};transform:rotate(-45deg);box-shadow:0 2px 6px rgba(0,0,0,.35);display:grid;place-items:center;border:2px solid #fff"><span style="transform:rotate(45deg);color:#fff;font-weight:800;font-size:12px;font-family:system-ui">${n}</span></div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 28],
    popupAnchor: [0, -26],
  });
}

const DUOMO: [number, number] = [45.4642, 9.19];

export default function RiderMap({ stops }: { stops: Stop[] }) {
  const pts = stops.filter((s) => Number.isFinite(s.lat) && Number.isFinite(s.lng));
  const center: [number, number] = pts.length
    ? [pts.reduce((s, p) => s + p.lat, 0) / pts.length, pts.reduce((s, p) => s + p.lng, 0) / pts.length]
    : DUOMO;

  return (
    <MapContainer center={center} zoom={12} scrollWheelZoom={false} style={{ height: "340px", width: "100%", borderRadius: "16px" }}>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {pts.map((s) => (
        <Marker key={s.id} position={[s.lat, s.lng]} icon={pinIcon(s.n, s.kind)}>
          <Popup>
            <div style={{ fontFamily: "system-ui", minWidth: 160 }}>
              <strong style={{ color: COLOR[s.kind] }}>{KIND_LABEL[s.kind]} #{s.n}</strong>
              <div style={{ fontWeight: 700, marginTop: 2 }}>{s.name}</div>
              <div style={{ color: "#555" }}>{s.address}</div>
              {s.when && <div style={{ color: "#555", marginTop: 2 }}>{s.when}</div>}
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
