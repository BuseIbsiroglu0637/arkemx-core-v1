"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { assessLandCandidate, LAND_NEEDS, LAND_USES, landCriteriaKey, normalizeLandCandidate, object, parseLandCriteria, readLandResearch, readLandSourceStatus, type LandSourceStatus, type LandCandidate, type LandCriteria, type LandResearch, type LandSearchResponse } from "../lib/land-research";
import { useProjectKernel } from "./ProjectKernel";

export function LandResearchStudio() {
  const { project, hydrated, patchModule } = useProjectKernel();
  if (!hydrated) return <p role="status">Proje kaydı açılıyor…</p>;
  const brief = object(project.modules["decision-assistant"]), input = object(brief.input);
  if (!Object.keys(input).length) return <section className="land-notice"><p>Araştırmayı bağlamak için önce projenizi başlatın.</p><Link href="/proje-baslat">Yeni proje başlat →</Link></section>;
  const location = typeof input.location === "string" ? input.location.trim().split(/\s*\/\s*|\s+/) : [];
  const initial: LandCriteria = { province: location[0] || "", district: location.slice(1).join(" "), tenure: "sale", minArea: 0, maxArea: 0, maxPrice: 0,
    use: Object.hasOwn(LAND_USES, String(input.usage)) ? input.usage as LandCriteria["use"] : "industrial", needs: [] };
  return <LandResearchWorkspace key={project.id} name={project.name} initial={initial} saved={readLandResearch(brief.landResearch)} onSave={landResearch => patchModule("decision-assistant", { landResearch })} />;
}

function LandResearchWorkspace({ name, initial, saved, onSave }: { name: string; initial: LandCriteria; saved: LandResearch | null; onSave: (value: LandResearch) => void }) {
  const [criteria, setCriteria] = useState(saved?.criteria ?? initial);
  const [shortlist, setShortlist] = useState(saved?.shortlist ?? []);
  const [selectedId, setSelectedId] = useState<string | null>(saved?.selectedId ?? null);
  const [searchedAt, setSearchedAt] = useState(saved?.searchedAt ?? "");
  const [result, setResult] = useState<LandSearchResponse | null>(null);
  const [connection, setConnection] = useState<"loading" | "ready" | "missing" | "error">("loading");
  const [sourceStatus, setSourceStatus] = useState<LandSourceStatus[]>([]);
  const [browserMode, setBrowserMode] = useState(false);
  const [browserProvider, setBrowserProvider] = useState("Tarayıcı araştırması");
  const [busy, setBusy] = useState(false), [notice, setNotice] = useState("");
  const controller = useRef<AbortController | null>(null), sequence = useRef(0);
  const parsed = parseLandCriteria(criteria);
  const currentKey = landCriteriaKey(criteria);
  const candidates = result?.criteriaKey === currentKey ? result.candidates : [];
  const selected = shortlist.find(c => c.id === selectedId);
  const selectedAssessment = selected ? assessLandCandidate(selected, criteria) : null;
  const canInspect = Boolean(selected && selectedAssessment?.mismatch.length === 0);
  const shortlisted = useMemo(() => new Set(shortlist.map(c => c.id)), [shortlist]);
  useEffect(() => {
    const abort = new AbortController();
    fetch("/api/land-candidates", { cache: "no-store", signal: abort.signal }).then(async response => {
      if (!response.ok) throw Error();
      const data = object(await response.json()); setConnection(data.ready === true ? "ready" : "missing"); setBrowserMode(data.mode === "local-browser"); setBrowserProvider(typeof data.provider === "string" ? data.provider : "Tarayıcı araştırması");
    }).catch(() => { if (!abort.signal.aborted) setConnection("error"); });
    return () => { abort.abort(); controller.current?.abort(); sequence.current++; };
  }, []);
  function persist(next: { criteria?: LandCriteria; shortlist?: LandCandidate[]; selectedId?: string | null; searchedAt?: string } = {}) {
    onSave({ schema: "ARKEM-LAND-RESEARCH/1.0", criteria: next.criteria ?? criteria,
      shortlist: next.shortlist ?? shortlist, selectedId: next.selectedId === undefined ? selectedId : next.selectedId, searchedAt: next.searchedAt ?? searchedAt });
  }
  function change<K extends keyof LandCriteria>(key: K, value: LandCriteria[K]) {
    controller.current?.abort(); sequence.current++; setBusy(false); setResult(null); setSourceStatus([]); setNotice("");
    setCriteria(current => ({ ...current, [key]: value }));
  }
  async function search() {
    if (!parsed || busy) return;
    controller.current?.abort(); const abort = new AbortController(); controller.current = abort;
    const requestId = ++sequence.current; setBusy(true); setNotice(""); setResult(null); setSourceStatus([]); persist();
    try {
      const response = await fetch("/api/land-candidates", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(parsed), signal: abort.signal });
      const data = object(await response.json());
      if (requestId !== sequence.current) return;
      setSourceStatus(readLandSourceStatus(data.sources));
      if (!response.ok) { if (data.code === "not-configured") setConnection("missing"); throw Error(typeof data.error === "string" ? data.error : "Adaylar getirilemedi."); }
      if (data.schema !== "ARKEM-LAND-SEARCH/1.0" || data.criteriaKey !== currentKey || !Array.isArray(data.candidates) || typeof data.searchedAt !== "string" || typeof data.provider !== "string") throw Error("Arama yanıtı doğrulanamadı.");
      const timestamp = data.searchedAt;
      const safe = data.candidates.map((v: unknown) => normalizeLandCandidate(v, timestamp)).filter((c: LandCandidate | null): c is LandCandidate => Boolean(c));
      setResult({ schema: "ARKEM-LAND-SEARCH/1.0", criteriaKey: currentKey, provider: data.provider, searchedAt: data.searchedAt, candidates: safe, sources: readLandSourceStatus(data.sources) }); setSearchedAt(data.searchedAt); setConnection("ready"); persist({ searchedAt: data.searchedAt });
      if (!safe.length) setNotice("Bu aramada aday bulunamadı. Bölge veya kriterleri değiştirerek tekrar araştırabilirsiniz.");
    } catch (error) { if (!abort.signal.aborted && requestId === sequence.current) setNotice(error instanceof Error ? error.message : "Araştırma tamamlanamadı."); }
    finally { if (requestId === sequence.current) setBusy(false); }
  }
  function add(candidate: LandCandidate) {
    if (shortlisted.has(candidate.id)) return;
    if (shortlist.length >= 30) { setNotice("Kısa listede en fazla 30 aday tutulabilir."); return; }
    const next = [...shortlist, candidate]; setShortlist(next); persist({ shortlist: next }); setNotice("Aday kısa listeye kaydedildi.");
  }
  function remove(id: string) {
    const next = shortlist.filter(c => c.id !== id), selected = selectedId === id ? null : selectedId;
    setShortlist(next); setSelectedId(selected); persist({ shortlist: next, selectedId: selected });
  }
  function select(candidate: LandCandidate) {
    if (assessLandCandidate(candidate, criteria).mismatch.length) return;
    setSelectedId(candidate.id); persist({ selectedId: candidate.id });
    setNotice("Aday incelemeye alındı. Parsel, imar ve altyapı doğrulaması henüz tamamlanmadı.");
  }
  const money = (n: number | null) => n === null ? "Bilgi bulunamadı" : `${n.toLocaleString("tr-TR", { maximumFractionDigits: 0 })} TL`;
  function card(candidate: LandCandidate, savedCard: boolean) {
    const assessment = assessLandCandidate(candidate, criteria);
    return <article className={`land-card${selectedId === candidate.id ? " is-selected" : ""}`} key={candidate.id} data-candidate-url={candidate.url}>
      <div className="land-card-top"><span>{candidate.basis === "browser-listing" ? "Tarayıcıda okunan ilan kartı" : candidate.basis === "ai-search" ? "AI web araştırması" : candidate.basis === "search-index" ? "Arama dizininde bulunan ilan" : "İlan sağlayıcısı kaydı"}</span><b>{selectedId === candidate.id ? "İncelemede" : "Doğrulama bekliyor"}</b></div>
      <h3><a href={candidate.url} target="_blank" rel="noopener noreferrer">{candidate.title} ↗</a></h3>
      <p>{[candidate.province, candidate.district].filter(Boolean).join(" / ") || "Konum doğrulanmadı"}</p>
      <dl><div><dt>{candidate.tenure === "rent" ? "İstenen aylık kira" : candidate.tenure === "sale" ? "İstenen satış fiyatı" : "İşlem türü doğrulanmadı"}</dt><dd>{money(candidate.priceTRY)}</dd></div><div><dt>İlanda belirtilen alan</dt><dd>{candidate.areaM2 === null ? "Bilgi bulunamadı" : `${candidate.areaM2.toLocaleString("tr-TR")} m²`}</dd></div><div><dt>İlan fiyatı / alan</dt><dd>{assessment.unitPrice === null ? "Hesaplanamıyor" : `${money(assessment.unitPrice)} / m²${candidate.tenure === "rent" ? " / ay" : ""}`}</dd></div></dl>
      {candidate.description ? <p>{candidate.description}</p> : null}
      <p className={assessment.mismatch.length ? "land-watch" : "land-match"}>{assessment.mismatch.length ? assessment.mismatch.join(" · ") : assessment.matchesDeclaredCriteria ? "İlan beyanları arama kriterleriyle eşleşiyor" : "Aday bulundu; kriter eşleşmesi için bilgiler eksik"}</p>
      <ul>{[...assessment.missing, ...assessment.review].map(text => <li key={text}>{text}</li>)}</ul>
      <small>{candidate.source} · Araştırma: {new Date(candidate.retrievedAt).toLocaleString("tr-TR")}</small>
      <div className="land-card-actions">{savedCard ? <><button type="button" disabled={Boolean(assessment.mismatch.length)} aria-pressed={selectedId === candidate.id} onClick={() => select(candidate)}>İncelemeye al</button><button type="button" onClick={() => remove(candidate.id)}>Listeden çıkar</button></> : <button type="button" disabled={shortlisted.has(candidate.id)} onClick={() => add(candidate)}>{shortlisted.has(candidate.id) ? "Kısa listede ✓" : "Kısa listeye al"}</button>}</div>
    </article>;
  }
  return <section className="land-research" data-testid="land-research-studio">
    <div className="land-project"><b>{name}</b><span>{canInspect ? "Aday incelemesi" : "Arsa araştırılıyor"}</span><small>İlan bulmak, parsel veya imar doğrulamasını tamamlamaz.</small></div>
    <div className="land-layout"><form className="land-criteria" onSubmit={event => { event.preventDefault(); void search(); }}>
      <h2>Arsa arama kriterleri</h2><label>İl<input value={criteria.province} maxLength={60} required onChange={e => change("province", e.target.value)} /></label><label>İlçe · isteğe bağlı<input value={criteria.district} maxLength={60} onChange={e => change("district", e.target.value)} /></label>
      <label>İşlem türü<select value={criteria.tenure} onChange={e => change("tenure", e.target.value as LandCriteria["tenure"])}><option value="sale">Satın alma</option><option value="rent" disabled={browserMode}>Kiralama</option></select></label>
      <label>Yatırım kullanımı<select value={criteria.use} onChange={e => change("use", e.target.value as LandCriteria["use"])}>{Object.entries(LAND_USES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      {([ ["minArea", "En az arsa alanı · m²"], ["maxArea", "En fazla arsa alanı · m²"], ["maxPrice", criteria.tenure === "rent" ? "En fazla aylık arsa kirası · TL" : "Arsa satın alma bütçesi · TL"] ] as const).map(([key, label]) => <label key={key}>{label}<input type="number" min={0} step={1} value={criteria[key] || ""} placeholder="Sınır yok" onChange={e => change(key, e.target.value === "" ? 0 : Number(e.target.value))} /></label>)}
      <small>Arsa bütçesi toplam yatırım bütçesinden ayrıdır. Kapalı alan ihtiyacı, gerekli arsa alanıyla aynı değildir.</small>
      <fieldset><legend>İncelemede doğrulanacak ihtiyaçlar</legend>{LAND_NEEDS.map(need => <label key={need}><input type="checkbox" checked={criteria.needs.includes(need)} onChange={() => change("needs", criteria.needs.includes(need) ? criteria.needs.filter(n => n !== need) : [...criteria.needs, need])} />{need}</label>)}</fieldset>
      {!parsed ? <p className="land-watch">İl ve alan/bütçe aralıklarını kontrol edin.</p> : null}
      {browserMode ? <p className="land-source-note">{browserProvider}: yalnız satın alma, ilk sayfada en fazla 24 ilan kartı. Sonuçlar istenen toplam fiyata göre sıralanır.</p> : null}
      <button type="submit" disabled={!parsed || busy || connection !== "ready" || (browserMode && criteria.tenure !== "sale")}>{busy ? "Agent kaynakları araştırıyor…" : "Adayları getir"}</button>
      <button type="button" disabled={!parsed || busy} onClick={() => { persist(); setNotice("Arama kriterleri projeye kaydedildi."); }}>Kriterleri kaydet</button>
    </form><div className="land-results">
      {connection === "loading" ? <p role="status">Araştırma bağlantısı kontrol ediliyor…</p> : connection !== "ready" ? <div className="land-notice"><h2>Canlı araştırma bağlantısı bekleniyor</h2><p>Arama kriterlerinizi kaydedebilirsiniz. Veri bağlantısı etkinleştiğinde ARKEMX adayları getirecek.</p><p>Şu anda canlı ilan gösterilmiyor.</p></div> : <p className="land-source-note">Agent erişebildiği kaynaklarda araştırır. İlanların yayında olması ve bilgilerin doğruluğu kaynakta ayrıca kontrol edilir.</p>}
      {busy ? <p role="status">Adaylar aranıyor; sonuçlar kaynak bağlantılarıyla listelenecek.</p> : null}
      {notice ? <p role="status" className="land-notice">{notice}</p> : null}
      {sourceStatus.length ? <section className="land-source-status" aria-label="Araştırılan kaynaklar"><h2>Kaynak durumu</h2>{sourceStatus.map(item => <p key={item.name}><b>{item.name}: {item.status === "completed" ? "Arama tamamlandı" : item.status === "blocked" ? "Erişim engellendi" : "Araştırma tamamlanamadı"}</b>{item.status === "completed" ? <span> · {item.readCount} ilan kartı okundu{item.totalCount === null ? "" : ` · kaynakta ${item.totalCount} sonuç`}</span> : null}{item.note ? <small>{item.note}</small> : null}</p>)}</section> : null}
      <h2>Arama sonuçları {result && result.criteriaKey === currentKey ? `· ${candidates.length} aday` : ""}</h2>
      {candidates.length ? <div className="land-cards">{candidates.map(c => card(c, false))}</div> : <p>{result ? "Bu aramada gösterilecek aday bulunamadı." : sourceStatus.some(item => item.status !== "completed") ? "Araştırma tamamlanamadığı için ilanlar okunamadı." : "Kriterlerinizi belirleyip adayları getirin."}</p>}
    </div></div>
    <section className="land-shortlist" aria-label="Kaydedilen kısa liste"><h2>Kısa liste · {shortlist.length} aday</h2><p>Kaydedilen adaylar mevcut kriterlere göre tekrar değerlendirilir. Fiyatlar, kaydedildikleri tarihteki ilan bilgileri veya kaynak beyanlarıdır.</p>{shortlist.length ? <div className="land-cards">{shortlist.map(c => card(c, true))}</div> : <p>Getirilen adaylardan incelemek istediklerinizi kısa listeye alın.</p>}</section>
    {canInspect ? <section className="land-next"><div><b>{selected?.title}</b><p>Seçim, satın alma veya uygunluk onayı değildir. Şimdi parsel kimliği, sınırı ve imar kanıtını doğrulayın.</p></div><Link href="/arsa-fizibilite-studyosu?stage=locate#geo-studyo">Parsel incelemesine geç →</Link><button type="button" onClick={() => { setSelectedId(null); persist({ selectedId: null }); }}>Araştırmaya dön</button></section> : null}
  </section>;
}
