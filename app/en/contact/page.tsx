import type { Metadata } from "next";
import { ProjectBriefForm } from "../../components/ProjectBriefForm";
import { SiteFooter, SiteHeader } from "../../components/SiteChrome";
import { site } from "../../data/site";

export const metadata: Metadata = {
  title: { absolute: "Project Pre-Assessment | Contact ARKEM" },
  description: "Send the project location, building type, approximate area, project stage and technical files for ARKEM’s engineering pre-assessment.",
  alternates: { canonical: "/en/contact", languages: { "tr-TR": "/iletisim", "en-US": "/en/contact", "x-default": "/iletisim" } },
};

export default function EnglishContactPage() {
  return <main className="v4-english-contact" lang="en"><SiteHeader dark={false} />
    <section className="v4-english-list-hero"><div className="shell"><p className="v4-index">08 / PROJECT PRE-ASSESSMENT</p><h1>NOT JUST A MESSAGE.<br /><em>A TECHNICAL STARTING RECORD.</em></h1><p>Send the location, building type, approximate area, current stage and available project files in one structured record.</p></div></section>
    <section className="section shell contact-layout v4-contact-layout"><aside><p className="eyebrow">DIRECT CONTACT</p><h2>ARKEM Building<br/><em>Systems</em></h2><div className="contact-lines"><a data-analytics="phone_click" href={`tel:${site.phoneHref}`}><span>Phone</span><b>{site.phoneDisplay}</b></a><a data-analytics="whatsapp_click" href={`https://wa.me/${site.whatsappHref}`} target="_blank" rel="noreferrer"><span>WhatsApp</span><b>Send a message ↗</b></a><div><span>Office</span><b>{site.location}</b></div></div><p className="contact-note">Uploaded project files are connected to the same technical pre-assessment record.</p></aside><ProjectBriefForm locale="en" /></section>
    <section className="contact-process"><div className="shell"><p className="eyebrow light">NEXT STEPS</p><div className="contact-step-grid"><article><span>01</span><h2>We review the input</h2><p>We assess the building type, location, area and available documents.</p></article><article><span>02</span><h2>We identify gaps</h2><p>We define the technical questions and missing data required for the right scope.</p></article><article><span>03</span><h2>We establish the path</h2><p>We explain the service scope, deliverables and next technical step.</p></article></div></div></section><SiteFooter />
  </main>;
}
