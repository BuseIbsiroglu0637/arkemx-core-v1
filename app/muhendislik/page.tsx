import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { SiteFooter, SiteHeader } from "../components/SiteChrome";
import { engineeringCapabilities } from "../data/engineering-v3";
import { getPublicV3Projects } from "../lib/public-projects";

export const metadata: Metadata = {
  title: { absolute: "Yapısal Mühendislik ve Statik Projelendirme | ARKEM" },
  description: "Taşıyıcı sistem tasarımı, statik analiz, deprem mühendisliği, uygulama ve imalat projeleri, BIM koordinasyonu, değer ve saha mühendisliği.",
  alternates: { canonical: "/muhendislik" },
  openGraph: {
    title: "Yapısal Mühendislik ve Statik Projelendirme | ARKEM",
    description: "Taşıyıcı sistem tasarımı, statik analiz, deprem mühendisliği, detaylandırma ve saha mühendisliği.",
    url: "/muhendislik",
    images: [{ url: "/projects/v32/cihan-tasiyici.webp", width: 1200, height: 630, alt: "ARKEM yapısal mühendislik ve taşıyıcı sistem kaydı" }],
  },
};

export default async function EngineeringPage() {
  const projects = await getPublicV3Projects();
  const verifiedStageCount = projects.flatMap((project) => project.caseStudy)
    .filter((stage) => stage.status === "doğrulandı").length;
  const archiveRecords = ([
    ["cihan-tat", "Taşıyıcı sistem ve çatı makasları", 0],
    ["yapikur-plaza", "Prefabrik eleman montaj sahası", 1],
    ["devrekani-bosb", "Betonarme prefabrik 3B proje kaydı", 0],
  ] as const).flatMap(([slug, label, mediaIndex]) => {
    const project = projects.find((item) => item.slug === slug);
    const media = project?.publishedMedia.filter((item) => item.contentType.startsWith("image/"))[mediaIndex];
    return project && media ? [{ project, media, label }] : [];
  });

  return <main className="inner-page v3d-engineering-page">
    <section className="v21-standard-hero v3d-engineering-hero"><SiteHeader /><div className="shell"><p className="v21-index">ARKEM / MÜHENDİSLİK</p><h1>HESAPLANABİLİR.<br />ÜRETİLEBİLİR.<br /><em>UYGULANABİLİR.</em></h1><p>Taşıyıcı sistemi yalnızca hesaplamıyoruz; girdiyi, mühendislik kararını, çıktıyı ve bu kararın teknik kaydını aynı zincirde gösteriyoruz.</p><div className="v3d-hero-proof"><span>08 mühendislik alanı</span><span><strong data-no-translate>{verifiedStageCount}</strong> <i>DOĞRULANMIŞ VAKA AŞAMASI</i></span><span>Kaynakla eşleşen teknik kayıt</span></div></div></section>

    <section className="v3d-engineering-intro"><div className="shell v3d-engineering-intro-grid"><div><p className="eyebrow">MÜHENDİSLİK OTORİTESİ</p><h2>Sonucu değil,<br/><em>karar zincirini göster.</em></h2></div><div><p>Her mühendislik alanını dört açık soruyla sunuyoruz: girdi nedir, hangi teknik karar verilir, hangi çıktı oluşur ve bu kapsam hangi belgeyle doğrulanır? Proje kayıtları yalnız yayımlanmış teknik kaynaklarla eşleşir.</p><Link className="text-link" href="/projeler">Teknik proje kayıtlarını açın <span aria-hidden="true">↗</span></Link></div></div></section>

    <section className="v32-engineering-records"><div className="shell"><header><div><p className="eyebrow light">GERÇEK PROJE KAYITLARI</p><h2>Modelden montaja.<br/><em>Teknik bağlamıyla.</em></h2></div><p>Temsili stok görsel yerine ARKEM proje arşivindeki taşıyıcı sistem, montaj sahası ve 3B proje kayıtları kullanılır. Her görsel kendi proje kimliğine bağlıdır.</p></header><div>{archiveRecords.map(({ project, media, label }) => <figure key={project.slug}><Link href={`/projeler/${project.slug}`}><Image src={media.href} alt={media.caption} width={1600} height={1000} unoptimized /></Link><figcaption><span>{project.code}</span><div><strong>{project.shortTitle}</strong><small>{label}</small></div><Link href={`/projeler/${project.slug}`}>Teknik kaydı açın ↗</Link></figcaption></figure>)}</div></div></section>

    <section className="v3d-capabilities"><div className="shell"><div className="v3d-capability-heading"><p className="eyebrow light">TEKNİK YETKİNLİKLER</p><h2>Sekiz alan.<br/><em>Tek izlenebilir yöntem.</em></h2></div><div className="v3d-capability-list">{engineeringCapabilities.map((capability) => {
      const evidenceProjects = projects.filter((project) => project.engineeringEvidence
        .some((evidence) => evidence.capabilityId === capability.id));
      return <article id={capability.id} key={capability.id} className="v3d-capability-record"><header><span>{capability.no}</span><div><h3>{capability.title}</h3><p>{capability.summary}</p></div>{evidenceProjects.length ? <b data-empty="false"><strong data-no-translate>{evidenceProjects.length}</strong><i>DOĞRULANMIŞ PROJE KAYDI</i></b> : <b data-empty="true">TEKNİK KAYIT BEKLENİYOR</b>}</header><div className="v3d-capability-contract"><div><small>GİRDİ</small><p>{capability.input}</p></div><div><small>MÜHENDİSLİK KARARI</small><p>{capability.decision}</p></div><div><small>ÇIKTI</small><p>{capability.output}</p></div><div><small>GEREKLİ TEKNİK KAYIT</small><p>{capability.evidenceNeeded}</p></div></div>{evidenceProjects.length > 0 && <div className="v3e-capability-projects"><small>BAĞLI PROJE KAYITLARI</small>{evidenceProjects.map((project) => <Link href={`/projeler/${project.slug}#muhendislik-kayitlari`} key={project.slug}><span>{project.code}</span><b>{project.shortTitle}</b><i>Kaydı inceleyin ↗</i></Link>)}</div>}</article>;
    })}</div></div></section>

    <section className="v3d-engineering-proof"><div className="shell v3d-engineering-proof-grid"><figure><Image src="/projects/v32/cihan-tasiyici.webp" width={1600} height={1000} sizes="(max-width: 900px) 100vw, 52vw" unoptimized alt="Cihan Tat Gıda üretim tesisinin taşıyıcı sistemi ve çatı makasları"/><figcaption>Cihan Tat Gıda · gerçek taşıyıcı sistem ve saha kaydı · R-002</figcaption></figure><div><p className="eyebrow">PROJE KAYIT DURUMU</p><h2>Teknik kapsam,<br/><em>belgeyle açılır.</em></h2><p>Genel vaka aşamaları yalnız proje düzeyi sayaçlarda görünür ve tek başına bir uzmanlığı doğrulamaz. Uzmanlık sayacı, ilgili mühendislik alanına doğrudan bağlanıp yayımlanan kaynak dosyalarından oluşur.</p><dl><div><dt>Proje kaydı</dt><dd>{projects.length}</dd></div><div><dt>Doğrulanmış vaka aşaması</dt><dd>{verifiedStageCount}</dd></div><div><dt>Yayın kuralı</dt><dd>Yalnız kaynak bağlı kayıt</dd></div></dl><Link className="button copper" href="/projeler">Proje Kayıtlarını İnceleyin <span aria-hidden="true">↗</span></Link></div></div></section>

    <section className="v21-section v21-engineering-x"><div className="shell v21-two-column"><div><p className="v21-index">MÜHENDİSLİK + ARKEMX</p><h2>Teknik karar.<br /><em>Bağlı proje verisi.</em></h2></div><div><p>ARKEM mühendisliği çözer. ARKEMX; model, analiz, detay, miktar, üretim ve saha kayıtlarını ortak proje omurgasında bağlamak üzere geliştirilen Ar-Ge platformudur.</p><Link className="v21-text-link" href="/arkemx">ARKEMX’i inceleyin <span aria-hidden="true">↗</span></Link></div></div></section>
    <SiteFooter />
  </main>;
}
