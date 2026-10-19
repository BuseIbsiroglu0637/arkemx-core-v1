import type { Metadata } from "next";
import { EnglishContentPage } from "../../components/EnglishContentPage";

export const metadata: Metadata = {
  title: { absolute: "About ARKEM | Structural Engineering and Building Systems" },
  description: "ARKEM connects structural engineering, building systems, production preparation, site experience and the ARKEMX digital engineering platform.",
  alternates: { canonical: "/en/about", languages: { "tr-TR": "/arkem", "en-US": "/en/about", "x-default": "/arkem" } },
};

const sections = [
  { id: "purpose", code: "01", title: "Why ARKEM Exists", copy: "To keep structural design, production preparation and site decisions within one clear technical responsibility line.", points: ["Engineering responsibility", "System thinking", "Delivery continuity"] },
  { id: "approach", code: "02", title: "Engineering Approach", copy: "A project decision must be calculable, producible, buildable and reviewable across its full delivery chain.", points: ["Measurable inputs", "Traceable decisions", "Defined boundaries"] },
  { id: "leadership", code: "03", title: "Technical Leadership", copy: "Founder Özenç Öztürk, MSc Civil Engineer, leads structural-system decisions, project coordination and the development direction of ARKEMX.", points: ["Structural systems", "Project coordination", "Engineering R&D"] },
  { id: "arkemx", code: "04", title: "From Site Experience to ARKEMX", copy: "ARKEMX systematises project experience around shared data, validation and connected engineering modules.", points: ["13 modules", "5 engineering groups", "1 project-data backbone"] },
] as const;

export default function EnglishAboutPage() {
  return <EnglishContentPage eyebrow="07 / ARKEM" title="ENGINEERING TO THE SITE. SITE EXPERIENCE TO TECHNOLOGY." lead="ARKEM is a building-systems organisation that connects real project experience, structural engineering and its own digital engineering platform." image="/projects/v32/yapikur-montaj.webp" imageAlt="ARKEM site and precast assembly record" sections={sections} />;
}

