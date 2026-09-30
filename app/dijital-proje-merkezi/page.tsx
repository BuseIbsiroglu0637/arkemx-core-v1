import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { SimpleProjectCenter } from "../components/SimpleProjectCenter";
import "../sade-arac-paneli.css";
import "./sade-proje-merkezi.css";

export const metadata: Metadata = {
  title: "Proje Merkezi | ARKEMX",
  description: "Projelerinizi açın, çalışma araçlarına geçin ve proje yedeğinizi yönetin.",
  alternates: { canonical: "/dijital-proje-merkezi" },
  robots: { index: false, follow: false },
};

export default function DigitalProjectCenterPage() {
  return <main className="arx-simple-home arx-center-page">
    <div className="arx-simple-shell">
      <header className="arx-simple-head">
        <Link href="/" className="arx-simple-brand" aria-label="ARKEMX araçlar ana sayfası">ARKEM<span>X</span></Link>
        <nav className="arx-simple-head-actions" aria-label="Proje merkezi bağlantıları"><Link href="/" className="arx-center-back"><ArrowLeft size={17} strokeWidth={1.9} aria-hidden="true" /> Araçlara dön</Link><a href="/giris?return_to=%2Fhesabim">Hesap</a></nav>
      </header>
      <div className="arx-center-intro">
        <span>ÇALIŞMA ALANI</span>
        <h1>Proje merkezi</h1>
        <p>Projenize devam edin, başka bir proje yükleyin veya çalışma araçlarından birini açın.</p>
      </div>
      <section id="canli-proje-grafigi" aria-label="Proje çalışma alanı">
        <SimpleProjectCenter />
      </section>
    </div>
  </main>;
}
