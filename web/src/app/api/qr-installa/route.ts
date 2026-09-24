import { NextResponse } from "next/server";
import QRCode from "qrcode";

/** Il codice QR della pagina di installazione, come immagine vera.
 *
 *  Prima veniva generato dentro la pagina e incorporato come data URL. Con
 *  quella modifica `/app/installa` è diventata una pagina asincrona e ha smesso
 *  di aprirsi: restava sulla rotellina, con il contenuto presente ma dentro un
 *  contenitore nascosto — il segnaposto dello streaming che non veniva mai
 *  scoperto. Il perché non l'ho chiarito; quello che è certo è che la pagina
 *  funzionava quando era sincrona, e ora lo è di nuovo.
 *
 *  Servirlo da qui è comunque la cosa giusta a prescindere: l'immagine si
 *  scarica una volta e resta in cache del browser, invece di viaggiare dentro
 *  ogni caricamento della pagina.
 *
 *  Non accetta nessun parametro di proposito: codifica sempre e solo il nostro
 *  indirizzo. Un generatore di QR aperto a testo libero è un modo comodo per
 *  far apparire link altrui sotto il nostro dominio. */

export const dynamic = "force-static";
export const revalidate = 86400;

export async function GET() {
  const sito = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://washloop.it").replace(/\s+/g, "").replace(/\/$/, "");
  try {
    const png = await QRCode.toBuffer(`${sito}/app/installa`, { margin: 1, width: 336 });
    return new NextResponse(new Uint8Array(png), {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=86400, s-maxage=86400",
      },
    });
  } catch {
    // Senza codice la pagina resta utilizzabile: c'è l'indirizzo scritto e il
    // pulsante per copiarlo. Meglio un riquadro vuoto che una pagina rotta.
    return new NextResponse(null, { status: 204 });
  }
}
