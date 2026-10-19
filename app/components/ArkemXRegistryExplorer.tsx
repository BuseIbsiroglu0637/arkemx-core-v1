"use client";

import Link from "next/link";
import { createPortal } from "react-dom";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, ArrowUpRight, X } from "lucide-react";
import { translateText } from "../data/i18n";
import type {
  PublicArkemXModule,
  PublicArkemXModuleGroup,
  PublicArkemXModuleGroupId,
} from "../data/arkemx-public-types";

const moduleNames: Record<string, string> = {
  "proje-modeli": "Project Model",
  "yapisal-analiz": "Structural Analysis",
  "deprem-muhendisligi": "Seismic Engineering",
  betonarme: "Reinforced Concrete",
  "prefabrik-betonarme": "Precast Reinforced Concrete",
  "yapisal-celik": "Structural Steel",
  "hafif-celik": "Light-Gauge Steel",
  "hibrit-sistemler": "Hybrid Systems",
  "temel-zemin": "Foundation & Soil Interaction",
  "detay-imalat": "Detailing & Fabrication",
  "metraj-maliyet": "Quantities & Cost",
  "dogrulama-izlenebilirlik": "Validation & Traceability",
  "yapim-saha": "Construction Stage & Site",
};

const customerModuleRoutes: Record<string, string> = {
  "proje-modeli": "/arkemx", "yapisal-analiz": "/tasarim-calismalari#tasiyici-on-tasarim", "deprem-muhendisligi": "/muhendislik-koordinasyon", betonarme: "/yapi-sistemi-karsilastirma#sistem-karsilastirma", "prefabrik-betonarme": "/yapi-sistemi-karsilastirma#sistem-karsilastirma", "yapisal-celik": "/yapi-sistemi-karsilastirma#sistem-karsilastirma", "hafif-celik": "/yapi-sistemi-karsilastirma#sistem-karsilastirma", "hibrit-sistemler": "/yapi-sistemi-karsilastirma#sistem-karsilastirma", "temel-zemin": "/arsa-fizibilite-studyosu", "detay-imalat": "/muhendislik-koordinasyon", "metraj-maliyet": "/proje-os", "dogrulama-izlenebilirlik": "/dijital-proje-merkezi#canli-proje-grafigi", "yapim-saha": "/proje-os",
};

const groupNames: Record<PublicArkemXModuleGroupId, string> = {
  "modelleme-analiz": "Modelling & Analysis",
  "tasiyici-sistemler": "Structural Systems",
  "temel-uretim": "Foundation & Production",
  "ekonomi-kontrol": "Project Economics & Control",
  yapim: "Construction",
};

const englishStatuses: Record<string, string> = {
  AKTİF: "ACTIVE",
  "AKTİF · GELİŞTİRİLİYOR": "ACTIVE · IN DEVELOPMENT",
  DOĞRULANIYOR: "UNDER VALIDATION",
  "GELİŞTİRME PROGRAMINDA": "IN DEVELOPMENT PROGRAMME",
};

const getRelatedCodes = (module: PublicArkemXModule) => new Set(module.connectedModuleCodes);

function ModuleDrawer({ module, groups, modules, locale, onClose, onPrevious, onNext }: { module: PublicArkemXModule; groups: readonly PublicArkemXModuleGroup[]; modules: readonly PublicArkemXModule[]; locale: "tr" | "en"; onClose: () => void; onPrevious: () => void; onNext: () => void }) {
  const closeButton = useRef<HTMLButtonElement>(null);
  const drawer = useRef<HTMLElement>(null);
  const group = groups.find((item) => item.id === module.groupId)!;
  const english = locale === "en";
  const t = (value: string) => english ? translateText(value, "en") : value;

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    const previousRootOverflow = document.documentElement.style.overflow;
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = Array.from(drawer.current?.querySelectorAll<HTMLElement>("a[href], button:not([disabled]), summary, [tabindex]:not([tabindex='-1'])") ?? []);
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    window.requestAnimationFrame(() => closeButton.current?.focus());
    return () => {
      document.body.style.overflow = previousOverflow;
      document.documentElement.style.overflow = previousRootOverflow;
      document.removeEventListener("keydown", onKeyDown);
      previouslyFocused?.focus();
    };
  }, [onClose]);

  if (typeof document === "undefined") return null;
  return createPortal(<div className="v34-module-drawer-root v4-module-drawer-root">
    <button className="v34-module-drawer-backdrop v4-module-drawer-backdrop" type="button" onClick={onClose} aria-label={english ? "Close module detail" : "Modül detayını kapat"} />
    <article ref={drawer} className="v34-module-drawer v4-module-drawer" role="dialog" aria-modal="true" aria-labelledby="arkemx-module-title" data-module-id={`ARKEMX-${module.code}`}>
      <header><div><button className="v4-module-back" type="button" onClick={onClose}><ArrowLeft size={17} strokeWidth={1.7} aria-hidden="true" /> ARKEMX</button><span>{module.code} / 13 · {english ? groupNames[group.id] : group.title.toLocaleUpperCase("tr-TR")}</span><h3 id="arkemx-module-title">{english ? moduleNames[module.id] : module.title}</h3></div><button ref={closeButton} className="v4-module-close" type="button" onClick={onClose} aria-label={english ? "Close module detail" : "Modül detayını kapat"}><X size={24} strokeWidth={1.6} aria-hidden="true" /></button></header>
      <div className="v4-module-status"><strong>{english ? englishStatuses[module.status] : module.status}</strong>{module.version ? <span>{module.version}</span> : null}<span>{english ? translateText(module.lastUpdated, "en") : module.lastUpdated}</span></div>
      <p className="v4-module-description">{t(module.shortDescription)}</p>
      <div className="v4-module-sections">
        <section><strong>{english ? "WHAT DOES IT SOLVE?" : "NEYİ ÇÖZER?"}</strong><p>{t(module.problemSolved)}</p></section>
        <section><strong>{english ? "INPUTS" : "GİRDİLER"}</strong><ul>{module.inputs.map((item) => <li key={item}>{t(item)}</li>)}</ul></section>
        <section><strong>{english ? "OUTPUTS" : "ÇIKTILAR"}</strong><ul>{module.outputs.map((item) => <li key={item}>{t(item)}</li>)}</ul></section>
        <section><strong>{english ? "CONNECTED MODULES" : "BAĞLI MODÜLLER"}</strong><ul>{module.connectedModuleCodes.map((code) => {
          const connected = modules.find((item) => item.code === code);
          return <li key={code}>{code} · {connected ? (english ? moduleNames[connected.id] : connected.title) : code}</li>;
        })}</ul></section>
      </div>
      <details className="v4-module-validation"><summary>{english ? "VIEW TECHNICAL VALIDATION" : "TEKNİK DOĞRULAMA AYRINTILARINI GÖRÜNTÜLE"}</summary><p>{t(module.publicValidationSummary)}</p></details>
      <details className="v4-module-updates"><summary>{english ? "RECENT DEVELOPMENT" : "SON GELİŞTİRMELER"}</summary><ul>{module.latestPublicUpdates.map((item) => <li key={item}>{t(item)}</li>)}</ul></details>
      <Link className="v4-module-route" href={english ? `/en/contact?arkemx=${module.code}` : customerModuleRoutes[module.id] || "/arkemx"} data-analytics="arkemx_working_module_open" data-analytics-context={module.code}>{english ? "OPEN PRE-ASSESSMENT" : "İLGİLİ ÇALIŞMA ALANINI AÇIN"}</Link>
      <nav className="v4-module-pagination" aria-label={english ? "Module navigation" : "Modül yönlendirmesi"}><button type="button" onClick={onPrevious}><ArrowLeft size={16} strokeWidth={1.7} aria-hidden="true" /> {english ? "Previous Module" : "Önceki Modül"}</button><span>{module.code} / 13</span><button type="button" onClick={onNext}>{english ? "Next Module" : "Sonraki Modül"} <ArrowRight size={16} strokeWidth={1.7} aria-hidden="true" /></button></nav>
    </article>
  </div>, document.body);
}

export function ArkemXRegistryExplorer({ groups, modules, locale = "tr" }: { groups: readonly PublicArkemXModuleGroup[]; modules: readonly PublicArkemXModule[]; locale?: "tr" | "en" }) {
  const [selectedGroupId, setSelectedGroupId] = useState<PublicArkemXModuleGroupId>("modelleme-analiz");
  const [selectedModuleId, setSelectedModuleId] = useState("proje-modeli");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const english = locale === "en";
  const selectedModule = modules.find((module) => module.id === selectedModuleId) ?? modules[0];
  const relatedCodes = useMemo(() => getRelatedCodes(selectedModule), [selectedModule]);
  const relatedModules = useMemo(
    () => modules.filter((module) => relatedCodes.has(module.code)),
    [modules, relatedCodes],
  );

  const writeHash = useCallback((id: string) => {
    const base = `${window.location.pathname}${window.location.search}`;
    window.history.replaceState(null, "", `${base}#${id}`);
  }, []);

  const selectGroup = (id: PublicArkemXModuleGroupId) => {
    setSelectedGroupId(id);
    const first = modules.find((module) => module.groupId === id);
    if (first) setSelectedModuleId(first.id);
    writeHash(id);
  };

  const openModule = useCallback((id: string) => {
    const registryModule = modules.find((item) => item.id === id);
    if (!registryModule) return;
    setSelectedGroupId(registryModule.groupId);
    setSelectedModuleId(registryModule.id);
    setDrawerOpen(true);
    writeHash(registryModule.id);
  }, [modules, writeHash]);

  useEffect(() => {
    const syncId = (id: string) => {
      if (!id) return;
      const registryModule = modules.find((item) => item.id === id);
      if (registryModule) {
        setSelectedGroupId(registryModule.groupId);
        setSelectedModuleId(registryModule.id);
        setDrawerOpen(true);
        return;
      }
      const group = groups.find((item) => item.id === id);
      if (group) setSelectedGroupId(group.id);
    };
    const syncHash = () => syncId(window.location.hash.replace(/^#/, ""));
    const syncSamePageLink = (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>("a[href]") : null;
      if (!target) return;
      const destination = new URL(target.href, window.location.href);
      if (destination.pathname !== window.location.pathname || !destination.hash) return;
      syncId(destination.hash.replace(/^#/, ""));
    };
    syncHash();
    const deferredHashSync = [80, 240, 600, 1200, 2400].map((delay) => window.setTimeout(syncHash, delay));
    window.addEventListener("hashchange", syncHash);
    window.addEventListener("popstate", syncHash);
    document.addEventListener("click", syncSamePageLink, true);
    return () => {
      deferredHashSync.forEach((timer) => window.clearTimeout(timer));
      window.removeEventListener("hashchange", syncHash);
      window.removeEventListener("popstate", syncHash);
      document.removeEventListener("click", syncSamePageLink, true);
    };
  }, [groups, modules]);

  const closeDrawer = () => {
    setDrawerOpen(false);
    const base = `${window.location.pathname}${window.location.search}`;
    window.history.replaceState(null, "", base);
  };
  const moveModule = (offset: number) => {
    const index = modules.findIndex((module) => module.id === selectedModule.id);
    const next = modules[(index + offset + modules.length) % modules.length];
    openModule(next.id);
  };

  return <section className="v34-registry v4-registry" data-testid="arkemx-module-registry">
    <header className="v4-registry-overview">
      <div><span>{english ? "PLATFORM OVERVIEW" : "PLATFORM HARİTASI"}</span><h3>{english ? "One project model. Connected engineering." : "Tek proje modeli. Birbirine bağlı mühendislik."}</h3><p>{english ? "The first level shows one data backbone and five engineering groups. Module and validation detail opens only when requested." : "İlk seviyede bir veri omurgası ve beş mühendislik grubu görünür. Modül ve doğrulama ayrıntısı yalnız istendiğinde açılır."}</p></div>
      <dl><div><dt>13</dt><dd>{english ? "PROJECT ENGINEERING MODULES" : "PROJE MÜHENDİSLİĞİ MODÜLÜ"}</dd></div><div><dt>5</dt><dd>{english ? "ENGINEERING GROUPS" : "MÜHENDİSLİK GRUBU"}</dd></div><div><dt>1</dt><dd>{english ? "PROJECT-DATA BACKBONE" : "ORTAK PROJE OMURGASI"}</dd></div></dl>
    </header>

    <div className="v4-platform-map" aria-label={english ? "Five ARKEMX engineering groups" : "Beş ARKEMX mühendislik grubu"}>
      <div><small>{english ? "COMMON PROJECT BACKBONE" : "ORTAK PROJE OMURGASI"}</small><strong>{english ? "PROJECT MODEL" : "PROJE MODELİ"}</strong></div>
      {groups.map((group) => <button id={group.id} type="button" className={selectedGroupId === group.id ? "is-active" : ""} aria-pressed={selectedGroupId === group.id} onClick={() => selectGroup(group.id)} key={group.id}><span>{group.code}</span><b>{english ? groupNames[group.id] : group.title}</b><small>{modules.filter((module) => module.groupId === group.id).length} {english ? "MODULES" : "MODÜL"}</small></button>)}
    </div>

    <div className="v4-registry-desktop">
      <nav className="v4-module-groups" aria-label={english ? "Module groups" : "Modül grupları"}>{groups.map((group) => <button type="button" className={selectedGroupId === group.id ? "is-active" : ""} onClick={() => selectGroup(group.id)} key={group.id}><span>{group.code}</span><b>{english ? groupNames[group.id] : group.title}</b></button>)}</nav>
      <div className="v4-module-matrix" aria-label={english ? "Thirteen ARKEMX modules" : "13 ARKEMX modülü"}>{modules.map((module) => {
        const selected = module.id === selectedModule.id;
        const related = relatedCodes.has(module.code);
        return <button id={module.id} type="button" className={`${selected ? "is-selected" : ""} ${related ? "v4-related-module" : ""} ${module.groupId === selectedGroupId ? "is-group-active" : ""}`} data-analytics="arkemx_module_open" data-analytics-context={module.id} onMouseEnter={() => setSelectedModuleId(module.id)} onFocus={() => setSelectedModuleId(module.id)} onClick={() => openModule(module.id)} key={module.id}><span>{module.code}</span><b>{english ? moduleNames[module.id] : module.title}</b><small>{english ? englishStatuses[module.status] : module.status}</small></button>;
      })}</div>
      <aside className="v4-module-summary"><span>{selectedModule.code} / 13</span><h3>{english ? moduleNames[selectedModule.id] : selectedModule.title}</h3><strong>{english ? englishStatuses[selectedModule.status] : selectedModule.status}</strong><p>{english ? translateText(selectedModule.shortDescription, "en") : selectedModule.shortDescription}</p><div className="v4-module-network"><small>{english ? "REGISTRY CONNECTIONS" : "REGISTRY BAĞLANTILARI"}</small><div><span>{selectedModule.code}</span><nav aria-label={english ? "Connected modules" : "Bağlı modüller"}>{relatedModules.map((module) => <button type="button" key={module.id} onClick={() => openModule(module.id)} aria-label={english ? moduleNames[module.id] : module.title}>{module.code}</button>)}</nav></div></div><button type="button" onClick={() => openModule(selectedModule.id)}>{english ? "OPEN MODULE DETAIL" : "MODÜL DETAYINI AÇIN"}<ArrowUpRight className="v4-arrow-icon" size={17} strokeWidth={1.7} aria-hidden="true" /></button></aside>
    </div>

    <div className="v4-registry-mobile" aria-label={english ? "ARKEMX mobile module groups" : "ARKEMX mobil modül grupları"}>
      {groups.map((group) => {
        const groupModules = modules.filter((module) => module.groupId === group.id);
        return <details key={group.id} open={selectedGroupId === group.id} onToggle={(event) => event.currentTarget.open && setSelectedGroupId(group.id)}><summary><span>{group.code}</span><b>{english ? groupNames[group.id] : group.title}</b><small>{groupModules.length} {english ? "modules" : "modül"}</small></summary><div>{groupModules.map((module) => <button type="button" onClick={() => openModule(module.id)} key={module.id}><span>{module.code}</span><b>{english ? moduleNames[module.id] : module.title}</b><small>{english ? englishStatuses[module.status] : module.status}</small><ArrowUpRight className="v4-arrow-icon" size={17} strokeWidth={1.7} aria-hidden="true" /></button>)}</div></details>;
      })}
    </div>
    {drawerOpen ? <ModuleDrawer module={selectedModule} groups={groups} modules={modules} locale={locale} onClose={closeDrawer} onPrevious={() => moveModule(-1)} onNext={() => moveModule(1)} /> : null}
  </section>;
}
