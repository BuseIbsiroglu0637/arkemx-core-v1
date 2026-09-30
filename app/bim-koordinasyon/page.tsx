import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { EngineeringCoordinationStudio } from "../components/EngineeringCoordinationStudio";
import "../sade-arac-paneli.css";
import "../sade-muhendislik-araclari.css";
import "./sade-bim.css";

export const metadata: Metadata = {
  title: "BIM Koordinasyon | ARKEMX",
  description: "Mimari, taşıyıcı ve disiplin girdilerini ortak modelde izleyin; çakışmaları ve koordinasyon konularını yönetin.",
  alternates: { canonical: "/bim-koordinasyon" },
  robots: { index: false, follow: false },
};

export default function BimCoordinationWorkspacePage() {
  return <main className="arx-simple-home arx-workspace-page arx-bim-page">
    <div className="arx-simple-shell arx-workspace-shell">
      <header className="arx-simple-head">
        <Link href="/" className="arx-simple-brand" aria-label="ARKEMX araçlar ana sayfası">ARKEM<span>X</span></Link>
        <nav className="arx-workspace-nav" aria-label="Sayfa bağlantıları">
          <Link href="/dijital-proje-merkezi"><ArrowLeft size={16} aria-hidden="true" /> Proje Çalışma Alanına Dön</Link>
          <Link href="/">Tüm araçlar</Link>
        </nav>
      </header>
      <div className="arx-workspace-intro">
        <span>MÜHENDİSLİK / BIM</span>
        <h1>BIM koordinasyon</h1>
        <p>Mimari ve taşıyıcı modeli aynı proje verisinde izleyin; çakışmaları, açık konuları ve temel koordinasyon girdilerini tek ekranda yönetin.</p>
      </div>
      <section className="arx-workspace-editor" aria-label="BIM koordinasyon çalışma alanı">
        <EngineeringCoordinationStudio simple />
      </section>
    </div>
  </main>;
}
