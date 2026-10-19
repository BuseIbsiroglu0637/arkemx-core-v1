"use client";
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { Box, Map, Trees, Maximize2, Minimize2, RotateCcw, ZoomIn, ZoomOut } from 'lucide-react';
import type { ProjectModelExperience, ProjectModelView } from '../lib/project-model-viewer';

export function ProjectModelViewer({ english = false }: { english?: boolean }) {
  const host = useRef<HTMLDivElement>(null), viewport = useRef<HTMLDivElement>(null), container = useRef<HTMLElement>(null), expandButton = useRef<HTMLButtonElement>(null);
  const experience = useRef<ProjectModelExperience | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'unavailable'>('loading');
  const [attempt, setAttempt] = useState(0), [active, setActive] = useState(false), [expanded, setExpanded] = useState(false), [view, setView] = useState<ProjectModelView>('perspective');
  useEffect(() => {
    const controller = new AbortController();
    let owned: ProjectModelExperience | undefined;
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      observer.disconnect();
      void import('../lib/project-model-viewer').then(async ({ createProjectModelViewer }) => {
        if (controller.signal.aborted || !host.current) return;
        owned = await createProjectModelViewer(host.current, controller.signal, () => { if (!controller.signal.aborted) { setStatus('unavailable'); setActive(false); experience.current = null; } });
        if (controller.signal.aborted) { owned.dispose(); return; }
        experience.current = owned; setStatus('ready');
      }).catch(() => { if (!controller.signal.aborted) setStatus('unavailable'); });
    }, { rootMargin: '150px' });
    if (host.current) observer.observe(host.current);
    return () => { controller.abort(); observer.disconnect(); owned?.dispose(); if (experience.current === owned) experience.current = null; };
  }, [attempt]);
  useEffect(() => {
    if (!expanded) return;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const background: Array<[HTMLElement, boolean]> = [];
    let branch: HTMLElement | null = container.current;
    while (branch?.parentElement) { const parent: HTMLElement = branch.parentElement; for (const sibling of Array.from(parent.children)) if (sibling !== branch && sibling instanceof HTMLElement) { background.push([sibling, sibling.inert]); sibling.inert = true; } if (parent === document.body) break; branch = parent; }
    expandButton.current?.focus({ preventScroll: true });
    return () => { for (const [element, inert] of background) element.inert = inert; document.body.style.overflow = overflow; expandButton.current?.focus({ preventScroll: true }); };
  }, [expanded]);
  function engage(value: boolean) { setActive(value); experience.current?.setActive(value); if (value) viewport.current?.focus({ preventScroll: true }); }
  function choose(value: ProjectModelView) { setView(value); experience.current?.setView(value); }
  const views = [{ id: 'perspective' as const, label: english ? 'Perspective' : 'Genel görünüm', icon: Box }, { id: 'top' as const, label: english ? 'Site layout' : 'Yerleşimi gör', icon: Map }, { id: 'garden' as const, label: english ? 'Garden view' : 'Bahçeden bak', icon: Trees }];
  return <section ref={container} className={`building-tour project-model-tour${expanded ? ' is-expanded' : ''}`} role={expanded ? 'dialog' : undefined} aria-modal={expanded || undefined} aria-label={english ? 'Architectural project model' : 'Mimari proje modeli'} onKeyDown={event => {
    if (event.key === 'Escape') { engage(false); setExpanded(false); }
    if (expanded && event.key === 'Tab') {
      const elements = Array.from(container.current?.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], [tabindex="0"]') ?? []).filter(element => element.getClientRects().length > 0), first = elements[0], last = elements.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); } else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }
  }}>
    <header className="building-tour-heading"><div><span>ARKEM / PROJE ATÖLYESİ</span><h2>{english ? 'A project. Every angle.' : 'Bir proje. Her açıdan.'}</h2></div><button ref={expandButton} type="button" onClick={() => setExpanded(value => !value)} aria-expanded={expanded} aria-label={expanded ? (english ? 'Compact view' : 'Görünümü küçült') : (english ? 'Expand view' : 'Görünümü büyüt')}>{expanded ? <Minimize2 size={19} /> : <Maximize2 size={19} />}</button></header>
    <div ref={viewport} className={`building-tour-viewport${active ? ' is-active' : ''}`} tabIndex={0} role="group" aria-label={english ? '3D view. Left and right arrows orbit, plus and minus zoom, Escape exits.' : '3D görünüm. Sağ ve sol okla dönün; artı ve eksiyle yaklaşın. Escape gezintiyi bitirir.'} onKeyDown={event => { if (active && event.target === event.currentTarget && ['ArrowLeft', 'ArrowRight', '+', '=', '-'].includes(event.key)) { event.preventDefault(); experience.current?.move(event.key); } }}>
      {status !== 'ready' && <img className="project-model-poster" src="/models/arkem-residential-preview.png" alt={english ? 'Preview of the supplied architectural model with house, garden and pool' : 'Konut, bahçe ve havuz içeren mimari modelin ön görünümü'} />}
      <div ref={host} className="building-tour-canvas" data-renderer-state={status} data-model-kind="supplied-architectural" />
      <span className="building-tour-model-label">{english ? 'RESIDENTIAL / ARCHITECTURAL MODEL' : 'KONUT / MİMARİ MODEL'}</span>
      {status !== 'ready' && <div className="building-tour-placeholder" role="status"><strong>{status === 'loading' ? (english ? 'Preparing the model…' : 'Model hazırlanıyor…') : (english ? 'Interactive view unavailable on this device.' : 'Bu cihazda etkileşimli görünüm açılamadı.')}</strong>{status === 'unavailable' && <button type="button" onClick={() => { setStatus('loading'); setView('perspective'); setActive(false); setAttempt(value => value + 1); }}>{english ? 'Try again' : 'Tekrar dene'}</button>}</div>}
      {status === 'ready' && <div className="building-tour-engage"><button type="button" aria-pressed={active} onClick={() => engage(!active)}>{active ? (english ? 'Finish exploring · Esc' : 'Gezintiyi bitir · Esc') : (english ? 'Explore the model' : 'Modeli keşfet')}</button></div>}
    </div>
    <div className="building-tour-controls" role="group" aria-label={english ? 'Model views' : 'Model görünümleri'}>{views.map(item => <button key={item.id} type="button" disabled={status !== 'ready'} aria-pressed={view === item.id} onClick={() => choose(item.id)}><item.icon size={17} aria-hidden="true" />{item.label}</button>)}<button type="button" disabled={status !== 'ready'} aria-label={english ? 'Reset view' : 'Görünümü sıfırla'} onClick={() => { choose('perspective'); engage(false); }}><RotateCcw size={17} /></button></div>
    <div className="project-model-navigation"><span>{english ? 'Explore in 3D' : 'Ölçeği koruyarak keşfedin'}</span><div><button type="button" disabled={status !== 'ready'} aria-label={english ? 'Zoom in' : 'Modele yaklaş'} onClick={() => experience.current?.move('+')}><ZoomIn size={18} /></button><button type="button" disabled={status !== 'ready'} aria-label={english ? 'Zoom out' : 'Modelden uzaklaş'} onClick={() => experience.current?.move('-')}><ZoomOut size={18} /></button></div></div>
    <p className="building-tour-instruction" role="status">{active ? (english ? 'Drag to orbit; scroll or pinch to zoom. Right-drag to pan.' : 'Sürükleyerek dönün; tekerlek veya iki parmakla yaklaşın. Sağ tuşla kaydırın.') : (english ? 'Choose a view, then explore at your own pace.' : 'Görünümü seçin. Modeli kendi hızınızda keşfedin.')}</p>
    <details className="building-tour-scope"><summary>{english ? 'Model information' : 'Model bilgisi'}</summary><p>{english ? 'Converted from the supplied SketchUp file for web presentation. Material and lighting appearance may differ in the browser. Overall model bounds: 37.72 × 39.05 × 8.78 m; these are not floor-area or axis measurements. This is an architectural presentation, not a verified structural design or a completed-project declaration.' : 'Paylaşılan SketchUp dosyasından web sunumu için dönüştürüldü. Malzeme ve ışık görünümü web ortamına göre değişebilir. Tüm modelin dış sınırları: 37,72 × 39,05 × 8,78 m; bunlar kat alanı veya aks ölçüsü değildir. Mimari sunumdur; doğrulanmış statik proje veya tamamlanmış uygulama beyanı değildir.'}</p></details>
    <footer><span>{english ? 'Architecture · landscape · detail' : 'Mimari · peyzaj · detay'}</span><Link href={english ? '/en/projects' : '/projeler'}>{english ? 'Explore projects' : 'Projeleri inceleyin'}</Link></footer>
  </section>;
}
