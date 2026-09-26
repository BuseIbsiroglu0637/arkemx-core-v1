"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { downloadTextFile } from "../lib/engineering";
import { createBimCoordinationModel } from "../lib/bim-coordination";
import { createCoordinationPackage } from "../lib/coordination-package";
import { ProjectKernelBar, useProjectKernel } from "./ProjectKernel";

type View = "federation" | "clashes" | "section" | "foundation" | "delivery" | "issues";
type LocalIssue = { id: string; severity: "critical" | "review" | "info"; discipline: string; title: string; evidence: string; action: string; assignee?: string; location?: string; type?: string; sourceRefs?: string[] };
type UnknownRecord = Record<string, unknown>;

function clamp(value: number, min: number, max: number) { return Math.min(max, Math.max(min, Number.isFinite(value) ? value : min)); }
function record(value: unknown): UnknownRecord { return value && typeof value === "object" && !Array.isArray(value) ? value as UnknownRecord : {}; }
function numeric(value: unknown, fallback = 0) { return typeof value === "number" && Number.isFinite(value) ? value : fallback; }

export function EngineeringCoordinationStudio() {
  const transferApplied = useRef(false);
  const { patchModule, thread, project, hydrated } = useProjectKernel();
  const [view, setView] = useState<View>("federation");
  const [floorHeight, setFloorHeight] = useState(3.4);
  const [beamDepth, setBeamDepth] = useState(.6);
  const [slabDepth, setSlabDepth] = useState(.16);
  const [serviceZone, setServiceZone] = useState(.45);
  const [ceilingBuildUp, setCeilingBuildUp] = useState(.12);
  const [raisedFloor, setRaisedFloor] = useState(.08);
  const [shaftArea, setShaftArea] = useState(32);
  const [plantArea, setPlantArea] = useState(110);
  const [soilBearing, setSoilBearing] = useState(200);
  const [rainfallIntensity, setRainfallIntensity] = useState(80);
  const [outletCapacity, setOutletCapacity] = useState(4);
  const [sprinkler, setSprinkler] = useState(true);
  const [facadeTolerance, setFacadeTolerance] = useState(20);
  const [resolved, setResolved] = useState<string[]>([]);
  const [syncMessage, setSyncMessage] = useState("Koordinasyon kesiti varsayılan kabullerle açıldı");

  const source = thread.canonical;
  const architectureModule = record(project.modules["architectural-program"]);
  const structureModule = record(project.modules["structural-concept"]);
  const architecturalScheme = architectureModule.architecturalScheme;
  const structuralStudio = structureModule.structuralStudio;
  const bimCoordination = useMemo(() => createBimCoordinationModel({
    projectId: project.id,
    projectRevision: project.revision,
    coordinateReference: source.site.crs,
    architecturalScheme,
    structuralStudio,
    floorHeight,
    beamDepth,
    slabDepth,
    serviceZone,
    ceilingBuildUp,
    raisedFloor,
    shaftArea,
    plantArea,
    factoredGravity: source.structure.factoredGravity,
    soilBearing,
    rainfallIntensity,
    outletCapacity,
    sprinkler,
    facadeTolerance,
  }), [architecturalScheme, beamDepth, ceilingBuildUp, facadeTolerance, floorHeight, outletCapacity, plantArea, project.id, project.revision, rainfallIntensity, raisedFloor, serviceZone, shaftArea, slabDepth, soilBearing, source.site.crs, source.structure.factoredGravity, sprinkler, structuralStudio]);

  const result = useMemo(() => ({
    floorPlate: bimCoordination.spatial.plate.floorAreaM2,
    roofArea: bimCoordination.spatial.plate.floorAreaM2,
    clearHeight: bimCoordination.coordination.clearHeightM,
    shaftRatio: bimCoordination.coordination.shaftRatioPct,
    plantRatio: bimCoordination.coordination.plantRatioPct,
    foundationPressure: bimCoordination.coordination.bearingPressureKNM2,
    bearingUtilization: bimCoordination.coordination.bearingUtilizationPct,
    rainwaterFlow: bimCoordination.coordination.rainwaterFlowLs,
    outletCount: bimCoordination.coordination.outletCount,
    serviceRatio: bimCoordination.coordination.serviceRatioPct,
    coordinationVolume: bimCoordination.quantities.coordination.serviceZoneVolumeM3,
  }), [bimCoordination]);

  const localIssues = useMemo<LocalIssue[]>(() => bimCoordination.clashes.map((clash) => ({
    id: clash.guid,
    severity: clash.severity,
    discipline: clash.disciplines.join(" / "),
    title: clash.title,
    evidence: clash.evidence,
    action: clash.requiredAction,
    assignee: clash.assignee,
    location: clash.location,
    type: clash.type,
    sourceRefs: clash.sourceRefs,
  })), [bimCoordination.clashes]);

  const combinedIssues = useMemo(() => [
    ...thread.issues.map((issue) => ({ ...issue, source: "DIGITAL THREAD" })),
    ...localIssues.map((issue) => ({ ...issue, route: "/muhendislik-koordinasyon", source: "ICE RULESET" })),
  ], [localIssues, thread.issues]);
  const openIssues = combinedIssues.filter((issue) => !resolved.includes(issue.id));

  useEffect(() => {
    patchModule("engineering-coordination", { schema: "ARKEM-COORDINATION/3.0", previousSchema: "ARKEM-COORDINATION/2.0", input: { floorHeight, beamDepth, slabDepth, serviceZone, ceilingBuildUp, raisedFloor, shaftArea, plantArea, soilBearing, rainfallIntensity, outletCapacity, sprinkler, facadeTolerance }, result: { ...result, openIssues: localIssues.filter((issue) => !resolved.includes(issue.id)).length }, issues: localIssues, bimCoordination, resolved, status: "v115-bim-discipline-coordination" });
  }, [beamDepth, bimCoordination, ceilingBuildUp, facadeTolerance, floorHeight, localIssues, outletCapacity, patchModule, plantArea, rainfallIntensity, raisedFloor, resolved, result, serviceZone, shaftArea, slabDepth, soilBearing, sprinkler]);

  const importThread = useCallback(() => {
    const scheme = record(architecturalScheme);
    const plate = record(scheme.plate);
    const studio = record(structuralStudio);
    const recommendation = record(studio.recommendation);
    const alternatives = Array.isArray(studio.alternatives) ? studio.alternatives.map(record) : [];
    const selected = alternatives.find((alternative) => alternative.system === recommendation.system) ?? alternatives[0] ?? {};
    const preliminary = record(selected.preliminary);
    const dimensions = record(preliminary.numeric);
    const nextFloorHeight = numeric(plate.floorHeight, source.architecture.floorHeight);
    const nextBeamDepth = numeric(dimensions.beamDepth, source.structure.beamDepth);
    const nextSlabDepth = numeric(dimensions.slabThickness, source.structure.slabThickness);
    if (nextFloorHeight > 0) setFloorHeight(clamp(nextFloorHeight, 2.6, 10));
    if (nextBeamDepth > 0) setBeamDepth(clamp(nextBeamDepth, .2, 2));
    if (nextSlabDepth > 0) setSlabDepth(clamp(nextSlabDepth, .08, .6));
    setSyncMessage("V113 kat/kot şeması ve V114 taşıyıcı kesitleri ortak BIM modeline yenilendi");
  }, [architecturalScheme, source.architecture.floorHeight, source.structure.beamDepth, source.structure.slabThickness, structuralStudio]);
  useEffect(() => {
    if (!hydrated || transferApplied.current) return;
    transferApplied.current = true;
    const timer = window.setTimeout(() => {
    const saved = project.modules["engineering-coordination"] as { input?: Record<string, unknown>; resolved?: string[] } | undefined;
    const input = saved?.input;
    if (input) {
      if (typeof input.floorHeight === "number") setFloorHeight(input.floorHeight);
      if (typeof input.beamDepth === "number") setBeamDepth(input.beamDepth);
      if (typeof input.slabDepth === "number") setSlabDepth(input.slabDepth);
      if (typeof input.serviceZone === "number") setServiceZone(input.serviceZone);
      if (typeof input.ceilingBuildUp === "number") setCeilingBuildUp(input.ceilingBuildUp);
      if (typeof input.raisedFloor === "number") setRaisedFloor(input.raisedFloor);
      if (typeof input.shaftArea === "number") setShaftArea(input.shaftArea);
      if (typeof input.plantArea === "number") setPlantArea(input.plantArea);
      if (typeof input.soilBearing === "number") setSoilBearing(input.soilBearing);
      if (typeof input.rainfallIntensity === "number") setRainfallIntensity(input.rainfallIntensity);
      if (typeof input.outletCapacity === "number") setOutletCapacity(input.outletCapacity);
      if (typeof input.sprinkler === "boolean") setSprinkler(input.sprinkler);
      if (typeof input.facadeTolerance === "number") setFacadeTolerance(input.facadeTolerance);
      if (saved?.resolved) setResolved(saved.resolved);
      setSyncMessage("Kayıtlı koordinasyon modeli otomatik açıldı");
    } else {
      importThread();
    }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [hydrated, importThread, project.modules]);
  const exportBcf = () => downloadTextFile("arkem-koordinasyon-issues.bcf.json", JSON.stringify(createCoordinationPackage({
    projectId: project.id,
    coordinateReference: source.site.crs,
    serviceZone,
    shaftArea,
    floorPlate: result.floorPlate,
    bimCoordination,
    topics: combinedIssues.map((issue) => ({ ...issue, closed: resolved.includes(issue.id) })),
  }), null, 2), "application/json");
  const exportCsv = () => downloadTextFile("arkem-koordinasyon-kaydi.csv", ["id,severity,discipline,title,evidence,status", ...combinedIssues.map((issue) => `${issue.id},${issue.severity},"${issue.discipline}","${issue.title}","${issue.evidence}",${resolved.includes(issue.id) ? "closed" : "open"}`)].join("\n"), "text/csv;charset=utf-8");

  return <section className="coordination-app" data-testid="engineering-coordination-studio">
    <ProjectKernelBar module="BIM & DISCIPLINE COORDINATION" confidence="V113 + V114 · IFC/BCF hazırlık" />
    <header className="coordination-head"><div><p className="eyebrow light">V115 / BIM VE DİSİPLİN KOORDİNASYONU</p><h2>Modeli üst üste koymayın.<br/><em>Çakışmayı karara bağlayın.</em></h2></div><p>V113 mimari şemasını, V114 taşıyıcı ön boyutlarını ve MEP–yangın–zemin girdilerini ortak aks, kot ve revizyon üzerinde federasyon modeline bağlayın. Çakışmaları BCF uyumlu issue kaydına; metraj, karbon ve süre verisini 4B / 5B göstergelerine dönüştürün.</p><div><span>SON SENKRON</span><b>{syncMessage}</b><button onClick={importThread}>V113 + V114 modelini yenile ↻</button></div></header>
    <div className="v115-source-band" data-state={bimCoordination.source.architectureConnected && bimCoordination.source.structureConnected ? bimCoordination.source.geometryMatches ? "connected" : "conflict" : "missing"}><div><span>ORTAK MODEL KAYNAKLARI</span><b>V113 {bimCoordination.source.architectureConnected ? "bağlı" : "bekleniyor"} · V114 {bimCoordination.source.structureConnected ? "bağlı" : "bekleniyor"}</b><small>{bimCoordination.source.geometryMatches ? "Kat, plaka ve taşıyıcı aks geometrisi aynı revizyonda." : "Kaynak geometri ve revizyon eşleşmesi doğrulanmalı."}</small></div><div><span>KOORDİNAT / REVİZYON</span><b>{bimCoordination.coordinateSystem.reference}</b><small>{bimCoordination.federation.commonRevision} · {bimCoordination.spatial.levels.length} kot · {bimCoordination.spatial.axes.x.length + bimCoordination.spatial.axes.y.length} aks</small></div><div><span>TESLİM SINIRI</span><b>IFC4 hazırlık manifestosu</b><small>BCF uyumlu issue · native IFC / BCFZIP değildir</small></div></div>
    <div className="coordination-workspace">
      <aside className="coordination-controls"><strong>KOORDİNASYON GİRDİLERİ</strong><div className="coordination-input-grid"><label>Kat yüksekliği<input type="number" min="2.6" max="10" step=".05" value={floorHeight} onChange={(event) => setFloorHeight(clamp(Number(event.target.value), 2.6, 10))}/><i>m</i></label><label>Kiriş yüksekliği<input type="number" min=".2" max="2" step=".05" value={beamDepth} onChange={(event) => setBeamDepth(clamp(Number(event.target.value), .2, 2))}/><i>m</i></label><label>Döşeme<input type="number" min=".08" max=".6" step=".01" value={slabDepth} onChange={(event) => setSlabDepth(clamp(Number(event.target.value), .08, .6))}/><i>m</i></label><label>MEP servis zonu<input type="number" min=".15" max="2" step=".05" value={serviceZone} onChange={(event) => setServiceZone(clamp(Number(event.target.value), .15, 2))}/><i>m</i></label><label>Asma tavan<input type="number" min="0" max=".5" step=".01" value={ceilingBuildUp} onChange={(event) => setCeilingBuildUp(clamp(Number(event.target.value), 0, .5))}/><i>m</i></label><label>Yükseltilmiş döşeme<input type="number" min="0" max=".5" step=".01" value={raisedFloor} onChange={(event) => setRaisedFloor(clamp(Number(event.target.value), 0, .5))}/><i>m</i></label><label>Şaft rezervi<input type="number" min="1" max="1000" value={shaftArea} onChange={(event) => setShaftArea(clamp(Number(event.target.value), 1, 1000))}/><i>m²/kat</i></label><label>Teknik hacim<input type="number" min="1" max="5000" value={plantArea} onChange={(event) => setPlantArea(clamp(Number(event.target.value), 1, 5000))}/><i>m²</i></label><label>Zemin taşıma girdisi<input type="number" min="25" max="2000" step="25" value={soilBearing} onChange={(event) => setSoilBearing(clamp(Number(event.target.value), 25, 2000))}/><i>kN/m²</i></label><label>Yağış şiddeti<input type="number" min="10" max="500" step="5" value={rainfallIntensity} onChange={(event) => setRainfallIntensity(clamp(Number(event.target.value), 10, 500))}/><i>mm/h</i></label><label>Çıkış kapasitesi<input type="number" min=".5" max="30" step=".5" value={outletCapacity} onChange={(event) => setOutletCapacity(clamp(Number(event.target.value), .5, 30))}/><i>L/s</i></label><label>Cephe toleransı<input type="number" min="5" max="100" step="1" value={facadeTolerance} onChange={(event) => setFacadeTolerance(clamp(Number(event.target.value), 5, 100))}/><i>mm</i></label></div><button className={sprinkler ? "coordination-toggle active" : "coordination-toggle"} onClick={() => setSprinkler((value) => !value)}><i>{sprinkler ? "✓" : "+"}</i><span>Sprinkler senaryosu</span><b>{sprinkler ? "AKTİF" : "KAPALI"}</b></button><strong>TEKNİK ÇIKTI</strong><div className="coordination-export"><button onClick={exportBcf}>IFC4 + BCF<b>Hazırlık manifestosu</b></button><button onClick={exportCsv}>CSV<b>Koordinasyon kaydı</b></button><Link href="/proje-os">OS<b>Karar merkezine geç</b></Link></div></aside>
      <main className="coordination-main"><header><nav>{(["federation", "clashes", "section", "foundation", "delivery", "issues"] as View[]).map((item) => <button key={item} className={view === item ? "active" : ""} onClick={() => setView(item)}>{item === "federation" ? "Federasyon" : item === "clashes" ? `Çakışmalar (${bimCoordination.clashes.length})` : item === "section" ? "Kesit / MEP" : item === "foundation" ? "Zemin / drenaj" : item === "delivery" ? "4B / 5B" : `Issue kaydı (${openIssues.length})`}</button>)}</nav><span>ARKEM-BIM-COORDINATION/3.0 · {source.site.crs}</span></header>
        <div className="coordination-kpis"><article><span>BAĞLI KATMAN</span><b>{bimCoordination.federation.connectedCount}/6</b><small>{bimCoordination.federation.conceptualCount} kavramsal · {bimCoordination.federation.missingCount} eksik</small></article><article><span>KRİTİK ÇAKIŞMA</span><b className={bimCoordination.clashes.some((issue) => issue.severity === "critical") ? "risk" : "good"}>{bimCoordination.clashes.filter((issue) => issue.severity === "critical" && !resolved.includes(issue.guid)).length}</b><small>{openIssues.length} açık issue</small></article><article><span>4B SÜRE GÖSTERGESİ*</span><b>{bimCoordination.schedule4D.totalWeeks.toFixed(1)} hf</b><small>{bimCoordination.schedule4D.phases.length} koordinasyon fazı</small></article><article><span>5B GÖRELİ MALİYET*</span><b>{bimCoordination.cost5D.relativeStructuralCost.toFixed(0)}</b><small>{bimCoordination.cost5D.linkedQuantities ? "V114 miktarına bağlı" : "kaynak bekleniyor"}</small></article></div>
        {view === "federation" && <section className="federation-view"><div className="federation-stack"><header><span>FEDERE MODEL KATMANLARI</span><b>Ortak koordinat · ortak revizyon · ayrı sorumluluk</b></header>{bimCoordination.federation.layers.map((layer, index) => { const value = layer.code === "ARC" ? `${bimCoordination.quantities.architectural.grossFloorAreaM2.toFixed(0)} m²` : layer.code === "STR" ? String(bimCoordination.source.selectedStructuralSystem ?? "—") : layer.code === "MEP" ? `${serviceZone.toFixed(2)} m zon` : layer.code === "FIRE" ? sprinkler ? "sprinkler aktif" : "senaryo bekliyor" : layer.code === "GEO" ? bimCoordination.coordinateSystem.verified ? "referans bağlı" : "yerel koordinat" : `${openIssues.length} açık`; return <article className={layer.state !== "missing" ? "active" : ""} data-state={layer.state} key={layer.code}><span>{layer.code}</span><div><b>{layer.label}</b><small>{layer.state === "connected" ? "KAYNAĞA BAĞLI" : layer.state === "conceptual" ? "KAVRAMSAL KATMAN" : "KAYNAK BEKLİYOR"}</small></div><strong>{value}</strong><i style={{ "--layer": index } as React.CSSProperties}></i></article>; })}</div><aside className="federation-rules"><span>V115 / OTOMATİK KURAL SETİ VE KOORDİNASYON KAPILARI</span>{bimCoordination.checks.map((check) => <button type="button" className={check.state} key={check.code} onClick={() => setView(check.code === "BIM-115-05" ? "clashes" : "federation")}><i>{check.state === "pass" ? "✓" : check.state === "review" ? "!" : "×"}</i><div><b>{check.code} · {check.label}</b><small>{check.value}</small></div><span>→</span></button>)}</aside></section>}
        {view === "clashes" && <section className="v115-clash-board"><header><div><span>V115 / CLASH DETECTION REGISTER</span><b>Geometri, boşluk, veri ve süreç çakışmaları</b></div><strong>{bimCoordination.clashes.filter((clash) => clash.severity === "critical" && !resolved.includes(clash.guid)).length} kritik · {bimCoordination.clashes.filter((clash) => !resolved.includes(clash.guid)).length} açık</strong></header><div>{bimCoordination.clashes.map((clash) => { const closed = resolved.includes(clash.guid); return <article key={clash.guid} className={`${clash.severity}${closed ? " closed" : ""}`}><header><i>{clash.severity === "critical" ? "×" : clash.severity === "review" ? "!" : "i"}</i><div><span>{clash.guid} · {clash.type.toUpperCase()}</span><b>{clash.title}</b></div><em>{closed ? "KAPALI" : clash.severity === "critical" ? "KRİTİK" : "İNCELE"}</em></header><dl><div><dt>Konum</dt><dd>{clash.location}</dd></div><div><dt>Disiplinler</dt><dd>{clash.disciplines.join(" · ")}</dd></div><div><dt>Sorumlu</dt><dd>{clash.assignee}</dd></div><div><dt>Kaynak</dt><dd>{clash.sourceRefs.join(" · ")}</dd></div></dl><p>{clash.evidence}</p><small>AKSİYON · {clash.requiredAction}</small><button onClick={() => setResolved((current) => current.includes(clash.guid) ? current.filter((id) => id !== clash.guid) : [...current, clash.guid])}>{closed ? "Issue’yu yeniden aç" : "İncelendi / kapat"}</button></article>; })}</div>{!bimCoordination.clashes.length && <p className="coordination-empty large">Açık çakışma üretilmedi. Native IFC elemanları bağlandığında geometrik kontrol kapsamı genişletilir.</p>}</section>}
        {view === "section" && <section className="section-coordination"><div className="technical-section"><header><span>TİP KAT KOORDİNASYON KESİTİ</span><b>±0.000 → +{floorHeight.toFixed(3)}</b></header><div className="section-drawing"><div className="section-slab top" style={{ height: `${Math.max(8, slabDepth * 55)}px` }}><span>DÖŞEME {slabDepth.toFixed(2)} m</span></div><div className="section-beam" style={{ height: `${beamDepth * 115}px` }}><span>KİRİŞ {beamDepth.toFixed(2)} m</span></div><div className="section-services" style={{ top: `${beamDepth * 115 + 15}px`, height: `${serviceZone * 115}px` }}><i></i><i></i><i></i><span>MEP SERVİS ZONU · {serviceZone.toFixed(2)} m</span></div><div className="section-ceiling" style={{ top: `${(beamDepth + serviceZone) * 115 + 20}px` }}><span>ASMA TAVAN</span></div><div className="clear-height-arrow"><i></i><b>{result.clearHeight.toFixed(2)} m<small>NET YÜKSEKLİK</small></b><i></i></div><div className="section-slab bottom"><span>YÜKSELTİLMİŞ DÖŞEME {raisedFloor.toFixed(2)} m</span></div></div></div><aside><span>KESİT BÜTÇESİ</span>{[["Kat yüksekliği", floorHeight],["Kiriş", -beamDepth],["MEP zonu", -serviceZone],["Tavan paketi", -ceilingBuildUp],["Döşeme paketi", -raisedFloor],["Net kullanım", result.clearHeight]].map(([label, value], index) => <p key={String(label)} className={index === 5 ? "total" : ""}><span>{label}</span><b>{Number(value) > 0 && index > 0 ? "+" : ""}{Number(value).toFixed(2)} m</b></p>)}<small>Kesit; çakışma riskini görünür kılan kavramsal zon modelidir. Gerçek kanal/boru kesitleri, eğimler, askılar, yalıtım ve bakım boşlukları tanımlanmamıştır.</small></aside></section>}
        {view === "foundation" && <section className="foundation-coordination"><div className="foundation-load-path"><header><span>YÜK YOLU / ZEMİN ÖN EKRANI</span><b>{source.structure.system || "Taşıyıcı sistem bekleniyor"}</b></header><div className="load-path-diagram"><div className="load-roof">G + Q + S <i>↓</i></div><div className="load-frame"><span></span><span></span><span></span><b>{source.structure.factoredGravity.toLocaleString("tr-TR", { maximumFractionDigits: 0 })} kN<small>toplam ULS gösterge</small></b></div><div className="load-foundation"><i></i><i></i><i></i><span>q* = {result.foundationPressure.toFixed(1)} kN/m²</span></div><div className="load-soil" style={{ "--utilization": `${Math.min(100, result.bearingUtilization)}%` } as React.CSSProperties}><span>ZEMİN GİRDİSİ · {soilBearing} kN/m²</span></div></div><p>Yüklerin düşey eleman, temel ve zemine aktarımı burada eşit yayılı kabul edilir; temel rijitliği, eksantrisite, deprem birleşimleri, yeraltı suyu, taşıma gücü ve oturma analizi dahil değildir.</p></div><aside className="drainage-panel"><span>ÇATI SUYU ÖN GÖSTERGESİ</span><div className="rain-gauge"><i style={{ height: `${Math.min(100, rainfallIntensity / 2)}%` }}></i><b>{rainfallIntensity}<small>mm/h girdi</small></b></div><p><span>Çatı alanı</span><b>{result.roofArea.toFixed(0)} m²</b></p><p><span>Debi göstergesi</span><b>{result.rainwaterFlow.toFixed(1)} L/s</b></p><p><span>Asgari çıkış göstergesi</span><b>{result.outletCount} adet</b></p><p><span>Tek çıkış varsayımı</span><b>{outletCapacity.toFixed(1)} L/s</b></p><small>Yerel yağış tekerrürü, çatı eğimi, tıkanma, acil taşma ve üretici kapasitesi doğrulanmadan drenaj projesi değildir.</small></aside></section>}
        {view === "delivery" && <section className="v115-delivery-board"><header><div><span>V115 / 4B + 5B + KARBON</span><b>Model öğesi → miktar → süre → göreli maliyet</b></div><strong>{bimCoordination.schedule4D.totalWeeks.toFixed(1)} hafta*</strong></header><div className="v115-delivery-layout"><div className="v115-4d"><span>4B KOORDİNASYON DİZİSİ</span>{bimCoordination.schedule4D.phases.map((phase) => <article key={phase.id}><div><b>{phase.id}</b><span>{phase.name}</span></div><i style={{ "--phase-start": `${phase.startWeek / bimCoordination.schedule4D.totalWeeks * 100}%`, "--phase-width": `${phase.durationWeeks / bimCoordination.schedule4D.totalWeeks * 100}%` } as React.CSSProperties}></i><strong>{phase.startWeek.toFixed(1)}–{phase.endWeek.toFixed(1)} hf</strong></article>)}<small>* Parametrik koordinasyon süresi; onaylı iş programı değildir.</small></div><aside className="v115-5d"><span>5B / MİKTAR BAĞLANTISI</span><div className="v115-quantity-grid"><p><small>Beton</small><b>{bimCoordination.quantities.structural.concreteVolumeM3.toFixed(1)} m³</b></p><p><small>Donatı</small><b>{bimCoordination.quantities.structural.reinforcementT.toFixed(1)} t</b></p><p><small>Yapı çeliği</small><b>{bimCoordination.quantities.structural.structuralSteelT.toFixed(1)} t</b></p><p><small>MEP zon hacmi</small><b>{bimCoordination.quantities.coordination.serviceZoneVolumeM3.toFixed(0)} m³</b></p></div><div className="v115-carbon"><div><span>KARBON GÖSTERGESİ*</span><b>{(bimCoordination.carbon.structuralKgCO2e / 1000).toFixed(0)} tCO₂e</b><small>{bimCoordination.carbon.intensityKgCO2eM2.toFixed(1)} kgCO₂e/m² · sertifikalı LCA değildir</small></div><i style={{ "--carbon": `${Math.min(100, bimCoordination.carbon.intensityKgCO2eM2 / 5)}%` } as React.CSSProperties}></i></div><div className="v115-cost-list">{bimCoordination.cost5D.packageIndices.map((item) => <p key={item.package}><span>{item.package}</span><b>{item.relativeIndex.toFixed(0)}</b></p>)}</div><footer><b>IFC / BCF sınırı</b><p>{bimCoordination.interoperability.profile}; native model, GUID ve viewpoint kapsamı %0’dır.</p></footer></aside></div></section>}
        {view === "issues" && <section className="issue-register"><header><div><span>OPENBIM / BCF UYUMLU ISSUE REGISTER</span><b>Kaynak, kanıt, sorumlu disiplin ve kapanış</b></div><div><button onClick={exportBcf}>IFC4 / BCF manifestosu ↓</button><button onClick={exportCsv}>CSV ↓</button></div></header><div className="issue-table"><div className="head"><span>ID / ÖNCELİK</span><span>KONU / KANIT</span><span>DİSİPLİN</span><span>KAYNAK</span><span>DURUM</span></div>{combinedIssues.map((issue) => { const closed = resolved.includes(issue.id); return <article className={`${issue.severity}${closed ? " closed" : ""}`} key={`${issue.source}-${issue.id}`}><div><i>{issue.severity === "critical" ? "×" : issue.severity === "review" ? "!" : "i"}</i><span><b>{issue.id}</b><small>{issue.severity.toUpperCase()}</small></span></div><div><b>{issue.title}</b><p>{issue.evidence}</p><small>AKSİYON · {issue.action}</small></div><span>{issue.discipline}</span><span>{issue.source}</span><button onClick={() => setResolved((current) => current.includes(issue.id) ? current.filter((id) => id !== issue.id) : [...current, issue.id])}>{closed ? "Yeniden aç" : "İncelendi / kapat"}</button></article>; })}</div>{!combinedIssues.length && <div className="coordination-empty large">Henüz issue yok. Parsel, mimari program, plan ve taşıyıcı model verilerini ürettikçe federasyon kuralları otomatik çalışır.</div>}</section>}
      </main>
    </div>
    <footer className="coordination-disclaimer"><b>Koordinasyon ve teslim sınırı</b><p>Bu motor erken disiplin koordinasyonu, BIM hazırlık manifestosu ve issue üretimi içindir. Native IFC modeli veya BCFZIP üretmez; statik/geoteknik hesap, yangın güvenliği, mekanik–elektrik tesisat tasarımı, metraj, LCA, iş programı, maliyet kontrolü ya da uygulama detayı yerine geçmez. Girdiler yetkili uzmanlarca doğrulanmalı ve gerçek BIM elemanlarıyla koordine edilmelidir.</p></footer>
  </section>;
}
