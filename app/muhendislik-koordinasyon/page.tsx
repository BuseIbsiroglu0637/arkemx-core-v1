import type { Metadata } from "next";
import { EngineeringCoordinationStudio } from "../components/EngineeringCoordinationStudio";
import { SiteFooter } from "../components/SiteChrome";
import { ModuleWorkspaceHeader } from "../components/ModuleWorkspaceHeader";

export const metadata: Metadata = {
  title: "BIM ve Disiplin Koordinasyonu | ARKEM",
  description: "V113 mimari şeması ile V114 taşıyıcı sistemini ortak aks ve kotlarda birleştiren; çakışma, IFC/BCF hazırlık, metraj, karbon ve 4B/5B göstergeleri üreten Arkem koordinasyon stüdyosu.",
  alternates: { canonical: "/muhendislik-koordinasyon" },
};

export default function EngineeringCoordinationPage() {
  return <main className="inner-page engineering-coordination-page module-workspace-page">
    <ModuleWorkspaceHeader title="Proje çelişkilerini birlikte görün" description="Disiplinler arasındaki açık konuları kaynak, sorumlu ve inceleme durumuyla düzenleyin. Ön göstergeler onaylı mühendislik hesabı değildir." target="koordinasyon-motoru" />
    
    <section id="koordinasyon-motoru" className="coordination-live-section"><div className="section shell"><EngineeringCoordinationStudio/></div></section>
  <section className="section shell coordination-intro"><div><p className="eyebrow">BIM ve Disiplin Koordinasyonu</p><h2>Ortak model kadar,<br/><em>ortak sorumluluk da kurun.</em></h2></div><div><p>V115 yalnız geometrileri üst üste koymaz; her çelişkiyi tür, konum, kaynak eleman, disiplin, sorumlu, kanıt, aksiyon ve kapanış durumuyla izlenebilir konuya dönüştürür.</p><p>Metraj, yapısal karbon, 4B süre ve 5B göreli maliyet bağlantıları erken karar göstergesidir. Native IFC modeli, BCFZIP, sertifikalı LCA, onaylı iş programı ve maliyet hesabı için yetkili proje verisi gerekir.</p></div></section>
  <SiteFooter/>
  </main>;
}
