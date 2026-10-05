"use client";
import { useEffect, useRef, useState } from "react";
import { normalizeLandParcelIdentity } from "../lib/land-parcel-prefill";
import Link from "next/link";
import { assessLandCandidate, object, readLandResearch } from "../lib/land-research";
import { useProjectKernel } from "./ProjectKernel";
export function LandCandidateContext() {
  const { project, hydrated, patchModule } = useProjectKernel();
  const research = readLandResearch(object(project.modules["decision-assistant"]).landResearch);
  const candidate = research?.shortlist.find(c => c.id === research.selectedId);
  const [detailNotice, setDetailNotice] = useState("");
  const latestResearch = useRef(research);
  latestResearch.current = research;
  const url = candidate?.url;
  const identity = candidate?.parcelIdentity;
  useEffect(() => {
    if (!hydrated || !url || identity || !/^https:\/\/www\.emlakjet\.com\/ilan\//.test(url)) return;
    const current = latestResearch.current;
    const selected = current?.shortlist.find(c => c.id === current.selectedId);
    if (!current || !selected || assessLandCandidate(selected, current.criteria).mismatch.length) return;
    const abort = new AbortController();
    setDetailNotice("Seçilen ilanın ada/parsel bilgileri okunuyor…");
    fetch("/api/land-candidate-detail", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url, province: selected.province, district: selected.district }), signal: abort.signal }).then(async response => {
      const data = object(await response.json());
      if (!response.ok) throw Error(typeof data.error === "string" ? data.error : "İlan detayı bağlantısı kullanılamıyor.");
      if (data.schema !== "ARKEM-LAND-PARCEL-DETAIL/1.0" || data.url !== url || !["found", "missing"].includes(String(data.status))) throw Error("İlan detayı doğrulanamadı.");
      const parcelIdentity = normalizeLandParcelIdentity(data.parcelIdentity, url);
      if (data.status === "found" && !parcelIdentity) throw Error("İlanın ada/parsel bilgileri doğrulanamadı.");
      if (abort.signal.aborted) return;
      const latest = latestResearch.current;
      if (latest?.selectedId !== url) return;
      const latestCandidate = latest.shortlist.find(c => c.id === url);
      if (!latestCandidate || assessLandCandidate(latestCandidate, latest.criteria).mismatch.length) return;
      if (!parcelIdentity) { setDetailNotice("İlanda açık mahalle/köy, ada ve parsel bilgileri bulunamadı. Eksik alanları tamamlayın."); return; }
      if (parcelIdentity.province !== selected.province || parcelIdentity.district !== selected.district) throw Error("İlanın konumu seçilen adayla eşleşmedi.");
      patchModule("decision-assistant", { landResearch: { ...latest, shortlist: latest.shortlist.map(c => c.id === url ? { ...c, parcelIdentity } : c) } });
      setDetailNotice("");
    }).catch(error => { if (!abort.signal.aborted) setDetailNotice(error instanceof Error ? error.message : "Ada/parsel bilgileri okunamadı."); });
    return () => abort.abort();
  }, [hydrated, url, identity, patchModule]);
  if (!hydrated || !research || !candidate || assessLandCandidate(candidate, research.criteria).mismatch.length) return null;
  return <aside className="arx-candidate-context" aria-label="İncelemeye alınan arsa adayı"><b>İncelemeye alınan aday: {candidate.title}</b><p>Bu kayıt bir ilan araştırmasıdır. Ada/parsel bilgisi ilan beyanıdır; resmî sınır ve imar doğrulaması bekleniyor; ilan alanı hesaplara aktarılmadı.</p>{identity ? <p>İlan beyanı: {identity.neighborhood} · Ada {identity.block} / Parsel {identity.parcelNo}. Boş ve uyumlu seçim alanları otomatik doldurulur; mevcut parsel çalışması korunur.</p> : detailNotice ? <p role="status">{detailNotice}</p> : null}<a href={candidate.url} target="_blank" rel="noopener noreferrer">Kaynak ilanı aç ↗</a><Link href="/arsa-arastirma">Aday karşılaştırmasına dön →</Link></aside>;
}

