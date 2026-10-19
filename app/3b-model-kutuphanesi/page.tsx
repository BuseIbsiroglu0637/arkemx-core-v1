import type { Metadata } from "next";
import { SiteFooter } from "../components/SiteChrome";
import { SketchfabModelLibrary } from "../components/SketchfabModelLibrary";
import { SiteHeader } from '../components/SiteChrome';
import { PresentationCatalog } from '../components/PresentationCatalog';

export const metadata: Metadata = {
  title: "3B Model Kütüphanesi | ARKEM Referans Projeleri",
  description: "ARKEM referans arşivinden seçilmiş modelleri projeleriyle birlikte keşfedin. Prefabrik, betonarme, hafif çelik ve tarımsal yapı sunumlarını üç boyutta inceleyin.",
  alternates: { canonical: "/3b-model-kutuphanesi" },
};

export default function ModelLibraryPage(){return <main className="ref-experience ref-library">
  <SiteHeader dark={false} />
  <header className="shell ref-library-heading"><p className="ref-eyebrow">ARKEM / ÜÇ BOYUTLU SEÇKİ</p><h1>Projeye farklı<br /><em>bir açıdan bakın.</em></h1><p>Bir proje seçin; görselleri, modelin dayanağını ve kapsamını birlikte inceleyin. Üç boyutlu dosyalar yalnız siz istediğinizde yüklenir.</p></header>
  
  <section id="model-kutuphanesi" className="shell ref-index-catalog"><PresentationCatalog modelsOnly /></section>
  <details className="shell ref-library-external"><summary>Harici Sketchfab arşivini de inceleyin</summary><SketchfabModelLibrary/></details>
  <SiteFooter/>
</main>}
