import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowUpRight, Blocks, ClipboardList, DraftingCompass, FileBox,
  FolderOpen, GitMerge, Layers3, Map, Scale, Wrench,
} from "lucide-react";
import "./sade-arac-paneli.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "ARKEMX | Araçlar",
  description: "ARKEMX proje ve mühendislik araçları.",
  robots: { index: false, follow: false },
};

const tools = [
  { name: "Yeni proje", icon: ClipboardList, href: "/proje-baslat", section: "Proje" },
  { name: "Proje merkezi", icon: FolderOpen, href: "/dijital-proje-merkezi#canli-proje-grafigi", section: "Proje" },
  { name: "Arazi ve parsel", icon: Map, href: "/arsa-fizibilite-studyosu", section: "Tasarım" },
  { name: "Mimari program", icon: Layers3, href: "/mimari-program-studyosu", section: "Tasarım" },
  { name: "Plan ve aks", icon: DraftingCompass, href: "/plan-ve-aks", section: "Tasarım" },
  { name: "Taşıyıcı ön tasarım", icon: Blocks, href: "/tasiyici-on-tasarim", section: "Mühendislik" },
  { name: "Yapı sistemi", icon: Scale, href: "/sistem-karsilastirma", section: "Mühendislik" },
  { name: "BIM koordinasyon", icon: GitMerge, href: "/bim-koordinasyon", section: "Mühendislik" },
  { name: "Proje takibi", icon: Wrench, href: "/proje-takibi", section: "Teslim" },
  { name: "Dijital teslim", icon: FileBox, href: "/dijital-proje-merkezi", section: "Teslim" },
] as const;

export default function Home() {
  return (
    <main className="arx-simple-home">
      <div className="arx-simple-shell">
        <header className="arx-simple-head">
          <Link href="/" className="arx-simple-brand" aria-label="ARKEMX araçlar ana sayfası">ARKEM<span>X</span></Link>
          <div className="arx-simple-head-actions"><span className="arx-simple-head-label">Çalışma alanı</span><a href="/giris?return_to=%2Fhesabim">Hesap</a></div>
        </header>
        <section className="arx-simple-tools" aria-labelledby="arx-tools-title">
          <h1 id="arx-tools-title">Araçlar</h1>
          <div className="arx-simple-grid">
            {tools.map((tool) => {
              const Icon = tool.icon;
              return (
                <Link key={tool.name} href={tool.href} className="arx-simple-tool">
                  <span className="arx-simple-tool-icon"><Icon size={25} strokeWidth={1.7} aria-hidden="true" /></span>
                  <span className="arx-simple-tool-content">
                    <strong>{tool.name}</strong>
                    <small>{tool.section}</small>
                  </span>
                  <ArrowUpRight className="arx-simple-tool-arrow" size={19} strokeWidth={1.7} aria-hidden="true" />
                </Link>
              );
            })}
          </div>
        </section>
      </div>
    </main>
  );
}
