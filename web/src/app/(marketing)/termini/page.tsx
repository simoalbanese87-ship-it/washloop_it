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
      intro={`Le presenti condizioni regolano il contratto a distanza tra ${LEGAL.company} ("WashLoop") e il cliente consumatore ("Cliente") per il servizio di lavanderia a domicilio in abbonamento, ai sensi del Codice del Consumo (D.lgs. 206/2005). Prima di concludere l'ordine il Cliente prende visione e accetta le presenti condizioni; copia del contratto gli viene confermata via email (supporto durevole).`}
    >
      <LegalSection n="1" title="Oggetto del servizio">
        <p>WashLoop offre ritiro a domicilio, lavaggio, stiratura e riconsegna di capi e biancheria, erogato su base di abbonamento con ritiri programmati, nelle zone di copertura indicate sul sito.</p>
      </LegalSection>

      <LegalSection n="2" title="Fornitore">
        <p>Il servizio è fornito da <strong>{LEGAL.company}</strong>, sede legale in {LEGAL.address}, P.IVA {LEGAL.vat}, email <a href={`mailto:${LEGAL.email}`} className="text-blue hover:underline">{LEGAL.email}</a>{LEGAL.pec ? `, PEC ${LEGAL.pec}` : ""}.</p>
      </LegalSection>

      <LegalSection n="3" title="Informazioni precontrattuali">
        <p>Prima dell'ordine il Cliente riceve, in modo chiaro e comprensibile (art. 49 Cod. Consumo): le caratteristiche del servizio, il prezzo totale comprensivo di imposte, la natura ad <strong>abbonamento con addebito ricorrente</strong>, la durata e le condizioni di rinnovo e recesso. Il pulsante di conclusione dell'ordine indica espressamente che l'acquisto comporta un <strong>pagamento ricorrente</strong>.</p>
      </LegalSection>

      <LegalSection n="4" title="Abbonamenti, prezzi e rinnovo automatico">
        <ul className="list-disc space-y-1.5 pl-5">
          <li>Sono disponibili i piani <strong>Small, Medium e Large</strong>, che si differenziano per il numero di sacchi inclusi a settimana. Prezzi e contenuti aggiornati sono nella pagina prezzi.</li>
          <li>L'abbonamento è <strong>mensile a rinnovo automatico</strong>: salvo disdetta, si rinnova e viene addebitato automaticamente alla scadenza di ogni periodo, sul metodo di pagamento registrato.</li>
          <li>I prezzi sono comprensivi di IVA ove applicabile.</li>
          <li>La prenotazione dei ritiri richiede un abbonamento attivo.</li>
        </ul>
      </LegalSection>

      <LegalSection n="5" title="Capi speciali fuori abbonamento">
        <p>Alcuni capi (es. piumini, pelle, capispalla, calzature) non sono inclusi nel sacco standard e sono soggetti a un <strong>addebito aggiuntivo</strong> secondo il listino capi speciali, ai prezzi vigenti al momento della lavorazione. Tali capi, individuati al ricevimento, vengono addebitati automaticamente sul metodo di pagamento associato all'account; il Cliente ne riceve evidenza.</p>
      </LegalSection>

      <LegalSection n="6" title="Ritiri e riconsegne">
        <ul className="list-disc space-y-1.5 pl-5">
          <li>Ritiri e consegne avvengono negli <strong>slot orari resi disponibili da WashLoop</strong> e selezionati dal Cliente in fase di prenotazione.</li>
          <li>Il Cliente rende disponibile il bucato all'orario concordato e garantisce l'accesso per ritiro/consegna.</li>
          <li>I tempi di riconsegna ("pronto entro") sono indicativi e dipendono dal piano e dal carico di lavoro.</li>
        </ul>
      </LegalSection>

      <LegalSection n="7" title="Pagamenti">
        <p>I pagamenti sono elaborati in modo sicuro tramite <strong>Stripe</strong>. Sottoscrivendo l'abbonamento, il Cliente autorizza WashLoop ad addebitare il canone periodico e gli eventuali importi per capi speciali sul metodo di pagamento registrato. In caso di mancato pagamento il servizio può essere sospeso.</p>
      </LegalSection>

      <LegalSection n="8" title="Disdetta e diritto di recesso">
        <ul className="list-disc space-y-1.5 pl-5">
          <li>Il Cliente può <strong>disdire l'abbonamento in qualsiasi momento, online dalla propria area personale</strong>, senza ostacoli né passaggi esterni (art. 54-bis Cod. Consumo). La disdetta ha effetto al termine del periodo già pagato e blocca i rinnovi successivi.</li>
          <li>Il consumatore ha diritto di <strong>recesso entro 14 giorni</strong> dalla conclusione del contratto, senza motivazione (art. 52 Cod. Consumo); WashLoop rimborsa i pagamenti ricevuti entro 14 giorni dalla comunicazione.</li>
          <li>Chiedendo espressamente l'avvio del servizio durante il periodo di recesso, il Cliente riconosce che il diritto di recesso <strong>si estingue una volta che il servizio è stato eseguito</strong> (art. 59 Cod. Consumo). In particolare, <strong>con la presa in carico del primo ritiro del periodo</strong> il servizio del periodo mensile in corso si considera avviato: il relativo canone non è rimborsabile e l'abbonamento prosegue fino al termine del periodo, rinnovandosi poi automaticamente salvo disdetta.</li>
          <li>Ogni richiesta di recesso è confermata da WashLoop su supporto durevole (email).</li>
        </ul>
      </LegalSection>

      <LegalSection n="9" title="Responsabilità sui capi">
        <ul className="list-disc space-y-1.5 pl-5">
          <li>WashLoop tratta i capi secondo le etichette di manutenzione e la migliore diligenza professionale.</li>
          <li>Il Cliente segnala capi delicati, macchie particolari o oggetti nelle tasche. WashLoop non risponde di oggetti lasciati nei capi.</li>
          <li>Le contestazioni vanno comunicate tempestivamente a <a href={`mailto:${LEGAL.email}`} className="text-blue hover:underline">{LEGAL.email}</a>. Gli eventuali rimborsi sono nei limiti di legge.</li>
        </ul>
      </LegalSection>

      <LegalSection n="10" title="Modifiche alle condizioni">
        <p>WashLoop può aggiornare le presenti condizioni; le modifiche sostanziali sono comunicate al Cliente con ragionevole preavviso. Per gli abbonamenti in corso si applicano le condizioni accettate, salvo accettazione delle nuove.</p>
      </LegalSection>

      <LegalSection n="11" title="Trattamento dei dati">
        <p>Il trattamento dei dati personali è descritto nell'<Link href="/privacy" className="text-blue hover:underline">Informativa Privacy</Link>; per i cookie vedi la <Link href="/cookie" className="text-blue hover:underline">Cookie Policy</Link>.</p>
      </LegalSection>

      <LegalSection n="12" title="Legge applicabile, reclami e risoluzione delle controversie">
        <p>Le presenti condizioni sono regolate dalla legge italiana. I reclami possono essere inviati a <a href={`mailto:${LEGAL.email}`} className="text-blue hover:underline">{LEGAL.email}</a>. Il consumatore può ricorrere agli organismi di <strong>risoluzione alternativa delle controversie (ADR)</strong> previsti dal Codice del Consumo (artt. 141 e ss.). Per i rapporti con i consumatori è competente il foro del luogo di residenza o domicilio del consumatore; negli altri casi il foro di {LEGAL.city}.</p>
      </LegalSection>
    </LegalShell>
  );
}
