import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { ArchitecturalProgramStudio } from "../../components/ArchitecturalProgramStudio";
import "../../sade-arac-paneli.css";
import "../sade-mimari.css";
import "./plan-koordinasyonu.css";

export const metadata: Metadata = {
  title: "Program Plan Koordinasyonu | ARKEMX",
  description: "Mahal programı ile plan toplam alanını aynı proje kaydında koordine eden odaklı çalışma görünümü.",
  robots: { index: false, follow: false },
};

export default function Page() {
  return <main className="arx-simple-home arx-plan-sync-page">
    <div className="arx-simple-shell">
      <header className="arx-simple-head">
        <Link href="/" className="arx-simple-brand" aria-label="ARKEMX araçlar ana sayfası">ARKEM<span>X</span></Link>
        <nav className="arx-plan-sync-links" aria-label="Program plan koordinasyon bağlantıları">
          <Link href="/dijital-proje-merkezi"><ArrowLeft size={16} aria-hidden="true" /> Proje Çalışma Alanı</Link>
          <Link href="/mimari-program-studyosu/kaks-duzeltme">KAKS kontrolü</Link>
          <Link href="/mimari-program-studyosu#mimari-motor">Tam mimari program</Link>
        </nav>
      </header>

      <div className="arx-plan-sync-intro">
        <span>KONTROL · ARC-021</span>
        <h1>Program ile plan alanını koordine et</h1>
        <p>Mahal programı brüt alanını mevcut plan geometrisi ve kat adediyle eşleyin. İmar girdileri veya plan geometrisi bu ekranda değiştirilmez.</p>
      </div>

      <ArchitecturalProgramStudio issueFocus="plan-sync" />
    </div>
  </main>;
}
