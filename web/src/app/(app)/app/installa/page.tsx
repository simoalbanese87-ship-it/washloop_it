import Link from "next/link";
import { InstallGuide } from "@/components/app/InstallGuide";

export const metadata = { title: "Installa l'app — WashLoop" };

/** Pagina **sincrona** di proposito. Renderla asincrona per generare il codice
 *  QR l'ha fatta smettere di aprirsi: restava sulla rotellina di attesa, con il
 *  contenuto presente nella pagina ma dentro un contenitore nascosto che non
 *  veniva mai scoperto. Il codice ora arriva da `/api/qr-installa`, come
 *  qualsiasi altra immagine, e qui non si aspetta più niente. */
export default function InstallaPage() {
  const url = `${(process.env.NEXT_PUBLIC_SITE_URL ?? "https://washloop.it").replace(/\s+/g, "").replace(/\/$/, "")}/app/installa`;

  return (
    <div className="space-y-4">
      <div>
        <Link href="/app/profilo" className="font-display text-sm font-bold text-blue hover:underline">← Profilo</Link>
        <h1 className="mt-1.5 font-display text-[23px] font-black tracking-[-0.03em] text-navy">App &amp; notifiche</h1>
        <p className="mt-1.5 text-sm font-medium text-muted">Due passi e sei pronto: metti WashLoop in schermata Home e attiva le notifiche.</p>
      </div>
      <InstallGuide url={url} />
    </div>
  );
}
