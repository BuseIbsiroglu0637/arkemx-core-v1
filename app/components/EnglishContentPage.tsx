import { ProjectPhoto } from "./ProjectPhoto";
import Link from "next/link";
import { SiteFooter, SiteHeader } from "./SiteChrome";

type EnglishSection = { id: string; code: string; title: string; copy: string; points: readonly string[] };

export function EnglishContentPage({ eyebrow, title, lead, image, imageAlt, sections, cta = "START A TECHNICAL REVIEW" }: { eyebrow: string; title: string; lead: string; image: string; imageAlt: string; sections: readonly EnglishSection[]; cta?: string }) {
  return <main className="v4-english-page" lang="en">
    <SiteHeader dark={false} />
    <section className="v4-english-hero"><div className="shell"><div><p className="v4-index">{eyebrow}</p><h1>{title}</h1><p>{lead}</p><div className="v4-actions"><Link className="v4-button is-primary" href="/en/contact">{cta}<span aria-hidden="true">↗</span></Link><Link className="v4-button is-secondary" href="/en/projects">VIEW PROJECTS<span aria-hidden="true">↗</span></Link></div></div><figure><ProjectPhoto src={image} sizes="(max-width: 900px) 100vw, 48vw" alt={imageAlt} /></figure></div></section>
    <section className="v4-section v4-english-sections"><div className="shell">{sections.map((section) => <article id={section.id} key={section.id}><span>{section.code}</span><div><h2>{section.title}</h2><p>{section.copy}</p></div><ul>{section.points.map((point) => <li key={point}>{point}</li>)}</ul></article>)}</div></section>
    <section className="v4-section v4-contact"><div className="shell v4-contact-frame"><div><p className="v4-index">PROJECT PRE-ASSESSMENT</p><h2>Share the project data.<br /><em>Establish the right technical start.</em></h2><p>Location, building type, approximate area, project stage and available technical documents.</p></div><Link className="v4-button is-primary" href="/en/contact">START TECHNICAL REVIEW<span aria-hidden="true">↗</span></Link></div></section>
    <SiteFooter />
  </main>;
}

