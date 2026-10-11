"use client";

import Link from "next/link";
import { useState } from "react";
import { downloadTextFile } from "../lib/engineering";
import { createCorporateTechnicalPdf } from "../lib/technical-sheet";
import { validateDeliveryPackage } from "../lib/delivery-package";
import { createCollaborationAudit } from "../lib/collaboration-audit";
import { INTEGRATION_SECURITY_REGISTRY } from "../lib/integration-security";
import { formatProjectDateTime } from "../lib/date-format";
import { PROJECT_JOURNEY, deriveProjectJourneyState, useProjectKernel } from "./ProjectKernel";
import { portalStageStatus } from "../lib/portal-stage-status";
import { portalRecords, nextPortalDecisionId, type ApprovalState } from "../lib/portal-records";

type PortalView = "overview" | "engineering" | "approvals" | "deliverables" | "assistant" | "asset" | "review" | "readiness" | "integrations";

const primaryPortalViews: Array<[PortalView, string]> = [
  ["overview", "Proje özeti"],
  ["engineering", "Teknik inceleme"],
  ["approvals", "Karar & onay"],
  ["deliverables", "Teslim paketi"],
];

const advancedPortalViews: Array<[PortalView, string]> = [
  ["assistant", "Proje asistanı"],
  ["asset", "Yapı pasaportu"],
  ["review", "XR inceleme"],
  ["readiness", "Karar dosyası"],
  ["integrations", "Entegrasyonlar"],
];

const portalViews = [...primaryPortalViews, ...advancedPortalViews];

const integrationRows = [
  ["Parsel / GIS", "Canlı", "Tarayıcıda koordinat, poligon, KML, GeoJSON ve CSV çalışır."],
  ["TKGM kadastro servisi", "Protokol", "Kurumsal servis ve kullanım yetkisi sağlandığında bağlanır."],
  ["Fotogerçekçi 3B harita", "API / lisans", "Google 3D Tiles veya eşdeğer servis anahtarı gerektirir."],
  ["OpenBIM / IFC", "Hazır mimari", "Gerçek IFC doğrulama ve dönüşüm servisi proje kurulumunda bağlanır."],
  ["DXF / DWG", "Kısmi canlı", "DXF üretilir; gerçek DWG için lisanslı dönüşüm servisi gerekir."],
  ["CDE / doküman yönetimi", "Kurulum", "Rol, onay ve saklama politikası müşteri altyapısına göre yapılandırılır."],
  ["Dijital ikiz / sensör", "Proje bağlantısı", "Saha sensörü, BMS ve varlık kimlikleri sağlandığında etkinleşir."],
] as const;

function safeRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function safeNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

export function ClientTechnicalProjectRoom() {
  const { project, thread, hydrated, patchModule, synchronizeProject, importProject, applyHandoff } = useProjectKernel();
  const storedPortal = safeRecord(project.modules["client-portal"]);
  const demolition = safeRecord(project.modules["demolition-screening"]);
  const projectOs = safeRecord(project.modules["project-os"]);
  const earnedValue = safeRecord(projectOs.earnedValue);
  const numericLabel = (value: unknown, digits = 2) => typeof value === "number" && Number.isFinite(value) ? value.toFixed(digits) : "Veri yok";
  const progressLabel = (key: string) => typeof earnedValue[key] === "number" && Number.isFinite(earnedValue[key]) ? `%${Number(earnedValue[key]).toFixed(0)}` : "Veri yok";
  const demolitionInput = safeRecord(demolition.input);
  const demolitionAnalysis = safeRecord(demolition.analysis);
  const demolitionGates = Array.isArray(demolition.gates) ? demolition.gates.map(safeRecord) : [];
  const { approvals, decisions } = portalRecords(storedPortal);
  const [view, setView] = useState<PortalView>("overview");
  const [role, setRole] = useState("İşveren");
  const [assets, setAssets] = useState({
    model: true,
    warranty: false,
    maintenance: false,
    products: false,
  });
  const [snapshots, setSnapshots] = useState<Array<{ id: string; name: string; revision: string; savedAt: string; data: unknown }>>(() => {
    if (typeof window === "undefined") return [];
    try {
      const stored = window.localStorage.getItem("arkem-project-vault-v1");
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });
  const [vaultMessage, setVaultMessage] = useState("");
  const [handoffMessage, setHandoffMessage] = useState("");
  const [decisionText, setDecisionText] = useState("");
  const [decisionOwner, setDecisionOwner] = useState("İşveren");
  const [assistantTopic, setAssistantTopic] = useState<"next" | "risk" | "evidence" | "delivery">("next");
  const [reviewMode, setReviewMode] = useState<"desktop" | "vr" | "ar">("desktop");
  const [reviewLanguage, setReviewLanguage] = useState("Türkçe");

  const approvedCount = Object.values(approvals).filter((state) => state === "Onaylandı").length;
  const portalStatus = portalStageStatus(thread, deriveProjectJourneyState(thread), approvedCount);
  const completedJourney = PROJECT_JOURNEY.map((step, index) => ({ ...step, ...portalStatus.stages[index] }));
  const deliverables = [
    ["Proje veri paketi", project.events.length ? "Hazır" : "Başlatılmadı", `${project.events.length} denetlenebilir işlem`],
    ["Disiplin kayıtları", thread.metrics.activeCount ? "Hazır" : "Eksik", `${thread.metrics.activeCount}/${thread.metrics.totalCount} modül`],
    ["Koordinasyon kontrolü", thread.metrics.critical ? "Düzeltme gerekli" : "Kontrollü", `${thread.metrics.critical} kritik issue`],
    ["Müşteri onayları", approvedCount === 4 ? "Tamamlandı" : "Devam ediyor", `${approvedCount}/4 onay`],
  ];
  const deliveryPackage = validateDeliveryPackage([
    { name: `${project.id}-pafta.pdf`, format: "PDF", bytes: 1, revision: project.revision, sourceModule: "technical-sheet" },
    { name: `${project.id}-model.dxf`, format: "DXF", bytes: thread.canonical.site.geometryValid ? 1 : 0, revision: project.revision, coordinateReference: project.coordinateReference, sourceModule: "design-studios" },
    { name: `${project.id}-index.csv`, format: "CSV", bytes: project.events.length ? 1 : 0, revision: project.revision, sourceModule: "project-kernel" },
    { name: `${project.id}-manifest.json`, format: "JSON", bytes: 1, revision: project.revision, sourceModule: "client-portal" },
  ]);
  const stageGates = [
    { code: "G01", label: "Brief", route: "/proje-baslat", ready: thread.nodes.some((node) => node.id === "decision-assistant" && node.active), requirement: "Yatırım hedefi ve başarı ölçütü" },
    { code: "G02", label: "Parsel", route: "/arsa-fizibilite-studyosu", ready: thread.canonical.site.parcelArea > 1 && thread.canonical.site.geometryValid, requirement: "Doğrulanabilir sınır ve koordinat" },
    { code: "G03", label: "Mimari", route: "/mimari-program-studyosu", ready: portalStatus.architectureReady, requirement: "İhtiyaç onayı, plan ve önceki aşama kontrolleri" },
    { code: "G04", label: "Taşıyıcı", route: "/tasarim-calismalari#tasiyici-on-tasarim", ready: Boolean(thread.canonical.structure.system && thread.canonical.structure.width), requirement: "Sistem, aks ve ön boyut" },
    { code: "G05", label: "Koordinasyon", route: "/muhendislik-koordinasyon", ready: thread.nodes.some((node) => node.id === "engineering-coordination" && node.active) && thread.metrics.critical === 0, requirement: "Kritik issue kapanışı" },
    { code: "G06", label: "Teslim", route: "/dijital-proje-merkezi", ready: portalStatus.deliveryReady, requirement: "Önceki kontroller, teslim kapsamı ve kayıtlı onaylar" },
  ];
  const readyGateCount = stageGates.filter((gate) => gate.ready).length;
  const readinessScore = Math.round((thread.metrics.readiness + thread.metrics.quality + approvedCount * 25 + readyGateCount / stageGates.length * 100) / 4);
  const readinessVerdict = thread.metrics.critical > 0 ? "Kritik kayıtlar kapatılmalı" : readinessScore >= 80 ? "Teknik görüşmeye hazır" : readinessScore >= 55 ? "Koşullu ilerleme" : "Veri hazırlığı gerekli";
  const readinessPillars = [
    { code: "01", label: "Proje verisi", value: thread.metrics.readiness, note: `${thread.metrics.activeCount}/${thread.metrics.totalCount} bağlı modül` },
    { code: "02", label: "Mühendislik kanıtı", value: thread.metrics.quality, note: `${thread.metrics.critical} kritik · ${thread.metrics.review} inceleme` },
    { code: "03", label: "Karar yetkisi", value: approvedCount * 25, note: `${approvedCount}/4 müşteri onayı` },
    { code: "04", label: "Aşama kapıları", value: Math.round(readyGateCount / stageGates.length * 100), note: `${readyGateCount}/${stageGates.length} kalite kapısı` },
    { code: "05", label: "Dijital teslim", value: Math.round((Number(assets.model) + Number(assets.products) + Number(assets.maintenance) + Number(assets.warranty)) / 4 * 100), note: `${Object.values(assets).filter(Boolean).length}/4 varlık katmanı` },
  ];
  const assistantResponses = {
    next: { title: `Sıradaki çalışma: ${thread.nextAction.label}`, copy: `Aktif ${thread.metrics.activeCount}/${thread.metrics.totalCount} modüle ve mevcut bağımlılıklara göre tamamlanabilir ilk adım budur.`, route: thread.nextAction.route, action: "Çalışma alanını açın" },
    risk: { title: `${thread.metrics.critical} kritik, ${thread.metrics.review} inceleme kaydı`, copy: thread.issues[0] ? `${thread.issues[0].title}: ${thread.issues[0].action}` : "Mevcut ön değerlendirme verisinde açık kritik issue görünmüyor.", route: thread.issues[0]?.route || "/muhendislik-koordinasyon", action: "Risk kaydını inceleyin" },
    evidence: { title: `Kanıt hazırlığı %${thread.metrics.quality}`, copy: `Parsel, mimari, taşıyıcı ve koordinasyon kayıtlarının tutarlılığına göre hesaplanır. ${snapshots.length} geri dönüş noktası ve ${project.events.length} işlem kaydı bulunuyor.`, route: "/dijital-proje-merkezi", action: "Proje grafiğini açın" },
    delivery: { title: `Teslim hazırlığı: ${approvedCount}/4 onay`, copy: `Kurumsal PDF, CSV ve JSON canlıdır. Gerçek DWG, CDE ve dijital ikiz bağlantıları lisans veya proje kurulumu gerektirir.`, route: "/proje-os", action: "Teslim kapsamını açın" },
  };

  const saveApprovals = (next: Record<string, ApprovalState>) => {
    if (!hydrated) return;
    patchModule("client-portal", { approvals: next, role, status: "Müşteri portalı etkin" });
  };

  const saveSnapshot = () => {
    const snapshot = { id: `${project.id}-${Date.now().toString(36)}`, name: project.name, revision: project.revision, savedAt: new Date().toISOString(), data: project };
    const next = [snapshot, ...snapshots].slice(0, 8);
    setSnapshots(next);
    window.localStorage.setItem("arkem-project-vault-v1", JSON.stringify(next));
    setVaultMessage("Geri dönüş noktası cihazınıza kaydedildi.");
  };

  const restoreSnapshot = (id: string) => {
    const snapshot = snapshots.find((item) => item.id === id);
    if (!snapshot) return;
    const accepted = importProject(snapshot.data);
    setVaultMessage(accepted ? `${snapshot.revision} geri yüklendi.` : "Kayıt doğrulanamadı.");
  };

  const deleteSnapshot = (id: string) => {
    const next = snapshots.filter((item) => item.id !== id);
    setSnapshots(next);
    window.localStorage.setItem("arkem-project-vault-v1", JSON.stringify(next));
    setVaultMessage("Geri dönüş noktası kaldırıldı.");
  };

  const cycleApproval = (id: string) => {
    const current = approvals[id];
    const nextState: ApprovalState = current === "Bekliyor" ? "İncelemede" : current === "İncelemede" ? "Onaylandı" : "Bekliyor";
    saveApprovals({ ...approvals, [id]: nextState });
  };

  const addDecision = () => {
    const text = decisionText.trim();
    if (!hydrated || !text) return;
    const next = [{ id: nextPortalDecisionId(decisions), text, owner: decisionOwner, status: "Açık", createdAt: new Date().toISOString() }, ...decisions];
    setDecisionText("");
    patchModule("client-portal", { decisions: next, role, status: "Müşteri karar kaydı etkin" });
  };

  const toggleDecision = (id: string) => {
    if (!hydrated) return;
    const next = decisions.map((decision) => decision.id === id ? { ...decision, status: decision.status === "Açık" ? "Kapalı" : "Açık" } : decision);
    patchModule("client-portal", { decisions: next });
  };

  const exportManifest = () => {
    downloadTextFile(`${project.id}-${project.revision}-teslim-manifestosu.json`, JSON.stringify({
      schema: "ARKEM-DELIVERY/2.0",
      generatedAt: new Date().toISOString(),
      project: { id: project.id, name: project.name, revision: project.revision, phase: project.phase },
      readiness: thread.metrics,
      approvals,
      collaboration: createCollaborationAudit({ projectId: project.id, revision: project.revision, decisions, approvals }),
      deliveryValidation: deliveryPackage,
      modules: thread.nodes.map(({ id, code, label, active, readiness }) => ({ id, code, label, active, readiness })),
      limits: "Ön değerlendirme çıktısıdır; yetkili proje, resmi onay veya uygulama projesi yerine geçmez.",
    }, null, 2), "application/json");
  };

  const exportCsv = () => {
    const rows = [
      ["Kod", "Modül", "Aşama", "Durum", "Hazırlık"],
      ...thread.nodes.map((node) => [node.code, node.label, node.stage, node.active ? "Aktif" : "Bekliyor", `${node.readiness}%`]),
    ];
    downloadTextFile(`${project.id}-${project.revision}-teslim-indeksi.csv`, `\uFEFF${rows.map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(";")).join("\n")}`, "text/csv;charset=utf-8");
  };

  const exportPdf = async () => {
    const width = Math.max(12, thread.canonical.structure.width || 30);
    const depth = Math.max(8, thread.canonical.structure.depth || 20);
    const pdf = await createCorporateTechnicalPdf({
      projectName: project.name,
      projectCode: project.id,
      module: "Müşteri Proje Portalı",
      drawingTitle: "Yönetici Proje Özeti",
      drawingSubtitle: "Karar, koordinasyon ve teslim hazırlığı",
      revision: project.revision,
      status: project.phase,
      sheetNo: "CP-001",
      scale: "Şematik / ölçeksiz",
      coordinateSystem: project.coordinateReference,
      preparedBy: "ARKEMX",
      checkedBy: "Proje ekibi",
      polylines: [{ role: "primary", closed: true, points: [{ x: 0, y: 0 }, { x: width, y: 0 }, { x: width, y: depth }, { x: 0, y: depth }] }],
      metrics: [
        ["Proje hazırlığı", `%${thread.metrics.readiness}`],
        ["Kalite skoru", `%${thread.metrics.quality}`],
        ["Aktif modül", `${thread.metrics.activeCount}/${thread.metrics.totalCount}`],
        ["Müşteri onayı", `${approvedCount}/4`],
      ],
      notes: [
        `Sıradaki önerilen adım: ${thread.nextAction.label}.`,
        `${thread.metrics.critical} kritik ve ${thread.metrics.review} inceleme kaydı bulunuyor.`,
        "Bu pafta ön değerlendirme ve karar iletişimi içindir; yetkili uygulama projesi değildir.",
      ],
    });
    downloadTextFile(`${project.id}-${project.revision}-yonetici-ozeti.pdf`, pdf, "application/pdf");
  };

  const exportReviewBrief = () => {
    downloadTextFile(`${project.id}-${project.revision}-xr-inceleme-paketi.json`, JSON.stringify({
      schema: "ARKEM-XR-REVIEW/1.0",
      generatedAt: new Date().toISOString(),
      project: { id: project.id, name: project.name, revision: project.revision, phase: project.phase },
      session: { mode: reviewMode, language: reviewLanguage, role },
      model: {
        libraryRoute: "/3b-model-kutuphanesi",
        studioRoute: "/tasarim-calismalari",
        geometryReady: assets.model,
        coordinationIssues: thread.issues.length,
      },
      reviewChecklist: [
        { id: "XR-01", label: "Model sürümü doğrulandı", ready: assets.model },
        { id: "XR-02", label: "Koordinasyon issue listesi hazır", ready: thread.nodes.some((node) => node.id === "engineering-coordination" && node.active) },
        { id: "XR-03", label: "İnceleme rolü ve dili tanımlandı", ready: Boolean(role && reviewLanguage) },
        { id: "XR-04", label: "WebXR uyumlu cihaz ve tarayıcı doğrulandı", ready: false },
      ],
      limits: "Bu paket bir XR inceleme gündemidir. WebXR, AR yerleştirme ve çok kullanıcılı oturum; uyumlu cihaz, model erişimi ve proje yetkilendirmesi sağlandığında etkinleştirilir.",
    }, null, 2), "application/json");
  };

  const exportReadinessDossier = () => {
    downloadTextFile(`${project.id}-${project.revision}-yatirim-karar-dosyasi.json`, JSON.stringify({
      schema: "ARKEM-PROJECT-READINESS/1.0",
      generatedAt: new Date().toISOString(),
      project: { id: project.id, name: project.name, revision: project.revision, phase: project.phase },
      score: readinessScore,
      verdict: readinessVerdict,
      pillars: readinessPillars,
      gates: stageGates.map(({ code, label, ready, requirement }) => ({ code, label, ready, requirement })),
      openIssues: thread.issues.map(({ id, title, severity, evidence, action }) => ({ id, title, severity, evidence, action })),
      approvals,
      nextAction: thread.nextAction,
      limits: "Karar destek özetidir; resmi fizibilite, ruhsat, uygulama projesi, mali teklif veya yatırım tavsiyesi değildir.",
    }, null, 2), "application/json");
  };

  return <div className="client-portal">
    <aside className="client-portal-sidebar">
      <div><span className="client-portal-kicker">ARKEMX / MÜŞTERİ ALANI</span><h2>{project.name}</h2><p>{project.id} · {project.revision}</p></div>
      <label>Görünüm rolü<select value={role} onChange={(event) => setRole(event.target.value)}><option>İşveren</option><option>Mimari ekip</option><option>Mühendislik</option><option>Saha ekibi</option></select></label>
      <section className="client-portal-next">
        <span>SIRADAKİ DOĞRU ADIM</span>
        <b>{thread.nextAction.label}</b>
        <small>Mevcut proje verisine göre tamamlanabilir ilk çalışma.</small>
        <Link href={thread.nextAction.route}>Çalışma alanını açın <span>→</span></Link>
      </section>
      <nav aria-label="Müşteri portalı ana bölümleri">{primaryPortalViews.map(([id, label], index) => <button className={view === id ? "active" : ""} onClick={() => setView(id)} key={id}><span>{String(index + 1).padStart(2, "0")}</span>{label}</button>)}</nav>
      <details className="client-portal-more" open={advancedPortalViews.some(([id]) => id === view)}>
        <summary>Daha fazla araç <span>{advancedPortalViews.length}</span></summary>
        <nav aria-label="Müşteri portalı gelişmiş bölümleri">{advancedPortalViews.map(([id, label], index) => <button className={view === id ? "active" : ""} onClick={() => setView(id)} key={id}><span>{String(index + primaryPortalViews.length + 1).padStart(2, "0")}</span>{label}</button>)}</nav>
      </details>
      <div className="client-portal-security"><b>Yerel ve kontrollü prototip</b><p>Bu görünüm proje verisini cihazınızda tutar. Harici sistemlere izinsiz veri göndermez.</p></div>
    </aside>

    <section className="client-portal-stage">
      <header><div><span>{role} görünümü</span><h3>{portalViews.find(([id]) => id === view)?.[1]}</h3></div><div className="client-portal-health"><small>Proje hazırlığı</small><b>%{thread.metrics.readiness}</b></div></header>

      {view === "overview" && <div className="client-portal-view">
        <div className="client-next-action"><span>Sıradaki doğru adım</span><h4>{thread.nextAction.label}</h4><p>Mevcut proje kayıtlarına göre tamamlanabilir ilk teknik çalışma.</p><Link href={thread.nextAction.route}>Çalışma alanını açın <span>↗</span></Link></div>
        <section className="client-gate-board">
          <header><div><span>V62 / YÖNLENDİRMELİ KALİTE KAPILARI</span><h4>Teknoloji bilmeden ilerleyin.</h4></div><p>Her kapı bir sonraki disipline aktarılacak asgari, anlaşılır veri setini kontrol eder.</p></header>
          <div>{stageGates.map((gate) => <Link href={gate.route} className={gate.ready ? "ready" : ""} key={gate.code}><span>{gate.code}</span><b>{gate.label}</b><small>{gate.requirement}</small><em>{gate.ready ? "Hazır ✓" : "Tamamlayın →"}</em></Link>)}</div>
        </section>
        <div className="client-kpi-grid"><article><span>Aktif modül</span><b>{thread.metrics.activeCount}/{thread.metrics.totalCount}</b><small>Ortak proje kimliğine bağlı</small></article><article><span>Kalite skoru</span><b>%{thread.metrics.quality}</b><small>{thread.metrics.critical} kritik kayıt</small></article><article><span>Müşteri onayı</span><b>{approvedCount}/4</b><small>Karar kapısı tamamlandı</small></article><article><span>Son revizyon</span><b>{project.revision}</b><small>{project.phase}</small></article></div>
        <section className="client-source-provenance">
          <div><span>PARSEL KAYNAĞI</span><b>{thread.canonical.site.dataStatus || "Kaynak bekleniyor"}</b></div>
          <div><span>İMAR KOŞULLARI</span><b>{thread.canonical.site.allowedFootprint > 0 || thread.canonical.site.allowedGross > 0 || thread.canonical.site.maxHeight > 0 ? "Kayıt var · kaynağı kontrol edin" : "Resmî doğrulama bekliyor"}</b></div>
          <div><span>SON EŞİTLEME</span><b>{project.updatedAt ? formatProjectDateTime(project.updatedAt) : "Henüz eşitlenmedi"}</b></div>
        </section>
        <section className="parcel-handoff-console">
          <header><div><span>V63 / PARSEL → MİMARİ DEVİR KONTROLÜ</span><h4>Seçilen arazi bir sonraki adıma hazır mı?</h4></div><button onClick={() => { const done = applyHandoff("H-01"); setHandoffMessage(done ? "Parsel verisi mimari programa aktarıldı." : "Önce geçerli parsel sınırı ve alan üretin."); }}>{thread.canonical.site.geometryValid ? "Veriyi yeniden aktar ↻" : "Parseli tamamla →"}</button></header>
          <div className="parcel-handoff-data">
            <article><span>Parsel referansı</span><b>{thread.canonical.site.reference}</b><small>{thread.canonical.site.dataStatus}</small></article>
            <article><span>Koordinat sistemi</span><b>{thread.canonical.site.crs}</b><small>Kaynak referansı</small></article>
            <article><span>Hesaplanan alan</span><b>{thread.canonical.site.parcelArea > 0 ? `${thread.canonical.site.parcelArea.toFixed(1)} m²` : "—"}</b><small>{thread.canonical.site.geometryValid ? "Geometri geçerli" : "Geometri bekleniyor"}</small></article>
            <article><span>Öneri / izin</span><b>{thread.canonical.site.proposedFootprint > 0 ? `${thread.canonical.site.proposedFootprint.toFixed(0)} / ${thread.canonical.site.allowedFootprint.toFixed(0)} m²` : "—"}</b><small>{thread.canonical.site.setbackPass ? "Çekme ön kontrolü geçti" : "Ön kontrol gerekli"}</small></article>
          </div>
          {handoffMessage && <p role="status">{handoffMessage}</p>}
          <footer><span>Canlı: kullanıcı koordinatı ve dosyası</span><span>TKGM: kurumsal protokol gerektirir</span><Link href="/arsa-fizibilite-studyosu">Parsel çalışma alanını açın ↗</Link></footer>
        </section>
        <section className="four-five-d-summary">
          <header><div><span>V70 / 4B–5B YÖNETİCİ ÖZETİ</span><h4>Zaman, maliyet ve karar tek göstergede.</h4></div><Link href="/proje-takibi">Proje takibini açın ↗</Link></header>
          <div>
            <article><span>Rapor haftası</span><b>{projectOs.progress ? numericLabel(projectOs.week, 0) : "Veri yok"}</b><small>Beyan edilen proje kaydı</small></article>
            <article><span>Proje sağlığı</span><b>{safeNumber(projectOs.projectHealth) ? `%${safeNumber(projectOs.projectHealth)}` : "—"}</b><small>Karar + saha + teslim verisi</small></article>
            <article><span>SPI / CPI</span><b>{numericLabel(earnedValue.spi)} / {numericLabel(earnedValue.cpi)}</b><small>Program / maliyet verimi</small></article>
            <article><span>Tamamlanma tahmini</span><b>{safeNumber(earnedValue.eac) ? `₺${safeNumber(earnedValue.eac).toFixed(1)}M` : "—"}</b><small>Mevcut CPI sürerse</small></article>
          </div>
          <footer><i style={{ width: `${Math.min(100, Math.max(0, safeNumber(earnedValue.actual)))}%` }}></i><span>Gerçekleşen {progressLabel("actual")}</span><span>Plan {progressLabel("planned")}</span><small>Program ve maliyet göstergeleri kayıtlı proje girdilerinden hesaplanır; eksik değerler veri yok olarak gösterilir.</small></footer>
        </section>
        <div className="client-journey">{completedJourney.map((step, index) => <Link className={step.done ? "done" : ""} href={step.href} key={step.short}><span>{String(index + 1).padStart(2, "0")}</span><b>{step.short}</b><small>{step.label}</small></Link>)}</div>
        <button className="portal-sync" onClick={() => synchronizeProject()}>Tüm bağlı modülleri şimdi eşitleyin <span>↻</span></button>
        <section className="project-vault">
          <header><div><span>V61 / PROJE KASASI</span><h4>Revizyon geri dönüş noktaları</h4></div><button onClick={saveSnapshot}>Mevcut durumu kaydet <span>＋</span></button></header>
          {vaultMessage && <p role="status">{vaultMessage}</p>}
          <div>{snapshots.map((snapshot) => <article key={snapshot.id}><span><b>{snapshot.revision}</b><small>{formatProjectDateTime(snapshot.savedAt)}</small></span><strong>{snapshot.name}</strong><button onClick={() => restoreSnapshot(snapshot.id)}>Geri yükle</button><button aria-label={`${snapshot.revision} kaydını sil`} onClick={() => deleteSnapshot(snapshot.id)}>×</button></article>)}{!snapshots.length && <div className="project-vault-empty">Henüz geri dönüş noktası yok. Teknik karar öncesinde kayıt oluşturun.</div>}</div>
        </section>
      </div>}

      {view === "approvals" && <div className="client-portal-view"><div className="client-section-copy"><span>V69 / PAYDAŞ KARAR DEFTERİ</span><h4>Onaylar dosyada değil, proje hafızasında yaşar.</h4><p>Her satıra basarak inceleme durumunu ilerletin. Değişiklik proje çekirdeğine kaydedilir.</p></div><div className="approval-list">{[
        ["scope", "Proje kapsamı ve yatırım briefi", "İhtiyaç, başarı ölçütü ve yetki sınırı"],
        ["system", "Taşıyıcı sistem kararı", "Alternatif, gerekçe ve ön boyut"],
        ["coordination", "Disiplin koordinasyonu", "Kritik issue ve çözüm sorumlusu"],
        ["delivery", "Dijital teslim paketi", "Model, doküman ve varlık verisi"],
      ].map(([id, title, copy]) => <button onClick={() => cycleApproval(id)} key={id}><span className={`approval-state state-${approvals[id].toLocaleLowerCase("tr-TR")}`}>{approvals[id]}</span><div><b>{title}</b><small>{copy}</small></div><span>→</span></button>)}</div>
        <section className="decision-register">
          <header><div><span>Karar / yorum kaydı</span><b>Toplantı notunu sorumlu, zaman ve durumla bağlayın.</b></div><small>Yerel prototip · sunucu tabanlı CDE değildir</small></header>
          <div className="decision-entry"><input value={decisionText} onChange={(event) => setDecisionText(event.target.value)} placeholder="Örn. Güney cephede gölgeleme alternatifi karşılaştırılsın"/><select value={decisionOwner} onChange={(event) => setDecisionOwner(event.target.value)}><option>İşveren</option><option>Mimari</option><option>Statik</option><option>MEP</option><option>Saha</option></select><button onClick={addDecision}>Karar ekle ＋</button></div>
          <div className="decision-list">{decisions.map((decision) => <button onClick={() => toggleDecision(decision.id)} className={decision.status === "Kapalı" ? "closed" : ""} key={decision.id}><span>{decision.id}</span><div><b>{decision.text}</b><small>{decision.owner} · {formatProjectDateTime(decision.createdAt)}</small></div><em>{decision.status}</em></button>)}{!decisions.length && <p>Henüz karar kaydı yok.</p>}</div>
        </section>
      </div>}

      {view === "engineering" && <div className="client-portal-view">
        <div className="client-section-copy"><span>V64 / MİMARİ KARAR PANELİ</span><h4>Alan programını performansla birlikte okuyun.</h4><p>Parselden aktarılan izin girdisi; net–brüt verim, günışığı, kaçış ve kat plakası üzerinden tek karar görünümünde izlenir.</p></div>
        <section className="architecture-review">
          <div className="architecture-review-score"><span>Mimari veri hazırlığı</span><b>%{thread.nodes.find((node) => node.id === "architectural-program")?.readiness ?? 0}</b><small>{thread.canonical.architecture.use || "Kullanım tanımlanmadı"}</small></div>
          <div className="architecture-review-metrics">
            <article><span>Brüt alan</span><b>{thread.canonical.architecture.grossArea ? `${thread.canonical.architecture.grossArea.toFixed(0)} m²` : "—"}</b><small>{thread.canonical.site.allowedGross ? `${thread.canonical.site.allowedGross.toFixed(0)} m² izin girdisi` : "İmar girdisi bekleniyor"}</small></article>
            <article><span>Net alan / verim</span><b>{thread.canonical.architecture.netArea ? `${thread.canonical.architecture.netArea.toFixed(0)} m²` : "—"}</b><small>{thread.canonical.architecture.efficiency ? `%${thread.canonical.architecture.efficiency.toFixed(1)} alan verimi` : "Program bekleniyor"}</small></article>
            <article><span>Kat / plaka</span><b>{thread.canonical.architecture.floors ? `${thread.canonical.architecture.floors} kat` : "—"}</b><small>{thread.canonical.architecture.plateWidth ? `${thread.canonical.architecture.plateWidth.toFixed(1)} × ${thread.canonical.architecture.plateDepth.toFixed(1)} m` : "Plaka bekleniyor"}</small></article>
            <article><span>Günışığı kapsama</span><b>{thread.canonical.architecture.daylightCoverage ? `%${thread.canonical.architecture.daylightCoverage.toFixed(0)}` : "—"}</b><small>Ön performans göstergesi</small></article>
            <article><span>Kaçış mesafesi</span><b>{thread.canonical.architecture.travelDistance ? `${thread.canonical.architecture.travelDistance.toFixed(1)} m` : "—"}</b><small>{thread.canonical.architecture.targetTravel ? `${thread.canonical.architecture.targetTravel.toFixed(1)} m hedef` : "Hedef tanımlanmadı"}</small></article>
            <article><span>Kullanıcı yükü</span><b>{thread.canonical.architecture.occupants || "—"}</b><small>Kavramsal kişi yükü</small></article>
          </div>
          <footer><p>Bu metrikler erken tasarım karşılaştırması içindir; yangın, erişilebilirlik ve ruhsat kontrolleri yetkili proje sürecinde doğrulanır.</p><Link href="/mimari-program-studyosu">Mimari programı geliştirin ↗</Link></footer>
        </section>
        <section className="structure-review">
          <header><div><span>V65 / TAŞIYICI SİSTEM ÖN KONTROLÜ</span><h4>Geometri, yük izi ve metraj aynı ekranda.</h4></div><Link href="/tasarim-calismalari#tasiyici-on-tasarim">Taşıyıcı modeli açın ↗</Link></header>
          <div className="structure-review-grid">
            <article><span>Sistem</span><b>{thread.canonical.structure.system || "—"}</b><small>{thread.canonical.structure.recommendedSystem ? `MCDA: ${thread.canonical.structure.recommendedSystem}` : "Sistem karşılaştırması bekleniyor"}</small></article>
            <article><span>Aks düzeni</span><b>{thread.canonical.structure.baysX && thread.canonical.structure.baysY ? `${thread.canonical.structure.baysX} × ${thread.canonical.structure.baysY}` : "—"}</b><small>{thread.canonical.structure.spanX ? `${thread.canonical.structure.spanX.toFixed(2)} × ${thread.canonical.structure.spanY.toFixed(2)} m açıklık` : "Aks modeli bekleniyor"}</small></article>
            <article><span>Tasarım düşey yükü</span><b>{thread.canonical.structure.factoredGravity ? `${(thread.canonical.structure.factoredGravity / 1000).toFixed(1)} MN` : "—"}</b><small>Ön boyutlandırma yük izi</small></article>
            <article><span>Beton</span><b>{thread.canonical.structure.concreteVolume ? `${thread.canonical.structure.concreteVolume.toFixed(0)} m³` : "—"}</b><small>Kavramsal metraj</small></article>
            <article><span>Yapısal çelik</span><b>{thread.canonical.structure.steelTonnage ? `${thread.canonical.structure.steelTonnage.toFixed(1)} t` : "—"}</b><small>Kavramsal metraj</small></article>
            <article><span>Donatı</span><b>{thread.canonical.structure.reinforcementTonnage ? `${thread.canonical.structure.reinforcementTonnage.toFixed(1)} t` : "—"}</b><small>Kavramsal metraj</small></article>
          </div>
          <footer><span className={thread.metrics.critical ? "warning" : "pass"}>{thread.metrics.critical ? `${thread.metrics.critical} kritik disiplin çakışması` : "Kritik disiplin çakışması yok"}</span><p>Sonlu eleman analizi, zemin–yapı etkileşimi, deprem performansı ve uygulama projesi yetkili mühendislik hesabında tamamlanır.</p></footer>
        </section>
        <section className="demolition-review">
          <header><div><span>V66 / KONTROLLÜ YIKIM GÜVENLİK KAPISI</span><h4>Yöntem puanından önce kanıt hazırlığını görün.</h4></div><Link href="/yikim-karar-studyosu">Yıkım karar stüdyosunu açın ↗</Link></header>
          <div>
            <article><span>Yapı / yükseklik</span><b>{demolitionInput.structure ? String(demolitionInput.structure) : "—"}</b><small>{safeNumber(demolitionInput.height) ? `${safeNumber(demolitionInput.height)} m · ${safeNumber(demolitionInput.floors)} kat` : "Yapı verisi bekleniyor"}</small></article>
            <article><span>Komşu yapı mesafesi</span><b>{safeNumber(demolitionInput.neighbor) ? `${safeNumber(demolitionInput.neighbor)} m` : "—"}</b><small>Çevre etkisi girdisi</small></article>
            <article><span>Önerilen uzman incelemesi</span><b>{demolitionAnalysis.recommendedMethod ? String(demolitionAnalysis.recommendedMethod) : "—"}</b><small>Operasyon veya patlayıcı tasarımı değildir</small></article>
            <article><span>En yüksek doğal risk</span><b>{safeNumber(demolitionAnalysis.maxRisk) || "—"}</b><small>5×5 ön risk matrisi</small></article>
            <article><span>Hazırlık kapıları</span><b>{demolitionGates.length ? `${demolitionGates.filter((gate) => gate.complete === true).length}/${demolitionGates.length}` : "—"}</b><small>Tamamlanması yöntem onayı değildir</small></article>
          </div>
          <footer><b>Güvenlik sınırı</b><p>Modül; yöntem ön elemesi ve eksik kanıt listesidir. Patlayıcı miktarı, delik düzeni, ateşleme veya saha operasyon talimatı üretmez.</p></footer>
        </section>
        <section className="coordination-review">
          <header><div><span>V67 / DİSİPLİN ÇAKIŞMA RADARI</span><h4>Issue listesini karar sırasına koyun.</h4></div><div><b>{thread.metrics.critical}</b><small>kritik</small><b>{thread.metrics.review}</b><small>inceleme</small></div></header>
          <div className="coordination-kpis"><article><span>Net tavan</span><b>{thread.canonical.coordination.clearHeight ? `${thread.canonical.coordination.clearHeight.toFixed(2)} m` : "—"}</b></article><article><span>Şaft oranı</span><b>{thread.canonical.coordination.shaftRatio ? `%${thread.canonical.coordination.shaftRatio.toFixed(1)}` : "—"}</b></article><article><span>Taşıma kullanımı</span><b>{thread.canonical.coordination.bearingUtilization ? `%${thread.canonical.coordination.bearingUtilization.toFixed(0)}` : "—"}</b></article><article><span>Açık issue</span><b>{thread.issues.length}</b></article></div>
          <div className="coordination-issues">{thread.issues.slice(0, 6).map((issue) => <Link className={issue.severity} href={issue.route} key={issue.id}><span>{issue.id}</span><div><b>{issue.title}</b><small>{issue.evidence}</small></div><em>{issue.severity === "critical" ? "Kritik" : issue.severity === "review" ? "İncele" : "Bilgi"}</em></Link>)}{!thread.issues.length && <div className="coordination-empty">Mevcut ön değerlendirme verisinde açık disiplin çakışması görünmüyor.</div>}</div>
          <footer><p>Issue kaydı, tasarım ekibinin sorumluluk ve çözüm tarihini belirlemesi için başlangıçtır; otomatik kapanış değildir.</p><Link href="/muhendislik-koordinasyon">Koordinasyon motorunu açın ↗</Link></footer>
        </section>
      </div>}

      {view === "deliverables" && <div className="client-portal-view">
        <div className="client-section-copy"><span>V68 / KURUMSAL TESLİM KALİTE MERKEZİ</span><h4>Okunabilir pafta, açık veri ve izlenebilir indeks.</h4><p>Çıktılar proje kimliği, revizyonu, kurumsal antet ve teknik sınır notlarıyla üretilir.</p></div>
        <div className="delivery-readiness"><article><span>Paket hazırlığı</span><b>%{Math.round((thread.metrics.readiness + thread.metrics.quality + approvedCount * 25) / 3)}</b><small>Modül + kalite + onay bileşik göstergesi</small></article><div>{[["PDF / A3", "Canlı", "Gömülü logo, Unicode font, pafta kimliği"],["CSV", "Canlı", "UTF-8 BOM, başlık ve disiplin indeksi"],["JSON", "Canlı", "Şema, revizyon, modül ve sınır notu"],["DXF", "Modüllerde canlı", "Katmanlı açık CAD değişim formatı"],["DWG", "Lisans bağlantısı", "Gerçek DWG için lisanslı dönüştürücü gerekir"]].map(([format, state, note]) => <article key={format}><b>{format}</b><span>{state}</span><small>{note}</small></article>)}</div></div>
        <div className="delivery-list">{deliverables.map(([title, status, note]) => <article key={title}><div><b>{title}</b><small>{note}</small></div><span>{status}</span></article>)}</div>
        <section className="delivery-package-v86"><header><div><span>V86 / DOSYA DOĞRULAMA ZİNCİRİ</span><b>Boş dosya, revizyon ve koordinat kontrolü.</b></div><strong>{deliveryPackage.summary.valid}/{deliveryPackage.summary.total} hazır</strong></header><div className="delivery-package-v86-grid">{deliveryPackage.checks.map((file) => <article key={file.name}><b>{file.format} · {file.name}</b><span>{file.valid ? "DOĞRULANDI" : "EKSİK"}</span><small>{file.issues.join(" · ") || `${file.sourceModule} kaynağı · ${file.revision}`}</small></article>)}</div></section>
        <div className="delivery-checks">{[["Proje kodu", Boolean(project.id)],["Revizyon", Boolean(project.revision)],["Koordinat referansı", Boolean(project.coordinateReference)],["Teknik sınır notu", true],["Kurumsal antet", true],["Müşteri onayı", approvedCount === 4]].map(([label, pass]) => <span className={pass ? "pass" : ""} key={String(label)}>{pass ? "✓" : "○"} {label}</span>)}</div>
        <div className="portal-export-actions"><button onClick={exportPdf}>Kurumsal PDF <span>↓</span></button><button onClick={exportCsv}>Teslim CSV <span>↓</span></button><button onClick={exportManifest}>Proje JSON <span>↓</span></button></div>
      </div>}

      {view === "assistant" && <div className="client-portal-view">
        <div className="client-section-copy"><span>V71 / KANITA BAĞLI PROJE ASİSTANI</span><h4>Genel cevap değil, mevcut proje kaydından yönlendirme.</h4><p>Bu prototip yalnız proje çekirdeğindeki kuralları, konu kayıtlarını ve teslim durumunu açıklanabilir biçimde özetler; harici karar servisine veri göndermez.</p></div>
        <section className="project-assistant">
          <nav>{([["next","Sırada ne var?"],["risk","En kritik risk"],["evidence","Kanıt yeterli mi?"],["delivery","Teslime hazır mı?"]] as const).map(([id, label]) => <button className={assistantTopic === id ? "active" : ""} onClick={() => setAssistantTopic(id)} key={id}>{label}</button>)}</nav>
          <article><span>ARKEMX / KURAL TABANLI YANIT</span><h4>{assistantResponses[assistantTopic].title}</h4><p>{assistantResponses[assistantTopic].copy}</p><Link href={assistantResponses[assistantTopic].route}>{assistantResponses[assistantTopic].action} ↗</Link></article>
          <aside><b>Yanıt dayanağı</b><span>{thread.metrics.activeCount} aktif modül</span><span>{thread.issues.length} issue kaydı</span><span>{project.events.length} revizyon olayı</span><span>{approvedCount} müşteri onayı</span><Link href="/dokumanlar">Teknik bilgi bankası ↗</Link></aside>
        </section>
        <section className="context-knowledge">
          <header><div><span>V72 / BAĞLAMSAL TEKNİK BİLGİ BANKASI</span><h4>Proje aşamasına göre okunacak kaynağı öne çıkarın.</h4></div><Link href="/dokumanlar">Tüm dokümanları açın ↗</Link></header>
          <div>{[
            ["TBDY 2018", "Deprem tasarımı", thread.nodes.some((node) => node.id === "structural-concept" && node.active) ? "Taşıyıcı model aktif" : "Taşıyıcı aşamasında gerekir"],
            ["TS 498", "Yapı elemanlarının yükleri", thread.canonical.structure.liveLoad ? `${thread.canonical.structure.liveLoad.toFixed(2)} kN/m² hareketli yük girdisi` : "Yük girdisi bekleniyor"],
            ["Binaların Yangından Korunması", "Kaçış ve yangın güvenliği", thread.canonical.architecture.travelDistance ? `${thread.canonical.architecture.travelDistance.toFixed(1)} m kaçış göstergesi` : "Mimari program aşamasında gerekir"],
            ["Planlı Alanlar İmar Yönetmeliği", "Parsel ve yapılaşma", thread.canonical.site.reference,],
            ["ISO 19650", "Bilgi yönetimi ve CDE", thread.nodes.some((node) => node.id === "digital-delivery-scope" && node.active) ? "Teslim kapsamı aktif" : "BEP aşamasında gerekir"],
            ["6331 + Yapı İşleri İSG", "Saha ve yıkım güvenliği", demolitionGates.length ? `${demolitionGates.filter((gate) => gate.complete === true).length}/${demolitionGates.length} güvenlik kapısı` : "Saha/yıkım aşamasında gerekir"],
          ].map(([title, scope, context], index) => <Link href="/dokumanlar" key={title}><span>{String(index + 1).padStart(2, "0")}</span><b>{title}</b><small>{scope}</small><em>{context || "Proje verisi bekleniyor"}</em></Link>)}</div>
          <footer>Resmî mevzuat ve standartların yürürlük durumu, yetkili kurum ve standardizasyon kuruluşunun güncel kaynağından doğrulanmalıdır.</footer>
        </section>
      </div>}

      {view === "asset" && <div className="client-portal-view">
        <div className="client-section-copy"><span>V73 / DİJİTAL YAPI PASAPORTU & İKİZ HAZIRLIĞI</span><h4>Projeyi teslim etmeyin; işletilebilir bilgi bırakın.</h4><p>Varlık verisinin hangi katmanlarının teslim paketine gireceğini seçin ve dijital ikiz için eksik bağlantıları görün.</p></div>
        <div className="asset-passport">{Object.entries({ model: "As-built model", warranty: "Garanti kayıtları", maintenance: "Bakım planları", products: "Ürün ve üretici verisi" }).map(([id, label]) => <label key={id}><input type="checkbox" checked={assets[id as keyof typeof assets]} onChange={() => setAssets((current) => ({ ...current, [id]: !current[id as keyof typeof assets] }))}/><span><b>{label}</b><small>{assets[id as keyof typeof assets] ? "Teslim kapsamına dahil" : "Henüz hazırlanmadı"}</small></span></label>)}</div>
        <section className="twin-readiness">
          <header><div><span>DİJİTAL İKİZ OLGUNLUK KAPILARI</span><h4>%{Math.round((Object.values(assets).filter(Boolean).length / 4) * 55 + (thread.nodes.some((node) => node.id === "model-library-review" && node.active) ? 15 : 0))} hazır</h4></div><Link href="/arkem-x">İkiz senaryolarını açın ↗</Link></header>
          <div>{[
            ["Geometri", assets.model, "As-built BIM / IFC"],
            ["Varlık kimliği", assets.products, "Ürün, seri ve konum"],
            ["Bakım planı", assets.maintenance, "Periyot, sorumlu, görev"],
            ["Garanti", assets.warranty, "Başlangıç, süre, üretici"],
            ["Sensör / IoT", false, "Proje bağlantısı gerekir"],
            ["BMS / enerji", false, "API ve veri sözlüğü gerekir"],
            ["Yetki / güvenlik", false, "Kimlik sağlayıcı kurulumu gerekir"],
          ].map(([label, ready, detail]) => <article className={ready ? "ready" : ""} key={String(label)}><i>{ready ? "✓" : "○"}</i><div><b>{label}</b><small>{detail}</small></div><span>{ready ? "Hazır" : "Bağlantı"}</span></article>)}</div>
          <footer>Canlı sensör, BMS ve enerji verisi olmadan ekran “dijital ikiz” iddiasında bulunmaz; yalnız hazırlık mimarisini gösterir.</footer>
        </section>
      </div>}

      {view === "review" && <div className="client-portal-view">
        <div className="client-section-copy"><span>V74 / XR & ULUSLARARASI PROJE İNCELEME ODASI</span><h4>Aynı modeli, aynı gündemle, herkesin anlayacağı dilde inceleyin.</h4><p>Masaüstü, VR ve AR oturumlarını proje revizyonu, katılımcı rolü, issue listesi ve yedi dilde inceleme paketiyle aynı veri omurgasına bağlayın.</p></div>
        <section className="xr-review-room">
          <header>
            <div><span>İNCELEME OTURUMU</span><h4>{project.id} · {project.revision}</h4><p>{reviewLanguage} / {role} / {reviewMode === "desktop" ? "Masaüstü 3B" : reviewMode.toUpperCase()}</p></div>
            <div className="xr-readiness"><b>%{Math.round((Number(assets.model) + Number(thread.nodes.some((node) => node.id === "engineering-coordination" && node.active)) + Number(Boolean(reviewLanguage)) + Number(approvedCount > 0)) / 4 * 100)}</b><small>oturum hazırlığı</small></div>
          </header>
          <div className="xr-controls">
            <fieldset><legend>İnceleme modu</legend>{([["desktop","Masaüstü 3B"],["vr","VR gözlük"],["ar","AR yerleştirme"]] as const).map(([id, label]) => <button className={reviewMode === id ? "active" : ""} onClick={() => setReviewMode(id)} key={id}>{label}</button>)}</fieldset>
            <label>Toplantı dili<select value={reviewLanguage} onChange={(event) => setReviewLanguage(event.target.value)}>{["Türkçe","English","Azərbaycan dili","Русский","Italiano","Deutsch","Français"].map((language) => <option key={language}>{language}</option>)}</select></label>
          </div>
          <div className="xr-workflow">{[
            ["01", "Model", assets.model ? "As-built / koordinasyon modeli seçili" : "Model paketi bekleniyor", assets.model],
            ["02", "Gündem", `${thread.issues.length} issue · ${decisions.filter((decision) => decision.status === "Açık").length} açık karar`, true],
            ["03", "Deneyim", reviewMode === "desktop" ? "Tarayıcı içinde güvenli ön izleme" : "Cihaz ve WebXR doğrulaması gerekir", reviewMode === "desktop"],
            ["04", "Kayıt", `${project.events.length} revizyon olayı · ${approvedCount}/4 onay`, project.events.length > 0],
          ].map(([code, title, detail, ready]) => <article className={ready ? "ready" : ""} key={String(code)}><span>{code}</span><b>{title}</b><p>{detail}</p><em>{ready ? "Hazır" : "Bağlantı gerekli"}</em></article>)}</div>
          <footer><div><b>Güvenli erişim sınırı</b><p>VR/AR veya çok kullanıcılı canlı oturum; uyumlu cihaz, yayınlanmış model ve rol tabanlı erişim sağlandığında açılır. Site bu bağlantıları varmış gibi göstermez.</p></div><div><Link href="/3b-model-kutuphanesi">3B model kütüphanesi ↗</Link><Link href="/tasarim-calismalari">Tasarım stüdyosu ↗</Link><button onClick={exportReviewBrief}>İnceleme paketini indirin ↓</button></div></footer>
        </section>
      </div>}

      {view === "readiness" && <div className="client-portal-view">
        <div className="client-section-copy"><span>V75 / YATIRIM KARARI & TEKNİK GÖRÜŞME DOSYASI</span><h4>Gösterişli bir puan değil; eksikleriyle birlikte okunabilir proje resmi.</h4><p>Veri hazırlığı, mühendislik kanıtı, paydaş onayı, kalite kapıları ve dijital teslim kapsamını tek karar görünümünde birleştirin.</p></div>
        <section className="readiness-dossier">
          <header><div className="readiness-score"><span>PROJE HAZIR OLUŞ</span><b>%{readinessScore}</b><em>{readinessVerdict}</em></div><div><b>Sıradaki doğrulanabilir adım</b><h4>{thread.nextAction.label}</h4><p>{thread.nextAction.blockedBy.length ? `${thread.nextAction.blockedBy.length} ön koşul tamamlandığında bu adım karar zincirine bağlanır.` : "Mevcut bağlı proje verisine göre doğrudan çalışılabilir."}</p><Link href={thread.nextAction.route}>Çalışma alanını açın ↗</Link></div></header>
          <div className="readiness-pillars">{readinessPillars.map((pillar) => <article key={pillar.code}><span>{pillar.code}</span><b>{pillar.label}</b><div><i style={{ width: `${Math.max(0, Math.min(100, pillar.value))}%` }}></i></div><strong>%{pillar.value}</strong><small>{pillar.note}</small></article>)}</div>
          <div className="readiness-actions">
            <article><span>Karar dosyası</span><b>Denetlenebilir JSON özeti</b><p>Kapılar, issue kayıtları, onaylar, sıradaki adım ve teknik sınırlar birlikte indirilir.</p><button onClick={exportReadinessDossier}>Karar dosyasını indirin ↓</button></article>
            <article><span>Teknik değerlendirme</span><b>Proje verisiyle görüşme gündemi</b><p>Mevcut kayıtları Arkem ekibiyle paylaşmadan önce hangi verinin hazır, hangisinin eksik olduğunu görün.</p><Link href="/iletisim">Teknik görüşme planlayın ↗</Link></article>
            <article><span>Güvence sınırı</span><b>Karar desteği, resmi onay değil</b><p>Bu skor; ruhsat, uygulama projesi, mali teklif, yatırım tavsiyesi veya yetkili mühendis onayı yerine geçmez.</p><Link href="/teknik-altyapi">Teknik altyapıyı inceleyin ↗</Link></article>
          </div>
        </section>
      </div>}

      {view === "integrations" && <div className="client-portal-view"><div className="client-section-copy"><span>V90 / Güvenli entegrasyon sınırı</span><h4>Canlı olanla bağlantı gerektireni açıkça ayırın.</h4><p>API, lisans veya kurumsal protokol gerektiren hiçbir servis çalışıyormuş gibi gösterilmez.</p></div><div className="integration-list">{integrationRows.map(([name, status, detail]) => <article key={name}><div><b>{name}</b><small>{detail}</small></div><span>{status}</span></article>)}</div><section className="integration-security-v90">{INTEGRATION_SECURITY_REGISTRY.map((item) => <article key={item.id}><span>{item.state}</span><b>{item.id}</b><small>{item.scope}</small><small>{item.sendsDataExternally ? "Dış veri aktarımı: bağlantı ve yetki sonrası" : "Dış veri aktarımı yok"}</small></article>)}</section></div>}
    </section>
  </div>;
}
