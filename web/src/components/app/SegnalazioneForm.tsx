"use client";

import { useActionState, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { addIssue } from "@/lib/actions/partner";
import { Button } from "@/components/ui/Button";
import {
  RITARDI_PROPONIBILI,
  SEGNALAZIONE_AIUTO,
  SEGNALAZIONE_LABEL,
  TIPI_SEGNALAZIONE,
  avvisaSubitoIlCliente,
  fotoObbligatoria,
  type TipoSegnalazione,
} from "@/lib/segnalazioni";

type Stato = { error?: string; ok?: string } | null;

/** Modulo con cui la lavanderia segnala un capo.
 *
 *  Il tipo si sceglie per primo e non ha un valore predefinito: è il campo che
 *  decide chi viene avvisato e quando, e un default lo farebbe scegliere al
 *  caso. Sotto ogni opzione c'è scritto cosa comporta — «il cliente lo riceve
 *  subito» oppure «lo gestisce WashLoop» — perché chi scrive deve saperlo
 *  prima di premere, non dopo. */
export function SegnalazioneForm({ orderId }: { orderId: string }) {
  const [tipo, setTipo] = useState<TipoSegnalazione | "">("");
  const [ritardo, setRitardo] = useState(0);
  const [photoPath, setPhotoPath] = useState("");
  const [photoNome, setPhotoNome] = useState("");
  const [caricando, setCaricando] = useState(false);
  const [erroreFoto, setErroreFoto] = useState("");
  const formRef = useRef<HTMLFormElement | null>(null);

  const [stato, formAction, inCorso] = useActionState<Stato, FormData>(
    async (prev, fd) => {
      const res = await addIssue(prev, fd);
      if (res?.ok) {
        formRef.current?.reset();
        setTipo("");
        setRitardo(0);
        setPhotoPath("");
        setPhotoNome("");
      }
      return res;
    },
    null,
  );

  async function caricaFoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setCaricando(true);
    setErroreFoto("");
    const supabase = createClient();
    // Prima cartella = id dell'ordine: è la chiave con cui il bucket decide chi
    // può rileggere la foto. Stessa convenzione delle prove di consegna.
    const path = `${orderId}/segnalazione-${Date.now()}-${file.name.replace(/[^\w.-]/g, "_")}`;
    const { error } = await supabase.storage.from("proofs").upload(path, file, { upsert: true });
    if (error) setErroreFoto("Foto non caricata. Riprova, o manda la segnalazione senza.");
    else { setPhotoPath(path); setPhotoNome(file.name); }
    setCaricando(false);
  }

  const serveFoto = tipo ? fotoObbligatoria(tipo) : false;

  return (
    <form ref={formRef} action={formAction} className="space-y-4">
      <input type="hidden" name="order_id" value={orderId} />
      <input type="hidden" name="photo_url" value={photoPath} />

      <fieldset className="space-y-2">
        <legend className="font-display text-sm font-extrabold text-navy">Di che cosa si tratta?</legend>
        {TIPI_SEGNALAZIONE.map((t) => (
          <label
            key={t}
            className={`flex cursor-pointer gap-3 rounded-[14px] border-2 p-3 transition-colors ${
              tipo === t ? "border-blue bg-blue/[0.05]" : "border-line bg-white hover:border-navy/25"
            }`}
          >
            <input
              type="radio"
              name="kind"
              value={t}
              checked={tipo === t}
              onChange={() => setTipo(t)}
              className="mt-1 h-4 w-4 flex-none accent-[#2b7fd4]"
            />
            <span className="min-w-0">
              <span className="block font-display text-sm font-extrabold text-navy">{SEGNALAZIONE_LABEL[t]}</span>
              <span className="mt-0.5 block text-xs font-medium text-muted">{SEGNALAZIONE_AIUTO[t]}</span>
              <span className={`mt-1 block text-xs font-bold ${avvisaSubitoIlCliente(t) ? "text-[#1F8A5B]" : "text-[#C9881F]"}`}>
                {avvisaSubitoIlCliente(t)
                  ? "Il cliente viene avvisato subito."
                  : "Va solo a WashLoop: al cliente ci pensiamo noi."}
              </span>
            </span>
          </label>
        ))}
      </fieldset>

      <label className="block">
        <span className="font-display text-sm font-extrabold text-navy">Quale capo</span>
        <input
          name="capo"
          maxLength={80}
          placeholder="es. camicia bianca uomo"
          className="mt-1 w-full rounded-[12px] border border-line bg-white px-3.5 py-2.5 text-sm font-medium text-navy outline-none focus:border-blue"
        />
      </label>

      <label className="block">
        <span className="font-display text-sm font-extrabold text-navy">Cosa avete trovato</span>
        <textarea
          name="testo"
          required
          rows={3}
          maxLength={600}
          placeholder="es. macchia di unto sul davanti, provata a smacchiare due volte, resta un alone"
          className="mt-1 w-full rounded-[12px] border border-line bg-white px-3.5 py-2.5 text-sm font-medium text-navy outline-none focus:border-blue"
        />
        <span className="mt-1 block text-xs font-medium text-muted">
          Il cliente legge queste parole esattamente come le scrivete.
        </span>
      </label>

      <div>
        <span className="font-display text-sm font-extrabold text-navy">
          Foto {serveFoto ? <span className="text-[#C0392B]">(obbligatoria)</span> : <span className="text-muted">(consigliata)</span>}
        </span>
        <p className="mt-0.5 text-xs font-medium text-muted">
          Fra un mese, se qualcuno contesta, la foto è l&apos;unica cosa che resta.
        </p>
        <input
          type="file"
          accept="image/*"
          capture="environment"
          onChange={caricaFoto}
          className="mt-2 block w-full text-sm font-medium text-muted file:mr-3 file:rounded-full file:border-0 file:bg-ice file:px-4 file:py-2 file:font-display file:text-sm file:font-bold file:text-navy"
        />
        {caricando && <p className="mt-1 text-xs font-bold text-muted">Carico la foto…</p>}
        {photoNome && !caricando && <p className="mt-1 text-xs font-bold text-[#1F8A5B]">Foto allegata: {photoNome} ✓</p>}
        {erroreFoto && <p className="mt-1 text-xs font-bold text-[#C0392B]">{erroreFoto}</p>}
      </div>

      {/* Il tempo in più. Non un selettore di data: tre bottoni, perché chi
          compila ha il capo in una mano e il telefono nell'altra. E si parte da
          adesso, non dalla scadenza dell'ordine — «mi servono due giorni» vuol
          dire due giorni da ora. */}
      <div>
        <span className="font-display text-sm font-extrabold text-navy">Vi serve più tempo per questo capo?</span>
        <p className="mt-0.5 text-xs font-medium text-muted">
          Se lo dite, alla riconsegna ci pensiamo noi: se la data promessa non regge la spostiamo e avvisiamo
          il cliente. Non dovete chiamare nessuno.
        </p>
        <input type="hidden" name="ritardo_giorni" value={ritardo} />
        <div className="mt-2 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setRitardo(0)}
            className={`rounded-full border-2 px-4 py-2 font-display text-sm font-extrabold transition-colors ${
              ritardo === 0 ? "border-blue bg-blue/[0.06] text-navy" : "border-line text-navy/60 hover:border-navy/25"
            }`}
          >
            No, nei tempi
          </button>
          {RITARDI_PROPONIBILI.map((g) => (
            <button
              key={g}
              type="button"
              onClick={() => setRitardo(g)}
              className={`rounded-full border-2 px-4 py-2 font-display text-sm font-extrabold transition-colors ${
                ritardo === g ? "border-blue bg-blue/[0.06] text-navy" : "border-line text-navy/60 hover:border-navy/25"
              }`}
            >
              +{g} {g === 1 ? "giorno" : "giorni"}
            </button>
          ))}
        </div>
        {ritardo > 0 && (
          <p className="mt-2 rounded-[12px] bg-[#C9881F]/10 px-3 py-2 text-xs font-semibold text-[#C9881F]">
            Se {ritardo === 1 ? "il giorno in più" : `i ${ritardo} giorni in più`} superano la consegna già
            fissata, la spostiamo alla prima data utile e lo diciamo al cliente insieme a questa segnalazione.
            Se invece ci sta dentro, non cambia niente per lui.
          </p>
        )}
      </div>

      {stato?.error && (
        <p className="rounded-[12px] bg-[#C0392B]/10 px-3.5 py-2.5 text-sm font-semibold text-[#C0392B]">{stato.error}</p>
      )}
      {stato?.ok && (
        <p className="rounded-[12px] bg-[#1F8A5B]/10 px-3.5 py-2.5 text-sm font-semibold text-[#1F8A5B]">{stato.ok}</p>
      )}

      <Button type="submit" className="w-full" disabled={inCorso || caricando || !tipo}>
        {inCorso ? "Invio…" : "Invia la segnalazione"}
      </Button>
    </form>
  );
}
