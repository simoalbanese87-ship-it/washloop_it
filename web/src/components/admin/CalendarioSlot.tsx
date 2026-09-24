"use client";

import { useMemo, useState } from "react";
import { deleteSlot, createSlot, setSlotCapacity } from "@/lib/actions/admin";

/** Il calendario delle fasce, a mese.
 *
 *  Prima le fasce erano un elenco: sessanta righe in ordine di data, dentro cui
 *  bisognava leggere per capire che cosa mancava. E quello che mancava non si
 *  vedeva affatto — un giorno senza fasce non compare in un elenco di fasce.
 *  È così che il martedì è sparito dal calendario senza che nessuno se ne
 *  accorgesse, e con lui il ritiro settimanale di un cliente.
 *
 *  Qui il mese si guarda tutto insieme e ogni giorno ha due righe: ritiri in
 *  blu, consegne in verde. Un giorno scoperto è una casella vuota, che si vede
 *  da lontano. È il motivo per cui il calendario esiste. */

export type FasciaCal = {
  id: string;
  kind: "pickup" | "delivery";
  starts_at: string;
  ends_at: string;
  capacity: number | null;
  presi: number;
  laundry: string | null;
};

const GIORNI = ["lun", "mar", "mer", "gio", "ven", "sab", "dom"];
const MESI = [
  "gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno",
  "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre",
];

const COLORE = {
  pickup: { barra: "bg-[#2b7fd4]", chiaro: "bg-[#2b7fd4]/12 text-[#2b7fd4]", nome: "Ritiri" },
  delivery: { barra: "bg-[#1F8A5B]", chiaro: "bg-[#1F8A5B]/12 text-[#1F8A5B]", nome: "Consegne" },
} as const;

/** Chiave giorno in ora di Roma. Le fasce arrivano in UTC e a mezzanotte i due
 *  giorni non coincidono: raggruppare sull'ora sbagliata sposterebbe le fasce
 *  serali al giorno dopo. */
function giornoRoma(iso: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Rome", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date(iso));
}
function oraRoma(iso: string): string {
  return new Intl.DateTimeFormat("it-IT", {
    timeZone: "Europe/Rome", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).format(new Date(iso));
}

/** Gli orari che il servizio usa davvero, così aggiungere la fascia normale è
 *  un clic invece di quattro campi da compilare ogni volta. */
const PREDEFINITI = {
  pickup: { from: "08:00", to: "12:00", capacity: 15 },
  delivery: { from: "10:30", to: "14:30", capacity: 15 },
} as const;

export function CalendarioSlot({
  fasce,
  oggi,
  lavanderie = [],
}: {
  fasce: FasciaCal[];
  oggi: string;
  lavanderie?: { id: string; name: string }[];
}) {
  // `oggi` arriva dal server: calcolarlo qui darebbe un primo render diverso
  // fra server e browser, e React se ne lamenta a ragione.
  const [anno, mese] = useState(() => {
    const [a, m] = oggi.split("-").map(Number);
    return [a, m - 1];
  })[0];
  const [vista, setVista] = useState({ anno, mese });
  const [giornoAperto, setGiornoAperto] = useState<string | null>(null);
  const [tipoNuovo, setTipoNuovo] = useState<"pickup" | "delivery">("pickup");

  const perGiorno = useMemo(() => {
    const m = new Map<string, FasciaCal[]>();
    for (const f of fasce) {
      const g = giornoRoma(f.starts_at);
      const lista = m.get(g);
      if (lista) lista.push(f);
      else m.set(g, [f]);
    }
    for (const lista of m.values()) lista.sort((a, b) => a.starts_at.localeCompare(b.starts_at));
    return m;
  }, [fasce]);

  // Griglia del mese, lunedì per primo (come il calendario italiano).
  const celle = useMemo(() => {
    const primo = new Date(Date.UTC(vista.anno, vista.mese, 1));
    const giorniNelMese = new Date(Date.UTC(vista.anno, vista.mese + 1, 0)).getUTCDate();
    const offset = (primo.getUTCDay() + 6) % 7; // 0 = lunedì
    const out: (string | null)[] = Array(offset).fill(null);
    for (let d = 1; d <= giorniNelMese; d++) {
      out.push(`${vista.anno}-${String(vista.mese + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`);
    }
    while (out.length % 7 !== 0) out.push(null);
    return out;
  }, [vista]);

  const cambiaMese = (d: number) => {
    setGiornoAperto(null);
    setVista((v) => {
      const m = v.mese + d;
      if (m < 0) return { anno: v.anno - 1, mese: 11 };
      if (m > 11) return { anno: v.anno + 1, mese: 0 };
      return { anno: v.anno, mese: m };
    });
  };

  const delGiorno = giornoAperto ? (perGiorno.get(giornoAperto) ?? []) : [];

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => cambiaMese(-1)}
            aria-label="Mese precedente"
            className="grid h-9 w-9 place-items-center rounded-full border border-line font-display font-bold text-navy hover:bg-ice"
          >
            ‹
          </button>
          <span className="font-display text-lg font-extrabold capitalize text-navy">
            {MESI[vista.mese]} {vista.anno}
          </span>
          <button
            type="button"
            onClick={() => cambiaMese(1)}
            aria-label="Mese successivo"
            className="grid h-9 w-9 place-items-center rounded-full border border-line font-display font-bold text-navy hover:bg-ice"
          >
            ›
          </button>
        </div>
        <div className="flex items-center gap-3 text-xs font-bold">
          <span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-full bg-[#2b7fd4]" />Ritiri</span>
          <span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-full bg-[#1F8A5B]" />Consegne</span>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-px overflow-hidden rounded-[16px] border border-line bg-line">
        {GIORNI.map((g) => (
          <div key={g} className="bg-ice px-2 py-2 text-center font-display text-[11px] font-extrabold uppercase tracking-wider text-navy/55">
            {g}
          </div>
        ))}

        {celle.map((giorno, i) => {
          if (!giorno) return <div key={`v${i}`} className="min-h-[86px] bg-white/40" />;
          const delGiorno = perGiorno.get(giorno) ?? [];
          const ritiri = delGiorno.filter((f) => f.kind === "pickup");
          const consegne = delGiorno.filter((f) => f.kind === "delivery");
          const numero = Number(giorno.slice(-2));
          const passato = giorno < oggi;
          const aperto = giornoAperto === giorno;

          return (
            <button
              key={giorno}
              type="button"
              onClick={() => setGiornoAperto(aperto ? null : giorno)}
              className={`min-h-[86px] cursor-pointer bg-white p-1.5 text-left transition-colors hover:bg-ice ${
                aperto ? "ring-2 ring-inset ring-blue" : ""
              } ${passato ? "opacity-45" : ""}`}
            >
              <div className={`mb-1 px-1 font-display text-xs font-extrabold ${giorno === oggi ? "text-blue" : "text-navy/70"}`}>
                {numero}
              </div>
              {/* Due righe, sempre nello stesso ordine: così l'occhio impara
                  dove guardare e un giorno scoperto salta fuori da solo. */}
              <Riga fasce={ritiri} kind="pickup" />
              <Riga fasce={consegne} kind="delivery" />
            </button>
          );
        })}
      </div>

      {giornoAperto && (
        <div className="mt-4 rounded-[16px] border border-line bg-white p-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="font-display text-base font-extrabold text-navy">
              {new Date(`${giornoAperto}T12:00:00Z`).toLocaleDateString("it-IT", {
                weekday: "long", day: "numeric", month: "long",
              })}
            </h3>
            <button type="button" onClick={() => setGiornoAperto(null)} className="font-display text-sm font-bold text-navy/55 hover:text-navy">
              Chiudi
            </button>
          </div>

          {delGiorno.length === 0 && (
            <p className="mt-2 text-sm font-medium text-muted">
              Nessuna fascia in questo giorno: né ritiri né consegne. Chi prenota non lo vede proprio.
            </p>
          )}
          {delGiorno.length > 0 && (
            <div className="mt-3 space-y-2">
              {delGiorno.map((f) => {
                const c = COLORE[f.kind];
                const pieno = f.capacity != null && f.presi >= f.capacity;
                return (
                  <div key={f.id} className="flex flex-wrap items-center gap-3 rounded-[12px] border border-line px-3 py-2.5">
                    <span className={`rounded-full px-2.5 py-1 font-display text-[11px] font-extrabold ${c.chiaro}`}>{c.nome}</span>
                    <span className="font-display text-sm font-extrabold text-navy">
                      {oraRoma(f.starts_at)}–{oraRoma(f.ends_at)}
                    </span>
                    <span className={`font-display text-xs font-bold ${pieno ? "text-[#C0392B]" : "text-muted"}`}>
                      {f.presi} occupati su
                    </span>
                    {/* La capienza si cambia qui: rifare la fascia avrebbe
                        archiviato quella vecchia lasciandoci sopra gli ordini. */}
                    <form action={setSlotCapacity} className="flex items-center gap-1">
                      <input type="hidden" name="slot_id" value={f.id} />
                      <input
                        type="number"
                        name="capacity"
                        min={1}
                        defaultValue={f.capacity ?? 15}
                        aria-label="Capienza"
                        className="w-16 rounded-[8px] border border-line bg-white px-2 py-1 text-sm font-semibold text-navy"
                      />
                      <button type="submit" className="font-display text-xs font-bold text-blue hover:underline">
                        salva
                      </button>
                    </form>
                    <span className="min-w-0 flex-1 truncate text-xs font-medium text-muted">{f.laundry ?? "—"}</span>
                    <form action={deleteSlot}>
                      <input type="hidden" name="slot_id" value={f.id} />
                      <button type="submit" className="font-display text-xs font-bold text-[#C0392B] hover:underline">
                        Togli
                      </button>
                    </form>
                  </div>
                );
              })}
              <p className="pt-1 text-xs font-medium text-muted">
                «Togli» leva la fascia dal calendario e dalla prenotazione. Gli ordini già presi su quella
                fascia restano validi e mantengono giorno e ora: non si perde niente.
              </p>
            </div>
          )}

          {/* Aggiungere una fascia da qui era il pezzo che mancava: si poteva
              solo togliere, quindi aprire un giorno vuoto non serviva a niente.
              I campi arrivano già compilati con gli orari del servizio. */}
          <form action={createSlot} className="mt-4 border-t border-line pt-4">
            <input type="hidden" name="date" value={giornoAperto} />
            <div className="font-display text-sm font-extrabold text-navy">Aggiungi una fascia</div>
            <div className="mt-2 grid gap-2 sm:grid-cols-[auto_auto_auto_auto_1fr_auto]">
              <select
                name="kind"
                value={tipoNuovo}
                onChange={(e) => setTipoNuovo(e.target.value as "pickup" | "delivery")}
                className="rounded-[10px] border border-line bg-white px-3 py-2 text-sm font-medium text-navy"
              >
                <option value="pickup">Ritiro</option>
                <option value="delivery">Consegna</option>
              </select>
              <input
                type="time"
                name="from"
                defaultValue={PREDEFINITI[tipoNuovo].from}
                key={`from-${tipoNuovo}`}
                className="rounded-[10px] border border-line bg-white px-3 py-2 text-sm font-medium text-navy"
              />
              <input
                type="time"
                name="to"
                defaultValue={PREDEFINITI[tipoNuovo].to}
                key={`to-${tipoNuovo}`}
                className="rounded-[10px] border border-line bg-white px-3 py-2 text-sm font-medium text-navy"
              />
              <input
                type="number"
                name="capacity"
                min={1}
                defaultValue={PREDEFINITI[tipoNuovo].capacity}
                key={`cap-${tipoNuovo}`}
                aria-label="Capienza"
                className="w-24 rounded-[10px] border border-line bg-white px-3 py-2 text-sm font-medium text-navy"
              />
              <select
                name="laundry_id"
                defaultValue=""
                className="min-w-0 rounded-[10px] border border-line bg-white px-3 py-2 text-sm font-medium text-navy"
              >
                <option value="">Lavanderia (facoltativa)</option>
                {lavanderie.map((l) => (
                  <option key={l.id} value={l.id}>{l.name}</option>
                ))}
              </select>
              <button type="submit" className="rounded-[10px] bg-navy px-4 py-2 font-display text-sm font-bold text-white">
                Aggiungi
              </button>
            </div>
            <p className="mt-2 text-xs font-medium text-muted">
              Precompilata con gli orari del servizio: ritiro 08:00–12:00, consegna 10:30–14:30, 15 posti.
              La lavanderia serve solo a sapere da dove riparte il capo, non è obbligatoria.
            </p>
          </form>
        </div>
      )}
    </div>
  );
}

/** Una delle due righe di un giorno. Vuota se non c'è niente: lo spazio resta,
 *  perché è proprio l'assenza l'informazione da vedere. */
function Riga({ fasce, kind }: { fasce: FasciaCal[]; kind: "pickup" | "delivery" }) {
  const c = COLORE[kind];
  if (fasce.length === 0) return <div className="mb-0.5 h-[18px] rounded-[4px] border border-dashed border-line/80" />;
  const presi = fasce.reduce((t, f) => t + f.presi, 0);
  const posti = fasce.reduce((t, f) => t + (f.capacity ?? 0), 0);
  return (
    <div className={`mb-0.5 flex h-[18px] items-center justify-between rounded-[4px] px-1.5 text-[10px] font-extrabold text-white ${c.barra}`}>
      <span>{fasce.length}</span>
      <span className="opacity-90">{presi}/{posti || "∞"}</span>
    </div>
  );
}
