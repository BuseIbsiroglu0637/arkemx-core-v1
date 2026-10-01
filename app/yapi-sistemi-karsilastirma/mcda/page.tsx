import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { SystemComparisonTool } from "../../components/SystemComparisonTool";
import "../../sade-arac-paneli.css";
import "../../sade-muhendislik-araclari.css";
import "./mcda.css";

export const metadata: Metadata = {
  title: "MCDA Sistem Karşılaştırması | ARKEMX",
  description: "Aktif proje verileriyle taşıyıcı sistemleri çok ölçütlü ön elemede karşılaştıran sade çalışma görünümü.",
  robots: { index: false, follow: false },
};

export default function Page() {
  return <main className="arx-simple-home arx-mcda-page">
    <div className="arx-simple-shell arx-mcda-shell">
      <header className="arx-simple-head">
        <Link href="/" className="arx-simple-brand" aria-label="ARKEMX araçlar ana sayfası">ARKEM<span>X</span></Link>
        <nav className="arx-mcda-links" aria-label="MCDA çalışma bağlantıları">
          <Link href="/dijital-proje-merkezi"><ArrowLeft size={16} aria-hidden="true" /> Proje Çalışma Alanı</Link>
          <Link href="/yapi-sistemi-karsilastirma/sistem-karari">Sistem kararı</Link>
          <Link href="/tasiyici-on-tasarim">Taşıyıcı ön tasarım</Link>
        </nav>
      </header>

      <div className="arx-mcda-intro">
        <span>YAPI MÜHENDİSLİĞİ · MCDA</span>
        <h1>Taşıyıcı sistemleri proje verisiyle karşılaştır</h1>
        <p>Aktif proje kaydındaki kullanım, kat, alan ve açıklık verilerini kullanın; kriter ağırlıklarını inceleyin ve beş sistemi aynı ön eleme çerçevesinde karşılaştırın.</p>
      </div>

      <SystemComparisonTool simple />
    </div>
  </main>;
}
