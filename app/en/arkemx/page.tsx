import type { Metadata } from "next";
import Link from "next/link";
import { ArkemXRegistryExplorer } from "../../components/ArkemXRegistryExplorer";
import { SiteFooter, SiteHeader } from "../../components/SiteChrome";
import {
  publicArkemXModuleGroups,
  publicArkemXModules,
} from "../../data/arkemx-public-projection";

export const metadata: Metadata = {
  title: { absolute: "ARKEMX | Digital Structural Engineering Platform | ARKEM" },
  description: "ARKEMX connects 13 project-engineering modules across five engineering groups around one shared project-data backbone.",
  alternates: { canonical: "/en/arkemx", languages: { "tr-TR": "/arkemx", "en-US": "/en/arkemx", "x-default": "/arkemx" } },
  openGraph: { title: "ARKEMX | Digital Structural Engineering Platform | ARKEM", description: "13 project-engineering modules, five engineering groups and one connected project-data backbone.", url: "/en/arkemx", images: [{ url: "/visuals/arkem-x-coordination-v2.webp", width: 1200, height: 630, alt: "ARKEMX connected engineering platform" }] },
};

export default function EnglishArkemXPage() {
  return <main className="v4-arkemx-page v4-arkemx-en" lang="en"><section className="v4-x-hero"><SiteHeader /><div className="shell"><p className="v4-index">00 / ARKEMX</p><span>ACTIVE · CONTINUOUSLY DEVELOPED</span><h1>DIFFERENT SYSTEMS.<br /><em>ONE PROJECT-DATA BACKBONE.</em></h1><p>ARKEMX is ARKEM’s digital engineering R&amp;D platform. It connects project modelling, structural analysis, system design, detailing, quantities, validation and construction-stage records around shared project data.</p><div className="v4-arkemx-counts"><span><b>13</b>PROJECT ENGINEERING MODULES</span><span><b>5</b>ENGINEERING GROUPS</span><span><b>1</b>PROJECT-DATA BACKBONE</span></div><a className="v4-button is-primary" href="#project-modules">EXPLORE THE PLATFORM<span aria-hidden="true">↓</span></a></div></section>
    <section className="v4-section v4-x-principle"><div className="shell"><div><p className="v4-index">01 / CONNECTED ENGINEERING</p><h2>A result is not only calculated.<br /><em>It is traced and validated.</em></h2></div><p>All 13 modules keep their real module-level status. Core function flows are recorded and tested; engineering scope and validation continue to expand module by module.</p></div></section>
    <section className="v4-section v4-x-explorer" id="project-modules"><div className="shell"><header className="v4-section-head is-light"><div><p className="v4-index">02 / MODULE EXPLORER</p><h2>One backbone.<br /><em>Five groups. Thirteen modules.</em></h2></div><p>Select a group, inspect connected modules and open module-level scope, inputs, outputs, validation and recent development.</p></header><ArkemXRegistryExplorer groups={publicArkemXModuleGroups} modules={publicArkemXModules} locale="en" /></div></section>
    <section className="v4-section v4-contact"><div className="shell v4-contact-frame"><div><p className="v4-index">PROJECT PRE-ASSESSMENT</p><h2>Connect the project need<br /><em>to the right engineering scope.</em></h2></div><Link className="v4-button is-primary" href="/en/contact">START TECHNICAL REVIEW<span aria-hidden="true">↗</span></Link></div></section><SiteFooter /></main>;
}
