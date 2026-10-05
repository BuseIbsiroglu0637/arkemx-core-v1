import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { AdvancedPlanEditor } from "../../components/AdvancedPlanEditor";
import "../../sade-arac-paneli.css";
import "../plan-duzeltme/plan-duzeltme.css";

export const metadata: Metadata = {
  title: "Program / Plan Alan Koordinasyonu | ARKEMX",
  description: "Mimari program brüt alanını mevcut kat adedinde TAKS sınırını aşmadan plan taban geometrisine koordine eden odaklı çalışma görünümü.",
  robots: { index: false, follow: false },
};

export default function Page() {
  return <main className="arx-simple-home arx-plan-fix-page">
    <div className="arx-simple-shell">
      <header className="arx-simple-head">
        <Link href="/" className="arx-simple-brand" aria-label="ARKEMX araçlar ana sayfası">ARKEM<span>X</span></Link>
        <nav className="arx-plan-fix-links" aria-label="Program plan koordinasyon bağlantıları">
          <Link href="/dijital-proje-merkezi"><ArrowLeft size={16} aria-hidden="true" /> Proje Çalışma Alanı</Link>
          <Link href="/mimari-program-studyosu/plan-koordinasyonu">Program / plan özeti</Link>
          <Link href="/arsa-fizibilite-studyosu?stage=zoning&focus=taks#geo-studyo">TAKS girdisini incele</Link>
        </nav>
      </header>

      <div className="arx-plan-fix-intro">
        <span>KONTROL · ARC-021</span>
        <h1>Plan tabanını programa göre koordine et</h1>
        <p>Mimari program brütünü mevcut kat adedine bölerek hedef taban alanını üretin ve plan oranını koruyarak bu hedefe yaklaşın. Bu ekran programı veya imar girdilerini değiştirmez.</p>
      </div>

      <section aria-label="Program plan taban alanı koordinasyon çalışma alanı">
        <AdvancedPlanEditor issueFocus="program-area" />
      </section>
    </div>
  </main>;
}
