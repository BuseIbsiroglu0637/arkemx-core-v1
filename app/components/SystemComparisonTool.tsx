"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { downloadTextFile } from "../lib/engineering";
import { buildMcdaProjectSnapshot, mcdaInputMatchesSource, mcdaSourceKey, mcdaSourceMatches, type McdaSourceSnapshot } from "../lib/mcda-source";
import { ProjectKernelBar, useProjectKernel } from "./ProjectKernel";

type SystemId = "light" | "steel" | "precast" | "concrete" | "hybrid";
type CriterionId = "schedule" | "certainty" | "span" | "mass" | "carbon" | "flexibility" | "supply" | "fire";

const criteria: { id: CriterionId; label: string; note: string }[] = [
  { id: "schedule", label: "Program / yapım hızı", note: "Üretim, saha süresi ve montaj potansiyeli" },
  { id: "certainty", label: "Maliyet öngörülebilirliği", note: "Kapsam kilitleme ve değişiklik hassasiyeti" },
  { id: "span", label: "Açıklık performansı", note: "Kolonsuz alan ve yapısal verim" },
  { id: "mass", label: "Kütle / deprem talebi", note: "Taşıyıcı sistem öz ağırlığı eğilimi" },
  { id: "carbon", label: "Karbon / sökülebilirlik", note: "Malzeme yoğunluğu ve yeniden kullanım potansiyeli" },
  { id: "flexibility", label: "Mimari esneklik", note: "Geometri, değişim ve uyarlama kabiliyeti" },
  { id: "supply", label: "Yerel tedarik erişimi", note: "Pazar, ekip ve malzeme bulunabilirliği" },
  { id: "fire", label: "Yangın dayanımı", note: "Koruma katmanları dahil genel çözüm potansiyeli" },
];

const profiles: Record<SystemId, { name: string; slug: string; description: string; maxSpan: number; maxFloors: number; scores: Record<CriterionId, number>; risks: string[] }> = {
  light: { name: "Hafif Çelik", slug: "hafif-celik", description: "Tekrarlı modüllerde düşük kütle, fabrika üretimi ve hızlı kuru yapım.", maxSpan: 8, maxFloors: 5, scores: { schedule: 5, certainty: 4, span: 2, mass: 5, carbon: 5, flexibility: 4, supply: 3, fire: 3 }, risks: ["İnce cidarlı eleman stabilitesi", "Akustik ve yangın katmanı sürekliliği", "Üretim detayı bağımlılığı"] },
  steel: { name: "Yapısal Çelik", slug: "celik", description: "Geniş açıklık, esnek geometri ve yüksek fabrika kontrolü.", maxSpan: 40, maxFloors: 24, scores: { schedule: 4, certainty: 3, span: 5, mass: 4, carbon: 4, flexibility: 5, supply: 4, fire: 3 }, risks: ["Yangın koruması", "Birleşim ve stabilite tasarımı", "Fiyat / kur değişkenliği"] },
  precast: { name: "Betonarme Prefabrik", slug: "betonarme-prefabrik", description: "Tekrarlı akslarda seri üretim, kontrollü kalite ve hızlı montaj.", maxSpan: 24, maxFloors: 12, scores: { schedule: 5, certainty: 4, span: 4, mass: 2, carbon: 3, flexibility: 3, supply: 3, fire: 5 }, risks: ["Lojistik ve vinç erişimi", "Birleşim / diyafram davranışı", "Erken karar kilitleme"] },
  concrete: { name: "Betonarme", slug: "betonarme", description: "Yaygın tedarik ağı, rijitlik ve çok katlı yapım ekosistemi.", maxSpan: 12, maxFloors: 40, scores: { schedule: 2, certainty: 4, span: 3, mass: 1, carbon: 2, flexibility: 4, supply: 5, fire: 5 }, risks: ["Saha üretim kalite değişkenliği", "Kalıp / kür / iklim programı", "Yüksek öz ağırlık"] },
  hybrid: { name: "Karma Sistem", slug: "karma-sistem", description: "Çekirdek, döşeme ve çerçevede farklı sistemlerin birlikte optimizasyonu.", maxSpan: 40, maxFloors: 40, scores: { schedule: 3, certainty: 2, span: 5, mass: 4, carbon: 4, flexibility: 5, supply: 2, fire: 4 }, risks: ["Arayüz ve tolerans yönetimi", "Disiplinler arası sorumluluk", "Yoğun BIM / koordinasyon ihtiyacı"] },
};

const defaultWeights: Record<CriterionId, number> = { schedule: 5, certainty: 4, span: 4, mass: 4, carbon: 3, flexibility: 4, supply: 3, fire: 3 };
const usageLabels: Record<string, string> = {
  industrial: "Sanayi / üretim",
  storage: "Depo / lojistik",
  residential: "Konut",
  commercial: "Ticari / sosyal",
};
const formatArea = (value: number) => value.toLocaleString("tr-TR", { maximumFractionDigits: 1 });
const formatSpan = (value: number) => value.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const formatScore = (value: number) => value.toLocaleString("tr-TR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

export function SystemComparisonTool({ simple = false }: { simple?: boolean } = {}) {
  const transferApplied = useRef(false);
  const [transferReady, setTransferReady] = useState(false);
  const { patchModule, thread, project, hydrated } = useProjectKernel();
  const [usage, setUsage] = useState("industrial");
  const [floors, setFloors] = useState(2);
  const [span, setSpan] = useState(18);
  const [area, setArea] = useState(2400);
  const [repetition, setRepetition] = useState(70);
  const [transport, setTransport] = useState(180);
  const [fireRating, setFireRating] = useState(90);
  const [weights, setWeights] = useState(defaultWeights);
  const [shortlist, setShortlist] = useState<SystemId[]>(["steel", "precast", "hybrid"]);
  const [view, setView] = useState<"ranking" | "matrix" | "sensitivity">("ranking");
  const [sourceSnapshot, setSourceSnapshot] = useState<McdaSourceSnapshot | null>(null);
  const [manualOverrideIntent, setManualOverrideIntent] = useState(false);

  const currentProjectSource = useMemo(() => buildMcdaProjectSnapshot({
    use: thread.canonical.architecture.use,
    floors: thread.canonical.architecture.floors,
    grossArea: thread.canonical.architecture.grossArea,
    spanX: thread.canonical.structure.spanX,
    spanY: thread.canonical.structure.spanY,
  }), [thread.canonical]);

  const currentMcdaInput = useMemo(() => ({ usage, floors, span, area }), [area, floors, span, usage]);
  const sourceSnapshotCurrent = sourceSnapshot && currentProjectSource
    ? mcdaSourceMatches(sourceSnapshot, currentProjectSource)
    : false;
  const inputMatchesProject = mcdaInputMatchesSource(currentMcdaInput, currentProjectSource);
  const sourceStale = Boolean(
    transferReady
    && currentProjectSource
    && (sourceSnapshot ? !sourceSnapshotCurrent : !inputMatchesProject)
  );
  const manualOverride = Boolean(
    transferReady
    && currentProjectSource
    && sourceSnapshotCurrent
    && manualOverrideIntent
    && !inputMatchesProject
  );

  const ranking = useMemo(() => {
    const totalWeight = Object.values(weights).reduce((sum, value) => sum + value, 0);
    return (Object.entries(profiles) as [SystemId, (typeof profiles)[SystemId]][]).map(([id, profile]) => {
      const weighted = criteria.reduce((sum, criterion) => sum + profile.scores[criterion.id] * weights[criterion.id], 0) / Math.max(1, totalWeight * 5) * 100;
      let modifier = 0;
      const constraints: string[] = [];
      if (span > profile.maxSpan) { modifier -= Math.min(35, (span - profile.maxSpan) * 2.5); constraints.push(`${span} m açıklık tipik ön tarama aralığını aşıyor`); }
      if (floors > profile.maxFloors) { modifier -= 35; constraints.push(`${floors} kat için sistem özel doğrulama gerekir`); }
      if (usage === "residential" && id === "light") modifier += 5;
      if (usage === "industrial" && (id === "steel" || id === "precast")) modifier += 5;
      if (usage === "storage" && span > 16 && id === "steel") modifier += 5;
      if (usage === "commercial" && id === "hybrid") modifier += 3;
      if (repetition > 70 && (id === "precast" || id === "light")) modifier += 4;
      if (transport > 300 && id === "precast") { modifier -= 5; constraints.push("Uzun taşıma mesafesi lojistik inceleme gerektiriyor"); }
      if (fireRating >= 120 && (id === "light" || id === "steel")) { modifier -= 3; constraints.push(`${fireRating} dk yangın hedefi koruma sistemi tasarımı gerektiriyor`); }
      const score = Math.max(0, Math.min(100, weighted + modifier));
      const uncertainty = 7 + constraints.length * 3 + (area > 10_000 ? 3 : 0);
      return { id, ...profile, score, low: Math.max(0, score - uncertainty), high: Math.min(100, score + uncertainty), constraints };
    }).sort((a, b) => b.score - a.score);
  }, [area, fireRating, floors, repetition, span, transport, usage, weights]);

  useEffect(() => {
    // Do not overwrite the intake's saved MCDA values before state restoration.
    if (!hydrated || !transferReady) return;
    patchModule("system-comparison", {
      input: { usage, floors, span, area, repetition, transport, fireRating },
      weights,
      ranking,
      shortlist,
      sourceSnapshot,
      manualOverrideIntent,
      sourceKey: mcdaSourceKey(sourceSnapshot),
      sourceStatus: sourceStale ? "stale" : manualOverride ? "manual-override" : "current",
      status: "mcda-pre-screen",
    });
  }, [area, fireRating, floors, hydrated, manualOverride, manualOverrideIntent, patchModule, ranking, repetition, shortlist, sourceSnapshot, sourceStale, span, transferReady, transport, usage, weights]);

  const updateWeight = (id: CriterionId, value: number) => setWeights((current) => ({ ...current, [id]: value }));
  const toggleShortlist = (id: SystemId) => setShortlist((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  const importProjectGeometry = useCallback(() => {
    if (!currentProjectSource) return;

    // Persist the canonical project source immediately. Relying only on the
    // render-driven effect leaves a short window where another workspace can
    // still read the previous MCDA input/source snapshot.
    patchModule("system-comparison", {
      input: {
        usage: currentProjectSource.usage,
        floors: currentProjectSource.floors,
        span: currentProjectSource.span,
        area: currentProjectSource.area,
        repetition,
        transport,
        fireRating,
      },
      sourceSnapshot: currentProjectSource,
      sourceKey: mcdaSourceKey(currentProjectSource),
      sourceStatus: "current",
      status: "mcda-pre-screen",
    });

    setFloors(currentProjectSource.floors);
    setArea(Number(currentProjectSource.area.toFixed(1)));
    setSpan(Number(currentProjectSource.span.toFixed(2)));
    setUsage(currentProjectSource.usage);
    setSourceSnapshot(currentProjectSource);
    setManualOverrideIntent(false);
  }, [currentProjectSource, fireRating, patchModule, repetition, transport]);
  useEffect(() => {
    if (!hydrated || transferApplied.current) return;
    const timer = window.setTimeout(() => {
    if (transferApplied.current) return;
    transferApplied.current = true;
    const saved = project.modules["system-comparison"] as {
      input?: Record<string, unknown>;
      weights?: Record<CriterionId, number>;
      shortlist?: SystemId[];
      sourceSnapshot?: McdaSourceSnapshot;
      manualOverrideIntent?: boolean;
    } | undefined;
    if (saved?.input) {
      const input = saved.input;
      if (typeof input.usage === "string") setUsage(input.usage);
      if (typeof input.floors === "number") setFloors(input.floors);
      if (typeof input.span === "number") setSpan(Number(input.span.toFixed(2)));
      if (typeof input.area === "number") setArea(Number(input.area.toFixed(1)));
      if (typeof input.repetition === "number") setRepetition(input.repetition);
      if (typeof input.transport === "number") setTransport(input.transport);
      if (typeof input.fireRating === "number") setFireRating(input.fireRating);
      if (saved.weights) setWeights(saved.weights);
      if (saved.shortlist) setShortlist(saved.shortlist);
      if (currentProjectSource) {
        const explicitManualScenario = saved.manualOverrideIntent === true
          && saved.sourceSnapshot
          && mcdaSourceMatches(saved.sourceSnapshot, currentProjectSource)
          && !mcdaInputMatchesSource(input, currentProjectSource);
        if (explicitManualScenario) {
          setSourceSnapshot(saved.sourceSnapshot ?? currentProjectSource);
          setManualOverrideIntent(true);
        } else if (mcdaInputMatchesSource(input, currentProjectSource)) {
          setSourceSnapshot(currentProjectSource);
          setManualOverrideIntent(false);
        } else {
          // Legacy/stale MCDA records may contain old inputs with a current
          // source snapshot. Unless the user explicitly created a manual
          // scenario, open from the live project geometry.
          setUsage(currentProjectSource.usage);
          setFloors(currentProjectSource.floors);
          setArea(Number(currentProjectSource.area.toFixed(1)));
          setSpan(Number(currentProjectSource.span.toFixed(2)));
          setSourceSnapshot(currentProjectSource);
          setManualOverrideIntent(false);
        }
      } else if (saved.sourceSnapshot) {
        setSourceSnapshot(saved.sourceSnapshot);
        setManualOverrideIntent(saved.manualOverrideIntent === true);
      }
    } else {
      importProjectGeometry();
    }
    setTransferReady(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [currentProjectSource, hydrated, importProjectGeometry, project.modules]);
  const exportJson = () => downloadTextFile("arkem-sistem-mcda.json", JSON.stringify({ schema: "ARKEM-MCDA/1.0", inputs: { usage, floors, span, area, repetition, transport, fireRating }, weights, results: ranking, shortlist }, null, 2), "application/json");
  const exportCsv = () => downloadTextFile("arkem-sistem-karsilastirma.csv", ["rank,system,score,low,high,constraints", ...ranking.map((item, index) => `${index + 1},${item.name},${item.score.toFixed(1)},${item.low.toFixed(1)},${item.high.toFixed(1)},"${item.constraints.join("; ")}"`)].join("\n"), "text/csv;charset=utf-8");

  if (simple) {
    const activeUsage = currentProjectSource?.usage ?? usage;
    const activeArea = currentProjectSource?.area ?? area;
    const activeFloors = currentProjectSource?.floors ?? floors;
    const activeSpan = currentProjectSource?.span ?? span;

    return <section className="arx-system-tool" data-testid="system-comparison-tool">
      <section className="arx-system-context" aria-label="Aktif proje özeti">
        <div className="arx-system-context-copy">
          <span>MÜHENDİSLİK / SİSTEM SEÇİMİ</span>
          <h2>{project.name}</h2>
          <p>Çok ölçütlü sistem ön değerlendirmesi</p>
          <small>Ön değerlendirme · {project.revision}</small>
        </div>
        <dl className="arx-system-context-kpis">
          <div><dt>Kullanım</dt><dd>{usageLabels[activeUsage] ?? activeUsage}</dd></div>
          <div><dt>Brüt alan</dt><dd>{formatArea(activeArea)} m²</dd></div>
          <div><dt>Kat</dt><dd>{activeFloors}</dd></div>
          <div><dt>En büyük açıklık</dt><dd>{formatSpan(activeSpan)} m</dd></div>
        </dl>
      </section>
      {sourceStale && currentProjectSource ? <section className="arx-mcda-source-status is-stale" role="alert">
        <div>
          <span>PROJE VERİSİ GÜNCELLENDİ</span>
          <b>Karşılaştırma girdileri aktif proje verisinden farklı.</b>
          <p>Karşılaştırma: {formatArea(area)} m² · {floors} kat · {formatSpan(span)} m açıklık. Güncel proje: {formatArea(currentProjectSource.area)} m² · {currentProjectSource.floors} kat · {formatSpan(currentProjectSource.span)} m açıklık.</p>
        </div>
        <button type="button" onClick={importProjectGeometry}>Proje verilerini yenile ve puanları güncelle</button>
      </section> : manualOverride && currentProjectSource ? <section className="arx-mcda-source-status is-override" role="note">
        <div>
          <span>MANUEL KARŞILAŞTIRMA SENARYOSU</span>
          <b>Girdiler güncel projeden bilinçli olarak farklılaştırıldı.</b>
          <p>Aktif proje referansı {formatArea(currentProjectSource.area)} m² · {currentProjectSource.floors} kat · {formatSpan(currentProjectSource.span)} m açıklık.</p>
        </div>
        <button type="button" onClick={importProjectGeometry}>Güncel proje değerlerine dön</button>
      </section> : currentProjectSource ? <section className="arx-mcda-source-status is-current" role="status">
        <div><span>PROJE VERİSİYLE SENKRON</span><b>Karşılaştırma güncel proje girdilerini kullanıyor.</b><p>Alan, kat, kullanım ve açıklık değerleri proje zinciriyle eşleşiyor.</p></div>
      </section> : null}
      <div className="arx-system-grid">
        <section className="arx-system-panel" aria-labelledby="arx-system-input-title">
          <header className="arx-system-panel-head">
            <div><h2 id="arx-system-input-title">Proje girdileri</h2><p>Plan ve aks aşamasından gelen değerleri kullanın veya karşılaştırma senaryosu için düzenleyin.</p></div>
            <button type="button" onClick={importProjectGeometry}>Proje verilerini yenile</button>
          </header>
          <div className="arx-system-fields">
            <label>Kullanım
              <select value={usage} onChange={(event) => { setUsage(event.target.value); setManualOverrideIntent(true); }}>
                <option value="industrial">Sanayi / üretim</option>
                <option value="storage">Depo / lojistik</option>
                <option value="residential">Konut</option>
                <option value="commercial">Ticari / sosyal</option>
              </select>
            </label>
            <label>Kat adedi
              <input type="number" min="1" max="50" value={floors} onChange={(event) => { setFloors(Number(event.target.value)); setManualOverrideIntent(true); }} />
            </label>
            <label>En büyük açıklık (m)
              <input type="number" min="3" max="60" step=".01" value={span} onChange={(event) => { setSpan(Number(event.target.value)); setManualOverrideIntent(true); }} />
            </label>
            <label>Brüt alan (m²)
              <input type="number" min="50" max="100000" step="1" value={area} onChange={(event) => { setArea(Number(event.target.value)); setManualOverrideIntent(true); }} />
            </label>
          </div>
          <details className="arx-system-detail">
            <summary>Diğer proje girdileri</summary>
            <div className="arx-system-fields">
              <label>Yangın hedefi (dk)
                <input type="number" min="30" max="240" step="30" value={fireRating} onChange={(event) => setFireRating(Number(event.target.value))} />
              </label>
              <label>Tekrar oranı (%)
                <input type="number" min="0" max="100" step="5" value={repetition} onChange={(event) => setRepetition(Number(event.target.value))} />
              </label>
              <label>Taşıma mesafesi (km)
                <input type="number" min="10" max="1000" step="10" value={transport} onChange={(event) => setTransport(Number(event.target.value))} />
              </label>
            </div>
          </details>
          <details className="arx-system-detail">
            <summary>Kriter öncelikleri ve ağırlıkları</summary>
            <div className="arx-system-weights">
              {criteria.map((criterion) => <label key={criterion.id}>
                <span><b>{criterion.label}</b><small>{criterion.note}</small></span>
                <input type="range" aria-label={criterion.label} min="0" max="5" step="1" value={weights[criterion.id]} onChange={(event) => updateWeight(criterion.id, Number(event.target.value))} />
                <strong>{weights[criterion.id]}</strong>
              </label>)}
              <button type="button" onClick={() => setWeights(defaultWeights)}>Varsayılan ağırlıklar</button>
            </div>
          </details>
        </section>
        <section className="arx-system-panel arx-system-results" aria-labelledby="arx-system-results-title">
          <header className="arx-system-panel-head">
            <div><h2 id="arx-system-results-title">Sistem ön değerlendirmesi</h2><p>Beş alternatif; puan, belirsizlik bandı ve inceleme gerektiren koşullarla birlikte sıralanır.</p></div>
            <div className="arx-system-exports">
              <button type="button" onClick={exportJson}>JSON indir</button>
              <button type="button" onClick={exportCsv}>CSV indir</button>
            </div>
          </header>
          <div className="arx-system-list">
            {ranking.map((item) => <article key={item.id} className={shortlist.includes(item.id) ? "arx-system-result is-selected" : "arx-system-result"}>
              <div className="arx-system-result-name">
                <div className="arx-system-result-title"><h3>{item.name}</h3>{shortlist.includes(item.id) ? <span>Seçildi</span> : null}</div>
                <p>{item.description}</p>
                <small>{item.constraints[0] ?? "Ön taramada belirgin kısıt görünmüyor."}</small>
              </div>
              <div className="arx-system-score" aria-label={item.name + " ön tarama puanı"}>
                <div><strong>{formatScore(item.score)}</strong><small>belirsizlik bandı</small></div>
                <div className="arx-system-score-track" aria-hidden="true">
                  <i style={{ left: item.low + "%", width: (item.high - item.low) + "%" }} />
                  <b style={{ left: item.score + "%" }} />
                </div>
                <small>{item.low.toFixed(0)}–{item.high.toFixed(0)} puan</small>
              </div>
              <button type="button" aria-pressed={shortlist.includes(item.id)} onClick={() => toggleShortlist(item.id)}>
                {shortlist.includes(item.id) ? "Kısa listeden çıkar" : "Kısa listeye ekle"}
              </button>
            </article>)}
          </div>
          <details className="arx-system-detail">
            <summary>Teknik puan matrisi</summary>
            <div className="arx-system-table-wrap">
              <table className="arx-system-table">
                <caption className="sr-only">Kriterlere göre beş taşıyıcı sistemin teknik puanları</caption>
                <thead><tr><th scope="col">Kriter (ağırlık)</th>{(Object.keys(profiles) as SystemId[]).map((id) => <th scope="col" key={id}>{profiles[id].name}</th>)}</tr></thead>
                <tbody>{criteria.map((criterion) => <tr key={criterion.id}>
                  <th scope="row">{criterion.label} ({weights[criterion.id]}/5)</th>
                  {(Object.keys(profiles) as SystemId[]).map((id) => <td key={id}>{profiles[id].scores[criterion.id]}/5</td>)}
                </tr>)}</tbody>
              </table>
            </div>
          </details>
          <details className="arx-system-detail">
            <summary>Duyarlılık ve belirsizlik notları</summary>
            <div className="arx-system-sensitivity">
              <p>Sonuçlar zemin, kesin yükler, yerel fiyat ve termin, üretici kapasitesi ve detay seviyesi doğrulanmadan kesin sistem seçimi olarak yorumlanmamalıdır.</p>
              {ranking.map((item) => <p key={item.id}><b>{item.name}:</b> {item.low.toFixed(0)}–{item.high.toFixed(0)} puan · {item.constraints.length ? item.constraints.join("; ") : "Özel kısıt saptanmadı."}</p>)}
            </div>
          </details>
        </section>
      </div>
      <section className="arx-system-panel arx-system-shortlist" aria-labelledby="arx-system-shortlist-title">
        <div className="arx-system-shortlist-main">
          <div className="arx-system-shortlist-heading">
            <div><span>KISA LİSTE · {shortlist.length}</span><h2 id="arx-system-shortlist-title">Birlikte değerlendirilecek sistemler</h2><p>Seçili alternatifler bir sonraki ön taşıyıcı tasarım aşamasına birlikte aktarılır.</p></div>
            {shortlist.length ? <button type="button" onClick={() => setShortlist([])}>Listeyi temizle</button> : null}
          </div>
          <div className="arx-system-tags">
            {ranking.filter((item) => shortlist.includes(item.id)).map((item) => <button type="button" key={item.id} onClick={() => toggleShortlist(item.id)}>{item.name}<span>×</span></button>)}
            {shortlist.length === 0 ? <span className="is-empty">Henüz sistem seçilmedi.</span> : null}
          </div>
        </div>
        <div className="arx-system-next">
          <p>Kısa listedeki sistemlerle ön taşıyıcı tasarım aşamasına geçin.</p>
          {shortlist.length ? <Link href="/tasiyici-on-tasarim">Taşıyıcı ön tasarıma geç →</Link> : <button type="button" disabled>Önce sistem seçin</button>}
        </div>
      </section>
      <p className="arx-system-note" role="note"><b>Karar sınırı:</b> Bu ekran sistem alternatiflerini erken aşamada karşılaştırır; statik uygunluk, yönetmelik kontrolü, keşif, teklif veya uygulama kararı değildir.</p>
    </section>;
  }

  return <section className="system-comparison-tool mcda-tool" data-testid="system-comparison-tool">
    <ProjectKernelBar moduleKey="system-comparison" module="STRUCTURAL SYSTEM MCDA" confidence="Çok ölçütlü ön eleme" />
    <div className="mcda-heading"><div><p className="eyebrow light">Arkem Çok Ölçütlü Karar Motoru</p><h2>Tek puan değil,<br/><em>gerekçeli sistem seçimi.</em></h2></div><p>Beş taşıyıcı sistemi proje geometrisi ve sizin kriter ağırlıklarınızla karşılaştırın. Sonuç aralıkları veri belirsizliğini, engel notları ise detaylı inceleme gerektiren başlıkları gösterir.</p></div>
    <div className="mcda-thread-sync"><div><span>BAĞLI PROJE VERİSİ</span><b>Alan, kat, kullanım ve en büyük açıklığı ortak modelden alın.</b></div><button className="thread-import-button primary" onClick={importProjectGeometry}>Parsel / mimari / aks verisini aktar ↘</button></div>
    <div className="mcda-workspace">
      <aside className="mcda-inputs"><span>01 / PROJE GİRDİLERİ</span><label>Kullanım<select value={usage} onChange={(event) => setUsage(event.target.value)}><option value="industrial">Sanayi / üretim</option><option value="storage">Depo / lojistik</option><option value="residential">Konut</option><option value="commercial">Ticari / sosyal</option></select></label><div className="mcda-number-grid"><label>Kat<input type="number" min="1" max="50" value={floors} onChange={(event) => setFloors(Number(event.target.value))}/></label><label>En büyük açıklık<input type="number" min="3" max="60" step=".5" value={span} onChange={(event) => setSpan(Number(event.target.value))}/><i>m</i></label><label>Brüt alan<input type="number" min="50" max="100000" step="50" value={area} onChange={(event) => setArea(Number(event.target.value))}/><i>m²</i></label><label>Yangın hedefi<input type="number" min="30" max="240" step="30" value={fireRating} onChange={(event) => setFireRating(Number(event.target.value))}/><i>dk</i></label><label>Tekrar oranı<input type="number" min="0" max="100" step="5" value={repetition} onChange={(event) => setRepetition(Number(event.target.value))}/><i>%</i></label><label>Taşıma mesafesi<input type="number" min="10" max="1000" step="10" value={transport} onChange={(event) => setTransport(Number(event.target.value))}/><i>km</i></label></div><span>02 / KRİTER AĞIRLIKLARI</span><div className="mcda-weights">{criteria.map((criterion) => <label key={criterion.id}><div><b>{criterion.label}</b><small>{criterion.note}</small></div><input type="range" min="0" max="5" step="1" value={weights[criterion.id]} onChange={(event) => updateWeight(criterion.id, Number(event.target.value))}/><strong>{weights[criterion.id]}</strong></label>)}</div><button className="mcda-reset" onClick={() => setWeights(defaultWeights)}>Varsayılan ağırlıkları yükle</button></aside>
      <main className="mcda-results"><header><nav>{(["ranking","matrix","sensitivity"] as const).map((item) => <button key={item} className={view === item ? "active" : ""} onClick={() => setView(item)}>{item === "ranking" ? "Sıralama" : item === "matrix" ? "Puan matrisi" : "Duyarlılık"}</button>)}</nav><div><button onClick={exportJson}>JSON ↓</button><button onClick={exportCsv}>CSV ↓</button></div></header>
        {view === "ranking" && <div className="mcda-ranking"><div className="mcda-result-meta"><span>SKOR</span><span>BELİRSİZLİK BANDI</span><span>ÖN ELEME NOTU</span></div>{ranking.map((item, index) => <article key={item.id} className={shortlist.includes(item.id) ? "selected" : ""}><button className="mcda-shortlist" onClick={() => toggleShortlist(item.id)} aria-label={`${item.name} kısa listesini değiştir`}>{shortlist.includes(item.id) ? "✓" : "+"}</button><div className="mcda-rank"><span>{String(index + 1).padStart(2,"0")}</span><strong>{item.score.toFixed(1)}</strong></div><div className="mcda-system"><h3>{item.name}</h3><p>{item.description}</p><Link href={`/yapi-sistemleri/${item.slug}`}>Teknik sistem rehberi ↗</Link></div><div className="mcda-band"><i><b style={{ left: `${item.low}%`, width: `${item.high - item.low}%` }}></b><span style={{ left: `${item.score}%` }}></span></i><small>{item.low.toFixed(0)}–{item.high.toFixed(0)}</small></div><div className="mcda-constraints">{item.constraints.length ? item.constraints.map((constraint) => <p key={constraint}><i>!</i>{constraint}</p>) : <p className="pass"><i>✓</i>Ön elemede sert engel görünmüyor</p>}</div></article>)}</div>}
        {view === "matrix" && <div className="mcda-matrix"><table><caption className="sr-only">Taşıyıcı sistem teknik puan matrisi</caption><thead><tr><th>Kriter / ağırlık</th>{(Object.keys(profiles) as SystemId[]).map((id) => <th key={id}>{profiles[id].name}</th>)}</tr></thead><tbody>{criteria.map((criterion) => <tr key={criterion.id}><th><b>{criterion.label}</b><small>Ağırlık {weights[criterion.id]}/5</small></th>{(Object.keys(profiles) as SystemId[]).map((id) => <td key={id}><i style={{ "--score": `${profiles[id].scores[criterion.id] * 20}%` } as React.CSSProperties}></i><b>{profiles[id].scores[criterion.id]}</b><small>/5</small></td>)}</tr>)}</tbody></table></div>}
        {view === "sensitivity" && <div className="mcda-sensitivity"><header><span>DUYARLILIK OKUMASI</span><h3>Karar hangi girdiye ne kadar bağlı?</h3><p>Belirsizlik bandı; zemin, kesin yükler, yerel fiyat/termin, üretici ve detay seviyesi bilinmediği için sonucu tek sayı gibi yorumlamayı engeller.</p></header><div className="sensitivity-chart">{ranking.map((item) => <article key={item.id}><b>{item.name}</b><div><i style={{ left: `${item.low}%`, width: `${item.high - item.low}%` }}></i><span style={{ left: `${item.score}%` }}></span></div><small>{item.score.toFixed(1)}</small></article>)}</div><section><span>KARARIN DEĞİŞEBİLECEĞİ DURUMLAR</span>{[["Zemin ve temel","Ağır sistemlerin maliyet / deprem etkisi yeniden sıralanabilir."],["Yerel tedarik","Termin ve üretim kapasitesi hız puanını değiştirebilir."],["Yangın senaryosu",`${fireRating} dakika hedefi kaplama, kesit ve maliyeti etkiler.`],["Mimari revizyon","Açıklık ve kat değişimi mevcut puanları geçersiz kılabilir."]].map(([title,copy]) => <p key={title}><b>{title}</b><span>{copy}</span></p>)}</section></div>}
      </main>
      <aside className="mcda-shortlist-panel"><span>03 / KISA LİSTE</span><h3>{shortlist.length} sistem birlikte incelenecek</h3>{ranking.filter((item) => shortlist.includes(item.id)).map((item) => <article key={item.id}><div><b>{item.name}</b><strong>{item.score.toFixed(1)}</strong></div><p>{item.risks[0]}</p></article>)}<div className="mcda-next-data"><span>KARARI KESİNLEŞTİREN VERİ</span>{["Zemin etüdü ve temel varsayımı","Taşıyıcı yükler ve açıklık şeması","Yangın ve yapı fiziği hedefleri","Yerel keşif, termin ve lojistik","Üretici / uygulayıcı yeterliliği"].map((item) => <p key={item}>→ {item}</p>)}</div><Link href="/tasiyici-on-tasarim">Taşıyıcı ön tasarıma geç ↗</Link></aside>
    </div>
    <footer className="mcda-foot"><b>Karar sınırı</b><p>MCDA sonucu, tanımlanan kriter ve ağırlıklara bağlı ön elemedir; statik uygunluk, yönetmelik kontrolü, keşif, teklif veya uygulama kararı değildir. Kesin seçim, aynı performans şartnamesine göre hazırlanmış proje alternatifleri ve güncel piyasa verisiyle yapılır.</p></footer>
  </section>;
}

