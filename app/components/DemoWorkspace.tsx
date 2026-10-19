"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { type ReactNode, type FormEvent, useState } from "react";
import { useProjectKernel } from "./ProjectKernel";
import { PROJECT_MODULES } from "../lib/project-graph";

// Evidence from the 2026-10-19 entry checks and recorded browser tests.
const defaultCheck = { verified: "Sayfa açılıyor.", pending: "İşlev ve çıktı testleri bekliyor." };
const moduleChecks: Record<string, typeof defaultCheck> = {
  PIR: { verified: "Brief ve yol haritası test edildi.", pending: "Dosya/PDF çıktıları test bekliyor." },
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
  return ["/dijital-proje-merkezi", "/proje-karar-asistani"].includes(pathname ?? "") ? null : children;
}

export function DemoWorkspace() {
  const { project, hydrated, savedProjects, libraryError, openSavedProject, createNamedProject } = useProjectKernel();
  const router = useRouter();
  const [name, setName] = useState("");
  const [notice, setNotice] = useState("");
  const create = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (createNamedProject(name)) { setName(""); router.push("/proje-karar-asistani#karar-motoru"); }
    else setNotice("Proje oluşturulamadı. Adı ve tarayıcı kayıt durumunu kontrol edin.");
  };
  const open = (id: string) => {
    if (openSavedProject(id)) router.push("/proje-karar-asistani#karar-motoru");
    else setNotice("Proje açılamadı. Tarayıcı kayıt durumunu kontrol edin.");
  };
  return <section className="demo-workspace" aria-labelledby="demo-title">
    <header><p>ARKEMX <span>DEMO</span></p><h1 id="demo-title">Projelerim</h1></header>
    <section className="demo-projects" aria-label="Kayıtlı projeler">
      <form className="demo-project-create" onSubmit={create}><label htmlFor="demo-project-name">Yeni proje adı<input id="demo-project-name" maxLength={160} required value={name} onChange={event => setName(event.target.value)} placeholder="Örn. Kastamonu Konut" /></label><button type="submit" disabled={!hydrated || !name.trim()}>Yeni proje oluştur</button></form>
      <p className="demo-project-note">Projeler bu tarayıcıda otomatik saklanır. Başka cihazlara aktarılmaz.</p>
      {(libraryError || notice) && <p className="demo-project-error" role="alert">{libraryError || notice}</p>}
      {!hydrated ? <p role="status">Kayıtlar açılıyor…</p> : !savedProjects.length ? <p className="demo-project-empty">{libraryError ? "Kayıt listesi yüklenemedi." : "Henüz kayıtlı proje yok. Yeni bir proje oluşturarak başlayın."}</p> : <ul className="demo-project-list">{savedProjects.map(saved => {
        const count = PROJECT_MODULES.filter(module => Boolean(saved.modules[module.id])).length;
        return <li key={saved.id} className={saved.id === project.id ? "is-active" : ""}><div><h2>{saved.name}</h2><p>{saved.id === project.id && <span>Açık proje · </span>}{count}/13 modülde veri · {new Intl.DateTimeFormat("tr-TR", { dateStyle: "short", timeStyle: "short" }).format(new Date(saved.updatedAt))}</p></div><button type="button" onClick={() => open(saved.id)}>Projeyi aç <span aria-hidden="true">↗</span></button></li>;
      })}</ul>}
    </section>
    <h2 className="demo-modules-title">Modüller <span>13</span></h2>
    <nav className="demo-module-grid" aria-label="Proje modülleri">{PROJECT_MODULES.map((module, index) => {
      const check = moduleChecks[module.code] ?? defaultCheck;
      return <Link key={module.id} href={module.route} aria-label={`${module.code} — ${module.label}`} aria-describedby={`check-${module.code}`}><span className="demo-module-code">{String(index + 1).padStart(2, "0")} / {module.code}</span><h2>{module.label}</h2><small className="demo-module-check" id={`check-${module.code}`} title="Son kontrol: 19 Ekim 2026"><span className="demo-check-verified">{check.verified}</span><span className="demo-check-pending">{check.pending}</span></small><span className="demo-module-arrow" aria-hidden="true">↗</span></Link>;
    })}</nav>
  </section>;
}
