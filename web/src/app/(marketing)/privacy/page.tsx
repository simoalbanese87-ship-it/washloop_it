import type { Metadata } from "next";
import Link from "next/link";
import { LegalShell, LegalSection } from "@/components/marketing/LegalShell";
import { LEGAL } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Informativa Privacy",
  description: "Come WashLoop tratta i dati personali ai sensi del GDPR (Reg. UE 2016/679).",
};

export default function PrivacyPage() {
  return (
    <LegalShell
      title="Informativa sulla Privacy"
      intro={`La presente informativa descrive come ${LEGAL.company} ("WashLoop", "noi") tratta i dati personali degli utenti del servizio di lavanderia a domicilio, ai sensi del Regolamento (UE) 2016/679 ("GDPR") e del D.lgs. 196/2003.`}
    >
      <LegalSection n="1" title="Titolare del trattamento">
        <p>
          Titolare del trattamento è <strong>{LEGAL.company}</strong>, con sede legale in {LEGAL.address}, P.IVA {LEGAL.vat}.
          Per ogni questione relativa ai dati personali puoi scrivere a{" "}
          <a href={`mailto:${LEGAL.privacyEmail}`} className="text-blue hover:underline">{LEGAL.privacyEmail}</a> (PEC: {LEGAL.pec}).
        </p>
      </LegalSection>

      <LegalSection n="2" title="Quali dati raccogliamo">
        <ul className="list-disc space-y-1.5 pl-5">
          <li><strong>Dati identificativi e di contatto</strong>: nome, cognome, email, numero di telefono.</li>
          <li><strong>Dati di consegna</strong>: indirizzo di ritiro e riconsegna, eventuali note di accesso (citofono, piano).</li>
          <li><strong>Dati dell'ordine</strong>: numero di sacchi, servizio scelto, profumo, capi speciali, stato della lavorazione.</li>
          <li><strong>Dati di pagamento</strong>: gestiti dal nostro fornitore Stripe. Non conserviamo i dati completi della carta sui nostri sistemi; trattiamo solo riferimenti (es. ultime cifre, token, stato dell'abbonamento).</li>
          <li><strong>Dati account e tecnici</strong>: credenziali di accesso, log e identificatori di sessione necessari al funzionamento.</li>
        </ul>
      </LegalSection>

      <LegalSection n="3" title="Finalità e basi giuridiche">
        <ul className="list-disc space-y-1.5 pl-5">
          <li><strong>Erogazione del servizio</strong> (ritiro, lavaggio, riconsegna, gestione abbonamento): esecuzione del contratto (art. 6.1.b GDPR).</li>
          <li><strong>Pagamenti e fatturazione</strong>: esecuzione del contratto e obblighi legali/fiscali (art. 6.1.b e 6.1.c).</li>
          <li><strong>Comunicazioni transazionali</strong> (email di conferma e aggiornamenti sull'ordine): esecuzione del contratto.</li>
          <li><strong>Sicurezza e prevenzione frodi</strong>: legittimo interesse (art. 6.1.f).</li>
          <li><strong>Adempimenti contabili e fiscali</strong>: obbligo legale (art. 6.1.c).</li>
        </ul>
      </LegalSection>

      <LegalSection n="4" title="Fornitori e responsabili del trattamento">
        <p>Per erogare il servizio ci avvaliamo di fornitori che trattano dati per nostro conto, nominati responsabili ex art. 28 GDPR:</p>
        <ul className="list-disc space-y-1.5 pl-5">
          <li><strong>Supabase</strong> — database e autenticazione (hosting dati).</li>
          <li><strong>Vercel</strong> — hosting dell'applicazione web.</li>
          <li><strong>Stripe</strong> — elaborazione dei pagamenti e gestione abbonamenti.</li>
          <li><strong>Brevo (Sendinblue)</strong> — invio delle email transazionali.</li>
          <li><strong>Lavanderie partner e corrieri</strong> — esecuzione materiale del servizio. Le lavanderie partner trattano i dati in forma minimizzata: vedono un <strong>codice cliente anonimo</strong> e i soli dati operativi necessari (sacchi, servizio, profumo, zona), mai nome, indirizzo o recapiti.</li>
        </ul>
        <p>Alcuni fornitori possono trattare dati al di fuori dello SEE: in tal caso il trasferimento avviene con garanzie adeguate (es. Clausole Contrattuali Standard UE).</p>
      </LegalSection>

      <LegalSection n="5" title="Conservazione dei dati">
        <p>
          Conserviamo i dati per la durata del rapporto contrattuale e, successivamente, per il tempo necessario ad adempiere
          agli obblighi di legge (es. documenti contabili e fiscali: 10 anni). I dati non più necessari sono cancellati o anonimizzati.
        </p>
      </LegalSection>

      <LegalSection n="6" title="I tuoi diritti">
        <p>In qualità di interessato hai diritto di: accesso, rettifica, cancellazione, limitazione, portabilità, opposizione al trattamento e revoca del consenso (ove applicabile). Puoi esercitarli scrivendo a <a href={`mailto:${LEGAL.privacyEmail}`} className="text-blue hover:underline">{LEGAL.privacyEmail}</a>.</p>
        <p>Hai inoltre diritto di proporre reclamo al <strong>Garante per la protezione dei dati personali</strong> (www.garanteprivacy.it).</p>
      </LegalSection>

      <LegalSection n="7" title="Cookie">
        <p>Per i cookie e le tecnologie simili utilizzate dal sito consulta la <Link href="/cookie" className="text-blue hover:underline">Cookie Policy</Link>.</p>
      </LegalSection>
    </LegalShell>
  );
}
