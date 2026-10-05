import type { Metadata } from "next";
import { BlogIndex } from "../components/BlogIndex";
import { SiteFooter, SiteHeader } from "../components/SiteChrome";
import { blogPosts } from "../data/blog";

export const metadata: Metadata={title:"Blog | Yapı ve Mühendislik Bilgi Merkezi",description:"Arsa, deprem, betonarme prefabrik, çelik, hafif çelik, BIM, proje yönetimi, yapı fiziği ve yıkım mühendisliği üzerine teknik yazılar.",alternates:{canonical:"/blog"}};

export default function Page(){
  return <main className="inner-page blog-page-v2">
    <section className="inner-hero blog-hero-v2"><SiteHeader/><div className="shell inner-hero-content"><p className="eyebrow light">Arkem Teknik Yayın Merkezi</p><h1>Karardan önce veriyi,<br/><em>uygulamadan önce sistemi okuyun.</em></h1><p>Yatırımcı, tasarımcı ve uygulamacılar için arsa seçiminden yapı pasaportuna uzanan sade, teknik ve sahaya dönük mühendislik içerikleri.</p><div className="blog-hero-metrics"><span><b>{blogPosts.length}</b> teknik yazı</span><span><b>{new Set(blogPosts.map((post)=>post.category)).size}</b> uzmanlık alanı</span><span><b>01</b> bütünleşik bilgi zinciri</span></div></div></section>
    <section className="section shell"><div className="section-heading"><div><p className="eyebrow">Konu Kütüphanesi</p><h2>Teknik içeriği<br/><em>projenizin aşamasına göre bulun.</em></h2></div><p>Her yazı genel bilgilendirme sınırını açık tutar ve projeye özel kararların yetkili uzmanlarca doğrulanması gerektiğini belirtir.</p></div>
      <div className="blog-reading-paths">
        {[
          ["01", "Arsa & imar", "Parsel, plan, zemin ve fizibilite"],
          ["02", "Mimari & sistem", "Program, yapı fiziği ve taşıyıcı karar"],
          ["03", "Proje kontrolü", "RFI, revizyon, görev, program ve maliyet"],
          ["04", "Üretim & saha", "Kalite, montaj, güvenlik ve tedarik"],
          ["05", "Dijital teslim", "BIM, 4B–5B ve yapı pasaportu"],
        ].map(([no, title, copy]) => <article key={no}><span>{no}</span><b>{title}</b><p>{copy}</p></article>)}
      </div>
      <BlogIndex posts={blogPosts}/>
    </section>
    <section className="knowledge-bridge"><div className="section shell"><div><p className="eyebrow light">Bilgi Bankasıyla Birlikte</p><h2>Yorumdan sonra<br/><em>resmî kaynağa geçin.</em></h2></div><p>Teknik yazılardaki karar çerçevesini; güncel kanun, yönetmelik, standart kataloğu ve Arkem kontrol araçlarıyla birlikte inceleyin.</p><a className="button copper" href="/dokumanlar">Doküman Merkezini Açın <span>↗</span></a></div></section>
    <SiteFooter/>
  </main>;
}
