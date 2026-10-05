"use client";

import Link from "next/link";
import {
  ArrowRight,
  Boxes,
  Building2,
  Calculator,
  ChartNoAxesCombined,
  CircleCheck,
  Command,
  Compass,
  FileStack,
  HardHat,
  Layers3,
  MapPinned,
  Search,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { blogPosts } from "../data/blog";
import { completedWorks, designs, documents, readyProjects, trainings } from "../data/platform";
import { referenceRecords } from "../data/references";
import { services } from "../data/services";
import { navigationTree } from "../data/site";
import { structuralSystems } from "../data/structural-systems";
import { PROJECT_MODULES } from "../lib/project-graph";
import { useProjectKernel } from "./ProjectKernel";
import { resourceAnchor, resources } from "./ResourceLibrary";
import { expandMultilingualQuery } from "../lib/multilingual-search";

type SearchRecord = {
  group: string;
  label: string;
  description: string;
  href: string;
  keywords: string;
  icon: LucideIcon;
};

const commands: SearchRecord[] = [
  { group: "Projenizi başlatın", label: "Proje Karar Asistanı", description: "Hazırlık skoru, eksik veri ve ilk hizmet", href: "/proje-karar-asistani", keywords: "yatırım brief teklif başlangıç", icon: Compass },
  { group: "Projenizi başlatın", label: "Parsel & Arazi Stüdyosu", description: "Koordinat, parsel, 2B/3B yerleşim ve çıktı", href: "/arsa-fizibilite-studyosu", keywords: "arsa harita kml dxf arazi", icon: MapPinned },
  { group: "Tasarım", label: "Mimari Program Stüdyosu", description: "Mahal, zon, cephe ve performans programı", href: "/mimari-program-studyosu", keywords: "mimari mahal alan cephe günışığı", icon: Building2 },
  { group: "Tasarım", label: "Plan & Taşıyıcı Stüdyosu", description: "Aks, nesne modeli, yükler ve ön metraj", href: "/tasarim-calismalari", keywords: "statik betonarme çelik bim plan", icon: Layers3 },
  { group: "Tasarım", label: "Yapı Sistemi Karşılaştırma", description: "Beş sistemi gerekçeli karar matrisiyle kıyaslayın", href: "/yapi-sistemi-karsilastirma", keywords: "çelik prefabrik betonarme hafif çelik", icon: Calculator },
  { group: "Koordinasyon", label: "Mühendislik Koordinasyonu", description: "Mimari, statik, MEP, zemin ve issue kaydı", href: "/muhendislik-koordinasyon", keywords: "mep çakışma kesit zemin drenaj", icon: Boxes },
  { group: "Koordinasyon", label: "Prototip Proje Merkezi", description: "Bağlı çalışma alanlarının ortak proje veri grafiği", href: "/dijital-proje-merkezi", keywords: "veri zinciri proje merkezi", icon: ChartNoAxesCombined },
  { group: "Teslim & güven", label: "Arkem Proje OS", description: "4B, doküman, karar, bütçe, saha ve teslim", href: "/proje-os", keywords: "cde program bütçe rfi kalite", icon: FileStack },
  { group: "Teslim & güven", label: "Doğrulanmış Çalışmalar", description: "3B model, doküman ve video arşivi", href: "/referanslar", keywords: "referans proje model kanıt", icon: ShieldCheck },
  { group: "Teslim & güven", label: "Proje Görüşmesi", description: "Teknik ön bilgiyi hazırlayın ve paylaşın", href: "/iletisim", keywords: "iletişim teklif whatsapp görüşme", icon: HardHat },
];

const indexedRecords: SearchRecord[] = [
  ...commands,
  {
    group: "Kurumsal kayıtlar",
    label: "Özenç Öztürk",
    description: "Yüksek İnşaat Mühendisi · Yüksek Patlayıcı Mühendisi · Kurucu / Teknik Yönetim",
    href: "/kurumsal#ozenc-ozturk",
    keywords: "özenç ozturk ozenc öztürk ytü yıldız teknik üniversitesi kurucu yüksek inşaat mühendisi yüksek patlayıcı mühendisi yetkinlik deneyim",
    icon: HardHat,
  },
  ...navigationTree.flatMap((group) => [
    {
      group: "Site bölümleri",
      label: group.label,
      description: group.description,
      href: group.href,
      keywords: `${group.label} ${group.description}`,
      icon: Compass,
    },
    ...group.sections.flatMap((section) => section.items.map((item) => ({
      group: section.title,
      label: item.label,
      description: item.note,
      href: item.href,
      keywords: `${group.label} ${section.title} ${item.label} ${item.note}`,
      icon: Compass,
    }))),
  ]),
  ...PROJECT_MODULES.map((module) => ({
    group: `ARKEMX · ${module.stage}`,
    label: module.label,
    description: `${module.discipline} · ${module.output}`,
    href: module.route,
    keywords: `${module.code} ${module.stage} ${module.discipline} ${module.output} ${module.dependencies.join(" ")}`,
    icon: Boxes,
  })),
  ...services.map((service) => ({
    group: "Hizmetler ve kapsamlar",
    label: service.title,
    description: service.summary,
    href: `/hizmetler/${service.slug}`,
    keywords: JSON.stringify(service),
    icon: HardHat,
  })),
  ...structuralSystems.map((system) => ({
    group: "Yapı sistemleri",
    label: system.name,
    description: system.summary,
    href: `/yapi-sistemleri/${system.slug}`,
    keywords: JSON.stringify(system),
    icon: Layers3,
  })),
  ...blogPosts.map((post) => ({
    group: `Bilgi yazıları · ${post.category}`,
    label: post.title,
    description: post.description,
    href: `/blog/${post.slug}`,
    keywords: JSON.stringify(post),
    icon: FileStack,
  })),
  ...resources.map((resource) => ({
    group: `Teknik kaynaklar · ${resource.category}`,
    label: resource.title,
    description: `${resource.discipline} · ${resource.description}`,
    href: `/dokumanlar#${resourceAnchor(resource.title)}`,
    keywords: JSON.stringify(resource),
    icon: FileStack,
  })),
  ...referenceRecords.map((record) => ({
    group: `Proje arşivi · ${record.category}`,
    label: record.title,
    description: record.summary,
    href: `/referanslar/${record.slug}`,
    keywords: JSON.stringify(record),
    icon: ShieldCheck,
  })),
  ...[
    ...documents.map((item) => ({ ...item, route: "/dokumanlar", group: "Dokümanlar" })),
    ...designs.map((item) => ({ ...item, route: "/tasarim-calismalari", group: "Tasarım çalışmaları" })),
    ...completedWorks.map((item) => ({ ...item, route: "/yapilmis-isler", group: "Yapılmış işler" })),
    ...readyProjects.map((item) => ({ ...item, route: "/hazir-projeler", group: "Hazır projeler" })),
    ...trainings.map((item) => ({ ...item, route: "/egitimler", group: "Eğitimler" })),
  ].map((item) => ({
    group: item.group,
    label: item.title,
    description: item.description,
    href: item.route,
    keywords: JSON.stringify(item),
    icon: FileStack,
  })),
].filter((item, index, records) => records.findIndex((candidate) => candidate.href === item.href && candidate.label === item.label) === index);

function normalizeSearch(value: string) {
  return value
    .toLocaleLowerCase("tr-TR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ı/g, "i")
    .replace(/[ç]/g, "c")
    .replace(/[ğ]/g, "g")
    .replace(/[ö]/g, "o")
    .replace(/[ş]/g, "s")
    .replace(/[ü]/g, "u");
}

export function CommandLauncher() {
  return <button className="command-launcher" type="button" onClick={() => window.dispatchEvent(new Event("arkem-command-open"))} aria-label="Arkem hızlı erişim merkezini aç">
    <Search size={15} aria-hidden="true"/><span>Keşfet</span><kbd>⌘ K</kbd>
  </button>;
}

export function SiteCommandCenter() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const visible = useMemo(() => {
    const normalized = normalizeSearch(query).trim();
    if (!normalized) return commands;
    const { terms, expanded } = expandMultilingualQuery(normalized, normalizeSearch);
    return indexedRecords
      .map((item) => {
        const haystack = normalizeSearch(`${item.label} ${item.description} ${item.keywords} ${item.group}`);
        const matchedTerms = terms.filter((term) => haystack.includes(term) || expanded.some((alias) => haystack.includes(alias))).length;
        const label = normalizeSearch(item.label);
        const score = matchedTerms * 10 + (label.includes(normalized) ? 25 : 0) + (label.startsWith(normalized) ? 15 : 0);
        return { item, matchedTerms, score };
      })
      .filter((result) => result.matchedTerms === terms.length)
      .sort((first, second) => second.score - first.score || first.item.label.localeCompare(second.item.label, "tr"))
      .slice(0, 36)
      .map((result) => result.item);
  }, [query]);

  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLocaleLowerCase("tr-TR") === "k") {
        event.preventDefault();
        setOpen((current) => !current);
      }
      if (event.key === "Escape") setOpen(false);
    };
    const launch = () => setOpen(true);
    window.addEventListener("keydown", keydown);
    window.addEventListener("arkem-command-open", launch);
    return () => { window.removeEventListener("keydown", keydown); window.removeEventListener("arkem-command-open", launch); };
  }, []);

  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => inputRef.current?.focus(), 30);
    document.body.classList.add("command-center-open");
    return () => { window.clearTimeout(timer); document.body.classList.remove("command-center-open"); };
  }, [open]);

  if (!open) return null;
  return <div className="command-center-backdrop" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) setOpen(false); }}>
    <section className="command-center" role="dialog" aria-modal="true" aria-labelledby="command-center-title">
      <header><div><span>ARKEM / HIZLI ERİŞİM</span><h2 id="command-center-title">Ne yapmak istiyorsunuz?</h2></div><button type="button" onClick={() => setOpen(false)} aria-label="Hızlı erişim merkezini kapat"><X size={20}/></button></header>
      <label className="command-search"><Search size={19} aria-hidden="true"/><input ref={inputRef} type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Kişi, hizmet, mevzuat, araç, proje veya teknik konu arayın…"/><kbd>ESC</kbd></label>
      {query.trim() && <div className="command-result-summary"><b>{visible.length}</b><span>site kaydı eşleşti</span><small>Başlıklar, açıklamalar ve içerik ayrıntıları birlikte tarandı.</small></div>}
      <div className="command-results">{visible.map((item, index) => { const Icon = item.icon; const previous = visible[index - 1]; return <div key={`${item.href}-${item.label}`}>{(!previous || previous.group !== item.group) && <p>{item.group}</p>}<Link href={item.href} onClick={() => setOpen(false)}><span><Icon size={18}/></span><div><b>{item.label}</b><small>{item.description}</small></div><ArrowRight size={17}/></Link></div>; })}{!visible.length && <div className="command-empty"><Search size={24}/><b>Bu ifadeyle eşleşen site kaydı bulunamadı.</b><span>Farklı bir teknik terim veya daha kısa bir ifade deneyin.</span></div>}</div>
      <footer><span><Command size={14}/> Klavyeden açın: Ctrl/⌘ + K</span><Link href="/site-haritasi" onClick={() => setOpen(false)}>Tüm platform haritası <ArrowRight size={14}/></Link></footer>
    </section>
  </div>;
}

export function SiteScrollProgress() {
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    const update = () => {
      const total = document.documentElement.scrollHeight - window.innerHeight;
      setProgress(total > 0 ? Math.min(100, Math.max(0, window.scrollY / total * 100)) : 0);
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => { window.removeEventListener("scroll", update); window.removeEventListener("resize", update); };
  }, []);
  return <div className="site-scroll-progress" aria-hidden="true"><span style={{ width: `${progress}%` }}/></div>;
}

const roles = [
  { value: "yatirimci", label: "Yatırımcı / İşveren", detail: "Doğru kapsam, süre, bütçe ve risk görünümü" },
  { value: "tasarimci", label: "Mimar / Tasarım Ekibi", detail: "Program, sistem, BIM ve disiplin koordinasyonu" },
  { value: "yuklenici", label: "Yüklenici / Geliştirici", detail: "Yapılabilirlik, metraj, tedarik ve saha planı" },
] as const;
const projectTypes = [
  { value: "sanayi", label: "Sanayi / Depo", goal: "sanayi" },
  { value: "konut", label: "Konut / Villa", goal: "konut" },
  { value: "ticari", label: "Ticari / Sosyal", goal: "ticari" },
  { value: "mevcut", label: "Mevcut Yapı", goal: "mevcut" },
  { value: "yikim", label: "Kontrollü Yıkım", goal: "yikim" },
] as const;
const stages = [
  { value: "fikir", label: "Fikir / arsa" },
  { value: "on-proje", label: "Ön proje" },
  { value: "ruhsat", label: "Ruhsat / uygulama" },
  { value: "teklif", label: "Teklif / firma seçimi" },
  { value: "santiye", label: "Üretim / şantiye" },
] as const;
const priorities = [
  { value: "sure", label: "Süre", detail: "Program ve tedarik" },
  { value: "butce", label: "Bütçe", detail: "Metraj ve kapsam" },
  { value: "guvenlik", label: "Teknik risk", detail: "Kontrol ve kayıt" },
  { value: "enerji", label: "Performans", detail: "Enerji ve karbon" },
] as const;

export function ProjectConcierge() {
  const { patchModule, setIdentity } = useProjectKernel();
  const [role, setRole] = useState<(typeof roles)[number]["value"]>("yatirimci");
  const [type, setType] = useState<(typeof projectTypes)[number]["value"]>("sanayi");
  const [stage, setStage] = useState<(typeof stages)[number]["value"]>("fikir");
  const [priority, setPriority] = useState<(typeof priorities)[number]["value"]>("sure");
  const [prepared, setPrepared] = useState(false);

  const result = useMemo(() => {
    const roleLabel = roles.find((item) => item.value === role)?.label ?? "Yatırımcı";
    const typeItem = projectTypes.find((item) => item.value === type) ?? projectTypes[0];
    const stageLabel = stages.find((item) => item.value === stage)?.label ?? "Fikir / arsa";
    const priorityLabel = priorities.find((item) => item.value === priority)?.label ?? "Süre";
    const service = type === "yikim" ? { label: "Yıkım mühendisliği ön incelemesi", href: "/yikim-karar-studyosu" } : stage === "santiye" ? { label: "Yapım ve saha koordinasyonu", href: "/proje-os" } : stage === "teklif" || type === "mevcut" ? { label: "Teknik danışmanlık ve kapsam kontrolü", href: "/hizmetler/danismanlik" } : { label: "Bütünleşik projelendirme", href: "/proje-karar-asistani" };
    const deliverables = type === "yikim"
      ? ["Yapı ve çevre veri listesi", "Yöntem ön eleme kaydı", "Emniyet ve izin yol haritası"]
      : priority === "butce"
        ? ["Sistem alternatif matrisi", "Ön metraj ve kapsam sınırı", "Karar–maliyet bağlantısı"]
        : priority === "enerji"
          ? ["Kabuk ve yönlenme girdileri", "Karbon / sistem senaryosu", "Performans doğrulama planı"]
          : ["Koordinatlı proje briefi", "Disiplin karar kapıları", "Uygulanabilir teknik yol haritası"];
    const modules = type === "yikim" ? ["GIS", "DEM", "CDE"] : stage === "fikir" ? ["PIR", "GIS", "ARC", "MCDA"] : stage === "santiye" ? ["4B", "CDE", "RLT", "AIM"] : ["ARC", "BIM", "STR", "ICE"];
    return { roleLabel, typeItem, stageLabel, priorityLabel, service, deliverables, modules };
  }, [priority, role, stage, type]);

  const prepare = () => {
    setIdentity({ name: `${result.typeItem.label} · ${result.stageLabel}` });
    patchModule("decision-assistant", {
      input: { goal: result.typeItem.goal, stage, system: "kararsiz", location: "", area: "", documents: [], priorities: [priority], role },
      result: { service: result.service, deliverables: result.deliverables, modules: result.modules },
      status: "guided-intake",
    });
    setPrepared(true);
  };

  return <section className="project-concierge" id="proje-konsiyerji">
    <div className="shell concierge-shell">
      <header className="concierge-heading"><div><p className="eyebrow light">Arkem Project Concierge</p><h2>Size ait proje yolculuğunu<br/><em>ilk dakikada kurun.</em></h2></div><p>Rolünüzü ve önceliğinizi seçin. Arkem; konuşacağınız uzmanlığı, açacağınız dijital araçları ve ilk karar paketini anında düzenlesin.</p></header>
      <div className="concierge-workspace">
        <div className="concierge-controls">
          <fieldset><legend>01 / Sizin rolünüz</legend><div className="concierge-role-grid">{roles.map((item) => <button type="button" key={item.value} className={role === item.value ? "active" : ""} onClick={() => { setRole(item.value); setPrepared(false); }}><span>{role === item.value ? <CircleCheck size={17}/> : <Building2 size={17}/>}</span><b>{item.label}</b><small>{item.detail}</small></button>)}</div></fieldset>
          <div className="concierge-field-row"><label><span>02 / Proje tipi</span><select value={type} onChange={(event) => { setType(event.target.value as typeof type); setPrepared(false); }}>{projectTypes.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label><label><span>03 / Mevcut aşama</span><select value={stage} onChange={(event) => { setStage(event.target.value as typeof stage); setPrepared(false); }}>{stages.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label></div>
          <fieldset><legend>04 / Birincil karar odağı</legend><div className="concierge-priority-grid">{priorities.map((item) => <button type="button" key={item.value} className={priority === item.value ? "active" : ""} onClick={() => { setPriority(item.value); setPrepared(false); }}><b>{item.label}</b><small>{item.detail}</small></button>)}</div></fieldset>
          <button className="concierge-prepare" type="button" onClick={prepare}><Sparkles size={17}/>{prepared ? "Çalışma alanı hazır" : "Proje çalışma alanını hazırla"}<ArrowRight size={17}/></button>
          <small className="concierge-privacy"><ShieldCheck size={14}/> Seçimler bu cihazdaki proje oturumuna eklenir; sunucuya gönderilmez.</small>
        </div>
        <aside className="concierge-result" aria-live="polite">
          <header><span>ARKEM / EXECUTIVE BRIEF</span><b>{prepared ? "OTURUM HAZIR" : "CANLI ÖN İZLEME"}</b></header>
          <div className="concierge-result-title"><small>{result.roleLabel} · {result.typeItem.label}</small><h3>{result.service.label}</h3><p>{result.stageLabel} aşamasında, <b>{result.priorityLabel.toLocaleLowerCase("tr-TR")}</b> odağında önerilen başlangıç paketi.</p></div>
          <div className="concierge-deliverables"><span>İLK KARAR PAKETİ</span>{result.deliverables.map((item, index) => <p key={item}><small>0{index + 1}</small><b>{item}</b><CircleCheck size={15}/></p>)}</div>
          <div className="concierge-modules"><span>BAĞLANACAK MODÜLLER</span><div>{result.modules.map((item) => <b key={item}>{item}</b>)}</div></div>
          <div className="concierge-actions"><Link href={result.service.href}>Teknik akışı açın <ArrowRight size={16}/></Link><Link href="/iletisim">Uzman görüşmesi <ArrowRight size={16}/></Link></div>
        </aside>
      </div>
    </div>
  </section>;
}

const decisionStages = [
  { code: "G0", title: "Yatırım Tanımı", copy: "İhtiyaç, arsa, kapasite ve başarı ölçütleri", evidence: "PIR · GIS · karar kaydı", score: 92 },
  { code: "G1", title: "Sistem Kararı", copy: "Mimari program, taşıyıcı alternatif ve ön metraj", evidence: "ARC · MCDA · STR", score: 84 },
  { code: "G2", title: "Koordinasyon", copy: "Disiplin arayüzleri, issue ve bilgi teslim planı", evidence: "BIM · ICE · BEP", score: 78 },
  { code: "G3", title: "Yapım & Teslim", copy: "Program, tedarik, saha kanıtı ve yapı pasaportu", evidence: "4B · CDE · AIM", score: 71 },
] as const;

export function ExecutiveDecisionShowcase() {
  const [active, setActive] = useState(0);
  const current = decisionStages[active];
  return <section className="executive-showcase section"><div className="shell executive-grid"><div className="executive-copy"><p className="eyebrow light">Karar Kalitesi / Yönetici Görünümü</p><h2>Teknik ayrıntıyı kaybetmeden,<br/><em>yönetilebilir hale getirin.</em></h2><p>Arkem’in dijital katmanı; model sayısını artırmak için değil, doğru kararın kaynağını, etkisini ve sonraki sahibini görünür kılmak için çalışır.</p><div className="executive-stage-list">{decisionStages.map((item, index) => <button type="button" key={item.code} onClick={() => setActive(index)} className={active === index ? "active" : ""}><span>{item.code}</span><div><b>{item.title}</b><small>{item.copy}</small></div><ArrowRight size={16}/></button>)}</div></div><aside className="executive-panel"><header><div><span>ARKEM / KARAR ALANI</span><b>YÖNETİCİ ÖZETİ</b></div><i><ShieldCheck size={15}/> KAYNAĞA BAĞLI</i></header><section><div className="executive-gauge"><span>{current.code}</span><strong>{current.score}<small>/100</small></strong><i><b style={{ width: `${current.score}%` }}/></i><small>veri hazırlık göstergesi</small></div><div className="executive-current"><span>AKTİF KARAR KAPISI</span><h3>{current.title}</h3><p>{current.copy}</p><b>{current.evidence}</b></div></section><div className="executive-ledger"><p><span>Karar sahibi</span><b>{active < 2 ? "İşveren · Mimari · Statik" : "Proje Yönetimi · Disiplin Liderleri"}</b></p><p><span>Kanıt türü</span><b>{active === 3 ? "Saha kaydı · teslim verisi" : "Model · hesap · konu kaydı"}</b></p><p><span>Sonraki kapı</span><b>{active === 3 ? "İşletme / varlık bilgisi" : decisionStages[Math.min(3, active + 1)].title}</b></p></div><footer><Link href="/dijital-proje-merkezi">Prototip proje grafiğini açın <ArrowRight size={15}/></Link><span><ShieldCheck size={14}/> Temsili karar görünümü</span></footer></aside></div></section>;
}
