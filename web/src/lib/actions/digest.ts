"use server";

import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth";
import { sendDailyDigest } from "@/lib/digest";

/** Admin: invia subito il digest delle ultime 24h (test/on-demand). */
export async function sendDigestNow() {
  const me = await getCurrentProfile();
  if (!me || me.role !== "admin") throw new Error("Solo admin");
  const r = await sendDailyDigest(24);
  const msg = r.sent
    ? `Digest inviato a ${r.recipients} ${r.recipients === 1 ? "destinatario" : "destinatari"} (${r.customers} clienti, ${r.leads} lead nelle ultime 24h).`
    : `Niente da inviare: ${r.reason ?? "nessuna novità"}.`;
  redirect(`/admin/novita?${r.sent ? "ok" : "warn"}=${encodeURIComponent(msg)}`);
}
