"use client";

import "leaflet/dist/leaflet.css";
import { MapContainer, TileLayer, Marker, Popup, Polyline } from "react-leaflet";
import L from "leaflet";

/** La mappa del giro (Leaflet + OpenStreetMap, gratis, senza chiave).
 *
 *  Due giri, due colori
 *  --------------------
 *  Da ottobre 2026 i sacchi vanno in due posti diversi: la lavanderia generale
 *  a Zanica e la stireria del solo stiro a Corsico, agli antipodi di Milano.
 *  Finché il colore diceva solo «ritiro o consegna», il rider non aveva modo
 *  di vedere **dove sta andando quel sacco** mentre lo caricava — e un sacco
 *  caricato sul furgone sbagliato si scopre a fine giornata, a cinquanta
 *  chilometri di distanza.
 *
 *  Quindi il colore adesso dice il **giro**: blu la lavanderia, ambra il solo
 *  stiro. Resta da distinguere cosa si fa a quella porta, e lo fa il pieno: il
 *  pin pieno è un ritiro (il sacco sale sul furgone), quello vuoto è una
 *  riconsegna (il sacco scende). Due informazioni su due dimensioni diverse,
 *  leggibili insieme su uno schermo da telefono.
 *
 *  I due punti fissi
 *  -----------------
 *  Lavanderia e stireria si disegnano **sempre**, anche nelle giornate in cui
 *  non c'è niente da scaricare: sono i capolinea dei due giri, e vedere da che
 *  parte cadono è metà dell'orientamento. Quando ci sono sacchi da portare, il
 *  punto lo dice.
 *
 *  Il deposito resta l'hub interno, e resta visibile solo al rider. */

export type Servizio = "lavanderia" | "stiro";

export type Stop = {
  id: string;
  kind: "pickup" | "delivery";
  n: number;
  name: string;
  address: string;
  lat: number;
  lng: number;
  when: string | null;
  /** A quale giro appartiene: decide il colore e la linea su cui sta. */
  servizio?: Servizio | null;
  /** Dove va (o da dove viene) il sacco, per il fumetto. */
  destinazione?: string | null;
};

/** Un capolinea: la lavanderia o la stireria. */
export type Punto = {
  id: string;
  nome: string;
  servizio: Servizio;
  lat: number;
  lng: number;
  /** Quanti sacchi ci si lasciano oggi. 0 = oggi non si passa. */
  sacchi: number;
};

export type Depot = { lat: number; lng: number } | null;

/** Gli stessi colori del pannello (`lib/tipo-servizio.ts`): blu la lavanderia,
 *  viola il solo stiro.
 *
 *  Erano blu e ambra. Due guai in uno: l'ops vedeva viola dove il rider vedeva
 *  ambra — due colori per lo stesso fatto — e nell'app del rider l'ambra è già
 *  il colore di «in ritardo», «senza fascia», «senza posizione». Una fermata
 *  di solo stiro, puntuale e geolocalizzata, aveva addosso il colore dei
 *  problemi. */
const COLORE: Record<Servizio, string> = { lavanderia: "#2b7fd4", stiro: "#7A4FBF" };
/** Fermate di cui non sappiamo la destinazione: esistono e vanno viste, ma in
 *  grigio — è il modo in cui tutto il prodotto dice «non lo so». */
const SENZA = "#6B7A99";
const ETICHETTA: Record<Servizio, string> = { lavanderia: "Lava e stira", stiro: "Solo stiro" };

const coloreDi = (s: Servizio | null | undefined) => (s ? COLORE[s] : SENZA);

function pinIcon(n: number, kind: Stop["kind"], servizio: Servizio | null | undefined) {
  const c = coloreDi(servizio);
  // Ritiro = pieno (il sacco sale), riconsegna = vuoto (il sacco scende).
  const dentro =
    kind === "pickup"
      ? `background:${c};border:2px solid #fff`
      : `background:#fff;border:3px solid ${c}`;
  const testo = kind === "pickup" ? "#fff" : c;
  return L.divIcon({
    className: "",
    html: `<div style="width:28px;height:28px;border-radius:50% 50% 50% 0;${dentro};transform:rotate(-45deg);box-shadow:0 2px 6px rgba(0,0,0,.35);display:grid;place-items:center"><span style="transform:rotate(45deg);color:${testo};font-weight:800;font-size:12px;font-family:system-ui">${n}</span></div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 28],
    popupAnchor: [0, -26],
  });
}

function puntoIcon(p: Punto) {
  const c = COLORE[p.servizio];
  const attivo = p.sacchi > 0;
  return L.divIcon({
    className: "",
    html: `<div style="min-width:30px;height:30px;padding:0 6px;border-radius:9px;background:${attivo ? c : "#fff"};border:2px solid ${c};box-shadow:0 2px 6px rgba(0,0,0,.3);display:grid;place-items:center"><span style="color:${attivo ? "#fff" : c};font-size:12px;font-weight:800;font-family:system-ui">${p.servizio === "stiro" ? "ST" : "LAV"}</span></div>`,
    iconSize: [44, 30],
    iconAnchor: [22, 15],
    popupAnchor: [0, -16],
  });
}

const DUOMO: [number, number] = [45.4642, 9.19];

const depotIcon = L.divIcon({
  className: "",
  html: `<div style="width:30px;height:30px;border-radius:9px;background:#1B2D5E;box-shadow:0 2px 6px rgba(0,0,0,.35);display:grid;place-items:center;border:2px solid #fff"><span style="color:#fff;font-size:15px">🏠</span></div>`,
  iconSize: [30, 30], iconAnchor: [15, 15], popupAnchor: [0, -16],
});

export default function RiderMap({
  stops,
  depot = null,
  punti = [],
}: {
  stops: Stop[];
  depot?: Depot;
  punti?: Punto[];
}) {
  const pts = stops.filter((s) => Number.isFinite(s.lat) && Number.isFinite(s.lng));
  const tutti: [number, number][] = [
    ...(depot ? [[depot.lat, depot.lng] as [number, number]] : []),
    ...pts.map((p) => [p.lat, p.lng] as [number, number]),
    ...punti.map((p) => [p.lat, p.lng] as [number, number]),
  ];
  const center: [number, number] = tutti.length
    ? [tutti.reduce((s, p) => s + p[0], 0) / tutti.length, tutti.reduce((s, p) => s + p[1], 0) / tutti.length]
    : DUOMO;

  // Una linea per giro: parte dal punto di partenza, passa per le sue fermate
  // nell'ordine di visita e finisce al suo capolinea. Prima la linea era una
  // sola e tornava al deposito: con due destinazioni raccontava un viaggio che
  // nessuno fa.
  const giri = new Map<string, { colore: string; punti: [number, number][] }>();
  for (const s of pts) {
    const chiave = s.servizio ?? "senza";
    const g = giri.get(chiave) ?? {
      colore: coloreDi(s.servizio),
      punti: depot ? [[depot.lat, depot.lng] as [number, number]] : [],
    };
    g.punti.push([s.lat, s.lng]);
    giri.set(chiave, g);
  }
  for (const p of punti) {
    const g = giri.get(p.servizio);
    // Il capolinea si attacca alla linea solo se quel giro esiste oggi.
    if (g && g.punti.length > (depot ? 1 : 0)) g.punti.push([p.lat, p.lng]);
  }

  return (
    <div>
      <MapContainer center={center} zoom={11} scrollWheelZoom={false} style={{ height: "340px", width: "100%", borderRadius: "16px" }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {[...giri.entries()].map(([chiave, g]) =>
          g.punti.length >= 2 ? (
            <Polyline key={chiave} positions={g.punti} pathOptions={{ color: g.colore, weight: 3, opacity: 0.65, dashArray: "6 6" }} />
          ) : null,
        )}

        {depot && (
          <Marker position={[depot.lat, depot.lng]} icon={depotIcon}>
            <Popup><div style={{ fontFamily: "system-ui" }}><strong>Deposito</strong><div style={{ color: "#555" }}>Partenza del giro</div></div></Popup>
          </Marker>
        )}

        {punti.map((p) => (
          <Marker key={p.id} position={[p.lat, p.lng]} icon={puntoIcon(p)}>
            <Popup>
              <div style={{ fontFamily: "system-ui", minWidth: 160 }}>
                <strong style={{ color: COLORE[p.servizio] }}>{ETICHETTA[p.servizio]}</strong>
                <div style={{ fontWeight: 700, marginTop: 2 }}>{p.nome}</div>
                <div style={{ color: "#555" }}>
                  {p.sacchi > 0 ? `${p.sacchi} ${p.sacchi === 1 ? "sacco" : "sacchi"} da scaricare oggi` : "oggi niente da scaricare qui"}
                </div>
              </div>
            </Popup>
          </Marker>
        ))}

        {pts.map((s) => (
          <Marker key={s.id} position={[s.lat, s.lng]} icon={pinIcon(s.n, s.kind, s.servizio)}>
            <Popup>
              <div style={{ fontFamily: "system-ui", minWidth: 160 }}>
                <strong style={{ color: coloreDi(s.servizio) }}>
                  {s.kind === "pickup" ? "Ritiro" : "Riconsegna"} #{s.n}
                </strong>
                <div style={{ fontWeight: 700, marginTop: 2 }}>{s.name}</div>
                <div style={{ color: "#555" }}>{s.address}</div>
                {s.when && <div style={{ color: "#555", marginTop: 2 }}>{s.when}</div>}
                {s.destinazione && (
                  <div style={{ color: coloreDi(s.servizio), marginTop: 2, fontWeight: 700 }}>
                    {s.kind === "pickup" ? "→ " : "← "}
                    {s.destinazione}
                  </div>
                )}
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>

      {/* La legenda. Senza, i colori sono una decorazione: con due giri sulla
          stessa mappa bisogna poter leggere quale è quale senza indovinare. */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-4 py-2.5 text-[11px] font-semibold text-muted">
        <span className="inline-flex items-center gap-1.5">
          <i className="inline-block h-3 w-3 rounded-full" style={{ background: COLORE.lavanderia }} /> Lava e stira
        </span>
        <span className="inline-flex items-center gap-1.5">
          <i className="inline-block h-3 w-3 rounded-full" style={{ background: COLORE.stiro }} /> Solo stiro
        </span>
        <span className="inline-flex items-center gap-1.5">
          <i className="inline-block h-3 w-3 rounded-full border-2 border-navy/50 bg-navy" /> pieno = ritiro
        </span>
        <span className="inline-flex items-center gap-1.5">
          <i className="inline-block h-3 w-3 rounded-full border-2 border-navy/50 bg-white" /> vuoto = riconsegna
        </span>
      </div>
    </div>
  );
}
