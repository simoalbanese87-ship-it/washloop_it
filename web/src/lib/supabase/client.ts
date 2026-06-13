import { createBrowserClient } from "@supabase/ssr";

/** Client Supabase lato browser (Client Components).
 *  .trim() difensivo: evita errori "fetch Invalid value" se il valore env
 *  contiene spazi o a-capo finali (capita incollando le chiavi). */
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

export function createClient() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error(
      "Config Supabase mancante: NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY non disponibili nel bundle.",
    );
  }
  return createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}
