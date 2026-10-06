// WashLoop service worker — shell cache + network-first + Web Push.
//
// v5. Ripristinato il comportamento della v3 sull'area riservata.
//
// Nella v4 avevo tolto l'intercettazione su /app perché sembrava rompere le
// pagine in streaming: restavano sulla rotellina. Non era vero — era lo
// strumento con cui le stavo ispezionando a interferire, e le stesse pagine
// caricate normalmente hanno sempre funzionato. Tolta l'intercettazione si
// perdeva però la schermata "sei offline" nell'app installata, che è il motivo
// per cui il service worker esiste. Quindi torna, senza mettere in cache nulla
// di personale: solo la rete, e la pagina offline se la rete non c'è.
//
// Dalla v2 restano le tre correzioni di allora, tutte per lo stesso motivo:
// l'app installata si comportava male proprio quando serviva, cioè offline.
//
// 1. `/app` NON sta più nel precache. Richiede il login: se l'utente installava
//    da sloggato, finiva in cache l'HTML della pagina di login con chiave
//    `/app`, e da lì in poi l'app installata mostrava il login anche a sessione
//    valida. L'errore era dentro un catch vuoto, quindi invisibile.
// 2. Il fallback offline è una pagina dedicata, non la home: prima l'app
//    installata offline mostrava la landing marketing.
// 3. Le pagine autenticate non si mettono più in cache: su un dispositivo
//    condiviso restavano leggibili dopo il logout.
const CACHE = "washloop-v5";
const OFFLINE = "/offline";
const SHELL = ["/", "/login", OFFLINE, "/icon-192.png", "/manifest.webmanifest"];

// Aree con dati personali: mai in cache.
const PRIVATE = ["/app", "/admin", "/courier", "/laundry", "/sales"];
const isPrivate = (url) => PRIVATE.some((p) => url.pathname === p || url.pathname.startsWith(p + "/"));

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((c) =>
      // addAll fallisce tutto se una sola risorsa manca: qui ognuna va per conto suo.
      Promise.all(SHELL.map((u) => c.add(u).catch((e) => console.warn("[sw] precache fallito:", u, e)))),
    ),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    // Area riservata: la risposta passa di qui ma non viene mai copiata in
    // cache — sono dati personali, e su un dispositivo condiviso resterebbero
    // leggibili dopo il logout. Serve solo a poter mostrare la schermata
    // "sei offline" invece dell'errore del browser.
    if (isPrivate(url)) {
      event.respondWith(fetch(request).catch(async () => (await caches.match(OFFLINE)) || Response.error()));
      return;
    }

    event.respondWith(
      fetch(request)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(request, copy)).catch(() => {});
          }
          return res;
        })
        .catch(async () => (await caches.match(request)) || (await caches.match(OFFLINE)) || Response.error()),
    );
    return;
  }

  if (url.pathname.startsWith("/_next/static") || request.destination === "image") {
    event.respondWith(
      caches.match(request).then((cached) =>
        cached ||
        fetch(request).then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(request, copy)).catch(() => {});
          }
          return res;
        }),
      ),
    );
  }
});

// Web Push: mostra la notifica.
// icon e badge sono PNG: Chrome su Android non renderizza SVG nelle notifiche,
// quindi con l'SVG la notifica arrivava senza icona.
self.addEventListener("push", (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch (e) { data = { body: event.data && event.data.text() }; }
  const title = data.title || "WashLoop";
  const options = {
    body: data.body || "",
    icon: "/icon-192.png",
    badge: "/badge-96.png",
    data: { url: data.url || "/app" },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

// Click sulla notifica: porta sull'app (riusa una tab aperta se possibile)
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/app";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if ("focus" in c) { c.navigate(url); return c.focus(); }
      }
      return self.clients.openWindow(url);
    }),
  );
});

// Il browser può ruotare l'endpoint push quando vuole. Senza questo la
// sottoscrizione moriva in silenzio e l'utente smetteva di ricevere notifiche
// senza accorgersene.
self.addEventListener("pushsubscriptionchange", (event) => {
  event.waitUntil(
    (async () => {
      try {
        const vecchia = event.oldSubscription || (await self.registration.pushManager.getSubscription());
        const chiave = vecchia && vecchia.options && vecchia.options.applicationServerKey;
        if (!chiave) return;
        const nuova = await self.registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: chiave,
        });
        await fetch("/api/push/subscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(nuova),
        });
      } catch (e) {
        console.warn("[sw] rinnovo sottoscrizione push fallito:", e);
      }
    })(),
  );
});
