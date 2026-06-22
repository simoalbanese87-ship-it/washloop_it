import { redirect } from "next/navigation";
import { AppShell, type NavItem } from "@/components/app/AppShell";
import { getCurrentProfile } from "@/lib/auth";
import { roleHome } from "@/lib/orders";
import { InstallBanner } from "@/components/app/InstallBanner";
import { NotificationPrompt } from "@/components/app/NotificationPrompt";

const partnerNav: NavItem[] = [
  { href: "/laundry", label: "Lavorazioni" },
  { href: "/laundry/listino", label: "Listino" },
];

export default async function PartnerLayout({ children }: { children: React.ReactNode }) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login?next=/laundry");
  if (profile.role !== "partner") redirect(roleHome(profile.role));

  return (
    <AppShell nav={partnerNav} userName={profile.full_name ?? "Lavanderia"} badge="Lavanderia">
      <InstallBanner />
      {children}
      <NotificationPrompt subtitle="Ti avvisiamo dei nuovi ordini in arrivo." />
    </AppShell>
  );
}
