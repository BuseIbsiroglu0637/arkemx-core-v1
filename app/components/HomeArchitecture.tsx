"use client";

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { useState } from "react";
import { ProjectPhoto } from "./ProjectPhoto";

const phases = [
  { tr: "Taşıyıcı sistem", en: "Structural frame", src: "/projects/v32/cihan-tasiyici.webp", noteTr: "Yapının taşıyıcı sistemini sahada görün.", noteEn: "See the structural system on site." },
  { tr: "Tamamlanan yapı", en: "Completed building", src: "/projects/v32/cihan-tamamlanan.webp", noteTr: "Aynı projenin tamamlanan yapısına geçin.", noteEn: "Explore the completed building of the same project." },
] as const;

/** Actual archive photographs, changed only by the visitor; no simulated live model. */
export function HomeArchitecture({ english = false }: { english?: boolean }) {
  const [phase, setPhase] = useState(1);
  const current = phases[phase];
  return <section className="home-architecture home-project-story" aria-label={english ? "From structure to building" : "Taşıyıcı sistemden tamamlanan yapıya"}>
    <div className="home-project-story-heading"><span>{english ? "ENGINEERING, MADE VISIBLE" : "MÜHENDİSLİĞİN SAHADAKİ KARŞILIĞI"}</span><span>01 / CIHAN TAT</span></div>
    <figure className="home-architecture-figure">
      <Link className="home-architecture-image" href={english ? "/en/projects/cihan-tat" : "/projeler/cihan-tat"} aria-label={english ? "Explore the Cihan Tat project" : "Cihan Tat Gıda projesini inceleyin"}>
        <ProjectPhoto src={current.src} alt={english ? `Cihan Tat: ${current.en}, archive site photograph` : `Cihan Tat Gıda: ${current.tr}, arşiv saha fotoğrafı`} sizes="(max-width: 980px) 100vw, 50vw" priority />
        <span className="home-project-photo-link">{english ? "Explore project" : "Projeyi incele"}<ArrowUpRight size={17} aria-hidden="true" /></span>
      </Link>
          <figcaption><strong>Cihan Tat Gıda</strong><span>{english ? "Seydiler OSB · Kastamonu / Archive site photographs" : "Seydiler OSB · Kastamonu / Arşiv saha fotoğrafları"}</span></figcaption>
    </figure>
    <div className="home-project-phase" role="group" aria-label={english ? "Choose the project photograph" : "Projenin hangi aşamasını görmek istersiniz?"}>
      {phases.map((item, index) => <button key={item.src} type="button" aria-pressed={phase === index} aria-controls="home-project-phase-note" onClick={() => setPhase(index)}><span aria-hidden="true">0{index + 1}</span>{english ? item.en : item.tr}</button>)}
    </div>
    <p id="home-project-phase-note" className="home-project-phase-note" role="status">{english ? current.noteEn : current.noteTr}</p>
    <div className="home-project-paths" aria-label={english ? "Your next step" : "Size uygun sonraki adım"}>
      <Link href={english ? "/en/contact" : "/proje-baslat"}>{english ? "I have a project idea" : "Bir proje fikrim var"}<ArrowUpRight size={15} aria-hidden="true" /></Link>
      <Link href={english ? "/en/engineering" : "/arsa-fizibilite-studyosu"}>{english ? "Explore engineering" : "Arsamı değerlendirmek istiyorum"}<ArrowUpRight size={15} aria-hidden="true" /></Link>
      <Link href={english ? "/en/projects" : "/projeler"}>{english ? "See other projects" : "Diğer projeleri görmek istiyorum"}<ArrowUpRight size={15} aria-hidden="true" /></Link>
    </div>
  </section>;
}
