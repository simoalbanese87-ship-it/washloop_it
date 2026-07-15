import { redirect } from "next/navigation";
import { AppShell, type NavItem } from "@/components/app/AppShell";
import { getCurrentProfile } from "@/lib/auth";
import { roleHome } from "@/lib/orders";

const adminNav: NavItem[] = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/ordini", label: "Ordini" },
  { href: "/admin/novita", label: "Novità" },
  { href: "/admin/archivio", label: "Archivio" },
  { href: "/admin/abbonati", label: "Abbonati" },
  { href: "/admin/lista-attesa", label: "Lista d'attesa" },
  { href: "/admin/catalogo", label: "Catalogo" },
  { href: "/admin/team", label: "Team" },
  { href: "/admin/email", label: "Email" },
  { href: "/admin/crescita", label: "Crescita" },
  { href: "/admin/sicurezza", label: "Sicurezza" },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login?next=/admin");
  // Solo admin: il partner (lavanderia) ha il portale dedicato /laundry e l'area
  // ops espone dati cliente completi → niente accesso partner qui.
  if (profile.role !== "admin") redirect(roleHome(profile.role));

  return (
    <AppShell nav={adminNav} userName={profile.full_name ?? "Ops"} badge="Ops">
      {children}
    </AppShell>
  );
}
