import type { Metadata } from "next";
import Link from "next/link";
import { Grid2X2 } from "lucide-react";
import { SimpleProjectCenter } from "../components/SimpleProjectCenter";
import { AccountHeaderLink } from "../components/AccountHeaderLink";
import "../sade-arac-paneli.css";
import "./sade-proje-merkezi.css";

export const metadata: Metadata = {
  title: "Proje Çalışma Alanı | ARKEMX",
  description: "Aktif projenizi yönetin, proje ilerlemesini izleyin ve sıradaki mühendislik adımına devam edin.",
  alternates: { canonical: "/dijital-proje-merkezi" },
  robots: { index: false, follow: false },
};

export default function DigitalProjectCenterPage() {
  return <main className="arx-simple-home arx-center-page">
    <div className="arx-simple-shell">
      <header className="arx-simple-head">
        <Link href="/" className="arx-simple-brand" aria-label="ARKEMX ana sayfası">ARKEM<span>X</span></Link>
        <nav className="arx-simple-head-actions" aria-label="Proje Çalışma Alanı bağlantıları">
          <Link href="/araclar" className="arx-center-back"><Grid2X2 size={15} strokeWidth={1.9} aria-hidden="true" /> Tüm araçlar</Link>
          <AccountHeaderLink />
        </nav>
      </header>
      <div className="arx-center-intro">
        <span>PROJE KOKPİTİ</span>
        <h1>Proje Çalışma Alanı</h1>
        <p>Aktif projenizi yönetin, ilerlemeyi görün ve ARKEMX’in önerdiği sıradaki mühendislik adımına devam edin.</p>
      </div>
      <section id="canli-proje-grafigi" aria-label="Proje çalışma alanı">
        <SimpleProjectCenter />
      </section>
    </div>
  </main>;
}
