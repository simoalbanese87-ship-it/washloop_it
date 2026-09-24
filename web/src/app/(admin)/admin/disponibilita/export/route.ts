import { NextResponse } from "next/server";

/** L'export è passato a /admin/contatti/export, che scarica anche i contatti
 *  del funnel. Il vecchio indirizzo resta valido: chi lo aveva salvato o
 *  automatizzato continua a scaricare senza accorgersi del cambio. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const qs = new URLSearchParams(url.search);
  qs.set("fonte", "landing");
  return NextResponse.redirect(new URL(`/admin/contatti/export?${qs}`, req.url));
}
