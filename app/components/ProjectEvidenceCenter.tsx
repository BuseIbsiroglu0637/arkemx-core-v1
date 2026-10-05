"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  PROJECT_FACT_KEYS,
  PROJECT_STAGE_KEYS,
  type ProjectEvidenceAction,
  type ProjectEvidenceState,
  type ProjectEvidenceTargetType,
} from "../lib/project-evidence";
import {
  ENGINEERING_CAPABILITY_IDS,
  engineeringCapabilities,
} from "../data/engineering-v3";

type ProjectOption = { slug: string; code: string; title: string };

type EvidenceItem = {
  id: string;
  projectSlug: string;
  targetType: ProjectEvidenceTargetType;
  targetKey: string;
  claimValue: string;
  sourceLabel: string;
  internalNote: string;
  status: ProjectEvidenceState;
  fileName: string | null;
  contentType: string | null;
  fileSize: number | null;
  fileSha256: string | null;
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
};

const factLabels: Record<string, string> = {
  location: "Lokasyon",
  buildingType: "Yapı türü",
  system: "Taşıyıcı sistem",
  year: "Yıl",
  area: "Alan",
  client: "Müşteri / işveren ilişkisi",
  arkemRole: "ARKEM kapsamı",
  projectStatus: "Proje durumu",
};

const stageLabels: Record<string, string> = {
  "01": "İhtiyaç",
  "02": "Kısıt",
  "03": "Sistem Kararı",
  "04": "Mühendislik",
  "05": "Detay",
  "06": "Üretim",
  "07": "Uygulama",
  "08": "Sonuç",
};

const capabilityLabels = Object.fromEntries(
  engineeringCapabilities.map((capability) => [capability.id, capability.title]),
) as Record<string, string>;

const statusLabels: Record<ProjectEvidenceState, string> = {
  received: "ALINDI",
  in_review: "İNCELEMEDE",
  verified: "DOĞRULANDI",
  published: "YAYINDA",
  rejected: "REDDEDİLDİ",
};

const primaryAction: Record<ProjectEvidenceState, { action: ProjectEvidenceAction; label: string } | null> = {
  received: { action: "start_review", label: "İncelemeye al" },
  in_review: { action: "verify", label: "Doğrula" },
  verified: { action: "publish", label: "Yayımla" },
  published: { action: "withdraw", label: "Yayından çek" },
  rejected: { action: "restore", label: "Yeniden aç" },
};

function formatBytes(bytes: number | null) {
  if (!bytes) return "—";
  if (bytes < 1_000_000) return `${Math.round(bytes / 1000)} KB`;
  return `${(bytes / 1_000_000).toFixed(1)} MB`;
}

function targetLabel(item: Pick<EvidenceItem, "targetType" | "targetKey">) {
  if (item.targetType === "fact") return factLabels[item.targetKey] || item.targetKey;
  if (item.targetType === "stage") return `${item.targetKey} / ${stageLabels[item.targetKey] || item.targetKey}`;
  if (item.targetType === "capability") return <><span>Mühendislik</span><i aria-hidden="true"> / </i><span>{capabilityLabels[item.targetKey] || item.targetKey}</span></>;
  return "Proje medyası";
}

export function ProjectEvidenceCenter({ projects }: { projects: readonly ProjectOption[] }) {
  const [selectedProject, setSelectedProject] = useState(projects[0]?.slug || "");
  const [targetType, setTargetType] = useState<ProjectEvidenceTargetType>("fact");
  const [targetKey, setTargetKey] = useState<string>(PROJECT_FACT_KEYS[0]);
  const [claimValue, setClaimValue] = useState("");
  const [sourceLabel, setSourceLabel] = useState("");
  const [internalNote, setInternalNote] = useState("");
  const [items, setItems] = useState<EvidenceItem[]>([]);
  const [message, setMessage] = useState("Kanıt kayıtları hazırlanıyor…");
  const [busy, setBusy] = useState(false);
  const [fileInputKey, setFileInputKey] = useState(0);

  const targetOptions = useMemo(() => targetType === "fact"
    ? PROJECT_FACT_KEYS.map((key) => ({ value: key, label: factLabels[key] }))
    : targetType === "stage"
      ? PROJECT_STAGE_KEYS.map((key) => ({ value: key, label: `${key} / ${stageLabels[key]}` }))
      : targetType === "capability"
        ? ENGINEERING_CAPABILITY_IDS.map((key) => ({ value: key, label: capabilityLabels[key] }))
        : [{ value: "media", label: "Proje medyası" }], [targetType]);

  const load = useCallback(async () => {
    try {
      const response = await fetch(`/api/project-evidence?project=${encodeURIComponent(selectedProject)}`, { cache: "no-store" });
      const body = await response.json().catch(() => ({})) as { items?: EvidenceItem[]; error?: string };
      if (!response.ok) {
        setMessage(body.error || "Kanıt kayıtları yüklenemedi.");
        return;
      }
      setItems(body.items || []);
      setMessage(`${body.items?.length || 0} kanıt kaydı güvenli arşivde.`);
    } catch {
      setMessage("Bağlantı kurulamadı. Mevcut kayıtlar değiştirilmedi; yeniden deneyin.");
    }
  }, [selectedProject]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const changeTargetType = (value: ProjectEvidenceTargetType) => {
    setTargetType(value);
    setTargetKey(value === "fact"
      ? PROJECT_FACT_KEYS[0]
      : value === "stage"
        ? PROJECT_STAGE_KEYS[0]
        : value === "capability"
          ? ENGINEERING_CAPABILITY_IDS[0]
          : "media");
  };

  const upload = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    form.set("projectSlug", selectedProject);
    form.set("targetType", targetType);
    form.set("targetKey", targetKey);
    form.set("claimValue", claimValue);
    form.set("sourceLabel", sourceLabel);
    form.set("internalNote", internalNote);
    setBusy(true);
    setMessage("Dosya özeti oluşturuluyor ve kanıt arşivine aktarılıyor…");
    try {
      const response = await fetch("/api/project-evidence", { method: "POST", body: form });
      const body = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) {
        setMessage(body.error || "Kanıt kaydı tamamlanamadı.");
        return;
      }
      setClaimValue("");
      setSourceLabel("");
      setInternalNote("");
      setFileInputKey((value) => value + 1);
      setMessage("Kanıt alındı. İnceleme tamamlanmadan kamu sayfasına aktarılmayacak.");
      await load();
    } catch {
      setMessage("Bağlantı kesildi. Tamamlanmamış yükleme yayımlanmadı; yeniden deneyin.");
    } finally {
      setBusy(false);
    }
  };

  const transition = async (item: EvidenceItem, action: ProjectEvidenceAction) => {
    setBusy(true);
    setMessage("Kanıt durumu kontrollü olarak güncelleniyor…");
    try {
      const response = await fetch("/api/project-evidence", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: item.id, action, expectedStatus: item.status }),
      });
      const body = await response.json().catch(() => ({})) as { error?: string };
      const outcomeMessage = response.ok ? "Kanıt durumu güncellendi." : body.error || "Durum güncellenemedi.";
      await load();
      setMessage(outcomeMessage);
    } catch {
      setMessage("Bağlantı kesildi. Kanıt durumu değiştirilmedi; yeniden deneyin.");
    } finally {
      setBusy(false);
    }
  };

  return <div className="v3c-evidence-console">
    <header className="v3c-console-head">
      <div><span>V3.0‑E / PROJE KANIT MERKEZİ</span><h2>Kanıtı alın.<br/><em>İnceleyin, sonra yayımlayın.</em></h2></div>
      <aside aria-live="polite"><strong>YAYIN KAPISI AKTİF</strong><p>{message}</p></aside>
    </header>

    <div className="v3c-console-layout">
      <form className="v3c-evidence-form" onSubmit={upload}>
        <header><span>01 / YENİ KANIT</span><h3>Proje kaydına açık kaynak bağlayın.</h3><p>Dosya arşive alınır; kamu sayfasına doğrudan çıkmaz.</p></header>
        <label>Proje<select value={selectedProject} onChange={(event) => setSelectedProject(event.target.value)}>{projects.map((project) => <option key={project.slug} value={project.slug}>{project.code} · {project.title}</option>)}</select></label>
        <div className="v3c-form-row">
          <label>Kanıt alanı<select value={targetType} onChange={(event) => changeTargetType(event.target.value as ProjectEvidenceTargetType)}><option value="fact">Proje bilgisi</option><option value="stage">Vaka çalışması aşaması</option><option value="capability">Mühendislik uzmanlığı</option><option value="media">Proje medyası</option></select></label>
          <label>Bağlanacağı kayıt<select value={targetKey} onChange={(event) => setTargetKey(event.target.value)}>{targetOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
        </div>
        <label>{targetType === "media" ? "Medya açıklaması" : "Doğrulanacak bilgi"}<textarea required={targetType !== "media"} value={claimValue} onChange={(event) => setClaimValue(event.target.value)} placeholder={targetType === "media" ? "Örn. Prefabrik elemanların montaj aşaması" : "Kaynağın doğruladığı kesin ifadeyi yazın"}/></label>
        <label>Kamuya açık kaynak tanımı<input required value={sourceLabel} onChange={(event) => setSourceLabel(event.target.value)} placeholder="Örn. Onaylı statik uygulama paftası"/></label>
        <label>İç inceleme notu<textarea value={internalNote} onChange={(event) => setInternalNote(event.target.value)} placeholder="Yalnız ARKEM editörü görür"/></label>
        <label className="v3c-file-field">Kanıt dosyası<input key={fileInputKey} required name="file" type="file" accept=".pdf,.dwg,.dxf,.jpg,.jpeg,.png,.webp,.mp4,.mov,.xlsx,.zip"/><small>PDF, DWG/DXF, görsel, video, XLSX veya ZIP · en fazla 25 MB</small></label>
        <button disabled={busy}>{busy ? "İşleniyor…" : "Kanıtı güvenli arşive al →"}</button>
      </form>

      <section className="v3c-evidence-ledger">
        <header><div><span>02 / KANIT DEFTERİ</span><h3>Her kayıt kendi durumunu taşır.</h3></div><select aria-label="Kanıt projesi" value={selectedProject} onChange={(event) => setSelectedProject(event.target.value)}>{projects.map((project) => <option key={project.slug} value={project.slug}>{project.title}</option>)}</select></header>
        <div className="v3c-state-rail" aria-label="Yayın süreci"><span>ALINDI</span><i>→</i><span>İNCELEMEDE</span><i>→</i><span>DOĞRULANDI</span><i>→</i><span>YAYINDA</span></div>
        <div className="v3c-evidence-list">{items.length ? items.map((item) => {
          const action = primaryAction[item.status];
          return <article key={item.id} data-status={item.status}>
            <header><span>{targetLabel(item)}</span><em>{statusLabels[item.status]}</em></header>
            <h4>{item.claimValue || item.fileName || "Medya kanıtı"}</h4>
            <p>{item.sourceLabel}</p>
            <dl><div><dt>Dosya</dt><dd>{item.fileName || "—"}</dd></div><div><dt>Boyut</dt><dd>{formatBytes(item.fileSize)}</dd></div><div><dt>Özet</dt><dd>{item.fileSha256?.slice(0, 12) || "—"}</dd></div></dl>
            {item.internalNote && <small>{item.internalNote}</small>}
            <footer><a href={`/api/project-evidence/file/${encodeURIComponent(item.id)}`} target="_blank" rel="noreferrer">Dosyayı incele ↗</a><div>{action && <button disabled={busy} type="button" onClick={() => transition(item, action.action)}>{action.label}</button>}{["received", "in_review", "verified"].includes(item.status) && <button disabled={busy} className="secondary" type="button" onClick={() => transition(item, "reject")}>Reddet</button>}</div></footer>
          </article>;
        }) : <div className="v3c-empty"><strong>Henüz kanıt yok.</strong><p>İlk dosyayı eklediğinizde doğrulama zinciri burada başlayacak.</p></div>}</div>
      </section>
    </div>
  </div>;
}
