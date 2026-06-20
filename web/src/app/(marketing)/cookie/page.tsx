import type { Metadata } from "next";
import Link from "next/link";
import { LegalShell, LegalSection } from "@/components/marketing/LegalShell";

export const metadata: Metadata = {
  title: "Cookie Policy",
  description: "Quali cookie utilizza WashLoop e come gestirli.",
};

export default function CookiePage() {
  return (
    <LegalShell
      title="Cookie Policy"
      intro="Questa pagina spiega quali cookie e tecnologie simili utilizziamo sul sito WashLoop e a cosa servono."
    >
      <LegalSection n="1" title="Cosa sono i cookie">
        <p>I cookie sono piccoli file di testo che i siti salvano sul dispositivo dell'utente per far funzionare il sito, ricordarne le preferenze o raccogliere informazioni.</p>
      </LegalSection>

      <LegalSection n="2" title="Cookie tecnici (necessari)">
        <p>Indispensabili al funzionamento del servizio. Per questi non è richiesto il consenso preventivo (art. 122 Codice Privacy).</p>
        <ul className="list-disc space-y-1.5 pl-5">
          <li><strong>Autenticazione (Supabase)</strong> — mantengono la sessione di accesso all'area personale.</li>
          <li><strong>Preferenza cookie</strong> (<code>wl_cookie_consent</code>) — memorizza la tua scelta sui cookie.</li>
          <li><strong>Sicurezza pagamenti (Stripe)</strong> — prevenzione frodi e corretto funzionamento del checkout.</li>
        </ul>
      </LegalSection>

      <LegalSection n="3" title="Cookie di misurazione (previo consenso)">
        <p>Possiamo utilizzare cookie di misurazione/analytics per capire come viene usato il sito e migliorarlo. Sono attivati <strong>solo se scegli "Accetta tutti"</strong> nel banner. Scegliendo "Solo necessari" non vengono installati. Non utilizziamo cookie pubblicitari o di profilazione di terze parti.</p>
      </LegalSection>

      <LegalSection n="4" title="Come gestire o revocare il consenso">
        <p>Puoi modificare la tua scelta in qualsiasi momento dal link <strong>"Preferenze cookie"</strong> nel footer del sito. Puoi inoltre cancellare o bloccare i cookie dalle impostazioni del browser; disabilitando i cookie tecnici alcune funzioni (come l'accesso all'area personale) potrebbero non funzionare.</p>
      </LegalSection>

      <LegalSection n="5" title="Riferimenti">
        <p>Per il trattamento dei dati personali consulta l'<Link href="/privacy" className="text-blue hover:underline">Informativa Privacy</Link>.</p>
      </LegalSection>
    </LegalShell>
  );
}
