"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useProjectKernel } from "./ProjectKernel";
import { formatProjectDateTime } from "../lib/date-format";

type WorkspaceData = {
  user: { displayName: string; email: string };
  profile: null | { displayName: string; company: string; phone: string; preferredLanguage: string };
  projects: Array<{ id: string; name: string; phase: string; revision: string; status: string; updatedAt: string }>;
  meetings: Array<{ id: string; projectId: string; subject: string; meetingAt: string; channel: string; status: string; notes: string }>;
  activities: Array<{ id: number; eventType: string; title: string; detail: string; createdAt: string }>;
};

export function ClientAccountSettings({ displayName, email }: { displayName: string; email: string }) {
  const { project, thread } = useProjectKernel();
  const [data, setData] = useState<WorkspaceData | null>(null);
  const [message, setMessage] = useState("Güvenli çalışma alanı hazırlanıyor…");
  const [profile, setProfile] = useState({ displayName, company: "", phone: "", preferredLanguage: "tr" });
  const [meeting, setMeeting] = useState({ subject: "", meetingAt: "", projectId: "", channel: "Çevrim içi", notes: "" });
  const [meetingPending, setMeetingPending] = useState(false);

  const load = async () => {
    try {
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
    setMessage("Hesabınız ve proje kayıtlarınız güncel.");
    } catch {
      setMessage("Hesap verileri yüklenemedi. Bağlantınızı kontrol edip sayfayı yeniden açın.");
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, []);

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
    setMessage(success);
    await load();
    return true;
    } catch {
      setMessage("Kayıt sonucu doğrulanamadı. Bağlantınızı kontrol edin; yeniden göndermeden önce hesabınızı güncelleyin.");
      return false;
    }
  };

  const saveProfile = (event: FormEvent) => {
    event.preventDefault();
    void post({ action: "profile", ...profile }, "Profil bilgileriniz güncellendi.");
  };

  const saveProject = () => void post({
    action: "project",
    id: project.id,
    name: project.name,
    phase: project.phase,
    revision: project.revision,
    payload: project,
    expectedAccountUpdatedAt: data?.projects.find((item) => item.id === project.id)?.updatedAt ?? null,
  }, "Aktif ARKEMX projesi hesabınıza kaydedildi.");

  const saveMeeting = async (event: FormEvent) => {
    event.preventDefault();
    if (meetingPending) return;
    setMeetingPending(true);
    const saved = await post({ action: "meeting", ...meeting }, "Görüşme kaydı oluşturuldu.");
    if (saved) setMeeting({ subject: "", meetingAt: "", projectId: "", channel: "Çevrim içi", notes: "" });
    setMeetingPending(false);
  };

  const remove = async (resource: "project" | "meeting", id: string) => {
    const selected = resource === "project" ? data?.projects.find((item) => item.id === id) : data?.meetings.find((item) => item.id === id);
    const label = resource === "project" ? data?.projects.find((item) => item.id === id)?.name : data?.meetings.find((item) => item.id === id)?.subject;
    if (!selected || !window.confirm(`${label || id} kaydı hesabınızdan kalıcı olarak kaldırılsın mı? Bu işlem geri alınamaz; önce proje yedeğinizi indirin.`)) return;
    const revision = resource === "project" ? data?.projects.find((item) => item.id === id)?.updatedAt : undefined;
    try {
    const response = await fetch(`/api/customer-workspace?resource=${resource}&id=${encodeURIComponent(id)}${revision ? `&expectedAccountUpdatedAt=${encodeURIComponent(revision)}` : ""}`, { method: "DELETE" });
    const result = await response.json();
    const error = result && typeof result === "object" && "error" in result && typeof result.error === "string" ? result.error : "Kayıt kaldırılamadı.";
    setMessage(response.ok ? "Kayıt kaldırıldı." : error);
    if (response.ok) await load();
    } catch {
      setMessage("Silme sonucu doğrulanamadı. Bağlantınızı kontrol edip hesabınızı yeniden açın.");
    }
  };

  return <div className="customer-workspace">
    <header className="customer-console-head"><div><span>ARKEMX / GÜVENLİ MÜŞTERİ ALANI</span><h2>{displayName}</h2><p>{email}</p></div><div className="customer-console-state"><b>HESAP AKTİF</b><small role="status" aria-live="polite">{message}</small><button type="button" onClick={() => void load()}>Hesabı güncelle</button></div></header>
    <nav className="customer-summary" aria-label="Hesap özeti"><article><b>{data?.projects.length ?? 0}</b><span>Kayıtlı proje</span></article><article><b>{data?.meetings.length ?? 0}</b><span>Görüşme kaydı</span></article><article><b>{data?.activities.length ?? 0}</b><span>İşlem geçmişi</span></article><article><b>{project.revision}</b><span>Aktif revizyon</span></article></nav>
    <section className="customer-continuity">
      <div><span>AKTİF PROJE OMURGASI</span><h3>{project.name}</h3><p>{thread.metrics.activeCount}/{thread.metrics.totalCount} modül bağlı · hazırlık %{thread.metrics.readiness} · {thread.metrics.critical} kritik kayıt</p></div>
      <div><small>Sıradaki doğru adım</small><b>{thread.nextAction.label}</b><Link href={thread.nextAction.route}>Çalışmaya devam edin →</Link></div>
      <Link href="/musteri-proje-portali">Tüm proje görünümünü açın ↗</Link>
    </section>
    <div className="customer-workspace-grid">
      <section className="customer-panel customer-projects"><div className="customer-panel-title"><div><span>01 / PROJELERİM</span><h3>Tek proje kimliğiyle kaydedin.</h3></div><button type="button" onClick={saveProject}>Aktif projeyi kaydet ↗</button></div>
        <div className="customer-list">{data?.projects.length ? data.projects.map((item) => <article key={item.id}><span>{item.revision}</span><div><b>{item.name}</b><small>{item.id} · {item.phase}</small><time>{formatProjectDateTime(item.updatedAt)}</time></div><button type="button" onClick={() => remove("project", item.id)}>Kaldır</button></article>) : <p>Henüz buluta kaydedilmiş proje yok. ARKEMX’te başlattığınız aktif projeyi tek düğmeyle hesabınıza ekleyin.</p>}</div>
        <Link className="customer-inline-link" href="/proje-baslat">Yeni proje başlatın →</Link>
      </section>
      <section className="customer-panel"><div className="customer-panel-title"><div><span>02 / GÖRÜŞMELERİM</span><h3>Teknik görüşme geçmişi.</h3><p>Bu kayıt randevu onayı değildir; tarih ve saat ARKEM ekibiyle ayrıca teyit edilir.</p></div></div>
        <form className="customer-form" onSubmit={saveMeeting} aria-busy={meetingPending}><label>Konu<input disabled={meetingPending} required value={meeting.subject} onChange={(e) => setMeeting({ ...meeting, subject: e.target.value })} placeholder="Örn. Ön fizibilite görüşmesi"/></label><div><label>Tarih & saat<input disabled={meetingPending} required type="datetime-local" value={meeting.meetingAt} onChange={(e) => setMeeting({ ...meeting, meetingAt: e.target.value })}/></label><label>Kanal<select disabled={meetingPending} value={meeting.channel} onChange={(e) => setMeeting({ ...meeting, channel: e.target.value })}><option>Çevrim içi</option><option>Ofis</option><option>Telefon</option><option>Şantiye</option></select></label></div><label>Not<textarea disabled={meetingPending} value={meeting.notes} onChange={(e) => setMeeting({ ...meeting, notes: e.target.value })} placeholder="Görüşme gündemi veya takip notu"/></label><button disabled={meetingPending}>{meetingPending ? "Kaydediliyor…" : "Görüşmeyi kaydet"}</button></form>
        <div className="customer-list compact">{data?.meetings.map((item) => <article key={item.id}><span>{item.status}</span><div><b>{item.subject}</b><small>{item.channel} · {item.projectId || "Genel"}</small><time>{formatProjectDateTime(item.meetingAt)}</time></div><button type="button" onClick={() => remove("meeting", item.id)}>Kaldır</button></article>)}</div>
      </section>
      <section className="customer-panel"><div className="customer-panel-title"><div><span>03 / PROFİL</span><h3>Kurumsal iletişim bilgileri.</h3></div></div>
        <form className="customer-form" onSubmit={saveProfile}><label>Ad soyad<input value={profile.displayName} onChange={(e) => setProfile({ ...profile, displayName: e.target.value })}/></label><label>Firma<input value={profile.company} onChange={(e) => setProfile({ ...profile, company: e.target.value })}/></label><label>Telefon<input value={profile.phone} onChange={(e) => setProfile({ ...profile, phone: e.target.value })}/></label><button>Profili güncelle</button></form>
      </section>
      <section className="customer-panel"><div className="customer-panel-title"><div><span>04 / İŞLEM GEÇMİŞİ</span><h3>Hesap hareketleri.</h3></div></div><ol className="customer-activity">{data?.activities.map((item) => <li key={item.id}><i></i><div><b>{item.title}</b><small>{item.detail}</small><time>{formatProjectDateTime(item.createdAt)}</time></div></li>)}</ol></section>
    </div>
  </div>;
}
