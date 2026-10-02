"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { createArchitecturalScheme, type ArchitecturalCoreStrategy } from "../lib/architectural-scheme";
import { downloadTextFile } from "../lib/engineering";
import { ProjectKernelBar, useProjectKernel } from "./ProjectKernel";

type ProgramUse = "industrial" | "office" | "residential" | "education";
type ProgramView = "schedule" | "zoning" | "scheme" | "matrix" | "envelope" | "checks";
type Space = { id: string; code: string; name: string; zone: string; count: number; unitArea: number; density: number; daylight: boolean; accessible: boolean };
type Relationship = { id: string; from: string; to: string; priority: "Zorunlu" | "Tercih"; confirmed: boolean };
type SiteContext = { massingModel?: unknown; selectedMassingId?: string; parcelReference?: string; [key: string]: unknown };

const templates: Record<ProgramUse, { label: string; netRatio: number; liveLoad: number; spaces: Space[]; relationships: Relationship[] }> = {
  industrial: {
    label: "Sanayi / üretim", netRatio: 82, liveLoad: 5,
    spaces: [
      { id: "IND-01", code: "A-101", name: "Üretim holü", zone: "Üretim", count: 1, unitArea: 1450, density: 20, daylight: true, accessible: true },
      { id: "IND-02", code: "A-102", name: "Hammadde deposu", zone: "Lojistik", count: 1, unitArea: 420, density: 40, daylight: false, accessible: true },
      { id: "IND-03", code: "A-103", name: "Sevkiyat alanı", zone: "Lojistik", count: 1, unitArea: 320, density: 30, daylight: true, accessible: true },
      { id: "IND-04", code: "A-201", name: "Ofis", zone: "Yönetim", count: 1, unitArea: 210, density: 10, daylight: true, accessible: true },
      { id: "IND-05", code: "A-202", name: "Toplantı", zone: "Yönetim", count: 2, unitArea: 32, density: 2, daylight: true, accessible: true },
      { id: "IND-06", code: "A-301", name: "Personel / soyunma", zone: "Sosyal", count: 2, unitArea: 72, density: 3, daylight: false, accessible: true },
      { id: "IND-07", code: "A-401", name: "Teknik hacim", zone: "Teknik", count: 2, unitArea: 55, density: 30, daylight: false, accessible: false },
    ],
    relationships: [
      { id: "R-01", from: "Hammadde deposu", to: "Üretim holü", priority: "Zorunlu", confirmed: true },
      { id: "R-02", from: "Üretim holü", to: "Sevkiyat alanı", priority: "Zorunlu", confirmed: true },
      { id: "R-03", from: "Ofis", to: "Üretim holü", priority: "Tercih", confirmed: false },
      { id: "R-04", from: "Personel / soyunma", to: "Üretim holü", priority: "Tercih", confirmed: true },
    ],
  },
  office: {
    label: "Ofis / ticari", netRatio: 76, liveLoad: 3.5,
    spaces: [
      { id: "OFF-01", code: "A-101", name: "Açık ofis", zone: "Çalışma", count: 2, unitArea: 420, density: 9, daylight: true, accessible: true },
      { id: "OFF-02", code: "A-102", name: "Odak odası", zone: "Çalışma", count: 8, unitArea: 11, density: 5, daylight: false, accessible: true },
      { id: "OFF-03", code: "A-201", name: "Toplantı", zone: "Ortak", count: 5, unitArea: 30, density: 2, daylight: true, accessible: true },
      { id: "OFF-04", code: "A-202", name: "Lobi / karşılama", zone: "Ortak", count: 1, unitArea: 115, density: 3, daylight: true, accessible: true },
      { id: "OFF-05", code: "A-301", name: "Sosyal alan", zone: "Ortak", count: 1, unitArea: 180, density: 2.5, daylight: true, accessible: true },
      { id: "OFF-06", code: "A-401", name: "Teknik / arşiv", zone: "Teknik", count: 2, unitArea: 58, density: 20, daylight: false, accessible: false },
    ],
    relationships: [
      { id: "R-01", from: "Lobi / karşılama", to: "Toplantı", priority: "Zorunlu", confirmed: true },
      { id: "R-02", from: "Açık ofis", to: "Odak odası", priority: "Tercih", confirmed: true },
      { id: "R-03", from: "Açık ofis", to: "Sosyal alan", priority: "Tercih", confirmed: false },
    ],
  },
  residential: {
    label: "Konut / karma yaşam", netRatio: 72, liveLoad: 2,
    spaces: [
      { id: "RES-01", code: "A-101", name: "Yaşam alanı", zone: "Gündüz", count: 8, unitArea: 38, density: 5, daylight: true, accessible: true },
      { id: "RES-02", code: "A-102", name: "Mutfak", zone: "Gündüz", count: 8, unitArea: 14, density: 6, daylight: true, accessible: true },
      { id: "RES-03", code: "A-201", name: "Yatak odası", zone: "Gece", count: 16, unitArea: 15, density: 12, daylight: true, accessible: true },
      { id: "RES-04", code: "A-202", name: "Banyo", zone: "Servis", count: 16, unitArea: 5, density: 10, daylight: false, accessible: false },
      { id: "RES-05", code: "A-301", name: "Ortak giriş", zone: "Ortak", count: 1, unitArea: 75, density: 3, daylight: true, accessible: true },
      { id: "RES-06", code: "A-401", name: "Teknik hacim", zone: "Teknik", count: 2, unitArea: 32, density: 30, daylight: false, accessible: false },
    ],
    relationships: [
      { id: "R-01", from: "Yaşam alanı", to: "Mutfak", priority: "Zorunlu", confirmed: true },
      { id: "R-02", from: "Yatak odası", to: "Banyo", priority: "Tercih", confirmed: true },
      { id: "R-03", from: "Ortak giriş", to: "Yaşam alanı", priority: "Tercih", confirmed: false },
    ],
  },
  education: {
    label: "Eğitim / sosyal", netRatio: 70, liveLoad: 5,
    spaces: [
      { id: "EDU-01", code: "A-101", name: "Derslik", zone: "Eğitim", count: 12, unitArea: 58, density: 2, daylight: true, accessible: true },
      { id: "EDU-02", code: "A-102", name: "Laboratuvar", zone: "Eğitim", count: 3, unitArea: 82, density: 3, daylight: true, accessible: true },
      { id: "EDU-03", code: "A-201", name: "Çok amaçlı salon", zone: "Ortak", count: 1, unitArea: 310, density: 1.2, daylight: false, accessible: true },
      { id: "EDU-04", code: "A-202", name: "Kütüphane", zone: "Ortak", count: 1, unitArea: 180, density: 4, daylight: true, accessible: true },
      { id: "EDU-05", code: "A-301", name: "Yönetim", zone: "Yönetim", count: 1, unitArea: 130, density: 10, daylight: true, accessible: true },
      { id: "EDU-06", code: "A-401", name: "Teknik / servis", zone: "Teknik", count: 2, unitArea: 45, density: 20, daylight: false, accessible: false },
    ],
    relationships: [
      { id: "R-01", from: "Derslik", to: "Laboratuvar", priority: "Tercih", confirmed: true },
      { id: "R-02", from: "Çok amaçlı salon", to: "Ortak giriş", priority: "Zorunlu", confirmed: false },
      { id: "R-03", from: "Kütüphane", to: "Derslik", priority: "Tercih", confirmed: true },
    ],
  },
};

function clamp(value: number, min: number, max: number) { return Math.min(max, Math.max(min, Number.isFinite(value) ? value : min)); }
function objectValue(value: unknown) { return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {}; }

export function ArchitecturalProgramStudio({ simple = false, issueFocus = false }: { simple?: boolean; issueFocus?: "kaks" | "plan-sync" | false } = {}) {
  const { patchModule, thread, project, hydrated } = useProjectKernel();
  const transferApplied = useRef(false);
  const [transferReady, setTransferReady] = useState(false);
  const [view, setView] = useState<ProgramView>("schedule");
  const [use, setUse] = useState<ProgramUse>("industrial");
  const [spaces, setSpaces] = useState<Space[]>(templates.industrial.spaces);
  const [relationships, setRelationships] = useState<Relationship[]>(templates.industrial.relationships);
  const [targetGross, setTargetGross] = useState(3600);
  const [netRatio, setNetRatio] = useState(78);
  const [floors, setFloors] = useState(2);
  const [floorHeight, setFloorHeight] = useState(4.5);
  const [aspect, setAspect] = useState(1.55);
  const [corridorWidth, setCorridorWidth] = useState(1.8);
  const [targetTravel, setTargetTravel] = useState(30);
  const [stairs, setStairs] = useState(2);
  const [elevators, setElevators] = useState(1);
  const [wwr, setWwr] = useState({ north: 28, east: 35, south: 42, west: 30 });
  const [southShading, setSouthShading] = useState(55);
  const [selectedStrategy, setSelectedStrategy] = useState<"compact" | "balanced" | "daylight">("balanced");
  const [coreStrategy, setCoreStrategy] = useState<ArchitecturalCoreStrategy>("central");
  const [siteContext, setSiteContext] = useState<SiteContext>({});
  const [status, setStatus] = useState("Mimari program çalışma alanı hazır");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [grossDraft, setGrossDraft] = useState<string | null>(null);

  useEffect(() => {
    if (!hydrated || transferApplied.current) return;
    const timer = window.setTimeout(() => {
    if (transferApplied.current) return;
    transferApplied.current = true;
    const saved = project.modules["architectural-program"] as { input?: Record<string, unknown>; spaces?: Space[]; relationships?: Relationship[] } | undefined;
    const input = saved?.input;
    if (input) {
      if (typeof input.use === "string" && input.use in templates) setUse(input.use as ProgramUse);
      if (typeof input.targetGross === "number") setTargetGross(input.targetGross);
      if (typeof input.netRatio === "number") setNetRatio(input.netRatio);
      if (typeof input.floors === "number") setFloors(input.floors);
      if (typeof input.floorHeight === "number") setFloorHeight(input.floorHeight);
      if (typeof input.aspect === "number") setAspect(input.aspect);
      if (typeof input.corridorWidth === "number") setCorridorWidth(input.corridorWidth);
      if (typeof input.targetTravel === "number") setTargetTravel(input.targetTravel);
      if (typeof input.stairs === "number") setStairs(input.stairs);
      if (typeof input.elevators === "number") setElevators(input.elevators);
      if (input.coreStrategy === "central" || input.coreStrategy === "split" || input.coreStrategy === "perimeter") setCoreStrategy(input.coreStrategy);
      if (input.siteContext && typeof input.siteContext === "object") setSiteContext(input.siteContext as SiteContext);
      if (saved.spaces?.length) setSpaces(saved.spaces);
      if (saved.relationships?.length) setRelationships(saved.relationships);
      setStatus("Kayıtlı mimari çalışma otomatik açıldı");
      setTransferReady(true);
      return;
    }
    const source = thread.canonical;
    if (source.site.proposedGross > 0) setTargetGross(Math.round(source.site.proposedGross));
    if (source.architecture.floors > 0) setFloors(clamp(source.architecture.floors, 1, 30));
    if (source.architecture.floorHeight > 0) setFloorHeight(clamp(source.architecture.floorHeight, 2.6, 10));
    const sourceUse = source.architecture.use.toLocaleLowerCase("tr-TR");
    if (sourceUse.includes("konut")) setUse("residential");
    else if (sourceUse.includes("ofis") || sourceUse.includes("ticari")) setUse("office");
    else if (sourceUse.includes("eğitim") || sourceUse.includes("sosyal")) setUse("education");
    else if (sourceUse) setUse("industrial");
    const geo = objectValue(project.modules["geo-parcel"]);
    if (geo.massingModel) setSiteContext({ massingModel: geo.massingModel, selectedMassingId: typeof geo.selectedMassingId === "string" ? geo.selectedMassingId : undefined, parcelReference: typeof geo.reference === "string" ? geo.reference : undefined });
    setStatus(source.site.parcelArea > 0 ? "Parsel, alan, kullanım ve kat verileri otomatik aktarıldı" : "Yeni mimari program oluşturuldu");
    setTransferReady(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [hydrated, project.modules, thread.canonical]);

  const result = useMemo(() => {
    const netArea = spaces.reduce((sum, space) => sum + space.count * space.unitArea, 0);
    const grossDemand = netArea / Math.max(.4, netRatio / 100);
    const efficiency = netArea / Math.max(targetGross, 1) * 100;
    const programDelta = targetGross - grossDemand;
    const occupants = Math.ceil(spaces.reduce((sum, space) => sum + space.count * space.unitArea / Math.max(space.density, .5), 0));
    const daylightArea = spaces.filter((space) => space.daylight).reduce((sum, space) => sum + space.count * space.unitArea, 0);
    const accessibleArea = spaces.filter((space) => space.accessible).reduce((sum, space) => sum + space.count * space.unitArea, 0);
    const daylightCoverage = daylightArea / Math.max(netArea, 1) * 100;
    const accessibleCoverage = accessibleArea / Math.max(netArea, 1) * 100;
    const plateArea = targetGross / Math.max(floors, 1);
    const plateDepth = Math.sqrt(plateArea / Math.max(aspect, .5));
    const plateWidth = plateDepth * aspect;
    const facadeHeight = floors * floorHeight;
    const northSouthArea = plateWidth * facadeHeight;
    const eastWestArea = plateDepth * facadeHeight;
    const facadeArea = 2 * northSouthArea + 2 * eastWestArea;
    const glazingArea = northSouthArea * (wwr.north + wwr.south) / 100 + eastWestArea * (wwr.east + wwr.west) / 100;
    const solarIndex = (northSouthArea * wwr.north / 100 * .35 + northSouthArea * wwr.south / 100 * (1 - southShading / 100) + eastWestArea * wwr.east / 100 * .78 + eastWestArea * wwr.west / 100 * .92) / Math.max(glazingArea, 1) * 100;
    const compactness = facadeArea / Math.max(targetGross, 1);
    const travelDistance = Math.sqrt(plateArea) * 1.18 + corridorWidth * 2.2;
    const coreArea = stairs * 18 + elevators * 7 + 10;
    const coreRatio = coreArea * floors / Math.max(targetGross, 1) * 100;
    const exitCapacityProxy = stairs * 120;
    const adjacencyScore = relationships.filter((item) => item.confirmed).length / Math.max(relationships.length, 1) * 100;
    return { netArea, grossDemand, efficiency, programDelta, occupants, daylightCoverage, accessibleCoverage, plateArea, plateWidth, plateDepth, facadeArea, glazingArea, solarIndex, compactness, travelDistance, coreArea, coreRatio, exitCapacityProxy, adjacencyScore, liveLoad: templates[use].liveLoad };
  }, [aspect, corridorWidth, elevators, floorHeight, floors, netRatio, relationships, southShading, spaces, stairs, targetGross, use, wwr]);

  const architecturalScheme = useMemo(() => createArchitecturalScheme({
    reference: project.id,
    use,
    targetGross,
    netRatio,
    floors,
    floorHeight,
    aspect,
    corridorWidth,
    targetTravel,
    stairs,
    elevators,
    coreStrategy,
    spaces,
    relationships,
    massingModel: siteContext.massingModel,
    selectedMassingId: siteContext.selectedMassingId,
  }), [aspect, coreStrategy, corridorWidth, elevators, floorHeight, floors, netRatio, project.id, relationships, siteContext.massingModel, siteContext.selectedMassingId, spaces, stairs, targetGross, targetTravel, use]);
  const checks = architecturalScheme.checks;

  useEffect(() => {
    // Hydrate the stored brief before publishing editable defaults into the shared project.
    if (!hydrated || !transferReady) return;
    patchModule("architectural-program", { schema: "ARKEM-ARCH-PROGRAM/3.0", previousSchema: "ARKEM-ARCH-PROGRAM/2.0", input: { use, targetGross, netRatio, floors, floorHeight, aspect, corridorWidth, targetTravel, stairs, elevators, wwr, southShading, coreStrategy, siteContext }, spaces, relationships, selectedStrategy, result, architecturalScheme, checks, status: "architectural-scheme-draft" });
  }, [architecturalScheme, aspect, checks, coreStrategy, corridorWidth, elevators, floorHeight, floors, hydrated, netRatio, patchModule, relationships, result, selectedStrategy, siteContext, southShading, spaces, stairs, targetGross, targetTravel, transferReady, use, wwr]);

  const loadTemplate = () => {
    setSpaces(templates[use].spaces.map((space) => ({ ...space })));
    setRelationships(templates[use].relationships.map((relationship) => ({ ...relationship })));
    setNetRatio(templates[use].netRatio);
    setStatus(`${templates[use].label} program şablonu yüklendi`);
  };
  const importThread = () => {
    const source = thread.canonical;
    if (source.site.proposedGross > 0) setTargetGross(Math.round(source.site.proposedGross));
    if (source.architecture.floors > 0) setFloors(clamp(source.architecture.floors, 1, 30));
    if (source.architecture.floorHeight > 0) setFloorHeight(clamp(source.architecture.floorHeight, 2.6, 10));
    const sourceUse = source.architecture.use.toLocaleLowerCase("tr-TR");
    if (sourceUse.includes("konut")) setUse("residential"); else if (sourceUse.includes("ofis") || sourceUse.includes("ticari")) setUse("office"); else if (sourceUse.includes("eğitim") || sourceUse.includes("sosyal")) setUse("education"); else if (sourceUse) setUse("industrial");
    const geo = objectValue(project.modules["geo-parcel"]);
    const architecture = objectValue(project.modules["architectural-program"]);
    const input = objectValue(architecture.input);
    const upstreamContext = objectValue(input.siteContext);
    setSiteContext({ ...upstreamContext, massingModel: geo.massingModel ?? upstreamContext.massingModel, selectedMassingId: typeof geo.selectedMassingId === "string" ? geo.selectedMassingId : typeof upstreamContext.selectedMassingId === "string" ? upstreamContext.selectedMassingId : undefined, parcelReference: typeof geo.reference === "string" ? geo.reference : typeof upstreamContext.parcelReference === "string" ? upstreamContext.parcelReference : undefined });
    setStatus(geo.massingModel ? "V112 yapı zarfı, seçili kütle, kat ve kullanım verisi aktarıldı" : "Parsel ve proje zincirindeki alan, kat, kullanım verisi aktarıldı");
  };
  const updateSpace = (id: string, patch: Partial<Space>) => setSpaces((current) => current.map((space) => space.id === id ? { ...space, ...patch } : space));
  const addSpace = () => setSpaces((current) => [...current, { id: `USR-${Date.now().toString(36)}`, code: `A-${String(current.length + 1).padStart(3, "0")}`, name: "Yeni mahal", zone: "Tanımsız", count: 1, unitArea: 25, density: 10, daylight: true, accessible: true }]);
  const exportJson = () => downloadTextFile("arkem-mimari-sema.json", JSON.stringify({ schema: "ARKEM-ARCH-PROGRAM/3.0", previousSchema: "ARKEM-ARCH-PROGRAM/2.0", units: "SI", selectedStrategy, input: { use, targetGross, netRatio, floors, floorHeight, aspect, corridorWidth, targetTravel, stairs, elevators, wwr, southShading, coreStrategy, siteContext }, spaces, relationships, result, architecturalScheme, checks }, null, 2), "application/json");
  const exportCsv = () => downloadTextFile("arkem-mahal-listesi.csv", ["code,name,zone,count,unit_area_m2,total_area_m2,occupancy_density_m2_person,daylight,accessible", ...spaces.map((space) => `${space.code},${space.name},${space.zone},${space.count},${space.unitArea.toFixed(2)},${(space.count * space.unitArea).toFixed(2)},${space.density.toFixed(2)},${space.daylight},${space.accessible}`)].join("\n"), "text/csv;charset=utf-8");

  const zones = Array.from(new Set(spaces.map((space) => space.zone)));
  const strategyOptions = [
    { id: "compact" as const, label: "Kompakt çekirdek", note: "Düşük cephe alanı, kontrollü dolaşım", aspect: 1.2, netRatio: 80, wwr: { north: 24, east: 30, south: 34, west: 28 } },
    { id: "balanced" as const, label: "Dengeli plaka", note: "Program, günışığı ve esneklik dengesi", aspect: 1.55, netRatio: 76, wwr: { north: 28, east: 35, south: 42, west: 30 } },
    { id: "daylight" as const, label: "Günışığı odaklı", note: "İnce plaka, yüksek cephe erişimi", aspect: 2.15, netRatio: 70, wwr: { north: 38, east: 42, south: 48, west: 36 } },
  ];
  const applyStrategy = (strategy: (typeof strategyOptions)[number]) => {
    setSelectedStrategy(strategy.id);
    setAspect(strategy.aspect);
    setNetRatio(strategy.netRatio);
    setWwr(strategy.wwr);
    setStatus(`${strategy.label} senaryosu programa uygulandı`);
  };
  const allowedGross = thread.canonical.site.allowedGross;
  const programGross = result.grossDemand;
  const programTargetDelta = programGross - targetGross;
  const programTargetDeltaRatio = Math.abs(programTargetDelta) / Math.max(targetGross, 1);
  const programTargetPass = programTargetDeltaRatio <= .1;
  const targetNetArea = targetGross * (netRatio / 100);
  const targetProgramScale = result.netArea > 0 ? targetNetArea / result.netArea : 1;
  const grossOverage = allowedGross > 0 ? Math.max(0, programGross - allowedGross) : 0;
  const grossPass = allowedGross > 0 && programGross <= allowedGross + .01;
  const grossTarget = allowedGross > 0 ? allowedGross * .995 : 0;
  const grossScale = grossTarget > 0 && programGross > 0 ? Math.min(1, grossTarget / programGross) : 1;
  const allowedNetAtCurrentRatio = allowedGross > 0 ? allowedGross * (netRatio / 100) : 0;
  const programTemplateUse = (() => {
    const prefix = spaces[0]?.id?.split("-")[0];
    return prefix === "IND" ? "industrial" : prefix === "OFF" ? "office" : prefix === "RES" ? "residential" : prefix === "EDU" ? "education" : null;
  })();
  const programUseMismatch = Boolean(programTemplateUse && programTemplateUse !== use);
  const planModule = objectValue(project.modules["plan-editor"]);
  const planMetrics = objectValue(planModule.metrics);
  const planFloorArea = typeof planMetrics.floorArea === "number" ? planMetrics.floorArea : 0;
  const planFloorCount = typeof planModule.floorCount === "number" ? planModule.floorCount : 0;
  const planGross = planFloorArea * planFloorCount;
  const planSyncDelta = programGross - planGross;
  const planSyncPass = programGross > 0 && planGross > 0 && Math.abs(planSyncDelta) / programGross <= .1;
  const planSyncScale = programGross > 0 && planGross > 0 ? planGross / programGross : 1;
  const allowedFootprint = thread.canonical.site.allowedFootprint;
  const programTargetFootprint = planFloorCount > 0 && programGross > 0 ? programGross / planFloorCount : 0;
  const canExpandPlanToProgram = planSyncDelta > 0
    && programTargetFootprint > 0
    && allowedFootprint > 0
    && programTargetFootprint <= allowedFootprint + .01;

  const applyCurrentUseTemplate = () => {
    setSpaces(templates[use].spaces.map((space) => ({ ...space })));
    setRelationships(templates[use].relationships.map((relationship) => ({ ...relationship })));
    setNetRatio(templates[use].netRatio);
    setTargetGross(Math.max(100, Math.floor(allowedGross > 0 ? allowedGross * .995 : targetGross)));
    setGrossDraft(null);
    setStatus(`${templates[use].label} mahal programı proje kullanımına göre yüklendi`);
  };

  const applyTargetGrossSuggestion = () => {
    if (!(result.netArea > 0) || programTargetPass) return;
    setSpaces((current) => current.map((space) => ({
      ...space,
      unitArea: Number(Math.max(2, space.unitArea * targetProgramScale).toFixed(2)),
    })));
    setStatus(`Mahal alanları mevcut dağılım korunarak ${targetGross.toLocaleString("tr-TR", { maximumFractionDigits: 0 })} m² hedef brüte ölçeklendi`);
  };

  const applyKaksSuggestion = () => {
    if (!(allowedGross > 0) || !(programGross > 0) || grossPass) return;
    setSpaces((current) => current.map((space) => ({
      ...space,
      unitArea: Number(Math.max(2, space.unitArea * grossScale).toFixed(2)),
    })));
    setTargetGross(Math.max(100, Math.floor(grossTarget)));
    setGrossDraft(null);
    setStatus(`Mahal alanları mevcut dağılım korunarak KAKS sınırına göre küçültüldü · hedef ≤ ${allowedGross.toFixed(1)} m²`);
  };

  const applyPlanCoordinationSuggestion = () => {
    if (!(planGross > 0) || !(programGross > 0) || planSyncPass || programUseMismatch) return;
    setSpaces((current) => current.map((space) => ({
      ...space,
      unitArea: Number(Math.max(2, space.unitArea * planSyncScale).toFixed(2)),
    })));
    setTargetGross(Math.max(100, Number(planGross.toFixed(1))));
    if (planFloorCount > 0) setFloors(planFloorCount);
    setGrossDraft(null);
    setStatus(`Mahal programı plan toplam alanına göre koordine edildi · hedef ≈ ${planGross.toFixed(1)} m²`);
  };

  if (issueFocus === "plan-sync") {
    return <section className="architect-app arx-architect-plan-sync" data-testid="architectural-program-plan-sync">
      <div className="arx-plan-sync-project-strip" aria-label="Aktif proje">
        <div><span>ARKEMX / ARC SYNC</span><b>{project.name}</b></div>
        <div><span>{project.phase}</span><span>{project.revision}</span></div>
      </div>

      {programUseMismatch ? <section className="arx-plan-sync-use-warning" role="alert">
        <div>
          <span>ÖNCE PROGRAM KULLANIMINI DÜZELTİN</span>
          <b>Kullanım “{templates[use].label}”, mevcut mahal seti ise “{programTemplateUse ? templates[programTemplateUse].label : "tanımsız"}”.</b>
          <p>Yanlış kullanım şablonunu plan alanına ölçeklemek programı matematiksel olarak eşler ama mimari olarak yanlış kayıt üretir.</p>
        </div>
        <button type="button" onClick={applyCurrentUseTemplate}>{templates[use].label} şablonuna geçir</button>
      </section> : null}

      <section className="arx-plan-sync-summary" data-state={planSyncPass ? "pass" : "review"}>
        <div><span>MİMARİ PROGRAM BRÜTÜ</span><b>{programGross.toLocaleString("tr-TR", { maximumFractionDigits: 1 })} m²</b></div>
        <div><span>PLAN TOPLAMI</span><b>{planGross > 0 ? `${planGross.toLocaleString("tr-TR", { maximumFractionDigits: 1 })} m²` : "—"}</b></div>
        <div><span>FARK</span><b>{planGross > 0 ? `${planSyncDelta.toLocaleString("tr-TR", { maximumFractionDigits: 1 })} m²` : "—"}</b></div>
        {!planSyncPass && planGross > 0 && !programUseMismatch
          ? canExpandPlanToProgram
            ? <div className="arx-plan-sync-actions">
                <Link href="/tasarim-calismalari/program-plan-alani">Plan tabanını programa göre düzenle</Link>
                <button type="button" onClick={applyPlanCoordinationSuggestion}>Programı mevcut plana küçült</button>
              </div>
            : <button type="button" onClick={applyPlanCoordinationSuggestion}>Programı mevcut plan kapasitesine ölçekle</button>
          : planSyncPass
            ? <div className="arx-plan-sync-complete"><span>KOORDİNASYON TAMAMLANDI</span><b>Program ve plan alanı uyumlu</b></div>
            : null}
      </section>

      <div className="arx-plan-sync-grid">
        <main>
          <section className="arx-plan-sync-equation">
            <span>ARC-021 · PROGRAM ↔ PLAN ALAN KOORDİNASYONU</span>
            <div>
              <article><small>PLAN TABANI</small><b>{planFloorArea > 0 ? `${planFloorArea.toLocaleString("tr-TR", { maximumFractionDigits: 1 })} m²` : "—"}</b><p>Plan & aks modeli</p></article>
              <i>×</i>
              <article><small>KAT ADEDİ</small><b>{planFloorCount || "—"}</b><p>Plan & aks modeli</p></article>
              <i>=</i>
              <article><small>PLAN TOPLAMI</small><b>{planGross > 0 ? `${planGross.toLocaleString("tr-TR", { maximumFractionDigits: 1 })} m²` : "—"}</b><p>Program hedefi için fiziksel referans</p></article>
            </div>
          </section>

          <section className="arx-plan-sync-program">
            <header>
              <div><span>MAHAL PROGRAMI</span><b>{spaces.length} mahal türü · net {result.netArea.toLocaleString("tr-TR", { maximumFractionDigits: 1 })} m²</b></div>
              <div><span>NET / BRÜT</span><b>%{netRatio}</b></div>
            </header>
            <div className="arx-plan-sync-space-head" aria-hidden="true"><span>Mahal</span><span>Adet</span><span>Birim alan</span><span>Toplam net</span></div>
            <div className="arx-plan-sync-space-list">
              {spaces.map((space) => <article key={space.id}>
                <div><small>{space.code}</small><b>{space.name}</b><span>{space.zone}</span></div>
                <label><input aria-label={`${space.name} adedi`} type="number" min="1" max="500" value={space.count} onChange={(event) => updateSpace(space.id, { count: clamp(Number(event.target.value), 1, 500) })}/></label>
                <label><div><input aria-label={`${space.name} birim alanı`} type="number" min="2" max="50000" step=".5" value={space.unitArea} onChange={(event) => updateSpace(space.id, { unitArea: clamp(Number(event.target.value), 2, 50000) })}/><i>m²</i></div></label>
                <strong>{(space.count * space.unitArea).toLocaleString("tr-TR", { maximumFractionDigits: 1 })} m²</strong>
              </article>)}
            </div>
          </section>
        </main>

        <aside>
          <section>
            <strong>ALAN KOORDİNASYONU</strong>
            <div><span>Program brütü</span><b>{programGross.toLocaleString("tr-TR", { maximumFractionDigits: 1 })} m²</b></div>
            <div><span>Plan toplamı</span><b>{planGross > 0 ? `${planGross.toLocaleString("tr-TR", { maximumFractionDigits: 1 })} m²` : "—"}</b></div>
            <div><span>Fark oranı</span><b className={planSyncPass ? "good" : "risk"}>{programGross > 0 && planGross > 0 ? `%${(Math.abs(planSyncDelta) / programGross * 100).toFixed(1)}` : "—"}</b></div>
          </section>
          <section>
            <strong>İMAR / YÜKSEKLİK BAĞLAMI</strong>
            <div><span>KAKS azami</span><b>{allowedGross > 0 ? `${allowedGross.toLocaleString("tr-TR", { maximumFractionDigits: 1 })} m²` : "—"}</b></div>
            <div><span>TAKS azami taban</span><b>{allowedFootprint > 0 ? `${allowedFootprint.toLocaleString("tr-TR", { maximumFractionDigits: 1 })} m²` : "—"}</b></div>
            <div><span>Programdan hedef taban</span><b>{programTargetFootprint > 0 ? `${programTargetFootprint.toLocaleString("tr-TR", { maximumFractionDigits: 1 })} m²` : "—"}</b></div>
            <div><span>Plan kat adedi</span><b>{planFloorCount || "—"}</b></div>
            <div><span>Program kat adedi</span><b>{floors}</b></div>
            <small>{canExpandPlanToProgram ? "Programın mevcut kat adedindeki hedef tabanı TAKS sınırı içindedir. Programı küçültmeden önce plan geometrisini bu hedefe koordine etmek mümkündür." : "KAKS üst sınırdır; mevcut Hmax, TAKS ve plan kat adedi fiziksel kullanılabilir alanı ayrıca sınırlar. ARC-021 bu iki modeli koordine eder."}</small>
          </section>
        </aside>
      </div>

      <footer className="arx-plan-sync-foot"><b>Koordinasyon statüsü · Kavramsal</b><p>Bu ekran program ve plan alanlarını aynı proje kaydında tutarlı hale getirir. Mahal gereksinimleri, kullanıcı kapasitesi, mevzuat ve mimari tasarım kararları ayrıca doğrulanmalıdır.</p></footer>
    </section>;
  }

  const matrixSpaces = spaces.slice(0, 8);
  const matrixRelation = (from: string, to: string) => relationships.find((item) => (item.from === from && item.to === to) || (item.from === to && item.to === from));
  if (issueFocus === "kaks") {
    return <section className="architect-app arx-architect-kaks-focus" data-testid="architectural-program-kaks-focus">
      <div className="arx-kaks-project-strip" aria-label="Aktif proje">
        <div><span>ARKEMX / ARC</span><b>{project.name}</b></div>
        <div><span>{project.phase}</span><span>{project.revision}</span></div>
      </div>

      {programUseMismatch ? <section className="arx-kaks-use-warning" role="alert">
        <div>
          <span>PROGRAM / KULLANIM UYUMSUZLUĞU</span>
          <b>Kullanım “{templates[use].label}”, mevcut mahal seti ise “{programTemplateUse ? templates[programTemplateUse].label : "tanımsız"}”.</b>
          <p>KAKS hesabı matematiksel olarak geçse bile yanlış kullanım şablonuyla program üretmek doğru değildir. Mevcut kayıt otomatik silinmez.</p>
        </div>
        <button type="button" onClick={applyCurrentUseTemplate}>{templates[use].label} şablonuna geçir</button>
      </section> : null}

      <section className="arx-kaks-summary" data-state={grossPass ? "pass" : "review"}>
        <div><span>MEVCUT PROGRAM BRÜTÜ</span><b>{programGross.toLocaleString("tr-TR", { maximumFractionDigits: 1 })} m²</b></div>
        <div><span>{"KAKS'A GÖRE AZAMİ"}</span><b>{allowedGross > 0 ? `${allowedGross.toLocaleString("tr-TR", { maximumFractionDigits: 1 })} m²` : "—"}</b></div>
        <div><span>DURUM</span><b>{allowedGross <= 0 ? "İmar girdisi eksik" : grossPass ? "KAKS sınırı geçti" : `${grossOverage.toLocaleString("tr-TR", { maximumFractionDigits: 1 })} m² azaltılmalı`}</b></div>
        {!grossPass && allowedGross > 0 && !programUseMismatch ? <button type="button" onClick={applyKaksSuggestion}>Program dağılımını koruyarak sınır içine indir</button> : null}
      </section>

      <div className="arx-kaks-workspace">
        <main>
          <header className="arx-kaks-program-head">
            <div><span>MAHAL PROGRAMI</span><b>{spaces.length} mahal türü · net {result.netArea.toLocaleString("tr-TR", { maximumFractionDigits: 1 })} m²</b></div>
            <div><span>NET / BRÜT</span><b>%{netRatio}</b><small>KAKS sınırında mevcut oranla azami net ≈ {allowedNetAtCurrentRatio.toLocaleString("tr-TR", { maximumFractionDigits: 1 })} m²</small></div>
          </header>

          <div className="arx-kaks-space-columns" aria-hidden="true">
            <span>Mahal</span><span>Adet</span><span>Birim alan</span><span>Toplam net</span>
          </div>
          <div className="arx-kaks-space-list">
            {spaces.map((space) => <article key={space.id}>
              <div className="arx-kaks-space-name"><small>{space.code}</small><b>{space.name}</b><span>{space.zone}</span></div>
              <label><span className="arx-kaks-mobile-label">Adet</span><input aria-label={`${space.name} adedi`} type="number" min="1" max="500" value={space.count} onChange={(event) => updateSpace(space.id, { count: clamp(Number(event.target.value), 1, 500) })}/></label>
              <label><span className="arx-kaks-mobile-label">Birim alan</span><div className="arx-kaks-area-input"><input aria-label={`${space.name} birim alanı`} type="number" min="2" max="50000" step=".5" value={space.unitArea} onChange={(event) => updateSpace(space.id, { unitArea: clamp(Number(event.target.value), 2, 50000) })}/><i>m²</i></div></label>
              <div className="arx-kaks-space-total"><small>TOPLAM NET</small><b>{(space.count * space.unitArea).toLocaleString("tr-TR", { maximumFractionDigits: 1 })} m²</b></div>
            </article>)}
          </div>
        </main>
        <aside>
          <section>
            <strong>KAKS ÖN KONTROLÜ</strong>
            <div><span>Program neti</span><b>{result.netArea.toLocaleString("tr-TR", { maximumFractionDigits: 1 })} m²</b></div>
            <div><span>Program brütü</span><b>{programGross.toLocaleString("tr-TR", { maximumFractionDigits: 1 })} m²</b></div>
            <div><span>Azami brüt</span><b>{allowedGross > 0 ? `${allowedGross.toLocaleString("tr-TR", { maximumFractionDigits: 1 })} m²` : "—"}</b></div>
            <div><span>Fark</span><b className={grossPass ? "good" : "risk"}>{allowedGross > 0 ? `${(programGross - allowedGross).toLocaleString("tr-TR", { maximumFractionDigits: 1 })} m²` : "—"}</b></div>
            <small>KAKS/emsal girdisi değiştirilmez. Mahal adetlerini veya birim alanlarını düzenleyerek program brütünü sınır içine alın.</small>
          </section>
          <section className="arx-kaks-context">
            <strong>PROGRAM BAĞLAMI</strong>
            <div><span>Kullanım</span><b>{templates[use].label}</b></div>
            <div><span>Kat adedi</span><b>{floors}</b></div>
            <div><span>Kat yüksekliği</span><b>{floorHeight.toFixed(1)} m</b></div>
            <small>Kat ve yükseklik PLN-013 kapsamında ayrıca koordine edilir; bu ekranda KAKS açığını kapatmaya odaklanın.</small>
          </section>
        </aside>
      </div>
      <footer className="arx-kaks-foot"><b>Program statüsü · Kavramsal</b><p>Bu ön kontrol ruhsat veya resmî imar uygunluğu değildir. KAKS kaynağı uzman doğrulaması bekler; mahal alanları proje gereksinimleri ve ilgili mevzuat açısından ayrıca doğrulanmalıdır.</p></footer>
    </section>;
  }

  return <section className={simple ? "architect-app arx-architect-simple" : "architect-app"} data-testid="architectural-program-studio">
    {simple ? <details className="arx-architect-project-details"><summary>Proje bilgileri ve yedek</summary><ProjectKernelBar module="ARCHITECTURAL PROGRAM ENGINE" confidence="Mimari program / ön tasarım" /></details> : <ProjectKernelBar module="ARCHITECTURAL PROGRAM ENGINE" confidence="Mimari program / ön tasarım" />}
    <header className="architect-head"><div><p className="eyebrow light">Arkem Mimari Program & Performans Stüdyosu</p><h2>Metrekareyi değil,<br/><em>mekânsal sistemi tasarlayın.</em></h2></div><p>Mahal programı, net–brüt verimi, kullanıcı yükü, komşuluklar, düşey çekirdek, kaçış ön göstergesi ve cephe kararlarını aynı revizyon zincirinde yönetin.</p><div className="architect-status"><span>AKTARIM DURUMU</span><b>{status}</b></div></header>
    {simple && <div className="arx-architect-primary">
  <div className="arx-architect-transfer" data-ready={transferReady ? "true" : "false"} role="status">
    <div>
      <span>01 / PROJE VERİSİ</span>
      <b>{transferReady ? "Arazi ve proje verileri otomatik devralındı" : "Proje verileri açılıyor…"}</b>
      <small>{transferReady ? status : "Aktif proje kaydı ve seçili kütle hazırlanıyor."}</small>
    </div>
    <div className="arx-architect-transfer-tags" aria-label="Aktarım özeti">
      <span>{templates[use].label}</span>
      <span>{targetGross.toLocaleString("tr-TR")} m²</span>
      <span>{floors} kat</span>
      <span>{siteContext.parcelReference ? "Parsel bağlı" : "Parsel referansı yok"}</span>
      <span>{siteContext.massingModel ? "Kütle bağlı" : "Kütle bekleniyor"}</span>
    </div>
  </div>

  <div className="arx-architect-stage-strip" aria-label="Mimari çalışma akışı">
    <div className="done"><i>✓</i><span><b>Proje verisi</b><small>Devralındı</small></span></div>
    <div className={programTargetPass ? "done" : "current"}><i>{programTargetPass ? "✓" : "2"}</i><span><b>Mahal programı</b><small>{programTargetPass ? "Alan kapısı geçti" : "Şu an buradasın"}</small></span></div>
    <div className={programTargetPass ? "current" : ""}><i>3</i><span><b>Plan & aks</b><small>{programTargetPass ? "Sıradaki çalışma" : "Alan uyumu bekleniyor"}</small></span></div>
    <div><i>4</i><span><b>Mimari kontroller</b><small>Karar kapısı</small></span></div>
  </div>

  <div className="arx-architect-fields">
    <label>Yapı kullanımı
      <select value={use} onChange={(event) => setUse(event.target.value as ProgramUse)}>{Object.entries(templates).map(([key, template]) => <option value={key} key={key}>{template.label}</option>)}</select>
    </label>
    <label>Hedef brüt alan (m²)
      <input type="number" min="100" max="200000" step="50" value={grossDraft ?? targetGross}
        onChange={(event) => {
          const value = event.target.value;
          setGrossDraft(value);
          if (value !== "" && Number.isFinite(Number(value))) setTargetGross(clamp(Number(value), 100, 200000));
        }}
        onBlur={() => { if (grossDraft !== null) { if (grossDraft !== "") setTargetGross(clamp(Number(grossDraft), 100, 200000)); setGrossDraft(null); } }} />
    </label>
    <label>Kat adedi
      <input type="number" min="1" max="30" value={floors} onChange={(event) => setFloors(clamp(Number(event.target.value), 1, 30))}/>
    </label>
    <label>Çekirdek yerleşimi
      <select value={coreStrategy} onChange={(event) => setCoreStrategy(event.target.value as ArchitecturalCoreStrategy)}>
        <option value="central">Merkezi</option><option value="split">Ayrık (iki çekirdek)</option><option value="perimeter">Çeper</option>
      </select>
    </label>
  </div>
  <div className="arx-architect-program-gate" data-state={programTargetPass ? "pass" : "review"}>
    <div>
      <span>02 / MAHAL PROGRAMI ALAN KAPISI</span>
      <b>{programTargetPass ? "Program hedef brüt alanla uyumlu" : `Program hedef alanla uyumlu değil · ${Math.abs(programTargetDelta).toLocaleString("tr-TR", { maximumFractionDigits: 0 })} m² ${programTargetDelta > 0 ? "azaltılmalı" : "artırılmalı"}`}</b>
      <small>Hedef {targetGross.toLocaleString("tr-TR", { maximumFractionDigits: 0 })} m² · Program {programGross.toLocaleString("tr-TR", { maximumFractionDigits: 0 })} m² · tolerans ±%10</small>
    </div>
    {programTargetPass
      ? <Link href="/plan-ve-aks">Plan & Aksa Geç <i>→</i></Link>
      : <button type="button" onClick={applyTargetGrossSuggestion}>Dağılımı hedefe ölçekle</button>}
  </div>
  <div className="arx-architect-actions">
    <button type="button" onClick={() => { if (window.confirm("Kullanım şablonu mevcut mahal listesini değiştirecek. Devam edilsin mi?")) loadTemplate(); }}>Seçili kullanım şablonunu uygula</button>
    <button type="button" className={showAdvanced ? "arx-advanced-active" : ""} aria-expanded={showAdvanced} onClick={() => {
      setShowAdvanced((current) => !current);
      if (showAdvanced && (view === "zoning" || view === "matrix" || view === "envelope")) setView("schedule");
    }}>{showAdvanced ? "Gelişmiş ayarları kapat" : "Gelişmiş ayarlar"}</button>
  </div>
</div>}
    <div className="architect-workspace">
      {(!simple || showAdvanced) && <aside className="architect-controls"><strong>01 / PROJE PROGRAMI</strong><label>Kullanım<select value={use} onChange={(event) => setUse(event.target.value as ProgramUse)}>{Object.entries(templates).map(([key, template]) => <option value={key} key={key}>{template.label}</option>)}</select></label><button className="thread-import-button" onClick={loadTemplate}>Seçili kullanım şablonunu yükle</button><button className="thread-import-button primary" onClick={importThread}>Parsel / proje zincirinden aktar ↘</button><div className="architect-input-grid"><label>Hedef brüt<input type="number" min="100" max="200000" step="50" value={targetGross} onChange={(event) => setTargetGross(clamp(Number(event.target.value), 100, 200000))}/><i>m²</i></label><label>Net / brüt<input type="number" min="40" max="95" value={netRatio} onChange={(event) => setNetRatio(clamp(Number(event.target.value), 40, 95))}/><i>%</i></label><label>Kat<input type="number" min="1" max="30" value={floors} onChange={(event) => setFloors(clamp(Number(event.target.value), 1, 30))}/></label><label>Kat yüksekliği<input type="number" min="2.6" max="10" step=".1" value={floorHeight} onChange={(event) => setFloorHeight(clamp(Number(event.target.value), 2.6, 10))}/><i>m</i></label><label>Plaka oranı<input type="number" min=".5" max="4" step=".05" value={aspect} onChange={(event) => setAspect(clamp(Number(event.target.value), .5, 4))}/></label><label>Koridor hedefi<input type="number" min="1.2" max="5" step=".1" value={corridorWidth} onChange={(event) => setCorridorWidth(clamp(Number(event.target.value), 1.2, 5))}/><i>m</i></label><label>Kaçış hedefi<input type="number" min="10" max="80" step="1" value={targetTravel} onChange={(event) => setTargetTravel(clamp(Number(event.target.value), 10, 80))}/><i>m</i></label><label>Merdiven / asansör<div><input aria-label="Merdiven adedi" type="number" min="1" max="12" value={stairs} onChange={(event) => setStairs(clamp(Number(event.target.value), 1, 12))}/><input aria-label="Asansör adedi" type="number" min="0" max="12" value={elevators} onChange={(event) => setElevators(clamp(Number(event.target.value), 0, 12))}/></div></label></div><strong>02 / TEKNİK ÇIKTI</strong><div className="architect-export"><button onClick={exportJson}>JSON<b>Şema + kontroller</b></button><button onClick={exportCsv}>CSV<b>Mahal listesi</b></button><Link href="/plan-ve-aks">PLAN<b>Aks modeline geç ↗</b></Link></div></aside>}
      <main className="architect-main"><header><nav>{(["schedule", "zoning", "scheme", "matrix", "envelope", "checks"] as ProgramView[]).filter((item) => !simple || showAdvanced || item === "schedule" || item === "scheme" || item === "checks").map((item) => <button key={item} className={view === item ? "active" : ""} onClick={() => setView(item)}>{item === "schedule" ? "Mahal programı" : item === "zoning" ? "Zon / komşuluk" : item === "scheme" ? "Plan şeması" : item === "matrix" ? "Alternatif / matris" : item === "envelope" ? "Cephe / kabuk" : "Performans kontrolleri"}</button>)}</nav><div><span>ARKEM-ARC/3.0</span><b>{spaces.length} mahal türü · {relationships.length} ilişki</b></div></header>
        <div className="architect-kpis"><article data-state={programTargetPass ? "pass" : "review"}><span>PROGRAM / HEDEF</span><b>{architecturalScheme.plate.grossDemand.toLocaleString("tr-TR", { maximumFractionDigits: 0 })} / {targetGross.toLocaleString("tr-TR", { maximumFractionDigits: 0 })} m²</b><small>{programTargetPass ? "Alan hedefi tolerans içinde" : `%${(programTargetDeltaRatio * 100).toFixed(0)} fark · koordinasyon gerekli`}</small></article><article><span>KOMŞULUK</span><b>%{architecturalScheme.relationships.score.toFixed(0)}</b><small>{architecturalScheme.relationships.satisfied}/{architecturalScheme.relationships.total} ilişki gerçekleşti</small></article><article><span>EN UZAK KAÇIŞ*</span><b>{architecturalScheme.circulation.maximumTravelDistance.toFixed(1)} m</b><small>{targetTravel} m kavramsal hedef</small></article><article><span>PLAKA</span><b>{architecturalScheme.plate.width.toFixed(1)} × {architecturalScheme.plate.depth.toFixed(1)} m</b><small>{floors} kat / {architecturalScheme.plate.area.toFixed(0)} m²</small></article></div>
        <div className="v113-source-band" data-state={architecturalScheme.source.massingConnected ? architecturalScheme.source.authoritativeMassing ? "verified" : "conceptual" : "missing"}><span>V113 / MEKÂNSAL ŞEMA MOTORU</span><b>{architecturalScheme.source.massingConnected ? `V112 kütlesi bağlı · ${architecturalScheme.source.selectedMassingId ?? "önerilen alternatif"}` : "V112 kütlesi bulunamadı · program plakasından türetildi"}</b><small>{architecturalScheme.source.authoritativeMassing ? "Doğrulanmış imar girdisinden türetilen kütle kullanılıyor." : "Kavramsal ön tasarım · mimar ve ilgili uzman doğrulaması gerekir."}</small></div>
        {view === "schedule" && <section className="architect-schedule"><header><div><span>MAHAL LİSTESİ / PROGRAM REVİZYONU</span><b>Alan, adet, kullanıcı yoğunluğu ve performans etiketi</b></div><button onClick={addSpace}>+ Mahal türü ekle</button></header>{simple && <div className="arx-architect-space-list">
  {spaces.map((space) => <article key={space.id} className="arx-architect-space">
    <div className="arx-architect-space-name">
      <small>{space.code}</small>
      <label>Mahalin adı<input value={space.name} onChange={(event) => updateSpace(space.id, { name: event.target.value })} /></label>
    </div>
    <label>Adet<input key={space.id + "-count-" + space.count} type="number" min="1" max="500"
      defaultValue={space.count}
      onBlur={(event) => updateSpace(space.id, { count: event.currentTarget.value === "" ? space.count : clamp(Number(event.currentTarget.value), 1, 500) })} /></label>
    <label>Birim alan (m²)<input key={space.id + "-area-" + space.unitArea} type="number" min="2" max="50000" step="1"
      defaultValue={space.unitArea}
      onBlur={(event) => updateSpace(space.id, { unitArea: event.currentTarget.value === "" ? space.unitArea : clamp(Number(event.currentTarget.value), 2, 50000) })} /></label>
    <div className="arx-architect-space-total"><small>TOPLAM</small><b>{(space.count * space.unitArea).toLocaleString("tr-TR")} m²</b></div>
    <button type="button" className="arx-architect-remove" aria-label={space.name + " mahalini sil"} onClick={() => { if (window.confirm(space.name + " mahalini silmek istediğinize emin misiniz?")) setSpaces((current) => current.filter((item) => item.id !== space.id)); }}>Sil</button>
  </article>)}
</div>}<div className="architect-table"><div className="head"><span>KOD / MAHAL</span><span>ZON</span><span>ADET</span><span>BİRİM m²</span><span>TOPLAM</span><span>m²/KİŞİ</span><span>ÖZELLİK</span><span></span></div>{spaces.map((space) => <article key={space.id}><div><b>{space.code}</b><input aria-label={`${space.code} mahal adı`} value={space.name} onChange={(event) => updateSpace(space.id, { name: event.target.value })}/></div><input aria-label={`${space.code} zonu`} value={space.zone} onChange={(event) => updateSpace(space.id, { zone: event.target.value })}/><input aria-label={`${space.code} adedi`} type="number" min="1" max="500" value={space.count} onChange={(event) => updateSpace(space.id, { count: clamp(Number(event.target.value), 1, 500) })}/><input aria-label={`${space.code} alanı`} type="number" min="2" max="50000" step="1" value={space.unitArea} onChange={(event) => updateSpace(space.id, { unitArea: clamp(Number(event.target.value), 2, 50000) })}/><strong>{(space.count * space.unitArea).toFixed(0)}</strong><input aria-label={`${space.code} kişi yoğunluğu`} type="number" min=".5" max="100" step=".5" value={space.density} onChange={(event) => updateSpace(space.id, { density: clamp(Number(event.target.value), .5, 100) })}/><div className="architect-flags"><button className={space.daylight ? "active" : ""} onClick={() => updateSpace(space.id, { daylight: !space.daylight })}>G</button><button className={space.accessible ? "active" : ""} onClick={() => updateSpace(space.id, { accessible: !space.accessible })}>E</button></div><button className="remove" onClick={() => setSpaces((current) => current.filter((item) => item.id !== space.id))}>×</button></article>)}</div><footer><span>G · günışığı önceliği</span><span>E · erişilebilir rota hedefi</span><b>Toplam net · {result.netArea.toFixed(1)} m²</b></footer></section>}
        {view === "zoning" && <section className="architect-zoning"><div className="zone-board"><header><span>ZON DAĞILIMI</span><b>Program alanının işlevsel kümeleri</b></header><div>{zones.map((zone, index) => { const zoneArea = spaces.filter((space) => space.zone === zone).reduce((sum, space) => sum + space.count * space.unitArea, 0); return <article key={zone} style={{ "--zone-size": `${Math.max(18, zoneArea / Math.max(result.netArea, 1) * 100)}%` } as React.CSSProperties}><span>0{index + 1}</span><b>{zone}</b><strong>{zoneArea.toFixed(0)} m²</strong><small>%{(zoneArea / Math.max(result.netArea, 1) * 100).toFixed(1)} net alan</small></article>; })}</div></div><div className="adjacency-board"><header><span>KOMŞULUK / ARAYÜZ KAYDI</span><b>%{result.adjacencyScore.toFixed(0)} kararlandı</b></header>{relationships.map((relationship) => <button key={relationship.id} className={relationship.confirmed ? "confirmed" : ""} onClick={() => setRelationships((current) => current.map((item) => item.id === relationship.id ? { ...item, confirmed: !item.confirmed } : item))}><i>{relationship.confirmed ? "✓" : "?"}</i><span><b>{relationship.from}</b><small>↔ {relationship.to}</small></span><strong>{relationship.priority}</strong></button>)}<p>Komşuluk kaydı fiziksel mesafe hesabı değildir; plan editöründeki yerleşim kararı için doğrulanacak tasarım gereksinimidir.</p></div></section>}
        {view === "scheme" && <section className="v113-scheme-engine">{!programTargetPass && <div className="arx-architect-draft-warning" role="alert"><b>TASLAK ŞEMA · ALAN KOORDİNASYONU BEKLİYOR</b><span>Program brütü hedef alanla henüz uyumlu değil. Bu şema yalnız yerleşim fikrini gösterir; Plan & Aks aktarımı için önce mahal programı alan kapısını tamamlayın.</span></div>}<header><div><span>V113 / MEKÂNSAL ŞEMA MOTORU</span><b>Program → konum → ilişki → dolaşım → kontrol</b></div><strong>{checks.filter((check) => check.state === "pass").length}/{checks.length} kontrol geçti</strong></header><div className="v113-scheme-layout"><div className="v113-plan-panel"><div className="v113-plan-heading"><span>KAVRAMSAL PLAN ŞEMASI</span><b>{architecturalScheme.plate.width.toFixed(1)} × {architecturalScheme.plate.depth.toFixed(1)} m · {architecturalScheme.plate.floors} kat</b><small>Kuzey ↑ · Mahal türü düğümleri</small></div><div className="v113-plan-board" style={{ "--scheme-aspect": architecturalScheme.plate.aspect } as React.CSSProperties} aria-label="Kavramsal mimari plan şeması">{architecturalScheme.nodes.map((node) => <article key={node.id} className={node.daylightRequired ? "daylight" : "interior"} title={`${node.name} · ${node.totalArea.toFixed(0)} m²`} style={{ left: `${node.position.x}%`, top: `${node.position.y}%`, width: `${node.visual.width}%`, minHeight: `${node.visual.height}%` }}><span>{node.code}</span><b>{node.name}</b><small>{node.zone} · {node.totalArea.toFixed(0)} m²</small></article>)}{architecturalScheme.cores.map((core) => <i className="v113-core-node" key={core.id} style={{ left: `${core.position.x}%`, top: `${core.position.y}%` }} title={`${core.label} · ${core.area.toFixed(0)} m²`}>{core.id.replace("CORE-", "Ç")}</i>)}{architecturalScheme.exits.map((exit) => <i className="v113-exit-node" key={exit.id} style={{ left: `${exit.x}%`, top: `${exit.y}%` }} title={exit.label}>Ç</i>)}<div className="v113-circulation-spine" data-strategy={coreStrategy}></div></div><footer><span><i className="daylight"></i>Günışığı isteyen mahal</span><span><i className="interior"></i>İç zon</span><span><i className="core"></i>Çekirdek</span><span><i className="exit"></i>Çıkış</span></footer></div><aside className="v113-scheme-inspector"><span>Çekirdek yerleşimi</span><div className="v113-core-options">{(["central", "split", "perimeter"] as ArchitecturalCoreStrategy[]).map((strategy) => <button key={strategy} className={coreStrategy === strategy ? "active" : ""} onClick={() => setCoreStrategy(strategy)}>{strategy === "central" ? "Merkezi" : strategy === "split" ? "Ayrık" : "Çeper"}<small>{strategy === "central" ? "tek çekirdek" : strategy === "split" ? "iki kaçış odağı" : "servis kenarında"}</small></button>)}</div><dl className="v113-scheme-metrics"><div><dt>Günışığı kapasitesi</dt><dd>%{architecturalScheme.daylight.coverage.toFixed(0)}</dd></div><div><dt>Komşuluk gerçekleşmesi</dt><dd>%{architecturalScheme.relationships.score.toFixed(0)}</dd></div><div><dt>Ortalama kaçış yolu</dt><dd>{architecturalScheme.circulation.averageTravelDistance.toFixed(1)} m</dd></div><div><dt>Çekirdek payı</dt><dd>%{architecturalScheme.core.ratio.toFixed(1)}</dd></div></dl><div className="v113-relation-list"><b>Mesafe tabanlı ilişkiler</b>{architecturalScheme.relationships.items.map((relationship) => <p key={relationship.id} data-state={relationship.satisfied ? "pass" : relationship.confirmed ? "review" : "risk"}><i>{relationship.satisfied ? "✓" : "!"}</i><span>{relationship.from}<small>↔ {relationship.to}</small></span><strong>{relationship.distance.toFixed(1)} m</strong></p>)}</div></aside></div><footer className="v113-scheme-note"><b>Mesleki sınır</b><p>{architecturalScheme.limitations[0]}</p></footer></section>}
        {view === "matrix" && <section className="architect-matrix-view"><header><span>V83 / MİMARİ KARAR MATRİSİ</span><b>Üç plaka stratejisini aynı program üzerinde karşılaştırın</b><p>Seçim, avan tasarım başlangıç parametrelerini değiştirir; nihai mimari çözüm değildir.</p></header><div className="architect-strategies">{strategyOptions.map((strategy) => <article className={selectedStrategy === strategy.id ? "active" : ""} key={strategy.id}><span>{strategy.id.toLocaleUpperCase("tr-TR")}</span><b>{strategy.label}</b><p>{strategy.note}</p><dl><div><dt>Plaka oranı</dt><dd>{strategy.aspect.toFixed(2)}</dd></div><div><dt>Net / brüt</dt><dd>%{strategy.netRatio}</dd></div><div><dt>Güney WWR</dt><dd>%{strategy.wwr.south}</dd></div></dl><button onClick={() => applyStrategy(strategy)}>{selectedStrategy === strategy.id ? "Uygulandı ✓" : "Senaryoyu uygula"}</button></article>)}</div><div className="architect-adjacency-matrix" style={{ "--matrix-count": matrixSpaces.length } as React.CSSProperties}><div className="corner">İLİŞKİ</div>{matrixSpaces.map((space) => <b key={`head-${space.id}`}>{space.code}</b>)}{matrixSpaces.flatMap((row) => [<strong key={`row-${row.id}`}>{row.code}<small>{row.name}</small></strong>, ...matrixSpaces.map((column) => { const relation = matrixRelation(row.name, column.name); return <button key={`${row.id}-${column.id}`} className={relation?.confirmed ? "confirmed" : relation ? "required" : ""} title={row.id === column.id ? row.name : `${row.name} ↔ ${column.name}`}>{row.id === column.id ? "—" : relation?.priority === "Zorunlu" ? "Z" : relation ? "T" : "·"}</button>; })])}</div><footer><span><i>Z</i>Zorunlu</span><span><i>T</i>Tercih</span><span><i>✓</i>Kararlandı</span><b>Matris ilk 8 mahal türünü gösterir.</b></footer></section>}
        {view === "envelope" && <section className="architect-envelope"><div className="envelope-diagram"><header><span>CEPHE / KABUK ÖN MODELİ</span><b>{result.plateWidth.toFixed(1)} × {result.plateDepth.toFixed(1)} × {(floors * floorHeight).toFixed(1)} m</b></header><div className="envelope-massing"><i className="north" style={{ opacity: .25 + wwr.north / 100 }}></i><i className="east" style={{ opacity: .25 + wwr.east / 100 }}></i><i className="south" style={{ opacity: .25 + wwr.south / 100 }}></i><span>N ↑</span><b>{floors}<small>KAT</small></b></div><div className="envelope-metrics"><p><span>Cephe alanı</span><b>{result.facadeArea.toFixed(0)} m²</b></p><p><span>Cam alanı</span><b>{result.glazingArea.toFixed(0)} m²</b></p><p><span>A/V göstergesi</span><b>{result.compactness.toFixed(3)}</b></p><p><span>Güneş maruziyet endeksi</span><b>{result.solarIndex.toFixed(0)}</b></p></div></div><aside><span>YÖNE GÖRE SAYDAMLIK</span>{Object.entries({ north: "Kuzey", east: "Doğu", south: "Güney", west: "Batı" }).map(([key, label]) => <label key={key}><div><b>{label}</b><small>WWR / cephe alanı</small></div><input type="range" min="5" max="80" value={wwr[key as keyof typeof wwr]} onChange={(event) => setWwr((current) => ({ ...current, [key]: Number(event.target.value) }))}/><strong>%{wwr[key as keyof typeof wwr]}</strong></label>)}<label><div><b>Güney gölgeleme</b><small>Geometri tanımlanmadan ön katsayı</small></div><input type="range" min="0" max="90" value={southShading} onChange={(event) => setSouthShading(Number(event.target.value))}/><strong>%{southShading}</strong></label><p>Enerji, günışığı ve ısıl konfor sonucu için iklim dosyası, gerçek cephe geometrisi, malzeme ve kullanım programı gerekir.</p></aside></section>}
        {view === "checks" && <section className="architect-checks"><header><div><span>MİMARİ PERFORMANS ÖN KONTROLÜ</span><b>Girdi → gösterge → karar / doğrulama</b></div><strong>{checks.filter((check) => check.state === "pass").length}/{checks.length} geçti</strong></header><div className="arx-architect-check-summary" data-state={checks.every((check) => check.state === "pass") ? "pass" : "review"}><b>{checks.filter((check) => check.state !== "pass").length ? `${checks.filter((check) => check.state !== "pass").length} kontrol gözden geçirilmeli` : "Tüm mimari ön kontroller geçti"}</b><span>{checks.filter((check) => check.state !== "pass").map((check) => check.label).join(" · ") || "Plan & Aks koordinasyonuna devam edebilirsiniz."}</span></div>{checks.map((check) => <article className={check.state} key={check.code}><i>{check.state === "pass" ? "✓" : check.state === "review" ? "!" : "×"}</i><div><span>{check.code}</span><b>{check.label}</b><p>{check.note}</p></div><strong>{check.value}</strong></article>)}<div className="architect-next" data-ready={programTargetPass ? "true" : "false"}><span>SONRAKİ VERİ AKTARIMI</span><b>{programTargetPass ? "Mahal programı alan kapısı geçti. V113 mekânsal şemasını Plan & Aks modeline aktarabilirsiniz." : "Plan & Aks aktarımı için önce mahal programını hedef brüt alanla koordine edin."}</b>{programTargetPass ? <Link href="/plan-ve-aks">Plan & Aks stüdyosunu açın ↗</Link> : <button type="button" onClick={() => setView("schedule")}>Mahal programına dön</button>}</div></section>}
      </main>
    </div>
    <footer className="architect-disclaimer"><b>Mesleki sınır</b><p>Bu stüdyo mimari program, alternatif üretimi ve disiplinler arası veri hazırlığı içindir. İmar uygunluğu, yangın tahliyesi, erişilebilirlik, enerji performansı ve uygulama projesi; doğrulanmış mevzuat, bağlam verisi ve yetkili proje müelliflerinin tasarımıyla kesinleştirilir.</p></footer>
  </section>;
}
