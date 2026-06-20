import type { Metadata } from "next";
import Link from "next/link";
import { LegalShell, LegalSection } from "@/components/marketing/LegalShell";
import { LEGAL } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Condizioni di Vendita",
  description: "Termini e condizioni del servizio WashLoop di lavanderia a domicilio in abbonamento.",
};

export default function TerminiPage() {
  return (
    <LegalShell
      title="Condizioni Generali di Vendita"
      intro={`Le presenti condizioni regolano il rapporto tra ${LEGAL.company} ("WashLoop") e l'utente ("Cliente") per il servizio di lavanderia a domicilio in abbonamento. Effettuando la registrazione e sottoscrivendo un abbonamento, il Cliente accetta integralmente le presenti condizioni.`}
    >
      <LegalSection n="1" title="Oggetto del servizio">
        <p>WashLoop offre un servizio di ritiro a domicilio, lavaggio, stiratura e riconsegna di capi e biancheria, erogato su base di abbonamento con ritiri programmati. Il servizio è disponibile nelle zone di copertura indicate sul sito.</p>
      </LegalSection>

      <LegalSection n="2" title="Fornitore">
        <p>Il servizio è fornito da <strong>{LEGAL.company}</strong>, sede legale in {LEGAL.address}, P.IVA {LEGAL.vat}, email <a href={`mailto:${LEGAL.email}`} className="text-blue hover:underline">{LEGAL.email}</a>.</p>
      </LegalSection>

      <LegalSection n="3" title="Abbonamenti e prezzi">
        <ul className="list-disc space-y-1.5 pl-5">
          <li>Sono disponibili i piani <strong>Small, Medium e Large</strong>, che si differenziano per il numero di sacchi inclusi a settimana. Prezzi e contenuti aggiornati sono indicati nella pagina prezzi del sito.</li>
          <li>L'abbonamento è <strong>mensile a rinnovo automatico</strong>: salvo disdetta, si rinnova e viene addebitato automaticamente alla scadenza di ogni periodo.</li>
          <li>I prezzi sono comprensivi di IVA ove applicabile.</li>
          <li>La prenotazione dei ritiri richiede un abbonamento attivo.</li>
        </ul>
      </LegalSection>

      <LegalSection n="4" title="Capi speciali fuori abbonamento">
        <p>Alcuni capi (es. piumini, pelle, capispalla, calzature) non sono inclusi nel sacco standard e sono soggetti a un <strong>addebito aggiuntivo</strong> secondo il listino capi speciali. Tali capi, individuati al momento della lavorazione, vengono addebitati automaticamente sul metodo di pagamento associato all'account. Il listino è consultabile e i prezzi applicati sono quelli vigenti al momento della lavorazione.</p>
      </LegalSection>

      <LegalSection n="5" title="Ritiri e riconsegne">
        <ul className="list-disc space-y-1.5 pl-5">
          <li>I ritiri e le consegne avvengono negli <strong>slot orari resi disponibili da WashLoop</strong> e selezionati dal Cliente in fase di prenotazione.</li>
          <li>Il Cliente è tenuto a rendere disponibile il bucato all'orario concordato e a garantire l'accesso per il ritiro/consegna.</li>
          <li>I tempi di riconsegna ("pronto entro") sono indicativi e dipendono dal piano e dal carico di lavoro.</li>
        </ul>
      </LegalSection>

      <LegalSection n="6" title="Pagamenti">
        <p>I pagamenti sono elaborati in modo sicuro tramite <strong>Stripe</strong>. Sottoscrivendo l'abbonamento, il Cliente autorizza WashLoop ad addebitare il canone periodico e gli eventuali importi per capi speciali sul metodo di pagamento registrato. In caso di mancato pagamento, il servizio può essere sospeso.</p>
      </LegalSection>

      <LegalSection n="7" title="Disdetta e diritto di recesso">
        <ul className="list-disc space-y-1.5 pl-5">
          <li>Il Cliente può <strong>disdire l'abbonamento in qualsiasi momento</strong> dall'area personale; la disdetta ha effetto al termine del periodo già pagato.</li>
          <li>Ai sensi del Codice del Consumo (D.lgs. 206/2005), il consumatore ha diritto di recesso entro 14 giorni dalla sottoscrizione. Richiedendo l'esecuzione del servizio durante tale periodo, il Cliente riconosce che il diritto di recesso non si applica alle prestazioni già integralmente eseguite.</li>
        </ul>
      </LegalSection>

      <LegalSection n="8" title="Responsabilità sui capi">
        <ul className="list-disc space-y-1.5 pl-5">
          <li>WashLoop tratta i capi secondo le etichette di manutenzione e la migliore diligenza professionale.</li>
          <li>Il Cliente è tenuto a segnalare capi delicati, macchie particolari o oggetti dimenticati nelle tasche. WashLoop non risponde di oggetti lasciati nei capi.</li>
          <li>Eventuali contestazioni vanno comunicate tempestivamente a <a href={`mailto:${LEGAL.email}`} className="text-blue hover:underline">{LEGAL.email}</a>. Gli eventuali rimborsi sono limitati nei termini di legge.</li>
        </ul>
      </LegalSection>

      <LegalSection n="9" title="Trattamento dei dati">
        <p>Il trattamento dei dati personali è descritto nell'<Link href="/privacy" className="text-blue hover:underline">Informativa Privacy</Link>.</p>
      </LegalSection>

      <LegalSection n="10" title="Legge applicabile e foro competente">
        <p>Le presenti condizioni sono regolate dalla legge italiana. Per i rapporti con i consumatori è competente il foro del luogo di residenza o domicilio del consumatore; negli altri casi il foro di {LEGAL.city}.</p>
      </LegalSection>
    </LegalShell>
  );
}
