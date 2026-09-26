import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteFooter, SiteHeader } from "../../components/SiteChrome";
import { getReferenceRecord, referenceRecords } from "../../data/references";
import { site } from "../../data/site";

export function generateStaticParams() {
  return referenceRecords.map((record) => ({ slug: record.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const record = getReferenceRecord((await params).slug);
  if (!record) return {};
  return {
    title: record.title,
    description: record.summary,
    alternates: { canonical: `/referanslar/${record.slug}` },
    openGraph: { title: `${record.title} | ARKEM Yapı Sistemleri`, description: record.summary, images: [{ url: record.image, alt: record.imageAlt }] },
  };
}

export default async function ReferenceDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const record = getReferenceRecord((await params).slug);
  if (!record) notFound();
  const mainMedia = record.media[0];
  const schema = {
    "@context": "https://schema.org",
    "@type": "CreativeWork",
    name: record.title,
    description: record.summary,
    image: record.image,
    url: `${site.domain}/referanslar/${record.slug}`,
    publisher: { "@type": "Organization", name: site.name },
    inLanguage: "tr-TR",
  };

  return <main className="inner-page reference-detail-page">
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />
    <section className="inner-hero reference-detail-hero"><SiteHeader/><div className="shell inner-hero-content"><nav className="breadcrumb" aria-label="Sayfa yolu"><Link href="/">Ana Sayfa</Link><span>/</span><Link href="/referanslar">Proje Arşivi</Link><span>/</span><span>{record.title}</span></nav><p className="eyebrow light">{record.category}</p><h1>{record.title}</h1><p>{record.summary}</p><div className="reference-hero-tags">{record.types.map((type) => <span key={type}>{type}</span>)}<span>Doğrulanmış arşiv kaydı</span></div></div></section>

    <section className="section shell reference-detail-layout"><div className="reference-media-stage">{mainMedia.kind === "video" ? <video controls preload="metadata" poster={mainMedia.poster}><source src={mainMedia.url} type="video/mp4"/>Tarayıcınız video oynatmayı desteklemiyor.</video> : <a href={mainMedia.url} target="_blank" rel="noreferrer"><Image src={record.image} alt={record.imageAlt} width={1280} height={800} sizes="(max-width: 900px) 100vw, 64vw" unoptimized/></a>}<p>{record.archiveMeta}</p></div><aside className="reference-record-card"><p className="eyebrow">Arşiv Dosyaları</p><h2>Kaynağı doğrudan inceleyin.</h2><p>Her bağlantı eski Wix arşivindeki özgün dosyaya açılır.</p>{record.media.map((media) => <a href={media.url} target="_blank" rel="noreferrer" key={media.url}><span>{media.kind === "image" ? "GÖRSEL" : media.kind.toUpperCase()}</span><b>{media.label}</b><i aria-hidden="true">↗</i></a>)}</aside></section>

    <section className="reference-evidence"><div className="shell reference-evidence-grid"><div><p className="eyebrow light">Arşivde Doğrulananlar</p><h2>Görünen veri ile<br/><em>sınırlı teknik kayıt.</em></h2></div><ol>{record.verifiedEvidence.map((item, index) => <li key={item}><span>{String(index + 1).padStart(2, "0")}</span><p>{item}</p></li>)}</ol></div></section>

    <section className="section shell reference-boundary"><div><p className="eyebrow">Kapsam Sınırı</p><h2>Teknik kayıt,<br/><em>mevcut kaynağıyla sınırlıdır.</em></h2></div><div><p>{record.scopeBoundary}</p><p>Yeni proje paftası, sözleşme bilgisi veya saha fotoğrafı ulaştığında bu kayıt aynı doğrulama yaklaşımıyla genişletilebilir.</p></div></section>

    <section className="service-cta"><div className="shell"><p className="eyebrow light">İlgili Hizmet</p><h2>Benzer bir ihtiyacı<br/><em>birlikte değerlendirelim.</em></h2><div className="actions"><Link className="button copper" href={record.relatedService.href}>{record.relatedService.title} kapsamını inceleyin <span>↗</span></Link><Link className="button ghost" href="/proje-karar-asistani">Projenizi hazırlayın <span>↗</span></Link></div></div></section>
    <SiteFooter/>
  </main>;
}
