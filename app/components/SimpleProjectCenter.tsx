"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import {
  ArrowRight, ClipboardList, Download, DraftingCompass,
  FileUp, GitMerge, Layers3, ShieldAlert, Trash2, Wrench, X,
} from "lucide-react";
import { downloadTextFile } from "../lib/engineering";
import { deriveProjectJourneyState, useProjectKernel } from "./ProjectKernel";
import { DigitalProjectHub } from "./DigitalProjectHub";

const quickTools = [
  { label: "Yeni proje oluştur", href: "/proje-baslat", Icon: ClipboardList },
  { label: "Mimari program", href: "/mimari-program-studyosu", Icon: Layers3 },
  { label: "Plan ve aks", href: "/plan-ve-aks", Icon: DraftingCompass },
  { label: "BIM koordinasyon", href: "/bim-koordinasyon", Icon: GitMerge },
  { label: "Proje takibi", href: "/proje-takibi", Icon: Wrench },
] as const;

export function SimpleProjectCenter() {
  const { project, thread, importProject, clearLocalProject } = useProjectKernel();
  const fileRef = useRef<HTMLInputElement>(null);
  const [notice, setNotice] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const hasProject = Object.keys(project.modules).length > 0;
  const journeyState = deriveProjectJourneyState(thread);
  const journeyNextAction = {
    label: journeyState.nextStep.label,
    route: journeyState.nextStep.href,
  };
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

  async function loadProject(file?: File) {
    if (!file) return;
    try {
      const data: unknown = JSON.parse(await file.text());
      const accepted = importProject(data);
      setNotice(accepted
        ? "Proje yüklendi. Proje adı ve bağlı veri alanlarını kontrol edin."
        : "Bu dosya tam ARKEMX proje yedeği değil. Proje JSON dosyasını seçin.");
    } catch {
      setNotice("Dosya okunamadı. Geçerli bir proje JSON dosyası seçin.");
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
    setNotice("Tam proje JSON yedeği indirildi.");
  }

  function removeLocalWorkingCopy() {
    clearLocalProject();
    setDeleteOpen(false);
    setNotice("Bu tarayıcıdaki yerel çalışma kaydı silindi. Hesabınıza kaydedilmiş proje etkilenmedi.");
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
      clearLocalProject();
      setDeleteOpen(false);
      setNotice("Proje hem bu tarayıcıdaki yerel çalışma alanından hem de hesabınızdaki proje listesinden silindi.");
    } catch {
      setNotice("Hesap servisine ulaşılamadı. Yerel çalışma kaydı korunuyor.");
    } finally {
      setDeleteBusy(false);
    }
  }

  return <div className="arx-center-content">
    <section className="arx-center-project" aria-label="Aktif proje">
      <div className="arx-center-project-heading">
        <div>
          <span>AKTİF PROJE</span>
          <h2>{hasProject ? project.name : "Henüz proje seçilmedi"}</h2>
          <p>{hasProject
            ? `${project.id} · ${project.revision} · ${project.phase}`
            : "Yeni bir proje oluşturun veya mevcut proje yedeğinizi yükleyin."}</p>
          {hasProject && projectType ? <small className="arx-center-project-type">Proje türü: {projectType}</small> : null}
        </div>
        <span className="arx-center-storage">Yerel çalışma</span>
      </div>
      <div className="arx-center-actions">
        <Link className="arx-center-primary" href={hasProject ? journeyNextAction.route : "/proje-baslat"}>
          {hasProject ? "Sonraki çalışmaya geç" : "Yeni proje oluştur"} <ArrowRight size={17} aria-hidden="true" />
        </Link>
        <button type="button" onClick={() => fileRef.current?.click()}>
          <FileUp size={18} aria-hidden="true" /> Proje JSON yükle
        </button>
        <button type="button" onClick={exportProject} disabled={!hasProject}
          title={!hasProject ? "Yedek indirmek için önce bir proje oluşturun veya yükleyin." : "Bütün proje modüllerini içeren JSON yedeği"}>
          <Download size={18} aria-hidden="true" /> Proje yedeğini indir
        </button>
        {hasProject ? <button type="button" className="arx-center-delete-trigger" onClick={() => setDeleteOpen((value) => !value)}>
          <Trash2 size={17} aria-hidden="true" /> Aktif projeyi sil
        </button> : null}
        <input ref={fileRef} type="file" accept=".json,application/json"
          className="sr-only" aria-label="ARKEMX proje JSON dosyası seç"
          onChange={(event) => { void loadProject(event.target.files?.[0]); }} />
      </div>
      {deleteOpen && hasProject ? <section className="arx-center-delete-panel" aria-label="Aktif projeyi silme seçenekleri">
        <div>
          <span>PROJEYİ SİL</span>
          <b>{project.name}</b>
          <small>{project.id} · {project.revision}</small>
          <p>Bu işlem proje modüllerindeki mevcut çalışmayı kaldırır. Önce yedek indirmek isterseniz yukarıdaki “Proje yedeğini indir” düğmesini kullanın.</p>
        </div>
        <div className="arx-center-delete-actions">
          <article>
            <button type="button" onClick={removeLocalWorkingCopy} disabled={deleteBusy}>Bu tarayıcıdaki çalışma kaydını sil</button>
            <small>Hesabınıza kaydedilmiş proje etkilenmez.</small>
          </article>
          <article>
            <button type="button" className="danger" onClick={() => { void removeEverywhere(); }} disabled={deleteBusy}>
              {deleteBusy ? "Siliniyor…" : "Projeyi her yerden sil"}
            </button>
            <small>Hem bu tarayıcıdaki çalışma hem de hesabınızdaki proje kaydı silinir.</small>
          </article>
          <button type="button" className="cancel icon-only" onClick={() => setDeleteOpen(false)} disabled={deleteBusy} aria-label="Silme panelini kapat" title="Kapat"><X size={17} aria-hidden="true" /></button>
        </div>
      </section> : null}
      {notice && <p className="arx-center-notice" role="status" aria-live="polite">{notice}</p>}
    </section>

    {hasProject && <section className="arx-center-overview" aria-label="Proje özeti">
      <article><span>Bağlı veri alanı</span><strong>{thread.metrics.activeCount} / {thread.metrics.totalCount}</strong></article>
      <article><span>Kontrol gerektiren konu</span><strong>{thread.issues.length}</strong></article>
      <article><span>Sıradaki çalışma</span><strong className="arx-center-next">{journeyNextAction.label}</strong></article>
    </section>}

    <section className="arx-center-tool-section" aria-labelledby="arx-center-tools-title">
      <div className="arx-center-section-heading">
        <h2 id="arx-center-tools-title">Çalışma araçları</h2>
        <Link href="/">Tüm araçlar <ArrowRight size={16} aria-hidden="true" /></Link>
      </div>
      <div className="arx-center-tool-grid">
        {quickTools.map(({ label, href, Icon }) => <Link key={label} className="arx-center-tool" href={href}>
          <Icon size={23} strokeWidth={1.7} aria-hidden="true" />
          <strong>{label}</strong>
          <ArrowRight size={17} aria-hidden="true" />
        </Link>)}
      </div>
    </section>

    <details className="arx-center-advanced">
      <summary><span><ShieldAlert size={19} strokeWidth={1.7} aria-hidden="true" /> Ayrıntılı proje kontrolleri</span><small>Eksik adımlar, açık konular ve teslim hazırlığı</small></summary>
      <div className="arx-center-advanced-content"><DigitalProjectHub simple /></div>
    </details>
    <p className="arx-center-boundary">Bu ekran proje çalışma kaydını gösterir; teknik inceleme veya resmî onay yerine geçmez.</p>
  </div>;
}
