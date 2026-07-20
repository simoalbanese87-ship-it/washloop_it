"use client";

import "leaflet/dist/leaflet.css";
import { MapContainer, TileLayer, Marker, Popup, Polyline } from "react-leaflet";
import L from "leaflet";

/** Mappa fermate del rider (Leaflet + OpenStreetMap, gratis, no API key).
 *  Marker numerati nell'ordine di visita ottimizzato (Ritiro blu / Consegna verde)
 *  + deposito + polilinea del giro. Il deposito è visibile solo al rider. */

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

export type Depot = { lat: number; lng: number } | null;

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

const depotIcon = L.divIcon({
  className: "",
  html: `<div style="width:30px;height:30px;border-radius:9px;background:#1B2D5E;box-shadow:0 2px 6px rgba(0,0,0,.35);display:grid;place-items:center;border:2px solid #fff"><span style="color:#fff;font-size:15px">🏠</span></div>`,
  iconSize: [30, 30], iconAnchor: [15, 15], popupAnchor: [0, -16],
});

export default function RiderMap({ stops, depot = null }: { stops: Stop[]; depot?: Depot }) {
  const pts = stops.filter((s) => Number.isFinite(s.lat) && Number.isFinite(s.lng));
  const all: [number, number][] = [...(depot ? [[depot.lat, depot.lng] as [number, number]] : []), ...pts.map((p) => [p.lat, p.lng] as [number, number])];
  const center: [number, number] = all.length
    ? [all.reduce((s, p) => s + p[0], 0) / all.length, all.reduce((s, p) => s + p[1], 0) / all.length]
    : DUOMO;
  // Polilinea del giro: deposito → fermate nell'ordine ricevuto → deposito.
  const line: [number, number][] = depot ? [[depot.lat, depot.lng], ...pts.map((p) => [p.lat, p.lng] as [number, number]), [depot.lat, depot.lng]] : pts.map((p) => [p.lat, p.lng] as [number, number]);

  return (
    <MapContainer center={center} zoom={12} scrollWheelZoom={false} style={{ height: "340px", width: "100%", borderRadius: "16px" }}>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {line.length >= 2 && <Polyline positions={line} pathOptions={{ color: "#2b7fd4", weight: 3, opacity: 0.6, dashArray: "6 6" }} />}
      {depot && (
        <Marker position={[depot.lat, depot.lng]} icon={depotIcon}>
          <Popup><div style={{ fontFamily: "system-ui" }}><strong>Deposito</strong><div style={{ color: "#555" }}>Partenza / rientro giro</div></div></Popup>
        </Marker>
      )}
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
