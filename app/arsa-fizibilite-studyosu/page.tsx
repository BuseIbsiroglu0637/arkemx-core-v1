import type { Metadata } from "next";
import Link from "next/link";
import { GeoParcelStudio } from "../components/GeoParcelStudio";
import "../sade-arac-paneli.css";
import "./sade-arazi.css";

export const metadata: Metadata = {
  title: "Arazi ve Parsel | ARKEMX",
  description: "Parseli bulun, sınır verisini yükleyin ve imar bilgilerini kaynaklarıyla kaydedin.",
  alternates: { canonical: "/arsa-fizibilite-studyosu" },
  robots: { index: false, follow: false },
};

export default function SiteStudioPage() {
  return <main className="arx-simple-home arx-geo-page">
    <div className="arx-simple-shell">
      <header className="arx-simple-head">
        <Link href="/" className="arx-simple-brand" aria-label="ARKEMX araçlar ana sayfası">ARKEM<span>X</span></Link>
        <nav className="arx-geo-back" aria-label="Sayfa bağlantıları">
          <Link href="/dijital-proje-merkezi" className="arx-geo-back-primary">Proje Çalışma Alanına Dön</Link>
        </nav>
      </header>
      <div className="arx-geo-intro">
        <span>ARAZİ / PARSEL</span>
        <h1>Arazi ve parsel</h1>
        <p>Parseli bulun veya sınır dosyanızı yükleyin. İmar girdilerini, kaynak durumunu ve harita önizlemesini aynı çalışma alanında yönetin.</p>
      </div>
      <section id="geo-studyo" aria-label="Parsel çalışma alanı">
        <GeoParcelStudio simple />
      </section>
    </div>
  </main>;
}
