import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowUpRight, ClipboardList, FolderOpen,
} from "lucide-react";
import { ProjectModuleTools } from "../components/ProjectModuleTools";
import { AccountHeaderLink } from "../components/AccountHeaderLink";
import "../sade-arac-paneli.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "ARKEMX | Araçlar",
  description: "ARKEMX proje ve mühendislik araçları.",
  robots: { index: false, follow: false },
};

const tools = [
  { name: "Yeni proje", icon: ClipboardList, href: "/proje-baslat", section: "Proje" },
  { name: "Proje Çalışma Alanı", icon: FolderOpen, href: "/dijital-proje-merkezi#canli-proje-grafigi", section: "Proje" },
] as const;

export default function ToolsPage() {
  return (
    <main className="arx-simple-home">
      <div className="arx-simple-shell">
        <header className="arx-simple-head">
          <Link href="/" className="arx-simple-brand" aria-label="ARKEMX başlangıç">ARKEM<span>X</span></Link>
          <div className="arx-simple-head-actions"><span className="arx-simple-head-label">Çalışma alanı</span><AccountHeaderLink /></div>
        </header>
        <section className="arx-simple-tools" aria-labelledby="arx-tools-title">
          <h1 id="arx-tools-title">Araçlar</h1>
          <div className="arx-simple-grid" aria-label="Proje işlemleri">
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
          <ProjectModuleTools />
        </section>
      </div>
    </main>
  );
}
