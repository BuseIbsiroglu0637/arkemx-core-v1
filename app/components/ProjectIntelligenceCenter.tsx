"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Activity, ArrowRight, Check, CircleAlert, Download, FileCheck2, Radar, ShieldCheck } from "lucide-react";
import { createCorporateTechnicalPdf } from "../lib/technical-sheet";
import { PROJECT_MODULES } from "../lib/project-graph";
import { useProjectKernel } from "./ProjectKernel";

type IntelligenceView = "executive" | "evidence" | "route" | "deliverables";

const evidenceOptions = [
  ["parcel", "Doğrulanmış parsel / koordinat", "GIS"],
  ["survey", "Halihazır / kot / topoğrafya", "GIS"],
  ["program", "Mahal ve kapasite programı", "ARC"],
  ["geotechnical", "Zemin verisi", "STR"],
  ["budget", "Bütçe veya hedef maliyet", "5D"],
  ["schedule", "Hedef takvim ve karar tarihleri", "4D"],
] as const;

const objectives = [
  ["balanced", "Dengeli karar", "Süre, maliyet ve teknik performansı birlikte görün."],
  ["speed", "Hız / yatırım takvimi", "Karar kapılarını ve kritik tedariki öne alın."],
  ["cost", "Toplam maliyet", "Sistem, metraj ve belirsizlik etkisini karşılaştırın."],
  ["performance", "Performans / sürdürülebilirlik", "Kabuk, karbon ve işletme verisini erken bağlayın."],
] as const;

const stageOptions = [
  ["idea", "Fikir / yatırım kararı", 0],
  ["site", "Arsa / fizibilite", 1],
  ["design", "Ön proje / tasarım", 2],
  ["delivery", "Uygulama / yapım", 3],
] as const;

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, Math.round(value)));
}

function downloadBytes(name: string, bytes: Uint8Array, type: string) {
  const blob = new Blob([bytes as BlobPart], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function ProjectIntelligenceCenter({ compact = false }: { compact?: boolean }) {
  const { project, thread, patchModule } = useProjectKernel();
  const [view, setView] = useState<IntelligenceView>("executive");
  const [stage, setStage] = useState<(typeof stageOptions)[number][0]>("idea");
  const [objective, setObjective] = useState<(typeof objectives)[number][0]>("balanced");
  const [evidence, setEvidence] = useState<string[]>([]);
  const [saved, setSaved] = useState(false);

  const intelligence = useMemo(() => {
    const stageIndex = stageOptions.find((item) => item[0] === stage)?.[2] ?? 0;
    const evidenceScore = evidence.length / evidenceOptions.length * 44;
    const liveScore = thread.metrics.readiness * .38;
    const maturityScore = stageIndex * 4;
    const readiness = clamp(10 + evidenceScore + liveScore + maturityScore, 8, 96);
    const confidence = clamp(readiness - thread.metrics.critical * 9 - thread.metrics.review * 3, 5, 95);
    const uncertainty = clamp(100 - confidence, 5, 95);
    const completedCodes = evidence.map((item) => evidenceOptions.find((option) => option[0] === item)?.[2]).filter(Boolean);
    const recommended = stage === "idea"
      ? ["decision-assistant", "geo-parcel", "architectural-program", "system-comparison"]
      : stage === "site"
        ? ["geo-parcel", "quick-site-scenario", "architectural-program", "system-comparison"]
        : stage === "design"
          ? ["architectural-program", "plan-editor", "system-comparison", "structural-concept", "engineering-coordination"]
          : ["engineering-coordination", "digital-delivery-scope", "project-os", "arkem-x"];
    const modules = PROJECT_MODULES.filter((module) => recommended.includes(module.id));
    const missing = evidenceOptions.filter((item) => !evidence.includes(item[0]));
    const gate = readiness >= 78 ? "Karar kapısına yakın" : readiness >= 52 ? "Kontrollü ilerleme" : "Ön veri tamamlanmalı";
    const gateTone = readiness >= 78 ? "good" : readiness >= 52 ? "review" : "risk";
    const priority = objectives.find((item) => item[0] === objective)?.[1] ?? "Dengeli karar";
    return { readiness, confidence, uncertainty, completedCodes, modules, missing, gate, gateTone, priority };
  }, [evidence, objective, stage, thread.metrics]);

  const toggleEvidence = (id: string) => {
    setEvidence((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
    setSaved(false);
  };

  const saveSnapshot = () => {
    patchModule("decision-assistant", {
      intelligence: {
        stage,
        objective,
        evidence,
        readiness: intelligence.readiness,
        confidence: intelligence.confidence,
        recommendedModules: intelligence.modules.map((module) => module.id),
        generatedAt: new Date().toISOString(),
      },
      status: "Proje zekâsı değerlendirmesi proje çekirdeğine kaydedildi",
    });
    setSaved(true);
  };

  const exportPdf = async () => {
    const modules = intelligence.modules.map((module) => `${module.code} / ${module.label}`);
    const bytes = await createCorporateTechnicalPdf({
      projectName: project.name,
      projectCode: project.id,
      module: "ARKEMX / PROJE ZEKÂSI",
      drawingTitle: "Yatırım Kararı ve Veri Hazırlık Raporu",
      drawingSubtitle: intelligence.priority,
      revision: project.revision,
      status: intelligence.gate,
      sheetNo: "PX-001",
      scale: "Ölçeksiz / karar özeti",
      preparedBy: "ARKEMX Karar Motoru",
      checkedBy: "Yetkili teknik inceleme bekleniyor",
      polylines: [
        { role: "grid", points: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 60 }, { x: 0, y: 60 }], closed: true },
        { role: "primary", points: [{ x: 8, y: 10 }, { x: intelligence.readiness, y: 10 }, { x: intelligence.readiness, y: 24 }, { x: 8, y: 24 }], closed: true },
        { role: "secondary", points: [{ x: 8, y: 37 }, { x: intelligence.confidence, y: 37 }, { x: intelligence.confidence, y: 51 }, { x: 8, y: 51 }], closed: true },
      ],
      metrics: [
        ["Veri hazırlığı", `%${intelligence.readiness}`],
        ["Karar güveni", `%${intelligence.confidence}`],
        ["Belirsizlik", `%${intelligence.uncertainty}`],
        ["Bağlı modül", `${thread.metrics.activeCount}/${thread.metrics.totalCount}`],
        ["Kritik issue", `${thread.metrics.critical}`],
        ["Karar kapısı", intelligence.gate],
      ],
      notes: [
        `Karar odağı: ${intelligence.priority}`,
        `Önerilen modüller: ${modules.join(" · ")}`,
        `Eksik veri: ${intelligence.missing.map((item) => item[1]).join(" · ") || "Temel veri seti tamamlandı"}`,
        "Bu çıktı ön değerlendirmedir; ruhsat, uygulama projesi, statik hesap veya yetkili teknik onay yerine geçmez.",
      ],
      legend: [["Veri hazırlığı", "primary"], ["Karar güveni", "secondary"], ["Gösterge alanı", "grid"]],
    });
    downloadBytes(`${project.id}-arkem-x-proje-zekasi.pdf`, bytes, "application/pdf");
  };

  return <section className={`project-intelligence${compact ? " compact" : ""}`} data-testid="project-intelligence">
    <header className="intelligence-head">
      <div><span>ARKEMX / PROJECT INTELLIGENCE</span><h2>Proje verisini ölçün.<br/><em>Bir sonraki kararı görün.</em></h2></div>
      <p>Mevcut proje oturumunu, elinizdeki kanıtları ve yatırım önceliğini birlikte değerlendirir; teknik ayrıntıyı saklamadan yönetilebilir bir karar görünümüne dönüştürür.</p>
    </header>

    <div className="intelligence-console">
      <aside className="intelligence-controls">
        <label><span>01 / PROJE AŞAMASI</span><select value={stage} onChange={(event) => { setStage(event.target.value as typeof stage); setSaved(false); }}>{stageOptions.map((item) => <option value={item[0]} key={item[0]}>{item[1]}</option>)}</select></label>
        <fieldset><legend>02 / KARAR ODAĞI</legend>{objectives.map((item) => <button type="button" className={objective === item[0] ? "active" : ""} onClick={() => { setObjective(item[0]); setSaved(false); }} key={item[0]}><b>{item[1]}</b><small>{item[2]}</small></button>)}</fieldset>
        <fieldset className="intelligence-evidence"><legend>03 / ELİNİZDEKİ KANITLAR</legend>{evidenceOptions.map((item) => <button type="button" className={evidence.includes(item[0]) ? "active" : ""} onClick={() => toggleEvidence(item[0])} key={item[0]}><i>{evidence.includes(item[0]) ? <Check size={13}/> : item[2]}</i><b>{item[1]}</b></button>)}</fieldset>
      </aside>

      <div className="intelligence-workspace">
        <nav aria-label="Proje zekâsı görünümleri">
          {(["executive", "evidence", "route", "deliverables"] as IntelligenceView[]).map((item) => <button type="button" className={view === item ? "active" : ""} onClick={() => setView(item)} key={item}>{item === "executive" ? "Yönetici özeti" : item === "evidence" ? "Kanıt & risk" : item === "route" ? "Modül rotası" : "Teslim paketi"}</button>)}
        </nav>

        {view === "executive" && <div className="intelligence-executive">
          <div className={`intelligence-score ${intelligence.gateTone}`}>
            <span>PROJE HAZIRLIĞI</span><strong>{intelligence.readiness}<small>/100</small></strong><i><b style={{ width: `${intelligence.readiness}%` }}/></i><em>{intelligence.gate}</em>
          </div>
          <div className="intelligence-kpis">
            <article><Activity size={17}/><span>Karar güveni</span><b>%{intelligence.confidence}</b><small>Girdi ve bağlı modül verisine göre</small></article>
            <article><Radar size={17}/><span>Belirsizlik</span><b>%{intelligence.uncertainty}</b><small>{intelligence.missing.length} temel veri başlığı açık</small></article>
            <article><ShieldCheck size={17}/><span>Proje zinciri</span><b>{thread.metrics.activeCount}/{thread.metrics.totalCount}</b><small>{thread.metrics.critical} kritik · {thread.metrics.review} inceleme</small></article>
          </div>
          <section className="intelligence-next"><span>ÖNERİLEN SONRAKİ ADIM</span><div><i>{intelligence.modules[0]?.code ?? "PIR"}</i><div><b>{intelligence.modules[0]?.label ?? "Yatırım briefi"}</b><small>{intelligence.modules[0]?.output}</small></div><Link href={intelligence.modules[0]?.route ?? "/proje-baslat"}>Çalışma alanını açın <ArrowRight size={15}/></Link></div></section>
        </div>}

        {view === "evidence" && <div className="intelligence-evidence-view">
          <header><div><CircleAlert size={18}/><span>KANIT TAMLIĞI</span><b>{evidence.length}/{evidenceOptions.length}</b></div><p>Eksik başlıklar belirsizlik olarak tutulur; mevcut olmayan veri üretilmiş veya doğrulanmış gibi gösterilmez.</p></header>
          <div>{evidenceOptions.map((item) => <article className={evidence.includes(item[0]) ? "ready" : ""} key={item[0]}><i>{evidence.includes(item[0]) ? <Check size={14}/> : "—"}</i><div><b>{item[1]}</b><small>{evidence.includes(item[0]) ? "Kullanıcı tarafından mevcut olarak işaretlendi" : "Doğrulama / temin planı gerekli"}</small></div><span>{item[2]}</span></article>)}</div>
        </div>}

        {view === "route" && <div className="intelligence-route">
          <header><span>ÖNERİLEN TEKNİK ROTA</span><p>{intelligence.priority} odağında önceliklendirildi.</p></header>
          <div>{intelligence.modules.map((module, index) => <article key={module.id}><i>{String(index + 1).padStart(2, "0")}</i><span>{module.code}</span><div><b>{module.label}</b><small>{module.discipline} · {module.output}</small></div><Link href={module.route}><ArrowRight size={15}/></Link></article>)}</div>
        </div>}

        {view === "deliverables" && <div className="intelligence-deliverables">
          <header><FileCheck2 size={19}/><div><span>KURUMSAL KARAR DOSYASI</span><h3>Teknik başlangıç paketi</h3></div></header>
          <div>{["Proje hazırlık ve güven göstergesi","Eksik veri ve doğrulama listesi","Önerilen ARKEMX modül rotası","Karar kapısı ve yetki sınırı","Proje kimliği ve revizyon kaydı"].map((item, index) => <p key={item}><i>0{index + 1}</i><b>{item}</b><Check size={14}/></p>)}</div>
          <button type="button" onClick={exportPdf}><Download size={16}/> Kurumsal PDF karar dosyasını indirin</button>
        </div>}

        <footer className="intelligence-actions">
          <button type="button" onClick={saveSnapshot}><ShieldCheck size={15}/>{saved ? "Proje çekirdeğine kaydedildi" : "Değerlendirmeyi proje çekirdeğine kaydet"}</button>
          <Link href="/dijital-proje-merkezi">Prototip proje veri grafiği <ArrowRight size={15}/></Link>
        </footer>
      </div>
    </div>
  </section>;
}
