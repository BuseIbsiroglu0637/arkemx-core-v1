"use client";

import Link from "next/link";
import { FormEvent, useEffect, useRef, useState } from "react";
import { useProjectKernel } from "./ProjectKernel";
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
  const { project, thread, importProject } = useProjectKernel();
  const [data, setData] = useState<WorkspaceData | null>(null);
  const [draft, setDraft] = useState<GuidedDraftSummary | null>(null);
  const [message, setMessage] = useState("Güvenli çalışma alanı hazırlanıyor…");
  const [profile, setProfile] = useState({ displayName, company: "", phone: "", preferredLanguage: "tr" });
  const [meeting, setMeeting] = useState({ subject: "", meetingAt: "", projectId: "", channel: "Çevrim içi", notes: "" });
  const syncingProjectRef = useRef("");
  const recentActivities = data ? summarizeActivities(data.activities).slice(0, 5) : [];
  const hasActiveProject = Object.keys(project.modules).length > 0;
  const accountHasActiveProject = Boolean(data?.projects.some((item) => item.id === project.id));
  const meaningfulDraft = draft && ((draft.intake.name?.trim() ?? "").length >= 3 || draft.step > 0) ? draft : null;

  const load = async () => {
    const response = await fetch("/api/customer-workspace", { cache: "no-store" });
    const body = await response.json() as WorkspaceData & { error?: string };
    if (!response.ok) {
      setMessage(body.error || "Çalışma alanı yüklenemedi.");
      return;
    }
    setData(body);
    if (body.profile) setProfile({
      displayName: body.profile.displayName,
      company: body.profile.company,
      phone: body.profile.phone,
      preferredLanguage: body.profile.preferredLanguage,
    });
    try {
      const draftResponse = await fetch("/api/project-draft", { cache: "no-store" });
      if (draftResponse.ok) {
        const draftBody = await draftResponse.json() as { draft?: GuidedDraftSummary | null };
        setDraft(draftBody.draft ?? null);
      }
    } catch {
      // Account/project data remains usable if draft sync is temporarily unavailable.
    }
    setMessage("Hesabınız ve proje kayıtlarınız güncel.");
  };

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!data || !hasActiveProject || !project.id || accountHasActiveProject) return;
    if (syncingProjectRef.current === project.id) return;
    syncingProjectRef.current = project.id;
    setMessage("Aktif proje hesabınızla eşitleniyor…");
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
        expectedAccountUpdatedAt: null,
      }),
    }).then(async (response) => {
      const body = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) {
        setMessage(body.error || "Aktif proje hesaba otomatik kaydedilemedi.");
        return;
      }
      setMessage("Aktif proje hesabınıza otomatik kaydedildi.");
      await load();
    }).catch(() => {
      setMessage("Aktif proje hesaba otomatik kaydedilemedi.");
    }).finally(() => {
      syncingProjectRef.current = "";
    });
  }, [accountHasActiveProject, data, hasActiveProject, project.id, project.name, project.phase, project.revision, project.updatedAt]);

  const post = async (payload: Record<string, unknown>, success: string) => {
    setMessage("Kaydediliyor…");
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
      return;
    }
    setMessage(success);
    await load();
  };

  const saveProfile = (event: FormEvent) => {
    event.preventDefault();
    void post({ action: "profile", ...profile }, "Profil bilgileriniz güncellendi.");
  };

  const saveProject = () => {
    if (!hasActiveProject) {
      setMessage("Kaydedilecek aktif proje bulunmuyor.");
      return;
    }
    void post({
      action: "project",
      id: project.id,
      name: project.name,
      phase: project.phase,
      revision: project.revision,
      payload: project,
      expectedAccountUpdatedAt: data?.projects.find((item) => item.id === project.id)?.updatedAt ?? null,
    }, "Aktif ARKEMX projesi hesabınıza kaydedildi.");
  };

  const openAccountProject = (item: WorkspaceData["projects"][number]) => {
    if (!item.payload || !importProject(item.payload)) {
      setMessage("Hesaptaki proje çalışma alanına yüklenemedi.");
      return;
    }
    setMessage(`${item.name} çalışma alanına yüklendi.`);
    window.location.assign("/dijital-proje-merkezi");
  };

  const saveMeeting = (event: FormEvent) => {
    event.preventDefault();
    void post({ action: "meeting", ...meeting }, "Görüşme kaydı oluşturuldu.");
    setMeeting({ subject: "", meetingAt: "", projectId: "", channel: "Çevrim içi", notes: "" });
  };

  const remove = async (resource: "project" | "meeting", id: string) => {
    const response = await fetch(`/api/customer-workspace?resource=${resource}&id=${encodeURIComponent(id)}`, { method: "DELETE" });
    setMessage(response.ok ? "Kayıt kaldırıldı." : "Kayıt kaldırılamadı.");
    if (response.ok) await load();
  };

  if (simple) {
    return <div className="arx-account-panel" data-testid="account-settings-panel">
      <section className="arx-account-status">
        <div>
          <span>AKTİF HESAP</span>
          <h2>{profile.displayName || displayName}</h2>
          <p>{email}</p>
        </div>
        <small>{message}</small>
      </section>

      <section className="arx-account-metrics" aria-label="Hesap özeti">
        <article><span>KAYITLI PROJE</span><b>{data?.projects.length ?? 0}</b></article>
        <article><span>GÖRÜŞME</span><b>{data?.meetings.length ?? 0}</b></article>
        <article><span>AKTİF REVİZYON</span><b>{hasActiveProject ? project.revision : "—"}</b></article>
        <article><span>VERİ HAZIRLIĞI</span><b>{hasActiveProject ? `%${thread.metrics.readiness}` : "—"}</b></article>
      </section>

      <div className="arx-account-grid">
        <section className="arx-account-card" aria-labelledby="arx-account-profile-title">
          <header>
            <div><span>PROFİL</span><h3 id="arx-account-profile-title">Hesap bilgileri</h3></div>
          </header>
          <form className="arx-account-form" onSubmit={saveProfile}>
            <label>Ad soyad<input value={profile.displayName} onChange={(e) => setProfile({ ...profile, displayName: e.target.value })}/></label>
            <label>E-posta<input value={email} readOnly/></label>
            <label>Firma / kurum<input value={profile.company} onChange={(e) => setProfile({ ...profile, company: e.target.value })}/></label>
            <label>Telefon<input value={profile.phone} onChange={(e) => setProfile({ ...profile, phone: e.target.value })}/></label>
            <button type="submit">Profili kaydet</button>
          </form>
        </section>

        <section className="arx-account-card" aria-labelledby="arx-account-projects-title">
          <header>
            <div><span>PROJELER</span><h3 id="arx-account-projects-title">Hesaba bağlı projeler</h3></div>
            <Link href="/dijital-proje-merkezi" aria-disabled={!hasActiveProject} className={!hasActiveProject ? "is-disabled" : undefined}>Projeye Devam Et</Link>
          </header>
          <div className="arx-account-list">
            {hasActiveProject && !accountHasActiveProject ? <article className="arx-account-local-project">
              <div><b>{project.name}</b><small>{project.id} · {project.revision} · Yerel aktif proje</small><time>Hesap kaydı otomatik eşitleniyor…</time></div>
              <button type="button" onClick={saveProject}>Şimdi kaydet</button>
            </article> : null}
            {meaningfulDraft ? <article className="arx-account-draft">
              <div><b>{meaningfulDraft.intake.name?.trim() || "Devam eden proje taslağı"}</b><small>Devam eden taslak · Adım {Math.min(5, Math.max(1, meaningfulDraft.step + 1))}/5</small><time>{formatProjectDateTime(meaningfulDraft.savedAt)}</time></div>
              <Link href="/proje-baslat">Devam et</Link>
            </article> : null}
            {data?.projects.slice(0, 4).map((item) => <article key={item.id}>
              <div><b>{item.name}</b><small>{item.id} · {item.revision} · {item.phase}</small><time>{formatProjectDateTime(item.updatedAt)}</time></div>
              <span className="arx-account-project-actions"><button type="button" onClick={() => openAccountProject(item)}>Aç</button><button type="button" onClick={() => remove("project", item.id)}>Kaldır</button></span>
            </article>)}
            {data && data.projects.length === 0 ? <p>Henüz hesaba kaydedilmiş proje yok.</p> : null}
            {!data ? <p>Hesap kayıtları yükleniyor…</p> : null}
          </div>
          <footer><Link href="/dijital-proje-merkezi">Projeye Devam Et →</Link></footer>
        </section>
      </div>

      <details className="arx-account-detail">
        <summary>Görüşmeler ve İşlem Geçmişi</summary>
        <div className="arx-account-detail-grid">
          <section>
            <h3>Son görüşmeler</h3>
            {data?.meetings.slice(0, 4).map((item) => <article key={item.id}>
              <div><b>{item.subject}</b><small>{item.channel} · {formatProjectDateTime(item.meetingAt)}</small></div>
              <button type="button" onClick={() => remove("meeting", item.id)}>Kaldır</button>
            </article>)}
            {data && data.meetings.length === 0 ? <p>Henüz görüşme kaydı yok.</p> : null}
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
            {data && data.activities.length === 0 ? <p>Henüz işlem kaydı yok.</p> : null}
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
      <section className="customer-panel customer-projects"><div className="customer-panel-title"><div><span>01 / PROJELERİM</span><h3>Tek proje kimliğiyle kaydedin.</h3></div><button type="button" onClick={saveProject} disabled={!hasActiveProject}>Aktif projeyi kaydet ↗</button></div>
        <div className="customer-list">{data?.projects.length ? data.projects.map((item) => <article key={item.id}><span>{item.revision}</span><div><b>{item.name}</b><small>{item.id} · {item.phase}</small><time>{formatProjectDateTime(item.updatedAt)}</time></div><button type="button" onClick={() => remove("project", item.id)}>Kaldır</button></article>) : <p>Henüz hesaba kaydedilmiş proje yok. ARKEMX’te başlattığınız aktif projeyi tek düğmeyle hesabınıza ekleyin.</p>}</div>
        <Link className="customer-inline-link" href="/proje-baslat">Yeni proje başlatın →</Link>
      </section>
      <section className="customer-panel"><div className="customer-panel-title"><div><span>02 / GÖRÜŞMELERİM</span><h3>Teknik görüşme geçmişi.</h3></div></div>
        <form className="customer-form" onSubmit={saveMeeting}><label>Konu<input required value={meeting.subject} onChange={(e) => setMeeting({ ...meeting, subject: e.target.value })} placeholder="Örn. Ön fizibilite görüşmesi"/></label><div><label>Tarih & saat<input required type="datetime-local" value={meeting.meetingAt} onChange={(e) => setMeeting({ ...meeting, meetingAt: e.target.value })}/></label><label>Kanal<select value={meeting.channel} onChange={(e) => setMeeting({ ...meeting, channel: e.target.value })}><option>Çevrim içi</option><option>Ofis</option><option>Telefon</option><option>Şantiye</option></select></label></div><label>Not<textarea value={meeting.notes} onChange={(e) => setMeeting({ ...meeting, notes: e.target.value })} placeholder="Görüşme gündemi veya takip notu"/></label><button>Görüşmeyi kaydet</button></form>
        <div className="customer-list compact">{data?.meetings.map((item) => <article key={item.id}><span>{item.status}</span><div><b>{item.subject}</b><small>{item.channel} · {item.projectId || "Genel"}</small><time>{formatProjectDateTime(item.meetingAt)}</time></div><button type="button" onClick={() => remove("meeting", item.id)}>Kaldır</button></article>)}</div>
      </section>
      <section className="customer-panel"><div className="customer-panel-title"><div><span>03 / PROFİL</span><h3>Kurumsal iletişim bilgileri.</h3></div></div>
        <form className="customer-form" onSubmit={saveProfile}><label>Ad soyad<input value={profile.displayName} onChange={(e) => setProfile({ ...profile, displayName: e.target.value })}/></label><label>Firma<input value={profile.company} onChange={(e) => setProfile({ ...profile, company: e.target.value })}/></label><label>Telefon<input value={profile.phone} onChange={(e) => setProfile({ ...profile, phone: e.target.value })}/></label><button>Profili güncelle</button></form>
      </section>
      <section className="customer-panel"><div className="customer-panel-title"><div><span>04 / İŞLEM GEÇMİŞİ</span><h3>Hesap hareketleri.</h3></div></div><ol className="customer-activity">{data?.activities.map((item) => <li key={item.id}><i></i><div><b>{item.title}</b><small>{item.detail}</small><time>{formatProjectDateTime(item.createdAt)}</time></div></li>)}</ol></section>
    </div>
  </div>;
}
