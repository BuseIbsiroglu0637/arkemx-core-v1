import type { Metadata } from "next";
import { SiteFooter, SiteHeader } from "../components/SiteChrome";
import { SketchfabModelLibrary } from "../components/SketchfabModelLibrary";

export const metadata: Metadata = {
  title: "3B Model Kütüphanesi | Sketchfab Projeleri",
  description: "Özenç Öztürk Sketchfab hesabındaki Arkem yapı modellerini siteyi terk etmeden döndürün, yakınlaştırın, tam ekran inceleyin ve teknik model verilerini görün.",
  alternates: { canonical: "/3b-model-kutuphanesi" },
};

const capabilities = [
  ["01", "Site içi model görüntüleme", "Kullanıcı başka bir sayfaya yönlenmeden modeli döndürür, yakınlaştırır, kesitleri ve varsa açıklama noktalarını inceler."],
  ["02", "Canlı kütüphane eşleme", "Sketchfab public API, ozenczturk hesabında yayınlanan açık modelleri ve güncel teknik istatistikleri otomatik olarak listeye alır."],
  ["03", "VR / XR hazır görüntüleyici", "Model ve cihaz desteğine göre tam ekran, WebXR veya VR çalışma akışı Sketchfab Viewer üzerinden erişilebilir."],
  ["04", "Proje verisine bağlanma", "Bir sonraki katmanda model kimliği; Arkem Proje OS içindeki doküman, RFI, revizyon ve teslim kayıtlarıyla ilişkilendirilebilir."],
];

export default function ModelLibraryPage(){return <main className="inner-page model-library-page">
  <section className="model-library-hero"><SiteHeader/><div className="shell"><p className="eyebrow light">Arkem Dijital Model Arşivi</p><h1>Projeleri listede değil,<br/><em>üç boyut içinde inceleyin.</em></h1><p>Sketchfab, burada bir sosyal medya kısayolu değil; Arkem’in site içine gömülü, seçilebilir ve büyüyen teknik model kütüphanesidir.</p><a className="button copper" href="#model-kutuphanesi">Modelleri İnceleyin <span>↓</span></a></div><div className="shell model-library-index"><span>PUBLIC API</span><span>SITE İÇİ VIEWER</span><span>VR / XR</span><span>MODEL METADATA</span></div></section>
  <section className="section shell model-library-intro"><div><p className="eyebrow">Canlı Proje Akışı</p><h2>Yeni model yayınlandığında<br/><em>kütüphane büyür.</em></h2></div><p>Arayüz, ozenczturk hesabının açık model akışını tarayıcıda eşler. Her proje ayrı seçim kartı, etkileşimli görüntüleyici, yayın tarihi, geometri istatistiği ve lisans bilgisiyle aynı sayfada incelenir.</p></section>
  <section id="model-kutuphanesi" className="model-library-live"><div className="shell"><SketchfabModelLibrary/></div></section>
  <section className="section shell model-capability-grid">{capabilities.map(([no,title,copy])=><article key={no}><span>{no}</span><h3>{title}</h3><p>{copy}</p></article>)}</section>
  <section className="service-cta"><div className="shell"><p className="eyebrow light">Model Arşivini Genişletin</p><h2>GLB, IFC veya görselleştirmeyi<br/><em>müşteri deneyimine dönüştürelim.</em></h2><div className="actions"><a className="button copper" href="/iletisim">Model Entegrasyonu Talep Edin <span>↗</span></a><a className="button ghost" href="/tasarim-calismalari">3B Tasarım Stüdyosu <span>↗</span></a></div></div></section>
  <SiteFooter/>
</main>}
