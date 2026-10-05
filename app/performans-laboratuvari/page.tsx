import type { Metadata } from "next";
import Link from "next/link";
import { ArkemXLab } from "../components/ArkemXLab";
import "../sade-arac-paneli.css";
import "../sade-muhendislik-araclari.css";
export const metadata: Metadata = { title: "Performans laboratuvarı | ARKEMX", robots: { index: false, follow: false } };
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
      <div className="arx-workspace-intro"><h1>Performans laboratuvarı</h1><p>Karbon, üretim, saha ve varlık senaryolarını açık varsayımlarla karşılaştırın.</p></div>
      <section className="arx-workspace-editor" aria-label="Performans laboratuvarı çalışma alanı"><ArkemXLab /></section>
    </div>
  </main>;
}

