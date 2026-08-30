import { redirect } from "next/navigation";
import { AppShell, type NavItem } from "@/components/app/AppShell";
import { getCurrentProfile } from "@/lib/auth";
import { roleHome } from "@/lib/orders";

/** Sei voci al posto di quattordici.
 *
 *  La barra è orizzontale e condivisa con le altre aree, quindi dei gruppi con
 *  intestazione non ci starebbero: le voci di configurazione, che si aprono una
 *  volta al mese, sono raccolte in /admin/impostazioni. Nessun indirizzo è
 *  cambiato — Catalogo, Team, Email, Crescita e Sicurezza rispondono dove
 *  rispondevano, e le pagine assorbite (Novità, Lista d'attesa, Disponibilità,
 *  Archivio) reindirizzano alla lista giusta. */
const adminNav: NavItem[] = [
  { href: "/admin", label: "Home" },
  { href: "/admin/persone", label: "Persone" },
  { href: "/admin/ordini", label: "Ordini" },
  { href: "/admin/calendario", label: "Calendario" },
  { href: "/admin/incassi", label: "Incassi" },
  { href: "/admin/impostazioni", label: "Impostazioni" },
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
