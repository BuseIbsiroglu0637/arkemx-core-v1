import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { AdvancedPlanEditor } from "../../components/AdvancedPlanEditor";
import "../../sade-arac-paneli.css";
import "./km-kr-kaynaklari.css";

export const metadata: Metadata = {
  title: "KM–KR Kaynakları | ARKEMX",
  description: "Kütle ve rijitlik merkezi ön kontrolü için gerekli plan kaynak nesnelerini tanımlayan odaklı BIM çalışma görünümü.",
  robots: { index: false, follow: false },
};

export default function Page() {
  return <main className="arx-simple-home arx-kmkr-page">
    <div className="arx-simple-shell">
      <header className="arx-simple-head">
        <Link href="/" className="arx-simple-brand" aria-label="ARKEMX araçlar ana sayfası">ARKEM<span>X</span></Link>
        <nav className="arx-kmkr-links" aria-label="KM KR çalışma bağlantıları">
          <Link href="/dijital-proje-merkezi"><ArrowLeft size={16} aria-hidden="true" /> Proje Çalışma Alanı</Link>
          <Link href="/tasarim-calismalari/model-senkronizasyonu">Model senkronizasyonu</Link>
          <Link href="/tasarim-calismalari#plan-editor">Tam plan editörü</Link>
        </nav>
      </header>

      <div className="arx-kmkr-intro">
        <span>KONTROL · BIM-053</span>
        <h1>KM–KR ön kontrol kaynaklarını tamamla</h1>
        <p>Aktif katta kütle merkezi için mahal/yük bölgelerini, rijitlik merkezi için kolon/perde nesnelerini tanımlayın. Geometrik plaka merkezi gerçek rijitlik merkezi kabul edilmez.</p>
      </div>

      <AdvancedPlanEditor issueFocus="kmkr" />
    </div>
  </main>;
}
