/** Le notifiche push viste dal browser: stato, iscrizione, trappole.
 *
 *  Sta in un modulo suo perché la stessa logica serviva in tre posti e ne
 *  esisteva una copia sola, dentro il popup che chiede il permesso. Il popup
 *  però viveva solo nell'app del cliente: il rider e l'ops non l'hanno mai
 *  visto, e infatti al 17 ottobre 2026 su tutto il sistema c'erano **tre**
 *  iscrizioni — due clienti e la lavanderia, nessun rider.
 *
 *  Niente `server-only`: gira nel browser, è l'unico posto dove queste API
 *  esistono. */

const VAPID = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

/** Iscrive questo dispositivo e salva l'iscrizione da noi.
 *
 *  Torna `false` anche quando il permesso c'è ma il salvataggio fallisce: dire
 *  «notifiche attive» a chi non le riceverà è peggio che non dire niente. */
export async function iscriviti(): Promise<boolean> {
  if (!VAPID || !("serviceWorker" in navigator) || !("PushManager" in window)) return false;
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub =
      (await reg.pushManager.getSubscription()) ??
      (await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID) as BufferSource,
      }));
    const res = await fetch("/api/push/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(sub.toJSON()),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** Su iPhone le notifiche web funzionano SOLO dall'app aggiunta alla Home.
 *  Chiederle da Safari non installato non mostra niente di utile e **brucia il
 *  permesso in modo permanente**: dopo l'installazione non si può più chiedere. */
export function iosNonInstallato(): boolean {
  if (typeof window === "undefined") return false;
  const ua = navigator.userAgent;
  // iPadOS moderno si dichiara Macintosh: lo si riconosce dal touch.
  const isIOS = /iphone|ipad|ipod/i.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  if (!isIOS) return false;
  return !installata();
}

/** L'app è aperta dalla schermata Home (standalone), non dal browser. */
export function installata(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export type StatoNotifiche =
  /** Il browser non sa fare notifiche push (o manca la chiave VAPID). */
  | "non-supportate"
  /** iPhone/iPad da cui l'app non è stata ancora aggiunta alla Home. */
  | "ios-da-installare"
  /** Si possono chiedere: nessuno ha ancora risposto. */
  | "da-attivare"
  /** Permesso dato e iscrizione salvata: arrivano. */
  | "attive"
  /** Permesso dato ma l'iscrizione non è stata salvata: non arriveranno. */
  | "rotte"
  /** Negato dal browser: si sblocca solo dalle sue impostazioni. */
  | "bloccate";

/** Dove siamo su QUESTO dispositivo. Guarda anche se l'iscrizione esiste
 *  davvero: il permesso concesso non basta, ed è la differenza fra «attive» e
 *  «rotte» — cioè fra ricevere gli avvisi e credere di riceverli. */
export async function stato(): Promise<StatoNotifiche> {
  if (typeof window === "undefined") return "non-supportate";
  if (!VAPID || !("Notification" in window) || !("serviceWorker" in navigator) || !("PushManager" in window)) {
    return "non-supportate";
  }
  if (Notification.permission === "denied") return "bloccate";
  if (Notification.permission === "default") return iosNonInstallato() ? "ios-da-installare" : "da-attivare";
  // Permesso concesso: l'iscrizione va (ri)salvata ogni volta. Gli endpoint
  // push scadono e il browser li ruota, quindi «c'era a settembre» non
  // significa «c'è adesso».
  return (await iscriviti()) ? "attive" : "rotte";
}

/** Chiede il permesso e iscrive. Torna lo stato in cui siamo finiti. */
export async function attiva(): Promise<StatoNotifiche> {
  if (typeof window === "undefined" || !("Notification" in window)) return "non-supportate";
  if (iosNonInstallato()) return "ios-da-installare";
  try {
    const perm = await Notification.requestPermission();
    if (perm === "denied") return "bloccate";
    if (perm !== "granted") return "da-attivare";
    return (await iscriviti()) ? "attive" : "rotte";
  } catch {
    return "rotte";
  }
}
