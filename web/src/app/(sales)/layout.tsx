import { redirect } from "next/navigation";
import { AppShell, type NavItem } from "@/components/app/AppShell";
import { getCurrentProfile } from "@/lib/auth";
import { roleHome } from "@/lib/orders";

const salesNav: NavItem[] = [{ href: "/sales", label: "Lead" }];

export default async function SalesLayout({ children }: { children: React.ReactNode }) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login?next=/sales");
  // Accesso al team commerciale (sales) e all'admin (che può visionare).
  if (profile.role !== "sales" && profile.role !== "admin") redirect(roleHome(profile.role));

  return (
    <AppShell nav={salesNav} userName={profile.full_name ?? "Sales"} badge="Sales">
      {children}
    </AppShell>
  );
}
