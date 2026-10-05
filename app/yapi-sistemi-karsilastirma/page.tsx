import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter, SiteHeader } from "../components/SiteChrome";
import { SystemComparisonTool } from "../components/SystemComparisonTool";

export const metadata: Metadata = {
  title: "Yapı Sistemi Karşılaştırma Aracı",
  description: "Hafif çelik, yapısal çelik, betonarme prefabrik, betonarme ve karma sistemleri proje girdilerinize göre karşılaştırın.",
  alternates: { canonical: "/yapi-sistemi-karsilastirma" },
  openGraph: { title: "Yapı Sistemi Karşılaştırma Aracı | Arkem", description: "Projeniz için hangi taşıyıcı sistemlerin birlikte incelenmesi gerektiğini birkaç adımda görün." },
};

const schema = { "@context": "https://schema.org", "@type": "WebApplication", name: "Arkem Yapı Sistemi Karşılaştırma Aracı", applicationCategory: "BusinessApplication", operatingSystem: "Web", isAccessibleForFree: true, inLanguage: "tr-TR" };

export default function SystemComparisonPage() {
  return <main className="inner-page comparison-page"><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}/><section className="inner-hero comparison-hero"><SiteHeader/><div className="shell inner-hero-content"><nav className="breadcrumb" aria-label="Sayfa yolu"><Link href="/">Ana Sayfa</Link><span>/</span><span>Yapı Sistemi Karşılaştırma</span></nav><p className="eyebrow light">Arkem Dijital Araçlar</p><h1>Taşıyıcı sistem kararını<br/><em>tek veriye bırakmayın.</em></h1><p>Hafif çelik, çelik, betonarme prefabrik, betonarme ve karma sistemleri kullanım, kat, açıklık ve önceliklerinize göre birlikte değerlendirin.</p><div className="assistant-trust"><span>✓ Ücretsiz ön değerlendirme</span><span>✓ Beş sistem</span><span>✓ Veri kaydı yok</span></div></div></section><section id="sistem-karsilastirma" className="section shell"><SystemComparisonTool/></section><section className="assistant-boundary"><div className="shell"><b>Mühendislik sınırı</b><p>Araç genel karakteristikleri karşılaştırır; statik hesap, keşif, teklif, ruhsat uygunluğu veya kesin sistem seçimi üretmez. Nihai karar projeye özel veriler ve yetkili uzman değerlendirmesiyle verilir.</p></div></section><SiteFooter/></main>;
}
