"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { ProjectPhoto } from "./ProjectPhoto";

export type HomeProjectItem = { code: string; href: string; title: string; src: string; caption: string; kind: string };

export function HomeProjectCarousel({ items, english = false }: { items: HomeProjectItem[]; english?: boolean }) {
  const track = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ first: 0, atStart: true, atEnd: items.length < 2 });
  const updatePosition = useCallback(() => {
    const element = track.current;
    if (!element) return;
    const cards = Array.from(element.children) as HTMLElement[];
    const left = element.getBoundingClientRect().left;
    const first = cards.findIndex(card => card.getBoundingClientRect().right > left + 24);
    const next = { first: Math.max(0, first), atStart: element.scrollLeft <= 2, atEnd: element.scrollLeft + element.clientWidth >= element.scrollWidth - 2 };
    setPosition(previous => previous.first === next.first && previous.atStart === next.atStart && previous.atEnd === next.atEnd ? previous : next);
  }, []);

  useEffect(() => {
    const element = track.current;
    if (!element) return;
    updatePosition();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(updatePosition);
    observer.observe(element);
    return () => observer.disconnect();
  }, [updatePosition, items.length]);

  function move(direction: -1 | 1) {
    const element = track.current;
    const card = element?.firstElementChild as HTMLElement | null;
    if (!element || !card) return;
    const gap = parseFloat(window.getComputedStyle(element).columnGap) || 0;
    element.scrollBy({ left: direction * (card.getBoundingClientRect().width + gap), behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
  }

  if (!items.length) return null;
  return <aside className="home-project-selection" aria-label={english ? "Project selection" : "Proje seçkisi"}>
    <header><h2>{english ? "Our projects" : "Projelerimiz"}</h2><Link href={english ? "/en/projects" : "/projeler"}>{english ? "View all" : "Tümünü gör"}</Link></header>
    <div ref={track} id="home-project-track" className="home-project-track" onScroll={updatePosition} onKeyDown={event => { if (event.target === event.currentTarget && (event.key === "ArrowLeft" || event.key === "ArrowRight")) { event.preventDefault(); move(event.key === "ArrowLeft" ? -1 : 1); } }} tabIndex={0} role="region" aria-roledescription={english ? "carousel" : "kaydırılabilir proje vitrini"} aria-label={english ? "Scroll to explore projects" : "Projeleri kaydırarak inceleyin"}>
      {items.map(item => <Link className="home-project-slide" href={item.href} key={item.code} data-project-code={item.code} aria-label={english ? `Open project: ${item.title}` : `Projeyi aç: ${item.title}`}>
        <span className="home-project-slide-image"><ProjectPhoto src={item.src} alt={item.caption || item.title} sizes="(max-width: 600px) 22vw, (max-width: 980px) 16vw, 8vw" /></span>
        <span className="home-project-slide-caption"><b>{item.title}</b><small>{item.kind}</small></span>
      </Link>)}
    </div>
    <div className="home-project-controls">
      <span className="home-project-position" aria-live="polite" aria-atomic="true">{String(position.first + 1).padStart(2, "0")} / {String(items.length).padStart(2, "0")}</span>
      <div><button type="button" aria-controls="home-project-track" disabled={position.atStart} onClick={() => move(-1)}>{english ? "Previous" : "Önceki"}</button><button type="button" aria-controls="home-project-track" disabled={position.atEnd} onClick={() => move(1)}>{english ? "Next" : "Sonraki"}</button></div>
    </div>
  </aside>;
}
