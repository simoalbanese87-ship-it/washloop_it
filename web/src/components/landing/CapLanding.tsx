"use client";

import { VerificaCap } from "@/components/lead/VerificaCap";
import { useLead } from "./LeadContext";

/** Il controllo CAP della landing: lo stesso delle altre pagine, più il ponte
 *  verso il modulo lungo qui sotto.
 *
 *  Sostituisce `CapHeroForm`, che scriveva il CAP nel contesto e poi faceva
 *  scorrere la pagina fino al modulo — dove ricompariva «Verifica
 *  disponibilità» su un secondo bottone. Ora la risposta arriva subito in una
 *  finestra; il CAP finisce nel contesto lo stesso, così chi chiude la finestra
 *  e scorre trova il campo già pieno. */
export function CapLanding() {
  const { setCap } = useLead();
  return (
    <div className="mt-9">
      <VerificaCap onVerificato={setCap} />
    </div>
  );
}
