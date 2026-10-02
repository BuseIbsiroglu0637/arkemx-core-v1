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

type ProjectStartPageProps = {
  searchParams?: Promise<{ view?: string | string[] }>;
};

export default async function ProjectStartPage({ searchParams }: ProjectStartPageProps) {
  const params = await searchParams;
  const rawView = Array.isArray(params?.view) ? params?.view[0] : params?.view;
  const rawNew = Array.isArray(params?.new) ? params?.new[0] : params?.new;
  const summaryMode = rawView === "summary";
  const newProjectMode = rawNew === "1";

  return (
    <main className="arx-simple-home arx-start-page">
      <div className="arx-simple-shell">
        <header className="arx-simple-head">
          <Link href="/" className="arx-simple-brand" aria-label="ARKEMX araçlar ana sayfası">ARKEM<span>X</span></Link>
          <Link href="/" className="arx-start-back"><ArrowLeft size={17} strokeWidth={1.9} aria-hidden="true" /> Araçlara dön</Link>
        </header>
        <div className="arx-start-intro">
          <span>PROJE / BAŞLANGIÇ</span>
          <h1>{summaryMode ? "Proje başlangıç özeti" : "Yeni proje oluştur"}</h1>
          <p>{summaryMode ? "Başlangıç kararlarını, yol haritasını ve doğrulama bekleyen verileri tekrar inceleyin." : "Proje bilgilerinizi adım adım girin. Çalışmanız bu cihazda taslak olarak saklanır."}</p>
        </div>
        <ProjectStartStudio summaryMode={summaryMode} newProjectMode={newProjectMode} />
      </div>
    </main>
  );
}
