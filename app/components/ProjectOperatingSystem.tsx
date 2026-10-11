"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { downloadTextFile } from "../lib/engineering";
import { createProjectOperatingModel, operatingHealthGates, restoreOperatingWorkStates, operatingWorkStateKey, type ProjectOperatingWorkStatus } from "../lib/project-os-2";
import { ProjectKernelBar, useProjectKernel } from "./ProjectKernel";
import { restoreModuleValue, useModuleRestore } from "./useModuleRestore";

import { TrackingRegisterForm, TrackingActionForm, TrackingEvidenceView, TrackingPhaseForm, TrackingProgressForm } from "./TrackingRegisterForms";
import { createTrackingWork, earnedValueFromProgress, restoreRegisterRows, type TrackingPhase, type TrackingProgress, type TrackingDocument, type TrackingDecision, type TrackingWork, type TrackingEvidence, type RegisterDraft } from "../lib/tracking-register";

import { restoreProjectTracking } from "../lib/project-tracking";

type Module = "overview" | "work" | "program" | "documents" | "decisions" | "revisions" | "cost" | "quality" | "supply" | "handover";
type Status = "Onaylı" | "İncelemede" | "Revizyon";

const modules: { id: Module; no: string; short: string; label: string }[] = [
  { id: "overview", no: "01", short: "ÖZ", label: "Genel Bakış" },
  { id: "work", no: "02", short: "İŞ", label: "Görevler" },
  { id: "program", no: "03", short: "4B", label: "4B Program" },
  { id: "documents", no: "04", short: "DK", label: "Dokümanlar" },
  { id: "decisions", no: "05", short: "KR", label: "RFI & Kararlar" },
  { id: "revisions", no: "06", short: "RV", label: "Revizyonlar" },
  { id: "cost", no: "07", short: "₺", label: "Bütçe" },
  { id: "quality", no: "08", short: "KS", label: "Kalite & Saha" },
  { id: "supply", no: "09", short: "TD", label: "Tedarik" },
  { id: "handover", no: "10", short: "TS", label: "Teslim" },
];

const schedule = [
  { name: "Tasarım koordinasyonu", start: 1, end: 8, progress: 100, owner: "Proje" },
  { name: "Ruhsat / onay süreci", start: 4, end: 13, progress: 74, owner: "İşveren" },
  { name: "Çelik imalat modeli", start: 7, end: 15, progress: 62, owner: "BIM" },
  { name: "Temel ve altyapı", start: 11, end: 19, progress: 43, owner: "Saha" },
  { name: "Taşıyıcı imalatı", start: 14, end: 25, progress: 26, owner: "Üretim" },
  { name: "Montaj ve cephe", start: 21, end: 32, progress: 8, owner: "Saha" },
  { name: "Test, kabul ve teslim", start: 31, end: 36, progress: 0, owner: "Tüm ekip" },
];

const initialDocuments: { code: string; title: string; discipline: string; rev: string; status: Status; date: string }[] = [
  { code: "ARK-STR-101", title: "Temel aplikasyon planı", discipline: "Statik", rev: "R03", status: "Onaylı", date: "21.07.2026" },
  { code: "ARK-STL-214", title: "Çelik genel yerleşim", discipline: "Çelik", rev: "R05", status: "İncelemede", date: "22.07.2026" },
  { code: "ARK-ARC-087", title: "Cephe panel modülasyonu", discipline: "Mimari", rev: "R02", status: "Revizyon", date: "20.07.2026" },
  { code: "ARK-MEP-144", title: "Çatı drenaj koordinasyonu", discipline: "MEP", rev: "R01", status: "İncelemede", date: "22.07.2026" },
  { code: "ARK-BIM-031", title: "Koordinasyon modeli", discipline: "BIM", rev: "WIP-08", status: "Onaylı", date: "22.07.2026" },
];

const initialDecisions = [
  { id: "RFI-028", title: "Aks C / makine kaidesi yükü", impact: "Statik tasarım", owner: "İşveren", due: "Bugün", state: "Yanıt bekliyor" },
  { id: "DEC-014", title: "Cephe paneli renk ve doku kararı", impact: "Tedarik + 6 gün", owner: "Mimari", due: "24 Tem", state: "Karar gerekli" },
  { id: "RFI-026", title: "Yangın hattı çelik geçişi", impact: "Koordinasyon", owner: "MEP", due: "25 Tem", state: "Yanıt bekliyor" },
  { id: "DEC-012", title: "Çatı ışıklığı oranı", impact: "Enerji / maliyet", owner: "İşveren", due: "Kapandı", state: "Yanıtlandı" },
];

const supplyItems = [
  { item: "Ana çelik profiller", package: "PKG-01", lead: 18, risk: "Düşük", status: "Sipariş kilitli" },
  { item: "Sandviç cephe paneli", package: "PKG-04", lead: 34, risk: "Yüksek", status: "Teknik onay bekliyor" },
  { item: "Ankraj grupları", package: "PKG-02", lead: 12, risk: "Orta", status: "İmalatta" },
  { item: "Çatı drenaj elemanları", package: "PKG-07", lead: 26, risk: "Orta", status: "Teklif karşılaştırma" },
  { item: "Yükleme kapıları", package: "PKG-09", lead: 42, risk: "Yüksek", status: "Karar gerekli" },
];

const copilotAnswers: Record<string, { title: string; copy: string; actions: string[] }> = {
  risk: { title: "Program riski özeti", copy: "Cephe paneli teknik onayı ve yükleme kapısı kararı kritik yola yaklaşmış durumda. İki karar 48 saat içinde kapanmazsa montaj başlangıcında temsili 4–6 günlük sapma oluşabilir.", actions: ["DEC-014 kararını öne al", "PKG-04 onay toplantısı planla", "Alternatif tedarikçiyi hazır tut"] },
  document: { title: "Doküman tutarlılık kontrolü", copy: "R05 çelik yerleşimi ile R01 çatı drenaj koordinasyonunda aynı aks için açık bir geçiş kararı bulunuyor. İmalata çıkmadan önce RFI-026 ile birlikte kapatılması önerilir.", actions: ["İki modeli aynı görünümde aç", "RFI-026 sorumlusuna hatırlat", "İmalat paketini koşullu beklet"] },
  cost: { title: "Bütçe erken uyarısı", copy: "Onay bekleyen değişikliklerin tamamı kabul edilirse öngörülen maliyet sapması %3,1 olur. En yüksek etki cephe paneli alternatifinde; teknik eşdeğerlik kontrolüyle azaltılabilir.", actions: ["Eşdeğer ürün matrisi oluştur", "Değişiklik gerekçesini bağla", "Nakit akışını güncelle"] },
  quality: { title: "Saha kalite örüntüsü", copy: "Açık kayıtların ikisi aynı cephe aksında yoğunlaşıyor. Fotoğraf ve model konumu birlikte incelendiğinde tekrarlayan montaj toleransı riski görülüyor.", actions: ["Aks C için kontrol noktası aç", "Ekip brifingi oluştur", "Bir sonraki 360° kaydı karşılaştır"] },
};

function StatusPill({ value }: { value: string }) {
  const tone = value.includes("Onay") || value.includes("Yanıtlandı") || value.includes("kilitli") ? "good" : value.includes("Revizyon") || value.includes("Yüksek") || value.includes("gerekli") ? "alert" : "watch";
  return <span className={`os-status ${tone}`}>{value}</span>;
}

export function ProjectOperatingSystem(props: { compact?: boolean; demo?: boolean } = {}) {
  const { project } = useProjectKernel();
  return <ProjectOperatingSystemSession key={project.id} {...props} />;
}

function ProjectOperatingSystemSession({ compact = false, demo = false }: { compact?: boolean; demo?: boolean }) {
  const { patchModule, project, thread } = useProjectKernel();
  const [active, setActive] = useState<Module>("overview");
  const [week, setWeek] = useState(demo ? 17 : 0);
  const [documents, setDocuments] = useState<TrackingDocument[]>(demo ? initialDocuments : []);
  const [docFilter, setDocFilter] = useState<"Tümü" | Status>("Tümü");
  const [decisions, setDecisions] = useState<TrackingDecision[]>(demo ? initialDecisions : []);
  const [qualityOpen, setQualityOpen] = useState<boolean[]>(demo ? [true, true, true, false] : []);
  const [handover, setHandover] = useState<boolean[]>(demo ? [true, true, true, false, false, false] : Array(6).fill(false));
  const [copilot, setCopilot] = useState("risk");
  const [workStates, setWorkStates] = useState<Record<string, ProjectOperatingWorkStatus>>({});
  const [phases, setPhases] = useState<TrackingPhase[]>([]);
  const [progress, setProgress] = useState<TrackingProgress | null>(null);
  const [progressHistory, setProgressHistory] = useState<TrackingProgress[]>([]);
  const [manualWorkItems, setManualWorkItems] = useState<TrackingWork[]>([]);
  const [workClosures, setWorkClosures] = useState<Record<string, TrackingEvidence>>({});
  const [showClosedWork, setShowClosedWork] = useState(false);
  const [pendingAction, setPendingAction] = useState<{ kind: "document" | "decision" | "work"; id: string; title: string; revision: string } | null>(null);
  const [savedWorkItems, setSavedWorkItems] = useState<unknown[]>([]);
  const [operatingGeneratedAt] = useState(() => project.updatedAt);
  const [legacyTrackingSnapshot, setLegacyTrackingSnapshot] = useState<unknown>(null);
  const draftReady = useModuleRestore("project-os", (saved) => {
    if (demo) return;
    const tracking = restoreProjectTracking(saved);
    setWeek(tracking.week);
    if (tracking.current) {
      setPhases(restoreRegisterRows<TrackingPhase>(saved.phases));
      setProgress(restoreModuleValue(saved.progress, null as TrackingProgress | null));
      setProgressHistory(restoreRegisterRows<TrackingProgress>(saved.progressHistory));
      setManualWorkItems(restoreRegisterRows<TrackingWork>(saved.manualWorkItems));
      setWorkClosures(saved.workClosures && typeof saved.workClosures === "object" && !Array.isArray(saved.workClosures) ? saved.workClosures as Record<string, TrackingEvidence> : {});
    }
    setDocuments(restoreRegisterRows<TrackingDocument>(tracking.documents));
    setDecisions(restoreRegisterRows<TrackingDecision>(tracking.decisions));
    setQualityOpen(restoreModuleValue(tracking.qualityOpen, qualityOpen));
    setHandover(tracking.handover);
    setLegacyTrackingSnapshot(tracking.legacyTrackingSnapshot);
    setSavedWorkItems(Array.isArray(saved.workItems) ? saved.workItems : []);
    setWorkStates({});
  });
  const coordinationHandoff = (project.modules["project-os"] as { coordination?: { bimCoordination?: Parameters<typeof createProjectOperatingModel>[0]["bimCoordination"]; issueGate?: { blocked?: boolean; activeCriticalClashes?: number; reviewedCriticalClashes?: number; technicalApproval?: boolean } } } | undefined)?.coordination;
  const handedOffCoordination = coordinationHandoff?.bimCoordination;
  const issueGate = coordinationHandoff?.issueGate;
  const operatingSource = useMemo(() => {
    const input = {
    projectId: project.id,
    projectRevision: project.revision,
    generatedAt: operatingGeneratedAt,
    bimCoordination: handedOffCoordination,
    };
    try { return { model: createProjectOperatingModel(input), error: "" }; }
    catch (error) { return { model: createProjectOperatingModel({ ...input, bimCoordination: undefined }), error: error instanceof Error ? error.message : "Coordination source unsupported" }; }
  }, [handedOffCoordination, operatingGeneratedAt, project.id, project.revision]);
  const operatingModel = operatingSource.model;
  const restoredStates = useMemo(() => restoreOperatingWorkStates(savedWorkItems, [...operatingModel.workItems, ...manualWorkItems]), [savedWorkItems, operatingModel.workItems, manualWorkItems]);
  // A project manager may acknowledge a critical BIM issue, but cannot close
  // a still-active rule without a verified revised model / authorized approval.
  const workItems = useMemo(() => [...operatingModel.workItems, ...manualWorkItems].map((item) => ({
    ...item,
    closure: workClosures[operatingWorkStateKey(item)] ?? (item as TrackingWork).closure,
    status: item.sourceGuid && item.priority === "critical"
      ? (workStates[operatingWorkStateKey(item)] ?? restoredStates[item.id]) === "in-review" ? "in-review" as const : "blocked" as const
      : workStates[operatingWorkStateKey(item)] ?? restoredStates[item.id] ?? item.status,
  })), [operatingModel.workItems, manualWorkItems, workClosures, workStates, restoredStates]);
  const currentModule = modules.find((item) => item.id === active) ?? modules[0];
  const filteredDocuments = docFilter === "Tümü" ? documents : documents.filter((item) => item.status === docFilter);
  const completion = Math.round((handover.filter(Boolean).length / handover.length) * 100);
  const projectHealth = useMemo(() => {
    if (!demo) return null;
    const openDecisions = decisions.filter((item) => item.state !== "Yanıtlandı").length;
    const openQuality = qualityOpen.filter(Boolean).length;
    return Math.max(45, 92 - openDecisions * 3 - openQuality * 2 - thread.metrics.critical * 4 - thread.metrics.review);
  }, [demo, decisions, qualityOpen, thread.metrics.critical, thread.metrics.review]);
  const earnedValue = useMemo(() => {
    if (!demo) {
      try { return earnedValueFromProgress(progress); } catch { return null; }
    }
    const budget = 48.6;
    const planned = 48;
    const actual = 43;
    const actualCost = 21.5;
    const earned = budget * actual / 100;
    const plannedValue = budget * planned / 100;
    const spi = earned / plannedValue;
    const cpi = earned / actualCost;
    return { budget, planned, actual, actualCost, earned, spi, cpi, eac: budget / cpi };
  }, [demo, progress]);

  const currentOperatingModel = { ...operatingModel, workItems, healthGates: operatingHealthGates(workItems, operatingModel.source.coordinationConnected) };
  useEffect(() => { if (!draftReady || demo) return;
    if (operatingSource.error) return;
    patchModule("project-os", { schema: operatingModel.schema, operatingModel: { ...operatingModel, workItems, healthGates: operatingHealthGates(workItems, operatingModel.source.coordinationConnected) }, trackingDataStatus: "project-record", manualWorkItems, workClosures, phases, progress, progressHistory, legacyTrackingSnapshot, week, documents, decisions, workItems, qualityOpen, handover, projectHealth, earnedValue, digitalThread: thread.metrics, status: "v116-project-os-2" });
  }, [draftReady, demo, manualWorkItems, workClosures, phases, progress, progressHistory, legacyTrackingSnapshot, decisions, documents, earnedValue, handover, operatingModel, operatingSource.error, patchModule, projectHealth, qualityOpen, thread.metrics, week, workItems]);

  const indicator = (value: number | null | undefined) => typeof value === "number" ? value.toFixed(2) : "Veri yok";
  const saveProgress = (value: TrackingProgress) => { setProgress(value); setWeek(value.week); setProgressHistory(items => [...items, value]); };
  const approveDocument = (code: string) => {
    const item = documents.find(item => item.code === code);
    if (item) setPendingAction({ kind: "document", id: code, title: `Belge onayı: ${item.title}`, revision: item.rev });
  };
  const closeDecision = (id: string) => {
    const item = decisions.find(item => item.id === id);
    if (item) setPendingAction({ kind: "decision", id, title: `Karar kapanışı: ${item.title}`, revision: project.revision });
  };
  const saveAction = (evidence: TrackingEvidence) => {
    if (!pendingAction) return;
    const { kind, id } = pendingAction;
    if (kind === "document") setDocuments(items => items.map(item => item.code === id ? { ...item, status: "Onaylı", approval: evidence } : item));
    if (kind === "decision") setDecisions(items => items.map(item => item.id === id ? { ...item, state: "Yanıtlandı", resolution: evidence } : item));
    if (kind === "work") {
      const item = workItems.find(item => item.id === id);
      if (!item || (item.sourceGuid && item.priority === "critical")) return;
      const key = operatingWorkStateKey(item);
      setWorkClosures(values => ({ ...values, [key]: evidence }));
      setWorkStates(values => ({ ...values, [key]: "closed" }));
    }
    setPendingAction(null);
  };
  const changeWork = (item: TrackingWork) => {
    if (item.status === "in-review" && !(item.sourceGuid && item.priority === "critical")) {
      setPendingAction({ kind: "work", id: item.id, title: `Görev kapanışı: ${item.title}`, revision: item.revision });
    } else setWorkStates(values => ({ ...values, [operatingWorkStateKey(item)]: item.status === "in-review" ? "blocked" : "in-review" }));
  };
  const addDocument = (draft: RegisterDraft) => {
    if (documents.some(item => item.code === draft.code)) throw new Error("Bu belge kodu zaten kayıtlı.");
    setDocuments(items => [...items, { code: draft.code, title: draft.title, discipline: draft.discipline, rev: draft.revision, status: "İncelemede", date: draft.due, source: draft.source }]);
  };
  const addDecision = (draft: RegisterDraft) => setDecisions(items => [...items, { id: `DEC-${crypto.randomUUID()}`, title: draft.title, owner: draft.owner, due: draft.due, impact: `${draft.impact || "Etki değerlendirilecek"} · ${draft.source} · ${draft.revision}`, state: "Karar gerekli" }]);
  const addWork = (draft: RegisterDraft) => {
    const item = createTrackingWork(draft, `TASK-${crypto.randomUUID()}`);
    setManualWorkItems(items => [...items, item]);
  };
  const exportRegister = () => downloadTextFile("arkem-project-os-register.json", JSON.stringify({ ...currentOperatingModel, trackingDataStatus: demo ? "demo" : "project-record", week, documents, decisions, manualWorkItems, workClosures, phases, progress, progressHistory, supplyItems: demo ? supplyItems : [], qualityOpen, handover, earnedValue }, null, 2), "application/json");

  if (!demo && !draftReady) return <section data-testid="project-operating-system" data-ready="false"><p role="status">Proje takip kaydı yükleniyor…</p></section>;

  if (!demo) {
    const openWork = workItems.filter((item) => item.status !== "closed");
    const openDecisions = decisions.filter((item) => item.state !== "Yanıtlandı");
    const displayedWork = showClosedWork ? workItems : openWork;

    return <section className="arx-tracking-tool" data-testid="project-operating-system" data-ready={draftReady ? "true" : "false"}>
      {operatingSource.error ? <p role="alert">Koordinasyon aktarımı reddedildi: {operatingSource.error}. Aşağıdaki kaynak verisi eksiktir; kaynak kaydı değiştirilmedi.</p> : null}
      <ProjectKernelBar moduleKey="project-os" module="PROJECT DELIVERY OS" confidence="Proje takip kaydı" compact />
      {legacyTrackingSnapshot ? <details data-testid="legacy-tracking"><summary>Önceki sürümün takip verisi — doğrulanacak</summary><p>Örnek verilerle karışmış eski kayıt ayrı saklandı; güncel ilerleme veya onay olarak kullanılmıyor.</p><button type="button" onClick={() => downloadTextFile("legacy-project-tracking.json", JSON.stringify(legacyTrackingSnapshot, null, 2), "application/json")}>Eski takip kaydını indir</button></details> : null}
      <div className="arx-track-grid">
        <section className="arx-track-panel" aria-labelledby="arx-track-work-title">
          <header className="arx-track-head">
            <div><h2 id="arx-track-work-title">Proje durumu ve açık işler</h2><p>Öncelikli işler, kararlar ve program sinyalleri. Ayrıntılar gerektiğinde açılır.</p></div>
            <button type="button" onClick={exportRegister}>Proje kaydını indir</button>
          </header>
          {issueGate?.blocked ? <p className="arx-track-warning" data-testid="project-os-issue-gate">{issueGate.activeCriticalClashes ?? 0} aktif kritik BIM çakışması nedeniyle 4B/5B onay kapısı blokeli. İnceleme işareti teknik çözüm değildir.</p> : null}
          <div className="arx-track-kpis">
            <article><span>PROJE SAĞLIĞI</span><b>—</b><small>Gerçek ilerleme verisi bekleniyor</small></article>
            <article><span>AÇIK İŞ</span><b>{openWork.length}</b><small>{workItems.filter((item) => item.status === "blocked").length} bloke</small></article>
            <article><span>AÇIK KARAR</span><b>{openDecisions.length}</b><small>RFI ve karar kaydı</small></article>
            <article><span>SPI / CPI</span><b>{indicator(earnedValue?.spi)} / {indicator(earnedValue?.cpi)}</b><small>{earnedValue ? "Beyan edilen proje verisinden" : "Program ve maliyet verisi yok"}</small></article>
          </div>
          <TrackingRegisterForm kind="Görev" revision={project.revision} onSave={addWork} />
          <label><input type="checkbox" checked={showClosedWork} onChange={event => setShowClosedWork(event.target.checked)} />Kapalı işleri de göster</label>
          {pendingAction ? <TrackingActionForm key={`${pendingAction.kind}:${pendingAction.id}`} title={pendingAction.title} revision={pendingAction.revision} onSave={saveAction} onCancel={() => setPendingAction(null)} /> : null}
          <div className="arx-track-list">
            {displayedWork.map((item) => <article className={`arx-track-item ${item.status === "blocked" ? "blocked" : ""}`} key={item.id}>
              <div>
                <span>{item.type.toUpperCase()} · {item.id}</span>
                <h3>{item.title}</h3>
                <p>{item.owner}{item.ownerSuggested ? " (öneri)" : ""} · {item.dueDate}{item.dueDateSuggested ? " (önerilen tarih)" : ""} · {item.scheduleImpact} · {item.status === "closed" ? "Kapalı" : item.status === "in-review" ? "İncelemede" : item.status === "blocked" ? "Bloke" : "Açık"}</p>
                {item.status === "closed" ? <TrackingEvidenceView value={item.closure} /> : null}
              </div>
              {item.status !== "closed" ? <button type="button" data-testid={item.sourceGuid && item.priority === "critical" ? "critical-bim-review-action" : undefined} onClick={() => changeWork(item)}>
                {item.sourceGuid && item.priority === "critical" ? item.status === "in-review" ? "İşareti kaldır" : "İncelemeye al" : item.status === "in-review" ? "Kapat" : "İncele"}
              </button> : null}
            </article>)}
            {!displayedWork.length ? <p className="arx-track-empty">Açık iş bulunmuyor.</p> : null}
          </div>
          <details className="arx-track-detail">
            <summary>Kararlar ve RFI ({openDecisions.length} açık)</summary>
            <TrackingRegisterForm kind="Karar" revision={project.revision} onSave={addDecision} />
            <div className="arx-track-decisions">
              {decisions.map((item) => <article className="arx-track-decision" key={item.id}>
                <span>{item.id}</span>
                <div><b>{item.title}</b><small>{item.impact} · {item.owner} · {item.due}</small></div>
                {item.state !== "Yanıtlandı" ? <button type="button" onClick={() => closeDecision(item.id)}>Kararı kapat</button> : <TrackingEvidenceView value={item.resolution} />}
              </article>)}
            </div>
          </details>
          <details className="arx-track-detail">
            <summary>Dokümanlar ({documents.length})</summary>
            <TrackingRegisterForm kind="Belge" revision={project.revision} onSave={addDocument} />
            <div className="arx-track-docs">
              {documents.map((item) => <article className="arx-track-doc" key={item.code}>
                <span>{item.code}</span>
                <div><b>{item.title}</b><small>{item.discipline} · {item.rev} · {item.status} · {item.source || "Kaynak doğrulanacak"}</small></div>
                {item.status !== "Onaylı" ? <button type="button" onClick={() => approveDocument(item.code)}>Onayla</button> : <TrackingEvidenceView value={item.approval} />}
              </article>)}
            </div>
          </details>
          <details className="arx-track-detail">
            <summary>4B program özeti · {phases.length ? `${phases.length} aktivite` : "veri bekleniyor"}</summary>
            <TrackingPhaseForm revision={project.revision} onSave={phase => setPhases(items => [...items, phase])} />
            <div className="arx-track-program"><p>Beyan edilen program kaydı; program onayı ayrıca doğrulanmalı.</p>
              {phases.map((item) => <article key={item.id}>
                <span>{item.name} · {item.start}–{item.end} · {item.source} · {item.revision}</span>
                <i aria-hidden="true"><b style={{ width: item.progress + "%" }} /></i>
                <small>%{item.progress} · {item.owner}</small>
              </article>)}
            </div>
          </details>
        </section>

        <aside className="arx-track-side">
          <section className="arx-track-panel arx-track-summary">
            <h2>Takip özeti</h2>
            <TrackingProgressForm revision={project.revision} value={progress} onSave={saveProgress} />
            {progress ? <TrackingEvidenceView value={progress.evidence} /> : null}
            <dl>
              <div><dt>Bağlı proje verisi</dt><dd>{thread.metrics.activeCount} / {thread.metrics.totalCount}</dd></div>
              <div><dt>Kritik konu</dt><dd>{thread.metrics.critical}</dd></div>
              <div><dt>İnceleme konusu</dt><dd>{thread.metrics.review}</dd></div>
              <div><dt>Fiziksel ilerleme</dt><dd>{earnedValue ? `%${earnedValue.actual}` : "Veri yok"}</dd></div>
              <div><dt>Hafta</dt><dd>{progress ? week : week > 0 ? week : "Veri yok"}</dd></div>
              <div><dt>Program göstergesi</dt><dd>{indicator(earnedValue?.spi)}</dd></div>
              <div><dt>Maliyet göstergesi</dt><dd>{indicator(earnedValue?.cpi)}</dd></div>
            </dl>
          </section>
          <section className="arx-track-panel arx-track-handover">
            <div className="arx-track-handover-head"><h2>Teslim hazırlığı</h2><strong>%{completion}</strong></div>
            <div className="arx-track-handover-list">
              {["As-built model ve çizimler","Test / kontrol tutanakları","Ürün ve malzeme listesi","Garanti ve bakım planları","Ekipman varlık kimlikleri","Söküm / yeniden kullanım notları"].map((item,index)=><button type="button" key={item} className={handover[index] ? "done" : ""} onClick={()=>setHandover((values)=>values.map((value,i)=>i===index?!value:value))}><span>{item}</span><b>{handover[index] ? "✓" : "—"}</b></button>)}
            </div>
          </section>
          <section className="arx-track-panel">
            <div className="arx-track-actions">
              <button type="button" onClick={exportRegister}>JSON indir</button>
              <Link href="/dijital-proje-merkezi">Dijital teslim / proje merkezi →</Link>
            </div>
          </section>
        </aside>
      </div>
    </section>;
  }

  if (!earnedValue || earnedValue.spi === null || earnedValue.cpi === null || earnedValue.eac === null) return null;
  return <section className={`project-os-app${compact ? " compact" : ""}`}>
    {operatingSource.error ? <p role="alert">Koordinasyon aktarımı reddedildi: {operatingSource.error}. Kaynak verisi eksiktir; kaynak kaydı değiştirilmedi.</p> : null}
    {pendingAction ? <TrackingActionForm key={`${pendingAction.kind}:${pendingAction.id}`} title={pendingAction.title} revision={pendingAction.revision} onSave={saveAction} onCancel={() => setPendingAction(null)} /> : null}
    <p role="status">Örnek gösterim — bu veriler aktif proje kaydına yazılmaz.</p>
    <ProjectKernelBar moduleKey="project-os" module="PROJECT DELIVERY OS" confidence="Örnek gösterim" />
    <header className="project-os-topbar">
      <div className="os-project-id"><span>V116 / PROJECT OS 2.0</span><b>Endüstriyel Yapı · Dijital Proje Merkezi</b></div>
      <div className="os-live" data-issue-gate={issueGate?.blocked ? "blocked" : "conceptual"}><i></i><span>{issueGate?.blocked ? "KRİTİK BIM BLOKAJI" : operatingModel.source.coordinationConnected ? "V115 BAĞLI" : "ÖRNEK VERİ"}</span><b>{issueGate?.blocked ? `${issueGate.activeCriticalClashes ?? 0} kritik çakışma · 4B/5B onay kapısı kapalı` : operatingModel.source.coordinationConnected ? "Koordinasyon issue’ları aktarıldı" : "Kaynak bağlantısı bekleniyor"}</b></div>
      <div className="os-profile"><span>ÖÖ</span><div><b>Proje Yetkisi</b><small>İşveren görünümü</small></div></div>
    </header>
    <div className="project-os-workspace">
      <nav className="project-os-nav" aria-label="Proje işletim sistemi modülleri">
        {modules.map((item) => <button key={item.id} className={active === item.id ? "active" : ""} onClick={() => setActive(item.id)}><span>{item.short}</span><b>{item.label}</b><small>{item.no}</small></button>)}
      </nav>
      <main className="project-os-main">
        <header className="os-module-head"><div><span>{currentModule.no} / PROJE MODÜLÜ</span><h3>{currentModule.label}</h3></div><div><button>22 TEM 2026</button><button onClick={exportRegister}>KAYIT JSON ↓</button></div></header>

        {issueGate?.blocked && <aside className="os-issue-gate-notice" data-testid="project-os-issue-gate" role="status"><b>4B / 5B ONAY KAPISI BLOKE</b><p>{issueGate.activeCriticalClashes ?? 0} aktif kritik BIM çakışması mevcut. {issueGate.reviewedCriticalClashes ?? 0} tanesi incelendi; inceleme işareti teknik çözüm değildir. Gösterilen süre ve maliyetler kavramsaldır.</p></aside>}
        {active === "overview" && <div className="os-overview">
          <div className="os-kpi-grid">
            <article><span>PROJE SAĞLIĞI</span><strong>%{projectHealth}</strong><i className="up">+3</i><small>karar ve saha verisinden</small></article>
            <article><span>FİZİKSEL İLERLEME</span><strong>%43</strong><i>Hf. 17</i><small>baz programa göre +%1</small></article>
            <article><span>AÇIK KARAR</span><strong>{String(decisions.filter((item) => item.state !== "Yanıtlandı").length).padStart(2, "0")}</strong><i className="warn">2 kritik</i><small>ortalama yaş 3,4 gün</small></article>
            <article><span>PROGRAM / MALİYET</span><strong>{earnedValue.spi.toFixed(2)} / {earnedValue.cpi.toFixed(2)}</strong><i className={earnedValue.spi < .95 ? "warn" : "up"}>SPI / CPI</i><small>kazanılmış değer göstergesi</small></article>
          </div>
          <div className="os-overview-grid">
            <section className="os-health-panel"><header><div><span>CANLI PROJE RADARI</span><b>Öncelik ve sapma sinyalleri</b></div><small>{thread.metrics.activeCount} bağlı veri akışı</small></header><div className="os-radar-list">{[["Tasarım koordinasyonu",Math.max(35,thread.metrics.quality),thread.metrics.critical?"alert":thread.metrics.review?"watch":"good"],["Program güveni",76,"watch"],["Bütçe kontrolü",82,"good"],["Tedarik hazırlığı",61,"alert"],["Saha kalitesi",79,"watch"],["Teslim verisi",50,"watch"]].map(([label,value,tone])=><div key={String(label)}><span>{label}</span><i><b className={String(tone)} style={{width:`${value}%`}}></b></i><strong>{value}</strong></div>)}</div></section>
            <section className="os-next-decisions"><header><span>SIRADAKİ KARARLAR</span><b>Gecikmeden önce görün</b></header>{decisions.slice(0,3).map((item)=><article key={item.id}><span>{item.id}</span><div><b>{item.title}</b><small>{item.impact} · {item.owner}</small></div><StatusPill value={item.due}/></article>)}</section>
          </div>
          <div className="os-digital-thread"><span>TEK VERİ ZİNCİRİ</span>{["Yatırım briefi","BIM / hesap","4B + maliyet","İmalat","360° saha","Yapı pasaportu"].map((item,index)=><div key={item}><b>{String(index+1).padStart(2,"0")}</b><small>{item}</small>{index<5&&<i>→</i>}</div>)}</div>
          <div className="v116-health-gates">{operatingModel.healthGates.map((gate)=><article key={gate.code} className={gate.status}><span>{gate.code}</span><b>{gate.label}</b><strong>{gate.count}</strong><small>{gate.status === "passed" ? "Hazır" : "İnceleme gerekli"}</small></article>)}</div>
        </div>}

        {active === "work" && <div className="v116-workspace">
          <div className="os-tool-row"><div><span>Koordinasyondan gelen işler</span><b>Sorumlu ve hedef tarih olmadan iş açılmaz</b></div><span className="os-capture-time">{workItems.filter((item)=>item.status!=="closed").length} AÇIK KAYIT</span></div>
          <div className="v116-work-board">{["blocked","open","in-review","closed"].map((status)=><section key={status}><header><b>{{blocked:"Bloke",open:"Açık","in-review":"İncelemede",closed:"Kapalı"}[status]}</b><span>{workItems.filter((item)=>item.status===status).length}</span></header>{workItems.filter((item)=>item.status===status).map((item)=><article key={item.id} className={item.priority}><div><span>{item.type.toUpperCase()} · {item.id}</span><StatusPill value={item.priority === "critical" ? "Yüksek" : item.status}/></div><h4>{item.title}</h4><p>{item.location ?? item.scheduleImpact}</p><dl><div><dt>Sorumlu ve hedef tarih</dt><dd>{item.owner}{item.ownerSuggested ? " (öneri)" : ""} · {item.dueDate}{item.dueDateSuggested ? " (önerilen tarih)" : ""}</dd></div><div><dt>Kaynak / revizyon</dt><dd>{item.sourceGuid ?? item.source} · {item.revision}</dd></div><div><dt>Etki</dt><dd>{item.scheduleImpact}</dd></div></dl>{item.status!=="closed"&&<button data-testid={item.sourceGuid && item.priority === "critical" ? "critical-bim-review-action" : undefined} onClick={()=>setWorkStates((values)=>({...values,[operatingWorkStateKey(item)]:item.sourceGuid && item.priority === "critical" ? item.status==="in-review"?"blocked":"in-review" : item.status==="in-review"?"closed":"in-review"}))}>{item.sourceGuid && item.priority === "critical" ? item.status==="in-review"?"İnceleme işaretini kaldır":"İncelemeye al · kapatılamaz" : item.status==="in-review"?"Kanıtla ve kapat":"İncelemeye al"} →</button>}</article>)}</section>)}</div>
          <p className="os-inline-note"><b>Kaynak sürekliliği:</b> V115 BCF uyumlu issue GUID’i, model konumu, disiplinler ve revizyon bilgisi görev kapanana kadar korunur.</p>
        </div>}

        {active === "program" && <div className="os-program">
          <div className="os-tool-row"><div><span>4B PROGRAM SİMÜLASYONU</span><b>Model + zaman + sorumluluk</b></div><label>Simülasyon haftası <strong>{week}</strong><input type="range" min="1" max="36" value={week} onChange={(event)=>setWeek(Number(event.target.value))}/></label></div>
          <div className="os-program-grid"><section className="os-gantt"><div className="os-gantt-scale">{[1,6,12,18,24,30,36].map((value)=><span key={value}>HF {value}</span>)}</div>{schedule.map((item)=><article key={item.name}><div><b>{item.name}</b><small>{item.owner} · %{item.progress}</small></div><div className="os-gantt-track"><i style={{left:`${((item.start-1)/36)*100}%`,width:`${((item.end-item.start+1)/36)*100}%`}}><b style={{width:`${item.progress}%`}}></b></i><span style={{left:`${(week/36)*100}%`}}></span></div></article>)}</section><aside className="os-4d-stage"><span>MODEL DURUMU / HF {week}</span><div className="os-structure-stage">{Array.from({length:18},(_,index)=><i key={index} className={index < Math.round(week/2) ? "built" : index < Math.round(week/1.25) ? "planned" : ""}></i>)}</div><div className="os-stage-legend"><span><i></i>Gerçekleşen</span><span><i></i>Planlanan</span><span><i></i>Henüz başlamadı</span></div><article><b>{week < 10 ? "Tasarım ve onay" : week < 20 ? "Temel + imalat" : week < 31 ? "Montaj + cephe" : "Test ve teslim"}</b><p>Seçilen haftaya göre model elemanlarının yapım durumu, sorumlusu ve bağlı dokümanı birlikte okunur.</p></article></aside></div>
        </div>}

        {active === "documents" && <div className="os-documents">
          <div className="os-tool-row"><div><span>ORTAK VERİ ORTAMI / CDE</span><b>Tek güncel kaynak, izlenebilir onay</b></div><div className="os-filter-row">{(["Tümü","Onaylı","İncelemede","Revizyon"] as const).map((filter)=><button key={filter} className={docFilter===filter?"active":""} onClick={()=>setDocFilter(filter)}>{filter}</button>)}</div></div>
          <div className="os-table"><header><span>KOD / DOKÜMAN</span><span>DİSİPLİN</span><span>REVİZYON</span><span>DURUM</span><span>SON İŞLEM</span><span></span></header>{filteredDocuments.map((item)=><article key={item.code}><div><b>{item.code}</b><span>{item.title}</span></div><span>{item.discipline}</span><b>{item.rev}</b><StatusPill value={item.status}/><span>{item.date}</span>{item.status!=="Onaylı"?<button onClick={()=>approveDocument(item.code)}>İncele → Onayla</button>:<button className="muted-action">Geçmiş ↗</button>}</article>)}</div>
          <p className="os-inline-note"><b>Versiyon kontrolü:</b> Eski dosya indirme, yanlış revizyonla imalat ve dağınık e-posta zincirlerini azaltmak için her kayıt model konumu, sorumlu ve karar geçmişiyle bağlanır.</p>
        </div>}

        {active === "decisions" && <div className="os-decisions">
          <div className="os-tool-row"><div><span>RFI / KARAR / DEĞİŞİKLİK</span><b>Sorudan kapanışa tek iz</b></div><button className="os-primary-action">+ YENİ KAYIT</button></div>
          <div className="os-decision-board">{["Karar gerekli","Yanıt bekliyor","Yanıtlandı"].map((state)=><section key={state}><header><b>{state}</b><span>{decisions.filter((item)=>item.state===state).length}</span></header>{decisions.filter((item)=>item.state===state).map((item)=><article key={item.id}><span>{item.id}</span><h4>{item.title}</h4><p>{item.impact}</p><div><small>{item.owner}</small><StatusPill value={item.due}/></div>{item.state!=="Yanıtlandı"&&<button onClick={()=>closeDecision(item.id)}>Kararı kapat ✓</button>}</article>)}</section>)}</div>
        </div>}

        {active === "revisions" && <div className="v116-revisions">
          <div className="os-tool-row"><div><span>Revizyon kaydı</span><b>Yalnız kayıtlı revizyonlar gösterilir</b></div><span className="os-capture-time">CDE DURUM KODU + KAYNAK</span></div>
          <div className="v116-revision-grid">{operatingModel.revisions.map((item)=><article key={`${item.code}-${item.title}`} className={item.status}><span>{item.status === "current" ? "GÜNCEL" : "ESKİ / KULLANMAYIN"}</span><strong>{item.code}</strong><div><h4>{item.title}</h4><p>{item.source}</p></div><b>{item.status === "current" ? "Yayımlanmış çalışma kaydı" : "Revizyon geçmişi kayıtlı değil"}</b></article>)}</div>
          <div className="v116-source-note"><b>Yetki sınırı</b><p>Bu görünüm Project Kernel içindeki proje zincirini açıklar. Sözleşmesel yayımlama, erişim yetkisi ve kalıcı belge geçmişi için kurumsal CDE yapılandırması gerekir.</p></div>
        </div>}

        {active === "cost" && <div className="os-cost">
          <div className="os-kpi-grid cost"><article><span>SÖZLEŞME BÜTÇESİ</span><strong>₺{earnedValue.budget.toFixed(1)}M</strong><small>Baz kapsam / Rev. 00</small></article><article><span>KAZANILMIŞ DEĞER</span><strong>₺{earnedValue.earned.toFixed(1)}M</strong><small>EV · gerçekleşen %{earnedValue.actual}</small></article><article><span>SPI / CPI</span><strong>{earnedValue.spi.toFixed(2)} / {earnedValue.cpi.toFixed(2)}</strong><small>program / maliyet verimi</small></article><article><span>EAC TAHMİNİ</span><strong>₺{earnedValue.eac.toFixed(1)}M</strong><small>mevcut CPI sürerse</small></article></div>
          <div className="os-cost-grid"><section><header><span>NAKİT AKIŞI / TEMSİLİ</span><b>Planlanan – gerçekleşen – tahmin</b></header><div className="os-cashflow">{[14,22,34,48,58,72,86,94,78,62,38,18].map((value,index)=><div key={index}><i style={{height:`${value}%`}}></i><b style={{height:`${Math.max(4,value-(index<6?4:index*2))}%`}}></b><span>{index+1}</span></div>)}</div><div className="os-stage-legend"><span><i></i>Plan</span><span><i></i>Gerçek / tahmin</span></div></section><section className="os-change-list"><header><span>DEĞİŞİKLİK RADARI</span><b>Etki + gerekçe + onay</b></header>{[["CO-006","Cephe paneli eşdeğer ürün","₺310K","İncelemede"],["CO-005","Makine kaidesi ilavesi","₺188K","Onaylı"],["CO-004","Çatı ışıklığı revizyonu","-₺72K","Onaylı"],["CO-003","Zemin iyileştirme farkı","₺214K","Revizyon"]].map(([id,title,value,status])=><article key={id}><span>{id}</span><div><b>{title}</b><small>{status}</small></div><strong>{value}</strong></article>)}</section></div>
        </div>}

        {active === "quality" && <div className="os-quality">
          <div className="os-tool-row"><div><span>360° GERÇEKLİK + KALİTE</span><b>Konuma, modele ve tarihe bağlı saha kanıtı</b></div><span className="os-capture-time">SON YAKALAMA · 22 TEM / 16:40</span></div>
          <div className="os-quality-grid"><section className="os-site-map"><div className="os-site-grid">{Array.from({length:24},(_,index)=><button key={index} className={qualityOpen[index%qualityOpen.length]&&[5,10,17].includes(index)?"issue":index<12?"captured":""} aria-label={`Saha bölgesi ${index+1}`}><span>{[5,10,17].includes(index)?"!":""}</span></button>)}</div><div className="os-site-scan"></div><span className="os-site-label a">360° / AKS C</span><span className="os-site-label b">MODEL EŞLEŞME %94</span></section><section className="os-quality-list"><header><span>AÇIK KALİTE KAYITLARI</span><b>{qualityOpen.filter(Boolean).length} kayıt</b></header>{["Ankraj düşeylik toleransı","Cephe alt bitiş kotu","Kaynak görsel kontrolü","Çatı dere izolasyonu"].map((item,index)=><article key={item} className={qualityOpen[index]?"open":"closed"}><button onClick={()=>setQualityOpen((values)=>values.map((value,i)=>i===index?!value:value))}>{qualityOpen[index]?"KAPAT":"AÇ"}</button><div><b>{item}</b><small>{index<2?"Aks C · Saha + model":"Blok A · Kontrol listesi"}</small></div><StatusPill value={qualityOpen[index]?index===1?"Yüksek":"İncelemede":"Onaylı"}/></article>)}</section></div>
        </div>}

        {active === "supply" && <div className="os-supply">
          <div className="os-tool-row"><div><span>TEDARİK KONTROL KULESİ</span><b>Uzun termin ve teknik karar erken uyarısı</b></div><span className="os-capture-time">2 KRİTİK PAKET</span></div>
          <div className="os-table supply"><header><span>PAKET / MALZEME</span><span>TERMİN</span><span>RİSK</span><span>DURUM</span><span>PROGRAM BAĞI</span></header>{supplyItems.map((item,index)=><article key={item.package}><div><b>{item.package}</b><span>{item.item}</span></div><strong>{item.lead} gün</strong><StatusPill value={item.risk}/><span>{item.status}</span><div className="os-mini-track"><i style={{width:`${Math.min(100,22+index*16)}%`}}></i><small>Hf {11+index*3}</small></div></article>)}</div>
          <div className="os-procurement-insight"><b>Önerilen hareket</b><p>PKG-04 cephe paneli ve PKG-09 yükleme kapıları için teknik karar tarihini satın alma tarihinden ayırın; eşdeğer ürün ve ikinci kaynak kontrolünü paralel başlatın.</p><button onClick={()=>setCopilot("risk")}>Programa etkisini analiz et ↗</button></div>
        </div>}

        {active === "handover" && <div className="os-handover">
          <div className="os-handover-head"><div><span>DİJİTAL TESLİM HAZIRLIĞI</span><h4>Anahtarın yanında yaşayan yapı hafızası.</h4></div><div className="os-completion-ring" style={{background:`conic-gradient(#b96636 ${completion}%,#dfe5e6 0)`}}><i><b>%{completion}</b><span>hazır</span></i></div></div>
          <div className="os-handover-grid"><section><header><span>TESLİM VERİ SETİ</span><b>{handover.filter(Boolean).length}/{handover.length} tamam</b></header>{["As-built model ve çizimler","Test / kontrol tutanakları","Ürün ve malzeme listesi","Garanti ve bakım planları","Ekipman varlık kimlikleri","Söküm / yeniden kullanım notları"].map((item,index)=><button key={item} className={handover[index]?"done":""} onClick={()=>setHandover((values)=>values.map((value,i)=>i===index?!value:value))}><i>{handover[index]?"✓":""}</i><span>{item}</span><b>{handover[index]?"TAMAM":"BEKLİYOR"}</b></button>)}</section><section className="os-passport-preview"><span>ARKEM ASSET PASSPORT</span><div><b>ARK-EP-2407-041</b><small>Çatı drenaj pompası / Blok A</small></div>{[["Model konumu","A / Çatı / Aks 7"],["Üretici verisi","Bağlı"],["Garanti bitişi","07.2031"],["Son bakım","Yeni varlık"],["Veri tamlığı","%84"]].map(([key,value])=><p key={key}><span>{key}</span><b>{value}</b></p>)}<button>Modelde göster ↗</button></section></div>
        </div>}
      </main>
      <aside className="project-os-copilot">
        <header><span>KURAL</span><div><b>Arkem Proje Kontrolü</b><small>Kaynağa bağlı kural tabanlı prototip</small></div></header>
        <p>Dağınık proje kayıtlarını karar, risk ve takip adımına dönüştüren yardımcı katman.</p>
        <div className="os-prompt-list">{[["risk","Program riskini bul"],["document","Doküman çelişkisini tara"],["cost","Bütçe sapmasını açıkla"],["quality","Kalite örüntüsünü incele"]].map(([id,label])=><button key={id} className={copilot===id?"active":""} onClick={()=>setCopilot(id)}>{label}<span>↗</span></button>)}</div>
        <article className="os-ai-answer"><span>ARKEM / KURAL TABANLI TEMSİLİ ÇIKTI</span><h4>{copilotAnswers[copilot].title}</h4><p>{copilotAnswers[copilot].copy}</p><div>{copilotAnswers[copilot].actions.map((item,index)=><b key={item}><i>{index+1}</i>{item}</b>)}</div></article>
        <small className="os-ai-disclaimer">Bu ekran gerçek proje verisi içermez. Kural tabanlı prototip çıktısı, uzman kontrolü ve kaynak doküman doğrulaması olmadan teknik karar yerine geçmez.</small>
      </aside>
    </div>
    <footer className="project-os-foot"><span>ISO 19650 CDE / OPENBIM / 4B / EARNED VALUE / REALITY / ASSET DATA</span><p>ARKEM-PROJECT-OS/2.0 · Kaynak, sorumlu, hedef tarih ve revizyon izli · Kurumsal CDE ve onaylı program yerine geçmez</p></footer>
  </section>;
}

