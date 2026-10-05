"use client";

import Link from "next/link";
import Image from "next/image";
import { useMemo, useState } from "react";
import { ArrowRight } from "lucide-react";
import { PROJECT_MODULES } from "../lib/project-graph";

const stages = ["Tanım", "Arsa", "Tasarım", "Koordinasyon", "Teslim"] as const;

const stageDetail = {
  Tanım: {
    statement: "Yatırım hedefini ve karar ölçütünü tek teknik briefte sabitleyin.",
    visual: "/visuals/arkem-x-brief-v2.webp",
    data: "İhtiyaç · öncelik · başarı ölçütü",
  },
  Arsa: {
    statement: "Parsel sınırı, konum, planlama ve çevre verisini tasarımın gerçek başlangıcı yapın.",
    visual: "/visuals/arkem-x-site-v2.webp",
    data: "Koordinat · parsel · kütle · bağlam",
  },
  Tasarım: {
    statement: "Mimari programı, aksları ve taşıyıcı sistemi aynı karar modelinde geliştirin.",
    visual: "/visuals/arkem-x-design-v2.webp",
    data: "Mahal · aks · sistem · yük · metraj",
  },
  Koordinasyon: {
    statement: "Disiplin kararlarını issue, revizyon ve bilgi teslim kurallarıyla denetlenebilir kılın.",
    visual: "/visuals/arkem-x-coordination-v2.webp",
    data: "BIM · issue · performans · BEP",
  },
  Teslim: {
    statement: "Program, saha kaydı ve varlık bilgisini yaşayan teslim paketine dönüştürün.",
    visual: "/visuals/arkem-x-delivery-v2.webp",
    data: "4B · CDE · saha · AIM · pasaport",
  },
} as const;

export function EcosystemCommandMap() {
  const [selectedId, setSelectedId] = useState(PROJECT_MODULES[0].id);
  const selected = PROJECT_MODULES.find((module) => module.id === selectedId) ?? PROJECT_MODULES[0];
  const stage = stageDetail[selected.stage];
  const selectedIndex = PROJECT_MODULES.findIndex((module) => module.id === selected.id);
  const stageModules = useMemo(
    () => PROJECT_MODULES.filter((module) => module.stage === selected.stage),
    [selected.stage],
  );

  const selectStage = (nextStage: (typeof stages)[number]) => {
    const first = PROJECT_MODULES.find((module) => module.stage === nextStage);
    if (first) setSelectedId(first.id);
  };

  return <section className="ecosystem-command-map" aria-label="ARKEMX çalışan geliştirme modülleri" data-testid="ecosystem-command-map">
    <nav className="ecosystem-command-stages" aria-label="ARKEMX proje aşamaları">
      {stages.map((item, index) => {
        const count = PROJECT_MODULES.filter((module) => module.stage === item).length;
        return <button type="button" className={selected.stage === item ? "active" : ""} onClick={() => selectStage(item)} key={item}>
          <span>{String(index + 1).padStart(2, "0")}</span>
          <b>{item}</b>
          <small>{count} modül</small>
        </button>;
      })}
    </nav>

    <div className="ecosystem-command-stage">
      <div className="ecosystem-command-visual">
        <Image src={stage.visual} alt="" aria-hidden="true" width={1280} height={800} sizes="(max-width: 900px) 100vw, 64vw" />
        <div className="ecosystem-command-grid" aria-hidden="true"/>
        <div className="ecosystem-command-visual-label">
          <span>ARKEMX / {selected.code}</span>
          <b>{selected.label}</b>
          <small>{stage.data}</small>
        </div>
        <div className="ecosystem-command-progress">
          <span>{String(selectedIndex + 1).padStart(2, "0")}</span>
          <i><b style={{ width: `${(selectedIndex + 1) / PROJECT_MODULES.length * 100}%` }}/></i>
          <small>{PROJECT_MODULES.length} bağlı modül</small>
        </div>
      </div>

      <article className="ecosystem-command-detail">
        <header><span>{selected.stage.toLocaleUpperCase("tr-TR")} / {selected.code}</span><div className="ecosystem-command-status"><i>AKTİF · GELİŞTİRİLİYOR</i></div></header>
        <div className="ecosystem-command-title"><small>{selected.discipline}</small><h3>{selected.label}</h3><p>{stage.statement}</p></div>
        <div className="ecosystem-command-output">
          <span><small>ÜRETİLEN TEKNİK ÇIKTI</small></span>
          <b>{selected.output}</b>
        </div>
        <div className="ecosystem-command-dependencies">
          <span>VERİ BAĞLANTISI</span>
          <div>
            {selected.dependencies.length
              ? selected.dependencies.map((dependency) => {
                const source = PROJECT_MODULES.find((module) => module.id === dependency);
                return <b key={dependency}>{source?.code ?? dependency}</b>;
              })
              : <b>BAŞLANGIÇ MODÜLÜ</b>}
            <i aria-hidden="true">→</i><b className="current">{selected.code}</b>
          </div>
        </div>
        <Link href={selected.route} data-analytics="arkemx_working_module_open" data-analytics-context={selected.code}>Modülü şimdi açın <ArrowRight size={17}/></Link>
      </article>
    </div>

    <div className="ecosystem-command-modules" aria-label={`${selected.stage} modülleri`}>
      {stageModules.map((module) => <button type="button" className={module.id === selected.id ? "active" : ""} onClick={() => setSelectedId(module.id)} key={module.id}>
        <span>{module.code}</span><b>{module.label}</b><small>{module.output}</small><ArrowRight size={15}/>
      </button>)}
    </div>

    <footer className="ecosystem-command-spine">
      <div className="ecosystem-spine-title">
        <b>ARKEMX PROJE OMURGASI</b>
        <span>Ortak proje veri omurgası</span>
      </div>
      <div className="ecosystem-spine-flow" aria-label="Proje verisinin izlediği aşamalar">
        {["Kimlik", "Koordinat", "Geometri", "Revizyon", "Karar", "Teslim"].map((step, index) =>
          <span key={step}><i>{String(index + 1).padStart(2, "0")}</i>{step}</span>
        )}
      </div>
      <Link href="/dijital-proje-merkezi">Canlı veri grafiği <ArrowRight size={15}/></Link>
    </footer>
  </section>;
}
