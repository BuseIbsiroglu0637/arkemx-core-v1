"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createLayeredDxf, downloadTextFile, type DxfPolyline } from "../lib/engineering";
import { createCorporateTechnicalPdf } from "../lib/technical-sheet";
import { expandProgramSpaces, buildProgramPlanElements, evaluateRequiredAdjacency } from "../lib/plan-program";
import { ProjectKernelBar, useProjectKernel } from "./ProjectKernel";

type Tool = "select" | "column" | "wall" | "space" | "core" | "opening" | "load" | "erase";
type View = "architectural" | "structural" | "loads" | "coordination";
type PlanElement = {
  id: string;
  type: Exclude<Tool, "select" | "erase">;
  level: number;
  x: number;
  y: number;
  orientation: "x" | "y";
  label: string;
  load: number;
  fire: string;
  section: string;
  provenance?: "manual" | "conceptual-seed" | "program";
  sourceSpaceId?: string;
  sourceSpaceInstance?: number;
  sourceSpaceCode?: string;
  sourceZone?: string;
  sourceUnitArea?: number;
  widthBays?: number;
  heightBays?: number;
};

const toolMeta: Record<Tool, { code: string; label: string; hint: string }> = {
  select: { code: "↖", label: "Seç / düzenle", hint: "Nesne özelliklerini aç" },
  column: { code: "■", label: "Kolon", hint: "Aks kesişimine yerleştir" },
  wall: { code: "▰", label: "Perde / duvar", hint: "Aks doğrultusunda yerleştir" },
  space: { code: "□", label: "Mahal", hint: "Aks hücresine tanımla" },
  core: { code: "▣", label: "Çekirdek", hint: "Düşey sirkülasyon alanı" },
  opening: { code: "◇", label: "Döşeme boşluğu", hint: "Diyafram boşluğu" },
  load: { code: "◎", label: "Yük bölgesi", hint: "Hareketli yük tanımla" },
  erase: { code: "×", label: "Sil", hint: "Nesneyi kaldır" },
};

const VIEWBOX = { width: 920, height: 640, padX: 90, padY: 72 };

function createId(type: string, level: number, x: number, y: number) {
  return `${type}-${level}-${x}-${y}-${Math.random().toString(36).slice(2, 7)}`;
}

export function AdvancedPlanEditor({ compactKernel = false, issueFocus = false }: { compactKernel?: boolean; issueFocus?: "taks" | "kmkr" | "program-area" | false } = {}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const transferApplied = useRef(false);
  const handoffSeen = useRef("");
  const { patchModule, thread, project, hydrated } = useProjectKernel();
  const [tool, setTool] = useState<Tool>("select");
  const [view, setView] = useState<View>(issueFocus === "kmkr" ? "coordination" : "architectural");
  const [level, setLevel] = useState(1);
  const [floorCount, setFloorCount] = useState(4);
  const [baysX, setBaysX] = useState(6);
  const [baysY, setBaysY] = useState(5);
  const [spanX, setSpanX] = useState(4.5);
  const [spanY, setSpanY] = useState(4.2);
  const [orientation, setOrientation] = useState<"x" | "y">("x");
  const [elements, setElements] = useState<PlanElement[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [history, setHistory] = useState<PlanElement[][]>([]);
  const [future, setFuture] = useState<PlanElement[][]>([]);
  const [status, setStatus] = useState("Yeni proje şeması hazır");
  const [layers, setLayers] = useState({ columns: true, walls: true, spaces: true, openings: true, loads: true });
  const [modelHydrated, setModelHydrated] = useState(false);
  const isTaksFocus = issueFocus === "taks";
  const isKmKrFocus = issueFocus === "kmkr";
  const isProgramAreaFocus = issueFocus === "program-area";
  const isPlanGeometryFocus = isTaksFocus || isProgramAreaFocus;

  useEffect(() => {
    if (!hydrated || transferApplied.current) return;
    transferApplied.current = true;
    const timer = window.setTimeout(() => {
    const saved = project.modules["plan-editor"] as Partial<{ level: number; floorCount: number; baysX: number; baysY: number; spanX: number; spanY: number; elements: PlanElement[] }> | undefined;
    if (saved) {
      if (typeof saved.level === "number") setLevel(saved.level);
      if (typeof saved.floorCount === "number") setFloorCount(saved.floorCount);
      if (typeof saved.baysX === "number") setBaysX(saved.baysX);
      if (typeof saved.baysY === "number") setBaysY(saved.baysY);
      if (typeof saved.spanX === "number") setSpanX(saved.spanX);
      if (typeof saved.spanY === "number") setSpanY(saved.spanY);
      if (Array.isArray(saved.elements)) setElements(saved.elements);
      setStatus("Kayıtlı plan ve nesneler otomatik açıldı");
      setModelHydrated(true);
      return;
    }
    const source = thread.canonical;
    const width = source.architecture.plateWidth || source.structure.width;
    const depth = source.architecture.plateDepth || source.structure.depth;
    const nextBaysX = source.structure.baysX || Math.max(2, Math.round(width / 5));
    const nextBaysY = source.structure.baysY || Math.max(2, Math.round(depth / 5));
    if (source.architecture.floors > 0) setFloorCount(Math.max(1, Math.min(30, source.architecture.floors)));
    if (nextBaysX > 0) setBaysX(Math.max(2, Math.min(16, nextBaysX)));
    if (nextBaysY > 0) setBaysY(Math.max(2, Math.min(16, nextBaysY)));
    if (width > 0 && nextBaysX > 0) setSpanX(Math.max(2, Math.min(12, width / nextBaysX)));
    if (depth > 0 && nextBaysY > 0) setSpanY(Math.max(2, Math.min(12, depth / nextBaysY)));
    setStatus(source.architecture.grossArea > 0 ? "Mimari plaka, kat ve ölçüler otomatik aktarıldı" : "Yeni proje şeması hazır");
    setModelHydrated(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [hydrated, project.modules, thread.canonical]);

  const visible = useMemo(() => elements.filter((element) => element.level === level), [elements, level]);
  const selected = elements.find((element) => element.id === selectedId) ?? null;
  const drawingWidth = VIEWBOX.width - VIEWBOX.padX * 2;
  const drawingHeight = VIEWBOX.height - VIEWBOX.padY * 2;
  const totalWidth = baysX * spanX;
  const totalDepth = baysY * spanY;
  const scale = Math.min(drawingWidth / totalWidth, drawingHeight / totalDepth);
  const originX = (VIEWBOX.width - totalWidth * scale) / 2;
  const originY = (VIEWBOX.height - totalDepth * scale) / 2;
  const cellW = spanX * scale;
  const cellH = spanY * scale;

  const metrics = useMemo(() => {
    const floorArea = totalWidth * totalDepth;
    const columns = visible.filter((element) => element.type === "column");
    const walls = visible.filter((element) => element.type === "wall");
    const rooms = visible.filter((element) => element.type === "space");
    const cores = visible.filter((element) => element.type === "core");
    const roomArea = rooms.reduce((sum, element) => sum + (element.widthBays ?? 1) * spanX * (element.heightBays ?? 1) * spanY, 0);
    const openings = visible.filter((element) => element.type === "opening");
    const loads = visible.filter((element) => element.type === "load");
    const wallLength = walls.reduce((sum, wall) => sum + (wall.orientation === "x" ? spanX : spanY), 0);
    const openingArea = openings.reduce((sum, element) => sum + (element.widthBays ?? 1) * spanX * (element.heightBays ?? 1) * spanY, 0);
    const coreArea = cores.reduce((sum, element) => sum + (element.widthBays ?? 1) * spanX * (element.heightBays ?? 1) * spanY, 0);
    const loadArea = loads.length * spanX * spanY;
    const totalLiveLoad = loads.reduce((sum, load) => sum + load.load * spanX * spanY, 0);
    const massPoints = [...rooms, ...loads].map((element) => ({
      x: (element.x + (element.widthBays ?? 1) / 2) * spanX,
      y: (element.y + (element.heightBays ?? 1) / 2) * spanY,
      weight: element.type === "load" ? Math.max(element.load, 1) : Math.max((element.widthBays ?? 1) * (element.heightBays ?? 1), .25),
    }));
    const massWeight = massPoints.reduce((sum, point) => sum + point.weight, 0);
    const massCenter = massPoints.length ? {
      x: massPoints.reduce((sum, point) => sum + point.x * point.weight, 0) / massWeight,
      y: massPoints.reduce((sum, point) => sum + point.y * point.weight, 0) / massWeight,
    } : { x: totalWidth / 2, y: totalDepth / 2 };
    const rigidityPoints = [
      ...columns.map((element) => ({ x: element.x * spanX, y: element.y * spanY, weight: 1 })),
      ...walls.map((element) => ({
        x: (element.x + (element.orientation === "x" ? .5 : 0)) * spanX,
        y: (element.y + (element.orientation === "y" ? .5 : 0)) * spanY,
        weight: 4,
      })),
    ];
    const rigidityWeight = rigidityPoints.reduce((sum, point) => sum + point.weight, 0);
    const rigidityCenter = rigidityPoints.length ? {
      x: rigidityPoints.reduce((sum, point) => sum + point.x * point.weight, 0) / rigidityWeight,
      y: rigidityPoints.reduce((sum, point) => sum + point.y * point.weight, 0) / rigidityWeight,
    } : { x: totalWidth / 2, y: totalDepth / 2 };
    // Without placed columns or shear walls, the geometric centre is NOT a centre of rigidity.
    const massPointCount = massPoints.length;
    const rigidityPointCount = rigidityPoints.length;
    const eccentricityEvaluable = massPointCount > 0 && rigidityPointCount > 0;
    const eccentricity = Math.hypot(massCenter.x - rigidityCenter.x, massCenter.y - rigidityCenter.y);
    const eccentricityRatio = eccentricity / Math.max(totalWidth, totalDepth) * 100;
    const conceptualMassPointCount = [...rooms, ...loads].filter((element) => element.provenance === "conceptual-seed").length;
    const conceptualRigidityPointCount = [...columns, ...walls].filter((element) => element.provenance === "conceptual-seed").length;
    const manualMassPointCount = massPointCount - conceptualMassPointCount;
    const manualRigidityPointCount = rigidityPointCount - conceptualRigidityPointCount;
    const outOfGridMassPointCount = [...rooms, ...loads].filter((element) =>
      element.x < 0 || element.y < 0 || element.x + (element.widthBays ?? 1) > baysX + .001 || element.y + (element.heightBays ?? 1) > baysY + .001
    ).length;
    const outOfGridRigidityPointCount = [...columns, ...walls].filter((element) => {
      const maxX = element.type === "wall" && element.orientation === "x" ? baysX - 1 : baysX;
      const maxY = element.type === "wall" && element.orientation === "y" ? baysY - 1 : baysY;
      return element.x < 0 || element.y < 0 || element.x > maxX || element.y > maxY;
    }).length;
    return { floorArea, roomArea, columns: columns.length, walls: walls.length, rooms: rooms.length, cores: cores.length, openings: openings.length, wallLength, openingArea, openingRatio: openingArea / Math.max(floorArea, 1) * 100, coreArea, loadArea, totalLiveLoad, massCenter, rigidityCenter, massPointCount, rigidityPointCount, conceptualMassPointCount, conceptualRigidityPointCount, manualMassPointCount, manualRigidityPointCount, outOfGridMassPointCount, outOfGridRigidityPointCount, eccentricityEvaluable, eccentricity, eccentricityRatio };
  }, [baysX, baysY, spanX, spanY, totalDepth, totalWidth, visible]);

  const allowedFootprint = thread.canonical.site.allowedFootprint;
  const footprintOverage = allowedFootprint > 0 ? Math.max(0, metrics.floorArea - allowedFootprint) : 0;
  const footprintPass = allowedFootprint > 0 && metrics.floorArea <= allowedFootprint + .01;
  const footprintScale = allowedFootprint > 0 && metrics.floorArea > 0
    ? Math.sqrt((allowedFootprint * .995) / metrics.floorArea)
    : 1;
  const suggestedSpanX = Math.max(2, Math.min(15, spanX * footprintScale));
  const suggestedSpanY = Math.max(2, Math.min(15, spanY * footprintScale));

  const programGrossTarget = thread.canonical.architecture.grossArea;
  const programFootprintTarget = floorCount > 0 && programGrossTarget > 0 ? programGrossTarget / floorCount : 0;
  const programFootprintPass = programFootprintTarget > 0
    && Math.abs(metrics.floorArea - programFootprintTarget) / programFootprintTarget <= .01;
  const programFootprintFeasible = programFootprintTarget > 0
    && (allowedFootprint <= 0 || programFootprintTarget <= allowedFootprint + .01);
  const programFootprintScale = programFootprintTarget > 0 && metrics.floorArea > 0
    ? Math.sqrt(programFootprintTarget / metrics.floorArea)
    : 1;
  const suggestedProgramSpanX = Math.max(2, Math.min(15, spanX * programFootprintScale));
  const suggestedProgramSpanY = Math.max(2, Math.min(15, spanY * programFootprintScale));
  const architectureModule = project.modules["architectural-program"] as {
    spaces?: Array<{ id?: string; code?: string; name?: string; zone?: string; count?: number; unitArea?: number; liveLoad?: number }>;
    relationships?: Array<{ id?: string; from?: string; to?: string; priority?: string; confirmed?: boolean }>;
    result?: { liveLoad?: number };
    journeyComplete?: boolean;
  } | undefined;
  const upstreamSpaces = Array.isArray(architectureModule?.spaces) ? architectureModule.spaces : [];
  const programInstances = useMemo(() => expandProgramSpaces(upstreamSpaces, Number(architectureModule?.result?.liveLoad) || 3.5), [architectureModule?.result?.liveLoad, upstreamSpaces]);
  const upstreamSpaceCount = programInstances.length;
  const expectedProgramIds = useMemo(() => new Set(programInstances.map((space) => space.key)), [programInstances]);
  const expectedProgramById = useMemo(() => new Map(programInstances.map((space) => [space.key, space])), [programInstances]);
  const allPlanSpaces = elements.filter((element) => element.type === "space");
  const linkedProgramSpaces = allPlanSpaces.filter((element) => expectedProgramIds.has(element.id));
  const manualOrUnlinkedSpaces = allPlanSpaces.filter((element) => !expectedProgramIds.has(element.id));
  const programMetadataPass = linkedProgramSpaces.every((element) => {
    const expected = expectedProgramById.get(element.id);
    if (!expected) return false;
    return element.label === expected.name
      && element.sourceSpaceId === expected.sourceSpaceId
      && element.sourceSpaceInstance === expected.sourceInstance
      && element.sourceSpaceCode === expected.code
      && Math.abs((element.sourceUnitArea ?? -1) - expected.unitArea) < .01;
  });
  const programLinkPass = upstreamSpaceCount > 0
    && linkedProgramSpaces.length === upstreamSpaceCount
    && allPlanSpaces.length === upstreamSpaceCount
    && programMetadataPass;
  const areaRepresentation = linkedProgramSpaces.map((element) => {
    const geometricArea = (element.widthBays ?? 1) * spanX * (element.heightBays ?? 1) * spanY;
    const targetArea = Math.max(element.sourceUnitArea ?? 0, .01);
    const ratio = Math.abs(geometricArea - targetArea) / targetArea;
    return { id: element.id, geometricArea, targetArea, ratio, pass: ratio <= .03 };
  });
  const areaRepresentationPass = linkedProgramSpaces.length === upstreamSpaceCount
    && areaRepresentation.every((item) => item.pass);
  const requiredAdjacency = evaluateRequiredAdjacency(
    linkedProgramSpaces,
    upstreamSpaces,
    Array.isArray(architectureModule?.relationships) ? architectureModule.relationships : [],
  );
  const requiredAdjacencyPass = requiredAdjacency.pass;
  const sourceAreaByName = new Map(upstreamSpaces.map((space) => [String(space.name ?? ""), Number(space.unitArea) || 0]));
  const requiredAdjacencyCapacityConflicts = requiredAdjacency.items.filter((item) => {
    const combined = (sourceAreaByName.get(item.from) ?? 0) + (sourceAreaByName.get(item.to) ?? 0);
    return combined > metrics.floorArea + .01;
  });
  const floorStats = Array.from({ length: floorCount }, (_, index) => {
    const floorLevel = index + 1;
    const floorElements = elements.filter((element) => element.level === floorLevel);
    return {
      level: floorLevel,
      rooms: floorElements.filter((element) => element.type === "space").length,
      linkedRooms: floorElements.filter((element) => element.type === "space" && expectedProgramIds.has(element.id)).length,
      cores: floorElements.filter((element) => element.type === "core").length,
    };
  });
  const floorCoveragePass = floorStats.every((floor) => floor.rooms > 0);
  const coreContinuityPass = floorStats.every((floor) => floor.cores > 0);
  const upstreamReady = programGrossTarget > 0 && floorCount > 0 && upstreamSpaceCount > 0;
  const planPlacementReady = programLinkPass && areaRepresentationPass && floorCoveragePass && coreContinuityPass;
  const axisReady = baysX >= 2 && baysY >= 2 && spanX >= 2 && spanY >= 2;
  const siteFootprintPass = allowedFootprint <= 0 || metrics.floorArea <= allowedFootprint + .01;
  const planGatePass = upstreamReady && planPlacementReady && axisReady && programFootprintPass && siteFootprintPass && requiredAdjacencyPass;
  const missingPlanGateItems = [
    !upstreamReady ? "Mimari veri devri" : "",
    !programLinkPass ? `Mahal programı eşleşmesi (${linkedProgramSpaces.length}/${upstreamSpaceCount})` : "",
    linkedProgramSpaces.length === upstreamSpaceCount && !programMetadataPass ? "Mahal ad / alan güncellemesi" : "",
    manualOrUnlinkedSpaces.length ? `${manualOrUnlinkedSpaces.length} bağlantısız mahal` : "",
    !areaRepresentationPass ? "Mahal alanlarının geometrik temsili" : "",
    !floorCoveragePass ? "Tüm katların planlanması" : "",
    !coreContinuityPass ? "Çekirdek sürekliliği" : "",
    !requiredAdjacencyPass ? `Zorunlu komşuluklar (${requiredAdjacency.satisfied}/${requiredAdjacency.total})` : "",
    !axisReady ? "Aks geometrisi" : "",
    !programFootprintPass ? "Program / plan alan uyumu" : "",
    !siteFootprintPass ? "TAKS taban sınırı" : "",
  ].filter(Boolean);

  const applyFootprintSuggestion = () => {
    if (!(allowedFootprint > 0) || !(metrics.floorArea > 0) || footprintPass) return;
    setSpanX(Number(suggestedSpanX.toFixed(3)));
    setSpanY(Number(suggestedSpanY.toFixed(3)));
    setStatus(`Plan taban alanı TAKS sınırına göre küçültüldü · hedef ≤ ${allowedFootprint.toFixed(1)} m²`);
  };

  const applyProgramFootprintSuggestion = () => {
    if (!programFootprintFeasible || programFootprintPass || !(metrics.floorArea > 0)) return;
    setSpanX(Number(suggestedProgramSpanX.toFixed(3)));
    setSpanY(Number(suggestedProgramSpanY.toFixed(3)));
    setStatus(`Plan tabanı mimari program brütüne göre koordine edildi · hedef ≈ ${programFootprintTarget.toFixed(1)} m²`);
  };

  const conceptualMassCells = () => {
    const lowX = Math.max(0, Math.min(baysX - 1, Math.floor((baysX - 1) * .25)));
    const lowY = Math.max(0, Math.min(baysY - 1, Math.floor((baysY - 1) * .25)));
    const highX = Math.max(0, baysX - 1 - lowX);
    const highY = Math.max(0, baysY - 1 - lowY);
    return [
      { x: lowX, y: lowY },
      { x: highX, y: lowY },
      { x: lowX, y: highY },
      { x: highX, y: highY },
    ].filter((item, index, list) => list.findIndex((other) => other.x === item.x && other.y === item.y) === index);
  };

  const conceptualRigidityNodes = () => [
    { x: 0, y: 0, label: "Temsili kolon A" },
    { x: baysX, y: 0, label: "Temsili kolon B" },
    { x: baysX, y: baysY, label: "Temsili kolon C" },
    { x: 0, y: baysY, label: "Temsili kolon D" },
  ];

  const buildConceptualKmKrElements = () => {
    const additions: PlanElement[] = [];
    conceptualRigidityNodes().forEach((item) => additions.push({
      id: createId("column", level, item.x, item.y),
      type: "column",
      level,
      x: item.x,
      y: item.y,
      orientation: "x",
      label: item.label,
      load: 0,
      fire: "R 90",
      section: "Temsili",
      provenance: "conceptual-seed",
    }));
    conceptualMassCells().forEach((item, index) => additions.push({
      id: createId("load", level, item.x, item.y),
      type: "load",
      level,
      x: item.x,
      y: item.y,
      orientation: "x",
      label: `Temsili kütle bölgesi ${index + 1}`,
      load: 5,
      fire: "Projede belirlenecek",
      section: "—",
      provenance: "conceptual-seed",
    }));
    return additions;
  };

  const createConceptualKmKrSources = () => {
    const current = elements.filter((element) => element.level === level);
    const hasRigidity = current.some((element) => element.type === "column" || element.type === "wall");
    const hasMass = current.some((element) => element.type === "space" || element.type === "load");
    if (hasRigidity && hasMass) {
      setStatus("Aktif katta KM/KR ön kontrol kaynakları zaten mevcut");
      return;
    }

    const additions: PlanElement[] = [];
    if (!hasRigidity) {
      additions.push(...buildConceptualKmKrElements().filter((element) => element.type === "column"));
    }
    if (!hasMass) {
      additions.push(...buildConceptualKmKrElements().filter((element) => element.type === "load"));
    }

    commit([...elements, ...additions], `K${level} için ${additions.length} simetrik temsilî KM/KR kaynak nesnesi oluşturuldu`);
    setView("coordination");
  };

  const canRecenterConceptualKmKr = metrics.eccentricityEvaluable
    && metrics.eccentricityRatio > 10
    && metrics.conceptualMassPointCount > 0
    && metrics.conceptualRigidityPointCount > 0
    && metrics.manualMassPointCount === 0
    && metrics.manualRigidityPointCount === 0;

  const recenterConceptualKmKrSources = () => {
    if (!canRecenterConceptualKmKr) {
      setStatus("Otomatik yeniden merkezleme yalnız tamamı temsilî olan KM/KR kaynak setlerinde kullanılabilir");
      return;
    }
    const retained = elements.filter((element) => !(
      element.level === level
      && element.provenance === "conceptual-seed"
      && (element.type === "column" || element.type === "wall" || element.type === "space" || element.type === "load")
    ));
    const rebuilt = buildConceptualKmKrElements();
    commit([...retained, ...rebuilt], `K${level} temsilî KM/KR kaynakları güncel aks geometrisine göre simetrik yeniden merkezlendi`);
    setSelectedId(null);
    setView("coordination");
  };

  const canRemapManualMassSources = metrics.outOfGridMassPointCount > 0
    && metrics.manualMassPointCount > 0;

  const canAlignConceptualRigidityToMass = metrics.eccentricityEvaluable
    && metrics.eccentricityRatio > 10
    && metrics.outOfGridMassPointCount === 0
    && metrics.manualMassPointCount > 0
    && metrics.conceptualRigidityPointCount > 0
    && metrics.manualRigidityPointCount === 0;

  const nearestBracket = (target: number, bayCount: number) => {
    let best = { low: 0, high: Math.min(1, bayCount), error: Number.POSITIVE_INFINITY };
    for (let low = 0; low < bayCount; low += 1) {
      for (let high = low + 1; high <= bayCount; high += 1) {
        const center = (low + high) / 2;
        const error = Math.abs(center - target);
        if (error < best.error) best = { low, high, error };
      }
    }
    return best;
  };

  const alignConceptualRigidityToMass = () => {
    if (!canAlignConceptualRigidityToMass) return;

    const targetGridX = spanX > 0 ? metrics.massCenter.x / spanX : baysX / 2;
    const targetGridY = spanY > 0 ? metrics.massCenter.y / spanY : baysY / 2;
    const xBracket = nearestBracket(targetGridX, baysX);
    const yBracket = nearestBracket(targetGridY, baysY);
    const nodes = [
      { x: xBracket.low, y: yBracket.low, label: "Temsili kolon A" },
      { x: xBracket.high, y: yBracket.low, label: "Temsili kolon B" },
      { x: xBracket.high, y: yBracket.high, label: "Temsili kolon C" },
      { x: xBracket.low, y: yBracket.high, label: "Temsili kolon D" },
    ];

    const retained = elements.filter((element) => !(
      element.level === level
      && element.provenance === "conceptual-seed"
      && (element.type === "column" || element.type === "wall")
    ));
    const rigidity = nodes.map((item) => ({
      id: createId("column", level, item.x, item.y),
      type: "column" as const,
      level,
      x: item.x,
      y: item.y,
      orientation: "x" as const,
      label: item.label,
      load: 0,
      fire: "R 90",
      section: "Temsili",
      provenance: "conceptual-seed" as const,
    }));

    commit(
      [...retained, ...rigidity],
      `K${level} temsilî rijitlik seti manuel kütle merkezini çevreleyen aks dikdörtgenine yerleştirildi`,
    );
    setSelectedId(null);
    setView("coordination");
  };

  const remapManualMassSourcesToCurrentGrid = () => {
    if (!canRemapManualMassSources) return;

    const activeMassSources = elements.filter((element) =>
      element.level === level
      && element.provenance !== "conceptual-seed"
      && (element.type === "space" || element.type === "load")
    );
    const sourceBaysX = Math.max(baysX, ...activeMassSources.map((element) => Math.floor(element.x) + 1));
    const sourceBaysY = Math.max(baysY, ...activeMassSources.map((element) => Math.floor(element.y) + 1));

    const remapped = elements.map((element) => {
      if (
        element.level !== level
        || element.provenance === "conceptual-seed"
        || (element.type !== "space" && element.type !== "load")
      ) return element;

      const ratioX = (element.x + .5) / Math.max(sourceBaysX, 1);
      const ratioY = (element.y + .5) / Math.max(sourceBaysY, 1);
      const x = Math.max(0, Math.min(baysX - 1, Math.floor(ratioX * baysX)));
      const y = Math.max(0, Math.min(baysY - 1, Math.floor(ratioY * baysY)));
      return { ...element, x, y };
    });

    commit(
      remapped,
      `K${level} manuel kütle kaynakları ${sourceBaysX}×${sourceBaysY} kaynak ızgarasından ${baysX}×${baysY} güncel ızgaraya oransal eşlendi`,
    );
    setSelectedId(null);
    setView("coordination");
  };

  useEffect(() => {
    if (!hydrated || !modelHydrated) return;
    patchModule("plan-editor", {
      level,
      floorCount,
      baysX,
      baysY,
      spanX,
      spanY,
      elements,
      metrics,
      journeyComplete: planGatePass,
      status: planGatePass ? "Mimari plan ve aks kontrol kapısı tamamlandı" : "Mimari plan ve aks koordinasyonu sürüyor",
    });
  }, [baysX, baysY, elements, floorCount, hydrated, level, metrics, modelHydrated, patchModule, planGatePass, spanX, spanY]);

  const commit = (next: PlanElement[], message: string) => {
    setHistory((current) => [...current.slice(-29), elements]);
    setFuture([]);
    setElements(next);
    setStatus(message);
  };

  const undo = () => {
    if (!history.length) return;
    const previous = history[history.length - 1];
    setFuture((current) => [elements, ...current].slice(0, 30));
    setHistory((current) => current.slice(0, -1));
    setElements(previous);
    setSelectedId(null);
    setStatus("Son işlem geri alındı");
  };
  const redo = () => {
    if (!future.length) return;
    const next = future[0];
    setHistory((current) => [...current, elements].slice(-30));
    setFuture((current) => current.slice(1));
    setElements(next);
    setStatus("İşlem yeniden uygulandı");
  };

  const rebuildFromArchitecturalProgram = () => {
    if (!upstreamSpaces.length) {
      setStatus("Mimari Programda geri getirilecek mahal bulunamadı");
      return;
    }
    const confirmed = window.confirm("Mimari Program kaynak kabul edilerek plandaki mahal ve çekirdek yerleşimi yeniden oluşturulacak. Mevcut manuel mahal/çekirdek yerleşimleri değiştirilecek. Devam edilsin mi?");
    if (!confirmed) return;
    const generated = buildProgramPlanElements(
      upstreamSpaces,
      baysX,
      baysY,
      floorCount,
      Number(architectureModule?.result?.liveLoad) || 3.5,
      spanX,
      spanY,
      Array.isArray(architectureModule?.relationships) ? architectureModule.relationships : [],
    ) as PlanElement[];
    const retained = elements.filter((element) => element.type !== "space" && element.type !== "core");
    commit([...retained, ...generated], `Mimari Programdan ${upstreamSpaceCount} mahal ve ${floorCount} kat çekirdeği yeniden oluşturuldu`);
    setSelectedId(null);
    setLevel(1);
  };

  const placeElement = (event: React.MouseEvent<SVGSVGElement>) => {
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const svgX = (event.clientX - rect.left) * (VIEWBOX.width / rect.width);
    const svgY = (event.clientY - rect.top) * (VIEWBOX.height / rect.height);
    const rawX = (svgX - originX) / cellW;
    const rawY = (svgY - originY) / cellH;
    if (rawX < -.2 || rawY < -.2 || rawX > baysX + .2 || rawY > baysY + .2) return;
    const x = tool === "column"
      ? Math.max(0, Math.min(baysX, Math.round(rawX)))
      : tool === "wall"
        ? Math.max(0, Math.min(orientation === "x" ? baysX - 1 : baysX, Math.round(rawX)))
        : Math.max(0, Math.min(baysX - 1, Math.floor(rawX)));
    const y = tool === "column"
      ? Math.max(0, Math.min(baysY, Math.round(rawY)))
      : tool === "wall"
        ? Math.max(0, Math.min(orientation === "y" ? baysY - 1 : baysY, Math.round(rawY)))
        : Math.max(0, Math.min(baysY - 1, Math.floor(rawY)));
    const candidates = visible.filter(showElement).filter((element) => {
      const width = element.widthBays ?? 1;
      const height = element.heightBays ?? 1;
      return rawX >= element.x && rawX <= element.x + width && rawY >= element.y && rawY <= element.y + height;
    });
    if (tool === "select") {
      setSelectedId(candidates[candidates.length - 1]?.id ?? null);
      setStatus(candidates.length ? "Nesne seçildi" : "Bu noktada düzenlenebilir nesne yok");
      return;
    }
    if (tool === "erase") {
      const target = candidates[candidates.length - 1];
      if (target) commit(elements.filter((element) => element.id !== target.id), `${toolMeta[target.type].label} silindi`);
      return;
    }
    const type = tool as PlanElement["type"];
    const duplicate = elements.find((element) => element.level === level && element.type === type && element.x === x && element.y === y && (type !== "wall" || element.orientation === orientation));
    if (duplicate) {
      setSelectedId(duplicate.id);
      setStatus("Aynı konumda bu nesne zaten var");
      return;
    }
    const element: PlanElement = {
      id: createId(type, level, x, y), type, level, x, y, orientation,
      label: type === "space" ? `Mahal ${visible.filter((item) => item.type === "space").length + 1}` : type === "core" ? "Merdiven / asansör" : type === "load" ? "Yük bölgesi" : toolMeta[type].label,
      load: type === "load" ? 5 : 3.5,
      fire: type === "core" ? "REI 120" : "R 60",
      section: type === "column" ? "50×50 cm" : type === "wall" ? "25 cm" : "—",
      widthBays: type === "column" || type === "wall" ? undefined : 1,
      heightBays: type === "column" || type === "wall" ? undefined : 1,
      provenance: "manual",
    };
    commit([...elements, element], `${toolMeta[type].label} K${level} planına eklendi`);
    setSelectedId(element.id);
  };

  const selectElement = (event: React.MouseEvent, id: string) => {
    event.stopPropagation();
    if (tool === "erase") {
      const target = elements.find((element) => element.id === id);
      commit(elements.filter((element) => element.id !== id), `${target ? toolMeta[target.type].label : "Nesne"} silindi`);
      setSelectedId(null);
    } else {
      setSelectedId(id);
      setTool("select");
      setStatus("Nesne özellikleri açıldı");
    }
  };

  const updateSelected = (patch: Partial<PlanElement>) => {
    if (!selectedId) return;
    setElements((current) => current.map((element) => element.id === selectedId ? { ...element, ...patch } : element));
  };

  const autoFrame = () => {
    const retained = elements.filter((element) => element.level !== level || element.type !== "column");
    const columns: PlanElement[] = [];
    for (let x = 0; x <= baysX; x += 1) for (let y = 0; y <= baysY; y += 1) columns.push({ id: createId("column", level, x, y), type: "column", level, x, y, orientation: "x", label: `K-${String.fromCharCode(65 + x)}${y + 1}`, load: 0, fire: "R 90", section: "50×50 cm", provenance: "manual" });
    commit([...retained, ...columns], `${columns.length} aks kolonu otomatik üretildi`);
  };

  const duplicateFloor = () => {
    if (level >= floorCount) { setStatus("Kopyalanacak üst kat bulunmuyor"); return; }
    const copies = visible.map((element) => ({ ...element, id: createId(element.type, level + 1, element.x, element.y), level: level + 1 }));
    commit([...elements.filter((element) => element.level !== level + 1), ...copies], `K${level} şeması K${level + 1} katına kopyalandı`);
    setLevel(level + 1);
  };

  const clearFloor = () => commit(elements.filter((element) => element.level !== level), `K${level} planı temizlendi`);

  const importUpstream = useCallback(() => {
    const source = thread.canonical;
    const saved = project.modules["plan-editor"] as Partial<{ floorCount: number; baysX: number; baysY: number; spanX: number; spanY: number; elements: PlanElement[] }> | undefined;
    const targetWidth = source.architecture.plateWidth || source.structure.width;
    const targetDepth = source.architecture.plateDepth || source.structure.depth;
    const nextBaysX = typeof saved?.baysX === "number" ? saved.baysX : targetWidth > 0 ? Math.max(1, Math.min(12, Math.round(targetWidth / 5))) : baysX;
    const nextBaysY = typeof saved?.baysY === "number" ? saved.baysY : targetDepth > 0 ? Math.max(1, Math.min(10, Math.round(targetDepth / 5))) : baysY;
    if (nextBaysX > 0) setBaysX(nextBaysX);
    if (nextBaysY > 0) setBaysY(nextBaysY);
    if (typeof saved?.spanX === "number") setSpanX(saved.spanX); else if (targetWidth > 0) setSpanX(Number((targetWidth / nextBaysX).toFixed(3)));
    if (typeof saved?.spanY === "number") setSpanY(saved.spanY); else if (targetDepth > 0) setSpanY(Number((targetDepth / nextBaysY).toFixed(3)));
    const nextFloorCount = typeof saved?.floorCount === "number" ? saved.floorCount : source.architecture.floors;
    if (nextFloorCount > 0) { const safeFloorCount = Math.max(1, Math.min(30, nextFloorCount)); setFloorCount(safeFloorCount); setLevel((current) => Math.min(current, safeFloorCount)); }
    if (Array.isArray(saved?.elements) && saved.elements.length) setElements(saved.elements);
    else setElements((current) => current.filter((element) => element.x <= nextBaysX && element.y <= nextBaysY));
    setStatus(Array.isArray(saved?.elements) && saved.elements.length ? "Mevcut plan korundu; Mimari Program bağlantısı güncellendi" : targetWidth > 0 || targetDepth > 0 ? "Mimari program / parsel geometrisi aks modeline aktarıldı" : "Aktarılacak mimari program veya parsel kütlesi bulunamadı");
  }, [baysX, baysY, project.modules, thread.canonical]);

  useEffect(() => {
    if (!hydrated || !project.experience.autoHandoff) return;
    const saved = project.modules["plan-editor"] as { handoff?: { synchronizedAt?: string } } | undefined;
    const synchronizedAt = saved?.handoff?.synchronizedAt ?? "";
    if (!synchronizedAt || handoffSeen.current === synchronizedAt) return;
    handoffSeen.current = synchronizedAt;
    importUpstream();
  }, [hydrated, importUpstream, project.experience.autoHandoff, project.modules]);

  const exportJson = () => downloadTextFile("arkem-plan-modeli.json", JSON.stringify({ schema: "ARKEM-PLAN/1.0", units: "m", floorCount, baysX, baysY, spanX, spanY, elements, metrics }, null, 2), "application/json");
  const exportCsv = () => {
    const content = issueFocus
      ? `type,count,quantity,unit\ncolumns,${metrics.columns},${metrics.columns},each\nwalls,${metrics.walls},${metrics.wallLength.toFixed(2)},m\nrooms,${metrics.rooms},${metrics.roomArea.toFixed(2)},m2\ncores,${metrics.cores},${metrics.coreArea.toFixed(2)},m2\nopenings,${metrics.openings},${metrics.openingArea.toFixed(2)},m2\nload_zones,${visible.filter((element) => element.type === "load").length},${metrics.totalLiveLoad.toFixed(2)},kN`
      : `type,count,quantity,unit\nfloor_area,1,${metrics.floorArea.toFixed(2)},m2\nrooms,${metrics.rooms},${metrics.roomArea.toFixed(2)},m2\ncores,${metrics.cores},${metrics.coreArea.toFixed(2)},m2\nopenings,${metrics.openings},${metrics.openingArea.toFixed(2)},m2\ngrid_x,${baysX},${spanX.toFixed(3)},m\ngrid_y,${baysY},${spanY.toFixed(3)},m`;
    downloadTextFile("arkem-plan-on-metraj.csv", content, "text/csv;charset=utf-8");
  };
  const buildPlanPolylines = () => {
    const polylines: DxfPolyline[] = [{
      layer: "ON_YAPI",
      points: [{ x: 0, y: 0 }, { x: totalWidth, y: 0 }, { x: totalWidth, y: totalDepth }, { x: 0, y: totalDepth }],
    }];
    visible.filter(showElement).forEach((element) => {
      const x = element.x * spanX;
      const y = element.y * spanY;
      const layer = element.type === "column" ? "KOLON" : element.type === "wall" ? "PERDE" : element.type === "space" ? "MAHAL" : element.type === "core" ? "CEKIRDEK" : element.type === "opening" ? "BOSLUK" : "YAZI";
      if (element.type === "column") {
        const size = Math.max(.35, Math.min(spanX, spanY) * .08);
        polylines.push({ layer, points: [{ x: x - size / 2, y: y - size / 2 }, { x: x + size / 2, y: y - size / 2 }, { x: x + size / 2, y: y + size / 2 }, { x: x - size / 2, y: y + size / 2 }] });
      } else if (element.type === "wall") {
        const thickness = .25;
        polylines.push({ layer, points: element.orientation === "x"
          ? [{ x, y: y - thickness / 2 }, { x: x + spanX, y: y - thickness / 2 }, { x: x + spanX, y: y + thickness / 2 }, { x, y: y + thickness / 2 }]
          : [{ x: x - thickness / 2, y }, { x: x + thickness / 2, y }, { x: x + thickness / 2, y: y + spanY }, { x: x - thickness / 2, y: y + spanY }] });
      } else {
        const inset = Math.min(spanX, spanY) * .05;
        const elementWidth = (element.widthBays ?? 1) * spanX;
        const elementHeight = (element.heightBays ?? 1) * spanY;
        polylines.push({ layer, points: [{ x: x + inset, y: y + inset, label: element.label }, { x: x + elementWidth - inset, y: y + inset }, { x: x + elementWidth - inset, y: y + elementHeight - inset }, { x: x + inset, y: y + elementHeight - inset }] });
      }
    });
    return polylines;
  };
  const exportDxf = () => {
    const dxf = createLayeredDxf({
      title: `ARKEM KAT PLANI / K${level}`,
      width: totalWidth,
      depth: totalDepth,
      grid: { baysX, baysY },
      polylines: buildPlanPolylines(),
      notes: [`KAT: K${level}`, `${visible.length} NESNE / ${metrics.columns} KOLON / ${metrics.walls} PERDE-DUVAR`],
      sheet: {
        projectName: project.name,
        projectCode: project.id,
        module: "ARC / PARAMETRIK PLAN",
        drawingTitle: issueFocus ? `K${level} MIMARI VE TASIYICI KURGU PLANI` : `K${level} MIMARI PLAN VE AKS KOORDINASYONU`,
        drawingNo: `ARC-${String(level).padStart(3, "0")}`,
        revision: project.revision,
        status: issueFocus ? "KAVRAMSAL BIM SEMASI" : "KAVRAMSAL MIMARI PLAN",
        coordinateSystem: project.coordinateReference,
        scale: "MODEL 1:1",
        preparedBy: "ARKEMX",
        checkedBy: "PROJEYE OZEL",
      },
    });
    downloadTextFile(`arkem-k${level}-katmanli-kat-plani.dxf`, dxf, "application/dxf");
    setStatus(`K${level} kurumsal antetli CAD paftası oluşturuldu`);
  };
  const exportPdf = async () => {
    const roleByLayer = (layer: string) => layer === "ON_YAPI" || layer === "KOLON" || layer === "PERDE"
      ? "primary" as const
      : layer === "BOSLUK"
        ? "warning" as const
        : "secondary" as const;
    const pdf = await createCorporateTechnicalPdf({
      projectName: project.name,
      projectCode: project.id,
      module: "ARKEMX / PARAMETRIK PLAN",
      drawingTitle: issueFocus ? `K${level} Mimari ve Taşıyıcı Kurgu Planı` : `K${level} Mimari Plan ve Aks Koordinasyonu`,
      drawingSubtitle: `${baysX} × ${baysY} aks / ${visible.length} nesne / ${view} görünümü`,
      revision: project.revision,
      status: "Kavramsal BIM şeması",
      sheetNo: `ARC-${String(level).padStart(3, "0")}`,
      scale: "OTOMATIK / METRE",
      coordinateSystem: project.coordinateReference,
      polylines: buildPlanPolylines().map((polyline) => ({
        points: polyline.points,
        closed: polyline.closed,
        role: roleByLayer(polyline.layer),
      })),
      metrics: [
        ["Kat alanı", `${metrics.floorArea.toFixed(1)} m²`],
        ["Aks düzeni", `${baysX} × ${baysY}`],
        ["Aks açıklığı", `${spanX.toFixed(2)} × ${spanY.toFixed(2)} m`],
        ["Kolon / perde", `${metrics.columns} / ${metrics.walls}`],
        ["Perde uzunluğu", `${metrics.wallLength.toFixed(1)} m`],
        ["Boşluk oranı", `%${metrics.openingRatio.toFixed(1)}`],
        ["KM-KR dışmerkezlik", metrics.eccentricityEvaluable ? `${metrics.eccentricity.toFixed(2)} m (kavramsal)` : "Hesaplanmadı · taşıyıcı yerleşim eksik"],
      ],
      notes: [
        `Aktif kat K${level}; model toplam ${floorCount} kat için düzenlenmektedir.`,
        "Kesit, yük ve yangın sınıfı değerleri kullanıcı girdisidir; hesap modeliyle doğrulanmalıdır.",
        "Mahal, çekirdek, boşluk ve taşıyıcı nesneler aynı proje kimliği altında kaydedilir.",
        "Bu pafta uygulama, ruhsat veya statik hesap paftası değildir.",
      ],
      legend: [["Taşıyıcı / plan sınırı", "primary"], ["Mahal / çekirdek", "secondary"], ["Boşluk / uyarı", "warning"]],
    });
    downloadTextFile(`arkem-k${level}-kurumsal-teknik-pafta.pdf`, pdf, "application/pdf");
    setStatus(`K${level} A3 kurumsal PDF paftası oluşturuldu`);
  };

  const showElement = (element: PlanElement) => {
    if (!issueFocus && (element.type === "column" || element.type === "wall" || element.type === "load")) return false;
    if (element.type === "column") return layers.columns;
    if (element.type === "wall") return layers.walls;
    if (element.type === "space" || element.type === "core") return layers.spaces;
    if (element.type === "opening") return layers.openings;
    return layers.loads;
  };

  const mainPlanTools: Tool[] = ["select", "space", "core", "opening", "erase"];
  const kmkrTools: Tool[] = ["select", "column", "wall", "space", "load", "erase"];

  return <section className={`advanced-plan-editor cad-plan-editor${issueFocus ? " cad-issue-focus" : ""}`} data-testid="advanced-plan-editor">
    {issueFocus ? <div className="cad-issue-project-strip" aria-label="Aktif proje">
      <div><span>{isKmKrFocus ? "ARKEMX / KM-KR" : isProgramAreaFocus ? "ARKEMX / ARC SYNC" : "ARKEMX / PLAN"}</span><b>{project.name}</b></div>
      <div><span>{project.phase}</span><span>{project.revision}</span></div>
    </div> : <>
      <ProjectKernelBar module="PARAMETRIC PLAN AUTHORING" confidence="Mimari plan koordinasyonu" compact={compactKernel} />
      <section className="cad-plan-handoff" data-ready={upstreamReady ? "true" : "false"}>
        <div>
          <span>01 / MİMARİDEN DEVRALINAN VERİ</span>
          <b>{upstreamReady ? "Mimari program verileri otomatik devralındı" : "Mimari program verisi bekleniyor"}</b>
          <small>Bu ekranda tekrar veri aktarımı yapmanız gerekmez. Plan ve aks çalışması aynı proje kaydını kullanır.</small>
        </div>
        <dl>
          <div><dt>Program brütü</dt><dd>{programGrossTarget > 0 ? `${programGrossTarget.toLocaleString("tr-TR", { maximumFractionDigits: 0 })} m²` : "—"}</dd></div>
          <div><dt>Kat</dt><dd>{floorCount || "—"}</dd></div>
          <div><dt>Mahal</dt><dd>{upstreamSpaceCount || "—"}</dd></div>
          <div><dt>Plaka</dt><dd>{thread.canonical.architecture.plateWidth > 0 && thread.canonical.architecture.plateDepth > 0 ? `${thread.canonical.architecture.plateWidth.toFixed(1)} × ${thread.canonical.architecture.plateDepth.toFixed(1)} m` : "—"}</dd></div>
        </dl>
      </section>
      <div className="cad-plan-flow" aria-label="Plan ve aks çalışma akışı">
        <div className={upstreamReady ? "done" : "current"}><i>{upstreamReady ? "✓" : "1"}</i><span><b>Veri devri</b><small>{upstreamReady ? "Tamamlandı" : "Bekleniyor"}</small></span></div>
        <div className={planPlacementReady ? "done" : upstreamReady ? "current" : ""}><i>{planPlacementReady ? "✓" : "2"}</i><span><b>Plan yerleşimi</b><small>{planPlacementReady ? "Mahal + çekirdek hazır" : upstreamReady ? "Şu an buradasın" : "Bekliyor"}</small></span></div>
        <div className={axisReady && programFootprintPass ? "done" : planPlacementReady ? "current" : ""}><i>{axisReady && programFootprintPass ? "✓" : "3"}</i><span><b>Aks düzeni</b><small>{axisReady && programFootprintPass ? "Alanla uyumlu" : planPlacementReady ? "Koordine et" : "Bekliyor"}</small></span></div>
        <div className={planGatePass ? "done" : axisReady && programFootprintPass ? "current" : ""}><i>{planGatePass ? "✓" : "4"}</i><span><b>Mimari kontrol</b><small>{planGatePass ? "Kontrol kapısı geçti" : axisReady && programFootprintPass ? "Son kontrol" : "Bekliyor"}</small></span></div>
      </div>
      <div className="plan-editor-head"><div><p className="eyebrow light">ARKEMX / PLAN & AKS</p><h2>Mimari planı ve aks düzenini koordine edin.</h2></div><p>Taşıyıcı sistem, yük ve KM/KR kararları bu ekranın ana akışından ayrıldı; ilgili mühendislik adımlarında ele alınır.</p></div>
    </>}
    {isTaksFocus ? <section className="cad-issue-summary" data-state={footprintPass ? "pass" : "review"}>
      <div><span>MEVCUT PLAN TABANI</span><b>{metrics.floorArea.toFixed(1)} m²</b></div>
      <div><span>{"TAKS'A GÖRE AZAMİ"}</span><b>{allowedFootprint > 0 ? `${allowedFootprint.toFixed(1)} m²` : "—"}</b></div>
      <div><span>DURUM</span><b>{allowedFootprint <= 0 ? "İmar girdisi eksik" : footprintPass ? "TAKS sınırı geçti" : `${footprintOverage.toFixed(1)} m² azaltılmalı`}</b></div>
      {!footprintPass && allowedFootprint > 0 ? <button type="button" onClick={applyFootprintSuggestion}>Oranı koruyarak önerilen ölçüleri uygula</button> : null}
    </section> : isProgramAreaFocus ? <section className="cad-issue-summary" data-state={programFootprintPass ? "pass" : "review"}>
      <div><span>MEVCUT PLAN TABANI</span><b>{metrics.floorArea.toFixed(1)} m²</b></div>
      <div><span>PROGRAMDAN HEDEF TABAN</span><b>{programFootprintTarget > 0 ? `${programFootprintTarget.toFixed(1)} m²` : "—"}</b></div>
      <div><span>DURUM</span><b>{!programFootprintFeasible ? "Hedef TAKS sınırı içinde değil" : programFootprintPass ? "Program / plan tabanı uyumlu" : `${Math.abs(programFootprintTarget - metrics.floorArea).toFixed(1)} m² fark`}</b></div>
      {programFootprintFeasible && !programFootprintPass ? <button type="button" onClick={applyProgramFootprintSuggestion}>Plan tabanını program kapasitesine getir</button> : null}
    </section> : isKmKrFocus ? <section className="cad-issue-summary cad-kmkr-summary" data-state={metrics.eccentricityEvaluable && metrics.eccentricityRatio <= 10 ? "pass" : "review"}>
      <div><span>KÜTLE KAYNAKLARI</span><b>{metrics.massPointCount}</b><small>Mahal + yük bölgesi</small></div>
      <div><span>RİJİTLİK KAYNAKLARI</span><b>{metrics.rigidityPointCount}</b><small>Kolon + perde</small></div>
      <div><span>DURUM</span><b>{!metrics.eccentricityEvaluable ? "Kaynak nesneler eksik" : metrics.eccentricityRatio > 10 ? "Dışmerkezlik göstergesi yüksek" : "KM/KR ön kontrolü hesaplanabilir"}</b></div>
      {!metrics.eccentricityEvaluable
        ? <button type="button" onClick={createConceptualKmKrSources}>Temsilî kaynak seti oluştur</button>
        : canRemapManualMassSources
          ? <button type="button" onClick={remapManualMassSourcesToCurrentGrid}>Aks dışı kütle kaynaklarını güncel plana uyarla</button>
          : canAlignConceptualRigidityToMass
            ? <button type="button" onClick={alignConceptualRigidityToMass}>Temsilî rijitlik setini KM çevresine yerleştir</button>
            : canRecenterConceptualKmKr
              ? <button type="button" onClick={recenterConceptualKmKrSources}>Temsilî kaynakları yeniden merkezle</button>
              : <div className={`cad-kmkr-complete${metrics.eccentricityRatio > 10 ? " is-warning" : ""}`}><span>{metrics.eccentricityRatio > 10 ? "YERLEŞİM İNCELEMESİ GEREKLİ" : "ÖN KONTROL HAZIR"}</span><b>{metrics.eccentricity.toFixed(2)} m · %{metrics.eccentricityRatio.toFixed(1)}</b></div>}
    </section> : null}
    <div className="cad-editor-app">
      <header className="cad-topbar"><div className="cad-project-id"><span>{isKmKrFocus ? "KM–KR / KAYNAK NESNELER" : isProgramAreaFocus ? "PROGRAM / PLAN TABANI" : isTaksFocus ? "PLAN TABANI / TAKS" : "ARKEM / CONCEPT BIM"}</span><b>{issueFocus ? `K${level} · ${totalWidth.toFixed(2)} × ${totalDepth.toFixed(2)} m · ${baysX}×${baysY} aks` : `K${level} · ${totalWidth.toFixed(2)} × ${totalDepth.toFixed(2)} m`}</b></div>{!issueFocus ? <><nav aria-label="Plan görünümü">{(["architectural","structural","loads","coordination"] as View[]).map((item) => <button key={item} className={view === item ? "active" : ""} onClick={() => setView(item)}>{item === "architectural" ? "Mimari" : item === "structural" ? "Taşıyıcı" : item === "loads" ? "Yükler" : "Koordinasyon"}</button>)}</nav><div className="cad-top-actions"><button className="cad-sync" onClick={importUpstream}>Üst veriyi aktar ↘</button><button onClick={undo} disabled={!history.length}>↶ Geri</button><button onClick={redo} disabled={!future.length}>↷ İleri</button><button onClick={exportJson}>Kaydet / JSON</button></div></> : <div className="cad-top-actions">{isKmKrFocus ? <button className="cad-sync" onClick={() => setView("coordination")}>KM/KR görünümü</button> : null}<button onClick={undo} disabled={!history.length}>↶ Geri</button><button onClick={redo} disabled={!future.length}>↷ İleri</button></div>}</header>
      <div className="cad-editor-grid">
        {!issueFocus ? <aside className="cad-plan-simple-tools">
          <strong>PLAN ARAÇLARI</strong>
          <p>Mahal, çekirdek ve döşeme boşluklarını aks hücreleri üzerinde düzenleyin.</p>
          {mainPlanTools.map((item) => <button key={item} className={tool === item ? "active" : ""} onClick={() => setTool(item)} title={toolMeta[item].hint}><i>{toolMeta[item].code}</i><span><b>{toolMeta[item].label}</b><small>{toolMeta[item].hint}</small></span></button>)}
          <div className="cad-plan-history"><button type="button" onClick={undo} disabled={!history.length} title="Son nesne işlemini geri al">← Geri al</button><button type="button" onClick={redo} disabled={!future.length} title="Geri alınan nesne işlemini yinele">Yinele →</button></div>
          <div className="cad-plan-tool-boundary"><b>Taşıyıcı araçlar ayrıldı</b><span>Kolon, perde, yük bölgesi ve KM/KR kararları Sistem ve Taşıyıcı Ön Tasarım aşamalarında ele alınacak.</span></div>
        </aside> : null}
        {!issueFocus || isKmKrFocus ? <aside className="cad-tools"><strong>{isKmKrFocus ? "KM/KR KAYNAK ARAÇLARI" : "NESNE ARAÇLARI"}</strong>{(isKmKrFocus ? kmkrTools : Object.keys(toolMeta) as Tool[]).map((item) => <button key={item} className={tool === item ? "active" : ""} onClick={() => setTool(item)} title={toolMeta[item].hint}><i>{toolMeta[item].code}</i><span><b>{toolMeta[item].label}</b><small>{toolMeta[item].hint}</small></span></button>)}<strong>YERLEŞİM YÖNÜ</strong><div className="cad-orientation"><button className={orientation === "x" ? "active" : ""} onClick={() => setOrientation("x")}>X doğrultusu →</button><button className={orientation === "y" ? "active" : ""} onClick={() => setOrientation("y")}>Y doğrultusu ↑</button></div><strong>{isKmKrFocus ? "ÖN KONTROL KAYNAĞI" : "HIZLI ÜRETİM"}</strong>{isKmKrFocus ? <><button className="cad-command" onClick={createConceptualKmKrSources}>Temsilî kaynak seti oluştur</button>{canRemapManualMassSources ? <button className="cad-command" onClick={remapManualMassSourcesToCurrentGrid}>Aks dışı kütle kaynaklarını güncel plana uyarla</button> : null}{canAlignConceptualRigidityToMass ? <button className="cad-command" onClick={alignConceptualRigidityToMass}>Temsilî rijitlik setini KM çevresine yerleştir</button> : null}{canRecenterConceptualKmKr ? <button className="cad-command" onClick={recenterConceptualKmKrSources}>Temsilî kaynakları yeniden merkezle</button> : null}<small className="cad-kmkr-tool-note">Aks dışı manuel kütle kaynakları yalnız açık kullanıcı aksiyonuyla güncel aks ızgarasına oransal eşlenir. Manuel kütle + temsilî rijitlik durumunda yalnız temsilî rijitlik seti KM çevresindeki akslara taşınabilir. Bu işlemler taşıyıcı tasarım yerine geçmez.</small></> : <><button className="cad-command" onClick={autoFrame}>Tüm akslara kolon yerleştir</button><button className="cad-command" onClick={duplicateFloor}>Aktif katı üst kata kopyala</button><button className="cad-command danger" onClick={clearFloor}>Aktif katı temizle</button></>}</aside> : null}
        <main className={`cad-canvas view-${view}`}>
          <div className="cad-canvas-toolbar">{isKmKrFocus ? <><span>KM/KR KAYNAK YERLEŞİMİ</span><div><b>{toolMeta[tool].label.toUpperCase()}</b><small>{modelHydrated ? status : "Plan kaydı yükleniyor…"}</small></div><span>K{level} · KUZEY ↑</span></> : isPlanGeometryFocus ? <><span>{isProgramAreaFocus ? "PROGRAM / PLAN TABAN KOORDİNASYONU" : "PLAN ÖNİZLEMESİ"}</span><div><b>KAYITLI AKS GEOMETRİSİ</b><small>{modelHydrated ? status : "Plan kaydı yükleniyor…"}</small></div><span>KUZEY ↑</span></> : <><span>SNAP · AKS / HÜCRE</span><div><b>{toolMeta[tool].label.toUpperCase()}</b><small>{status}</small></div><span>KUZEY ↑</span></>}</div>
          <svg ref={svgRef} viewBox={`0 0 ${VIEWBOX.width} ${VIEWBOX.height}`} onClick={placeElement} aria-label={`K${level} nesne tabanlı teknik plan editörü`} role="application">
            <defs><pattern id="plan-dot-grid" width="12" height="12" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r=".7" fill="#94a9b2" opacity=".42"/></pattern><pattern id="core-hatch" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="8" stroke="#829aa4" strokeWidth="2"/></pattern><pattern id="opening-hatch" width="9" height="9" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="9" stroke="#b96636" strokeWidth="1" opacity=".6"/></pattern></defs>
            <rect width={VIEWBOX.width} height={VIEWBOX.height} fill="url(#plan-dot-grid)"/>
            <rect x={originX} y={originY} width={totalWidth * scale} height={totalDepth * scale} fill="#fbfcfb" stroke="#718993" strokeWidth="1.4"/>
            {Array.from({ length: baysX + 1 }, (_, index) => <g key={`x-${index}`}><line x1={originX + index * cellW} y1={originY - 28} x2={originX + index * cellW} y2={originY + totalDepth * scale + 28} stroke="#86a0aa" strokeWidth=".75" strokeDasharray="5 4"/><circle cx={originX + index * cellW} cy={originY - 42} r="13" fill="#f7f9f8" stroke="#b96636"/><text x={originX + index * cellW} y={originY - 38.5} textAnchor="middle" fontSize="9" fill="#173243">{String.fromCharCode(65 + index)}</text></g>)}
            {Array.from({ length: baysY + 1 }, (_, index) => <g key={`y-${index}`}><line x1={originX - 28} y1={originY + index * cellH} x2={originX + totalWidth * scale + 28} y2={originY + index * cellH} stroke="#86a0aa" strokeWidth=".75" strokeDasharray="5 4"/><circle cx={originX - 42} cy={originY + index * cellH} r="13" fill="#f7f9f8" stroke="#b96636"/><text x={originX - 42} y={originY + index * cellH + 3.5} textAnchor="middle" fontSize="9" fill="#173243">{index + 1}</text></g>)}
            {visible.filter(showElement).map((element) => {
              const x = originX + element.x * cellW;
              const y = originY + element.y * cellH;
              const selectedClass = element.id === selectedId ? " selected" : "";
              if (element.type === "column") return <g className={`cad-element column${selectedClass}`} key={element.id} onClick={(event) => selectElement(event, element.id)}><rect x={x - 6} y={y - 6} width="12" height="12"/><text x={x + 9} y={y - 8}>{element.label}</text></g>;
              if (element.type === "wall") return <g className={`cad-element wall${selectedClass}`} key={element.id} onClick={(event) => selectElement(event, element.id)}><line x1={x} y1={y} x2={x + (element.orientation === "x" ? cellW : 0)} y2={y + (element.orientation === "y" ? cellH : 0)}/></g>;
              const fill = element.type === "core" ? "url(#core-hatch)" : element.type === "opening" ? "url(#opening-hatch)" : element.type === "load" ? "rgba(185,102,54,.22)" : view === "loads" ? `rgba(45,126,157,${Math.min(.56, .12 + element.load / 20)})` : "rgba(107,161,180,.11)";
              const elementWidth = (element.widthBays ?? 1) * cellW;
              const elementHeight = (element.heightBays ?? 1) * cellH;
              const centerX = x + elementWidth / 2;
              const centerY = y + elementHeight / 2;
              const sourceArea = typeof element.sourceUnitArea === "number" ? element.sourceUnitArea : 0;
              const geometricArea = (element.widthBays ?? 1) * spanX * (element.heightBays ?? 1) * spanY;
              return <g className={`cad-element cell ${element.type}${selectedClass}`} key={element.id} onClick={(event) => selectElement(event, element.id)}><rect x={x + 3} y={y + 3} width={Math.max(8, elementWidth - 6)} height={Math.max(8, elementHeight - 6)} fill={fill}/><text x={centerX} y={centerY - 4} textAnchor="middle">{element.label}</text><text className="sub" x={centerX} y={centerY + 11} textAnchor="middle">{element.type === "load" || view === "loads" ? `${element.load.toFixed(1)} kN/m²` : element.type === "space" && expectedProgramIds.has(element.id) ? [element.sourceSpaceCode, sourceArea > 0 ? `${sourceArea.toLocaleString("tr-TR", { maximumFractionDigits: 1 })} m²` : "", sourceArea > 0 ? `plan ${geometricArea.toLocaleString("tr-TR", { maximumFractionDigits: 1 })} m²` : ""].filter(Boolean).join(" · ") : element.type.toUpperCase()}</text></g>;
            })}
            {view === "coordination" && metrics.eccentricityEvaluable && <g className="cad-centers"><line x1={originX + metrics.massCenter.x * scale} y1={originY} x2={originX + metrics.massCenter.x * scale} y2={originY + totalDepth * scale}/><line x1={originX} y1={originY + metrics.massCenter.y * scale} x2={originX + totalWidth * scale} y2={originY + metrics.massCenter.y * scale}/><circle className="mass" cx={originX + metrics.massCenter.x * scale} cy={originY + metrics.massCenter.y * scale} r="8"/><circle className="rigidity" cx={originX + metrics.rigidityCenter.x * scale} cy={originY + metrics.rigidityCenter.y * scale} r="8"/><text x={originX + metrics.massCenter.x * scale + 12} y={originY + metrics.massCenter.y * scale - 12}>KM</text><text x={originX + metrics.rigidityCenter.x * scale + 12} y={originY + metrics.rigidityCenter.y * scale + 19}>KR</text></g>}
            <text x={originX} y={VIEWBOX.height - 20} fill="#71858d" fontSize="9">K{level} · {totalWidth.toFixed(2)} × {totalDepth.toFixed(2)} m · Aks {baysX}×{baysY} · Ölçek ekran uyarlamalı</text>
          </svg>
          <div className="cad-statusbar"><span>SNAP: AKS / HÜCRE</span><span>{visible.filter(showElement).length} mimari nesne · K{level}/{floorCount}</span><span>ARKEM-PLAN/1.0</span></div>
        </main>
        {!issueFocus ? <aside className="cad-plan-simple-inspector">
          <section>
            <strong>AKTİF KAT</strong>
            <div className="cad-floor-tabs">{Array.from({ length: floorCount }, (_, index) => <button key={index + 1} className={level === index + 1 ? "active" : ""} onClick={() => { setLevel(index + 1); setSelectedId(null); }}>K{index + 1}</button>)}</div>
            <p>{floorCount} kat Mimari Programdan devralındı. Kat sayısı burada değiştirilmez.</p>
          </section>
          <section>
            <strong>AKS DÜZENİ</strong>
            <div className="cad-input-grid">
              <label>X aks sayısı<input type="number" min="2" max="16" value={baysX} onChange={(event) => setBaysX(Math.max(2, Math.min(16, Number(event.target.value))))}/></label>
              <label>Y aks sayısı<input type="number" min="2" max="16" value={baysY} onChange={(event) => setBaysY(Math.max(2, Math.min(16, Number(event.target.value))))}/></label>
              <label>X açıklığı<input type="number" min="2" max="15" step=".1" value={spanX} onChange={(event) => setSpanX(Math.max(2, Math.min(15, Number(event.target.value))))}/><i>m</i></label>
              <label>Y açıklığı<input type="number" min="2" max="15" step=".1" value={spanY} onChange={(event) => setSpanY(Math.max(2, Math.min(15, Number(event.target.value))))}/><i>m</i></label>
            </div>
          </section>
          <section className="cad-plan-control">
            <strong>MİMARİ KONTROL</strong>
            <div><span>Plan tabanı</span><b>{metrics.floorArea.toFixed(1)} m²</b></div>
            <div><span>Programdan hedef</span><b>{programFootprintTarget > 0 ? `${programFootprintTarget.toFixed(1)} m²` : "—"}</b></div>
            <div><span>TAKS azami taban</span><b>{allowedFootprint > 0 ? `${allowedFootprint.toFixed(1)} m²` : "Bilgi yok"}</b></div>
            <div><span>Aktif kat · Mahal / çekirdek</span><b>{metrics.rooms} / {metrics.cores}</b></div>
            <div><span>Aktif kat · Net mahal alanı</span><b>{metrics.roomArea.toFixed(1)} m²</b></div>
            <div><span>Tüm proje · Mahal</span><b className={programLinkPass ? "good" : "watch"}>{allPlanSpaces.length} / {upstreamSpaceCount}</b></div>
            <div><span>Çekirdek sürekliliği</span><b className={coreContinuityPass ? "good" : "watch"}>{floorStats.filter((floor) => floor.cores > 0).length} / {floorCount} kat</b></div>
            <div><span>Alan temsili</span><b className={areaRepresentationPass ? "good" : "watch"}>{areaRepresentation.filter((item) => item.pass).length} / {upstreamSpaceCount}</b></div>
            <div><span>Zorunlu komşuluk</span><b className={requiredAdjacencyPass ? "good" : "watch"}>{requiredAdjacency.satisfied} / {requiredAdjacency.total}</b></div>
            <div><span>Program bağlantısı</span><b className={programLinkPass ? "good" : "watch"}>{programLinkPass ? "Güncel" : "Eşleştirilmeli"}</b></div>
            <div><span>Kontrol kapısı</span><b className={planGatePass ? "good" : "watch"}>{planGatePass ? "Geçti" : "Açık"}</b></div>
            {!programFootprintPass && programFootprintFeasible ? <button type="button" onClick={applyProgramFootprintSuggestion}>Plan tabanını programa uyarla</button> : null}
          </section>
          <section className="cad-program-link" data-state={programLinkPass && coreContinuityPass && areaRepresentationPass && requiredAdjacencyPass ? "pass" : "review"}>
            <strong>MİMARİ PROGRAM BAĞLANTISI</strong>
            <p>Mimari Programdaki mahal listesi kaynak kayıttır. Plan üzerinde mahal silinirse veya program sonradan değiştirilirse burada fark görünür.</p>
            <div><span>Kaynak program</span><b>{upstreamSpaceCount} mahal</b></div>
            <div><span>Planda bağlı</span><b>{linkedProgramSpaces.length} mahal</b></div>
            <div><span>Bağlantısız / manuel</span><b>{manualOrUnlinkedSpaces.length}</b></div>
            {floorStats.map((floor) => <div key={floor.level}><span>K{floor.level}</span><b>{floor.rooms} mahal · {floor.cores} çekirdek</b></div>)}
            <div><span>Alan temsili</span><b>{areaRepresentation.filter((item) => item.pass).length}/{upstreamSpaceCount} mahal</b></div>
            <div><span>Zorunlu komşuluk</span><b>{requiredAdjacency.satisfied}/{requiredAdjacency.total}</b></div>
            {requiredAdjacency.items.filter((item) => !item.satisfied).map((item) => <div className="cad-program-relation-risk" key={item.id}><span>{item.from} ↔ {item.to}</span><b>{requiredAdjacencyCapacityConflicts.some((conflict) => conflict.id === item.id) ? "Mevcut katta alan olarak mümkün değil" : "Aynı katta temas etmiyor"}</b></div>)}
            {(!programLinkPass || !coreContinuityPass || !floorCoveragePass || !areaRepresentationPass) ? <button type="button" onClick={rebuildFromArchitecturalProgram}>Mimari Programdan Yeniden Kur</button> : <small>Plan mahal listesi ve alan temsili güncel Mimari Programla bağlı.</small>}
            {!requiredAdjacencyPass ? <p className="cad-program-adjacency-note">{requiredAdjacencyCapacityConflicts.length ? `${requiredAdjacencyCapacityConflicts.length} zorunlu ilişki mevcut kat brüt alanından daha büyük birleşik mahal alanı istiyor. Kat/plaka veya program kararı yeniden ele alınmalı.` : "Zorunlu komşuluk aynı katta fiziksel temas gerektirir. Yerleşimi düzenleyin veya Mimari Program kararını yeniden ele alın."}</p> : null}
            <Link className="cad-program-edit-link" href="/mimari-program-studyosu">Mimari Programı Düzenle →</Link>
          </section>
          <section className="cad-properties">
            <strong>SEÇİLİ NESNE</strong>
            {selected && (selected.type === "space" || selected.type === "core" || selected.type === "opening") ? <>
              <div className="cad-selected-type"><i>{toolMeta[selected.type].code}</i><span><b>{toolMeta[selected.type].label}</b><small>{selected.type === "space" ? "Mimari mahal" : selected.type === "core" ? "Düşey sirkülasyon" : "Döşeme boşluğu"}</small></span></div>
              {selected.type === "space" && expectedProgramIds.has(selected.id) ? <div className="cad-program-source-field"><span>Program mahali</span><b>{selected.label}</b><small>{selected.sourceSpaceCode ? `${selected.sourceSpaceCode} · ` : ""}{typeof selected.sourceUnitArea === "number" ? `Hedef ${selected.sourceUnitArea.toLocaleString("tr-TR", { maximumFractionDigits: 2 })} m² · ` : ""}Plan ${(((selected.widthBays ?? 1) * spanX * (selected.heightBays ?? 1) * spanY)).toLocaleString("tr-TR", { maximumFractionDigits: 2 })} m². Ad / hedef alan değişikliği Mimari Programdan yapılır.</small></div> : <label>Etiket<input value={selected.label} onChange={(event) => updateSelected({ label: event.target.value })}/></label>}
              <button className="cad-delete-selected" onClick={() => { commit(elements.filter((element) => element.id !== selected.id), "Seçili mimari nesne silindi"); setSelectedId(null); }}>Seçili nesneyi sil</button>
            </> : <p>Plan üzerinde bir mahal, çekirdek veya boşluk seçin. Taşıyıcı özellikler bu aşamada düzenlenmez.</p>}
          </section>
          <details className="cad-plan-exports">
            <summary>Teknik çıktılar</summary>
            <div className="cad-export"><button onClick={exportPdf}>PDF<span>Kavramsal plan paftası</span></button><button onClick={exportDxf}>CAD<span>Katmanlı DXF</span></button><button onClick={exportJson}>JSON<span>Plan modeli</span></button><button onClick={exportCsv}>CSV<span>Ön metraj</span></button></div>
          </details>
        </aside> : null}
        <aside className="cad-inspector">
          {isKmKrFocus ? <>
            <section><strong>AKTİF KAT</strong><div className="cad-floor-tabs">{Array.from({ length: floorCount }, (_, index) => <button key={index + 1} className={level === index + 1 ? "active" : ""} onClick={() => { setLevel(index + 1); setSelectedId(null); setView("coordination"); }}>K{index + 1}</button>)}</div><p className="cad-issue-scope-note">BIM-052 / BIM-053 yalnız aktif kattaki KM/KR kaynak yeterliliği ve kavramsal merkez göstergesini düzenler; aks geometrisi ve kat adedi bu ekranda değiştirilmez.</p></section>
            <section className="cad-kmkr-control"><strong>KM/KR KAYNAK DURUMU</strong><div><span>Kütle kaynağı</span><b className={metrics.massPointCount > 0 ? "good" : "risk"}>{metrics.massPointCount} nokta</b></div><div><span>Rijitlik kaynağı</span><b className={metrics.rigidityPointCount > 0 ? "good" : "risk"}>{metrics.rigidityPointCount} nokta</b></div><div><span>Aks sınırı dışı kaynak</span><b className={metrics.outOfGridMassPointCount + metrics.outOfGridRigidityPointCount > 0 ? "risk" : "good"}>{metrics.outOfGridMassPointCount + metrics.outOfGridRigidityPointCount} nokta</b></div><div><span>KM–KR dışmerkezlik</span><b className={!metrics.eccentricityEvaluable ? "watch" : metrics.eccentricityRatio > 10 ? "risk" : metrics.eccentricityRatio > 5 ? "watch" : "good"}>{metrics.eccentricityEvaluable ? `${metrics.eccentricity.toFixed(2)} m · %${metrics.eccentricityRatio.toFixed(1)}` : "Hesaplanamaz"}</b></div><small>{metrics.outOfGridMassPointCount + metrics.outOfGridRigidityPointCount > 0 ? "Bazı kaynak nesneleri önceki aks geometrisinden kalmış olabilir. Önce güncel aks ızgarasına koordine edin; ardından KM–KR göstergesini yeniden değerlendirin." : metrics.eccentricityEvaluable ? "Bu değer tanımlı temsilî/manuel kaynak nesnelerinden türeyen kavramsal göstergedir; deprem düzensizlik hesabı değildir." : "En az bir kütle kaynağı ile bir rijitlik kaynağı gerekir. Geometrik plaka merkezi KR kabul edilmez."}</small></section>
            <section className="cad-kmkr-provenance"><strong>KAYNAK NİTELİĞİ</strong><div><span>Temsilî kütle nesnesi</span><b>{metrics.conceptualMassPointCount}</b></div><div><span>Temsilî rijitlik nesnesi</span><b>{metrics.conceptualRigidityPointCount}</b></div><div><span>Manuel kütle nesnesi</span><b>{metrics.manualMassPointCount}</b></div><div><span>Manuel rijitlik nesnesi</span><b>{metrics.manualRigidityPointCount}</b></div><small>Temsilî kaynaklar yeniden konumlandırılabilir. Manuel kütle kaynakları yalnız aks sınırı dışında kaldıklarında açık kullanıcı komutuyla güncel ızgaraya eşlenir; manuel kütle verisi korunurken temsilî rijitlik seti KM çevresindeki akslara taşınabilir.</small></section>
            <section className="cad-properties"><strong>NESNE ÖZELLİKLERİ</strong>{selected ? <><div className="cad-selected-type"><i>{toolMeta[selected.type].code}</i><span><b>{toolMeta[selected.type].label}</b><small>{selected.provenance === "conceptual-seed" ? "Temsilî kaynak" : "Manuel kaynak"}</small></span></div><label>Etiket<input value={selected.label} onChange={(event) => updateSelected({ label: event.target.value })}/></label>{selected.type === "load" || selected.type === "space" ? <label>Hareketli yük<input type="number" min="0" max="25" step=".5" value={selected.load} onChange={(event) => updateSelected({ load: Number(event.target.value) })}/><i>kN/m²</i></label> : null}<button className="cad-delete-selected" onClick={() => { commit(elements.filter((element) => element.id !== selected.id), "Seçili kaynak nesnesi silindi"); setSelectedId(null); }}>Seçili nesneyi sil</button></> : <p>Plan üzerinde kolon/perde veya mahal/yük bölgesi seçin; gerekirse yeni kaynak nesnesi yerleştirin.</p>}</section>
          </> : <>
            <section><strong>{isPlanGeometryFocus ? "PLAN GEOMETRİSİ" : "KAT & AKS YÖNETİMİ"}</strong>{!isPlanGeometryFocus ? <><div className="cad-floor-tabs">{Array.from({ length: floorCount }, (_, index) => <button key={index + 1} className={level === index + 1 ? "active" : ""} onClick={() => { setLevel(index + 1); setSelectedId(null); }}>K{index + 1}</button>)}</div><label>Kat adedi<input type="number" min="1" max="30" value={floorCount} onChange={(event) => { const count = Math.max(1, Math.min(30, Number(event.target.value))); setFloorCount(count); setLevel((current) => Math.min(current, count)); }}/></label></> : <p className="cad-issue-scope-note">{isProgramAreaFocus ? "ARC-021 plan seçeneği yalnız taban geometrisini program brütüne göre koordine eder. Kat adedi ve imar girdileri burada değiştirilmez." : "PLN-011 yalnız taban geometrisini düzenler. Kat adedi bu ekranda değiştirilmez."}</p>}<div className="cad-input-grid"><label>X aks sayısı<input type="number" min="1" max="16" value={baysX} onChange={(event) => setBaysX(Math.max(1, Math.min(16, Number(event.target.value))))}/></label><label>Y aks sayısı<input type="number" min="1" max="16" value={baysY} onChange={(event) => setBaysY(Math.max(1, Math.min(16, Number(event.target.value))))}/></label><label>X açıklığı<input type="number" min="2" max="15" step=".1" value={spanX} onChange={(event) => setSpanX(Math.max(2, Math.min(15, Number(event.target.value))))}/><i>m</i></label><label>Y açıklığı<input type="number" min="2" max="15" step=".1" value={spanY} onChange={(event) => setSpanY(Math.max(2, Math.min(15, Number(event.target.value))))}/><i>m</i></label></div></section>
            {isTaksFocus ? <section className="cad-footprint-control"><strong>TAKS ÖN KONTROLÜ</strong><div><span>Plan tabanı</span><b>{metrics.floorArea.toFixed(1)} m²</b></div><div><span>Azami taban</span><b>{allowedFootprint > 0 ? `${allowedFootprint.toFixed(1)} m²` : "—"}</b></div><div><span>Fark</span><b className={footprintPass ? "good" : "risk"}>{allowedFootprint > 0 ? `${(metrics.floorArea - allowedFootprint).toFixed(1)} m²` : "—"}</b></div><small>TAKS girdisi değiştirilmez. X/Y açıklık sayısı ve açıklık ölçülerini düzenleyerek plan tabanını sınır içine alın.</small></section> : isProgramAreaFocus ? <section className="cad-footprint-control"><strong>PROGRAM / PLAN ÖN KONTROLÜ</strong><div><span>Program brütü</span><b>{programGrossTarget > 0 ? `${programGrossTarget.toFixed(1)} m²` : "—"}</b></div><div><span>2B hedef taban</span><b>{programFootprintTarget > 0 ? `${programFootprintTarget.toFixed(1)} m²` : "—"}</b></div><div><span>TAKS azami taban</span><b>{allowedFootprint > 0 ? `${allowedFootprint.toFixed(1)} m²` : "—"}</b></div><small>{programFootprintFeasible ? "Programın mevcut kat adedindeki hedef tabanı TAKS sınırı içindedir. Plan oranı korunarak ölçeklenebilir." : "Program hedefi mevcut kat adedinde TAKS sınırını aşıyor; program veya kat/yükseklik kararı ayrıca ele alınmalıdır."}</small></section> : <>
              <section><strong>KATMANLAR</strong>{Object.entries(layers).map(([key, value]) => <label className="cad-layer" key={key}><input type="checkbox" checked={value} onChange={(event) => setLayers((current) => ({ ...current, [key]: event.target.checked }))}/><span>{key === "columns" ? "Kolonlar" : key === "walls" ? "Perde / duvar" : key === "spaces" ? "Mahal / çekirdek" : key === "openings" ? "Boşluklar" : "Yük bölgeleri"}</span><b>{value ? "AÇIK" : "KAPALI"}</b></label>)}</section>
              <section className="cad-properties"><strong>NESNE ÖZELLİKLERİ</strong>{selected ? <><div className="cad-selected-type"><i>{toolMeta[selected.type].code}</i><span><b>{toolMeta[selected.type].label}</b><small>{selected.id.slice(0, 18)}</small></span></div><label>Etiket<input value={selected.label} onChange={(event) => updateSelected({ label: event.target.value })}/></label><label>Hareketli yük<input type="number" min="0" max="25" step=".5" value={selected.load} onChange={(event) => updateSelected({ load: Number(event.target.value) })}/><i>kN/m²</i></label><label>Yangın sınıfı<select value={selected.fire} onChange={(event) => updateSelected({ fire: event.target.value })}>{["R 30","R 60","R 90","REI 120","Projede belirlenecek"].map((value) => <option key={value}>{value}</option>)}</select></label><label>Ön kesit<input value={selected.section} onChange={(event) => updateSelected({ section: event.target.value })}/></label><button className="cad-delete-selected" onClick={() => { commit(elements.filter((element) => element.id !== selected.id), "Seçili nesne silindi"); setSelectedId(null); }}>Seçili nesneyi sil</button></> : <p>Plan üzerinde bir nesne seçin veya yerleştirme aracıyla yeni nesne oluşturun.</p>}</section>
              <section className="cad-metrics"><strong>MODEL KONTROLÜ</strong><div><span>Kat alanı</span><b>{metrics.floorArea.toFixed(1)} m²</b></div><div><span>Kolon / perde</span><b>{metrics.columns} / {metrics.walls}</b></div><div><span>Perde uzunluğu</span><b>{metrics.wallLength.toFixed(1)} m</b></div><div><span>Boşluk oranı</span><b className={metrics.openingRatio > 25 ? "risk" : ""}>%{metrics.openingRatio.toFixed(1)}</b></div><div><span>KM–KR dışmerkezlik</span><b className={!metrics.eccentricityEvaluable ? "watch" : metrics.eccentricityRatio > 10 ? "risk" : metrics.eccentricityRatio > 5 ? "watch" : "good"}>{metrics.eccentricityEvaluable ? `${metrics.eccentricity.toFixed(2)} m` : "Veri eksik"}</b></div><small>{metrics.eccentricityEvaluable ? "Tanımlı mahal ve taşıyıcı nesnelere bağlı kavramsal merkez göstergesidir; deprem düzensizlik hesabı değildir." : "Kütle ve taşıyıcı rijitlik merkezi birlikte tanımlanmadan KM–KR dışmerkezliği hesaplanamaz. Otomatik çizilen geometrik merkez KR değildir."}</small></section>
              <section><strong>TEKNİK ÇIKTI</strong><div className="cad-export"><button onClick={exportPdf}>PDF<span>A3 kurumsal pafta</span></button><button onClick={exportDxf}>CAD<span>DWG uyumlu DXF</span></button><button onClick={exportJson}>JSON<span>Model verisi</span></button><button onClick={exportCsv}>CSV<span>Ön metraj</span></button></div></section>
            </>}
          </>}
        </aside>
      </div>
      <footer className="cad-editor-foot"><b>{issueFocus ? "Model statüsü · Konsept" : "Plan & Aks statüsü · Mimari koordinasyon"}</b><p>{issueFocus ? "Bu editör nesne yerleşimi, veri hazırlığı ve disiplinler arası karar kaydı içindir. Mimari uygulama projesi, statik analiz modeli, yangın projesi veya ruhsat paftası değildir." : "Bu çalışma mimari mahal, çekirdek, boşluk ve aks koordinasyonu içindir. Taşıyıcı sistem, kesit, yük ve KM/KR kararları sonraki mühendislik aşamalarında doğrulanır."}</p></footer>
    </div>
    {!issueFocus ? <section className="cad-plan-completion" data-state={planGatePass ? "pass" : "review"}>
      <div><span>04 / MİMARİ TAMAMLAMA KAPISI</span><b>{planGatePass ? "Plan ve aks çalışması tamamlandı" : "Plan ve aks çalışması henüz tamamlanmadı"}</b><small>{planGatePass ? "Mimari adımı kapanabilir. Sıradaki ana proje adımı Sistem seçimidir." : `Bekleyen: ${missingPlanGateItems.join(" · ") || "Kontroller güncelleniyor"}`}</small></div>
      {planGatePass ? <Link href="/sistem-karsilastirma">Sistem ve Yöntemi Seç <i>→</i></Link> : null}
    </section> : null}
  </section>;
}
