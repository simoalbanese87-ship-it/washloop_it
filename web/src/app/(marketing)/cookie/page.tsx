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

      <LegalSection n="2" title="Cookie che utilizziamo">
        <p>Attualmente WashLoop utilizza <strong>esclusivamente cookie tecnici/necessari</strong>, indispensabili al funzionamento del servizio. Per questi cookie non è richiesto il consenso preventivo (art. 122 Codice Privacy).</p>
        <ul className="list-disc space-y-1.5 pl-5">
          <li><strong>Autenticazione (Supabase)</strong> — mantengono la sessione di accesso all'area personale. Senza, non potresti restare loggato.</li>
          <li><strong>Preferenza cookie</strong> (<code>wl_cookie_consent</code>) — ricorda che hai visto questa informativa, per non rimostrarla.</li>
          <li><strong>Sicurezza pagamenti (Stripe)</strong> — utilizzati nelle pagine di pagamento per la prevenzione delle frodi e il corretto funzionamento del checkout.</li>
        </ul>
        <p>Non utilizziamo cookie di profilazione, pubblicitari o di analytics di terze parti. Qualora in futuro ne introducessimo, aggiorneremo questa policy e richiederemo il consenso tramite banner.</p>
      </LegalSection>

      <LegalSection n="3" title="Come gestire i cookie">
        <p>Puoi cancellare o bloccare i cookie dalle impostazioni del tuo browser. Disabilitando i cookie tecnici, però, alcune funzioni del sito (come l'accesso all'area personale) potrebbero non funzionare correttamente.</p>
      </LegalSection>

      <LegalSection n="4" title="Riferimenti">
        <p>Per il trattamento dei dati personali consulta l'<Link href="/privacy" className="text-blue hover:underline">Informativa Privacy</Link>.</p>
      </LegalSection>
    </LegalShell>
  );
}
