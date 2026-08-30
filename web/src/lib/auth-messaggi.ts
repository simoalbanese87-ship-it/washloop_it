/** I messaggi di Supabase, in italiano e con dentro cosa fare.
 *
 *  Arrivano in inglese e crudi: chi si stava registrando si è visto comparire
 *  «User already registered» sotto il campo password. Non è solo brutto — non
 *  dice la cosa utile, che è "hai già un account, accedi invece di crearne uno".
 *
 *  Le chiavi sono frammenti in minuscolo cercati dentro al messaggio, perché
 *  Supabase cambia la formulazione fra una versione e l'altra ma tiene il
 *  nocciolo. Quello che non riconosciamo passa così com'è: meglio una frase in
 *  inglese che una bugia rassicurante. */

const TRADUZIONI: [string, string][] = [
  ["user already registered", "Esiste già un account con questa email. Accedi invece di crearne uno nuovo."],
  ["already been registered", "Esiste già un account con questa email. Accedi invece di crearne uno nuovo."],
  ["invalid login credentials", "Email o password non corrette."],
  ["email not confirmed", "Devi prima confermare l'email: controlla la posta, anche nello spam."],
  ["password should be at least", "La password è troppo corta: servono almeno 8 caratteri."],
  ["password is too weak", "Password troppo debole: aggiungi lettere, numeri e una maiuscola."],
  ["unable to validate email address", "L'indirizzo email non sembra valido."],
  ["invalid email", "L'indirizzo email non sembra valido."],
  ["email rate limit exceeded", "Troppi tentativi ravvicinati. Riprova fra qualche minuto."],
  ["for security purposes", "Troppi tentativi ravvicinati. Riprova fra qualche minuto."],
  ["over_request_rate_limit", "Troppi tentativi ravvicinati. Riprova fra qualche minuto."],
  ["signups not allowed", "Le registrazioni sono momentaneamente chiuse."],
  ["network", "Connessione assente o instabile. Controlla la rete e riprova."],
  ["failed to fetch", "Connessione assente o instabile. Controlla la rete e riprova."],
];

export function messaggioAuth(grezzo: string | null | undefined): string {
  const testo = (grezzo ?? "").trim();
  if (!testo) return "Qualcosa non ha funzionato. Riprova.";
  const minuscolo = testo.toLowerCase();
  for (const [ago, italiano] of TRADUZIONI) if (minuscolo.includes(ago)) return italiano;
  return testo;
}
