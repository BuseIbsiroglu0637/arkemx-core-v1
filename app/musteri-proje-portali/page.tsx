import type { Metadata } from "next";
import Link from "next/link";
import { ClientProjectPortal } from "../components/ClientProjectPortal";
import { SiteFooter, SiteHeader } from "../components/SiteChrome";

export const metadata: Metadata = {
  title: "Müşteri Proje Portalı | ARKEMX",
  description: "ARKEMX müşteri portalı; sıradaki işi, proje özetini, kararları ve dosyaları sade bir çalışma alanında birleştirir.",
  alternates: { canonical: "/musteri-proje-portali" },
};

export default function ClientProjectPortalPage() {
  return <main className="inner-page client-portal-page">
    <section className="portal-page-hero v108-portal-hero"><SiteHeader/><div className="shell portal-page-hero-grid"><div><nav className="breadcrumb" aria-label="Sayfa yolu"><Link href="/">Ana Sayfa</Link><span>/</span><Link href="/dijital-proje-merkezi">ARKEMX</Link><span>/</span><span>Müşteri Portalı</span></nav><p className="eyebrow light">ARKEMX / MÜŞTERİ PORTALI V108</p><h1>Bugün ne yapacağınızı,<br/><em>tek bakışta görün.</em></h1><p>Sıradaki iş, proje özeti, kararlar ve dosyalar. Teknik ayrıntılar ihtiyaç duyduğunuzda ikinci seviyede açılır.</p></div><aside className="v108-hero-promise"><span>SADE MÜŞTERİ YOLCULUĞU</span><ol><li><b>01</b>Bugün</li><li><b>02</b>Projem</li><li><b>03</b>Kararlar ve Dosyalar</li></ol><small>Hesap ve cihaz kayıtları izniniz olmadan birbirinin üzerine yazılmaz.</small></aside></div></section>
    <section className="section shell"><ClientProjectPortal/></section>
    <section className="portal-principles"><div className="section shell"><article><span>01</span><h3>Tek sıradaki adım</h3><p>Kullanıcı her girişte şimdi ne yapması gerektiğini görür.</p></article><article><span>02</span><h3>Açık sorumluluk</h3><p>Her iş ve kararda sorumlu, durum ve hedef tarih birlikte görünür.</p></article><article><span>03</span><h3>Güvenli kayıt seçimi</h3><p>Hesap ve cihaz sürümleri çelişirse seçim kullanıcıya bırakılır.</p></article></div></section>
    <SiteFooter/>
  </main>;
}
