import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { StructuralDesigner } from "../components/StructuralDesigner";
import "../sade-arac-paneli.css";
import "../sade-muhendislik-araclari.css";

export const metadata: Metadata = {
  title: "Taşıyıcı Ön Tasarım | ARKEMX",
  description: "Aynı proje geometrisiyle farklı taşıyıcı sistemleri kavramsal düzeyde karşılaştırın.",
  alternates: { canonical: "/tasiyici-on-tasarim" },
  robots: { index: false, follow: false },
};

export default function StructuralConceptPage() {
  return <main className="arx-simple-home arx-workspace-page arx-structural-page">
    <div className="arx-simple-shell arx-workspace-shell">
      <header className="arx-simple-head">
        <Link href="/" className="arx-simple-brand" aria-label="ARKEMX araçlar ana sayfası">ARKEM<span>X</span></Link>
        <nav className="arx-workspace-nav" aria-label="Sayfa bağlantıları">
          <Link href="/sistem-karsilastirma"><ArrowLeft size={16} aria-hidden="true" /> Önceki adıma dön</Link>
          <Link href="/dijital-proje-merkezi">Proje Çalışma Alanı</Link>
          <Link href="/araclar">Tüm araçlar</Link>
        </nav>
      </header>
      <div className="arx-workspace-intro">
        <span>MÜHENDİSLİK / ÖN TASARIM</span>
        <h1>Taşıyıcı ön tasarım</h1>
        <p>Plan ve aks verilerini kullanarak beş taşıyıcı sistemi karşılaştırın. Sonuçlar nihai statik hesap veya uygulama projesi değildir.</p>
      </div>
      <section className="arx-workspace-editor" aria-label="Taşıyıcı ön tasarım çalışma alanı">
        <StructuralDesigner compactKernel />
      </section>
    </div>
  </main>;
}

