import "server-only";
import webpush from "web-push";
import { createServiceClient } from "@/lib/supabase/server";

/** Web Push (VAPID). Best-effort: non lancia mai, e se le env mancano è un no-op
 *  (sviluppo/build non si rompono). Le subscription morte (404/410) vengono
 *  rimosse. */

let configured = false;
function configure(): boolean {
  if (configured) return true;
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) return false;
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || "mailto:info@washloop.it", pub, priv);
  configured = true;
  return true;
}

export async function sendPush(userId: string, payload: { title: string; body: string; url?: string }) {
  if (!configure()) return;
  try {
    const svc = createServiceClient();
    const { data: subs } = await svc.from("push_subscriptions").select("id, endpoint, p256dh, auth").eq("user_id", userId);
    if (!subs?.length) return;
    const body = JSON.stringify({ title: payload.title, body: payload.body, url: payload.url ?? "/app" });
    await Promise.all(
      subs.map(async (s) => {
        try {
          await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, body);
        } catch (err: unknown) {
          const code = (err as { statusCode?: number })?.statusCode;
          if (code === 404 || code === 410) await svc.from("push_subscriptions").delete().eq("id", s.id);
        }
      }),
    );
  } catch (err) {
    console.error("[push] sendPush fallita:", err);
  }
}
