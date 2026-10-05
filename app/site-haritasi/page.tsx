import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter, SiteHeader } from "../components/SiteChrome";
import { navigationTree } from "../data/site";

export const metadata: Metadata = { title: "Site Haritası", description: "Arkem Yapı Sistemleri hizmet, referans, dijital araç, teknik içerik ve iletişim sayfalarının açıklamalı site ağacı.", alternates: { canonical: "/site-haritasi" } };

export default function SiteMapPage(){return <main className="inner-page sitemap-page">
  <section className="sitemap-hero"><SiteHeader/><div className="shell"><p className="eyebrow light">Arkem Bilgi Mimarisi</p><h1>Dolu bir platform.<br/><em>Sade bir yolculuk.</em></h1><p>Tüm hizmetler, proje kayıtları, mühendislik araçları ve bilgi ürünleri dört ana dal altında anlamlı bir ağaçta toplanır.</p></div></section>
  <section className="section shell sitemap-tree"><div className="sitemap-root"><span>00</span><div><b>ARKEM YAPI SİSTEMLERİ</b><small>Kurumsal site · mühendislik platformu · müşteri çalışma alanı</small></div></div><div className="sitemap-branches">{navigationTree.map((group,index)=><article key={group.label}><header><span>0{index+1}</span><div><Link href={group.href}>{group.label} ↗</Link><p>{group.description}</p></div></header><div className="sitemap-sections">{group.sections.map((section)=><section key={section.title}><h2>{section.title}</h2>{section.items.map((item)=><Link href={item.href} key={`${section.title}-${item.href}`}><span>→</span><div><b>{item.label}</b><small>{item.note}</small></div></Link>)}</section>)}</div></article>)}</div></section>
  <section className="sitemap-journey"><div className="section shell"><p className="eyebrow light">Önerilen Bütünleşik Proje Yolculuğu</p><div>{[["01","Arsanızı doğrulayın","/arsa-fizibilite-studyosu"],["02","Mimari programı kurun","/mimari-program-studyosu"],["03","Plan ve taşıyıcı modeli üretin","/tasarim-calismalari"],["04","Disiplinleri koordine edin","/muhendislik-koordinasyon"],["05","Proje zincirini yönetin","/dijital-proje-merkezi"],["06","Teknik görüşmeyi başlatın","/iletisim"]].map(([no,label,href])=><Link href={href} key={no}><span>{no}</span><b>{label}</b><i>↗</i></Link>)}</div></div></section>
  <SiteFooter/>
</main>}
