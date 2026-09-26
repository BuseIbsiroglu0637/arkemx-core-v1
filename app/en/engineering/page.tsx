import type { Metadata } from "next";
import { EnglishContentPage } from "../../components/EnglishContentPage";

export const metadata: Metadata = {
  title: { absolute: "Structural Engineering and Detailed Design | ARKEM" },
  description: "Structural-system design, analysis, seismic engineering, detailing, fabrication preparation, BIM coordination and site engineering.",
  alternates: { canonical: "/en/engineering", languages: { "tr-TR": "/muhendislik", "en-US": "/en/engineering", "x-default": "/muhendislik" } },
};

const sections = [
  { id: "structural-system", code: "01", title: "Structural-System Design", copy: "We compare system alternatives against geometry, load path, programme, supply and production constraints before fixing the project model.", points: ["System alternatives", "Concept sizing", "Responsibility boundaries"] },
  { id: "structural-analysis", code: "02", title: "Structural Analysis", copy: "Analysis is recorded together with its assumptions, controlling behaviour, sources and validation boundaries.", points: ["Loads and combinations", "Structural behaviour", "Traceable checks"] },
  { id: "seismic", code: "03", title: "Seismic Engineering", copy: "Seismic inputs and structural response are connected to the selected system and its verification path.", points: ["Seismic parameters", "Response checks", "Validation records"] },
  { id: "detailing", code: "04", title: "Detailing and Fabrication", copy: "The calculation decision is carried into dimensions, connections, tolerances and producible project information.", points: ["Application drawings", "Connection decisions", "Fabrication preparation"] },
  { id: "site", code: "05", title: "Site Engineering", copy: "Assembly, temporary conditions, revisions and technical close-out remain connected to the project record.", points: ["Assembly sequence", "Technical queries", "Revision trace"] },
] as const;

export default function EnglishEngineeringPage() {
  return <EnglishContentPage eyebrow="03 / ENGINEERING" title="THE CALCULATION IS A STEP. ENGINEERING IS THE CHAIN." lead="ARKEM carries the structural decision from system selection and analysis into detailing, production preparation and the site." image="/visuals/arkem-x-design-v2.webp" imageAlt="ARKEMX structural analysis and engineering model" sections={sections} />;
}
