import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter, SiteHeader } from "../components/SiteChrome";
import { primaryStructuralSystems } from "../data/structural-systems";
import { site } from "../data/site";

export const metadata: Metadata = {
  title: "Yapı Sistemleri | Prefabrik, Çelik, Hafif Çelik ve Hibrit",
  description: "Betonarme prefabrik, yapısal çelik, hafif çelik ve hibrit sistemleri kullanım alanları, avantajları, sınırları ve teknik yaklaşımlarıyla inceleyin. Betonarme rehberine ayrıca ulaşın.",
  alternates: { canonical: "/yapi-sistemleri" },
  openGraph: {
    title: "Yapı Sistemleri Bilgi Merkezi | Arkem",
    description: "Dört ana taşıyıcı sistemi teknik karar başlıklarıyla karşılaştırın; destekleyici betonarme rehberini ayrıca inceleyin.",
    images: [{ url: "/arkem-social-share.png", width: 1200, height: 630, alt: "Arkem Yapı Sistemleri" }],
  },
};

const schema = {
  "@context": "https://schema.org",
  "@type": "CollectionPage",
  name: "Arkem Yapı Sistemleri Bilgi Merkezi",
  description: "Taşıyıcı yapı sistemleri için teknik bilgi merkezi.",
  url: `${site.hostedDomain}/yapi-sistemleri`,
  inLanguage: "tr-TR",
  hasPart: primaryStructuralSystems.map((system) => ({
    "@type": "WebPage",
    name: system.name,
    url: `${site.hostedDomain}/yapi-sistemleri/${system.slug}`,
  })),
};

export default function StructuralSystemsPage() {
  return <main className="inner-page system-hub-page">
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />
    <section className="inner-hero system-hub-hero">
      <SiteHeader />
      <div className="shell inner-hero-content">
        <nav className="breadcrumb" aria-label="Sayfa yolu"><Link href="/">Ana Sayfa</Link><span>/</span><span>Yapı Sistemleri</span></nav>
        <p className="eyebrow light">DÖRT ANA YAPI SİSTEMİ</p>
        <h1>Malzemeyi değil,<br/><em>doğru sistemi seçin.</em></h1>
        <p>Betonarme prefabrik, yapısal çelik, hafif çelik ve hibrit sistemleri; kullanım alanı, avantaj, sınır ve teknik yaklaşım başlıklarıyla inceleyin.</p>
        <div className="assistant-trust"><span>✓ 4 ana sistem</span><span>✓ Açık avantaj ve sınırlar</span><span>✓ Kanıta bağlı proje eşlemesi</span></div>
      </div>
    </section>

    <section className="section shell system-hub-intro">
      <div><p className="eyebrow">Sistem Seçimi</p><h2>Tek bir “en iyi” yok.<br/><em>Projeye uygun çözüm var.</em></h2></div>
      <div><p>Açıklık, kat, zemin, yük, yangın, üretim, lojistik, takvim ve bütçe aynı kararın girdileridir. Arkem yaklaşımı, alternatifleri aynı ihtiyaç programı üzerinde görünür ve karşılaştırılabilir hâle getirir.</p><Link className="text-link" href="/yapi-sistemi-karsilastirma">Karşılaştırma aracını kullanın <span aria-hidden="true">↗</span></Link></div>
    </section>

    <section className="system-hub-list section"><div className="shell">
      {primaryStructuralSystems.map((system, index) => <article key={system.id} className="system-hub-card">
        <Link className="system-hub-card-image" href={`/yapi-sistemleri/${system.slug}`}><img src={system.image} alt={system.imageAlt}/><span>{String(index + 1).padStart(2, "0")}</span></Link>
        <div>
          <p className="eyebrow">{system.eyebrow}</p>
          <h2>{system.name}</h2>
          <p>{system.summary}</p>
          <div className="system-card-tags">{system.suitableFor.slice(0, 3).map((item) => <span key={item}>{item}</span>)}</div>
          <Link className="text-link" href={`/yapi-sistemleri/${system.slug}`}>Teknik rehberi açın <span aria-hidden="true">↗</span></Link>
        </div>
      </article>)}
      <aside className="v3d-supporting-guide"><div><p className="eyebrow">Destekleyici sistem rehberi</p><h2>Betonarme</h2></div><div><p>Betonarme; temel, çekirdek, yerinde dökme bölümler ve hibrit sistem arayüzlerinde ayrıca değerlendirilir. Ana dört sistem hiyerarşisini bozmadan teknik rehberi erişilebilir tutuyoruz.</p><Link className="text-link" href="/yapi-sistemleri/betonarme">Betonarme rehberini açın <span aria-hidden="true">↗</span></Link></div></aside>
    </div></section>

    <section className="service-cta"><div className="shell"><p className="eyebrow light">Karşılaştırmalı Ön Değerlendirme</p><h2>Projeniz için hangi sistemler<br/><em>birlikte incelenmeli?</em></h2><Link className="button copper" href="/yapi-sistemi-karsilastirma">Sistem Adaylarını Karşılaştır <span aria-hidden="true">↗</span></Link></div></section>
    <SiteFooter />
  </main>;
}
