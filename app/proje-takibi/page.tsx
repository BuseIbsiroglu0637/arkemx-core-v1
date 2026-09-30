import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { ProjectOperatingSystem } from "../components/ProjectOperatingSystem";
import "../sade-arac-paneli.css";
import "../sade-muhendislik-araclari.css";
import "./sade-proje-takibi.css";

export const metadata: Metadata = {
  title: "Proje Takibi | ARKEMX",
  description: "Açık işler, kararlar, dokümanlar, program ve teslim hazırlığını aynı proje kaydında takip edin.",
  alternates: { canonical: "/proje-takibi" },
  robots: { index: false, follow: false },
};

export default function ProjectTrackingPage() {
  return <main className="arx-simple-home arx-workspace-page arx-tracking-page">
    <div className="arx-simple-shell arx-workspace-shell">
      <header className="arx-simple-head">
        <Link href="/" className="arx-simple-brand" aria-label="ARKEMX araçlar ana sayfası">ARKEM<span>X</span></Link>
        <nav className="arx-workspace-nav" aria-label="Sayfa bağlantıları">
          <Link href="/bim-koordinasyon"><ArrowLeft size={16} aria-hidden="true" /> Önceki adıma dön</Link>
          <Link href="/dijital-proje-merkezi">Proje Çalışma Alanı</Link>
          <Link href="/araclar">Tüm araçlar</Link>
        </nav>
      </header>
      <div className="arx-workspace-intro">
        <span>TESLİM / TAKİP</span>
        <h1>Proje takibi</h1>
        <p>Açık işleri, kararları, program sinyallerini, güncel dokümanları ve teslim hazırlığını aynı proje kaydında izleyin.</p>
      </div>
      <section className="arx-workspace-editor" aria-label="Proje takip çalışma alanı">
        <ProjectOperatingSystem compact />
      </section>
    </div>
  </main>;
}
