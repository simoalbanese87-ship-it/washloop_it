import { createBrowserClient } from "@supabase/ssr";

/** Client Supabase lato browser (Client Components).
 *  Le NEXT_PUBLIC_* vengono incise nel bundle al build: questo file
 *  legge esplicitamente i valori per garantire l'inlining corretto. */
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export function createClient() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error(
      "Config Supabase mancante: NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY non disponibili nel bundle.",
    );
  }
  return createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}
