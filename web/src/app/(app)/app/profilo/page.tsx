import { Card, PageTitle } from "@/components/app/AppShell";
import { Button } from "@/components/ui/Button";
import { ChangePassword } from "@/components/app/ChangePassword";
import { getCurrentProfile } from "@/lib/auth";
import { updateProfile } from "@/lib/actions/profile";

const input = "h-11 w-full rounded-[14px] border border-line bg-ice px-3.5 text-sm font-medium text-navy outline-none focus:border-blue";

export default async function ProfiloPage() {
  const profile = await getCurrentProfile();

  return (
    <>
      <PageTitle kicker="Profilo" title="Il tuo account" sub="Dati personali e sicurezza." />

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <h2 className="font-display text-base font-extrabold text-navy">Dati personali</h2>
          <form action={updateProfile} className="mt-4 space-y-3">
            <label className="block text-xs font-bold text-muted">Nome e cognome
              <input name="full_name" defaultValue={profile?.full_name ?? ""} className={`${input} mt-1`} />
            </label>
            <label className="block text-xs font-bold text-muted">Telefono
              <input name="phone" defaultValue={profile?.phone ?? ""} placeholder="+39…" className={`${input} mt-1`} />
            </label>
            <Button type="submit" size="md">Salva</Button>
          </form>
        </Card>

        <Card>
          <h2 className="font-display text-base font-extrabold text-navy">Password</h2>
          <p className="mt-1 text-sm font-medium text-muted">Scegli una nuova password per il tuo accesso.</p>
          <div className="mt-4">
            <ChangePassword />
          </div>
        </Card>
      </div>
    </>
  );
}
