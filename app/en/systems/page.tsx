import type { Metadata } from "next";
import { EnglishContentPage } from "../../components/EnglishContentPage";

export const metadata: Metadata = {
  title: { absolute: "Building Systems | Precast, Steel, Light-Gauge Steel and Hybrid | ARKEM" },
  description: "Project-specific structural-system decisions for precast concrete, structural steel, light-gauge steel and hybrid buildings.",
  alternates: { canonical: "/en/systems", languages: { "tr-TR": "/yapi-sistemleri", "en-US": "/en/systems", "x-default": "/yapi-sistemleri" } },
};

const sections = [
  { id: "precast", code: "01", title: "Precast Reinforced Concrete", copy: "Element repetition, controlled production, logistics and rapid assembly are resolved as one structural-system decision.", points: ["Element layout", "Connections", "Logistics and assembly"] },
  { id: "steel", code: "02", title: "Structural Steel", copy: "Long spans, low self-weight, stability, connections and protection are considered with fabrication reality.", points: ["Member stability", "Connection design", "Fabrication tolerances"] },
  { id: "light-steel", code: "03", title: "Light-Gauge Steel", copy: "Panelisation, building physics and precise dry production are coordinated for low-rise building systems.", points: ["Panel layout", "Profile scope", "Envelope coordination"] },
  { id: "hybrid", code: "04", title: "Hybrid Systems", copy: "Multiple structural systems are combined only when their interfaces, load transfer and responsibilities are explicitly resolved.", points: ["System interfaces", "Load transfer", "Integrated detailing"] },
] as const;

export default function EnglishSystemsPage() {
  return <EnglishContentPage eyebrow="02 / BUILDING SYSTEMS" title="THE SYSTEM FOLLOWS THE PROJECT." lead="Span, load path, ground conditions, programme, supply and production reality shape the system decision." image="/projects/v32/cihan-tamamlanan.webp" imageAlt="Completed precast concrete industrial facility" sections={sections} />;
}

