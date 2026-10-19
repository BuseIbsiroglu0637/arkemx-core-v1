import type { Metadata } from "next";
import { SiteFooter } from "../components/SiteChrome";
import { ModuleWorkspaceHeader } from "../components/ModuleWorkspaceHeader";
import { SystemComparisonTool } from "../components/SystemComparisonTool";

export const metadata: Metadata = {
  title: "Yapı Sistemi Karşılaştırma Aracı",
  description: "Hafif çelik, yapısal çelik, betonarme prefabrik, betonarme ve karma sistemleri proje girdilerinize göre karşılaştırın.",
  alternates: { canonical: "/yapi-sistemi-karsilastirma" },
  openGraph: { title: "Yapı Sistemi Karşılaştırma Aracı | Arkem", description: "Projeniz için hangi taşıyıcı sistemlerin birlikte incelenmesi gerektiğini birkaç adımda görün." },
};

const schema = { "@context": "https://schema.org", "@type": "WebApplication", name: "Arkem Yapı Sistemi Karşılaştırma Aracı", applicationCategory: "BusinessApplication", operatingSystem: "Web", isAccessibleForFree: true, inLanguage: "tr-TR" };

export default function SystemComparisonPage() {
  return <main className="inner-page comparison-page module-workspace-page"><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}/><ModuleWorkspaceHeader title="Yapı sistemi alternatiflerini karşılaştırın" description="Önceliklerinizi ve bildiğiniz girdileri düzenleyin. Kural tabanlı gösterim puanları teknik uygunluk veya kesin sistem seçimi değildir." target="sistem-karsilastirma" /><section id="sistem-karsilastirma" className="section shell"><SystemComparisonTool/></section><section className="assistant-boundary"><div className="shell"><b>Mühendislik sınırı</b><p>Araç genel karakteristikleri karşılaştırır; statik hesap, keşif, teklif, ruhsat uygunluğu veya kesin sistem seçimi üretmez. Nihai karar projeye özel veriler ve yetkili uzman değerlendirmesiyle verilir.</p></div></section><SiteFooter/></main>;
}
