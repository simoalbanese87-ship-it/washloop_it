import { redirect } from "next/navigation";
import { OnboardingWizard, type WizPlan } from "@/components/OnboardingWizard";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { roleHome } from "@/lib/orders";
import { invitoCorrente } from "@/lib/invito-corrente";

/** Fuori dall'indice, e non è una svista.
 *
 *  È linkata da ogni pagina di marketing come richiamo all'azione, quindi
 *  Google la trova sempre — ma non ha un titolo suo: eredita quello del layout,
 *  cioè lo stesso identico title e la stessa description della home. Due pagine
 *  gemelle che si contendono le stesse parole fanno perdere entrambe.
 *
 *  `follow: true` perché i link che contiene restano buoni, e niente `Disallow`
 *  in robots.txt: un `noindex` si può leggere solo se il crawler può aprire la
 *  pagina. */
export const metadata = {
  robots: { index: false, follow: true },
};

export default async function OnboardingPage({ searchParams }: { searchParams: Promise<{ plan?: string; ref?: string }> }) {
  // Chi è già loggato salta l'onboarding e va alla home del proprio ruolo.
  // (Mai mandare al login: un admin/partner in sessione che apre /onboarding
  //  finirebbe sul login — era la causa del "non funziona su Firefox".)
  const profile = await getCurrentProfile();
  if (profile) redirect(roleHome(profile.role));

  const [{ plan, ref }, supabase] = await Promise.all([searchParams, createClient()]);
  const { data: plans } = await supabase
    .from("plans")
    .select("id, code, name, price_month_cents, pickups_per_week, turnaround_hours, servizio")
    .eq("active", true)
    .order("sort")
    .returns<WizPlan[]>();

  // `?ref=` arriva dalla pagina di invito. Se manca, il codice lo ritrova
  // comunque il cookie messo da `proxy.ts`: chi apre un invito, gira per il
  // sito e si iscrive mezz'ora dopo non perde il suo amico.
  const invito = await invitoCorrente(ref ?? null);

  return (
    <OnboardingWizard
      plans={plans ?? []}
      initialPlanCode={plan ?? null}
      codiceInvito={invito?.codice ?? null}
      invitanteNome={invito?.nome ?? null}
    />
  );
}
