/** La chat con una persona, caricata solo quando qualcuno la vuole.
 *
 *  Perché al clic e non in cima alla pagina
 *  ----------------------------------------
 *  Lo snippet che dà Brevo si mette nel `<head>` e il widget si carica a ogni
 *  visita. Qui si fa il contrario, per tre motivi che valgono tutti e tre:
 *
 *  1. **Niente cookie prima di un gesto.** Brevo scrive i suoi cookie quando il
 *     widget parte. Facendolo partire solo quando uno preme «Scrivi a noi», la
 *     chat non entra nel banner: non c'è niente da far accettare a chi passa di
 *     qui e non ci scriverà mai.
 *  2. **Un launcher solo.** Il widget ha una sua bollicina in basso a destra,
 *     dove sta già la nostra: due bolle sovrapposte nello stesso angolo sono un
 *     guasto, non una scelta. Si carica con `hideButtonOnLoad` e si apre a mano.
 *  3. **Peso.** Sono un paio di centinaia di kilobyte di roba esterna su ogni
 *     pagina, per una funzione che usa una persona su cento.
 *
 *  Il modulo è idempotente: lo script si inietta una volta sola per sessione,
 *  e dalla seconda volta in poi si chiama solo `openChat`. */

declare global {
  interface Window {
    BrevoConversations?: ((...args: unknown[]) => void) & { q?: unknown[] };
    BrevoConversationsID?: string;
    BrevoConversationsSetup?: Record<string, unknown>;
  }
}

/** L'identificativo del widget. Pubblico per natura — viaggia nel browser di
 *  chiunque apra la chat — ma sta in env come gli altri tag di terze parti:
 *  senza, la seconda strada non si mostra nemmeno. */
export const BREVO_CHAT_ID = process.env.NEXT_PUBLIC_BREVO_CHAT_ID ?? "";

export const chatDisponibile = () => BREVO_CHAT_ID.length > 0;

/** Chi sta scrivendo, quando lo sappiamo: in area cliente si passano nome ed
 *  email così chi risponde non deve chiedere «con chi parlo?». Sulle pagine
 *  pubbliche non si passa niente, perché non c'è niente da passare. */
export type ChiScrive = { nome?: string | null; email?: string | null };

let iniettato = false;

function brevo(): NonNullable<Window["BrevoConversations"]> {
  // La coda è quella dello snippet ufficiale: le chiamate fatte prima che lo
  // script arrivi si impilano e partono dopo, in ordine.
  if (!window.BrevoConversations) {
    const coda = ((...args: unknown[]) => {
      (coda.q = coda.q || []).push(args);
    }) as NonNullable<Window["BrevoConversations"]>;
    window.BrevoConversations = coda;
  }
  return window.BrevoConversations;
}

/** Carica il widget se serve e apre la chat. Ritorna `false` se non è
 *  configurato: chi chiama deve poter dire «scrivici per email» invece di
 *  lasciare un bottone che non fa niente. */
export function apriChat(chi?: ChiScrive): boolean {
  if (typeof window === "undefined" || !chatDisponibile()) return false;

  const bc = brevo();

  if (!iniettato) {
    iniettato = true;
    window.BrevoConversationsID = BREVO_CHAT_ID;
    // `hideButtonOnLoad`: la bollicina la mettiamo noi, questa resta spenta.
    window.BrevoConversationsSetup = { ...(window.BrevoConversationsSetup ?? {}), hideButtonOnLoad: true };
    const s = document.createElement("script");
    s.async = true;
    s.src = "https://conversations-widget.brevo.com/brevo-conversations.js";
    document.head.appendChild(s);
  }

  if (chi?.email || chi?.nome) {
    bc("updateIntegrationData", {
      email: chi.email ?? undefined,
      // Brevo vuole nome e cognome separati: quello che abbiamo è un campo
      // solo, quindi si spezza al primo spazio e il resto va nel cognome.
      firstName: chi.nome?.split(" ")[0] || undefined,
      lastName: chi.nome?.split(" ").slice(1).join(" ") || undefined,
    });
  }

  bc("openChat", true);
  return true;
}
