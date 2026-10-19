import type { Metadata } from "next";
import Link from "next/link";
import { ProjectIntelligenceCenter } from "../components/ProjectIntelligenceCenter";
import { SiteFooter, SiteHeader } from "../components/SiteChrome";

export const metadata: Metadata = {
  title: "ARKEMX Proje Kararı | Veri Hazırlık Prototipi",
  description: "Proje verisi, kanıt tamlığı, karar güveni, risk ve teknik çıktı hazırlığı için ARKEMX geliştirme prototipi.",
  alternates: { canonical: "/proje-zekasi" },
  robots: { index: false, follow: false },
};

export default function ProjectIntelligencePage() {
  return <main className="inner-page intelligence-page">
    <section className="intelligence-page-hero">
      <SiteHeader/>
      <div className="shell intelligence-page-copy">
        <nav className="breadcrumb" aria-label="Sayfa yolu"><Link href="/">Ana Sayfa</Link><span>/</span><Link href="/arkemx">ARKEMX</Link><span>/</span><span>Proje Kararı</span></nav>
        <p className="eyebrow light">ARKEMX / PROJE KARAR VE VERİ HAZIRLIĞI</p>
        <h1>Veri çoğalmasın.<br/><em>Karar netleşsin.</em></h1>
        <p>Yatırım önceliğini, mevcut teknik kanıtları ve bağlı proje veri alanlarını birlikte okuyarak sıradaki doğru mühendislik adımını görünür hale getiren geliştirme prototipi.</p>
        <div className="actions"><a className="button copper" href="#proje-zekasi-motoru">Karar Motorunu Açın <span>↓</span></a><Link className="button ghost" href="/proje-baslat">Yönlendirmeli Proje Başlat <span>↗</span></Link></div>
      </div>
      <div className="shell intelligence-hero-metrics"><span><b>01</b> Kanıt tamlığı</span><span><b>02</b> Karar güveni</span><span><b>03</b> Risk görünümü</span><span><b>04</b> Modül rotası</span><span><b>05</b> Kurumsal çıktı</span></div>
    </section>
    <section className="intelligence-page-body" id="proje-zekasi-motoru"><div className="section shell"><ProjectIntelligenceCenter/></div></section>
    <section className="intelligence-principles"><div className="section shell"><header><p className="eyebrow light">Mühendislik Sınırı</p><h2>Akıllı yönlendirme.<br/><em>Açık yetki sınırı.</em></h2></header><div>{[
      ["01","Kaynak görünürlüğü","Kullanıcı girdisi, resmî veri ve mühendislik sonucu aynı statüde gösterilmez."],
      ["02","Belirsizlik kaydı","Eksik bilgi varsayım olarak işaretlenir; doğrulanmış veri gibi kullanılmaz."],
      ["03","Disiplin sorumluluğu","Her hesap ve karar kendi yetkili disiplin kaynağını korur."],
      ["04","İzlenebilir çıktı","PDF karar dosyası proje kimliği, revizyon ve yetki sınırıyla üretilir."],
    ].map(([no,title,copy]) => <article key={no}><span>{no}</span><h3>{title}</h3><p>{copy}</p></article>)}</div></div></section>
    <SiteFooter/>
  </main>;
}
