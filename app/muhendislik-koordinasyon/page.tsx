import type { Metadata } from "next";
import Link from "next/link";
import { EngineeringCoordinationStudio } from "../components/EngineeringCoordinationStudio";
import { SiteFooter, SiteHeader } from "../components/SiteChrome";

export const metadata: Metadata = {
  title: "BIM ve Disiplin Koordinasyonu | V115",
  description: "V113 mimari şeması ile V114 taşıyıcı sistemini ortak aks ve kotlarda birleştiren; çakışma, IFC/BCF hazırlık, metraj, karbon ve 4B/5B göstergeleri üreten Arkem koordinasyon stüdyosu.",
  alternates: { canonical: "/muhendislik-koordinasyon" },
};

export default function EngineeringCoordinationPage() {
  return <main className="inner-page engineering-coordination-page">
    <section className="coordination-page-hero"><SiteHeader/><div className="shell"><nav className="breadcrumb" aria-label="Sayfa yolu"><Link href="/">Ana Sayfa</Link><span>/</span><Link href="/dijital-proje-merkezi">Dijital Proje Merkezi</Link><span>/</span><span>Koordinasyon</span></nav><p className="eyebrow light">ARKEM / V115 · INTEGRATED COORDINATION ENGINE</p><h1>Modeli federasyonda birleştirin.<br/><em>Çakışmayı issue olarak kapatın.</em></h1><p>V113 mimari şeması ile V114 taşıyıcı ön tasarımını ortak koordinat, aks, kot ve revizyonda birleştirin; MEP, yangın ve zemin kararlarını IFC/BCF hazırlık zincirine bağlayın.</p><div className="actions"><a className="button copper" href="#koordinasyon-motoru">BIM Koordinasyonunu Açın <span>↓</span></a><Link className="button ghost" href="/dijital-proje-merkezi">Proje Grafiğini Görün <span>↗</span></Link></div></div><div className="shell coordination-hero-strip">{["V113 ARC","V114 STR","MEP","FIRE","GEO","CLASH","IFC4","BCF"].map((item) => <span key={item}>{item}</span>)}</div></section>
    <section className="section shell coordination-intro"><div><p className="eyebrow">BIM ve Disiplin Koordinasyonu</p><h2>Ortak model kadar,<br/><em>ortak sorumluluk da kurun.</em></h2></div><div><p>V115 yalnız geometrileri üst üste koymaz; her çelişkiyi tür, konum, kaynak eleman, disiplin, sorumlu, kanıt, aksiyon ve kapanış durumuyla izlenebilir konuya dönüştürür.</p><p>Metraj, yapısal karbon, 4B süre ve 5B göreli maliyet bağlantıları erken karar göstergesidir. Native IFC modeli, BCFZIP, sertifikalı LCA, onaylı iş programı ve maliyet hesabı için yetkili proje verisi gerekir.</p></div></section>
    <section id="koordinasyon-motoru" className="coordination-live-section"><div className="section shell"><EngineeringCoordinationStudio/></div></section>
    <SiteFooter/>
  </main>;
}
