import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { StructuralSyncStudio } from "../../components/StructuralSyncStudio";
import "../../sade-arac-paneli.css";
import "./model-senkronizasyonu.css";

export const metadata: Metadata = {
  title: "Plan → Taşıyıcı Model Senkronizasyonu | ARKEMX",
  description: "Plan ve taşıyıcı ön tasarım geometri kayıtlarını kontrollü biçimde eşleyen odaklı koordinasyon görünümü.",
  robots: { index: false, follow: false },
};

export default function Page() {
  return <main className="arx-simple-home arx-struct-sync-page">
    <div className="arx-simple-shell">
      <header className="arx-simple-head">
        <Link href="/" className="arx-simple-brand" aria-label="ARKEMX araçlar ana sayfası">ARKEM<span>X</span></Link>
        <nav className="arx-struct-sync-links" aria-label="Model senkronizasyon bağlantıları">
          <Link href="/dijital-proje-merkezi"><ArrowLeft size={16} aria-hidden="true" /> Proje Çalışma Alanı</Link>
          <Link href="/tasarim-calismalari/yukseklik-duzeltme">Yükseklik kontrolü</Link>
          <Link href="/tasarim-calismalari#tasiyici-on-tasarim">Tam taşıyıcı ön tasarım</Link>
        </nav>
      </header>

      <div className="arx-struct-sync-intro">
        <span>KONTROL · STR-031 / STR-032 / STR-033</span>
        <h1>Plan ile taşıyıcı modeli senkronize et</h1>
        <p>Plan & aks modelindeki geometrik kaydı taşıyıcı ön tasarıma kontrollü olarak aktarın. Mühendislik kabulleri ve taşıyıcı sistem seçimleri korunur.</p>
      </div>

      <StructuralSyncStudio />
    </div>
  </main>;
}
