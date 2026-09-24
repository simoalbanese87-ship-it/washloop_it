import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { roleHome, type UserRole } from "@/lib/orders";

/** Scambia il code del magic link con una sessione, poi reindirizza
 *  alla home del ruolo (o al `next` richiesto). */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const next = searchParams.get("next");

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      if (next) return NextResponse.redirect(`${origin}${next}`);
      const {
        data: { user },
      } = await supabase.auth.getUser();
      let dest = "/app";
      if (user) {
        const { data } = await supabase.from("profiles").select("role").eq("id", user.id).single();
        dest = roleHome((data?.role as UserRole) ?? "customer");
      }
      return NextResponse.redirect(`${origin}${dest}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth`);
}
