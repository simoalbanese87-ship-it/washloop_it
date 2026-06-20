import { redirect } from "next/navigation";
import { MobileShell } from "@/components/app/MobileShell";
import { getCurrentProfile } from "@/lib/auth";
import { roleHome } from "@/lib/orders";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login?next=/app");
  // Staff/admin hanno una loro area
  if (profile.role !== "customer") redirect(roleHome(profile.role));

  return <MobileShell userName={profile.full_name ?? "Il mio account"}>{children}</MobileShell>;
}
