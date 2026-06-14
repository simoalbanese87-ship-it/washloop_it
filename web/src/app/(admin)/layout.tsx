import { redirect } from "next/navigation";
import { AppShell, type NavItem } from "@/components/app/AppShell";
import { getCurrentProfile } from "@/lib/auth";

const adminNav: NavItem[] = [
  { href: "/admin", label: "Ordini" },
  { href: "/admin/archivio", label: "Archivio" },
  { href: "/admin/abbonati", label: "Abbonati" },
  { href: "/admin/catalogo", label: "Catalogo" },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login?next=/admin");
  if (profile.role !== "admin" && profile.role !== "partner") redirect("/app");

  return (
    <AppShell nav={adminNav} userName={profile.full_name ?? "Ops"} badge={profile.role === "partner" ? "Partner" : "Ops"}>
      {children}
    </AppShell>
  );
}
