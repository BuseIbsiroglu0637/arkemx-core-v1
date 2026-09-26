import type { Metadata } from "next";
import Link from "next/link";
import { ArchitecturalProgramStudio } from "../components/ArchitecturalProgramStudio";
import { SiteFooter, SiteHeader } from "../components/SiteChrome";

export const metadata: Metadata = {
  title: "Mimari Tasarım Stüdyosu 2.0 | V113",
  description: "V112 yapı zarfını mahal programı, gerçek mesafe tabanlı komşuluk, dolaşım, çekirdek, günışığı ve kaçış ön kontrollerine bağlayan Arkem V113 mimari tasarım stüdyosu.",
  alternates: { canonical: "/mimari-program-studyosu" },
};

export default function ArchitecturalProgramPage() {
  return <main className="inner-page architectural-program-page">
    <section className="architecture-page-hero"><SiteHeader/><div className="shell"><nav className="breadcrumb" aria-label="Sayfa yolu"><Link href="/">Ana Sayfa</Link><span>/</span><Link href="/tasarim-calismalari">Tasarım</Link><span>/</span><span>Mimari Tasarım 2.0</span></nav><p className="eyebrow light">V113 / ARCHITECTURAL SCHEME ENGINE</p><h1>Yapı zarfından<br/><em>izlenebilir mekân şemasına.</em></h1><p>V112 kütlesini mahal, zon, gerçek komşuluk mesafesi, dolaşım, düşey çekirdek, günışığı ve kaçış ön kontrolleriyle tek proje kaydında geliştirin.</p><div className="actions"><a className="button copper" href="#mimari-motor">Şema Motorunu Açın <span>↓</span></a><Link className="button ghost" href="/arsa-fizibilite-studyosu#geo-studyo">V112 Kütlesini Açın <span>↗</span></Link></div></div><div className="shell architecture-hero-strip">{["PROGRAM","MASSING","ADJACENCY","CIRCULATION","CORE","EGRESS*","DAYLIGHT*","PLAN HANDOFF"].map((item) => <span key={item}>{item}</span>)}</div></section>
    <section className="section shell architecture-intro"><div><p className="eyebrow">Mimari Karar Sistemi 2.0</p><h2>Biçimden önce<br/><em>gereksinim, ilişki ve rota.</em></h2></div><div><p>Şema motoru; her mahalin alanını, adedini, kullanıcı yoğunluğunu ve çevre ihtiyacını V112’den gelen yapı zarfı içinde konumlandırır.</p><p>Komşuluk kararları gerçek düğüm mesafeleriyle, kaçış ön göstergesi en yakın çıkış rotasıyla değerlendirilir. Sonuç avan tasarım girdisidir; ruhsat veya uygulama projesi değildir.</p></div></section>
    <section id="mimari-motor" className="architecture-live-section"><div className="section shell"><ArchitecturalProgramStudio/></div></section>
    <section className="architecture-workflow"><div className="section shell"><p className="eyebrow light">Bağlı Tasarım Akışı</p><div>{[["01","Parsel","İzin ve kütle girdisi","/arsa-fizibilite-studyosu"],["02","Program","Mahal ve performans kaydı","/mimari-program-studyosu"],["03","Plan","Aks ve nesne modeli","/tasarim-calismalari"],["04","Koordinasyon","Mimari–statik–MEP issue","/muhendislik-koordinasyon"]].map(([no,title,copy,href]) => <Link href={href} key={no}><span>{no}</span><b>{title}</b><small>{copy}</small><i>↗</i></Link>)}</div></div></section>
    <SiteFooter/>
  </main>;
}
