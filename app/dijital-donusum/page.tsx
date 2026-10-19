import type { Metadata } from "next";
import { DigitalJourneyGateway } from "../components/DigitalJourneyGateway";
import { SiteFooter, SiteHeader } from "../components/SiteChrome";

export const metadata: Metadata = {
  title: "Dijital Araçlar | ARKEM Yapı Sistemleri",
  description: "Yeni proje başlangıcından arsa fizibilitesine, sistem seçiminden proje ve şantiye takibine uzanan ARKEM dijital araçları.",
  alternates: { canonical: "/dijital-donusum" },
};

export default function DigitalToolsPage() {
  return <main className="digital-tools-page">
    <div className="customer-site-header"><SiteHeader dark={false} /></div>
    <DigitalJourneyGateway />
    <SiteFooter />
  </main>;
}
