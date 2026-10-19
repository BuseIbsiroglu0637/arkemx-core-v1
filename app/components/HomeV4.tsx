import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, ChevronRight, ClipboardList, FolderPlus, Layers3, MapPin, PhoneCall } from "lucide-react";
import { englishProjectRecords } from "../data/projects-en";
import { getPublicV3Projects } from "../lib/public-projects";
import { projectVisualKind, selectProjectPhoto } from "../lib/project-photo";
import { ProjectPhoto } from "./ProjectPhoto";
import { HomeProjectCarousel } from "./HomeProjectCarousel";
import { BuildingWalkthrough } from "./BuildingWalkthrough";
import { SiteFooter, SiteHeader } from "./SiteChrome";
import { projectPresentations } from "../data/project-presentations";

type HomeLocale = "tr" | "en";

const copy = {
  tr: {
    label: "00 / ARKEM",
    title: <><span>MÜHENDİSLİKTEN</span><em>SAHAYA.</em></>,
    lead: "Betonarme prefabrik, yapısal çelik, hafif çelik ve hibrit yapı sistemlerinde proje, mühendislik ve uygulama.",
    primary: "YENİ PROJE BAŞLAT",
    secondary: "PROJEME DEVAM ET",
    process: ["Proje", "Analiz", "Detay", "Üretim", "Saha"],
  },
  en: {
    label: "00 / ARKEM",
    title: <><span>ENGINEERING</span><em>TO THE SITE.</em></>,
    lead: "Project design, structural engineering and delivery for precast concrete, structural steel, light-gauge steel and hybrid building systems.",
    primary: "VIEW PROJECTS",
    secondary: "START TECHNICAL REVIEW",
    process: ["Project", "Analysis", "Detail", "Production", "Site"],
  },
} as const;

const capabilities = [
  { tr: "Projeye başlayacağım", en: "Start a project", subTr: "Hedefinizi anlatın · yol haritanızı görün", subEn: "Describe the goal · see the route", href: "/proje-baslat", enHref: "/en/contact", icon: FolderPlus },
  { tr: "Arsayı değerlendireceğim", en: "Assess a site", subTr: "Konum · parsel · ön fizibilite", subEn: "Location · parcel · feasibility", href: "/arsa-fizibilite-studyosu", enHref: "/en/contact", icon: MapPin },
  { tr: "Sistem seçeceğim", en: "Compare systems", subTr: "Prefabrik · çelik · hafif çelik · hibrit", subEn: "Precast · steel · light-gauge · hybrid", href: "/yapi-sistemi-karsilastirma", enHref: "/en/systems", icon: Layers3 },
  { tr: "Projemi takip edeceğim", en: "Existing project enquiry", subTr: "Sıradaki iş · kararlar · dosyalar", subEn: "Contact ARKEM about your project", href: "/musteri-proje-portali", enHref: "/en/contact", icon: ClipboardList },
] as const;

const digitalSteps = [
  { code: "01", title: "BAŞLANGIÇ", note: "Hedef ve ihtiyaç", href: "/proje-baslat" },
  { code: "02", title: "ARSA", note: "Konum ve fizibilite", href: "/arsa-fizibilite-studyosu" },
  { code: "03", title: "YAPI", note: "Alan ve mekân programı", href: "/mimari-program-studyosu" },
  { code: "04", title: "SİSTEM", note: "Alternatifleri karşılaştırın", href: "/yapi-sistemi-karsilastirma" },
  { code: "05", title: "YÖNETİM", note: "Koordinasyon, süre ve maliyet", href: "/proje-os" },
] as const;

const systems = [
  { code: "01", tr: "BETONARME PREFABRİK", en: "PRECAST CONCRETE", href: "/yapi-sistemleri/betonarme-prefabrik", enHref: "/en/systems#precast", noteTr: "Eleman düzeni, üretim, lojistik ve montaj tek sistem kararında.", noteEn: "Element layout, production, logistics and assembly in one system decision." },
  { code: "02", tr: "YAPISAL ÇELİK", en: "STRUCTURAL STEEL", href: "/yapi-sistemleri/celik", enHref: "/en/systems#steel", noteTr: "Geniş açıklık, stabilite, birleşim ve koruma birlikte.", noteEn: "Span, stability, connections and protection considered together." },
  { code: "03", tr: "HAFİF ÇELİK", en: "LIGHT-GAUGE STEEL", href: "/yapi-sistemleri/hafif-celik", enHref: "/en/systems#light-steel", noteTr: "Panelizasyon, yapı fiziği ve hassas kuru üretim.", noteEn: "Panelisation, building physics and precise dry production." },
  { code: "04", tr: "HİBRİT SİSTEMLER", en: "HYBRID SYSTEMS", href: "/yapi-sistemleri/karma-sistem", enHref: "/en/systems#hybrid", noteTr: "Farklı taşıyıcı sistemlerin proje bazlı arayüz kararı.", noteEn: "Project-specific interfaces between multiple structural systems." },
] as const;

const methodology = [
  ["01", "KAPSAM", "SCOPE", "İhtiyaç · geometri · sorumluluk", "Need · geometry · responsibility"],
  ["02", "SİSTEM KARARI", "SYSTEM DECISION", "Alternatif · süre · tedarik", "Alternatives · programme · supply"],
  ["03", "MODEL", "MODEL", "Aks · eleman · malzeme", "Grid · element · material"],
  ["04", "ANALİZ", "ANALYSIS", "Davranış · kontrol · doğrulama", "Behaviour · checks · validation"],
  ["05", "DETAY / ÜRETİM", "DETAIL / PRODUCTION", "Pafta · imalat · metraj", "Drawing · fabrication · quantities"],
  ["06", "SAHA", "SITE", "Montaj · revizyon · kapanış", "Assembly · revision · close-out"],
] as const;

const outputCards = [
  ["TEMSİLİ MODEL", "ILLUSTRATIVE MODEL", "/visuals/arkem-x-design-v2.webp", "Temsili taşıyıcı sistem modeli", "Illustrative structural-system model"],
  ["3B GÖRSEL", "3D VIEW", "/projects/v32/devrekani-3b.webp", "Devrekani betonarme prefabrik tesis üç boyutlu proje kaydı", "Devrekani precast concrete facility, 3D project view"],
  ["TAŞIYICI SİSTEM", "STRUCTURAL SYSTEM", "/projects/v32/cihan-tasiyici.webp", "Cihan Tat Gıda betonarme prefabrik taşıyıcı sistem saha kaydı", "Cihan Tat Gıda precast concrete structure, site record"],
  ["SAHA", "SITE", "/projects/v32/yapikur-montaj.webp", "Yapıkur Plaza prefabrik montaj saha kaydı", "Yapıkur Plaza precast assembly, site record"],
] as const;

export async function HomeV4({ locale = "tr" }: { locale?: HomeLocale }) {
  const english = locale === "en";
  const c = copy[locale];
  const projects = await getPublicV3Projects();
  const selectedProjects = projects
    .filter((project) => project.homepageFeatured)
    .sort((left, right) => (left.homepagePriority ?? 999) - (right.homepagePriority ?? 999))
    .slice(0, 4);
  const projectThumbnails = [...projects]
    .filter(project => project.archiveVisible && selectProjectPhoto(project.slug, project.publishedMedia))
    .sort((left, right) => (left.homepagePriority ?? 999) - (right.homepagePriority ?? 999));
  const projectSlides = projectThumbnails.map(project => {
    const photo = selectProjectPhoto(project.slug, project.publishedMedia)!;
    const visualKind = projectVisualKind(photo.href);
    return {
      code: project.code,
      href: english ? `/en/projects/${project.slug}` : `/projeler/${project.slug}`,
      title: english ? englishProjectRecords[project.slug]?.title ?? project.shortTitle : project.shortTitle,
      src: photo.href, caption: photo.caption,
      kind: visualKind === "model" ? (english ? "3D project view" : "3B proje görseli") : visualKind === "photo" ? (english ? "Site photograph" : "Saha fotoğrafı") : (english ? "Project image" : "Proje görseli"),
    };
  });
  if (!english) {
    for (const item of projectSlides) {
      const presentation = projectPresentations.find(p => `/projeler/${p.slug}` === item.href);
      if (presentation && presentation.cover.kind === 'photo') { item.src = presentation.cover.src; item.caption = presentation.cover.alt; item.kind = 'Saha kaydı'; }
    }
    for (const presentation of projectPresentations.filter(p => p.model && !projectSlides.some(item => item.href === `/projeler/${p.slug}`)).slice(0, 10)) projectSlides.push({ code: `REF-${presentation.slug}`, href: `/projeler/${presentation.slug}`, title: presentation.title, src: presentation.cover.src, caption: presentation.cover.alt, kind: '3B sunum' });
  }
  return <main className="v4-home home-experience" lang={english ? "en" : "tr"}>
    <SiteHeader dark={false} />
    <section className="v4-hero" id="arkem">
      <div className="shell v4-hero-grid">
        <div className="v4-hero-copy">
          <p className="home-opening-label">{english ? "ARKEM / BUILDING SYSTEMS" : "ARKEM / YAPI SİSTEMLERİ"}</p>
          <h1>{c.title}</h1>
          <p className="v4-hero-lead">{c.lead}</p>
          <div className="v4-actions">
            <Link className="v4-button is-primary" data-analytics="hero_cta" href={english ? "/en/projects" : "/proje-baslat"}>{c.primary}<ArrowUpRight className="v4-arrow-icon" size={17} strokeWidth={1.7} aria-hidden="true" /></Link>
            <Link className="v4-button is-secondary" data-analytics="hero_cta" href={english ? "/en/contact" : "/musteri-proje-portali"}>{c.secondary}<ArrowUpRight className="v4-arrow-icon" size={17} strokeWidth={1.7} aria-hidden="true" /></Link>
          </div>
          <ol className="v4-hero-process" aria-label={english ? "ARKEM project process" : "ARKEM proje süreci"}>
            {c.process.map((step, index) => <li key={step}><span>{String(index + 1).padStart(2, "0")}</span><b>{step}</b>{index < c.process.length - 1 ? <ChevronRight size={14} strokeWidth={1.6} aria-hidden="true" /> : null}</li>)}
          </ol>
          <Link className="home-explore-link" href="#proje-deneyimi">{english ? "Explore the work" : "Mühendisliği keşfedin"}<ChevronRight size={16} aria-hidden="true" /></Link>
        </div>
        <BuildingWalkthrough english={english} />
      </div>
      <div className="shell home-project-rail"><HomeProjectCarousel items={projectSlides} english={english} /></div>
      <p className="shell v117-choice-label">{english ? "WHAT WOULD YOU LIKE TO DO?" : "NE YAPMAK İSTİYORSUNUZ?"}</p>
      <nav className="shell v4-capability-band" aria-label={english ? "Choose your next step" : "İhtiyacınıza göre yönlendirme"}>
        {capabilities.map((item, index) => <Link href={english ? item.enHref : item.href} key={item.tr}><div className="home-capability-symbol"><item.icon size={25} strokeWidth={1.6} aria-hidden="true" /><span aria-hidden="true">{String(index + 1).padStart(2, "0")}</span></div><strong>{english ? item.en : item.tr}</strong><small>{english ? item.subEn : item.subTr}</small></Link>)}
      </nav>
    </section>

    <section className="v4-section v4-projects" id="proje-deneyimi">
      <div className="shell">
        <header className="v4-section-head">
          <div><p className="v4-index">01 / {english ? "PROJECT EXPERIENCE" : "PROJE DENEYİMİ"}</p><h2>{english ? <>Engineering decisions,<br /><em>recorded through delivery.</em></> : <>Her proje, mühendislik yaklaşımımızın<br /><em>uygulamadaki karşılığıdır.</em></>}</h2></div>
          <p>{english ? "We record completed and ongoing work with the structural-system decision, ARKEM scope and site process—not only the final image." : "Tamamlanan ve devam eden çalışmaları; taşıyıcı sistem kararı, ARKEM kapsamı ve uygulama süreciyle birlikte kayıt altına alıyoruz."}</p>
        </header>
        <div className="v4-project-editorial">
          {selectedProjects.map((project, index) => {
            const cover = selectProjectPhoto(project.slug, project.publishedMedia);
            const enProject = englishProjectRecords[project.slug];
            return <article className={index === 0 ? "is-flagship" : ""} key={project.slug}>
              <Link className="v4-project-image" href={english ? `/en/projects/${project.slug}` : `/projeler/${project.slug}`}>
                {cover ? <ProjectPhoto src={cover.href} alt={cover.caption || project.shortTitle} sizes={index === 0 ? "(max-width: 900px) 100vw, 62vw" : "(max-width: 900px) 100vw, 32vw"} /> : null}
                <span>{project.code}</span>
              </Link>
              <div><small>{project.code} / {english ? "TECHNICAL PROJECT RECORD" : "TEKNİK PROJE KAYDI"}</small><h3><Link href={english ? `/en/projects/${project.slug}` : `/projeler/${project.slug}`}>{english ? enProject?.title : project.shortTitle}</Link></h3>
                <dl><div><dt>{english ? "LOCATION" : project.facts.location.status === "arşiv doğrulaması" ? "YAPI TÜRÜ" : "LOKASYON"}</dt><dd>{english ? enProject?.location : project.facts.location.status === "arşiv doğrulaması" ? project.facts.buildingType.value : project.facts.location.value}</dd></div><div><dt>{english ? "SYSTEM" : "SİSTEM"}</dt><dd>{english ? enProject?.system : project.facts.system.value}</dd></div></dl>
              </div>
            </article>;
          })}
        </div>
        <div className="v4-section-link"><Link href={english ? "/en/projects" : "/projeler"}>{english ? "VIEW THE PROJECT ARCHIVE" : "TÜM PROJE ARŞİVİ"}<ArrowUpRight className="v4-arrow-icon" size={17} strokeWidth={1.7} aria-hidden="true" /></Link></div>
      </div>
    </section>

    <section className="v4-section v4-systems" id="yapi-sistemleri">
      <div className="shell">
        <header className="v4-section-head is-light"><div><p className="v4-index">02 / {english ? "BUILDING SYSTEMS" : "YAPI SİSTEMLERİ"}</p><h2>{english ? <>The system follows<br /><em>the project.</em></> : <>Projeye göre sistem.<br /><em>Sisteme göre mühendislik.</em></>}</h2></div><p>{english ? "Span, load path, ground conditions, programme, supply and production reality shape the structural-system decision." : "Açıklık, yük yolu, zemin, süre, tedarik ve üretim gerçekleri taşıyıcı sistem kararını birlikte belirler."}</p></header>
        <div className="v4-systems-stage">
          <div className="v4-systems-media"><ProjectPhoto src="/projects/v32/cihan-tamamlanan.webp" alt={english ? "Completed precast concrete industrial building" : "Tamamlanan betonarme prefabrik endüstriyel yapı"} /><span>{english ? "REAL PROJECT RECORD · P-002" : "GERÇEK PROJE KAYDI · P-002"}</span></div>
          <nav>{systems.map((system) => <Link id={system.enHref.split("#")[1]} key={system.code} href={english ? system.enHref : system.href}><span>{system.code}</span><div><b>{english ? system.en : system.tr}</b><small>{english ? system.noteEn : system.noteTr}</small></div><ArrowUpRight className="v4-arrow-icon" size={17} strokeWidth={1.7} aria-hidden="true" /></Link>)}</nav>
        </div>
      </div>
    </section>

    <section className="v4-section v4-engineering" id="muhendislik">
      <div className="shell v4-engineering-grid">
        <div className="v4-engineering-board">
          <div className="v4-engineering-model"><Image src="/visuals/arkem-x-design-v2.webp" fill sizes="(max-width: 900px) 100vw, 48vw" unoptimized alt={english ? "Illustrative structural-system model" : "Temsili taşıyıcı sistem modeli"} /><span className="hotspot h1">01<small>{english ? "LOAD PATH" : "YÜK YOLU"}</small></span><span className="hotspot h2">02<small>{english ? "SYSTEM" : "SİSTEM"}</small></span><span className="hotspot h3">03<small>{english ? "DETAIL" : "DETAY"}</small></span></div>
          <div className="v4-board-caption"><span>MODEL / ARKEMX</span><b>{english ? "ILLUSTRATIVE MODEL VIEW" : "TEMSİLİ MODEL GÖRÜNÜMÜ"}</b></div>
        </div>
        <div className="v4-engineering-copy"><p className="v4-index">03 / {english ? "ENGINEERING" : "MÜHENDİSLİK"}</p><h2>{english ? <>Analysis is a step.<br /><em>Engineering is the chain.</em></> : <>Analiz bir aşamadır.<br /><em>Mühendislik karar zinciridir.</em></>}</h2><p>{english ? "We carry the structural decision from system selection and analysis into detailing, production preparation and the site." : "Taşıyıcı sistem kararını seçim ve analizden; detay, üretim hazırlığı ve sahadaki karşılığına kadar birlikte ele alıyoruz."}</p>
          <ol>{(english ? ["Structural-system design", "Structural analysis", "Seismic engineering", "Detailing and fabrication", "BIM and coordination", "Site engineering"] : ["Taşıyıcı sistem tasarımı", "Statik analiz", "Deprem mühendisliği", "Detay ve imalat", "BIM ve koordinasyon", "Saha mühendisliği"]).map((item, index) => <li key={item}><span>{String(index + 1).padStart(2, "0")}</span>{item}</li>)}</ol>
          <Link className="v4-text-link" href={english ? "/en/engineering" : "/muhendislik"}>{english ? "EXPLORE ENGINEERING" : "MÜHENDİSLİK KAPSAMINI İNCELE"}<ArrowUpRight className="v4-arrow-icon" size={17} strokeWidth={1.7} aria-hidden="true" /></Link>
        </div>
      </div>
    </section>

    <section className="v4-section v4-arkemx" id="arkemx">
      <div className="shell v4-arkemx-grid">
        <div className="v4-arkemx-copy"><p className="v4-index">04 / {english ? "DIGITAL PROJECT TOOLS" : "DİJİTAL PROJE ARAÇLARI"}</p><span>{english ? "NO TECHNICAL KNOWLEDGE REQUIRED" : "TEKNİK BİLGİ GEREKTİRMEZ"}</span><h2>{english ? "CHOOSE WHAT YOU NEED." : "NE YAPMAK İSTEDİĞİNİZİ SEÇİN."}<br /><em>{english ? "FOLLOW ONE CLEAR ROUTE." : "TEK BİR YOLDAN İLERLEYİN."}</em></h2><p>{english ? "Tell us what you need next. Contact ARKEM with a new project brief or an existing project reference." : "Yeni bir proje başlatın ya da mevcut projenize devam edin. Müşteri görünümü yalnız sıradaki kararı gösterir; teknik ayrıntılar ikinci seviyede açılır."}</p><div className="v117-digital-actions"><Link className="v4-button is-primary" href={english ? "/en/contact" : "/proje-baslat"}>{english ? "START A PROJECT" : "YÖNLENDİRMELİ BAŞLA"}<ArrowUpRight className="v4-arrow-icon" size={17} strokeWidth={1.7} aria-hidden="true" /></Link><Link className="v4-text-link" href={english ? "/en/arkemx" : "/dijital-donusum"}>{english ? "VIEW DIGITAL TOOLS" : "TÜM DİJİTAL ARAÇLAR"}<ArrowUpRight className="v4-arrow-icon" size={17} strokeWidth={1.7} aria-hidden="true" /></Link></div></div>
        <div className="v4-arkemx-map" aria-label={english ? "ARKEMX platform map" : "ARKEMX platform haritası"}>
          <Link className="v4-spine v117-portal-spine" href={english ? "/en/contact" : "/musteri-proje-portali"}><small>{english ? "YOUR EXISTING PROJECT" : "MEVCUT PROJENİZ"}</small><strong>{english ? "CONTACT ABOUT YOUR PROJECT" : "MÜŞTERİ PROJE PORTALI"}</strong><span>{english ? "SHARE YOUR PROJECT REFERENCE AND REQUEST" : "BUGÜN · PROJEM · KARARLAR VE DOSYALAR"}</span></Link>
          <div className="v4-group-map">{digitalSteps.map((step) => <Link key={step.code} href={english ? "/en/contact" : step.href}><span>{step.code}</span><b>{english ? ({"BAŞLANGIÇ":"START","ARSA":"SITE","YAPI":"BUILDING","SİSTEM":"SYSTEM","YÖNETİM":"MANAGEMENT"} as Record<string,string>)[step.title] : step.title}</b><small>{english ? "OPEN THE NEXT STEP" : step.note}</small></Link>)}</div>
          <p>{english ? "Explore the digital project tools that match your needs. Start with the task, not a product name." : "İhtiyacınıza uygun dijital proje araçlarını inceleyin. Ürün adıyla değil, yapmak istediğiniz işle başlayın."}</p>
        </div>
      </div>
    </section>

    <section className="v4-section v4-methodology" id="projeden-sahaya">
      <div className="shell"><header className="v4-section-head"><div><p className="v4-index">05 / {english ? "FROM PROJECT TO SITE" : "PROJEDEN SAHAYA"}</p><h2>{english ? <>One decision.<br /><em>A traceable project chain.</em></> : <>Bir karar.<br /><em>İzlenebilir proje zinciri.</em></>}</h2></div><p>{english ? "A change in the project model is evaluated together with its effects on analysis, detail, production and site records." : "Proje modelindeki değişiklik; analiz, detay, üretim ve saha kayıtlarındaki etkisiyle birlikte değerlendirilir."}</p></header><ol className="v4-method-flow">{methodology.map(([code, tr, en, subTr, subEn]) => <li key={code}><span>{code}</span><b>{english ? en : tr}</b><small>{english ? subEn : subTr}</small></li>)}</ol></div>
    </section>

    <section className="v4-section v4-outputs" id="teknik-ciktilar">
      <div className="shell"><header className="v4-section-head is-light"><div><p className="v4-index">06 / {english ? "TECHNICAL OUTPUTS" : "TEKNİK ÇIKTILAR"}</p><h2>{english ? <>Engineering becomes visible<br /><em>in the output.</em></> : <>Mühendislik,<br /><em>çıktıda görünür olur.</em></>}</h2></div><p>{english ? "Illustrative model, three-dimensional project view, structural-system and site-record examples from different projects and platform records." : "Farklı proje ve platform kayıtlarından temsili model, üç boyutlu proje görseli, taşıyıcı sistem ve saha kaydı örnekleri."}</p></header><div className="v4-output-mosaic">{outputCards.map(([tr, en, src, alt, altEn], index) => <figure className={index === 0 ? "is-large" : ""} key={tr}><ProjectPhoto src={src} sizes={index === 0 ? "(max-width: 900px) 100vw, 52vw" : "(max-width: 900px) 100vw, 24vw"} alt={english ? altEn : alt} /><figcaption><span>{String(index + 1).padStart(2, "0")}</span><b>{english ? en : tr}</b></figcaption></figure>)}</div></div>
    </section>

    <section className="v4-section v4-about" id="kurumsal">
      <div className="shell v4-about-grid"><div><p className="v4-index">07 / ARKEM</p><h2>{english ? <>ENGINEERING TO THE SITE.<br /><em>SITE EXPERIENCE TO TECHNOLOGY.</em></> : <>MÜHENDİSLİKTEN SAHAYA.<br /><em>SAHA DENEYİMİNDEN TEKNOLOJİYE.</em></>}</h2><p>{english ? "ARKEM coordinates structural engineering, building systems, production preparation and site decisions within the agreed project scope." : "ARKEM; taşıyıcı sistem mühendisliğini, yapı sistemlerini, üretim hazırlığını ve saha kararlarını proje kapsamına göre koordineli biçimde ele alır."}</p><Link className="v4-text-link" href={english ? "/en/about" : "/arkem"}>{english ? "ABOUT ARKEM" : "ARKEM'İ TANIYIN"}<ArrowUpRight className="v4-arrow-icon" size={17} strokeWidth={1.7} aria-hidden="true" /></Link></div><article className="v4-leadership"><Image src="/ozenc-ozturk.jpg" width={1122} height={1402} sizes="(max-width: 700px) 34vw, 230px" unoptimized alt="Özenç Öztürk" /><div><small>{english ? "FOUNDER / TECHNICAL LEADERSHIP" : "KURUCU / TEKNİK LİDERLİK"}</small><b>Özenç Öztürk</b><span>{english ? "MSc Civil Engineer" : "Yüksek İnşaat Mühendisi"}</span><p>{english ? "Structural-system decisions, project coordination and the development direction of ARKEMX." : "Taşıyıcı sistem kararları, proje koordinasyonu ve ARKEMX'in geliştirme yönü."}</p></div></article></div>
    </section>

    <section className="v4-section v4-contact" id="proje-on-degerlendirme">
      <div className="shell v4-contact-frame"><div><p className="v4-index">08 / {english ? "PROJECT PRE-ASSESSMENT" : "PROJE ÖN DEĞERLENDİRME"}</p><h2>{english ? <>Send the project data.<br /><em>Let us establish the right technical start.</em></> : <>Proje verisini gönderin.<br /><em>Doğru teknik başlangıcı birlikte kuralım.</em></>}</h2><p>{english ? "Share the location, building type, approximate area, project stage, requested scope, target date and available files. We agree on the assessment scope after reviewing your information." : "Konum, yapı türü, yaklaşık alan, proje aşaması, istediğiniz hizmet, hedef tarih ve elinizdeki dosyaları paylaşın. Değerlendirme kapsamını verilerinizi inceledikten sonra birlikte belirleyelim."}</p></div><div className="v4-contact-actions"><Link className="v4-button is-primary" href={english ? "/en/contact" : "/iletisim"}>{english ? "START TECHNICAL REVIEW" : "TEKNİK DEĞERLENDİRMEYE GÖNDER"}<ArrowUpRight className="v4-arrow-icon" size={17} strokeWidth={1.7} aria-hidden="true" /></Link><a className="v4-button is-secondary" href="tel:+905335755437">{english ? "CALL ARKEM" : "İLETİŞİME GEÇİN"}<PhoneCall className="v4-arrow-icon" size={17} strokeWidth={1.7} aria-hidden="true" /></a></div></div>
    </section>
    <SiteFooter />
  </main>;
}
