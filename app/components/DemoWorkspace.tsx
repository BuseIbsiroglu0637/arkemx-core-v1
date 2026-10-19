"use client";
import Link from "next/link";
import { useState } from "react";
import { createDemoProject } from "../lib/demo";
import { PROJECT_MODULES } from "../lib/project-graph";
import { downloadTextFile } from "../lib/engineering";
import { useProjectKernel } from "./ProjectKernel";

export function DemoBanner() {
  return <aside className="demo-banner" aria-label="Demo bilgisi"><strong>ARKEMX DEMO · v177</strong><span>Örnek çalışma · Kayıtlar bu tarayıcıda tutulur.</span><Link href="/dijital-proje-merkezi">13 modüle dön ↗</Link></aside>;
}
export function DemoWorkspace() {
  const { project, hydrated, importProject } = useProjectKernel();
  const [notice, setNotice] = useState("");
  const [confirmReload, setConfirmReload] = useState(false);
  function load() {
    if (importProject(createDemoProject())) { setNotice("Örnek proje yüklendi. Bir modül seçerek başlayabilirsiniz."); setConfirmReload(false); }
    else setNotice("Örnek proje yüklenemedi.");
  }
  return <section className="demo-workspace shell" aria-labelledby="demo-title">
    <header><p className="eyebrow">ARKEMX / ETKİLEŞİMLİ DEMO</p><h1 id="demo-title">Bir projeyi birlikte keşfedin.</h1><p>Örnek bir konut yatırımıyla başlayın; arsa araştırmasından tasarım ve teslime kadar 13 çalışma alanını gezin.</p></header>
    <div className="demo-actions"><button type="button" disabled={!hydrated} onClick={() => Object.keys(project.modules).length ? setConfirmReload(true) : load()}>Örnek projeyi yükle</button><button type="button" disabled={!hydrated} onClick={() => { downloadTextFile(`${project.id}-demo.json`, JSON.stringify({ ...project, demo: true }, null, 2), "application/json"); setNotice("Demo çalışma dosyası indirildi."); }}>Çalışmamı indir</button></div>
    {confirmReload && <div className="demo-confirm" role="group" aria-label="Örnek projeyi yeniden yükle"><p>Bu demo oturumundaki değişiklikler örnek projeyle değiştirilecek. Saklamak için önce çalışmanızı indirin.</p><button type="button" onClick={load}>Örneği yeniden yükle</button><button type="button" onClick={() => setConfirmReload(false)}>Vazgeç</button></div>}
    <p className="demo-notice" role="status">{notice || (hydrated ? `Açık çalışma: ${project.name}` : "Demo hazırlanıyor…")}</p>
    <p className="demo-note">Başlangıç örneğinde yatırım hedefi, arama bölgesi ve mahal listesi bulunur. Diğer modülleri açıp kendi girdilerinizle deneyin. Harita ve dış kaynak sorguları internet gerektirir; gerçek parsel, imar doğrulaması veya mühendislik onayı örneğe dahil değildir. Başvuru, hesap ve belge servisi bu demoda kapalıdır.</p>
    <div className="demo-module-grid">{PROJECT_MODULES.map((module, index) => <Link key={module.id} href={module.route}><span>{String(index + 1).padStart(2, "0")} / {module.code}</span><h2>{module.label}</h2><p>{module.output}</p><small>{project.modules[module.id] ? "Çalışma verisi var" : "Girdilerle dene"} · Aç ↗</small></Link>)}</div>
  </section>;
}
