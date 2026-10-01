import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "../../components/SiteChrome";
import { AdvancedPlanEditor } from "../../components/AdvancedPlanEditor";

export const metadata: Metadata = {
  title: "Plan Tabanı Düzeltme | ARKEMX",
  description: "Plan taban alanını TAKS ön kontrol sınırıyla uyumlu hale getiren odaklı plan düzenleme görünümü.",
  robots: { index: false, follow: false },
};

export default function Page() {
  return <main className="inner-page plan-fix-page">
    <SiteHeader />
    <section className="shell plan-fix-shell">
      <header className="plan-fix-nav">
        <div>
          <span>AÇIK KONU · PLN-011</span>
          <h1>Plan tabanını düzelt</h1>
          <p>Plan & aks modelindeki taban alanını, kayıtlı TAKS girdisine göre sınır içine alın. Bu işlem imar değerini değiştirmez.</p>
        </div>
        <nav aria-label="Plan düzeltme gezinmesi">
          <Link href="/dijital-proje-merkezi">← Proje Çalışma Alanı</Link>
          <Link href="/arsa-fizibilite-studyosu?stage=zoning#geo-studyo">İmar girdisini incele</Link>
          <Link href="/tasarim-calismalari#plan-editor">Tam plan editörü</Link>
        </nav>
      </header>
      <AdvancedPlanEditor compactKernel issueFocus />
    </section>
  </main>;
}
