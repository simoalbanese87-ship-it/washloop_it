import { createBrowserClient } from "@supabase/ssr";

/** Rimuove OGNI spazio/a-capo: URL e chiavi JWT non ne contengono mai.
 *  Difende da valori env incollati spezzati su più righe (header HTTP illegale). */
const clean = (v?: string) => v?.replace(/\s+/g, "") ?? "";

const SUPABASE_URL = clean(process.env.NEXT_PUBLIC_SUPABASE_URL);
const SUPABASE_ANON_KEY = clean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

export function createClient() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error(
      "Config Supabase mancante: NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY non disponibili nel bundle.",
    );
  }
  return createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}
