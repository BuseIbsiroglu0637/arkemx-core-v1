import { DEMO_ENABLED } from "../lib/demo";
import type { Metadata } from "next";
import Link from "next/link";
import { ArchitecturalProgramStudio } from "../components/ArchitecturalProgramStudio";
import { SiteFooter } from "../components/SiteChrome";
import { ModuleWorkspaceHeader } from "../components/ModuleWorkspaceHeader";

export const metadata: Metadata = {
  title: "Mimari Program ve Mekân Tasarımı | ARKEMX",
  description: "V112 yapı zarfını mahal programı, gerçek mesafe tabanlı komşuluk, dolaşım, çekirdek, günışığı ve kaçış ön kontrollerine bağlayan Arkem V113 mimari tasarım stüdyosu.",
  alternates: { canonical: "/mimari-program-studyosu" },
};

export default function ArchitecturalProgramPage() {
  return <main className="inner-page architectural-program-page module-workspace-page">
    {!DEMO_ENABLED && <ModuleWorkspaceHeader title="Mekân ihtiyaçlarınızı düzenleyin" description="Alanları ve mekân ilişkilerini bir ön şemada geliştirin. Sonuç mimar incelemesi içindir; ruhsat veya uygulama projesi değildir." target="mimari-motor" />}
    
    <section id="mimari-motor" className="architecture-live-section"><div className="section shell"><ArchitecturalProgramStudio/></div></section>
    {!DEMO_ENABLED && <><section className="architecture-workflow"><div className="section shell"><p className="eyebrow light">Bağlı Tasarım Akışı</p><div>{[["01","Parsel","İzin ve kütle girdisi","/arsa-fizibilite-studyosu"],["02","Program","Mahal ve performans kaydı","/mimari-program-studyosu"],["03","Plan","Aks ve nesne modeli","/tasarim-calismalari"],["04","Koordinasyon","Mimari–statik–MEP issue","/muhendislik-koordinasyon"]].map(([no,title,copy,href]) => <Link href={href} key={no}><span>{no}</span><b>{title}</b><small>{copy}</small><i>↗</i></Link>)}</div></div></section>
  <section className="section shell architecture-intro"><div><p className="eyebrow">Mimari Karar Sistemi 2.0</p><h2>Biçimden önce<br/><em>gereksinim, ilişki ve rota.</em></h2></div><div><p>Şema motoru; her mahalin alanını, adedini, kullanıcı yoğunluğunu ve çevre ihtiyacını V112’den gelen yapı zarfı içinde konumlandırır.</p><p>Komşuluk kararları gerçek düğüm mesafeleriyle, kaçış ön göstergesi en yakın çıkış rotasıyla değerlendirilir. Sonuç avan tasarım girdisidir; ruhsat veya uygulama projesi değildir.</p></div></section>
  <SiteFooter/></>}
  </main>;
}
