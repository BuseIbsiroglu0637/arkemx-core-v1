import type { Metadata } from "next";
import { ProjectBriefForm } from "../components/ProjectBriefForm";
import { SiteFooter, SiteHeader } from "../components/SiteChrome";
import { site } from "../data/site";

export const metadata: Metadata = {
  title: { absolute: "Projenizi Değerlendirelim | ARKEM Yapı Sistemleri" },
  description: "Proje konumu, yapı türü, yaklaşık alan, proje aşaması ve teknik belgelerinizi ARKEM mühendislik ön değerlendirmesine iletin.",
  alternates: { canonical: "/iletisim" },
  openGraph: {
    title: "Projenizi Değerlendirelim | ARKEM Yapı Sistemleri",
    description: "Proje verilerinizi ve teknik dosyalarınızı tek ön değerlendirme kaydında iletin.",
    url: "/iletisim",
    images: [{ url: "/projects/v32/yapikur-montaj.webp", width: 1200, height: 630, alt: "ARKEM proje teknik ön değerlendirme" }],
  },
};

export default function ContactPage() {
  return <main className="inner-page contact-page v21-standard-page">
    <section className="inner-hero premium-inner-hero contact-hero-v27"><SiteHeader/><div className="shell inner-hero-content"><p className="eyebrow light">PROJENİZİ DEĞERLENDİRELİM</p><h1>Bir mesaj değil,<br/>teknik başlangıç kaydı.</h1><p>Arsanız, mevcut yapınız veya yatırım fikriniz için proje verisini ve teknik belgeleri aynı ön değerlendirme kaydında iletin.</p><div className="premium-hero-actions"><a className="button copper" data-analytics="hero_cta" data-analytics-context="contact_form" href="#proje-on-bilgisi">Proje bilgisini hazırlayın <span>↓</span></a><a className="button ghost" data-analytics="whatsapp_click" href={`https://wa.me/${site.whatsappHref}`} target="_blank" rel="noreferrer">WhatsApp <span>↗</span></a></div><div className="premium-hero-trust"><span>01 <b>Tek kayıt numarası</b></span><span>02 <b>Genel dosya yükleme</b></span><span>03 <b>Teknik ön değerlendirme</b></span></div></div></section>
    <section className="section shell contact-layout" id="proje-on-bilgisi"><aside><p className="eyebrow">Doğrudan İletişim</p><h2>ARKEM Yapı<br/><em>Sistemleri</em></h2><div className="contact-lines"><a data-analytics="phone_click" href={`tel:${site.phoneHref}`}><span>Telefon</span><b>{site.phoneDisplay}</b></a><a data-analytics="whatsapp_click" href={`https://wa.me/${site.whatsappHref}`} target="_blank" rel="noreferrer"><span>WhatsApp</span><b>Mesaj gönder ↗</b></a><div><span>Merkez</span><b>{site.location}</b></div></div><p className="contact-note">Yüklenen proje dosyaları aynı teknik ön değerlendirme kaydına bağlanır.</p></aside><ProjectBriefForm/></section>
    <section className="contact-process"><div className="shell"><p className="eyebrow light">Sonraki Adımlar</p><div className="contact-step-grid"><article><span>01</span><h2>Ön bilgiyi inceleriz</h2><p>Yapı türü, konum, alan ve mevcut dokümanları değerlendiririz.</p></article><article><span>02</span><h2>Eksikleri netleştiririz</h2><p>Doğru kapsam için gereken teknik soruları ve verileri belirleriz.</p></article><article><span>03</span><h2>Yol haritası oluştururuz</h2><p>Hizmet kapsamı, teslimler ve sonraki teknik adımı açıklarız.</p></article></div></div></section><SiteFooter/>
  </main>;
}
