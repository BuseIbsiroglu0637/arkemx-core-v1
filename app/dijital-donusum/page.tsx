import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { SiteFooter, SiteHeader } from "../components/SiteChrome";

export const metadata: Metadata = {
  title: "Dijital Araçlar | ARKEM Yapı Sistemleri",
  description: "Yeni proje başlangıcından arsa fizibilitesine, sistem seçiminden proje ve şantiye takibine uzanan ARKEM dijital araçları.",
  alternates: { canonical: "/dijital-donusum" },
};

const entryPoints = [
  { code: "01", title: "Yeni proje başlatacağım", note: "Teknik bilgi gerekmeden beş sade adım", href: "/proje-baslat" },
  { code: "02", title: "Arsamı değerlendireceğim", note: "Konum, parsel ve ön fizibilite", href: "/arsa-fizibilite-studyosu" },
  { code: "03", title: "Taşıyıcı sistem seçeceğim", note: "Prefabrik, çelik, hafif çelik ve hibrit", href: "/yapi-sistemi-karsilastirma" },
  { code: "04", title: "Mevcut projeme devam edeceğim", note: "Sıradaki iş, kararlar ve dosyalar", href: "/musteri-proje-portali" },
] as const;

const ecosystemProducts = [
  { code: "01", stage: "Fırsat", title: "Fırsat Radarı", outcome: "Bölge, yatırım türü ve erken fırsat kayıtlarını tek görünümde toplar.", status: "Temel altyapı", href: "/iletisim", action: "Bilgi alın" },
  { code: "02", stage: "Arsa", title: "Arsa Fizibilitesi", outcome: "Parseli, çevresini ve yapılaşma girdilerini erken karar için görünür kılar.", status: "Kararlı prototip", href: "/arsa-fizibilite-studyosu", action: "Aracı aç" },
  { code: "03", stage: "Tasarım", title: "ARKEMX", outcome: "Proje hedefini, yapı sistemini ve mühendislik kararlarını ortak proje verisinde ilerletir.", status: "Aktif Ar-Ge", href: "/proje-baslat", action: "Yönlendirmeli başla" },
  { code: "04", stage: "Metraj", title: "Metraj ve Maliyet", outcome: "Miktarları, değişiklikleri ve maliyet etkisini aynı proje kaydıyla ilişkilendirir.", status: "İleri prototip", href: "/proje-os", action: "Prototipi incele" },
  { code: "05", stage: "Planlama", title: "Proje Kontrolü", outcome: "Teklif, karar, süre ve bütçe başlıklarını yönetilebilir bir akışta birleştirir.", status: "Mimarisi tanımlı", href: "/proje-os", action: "Kapsamı incele" },
  { code: "06", stage: "Şantiye", title: "Şantiye Maliyet Takibi", outcome: "Şantiyedeki harcama, ilerleme ve sapmaları proje hedefleriyle karşılaştırır.", status: "Mimarisi tanımlı", href: "/musteri-proje-portali", action: "Müşteri görünümünü aç" },
  { code: "07", stage: "İş akışı", title: "İş ve Süreç Yönetimi", outcome: "Görevleri, sorumluları, kararları ve teslimleri tek çalışma düzeninde izler.", status: "Mimarisi tanımlı", href: "/musteri-proje-portali", action: "Müşteri görünümünü aç" },
] as const;

const customerPaths = [
  { title: "Mimar / yatırımcı", need: "Arsayı ve yatırım kararını netleştirmek", tools: "Arsa Fizibilitesi · Metraj ve Maliyet", href: "/arsa-fizibilite-studyosu" },
  { title: "Mühendislik ofisi", need: "Tasarım ve sistem kararını ortak veride ilerletmek", tools: "ARKEMX · Metraj ve Maliyet", href: "/proje-baslat" },
  { title: "Müteahhit / şantiye", need: "Süreyi, maliyeti ve saha kayıtlarını yönetmek", tools: "Proje Kontrolü · Şantiye Takibi · İş Yönetimi", href: "/proje-os" },
  { title: "Kurumsal müşteri", need: "Fırsattan teslimata kadar tek proje zinciri kurmak", tools: "Tüm dijital ürünler · ARKEMX", href: "/iletisim" },
] as const;

const Arrow = () => <ArrowUpRight size={17} strokeWidth={1.7} aria-hidden="true" />;

export default function DigitalToolsPage() {
  return <main className="v117-digital-page">
    <section className="v117-digital-hero">
      <SiteHeader />
      <div className="shell v117-digital-hero-grid">
        <div className="v117-digital-intro">
          <nav className="breadcrumb" aria-label="Sayfa yolu"><Link href="/">Ana Sayfa</Link><span>/</span><span>Dijital Araçlar</span></nav>
          <p className="v4-index">ARKEM / DİJİTAL YAPI EKOSİSTEMİ</p>
          <h1>Projeniz hangi aşamada?</h1>
          <p>Ürün veya modül adı bilmeniz gerekmiyor. Yapmak istediğiniz işi seçin; doğru araç ve sıradaki adım birlikte açılsın.</p>
          <div className="v117-digital-hero-actions">
            <Link className="v4-button is-primary" href="/proje-baslat">Yeni proje başlat <Arrow /></Link>
            <Link className="v4-button is-secondary" href="/musteri-proje-portali">Projeme devam et <Arrow /></Link>
          </div>
        </div>
        <aside className="v117-entry-panel" aria-labelledby="v117-entry-title">
          <span>HIZLI YÖNLENDİRME</span>
          <h2 id="v117-entry-title">Ne yapmak istiyorsunuz?</h2>
          <div>{entryPoints.map((item) => <Link href={item.href} key={item.code}><span>{item.code}</span><div><b>{item.title}</b><small>{item.note}</small></div><Arrow /></Link>)}</div>
        </aside>
      </div>
    </section>

    <section className="v117-product-journey">
      <div className="shell">
        <header className="v117-section-head"><div><p className="v4-index">01 / TEK PROJE ZİNCİRİ</p><h2>Yedi ürün.<br /><em>Birbirini kaybetmeyen proje verisi.</em></h2></div><p>Her ürün farklı bir müşteri sorununu çözer. ARKEMX bu ürünlerden biridir; kendi içindeki 13 mühendislik modülü burada ayrıca menüye yüklenmez.</p></header>
        <ol>{ecosystemProducts.map((product) => <li key={product.code}>
          <Link href={product.href}>
            <header><span>{product.code}</span><small>{product.stage}</small></header>
            <div><p>{product.status}</p><h3>{product.title}</h3><span>{product.outcome}</span></div>
            <footer><b>{product.action}</b><Arrow /></footer>
          </Link>
        </li>)}</ol>
      </div>
    </section>

    <section className="v117-customer-paths">
      <div className="shell">
        <header className="v117-section-head"><div><p className="v4-index">02 / SİZE GÖRE BAŞLANGIÇ</p><h2>Mesleğinizi değil,<br /><em>ihtiyacınızı seçin.</em></h2></div><p>Aynı ürün listesinde kaybolmak yerine kendi işinize en yakın başlangıç yolunu açın.</p></header>
        <div className="v117-path-grid">{customerPaths.map((path, index) => <Link href={path.href} key={path.title}><span>{String(index + 1).padStart(2, "0")}</span><h3>{path.title}</h3><p>{path.need}</p><small>{path.tools}</small><b>Bu yoldan başlayın <Arrow /></b></Link>)}</div>
      </div>
    </section>

    <section className="v117-digital-final">
      <div className="shell"><div><p className="v4-index">03 / DOĞRU BAŞLANGIÇ</p><h2>Teknik terimleri bize bırakın.<br /><em>Siz projenizi anlatın.</em></h2><p>Beş kısa adımda hedefinizi, arsanızı, yapı ihtiyacınızı ve önceliklerinizi tanımlayın.</p></div><div><Link className="v4-button is-primary" href="/proje-baslat">Yönlendirmeli başla <Arrow /></Link><Link className="v4-text-link" href="/arkemx">ARKEMX’in teknik kapsamı <Arrow /></Link></div></div>
    </section>
    <SiteFooter />
  </main>;
}
