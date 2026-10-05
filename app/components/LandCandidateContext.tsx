"use client";
import { useEffect, useRef, useState } from "react";
import { normalizeLandZoningDeclaration } from "../lib/land-zoning-declaration";
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
  const zoningDeclaration = candidate?.zoningDeclaration;
  const detailVersion = candidate?.listingDetailVersion;
  useEffect(() => {
    if (!hydrated || !url || detailVersion === 2 || !/^https:\/\/www\.emlakjet\.com\/ilan\//.test(url)) return;
    const current = latestResearch.current;
    const selected = current?.shortlist.find(c => c.id === current.selectedId);
    if (!current || !selected || assessLandCandidate(selected, current.criteria).mismatch.length) return;
    const abort = new AbortController();
    setDetailNotice("Seçilen ilanın parsel ve imar beyanları otomatik okunuyor…");
    fetch("/api/land-candidate-detail", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url, province: selected.province, district: selected.district }), signal: abort.signal }).then(async response => {
      const data = object(await response.json());
      if (!response.ok) throw Error(typeof data.error === "string" ? data.error : "İlan detayı bağlantısı kullanılamıyor.");
      if (data.detailVersion !== 2 || data.schema !== "ARKEM-LAND-PARCEL-DETAIL/1.0" || data.url !== url || !["found", "missing"].includes(String(data.status))) throw Error("İlan detayı doğrulanamadı.");
      const zoningDeclaration = normalizeLandZoningDeclaration(data.zoningDeclaration, url);
      const parcelIdentity = normalizeLandParcelIdentity(data.parcelIdentity, url);
      if (data.status === "found" && !parcelIdentity) throw Error("İlanın ada/parsel bilgileri doğrulanamadı.");
      if (abort.signal.aborted) return;
      const latest = latestResearch.current;
      if (latest?.selectedId !== url) return;
      const latestCandidate = latest.shortlist.find(c => c.id === url);
      if (!latestCandidate || assessLandCandidate(latestCandidate, latest.criteria).mismatch.length) return;
      if (zoningDeclaration && (zoningDeclaration.province !== selected.province || zoningDeclaration.district !== selected.district)) throw Error("İmar beyanının konumu seçilen adayla eşleşmedi.");
      if (parcelIdentity && (parcelIdentity.province !== selected.province || parcelIdentity.district !== selected.district)) throw Error("İlanın konumu seçilen adayla eşleşmedi.");
      patchModule("decision-assistant", { landResearch: { ...latest, shortlist: latest.shortlist.map(c => c.id === url ? { ...c, parcelIdentity, zoningDeclaration, listingDetailVersion: 2 } : c) } });
      setDetailNotice("");
    }).catch(error => { if (!abort.signal.aborted) setDetailNotice(error instanceof Error ? error.message : "Ada/parsel bilgileri okunamadı."); });
    return () => abort.abort();
  }, [hydrated, url, detailVersion, patchModule]);
  if (!hydrated || !research || !candidate || assessLandCandidate(candidate, research.criteria).mismatch.length) return null;
  return <aside className="arx-candidate-context" aria-label="İncelemeye alınan arsa adayı"><b>İncelemeye alınan aday: {candidate.title}</b><p>Bu kayıt bir ilan araştırmasıdır. Ada/parsel bilgisi ilan beyanıdır; resmî sınır ve imar doğrulaması bekleniyor; ilan alanı hesaplara aktarılmadı.</p>{identity ? <p>İlan beyanı: {identity.neighborhood} · Ada {identity.block} / Parsel {identity.parcelNo}. Boş ve uyumlu seçim alanları otomatik doldurulur; mevcut parsel çalışması korunur.</p> : detailNotice ? <p role="status">{detailNotice}</p> : detailVersion === 2 ? <p>İlanda tam mahalle/köy, ada ve parsel bilgisi bulunamadı; eksik seçim alanları boş bırakıldı.</p> : null}{zoningDeclaration ? <p>İmar beyanı: {zoningDeclaration.landUse || "Kullanım belirtilmemiş"} · TAKS {zoningDeclaration.taks ?? "bilgi yok"} · KAKS {zoningDeclaration.kaks ?? "bilgi yok"} · Hmax {zoningDeclaration.hmax === null ? "bilgi yok" : `${zoningDeclaration.hmax} m`}. Kaynak: seçilen ilan; resmî doğrulama bekliyor.</p> : detailVersion === 2 ? <p>İlanda açık imar değerleri bulunamadı. Arama varsayımları imar formuna aktarılmadı.</p> : null}<a href={candidate.url} target="_blank" rel="noopener noreferrer">Kaynak ilanı aç ↗</a><Link href="/arsa-arastirma">Aday karşılaştırmasına dön →</Link></aside>;
}

