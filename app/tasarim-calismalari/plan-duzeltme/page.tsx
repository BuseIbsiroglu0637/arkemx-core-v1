import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { AdvancedPlanEditor } from "../../components/AdvancedPlanEditor";
import "../../sade-arac-paneli.css";
import "./plan-duzeltme.css";

export const metadata: Metadata = {
  title: "Plan Tabanı Düzeltme | ARKEMX",
  description: "Plan taban alanını TAKS ön kontrol sınırıyla uyumlu hale getiren odaklı plan düzenleme görünümü.",
  robots: { index: false, follow: false },
};

export default function Page() {
  return <main className="arx-simple-home arx-plan-fix-page">
    <div className="arx-simple-shell">
      <header className="arx-simple-head">
        <Link href="/" className="arx-simple-brand" aria-label="ARKEMX araçlar ana sayfası">ARKEM<span>X</span></Link>
        <nav className="arx-plan-fix-links" aria-label="Plan düzeltme bağlantıları">
          <Link href="/dijital-proje-merkezi"><ArrowLeft size={16} aria-hidden="true" /> Proje Çalışma Alanı</Link>
          <Link href="/arsa-fizibilite-studyosu?stage=zoning&focus=taks#geo-studyo">TAKS girdisini incele</Link>
          <Link href="/tasarim-calismalari#plan-editor">Tam plan editörü</Link>
        </nav>
      </header>

      <div className="arx-plan-fix-intro">
        <span>KONTROL · PLN-011</span>
        <h1>Plan tabanını düzelt</h1>
        <p>Plan & aks modelindeki taban alanını kayıtlı TAKS girdisine göre sınır içine alın. Bu ekran imar değerini değiştirmez; plan geometrisini düzenler.</p>
      </div>

      <section aria-label="TAKS plan tabanı düzeltme çalışma alanı">
        <AdvancedPlanEditor issueFocus="taks" />
      </section>
    </div>
  </main>;
}
