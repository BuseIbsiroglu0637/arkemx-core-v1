"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { createLayeredDxf, downloadTextFile } from "../lib/engineering";
import {
  deriveGuidedProjectRoadmap,
  GUIDED_DOCUMENT_OPTIONS,
  GUIDED_GATE_LABELS,
  type GuidedDocumentId,
} from "../lib/guided-project";
import { PROJECT_MODULES } from "../lib/project-graph";
import { createCorporateTechnicalPdf } from "../lib/technical-sheet";
import { useLanguage } from "./LanguageSystem";
import { ProjectCoreRegistry } from "./ProjectCoreRegistry";
import { type ProjectIntake, useProjectKernel } from "./ProjectKernel";

const steps = [
  { code: "01", title: "Hedef", copy: "Yatırımın amacını ve çalışma adını belirleyin." },
  { code: "02", title: "Arsa", copy: "Konumu, parsel hazırlığını ve elinizdeki belgeleri işaretleyin." },
  { code: "03", title: "Yapı", copy: "Kullanım, alan ve kat ihtiyacını sade biçimde tanımlayın." },
  { code: "04", title: "Kararlar", copy: "Sistem, bütçe, zaman ve karar önceliklerini kaydedin." },
  { code: "05", title: "Yol Haritası", copy: "Kişisel proje yolunuzu ve doğrulama kapılarını kontrol edin." },
] as const;

const initial: ProjectIntake = {
  name: "",
  projectType: "new",
  usage: "industrial",
  location: "",
  parcelStatus: "unknown",
  targetArea: 1200,
  floors: 1,
  floorHeight: 6,
  system: "undecided",
  priorities: ["safety", "cost"],
  budget: "undecided",
  timeline: "flexible",
  documents: [],
  experienceMode: "guided",
};

const DRAFT_KEY = "arkem-guided-project-draft-v107";

type GuidedProjectDraft = {
  schema: "ARKEM-GUIDED-DRAFT/1.0";
  savedAt: string;
  step: number;
  intake: ProjectIntake;
};

function normalizeDraft(value: unknown): GuidedProjectDraft | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const candidate = value as Partial<GuidedProjectDraft>;
  if (candidate.schema !== "ARKEM-GUIDED-DRAFT/1.0" || !candidate.intake) return null;
  const step = Math.max(0, Math.min(steps.length - 1, Number(candidate.step) || 0));
  return {
    schema: "ARKEM-GUIDED-DRAFT/1.0",
    savedAt: typeof candidate.savedAt === "string" && candidate.savedAt ? candidate.savedAt : new Date(0).toISOString(),
    step,
    intake: { ...initial, ...candidate.intake },
  };
}

function newerDraft(left: GuidedProjectDraft | null, right: GuidedProjectDraft | null) {
  if (!left) return right;
  if (!right) return left;
  const leftTime = Date.parse(left.savedAt) || 0;
  const rightTime = Date.parse(right.savedAt) || 0;
  return rightTime > leftTime ? right : left;
}

const projectTypeLabels: Record<ProjectIntake["projectType"], string> = {
  new: "Yeni yapı yatırımı",
  existing: "Mevcut yapı / dönüşüm",
  demolition: "Kontrollü veya patlatmalı yıkım",
};

const usageLabels: Record<ProjectIntake["usage"], string> = {
  residential: "Konut / villa",
  industrial: "Sanayi / üretim / depo",
  commercial: "Ticari / sosyal yapı",
  agricultural: "Tarımsal yapı",
  mixed: "Karma kullanım",
};

const systemLabels: Record<ProjectIntake["system"], string> = {
  undecided: "ARKEMX karşılaştırsın",
  concrete: "Yerinde dökme betonarme",
  precast: "Betonarme prefabrik",
  steel: "Yapısal çelik",
  light: "Hafif çelik",
  hybrid: "Karma / hibrit sistem",
};

const parcelStatusLabels: Record<ProjectIntake["parcelStatus"], { title: string; copy: string }> = {
  unknown: { title: "Henüz arsa yok", copy: "Bölge veya yatırım alternatifi araştırılıyor." },
  searching: { title: "Arsa araştırılıyor", copy: "Birden fazla konum veya parsel değerlendiriliyor." },
  identified: { title: "Parsel biliniyor", copy: "Konum veya ada/parsel bilgisi mevcut." },
  verified: { title: "Ada/parsel hazır", copy: "Kimlik bilgisi mevcut; resmî geometri yine doğrulanacak." },
};

const budgetLabels: Record<ProjectIntake["budget"], string> = {
  undecided: "Henüz belirlenmedi",
  "under-five": "5 milyon TL altı",
  "five-fifteen": "5–15 milyon TL",
  "fifteen-fifty": "15–50 milyon TL",
  "over-fifty": "50 milyon TL üzeri",
};

const timelineLabels: Record<ProjectIntake["timeline"], string> = {
  urgent: "0–3 ay içinde başlamak",
  "six-months": "3–6 ay içinde başlamak",
  "twelve-months": "6–12 ay içinde başlamak",
  flexible: "Takvim esnek",
};

const priorityOptions = [
  ["safety", "Teknik güvenlik"],
  ["cost", "Yatırım maliyeti"],
  ["time", "Kısa yapım süresi"],
  ["flexibility", "Mimari esneklik"],
  ["carbon", "Düşük karbon"],
  ["operation", "İşletme performansı"],
] as const;

function clampNumber(value: string, min: number, max: number, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.min(max, Math.max(min, parsed)) : fallback;
}

export function ProjectStartStudio() {
  const { project, thread, startProject } = useProjectKernel();
  const { language, translate } = useLanguage();
  const [step, setStep] = useState(0);
  const [intake, setIntake] = useState<ProjectIntake>(initial);
  const [numericDrafts, setNumericDrafts] = useState({
    targetArea: String(initial.targetArea),
    floors: String(initial.floors),
    floorHeight: String(initial.floorHeight),
  });
  const [completed, setCompleted] = useState(false);
  const [notice, setNotice] = useState("");
  const [draftReady, setDraftReady] = useState(false);
  const [draftTransferMessage, setDraftTransferMessage] = useState("");
  const [cloudState, setCloudState] = useState<"idle" | "saving" | "saved" | "login" | "error">("idle");

  const update = <K extends keyof ProjectIntake>(key: K, value: ProjectIntake[K]) => setIntake((current) => ({ ...current, [key]: value }));
  const updateNumericDraft = (key: "targetArea" | "floors" | "floorHeight", rawValue: string, min: number, max: number) => {
    setNumericDrafts((current) => ({ ...current, [key]: rawValue }));
    if (rawValue.trim() === "") return;
    const parsed = Number(rawValue);
    if (!Number.isFinite(parsed) || parsed < min || parsed > max) return;
    update(key, parsed);
  };
  const commitNumericDraft = (key: "targetArea" | "floors" | "floorHeight", min: number, max: number) => {
    const rawValue = numericDrafts[key].trim();
    const currentValue = intake[key];
    const nextValue = rawValue === "" ? currentValue : clampNumber(rawValue, min, max, currentValue);
    update(key, nextValue);
    setNumericDrafts((current) => ({ ...current, [key]: String(nextValue) }));
  };
  const togglePriority = (value: string) => update("priorities", intake.priorities.includes(value) ? intake.priorities.filter((item) => item !== value) : [...intake.priorities, value]);
  const toggleDocument = (value: GuidedDocumentId) => update("documents", intake.documents.includes(value) ? intake.documents.filter((item) => item !== value) : [...intake.documents, value]);
  const stageCounts = useMemo(() => ["Tanım", "Arsa", "Tasarım", "Koordinasyon", "Teslim"].map((stage) => ({ stage, count: PROJECT_MODULES.filter((module) => module.stage === stage).length })), []);
  const roadmap = useMemo(() => deriveGuidedProjectRoadmap(intake), [intake]);
  const floorArea = Math.max(1, intake.targetArea / Math.max(1, intake.floors));
  const conceptWidth = Math.sqrt(floorArea * 1.45);
  const conceptDepth = floorArea / conceptWidth;
  const parcelReviewLabel = intake.parcelStatus === "verified"
    ? "Kullanıcı beyanı: ada/parsel hazır · Resmî doğrulama bekleniyor"
    : intake.parcelStatus === "identified"
      ? "Parsel biliniyor · Resmî doğrulama bekleniyor"
      : parcelStatusLabels[intake.parcelStatus].title;
  const reviewEvidenceItems = Array.from(new Set([
    ...roadmap.verificationItems,
    ...roadmap.missingDocuments.map((item) => `${item} — eksik veya doğrulanacak.`),
  ]));

  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(() => {
      void (async () => {
        let localDraft: GuidedProjectDraft | null = null;
        let accountDraft: GuidedProjectDraft | null = null;

        try {
          const raw = window.localStorage.getItem(DRAFT_KEY);
          if (raw) localDraft = normalizeDraft(JSON.parse(raw));
        } catch {
          // A damaged local draft never blocks project startup.
        }

        try {
          const response = await fetch("/api/project-draft", { cache: "no-store" });
          if (response.ok) {
            const body = await response.json() as { draft?: unknown };
            accountDraft = normalizeDraft(body.draft);
          }
        } catch {
          // Account draft sync is optional in offline/local-only use.
        }

        const selected = newerDraft(localDraft, accountDraft);
        if (!cancelled && selected) {
          const restoredIntake = { ...initial, ...selected.intake } as ProjectIntake;
          setIntake(restoredIntake);
          setNumericDrafts({
            targetArea: String(restoredIntake.targetArea),
            floors: String(restoredIntake.floors),
            floorHeight: String(restoredIntake.floorHeight),
          });
          setStep(selected.step);
          setDraftTransferMessage(
            accountDraft && selected.savedAt === accountDraft.savedAt
              ? "Hesabınızdaki son taslak geri yüklendi."
              : "Bu cihazdaki son taslak geri yüklendi.",
          );
        }
        if (!cancelled) setDraftReady(true);
      })();
    }, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    if (!draftReady || completed) return;
    const timer = window.setTimeout(() => {
      const draft: GuidedProjectDraft = {
        schema: "ARKEM-GUIDED-DRAFT/1.0",
        savedAt: new Date().toISOString(),
        step,
        intake,
      };
      try {
        window.localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
      } catch {
        // Device storage is optional; account sync remains available.
      }
      void fetch("/api/project-draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      }).catch(() => {
        // Local draft remains available when the account service is offline.
      });
    }, 350);
    return () => window.clearTimeout(timer);
  }, [completed, draftReady, intake, step]);

  const exportDraft = () => {
    const draft: GuidedProjectDraft = {
      schema: "ARKEM-GUIDED-DRAFT/1.0",
      savedAt: new Date().toISOString(),
      step,
      intake,
    };
    const safeName = intake.name.trim().toLowerCase().replace(/[^a-z0-9ğüşöçıİĞÜŞÖÇ]+/gi, "-").replace(/^-+|-+$/g, "") || "arkemx-proje";
    downloadTextFile(`${safeName}-taslak.json`, JSON.stringify(draft, null, 2), "application/json;charset=utf-8");
    setDraftTransferMessage("Taslak dosyası indirildi.");
  };

  const importDraftFile = async (file: File | null) => {
    if (!file) return;
    try {
      const parsed = normalizeDraft(JSON.parse(await file.text()));
      if (!parsed) {
        setDraftTransferMessage("Seçilen dosya geçerli bir ARKEMX taslağı değil.");
        return;
      }
      const restoredIntake = { ...initial, ...parsed.intake } as ProjectIntake;
      setIntake(restoredIntake);
      setNumericDrafts({
        targetArea: String(restoredIntake.targetArea),
        floors: String(restoredIntake.floors),
        floorHeight: String(restoredIntake.floorHeight),
      });
      setStep(parsed.step);
      setDraftReady(true);
      setDraftTransferMessage("Taslak dosyası yüklendi.");
    } catch {
      setDraftTransferMessage("Taslak dosyası okunamadı.");
    }
  };

  const canContinue = step === 0
    ? intake.name.trim().length >= 3
    : step === 1
      ? intake.location.trim().length >= 2
      : step === 2
        ? intake.targetArea > 0 && intake.floors > 0 && intake.floorHeight > 0
        : step === 3
          ? intake.priorities.length > 0
          : true;

  const finish = () => {
    if (!canContinue) return;
    startProject(intake);
    setCompleted(true);
    setNotice(`${roadmap.nextAction.title}. Brief, belge hazırlığı ve kişisel yol haritası aynı proje kimliğine kaydedildi.`);
    try {
      window.localStorage.removeItem(DRAFT_KEY);
    } catch {
      // Project kernel already holds the completed intake.
    }
    void fetch("/api/project-draft", { method: "DELETE" }).catch(() => {
      // Completed project remains in the project kernel even if account cleanup is offline.
    });
  };

  const saveToAccount = async () => {
    setCloudState("saving");
    try {
      const response = await fetch("/api/customer-workspace", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "project",
          id: project.id,
          name: project.name,
          phase: project.phase,
          revision: project.revision,
          payload: project,
          expectedAccountUpdatedAt: null,
        }),
      });
      if (response.status === 401) return setCloudState("login");
      if (!response.ok) return setCloudState("error");
      setCloudState("saved");
    } catch {
      setCloudState("error");
    }
  };

  const exportBrief = () => downloadTextFile(
    `${project.id || "arkem"}-proje-briefi.json`,
    JSON.stringify({ schema: "ARKEM-INTAKE/2.0", language, project: { ...intake, floorArea, conceptWidth, conceptDepth }, guidedJourney: roadmap, boundary: translate("Ön değerlendirme verisidir; yetkili proje, imar veya statik hesap değildir.") }, null, 2),
    "application/json",
  );

  const exportCsv = () => {
    const rows = [
      ["Alan", "Değer", "Birim / açıklama"],
      ["Proje adı", intake.name, ""],
      ["Proje türü", projectTypeLabels[intake.projectType], ""],
      ["Kullanım", usageLabels[intake.usage], ""],
      ["Konum", intake.location, "Resmî parsel doğrulaması bekleniyor"],
      ["Parsel hazırlığı", parcelStatusLabels[intake.parcelStatus].title, parcelStatusLabels[intake.parcelStatus].copy],
      ["Hedef brüt alan", String(intake.targetArea), "m²"],
      ["Kat adedi", String(intake.floors), "adet"],
      ["Kat yüksekliği", String(intake.floorHeight), "m"],
      ["Kat başına yaklaşık alan", floorArea.toFixed(2), "m²"],
      ["Ön sistem tercihi", systemLabels[intake.system], ""],
      ["Öncelikler", intake.priorities.join(" | "), ""],
      ["Bütçe aralığı", budgetLabels[intake.budget], "Müşteri hedefi"],
      ["Hedef takvim", timelineLabels[intake.timeline], "Müşteri hedefi"],
      ["Mevcut belgeler", intake.documents.map((id) => GUIDED_DOCUMENT_OPTIONS.find((item) => item.id === id)?.label ?? id).join(" | "), "İçerik doğrulaması bekleniyor"],
      ["Başlangıç veri hazırlığı", String(roadmap.readiness), "%"],
      ["Sıradaki adım", roadmap.nextAction.title, roadmap.nextAction.route],
    ];
    const localizedRows = language === "tr" ? rows : rows.map((row) => row.map((cell) => translate(cell)));
    const suffix = {
      tr: "proje-briefi",
      en: "project-brief",
      az: "layihe-brifi",
      ru: "brief-proekta",
      it: "brief-progetto",
      de: "projektbrief",
      fr: "brief-projet",
    }[language];
    downloadTextFile(`${project.id || "arkem"}-${suffix}.csv`, localizedRows.map((row) => row.map((cell) => `"${String(cell).replaceAll("\"", "\"\"")}"`).join(";")).join("\n"), "text/csv;charset=utf-8");
  };

  const exportDxf = () => {
    const dxf = createLayeredDxf({
      title: `${intake.name} / KAVRAMSAL OTURUM`,
      width: conceptWidth,
      depth: conceptDepth,
      polylines: [{ layer: "KAVRAMSAL_OTURUM", closed: true, points: [{ x: 0, y: 0 }, { x: conceptWidth, y: 0 }, { x: conceptWidth, y: conceptDepth }, { x: 0, y: conceptDepth }] }],
      grid: { baysX: Math.max(1, Math.round(conceptWidth / 6)), baysY: Math.max(1, Math.round(conceptDepth / 6)) },
      notes: [
        `${translate("ARKEMX ön değerlendirme").toUpperCase()} / ${translate(projectTypeLabels[intake.projectType]).toUpperCase()}`,
        `${translate("Brüt alan").toUpperCase()} ${intake.targetArea.toFixed(0)} M2 / ${intake.floors} ${translate("kat").toUpperCase()}`,
        translate("Resmî parsel sınırı veya uygulama projesi değildir.").toUpperCase(),
      ],
      sheet: {
        projectName: intake.name,
        projectCode: project.id,
        module: "PIR / PROJE BRIEFI",
        drawingTitle: "KAVRAMSAL YAPI OTURUMU",
        drawingNo: "PIR-001",
        revision: project.revision,
        status: "BASLANGIC / ON DEGERLENDIRME",
        coordinateSystem: intake.location || "KONUM DOGRULAMASI BEKLIYOR",
        scale: "MODEL 1:1",
        preparedBy: "ARKEMX",
        checkedBy: "PROJEYE OZEL",
      },
    });
    downloadTextFile(`${project.id || "arkem"}-kavramsal-oturum.dxf`, dxf, "application/dxf");
  };
  const exportPdf = async () => {
    const pdf = await createCorporateTechnicalPdf({
      projectName: intake.name,
      projectCode: project.id,
      module: "ARKEMX / PROJE BRİFİ",
      drawingTitle: "Kavramsal Yapı Oturumu ve Başlangıç Paftası",
      drawingSubtitle: `${projectTypeLabels[intake.projectType]} / ${usageLabels[intake.usage]}`,
      revision: project.revision,
      status: "Başlangıç / ön değerlendirme",
      sheetNo: "PIR-001",
      scale: "OTOMATIK / METRE",
      coordinateSystem: intake.location || "Konum doğrulaması bekliyor",
      polylines: [{
        role: "primary",
        points: [{ x: 0, y: 0 }, { x: conceptWidth, y: 0 }, { x: conceptWidth, y: conceptDepth }, { x: 0, y: conceptDepth }],
      }],
      metrics: [
        ["Hedef brüt alan", `${intake.targetArea.toFixed(0)} m²`],
        ["Kat adedi", `${intake.floors}`],
        ["Kat yüksekliği", `${intake.floorHeight.toFixed(2)} m`],
        ["Kat başına alan", `${floorArea.toFixed(1)} m²`],
        ["Ön oturum", `${conceptWidth.toFixed(1)} × ${conceptDepth.toFixed(1)} m`],
        ["Sistem tercihi", systemLabels[intake.system]],
        ["Karar önceliği", `${intake.priorities.length} başlık`],
        ["Yol haritası hazırlığı", `%${roadmap.readiness}`],
      ],
      notes: [
        `Proje türü: ${projectTypeLabels[intake.projectType]}; kullanım: ${usageLabels[intake.usage]}.`,
        `Başlangıç konumu: ${intake.location}; resmî parsel ve imar doğrulaması sonraki aşamadadır.`,
        `Parsel hazırlığı: ${parcelStatusLabels[intake.parcelStatus].title}; bütçe: ${budgetLabels[intake.budget]}; hedef: ${timelineLabels[intake.timeline]}.`,
        `Sıradaki adım: ${roadmap.nextAction.title}.`,
        `Öncelikler: ${intake.priorities.join(", ") || "Tanımlanmadı"}.`,
        "Kavramsal oturum, hedef alan üzerinden türetilmiştir; mimari program, parsel ve taşıyıcı kararlarıyla güncellenmelidir.",
      ],
      legend: [["Kavramsal yapı oturumu", "primary"]],
    });
    downloadTextFile(`${project.id || "arkem"}-kurumsal-baslangic-pafta.pdf`, pdf, "application/pdf");
  };

  if (completed) {
    return <section className="start-success" aria-live="polite">
      <header><span>ARKEMX / PROJE ÇEKİRDEĞİ HAZIR</span><b>{project.id}</b></header>
      <div className="start-success-main">
        <div><i>✓</i><p className="eyebrow">Başlangıç Tamamlandı</p><h2>{intake.name}</h2><p>{notice}</p></div>
        <aside><span>PROJE HAZIRLIĞI</span><strong>%{roadmap.readiness}</strong><p>{thread.metrics.activeCount} çalışma alanı başlangıç verisiyle bağlı. Sonraki teknik adım aynı proje kaydını kullanacak.</p></aside>
      </div>
      <div className="start-success-flow">{stageCounts.map((item, index) => <article key={item.stage}><span>{String(index + 1).padStart(2, "0")}</span><b>{item.stage}</b><small>{item.count} veri alanı</small>{index < stageCounts.length - 1 && <i aria-hidden="true">→</i>}</article>)}</div>
      <div className="start-success-summary">
        <article><span>Sıradaki doğru adım</span><b>{roadmap.nextAction.title}</b><small>{roadmap.nextAction.copy}</small></article>
        <article><span>Program</span><b>{intake.targetArea.toLocaleString("tr-TR")} m² · {intake.floors} kat</b><small>{usageLabels[intake.usage]}</small></article>
        <article><span>Karar çerçevesi</span><b>{budgetLabels[intake.budget]}</b><small>{timelineLabels[intake.timeline]} · {intake.priorities.length} öncelik</small></article>
      </div>
      <section className="start-roadmap-result">
        <header><div><span>V107 / KİŞİSEL PROJE YOLU</span><h3>Kişisel proje yol haritanız</h3><p>Her kapı, mevcut beyanı resmî doğrulama ve uzman incelemesinden açıkça ayırır.</p></div><strong>%{roadmap.readiness}<small>Başlangıç veri hazırlığı</small></strong></header>
        <div className="start-roadmap-gates">{roadmap.gates.map((gate, index) => <article className={`status-${gate.status}`} key={gate.id}><i>{String(index + 1).padStart(2, "0")}</i><div><span>{GUIDED_GATE_LABELS[gate.status]}</span><b>{gate.label}</b><small>{gate.detail}</small></div><Link href={gate.route} aria-label={`${gate.label} çalışma alanını açın`}>↗</Link></article>)}</div>
        {reviewEvidenceItems.length > 0 && <aside className="start-missing-documents"><span>EKSİK / DOĞRULANACAK VERİLER VE BELGELER</span><ul>{reviewEvidenceItems.map((item) => <li key={item}>{item}</li>)}</ul></aside>}
      </section>
      <ProjectCoreRegistry compact />
      <div className="start-success-actions"><Link className="button copper" href={roadmap.nextAction.route}>{roadmap.nextAction.title} <span>→</span></Link><Link className="button navy" href="/dijital-proje-merkezi">Proje Çalışma Alanını Aç <span>↗</span></Link></div>
      <div className="start-account-save">
        <div><span>CİHAZLAR ARASI DEVAMLILIK</span><b>Projeyi Arkem hesabınıza bağlayın.</b><p>Bu cihazdaki bütünlük denetimli kayıt korunur. Hesaba kaydettiğinizde proje müşteri çalışma alanınızda da görünür.</p></div>
        <button type="button" onClick={saveToAccount} disabled={cloudState === "saving" || cloudState === "saved"}>
          <span key={cloudState}>{cloudState === "saving" ? "Kaydediliyor…" : cloudState === "saved" ? "Hesaba kaydedildi ✓" : "Projeyi hesabıma kaydet"}</span>
        </button>
        {cloudState === "login" && <p><Link href="/giris">Önce müşteri hesabınıza giriş yapın →</Link></p>}
        {cloudState === "error" && <p>Hesap kaydı tamamlanamadı; proje bu cihazda güvende. Daha sonra müşteri alanından yeniden deneyebilirsiniz.</p>}
      </div>
      <div className="start-export-panel"><div><span>İLK TEKNİK PAKET</span><b>Kurumsal pafta ve izlenebilir başlangıç verisi</b><p>PDF ve CAD paftaları aynı proje kodu, revizyon ve teknik sınır bilgisiyle oluşturulur. Resmî parsel ve tasarım geometrisi doğrulandıkça paket güncellenir.</p></div><button onClick={exportPdf}>Kurumsal PDF ↓</button><button onClick={exportDxf}>CAD / DXF ↓</button><button onClick={exportBrief}>Proje JSON ↓</button><button onClick={exportCsv}>Düzenli CSV ↓</button></div>
    </section>;
  }

  return <section className="project-start-studio" data-testid="project-start-studio">
    {thread.metrics.activeCount > 0 && <div className="start-resume-banner"><div><span>AKTİF PROJE BULUNDU</span><b>{project.name}</b><small>{project.id} · {thread.metrics.activeCount} veri alanı bağlı</small></div><Link href="/dijital-proje-merkezi">Çalışmaya devam edin ↗</Link></div>}
    <header className="project-start-head">
      <div><p className="eyebrow light">ARKEMX / Yönlendirmeli Başlangıç</p><h2>Teknik bilgi gerekmez.<br/><em>Doğru soruyla başlayın.</em></h2></div>
      <p>Beş sade adımda ihtiyacı, parsel hazırlığını, bütçeyi ve hedef süreyi tanımlayın. ARKEMX yalnızca mevcut veriye göre kişisel yol haritası oluşturur; resmî bilgi olmayan yerde sonuç uydurmaz.</p>
      <div className="start-mode-switch" role="group" aria-label="Proje başlangıç görünümü">
        <span>KULLANIM DÜZEYİ</span>
        <button type="button" className={intake.experienceMode === "guided" ? "active" : ""} aria-pressed={intake.experienceMode === "guided"} onClick={() => update("experienceMode", "guided")}><b>Müşteri görünümü</b><small>Yalnız gerekli kararlar</small></button>
        <button type="button" className={intake.experienceMode === "technical" ? "active" : ""} aria-pressed={intake.experienceMode === "technical"} onClick={() => update("experienceMode", "technical")}><b>Uzman görünümü</b><small>Teknik girdiler görünür</small></button>
      </div>
    </header>
    <nav className="project-start-steps" aria-label="Proje başlatma adımları">{steps.map((item, index) => <button type="button" key={item.code} className={`${index === step ? "active " : ""}${index < step ? "passed" : ""}`.trim()} onClick={() => index <= step && setStep(index)} aria-current={index === step ? "step" : undefined}><i>{index < step ? "✓" : item.code}</i><span><b>{item.title}</b><small>{item.copy}</small></span></button>)}</nav>
    <div className="project-start-workspace">
      <aside><span>ADIM {steps[step].code} / 05</span><h3>{steps[step].title}</h3><p>{steps[step].copy}</p><div><small>VERİ AKTARIMI</small><b>{step === 0 ? "Brief + proje kimliği" : step === 1 ? "GIS + belge hazırlığı" : step === 2 ? "Mimari program + alan hedefi" : step === 3 ? "MCDA + bütçe + takvim" : "Kişisel yol haritası + aşama kapıları"}</b></div><div className="start-draft-state"><small>TASLAK</small><b>Taslak cihazda ve oturum açıksa hesabınızda otomatik kaydedilir</b><span>%{roadmap.readiness} hazırlık</span><div className="start-draft-transfer"><button type="button" onClick={exportDraft}>Taslağı indir</button><label>Taslak yükle<input type="file" accept=".json,application/json" onChange={(event) => { void importDraftFile(event.target.files?.[0] ?? null); event.currentTarget.value = ""; }}/></label></div>{draftTransferMessage ? <em role="status">{draftTransferMessage}</em> : null}</div></aside>
      <section className="project-start-form">
        {step === 0 && <div className="start-fieldset"><label><span>Projeye verilecek çalışma adı</span><input autoFocus value={intake.name} onChange={(event) => update("name", event.target.value)} placeholder="Örn. Arifiye üretim tesisi" /></label><fieldset><legend>Proje türü</legend>{(Object.keys(projectTypeLabels) as ProjectIntake["projectType"][]).map((value) => <button type="button" className={intake.projectType === value ? "selected" : ""} onClick={() => update("projectType", value)} key={value}><i>{intake.projectType === value ? "✓" : "+"}</i><b>{projectTypeLabels[value]}</b></button>)}</fieldset></div>}
        {step === 1 && <div className="start-fieldset"><label><span>İlk konum bilgisi</span><input autoFocus value={intake.location} onChange={(event) => update("location", event.target.value)} placeholder="İl / ilçe veya bilinen mevki" /></label><fieldset className="start-parcel-options"><legend>Arsa / parsel hangi durumda?</legend>{(Object.keys(parcelStatusLabels) as ProjectIntake["parcelStatus"][]).map((value) => <button type="button" className={intake.parcelStatus === value ? "selected" : ""} aria-pressed={intake.parcelStatus === value} onClick={() => update("parcelStatus", value)} key={value}><i>{intake.parcelStatus === value ? "✓" : "+"}</i><span><b>{parcelStatusLabels[value].title}</b><small>{parcelStatusLabels[value].copy}</small></span></button>)}</fieldset><fieldset className="start-document-grid"><legend>Şu anda elinizde olanlar</legend>{GUIDED_DOCUMENT_OPTIONS.map((item) => <button type="button" className={intake.documents.includes(item.id) ? "selected" : ""} aria-pressed={intake.documents.includes(item.id)} onClick={() => toggleDocument(item.id)} key={item.id}><i>{intake.documents.includes(item.id) ? "✓" : "+"}</i><span><b>{item.short}</b><small>{item.label}</small></span></button>)}</fieldset><div className="start-info-card"><i>GIS</i><div><b>Belge var demek doğrulandı demek değildir</b><p>Parsel geometrisi TKGM/MEGSİS veya yetkili harita verisiyle; imar hakları ise plan, belediye/e-Plan kaynağı ve gerektiğinde uzman incelemesiyle doğrulanır.</p></div></div></div>}
        {step === 2 && <div className="start-fieldset"><label><span>Yapı kullanımı</span><select value={intake.usage} onChange={(event) => update("usage", event.target.value as ProjectIntake["usage"])}>{(Object.keys(usageLabels) as ProjectIntake["usage"][]).map((value) => <option value={value} key={value}>{usageLabels[value]}</option>)}</select></label><div className="start-number-grid"><label><span>Hedef brüt alan</span><input type="number" min="20" max="1000000" value={numericDrafts.targetArea} onChange={(event) => updateNumericDraft("targetArea", event.target.value, 20, 1_000_000)} onBlur={() => commitNumericDraft("targetArea", 20, 1_000_000)}/><small>m²</small></label><label><span>Kat adedi</span><input type="number" min="1" max="100" value={numericDrafts.floors} onChange={(event) => updateNumericDraft("floors", event.target.value, 1, 100)} onBlur={() => commitNumericDraft("floors", 1, 100)}/><small>kat</small></label>{intake.experienceMode === "technical" && <label><span>Hedef kat yüksekliği</span><input type="number" step=".1" min="2.4" max="30" value={numericDrafts.floorHeight} onChange={(event) => updateNumericDraft("floorHeight", event.target.value, 2.4, 30)} onBlur={() => commitNumericDraft("floorHeight", 2.4, 30)}/><small>m</small></label>}</div>{intake.experienceMode === "guided" && <details className="start-technical-details"><summary>İsteğe bağlı teknik ayrıntı</summary><label><span>Hedef kat yüksekliği</span><input type="number" step=".1" min="2.4" max="30" value={numericDrafts.floorHeight} onChange={(event) => updateNumericDraft("floorHeight", event.target.value, 2.4, 30)} onBlur={() => commitNumericDraft("floorHeight", 2.4, 30)}/><small>m</small></label><p>Bilmiyorsanız değiştirmeyin; kullanım türüne göre başlangıç değeri uzman incelemesinde güncellenir.</p></details>}<div className="start-live-metric"><span>KAT BAŞINA YAKLAŞIK ALAN</span><b>{floorArea.toLocaleString("tr-TR", { maximumFractionDigits: 0 })} m²</b><small>Kesin yerleşim parsel ve mimari program aşamasında oluşur.</small></div></div>}
        {step === 3 && <div className="start-fieldset"><div className="start-decision-grid"><label><span>Ön taşıyıcı sistem tercihi</span><select value={intake.system} onChange={(event) => update("system", event.target.value as ProjectIntake["system"])}>{(Object.keys(systemLabels) as ProjectIntake["system"][]).map((value) => <option value={value} key={value}>{systemLabels[value]}</option>)}</select></label><label><span>Yaklaşık yatırım bütçesi</span><select value={intake.budget} onChange={(event) => update("budget", event.target.value as ProjectIntake["budget"])}>{(Object.keys(budgetLabels) as ProjectIntake["budget"][]).map((value) => <option value={value} key={value}>{budgetLabels[value]}</option>)}</select></label><label><span>Hedef başlangıç</span><select value={intake.timeline} onChange={(event) => update("timeline", event.target.value as ProjectIntake["timeline"])}>{(Object.keys(timelineLabels) as ProjectIntake["timeline"][]).map((value) => <option value={value} key={value}>{timelineLabels[value]}</option>)}</select></label></div><fieldset><legend>Kararda öncelikli olanlar</legend>{priorityOptions.map(([value, label]) => <button type="button" className={intake.priorities.includes(value) ? "selected" : ""} aria-pressed={intake.priorities.includes(value)} onClick={() => togglePriority(value)} key={value}><i>{intake.priorities.includes(value) ? "✓" : "+"}</i><b>{label}</b></button>)}</fieldset><p className="start-boundary">Bütçe, süre ve sistem bilgileri müşteri hedefidir. Keşif, iş programı veya nihai taşıyıcı sistem kararı sayılmaz; parsel, zemin, açıklık, deprem, yangın, üretim ve tedarik verileriyle doğrulanır.</p></div>}
        {step === 4 && <div className="start-review"><header><span>V107 / KİŞİSEL PROJE YOLU</span><b>Kontrol edin; sonra tek çalışma alanını oluşturun.</b><strong><small>BAŞLANGIÇ VERİ HAZIRLIĞI</small>%{roadmap.readiness}</strong></header><dl><div><dt>Proje</dt><dd>{intake.name}</dd></div><div><dt>Tür</dt><dd>{projectTypeLabels[intake.projectType]}</dd></div><div><dt>Konum / parsel</dt><dd>{intake.location} · {parcelReviewLabel}</dd></div><div><dt>Program</dt><dd>{usageLabels[intake.usage]} · {intake.targetArea.toLocaleString("tr-TR")} m² · {intake.floors} kat</dd></div><div><dt>Sistem</dt><dd>{systemLabels[intake.system]}</dd></div><div><dt>Bütçe / takvim</dt><dd>{budgetLabels[intake.budget]} · {timelineLabels[intake.timeline]}</dd></div></dl><section className="start-review-next"><span>SIRADAKİ DOĞRU ADIM</span><h4>{roadmap.nextAction.title}</h4><p>{roadmap.nextAction.copy}</p></section><div className="start-roadmap-gates">{roadmap.gates.map((gate, index) => <article className={`status-${gate.status}`} key={gate.id}><i>{String(index + 1).padStart(2, "0")}</i><div><span>{GUIDED_GATE_LABELS[gate.status]}</span><b>{gate.label}</b><small>{gate.detail}</small></div></article>)}</div>{reviewEvidenceItems.length > 0 && <aside className="start-missing-documents"><span>EKSİK / DOĞRULANACAK VERİLER VE BELGELER</span><ul>{reviewEvidenceItems.map((item) => <li key={item}>{item}</li>)}</ul></aside>}</div>}
        {!canContinue && <p className="start-validation" role="alert">Bu adımın zorunlu bilgisini tamamlayın.</p>}
        <footer className="project-start-actions"><button type="button" onClick={() => setStep((current) => Math.max(0, current - 1))} disabled={step === 0}>← Geri</button>{step < steps.length - 1 ? <button type="button" className="primary" disabled={!canContinue} onClick={() => setStep((current) => Math.min(steps.length - 1, current + 1))}>Sonraki adım →</button> : <button type="button" className="primary" onClick={finish}>ARKEMX projesini başlat →</button>}</footer>
      </section>
    </div>
    <footer className="project-start-foot"><b>VERİ SINIRI</b><p>Bu çalışma cihazınızda saklanan bir ön proje oturumudur. Resmî parsel, imar, ruhsat, statik hesap, maliyet ve uygulama onayı değildir. Yetkili disiplinlerin doğrulaması proje ilerledikçe karar kayıtlarına eklenir.</p></footer>
  </section>;
}
