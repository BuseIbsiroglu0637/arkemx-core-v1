import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { HeightCorrectionStudio } from "../../components/HeightCorrectionStudio";
import "../../sade-arac-paneli.css";
import "./yukseklik-duzeltme.css";

export const metadata: Metadata = {
  title: "Yükseklik Düzeltme | ARKEMX",
  description: "Kat adedi ve Hmax ön kontrolünü proje veri kaynaklarıyla koordine eden odaklı çalışma görünümü.",
  robots: { index: false, follow: false },
};

export default function Page() {
  return <main className="arx-simple-home arx-height-fix-page">
    <div className="arx-simple-shell">
      <header className="arx-simple-head">
        <Link href="/" className="arx-simple-brand" aria-label="ARKEMX araçlar ana sayfası">ARKEM<span>X</span></Link>
        <nav className="arx-height-fix-links" aria-label="Yükseklik düzeltme bağlantıları">
          <Link href="/dijital-proje-merkezi"><ArrowLeft size={16} aria-hidden="true" /> Proje Çalışma Alanı</Link>
          <Link href="/arsa-fizibilite-studyosu?stage=zoning&focus=hmax#geo-studyo">Hmax girdisini incele</Link>
          <Link href="/tasarim-calismalari#plan-editor">Tam plan editörü</Link>
        </nav>
      </header>

      <div className="arx-height-fix-intro">
        <span>KONTROL · PLN-013</span>
        <h1>Yapı yüksekliğini düzelt</h1>
        <p>Kat adedinin gerçek veri sahibini, kayıtlı Hmax/Yençok girdisine göre koordine edin. Kat yüksekliğinin kaynağı ayrıca görünür tutulur.</p>
      </div>

      <HeightCorrectionStudio />
    </div>
  </main>;
}
