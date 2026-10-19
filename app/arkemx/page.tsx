import type { Metadata } from "next";
import Link from "next/link";
import { ArkemXRegistryExplorer } from "../components/ArkemXRegistryExplorer";
import { CustomerProjectGuide } from "../components/CustomerProjectGuide";
import { SiteFooter, SiteHeader } from "../components/SiteChrome";
import {
  arkemXDevelopmentJournal,
  arkemXModuleRegistry,
  arkemXRoadmap,
} from "../data/arkemx-module-registry";
import {
  publicArkemXModuleGroups,
  publicArkemXModules,
} from "../data/arkemx-public-projection";

export const metadata: Metadata = {
  title: { absolute: "ARKEMX | Dijital Yapı Mühendisliği Platformu | ARKEM" },
  description: "ARKEMX; proje modeli, yapısal analiz, deprem, betonarme, prefabrik, çelik, hafif çelik, metraj, doğrulama ve yapım süreçlerini ortak veri omurgasında geliştiren ARKEM platformudur.",
  alternates: { canonical: "/arkemx" },
  openGraph: {
    title: "ARKEMX | Dijital Yapı Mühendisliği Platformu | ARKEM",
    description: "Proje modeli, analiz, sistem tasarımı, detay, metraj, doğrulama ve yapım süreçlerini ortak veri omurgasında birleştiren ARKEM platformu.",
    url: "/arkemx",
    images: [{ url: "/visuals/arkem-x-coordination-v2.webp", width: 1200, height: 630, alt: "ARKEMX ortak proje verisi ve bağlı mühendislik akışı" }],
  },
};

const decisionEffects = ["Analiz sonucu", "Sistem kararı", "Detay", "Metraj", "Üretim verisi"] as const;
const constructionStages = ["Üretim", "Taşıma", "Kaldırma", "Geçici durum", "Montaj", "Nihai sistem"] as const;
const activeModuleCount = arkemXModuleRegistry.filter((module) => module.status.startsWith("AKTİF")).length;
const validatingModuleCount = arkemXModuleRegistry.filter((module) => module.status === "DOĞRULANIYOR").length;
const moduleStructuredData = {
  "@context": "https://schema.org",
  "@type": "ItemList",
  name: "ARKEMX Proje Mühendisliği Modülleri",
  numberOfItems: arkemXModuleRegistry.length,
  itemListElement: arkemXModuleRegistry.map((module, index) => ({
    "@type": "ListItem",
    position: index + 1,
    name: module.title,
    description: module.seoDescription,
    url: `https://arkemyapisistemleri.com/arkemx#${module.id}`,
  })),
};
export default function ArkemXPage() {
  return <main className="inner-page v21-arkemx v31-arkemx v4-arkemx-page">
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(moduleStructuredData) }} />
    <div className="customer-site-header"><SiteHeader /></div>
    <CustomerProjectGuide />
    <details className="customer-technical"><summary>Mühendislik modülleri ve teknik kapsam</summary>
    <section className="v21-x-hero v31-x-hero">
      <div className="shell v21-x-hero-copy">
        <p className="v21-index">00 / ARKEMX</p>
        <span className="v31-x-status">AKTİF · SÜREKLİ GELİŞTİRİLİYOR</span>
        <h2>FARKLI SİSTEMLER.<br /><em>ORTAK PROJE VERİSİ.</em></h2>
        <p>ARKEMX, ARKEM’in mühendislik Ar-Ge ve dijital proje platformudur. Yapısal analizden sistem tasarımına, detaylandırmadan metraj ve yapım aşamalarına uzanan mühendislik süreçlerini ortak proje verisi üzerinde geliştirir.</p>
        <div className="v21-actions">
          <a className="v21-button v21-button-copper" href="#proje-modulleri">Ortak Proje Omurgasını İnceleyin <span aria-hidden="true">↓</span></a>
        </div>
      </div>
    </section>

    <section className="v21-section v31-x-intro" id="veri-akisi">
      <div className="shell v21-two-column">
        <div><p className="v21-index">01 / ARKEM DİJİTAL MÜHENDİSLİK PLATFORMU</p><h2>Aynı proje.<br /><em>Birbirine bağlı mühendislik verisi.</em></h2></div>
        <div>
          <p>ARKEMX yaşayan bir mühendislik platformudur; çalışan fonksiyonlar korunurken doğrulama, kapsam ve entegrasyon sürekli genişletilmektedir.</p>
          <p><strong>Platformun farkı modül sayısı değil; bir mühendislik kararının bağlı süreçlerdeki etkisini ortak proje verisi üzerinden izleyebilmesidir.</strong></p>
        </div>
      </div>
    </section>

    <section className="v21-section v31-registry-section" id="proje-modulleri">
      <span id="cekirdek" className="v31-anchor" aria-hidden="true" />
      <div className="shell">
        <header className="v21-section-head v21-section-head-light">
          <div><p className="v21-index">02 / 13 PROJE MÜHENDİSLİĞİ MODÜLÜ</p><h2>Ortak proje omurgası.<br /><em>Beş mühendislik grubu.</em></h2></div>
          <p>Bu 13 alan müşteriye dönük proje mühendisliği modülleridir; kaynak kodundaki klasör veya teknik bileşen sayısı değildir. Önce grup, sonra modül, ardından çalışan işlev ve geliştirme durumu açılır.</p>
        </header>
        <ArkemXRegistryExplorer groups={publicArkemXModuleGroups} modules={publicArkemXModules} locale="tr" />
      </div>
    </section>

    <section className="v21-section v31-working-section" id="calisan-moduller">
      <div className="shell">
        <header className="v21-section-head">
          <div><p className="v21-index">03 / ÇALIŞAN PROJE AKIŞI</p><h2>Çalışanı koru.<br /><em>Üzerine ekle.</em></h2></div>
          <p>Kabulü geçen çalışma alanları kullanıcı girdisi alır ve kapsamı tanımlı çıktı üretir. Temel işlev kabulü tamamlanmayan modüller aktif gösterilmez; yeni geliştirmeler çalışan davranışı kapatmadan ilerler.</p>
        </header>
        <div className="v31-working-status" aria-label="ARKEMX çalışma durumu">
          <article><span>13</span><strong>TEMEL İŞLEV AKIŞI KAYITLI</strong><p>Temel işlev ve test kapsamı kayıtlıdır; mühendislik doğrulaması modül bazında sürmektedir.</p></article>
          <article><span>{String(validatingModuleCount).padStart(2, "0")}</span><strong>DOĞRULANIYOR</strong><p>Mühendislik kapsamı ve temel işlev kabul kapıları tamamlanıyor; doğrulanmış alanlar ayrıca gösteriliyor.</p></article>
          <article><span>{String(activeModuleCount).padStart(2, "0")}</span><strong>AKTİF · GELİŞTİRİLİYOR</strong><p>Aktif ürün işlevleri korunurken kapsam ve entegrasyon genişletiliyor.</p></article>
        </div>
      </div>
    </section>

    <section className="v21-section v31-decision-section" id="karar-etkisi">
      <div className="shell">
        <header className="v21-section-head">
          <div><p className="v21-index">04 / KARARIN ZİNCİRLEME ETKİSİ</p><h2>Kolon kesiti değişir.<br /><em>Bağlı veri güncellenir.</em></h2></div>
          <p>Bir kesit değişikliği yalnız analiz sonucunu değil; sistem kararını, detayı, metrajı ve üretim verisini de etkiler. ARKEMX bu ilişkiyi ortak proje omurgasında görünür kılmayı geliştirir.</p>
        </header>
        <ol className="v31-decision-flow">
          <li><span>00</span><b>KOLON KESİTİ</b><small>DEĞİŞİKLİK</small></li>
          {decisionEffects.map((effect, index) => <li key={effect}><span>{String(index + 1).padStart(2, "0")}</span><b>{effect}</b><small>ETKİLENEN KAYIT</small></li>)}
        </ol>
      </div>
    </section>

    <section className="v21-section v31-construction-section" id="yapim-asamalari">
      <div className="shell">
        <header className="v21-section-head v21-section-head-light">
          <div><p className="v21-index">05 / ANALİZDEN SAHAYA</p><h2>Aynı eleman.<br /><em>Farklı mühendislik durumları.</em></h2></div>
          <p>Özellikle prefabrik ve montajlı sistemlerde eleman; üretim, taşıma, kaldırma, geçici sabitleme, montaj ve nihai sistem boyunca farklı mühendislik durumları taşır.</p>
        </header>
        <ol className="v31-construction-flow">{constructionStages.map((stage, index) => <li key={stage}><span>{String(index + 1).padStart(2, "0")}</span><b>{stage}</b></li>)}</ol>
      </div>
    </section>

    <section className="v21-section v31-validation-section" id="dogrulama">
      <div className="shell">
        <header className="v21-section-head">
          <div><p className="v21-index">06 / DOĞRULAMA VE İZLENEBİLİRLİK</p><h2>Bir sonuç yalnızca hesaplanmaz.<br /><em>Doğrulanır.</em></h2></div>
          <p>Girdi, teknik kaynak, ara hesap, kontrol eden kombinasyon, sonuç ve kullanım sınırı aynı kayıt zincirinde incelenebilir olmalıdır.</p>
        </header>
        <div className="v31-validation-grid">
          {[
            ["01", "KAYNAK", "Teknik veri ve kabul kaynağı"],
            ["02", "GİRDİ", "Model, geometri, yük ve malzeme"],
            ["03", "KONTROL", "Benchmark ve regresyon kapsamı"],
            ["04", "SONUÇ", "Çıktı, sınır ve revizyon izi"],
          ].map(([code, title, copy]) => <article key={code}><span>{code}</span><h3>{title}</h3><p>{copy}</p></article>)}
        </div>
      </div>
    </section>

    <section className="v21-section v31-journal-section" id="gelisim-gunlugu">
      <div className="shell">
        <header className="v21-section-head v21-section-head-light">
          <div><p className="v21-index">07 / GELİŞİM GÜNLÜĞÜ</p><h2>Çalışan sistem.<br /><em>Görünür gelişim.</em></h2></div>
          <p>Kod commitleri yerine müşterinin anlayacağı ürün değişiklikleri yayımlanır. Her kayıt aktif işlev, kapsam, doğrulama veya entegrasyondaki gerçek ilerlemeyi açıklar.</p>
        </header>
        <div className="v31-journal-list">{arkemXDevelopmentJournal.map((entry, index) => <article key={`${entry.period}-${entry.title}`}><span>{String(index + 1).padStart(2, "0")}</span><small>{entry.period}</small><h3>{entry.title}</h3><p>{entry.summary}</p></article>)}</div>
      </div>
    </section>

    <section className="v21-section v31-roadmap-section" id="urun-durumu">
      <div className="shell">
        <header className="v21-section-head">
          <div><p className="v21-index">08 / GELİŞİM YOL HARİTASI</p><h2>Tarihten önce<br /><em>doğrulama kapısı.</em></h2></div>
          <p>Yol haritası kesin teslim tarihi vaadi vermez; çalışan işlevleri koruyarak doğrulama, veri sürekliliği ve entegrasyon derinliğinin hangi yönde geliştiğini gösterir.</p>
        </header>
        <div className="v31-roadmap-grid" aria-label="ŞİMDİ · SONRAKİ GELİŞİM · UZUN VADELİ">{arkemXRoadmap.map((item, index) => <article key={item.stage}><span>{String(index + 1).padStart(2, "0")}</span><h3>{item.stage}</h3><p>{item.summary}</p></article>)}</div>
        <div className="v31-x-final">
          <p>Analizden sahaya izlenebilir mühendislik.</p>
          <div className="v21-actions">
            <Link className="v21-button v21-button-copper" href="/iletisim">Projenizi Değerlendirelim <span aria-hidden="true">↗</span></Link>
            <Link className="v21-button v21-button-dark" href="/projeler">Proje Arşivini İnceleyin <span aria-hidden="true">↗</span></Link>
          </div>
        </div>
      </div>
    </section>

    </details>
    <SiteFooter />
  </main>;
}
