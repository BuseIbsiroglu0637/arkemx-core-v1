import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { SystemComparisonTool } from "../components/SystemComparisonTool";
import "../sade-arac-paneli.css";
import "../sade-muhendislik-araclari.css";
import "./sade-sistem.css";

export const metadata: Metadata = {
  title: "Yapı Sistemi Karşılaştırma | ARKEMX",
  description: "Proje verileri ve belirlediğiniz kriterlerle beş taşıyıcı sistemi ön eleme düzeyinde karşılaştırın.",
  alternates: { canonical: "/sistem-karsilastirma" },
  robots: { index: false, follow: false },
};

export default function SimpleSystemComparisonPage() {
  return <main className="arx-simple-home arx-workspace-page arx-system-page">
    <div className="arx-simple-shell arx-workspace-shell">
      <header className="arx-simple-head">
        <Link href="/" className="arx-simple-brand" aria-label="ARKEMX araçlar ana sayfası">ARKEM<span>X</span></Link>
        <nav className="arx-workspace-nav" aria-label="Sayfa bağlantıları">
          <Link href="/dijital-proje-merkezi"><ArrowLeft size={16} aria-hidden="true" /> Proje Çalışma Alanına Dön</Link>
          <Link href="/">Tüm araçlar</Link>
        </nav>
      </header>
      <div className="arx-workspace-intro">
        <span>MÜHENDİSLİK / SİSTEM SEÇİMİ</span>
        <h1>Yapı sistemi karşılaştırma</h1>
        <p>Proje girdilerini ve önceliklerinizi belirleyin; beş sistemin ön eleme sonuçlarını aynı ekranda inceleyin.</p>
      </div>
      <section className="arx-workspace-editor" aria-label="Yapı sistemi karşılaştırma çalışma alanı">
        <SystemComparisonTool simple />
      </section>
    </div>
  </main>;
}
