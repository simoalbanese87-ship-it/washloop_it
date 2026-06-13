import { createBrowserClient } from "@supabase/ssr";

/** Client Supabase lato browser (Client Components). */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
