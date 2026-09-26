import type { Metadata } from "next";
import Link from "next/link";
import { ProjectDecisionAssistant } from "../components/ProjectDecisionAssistant";
import { SiteFooter, SiteHeader } from "../components/SiteChrome";

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
  return <main className="inner-page decision-page">
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(assistantSchema) }} />
    <section className="inner-hero decision-hero"><SiteHeader/><div className="shell inner-hero-content"><nav className="breadcrumb" aria-label="Sayfa yolu"><Link href="/">Ana Sayfa</Link><span>/</span><span>Proje Karar Asistanı</span></nav><p className="eyebrow light">Arkem Dijital Araçlar</p><h1>Projenizin ilk yol haritasını<br/><em>birkaç dakikada oluşturun.</em></h1><p>Yapı türü, mevcut belgeler ve önceliklerinizi seçin; hangi teknik hizmetle başlamanız gerektiğini ve eksik veri listenizi görün.</p><div className="assistant-trust"><span>✓ Ücretsiz ön hazırlık</span><span>✓ Veri kaydı yok</span><span>✓ WhatsApp özeti</span></div></div></section>
    <section id="karar-motoru" className="section shell"><ProjectDecisionAssistant/></section>
    <section className="assistant-boundary"><div className="shell"><b>Önemli kapsam notu</b><p>Bu araç teklif, statik hesap, ruhsat uygunluğu veya kesin sistem seçimi üretmez. Sonuçlar yalnızca ilk görüşmeyi hazırlamak içindir; projeye özel kararlar yetkili uzman incelemesiyle verilir.</p></div></section>
    <SiteFooter/>
  </main>;
}
