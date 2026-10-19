"use client";

import { useEffect, useMemo, useState } from "react";
import { downloadTextFile } from "../lib/engineering";
import { ProjectKernelBar, useProjectKernel } from "./ProjectKernel";

type SketchfabModel = {
  uid: string;
  name: string;
  description?: string;
  viewerUrl?: string;
  embedUrl?: string;
  publishedAt?: string;
  viewCount?: number;
  likeCount?: number;
  faceCount?: number;
  vertexCount?: number;
  isDownloadable?: boolean;
  categories?: { name: string }[];
  license?: { label?: string; url?: string };
  thumbnails?: { images?: { url: string; width?: number; height?: number }[] };
};

const fallbackModel: SketchfabModel = {
  uid: "934f9c0e9ae84d338f65cc6bdae3a3a8",
  name: "ROMON 3D",
  description: "Taşıyıcı sistem bileşenlerinin ve yapı geometrisinin etkileşimli teknik modeli.",
  viewerUrl: "https://sketchfab.com/3d-models/romon-3d-934f9c0e9ae84d338f65cc6bdae3a3a8",
  embedUrl: "https://sketchfab.com/models/934f9c0e9ae84d338f65cc6bdae3a3a8/embed",
  publishedAt: "2025-06-06T00:00:00.000Z",
  viewCount: 39,
  likeCount: 2,
  faceCount: 12_806,
  vertexCount: 6_118,
  isDownloadable: true,
  categories: [{ name: "Architecture" }],
  license: { label: "CC Attribution" },
  thumbnails: { images: [{ url: "https://media.sketchfab.com/models/934f9c0e9ae84d338f65cc6bdae3a3a8/thumbnails/85d10395753a4326b43b7abf1ddcb34c/15aa49f57f454b2fac31f0589e2e25bb.jpeg", width: 1024, height: 576 }] },
};

function thumbnail(model: SketchfabModel) {
  return [...(model.thumbnails?.images ?? [])].sort((a, b) => (b.width ?? 0) - (a.width ?? 0))[0]?.url ?? "/portfolio/bim-engineering.webp";
}

function formatDate(value?: string) {
  if (!value) return "Tarih yok";
  return new Intl.DateTimeFormat("tr-TR", { day: "2-digit", month: "long", year: "numeric" }).format(new Date(value));
}

export function SketchfabModelLibrary({ compact = false }: { compact?: boolean }) {
  const { patchModule } = useProjectKernel();
  const [models, setModels] = useState<SketchfabModel[]>([fallbackModel]);
  const [selectedId, setSelectedId] = useState(fallbackModel.uid);
  const [query, setQuery] = useState("");
  const [syncState, setSyncState] = useState<"syncing" | "live" | "fallback">("syncing");
  const [reviewStatus, setReviewStatus] = useState("İnceleme bekliyor");
  const [modelPurpose, setModelPurpose] = useState("Görsel koordinasyon");
  const [reviewNote, setReviewNote] = useState("Model ölçü, koordinat sistemi ve revizyon bilgisiyle doğrulanmalı.");

  useEffect(() => {
    const controller = new AbortController();
    fetch("https://api.sketchfab.com/v3/models?user=ozenczturk&count=24", { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error("Sketchfab public feed unavailable");
        return response.json() as Promise<{ results?: SketchfabModel[] }>;
      })
      .then((data) => {
        if (data.results?.length) {
          setModels(data.results);
          setSelectedId((current) => data.results?.some((model) => model.uid === current) ? current : data.results![0].uid);
          setSyncState("live");
        } else setSyncState("fallback");
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setSyncState("fallback");
      });
    return () => controller.abort();
  }, []);

  const filtered = useMemo(() => models.filter((model) => `${model.name} ${model.description ?? ""} ${(model.categories ?? []).map((category) => category.name).join(" ")}`.toLocaleLowerCase("tr-TR").includes(query.toLocaleLowerCase("tr-TR"))), [models, query]);
  const selected = models.find((model) => model.uid === selectedId) ?? filtered[0] ?? fallbackModel;
  const embedUrl = selected.embedUrl ?? `https://sketchfab.com/models/${selected.uid}/embed`;
  useEffect(() => { patchModule("model-library-review", { selected: { uid: selected.uid, name: selected.name, faceCount: selected.faceCount, vertexCount: selected.vertexCount }, reviewStatus, modelPurpose, reviewNote, source: syncState === "live" ? "Sketchfab public API" : "fallback record" }); }, [modelPurpose, patchModule, reviewNote, reviewStatus, selected.faceCount, selected.name, selected.uid, selected.vertexCount, syncState]);
  const exportReview = () => downloadTextFile(`${selected.uid}-model-inceleme.json`, JSON.stringify({ schema: "ARKEM-MODEL-REVIEW/1.0", model: selected, review: { status: reviewStatus, purpose: modelPurpose, note: reviewNote }, sourceStatus: syncState }, null, 2), "application/json");

  return <section className={`sketchfab-library${compact ? " compact" : ""}`}>
    <ProjectKernelBar module="3D MODEL REVIEW" confidence={syncState === "live" ? "Canlı harici model kaydı" : "Yerel yedek model"} />
    <header className="sketchfab-library-head"><div><span>ARKEM / 3B MODEL KÜTÜPHANESİ</span><b>Özenç Öztürk · Sketchfab proje akışı</b></div><div><i className={syncState === "live" ? "live" : ""}></i><span>{syncState === "syncing" ? "KÜTÜPHANE EŞLENİYOR" : syncState === "live" ? "CANLI PUBLIC API" : "YEREL YEDEK MODEL"}</span><small>Yeni yayınlanan açık modeller otomatik listelenir</small></div></header>
    <div className="sketchfab-library-body">
      <aside className="sketchfab-model-rail">
        <label><span className="sr-only">Model ara</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Model, kategori veya açıklama ara" /><i>⌕</i></label>
        <div className="sketchfab-rail-meta"><span>{String(filtered.length).padStart(2, "0")} MODEL</span><b>Site içi etkileşimli arşiv</b></div>
        <div className="sketchfab-model-list">{filtered.map((model, index) => <button key={model.uid} className={selected.uid === model.uid ? "active" : ""} onClick={() => setSelectedId(model.uid)}><img src={thumbnail(model)} alt="" /><span><small>{String(index + 1).padStart(2, "0")} / {(model.categories?.[0]?.name ?? "3B MODEL").toLocaleUpperCase("tr-TR")}</small><b>{model.name}</b><i>{(model.faceCount ?? 0).toLocaleString("tr-TR")} yüz</i></span></button>)}{!filtered.length && <p className="sketchfab-empty">Aramayla eşleşen model bulunamadı.</p>}</div>
      </aside>
      <main className="sketchfab-viewer-stage"><div className="sketchfab-iframe-wrap"><iframe key={selected.uid} title={`${selected.name} etkileşimli 3B modeli`} src={`${embedUrl}?autostart=0&ui_theme=dark&ui_infos=1&ui_annotations=1`} allow="autoplay; fullscreen; xr-spatial-tracking" allowFullScreen></iframe><div className="sketchfab-viewer-badge"><i></i><span>ETKİLEŞİMLİ 3B</span></div></div><div className="sketchfab-viewer-help"><span>SOL: döndür</span><span>SAĞ: kaydır</span><span>TEKER: yaklaş</span><span>TAM EKRAN: ⛶</span></div></main>
      <aside className="sketchfab-model-info"><span>SEÇİLİ PROJE</span><h3>{selected.name}</h3><p>{selected.description || "Model açıklaması Sketchfab proje kaydından canlı olarak alınır."}</p><div className="sketchfab-info-grid"><p><span>Yayın</span><b>{formatDate(selected.publishedAt)}</b></p><p><span>Kategori</span><b>{selected.categories?.map((category) => category.name).join(", ") || "3B Model"}</b></p><p><span>Geometri</span><b>{(selected.faceCount ?? 0).toLocaleString("tr-TR")} yüz</b></p><p><span>Köşe</span><b>{(selected.vertexCount ?? 0).toLocaleString("tr-TR")}</b></p><p><span>Görüntülenme</span><b>{(selected.viewCount ?? 0).toLocaleString("tr-TR")}</b></p><p><span>Beğeni</span><b>{(selected.likeCount ?? 0).toLocaleString("tr-TR")}</b></p><p><span>Lisans</span><b>{selected.license?.label ?? "Model kaydına göre"}</b></p><p><span>İndirme</span><b>{selected.isDownloadable ? "Kaynakta açık" : "Kapalı"}</b></p></div><div className="sketchfab-review"><span>TEKNİK İNCELEME KAYDI</span><label>Amaç<select value={modelPurpose} onChange={(event) => setModelPurpose(event.target.value)}><option>Görsel koordinasyon</option><option>İşveren sunumu</option><option>Taşıyıcı sistem inceleme</option><option>İmalat / montaj inceleme</option><option>As-built karşılaştırma</option></select></label><label>Durum<select value={reviewStatus} onChange={(event) => setReviewStatus(event.target.value)}><option>İnceleme bekliyor</option><option>Yorumlandı</option><option>Revizyon gerekli</option><option>Görsel onay</option></select></label><label>Not<textarea value={reviewNote} onChange={(event) => setReviewNote(event.target.value)} rows={3}/></label><button onClick={exportReview}>İnceleme JSON ↓</button></div><div className="sketchfab-model-actions"><button onClick={() => document.querySelector<HTMLIFrameElement>(`.sketchfab-iframe-wrap iframe`)?.requestFullscreen?.()}>Tam ekran incele ⛶</button><a href={selected.viewerUrl ?? `https://sketchfab.com/models/${selected.uid}`} target="_blank" rel="noreferrer">Kaynak model kaydı ↗</a></div><small className="sketchfab-api-note">Sketchfab modeli site içinde görüntülenir; görsel onay geometri doğrulaması veya proje müellifi onayı değildir. Ölçek, koordinat, revizyon ve kaynak dosya ayrıca doğrulanır.</small></aside>
    </div>
  </section>;
}
