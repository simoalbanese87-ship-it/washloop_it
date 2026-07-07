import Link from "next/link";
import { InstallGuide } from "@/components/app/InstallGuide";

export const metadata = { title: "Installa l'app — WashLoop" };

export default function InstallaPage() {
  return (
    <div className="space-y-4">
      <div>
        <Link href="/app/profilo" className="font-display text-sm font-bold text-blue hover:underline">← Profilo</Link>
        <h1 className="mt-1.5 font-display text-[23px] font-black tracking-[-0.03em] text-navy">App & notifiche</h1>
        <p className="mt-1.5 text-sm font-medium text-muted">Due passi e sei pronto: metti WashLoop in schermata Home e attiva le notifiche.</p>
      </div>
      <InstallGuide />
    </div>
  );
}
