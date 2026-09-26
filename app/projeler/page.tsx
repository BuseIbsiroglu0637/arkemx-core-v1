import type { Metadata } from "next";
import Link from "next/link";
import { ProjectArchiveExplorer } from "../components/ProjectArchiveExplorer";
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
  return <main className="inner-page v21-standard-page v31-project-index">
    <section className="v21-standard-hero v31-project-hero">
      <SiteHeader />
      <div className="shell">
        <p className="v21-index">ARKEM / PROJE ARŞİVİ</p>
        <h1>HER PROJE,<br /><em>MÜHENDİSLİK YAKLAŞIMIMIZIN UYGULAMADAKİ KARŞILIĞIDIR.</em></h1>
        <p>Projeleri yalnız sonuçlarıyla değil; künyesi, teknik kısıtları, sistem kararı, ARKEM kapsamı, üretim ve saha kayıtlarıyla birlikte değerlendiriyoruz.</p>
      </div>
    </section>
    <section className="v21-section">
      <div className="shell">
        <header className="v21-section-head">
          <div><p className="v21-index">01 / PROJE ARŞİVİ</p><h2>Seçilmiş projeler.<br /><em>Teknik kayıt düzeni.</em></h2></div>
          <p>Proje adı, lokasyon, yapı türü, taşıyıcı sistem, yıl ve ARKEM kapsamı yalnız kaynak kaydıyla eşleşen veri üzerinden gösterilir.</p>
        </header>
        <ProjectArchiveExplorer projects={projects} />
        <aside className="v31-project-registry-note">
          <strong>TEKNİK KAYIT STANDARDI</strong>
          <p>Eksik proje verisi tahminle tamamlanmaz. Gerçek medya, teknik değer ve sorumluluk kapsamı kaynak ve yayın hakkı kaydı tamamlandığında açılır.</p>
          <Link href="/iletisim">Projenizi değerlendirelim <span aria-hidden="true">↗</span></Link>
        </aside>
      </div>
    </section>
    <SiteFooter />
  </main>;
}
