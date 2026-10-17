import { redirect } from "next/navigation";
import { AppShell, type NavItem } from "@/components/app/AppShell";
import { NotificationPrompt } from "@/components/app/NotificationPrompt";
import { getCurrentProfile } from "@/lib/auth";
import { roleHome } from "@/lib/orders";

const courierNav: NavItem[] = [
  { href: "/courier", label: "Oggi" },
  // «Oggi» risponde a «qual è la prossima porta», Planning a «come mi organizzo
  // la settimana»: due domande diverse, e la seconda non aveva una pagina.
  { href: "/courier/planning", label: "Planning" },
  { href: "/courier/storico", label: "Storico" },
];

export default async function CourierLayout({ children }: { children: React.ReactNode }) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login?next=/courier");
  if (profile.role !== "courier") redirect(roleHome(profile.role));

  return (
    <AppShell nav={courierNav} userName={profile.full_name ?? "Corriere"} badge="Corriere">
      {children}
      {/* L'invito alle notifiche non era mai arrivato qui dentro: viveva solo
          nell'app del cliente e nel portale della lavanderia. Meryl ha
          installato la webapp e non le è stato chiesto niente — e il rider è
          proprio quello che, senza avviso, non sa di avere un giro. */}
      <NotificationPrompt
        subtitle="Ti avvisiamo quando ti assegnano una fermata o c'è materiale da portare."
        sopraLaBarra={false}
      />
    </AppShell>
  );
}
