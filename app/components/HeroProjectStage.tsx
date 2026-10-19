"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { useState } from "react";

export type HeroProjectStageProject = {
  code: string;
  buildingType: string;
  location: string;
  system: string;
  href: string;
  media: readonly { id: string; src: string; caption: string; contentType: string }[];
};

export function HeroProjectStage({ locale = "tr", project }: { locale?: "tr" | "en"; project: HeroProjectStageProject | null }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const english = locale === "en";
  const media = project?.media ?? [];
  const active = media[activeIndex % Math.max(media.length, 1)];

  if (!project || !active) return null;

  return <article className="v4-hero-stage" data-project-code={project.code} aria-label={english ? "Featured project stage" : "Seçilmiş proje sahnesi"}>
    <div className="v4-hero-stage-media">
      {active.contentType.startsWith("video/")
        ? <video className="v4-stage-video" key={active.id} src={active.src} controls playsInline preload="metadata" aria-label={active.caption} />
        : <Image className="v4-stage-image" key={active.id} src={active.src} fill priority sizes="(max-width: 960px) 100vw, 55vw" unoptimized alt={active.caption} />}
    </div>
    {media.length > 1 && <nav className="corporate-project-media" aria-label={english ? "Project photographs" : "Proje fotoğrafları"}>{media.map((item, index) => <button key={item.id} type="button" aria-pressed={activeIndex === index} onClick={() => setActiveIndex(index)}>{english ? `Photograph ${index + 1}` : `Fotoğraf ${index + 1}`}</button>)}</nav>}
    <div className="v4-stage-meta">
      <span><small>{project.code} · {project.location}</small><b>{project.system}</b><i>{project.buildingType}</i></span>
      <Link href={project.href}>{english ? "VIEW PROJECT" : "PROJEYİ İNCELE"} <ArrowUpRight className="v4-arrow-icon" size={17} strokeWidth={1.7} aria-hidden="true" /></Link>
    </div>
  </article>;
}
