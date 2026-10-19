import type { Metadata } from "next";
import Link from "next/link";
import { ProjectStartStudio } from "../components/ProjectStartStudio";
import { SiteFooter, SiteHeader } from "../components/SiteChrome";

export const metadata: Metadata = {
  title: "ARKEMX Proje Başlat",
  description: "Proje hedefinizi, parsel hazırlığını, bütçe ve zaman kararlarını beş sade adımda tanımlayın; ARKEMX size kaynak ve doğrulama sınırları açık kişisel proje yol haritası oluştursun.",
  alternates: { canonical: "/proje-baslat" },
  openGraph: { title: "ARKEMX Proje Başlat | ARKEM Yapı Sistemleri", description: "Proje hedefinizi, parsel hazırlığını, bütçe ve zaman kararlarını beş sade adımda tanımlayın; ARKEMX size bir proje yol haritası oluştursun.", url: "/proje-baslat", images: [{ url: "/arkem-social-share.png", width: 1200, height: 630, alt: "ARKEM Yapı Sistemleri — mühendislikten sahaya" }] },
};

export default function ProjectStartPage() {
  return <main className="inner-page project-start-page">
    <section className="project-start-hero customer-start-hero">
      <SiteHeader />
      <div className="shell project-start-hero-content">
        <nav className="breadcrumb" aria-label="Sayfa yolu"><Link href="/">Ana Sayfa</Link><span>/</span><Link href="/arkemx">ARKEMX</Link><span>/</span><span>Proje Başlat</span></nav>
        <p className="eyebrow light">ARKEMX / PROJE BAŞLANGIÇ SİSTEMİ</p>
        <h1>Bir kez anlatın.<br/><em>Tüm proje birlikte ilerlesin.</em></h1>
        <p>İhtiyaç, konum, belge hazırlığı, alan, bütçe ve önceliklerinizi bir kez girin. ARKEMX size özel proje yolunu oluşturur; resmî veri, müşteri beyanı ve uzman incelemesini birbirine karıştırmaz.</p>
        <ol className="project-start-hero-flow" aria-label="Projeden teslime altı aşama">{["Hedef", "Arsa", "İmar", "Mimari", "Sistem", "Teslim"].map((item, index) => <li key={item}><i>{String(index + 1).padStart(2, "0")}</i><b>{item}</b></li>)}</ol>
      </div>
    </section>
    <section className="section shell"><ProjectStartStudio /></section>
    <section className="start-assurance"><div className="shell">{[
      ["01", "Kişisel proje yolu", "Sıradaki işlem; parsel, belge, bütçe ve teknik hazırlığınıza göre belirlenir."],
      ["02", "Kaynak görünürlüğü", "Kullanıcı girdisi, resmî veri ve mühendislik sonucu birbirinden ayrılır."],
      ["03", "Açık teknik çıktı", "Proje JSON, düzenli CSV ve katmanlı DXF ile taşınabilir kalır."],
      ["04", "Yetki sınırı", "Ön değerlendirme ile yetkili proje ve onay süreçleri açık biçimde ayrılır."],
    ].map(([no, title, copy]) => <article key={no}><span>{no}</span><h2>{title}</h2><p>{copy}</p></article>)}</div></section>
    <SiteFooter />
  </main>;
}
