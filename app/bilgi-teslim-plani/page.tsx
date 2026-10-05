import type { Metadata } from "next";
import Link from "next/link";
import { DigitalInnovationLab } from "../components/DigitalInnovationLab";
import "../sade-arac-paneli.css";
import "../sade-muhendislik-araclari.css";
export const metadata: Metadata = { title: "Bilgi teslim planı | ARKEMX", robots: { index: false, follow: false } };
export default function ModuleWorkspace() {
  return <main className="arx-simple-home arx-workspace-page">
    <div className="arx-simple-shell arx-workspace-shell">
      <header className="arx-simple-head">
        <Link href="/" className="arx-simple-brand">ARKEM<span>X</span></Link>
        <nav className="arx-workspace-nav" aria-label="Sayfa bağlantıları">
          <Link href="/araclar">Tüm araçlar</Link>
          <Link href="/dijital-proje-merkezi">Proje Çalışma Alanı</Link>
        </nav>
      </header>
      <div className="arx-workspace-intro"><h1>Bilgi teslim planı</h1><p>Proje aşaması, bilgi kapsamı ve teslim gereksinimlerini mevcut proje kaydına bağlayın.</p></div>
      <section className="arx-workspace-editor" aria-label="Bilgi teslim planı çalışma alanı"><DigitalInnovationLab /></section>
    </div>
  </main>;
}

