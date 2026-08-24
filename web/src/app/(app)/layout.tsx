import { redirect } from "next/navigation";
import { MobileShell } from "@/components/app/MobileShell";
import { ChiediAWashLoop } from "@/components/marketing/ChiediAWashLoop";
import { getCurrentProfile } from "@/lib/auth";
import { isImpersonating } from "@/lib/actions/impersonate";
import { roleHome } from "@/lib/orders";
import { createClient } from "@/lib/supabase/server";
import { linkPagamento } from "@/lib/dunning-piano";

/** Gli stati in cui c'è una fattura rimasta aperta. `unpaid` arriva dopo che
 *  Stripe ha esaurito i suoi tentativi: è più grave di `past_due`, e il banner
 *  lo dice con parole diverse. */
const IN_SOFFERENZA = ["past_due", "unpaid"];

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login?next=/app");
  // Staff/admin hanno una loro area
  if (profile.role !== "customer") redirect(roleHome(profile.role));

  const supabase = await createClient();
  // Lo stato del pagamento si legge qui, una volta sola per tutta l'area: il
  // banner deve comparire su ogni schermata, non solo su quella in cui a
  // qualcuno è venuto in mente di controllare.
  const [impersonating, { data: sub }, { count: quantiIndirizzi }] = await Promise.all([
    isImpersonating(),
    supabase
      .from("subscriptions")
      .select("status, last_failed_invoice_url")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle<{ status: string; last_failed_invoice_url: string | null }>(),
    supabase.from("addresses").select("id", { count: "exact", head: true }),
  ]);

  const pagamento = sub && IN_SOFFERENZA.includes(sub.status)
    ? { payUrl: linkPagamento(sub.last_failed_invoice_url), grave: sub.status === "unpaid" }
    : undefined;

  return (
    <MobileShell
      userName={profile.full_name ?? "Il mio account"}
      impersonating={impersonating}
      pagamento={pagamento}
      prenotaHref={(quantiIndirizzi ?? 0) === 0 ? "/app/indirizzi" : "/app/prenota"}
    >
      {children}
      {/* Alzato: nell'app la barra di navigazione sta in basso. */}
      <ChiediAWashLoop offsetBasso />
    </MobileShell>
  );
}
