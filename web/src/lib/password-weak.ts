/** Riconosce le password che chiunque indovinerebbe al primo tentativo.
 *
 *  Non blocca nulla: l'esito serve solo a mostrare un avviso sotto il campo, e
 *  chi vuole procedere procede. È una scelta di prodotto — rifiutare la
 *  password di chi si sta iscrivendo significa perdere l'iscrizione, e i nostri
 *  clienti non sono gente da gestore di password.
 *
 *  Tutto in locale, di proposito: nessuna chiamata di rete, nessun servizio
 *  esterno da dichiarare nella privacy policy, nessuna latenza mentre si digita.
 *  Non pretende di coprire tutto, copre i casi che si vedono davvero.
 *
 *  Gira nel browser: niente `server-only`, niente accesso a DB. */

/** Le più usate in Italia, più i classici globali. In minuscolo, senza accenti. */
const COMUNI = new Set([
  "password", "passwordx", "password1", "password123", "123456", "1234567", "12345678", "123456789",
  "1234567890", "12345", "1234", "qwerty", "qwertyuiop", "asdfgh", "asdasd", "zxcvbn", "abc123",
  "ciao", "ciaociao", "amore", "amoremio", "tiamo", "tiamo123", "giulia", "francesco", "alessandro",
  "juventus", "milan", "milano", "inter", "napoli", "roma", "forzaroma", "forzajuve", "lazio",
  "italia", "casa", "mamma", "mammamia", "mammacasa", "papa", "famiglia", "topolino", "pippo",
  "pluto", "batman", "superman", "iloveyou", "letmein", "welcome", "monkey", "dragon", "master",
  "sunshine", "princess", "football", "calcio", "estate", "vacanza", "segreto", "cambiami",
  "admin", "administrator", "root", "test", "prova", "provaprova", "utente", "cliente",
  "washloop", "washloop1", "lavanderia", "bucato",
]);

const SEQUENZE = "abcdefghijklmnopqrstuvwxyz0123456789";
const FILE_TASTIERA = ["qwertyuiop", "asdfghjkl", "zxcvbnm", "1234567890"];

/** Toglie accenti e maiuscole: "Città" e "citta" sono la stessa idea. */
function normalizza(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

/** Le due letture possibili di una password "travestita".
 *
 *  Due e non una perché le sostituzioni leet si mordono la coda: in `p4ssw0rd`
 *  il `4` sta per `a`, ma in `Juventus!` il `!` è solo punteggiatura finale, e
 *  tradurlo in `i` produceva `juventusi`, che non somiglia più a niente.
 *  Proviamo entrambe le letture e basta che una caschi nell'elenco. */
function noccioli(s: string): [string, string] {
  const n = normalizza(s);
  const soloLettere = n.replace(/[^a-z]/g, "");
  const conLeet = n
    .replace(/[4@]/g, "a").replace(/[3€]/g, "e").replace(/[1!|]/g, "i")
    .replace(/0/g, "o").replace(/[5$]/g, "s").replace(/7/g, "t")
    .replace(/[^a-z]/g, "");
  return [soloLettere, conLeet];
}

/** Contiene una sequenza crescente o decrescente di almeno `min` caratteri. */
function haSequenza(s: string, min = 4): boolean {
  const dritto = SEQUENZE;
  const rovescio = [...SEQUENZE].reverse().join("");
  for (let i = 0; i + min <= s.length; i++) {
    const pezzo = s.slice(i, i + min);
    if (dritto.includes(pezzo) || rovescio.includes(pezzo)) return true;
  }
  return false;
}

/** Pezzo di una fila della tastiera (qwer, asdf…). */
function haFilaTastiera(s: string, min = 4): boolean {
  for (const fila of FILE_TASTIERA) {
    const rovescio = [...fila].reverse().join("");
    for (let i = 0; i + min <= s.length; i++) {
      const pezzo = s.slice(i, i + min);
      if (fila.includes(pezzo) || rovescio.includes(pezzo)) return true;
    }
  }
  return false;
}

/** Le parole "personali" ricavabili da email e nome: si finiscono spesso dentro la password. */
function paroleProprie(email?: string, nome?: string): string[] {
  const out: string[] = [];
  const locale = (email ?? "").split("@")[0] ?? "";
  for (const pezzo of [...locale.split(/[._\-+0-9]+/), ...(nome ?? "").split(/\s+/)]) {
    const p = normalizza(pezzo).replace(/[^a-z]/g, "");
    if (p.length >= 4) out.push(p);
  }
  return out;
}

/** true se la password è facilmente indovinabile. `email` e `nome` sono
 *  facoltativi: se ci sono, si controlla anche che non siano dentro la password. */
export function passwordFacile(password: string, email?: string, nome?: string): boolean {
  const p = password ?? "";
  // Sotto gli 8 caratteri ci pensa già il `minLength` del campo: qui non
  // aggiungiamo un secondo avviso sulla stessa cosa.
  if (p.length < 8) return false;

  const n = normalizza(p);
  const [soloLettere, conLeet] = noccioli(p);

  if (COMUNI.has(n) || COMUNI.has(soloLettere) || COMUNI.has(conLeet)) return true;
  // "password2024", "juventus!" e simili sono già coperti: `nocciolo` toglie
  // cifre e simboli, quindi finiscono nel confronto con COMUNI qui sopra.
  if (/^\d+$/.test(p)) return true;                    // solo cifre (date, 12345678)
  if (new Set(n).size <= 3) return true;               // "aaaabbbb", "abababab"
  if (/^(.{1,4})\1+$/.test(n)) return true;            // stesso pezzo ripetuto: "ciaociaociao"
  if (haSequenza(n)) return true;
  if (haFilaTastiera(n)) return true;

  for (const parola of paroleProprie(email, nome)) {
    // il proprio nome o l'email dentro la password
    if (soloLettere.includes(parola) || conLeet.includes(parola)) return true;
  }
  return false;
}

/** Testo mostrato sotto il campo. Volutamente non dice "compromessa": non è
 *  quello che stiamo verificando, e allarmerebbe senza motivo. */
export const AVVISO_PASSWORD_FACILE =
  "Password facilmente riconoscibile. Puoi proseguire lo stesso, ma una meno prevedibile protegge meglio il tuo indirizzo di casa.";
