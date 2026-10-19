import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteFooter, SiteHeader } from "../../components/SiteChrome";
import { getStructuralSystem, matchesStructuralSystemEvidence, structuralSystems } from "../../data/structural-systems";
import { getPublicV3Projects } from "../../lib/public-projects";
import { site } from "../../data/site";

export function generateStaticParams() {
  return structuralSystems.map((system) => ({ slug: system.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const system = getStructuralSystem((await params).slug);
  if (!system) return {};
  return {
    title: system.name,
    description: system.description,
    alternates: { canonical: `/yapi-sistemleri/${system.slug}` },
    openGraph: {
      url: `/yapi-sistemleri/${system.slug}`,
      title: `${system.name} | Arkem`,
      description: system.description,
      images: [{ url: system.image, alt: system.imageAlt }],
    },
  };
}

export default async function StructuralSystemDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const system = getStructuralSystem((await params).slug);
  if (!system) notFound();
  const verifiedProjects = (await getPublicV3Projects())
    .filter((project) => matchesStructuralSystemEvidence(system, project.facts.system));

  const pageUrl = `${site.hostedDomain}/yapi-sistemleri/${system.slug}`;
  const schema = [
    {
      "@context": "https://schema.org",
      "@type": "TechArticle",
      headline: system.name,
      description: system.description,
      image: `${site.hostedDomain}${system.image}`,
      inLanguage: "tr-TR",
      author: { "@type": "Person", name: "Özenç Öztürk" },
      publisher: { "@type": "Organization", name: site.name, logo: { "@type": "ImageObject", url: `${site.domain}/brand/arkem-logo-master.svg` } },
      mainEntityOfPage: pageUrl,
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: system.faqs.map((faq) => ({
        "@type": "Question",
        name: faq.question,
        acceptedAnswer: { "@type": "Answer", text: faq.answer },
      })),
    },
  ];

  return <main className="inner-page system-detail-page">
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />
    <section className="inner-hero system-detail-hero">
      <SiteHeader />
      <div className="shell inner-hero-content">
        <nav className="breadcrumb" aria-label="Sayfa yolu"><Link href="/">Ana Sayfa</Link><span>/</span><Link href="/yapi-sistemleri">Yapı Sistemleri</Link><span>/</span><span>{system.shortName}</span></nav>
        <p className="eyebrow light">{system.eyebrow}</p>
        <h1>{system.name}</h1>
        <p>{system.lead}</p>
        <div className="actions"><Link className="button copper" href="/yapi-sistemi-karsilastirma">Sistemleri Karşılaştır <span aria-hidden="true">↗</span></Link><Link className="button ghost" href="/iletisim">Projenizi Konuşalım <span aria-hidden="true">↗</span></Link></div>
      </div>
    </section>

    <section className="section shell system-overview">
      <div className="system-overview-copy"><p className="eyebrow">Sisteme Genel Bakış</p><h2>Kararı, bütün yapı<br/><em>davranışı belirler.</em></h2>{system.overview.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}</div>
      <figure><Image src={system.image} alt={system.imageAlt} width={1400} height={900} sizes="(max-width: 900px) 100vw, 48vw" unoptimized/><figcaption>Faaliyet alanını anlatan temsili ARKEM çalışmasıdır; tamamlanmış proje kaydı değildir.</figcaption></figure>
    </section>

    <section className="system-balance"><div className="shell system-balance-grid">
      <article className="system-strengths"><p className="eyebrow light">AVANTAJLAR</p><h2>Projede oluşturabileceği değer</h2><ul>{system.strengths.map((item) => <li key={item}><span aria-hidden="true">+</span>{item}</li>)}</ul></article>
      <article className="system-watchouts"><p className="eyebrow">SINIRLAR VE KRİTİK BAŞLIKLAR</p><h2>Erken çözülmesi gerekenler</h2><ul>{system.watchouts.map((item) => <li key={item}><span aria-hidden="true">→</span>{item}</li>)}</ul></article>
    </div></section>

    <section className="section shell system-use-layout">
      <div><p className="eyebrow">Uygun Kullanım Alanları</p><h2>Hangi projelerde<br/><em>değerlendirilir?</em></h2><p>Sistem uygunluğu, aşağıdaki genel kullanım alanlarından çok projeye özel verilerle kesinleşir.</p></div>
      <ol>{system.suitableFor.map((item, index) => <li key={item}><span>{String(index + 1).padStart(2, "0")}</span><b>{item}</b></li>)}</ol>
    </section>

    <section className="system-inputs section"><div className="shell"><p className="eyebrow">Karar Girdileri</p><div className="section-heading"><h2>Sağlıklı ön proje için<br/><em>hangi veriler gerekir?</em></h2><p>Veri tamamlandıkça sistem karşılaştırması somutlaşır; kapsam, takvim ve yaklaşık maliyet daha güvenilir okunur.</p></div><div className="system-input-grid">{system.designInputs.map((item, index) => <article key={item}><span>{String(index + 1).padStart(2, "0")}</span><h3>{item}</h3></article>)}</div></div></section>

    <section className="section shell system-process"><p className="eyebrow">TEKNİK YAKLAŞIM</p><div className="section-heading"><h2>Karardan uygulamaya<br/><em>izlenebilir dört adım.</em></h2><p>Taşıyıcı sistem kararını üretim ve saha gerçekliğine bağlayan bütünleşik çalışma modeli.</p></div><div className="system-process-grid">{system.process.map((step, index) => <article key={step.title}><span>{String(index + 1).padStart(2, "0")}</span><h3>{step.title}</h3><p>{step.description}</p></article>)}</div></section>

    <section className="v3d-system-evidence"><div className="shell v3d-system-evidence-grid"><div><p className="eyebrow light">BAĞLI PROJE KAYDI</p><h2>{verifiedProjects.length ? "Doğrulanmış proje kayıtları" : "Doğrulanmış sistem eşlemesi bekleniyor"}</h2><p>Bir proje yalnız taşıyıcı sistem alanı kaynak dosyayla doğrulanıp yayımlandığında burada görünür. Proje adı veya görsel benzerliğinden sistem sonucu üretmiyoruz.</p></div><div className="v3d-system-evidence-list">{verifiedProjects.length ? verifiedProjects.map((project) => <Link href={`/projeler/${project.slug}`} key={project.slug}><span>{project.code}</span><b>{project.shortTitle}</b><em>Doğrulandı ↗</em></Link>) : <div className="v3d-evidence-empty"><span>KAYNAK KONTROLÜ</span><p>Sistem paftası, hesap modeli veya onaylı karar kaydı yayın kaydına bağlanmayı bekliyor.</p><Link className="text-link" href="/projeler">Proje kayıtlarını inceleyin <span aria-hidden="true">↗</span></Link></div>}</div></div></section>

    <section className="service-faq system-faq"><div className="shell service-faq-layout"><div><p className="eyebrow light">Sık Sorulan Sorular</p><h2>{system.shortName} hakkında<br/><em>net yanıtlar.</em></h2><p>Yanıtlar genel çerçeveyi açıklar. Uygulanabilir çözüm, projeye özel veriler ve güncel gereklilikler üzerinden hazırlanır.</p></div><div className="faq-list">{system.faqs.map((faq, index) => <details key={faq.question}><summary><span>{String(index + 1).padStart(2, "0")}</span>{faq.question}<b aria-hidden="true">+</b></summary><p>{faq.answer}</p></details>)}</div></div></section>

    <section className="section shell system-related"><p className="eyebrow">İlgili Arkem Alanları</p><div className="section-heading"><h2>Bilgiden somut<br/><em>proje adımına.</em></h2><p>İhtiyacınıza göre projelendirme, yapım veya danışmanlık kapsamını derinleştirin.</p></div><div className="system-related-grid">{system.relatedServices.map((item, index) => <Link href={item.href} key={item.href}><span>{String(index + 1).padStart(2, "0")}</span><h3>{item.title}</h3><p>{item.description}</p><b>İnceleyin ↗</b></Link>)}</div></section>

    <section className="assistant-boundary"><div className="shell"><b>Mühendislik sınırı</b><p>Bu sayfa genel bilgilendirme sunar; statik hesap, keşif, teklif, ruhsat uygunluğu veya kesin sistem seçimi değildir. Nihai çözüm zemin, mimari, yük, mevzuat, üretim ve saha verileriyle projeye özel geliştirilir.</p></div></section>
    <SiteFooter />
  </main>;
}
