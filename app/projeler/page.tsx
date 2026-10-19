import type { Metadata } from "next";
import Link from "next/link";
import { PresentationCatalog } from "../components/PresentationCatalog";
import { projectPresentations } from "../data/project-presentations";
import { selectProjectPhoto } from "../lib/project-photo";
import { SiteFooter, SiteHeader } from "../components/SiteChrome";
import { getPublicV3Projects } from "../lib/public-projects";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: { absolute: "Projeler | Yapısal ve Endüstriyel Proje Arşivi | ARKEM" },
  description: "ARKEM proje arşivini; proje künyesi, taşıyıcı sistem kararı, mühendislik kapsamı, uygulama ve saha kayıtlarıyla inceleyin.",
  alternates: { canonical: "/projeler" },
  openGraph: {
    title: "Projeler | Yapısal ve Endüstriyel Proje Arşivi | ARKEM",
    description: "Tamamlanan ve devam eden çalışmaların taşıyıcı sistem kararları, mühendislik kapsamı ve uygulama kayıtları.",
    url: "/projeler",
    images: [{ url: "/projects/v32/yapikur-montaj.webp", width: 1200, height: 630, alt: "ARKEM proje arşivi — Yapıkur Plaza saha kaydı" }],
  },
};

export default async function ProjectsPage() {
  const projects = (await getPublicV3Projects()).filter((project) => project.archiveVisible);
  const legacy = projects.map(p => ({ slug: p.slug, title: p.shortTitle, src: selectProjectPhoto(p.slug, p.publishedMedia)?.href || '', summary: p.summary })).filter(p => p.src);
  return <main className="ref-experience ref-index">
    <SiteHeader dark={false} />
    <section className="ref-index-heading shell"><div><p className="ref-eyebrow">ARKEM / REFERANS ÇALIŞMALARI</p><h1>Çizgiden yapıya.<br /><em>Mühendisliğin izleri.</em></h1><p className="ref-lead">Endüstriyel tesislerden konutlara; projelerimizi saha kayıtları, çizimler ve etkileşimli üç boyutlu sunumlarla keşfedin.</p></div><aside><span><b>{projectPresentations.filter(p => p.model).length}</b> etkileşimli proje sunumu</span><p>Gerçek saha görüntüsü, proje çizimi ve 3B sunum her kayıtta ayrı etiketlenir.</p><Link href="/3b-model-kutuphanesi">3B seçkisine geç ↗</Link></aside></section>
    <section className="shell ref-index-catalog"><PresentationCatalog legacy={legacy} /></section>
    <section className="shell ref-catalog-note"><p>Bu seçki proje ve arşiv çalışmalarını içerir; tüm kayıtlar tamamlanmış yapı beyanı değildir. Sunum kabulleri ve mevcut bilgi kapsamı ilgili proje sayfasında açıklanır.</p><Link href="/iletisim">Birlikte çalışalım ↗</Link></section>
    <SiteFooter />
  </main>;
}
