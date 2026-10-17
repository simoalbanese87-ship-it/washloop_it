import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { sendPush } from "@/lib/push";
import { roleHome, type UserRole } from "@/lib/orders";

/** «Mandami una prova»: una notifica a sé stessi, subito.
 *
 *  Serve a chiudere l'unico anello che restava aperto: il browser dice
 *  «permesso concesso», noi diciamo «iscrizione salvata», e nessuna delle due
 *  cose dimostra che una notifica arrivi davvero su quel telefono. Fra chiave
 *  VAPID e servizio push del browser ci sono tre pezzi che possono essere
 *  rotti in silenzio, e il modo di saperlo è farne partire una.
 *
 *  Si manda **solo a sé stessi**: nessun destinatario arriva dalla richiesta. */

export const dynamic = "force-dynamic";

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauth" }, { status: 401 });

  // Quante iscrizioni ha davvero questo utente: letto col service client
  // perché una policy che nega **torna vuoto**, e zero iscrizioni verrebbe
  // letto come «non ne hai» invece che «non te le faccio vedere».
  const svc = createServiceClient();
  const { count } = await svc
    .from("push_subscriptions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id);

  const quante = count ?? 0;
  if (quante === 0) {
    return NextResponse.json({ inviate: 0, error: "nessun dispositivo iscritto" });
  }

  // La notifica si apre su casa propria: il rider sul giro, la lavanderia sul
  // portale, il cliente sull'app. Aprire «/app» a un rider sarebbe il primo
  // avviso che riceve, e lo porterebbe nel posto sbagliato.
  const { data: prof } = await svc
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle<{ role: UserRole }>();

  await sendPush(user.id, {
    title: "Prova riuscita ✅",
    body: "Le notifiche su questo dispositivo funzionano.",
    url: roleHome(prof?.role ?? "customer"),
  });

  return NextResponse.json({ inviate: quante });
}
