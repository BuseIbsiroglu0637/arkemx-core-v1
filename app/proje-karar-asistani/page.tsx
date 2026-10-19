import type { Metadata } from "next";
import { ProjectDecisionAssistant } from "../components/ProjectDecisionAssistant";

export const metadata: Metadata = {
  title: "Yatırım briefi | ARKEMX Demo",
  description: "Yatırım briefi demo çalışma alanı.",
  alternates: { canonical: "/proje-karar-asistani" },
  robots: { index: false, follow: false },
};

export default function ProjectDecisionPage() {
  return <main className="inner-page decision-page module-workspace-page demo-brief-page">
    <header className="shell demo-brief-heading"><p className="eyebrow">01 / PIR · DEMO</p><h1>Yatırım briefi</h1><p>Proje bilgilerini düzenleyin, ön değerlendirme oluşturun ve raporunuzu indirin.</p></header>
    <section id="karar-motoru" className="section shell"><ProjectDecisionAssistant/></section>
  </main>;
}
