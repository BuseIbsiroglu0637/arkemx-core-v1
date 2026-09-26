import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { SiteFooter, SiteHeader } from "../../components/SiteChrome";
import { englishProjectRecords } from "../../data/projects-en";
import { getPublicV3Projects } from "../../lib/public-projects";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: { absolute: "Projects | Structural and Industrial Project Archive | ARKEM" },
  description: "ARKEM project records organised through project identity, structural-system decision, engineering scope and site evidence.",
  alternates: { canonical: "/en/projects", languages: { "tr-TR": "/projeler", "en-US": "/en/projects", "x-default": "/projeler" } },
};

export default async function EnglishProjectsPage() {
  const projects = (await getPublicV3Projects()).filter((project) => project.archiveVisible);
  return <main className="v4-english-projects" lang="en"><SiteHeader dark={false} />
    <section className="v4-english-list-hero"><div className="shell"><p className="v4-index">01 / PROJECT EXPERIENCE</p><h1>PROJECTS ARE THE APPLIED RECORD<br /><em>OF ENGINEERING DECISIONS.</em></h1><p>Completed and ongoing work is recorded with the structural-system decision, ARKEM scope and site process—not only the final image.</p></div></section>
    <section className="v4-section v4-projects"><div className="shell"><div className="v4-project-editorial">{projects.map((project, index) => {
      const image = project.publishedMedia.find((item) => item.contentType.startsWith("image/"));
      const translated = englishProjectRecords[project.slug];
      return <article className={index === 0 ? "is-flagship" : ""} key={project.slug}><Link className="v4-project-image" href={`/en/projects/${project.slug}`}>{image ? <Image src={image.href} fill sizes={index === 0 ? "(max-width: 900px) 100vw, 62vw" : "(max-width: 900px) 100vw, 32vw"} unoptimized alt={translated.title} /> : null}<span>{project.code}</span></Link><div><small>{project.code} / TECHNICAL PROJECT RECORD</small><h2>{translated.title}</h2><p>{translated.summary}</p><dl><div><dt>LOCATION</dt><dd>{translated.location}</dd></div><div><dt>SYSTEM</dt><dd>{translated.system}</dd></div><div><dt>ARKEM SCOPE</dt><dd>{translated.scope}</dd></div></dl></div></article>;
    })}</div></div></section><SiteFooter /></main>;
}
