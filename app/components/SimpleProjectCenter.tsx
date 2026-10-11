"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  ArrowRight, Check, Download, FileUp, FolderOpen,
  MoreHorizontal, ShieldAlert, Trash2, X,
} from "lucide-react";
import { downloadTextFile } from "../lib/engineering";
import { PROJECT_JOURNEY, deriveProjectJourneyState, useProjectKernel } from "./ProjectKernel";
import { PROJECT_MODULES } from "../lib/project-graph";
import { DigitalProjectHub } from "./DigitalProjectHub";

type CenterAccountProject = {
  id: string;
  name: string;
  phase: string;
  revision: string;
  status: string;
  updatedAt: string;
  payload?: unknown;
};

const ACCOUNT_SYNC_SUPPRESSION_KEY = "arkem-account-sync-suppressed-projects-v1";

const journeyDescriptions: Record<(typeof PROJECT_JOURNEY)[number]["short"], string> = {
  Brief: "Proje hedefini ve temel ihtiyacı netleştirin.",
  Arazi: "Konum, parsel ve saha verilerini doğrulayın.",
  Mimari: "Alan programını ve plan kararlarını geliştirin.",
  Sistem: "Taşıyıcı sistem ve yöntem kararını netleştirin.",
  Koordinasyon: "Mühendislik disiplinlerini ortak modelde koordine edin.",
  Planlama: "Süre, maliyet ve proje takibini yönetin.",
  Teslim: "Kontrolleri tamamlayın ve dijital teslim paketini hazırlayın.",
};

function provisionalJourneyLabel(short: (typeof PROJECT_JOURNEY)[number]["short"]) {
  return short === "Arazi"
    ? "Çalışıldı · imar doğrulaması bekliyor"
    : "Çalışıldı · üst kontrol bekliyor";
}

export function SimpleProjectCenter() {
  const { project, thread, importProject, clearLocalProject, persistence } = useProjectKernel();
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const projectsRef = useRef<HTMLDivElement>(null);
  const operationsRef = useRef<HTMLDivElement>(null);
  const [notice, setNotice] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [operationsOpen, setOperationsOpen] = useState(false);
  const [projectsOpen, setProjectsOpen] = useState(false);
  const [accountProjects, setAccountProjects] = useState<CenterAccountProject[]>([]);
  const [projectsState, setProjectsState] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [projectSwitchBusy, setProjectSwitchBusy] = useState("");
  const [newProjectBusy, setNewProjectBusy] = useState(false);
  const hasProject = Object.keys(project.modules).length > 0;
  const journeyState = deriveProjectJourneyState(thread);
  const completedCount = journeyState.completed.filter(Boolean).length;
  const remainingCount = Math.max(0, PROJECT_JOURNEY.length - completedCount);
  // Current location comes from verified stage evidence, not the latest
  // persistence event. Background/autosave updates must never move the visible
  // journey forward on their own.
  const workingJourneyIndex = journeyState.workingIndex;

  const workedJourneyIndices = new Set<number>();
  const architecturalProgram = project.modules["architectural-program"] as { spaces?: unknown[]; input?: { programRequirementsConfirmed?: boolean } } | undefined;
  const planEditor = project.modules["plan-editor"] as { elements?: unknown[]; floorPlates?: unknown[]; floorCount?: number } | undefined;
  if (
    Boolean(architecturalProgram?.input?.programRequirementsConfirmed)
    || Boolean(architecturalProgram?.spaces?.length)
    || Boolean(planEditor?.elements?.length)
    || Boolean(planEditor?.floorPlates?.length)
    || Boolean(planEditor?.floorCount && planEditor.floorCount > 0)
  ) workedJourneyIndices.add(2);

  const systemComparison = project.modules["system-comparison"] as { ranking?: unknown[] } | undefined;
  if (Boolean(systemComparison?.ranking?.length) || project.modules["structural-concept"]) workedJourneyIndices.add(3);

  const currentJourneyStep = PROJECT_JOURNEY[workingJourneyIndex];
  const architectureMilestoneReady = Boolean(thread.nodes.find((node) => node.id === "architectural-program")?.milestoneComplete);
  const planMilestoneReady = Boolean(thread.nodes.find((node) => node.id === "plan-editor")?.milestoneComplete);
  const journeyNextAction = journeyState.allComplete
    ? { label: "Teslim kontrollerini gözden geçir", route: "#arx-project-controls" }
    : journeyState.hasBacklog
      ? { label: thread.nextAction.label, route: thread.nextAction.route }
      : currentJourneyStep.short === "Arazi"
        ? { label: thread.nextAction.label, route: thread.nextAction.route }
        : currentJourneyStep.short === "Mimari" && architectureMilestoneReady && !planMilestoneReady
          ? { label: "Plan ve aksı tamamla", route: "/plan-ve-aks" }
          : { label: journeyState.nextStep.label, route: journeyState.nextStep.href };
  const storageLabel = persistence.state === "loading"
    ? "Çalışma kaydı kontrol ediliyor"
    : persistence.state === "unavailable"
      ? "Yerel kayıt kullanılamıyor"
      : "Bu cihazda kayıtlı";
  useEffect(() => {
    if (!operationsOpen && !projectsOpen) return;

    const closeOnOutsidePointer = (event: PointerEvent) => {
      const target = event.target as Node;
      if (operationsOpen && !operationsRef.current?.contains(target)) setOperationsOpen(false);
      if (projectsOpen && !projectsRef.current?.contains(target)) setProjectsOpen(false);
    };

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOperationsOpen(false);
        setProjectsOpen(false);
      }
    };

    document.addEventListener("pointerdown", closeOnOutsidePointer);
    document.addEventListener("keydown", closeOnEscape);

    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePointer);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [operationsOpen, projectsOpen]);

  const projectType = (() => {
    const decision = project.modules["decision-assistant"];
    if (!decision || typeof decision !== "object" || Array.isArray(decision)) return "";
    const input = (decision as Record<string, unknown>).input;
    if (!input || typeof input !== "object" || Array.isArray(input)) return "";
    const value = (input as Record<string, unknown>).projectType;
    return value === "new"
      ? "Yeni yapı yatırımı"
      : value === "existing"
        ? "Mevcut yapı / dönüşüm"
        : value === "demolition"
          ? "Yıkım / yeniden geliştirme"
          : "";
  })();

  function openProjectControls() {
    const controls = document.getElementById("arx-project-controls") as HTMLDetailsElement | null;
    if (!controls) return;
    controls.open = true;
    window.requestAnimationFrame(() => {
      const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      controls.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
    });
  }

  function activeProjectIsAccountSuppressed() {
    if (!hasProject || !project.id) return false;
    try {
      const raw = window.localStorage.getItem(ACCOUNT_SYNC_SUPPRESSION_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) && parsed.includes(project.id);
    } catch {
      return false;
    }
  }

  async function loadAccountProjects() {
    setProjectsState("loading");
    try {
      const response = await fetch("/api/customer-workspace", { cache: "no-store" });
      const body = await response.json().catch(() => ({})) as { projects?: CenterAccountProject[]; error?: string };
      if (!response.ok) {
        setProjectsState("error");
        setNotice(response.status === 401
          ? "Projelerinizi çalışma alanında görmek için giriş yapmanız gerekiyor."
          : body.error || "Hesabınızdaki projeler yüklenemedi.");
        return false;
      }
      setAccountProjects(Array.isArray(body.projects) ? body.projects : []);
      setProjectsState("ready");
      return true;
    } catch {
      setProjectsState("error");
      setNotice("Hesap servisine ulaşılamadı. Proje listesi yüklenemedi.");
      return false;
    }
  }

  async function toggleProjectsMenu() {
    const nextOpen = !projectsOpen;
    setProjectsOpen(nextOpen);
    setOperationsOpen(false);
    setDeleteOpen(false);
    if (nextOpen && projectsState !== "loading") await loadAccountProjects();
  }

  async function persistCurrentProjectBeforeSwitch() {
    if (!hasProject) return true;
    if (activeProjectIsAccountSuppressed()) {
      setNotice("Aktif proje yalnız bu cihazda tutuluyor. Başka projeye geçmeden önce Hesabım sayfasından projeyi hesabınıza yeniden ekleyin.");
      return false;
    }
    const accountProject = accountProjects.find((item) => item.id === project.id);
    setNotice("Mevcut projenin son durumu hesabınıza kaydediliyor…");
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
          expectedAccountUpdatedAt: accountProject?.updatedAt ?? null,
        }),
      });
      const body = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) {
        setNotice(body.error || "Mevcut proje güvenli biçimde kaydedilemedi. Proje değiştirilmedi.");
        return false;
      }
      return true;
    } catch {
      setNotice("Hesap servisine ulaşılamadı. Veri kaybını önlemek için proje değiştirilmedi.");
      return false;
    }
  }

  async function switchAccountProject(item: CenterAccountProject) {
    if (item.id === project.id || projectSwitchBusy) return;
    setProjectSwitchBusy(item.id);
    try {
      const preserved = await persistCurrentProjectBeforeSwitch();
      if (!preserved) return;
      if (!item.payload || !importProject(item.payload)) {
        setNotice("Seçilen proje çalışma alanına yüklenemedi.");
        return;
      }
      setProjectsOpen(false);
      setNotice(`${item.name} aktif proje olarak açıldı.`);
    } finally {
      setProjectSwitchBusy("");
    }
  }

  async function startAnotherProject() {
    if (newProjectBusy) return;
    if (!hasProject) {
      router.push("/proje-baslat?new=1&fresh=1");
      return;
    }

    if (activeProjectIsAccountSuppressed()) {
      setNotice("Aktif proje yalnız bu cihazda tutuluyor. Yeni proje başlatmadan önce Hesabım sayfasından projeyi hesabınıza yeniden ekleyin.");
      setProjectsOpen(false);
      setOperationsOpen(false);
      return;
    }

    setNewProjectBusy(true);
    setOperationsOpen(false);
    setProjectsOpen(false);
    setNotice("Mevcut proje hesabınıza güvenli biçimde kaydediliyor…");

    try {
      const workspaceResponse = await fetch("/api/customer-workspace", { cache: "no-store" });
      if (workspaceResponse.status === 401) {
        setNotice("Yeni proje başlatmadan önce mevcut projeyi korumak için giriş yapın veya proje yedeğini indirin.");
        return;
      }

      const workspace = await workspaceResponse.json().catch(() => ({})) as {
        projects?: Array<{ id: string; updatedAt?: string }>;
        error?: string;
      };
      if (!workspaceResponse.ok) {
        setNotice(workspace.error || "Mevcut proje hesabınızda doğrulanamadı. Yeni proje başlatılmadı.");
        return;
      }

      const accountProject = workspace.projects?.find((item) => item.id === project.id);
      const saveResponse = await fetch("/api/customer-workspace", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "project",
          id: project.id,
          name: project.name,
          phase: project.phase,
          revision: project.revision,
          payload: project,
          expectedAccountUpdatedAt: accountProject?.updatedAt ?? null,
        }),
      });
      const body = await saveResponse.json().catch(() => ({})) as { error?: string };

      if (!saveResponse.ok) {
        setNotice(body.error || "Mevcut proje hesaba kaydedilemedi. Veri kaybını önlemek için yeni proje başlatılmadı.");
        return;
      }

      setNotice("Mevcut proje hesabınıza kaydedildi. Yeni proje formu açılıyor…");
      router.push("/proje-baslat?new=1&fresh=1");
    } catch {
      setNotice("Hesap servisine ulaşılamadı. Veri kaybını önlemek için yeni proje başlatılmadı.");
    } finally {
      setNewProjectBusy(false);
    }
  }

  async function loadProject(file?: File) {
    if (!file) return;
    try {
      const data: unknown = JSON.parse(await file.text());
      const accepted = importProject(data);
      setNotice(accepted
        ? "Proje yedeği yüklendi. Proje adı ve bağlı veri alanlarını kontrol edin."
        : "Bu dosya tam ARKEMX proje yedeği değil. ARKEMX proje JSON dosyasını seçin.");
    } catch {
      setNotice("Dosya okunamadı. Geçerli bir ARKEMX proje yedeği seçin.");
    }
    if (fileRef.current) fileRef.current.value = "";
  }

  function exportProject() {
    if (!hasProject) return;
    downloadTextFile(
      `${project.id}-${project.revision}.arkem.json`,
      JSON.stringify(project, null, 2),
      "application/json",
    );
    setNotice("Proje verileri yedeği indirildi. Büyük kabuk hesap kayıtları bu dosyada yok; bu cihazın tarayıcı deposunda tutuluyor.");
    setOperationsOpen(false);
  }

  async function removeLocalWorkingCopy() {
    if(deleteBusy)return;
    setDeleteBusy(true);
    try{
      await clearLocalProject();
      setDeleteOpen(false);
      setOperationsOpen(false);
      setNotice("Bu tarayıcıdaki çalışma ve kabuk hesap kayıtları silindi. Hesabınıza kaydedilmiş proje etkilenmedi.");
    }catch(e){setNotice("Yerel kayıt silinemedi: "+(e instanceof Error?e.message:"depo hatası"));}
    finally{setDeleteBusy(false);}
  }

  async function removeEverywhere() {
    if (!hasProject || deleteBusy) return;
    setDeleteBusy(true);
    setNotice("Proje yerel çalışma alanından ve hesabınızdan siliniyor…");
    try {
      const response = await fetch(`/api/customer-workspace?resource=project&id=${encodeURIComponent(project.id)}`, {
        method: "DELETE",
      });
      const body = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) {
        setNotice(body.error || "Hesaptaki proje kaydı silinemedi. Yerel çalışma kaydı korunuyor.");
        return;
      }
      try{await clearLocalProject();}
      catch(e){setNotice("Hesap kaydı silindi; bu cihazdaki silme tamamlanamadı: "+(e instanceof Error?e.message:"depo hatası"));return;}
      setDeleteOpen(false);
      setOperationsOpen(false);
      setNotice("Proje hem bu tarayıcıdaki çalışma alanından hem de hesabınızdaki proje listesinden silindi.");
    } catch {
      setNotice("Hesap servisine ulaşılamadı. Yerel çalışma kaydı korunuyor.");
    } finally {
      setDeleteBusy(false);
    }
  }

  return <div className="arx-center-content">
    <section className={`arx-center-project ${hasProject ? "has-project" : "is-empty"}`} aria-label="Aktif proje">
      <div className="arx-center-project-heading">
        <div>
          <span>{hasProject ? "AKTİF PROJE" : "PROJE SEÇİMİ"}</span>
          <h2>{hasProject ? project.name : "Henüz aktif projeniz yok"}</h2>
          <p>{hasProject
            ? `${project.id} · ${project.revision} · ${project.phase}`
            : "Yeni bir proje başlatın, hesabınızdaki bir projeyi açın veya ARKEMX proje yedeğinizi yükleyin."}</p>
          {hasProject && projectType ? <small className="arx-center-project-type">{projectType}</small> : null}
        </div>
        {hasProject ? <span className={`arx-center-storage is-${persistence.state}`}><i aria-hidden="true"></i>{storageLabel}</span> : null}
      </div>

      <div className="arx-center-actions">
        <Link className="arx-center-primary" href={hasProject ? journeyNextAction.route : "/proje-baslat"}>
          <span>
            <small>{hasProject ? "SIRADAKİ ADIM" : "BAŞLANGIÇ"}</small>
            <b>{hasProject ? journeyNextAction.label : "Yeni Proje Başlat"}</b>
          </span>
          <ArrowRight size={18} aria-hidden="true" />
        </Link>

        {!hasProject ? <Link href="/hesabim">
          <FolderOpen size={18} aria-hidden="true" /> Hesabımdaki Projeleri Aç
        </Link> : null}

        {!hasProject ? <button type="button" onClick={() => fileRef.current?.click()}>
          <FileUp size={18} aria-hidden="true" /> Proje Yedeği Yükle
        </button> : null}

        {hasProject ? <div className="arx-center-projects-wrap" ref={projectsRef}>
          <button type="button" className="arx-center-projects-trigger" aria-expanded={projectsOpen}
            aria-haspopup="dialog" aria-controls="arx-project-switcher"
            onClick={() => { void toggleProjectsMenu(); }}>
            <FolderOpen size={18} aria-hidden="true" /> Projelerim
            {projectsState === "ready" ? <small>{accountProjects.length}</small> : null}
          </button>
          {projectsOpen ? <div id="arx-project-switcher" className="arx-center-projects-menu" role="dialog" aria-label="Hesabımdaki projeler">
            <header>
              <div><span>PROJELERİM</span><b>Projeler arasında geçiş yapın</b></div>
              <button type="button" onClick={() => setProjectsOpen(false)} aria-label="Projelerim menüsünü kapat"><X size={15} aria-hidden="true" /></button>
            </header>

            <div className="arx-center-projects-list">
              {projectsState === "loading" ? <p className="arx-center-projects-state">Projeler yükleniyor…</p> : null}
              {projectsState === "error" ? <div className="arx-center-projects-state">
                <p>Proje listesi şu anda yüklenemedi.</p>
                <button type="button" onClick={() => { void loadAccountProjects(); }}>Tekrar dene</button>
              </div> : null}
              {projectsState === "ready" && accountProjects.length === 0 ? <p className="arx-center-projects-state">Hesabınıza kayıtlı başka proje bulunmuyor.</p> : null}
              {projectsState === "ready" ? [...accountProjects]
                .sort((left, right) => Number(right.id === project.id) - Number(left.id === project.id))
                .map((item) => {
                const active = item.id === project.id;
                return <article key={item.id} className={active ? "is-active" : undefined}>
                  <div>
                    <span className="arx-center-project-switch-title">
                      <b>{item.name}</b>
                      {active ? <em><i aria-hidden="true"></i> Aktif</em> : null}
                    </span>
                    <small>{item.id} · {item.revision} · {item.phase}</small>
                  </div>
                  {active
                    ? <span className="arx-center-project-switch-current">Şu anda açık</span>
                    : <button type="button" onClick={() => { void switchAccountProject(item); }} disabled={Boolean(projectSwitchBusy)}>
                      {projectSwitchBusy === item.id ? "Açılıyor…" : "Aç"}
                    </button>}
                </article>;
              }) : null}
            </div>

            <footer>
              <button type="button" onClick={() => { void startAnotherProject(); }} disabled={newProjectBusy}>
                {newProjectBusy ? "Mevcut proje kaydediliyor…" : "+ Yeni Proje Başlat"}
              </button>
              <Link href="/hesabim" onClick={() => setProjectsOpen(false)}>Tüm projeleri Hesabım&apos;da gör →</Link>
            </footer>
          </div> : null}
        </div> : null}

        {hasProject ? <button type="button" className="arx-center-new-project" onClick={() => { void startAnotherProject(); }} disabled={newProjectBusy}>
          {newProjectBusy ? "Mevcut proje kaydediliyor…" : "+ Yeni Proje"}
        </button> : null}

        {hasProject ? <div className="arx-center-more-wrap" ref={operationsRef}>
          <button type="button" className="arx-center-more-trigger" aria-expanded={operationsOpen}
            aria-haspopup="menu" aria-controls="arx-project-operations-menu"
            onClick={() => { setOperationsOpen((value) => !value); setProjectsOpen(false); setDeleteOpen(false); }}>
            <MoreHorizontal size={19} aria-hidden="true" /> Proje işlemleri
          </button>
          {operationsOpen ? <div id="arx-project-operations-menu" className="arx-center-more-menu" role="menu">
            <button type="button" onClick={() => { setOperationsOpen(false); void toggleProjectsMenu(); }}><FolderOpen size={16} aria-hidden="true" /> Başka proje aç</button>
            <button type="button" onClick={() => { void startAnotherProject(); }} disabled={newProjectBusy}><span aria-hidden="true">＋</span> Yeni proje başlat</button>
            <button type="button" onClick={() => { setOperationsOpen(false); fileRef.current?.click(); }}><FileUp size={16} aria-hidden="true" /> Başka yedek yükle</button>
            <button type="button" onClick={exportProject}><Download size={16} aria-hidden="true" /> Proje yedeğini indir</button>
            <button type="button" className="danger" onClick={() => { setOperationsOpen(false); setDeleteOpen(true); }}><Trash2 size={16} aria-hidden="true" /> Aktif projeyi sil</button>
          </div> : null}
        </div> : null}

        <input ref={fileRef} type="file" accept=".json,application/json"
          className="sr-only" aria-label="ARKEMX proje yedeği seç"
          onChange={(event) => { void loadProject(event.target.files?.[0]); }} />
      </div>

      {deleteOpen && hasProject ? <section className="arx-center-delete-panel" aria-label="Aktif projeyi silme seçenekleri">
        <div>
          <span>PROJEYİ SİL</span>
          <b>{project.name}</b>
          <small>{project.id} · {project.revision}</small>
          <p>Bu işlem proje modüllerindeki çalışmayı ve bu cihazdaki kabuk hesap kayıtlarını kaldırır. “Proje yedeğini indir” dosyası büyük kabuk hesap sonuçlarını içermez.</p>
        </div>
        <div className="arx-center-delete-actions">
          <article>
            <button type="button" onClick={removeLocalWorkingCopy} disabled={deleteBusy}>Yalnız bu cihazdaki kaydı sil</button>
            <small>Hesabınıza kaydedilmiş proje etkilenmez.</small>
          </article>
          <article>
            <button type="button" className="danger" onClick={() => { void removeEverywhere(); }} disabled={deleteBusy}>
              {deleteBusy ? "Siliniyor…" : "Projeyi her yerden sil"}
            </button>
            <small>Bu cihazdaki çalışma ve hesabınızdaki proje kaydı silinir.</small>
          </article>
          <button type="button" className="cancel icon-only" onClick={() => setDeleteOpen(false)} disabled={deleteBusy} aria-label="Silme panelini kapat" title="Kapat"><X size={17} aria-hidden="true" /></button>
        </div>
      </section> : null}

      {notice && <p className="arx-center-notice" role="status" aria-live="polite">{notice}</p>}
    </section>

    {hasProject ? <>
      <section className="arx-center-journey" aria-labelledby="arx-center-journey-title">
        <div className="arx-center-section-heading">
          <div>
            <span>PROJE YOLCULUĞU</span>
            <h2 id="arx-center-journey-title">Neredeyiz?</h2>
          </div>
          <small>{completedCount} / {PROJECT_JOURNEY.length} ana aşama tamamlandı · aktif çalışma {workingJourneyIndex + 1} / {PROJECT_JOURNEY.length} · {PROJECT_MODULES.length} teknik modül</small>
        </div>
        <div className="arx-center-journey-track">
          {PROJECT_JOURNEY.map((step, index) => {
            const done = journeyState.completed[index];
            const achieved = journeyState.achieved[index] || workedJourneyIndices.has(index);
            const current = index === workingJourneyIndex && !journeyState.allComplete;
            const provisional = index < workingJourneyIndex && achieved && !done;
            const backlog = index < workingJourneyIndex && !achieved;
            const state = current ? "current" : done ? "done" : provisional ? "provisional" : backlog ? "backlog" : "upcoming";
            return <Link key={step.short} href={step.href} className={`arx-center-journey-step is-${state}`}
              aria-current={current ? "step" : undefined}>
              <i aria-hidden="true">{done ? <Check size={13} strokeWidth={2.4} /> : index + 1}</i>
              <span><b>{step.short}</b><small>{current ? "Şu an buradasın" : done ? "Tamamlandı" : provisional ? provisionalJourneyLabel(step.short) : backlog ? "Eksik kontrol var" : "Henüz başlanmadı"}</small></span>
            </Link>;
          })}
        </div>
      </section>

      <section className="arx-center-overview" aria-label="Proje özeti">
        <article><span>Çalışılan ana aşama</span><strong>{workingJourneyIndex + 1} / {PROJECT_JOURNEY.length}</strong><small>{completedCount} ana aşama tamamlandı · {PROJECT_MODULES.length} teknik modül</small></article>
        <article><span>Açık konu</span><strong className={thread.issues.length ? "watch" : "good"}>{thread.issues.length}</strong><small>kontrol bekleyen kayıt</small></article>
        <article><span>Veri hazırlığı</span><strong>%{thread.metrics.readiness}</strong><small>bağlı proje verisi</small></article>
      </section>

      {thread.issues.length > 0 ? <section className={`arx-center-issue-banner ${thread.metrics.critical > 0 ? "is-critical" : ""}`} aria-label="Kontrol bekleyen konular">
        <ShieldAlert size={19} strokeWidth={1.8} aria-hidden="true" />
        <div>
          <b>{thread.issues.length} konu işlem bekliyor</b>
          <small>{thread.metrics.critical > 0 ? `${thread.metrics.critical} kritik kayıt öncelikli olarak gözden geçirilmeli.` : "Ayrıntılı proje kontrollerinden eksik ve açık konuları inceleyebilirsiniz."}</small>
        </div>
        <button type="button" onClick={openProjectControls}>Kontrolleri aç</button>
      </section> : null}

      <section className="arx-center-next-work" aria-labelledby="arx-center-next-title">
        <div>
          <span>{journeyState.hasBacklog ? "ÖNCELİKLİ EKSİK" : "SIRADAKİ ADIM"}</span>
          <h2 id="arx-center-next-title">{journeyNextAction.label}</h2>
          <p>{journeyState.hasBacklog ? "Proje daha ileri bir aşamada çalışılıyor; bu geriye dönük kontrol kapanmadan proje zinciri tamamlanmış sayılmaz." : journeyDescriptions[journeyState.nextStep.short]}</p>
        </div>
        <Link href={journeyNextAction.route}>Çalışmaya Devam Et <ArrowRight size={17} aria-hidden="true" /></Link>
      </section>

      <section className="arx-center-step-section" aria-labelledby="arx-center-steps-title">
        <div className="arx-center-section-heading">
          <div>
            <span>7 ANA AŞAMA</span>
            <h2 id="arx-center-steps-title">Çalışma akışı</h2>
          </div>
          <small>{PROJECT_MODULES.length} teknik modül bu ana aşamalar altında aynı proje kaydını kullanır.</small>
        </div>
        <div className="arx-center-step-grid">
          {PROJECT_JOURNEY.map((step, index) => {
            const done = journeyState.completed[index];
            const achieved = journeyState.achieved[index] || workedJourneyIndices.has(index);
            const current = index === workingJourneyIndex && !journeyState.allComplete;
            const provisional = index < workingJourneyIndex && achieved && !done;
            const backlog = index < workingJourneyIndex && !achieved;
            return <Link key={step.short} href={step.href} className={`arx-center-step-card ${current ? "is-current" : done ? "is-done" : provisional ? "is-provisional" : backlog ? "is-backlog" : ""}`}>
              <span>{String(index + 1).padStart(2, "0")} / {step.short.toUpperCase()}</span>
              <b>{step.label}</b>
              <p>{journeyDescriptions[step.short]}</p>
              <small>{current ? "Şu an çalışılıyor →" : done ? "Tamamlandı ✓" : provisional ? provisionalJourneyLabel(step.short) : backlog ? "Eksik kontrol var" : "Henüz başlanmadı"}</small>
            </Link>;
          })}
        </div>
      </section>
    </> : null}

    <details id="arx-project-controls" className="arx-center-advanced">
      <summary>
        <span><ShieldAlert size={19} strokeWidth={1.7} aria-hidden="true" /> Proje Kontrolleri</span>
        <small>{hasProject
          ? `${thread.issues.length} açık konu · ${remainingCount} eksik adım · ${journeyState.allComplete ? "Teslim akışı tamamlandı" : "Teslim henüz hazır değil"}`
          : "Aktif proje seçildikten sonra kontroller burada görünür."}</small>
      </summary>
      <div className="arx-center-advanced-content"><DigitalProjectHub simple /></div>
    </details>

    <p className="arx-center-boundary">Bu ekran proje çalışma kaydını ve yönlendirici kontrolleri gösterir; teknik inceleme veya resmî onay yerine geçmez.</p>
  </div>;
}
