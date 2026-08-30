import type { SupabaseClient } from "@supabase/supabase-js";
import { messaggioAuth } from "@/lib/auth-messaggi";

/** Registra una persona e la lascia con una sessione valida in mano.
 *
 *  Serve perché sia il login sia l'onboarding facevano così:
 *
 *      if (data.session && data.user) { ...vai avanti... }
 *      else { setInfo("Account creato. Conferma l'email, poi accedi."); }
 *
 *  e quel ramo `else` era un vicolo cieco. L'account veniva creato davvero, ma
 *  la pagina restava ferma con un messaggio: chi si stava iscrivendo pensava
 *  che non fosse successo niente, ripremeva, e si sentiva rispondere che
 *  l'utente esisteva già. Sul percorso a pagamento questo significa perdere
 *  l'iscrizione a metà.
 *
 *  Quando la conferma via email non è richiesta — ed è la configurazione di
 *  questo progetto — la sessione arriva subito. Se per qualsiasi motivo non
 *  arriva, invece di fermarsi si prova ad accedere con le stesse credenziali
 *  appena scelte: sono quelle che la persona ha davanti agli occhi, e se
 *  l'account è stato creato l'accesso riesce. Ci si ferma solo se anche questo
 *  fallisce, e allora si dice cosa fare. */

export type EsitoRegistrazione =
  | { ok: true; userId: string }
  | { ok: false; errore: string; esisteGia?: boolean };

export async function registraUtente(
  supabase: SupabaseClient,
  input: { email: string; password: string; meta?: Record<string, unknown> },
): Promise<EsitoRegistrazione> {
  const email = input.email.trim();
  const { data, error } = await supabase.auth.signUp({
    email,
    password: input.password,
    options: { data: input.meta },
  });

  if (error) {
    const grezzo = error.message ?? "";
    return {
      ok: false,
      errore: messaggioAuth(grezzo),
      esisteGia: /already (registered|been registered)/i.test(grezzo),
    };
  }

  if (data.session && data.user) return { ok: true, userId: data.user.id };

  // Nessuna sessione: si entra con le credenziali appena scelte invece di
  // lasciare la persona ferma su una schermata che non porta da nessuna parte.
  const accesso = await supabase.auth.signInWithPassword({ email, password: input.password });
  if (accesso.data.session && accesso.data.user) {
    return { ok: true, userId: accesso.data.user.id };
  }

  return {
    ok: false,
    errore: accesso.error
      ? messaggioAuth(accesso.error.message)
      : "Abbiamo creato l'account ma non siamo riusciti ad aprirti la sessione. Prova ad accedere con l'email e la password che hai appena scelto.",
  };
}

/** Scrive sul profilo la prova del consenso. Best-effort **di proposito**:
 *  prima era un `await` sulla strada del reindirizzamento, e un problema qui
 *  bloccava tutta l'iscrizione. Il consenso resta comunque nei metadati
 *  dell'utente, scritti al momento della registrazione. */
export async function segnaConsenso(supabase: SupabaseClient, userId: string, quando: string): Promise<void> {
  try {
    await supabase.from("profiles").update({ terms_accepted_at: quando }).eq("id", userId);
  } catch (err) {
    console.error("[registrazione] consenso non scritto sul profilo:", err);
  }
}
