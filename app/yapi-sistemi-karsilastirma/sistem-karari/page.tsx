import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { SystemDecisionStudio } from "../../components/SystemDecisionStudio";
import "../../sade-arac-paneli.css";
import "./sistem-karari.css";

export const metadata: Metadata = {
  title: "Taşıyıcı Sistem Kararı | ARKEMX",
  description: "MCDA ön eleme sonucu ile modellenen taşıyıcı sistem arasındaki karar izini yöneten odaklı çalışma görünümü.",
  robots: { index: false, follow: false },
};

export default function Page() {
  return <main className="arx-simple-home arx-system-decision-page">
    <div className="arx-simple-shell">
      <header className="arx-simple-head">
        <Link href="/" className="arx-simple-brand" aria-label="ARKEMX araçlar ana sayfası">ARKEM<span>X</span></Link>
        <nav className="arx-system-decision-links" aria-label="Sistem kararı bağlantıları">
          <Link href="/dijital-proje-merkezi"><ArrowLeft size={16} aria-hidden="true" /> Proje Çalışma Alanı</Link>
          <Link href="/yapi-sistemi-karsilastirma/mcda">MCDA karşılaştırması</Link>
          <Link href="/tasiyici-on-tasarim">Taşıyıcı ön tasarım</Link>
        </nav>
      </header>

      <div className="arx-system-decision-intro">
        <span>KONTROL · SYS-041</span>
        <h1>Taşıyıcı sistem kararını gerekçesiyle bağla</h1>
        <p>MCDA ön eleme birincisi ile modellenen sistem farklıysa, öneriyi modele aktarın veya mevcut seçimi gerekçeli karar kaydıyla koruyun.</p>
      </div>

      <SystemDecisionStudio />
    </div>
  </main>;
}
