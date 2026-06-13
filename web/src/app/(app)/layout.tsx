import { redirect } from "next/navigation";
import { AppShell, type NavItem } from "@/components/app/AppShell";
import { getCurrentProfile } from "@/lib/auth";
import { roleHome } from "@/lib/orders";

const customerNav: NavItem[] = [
  { href: "/app", label: "Dashboard" },
  { href: "/app/prenota", label: "Prenota ritiro" },
  { href: "/app/indirizzi", label: "Indirizzi" },
  { href: "/app/abbonamento", label: "Abbonamento" },
];

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login?next=/app");
  // Staff/admin hanno una loro area
  if (profile.role !== "customer") redirect(roleHome(profile.role));

  return (
    <AppShell nav={customerNav} userName={profile.full_name ?? "Il mio account"}>
      {children}
    </AppShell>
  );
}
