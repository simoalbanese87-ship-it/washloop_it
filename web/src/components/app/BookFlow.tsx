"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { bookPickup } from "@/lib/actions/orders";
import { romeDayKey, fmtDow, fmtDayNum, fmtDowLong, fmtTimeRange } from "@/lib/format";

export type Address = { id: string; label: string | null; street: string; zone_id: string | null };
export type Laundry = { id: string; name: string; zone_id: string | null };
export type Slot = { id: string; starts_at: string; ends_at: string; laundry_id: string | null };
export type SpecialItem = { name: string; price_cli_cents: number };
export type SpecialCategory = { id: string; name: string; emoji: string; items: SpecialItem[] };

const eur = (cents: number) => "€" + (cents / 100).toLocaleString("it-IT", { minimumFractionDigits: 0 });

const TOTAL = 3;
const TITLES = ["Quando ritiriamo?", "Hai capi speciali?", "Conferma"];
const SUBS = [
  "Scegli il giorno e la fascia: passiamo noi sotto casa.",
  "Mettili in un sacco separato dal bucato — al resto pensiamo noi.",
  "Controlla e conferma il ritiro.",
];

/* ---- icone minime ---- */
const ChevL = () => (<svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"><path d="m15 6-6 6 6 6" /></svg>);
const ArrowR = () => (<svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>);
const Check = ({ size = 20 }: { size?: number }) => (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>);

export function BookFlow({
  addresses,
  laundries,
  slots,
  categories,
}: {
  addresses: Address[];
  laundries: Laundry[];
  slots: Slot[];
  categories: SpecialCategory[];
}) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [addressId, setAddressId] = useState(addresses[0]?.id ?? "");
  const [dayKey, setDayKey] = useState<string | null>(null);
  const [slotId, setSlotId] = useState<string | null>(null);
  const [bags, setBags] = useState(1);
  const [notes, setNotes] = useState("");
  const [openCat, setOpenCat] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdId, setCreatedId] = useState<string | null>(null);

  const address = addresses.find((a) => a.id === addressId);

  // Routing interno: lavanderia non scelta né mostrata. Prima attiva della zona.
  const effectiveLaundryId = useMemo(() => {
    const zl = laundries.filter((l) => !address?.zone_id || l.zone_id === address.zone_id);
    return zl[0]?.id ?? "";
  }, [laundries, address?.zone_id]);

  const laundrySlots = useMemo(
    () => slots.filter((s) => s.laundry_id === effectiveLaundryId),
    [slots, effectiveLaundryId],
  );

  // Giorni disponibili (raggruppo gli slot per giorno di Roma)
  const days = useMemo(() => {
    const map = new Map<string, Slot[]>();
    for (const s of laundrySlots) {
      const k = romeDayKey(s.starts_at);
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(s);
    }
    return [...map.entries()]
      .map(([key, list]) => ({ key, ref: list[0].starts_at, slots: list.sort((a, b) => a.starts_at.localeCompare(b.starts_at)) }))
      .sort((a, b) => a.key.localeCompare(b.key));
  }, [laundrySlots]);

  const selectedDay = days.find((d) => d.key === dayKey) ?? null;
  const daySlots = selectedDay?.slots ?? [];
  const selectedSlot = laundrySlots.find((s) => s.id === slotId) ?? null;

  const noLaundry = effectiveLaundryId === "";
  const canNext = step === 0 ? !!selectedSlot : true;

  async function confirm() {
    if (!address || !selectedSlot) return;
    setSubmitting(true);
    setError(null);
    const res = await bookPickup({
      address_id: address.id,
      pickup_slot_id: selectedSlot.id,
      laundry_id: effectiveLaundryId || null,
      bags,
      notes: notes.trim() || null,
    });
    setSubmitting(false);
    if (!res.ok) return setError(res.error);
    setCreatedId(res.id);
  }

  /* ---------------- SUCCESS (scuro) ---------------- */
  if (createdId) {
    return (
      <section
        className="relative overflow-hidden rounded-[26px] px-6 py-9 text-center text-white"
        style={{ background: "radial-gradient(120% 90% at 78% 0%, #2a4a8e 0%, #1B2D5E 52%, #142046 100%)" }}
      >
        <div className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-gradient-to-br from-blue to-cyan shadow-[0_16px_36px_-16px_rgba(43,127,212,0.7)]">
          <Check size={40} />
        </div>
        <h2 className="mt-5 font-display text-[26px] font-black">Tutto pronto!</h2>
        <p className="mt-2 text-sm font-medium text-white/70">Ritiro prenotato. Ti avvisiamo prima di ogni passaggio.</p>

        <div className="mt-6 rounded-[18px] border border-white/15 bg-white/[0.07] p-4 text-left">
          <Row k="Ritiro" v={selectedSlot ? `${cap(fmtDowLong(selectedSlot.starts_at))} · ${fmtTimeRange(selectedSlot.starts_at, selectedSlot.ends_at)}` : "—"} />
          <Row k="Indirizzo" v={address?.street ?? "—"} />
          <Row k="Consegna" v="Entro 72h — scegli la fascia quando è pronto" last />
        </div>

        <div className="mt-6 space-y-3">
          <Link href={`/app/ordini/${createdId}`} className="flex h-[54px] w-full items-center justify-center rounded-full bg-gradient-to-br from-blue to-cyan font-display text-base font-extrabold text-white shadow-[0_16px_36px_-16px_rgba(43,127,212,0.7)]">
            Segui l&apos;ordine →
          </Link>
          <Link href="/app" className="flex h-[54px] w-full items-center justify-center rounded-full border-2 border-white/25 font-display text-base font-extrabold text-white">
            Torna alla home
          </Link>
        </div>
      </section>
    );
  }

  if (noLaundry) {
    return (
      <div className="rounded-[18px] border border-line bg-white p-5 text-sm font-medium text-muted">
        Zona non ancora coperta. Stiamo arrivando — riprova presto.
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Progress header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => (step === 0 ? router.push("/app") : setStep(step - 1))}
          aria-label="Indietro"
          className="grid h-10 w-10 flex-none place-items-center rounded-full bg-white text-navy shadow-[0_1px_0_rgba(27,45,94,0.04),0_10px_24px_-18px_rgba(27,45,94,0.5)]"
        >
          <ChevL />
        </button>
        <div className="h-[7px] flex-1 overflow-hidden rounded-full bg-navy/10">
          <div className="h-full rounded-full bg-gradient-to-r from-blue to-cyan transition-[width] duration-500" style={{ width: `${((step + 1) / TOTAL) * 100}%` }} />
        </div>
        <span className="flex-none font-display text-xs font-extrabold text-muted">{step + 1}/{TOTAL}</span>
      </div>

      {/* Titolo */}
      <div>
        <div className="font-display text-[11px] font-extrabold uppercase tracking-[0.2em] text-blue">Nuovo ritiro</div>
        <h2 className="mt-1.5 font-display text-[26px] font-black tracking-[-0.02em] text-navy">{TITLES[step]}</h2>
        <p className="mt-1.5 text-sm font-medium text-muted">{SUBS[step]}</p>
      </div>

      {/* STEP 0 — giorno + slot */}
      {step === 0 && (
        <div className="space-y-4">
          {addresses.length > 1 && (
            <select
              value={addressId}
              onChange={(e) => { setAddressId(e.target.value); setDayKey(null); setSlotId(null); }}
              className="h-12 w-full rounded-[16px] border-2 border-line bg-white px-4 text-sm font-semibold text-navy outline-none focus:border-cyan"
            >
              {addresses.map((a) => (
                <option key={a.id} value={a.id}>{a.label ? `${a.label} — ` : ""}{a.street}</option>
              ))}
            </select>
          )}

          {days.length === 0 ? (
            <div className="rounded-[18px] border border-line bg-white p-5 text-sm font-medium text-muted">
              Nessuna fascia disponibile al momento. Riprova più tardi.
            </div>
          ) : (
            <>
              {/* daystrip */}
              <div className="-mx-1 flex gap-2.5 overflow-x-auto px-1 pb-1 [scrollbar-width:none]">
                {days.map((d) => {
                  const on = d.key === dayKey;
                  return (
                    <button
                      key={d.key}
                      onClick={() => { setDayKey(d.key); setSlotId(null); }}
                      className={`flex-none w-[58px] rounded-[16px] py-2.5 text-center transition-all ${on ? "bg-gradient-to-br from-blue to-cyan text-white shadow-[0_16px_36px_-16px_rgba(43,127,212,0.55)]" : "border border-line bg-white"}`}
                    >
                      <div className={`font-display text-[11px] font-extrabold uppercase tracking-[0.06em] ${on ? "text-white/85" : "text-muted"}`}>{fmtDow(d.ref)}</div>
                      <div className={`mt-0.5 font-display text-xl font-black ${on ? "text-white" : "text-navy"}`}>{fmtDayNum(d.ref)}</div>
                    </button>
                  );
                })}
              </div>

              {/* slot grid */}
              {selectedDay ? (
                <div className="grid grid-cols-2 gap-2.5">
                  {daySlots.map((s) => {
                    const on = s.id === slotId;
                    return (
                      <button
                        key={s.id}
                        onClick={() => setSlotId(s.id)}
                        className={`rounded-[14px] border-2 bg-white px-3 py-3.5 text-center transition-all ${on ? "border-cyan shadow-[0_14px_30px_-18px_rgba(0,200,240,0.5)]" : "border-transparent shadow-[0_1px_0_rgba(27,45,94,0.04),0_10px_24px_-18px_rgba(27,45,94,0.5)]"}`}
                      >
                        <div className="font-display text-[15px] font-black text-navy">{fmtTimeRange(s.starts_at, s.ends_at)}</div>
                        <div className="mt-0.5 text-[11.5px] font-bold text-muted">Disponibile</div>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <p className="rounded-[14px] bg-ice px-4 py-3 text-sm font-medium text-muted">Scegli prima un giorno qui sopra.</p>
              )}
            </>
          )}
        </div>
      )}

      {/* STEP 1 — capi speciali (vetrina) */}
      {step === 1 && (
        <div className="space-y-3">
          <div className="flex items-start gap-3 rounded-[18px] bg-cyan/[0.08] p-4">
            <span className="grid h-11 w-11 flex-none place-items-center rounded-[13px] bg-white text-blue">
              <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><path d="M12 8h.01M11 12h1v4h1" /></svg>
            </span>
            <div className="text-sm">
              <div className="font-display font-extrabold text-navy">Nessun acquisto adesso</div>
              <div className="mt-0.5 font-medium text-muted">Metti i capi speciali in un sacco separato dal bucato: li riconosciamo, li trattiamo e li addebitiamo in automatico a fine mese.</div>
            </div>
          </div>

          {categories.map((c) => {
            const open = openCat === c.id;
            const min = Math.min(...c.items.map((i) => i.price_cli_cents));
            return (
              <div key={c.id} className="overflow-hidden rounded-[18px] border border-line bg-white">
                <button onClick={() => setOpenCat(open ? null : c.id)} className="flex w-full items-center gap-3.5 p-4 text-left">
                  <span className="grid h-11 w-11 flex-none place-items-center rounded-[13px] bg-ice text-xl">{c.emoji}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-display text-[15px] font-extrabold text-navy">{c.name}</span>
                    <span className="block text-xs font-medium text-muted">{c.items.length} capi · tocca per il listino</span>
                  </span>
                  <span className="flex-none text-right">
                    <span className="block font-display text-sm font-black text-navy">da {eur(min)}</span>
                    <span className="block text-[11px] font-bold text-blue">{open ? "chiudi ▲" : "apri ▼"}</span>
                  </span>
                </button>
                {open && (
                  <div className="border-t border-line px-4 pb-2">
                    {c.items.map((it) => (
                      <div key={it.name} className="flex items-center justify-between border-b border-line py-2 text-sm last:border-0">
                        <span className="font-medium text-muted">{it.name}</span>
                        <span className="font-display font-extrabold text-navy">{eur(it.price_cli_cents)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
          <p className="text-center text-xs font-medium text-muted">Prezzi IVA inclusa · addebito automatico a fine mese in base ai capi lasciati nel sacco.</p>
        </div>
      )}

      {/* STEP 2 — conferma */}
      {step === 2 && (
        <div className="space-y-3">
          <div className="rounded-[18px] border border-line bg-white p-5">
            <RowEdit
              title={selectedSlot ? `Ritiro · ${cap(fmtDowLong(selectedSlot.starts_at))}` : "Ritiro"}
              sub={selectedSlot ? fmtTimeRange(selectedSlot.starts_at, selectedSlot.ends_at) : "—"}
              onEdit={() => setStep(0)}
            />
            <div className="my-3 h-px bg-line" />
            <RowEdit title={address?.label ?? "Indirizzo"} sub={address?.street ?? "—"} />
            <div className="my-3 h-px bg-line" />
            <RowEdit title="Consegna" sub="Entro 72h — scegli la fascia quando è pronto" />
          </div>

          <div className="flex items-center justify-between rounded-[18px] border border-line bg-white p-4">
            <div>
              <div className="font-display text-sm font-extrabold text-navy">Quanti sacchi?</div>
              <div className="text-xs font-medium text-muted">Inclusi nel tuo abbonamento</div>
            </div>
            <div className="flex items-center gap-3">
              <button onClick={() => setBags(Math.max(1, bags - 1))} className="grid h-9 w-9 place-items-center rounded-full bg-ice font-display text-lg font-black text-blue disabled:opacity-40" disabled={bags <= 1}>−</button>
              <span className="w-5 text-center font-display text-lg font-black text-navy">{bags}</span>
              <button onClick={() => setBags(bags + 1)} className="grid h-9 w-9 place-items-center rounded-full bg-ice font-display text-lg font-black text-blue">+</button>
            </div>
          </div>

          <input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Note per il corriere (facoltative)"
            className="h-12 w-full rounded-[16px] border-2 border-line bg-white px-4 text-sm font-semibold text-navy outline-none focus:border-cyan"
          />

          <div className="flex items-start gap-3 rounded-[18px] bg-cyan/[0.08] p-4 text-sm">
            <span className="grid h-9 w-9 flex-none place-items-center rounded-[11px] bg-white text-blue">✨</span>
            <div><span className="font-display font-extrabold text-navy">Capi speciali</span><span className="mt-0.5 block font-medium text-muted">Mettili in un sacco separato: riconosciuti e addebitati in automatico secondo il listino.</span></div>
          </div>

          <p className="text-center text-xs font-medium text-muted">Ritiro e consegna sono inclusi nel tuo abbonamento.</p>
        </div>
      )}

      {error && <p className="text-sm font-semibold text-[#C0392B]">{error}</p>}

      {/* CTA */}
      {step < 2 ? (
        <button
          onClick={() => canNext && setStep(step + 1)}
          disabled={!canNext}
          className="flex h-[54px] w-full items-center justify-center gap-2 rounded-full bg-gradient-to-br from-blue to-cyan font-display text-base font-extrabold text-white shadow-[0_16px_36px_-16px_rgba(43,127,212,0.7)] transition active:scale-[0.98] disabled:opacity-40"
        >
          Continua <ArrowR />
        </button>
      ) : (
        <button
          onClick={confirm}
          disabled={submitting}
          className="flex h-[54px] w-full items-center justify-center gap-2 rounded-full bg-gradient-to-br from-blue to-cyan font-display text-base font-extrabold text-white shadow-[0_16px_36px_-16px_rgba(43,127,212,0.7)] transition active:scale-[0.98] disabled:opacity-40"
        >
          {submitting ? "Confermo…" : <><Check /> Conferma ritiro</>}
        </button>
      )}
    </div>
  );
}

function cap(s: string) { return s.charAt(0).toUpperCase() + s.slice(1); }

function Row({ k, v, last }: { k: string; v: string; last?: boolean }) {
  return (
    <div className={`flex items-center justify-between gap-4 py-2.5 text-sm ${last ? "" : "border-b border-white/12"}`}>
      <span className="font-medium text-white/65">{k}</span>
      <span className="text-right font-display font-extrabold text-white">{v}</span>
    </div>
  );
}

function RowEdit({ title, sub, onEdit }: { title: string; sub: string; onEdit?: () => void }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <div className="font-display text-[15px] font-extrabold text-navy">{title}</div>
        <div className="mt-0.5 text-sm font-medium text-muted">{sub}</div>
      </div>
      {onEdit && <button onClick={onEdit} className="flex-none font-display text-[13px] font-extrabold text-blue">Modifica</button>}
    </div>
  );
}
