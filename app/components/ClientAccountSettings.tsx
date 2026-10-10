"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { useProjectKernel } from "./ProjectKernel";
import { deriveProjectThread } from "../lib/project-graph";
import { formatProjectDateTime } from "../lib/date-format";

type WorkspaceActivity = {
  id: number;
  eventType: string;
  title: string;
  detail: string;
  createdAt: string;
};

type WorkspaceData = {
  user: { displayName: string; email: string };
  profile: null | { displayName: string; company: string; phone: string; preferredLanguage: string };
  projects: Array<{ id: string; name: string; phase: string; revision: string; status: string; updatedAt: string; payload?: unknown }>;
  meetings: Array<{ id: string; projectId: string; subject: string; meetingAt: string; channel: string; status: string; notes: string }>;
  activities: WorkspaceActivity[];
};

type GuidedDraftSummary = {
  schema: "ARKEM-GUIDED-DRAFT/1.0";
  savedAt: string;
  step: number;
  intake: { name?: string };
};

const GUIDED_DRAFT_KEY = "arkem-guided-project-draft-v107";
const ACCOUNT_SYNC_SUPPRESSION_KEY = "arkem-account-sync-suppressed-projects-v1";

function payloadReadiness(payload: unknown) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;
  const modules = (payload as { modules?: unknown }).modules;
  if (!modules || typeof modules !== "object" || Array.isArray(modules)) return null;
  return deriveProjectThread(modules as Record<string, unknown>).metrics.readiness;
}

function payloadUpdatedAt(payload: unknown) {
  if (!payload || typeof payload !== "object") return 0;
  const value = String((payload as { updatedAt?: unknown }).updatedAt ?? "");
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function summarizeActivities(activities: WorkspaceActivity[]) {
  const summarized: Array<WorkspaceActivity & { count: number }> = [];

  activities.forEach((activity) => {
    const normalized = {
      ...activity,
      title: activity.eventType === "project" && activity.title === "Proje buluta kaydedildi"
        ? "Proje hesaba kaydedildi"
        : activity.title,
    };
    const previous = summarized[summarized.length - 1];

    if (
      (normalized.eventType === "project" || normalized.eventType === "profile") &&
      previous?.eventType === normalized.eventType &&
      previous.title === normalized.title &&
      previous.detail === normalized.detail
    ) {
      previous.count += 1;
      return;
    }

    summarized.push({ ...normalized, count: 1 });
  });

  return summarized;
}

export function ClientAccountSettings({ displayName, email, simple = false }: { displayName: string; email: string; simple?: boolean }) {
  const { project, thread, importProject, clearLocalProject } = useProjectKernel();
  const router = useRouter();
  const [data, setData] = useState<WorkspaceData | null>(null);
  const [draft, setDraft] = useState<GuidedDraftSummary | null>(null);
  const [message, setMessage] = useState("Güvenli çalışma alanı hazırlanıyor…");
  const [profile, setProfile] = useState({ displayName, company: "", phone: "", preferredLanguage: "tr" });
  const [profileBaseline, setProfileBaseline] = useState({ displayName, company: "", phone: "", preferredLanguage: "tr" });
  const [profileStatus, setProfileStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [showAllProjects, setShowAllProjects] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [activeProjectRemovalId, setActiveProjectRemovalId] = useState<string | null>(null);
  const [projectRemovalBusy, setProjectRemovalBusy] = useState(false);
  const [projectSwitchBusy, setProjectSwitchBusy] = useState(false);
  const [suppressedProjectIds, setSuppressedProjectIds] = useState<string[]>([]);
  const [suppressionReady, setSuppressionReady] = useState(false);
  const [meeting, setMeeting] = useState({ subject: "", meetingAt: "", projectId: "", channel: "Çevrim içi", notes: "" });
  const syncingProjectRef = useRef("");
  const suppressedProjectIdsRef = useRef<Set<string>>(new Set());
  const recentActivities = data ? summarizeActivities(data.activities).slice(0, 5) : [];
  const hasActiveProject = Object.keys(project.modules).length > 0;
  const accountActiveProject = data?.projects.find((item) => item.id === project.id) ?? null;
  const accountHasActiveProject = Boolean(accountActiveProject);
  const localProjectUpdatedAt = Date.parse(project.updatedAt) || 0;
  const accountPayloadUpdatedAt = payloadUpdatedAt(accountActiveProject?.payload);
  const activeProjectSyncSuppressed = suppressedProjectIds.includes(project.id);
  const accountCopyNeedsUpdate = hasActiveProject
    && Boolean(project.id)
    && !activeProjectSyncSuppressed
    && (!accountActiveProject || localProjectUpdatedAt > accountPayloadUpdatedAt);
  const meaningfulDraft = draft && ((draft.intake.name?.trim() ?? "").length >= 3 || draft.step > 0) ? draft : null;
  const profileDirty = profile.displayName !== profileBaseline.displayName
    || profile.company !== profileBaseline.company
    || profile.phone !== profileBaseline.phone
    || profile.preferredLanguage !== profileBaseline.preferredLanguage;
  const visibleProjects = data ? (showAllProjects ? data.projects : data.projects.slice(0, 4)) : [];
  const selectedAccountProject = data?.projects.find((item) => item.id === selectedProjectId)
    ?? accountActiveProject
    ?? data?.projects[0]
    ?? null;
  const selectedProjectIsActive = Boolean(selectedAccountProject && hasActiveProject && selectedAccountProject.id === project.id);
  const selectedProjectName = selectedProjectIsActive ? project.name : selectedAccountProject?.name ?? "";
  const selectedProjectPhase = selectedProjectIsActive ? project.phase : selectedAccountProject?.phase ?? "";
  const selectedProjectRevision = selectedProjectIsActive ? project.revision : selectedAccountProject?.revision ?? "—";
  const selectedProjectReadiness = selectedProjectIsActive
    ? thread.metrics.readiness
    : payloadReadiness(selectedAccountProject?.payload);
  const statusError = /yüklenemedi|kaydedilemedi|kaldırılamadı|tamamlanamadı|çakış|bağlanılamadı/i.test(message);
  const statusBusy = /hazırlanıyor|kaydediliyor|eşitleniyor|kaldırılıyor|yükleniyor/i.test(message);
  const accountStatus = statusError ? "error" : (!data || statusBusy ? "syncing" : "ready");
  const accountStatusLabel = accountStatus === "error"
    ? "İşlem başarısız"
    : accountStatus === "syncing"
      ? "Eşitleniyor"
      : "Hesap güncel";

  const setProjectSyncSuppressed = (projectId: string, suppressed: boolean) => {
    if (!projectId) return;
    const nextSet = new Set(suppressedProjectIdsRef.current);
    if (suppressed) nextSet.add(projectId);
    else nextSet.delete(projectId);
    suppressedProjectIdsRef.current = nextSet;
    const next = Array.from(nextSet);
    setSuppressedProjectIds(next);
    try {
      window.localStorage.setItem(ACCOUNT_SYNC_SUPPRESSION_KEY, JSON.stringify(next));
    } catch {
      // Account sync suppression remains effective for the current session.
    }
  };

  const updateProfile = (patch: Partial<typeof profile>) => {
    setProfile((currentProfile) => ({ ...currentProfile, ...patch }));
    setProfileStatus("idle");
  };

  const load = useCallback(async (finalMessage = "Hesabınız ve proje kayıtlarınız güncel.") => {
    const response = await fetch("/api/customer-workspace", { cache: "no-store" });
    const body = await response.json() as WorkspaceData & { error?: string };
    if (!response.ok) {
      setMessage(body.error || "Çalışma alanı yüklenemedi.");
      return;
    }
    setData(body);
    setSelectedProjectId((currentSelection) => {
      if (currentSelection && body.projects.some((item) => item.id === currentSelection)) return currentSelection;
      const activeAccountProject = body.projects.find((item) => item.id === project.id);
      return activeAccountProject?.id ?? body.projects[0]?.id ?? "";
    });
    if (body.profile) {
      const loadedProfile = {
        displayName: body.profile.displayName,
        company: body.profile.company,
        phone: body.profile.phone,
        preferredLanguage: body.profile.preferredLanguage,
      };
      setProfile(loadedProfile);
      setProfileBaseline(loadedProfile);
    }
    try {
      const draftResponse = await fetch("/api/project-draft", { cache: "no-store" });
      if (draftResponse.ok) {
        const draftBody = await draftResponse.json() as { draft?: GuidedDraftSummary | null };
        setDraft(draftBody.draft ?? null);
      }
    } catch {
      // Account/project data remains usable if draft sync is temporarily unavailable.
    }
    setMessage(finalMessage);
  }, [project.id]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
    try {
      const raw = window.localStorage.getItem(ACCOUNT_SYNC_SUPPRESSION_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      const ids = Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === "string") : [];
      suppressedProjectIdsRef.current = new Set(ids);
      setSuppressedProjectIds(ids);
    } catch {
      suppressedProjectIdsRef.current = new Set();
      setSuppressedProjectIds([]);
    }
    setSuppressionReady(true);
    void load();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  useEffect(() => {
    if (!suppressionReady || !data || !hasActiveProject || !project.id || !accountCopyNeedsUpdate || suppressedProjectIdsRef.current.has(project.id)) return;
    const syncKey = `${project.id}:${project.updatedAt}`;
    if (syncingProjectRef.current === syncKey) return;
    syncingProjectRef.current = syncKey;
    const timer = window.setTimeout(() => {
      setMessage(accountHasActiveProject
        ? "Yerel proje değişiklikleri hesabınızla eşitleniyor…"
        : "Aktif proje hesabınızla eşitleniyor…");
      void fetch("/api/customer-workspace", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "project",
          id: project.id,
          name: project.name,
          phase: project.phase,
          revision: project.revision,
          payload: project,
          expectedAccountUpdatedAt: accountActiveProject?.updatedAt ?? null,
        }),
      }).then(async (response) => {
        const body = await response.json().catch(() => ({})) as { error?: string };
        if (!response.ok) {
          setMessage(body.error || "Aktif proje hesaba otomatik kaydedilemedi.");
          if (response.status === 409) await load();
          return;
        }
        await load("Yerel proje hesabınızla eşitlendi.");
      }).catch(() => {
        setMessage("Aktif proje hesaba otomatik kaydedilemedi.");
      }).finally(() => {
        if (syncingProjectRef.current === syncKey) syncingProjectRef.current = "";
      });
    }, 450);
    return () => window.clearTimeout(timer);
  }, [
    accountActiveProject?.updatedAt,
    accountCopyNeedsUpdate,
    accountHasActiveProject,
    data,
    hasActiveProject,
    suppressionReady,
    project,
    load,
    project.id,
    project.name,
    project.phase,
    project.revision,
    project.updatedAt,
  ]);

  const post = async (payload: Record<string, unknown>, success: string) => {
    setMessage("Kaydediliyor…");
    try {
      const response = await fetch("/api/customer-workspace", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await response.json() as { error?: string };
      if (!response.ok) {
        const error = body.error || "Kayıt tamamlanamadı.";
        if (response.status === 409) await load();
        setMessage(error);
        return false;
      }
      await load(success);
      return true;
    } catch {
      setMessage("Hesap servisine bağlanılamadı.");
      return false;
    }
  };

  const saveProfile = async (event: FormEvent) => {
    event.preventDefault();
    if (!profileDirty || profileStatus === "saving") return;
    setProfileStatus("saving");
    const ok = await post({ action: "profile", ...profile }, "Profil bilgileriniz güncellendi.");
    if (ok) {
      setProfileBaseline(profile);
      setProfileStatus("saved");
    } else {
      setProfileStatus("error");
    }
  };

  const saveProject = async () => {
    if (!hasActiveProject) {
      setMessage("Kaydedilecek aktif proje bulunmuyor.");
      return false;
    }
    const ok = await post({
      action: "project",
      id: project.id,
      name: project.name,
      phase: project.phase,
      revision: project.revision,
      payload: project,
      expectedAccountUpdatedAt: data?.projects.find((item) => item.id === project.id)?.updatedAt ?? null,
    }, "Aktif ARKEMX projesi hesabınıza kaydedildi.");
    if (ok) setProjectSyncSuppressed(project.id, false);
    return ok;
  };

  const persistActiveProjectBeforeSwitch = async () => {
    if (!hasActiveProject || !project.id) return true;
    if (suppressedProjectIdsRef.current.has(project.id)) {
      setMessage("Aktif proje yalnız bu cihazda tutuluyor. Başka projeye geçmeden önce projeyi hesabınıza yeniden ekleyin.");
      return false;
    }
    const accountCopy = data?.projects.find((item) => item.id === project.id);
    if (accountCopy && localProjectUpdatedAt <= payloadUpdatedAt(accountCopy.payload)) return true;

    setMessage("Mevcut projenin son değişiklikleri hesabınıza kaydediliyor…");
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
          expectedAccountUpdatedAt: accountCopy?.updatedAt ?? null,
        }),
      });
      const body = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) {
        setMessage(body.error || "Mevcut proje güvenli biçimde kaydedilemedi. Proje değiştirilmedi.");
        if (response.status === 409) await load("Proje kaydı başka bir oturumda değişmiş. Son hesap kaydı yenilendi; proje değiştirilmedi.");
        return false;
      }
      return true;
    } catch {
      setMessage("Hesap servisine ulaşılamadı. Veri kaybını önlemek için proje değiştirilmedi.");
      return false;
    }
  };

  const openAccountProject = async (item: WorkspaceData["projects"][number]) => {
    if (projectSwitchBusy) return;
    const openingCurrentLocalProject = hasActiveProject
      && item.id === project.id
      && localProjectUpdatedAt >= payloadUpdatedAt(item.payload);

    if (openingCurrentLocalProject) {
      setMessage(`${item.name} için güncel yerel çalışma korunuyor.`);
      router.push("/dijital-proje-merkezi");
      return;
    }

    setProjectSwitchBusy(true);
    try {
      if (hasActiveProject && item.id !== project.id) {
        const preserved = await persistActiveProjectBeforeSwitch();
        if (!preserved) return;
      }

      if (!item.payload || !importProject(item.payload)) {
        setMessage("Hesaptaki proje çalışma alanına yüklenemedi.");
        return;
      }

      setMessage(`${item.name} çalışma alanına yüklendi.`);
      // Client-side navigation keeps ProjectKernel mounted long enough for the
      // imported account snapshot to become the active persisted project.
      router.push("/dijital-proje-merkezi");
    } finally {
      setProjectSwitchBusy(false);
    }
  };

  const removeActiveProjectFromAccount = async () => {
    if (!hasActiveProject || projectRemovalBusy) return;
    setProjectRemovalBusy(true);
    setProjectSyncSuppressed(project.id, true);
    setMessage("Aktif proje hesabınızdan kaldırılıyor; bu cihazdaki çalışma korunacak…");
    try {
      const response = await fetch(`/api/customer-workspace?resource=project&id=${encodeURIComponent(project.id)}`, { method: "DELETE" });
      if (!response.ok) {
        setProjectSyncSuppressed(project.id, false);
        setMessage("Proje hesabınızdan kaldırılamadı.");
        return;
      }
      setActiveProjectRemovalId(null);
      await load("Proje hesabınızdan kaldırıldı. Bu cihazdaki aktif çalışma korunuyor ve otomatik hesap eşitlemesi durduruldu.");
    } catch {
      setProjectSyncSuppressed(project.id, false);
      setMessage("Proje hesabınızdan kaldırılamadı.");
    } finally {
      setProjectRemovalBusy(false);
    }
  };

  const removeActiveProjectEverywhere = async () => {
    if (!hasActiveProject || projectRemovalBusy) return;
    setProjectRemovalBusy(true);
    setMessage("Aktif proje hesabınızdan ve bu cihazdaki çalışma alanından siliniyor…");
    try {
      const response = await fetch(`/api/customer-workspace?resource=project&id=${encodeURIComponent(project.id)}`, { method: "DELETE" });
      if (!response.ok) {
        setMessage("Proje hesabınızdan silinemedi. Yerel çalışma korunuyor.");
        return;
      }
      setProjectSyncSuppressed(project.id, false);
      clearLocalProject();
      setActiveProjectRemovalId(null);
      await load("Aktif proje hesabınızdan ve bu cihazdaki çalışma alanından silindi.");
    } catch {
      setMessage("Hesap servisine ulaşılamadı. Yerel çalışma korunuyor.");
    } finally {
      setProjectRemovalBusy(false);
    }
  };

  const saveMeeting = (event: FormEvent) => {
    event.preventDefault();
    void post({ action: "meeting", ...meeting }, "Görüşme kaydı oluşturuldu.");
    setMeeting({ subject: "", meetingAt: "", projectId: "", channel: "Çevrim içi", notes: "" });
  };

  const remove = async (resource: "project" | "meeting", id: string, label?: string) => {
    const resourceName = resource === "project" ? "projeyi" : "görüşme kaydını";
    const target = label ? ` “${label}”` : "";
    if (!window.confirm(`${target} ${resourceName} hesabınızdan kaldırmak istediğinize emin misiniz?`)) return;
    setMessage(resource === "project" ? "Proje kaldırılıyor…" : "Görüşme kaydı kaldırılıyor…");
    try {
      const response = await fetch(`/api/customer-workspace?resource=${resource}&id=${encodeURIComponent(id)}`, { method: "DELETE" });
      if (response.ok) await load("Kayıt kaldırıldı.");
      else setMessage("Kayıt kaldırılamadı.");
    } catch {
      setMessage("Kayıt kaldırılamadı.");
    }
  };

  const removeDraft = async () => {
    if (!window.confirm("Devam eden proje taslağını kaldırmak istediğinize emin misiniz? Kayıtlı projeleriniz etkilenmez.")) return;
    setMessage("Yeni proje taslağı kaldırılıyor…");
    try {
      const response = await fetch("/api/project-draft", { method: "DELETE" });
      if (!response.ok) {
        setMessage("Hesaptaki proje taslağı kaldırılamadı.");
        return;
      }
      try {
        window.localStorage.removeItem(GUIDED_DRAFT_KEY);
      } catch {
        // Account copy is already deleted; local storage may be unavailable.
      }
      setDraft(null);
      setMessage("Yeni proje taslağı kaldırıldı. Kayıtlı projeleriniz etkilenmedi.");
    } catch {
      setMessage("Proje taslağı kaldırılamadı.");
    }
  };

  if (simple) {
    return <div className="arx-account-panel" data-testid="account-settings-panel">
      <section className={`arx-account-sync is-${accountStatus}`} aria-live="polite">
        <span><i aria-hidden="true"></i> {accountStatusLabel}</span>
        <small>{message}</small>
      </section>

      {selectedAccountProject ? <section className="arx-account-selected-project" aria-live="polite">
        <div>
          <span>İNCELENEN PROJE</span>
          <b>{selectedProjectName}</b>
          <small>{selectedAccountProject.id} · {selectedProjectPhase || "Aşama belirtilmedi"}</small>
        </div>
        {selectedProjectIsActive ? <em><i aria-hidden="true"></i> Aktif proje</em> : <span>Proje listesinden farklı bir kayıt seçebilirsiniz.</span>}
      </section> : null}

      <section className="arx-account-metrics" aria-label="Hesap ve seçili proje özeti">
        <article><span>Kayıtlı proje</span><b>{data ? data.projects.length : "—"}</b><small>hesabınızdaki toplam kayıt</small></article>
        <article><span>Görüşme</span><b>{data ? data.meetings.length : "—"}</b><small>hesaba bağlı görüşme</small></article>
        <article><span>Seçili revizyon</span><b>{selectedAccountProject ? selectedProjectRevision : "—"}</b><small>{selectedProjectName || "Proje seçilmedi"}</small></article>
        <article><span>Veri hazırlığı</span><b>{selectedProjectReadiness === null || selectedProjectReadiness === undefined ? "—" : `%${selectedProjectReadiness}`}</b><small>{selectedProjectPhase || "Proje verisi bekleniyor"}</small></article>
      </section>

      <div className="arx-account-grid">
        <section className="arx-account-card" aria-labelledby="arx-account-profile-title">
          <header>
            <div><span>PROFİL</span><h3 id="arx-account-profile-title">Hesap bilgileri</h3></div>
          </header>
          <form className="arx-account-form" onSubmit={saveProfile}>
            <label>Ad soyad<input required autoComplete="name" value={profile.displayName} onChange={(e) => updateProfile({ displayName: e.target.value })}/></label>
            <label>E-posta<input type="email" autoComplete="email" value={email} readOnly aria-readonly="true"/></label>
            <label>Firma / kurum<input autoComplete="organization" value={profile.company} onChange={(e) => updateProfile({ company: e.target.value })}/></label>
            <label>Telefon<input autoComplete="tel" inputMode="tel" value={profile.phone} onChange={(e) => updateProfile({ phone: e.target.value })} placeholder="+90 …"/></label>
            <label className="arx-account-language">Dil
              <select value={profile.preferredLanguage} onChange={(e) => updateProfile({ preferredLanguage: e.target.value })}>
                <option value="tr">Türkçe</option>
                <option value="en" disabled>İngilizce (yakında)</option>
              </select>
            </label>
            <div className="arx-account-form-actions">
              <button type="submit" disabled={!profileDirty || profileStatus === "saving"}>
                {profileStatus === "saving" ? "Kaydediliyor…" : "Profili Kaydet"}
              </button>
              <small className={`is-${profileStatus}`} aria-live="polite">
                {profileStatus === "saved" ? "Kaydedildi ✓" : profileStatus === "error" ? "Kaydedilemedi" : profileDirty ? "Kaydedilmemiş değişiklik var" : "Bilgiler güncel"}
              </small>
            </div>
          </form>
        </section>

        <section className="arx-account-card arx-account-project-card" aria-labelledby="arx-account-projects-title">
          <header>
            <div><span>PROJELER</span><h3 id="arx-account-projects-title">Hesaba bağlı projeler</h3></div>
          </header>
          <div className="arx-account-list">
            {hasActiveProject && !accountHasActiveProject ? <article className="arx-account-local-project">
              <div>
                <b>{project.name}</b>
                <small>{project.id} · {project.revision} · {activeProjectSyncSuppressed ? "Yalnız bu cihazda" : "Yerel aktif proje"}</small>
                <time>{activeProjectSyncSuppressed ? "Otomatik hesap eşitlemesi kapalı." : "Hesap kaydı otomatik eşitleniyor…"}</time>
              </div>
              <button type="button" onClick={() => { void saveProject(); }}>
                {activeProjectSyncSuppressed ? "Hesaba yeniden ekle" : "Şimdi kaydet"}
              </button>
            </article> : null}

            {meaningfulDraft ? <article className="arx-account-draft">
              <div><b>{meaningfulDraft.intake.name?.trim() || "Devam eden proje taslağı"}</b><small>Yeni proje taslağı · kayıtlı projelerden ayrıdır · Adım {Math.min(5, Math.max(1, meaningfulDraft.step + 1))}/5</small><time>{formatProjectDateTime(meaningfulDraft.savedAt)}</time></div>
              <span className="arx-account-project-actions arx-account-draft-actions"><Link href="/proje-baslat">Taslağa Devam Et <span aria-hidden="true">→</span></Link><button type="button" onClick={() => { void removeDraft(); }}>Kaldır</button></span>
            </article> : null}

            {visibleProjects.map((item) => {
              const isCurrentProject = hasActiveProject && item.id === project.id;
              const isSelectedProject = selectedAccountProject?.id === item.id;
              return <article key={item.id} className={`${isCurrentProject ? "is-current-project" : ""} ${isSelectedProject ? "is-selected-project" : ""}`.trim()}>
                <button type="button" className="arx-account-project-overview-trigger"
                  onClick={() => setSelectedProjectId(item.id)}
                  aria-pressed={isSelectedProject}>
                  <span className="arx-account-project-title-row">
                    <b>{item.name}</b>
                    {isCurrentProject ? <em><i aria-hidden="true"></i> Aktif proje</em> : null}
                    {isSelectedProject && !isCurrentProject ? <em className="is-selected">İnceleniyor</em> : null}
                  </span>
                  <small>{item.id} · {item.revision} · {item.phase}</small>
                  <time>{formatProjectDateTime(item.updatedAt)}</time>
                </button>
                <span className="arx-account-project-actions">
                  {isCurrentProject
                    ? <Link href="/dijital-proje-merkezi">Çalışma Alanına Git <span aria-hidden="true">→</span></Link>
                    : <button type="button" onClick={() => { void openAccountProject(item); }} disabled={projectSwitchBusy}>
                      {projectSwitchBusy ? "Açılıyor…" : "Aç"}
                    </button>}
                  <button type="button" onClick={() => {
                    if (isCurrentProject) setActiveProjectRemovalId(item.id);
                    else void remove("project", item.id, item.name);
                  }}>Kaldır</button>
                </span>
                {isCurrentProject && activeProjectRemovalId === item.id ? <div className="arx-account-active-removal" role="group" aria-label="Aktif proje silme seçenekleri">
                  <div>
                    <b>Aktif proje için kaldırma seçeneğini belirleyin</b>
                    <small>Hesaptan kaldırmak yerel çalışmayı korur; tamamen silmek hem hesap kaydını hem bu cihazdaki aktif çalışmayı kaldırır.</small>
                  </div>
                  <div>
                    <button type="button" onClick={() => { void removeActiveProjectFromAccount(); }} disabled={projectRemovalBusy}>Yalnız hesaptan kaldır</button>
                    <button type="button" className="danger" onClick={() => { void removeActiveProjectEverywhere(); }} disabled={projectRemovalBusy}>
                      {projectRemovalBusy ? "İşleniyor…" : "Her yerden sil"}
                    </button>
                    <button type="button" className="cancel" onClick={() => setActiveProjectRemovalId(null)} disabled={projectRemovalBusy}>Vazgeç</button>
                  </div>
                </div> : null}
              </article>;
            })}

            {data && data.projects.length === 0 && !(hasActiveProject && !accountHasActiveProject) && !meaningfulDraft ? <div className="arx-account-empty">
              <span aria-hidden="true">⌁</span>
              <b>Henüz kayıtlı projeniz yok</b>
              <p>Çalışma alanında oluşturduğunuz projeler burada görünecek.</p>
              <Link href="/dijital-proje-merkezi">Proje Çalışma Alanına Git <span aria-hidden="true">→</span></Link>
            </div> : null}

            {!data ? <p className="arx-account-loading">Hesap kayıtları yükleniyor…</p> : null}
          </div>

          {data && data.projects.length > 4 ? <footer className="arx-account-card-footer">
            <button type="button" onClick={() => setShowAllProjects((value) => !value)}>
              {showAllProjects ? "Daha az göster" : `Tüm projeleri göster (${data.projects.length})`}
            </button>
          </footer> : null}
        </section>
      </div>

      <details className="arx-account-detail">
        <summary>Görüşmeler ve İşlem Geçmişi</summary>
        <div className="arx-account-detail-grid">
          <section>
            <h3>Son görüşmeler</h3>
            {data?.meetings.slice(0, 4).map((item) => <article key={item.id}>
              <div><b>{item.subject}</b><small>{item.channel} · {formatProjectDateTime(item.meetingAt)}</small></div>
              <button type="button" onClick={() => { void remove("meeting", item.id, item.subject); }}>Kaldır</button>
            </article>)}
            {data && data.meetings.length === 0 ? <p className="arx-account-empty-inline">Henüz görüşme kaydı yok.</p> : null}
          </section>
          <section>
            <h3>Son işlemler</h3>
            {recentActivities.map((item) => <article key={item.id}>
              <div>
                <b>{item.title}</b>
                <small>
                  {item.detail || "Hesap işlemi"} · {formatProjectDateTime(item.createdAt)}
                  {item.count > 1 ? ` · ${item.count} kez güncellendi` : ""}
                </small>
              </div>
            </article>)}
            {data && data.activities.length === 0 ? <p className="arx-account-empty-inline">Henüz işlem kaydı yok.</p> : null}
          </section>
        </div>
      </details>
    </div>;
  }

  return <div className="customer-workspace">
    <header className="customer-console-head"><div><span>ARKEMX / GÜVENLİ MÜŞTERİ ALANI</span><h2>{displayName}</h2><p>{email}</p></div><div className="customer-console-state"><b>HESAP AKTİF</b><small>{message}</small></div></header>
    <nav className="customer-summary" aria-label="Hesap özeti"><article><b>{data?.projects.length ?? 0}</b><span>Kayıtlı proje</span></article><article><b>{data?.meetings.length ?? 0}</b><span>Görüşme kaydı</span></article><article><b>{data?.activities.length ?? 0}</b><span>İşlem geçmişi</span></article><article><b>{project.revision}</b><span>Aktif revizyon</span></article></nav>
    <section className="customer-continuity">
      <div><span>AKTİF PROJE OMURGASI</span><h3>{project.name}</h3><p>{thread.metrics.activeCount}/{thread.metrics.totalCount} modül bağlı · hazırlık %{thread.metrics.readiness} · {thread.metrics.critical} kritik kayıt</p></div>
      <div><small>Sıradaki doğru adım</small><b>{thread.nextAction.label}</b><Link href={thread.nextAction.route}>Çalışmaya devam edin →</Link></div>
      <Link href="/musteri-proje-portali">Tüm proje görünümünü açın ↗</Link>
    </section>
    <div className="customer-workspace-grid">
      <section className="customer-panel customer-projects"><div className="customer-panel-title"><div><span>01 / PROJELERİM</span><h3>Tek proje kimliğiyle kaydedin.</h3></div><button type="button" onClick={() => { void saveProject(); }} disabled={!hasActiveProject}>Aktif projeyi kaydet ↗</button></div>
        <div className="customer-list">{data?.projects.length ? data.projects.map((item) => <article key={item.id}><span>{item.revision}</span><div><b>{item.name}</b><small>{item.id} · {item.phase}</small><time>{formatProjectDateTime(item.updatedAt)}</time></div><button type="button" onClick={() => { void remove("project", item.id, item.name); }}>Kaldır</button></article>) : <p>Henüz hesaba kaydedilmiş proje yok. ARKEMX’te başlattığınız aktif projeyi tek düğmeyle hesabınıza ekleyin.</p>}</div>
        <Link className="customer-inline-link" href="/proje-baslat">Yeni proje başlatın →</Link>
      </section>
      <section className="customer-panel"><div className="customer-panel-title"><div><span>02 / GÖRÜŞMELERİM</span><h3>Teknik görüşme geçmişi.</h3></div></div>
        <form className="customer-form" onSubmit={saveMeeting}><label>Konu<input required value={meeting.subject} onChange={(e) => setMeeting({ ...meeting, subject: e.target.value })} placeholder="Örn. Ön fizibilite görüşmesi"/></label><div><label>Tarih & saat<input required type="datetime-local" value={meeting.meetingAt} onChange={(e) => setMeeting({ ...meeting, meetingAt: e.target.value })}/></label><label>Kanal<select value={meeting.channel} onChange={(e) => setMeeting({ ...meeting, channel: e.target.value })}><option>Çevrim içi</option><option>Ofis</option><option>Telefon</option><option>Şantiye</option></select></label></div><label>Not<textarea value={meeting.notes} onChange={(e) => setMeeting({ ...meeting, notes: e.target.value })} placeholder="Görüşme gündemi veya takip notu"/></label><button>Görüşmeyi kaydet</button></form>
        <div className="customer-list compact">{data?.meetings.map((item) => <article key={item.id}><span>{item.status}</span><div><b>{item.subject}</b><small>{item.channel} · {item.projectId || "Genel"}</small><time>{formatProjectDateTime(item.meetingAt)}</time></div><button type="button" onClick={() => { void remove("meeting", item.id, item.subject); }}>Kaldır</button></article>)}</div>
      </section>
      <section className="customer-panel"><div className="customer-panel-title"><div><span>03 / PROFİL</span><h3>Kurumsal iletişim bilgileri.</h3></div></div>
        <form className="customer-form" onSubmit={saveProfile}><label>Ad soyad<input value={profile.displayName} onChange={(e) => setProfile({ ...profile, displayName: e.target.value })}/></label><label>Firma<input value={profile.company} onChange={(e) => setProfile({ ...profile, company: e.target.value })}/></label><label>Telefon<input value={profile.phone} onChange={(e) => setProfile({ ...profile, phone: e.target.value })}/></label><button>Profili güncelle</button></form>
      </section>
      <section className="customer-panel"><div className="customer-panel-title"><div><span>04 / İŞLEM GEÇMİŞİ</span><h3>Hesap hareketleri.</h3></div></div><ol className="customer-activity">{data?.activities.map((item) => <li key={item.id}><i></i><div><b>{item.title}</b><small>{item.detail}</small><time>{formatProjectDateTime(item.createdAt)}</time></div></li>)}</ol></section>
    </div>
  </div>;
}
