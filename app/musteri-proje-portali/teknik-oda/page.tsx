import type { Metadata } from "next";
import Link from "next/link";
import { ClientTechnicalProjectRoom } from "../../components/ClientTechnicalProjectRoom";
import { SiteFooter, SiteHeader } from "../../components/SiteChrome";

export const metadata: Metadata = {
  title: "Teknik Proje Odası | ARKEMX",
  description: "ARKEMX proje verisini kalite kapıları, mühendislik incelemeleri, onaylar, teslim paketi ve entegrasyon sınırlarıyla ayrıntılı gösterir.",
  alternates: { canonical: "/musteri-proje-portali/teknik-oda" },
};

export default function ClientTechnicalProjectRoomPage() {
  return <main className="inner-page client-portal-page">
    <section className="portal-page-hero v108-technical-room-hero">
      <SiteHeader/>
      <div className="shell portal-page-hero-grid">
        <div>
          <nav className="breadcrumb" aria-label="Sayfa yolu"><Link href="/">Ana Sayfa</Link><span>/</span><Link href="/musteri-proje-portali">Müşteri Portalı</Link><span>/</span><span>Teknik Proje Odası</span></nav>
          <p className="eyebrow light">ARKEMX / MÜŞTERİ PROJE PORTALI / TEKNİK ODA</p>
          <h1>Teknik veriyi,<br/><em>ayrıntılı inceleyin.</em></h1>
          <p>Kalite kapıları, disiplin kontrolleri, onaylar, teslim paketi ve entegrasyon sınırları uzman kullanıcılar için bu ikinci seviyede korunur.</p>
          <Link className="v108-back-to-simple" href="/musteri-proje-portali">Sade müşteri görünümüne dönün →</Link>
        </div>
      </div>
    </section>
    <section className="section shell"><ClientTechnicalProjectRoom/></section>
    <SiteFooter/>
  </main>;
}
