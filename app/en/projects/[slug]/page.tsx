import type { Metadata } from "next";
import { ProjectPhoto } from "../../../components/ProjectPhoto";
import { selectProjectPhoto } from "../../../lib/project-photo";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteFooter, SiteHeader } from "../../../components/SiteChrome";
import { englishProjectRecords } from "../../../data/projects-en";
import { v3Projects } from "../../../data/projects-v3";
import { getPublicV3Projects } from "../../../lib/public-projects";

export const dynamic = "force-dynamic";
export function generateStaticParams() { return v3Projects.map((project) => ({ slug: project.slug })); }

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const slug = (await params).slug;
  const project = englishProjectRecords[slug];
  if (!project) return {};
  return { title: { absolute: `${project.title} | Project Record | ARKEM` }, description: project.summary, alternates: { canonical: `/en/projects/${slug}`, languages: { "tr-TR": `/projeler/${slug}`, "en-US": `/en/projects/${slug}`, "x-default": `/projeler/${slug}` } } };
}

export default async function EnglishProjectDetail({ params }: { params: Promise<{ slug: string }> }) {
  const slug = (await params).slug;
  const records = await getPublicV3Projects();
  const source = records.find((project) => project.slug === slug);
  const project = englishProjectRecords[slug];
  if (!source || !project) notFound();
  const hero = selectProjectPhoto(source.slug, source.publishedMedia);
  return <main className="v4-english-project-detail" lang="en"><SiteHeader dark={false} />
    <section className="v4-english-project-hero"><div className="shell"><nav><Link href="/en">Home</Link><span>/</span><Link href="/en/projects">Projects</Link><span>/</span><b>{source.code}</b></nav><div><p className="v4-index">{source.code} / TECHNICAL PROJECT RECORD</p><h1>{project.title}</h1><p>{project.summary}</p></div>{hero ? <figure><ProjectPhoto src={hero.href} priority alt={project.title} /></figure> : null}</div></section>
    <section className="v4-section v4-english-project-facts"><div className="shell"><header className="v4-section-head"><div><p className="v4-index">PROJECT IDENTITY</p><h2>Verified information.<br /><em>Explicit boundaries.</em></h2></div><p>Unverified technical values remain unpublished until their source record is complete.</p></header><dl><div><dt>PROJECT</dt><dd>{source.code}</dd></div><div><dt>LOCATION</dt><dd>{project.location}</dd></div><div><dt>BUILDING TYPE</dt><dd>{project.buildingType}</dd></div><div><dt>STRUCTURAL SYSTEM</dt><dd>{project.system}</dd></div><div><dt>ARKEM SCOPE</dt><dd>{project.scope}</dd></div><div><dt>RECORD STATUS</dt><dd>TECHNICAL RECORD UNDER CONTINUOUS VERIFICATION</dd></div></dl></div></section>
    <section className="v4-section v4-contact"><div className="shell v4-contact-frame"><div><p className="v4-index">RELATED TECHNICAL REVIEW</p><h2>Planning a similar project?<br /><em>Establish the right technical start.</em></h2></div><Link className="v4-button is-primary" href="/en/contact">START TECHNICAL REVIEW<span aria-hidden="true">↗</span></Link></div></section><SiteFooter /></main>;
}

