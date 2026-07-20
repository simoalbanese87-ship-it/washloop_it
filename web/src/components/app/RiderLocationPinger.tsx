"use client";

import { useEffect, useRef, useState } from "react";
import { pingCourierLocation } from "@/lib/actions/orders";

/** Rider: condivisione posizione live (opt-in, throttling 15s). Il cliente la vede
 *  solo quando il rider è vicino a lui e in fase attiva. Off di default (batteria). */
export function RiderLocationPinger() {
  const [on, setOn] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const lastRef = useRef(0);

  useEffect(() => {
    if (!on) return;
    if (!("geolocation" in navigator)) { setErr("Geolocalizzazione non disponibile"); setOn(false); return; }
    const id = navigator.geolocation.watchPosition(
      (pos) => {
        const now = Date.now();
        if (now - lastRef.current < 15000) return;
        lastRef.current = now;
        pingCourierLocation(pos.coords.latitude, pos.coords.longitude).catch(() => {});
      },
      (e) => { setErr(e.message); setOn(false); },
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 20000 },
    );
    return () => navigator.geolocation.clearWatch(id);
  }, [on]);

  return (
    <div>
      <button
        onClick={() => { setErr(null); setOn((v) => !v); }}
        className={`flex w-full items-center justify-center gap-2 rounded-full px-5 py-3 font-display text-sm font-extrabold transition-colors ${on ? "bg-[#1F8A5B] text-white" : "border-2 border-line bg-white text-navy"}`}
      >
        <PinIcon /> {on ? "Posizione live attiva — tocca per fermare" : "Attiva posizione live"}
      </button>
      {err && <p className="mt-1 text-center text-[11px] font-medium text-[#C0392B]">{err}</p>}
    </div>
  );
}

const PinIcon = () => (
  <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"><path d="M12 21s-7-6-7-11a7 7 0 0 1 14 0c0 5-7 11-7 11Z" /><circle cx="12" cy="10" r="2.5" /></svg>
);
