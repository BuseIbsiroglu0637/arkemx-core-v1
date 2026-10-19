"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { PROJECT_MODULES } from "../lib/project-graph";

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
    <nav className="demo-module-grid" aria-label="Proje modülleri">{PROJECT_MODULES.map((module, index) => <Link key={module.id} href={module.route} aria-label={`${module.code} — ${module.label}`}><span className="demo-module-code">{String(index + 1).padStart(2, "0")} / {module.code}</span><h2>{module.label}</h2><span className="demo-module-arrow" aria-hidden="true">↗</span></Link>)}</nav>
  </section>;
}
