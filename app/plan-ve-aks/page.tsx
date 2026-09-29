import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { AdvancedPlanEditor } from "../components/AdvancedPlanEditor";
import "../sade-arac-paneli.css";
import "../sade-muhendislik-araclari.css";

export const metadata: Metadata = {
  title: "Plan ve Aks | ARKEMX",
  description: "Mimari programdan gelen verilerle aks düzeni ve nesne tabanlı kavramsal plan oluşturun.",
  alternates: { canonical: "/plan-ve-aks" },
  robots: { index: false, follow: false },
};

export default function PlanAndGridPage() {
  return <main className="arx-simple-home arx-workspace-page arx-plan-page">
    <div className="arx-simple-shell arx-workspace-shell">
      <header className="arx-simple-head">
        <Link href="/" className="arx-simple-brand" aria-label="ARKEMX araçlar ana sayfası">ARKEM<span>X</span></Link>
        <nav className="arx-workspace-nav" aria-label="Sayfa bağlantıları">
          <Link href="/dijital-proje-merkezi"><ArrowLeft size={16} aria-hidden="true" /> Proje merkezine dön</Link>
          <Link href="/">Tüm araçlar</Link>
        </nav>
      </header>
      <div className="arx-workspace-intro">
        <span>TASARIM / PLAN</span>
        <h1>Plan ve aks</h1>
        <p>Mimari programdaki verilerle aksları ve plan nesnelerini düzenleyin. Çalışmanız aynı proje kaydında saklanır.</p>
      </div>
      <section className="arx-workspace-editor" aria-label="Plan ve aks çalışma alanı">
        <AdvancedPlanEditor compactKernel />
      </section>
    </div>
  </main>;
}
