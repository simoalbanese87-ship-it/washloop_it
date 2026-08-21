import { Header } from "@/components/marketing/Header";
import { Footer } from "@/components/marketing/Footer";
import { ChiediAWashLoop } from "@/components/marketing/ChiediAWashLoop";

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Header />
      <main className="flex-1">{children}</main>
      <Footer />
      <ChiediAWashLoop />
    </>
  );
}
