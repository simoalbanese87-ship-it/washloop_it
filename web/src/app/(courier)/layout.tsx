import { redirect } from "next/navigation";
import { AppShell, type NavItem } from "@/components/app/AppShell";
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
    </AppShell>
  );
}
