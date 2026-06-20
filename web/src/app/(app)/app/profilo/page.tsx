import Link from "next/link";
import { ChangePassword } from "@/components/app/ChangePassword";
import { getCurrentProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { updateProfile } from "@/lib/actions/profile";
import { signOut } from "@/lib/actions/auth";

const input = "h-12 w-full rounded-[16px] border-2 border-line bg-white px-4 text-sm font-semibold text-navy outline-none focus:border-cyan";

const PinIcon = () => (
  <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11Z" /><circle cx="12" cy="10" r="2.5" />
  </svg>
);
const CardIcon = () => (
  <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="5" width="18" height="14" rx="3" /><path d="M3 10h18" />
  </svg>
);
const Chev = () => (
  <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
    <path d="m9 6 6 6-6 6" />
  </svg>
);
const LogoutIcon = () => (
  <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="m16 17 5-5-5-5" /><path d="M21 12H9" />
  </svg>
);

export default async function ProfiloPage() {
  const profile = await getCurrentProfile();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const email = user?.email ?? "";
  const name = profile?.full_name ?? "Il mio account";
  const initials = name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("") || "W";

  return (
    <div className="space-y-4">
      <h1 className="font-display text-[23px] font-black tracking-[-0.03em] text-navy">Profilo</h1>

      {/* Card profilo */}
      <section className="flex items-center gap-3.5 rounded-[18px] border border-line bg-white p-5">
        <span className="grid h-14 w-14 flex-none place-items-center rounded-full bg-gradient-to-br from-blue to-cyan font-display text-xl font-black text-white">
          {initials}
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate font-display text-lg font-black text-navy">{name}</div>
          {email && <div className="truncate text-sm font-medium text-muted">{email}</div>}
        </div>
      </section>

      {/* Dati personali */}
      <section className="rounded-[18px] border border-line bg-white p-5">
        <h2 className="font-display text-base font-extrabold text-navy">Dati personali</h2>
        <form action={updateProfile} className="mt-4 space-y-3">
          <label className="block">
            <span className="font-display text-[12px] font-extrabold uppercase tracking-[0.04em] text-muted">Nome e cognome</span>
            <input name="full_name" defaultValue={profile?.full_name ?? ""} className={`${input} mt-1.5`} />
          </label>
          <label className="block">
            <span className="font-display text-[12px] font-extrabold uppercase tracking-[0.04em] text-muted">Telefono</span>
            <input name="phone" defaultValue={profile?.phone ?? ""} placeholder="+39…" className={`${input} mt-1.5`} />
          </label>
          <button type="submit" className="rounded-full bg-gradient-to-br from-blue to-cyan px-6 py-3 font-display text-sm font-extrabold text-white shadow-[0_10px_24px_-10px_rgba(0,200,240,0.7)]">
            Salva modifiche
          </button>
        </form>
      </section>

      {/* Link rapidi */}
      <section className="rounded-[18px] border border-line bg-white px-5 py-1">
        <RowLink href="/app/indirizzi" Icon={PinIcon} title="Indirizzi" sub="Dove ritiriamo e consegniamo" />
        <RowLink href="/app/abbonamento" Icon={CardIcon} title="Abbonamento" sub="Gestisci il tuo piano" last />
      </section>

      {/* Password */}
      <section className="rounded-[18px] border border-line bg-white p-5">
        <h2 className="font-display text-base font-extrabold text-navy">Password</h2>
        <p className="mt-1 text-sm font-medium text-muted">Scegli una nuova password per il tuo accesso.</p>
        <div className="mt-4">
          <ChangePassword />
        </div>
      </section>

      {/* Logout */}
      <form action={signOut}>
        <button
          type="submit"
          className="flex w-full items-center justify-center gap-2 rounded-full border-2 border-line bg-white py-3.5 font-display text-sm font-extrabold text-muted"
        >
          <LogoutIcon /> Esci
        </button>
      </form>
      <p className="pb-2 text-center text-xs font-semibold text-muted">WashLoop · v1.0 · Milano</p>
    </div>
  );
}

function RowLink({ href, Icon, title, sub, last }: { href: string; Icon: () => React.ReactElement; title: string; sub: string; last?: boolean }) {
  return (
    <Link href={href} className={`flex items-center gap-3 py-3.5 ${last ? "" : "border-b border-line"}`}>
      <span className="grid h-11 w-11 flex-none place-items-center rounded-[13px] bg-ice text-blue"><Icon /></span>
      <span className="min-w-0 flex-1">
        <span className="block font-display text-[15px] font-extrabold text-navy">{title}</span>
        <span className="block text-xs font-medium text-muted">{sub}</span>
      </span>
      <span className="text-navy/30"><Chev /></span>
    </Link>
  );
}
