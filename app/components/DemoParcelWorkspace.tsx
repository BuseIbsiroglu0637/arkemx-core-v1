"use client";
import Link from "next/link";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useProjectKernel } from "./ProjectKernel";
import { GeoParcelStudio } from "./GeoParcelStudio";
import { briefSiteContext, briefSitePatch, landSearchError } from "../lib/brief-site-context";

export function DemoParcelWorkspace() {
  const { project, hydrated } = useProjectKernel();
  if (!hydrated) return <p role="status">Proje açılıyor…</p>;
  return <ParcelWorkspace key={project.id} />;
}
function ParcelWorkspace() {
  const { project, patchModule } = useProjectKernel();
  const geo = project.modules["geo-parcel"] as { landMode?: string; landSearch?: {region?: string;minArea?: string;maxArea?: string;budget?: string}; briefContext?: { signature?: string }; parcel?: unknown[] } | undefined;
  const context = useMemo(() => briefSiteContext(project.id,project.modules),[project.id,project.modules]);
  const [mode,setMode] = useState(geo?.landMode === "search" ? "search" : geo?.landMode === "owned" || (geo?.parcel?.length ?? 0) >= 3 ? "owned" : "");
  const [search,setSearch] = useState({ region: geo?.landSearch?.region ?? context?.location ?? "", minArea: geo?.landSearch?.minArea ?? "", maxArea: geo?.landSearch?.maxArea ?? "", budget: geo?.landSearch?.budget ?? "" });
  const [notice,setNotice] = useState("");
  const [error,setError] = useState("");
  const signature = context?.signature ?? "";
  const linkedSignature = geo?.briefContext?.signature ?? "";
  useEffect(() => {
    if (!context || linkedSignature) return;
    const timer = window.setTimeout(() => patchModule("geo-parcel",briefSitePatch(context,geo)),0);
    return () => window.clearTimeout(timer);
  }, [context,linkedSignature,patchModule,geo]);
  const choose = (value: string) => { setMode(value); patchModule("geo-parcel",{landMode:value}); setNotice(""); };
  const save = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); const message = landSearchError(search); setError(message); if(message) return;
    patchModule("geo-parcel",{landMode:"search",landSearch:{...search,savedAt:new Date().toISOString(),status:"criteria-only"}});setNotice("Arama ölçütleri projeye kaydedildi.");
  };
  const briefSummary = context ? <section className="demo-site-brief" aria-label="Yatırım briefinden gelen bilgiler"><h2>Yatırım briefi</h2><dl><div><dt>Bölge</dt><dd>{context.location}</dd></div><div><dt>Kullanım</dt><dd>{context.goal}</dd></div><div><dt>Hedef yapı alanı</dt><dd>{context.targetGrossArea ? `${context.targetGrossArea.toLocaleString("tr-TR")} m²` : "Belirtilmedi"}</dd></div><div><dt>Sistem tercihi</dt><dd>{context.systemLabel}</dd></div></dl>{linkedSignature !== signature && linkedSignature && <button type="button" onClick={() => {patchModule("geo-parcel",briefSitePatch(context,geo));setNotice("Güncel brief hedefleri aktarıldı. Parsel sınırı ve imar kaydı korundu.");}}>Güncel briefi aktar</button>}<small>Yapı alanı hedefi, arsa büyüklüğü veya yapılaşma hakkı değildir.</small></section> : <p className="demo-site-missing">Bu projede kayıtlı yatırım briefi yok. <Link href="/proje-karar-asistani#karar-motoru">Briefi tamamla ↗</Link></p>;
  return <div className="demo-parcel-workspace">
    <p className="demo-active-project-name">Proje: <strong>{project.name}</strong></p>
    {mode === "owned" && context ? <details className="demo-owned-brief"><summary>Brief özeti <span>{context.location}{context.targetGrossArea ? ` · ${context.targetGrossArea.toLocaleString("tr-TR")} m² yapı hedefi` : ""}</span></summary>{briefSummary}</details> : briefSummary}
    <fieldset className="demo-land-choice"><legend>Arsa durumunuz</legend><button type="button" aria-pressed={mode === "owned"} onClick={() => choose("owned")}>Arsam var</button><button type="button" aria-pressed={mode === "search"} onClick={() => choose("search")}>Arsa arıyorum</button></fieldset>
    {notice && <p role="status" className="demo-site-notice">{notice}</p>}
    {mode === "search" && <section className="demo-land-search" aria-labelledby="land-search-title"><h2 id="land-search-title">Arama ölçütleri</h2><p>Aday arsa ararken kullanacağınız bölge, arsa alanı ve bütçe sınırlarını kaydedin.</p><form onSubmit={save}><div className="demo-land-fields">{[["region","Arama bölgesi"],["minArea","En küçük arsa alanı (m²)"],["maxArea","En büyük arsa alanı (m²)"],["budget","En yüksek arsa bütçesi (TL)"]].map(([key,label]) => <label key={key}>{label}<input value={search[key as keyof typeof search]} required={key === "region"} inputMode={key === "region" ? "text" : "decimal"} maxLength={key === "region" ? 300 : 30} onChange={event => {const value=event.currentTarget.value;setSearch(current=>({...current,[key]:value}));setNotice("");setError("");}}/></label>)}</div>{error && <p role="alert">{error}</p>}<button type="submit">Ölçütleri kaydet</button></form><p className="demo-site-note">Bu adım ilan getirmez ve arsa seçilmiş sayılmaz. Bir aday belirlediğinizde “Arsam var” ile parselini inceleyebilirsiniz.</p><Link href="/hizli-yerlesim#hizli-senaryo">Arsa seçmeden kavramsal yerleşimi dene ↗</Link></section>}
    {mode === "owned" && <GeoParcelStudio />}
    {!mode && <p className="demo-site-note">İlerlemek için arsa durumunu seçin. Mevcut parsel ve arama kayıtlarınız korunur.</p>}
    <div id="hizli-senaryo" className="demo-site-next"><Link href="/hizli-yerlesim#hizli-senaryo">Sonraki modül: Hızlı yerleşim →</Link></div>
  </div>;
}
