"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { PROJECT_MODULES } from "../lib/project-graph";

// Evidence from the 2026-10-19 entry checks and recorded browser tests.
const defaultCheck = { verified: "Sayfa açılıyor.", pending: "İşlev ve çıktı testleri bekliyor." };
const moduleChecks: Record<string, typeof defaultCheck> = {
  ARC: { verified: "Örnek proje verisi açılıyor.", pending: "Diğer işlev ve çıktılar test bekliyor." },
  BEP: { verified: "Seçim ve sonuç güncellemesi çalışıyor.", pending: "JSON çıktısı test bekliyor." },
  LCA: { verified: "Karbon paneli açılıyor.", pending: "Hesap ve çıktılar test bekliyor." },
};

export function DemoBanner() {
  const pathname = usePathname();
  if (pathname === "/dijital-proje-merkezi") return null;
  return <aside className="demo-banner" aria-label="Demo bilgisi"><strong>ARKEMX DEMO · v177</strong><span>Örnek çalışma · Kayıtlar bu tarayıcıda tutulur.</span><Link href="/dijital-proje-merkezi">13 modüle dön ↗</Link></aside>;
}

export function DemoContact({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  return pathname === "/dijital-proje-merkezi" ? null : children;
}

export function DemoWorkspace() {
  return <section className="demo-workspace" aria-labelledby="demo-title">
    <header><p>ARKEMX <span>DEMO</span></p><h1 id="demo-title">Modüller <span>13</span></h1></header>
    <nav className="demo-module-grid" aria-label="Proje modülleri">{PROJECT_MODULES.map((module, index) => {
      const check = moduleChecks[module.code] ?? defaultCheck;
      return <Link key={module.id} href={module.route} aria-label={`${module.code} — ${module.label}`} aria-describedby={`check-${module.code}`}><span className="demo-module-code">{String(index + 1).padStart(2, "0")} / {module.code}</span><h2>{module.label}</h2><small className="demo-module-check" id={`check-${module.code}`} title="Son kontrol: 19 Ekim 2026"><span className="demo-check-verified">{check.verified}</span><span className="demo-check-pending">{check.pending}</span></small><span className="demo-module-arrow" aria-hidden="true">↗</span></Link>;
    })}</nav>
  </section>;
}
