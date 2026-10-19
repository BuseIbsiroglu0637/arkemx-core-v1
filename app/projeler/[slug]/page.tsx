import type { Metadata } from "next";
import { ProjectPhoto } from "../../components/ProjectPhoto";
import { selectProjectPhoto } from "../../lib/project-photo";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteFooter, SiteHeader } from "../../components/SiteChrome";
import { getV3Project, v3Projects } from "../../data/projects-v3";
import { applyPublishedProjectEvidence } from "../../lib/project-evidence";
import { getPublishedProjectEvidence } from "../../lib/project-evidence-store";
import { site } from "../../data/site";
import { engineeringCapabilities } from "../../data/engineering-v3";
import { getProjectPresentation, projectPresentations } from "../../data/project-presentations";
import { ProjectPresentationPage } from "../../components/ProjectPresentationPage";

function recordStatusLabel(status: string) {
  if (status === "doğrulandı") return "YAYINDA";
  if (status === "kısmi doğrulama") return "KISMİ KAYIT";
  return "KAYNAK KONTROLÜ";
}

export const dynamic = "force-dynamic";

export function generateStaticParams() {
  return Array.from(new Set([...v3Projects, ...projectPresentations].map(project => project.slug))).map(slug => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const slug = (await params).slug;
  const presentation = getProjectPresentation(slug);
  if (presentation) return { title: presentation.title, description: presentation.summary, alternates: { canonical: `/projeler/${slug}` }, openGraph: { title: `${presentation.title} | ARKEM`, description: presentation.summary, url: `/projeler/${slug}`, images: [{ url: presentation.cover.src, alt: presentation.cover.alt }] } };
  const project = getV3Project(slug);
  if (!project) return {};
  return {
    title: project.title,
    description: project.summary,
    alternates: { canonical: `/projeler/${project.slug}` },
    openGraph: {
      title: `${project.title} | ARKEM Yapı Sistemleri`,
      description: project.summary,
      url: `/projeler/${project.slug}`,
      images: project.archiveMedia[0]
        ? [{ url: project.archiveMedia[0].href, width: 1200, height: 630, alt: project.archiveMedia[0].caption }]
        : [{ url: "/arkem-social-share.png", width: 1200, height: 630, alt: `${project.shortTitle} · ARKEM proje kaydı` }],
    },
  };
}

export default async function ProjectDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const slug = (await params).slug;
  const presentation = getProjectPresentation(slug);
  const baseProject = getV3Project(slug);
  if (presentation) {
    const archiveRecord = baseProject ? applyPublishedProjectEvidence(baseProject, await getPublishedProjectEvidence(baseProject.slug)) : undefined;
    return <ProjectPresentationPage project={presentation} archiveRecord={archiveRecord} />;
  }
  if (!baseProject) notFound();
  const project = applyPublishedProjectEvidence(baseProject, await getPublishedProjectEvidence(baseProject.slug));
  const heroMedia = selectProjectPhoto(project.slug, project.publishedMedia);

  const schema = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: project.title,
    description: project.summary,
    url: `${site.domain}/projeler/${project.slug}`,
    publisher: { "@type": "Organization", name: site.name },
    inLanguage: "tr-TR",
  };

  return <main className="inner-page v21-standard-page v3-project-detail">
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />
    <section className="v21-standard-hero v3-project-detail-hero">
      <SiteHeader />
      <div className="shell">
        <nav className="v3-project-breadcrumb" aria-label="Sayfa yolu"><Link href="/">Ana Sayfa</Link><span>/</span><Link href="/projeler">Projeler</Link><span>/</span><span>{project.shortTitle}</span></nav>
        <p className="v21-index">{project.code}</p>
        <h1>{project.shortTitle}</h1>
        <p>{project.summary}</p>
        <div className="v3-project-hero-status"><strong>{recordStatusLabel(project.evidenceStatus)}</strong><span>Yayımlanan her teknik değer ve medya kendi kaynak kaydıyla ilişkilendirilir.</span></div>
        {heroMedia && <figure className="v32-project-hero-media">
          <ProjectPhoto src={heroMedia.href} alt={heroMedia.caption || `${project.shortTitle} proje kaydı`} priority natural />
          <figcaption><strong>{heroMedia.caption}</strong><span>{heroMedia.sourceLabel}</span></figcaption>
        </figure>}
      </div>
    </section>

    <section className="v21-section v3-project-facts-section"><div className="shell">
      <header className="v21-section-head"><div><p className="v21-index">00 / PROJE KÜNYESİ</p><h2>Doğrulanmış bilgi.<br /><em>Açık kaynak durumu.</em></h2></div><p>Her alan kendi yayın durumunu ve kaynağını taşır. Eksik teknik veri, kaynak kaydı tamamlanana kadar kesin bilgi olarak gösterilmez.</p></header>
      <div className="v3-project-facts">{Object.values(project.facts).map((fact) => <article key={fact.label} data-status={fact.status}>
        <header><span>{fact.label}</span><em>{recordStatusLabel(fact.status)}</em></header>
        <strong>{fact.value}</strong>
        <small>{fact.source}</small>
      </article>)}</div>
    </div></section>

    <section className="v21-section v3-project-case" id="proje-sureci"><div className="shell">
      <header className="v21-section-head v21-section-head-light"><div><p className="v21-index">01 / PROJE SÜRECİ</p><h2>Proje kararları.<br /><em>Uygulamadaki karşılığı.</em></h2></div><p>Proje ihtiyacından sonuca uzanan yedi bölüm, ilgili teknik kaynak proje kaydıyla eşleştiğinde yayımlanır.</p></header>
      <ol>{project.caseStudy.map((stage) => <li key={stage.code}>
        <span>{stage.code}</span>
        <div><small>{recordStatusLabel(stage.status)}</small><h3>{stage.title}</h3><p>{stage.summary}</p></div>
        <aside><strong>GEREKLİ TEKNİK KAYIT</strong><p>{stage.evidenceNeeded}</p></aside>
      </li>)}</ol>
    </div></section>

    <section className="v21-section v3-project-evidence"><div className="shell">
      <header className="v21-section-head"><div><p className="v21-index">02 / TEKNİK KAYIT</p><h2>Proje verisi<br /><em>kaynağıyla birlikte yayımlanır.</em></h2></div><p>Bu liste proje sayfasının yayın kaydıdır. Bir alan, teknik kaynağı tanımlandığında ilgili yayın durumuna geçer.</p></header>
      <div className="v3-project-manifest">{project.sourceManifest.map((item, index) => <article key={item.label} data-status={item.status}>
        <span>{String(index + 1).padStart(2, "0")}</span>
        <div><h3>{item.label}</h3><p>{item.value}</p><small>{item.source}</small></div>
        <em>{recordStatusLabel(item.status)}</em>
      </article>)}</div>
      <div className="v3-project-boundaries">
        <article><strong>MEDYA DURUMU</strong><h3>{project.publishedMedia.length ? `${project.publishedMedia.length} yayımlanmış medya kaydı.` : "Gerçek proje medyası bekleniyor."}</h3><p>{project.media.note}</p><span>{recordStatusLabel(project.media.status)}</span></article>
        <article><strong>KAPSAM SINIRI</strong><h3>Teknik kayıt, doğrulanmış veriyle sınırlıdır.</h3><p>{project.scopeBoundary}</p><span>YAYIN KONTROLÜ</span></article>
      </div>
      {project.engineeringEvidence.length > 0 && <div className="v3e-project-capability-evidence" id="muhendislik-kayitlari">
        <header><div><p className="v21-index">MÜHENDİSLİK KAYITLARI</p><h3>Mühendislik kapsamı,<br/><em>doğrudan kaynağına bağlı.</em></h3></div><p>Bu kayıtlar genel proje aşamasından üretilmez; ilgili uzmanlık alanına açıkça bağlanan teknik kaynaklardan yayımlanır.</p></header>
        <div>{project.engineeringEvidence.map((evidence) => {
          const capability = engineeringCapabilities.find((item) => item.id === evidence.capabilityId);
          return <article key={evidence.id}><span>{capability?.no || "—"}</span><div><small>{capability?.title || evidence.capabilityId}</small><h4>{evidence.summary}</h4><p>{evidence.sourceLabel}</p></div><a href={evidence.href}>Teknik dosyayı inceleyin ↗</a></article>;
        })}</div>
      </div>}
      {project.publishedMedia.length > 0 && <div className="v3-project-media-grid">{project.publishedMedia.map((item) => <figure key={item.id}>
        {item.contentType.startsWith("image/") ? <ProjectPhoto src={item.href} alt={item.caption || `${project.shortTitle} proje kaydı`} natural /> : item.contentType.startsWith("video/") ? <video controls preload="metadata"><source src={item.href} type={item.contentType}/></video> : <a className="v3-project-media-file" href={item.href}><span>TEKNİK DOSYA</span><strong>{item.fileName}</strong><small>Dosyayı açın ↗</small></a>}
        <figcaption><strong>{item.caption || item.fileName}</strong><span>{item.sourceLabel}</span></figcaption>
      </figure>)}</div>}
    </div></section>

    <section className="v21-section v3-project-next"><div className="shell">
      <p className="v21-index">03 / İLGİLİ TEKNİK ALAN</p>
      <h2>Benzer bir proje için<br /><em>doğru teknik başlangıcı kurun.</em></h2>
      <div className="v21-actions"><Link className="v21-button v21-button-copper" href={project.relatedService.href}>{project.relatedService.title} <span aria-hidden="true">↗</span></Link><Link className="v21-button v21-button-ghost" href={project.relatedSystem.href}>{project.relatedSystem.title} <span aria-hidden="true">↗</span></Link></div>
    </div></section>
    <SiteFooter />
  </main>;
}
