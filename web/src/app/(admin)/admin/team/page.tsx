import { Card, PageTitle } from "@/components/app/AppShell";
import { Button } from "@/components/ui/Button";
import { StaffRowActions } from "@/components/admin/StaffRowActions";
import { createServiceClient } from "@/lib/supabase/server";
import { cambiaRuolo, createStaff } from "@/lib/actions/staff";
import { RUOLI, RUOLO_COSA_VEDE, RUOLO_LABEL, type Ruolo } from "@/lib/ruoli";

type Prof = { id: string; full_name: string | null; phone: string | null; role: string; laundry_id: string | null };
type Laundry = { id: string; name: string };

const input = "h-10 w-full rounded-[12px] border border-line bg-ice px-3 text-sm font-medium text-navy outline-none focus:border-blue";

const ROLE_LABEL: Record<string, string> = RUOLO_LABEL;
// L'amministratore ha il rosso: è l'unico ruolo che vede tutto e può
// disfare tutto, e in un elenco va distinto a colpo d'occhio dagli altri.
const roleTone = (r: string) =>
  r === "admin"
    ? "bg-[#C0392B]/12 text-[#C0392B]"
    : r === "partner"
      ? "bg-[#C9881F]/15 text-[#C9881F]"
      : r === "courier"
        ? "bg-blue/12 text-blue"
        : "bg-[#1F8A5B]/12 text-[#1F8A5B]";

export default async function TeamPage({ searchParams }: { searchParams: Promise<{ ok?: string; warn?: string }> }) {
  const { ok, warn } = await searchParams;
  const svc = createServiceClient();

  const [{ data: staff }, { data: laundries }] = await Promise.all([
    svc.from("profiles").select("id, full_name, phone, role, laundry_id").in("role", ["admin", "partner", "courier", "sales"]).order("role").returns<Prof[]>(),
    svc.from("laundries").select("id, name").order("name").returns<Laundry[]>(),
  ]);

  const lmap = new Map((laundries ?? []).map((l) => [l.id, l.name]));
  const emails = new Map<string, string>();
  await Promise.all((staff ?? []).map(async (s) => {
    const { data } = await svc.auth.admin.getUserById(s.id);
    if (data?.user?.email) emails.set(s.id, data.user.email);
  }));

  return (
    <>
      <PageTitle kicker="Team" title="Accessi staff" sub="Crea gli accessi per lavanderia, rider e sales. Le credenziali vengono inviate via email al membro." />

      {ok && <div className="mb-4 rounded-[14px] bg-[#1F8A5B]/10 px-4 py-3 text-sm font-semibold text-[#1F8A5B]">{ok}</div>}
      {warn && <div className="mb-4 rounded-[14px] bg-[#C9881F]/12 px-4 py-3 text-sm font-semibold text-[#C9881F]">{warn}</div>}

      {/* Crea accesso */}
      <Card className="mb-6">
        <h2 className="font-display text-base font-extrabold text-navy">Nuovo accesso</h2>
        <p className="mt-1 text-sm font-medium text-muted">La password è generata automaticamente e inviata via email. Per la lavanderia scegli la sede.</p>
        <form action={createStaff} className="mt-4 grid gap-2 sm:grid-cols-[1fr_1.2fr_1fr_1.2fr_auto] sm:items-end">
          <label className="text-xs font-bold text-muted">Ruolo
            <select name="role" className={input} defaultValue="partner">
              <option value="partner">Lavanderia</option>
              <option value="courier">Rider</option>
              <option value="sales">Sales</option>
            </select>
          </label>
          <label className="text-xs font-bold text-muted">Nome<input name="full_name" required placeholder="Nome e cognome" className={input} /></label>
          <label className="text-xs font-bold text-muted">Telefono<input name="phone" placeholder="Telefono" className={input} /></label>
          <label className="text-xs font-bold text-muted">Email<input name="email" type="email" required placeholder="email@dominio.it" className={input} /></label>
          <Button type="submit" size="md">Crea</Button>
          <label className="text-xs font-bold text-muted sm:col-span-5">Sede lavanderia (solo per ruolo Lavanderia)
            <select name="laundry_id" className={input} defaultValue="">
              <option value="">—</option>
              {(laundries ?? []).map((l) => (<option key={l.id} value={l.id}>{l.name}</option>))}
            </select>
          </label>
        </form>
      </Card>

      {/* Cambia ruolo a chi un account ce l'ha già */}
      <Card className="mb-6">
        <h2 className="font-display text-base font-extrabold text-navy">Cambia ruolo a un account che esiste</h2>
        <p className="mt-1 text-sm font-medium text-muted">
          Per promuovere chi ha già un accesso — un cliente che entra nel team, un rider che diventa
          amministratore. <strong className="text-navy">Email e password non si toccano</strong>: l&apos;accesso resta
          il suo, cambia solo cosa vede entrando. Scrivi l&apos;email esatta dell&apos;account.
        </p>
        <form action={cambiaRuolo} className="mt-4 grid gap-2 sm:grid-cols-[1.6fr_1fr_1.2fr_auto] sm:items-end">
          <label className="text-xs font-bold text-muted">Account (email)
            <input name="email" type="email" required placeholder="email@dominio.it" className={input} />
          </label>
          <label className="text-xs font-bold text-muted">Nuovo ruolo
            <select name="role" className={input} defaultValue="courier">
              {RUOLI.map((r: Ruolo) => (<option key={r} value={r}>{RUOLO_LABEL[r]}</option>))}
            </select>
          </label>
          <label className="text-xs font-bold text-muted">Sede (solo per Lavanderia)
            <select name="laundry_id" className={input} defaultValue="">
              <option value="">—</option>
              {(laundries ?? []).map((l) => (<option key={l.id} value={l.id}>{l.name}</option>))}
            </select>
          </label>
          <Button type="submit" size="md" variant="ghost-navy">Cambia ruolo</Button>
        </form>
        {/* Cosa si apre a ciascun ruolo, scritto qui: promuovere qualcuno senza
            saperlo è il modo in cui si regalano i dati di tutti. */}
        <ul className="mt-4 space-y-1 border-t border-line pt-3 text-xs font-medium text-muted">
          {RUOLI.map((r: Ruolo) => (
            <li key={r}>
              <strong className="text-navy">{RUOLO_LABEL[r]}</strong>: vede {RUOLO_COSA_VEDE[r]}.
            </li>
          ))}
        </ul>
      </Card>

      {/* Elenco staff */}
      <Card>
        <h2 className="mb-3 font-display text-base font-extrabold text-navy">Accessi attivi ({staff?.length ?? 0})</h2>
        <div className="space-y-2">
          {(staff ?? []).map((s) => (
            <div key={s.id} className="flex items-center gap-3 rounded-[14px] border border-line bg-white px-3 py-2.5">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-display text-sm font-extrabold text-navy">{s.full_name ?? "—"}</span>
                  <span className={`rounded-full px-2 py-0.5 font-display text-[10px] font-bold ${roleTone(s.role)}`}>{ROLE_LABEL[s.role] ?? s.role}</span>
                  {s.role === "partner" && s.laundry_id && <span className="rounded-full bg-navy/8 px-2 py-0.5 font-display text-[10px] font-bold text-navy">{lmap.get(s.laundry_id) ?? "—"}</span>}
                </div>
                <div className="mt-0.5 flex flex-wrap gap-x-3 text-xs font-medium text-muted">
                  {emails.get(s.id) && <span>{emails.get(s.id)}</span>}
                  {s.phone && <span>{s.phone}</span>}
                </div>
              </div>
              <StaffRowActions id={s.id} name={s.full_name ?? "questo accesso"} email={emails.get(s.id)} />
            </div>
          ))}
          {(!staff || staff.length === 0) && <p className="text-sm font-medium text-muted">Nessun accesso staff.</p>}
        </div>
      </Card>
    </>
  );
}
