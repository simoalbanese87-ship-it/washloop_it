"use client";

import { useEffect, useState } from "react";
import { attiva, stato, type StatoNotifiche as Stato } from "@/lib/notifiche-browser";

/** L'interruttore delle notifiche, in chiaro e sempre raggiungibile.
 *
 *  Il popup che chiede il permesso passa una volta sola: chi preme «più tardi»,
 *  chi lo chiude per sbaglio, chi installa l'app su un secondo telefono non lo
 *  rivede più, e da nessuna parte era scritto se gli avvisi arrivavano o no.
 *  Risultato, al 17 ottobre 2026: tre iscrizioni in tutto il sistema, nessuna
 *  di un rider — e il rider è quello che senza avviso non sa di avere un giro.
 *
 *  Dice sempre e solo la verità su **questo** dispositivo: le notifiche push
 *  sono per dispositivo, non per persona. Attivarle sul telefono non le attiva
 *  sul computer, ed è giusto che si legga dove si sta guardando. */

const TESTO: Record<Stato, { titolo: string; dettaglio: string; tono: "bene" | "attenzione" | "neutro" }> = {
  attive: {
    titolo: "Notifiche attive su questo dispositivo",
    dettaglio: "Ricevi un avviso quando c'è qualcosa da fare.",
    tono: "bene",
  },
  "da-attivare": {
    titolo: "Notifiche non attive",
    dettaglio: "Senza, gli avvisi li vedi solo aprendo l'app.",
    tono: "attenzione",
  },
  rotte: {
    titolo: "Notifiche da risistemare",
    dettaglio: "Il permesso c'è ma l'iscrizione non è stata salvata: così non arriva niente. Riprova.",
    tono: "attenzione",
  },
  bloccate: {
    titolo: "Notifiche bloccate dal browser",
    dettaglio:
      "Il permesso è stato negato e non si può richiedere da qui: va riattivato dalle impostazioni del sito (il lucchetto accanto all'indirizzo) o, sul telefono, dalle impostazioni dell'app.",
    tono: "attenzione",
  },
  "ios-da-installare": {
    titolo: "Prima aggiungi l'app alla schermata Home",
    dettaglio:
      "Su iPhone le notifiche funzionano solo dall'app installata: Condividi → «Aggiungi a Home», poi apri l'app da lì e torna qui.",
    tono: "attenzione",
  },
  "non-supportate": {
    titolo: "Questo browser non fa notifiche",
    dettaglio: "Apri l'app da un altro browser o dal telefono.",
    tono: "neutro",
  },
};

const COLORE = {
  bene: "border-[#1F8A5B]/30 bg-[#1F8A5B]/8",
  attenzione: "border-[#C9881F]/35 bg-[#C9881F]/8",
  neutro: "border-line bg-ice",
} as const;

export function StatoNotifiche({
  /** Cosa si perde senza: cambia col mestiere di chi legge. */
  perche = "Ti avvisiamo quando c'è qualcosa da fare.",
  /** `true` nasconde il riquadro quando è tutto a posto. */
  soloSeServe = false,
}: {
  perche?: string;
  soloSeServe?: boolean;
}) {
  const [s, setS] = useState<Stato | null>(null);
  const [inCorso, setInCorso] = useState(false);
  const [prova, setProva] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    void stato().then((x) => {
      if (vivo) setS(x);
    });
    return () => {
      vivo = false;
    };
  }, []);

  // Finché non si sa, non si scrive niente: un lampo di «non attive» a chi le
  // ha attive è il modo migliore per far premere un bottone che non serve.
  if (!s) return null;
  if (soloSeServe && s === "attive") return null;

  const t = TESTO[s];
  const puoAttivare = s === "da-attivare" || s === "rotte";

  return (
    <div className={`rounded-[16px] border-2 px-4 py-3 ${COLORE[t.tono]}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="font-display text-sm font-extrabold text-navy">
            {s === "attive" ? "🔔 " : ""}
            {t.titolo}
          </div>
          <p className="mt-0.5 text-xs font-medium text-muted">{s === "da-attivare" ? `${t.dettaglio} ${perche}` : t.dettaglio}</p>
          {prova && <p className="mt-1.5 text-xs font-bold text-navy">{prova}</p>}
        </div>

        <div className="flex flex-none items-center gap-2">
          {puoAttivare && (
            <button
              type="button"
              disabled={inCorso}
              onClick={async () => {
                setInCorso(true);
                setS(await attiva());
                setInCorso(false);
              }}
              className="rounded-full bg-gradient-to-br from-blue to-cyan px-4 py-2 font-display text-xs font-extrabold text-white disabled:opacity-50"
            >
              {inCorso ? "Attivo…" : "Attiva"}
            </button>
          )}
          {s === "attive" && (
            // La prova esiste perché «attive» è una promessa, e una promessa
            // sugli avvisi si verifica in un modo solo: facendone arrivare uno.
            <button
              type="button"
              disabled={inCorso}
              onClick={async () => {
                setInCorso(true);
                setProva(null);
                try {
                  const res = await fetch("/api/push/test", { method: "POST" });
                  const dati = (await res.json().catch(() => null)) as { inviate?: number; error?: string } | null;
                  setProva(
                    res.ok && (dati?.inviate ?? 0) > 0
                      ? "Inviata: dovrebbe arrivarti fra un istante."
                      : "Non è partita. Prova a premere «Attiva» di nuovo.",
                  );
                } catch {
                  setProva("Non è partita. Riprova fra poco.");
                }
                setInCorso(false);
              }}
              className="rounded-full border-2 border-navy/20 px-3.5 py-2 font-display text-xs font-bold text-navy disabled:opacity-50"
            >
              {inCorso ? "Invio…" : "Mandami una prova"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
