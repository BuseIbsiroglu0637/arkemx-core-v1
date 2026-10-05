import type { Metadata } from "next";
import Link from "next/link";
import { LandResearchStudio } from "../components/LandResearchStudio";
import "../sade-arac-paneli.css";
import "../sade-muhendislik-araclari.css";
import "./arsa-arastirma.css";

export const metadata: Metadata = { title: "Arsa Araştırması | ARKEMX", description: "Yatırım kriterlerine göre aday arsaları araştırın ve kısa listenizi oluşturun.", robots: { index: false, follow: false } };
export default function LandResearchPage() {
  return <main className="arx-simple-home arx-workspace-page arx-land-page"><div className="arx-simple-shell arx-workspace-shell">
    <header className="arx-simple-head"><Link className="arx-simple-brand" href="/">ARKEM<span>X</span></Link><nav aria-label="Sayfa bağlantıları"><Link href="/proje-baslat?view=summary">Başlangıç bilgileri</Link><Link href="/dijital-proje-merkezi">Proje Çalışma Alanı</Link></nav></header>
    <div className="arx-workspace-intro"><span>ARAZİ / ARAŞTIRMA</span><h1>Arsa araştırması</h1><p>Yatırım ihtiyaçlarınıza göre adayları getirin, karşılaştırın ve incelemeye alacağınız arsayı seçin.</p></div>
    <LandResearchStudio />
  </div></main>;
}
