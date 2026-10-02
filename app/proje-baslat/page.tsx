import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { ProjectStartIntro, ProjectStartStudio } from "../components/ProjectStartStudio";
import "../sade-arac-paneli.css";
import "./sade-baslangic.css";

export const metadata: Metadata = {
  title: "Proje Başlangıcı | ARKEMX",
  description: "Yeni proje oluşturun veya aktif projenizin başlangıç bilgilerini yönetin.",
  alternates: { canonical: "/proje-baslat" },
  robots: { index: false, follow: false },
};

type ProjectStartPageProps = {
  searchParams?: Promise<{
    view?: string | string[];
    new?: string | string[];
    fresh?: string | string[];
  }>;
};

export default async function ProjectStartPage({ searchParams }: ProjectStartPageProps) {
  const params = await searchParams;
  const rawView = Array.isArray(params?.view) ? params?.view[0] : params?.view;
  const rawNew = Array.isArray(params?.new) ? params?.new[0] : params?.new;
  const rawFresh = Array.isArray(params?.fresh) ? params?.fresh[0] : params?.fresh;
  const summaryMode = rawView === "summary";
  const newProjectMode = rawNew === "1";
  const freshProjectMode = rawFresh === "1";

  return (
    <main className="arx-simple-home arx-start-page">
      <div className="arx-simple-shell">
        <header className="arx-simple-head">
          <Link href="/" className="arx-simple-brand" aria-label="ARKEMX araçlar ana sayfası">ARKEM<span>X</span></Link>
          <Link href="/dijital-proje-merkezi" className="arx-start-back"><ArrowLeft size={17} strokeWidth={1.9} aria-hidden="true" /> Proje Çalışma Alanına Dön</Link>
        </header>
        <ProjectStartIntro summaryMode={summaryMode} newProjectMode={newProjectMode} />
        <ProjectStartStudio
          summaryMode={summaryMode}
          newProjectMode={newProjectMode}
          freshProjectMode={freshProjectMode}
        />
      </div>
    </main>
  );
}
