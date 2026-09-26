"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import type { V3PublishedProjectRecord } from "../lib/project-evidence";

type ProjectArchiveFilter = {
  id: string;
  label: string;
  matches: (project: V3PublishedProjectRecord) => boolean;
};

const normalized = (value: string) => value.toLocaleLowerCase("tr-TR");
const verifiedValue = (project: V3PublishedProjectRecord, field: "system" | "arkemRole") =>
  project.facts[field].status !== "arşiv doğrulaması" ? normalized(project.facts[field].value) : "";

const filters: readonly ProjectArchiveFilter[] = [
  { id: "all", label: "Tümü", matches: () => true },
  { id: "industrial", label: "Endüstriyel", matches: (project) => /endüstriyel|üretim tesisi/.test(normalized(project.facts.buildingType.value)) },
  { id: "commercial", label: "Ticari", matches: (project) => normalized(project.facts.buildingType.value).includes("ticari") },
  { id: "agricultural", label: "Tarımsal", matches: (project) => /tarım|hayvancılık/.test(normalized(project.facts.buildingType.value)) },
  { id: "precast", label: "Betonarme Prefabrik", matches: (project) => verifiedValue(project, "system").includes("prefabrik") },
  { id: "steel", label: "Çelik", matches: (project) => verifiedValue(project, "system").includes("çelik") },
  { id: "light-steel", label: "Hafif Çelik", matches: (project) => verifiedValue(project, "system").includes("hafif çelik") },
] as const;

export function ProjectArchiveExplorer({ projects }: { projects: readonly V3PublishedProjectRecord[] }) {
  const [activeFilter, setActiveFilter] = useState(filters[0].id);
  const filter = filters.find((item) => item.id === activeFilter) ?? filters[0];
  const visibleProjects = useMemo(() => projects.filter(filter.matches), [filter, projects]);

  return <div className="v31-project-archive" data-testid="project-archive-explorer">
    <nav aria-label="Proje arşivi filtreleri">
      {filters.map((item) => {
        const count = projects.filter(item.matches).length;
        return <button
          type="button"
          className={item.id === activeFilter ? "is-active" : ""}
          aria-pressed={item.id === activeFilter}
          onClick={() => setActiveFilter(item.id)}
          key={item.id}
        >{item.label}<small>{count}</small></button>;
      })}
    </nav>
    <p className="v31-project-filter-result" aria-live="polite"><strong>{filter.label}</strong> · {visibleProjects.length} proje kaydı</p>
    {visibleProjects.length ? <div className="v31-project-archive-grid">
      {visibleProjects.map((project) => {
        const cover = project.publishedMedia.find((item) => item.contentType.startsWith("image/"));
        const cardFacts = [
          project.facts.location,
          project.facts.buildingType,
          project.facts.system,
          project.facts.arkemRole,
        ].filter((fact) => fact.status !== "arşiv doğrulaması");
        const recordLabel = project.facts.projectStatus.value.includes("3B") ? "3B PROJE KAYDI" : "PROJE KAYDI";
        return <article id={project.slug} key={project.slug}>
          <Link className="v31-project-archive-media" href={`/projeler/${project.slug}`} data-analytics="project_open" data-analytics-context={project.slug}>
            {cover
              ? <Image src={cover.href} alt={cover.caption || `${project.shortTitle} proje kaydı`} width={1280} height={800} unoptimized />
              : <span><b>PROJE MEDYASI</b><small>Kaynak ve yayın hakkı eşleşmesi bekleniyor</small></span>}
          </Link>
          <header><span>{project.code}</span><em>{recordLabel}</em></header>
          <h2>{project.shortTitle}</h2>
          <dl>{cardFacts.map((fact) => <div key={fact.label}><dt>{fact.label.toLocaleUpperCase("tr-TR")}</dt><dd>{fact.value}</dd></div>)}</dl>
          <p>{project.summary}</p>
          <Link href={`/projeler/${project.slug}`} data-analytics="project_open" data-analytics-context={project.slug}>Proje kaydını inceleyin <span aria-hidden="true">↗</span></Link>
        </article>;
      })}
    </div> : <div className="v31-project-empty"><strong>Bu filtrede yayımlanmış teknik kayıt bulunmuyor.</strong><p>Taşıyıcı sistem veya ARKEM kapsamı kaynağı doğrulandığında proje ilgili filtrede otomatik olarak açılır.</p></div>}
  </div>;
}
