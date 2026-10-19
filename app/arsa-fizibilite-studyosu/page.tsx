import type { Metadata } from "next";
import { DemoParcelWorkspace } from "../components/DemoParcelWorkspace";
export const metadata: Metadata = { title: "Parsel ve arazi incelemesi | ARKEMX Demo", description: "Brief hedefleriyle parsel ve arsa araştırma çalışma alanı.", robots: {index:false,follow:false} };
export default function SiteStudioPage(){return <main id="geo-studyo" className="inner-page site-studio-page module-workspace-page demo-gis-page"><header className="shell demo-brief-heading"><p className="eyebrow">ARKEM / ARSA REHBERİ</p><h1>Parsel ve arazi incelemesi</h1><p>Konumu seçin, parsel sınırını doğrulayın ve araziyi inceleyin.</p></header><section className="shell demo-gis-content"><DemoParcelWorkspace/></section></main>}
