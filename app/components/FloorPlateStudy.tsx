"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createGridDxf, downloadTextFile, type StructuralConceptInput } from "../lib/engineering";
import { createCorporateTechnicalPdf, type TechnicalSheetPolyline } from "../lib/technical-sheet";
import { calculateFloorPlateStudy, floorStudyDocument, recordFloorStudy, sealFloorStudyDocument, type FloorStudyRecord } from "../lib/floor-plate-study";
import { traceJson } from "../lib/structural-traceability";
import { useProjectKernel } from "./ProjectKernel";
import { FloorCoordinationPanel } from "./FloorCoordinationPanel";
import { FrameWorkbench } from "./FrameWorkbench";

export function FloorPlateStudy({ input }: { input: StructuralConceptInput }) {
  const { project, patchModule } = useProjectKernel();
  const persistedInput = (project.modules["structural-concept"] as { input?: unknown } | undefined)?.input;
  const inputCurrent = traceJson(persistedInput ?? {}) === traceJson(input);
  const report = useMemo(() => calculateFloorPlateStudy(project, input), [project, input]);
  const contentKey = report.study ? traceJson(report.study) : "";
  const registryKey = traceJson((project.modules["structural-concept"] as { floorStudyRegistry?: unknown } | undefined)?.floorStudyRegistry ?? {});
  const [recorded, setRecorded] = useState<{ key: string; record: FloorStudyRecord } | null>(null);
  const [selectedLevel, setSelectedLevel] = useState(1);
  const [error, setError] = useState("");
  const latest = useRef({ projectId: project.id, revision: project.revision, contentKey, inputCurrent });
  useEffect(() => { latest.current = { projectId: project.id, revision: project.revision, contentKey, inputCurrent }; }, [project.id, project.revision, contentKey, inputCurrent]);
  useEffect(() => {
    if (!inputCurrent) return;
    if (!contentKey) {
      patchModule("structural-concept", { floorStudyId: null });
      return;
    }
    let cancelled = false;
    recordFloorStudy(JSON.parse(contentKey)).then(record => {
      if (cancelled || latest.current.contentKey !== contentKey) return;
      const existing = (JSON.parse(registryKey) as Record<string, unknown>)[record.id];
      if (existing && traceJson(existing) !== traceJson(record)) throw new Error("Kat çalışma kaydı bozulmuş.");
      setError(""); setRecorded({ key: contentKey, record });
      patchModule("structural-concept", { floorStudyId: record.id, floorStudyStatus: "current", floorStudyRegistry: { [record.id]: record } });
    }).catch(() => { if (!cancelled) { setRecorded(null); setError("Kat çalışması kaydedilemedi; kaynak kaydı gözden geçirilmeli."); patchModule("structural-concept", { floorStudyId: null }); } });
    return () => { cancelled = true; };
  }, [contentKey, registryKey, patchModule, inputCurrent]);

  const study = report.study;
  const floor = study?.floors.find(item => item.level === selectedLevel) ?? study?.floors[0];
  const ready = inputCurrent && recorded?.key === contentKey && !!contentKey;
  const formatNumber = (value: number) => value.toLocaleString("tr-TR", { maximumFractionDigits: 2 });
  const exportStudy = async (format: "JSON" | "CSV" | "PDF" | "DXF") => {
    if (!study || !floor || !ready || !recorded) return;
    try {
      setError("");
      const manifest = await floorStudyDocument(recorded.record, project, input, format, format === "PDF" || format === "DXF" ? floor.level : undefined);
      const traceability = { studyRecord: recorded.record, documentManifest: manifest };
      let bytes: string | Uint8Array, name: string, mime: string;
      if (format === "JSON") {
        name = "arkem-kat-bazli-on-calisma.json"; mime = "application/json";
        bytes = JSON.stringify(traceability, null, 2);
      } else if (format === "CSV") {
        name = "arkem-kat-yuk-tablosu.csv"; mime = "text/csv;charset=utf-8";
        const csv = (v: unknown) => `"${String(v).replaceAll('"', '""')}"`;
        bytes = "\uFEFF" + ["project,revision,study_id,document_reference,level,width_m,depth_m,gross_area_m2,G_kN,Q_kN,gravity_proxy_kN,gross_slab_concrete_m3,source_element_ids,full_building_analysis",
          ...study.floors.map(item => [study.projectId, study.revision, recorded.record.id, manifest.identity.reference, item.level, item.width, item.depth, item.area, item.loads.permanentTotal, item.loads.liveTotal, item.loads.gravityCombinationProxy, item.quantities.grossSlabConcreteVolume, JSON.stringify(item.sourceElementIds), false].map(csv).join(","))].join("\n");
      } else if (format === "DXF") {
        name = `arkem-kat-K${floor.level}-kavramsal.dxf`; mime = "application/dxf";
        bytes = createGridDxf(floor.width, floor.depth, floor.baysX, floor.baysY, { projectName: project.name, projectCode: project.id, revision: project.revision, drawingNo: `FLOOR-K${floor.level}`, drawingTitle: `K${floor.level} BRUT PLAKA / BAGIMSIZ KAT CALISMASI`, status: "KAVRAMSAL KAT CALISMASI / YAPI ANALIZI DEGIL", coordinateSystem: manifest.identityInput.coordinateSystem, checkedBy: "YETKILI DOGRULAMA BEKLENIYOR", traceability });
      } else {
        name = `arkem-kat-K${floor.level}-kavramsal.pdf`; mime = "application/pdf";
        const polylines: TechnicalSheetPolyline[] = [{ role: "primary", closed: true, points: [{ x: 0, y: 0 }, { x: floor.width, y: 0 }, { x: floor.width, y: floor.depth }, { x: 0, y: floor.depth }] }];
        for (let i = 0; i <= floor.baysX; i++) polylines.push({ role: "grid", points: [{ x: i * floor.spanX, y: 0 }, { x: i * floor.spanX, y: floor.depth }] });
        for (let i = 0; i <= floor.baysY; i++) polylines.push({ role: "grid", points: [{ x: 0, y: i * floor.spanY }, { x: floor.width, y: i * floor.spanY }] });
        bytes = await createCorporateTechnicalPdf({ ...manifest.identityInput, projectName: project.name, drawingTitle: `K${floor.level} Brüt Plaka ve Yük Çalışması`, drawingSubtitle: "Bağımsız kat ön çalışması · taşıyıcı sürekliliği doğrulanmadı", status: "Kavramsal kat çalışması / yapı analizi değil", reviewBanner: "KATLAR ARASI TASİYICI SUREKLİLİGİ VE 3B ANALİZ YOK", checkedBy: "Yetkili doğrulama bekleniyor", polylines,
          metrics: [["Plaka ölçüleri", `${floor.width} × ${floor.depth} m`], ["Brüt alan", `${formatNumber(floor.area)} m²`], ["G / Q", `${formatNumber(floor.loads.permanentTotal)} / ${formatNumber(floor.loads.liveTotal)} kN`], ["Brüt plaka betonu", `${formatNumber(floor.quantities.grossSlabConcreteVolume)} m³`]], notes: study.limitations, traceability });
      }
      const documentRecord = await sealFloorStudyDocument(manifest, name, bytes);
      const current = latest.current;
      if (!current.inputCurrent || current.projectId !== project.id || current.revision !== project.revision || current.contentKey !== contentKey) throw new Error("Kaynak dışa aktarılırken değişti.");
      patchModule("structural-concept", { floorDocumentRegistry: { [documentRecord.id]: documentRecord } });
      downloadTextFile(name, bytes, mime);
    } catch { setError("Kat çalışmasının kaynak zinciri doğrulanamadı; dosya oluşturulmadı."); }
  };

  if (!study || !floor) return <section data-testid="floor-plate-study-unavailable"><h2>Kat bazlı çalışma için eksik kaynak</h2><ul>{report.issues.map(issue => <li key={issue}>{issue}</li>)}</ul></section>;
  const plotScale = Math.min(330 / floor.width, 180 / floor.depth);
  return <section className="engineering-panel" data-testid="floor-plate-study">
    <header><div><span>KAT BAZLI ÖN ÇALIŞMA</span><h2>Her katın kendi plakası ve yükü</h2></div></header>
    <p>Toplam brüt alan: <b data-testid="floor-study-total-area">{formatNumber(study.totals.grossArea)} m²</b>. Plakalar ayrı hesaplanır; seçili kat tüm katlara kopyalanmaz.</p>
    {study.floors.some(item => item.areaConsistency?.roundingAccepted) && <p data-testid="floor-study-rounding-note">Kaynak ölçüler 0,001 m, alanlar 0,01 m² hassasiyetinde kaydedilmiş. Yuvarlama sınırındaki küçük farklar kabul edildi; alan, yük ve miktarlar kayıtlı boyutların çarpımından hesaplanıyor. {study.floors.filter(item => item.areaConsistency?.roundingAccepted).map(item => `K${item.level}: fark ${Math.abs(item.areaConsistency!.difference).toFixed(4)} m² / sınır ${item.areaConsistency!.tolerance.toFixed(4)} m²`).join(" · ")}</p>}
    <p>Bu bölüm kat alanı, yük ve brüt plaka miktarı içindir. Ortak koordinatlar ve açık eleman modeli aşağıdaki bölümlerde ayrıca değerlendirilir; bu alan tablosu tek başına yapı analizi değildir.</p>
    {error && <p role="alert">{error}</p>}
    <table><caption>Katlara göre alan ve yük tablosu</caption><thead><tr><th>Kat</th><th>Boyut (m)</th><th>Alan (m²)</th><th>G (kN)</th><th>Q (kN)</th><th>Brüt plaka betonu (m³)</th></tr></thead><tbody>{study.floors.map(item => <tr key={item.level} data-testid={`floor-study-row-${item.level}`}><th scope="row">K{item.level}</th><td>{item.width} × {item.depth}</td><td>{formatNumber(item.area)}</td><td>{formatNumber(item.loads.permanentTotal)}</td><td>{formatNumber(item.loads.liveTotal)}</td><td>{formatNumber(item.quantities.grossSlabConcreteVolume)}</td></tr>)}</tbody></table>
    <label>Çizim katı <select value={floor.level} onChange={event => setSelectedLevel(Number(event.target.value))}>{study.floors.map(item => <option key={item.level} value={item.level}>K{item.level}</option>)}</select></label>
    <svg viewBox="0 0 420 270" role="img" aria-label={`K${floor.level} bağımsız plaka şeması: ${floor.width} × ${floor.depth} metre`} style={{ maxWidth: 480, width: "100%" }}><rect x="30" y="30" width={floor.width * plotScale} height={floor.depth * plotScale} fill="none" stroke="currentColor" strokeWidth="2"/><text x="30" y="240" fill="currentColor">K{floor.level} · {floor.width} × {floor.depth} m · {formatNumber(floor.area)} m²</text></svg>
    <FloorCoordinationPanel/>
    <FrameWorkbench input={input}/>
    <ul>{study.limitations.map(note => <li key={note}>{note}</li>)}</ul>
    <p role="status">{ready ? "Kat çalışması güncel proje girdileri ve kaynaklarıyla kaydedildi." : "Proje girdileri veya kaynak değişti; güncel kayıt oluşmadan çıktı indirilemez."}</p>
    <div className="engineering-export-actions">{([
      ["JSON", "Kat bazlı ön çalışmayı indir"], ["CSV", "Kat yük tablosunu indir"],
      ["PDF", "Seçili kat paftasını indir"], ["DXF", "Seçili kat çizimini indir"],
    ] as const).map(([format, label]) => <button key={format} aria-label={`${label} (${format})`} disabled={!ready} onClick={() => exportStudy(format)}><span>{format}</span><b>{label}</b><i aria-hidden="true">↓</i></button>)}</div>
  </section>;
}
