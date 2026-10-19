import type { Metadata } from "next";
import { DemoParcelWorkspace } from "../components/DemoParcelWorkspace";
export const metadata: Metadata = { title: "Parsel ve bağlam | ARKEMX Demo", description: "Brief hedefleriyle parsel ve arsa araştırma çalışma alanı.", robots: {index:false,follow:false} };
export default function SiteStudioPage(){return <main className="inner-page site-studio-page module-workspace-page demo-gis-page"><header className="shell demo-brief-heading"><p className="eyebrow">02 / GIS · DEMO</p><h1>Parsel ve bağlam</h1><p>Arsa durumunu seçin; parselinizi inceleyin veya arama ölçütlerinizi kaydedin.</p></header><section id="geo-studyo" className="shell demo-gis-content"><DemoParcelWorkspace/></section></main>}
