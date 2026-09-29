import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { ArchitecturalProgramStudio } from "../components/ArchitecturalProgramStudio";
import "../sade-arac-paneli.css";
import "./sade-mimari.css";

export const metadata: Metadata = {
  title: "Mimari Program | ARKEMX",
  description: "Mahal listesi, hedef alan ve kavramsal plan şemasını yönetin.",
  alternates: { canonical: "/mimari-program-studyosu" },
  robots: { index: false, follow: false },
};

export default function ArchitecturalProgramPage() {
  return <main className="arx-simple-home arx-architecture-page">
    <div className="arx-simple-shell">
      <header className="arx-simple-head">
        <Link href="/" className="arx-simple-brand" aria-label="ARKEMX araçlar ana sayfası">ARKEM<span>X</span></Link>
        <nav className="arx-architecture-back" aria-label="Sayfa bağlantıları">
          <Link href="/dijital-proje-merkezi"><ArrowLeft size={16} aria-hidden="true" /> Proje merkezine dön</Link>
          <Link href="/">Tüm araçlar</Link>
        </nav>
      </header>
      <div className="arx-architecture-intro">
        <span>TASARIM / MİMARİ</span>
        <h1>Mimari program</h1>
        <p>Hedef alanı, katları ve mahal listesini düzenleyin. Ardından kavramsal plan şemasını inceleyin.</p>
      </div>
      <section id="mimari-motor" aria-label="Mimari program çalışma alanı">
        <ArchitecturalProgramStudio simple />
      </section>
    </div>
  </main>;
}
