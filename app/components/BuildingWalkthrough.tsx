"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Box, Footprints, Layers3, RotateCcw, Maximize2, Minimize2 } from "lucide-react";
import type { BuildingView, WalkCommand, createBuildingWalkthrough } from "../lib/building-walkthrough";
import { ProjectModelViewer } from './ProjectModelViewer';

type Experience = ReturnType<typeof createBuildingWalkthrough>;
export function BuildingWalkthrough({ english = false }: { english?: boolean }) {
  const [example, setExample] = useState(false);
  return <div className="model-experience"><div className="model-experience-switch" role="group" aria-label={english ? 'Presentation selection' : 'Sunum seçimi'}><button type="button" aria-pressed={!example} onClick={() => setExample(false)}>{english ? 'Architectural project' : 'Mimari proje'}</button><button type="button" aria-pressed={example} onClick={() => setExample(true)}>{english ? 'Industrial example' : 'Endüstriyel örnek'}</button></div>{example ? <ExampleBuildingWalkthrough english={english} /> : <ProjectModelViewer english={english} />}</div>;
}
function ExampleBuildingWalkthrough({ english = false }: { english?: boolean }) {
  const host = useRef<HTMLDivElement>(null);
  const viewport = useRef<HTMLDivElement>(null);
  const experience = useRef<Experience | null>(null);
  const container = useRef<HTMLElement>(null);
  const expandButton = useRef<HTMLButtonElement>(null);
  const [view, setView] = useState<BuildingView>("outside");
  const [active, setActive] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [status, setStatus] = useState<"loading" | "ready" | "unavailable">("loading");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!expanded) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const background: Array<[HTMLElement, boolean]> = [];
    let branch: HTMLElement | null = container.current;
    while (branch?.parentElement) {
      const parent: HTMLElement = branch.parentElement;
      for (const sibling of Array.from(parent.children)) {
        if (sibling !== branch && sibling instanceof HTMLElement) { background.push([sibling, sibling.inert]); sibling.inert = true; }
      }
      if (parent === document.body) break;
      branch = parent;
    }
    expandButton.current?.focus({ preventScroll: true });
    return () => { for (const [element, inert] of background) element.inert = inert; document.body.style.overflow = previousOverflow; expandButton.current?.focus({ preventScroll: true }); };
  }, [expanded]);
  useEffect(() => {
    let cancelled = false;
    let owned: Experience | undefined;
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      observer.disconnect();
      void import("../lib/building-walkthrough").then(({ createBuildingWalkthrough: create }) => {
        if (cancelled || !host.current) return;
        try {
          owned = create(host.current, () => { owned?.dispose(); experience.current = null; if (!cancelled) { setStatus("unavailable"); setActive(false); } });
          owned.setActive(false); experience.current = owned; setStatus("ready");
        } catch { if (!cancelled) setStatus("unavailable"); }
      }).catch(() => { if (!cancelled) setStatus("unavailable"); });
    }, { rootMargin: "150px" });
    if (host.current) observer.observe(host.current);
    return () => { cancelled = true; observer.disconnect(); owned?.dispose(); if (experience.current === owned) experience.current = null; };
  }, [attempt]);
  function choose(next: BuildingView) { setView(next); experience.current?.setView(next); if (active) viewport.current?.focus({ preventScroll: true }); }
  function engage(value: boolean) { setActive(value); experience.current?.setActive(value); if (value) viewport.current?.focus({ preventScroll: true }); }
  function walk(command: WalkCommand) { experience.current?.walk(command); }
  const views = [
    { id: "outside" as const, label: english ? "Exterior" : "Dışarıdan keşfet", icon: Box },
    { id: "inside" as const, label: english ? "Walk inside" : "İçeri gir", icon: Footprints },
    { id: "structure" as const, label: english ? "Structural frame" : "Taşıyıcıyı gör", icon: Layers3 },
  ];
  const notes = {
    outside: english ? "Drag to orbit. Scroll or pinch to zoom." : "Sürükleyerek çevresinde dönün. Tekerlek veya iki parmakla yaklaşın.",
    inside: english ? "Roof-hidden cutaway of the main hall. Drag to look; use W / S, arrow keys or the controls to walk." : "Ana holün çatısı kaldırılmış iç görünümü. Sürükleyerek bakın; W / S, yön tuşları veya düğmelerle gezinin.",
    structure: english ? "The cladding is hidden: explore the columns, trusses and bracing." : "Kaplamalar kaldırıldı: kolonları, makasları ve çaprazları inceleyin.",
  };
  return <section ref={container} className={`building-tour${expanded ? " is-expanded" : ""}`} role={expanded ? 'dialog' : undefined} aria-modal={expanded || undefined} aria-label={english ? "Interactive building tour" : "Etkileşimli yapı gezintisi"} onKeyDown={event => {
    if (event.key === "Escape") { engage(false); setExpanded(false); }
    if (expanded && event.key === 'Tab') {
      const elements = Array.from(container.current?.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], [tabindex="0"]') ?? []).filter(element => element.getClientRects().length > 0);
      const first = elements[0], last = elements.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }
  }}>
    <header className="building-tour-heading"><div><span>ARKEM / 3D</span><h2>{english ? "Explore a building." : "Bir yapının içine girin."}</h2></div><button ref={expandButton} type="button" onClick={() => setExpanded(v => !v)} aria-label={expanded ? (english ? "Compact view" : "Görünümü küçült") : (english ? "Expand view" : "Görünümü büyüt")} aria-expanded={expanded}>{expanded ? <Minimize2 size={19} /> : <Maximize2 size={19} />}</button></header>
    <div className={`building-tour-viewport${active ? " is-active" : ""}`} ref={viewport} tabIndex={0} role="group" aria-label={english ? "3D viewport. Escape ends interaction." : "3D görünüm. Escape gezintiyi bitirir."} onKeyDown={event => {
      if (event.key === "Escape") { engage(false); setExpanded(false); return; }
      if (!active || view !== "inside" || event.target !== event.currentTarget) return;
      const command = ({ w: "forward", W: "forward", ArrowUp: "forward", s: "back", S: "back", ArrowDown: "back", a: "left", A: "left", ArrowLeft: "left", d: "right", D: "right", ArrowRight: "right" } as Record<string, WalkCommand>)[event.key];
      if (command) { event.preventDefault(); walk(command); }
    }}>
      <div className="building-tour-canvas" ref={host} data-renderer-state={status} />
      <span className="building-tour-model-label">{english ? "EXAMPLE INDUSTRIAL BUILDING" : "ÖRNEK ENDÜSTRİYEL YAPI"}</span>
      {status !== "ready" && <div className="building-tour-placeholder" role="status"><Box size={38} strokeWidth={1.2} /><strong>{status === "loading" ? (english ? "Preparing your 3D tour…" : "3D gezintiniz hazırlanıyor…") : (english ? "3D is unavailable on this device." : "Bu cihazda 3D görünüm açılamadı.")}</strong>{status === "unavailable" && <><button type="button" onClick={() => { setStatus("loading"); setView("outside"); setAttempt(a => a + 1); }}>{english ? "Try again" : "Tekrar dene"}</button><Link href={english ? "/en/projects" : "/projeler"}>{english ? "Explore project photographs" : "Proje fotoğraflarını incele"}</Link></>}</div>}
      {status === "ready" && <div className="building-tour-engage"><button type="button" aria-pressed={active} onClick={() => engage(!active)}>{active ? (english ? "Finish exploring · Esc" : "Gezintiyi bitir · Esc") : (english ? "Start exploring" : "Gezintiye başla")}</button></div>}
    </div>
    <div className="building-tour-controls" role="group" aria-label={english ? "Building views" : "Yapı görünümleri"}>{views.map(item => <button type="button" key={item.id} aria-pressed={view === item.id} disabled={status !== "ready"} onClick={() => choose(item.id)}><item.icon size={18} aria-hidden="true" />{item.label}</button>)}<button type="button" disabled={status !== "ready"} aria-label={english ? "Reset view" : "Görünümü sıfırla"} onClick={() => { choose("outside"); engage(false); }}><RotateCcw size={18} aria-hidden="true" /></button></div>
    <p className="building-tour-instruction" role="status">{status === "ready" ? active ? notes[view] : (english ? "Choose a view, then start exploring." : "Bir görünüm seçin, ardından gezintiye başlayın.") : (english ? "The project links remain available while the model loads." : "Model hazırlanırken proje bağlantılarını kullanabilirsiniz.")}</p>
    {view === "inside" && active && <div className="building-tour-walk" role="group" aria-label={english ? "Walking controls" : "Gezinti düğmeleri"}>{(["left", "forward", "back", "right"] as WalkCommand[]).map(command => <button key={command} type="button" onClick={() => walk(command)}>{english ? ({left:"Turn left",forward:"Forward",back:"Back",right:"Turn right"})[command] : ({left:"Sola dön",forward:"İlerle",back:"Geri git",right:"Sağa dön"})[command]}</button>)}</div>}
    {view === "structure" && <details className="building-tour-scope"><summary>{english ? "About this example" : "Bu örnek hakkında"}</summary><p>{english ? "18 × 30 m main-hall axis dimensions, excluding the slab overhang and office annex; five frame positions and four bays. Interior movement is limited to the main hall, shown with its roof hidden. Member sizes, connections, foundations and stability have not been engineered. This presentation is neither a construction sequence nor a structural analysis or a model of your project." : "18 × 30 m ana hol aks ölçüsü; döşeme taşması ve ek ofis bu ölçüye dahil değildir. Beş çerçeve konumu ve dört aralık bulunur. İç gezinti, çatısı kaldırılmış ana holle sınırlıdır. Kesitler, birleşimler, temel ve stabilite sistemi mühendislik hesabıyla doğrulanmamıştır. Bu sunum bir montaj sırası, statik analiz veya size ait proje modeli değildir."}</p></details>}
    <footer><span>{english ? "Presentation model · not a completed reference project" : "Sunum modeli · uygulama projesi değildir"}</span><Link href={english ? "/en/projects" : "/projeler"}>{english ? "Our real projects" : "Gerçek projelerimiz"}</Link></footer>
  </section>;
}
