import Link from "next/link";
import QRCode from "qrcode";
import { InstallGuide } from "@/components/app/InstallGuide";

export const metadata = { title: "Installa l'app — WashLoop" };

/** Il codice si genera qui: `qrcode` gira solo lato server, come per le
 *  etichette e per il codice cliente nel profilo. */
export default async function InstallaPage() {
  const url = `${(process.env.NEXT_PUBLIC_SITE_URL ?? "https://washloop.it").replace(/\s+/g, "").replace(/\/$/, "")}/app/installa`;
  // Non deve mai far fallire la pagina: senza codice restano l'indirizzo
  // scritto e il pulsante per copiarlo.
  const qr = await QRCode.toDataURL(url, { margin: 1, width: 336 }).catch(() => null);

  return (
    <div className="space-y-4">
      <div>
        <Link href="/app/profilo" className="font-display text-sm font-bold text-blue hover:underline">← Profilo</Link>
        <h1 className="mt-1.5 font-display text-[23px] font-black tracking-[-0.03em] text-navy">App &amp; notifiche</h1>
        <p className="mt-1.5 text-sm font-medium text-muted">Due passi e sei pronto: metti WashLoop in schermata Home e attiva le notifiche.</p>
      </div>
      <InstallGuide qr={qr} url={url} />
    </div>
  );
}
