"use client";

import "leaflet/dist/leaflet.css";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";

/** Mappa live cliente: la propria casa + il rider (quando vicino e attivo). Nessun
 *  deposito, nessuna altra fermata. */

const homeIcon = L.divIcon({
  className: "",
  html: `<div style="width:26px;height:26px;border-radius:8px;background:#1B2D5E;box-shadow:0 2px 6px rgba(0,0,0,.3);display:grid;place-items:center;border:2px solid #fff"><span style="font-size:13px">🏠</span></div>`,
  iconSize: [26, 26], iconAnchor: [13, 13], popupAnchor: [0, -14],
});
const riderIcon = L.divIcon({
  className: "",
  html: `<div style="width:30px;height:30px;border-radius:50%;background:#2b7fd4;box-shadow:0 2px 8px rgba(43,127,212,.6);display:grid;place-items:center;border:3px solid #fff"><span style="font-size:15px">🛵</span></div>`,
  iconSize: [30, 30], iconAnchor: [15, 15], popupAnchor: [0, -16],
});

export default function LiveRiderMapView({ pos }: { pos: { lat: number; lng: number; label: string; custLat: number; custLng: number } }) {
  const center: [number, number] = [(pos.lat + pos.custLat) / 2, (pos.lng + pos.custLng) / 2];
  return (
    <MapContainer center={center} zoom={14} scrollWheelZoom={false} style={{ height: "260px", width: "100%", borderRadius: "16px" }}>
      <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" />
      <Marker position={[pos.custLat, pos.custLng]} icon={homeIcon}><Popup>Il tuo indirizzo</Popup></Marker>
      <Marker position={[pos.lat, pos.lng]} icon={riderIcon}><Popup>{pos.label}</Popup></Marker>
    </MapContainer>
  );
}
