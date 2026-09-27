import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { ProjectStartStudio } from "../components/ProjectStartStudio";
import "../sade-arac-paneli.css";
import "./sade-baslangic.css";

export const metadata: Metadata = {
  title: "Yeni Proje | ARKEMX",
  description: "Yeni projenizi beş adımda oluşturun ve ARKEMX araçlarında kullanın.",
  alternates: { canonical: "/proje-baslat" },
  robots: { index: false, follow: false },
};

export default function ProjectStartPage() {
  return (
    <main className="arx-simple-home arx-start-page">
      <div className="arx-simple-shell">
        <header className="arx-simple-head">
          <Link href="/" className="arx-simple-brand" aria-label="ARKEMX araçlar ana sayfası">ARKEM<span>X</span></Link>
          <Link href="/" className="arx-start-back"><ArrowLeft size={17} strokeWidth={1.9} aria-hidden="true" /> Araçlara dön</Link>
        </header>
        <div className="arx-start-intro">
          <span>PROJE / BAŞLANGIÇ</span>
          <h1>Yeni proje oluştur</h1>
          <p>Proje bilgilerinizi adım adım girin. Çalışmanız bu cihazda taslak olarak saklanır.</p>
        </div>
        <ProjectStartStudio />
      </div>
    </main>
  );
}
