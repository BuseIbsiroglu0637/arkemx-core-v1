import type { Metadata } from "next";
import { DemoParcelWorkspace } from "../components/DemoParcelWorkspace";
export const metadata: Metadata = { title: "Parsel ve bağlam | ARKEMX Demo", description: "Brief hedefleriyle parsel ve arsa araştırma çalışma alanı.", robots: {index:false,follow:false} };
export default function SiteStudioPage(){return <main className="inner-page site-studio-page module-workspace-page demo-gis-page"><header className="shell demo-brief-heading"><p className="eyebrow">ARKEM / ARSA REHBERİ</p><h1>Parsel ve arazi incelemesi</h1><p>Konumu seçin, parsel sınırını inceleyin ve araziyi değerlendirin.</p></header><section id="geo-studyo" className="shell demo-gis-content"><DemoParcelWorkspace/></section></main>}
