"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { PROJECT_MODULES } from "../lib/project-graph";
import { downloadTextFile } from "../lib/engineering";
import { createDeliveryReadiness, createWorkingDeliveryManifest } from "../lib/delivery-readiness";
import { ProjectCoreRegistry } from "./ProjectCoreRegistry";
import { deriveProjectJourneyState, PROJECT_JOURNEY, ProjectKernelBar, useProjectKernel } from "./ProjectKernel";

type View = "control" | "journey" | "graph" | "federated" | "rules" | "history";
const stages = ["Tanım", "Arsa", "Tasarım", "Koordinasyon", "Teslim"] as const;

export function DigitalProjectHub({ simple = false }: { simple?: boolean } = {}) {
  const { project, thread, core, importProject, setExperience, applyHandoff, synchronizeProject } = useProjectKernel();
  const [view, setView] = useState<View>("control");
  const [notice, setNotice] = useState("Yerel proje oturumu bağlı");
  const fileRef = useRef<HTMLInputElement>(null);
  const deliveryGate = createDeliveryReadiness({
    projectId: project.id,
    projectRevision: project.revision,
    projectName: project.name,
    projectPhase: project.phase,
    modules: project.modules,
    threadIssues: thread.issues,
  });

  const loadProject = async (file?: File) => {
    if (!file) return;
    try {
      const accepted = importProject(JSON.parse(await file.text()));
      setNotice(accepted ? `${file.name} proje zincirine yüklendi` : "Dosya ARKEM-PROJECT/1.0 sözleşmesine uymuyor");
    } catch {
      setNotice("Dosya okunamadı veya geçerli JSON değil");
    }
    if (fileRef.current) fileRef.current.value = "";
  };

  const canonicalSections = [
    { code: "GIS", label: "Parsel & planlama", values: [["Parsel", thread.canonical.site.reference], ["Kaynak / CRS", `${thread.canonical.site.dataStatus} · ${thread.canonical.site.crs}`], ["Parsel alanı", `${thread.canonical.site.parcelArea.toFixed(1)} m²`], ["Öneri / izin brüt", `${thread.canonical.site.proposedGross.toFixed(1)} / ${thread.canonical.site.allowedGross.toFixed(1)} m²`]] },
    { code: "ARC", label: "Mimari model", values: [["Kullanım", thread.canonical.architecture.use || "—"], ["Kat / yükseklik", `${thread.canonical.architecture.floors || "—"} / ${thread.canonical.architecture.floorHeight.toFixed(2)} m`], ["Net / brüt", `${thread.canonical.architecture.netArea.toFixed(1)} / ${thread.canonical.architecture.grossArea.toFixed(1)} m²`], ["Kullanıcı / günışığı", `${thread.canonical.architecture.occupants || "—"} / %${thread.canonical.architecture.daylightCoverage.toFixed(0)}`]] },
    { code: "STR", label: "Taşıyıcı model", values: [["Sistem", thread.canonical.structure.system || "—"], ["Aks", `${thread.canonical.structure.baysX || "—"} × ${thread.canonical.structure.baysY || "—"}`], ["Açıklık", `${thread.canonical.structure.spanX.toFixed(2)} × ${thread.canonical.structure.spanY.toFixed(2)} m`], ["Beton / çelik", `${thread.canonical.structure.concreteVolume.toFixed(1)} m³ / ${thread.canonical.structure.steelTonnage.toFixed(1)} t`]] },
    { code: "ICE", label: "Koordinasyon", values: [["Net tavan", `${thread.canonical.coordination.clearHeight.toFixed(2)} m`], ["Şaft rezervi", `%${thread.canonical.coordination.shaftRatio.toFixed(2)}`], ["Zemin göstergesi", `%${thread.canonical.coordination.bearingUtilization.toFixed(0)}`], ["Açık issue", `${thread.canonical.coordination.openIssues}`]] },
    { code: "CDE", label: "Teslim & yönetim", values: [["Bilgi olgunluğu", `%${thread.canonical.delivery.informationMaturity}`], ["Aktif yetkinlik", `${thread.canonical.delivery.activeCapabilities}/6`], ["Proje sağlığı", `%${thread.canonical.delivery.projectHealth}`], ["Proje OS", thread.canonical.delivery.status]] },
  ];
  const journeySummaries = [
    `${project.name} · ${project.phase}`,
    thread.canonical.site.parcelArea > 0 ? `${thread.canonical.site.reference} · ${thread.canonical.site.parcelArea.toLocaleString("tr-TR", { maximumFractionDigits: 0 })} m²` : "Parsel sınırı ve kaynak doğrulaması bekleniyor",
    thread.canonical.architecture.grossArea > 0 ? `${thread.canonical.architecture.grossArea.toLocaleString("tr-TR", { maximumFractionDigits: 0 })} m² · ${thread.canonical.architecture.floors} kat` : "Mahal, alan ve plaka programı bekleniyor",
    thread.canonical.structure.system ? `${thread.canonical.structure.system} · ${thread.canonical.structure.baysX || "—"}×${thread.canonical.structure.baysY || "—"} aks` : "Sistem karşılaştırması ve aks kararı bekleniyor",
    `${thread.metrics.critical} kritik · ${thread.metrics.review} inceleme kaydı`,
    thread.canonical.delivery.projectHealth > 0 ? `%${thread.canonical.delivery.projectHealth} proje sağlığı` : "Program, bütçe ve karar kayıtları bekleniyor",
    thread.canonical.delivery.informationMaturity > 0 ? `%${thread.canonical.delivery.informationMaturity} bilgi olgunluğu` : "Onaylı teslim paketi henüz oluşmadı",
  ];
  const journeyState = deriveProjectJourneyState(thread);
  const completedJourney = journeyState.completed;
  const currentJourneyIndex = journeyState.currentIndex;
  const systemDecisionReady = journeyState.systemDecisionReady;
  const journeyNextAction = {
    label: journeyState.nextStep.label,
    route: journeyState.nextStep.href,
  };

  const synchronize = () => {
    const count = synchronizeProject();
    setNotice(count ? `${count} veri devir-teslimi aynı proje revizyonunda güncellendi` : "Aktarılabilecek kaynak modül henüz oluşmadı");
  };

  const projectOutputs = [
    { code: "BRF", label: "Yatırım ve karar briefi", ready: Boolean(project.modules["decision-assistant"]), format: "JSON / PDF" },
    { code: "GIS", label: "Parsel, koordinat ve yerleşim verisi", ready: thread.canonical.site.parcelArea > 0, format: "DXF / KML / GEOJSON" },
    { code: "ARC", label: "Mimari program ve mahal kaydı", ready: thread.canonical.architecture.grossArea > 0, format: "CSV / JSON" },
    { code: "STR", label: "Taşıyıcı sistem ön değerlendirmesi", ready: systemDecisionReady, format: "PDF / DXF" },
    { code: "ICE", label: "Disiplin koordinasyon ve issue kaydı", ready: thread.canonical.coordination.openIssues > 0 || Boolean(project.modules["engineering-coordination"]), format: "CSV / BCF-LIKE" },
    { code: "CDE", label: "Dijital teslim ve proje pasaportu", ready: deliveryGate.workingExportEligible, format: deliveryGate.officialReleaseEligible ? "RESMÎ TESLİM" : "ÇALIŞMA MANİFESTOSU" },
  ];
  const readyOutputs = projectOutputs.filter((item) => item.ready).length;
  const readinessRows = PROJECT_JOURNEY.map((step, index) => ({
    ...step,
    ready: completedJourney[index],
    summary: journeySummaries[index],
  }));

  const exportExecutivePackage = () => {
    downloadTextFile(`${project.id}-${project.revision}-arkem-x-proje-paketi.json`, JSON.stringify({
      schema: "ARKEM-X-EXECUTIVE-PACKAGE/1.0",
      generatedAt: new Date().toISOString(),
      identity: {
        id: project.id,
        name: project.name,
        revision: project.revision,
        phase: project.phase,
        coordinateReference: project.coordinateReference,
      },
      readiness: {
        project: thread.metrics.readiness,
        quality: thread.metrics.quality,
        outputs: `${readyOutputs}/${projectOutputs.length}`,
      },
      nextAction: journeyNextAction,
      canonical: thread.canonical,
      projectCore: core,
      issues: thread.issues,
      outputs: projectOutputs,
      eventLog: project.events,
      boundary: "Ön değerlendirme ve veri koordinasyon paketidir; yetkili proje, resmî onay veya uygulama projesi değildir.",
    }, null, 2), "application/json");
    setNotice("Kurumsal proje çalışma paketi indirildi");
  };

  const exportWorkingDelivery = () => {
    const manifest = createWorkingDeliveryManifest({
      projectId: project.id,
      projectRevision: project.revision,
      projectName: project.name,
      projectPhase: project.phase,
      modules: project.modules,
      threadIssues: thread.issues,
    });
    downloadTextFile(`${project.id}-${project.revision}-CALISMA-TESLIM-MANIFESTOSU.json`, JSON.stringify(manifest, null, 2), "application/json");
    setNotice("Çalışma teslim manifestosu indirildi · resmî/onaylı teslim değildir");
  };

  const exportReadinessCsv = () => {
    const rows = [
      ["sira", "asama", "durum", "beklenen_cikti", "mevcut_ozet"],
      ...readinessRows.map((row, index) => [
        String(index + 1),
        row.label,
        row.ready ? "hazir" : "bekliyor",
        row.output,
        row.summary,
      ]),
    ];
    const csv = rows.map((row) => row.map((value) => `"${String(value).replaceAll("\"", "\"\"")}"`).join(",")).join("\r\n");
    downloadTextFile(`${project.id}-${project.revision}-hazirlik-matrisi.csv`, `\ufeff${csv}`, "text/csv;charset=utf-8");
    setNotice("Hazırlık matrisi düzenli CSV olarak indirildi");
  };

  if (simple) {
    const priorityIssues = [...thread.issues]
      .sort((left, right) => {
        const priority = { critical: 0, review: 1, info: 2 } as const;
        return priority[left.severity] - priority[right.severity];
      })
      .slice(0, 5);
    const recentEvents = [...project.events].reverse().slice(0, 6);

    return <section className="arx-advanced-hub" data-testid="digital-project-hub">
      <header className="arx-advanced-head">
        <div>
          <h3>Proje kontrol özeti</h3>
          <p>Eksik adımlar, açık konular ve teslim hazırlığını tek görünümde kontrol edin.</p>
        </div>
        <div className="arx-advanced-head-actions">
          <button type="button" onClick={synchronize}>Hazır veriyi senkronize et</button>
          <button type="button" onClick={exportExecutivePackage}>Proje paketini indir</button>
        </div>
      </header>

      {notice ? <p className="arx-advanced-notice" role="status">{notice}</p> : null}

      <div className="arx-advanced-metrics">
        <article><span>VERİ HAZIRLIĞI</span><b>%{thread.metrics.readiness}</b><small>{thread.metrics.activeCount}/{thread.metrics.totalCount} veri alanı bağlı</small></article>
        <article><span>KONTROL KONUSU</span><b className={thread.metrics.critical ? "risk" : ""}>{thread.issues.length}</b><small>{thread.metrics.critical} kritik · {thread.metrics.review} inceleme</small></article>
        <article><span>TEKNİK ÇIKTI</span><b>{readyOutputs}/{projectOutputs.length}</b><small>paket için kaynak veri mevcut</small></article>
        <article><span>TESLİM DURUMU</span><b className={deliveryGate.officialReleaseEligible ? "good" : "watch"}>{deliveryGate.officialReleaseEligible ? "Hazır" : "Kontrol"}</b><small>resmî yayın kapısı</small></article>
      </div>

      <div className="arx-advanced-layout">
        <section className="arx-advanced-panel" aria-labelledby="arx-readiness-title">
          <header><h4 id="arx-readiness-title">Proje adımları</h4><span>Sıradaki: {journeyNextAction.label}</span></header>
          <div className="arx-advanced-readiness">
            {readinessRows.map((row, index) => <article key={row.href} className={row.ready ? "ready" : ""}>
              <i>{row.ready ? "✓" : String(index + 1).padStart(2, "0")}</i>
              <div><b>{row.label}</b><small>{row.summary}</small></div>
              <span>{row.ready ? "Hazır" : "Bekliyor"}</span>
            </article>)}
          </div>
          <footer><Link href={journeyNextAction.route}>Sıradaki çalışmayı aç →</Link></footer>
        </section>

        <section className="arx-advanced-panel" aria-labelledby="arx-issues-title">
          <header><h4 id="arx-issues-title">Açık konular</h4><span>{thread.issues.length} kayıt</span></header>
          <div className="arx-advanced-issues">
            {priorityIssues.map((issue) => <article className={issue.severity} key={issue.id}>
              <i>{issue.severity === "critical" ? "!" : issue.severity === "review" ? "?" : "i"}</i>
              <div>
                <b>{issue.title}</b>
                <small>{issue.id} · {issue.discipline}</small>
                <p>{issue.evidence}</p>
                <em className="arx-issue-recommendation">Önerilen düzeltme: {issue.action}</em>
              </div>
              <div className="arx-issue-actions">
                <Link href={issue.route}>{issue.routeLabel ?? "Aç"}</Link>
                {issue.secondaryRoute ? <Link className="secondary" href={issue.secondaryRoute}>{issue.secondaryRouteLabel ?? "Kaynağı incele"}</Link> : null}
              </div>
            </article>)}
            {!priorityIssues.length ? <p className="arx-advanced-empty">Aktif proje verisinde açık kontrol konusu görünmüyor.</p> : null}
          </div>
        </section>
      </div>

      <details className="arx-advanced-detail">
        <summary>Teslim hazırlığı ve teknik çıktılar</summary>
        <div className="arx-advanced-delivery" data-testid="delivery-release-gate" data-state={deliveryGate.state}>
          <div className="arx-advanced-delivery-status">
            <span>Resmî/onaylı teslim</span>
            <b>{deliveryGate.officialReleaseEligible ? "Uygun" : "Uygun değil"}</b>
            <small>Çalışma manifestosu: {deliveryGate.workingExportEligible ? "üretilebilir" : "bekliyor"}</small>
          </div>
          {deliveryGate.blockingIssues.length > 0 ? <div className="arx-advanced-blockers" data-testid="delivery-active-blockers">
            <b>Bloke eden konular</b>
            {deliveryGate.blockingIssues.slice(0, 5).map((issue) => <p key={issue.source + issue.id}>{issue.id} · {issue.title}</p>)}
          </div> : null}
          <div className="arx-advanced-outputs">
            {projectOutputs.map((output) => <article key={output.code}>
              <i>{output.code}</i><span><b>{output.label}</b><small>{output.format}</small></span><strong>{output.ready ? "Hazır" : "Bekliyor"}</strong>
            </article>)}
          </div>
          <div className="arx-advanced-delivery-actions">
            <button type="button" onClick={exportReadinessCsv}>Hazırlık CSV indir</button>
            <button type="button" data-testid="working-delivery-export" onClick={exportWorkingDelivery}>Çalışma teslim manifestosu</button>
            <button type="button" data-testid="official-delivery-release" disabled={!deliveryGate.officialReleaseEligible}>Resmî teslimi yayımla</button>
          </div>
          <small className="arx-advanced-boundary">Elektronik imza, yetkili belge doğrulaması ve kurumsal CDE onayı yapılandırılmadan bu kayıt resmî teslim yetkisi oluşturmaz.</small>
        </div>
      </details>

      <details className="arx-advanced-detail">
        <summary>Son proje işlemleri</summary>
        <div className="arx-advanced-history">
          {recentEvents.map((event, index) => {
            const definition = PROJECT_MODULES.find((item) => item.id === event.module);
            return <article key={event.id + "-" + index}>
              <i>{event.action === "create" ? "+" : event.action === "remove" ? "×" : event.action === "import" ? "↑" : event.action === "handoff" ? "⇄" : "↻"}</i>
              <div><b>{definition?.label ?? event.module}</b><small>{event.revision} · {new Date(event.timestamp).toLocaleString("tr-TR")}</small></div>
            </article>;
          })}
          {!recentEvents.length ? <p className="arx-advanced-empty">Henüz proje işlemi kaydı yok.</p> : null}
        </div>
      </details>
    </section>;
  }

  return <section className="digital-hub" data-testid="digital-project-hub">
    <ProjectKernelBar module="ORTAK PROJE VERİ ZİNCİRİ" confidence="Geliştirme prototipi / çapraz disiplin" />
    <header className="digital-hub-head"><div><p className="eyebrow light">ARKEMX Prototip Proje Veri Alanı</p><h2>Bağlı çalışma alanları.<br/><em>Ortak proje kimliği.</em></h2></div><p>Her çalışma alanı kendi veri sorumluluğunu korur; ortak proje çekirdeği alan, kat, aks, sistem, miktar, sorun ve teslim verisini kaynak–revizyon iziyle ilişkilendirmeyi araştırır.</p><div className="hub-file-control"><span>OTURUM / DOSYA</span><b>{notice}</b><button onClick={() => fileRef.current?.click()}>Proje JSON yükle ↑</button><input ref={fileRef} className="sr-only" type="file" accept="application/json,.json" onChange={(event) => loadProject(event.target.files?.[0])}/></div></header>
    <div className="digital-hub-metrics"><article><span>BAĞLI VERİ ALANI</span><strong>{thread.metrics.activeCount}<small>/ {thread.metrics.totalCount}</small></strong><i style={{ "--value": `${thread.metrics.readiness}%` } as React.CSSProperties}></i><b>%{thread.metrics.readiness} veri zinciri</b></article><article><span>MODEL KALİTESİ</span><strong>{thread.metrics.quality}<small>/ 100</small></strong><i style={{ "--value": `${thread.metrics.quality}%` } as React.CSSProperties}></i><b>Kural tabanlı gösterge</b></article><article><span>KOORDİNASYON</span><strong className={thread.metrics.critical ? "risk" : "good"}>{thread.metrics.critical}<small>kritik</small></strong><b>{thread.metrics.review} inceleme · {thread.issues.length} toplam</b></article><article><span>SONRAKİ AKIŞ</span><strong className="next">{journeyNextAction.label}</strong><Link href={journeyNextAction.route}>Çalışma alanını aç ↗</Link></article></div>
    <div className="digital-hub-workspace"><header><nav aria-label="Proje merkezi görünümleri">{(["control", "journey", "graph", "federated", "rules", "history"] as View[]).map((item) => <button type="button" role="tab" aria-selected={view === item} key={item} className={view === item ? "active" : ""} onClick={() => setView(item)}>{item === "control" ? "Proje kontrol merkezi" : item === "journey" ? "Yönlendirmeli akış" : item === "graph" ? "Proje veri haritası" : item === "federated" ? "Federasyon verisi" : item === "rules" ? `Kural / konu (${thread.issues.length})` : `Revizyon izi (${project.events.length})`}</button>)}</nav><span>{project.id} · {project.revision} · {project.phase}</span></header>
      {view === "control" && <div className="hub-control-center">
        <ProjectCoreRegistry compact />
        <section className="hub-control-main">
          <header><div><span>PROJE HAZIRLIK MATRİSİ</span><h3>Ne tamamlandı,<br/>sırada ne var?</h3></div><strong>%{thread.metrics.readiness}</strong></header>
          <div className="hub-readiness-grid">{readinessRows.map((row, index) => <article className={row.ready ? "ready" : ""} key={row.href}><i>{row.ready ? "✓" : String(index + 1).padStart(2, "0")}</i><div><b>{row.label}</b><small>{row.summary}</small></div><span>{row.ready ? "HAZIR" : "BEKLİYOR"}</span></article>)}</div>
          <div className="hub-control-recommendation"><i>→</i><div><b>Önerilen sonraki çalışma: {journeyNextAction.label}</b><small>Mevcut proje verisi ve eksik bağlantılar üzerinden belirlenir.</small></div><Link href={journeyNextAction.route}>Çalışmayı aç ↗</Link></div>
        </section>
        <aside className="hub-control-side">
          <header><div><span>VERİ DEVİR TESLİMİ / TEKNİK ÇIKTI KAYDI</span><h3>{readyOutputs}/{projectOutputs.length} paket hazır</h3></div></header>
          <div className="hub-output-register">{projectOutputs.map((output) => <article key={output.code}><i>{output.code}</i><div><b>{output.label}</b><small>{output.ready ? "Kaynak veri proje çekirdeğinde mevcut" : "İlgili modül verisi bekleniyor"}</small></div><span>{output.format}</span></article>)}</div>
          <section className="hub-delivery-gate" data-testid="delivery-release-gate" data-state={deliveryGate.state}>
            <header><span>V117 / TESLİM YAYIN KAPISI</span><b>{deliveryGate.officialReleaseEligible ? "RESMÎ YAYIN UYGUN" : deliveryGate.state === "critical-blocked" ? "KRİTİK BLOKAJ" : "İNCELEME GEREKLİ"}</b></header>
            <p>Resmî/onaylı teslim: <strong>{deliveryGate.officialReleaseEligible ? "UYGUN" : "UYGUN DEĞİL"}</strong> · Çalışma manifestosu: <strong>{deliveryGate.workingExportEligible ? "ÜRETİLEBİLİR" : "BEKLİYOR"}</strong></p>
            {deliveryGate.blockingIssues.length > 0 && <div className="hub-delivery-blockers" data-testid="delivery-active-blockers">{deliveryGate.blockingIssues.map((issue) => <p key={issue.source + issue.id}><b>{issue.source}</b> · {issue.id} · {issue.title}</p>)}</div>}
            {deliveryGate.reviewIssues.length > 0 && <div className="hub-delivery-reviews" data-testid="delivery-review-issues"><b>AÇIK İNCELEME KONULARI</b>{deliveryGate.reviewIssues.map((issue) => <p key={issue.source + issue.id}>{issue.id} · {issue.title}</p>)}</div>}
            <div>{deliveryGate.checks.map((check) => <article key={check.code} data-status={check.status}><i>{check.code}</i><span><b>{check.label}</b><small>{check.detail}</small></span><strong>{check.status === "blocked" ? "BLOKE" : check.status === "missing" ? "EKSİK" : "İNCELE"}</strong></article>)}</div>
            <small>Elektronik imza, yetkili belge doğrulaması ve sunucu tabanlı CDE onayı yapılandırılmadığı için kullanıcı girdileri veya kayıtlı statüler resmî teslim yetkisi oluşturmaz.</small>
          </section>
          <div className="hub-control-actions"><button type="button" className="primary" onClick={exportExecutivePackage}>Proje paketini indir ↓</button><button type="button" onClick={exportReadinessCsv}>Hazırlık matrisini indir ↓</button><button type="button" data-testid="working-delivery-export" onClick={exportWorkingDelivery}>Çalışma teslim manifestosu ↓</button><button type="button" data-testid="official-delivery-release" disabled={!deliveryGate.officialReleaseEligible}>Resmî teslimi yayımla</button></div>
        </aside>
      </div>}
      {view === "journey" && <div className="hub-journey">
        <header className="hub-journey-command">
          <div><span>ARKEMX PROJE REHBERİ</span><h3>Bir sonraki doğru adım,<br/><em>mevcut verinizden belirlenir.</em></h3><p>Yönlendirmeli mod teknik ayrıntıyı saklamaz; karar için gerekli bilgiyi öne çıkarır ve üretilen veriyi sonraki çalışma alanına hazır taşır.</p></div>
          <aside><span>KULLANIM DÜZEYİ</span><div><button className={project.experience.mode === "guided" ? "active" : ""} onClick={() => setExperience({ mode: "guided", autoHandoff: true })}>Yönlendirmeli</button><button className={project.experience.mode === "technical" ? "active" : ""} onClick={() => setExperience({ mode: "technical" })}>Teknik</button></div><label><input type="checkbox" checked={project.experience.autoHandoff} onChange={(event) => setExperience({ autoHandoff: event.target.checked })}/><span>Modüller arasında otomatik veri aktarımı</span></label><button className="hub-sync-all" onClick={synchronize}>Tüm hazır veriyi senkronize et <i>↻</i></button><small>{project.experience.lastSynchronizedAt ? `Son aktarım · ${new Date(project.experience.lastSynchronizedAt).toLocaleString("tr-TR")}` : "İlk aktarım proje verisi oluştukça çalışır"}</small></aside>
        </header>
        <div className="hub-journey-steps">{PROJECT_JOURNEY.map((step, index) => {
          const completed = completedJourney[index];
          const active = index === currentJourneyIndex;
          return <article className={`${completed ? "completed " : ""}${active ? "active" : ""}`.trim()} key={step.href}>
            <i>{completed ? "✓" : String(index + 1).padStart(2, "0")}</i>
            <div><span>{step.short.toUpperCase()}</span><h4>{step.label}</h4><p>{journeySummaries[index]}</p><small>ÇIKTI · {step.output}</small></div>
            <Link href={step.href}>{completed ? "Çalışmayı aç" : active ? "Bu adımı başlat" : "Adımı incele"} <b>↗</b></Link>
          </article>;
        })}</div>
        <section className="hub-transfer-ledger"><header><div><span>CANLI VERİ DEVİR TESLİMİ</span><h3>Altı entegrasyon sözleşmesi</h3></div><p>Kaynak verisi değiştiğinde, aşağıdaki sözleşmeler hedef modülün ilgili alanlarını günceller; hedefe özgü kullanıcı kararlarını korur.</p></header><div>{thread.handoffs.map((handoff) => {
          const sourceReady = thread.nodes.some((node) => node.id === handoff.source && node.active);
          return <article className={handoff.state} key={handoff.id}><i>{handoff.id}</i><div><b>{handoff.label}</b><small>{handoff.payload.join(" · ")}</small></div><span>{sourceReady ? handoff.state === "conflict" ? "Kontrol gerekli" : "Kaynak hazır" : "Kaynak bekleniyor"}</span><button disabled={!sourceReady} onClick={() => { const applied = applyHandoff(handoff.id); setNotice(applied ? `${handoff.label} güncellendi` : `${handoff.label} için kaynak verisi bekleniyor`); }}>{sourceReady ? "Şimdi aktar" : "Bekliyor"} ↻</button></article>;
        })}</div></section>
      </div>}
      {view === "graph" && <div className="hub-graph"><div className="hub-stage-row">{stages.map((stage) => <section key={stage}><header><span>{String(stages.indexOf(stage) + 1).padStart(2, "0")}</span><b>{stage}</b><small>{thread.nodes.filter((node) => node.stage === stage && node.active).length}/{thread.nodes.filter((node) => node.stage === stage).length} aktif</small></header><div>{thread.nodes.filter((node) => node.stage === stage).map((node) => <Link href={node.route} className={`${node.active ? "active" : ""}${node.blockedBy.length ? " blocked" : ""}`} key={node.id}><i>{node.code}</i><span><b>{node.label}</b><small>{node.discipline}</small></span><strong>{node.active ? node.blockedBy.length ? "KAYIT / BAĞ EKSİK" : "BAĞLI" : node.blockedBy.length ? `${node.blockedBy.length} GİRDİ BEKLİYOR` : "BAŞLAT"}</strong><em>{node.output}</em></Link>)}</div></section>)}</div><div className="hub-handoffs"><header><span>VERİ DEVİR TESLİMİ</span><b>Kaynak → hedef / aktarılan sözleşme</b></header>{thread.handoffs.map((handoff) => <article className={handoff.state} key={handoff.id}><i>{handoff.state === "ready" ? "✓" : handoff.state === "conflict" ? "!" : "…"}</i><div><b>{handoff.label}</b><small>{handoff.payload.join(" · ")}</small></div><span>{handoff.state === "ready" ? "AKTARIM HAZIR" : handoff.state === "conflict" ? "ÇELİŞKİYİ İNCELE" : "KAYNAK / HEDEF BEKLİYOR"}</span></article>)}</div></div>}
      {view === "federated" && <div className="hub-federated"><header><div><span>KANONİK PROJE ANLIK GÖRÜNTÜSÜ</span><b>Uygulamalar arasında son geçerli değer seçimi</b></div><p>Değerler kaynağı değiştirmez; proje zinciri plan, mimari, statik ve GIS kayıtlarını karşılaştırarak ortak karar görünümü üretir.</p></header><div>{canonicalSections.map((section) => <article key={section.code}><header><i>{section.code}</i><b>{section.label}</b></header>{section.values.map(([label, value]) => <p key={label}><span>{label}</span><strong>{value}</strong></p>)}</article>)}</div><footer><span>VERİ SAHİPLİĞİ</span><p>GIS → koordinat/parsel · Mimari → kullanım/program · Statik → yük/kesit · MEP → servis/şaft · PM → durum/onay. Federasyon görünümü disiplin sorumluluğunu devralmaz.</p></footer></div>}
      {view === "rules" && <div className="hub-rules"><header><div><span>ÇAPRAZ DİSİPLİN KURAL MOTORU</span><b>Alan · kat · yükseklik · aks · sistem · performans</b></div><div><b>{thread.metrics.critical} kritik</b><span>{thread.metrics.review} inceleme</span></div></header>{thread.issues.map((issue) => <article className={issue.severity} key={issue.id}><i>{issue.severity === "critical" ? "×" : issue.severity === "review" ? "!" : "i"}</i><div><span>{issue.id} · {issue.discipline}</span><h3>{issue.title}</h3><p>{issue.evidence}</p><small>ÖNERİLEN AKSİYON · {issue.action}</small></div><div className="hub-rule-actions"><Link href={issue.route}>{issue.routeLabel ?? "Kaynak uygulamayı aç"} ↗</Link>{issue.secondaryRoute ? <Link href={issue.secondaryRoute}>{issue.secondaryRouteLabel ?? "Kaynağı incele"} ↗</Link> : null}</div></article>)}{!thread.issues.length && <div className="hub-empty"><b>Aktif veriler arasında çelişki görünmüyor.</b><p>Bu sonuç teknik onay değildir; yeni disiplin kayıtları geldikçe kural seti tekrar çalışır.</p></div>}</div>}
      {view === "history" && <div className="hub-history"><header><div><span>REVİZYON / OLAY GÜNLÜĞÜ</span><b>Son 80 yerel modül işlemi</b></div><small>Sunucu tabanlı CDE denetim izi değildir</small></header>{[...project.events].reverse().map((event, index) => { const definition = PROJECT_MODULES.find((item) => item.id === event.module); return <article key={`${event.id}-${index}`}><i>{event.action === "create" ? "+" : event.action === "remove" ? "×" : event.action === "import" ? "↑" : event.action === "handoff" ? "⇄" : "↻"}</i><span><b>{definition?.label ?? event.module}</b><small>{event.action === "create" ? "Modül oluşturuldu" : event.action === "remove" ? "Modül kaldırıldı" : event.action === "import" ? "Proje içe aktarıldı" : event.action === "handoff" ? "Modüller arası veri aktarıldı" : "Veri güncellendi"}</small></span><strong>{event.revision}</strong><time>{new Date(event.timestamp).toLocaleString("tr-TR")}</time></article>; })}{!project.events.length && <div className="hub-empty"><b>Henüz revizyon olayı yok.</b><p>Bir teknik uygulamayı açıp veri ürettiğinizde değişiklikler burada görünür.</p></div>}</div>}
    </div>
    <footer className="digital-hub-foot"><b>ARKEM PROJECT THREAD / 1.0</b><p>Bu prototip cihaz içi proje oturumuyla çalışır. Çok kullanıcılı yetki, değiştirilemez denetim izi, sunucu veritabanı, gerçek CDE/IFC/BCF servisleri ve elektronik onay için proje özelinde kurumsal altyapı gerekir.</p></footer>
  </section>;
}

export function DigitalThreadBanner() {
  const { thread } = useProjectKernel();
  return <section className="home-thread-banner"><div className="shell">
    <header><div><p className="eyebrow light">ARKEMX · Bağlı Proje Zinciri</p><h2>Tek proje verisi.<br/><em>Beş karar aşaması.</em></h2></div><p>Parsel, tasarım, mühendislik, koordinasyon ve teslim verisi aynı proje kaydında ilerler.</p><Link href="/dijital-proje-merkezi">Proje zincirini inceleyin <span>↗</span></Link></header>
    <div className="home-thread-flow">{[{ code: "GIS", label: "Parsel", active: thread.nodes.some((node) => node.id === "geo-parcel" && node.active) },{ code: "ARC", label: "Mimari", active: thread.nodes.some((node) => node.id === "architectural-program" && node.active) },{ code: "STR", label: "Mühendislik", active: thread.nodes.some((node) => node.id === "structural-concept" && node.active) },{ code: "ICE", label: "Koordinasyon", active: thread.nodes.some((node) => node.id === "engineering-coordination" && node.active) },{ code: "CDE", label: "Teslim", active: thread.nodes.some((node) => node.id === "project-os" && node.active) }].map((item, index) => <article className={item.active ? "active" : ""} key={item.code}><span>{String(index + 1).padStart(2, "0")}</span><i>{item.code}</i><b>{item.label}</b><small>{item.active ? "BAĞLI" : "HAZIR"}</small></article>)}</div>
    <aside><strong>%{thread.metrics.readiness}</strong><div><span>veri hazırlığı</span><b>{thread.metrics.activeCount}/{thread.metrics.totalCount} modül</b><small>{thread.metrics.critical} kritik · {thread.metrics.review} inceleme</small></div></aside>
  </div></section>;
}
