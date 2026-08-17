import { NextResponse } from "next/server";

/** L'export è passato a /admin/incassi/export. Il vecchio indirizzo resta
 *  valido per chi l'avesse salvato. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  return NextResponse.redirect(new URL(`/admin/incassi/export${url.search}`, req.url));
}
