import type { Metadata } from "next";
import { ProjectDecisionAssistant } from "../components/ProjectDecisionAssistant";
import { SiteFooter } from "../components/SiteChrome";
import { ModuleWorkspaceHeader } from "../components/ModuleWorkspaceHeader";

export const metadata: Metadata = {
  title: "Proje Karar Asistanı",
  description: "Yapı türü, proje aşaması, mevcut belgeler ve önceliklerinize göre ilk teknik adımı ve gerekli veri listesini oluşturun.",
  alternates: { canonical: "/proje-karar-asistani" },
  openGraph: {
    title: "Proje Karar Asistanı | Arkem Yapı Sistemleri",
    description: "Proje verilerinizi birkaç adımda somutlaştırın; doğru hizmeti ve öncelikli yol haritasını görün.",
  },
};

const assistantSchema = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "Arkem Proje Karar Asistanı",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  isAccessibleForFree: true,
  inLanguage: "tr-TR",
  description: "Yapı yatırımı için mevcut proje verilerini düzenleyen ve uygun ilk hizmete yönlendiren ücretsiz ön hazırlık aracı.",
};

export default function ProjectDecisionPage() {
  return <main className="inner-page decision-page module-workspace-page">
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(assistantSchema) }} />
    <ModuleWorkspaceHeader title="İlk görüşmenin yol haritasını oluşturun" description="İhtiyacınızı ve belge durumunuzu anlatın; açık sorularınızla birlikte ilk hizmet adımını görün. Teknik onay üretmez." target="karar-motoru" />
    <section id="karar-motoru" className="section shell"><ProjectDecisionAssistant/></section>
    <section className="assistant-boundary"><div className="shell"><b>Önemli kapsam notu</b><p>Bu araç teklif, statik hesap, ruhsat uygunluğu veya kesin sistem seçimi üretmez. Sonuçlar yalnızca ilk görüşmeyi hazırlamak içindir; projeye özel kararlar yetkili uzman incelemesiyle verilir.</p></div></section>
    <SiteFooter/>
  </main>;
}
