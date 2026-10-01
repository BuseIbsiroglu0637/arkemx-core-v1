import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { ArchitecturalProgramStudio } from "../../components/ArchitecturalProgramStudio";
import "../../sade-arac-paneli.css";
import "../sade-mimari.css";
import "./kaks-duzeltme.css";

export const metadata: Metadata = {
  title: "KAKS Program Düzeltme | ARKEMX",
  description: "Mimari program brüt alanını kayıtlı KAKS/emsal sınırıyla uyumlu hale getiren odaklı çalışma görünümü.",
  robots: { index: false, follow: false },
};

export default function Page() {
  return <main className="arx-simple-home arx-architecture-page arx-kaks-page">
    <div className="arx-simple-shell">
      <header className="arx-simple-head">
        <Link href="/" className="arx-simple-brand" aria-label="ARKEMX araçlar ana sayfası">ARKEM<span>X</span></Link>
        <nav className="arx-architecture-back" aria-label="KAKS düzeltme bağlantıları">
          <Link href="/dijital-proje-merkezi"><ArrowLeft size={16} aria-hidden="true" /> Proje Çalışma Alanı</Link>
          <Link href="/arsa-fizibilite-studyosu?stage=zoning#geo-studyo">KAKS girdisini incele</Link>
          <Link href="/mimari-program-studyosu#mimari-motor">Tam mimari program</Link>
        </nav>
      </header>
      <div className="arx-kaks-page-intro">
        <span>KONTROL · PLN-012</span>
        <h1>Program brütünü düzelt</h1>
        <p>Mahal programını kayıtlı KAKS/emsal girdisine göre sınır içine alın. Bu ekran imar değerini değiştirmez; mimari program kaydını düzenler.</p>
      </div>
      <section aria-label="KAKS program düzeltme çalışma alanı">
        <ArchitecturalProgramStudio issueFocus="kaks" />
      </section>
    </div>
  </main>;
}
