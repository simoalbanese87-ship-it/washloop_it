import { redirect } from "next/navigation";
import { AppShell, type NavItem } from "@/components/app/AppShell";
import { NotificationPrompt } from "@/components/app/NotificationPrompt";
import { getCurrentProfile } from "@/lib/auth";
import { roleHome } from "@/lib/orders";

/** Otto voci, e sotto tre di esse il loro elenco.
 *
 *  Le pagine che si aprono di rado stanno raccolte in /admin/impostazioni, che
 *  resta: è utile per leggere a cosa serve ciascuna. Ma per arrivare a una
 *  pagina che si guarda ogni settimana — il Cantiere SEO — non deve essere
 *  l'unica strada: la voce della barra apre il suo elenco al passaggio del
 *  mouse, e da lì si va dritti.
 *
 *  Il sottomenu ce l'hanno solo le sezioni che hanno davvero qualcosa sotto.
 *  Calendario, Incassi, Extra e Competenza sono una pagina sola: dargli una
 *  tendina con dentro sé stessi vorrebbe dire un clic in più per niente.
 *
 *  Persone e Ordini non hanno sottopagine ma hanno i filtri che si usano come
 *  tali — «Clienti attivi», «Conclusi» — e quelli sì che meritano un posto
 *  nella barra: oggi ci si arriva solo passando dalla lista e cliccando il
 *  chip giusto. Nessun indirizzo è cambiato: le pagine assorbite (Novità,
 *  Lista d'attesa, Disponibilità, Archivio, Abbonati, Fatture) continuano a
 *  reindirizzare alla lista giusta. */
const adminNav: NavItem[] = [
  { href: "/admin", label: "Home" },
  {
    href: "/admin/persone",
    label: "Persone",
    sub: [
      {
        voci: [
          { href: "/admin/persone", label: "Tutti" },
          { href: "/admin/persone?stadio=attivo", label: "Clienti attivi" },
          { href: "/admin/persone?stadio=lead", label: "Contatti" },
          { href: "/admin/persone?stadio=difficolta", label: "Pagamento fallito" },
          { href: "/admin/persone?stadio=perso", label: "Clienti persi" },
        ],
      },
    ],
  },
  {
    href: "/admin/ordini",
    label: "Ordini",
    sub: [
      {
        voci: [
          { href: "/admin/ordini", label: "Da seguire" },
          { href: "/admin/ordini?stato=conclusi", label: "Conclusi" },
          { href: "/admin/segnalazioni", label: "Segnalazioni sui capi" },
        ],
      },
    ],
  },
  { href: "/admin/calendario", label: "Calendario" },
  { href: "/admin/incassi", label: "Incassi" },
  { href: "/admin/extra", label: "Extra" },
  { href: "/admin/competenza", label: "Competenza" },
  {
    href: "/admin/impostazioni",
    label: "Impostazioni",
    sub: [
      {
        titolo: "Operatività",
        voci: [
          { href: "/admin/etichette", label: "Etichette" },
          { href: "/admin/compiti", label: "Materiale" },
          { href: "/admin/team", label: "Team" },
          { href: "/admin/lavanderia", label: "Soldi alla lavanderia" },
        ],
      },
      {
        titolo: "Marketing",
        voci: [
          { href: "/admin/seo", label: "Cantiere SEO" },
          { href: "/admin/recensioni", label: "Recensioni Google" },
          { href: "/admin/crescita", label: "Crescita" },
          { href: "/admin/inviti", label: "Porta un amico" },
          { href: "/admin/email", label: "Email inviate" },
          { href: "/admin/domande", label: "Cosa ci chiedono" },
        ],
      },
      {
        titolo: "Configurazione",
        voci: [
          { href: "/admin/catalogo", label: "Catalogo" },
          { href: "/admin/listino", label: "Listino capi speciali" },
          { href: "/admin/sicurezza", label: "Sicurezza e stato" },
        ],
      },
    ],
  },
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
      {/* Gli avvisi che arrivano qui sono i guasti e i pagamenti falliti
          (`notify.ts`): roba che non può aspettare il prossimo accesso. */}
      <NotificationPrompt
        subtitle="Ti avvisiamo dei guasti e dei pagamenti falliti."
        sopraLaBarra={false}
      />
    </AppShell>
  );
}
