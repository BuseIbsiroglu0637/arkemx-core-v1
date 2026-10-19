import type { Metadata } from "next";
import { ReferenceExplorer } from "../components/ReferenceExplorer";
import { SiteFooter, SiteHeader } from "../components/SiteChrome";
import Link from 'next/link';
import { PresentationCatalog } from '../components/PresentationCatalog';

export const metadata: Metadata = {
  title: "Proje Arşivi | Doğrulanmış Teknik Kayıtlar",
  description: "ARKEM proje arşivinden kaynağı doğrulanabilen 3B model, teknik doküman ve saha inceleme kayıtları.",
  alternates: { canonical: "/referanslar" },
};

export default function ReferencesPage() {
  return <main className="inner-page references-page">
    <section className="inner-hero premium-inner-hero references-hero-v27"><SiteHeader/><div className="shell inner-hero-content"><p className="eyebrow light">PROJE ARŞİVİ / TEKNİK KAYITLAR</p><h1>Kaynağı incelenebilir.<br/>Kapsamı açık proje kayıtları.</h1><p>3B model, teknik doküman ve saha videosu kayıtlarını doğrudan arşiv kaynağıyla sunuyor; kaynakta bulunmayan proje ölçeği, kapsamı veya sonucu eklemiyoruz.</p><div className="premium-hero-stats"><span><b>03</b> kaynaklı kayıt</span><span><b>02</b> model görseli</span><span><b>01</b> teknik PDF</span><span><b>01</b> saha videosu</span></div></div></section>
    <section className="section shell reference-ledger-section"><div className="reference-note premium-reference-note"><b>Teknik kayıt standardı</b><p>Her kayıt gerçek arşiv dosyasına veya açık 3B modele bağlıdır. Mevcut kaynakta bulunmayan metrekare, konum, işveren kapsamı ve performans sonucu eklenmez.</p><span>KAYNAK · TARİH · FORMAT · İNCELEME</span></div><ReferenceExplorer/></section>
    <section className="ref-experience"><div className="shell ref-index-catalog"><header className="ref-library-heading"><p className="ref-eyebrow">GENİŞLETİLMİŞ PROJE SEÇKİSİ</p><h2>Referans çalışmaları ve 3B sunumlar</h2><p>Yeni referans paketlerini bir arada keşfedin. Her proje, görselleri ve model kapsamıyla kendi sayfasında sunulur.</p><Link href="/projeler">Proje kataloğuna geç ↗</Link></header><PresentationCatalog /></div></section>
    <section className="markets reference-markets"><div className="shell"><p className="eyebrow light">Çalışma Alanları</p><h2>Farklı yapı türleri,<br/><em>aynı mühendislik disiplini.</em></h2><div className="market-tags">{["Sanayi Tesisleri","Fabrikalar","Depolar","Ticari Yapılar","Tarımsal Yapılar","Konut ve Villalar","Sosyal Tesisler","Kontrollü ve Patlatmalı Yıkım"].map(item=><span key={item}>{item}</span>)}</div></div></section>
    <section className="service-cta"><div className="shell"><p className="eyebrow light">Benzer Bir İhtiyacınız mı Var?</p><h2>Projenizin teknik çerçevesini<br/><em>birlikte oluşturalım.</em></h2><a className="button copper" href="/iletisim">Ön Değerlendirme İsteyin <span>↗</span></a></div></section><SiteFooter/>
  </main>;
}
