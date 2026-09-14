"use client";

import { useState } from "react";
import { annullaCapoSpeciale } from "@/lib/actions/charge";
import { BottoneInvio } from "@/components/ui/BottoneInvio";

/** Toglie un addebito che la lavanderia ha segnato, chiedendo perché.
 *
 *  Il motivo non è un campo di cortesia. Quando un cliente contesta un importo,
 *  la domanda che arriva mesi dopo è «perché su questo ritiro non avete
 *  addebitato la camicia?», e senza una riga scritta l'unica risposta possibile
 *  è «non me lo ricordo». Per questo il bottone di conferma resta spento finché
 *  non c'è scritto qualcosa: costringere a scriverlo ora costa cinque secondi,
 *  ricostruirlo dopo non si può.
 *
 *  I motivi pronti coprono i due casi veri — il cliente reclama, oppure la
 *  lavanderia ha contato male — e restano modificabili: sono un punto di
 *  partenza, non un elenco chiuso. */
const MOTIVI = [
  "Claim del cliente: capo non suo o non trovato",
  "Errore della lavanderia: capo già compreso nel sacco",
  "Errore della lavanderia: quantità sbagliata",
];

export function AnnullaAddebito({ specialId, tornaA }: { specialId: string; tornaA: string }) {
  const [aperto, setAperto] = useState(false);
  const [motivo, setMotivo] = useState("");
  // Chi si prende il costo. Di base no: il caso più frequente è l'errore della
  // lavanderia, dove il capo non è stato lavorato o è stato lavorato male.
  const [regalato, setRegalato] = useState(false);

  if (!aperto) {
    return (
      <button
        type="button"
        onClick={() => setAperto(true)}
        className="font-display text-xs font-bold text-[#C0392B] hover:underline"
      >
        Annulla
      </button>
    );
  }

  return (
    <form action={annullaCapoSpeciale} className="w-full space-y-2 rounded-[12px] border border-[#C0392B]/30 bg-white p-3">
      <input type="hidden" name="special_id" value={specialId} />
      <input type="hidden" name="torna_a" value={tornaA} />
      <p className="text-xs font-semibold text-navy">
        Perché lo annulli? Resta scritto sulla scheda: serve se il cliente lo contesta.
      </p>
      <div className="flex flex-wrap gap-1.5">
        {MOTIVI.map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMotivo(m)}
            className={`rounded-full border px-2.5 py-1 text-[11px] font-bold ${
              motivo === m ? "border-navy bg-navy text-white" : "border-line bg-ice text-navy/70 hover:border-navy/40"
            }`}
          >
            {m}
          </button>
        ))}
      </div>
      <input
        name="motivo"
        value={motivo}
        onChange={(e) => setMotivo(e.target.value)}
        placeholder="…o scrivilo tu"
        className="h-10 w-full rounded-[10px] border border-line bg-ice px-3 text-sm font-medium text-navy outline-none focus:border-blue"
      />

      {/* La domanda che mancava: chi paga il lavoro già fatto.
          Togliendo un capo al cliente il compenso alla lavanderia veniva
          sempre azzerato. Giusto quando hanno sbagliato loro; sbagliato quando
          il capo l'hanno lavato e siamo noi a non farlo pagare — lì il regalo
          lo facciamo noi, non loro. */}
      <label className="flex items-start gap-2 rounded-[10px] bg-ice px-2.5 py-2 text-[11px] font-semibold text-navy">
        <input
          type="checkbox"
          name="regalato"
          value="1"
          checked={regalato}
          onChange={(e) => setRegalato(e.target.checked)}
          className="mt-0.5 h-4 w-4 accent-[#1F8A5B]"
        />
        <span>
          Il capo è stato lavorato: <strong>paga comunque la lavanderia</strong>.
          <span className="block font-medium text-muted">
            Spunta quando lo offri tu al cliente. Lascia vuoto se la lavanderia ha sbagliato: lì non si paga.
          </span>
        </span>
      </label>
      <div className="flex items-center gap-2">
        <BottoneInvio
          disabled={motivo.trim().length === 0}
          className="rounded-full bg-[#C0392B] px-4 py-1.5 font-display text-xs font-extrabold text-white disabled:opacity-40"
        >
          Annulla l&apos;addebito
        </BottoneInvio>
        <button
          type="button"
          onClick={() => setAperto(false)}
          className="font-display text-xs font-bold text-muted hover:underline"
        >
          Lascia stare
        </button>
      </div>
    </form>
  );
}
