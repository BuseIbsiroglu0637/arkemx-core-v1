"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  derivePortalProjectSections,
  derivePortalWorkItems,
  hasMeaningfulProject,
  readPortalDecisions,
  resolveProjectRecord,
  type AccountProjectRecord,
  type PortalLoadState,
} from "../lib/customer-portal";
import { formatProjectDateTime } from "../lib/date-format";
import { downloadTextFile } from "../lib/engineering";
import { useProjectKernel } from "./ProjectKernel";

type PortalView = "today" | "project" | "records";

type WorkspaceData = {
  user: { displayName: string; email: string };
  profile: null | {
    displayName: string;
    company: string;
    phone: string;
    preferredLanguage: string;
  };
  projects: AccountProjectRecord[];
  meetings: Array<{
    id: string;
    projectId: string;
    subject: string;
    meetingAt: string;
    channel: string;
    status: string;
    notes: string;
  }>;
  activities: Array<{
    id: number;
    eventType: string;
    title: string;
    detail: string;
    createdAt: string;
  }>;
};

const portalViews: Array<{
  id: PortalView;
  index: string;
  label: string;
  short: string;
}> = [
  { id: "today", index: "01", label: "Bugün", short: "Sıradaki iş" },
  { id: "project", index: "02", label: "Projem", short: "Tek proje özeti" },
  { id: "records", index: "03", label: "Kararlar ve Dosyalar", short: "Kayıtlar" },
];

const trustLabels = {
  verified: "Doğrulandı",
  declared: "Beyan",
  derived: "Ön değerlendirme",
  missing: "Eksik",
} as const;

export function ClientProjectPortal({
  account,
}: {
  account?: { displayName: string; email: string };
}) {
  const {
    project,
    thread,
    core,
    hydrated,
    persistence,
    patchModule,
    importProject,
  } = useProjectKernel();
  const [view, setView] = useState<PortalView>("today");
  const [loadState, setLoadState] = useState<PortalLoadState>("loading");
  const [workspace, setWorkspace] = useState<WorkspaceData | null>(null);
  const [recordMessage, setRecordMessage] = useState("");
  const [decisionText, setDecisionText] = useState("");
  const [decisionOwner, setDecisionOwner] = useState("Proje sahibi");
  const [decisionTarget, setDecisionTarget] = useState("");

  const loadWorkspace = useCallback(async () => {
    setLoadState("loading");
    setRecordMessage("");
    try {
      const response = await fetch("/api/customer-workspace", { cache: "no-store" });
      const body = await response.json() as WorkspaceData & { error?: string };
      if (response.status === 401) {
        setWorkspace(null);
        setLoadState("signed-out");
        return;
      }
      if (!response.ok) {
        setLoadState("error");
        setRecordMessage(body.error || "Hesap kayıtları yüklenemedi.");
        return;
      }
      setWorkspace(body);
      setLoadState("ready");
    } catch {
      setLoadState("error");
      setRecordMessage("Bağlantı kurulamadı. Bu cihazdaki proje korunuyor.");
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => { void loadWorkspace(); }, 0);
    return () => window.clearTimeout(timer);
  }, [loadWorkspace]);

  const accountProjects = useMemo(() => workspace?.projects ?? [], [workspace?.projects]);
  const effectiveLoadState = hydrated ? loadState : "loading";
  const recordState = useMemo(
    () => resolveProjectRecord(project, accountProjects, effectiveLoadState),
    [accountProjects, effectiveLoadState, project],
  );
  const meaningfulProject = hasMeaningfulProject(project);
  const workItems = useMemo(
    () => derivePortalWorkItems(project, thread),
    [project, thread],
  );
  const projectSections = useMemo(
    () => derivePortalProjectSections(core),
    [core],
  );
  const decisions = useMemo(() => readPortalDecisions(project), [project]);

  const saveProjectToAccount = async () => {
    if (loadState === "signed-out") {
      window.location.assign("/giris?return_to=%2Fmusteri-proje-portali");
      return;
    }
    setRecordMessage("Hesap kaydı güncelleniyor…");
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
          expectedAccountUpdatedAt: recordState.matchingProject?.updatedAt ?? null,
        }),
      });
      const body = await response.json() as { error?: string };
      if (!response.ok) {
        const error = body.error || "Proje hesabınıza kaydedilemedi.";
        if (response.status === 409) await loadWorkspace();
        setRecordMessage(error);
        return;
      }
      setRecordMessage("Bu cihazdaki sürüm hesabınıza kaydedildi.");
      await loadWorkspace();
    } catch {
      setRecordMessage("Bağlantı kurulamadı; cihazdaki proje değişmedi.");
    }
  };

  const openAccountProject = (accountProject: AccountProjectRecord) => {
    if (!accountProject.payload) {
      setRecordMessage("Hesap projesinin veri paketi doğrulanamadı; cihaz kaydı değiştirilmedi.");
      return;
    }
    const imported = importProject(accountProject.payload);
    setRecordMessage(imported
      ? `${accountProject.name} bu cihazda açıldı.`
      : "Hesap projesi doğrulanamadı; cihaz kaydı değiştirilmedi.");
  };

  const addDecision = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const text = decisionText.trim();
    if (!text) return;
    const next = [{
      id: `DEC-${Date.now().toString(36).toUpperCase()}`,
      text,
      owner: decisionOwner,
      status: "Açık",
      target: decisionTarget || "Tarih belirlenmedi",
      createdAt: new Date().toISOString(),
    }, ...decisions].slice(0, 30);
    patchModule("client-portal", {
      decisions: next,
      status: "Müşteri karar kaydı etkin",
    });
    setDecisionText("");
    setDecisionTarget("");
  };

  const toggleDecision = (id: string) => {
    const next = decisions.map((decision) => decision.id === id
      ? { ...decision, status: decision.status === "Kapalı" ? "Açık" : "Kapalı" }
      : decision);
    patchModule("client-portal", { decisions: next });
  };

  const downloadProjectSummary = () => {
    downloadTextFile(
      `${project.id}-${project.revision}-musteri-ozeti.json`,
      JSON.stringify({
        schema: "ARKEM-CUSTOMER-PORTAL/2.0",
        generatedAt: new Date().toISOString(),
        project: {
          id: project.id,
          name: project.name,
          phase: project.phase,
          revision: project.revision,
        },
        readiness: thread.metrics,
        nextAction: thread.nextAction,
        fields: core.fields,
        decisions,
        limits: "Müşteri görünümüdür; resmî imar belgesi, uygulama projesi veya yetkili mühendis onayı değildir.",
      }, null, 2),
      "application/json",
    );
  };

  const downloadDecisionRegister = () => {
    const rows = [
      ["Karar No", "Karar", "Sorumlu", "Durum", "Hedef"],
      ...decisions.map((decision) => [
        decision.id,
        decision.text,
        decision.owner,
        decision.status,
        decision.target,
      ]),
    ];
    const csv = `\uFEFF${rows.map((row) => row
      .map((value) => `"${String(value).replaceAll('"', '""')}"`)
      .join(";"))
      .join("\n")}`;
    downloadTextFile(
      `${project.id}-${project.revision}-karar-kaydi.csv`,
      csv,
      "text/csv;charset=utf-8",
    );
  };

  return <div className="v108-portal" data-portal-state={recordState.state}>
    <header className="v108-portal-head">
      <div>
        <span>ARKEMX / MÜŞTERİ PORTALI V108</span>
        <h2>{meaningfulProject ? project.name : "Proje çalışma alanınız"}</h2>
        <p>{meaningfulProject
          ? `${project.id} · ${project.revision} · ${project.phase}`
          : "Teknik bilgi gerekmeden, sıradaki doğru adımdan başlayın."}</p>
      </div>
      <div className="v108-portal-score" aria-label={`Proje hazırlığı yüzde ${thread.metrics.readiness}`}>
        <span>PROJE HAZIRLIĞI</span>
        <b>%{thread.metrics.readiness}</b>
        <small>{thread.metrics.activeCount}/{thread.metrics.totalCount} modül bağlı</small>
      </div>
    </header>

    <nav className="v108-primary-nav" aria-label="Müşteri portalı bölümleri" role="tablist">
      {portalViews.map((item) => <button
        type="button"
        role="tab"
        aria-selected={view === item.id}
        className={view === item.id ? "active" : ""}
        onClick={() => setView(item.id)}
        key={item.id}
      >
        <span>{item.index}</span>
        <b>{item.label}</b>
        <small>{item.short}</small>
      </button>)}
    </nav>

    <section className={`v108-record-state is-${recordState.state}`} aria-live="polite">
      <div className="v108-record-copy">
        <span>HESAP VE CİHAZ KAYITLARI</span>
        <h3>{recordState.label}</h3>
        <p>{recordState.detail}</p>
        {recordMessage && <small>{recordMessage}</small>}
      </div>
      <div className="v108-record-meta">
        <span><b>Cihaz</b>{persistence.state === "loading" ? "Yükleniyor" : persistence.state === "unavailable" ? "Kayıt kullanılamıyor" : "Taslak korunuyor"}</span>
        <span><b>Hesap</b>{loadState === "loading" ? "Yükleniyor" : loadState === "ready" ? `${accountProjects.length} proje` : loadState === "signed-out" ? "Giriş yapılmadı" : "Bağlantı hatası"}</span>
      </div>
      <div className="v108-record-actions">
        {recordState.state === "loading" && <div className="v108-record-skeleton" aria-label="Yükleniyor"><i></i><i></i></div>}
        {recordState.state === "empty" && <Link href="/proje-baslat">İlk projenizi başlatın <span>→</span></Link>}
        {recordState.state === "device-only" && (loadState === "signed-out"
          ? <Link href="/giris?return_to=%2Fmusteri-proje-portali">Hesabıma giriş yap <span>→</span></Link>
          : <button type="button" onClick={() => { void saveProjectToAccount(); }}>Hesabıma kaydet <span>→</span></button>)}
        {recordState.state === "aligned" && <button type="button" onClick={() => { void saveProjectToAccount(); }}>Hesap kaydını güncelle <span>↻</span></button>}
        {recordState.state === "account-only" && recordState.accountProjectCount > 0 && <button type="button" onClick={() => setView("project")}>Hesap projelerini göster <span>→</span></button>}
        {recordState.state === "conflict" && <>
          <button type="button" onClick={() => { void saveProjectToAccount(); }}>Cihaz sürümünü hesabıma kaydet</button>
          {recordState.matchingProject && <button className="secondary" type="button" onClick={() => openAccountProject(recordState.matchingProject!)}>Hesap sürümünü bu cihazda aç</button>}
        </>}
        {recordState.state === "error" && <button type="button" onClick={() => { void loadWorkspace(); }}>Bağlantıyı yeniden dene <span>↻</span></button>}
      </div>
    </section>

    <div className="v108-portal-stage" role="tabpanel">
      {view === "today" && <section className="v108-today">
        {!meaningfulProject ? <div className="v108-empty-state">
          <span>BUGÜN</span>
          <h3>Önce projenizi kısaca tanımlayın.</h3>
          <p>Kullanım, yaklaşık alan, konum ve önceliklerinizi girin. Sistem size izlenecek ilk doğrulanabilir adımı gösterecek.</p>
          <Link href="/proje-baslat">Yönlendirmeli başlangıcı açın <span>→</span></Link>
        </div> : <>
          <div className="v108-next-action">
            <div>
              <span>SIRADAKİ DOĞRU ADIM</span>
              <h3>{thread.nextAction.label}</h3>
              <p>Mevcut proje kayıtlarına göre şimdi tamamlanabilir ilk çalışma.</p>
            </div>
            <Link href={thread.nextAction.route}>Çalışmaya devam edin <span>→</span></Link>
          </div>
          <div className="v108-today-grid">
            <section>
              <header><span>BUGÜNÜN İŞLERİ</span><b>{workItems.length} açık kayıt</b></header>
              <div className="v108-work-list">{workItems.map((item) => <article className={`is-${item.tone}`} key={item.id}>
                <i></i>
                <div>
                  <span>{item.status}</span>
                  <h4>{item.title}</h4>
                  <p>{item.detail}</p>
                  <dl><div><dt>Sorumlu</dt><dd>{item.owner}</dd></div><div><dt>Hedef</dt><dd>{item.target}</dd></div></dl>
                </div>
                <Link href={item.route} aria-label={`${item.title} kaydını aç`}>→</Link>
              </article>)}</div>
            </section>
            <aside className="v108-today-summary">
              <span>PROJE NABZI</span>
              <div><b>%{thread.metrics.quality}</b><small>veri kalitesi</small></div>
              <ul>
                <li><span>Doğrulanmış alan</span><b>{core.metrics.verified}</b></li>
                <li><span>Eksik alan</span><b>{core.metrics.missing}</b></li>
                <li><span>Kritik kayıt</span><b>{thread.metrics.critical}</b></li>
                <li><span>Açık karar</span><b>{decisions.filter((item) => item.status !== "Kapalı").length}</b></li>
              </ul>
              <button type="button" onClick={() => setView("project")}>Proje özetini açın →</button>
            </aside>
          </div>
        </>}
      </section>}

      {view === "project" && <section className="v108-project">
        <header className="v108-section-head">
          <div><span>PROJEM</span><h3>Teknik ayrıntıdan önce anlaşılır proje resmi.</h3></div>
          <div><b>{core.metrics.complete}/{core.metrics.total}</b><small>temel bilgi hazır</small></div>
        </header>
        {!meaningfulProject ? <div className="v108-empty-state compact">
          <h3>Özetlenecek aktif proje yok.</h3>
          <Link href="/proje-baslat">Proje briefini oluşturun →</Link>
        </div> : <>
          <div className="v108-project-identity">
            <div><span>PROJE KİMLİĞİ</span><h4>{project.name}</h4><p>{project.id} · {project.revision} · {project.phase}</p></div>
            <dl>
              <div><dt>Son cihaz kaydı</dt><dd>{persistence.lastSavedAt ? formatProjectDateTime(persistence.lastSavedAt) : "Hazırlanıyor"}</dd></div>
              <div><dt>Veri kaynağı</dt><dd>{persistence.integrity === "verified" ? "Doğrulanmış cihaz zarfı" : "Yerel çalışma kaydı"}</dd></div>
            </dl>
          </div>
          <div className="v108-project-sections">{projectSections.map((section) => <article className={`is-${section.trust}`} key={section.id}>
            <header><span>{trustLabels[section.trust]}</span><b>{section.label}</b><small>{section.status}</small></header>
            <div>{section.fields.slice(0, 2).map((field) => <p key={field.id}><span>{field.label}</span><b>{field.value}</b></p>)}</div>
            <Link href={section.route}>Çalışma alanını açın →</Link>
          </article>)}</div>
          <details className="v108-technical-details">
            <summary>Teknik kaynak ve güven ayrıntılarını göster <span>{core.fields.length} kayıt</span></summary>
            <div>{core.fields.map((field) => <article key={`${field.id}-${field.sourceModule}`}>
              <div><span className={`is-${field.trust}`}>{trustLabels[field.trust]}</span><b>{field.label}</b><p>{field.value}</p></div>
              <aside><small>{field.sourceLabel}</small><p>{field.boundary}</p></aside>
            </article>)}</div>
          </details>
        </>}
        {accountProjects.length > 0 && <section className="v108-account-projects">
          <header><div><span>HESAPTAKİ PROJELER</span><h4>Bir projeyi yalnız siz seçtiğinizde bu cihazda açın.</h4></div><b>{accountProjects.length}</b></header>
          <div>{accountProjects.map((item) => <article key={item.id}>
            <div><span>{item.revision}</span><b>{item.name}</b><small>{item.id} · {item.phase} · {formatProjectDateTime(item.updatedAt)}</small></div>
            <button type="button" disabled={!item.payload} onClick={() => openAccountProject(item)}>Bu cihazda aç</button>
          </article>)}</div>
        </section>}
      </section>}

      {view === "records" && <section id="kararlar-ve-dosyalar" className="v108-records">
        <header className="v108-section-head">
          <div><span>KARARLAR VE DOSYALAR</span><h3>Kim, neyi, ne zamana kadar sonuçlandıracak?</h3></div>
          <div><b>{decisions.filter((item) => item.status !== "Kapalı").length}</b><small>açık karar</small></div>
        </header>
        <div className="v108-records-grid">
          <section className="v108-decisions">
            <header><span>KARAR KAYDI</span><b>Yeni karar ekleyin</b></header>
            <form onSubmit={addDecision}>
              <label>Karar veya beklenen onay<textarea required value={decisionText} onChange={(event) => setDecisionText(event.target.value)} placeholder="Örn. Hafif çelik ve betonarme seçeneklerinin maliyet karşılaştırması onaylanacak."/></label>
              <div>
                <label>Sorumlu<select value={decisionOwner} onChange={(event) => setDecisionOwner(event.target.value)}><option>Proje sahibi</option><option>Arkem mühendislik</option><option>Mimari ekip</option><option>Yüklenici</option></select></label>
                <label>Hedef tarih<input type="date" value={decisionTarget} onChange={(event) => setDecisionTarget(event.target.value)}/></label>
              </div>
              <button type="submit">Kararı kaydet <span>→</span></button>
            </form>
            <div className="v108-decision-list">{decisions.length ? decisions.map((decision) => <article className={decision.status === "Kapalı" ? "is-closed" : ""} key={decision.id}>
              <span>{decision.id}</span>
              <div><b>{decision.text}</b><small>{decision.owner} · {decision.target}</small></div>
              <button type="button" onClick={() => toggleDecision(decision.id)}>{decision.status}</button>
            </article>) : <p>Henüz karar kaydı yok. İlk onay veya sorumluluk kaydını ekleyin.</p>}</div>
          </section>
          <aside className="v108-files">
            <header><span>DOSYALAR VE RAPORLAR</span><b>İndirilebilir proje kayıtları</b></header>
            <article><div><span>JSON</span><b>Müşteri proje özeti</b><small>Kaynak, güven, sıradaki adım ve kararlar</small></div><button type="button" onClick={downloadProjectSummary}>İndir ↓</button></article>
            <article><div><span>CSV</span><b>Karar kayıt listesi</b><small>Sorumlu, durum ve hedef tarihi</small></div><button type="button" onClick={downloadDecisionRegister}>İndir ↓</button></article>
            <article><div><span>PDF / DXF</span><b>Teknik teslim paketi</b><small>Kurumsal pafta ve açık CAD çıktıları</small></div><Link href="/dijital-proje-merkezi">Merkezi aç →</Link></article>
            <p>İndirilen özetler çalışma kaydıdır; yetkili proje, resmî imar belgesi veya uygulama onayı yerine geçmez.</p>
          </aside>
        </div>
        {workspace?.meetings.length ? <section className="v108-meetings">
          <header><span>GÖRÜŞMELER</span><b>Hesabınızdaki son toplantı kayıtları</b></header>
          <div>{workspace.meetings.slice(0, 6).map((meeting) => <article key={meeting.id}><span>{meeting.status}</span><div><b>{meeting.subject}</b><small>{meeting.channel} · {formatProjectDateTime(meeting.meetingAt)}</small></div></article>)}</div>
          <Link href="/iletisim">Yeni teknik görüşme planlayın →</Link>
        </section> : <section className="v108-meetings is-empty">
          <div><span>GÖRÜŞMELER</span><b>Henüz bağlı görüşme kaydı yok.</b><p>Teknik ekiple proje verisi üzerinden görüşme planlayın.</p></div>
          <Link href="/iletisim">Görüşme planlayın →</Link>
        </section>}
      </section>}
    </div>

    <footer className="v108-portal-footer">
      <p><b>Veri sınırı:</b> Resmî veri, kullanıcı beyanı ve ön değerlendirme birbirine karıştırılmaz.</p>
      <div><Link href="/teknik-altyapi">Teknik altyapı</Link><Link href="/dokumanlar">Bilgi bankası</Link><Link href="/musteri-proje-portali/teknik-oda">Teknik proje odası</Link>{account && <Link href="/hesabim">Hesabım</Link>}</div>
      {account && <small>{account.displayName} · {account.email}</small>}
    </footer>
  </div>;
}
