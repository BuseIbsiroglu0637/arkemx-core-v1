"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createLayeredDxf, downloadTextFile, type DxfPolyline } from "../lib/engineering";
import { createCorporateTechnicalPdf } from "../lib/technical-sheet";
import Link from "next/link";
import { DEMO_ENABLED } from "../lib/demo";
import { planProgramSync } from "../lib/plan-program-sync";
import { planFloorLayout } from "../lib/plan-floor-layout";
import { createMeasuredPlan, measuredCurrent, type RoomGeometry, type CorridorGeometry } from "../lib/measured-plan";
import { MeasuredRoom, MeasuredCorridor } from "./MeasuredPlanLayer";
import { MeasuredCoreDoor } from "./MeasuredCoreDoor";
import { planCellBounds, planCellConflicts, PLAN_LOCAL_CRS } from "../lib/plan-geometry";
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
  sourceSpaceId?: string;
  roomWidth?: number; doorWidth?: number; roomGeometry?: RoomGeometry; corridorGeometry?: CorridorGeometry;
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

export function AdvancedPlanEditor() {
  const { project, hydrated } = useProjectKernel();
  if (!hydrated) return <p role="status">Plan kaydı yükleniyor…</p>;
  return <ScopedPlanEditor key={project.id}/>;
}
function ScopedPlanEditor() {
  const svgRef = useRef<SVGSVGElement>(null);
  const transferApplied = useRef(false);
  const propertyEditStarted = useRef(false);
  const handoffSeen = useRef("");
  const [loaded, setLoaded] = useState(false);
  const { patchModule, thread, project, hydrated } = useProjectKernel();
  const [tool, setTool] = useState<Tool>("select");
  const [view, setView] = useState<View>(DEMO_ENABLED ? "architectural" : "structural");
  const [level, setLevel] = useState(1);
  const [floorCount, setFloorCount] = useState(4);
  const [baysX, setBaysX] = useState(6);
  const [baysY, setBaysY] = useState(5);
  const [spanX, setSpanX] = useState(4.5);
  const [spanY, setSpanY] = useState(4.2);
  const [corridorWidth, setCorridorWidth] = useState(1.2);
  const [orientation, setOrientation] = useState<"x" | "y">("x");
  const [elements, setElements] = useState<PlanElement[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [history, setHistory] = useState<PlanElement[][]>([]);
  const [future, setFuture] = useState<PlanElement[][]>([]);
  const [status, setStatus] = useState("Yeni proje şeması hazır");
  const [layers, setLayers] = useState({ columns: true, walls: true, spaces: true, openings: true, loads: true });

  useEffect(() => {
    if (!hydrated || transferApplied.current) return;
    const timer = window.setTimeout(() => {
    transferApplied.current = true;
    const saved = project.modules["plan-editor"] as Partial<{ level: number; floorCount: number; baysX: number; baysY: number; spanX: number; spanY: number; corridorWidth: number; elements: PlanElement[] }> | undefined;
    if (saved) {
      if (typeof saved.level === "number") setLevel(saved.level);
      if (typeof saved.floorCount === "number") setFloorCount(saved.floorCount);
      if (typeof saved.baysX === "number") setBaysX(saved.baysX);
      if (typeof saved.baysY === "number") setBaysY(saved.baysY);
      if (typeof saved.spanX === "number") setSpanX(saved.spanX);
      if (typeof saved.spanY === "number") setSpanY(saved.spanY);
      if (typeof saved.corridorWidth === "number") setCorridorWidth(saved.corridorWidth);
      if (Array.isArray(saved.elements)) setElements(saved.elements);
      setStatus("Kayıtlı plan ve nesneler otomatik açıldı");
      setLoaded(true);
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
    setLoaded(true);
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

  const measuredGrid = useMemo(() => ({ floors: floorCount, baysX, baysY, spanX, spanY, corridorWidth }), [floorCount, baysX, baysY, spanX, spanY, corridorWidth]);
  const measuredProposal = useMemo(() => createMeasuredPlan(elements, project.modules["architectural-program"], measuredGrid), [elements, project.modules, measuredGrid]);
  const measuredReady = measuredCurrent(elements, project.modules["architectural-program"], measuredGrid);
  const hasMeasured = elements.some(e => e.roomGeometry);
  const metrics = useMemo(() => {
    const floorArea = totalWidth * totalDepth;
    const columns = visible.filter((element) => element.type === "column");
    const walls = visible.filter((element) => element.type === "wall");
    const rooms = visible.filter((element) => element.type === "space");
    const cores = visible.filter((element) => element.type === "core");
    const openings = visible.filter((element) => element.type === "opening");
    const loads = visible.filter((element) => element.type === "load");
    const wallLength = walls.reduce((sum, wall) => sum + (wall.orientation === "x" ? spanX : spanY), 0);
    const openingArea = openings.length * spanX * spanY;
    const coreArea = cores.length * spanX * spanY;
    const loadArea = loads.length * spanX * spanY;
    const totalLiveLoad = loads.reduce((sum, load) => sum + load.load * spanX * spanY, 0);
    const massPoints = [...rooms, ...loads].map((element) => ({ x: measuredReady && element.roomGeometry ? element.roomGeometry.x+element.roomGeometry.width/2 : (element.x + .5) * spanX, y: measuredReady && element.roomGeometry ? element.roomGeometry.y+element.roomGeometry.depth/2 : (element.y + .5) * spanY, weight: element.type === "load" ? Math.max(element.load, 1) : 1 }));
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
    const eccentricity = Math.hypot(massCenter.x - rigidityCenter.x, massCenter.y - rigidityCenter.y);
    const eccentricityRatio = eccentricity / Math.max(totalWidth, totalDepth) * 100;
    return { roomArea: measuredReady ? rooms.reduce((sum, e) => sum + (e.roomGeometry?.area ?? 0), 0) : rooms.length * spanX * spanY, floorArea, columns: columns.length, walls: walls.length, rooms: rooms.length, cores: cores.length, openings: openings.length, wallLength, openingArea, openingRatio: openingArea / Math.max(floorArea, 1) * 100, coreArea, loadArea, totalLiveLoad, massCenter, rigidityCenter, eccentricity, eccentricityRatio };
  }, [measuredReady, spanX, spanY, totalDepth, totalWidth, visible]);

  useEffect(() => {
    if (!loaded) return;
    patchModule("plan-editor", { level, floorCount, baysX, baysY, spanX, spanY, corridorWidth, elements, metrics, measurementNeedsReview: hasMeasured && !measuredReady, status: "concept-plan" });
  }, [loaded, hasMeasured, measuredReady, baysX, baysY, corridorWidth, elements, floorCount, level, metrics, patchModule, spanX, spanY]);

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
    const candidates = visible.filter((element) => element.x === x && element.y === y);
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
      propertyEditStarted.current = false;
    setSelectedId(id);
      setTool("select");
      setStatus("Nesne özellikleri açıldı");
    }
  };

  const updateSelected = (patch: Partial<PlanElement>) => {
    if (!selectedId) return;
    if (!propertyEditStarted.current) {
      setHistory(current => [...current.slice(-29), elements]);
      propertyEditStarted.current = true;
    }
    setFuture([]);
    setElements((current) => current.map((element) => element.id === selectedId ? { ...element, ...patch } : element));
  };

  const autoFrame = () => {
    const retained = elements.filter((element) => element.level !== level || element.type !== "column");
    const columns: PlanElement[] = [];
    for (let x = 0; x <= baysX; x += 1) for (let y = 0; y <= baysY; y += 1) columns.push({ id: createId("column", level, x, y), type: "column", level, x, y, orientation: "x", label: `K-${String.fromCharCode(65 + x)}${y + 1}`, load: 0, fire: "R 90", section: "50×50 cm" });
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
    if (nextFloorCount > 0) { const safeFloorCount = Math.max(1, Math.min(12, nextFloorCount)); setFloorCount(safeFloorCount); setLevel((current) => Math.min(current, safeFloorCount)); }
    if (Array.isArray(saved?.elements) && saved.elements.length) setElements(saved.elements);
    else setElements((current) => current.filter((element) => element.x <= nextBaysX && element.y <= nextBaysY));
    setStatus(Array.isArray(saved?.elements) && saved.elements.length ? "Mimari programdan üretilen plan nesneleri otomatik açıldı" : targetWidth > 0 || targetDepth > 0 ? "Mimari program / parsel geometrisi aks modeline aktarıldı" : "Aktarılacak mimari program veya parsel kütlesi bulunamadı");
  }, [baysX, baysY, project.modules, thread.canonical]);

  useEffect(() => {
    if (!hydrated || !project.experience.autoHandoff) return;
    const saved = project.modules["plan-editor"] as { handoff?: { synchronizedAt?: string } } | undefined;
    const synchronizedAt = saved?.handoff?.synchronizedAt ?? "";
    if (!synchronizedAt || handoffSeen.current === synchronizedAt) return;
    handoffSeen.current = synchronizedAt;
    importUpstream();
  }, [hydrated, importUpstream, project.experience.autoHandoff, project.modules]);

  const exportJson = () => downloadTextFile("arkem-plan-modeli.json", JSON.stringify({ schema: "ARKEM-PLAN/1.0", units: "m", coordinateSystem: PLAN_LOCAL_CRS, editorYAxis: "down", exportYAxis: "up", floorCount, baysX, baysY, spanX, spanY, corridorWidth, measuredReady, measurementSchema: hasMeasured ? "ARKEM-MEASURED-PLAN/1.0" : undefined, elements, metrics }, null, 2), "application/json");
  const exportCsv = () => downloadTextFile("arkem-plan-metraj.csv", `type,count,quantity,unit,basis\ncolumns,${metrics.columns},${metrics.columns},each,object_count\nwalls,${metrics.walls},${metrics.wallLength.toFixed(2)},m,grid_span_length\nrooms,${metrics.rooms},${metrics.roomArea.toFixed(2)},m2,${measuredReady ? "programme_net_area" : "grid_cell_area_not_net_room_area"}\ncores,${metrics.cores},${metrics.coreArea.toFixed(2)},m2,grid_cell_area\nopenings,${metrics.openings},${metrics.openingArea.toFixed(2)},m2,grid_cell_area\nload_zones,${visible.filter((element) => element.type === "load").length},${metrics.totalLiveLoad.toFixed(2)},kN,load_times_grid_cell_area`, "text/csv;charset=utf-8");
  const buildPlanPolylines = () => {
    const polylines: DxfPolyline[] = [{
      layer: "ON_YAPI",
      points: [{ x: 0, y: 0 }, { x: totalWidth, y: 0 }, { x: totalWidth, y: totalDepth }, { x: 0, y: totalDepth }],
    }];
    visible.forEach((element) => {
      if (element.roomGeometry && measuredReady) {
        const r=element.roomGeometry,left=r.x,right=r.x+r.width,bottom=totalDepth-r.y-r.depth,top=totalDepth-r.y;
        const dl=(left+right-r.doorWidth)/2,dr=dl+r.doorWidth,dy=r.side==="bottom"?bottom:top;
        const points=r.side==="bottom"?[{x:dl,y:bottom,label:undefined},{x:left,y:bottom},{x:left,y:top},{x:right,y:top},{x:right,y:bottom},{x:dr,y:bottom}]:
          [{x:dr,y:top,label:undefined},{x:right,y:top},{x:right,y:bottom},{x:left,y:bottom},{x:left,y:top},{x:dl,y:top}];
        polylines.push({layer:"MAHAL",closed:false,points});
        const sign=r.side==="bottom"?1:-1;
        polylines.push({layer:"KAPI",closed:false,points:[{x:dl,y:dy},{x:dl,y:dy+sign*r.doorWidth}]});
        polylines.push({layer:"KAPI",closed:false,points:Array.from({length:13},(_,i)=>({x:dl+r.doorWidth*Math.sin(i*Math.PI/24),y:dy+sign*r.doorWidth*Math.cos(i*Math.PI/24)}))});
        polylines.push({layer:"BAGLANTI",closed:false,points:r.route.map(p=>({x:p.x,y:totalDepth-p.y}))});
        return;
      }
      if (element.corridorGeometry && measuredReady) {
        const c=element.corridorGeometry;
        polylines.push({layer:"KORIDOR",points:[{x:c.x,y:totalDepth-c.y-c.depth},{x:c.x+c.width,y:totalDepth-c.y-c.depth},{x:c.x+c.width,y:totalDepth-c.y},{x:c.x,y:totalDepth-c.y}]});
        const left=element.x*spanX,right=left+spanX,bottom=totalDepth-c.y,top=bottom+spanY,dl=c.doorX-c.doorWidth/2,dr=c.doorX+c.doorWidth/2;
        polylines.push({layer:"CEKIRDEK",closed:false,points:[{x:dl,y:bottom,label:undefined},{x:left,y:bottom},{x:left,y:top},{x:right,y:top},{x:right,y:bottom},{x:dr,y:bottom}]});
        polylines.push({layer:"KAPI",closed:false,points:[{x:dl,y:bottom},{x:dl,y:bottom+c.doorWidth}]});
        polylines.push({layer:"KAPI",closed:false,points:Array.from({length:13},(_,i)=>({x:dl+c.doorWidth*Math.sin(i*Math.PI/24),y:bottom+c.doorWidth*Math.cos(i*Math.PI/24)}))});
        return;
      }
      const x = element.x * spanX;
      const y = totalDepth - element.y * spanY;
      const layer = element.type === "column" ? "KOLON" : element.type === "wall" ? "PERDE" : element.type === "space" ? "MAHAL" : element.type === "core" ? "CEKIRDEK" : element.type === "opening" ? "BOSLUK" : "YAZI";
      if (element.type === "column") {
        const size = Math.max(.35, Math.min(spanX, spanY) * .08);
        polylines.push({ layer, points: [{ x: x - size / 2, y: y - size / 2 }, { x: x + size / 2, y: y - size / 2 }, { x: x + size / 2, y: y + size / 2 }, { x: x - size / 2, y: y + size / 2 }] });
      } else if (element.type === "wall") {
        const thickness = .25;
        polylines.push({ layer, points: element.orientation === "x"
          ? [{ x, y: y - thickness / 2 }, { x: x + spanX, y: y - thickness / 2 }, { x: x + spanX, y: y + thickness / 2 }, { x, y: y + thickness / 2 }]
          : [{ x: x - thickness / 2, y }, { x: x + thickness / 2, y }, { x: x + thickness / 2, y: y - spanY }, { x: x - thickness / 2, y: y - spanY }] });
      } else {
        const cell = planCellBounds(element.x, element.y, spanX, spanY, totalDepth);
        const inset = Math.min(spanX, spanY) * .05;
        polylines.push({ layer, points: [{ x: cell.left + inset, y: cell.bottom + inset, label: element.label }, { x: cell.right - inset, y: cell.bottom + inset }, { x: cell.right - inset, y: cell.top - inset }, { x: cell.left + inset, y: cell.top - inset }] });
      }
    });
    return polylines;
  };
  const measuredLabels = measuredReady ? visible.flatMap(e=>{
    if(e.roomGeometry) {
      const r=e.roomGeometry;
      return [{x:r.x+r.width/2,y:totalDepth-r.y-r.depth/2,width:r.width,lines:[e.label,r.width.toFixed(2)+"×"+r.depth.toFixed(2),r.area.toFixed(1)+" m²"]}];
    }
    if(e.type==="core")return [{x:(e.x+.5)*spanX,y:totalDepth-(e.y+.5)*spanY,width:spanX,lines:["Çekirdek"]}];
    return [];
  }) : [];
  const exportDxf = () => {
    const dxf = createLayeredDxf({
      title: `ARKEM KAT PLANI / K${level}`,
      width: totalWidth,
      depth: totalDepth,
      grid: { baysX, baysY },
      polylines: buildPlanPolylines(),
      labels: measuredLabels,
      notes: [`KAT: K${level}`, `${visible.length} NESNE / ${metrics.columns} KOLON / ${metrics.walls} PERDE-DUVAR`],
      sheet: {
        projectName: project.name,
        projectCode: project.id,
        module: "ARC / PARAMETRIK PLAN",
        drawingTitle: `K${level} MIMARI VE TASIYICI KURGU PLANI`,
        drawingNo: `ARC-${String(level).padStart(3, "0")}`,
        revision: project.revision,
        status: "KAVRAMSAL BIM SEMASI",
        coordinateSystem: PLAN_LOCAL_CRS,
        scale: "MODEL 1:1",
        preparedBy: "ARKEMX",
        checkedBy: "PROJEYE OZEL",
      },
    });
    downloadTextFile(`arkem-k${level}-katmanli-kat-plani.dxf`, dxf, "application/dxf");
    setStatus(`K${level} kurumsal antetli CAD paftası oluşturuldu`);
  };
  const exportPdf = async () => {
    const roleByLayer = (layer: string) => layer === "BAGLANTI" || layer === "KORIDOR" ? "grid" as const : layer === "ON_YAPI" || layer === "KOLON" || layer === "PERDE"
      ? "primary" as const
      : layer === "BOSLUK"
        ? "warning" as const
        : "secondary" as const;
    const pdf = await createCorporateTechnicalPdf({
      projectName: project.name,
      projectCode: project.id,
      module: "ARKEMX / PARAMETRIK PLAN",
      drawingTitle: `K${level} Mimari ve Taşıyıcı Kurgu Planı`,
      drawingSubtitle: `${baysX} × ${baysY} aks / ${visible.length} nesne / ${view} görünümü`,
      detailsNote: measuredReady ? "Net alanlar programdan. Duvar kalınlığı modellenmedi." : "Tam model: JSON çıktısı. Hücreler net oda alanı değildir.",
      revision: project.revision,
      status: "Kavramsal BIM şeması",
      sheetNo: `ARC-${String(level).padStart(3, "0")}`,
      scale: "OTOMATIK / METRE",
      coordinateSystem: PLAN_LOCAL_CRS,
      polylines: buildPlanPolylines().map((polyline) => ({
        points: polyline.points,
        closed: polyline.closed,
        role: roleByLayer(polyline.layer),
      })),
      labels: measuredLabels,
      metrics: [...(measuredReady ? [["Program net alanı", metrics.roomArea.toFixed(1)+" m²"], ["Oda kapıları", metrics.rooms+" bağlantı"]] as [string,string][] : []),
        ["Kat alanı", `${metrics.floorArea.toFixed(1)} m²`],
        ["Aks düzeni", `${baysX} × ${baysY}`],
        ["Aks açıklığı", `${spanX.toFixed(2)} × ${spanY.toFixed(2)} m`],
        ["Kolon / perde", `${metrics.columns} / ${metrics.walls}`],
        ["Perde uzunluğu", `${metrics.wallLength.toFixed(1)} m`],
        ["Boşluk oranı", `%${metrics.openingRatio.toFixed(1)}`],
        ["KM-KR dışmerkezlik", `${metrics.eccentricity.toFixed(2)} m`],
      ],
      notes: [
        `Aktif kat K${level}; model ${floorCount} kat. ${planCellConflicts(elements)} çakışan hücre; yerleşim incelemesi gerekli.`,
        "Kesit, yük ve yangın sınıfı değerleri kullanıcı girdisidir; hesap modeliyle doğrulanmalıdır.",
        "Mahal, çekirdek, boşluk ve taşıyıcı nesneler aynı proje kimliği altında kaydedilir.",
        "Bu pafta uygulama, ruhsat veya statik hesap paftası değildir.",
      ],
      legend: [["Taşıyıcı / plan sınırı", "primary"], ["Mahal / çekirdek", "secondary"], ["Boşluk / uyarı", "warning"]],
    });
    downloadTextFile(`arkem-k${level}-kurumsal-teknik-pafta.pdf`, pdf, "application/pdf");
    setStatus(`K${level} A3 kurumsal PDF paftası oluşturuldu`);
  };

  const conflictingCells = planCellConflicts(elements);
  const programSync = planProgramSync(project.modules["architectural-program"], elements, { floors: floorCount, x: baysX, y: baysY });
  const floorLayout = planFloorLayout(elements, programSync.summary, { floors: floorCount, x: baysX, y: baysY });
  const currentFloors = Array.from({ length: floorCount }, (_, i) => ({ level: i + 1, rooms: elements.filter(e => e.type === "space" && e.level === i + 1).length }));
  const applyFloorLayout = () => {
    if (!loaded || !programSync.valid || !floorLayout.valid || !floorLayout.moved) return;
    commit(floorLayout.elements, "Kat dağılımı uygulandı; çekirdekler ve mahal özellikleri korundu");
    setSelectedId(null); setLevel(1); setView("architectural");
  };
  const applyMeasured = () => {
    if (!loaded || !measuredProposal.valid) return;
    commit(measuredProposal.elements, "Oda ölçüleri, kapılar ve koridor bağlantıları uygulandı");
    setTool("select"); setSelectedId(null); setView("architectural");
  };
  const addMissingRooms = () => {
    if (!loaded || !programSync.canApply) return;
    commit([...elements, ...programSync.additions], "Eksik mahaller boş hücrelere eklendi; mevcut nesneler korundu");
    setView("architectural");
  };
  const showElement = (element: PlanElement) => {
    if (element.type === "column") return layers.columns;
    if (element.type === "wall") return layers.walls;
    if (element.type === "space" || element.type === "core") return layers.spaces;
    if (element.type === "opening") return layers.openings;
    return layers.loads;
  };

  return <section className={`advanced-plan-editor cad-plan-editor${DEMO_ENABLED ? " bim-demo" : ""}`} data-testid="advanced-plan-editor">
    {!DEMO_ENABLED && <ProjectKernelBar module="PARAMETRIC PLAN AUTHORING" confidence="Konsept BIM şeması" />}
    {DEMO_ENABLED ? <header className="bim-heading"><span>05 / BIM</span><h1>Plan ve aks modeli</h1><p>{project.name} · Mahalleri yerleştirin, katları ve aksları düzenleyin.</p><small role="status">{status}</small></header> : <div className="plan-editor-head"><div><p className="eyebrow light">Arkem Plan & Taşıyıcı Kurgu Editörü</p><h2>Aksları tanımlayın.<br/><em>Nesne tabanlı plan üretin.</em></h2></div><p>Kolon, perde, çekirdek, mahal, döşeme boşluğu ve yük bölgelerini kat bazında yönetin; kütle–rijitlik merkezlerini izleyin ve açık formatta teknik çıktı alın.</p></div>}
    {DEMO_ENABLED && <section className="bim-program" aria-label="Mimari program aktarımı"><header><div><h2>Mimari program → plan</h2><p>Eksik mahaller boş aks hücrelerine eklenir. Mevcut çizimler taşınmaz veya silinmez.</p></div><button disabled={!loaded || !programSync.canApply} onClick={addMissingRooms}>{programSync.missing ? `Eksik ${programSync.missing} mahali ekle` : "Mahaller planda"}</button></header>{!programSync.valid ? <p>Geçerli ve aktarılabilir mimari program bekleniyor.</p> : <><ul>{programSync.summary.map(room => <li key={room.id}><b>{room.name}</b><span>{room.placed}/{room.count} planda{room.extra > 0 ? " · Fazla nesne var" : ""}</span></li>)}</ul>{programSync.missing > programSync.free && <p role="alert">Boş hücre sayısı yetersiz. Kat ve aks düzenini gözden geçirin.</p>}</>}{conflictingCells > 0 ? <p role="alert">{conflictingCells} hücrede mahal, çekirdek veya boşluk üst üste geliyor. Yerleşimi gözden geçirin.</p> : loaded && <p>Hücre çakışması bulunmadı.</p>}<p>Hücreler gerçek oda alanı değildir; yakınlıklar, kapılar ve geçişler bu işlemle doğrulanmaz. Eklemeyi Geri düğmesiyle geri alabilirsiniz.</p></section>}
    {DEMO_ENABLED && <section className="bim-program bim-layout" aria-label="Kat dağılımı"><header><div><h2>Katlara dağılım</h2><p>Mevcut: {currentFloors.map(f => `K${f.level}: ${f.rooms} mahal`).join(" · ")}</p></div><button disabled={!loaded || !programSync.valid || !floorLayout.valid || !floorLayout.moved} onClick={applyFloorLayout}>{floorLayout.moved ? "Dağılım taslağını uygula" : "Dağılım yerinde"}</button></header>{floorLayout.valid ? <><p>Taslak: {floorLayout.floors.map(f => `K${f.level}: ${f.rooms} mahal`).join(" · ")} · {floorLayout.moved} mahalin konumu değişecek.</p><p>{floorLayout.reason}</p></> : <p>{floorLayout.reason}</p>}<p>Bu adet dağılımı bir taslaktır. Oda alanları, yakınlıklar ve katlar arası erişim ayrıca düzenlenir. Geri ile önceki yerleşime dönebilirsiniz.</p></section>}
    {DEMO_ENABLED && <section className="bim-program" aria-label="Oda ölçüleri ve bağlantılar">
      <header><div><h2>Oda ölçüleri, kapılar ve koridor</h2><p>{measuredReady ? "Ölçülü taslak güncel · " + elements.filter(e=>e.roomGeometry).length + " oda koridor üzerinden çekirdeğe bağlı." : hasMeasured ? "Girdiler değişti; ölçülü taslağı güncelleyin." : "Net alanları mimari programdan alarak ölçülü bir taslak oluşturun."}</p></div>
      <button disabled={!loaded || !measuredProposal.valid || measuredReady} onClick={applyMeasured}>{hasMeasured ? "Ölçülü taslağı güncelle" : "Ölçülü taslak oluştur"}</button></header>
      <label className="bim-corridor-input">Koridor genişliği (m)<input type="number" min=".9" max="3" step=".1" value={corridorWidth} onChange={e=>setCorridorWidth(Number(e.target.value))}/></label>
      {!measuredProposal.valid && <p role="alert">{measuredProposal.reason}</p>}
      <p>Başlangıç: 1,20 m koridor, 0,90 m kapı; oda eni alan üzerinden türetilir. Odayı seçerek en ve kapı ölçüsünü değiştirebilirsiniz. Sınırlar net iç alan şemasıdır; duvar kalınlığı, bağımsız bölüm ve kaçış uygunluğu doğrulanmış değildir.</p>
    </section>}
    <div className="cad-editor-app">
      <header className="cad-topbar"><div className="cad-project-id"><span>ARKEM / CONCEPT BIM</span><b>K{level} · {totalWidth.toFixed(2)} × {totalDepth.toFixed(2)} m</b></div><nav aria-label="Plan görünümü">{(["architectural","structural","loads","coordination"] as View[]).map((item) => <button key={item} className={view === item ? "active" : ""} onClick={() => setView(item)}>{item === "architectural" ? "Mimari" : item === "structural" ? "Taşıyıcı" : item === "loads" ? "Yükler" : "Koordinasyon"}</button>)}</nav><div className="cad-top-actions"><button className="cad-sync" onClick={importUpstream}>Üst veriyi aktar ↘</button><button onClick={undo} disabled={!history.length}>↶ Geri</button><button onClick={redo} disabled={!future.length}>↷ İleri</button><button onClick={exportJson}>JSON indir</button></div></header>
      <div className="cad-editor-grid">
        <aside className="cad-tools"><strong>NESNE ARAÇLARI</strong>{(Object.keys(toolMeta) as Tool[]).map((item) => <button key={item} className={tool === item ? "active" : ""} onClick={() => setTool(item)} title={toolMeta[item].hint}><i>{toolMeta[item].code}</i><span><b>{toolMeta[item].label}</b><small>{toolMeta[item].hint}</small></span></button>)}<strong>YERLEŞİM YÖNÜ</strong><div className="cad-orientation"><button className={orientation === "x" ? "active" : ""} onClick={() => setOrientation("x")}>X doğrultusu →</button><button className={orientation === "y" ? "active" : ""} onClick={() => setOrientation("y")}>Y doğrultusu ↑</button></div><strong>HIZLI ÜRETİM</strong><button className="cad-command" onClick={autoFrame}>Tüm akslara kolon yerleştir</button><button className="cad-command" onClick={duplicateFloor}>Aktif katı üst kata kopyala</button><button className="cad-command danger" onClick={clearFloor}>Aktif katı temizle</button></aside>
        <div className={`cad-canvas view-${view}`} role="region" aria-label="Plan çizimi" tabIndex={0}>
          <div className="cad-canvas-toolbar"><span>SNAP · AKS / 1 mm gösterim hassasiyeti</span><div><b>{toolMeta[tool].label.toUpperCase()}</b><small>{status}</small></div><span>KUZEY ↑</span></div>
          <p className="measured-mobile-hint">Ayrıntılar için çizimi yana kaydırın.</p>
          <svg ref={svgRef} viewBox={`0 0 ${VIEWBOX.width} ${VIEWBOX.height}`} onClick={placeElement} aria-label={`K${level} nesne tabanlı teknik plan editörü`} role="application">
            <defs><pattern id="plan-dot-grid" width="12" height="12" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r=".7" fill="#94a9b2" opacity=".42"/></pattern><pattern id="core-hatch" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="8" stroke="#829aa4" strokeWidth="2"/></pattern><pattern id="opening-hatch" width="9" height="9" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="9" stroke="#b96636" strokeWidth="1" opacity=".6"/></pattern></defs>
            <rect width={VIEWBOX.width} height={VIEWBOX.height} fill="url(#plan-dot-grid)"/>
            <rect x={originX} y={originY} width={totalWidth * scale} height={totalDepth * scale} fill="#fbfcfb" stroke="#718993" strokeWidth="1.4"/>
            {Array.from({ length: baysX + 1 }, (_, index) => <g key={`x-${index}`}><line x1={originX + index * cellW} y1={originY - 28} x2={originX + index * cellW} y2={originY + totalDepth * scale + 28} stroke="#86a0aa" strokeWidth=".75" strokeDasharray="5 4"/><circle cx={originX + index * cellW} cy={originY - 42} r="13" fill="#f7f9f8" stroke="#b96636"/><text x={originX + index * cellW} y={originY - 38.5} textAnchor="middle" fontSize="9" fill="#173243">{String.fromCharCode(65 + index)}</text></g>)}
            {Array.from({ length: baysY + 1 }, (_, index) => <g key={`y-${index}`}><line x1={originX - 28} y1={originY + index * cellH} x2={originX + totalWidth * scale + 28} y2={originY + index * cellH} stroke="#86a0aa" strokeWidth=".75" strokeDasharray="5 4"/><circle cx={originX - 42} cy={originY + index * cellH} r="13" fill="#f7f9f8" stroke="#b96636"/><text x={originX - 42} y={originY + index * cellH + 3.5} textAnchor="middle" fontSize="9" fill="#173243">{index + 1}</text></g>)}
            {layers.spaces && visible.filter(e=>e.corridorGeometry).map(e=><MeasuredCorridor key={"corridor-"+e.id} value={e.corridorGeometry!} originX={originX} originY={originY} scale={scale}/>)}
            {visible.filter(showElement).map((element) => {
              if(element.roomGeometry) return <MeasuredRoom key={element.id} value={element.roomGeometry} label={element.label} selected={selectedId===element.id} originX={originX} originY={originY} scale={scale} onSelect={event=>selectElement(event,element.id)}/>;
              const x = originX + element.x * cellW;
              const y = originY + element.y * cellH;
              const selectedClass = element.id === selectedId ? " selected" : "";
              if (element.type === "column") return <g className={`cad-element column${selectedClass}`} key={element.id} onClick={(event) => selectElement(event, element.id)}><rect x={x - 6} y={y - 6} width="12" height="12"/><text x={x + 9} y={y - 8}>{element.label}</text></g>;
              if (element.type === "wall") return <g className={`cad-element wall${selectedClass}`} key={element.id} onClick={(event) => selectElement(event, element.id)}><line x1={x} y1={y} x2={x + (element.orientation === "x" ? cellW : 0)} y2={y + (element.orientation === "y" ? cellH : 0)}/></g>;
              const fill = element.type === "core" ? "url(#core-hatch)" : element.type === "opening" ? "url(#opening-hatch)" : element.type === "load" ? "rgba(185,102,54,.22)" : view === "loads" ? `rgba(45,126,157,${Math.min(.56, .12 + element.load / 20)})` : "rgba(107,161,180,.11)";
              return <g className={`cad-element cell ${element.type}${selectedClass}`} key={element.id} onClick={(event) => selectElement(event, element.id)}><rect x={x + 3} y={y + 3} width={cellW - 6} height={cellH - 6} fill={fill}/><title>{element.label}</title><text x={x + cellW / 2} y={y + cellH / 2 - 3} textAnchor="middle">{element.type === "core" ? "Çekirdek" : element.label.length > 14 ? element.label.slice(0, 13) + "…" : element.label}</text><text className="sub" x={x + cellW / 2} y={y + cellH / 2 + 11} textAnchor="middle">{element.type === "load" || view === "loads" ? `${element.load.toFixed(1)} kN/m²` : element.type.toUpperCase()}</text></g>;
            })}
            {layers.spaces && visible.filter(e=>e.corridorGeometry).map(e=><MeasuredCoreDoor key={"core-door-"+e.id} value={e.corridorGeometry!} originX={originX} originY={originY} scale={scale}/>)}
            {view === "coordination" && <g className="cad-centers"><line x1={originX + metrics.massCenter.x * scale} y1={originY} x2={originX + metrics.massCenter.x * scale} y2={originY + totalDepth * scale}/><line x1={originX} y1={originY + metrics.massCenter.y * scale} x2={originX + totalWidth * scale} y2={originY + metrics.massCenter.y * scale}/><circle className="mass" cx={originX + metrics.massCenter.x * scale} cy={originY + metrics.massCenter.y * scale} r="8"/><circle className="rigidity" cx={originX + metrics.rigidityCenter.x * scale} cy={originY + metrics.rigidityCenter.y * scale} r="8"/><text x={originX + metrics.massCenter.x * scale + 12} y={originY + metrics.massCenter.y * scale - 12}>KM</text><text x={originX + metrics.rigidityCenter.x * scale + 12} y={originY + metrics.rigidityCenter.y * scale + 19}>KR</text></g>}
            <text x={originX} y={VIEWBOX.height - 20} fill="#71858d" fontSize="9">K{level} · {totalWidth.toFixed(2)} × {totalDepth.toFixed(2)} m · Aks {baysX}×{baysY} · Ölçek ekran uyarlamalı</text>
          </svg>
          <div className="cad-statusbar"><span>X: — m · Y: — m · SNAP: AKS</span><span>{visible.length} nesne · K{level}/{floorCount}</span><span>ARKEM-PLAN/1.0</span></div>
        </div>
        <aside className="cad-inspector">
          <section><strong>KAT & AKS YÖNETİMİ</strong><div className="cad-floor-tabs">{Array.from({ length: floorCount }, (_, index) => <button key={index + 1} className={level === index + 1 ? "active" : ""} onClick={() => { setLevel(index + 1); setSelectedId(null); }}>K{index + 1}</button>)}</div><label>Kat adedi<input type="number" min="1" max="12" value={floorCount} onChange={(event) => { const count = Math.max(1, Math.min(12, Number(event.target.value))); setFloorCount(count); setLevel((current) => Math.min(current, count)); }}/></label><div className="cad-input-grid"><label>X açıklık<input type="number" min="1" max="12" value={baysX} onChange={(event) => setBaysX(Math.max(1, Math.min(12, Number(event.target.value))))}/></label><label>Y açıklık<input type="number" min="1" max="10" value={baysY} onChange={(event) => setBaysY(Math.max(1, Math.min(10, Number(event.target.value))))}/></label><label>X açıklığı<input type="number" min="2" max="15" step=".1" value={spanX} onChange={(event) => setSpanX(Math.max(2, Math.min(15, Number(event.target.value))))}/><i>m</i></label><label>Y açıklığı<input type="number" min="2" max="15" step=".1" value={spanY} onChange={(event) => setSpanY(Math.max(2, Math.min(15, Number(event.target.value))))}/><i>m</i></label></div></section>
          <section><strong>KATMANLAR</strong>{Object.entries(layers).map(([key, value]) => <label className="cad-layer" key={key}><input type="checkbox" checked={value} onChange={(event) => setLayers((current) => ({ ...current, [key]: event.target.checked }))}/><span>{key === "columns" ? "Kolonlar" : key === "walls" ? "Perde / duvar" : key === "spaces" ? "Mahal / çekirdek" : key === "openings" ? "Boşluklar" : "Yük bölgeleri"}</span><b>{value ? "AÇIK" : "KAPALI"}</b></label>)}</section>
          <section className="cad-properties"><strong>NESNE ÖZELLİKLERİ</strong>{selected ? <><div className="cad-selected-type"><i>{toolMeta[selected.type].code}</i><span><b>{toolMeta[selected.type].label}</b><small>{selected.id.slice(0, 18)}</small></span></div><label>Etiket<input value={selected.label} onFocus={() => { propertyEditStarted.current = false; }} onChange={(event) => updateSelected({ label: event.target.value })}/></label>{selected.type === "space" && <><label>Oda eni (m)<input type="number" min="1.2" max="12" step=".1" value={selected.roomWidth ?? selected.roomGeometry?.width ?? ""} placeholder="Otomatik" onFocus={()=>{propertyEditStarted.current=false;}} onChange={e=>updateSelected({roomWidth:e.target.value===""?undefined:Number(e.target.value)})}/></label><label>Kapı genişliği (m)<input type="number" min=".6" max="1.5" step=".05" value={selected.doorWidth ?? .9} onFocus={()=>{propertyEditStarted.current=false;}} onChange={e=>updateSelected({doorWidth:Number(e.target.value)})}/></label>{selected.roomGeometry && <p>Uygulanan: {selected.roomGeometry.width.toFixed(2)} × {selected.roomGeometry.depth.toFixed(2)} m · {selected.roomGeometry.area.toFixed(1)} m². Seçili odanın kesik çizgisi çekirdeğe giden koridor rotasıdır.</p>}</>}<label>Hareketli yük<input type="number" min="0" max="25" step=".5" value={selected.load} onFocus={() => { propertyEditStarted.current = false; }} onChange={(event) => updateSelected({ load: Number(event.target.value) })}/><i>kN/m²</i></label><label>Yangın sınıfı<select value={selected.fire} onFocus={() => { propertyEditStarted.current = false; }} onChange={(event) => updateSelected({ fire: event.target.value })}>{["R 30","R 60","R 90","REI 120","Projede belirlenecek"].map((value) => <option key={value}>{value}</option>)}</select></label><label>Ön kesit<input value={selected.section} onFocus={() => { propertyEditStarted.current = false; }} onChange={(event) => updateSelected({ section: event.target.value })}/></label><button className="cad-delete-selected" onClick={() => { commit(elements.filter((element) => element.id !== selected.id), "Seçili nesne silindi"); setSelectedId(null); }}>Seçili nesneyi sil</button></> : <p>Plan üzerinde bir nesne seçin veya yerleştirme aracıyla yeni nesne oluşturun.</p>}</section>
          <section className="cad-metrics"><strong>MODEL KONTROLÜ</strong><div><span>Kat alanı</span><b>{metrics.floorArea.toFixed(1)} m²</b></div><div><span>Kolon / perde</span><b>{metrics.columns} / {metrics.walls}</b></div><div><span>Perde uzunluğu</span><b>{metrics.wallLength.toFixed(1)} m</b></div><div><span>Boşluk oranı</span><b className={metrics.openingRatio > 25 ? "risk" : ""}>%{metrics.openingRatio.toFixed(1)}</b></div><div><span>KM–KR dışmerkezlik</span><b className={metrics.eccentricityRatio > 10 ? "risk" : metrics.eccentricityRatio > 5 ? "watch" : "good"}>{metrics.eccentricity.toFixed(2)} m</b></div><small>Merkez hesabı, tanımlı nesnelere bağlı kavramsal göstergedir; deprem düzensizlik hesabı değildir.</small></section>
          <section><strong>TEKNİK ÇIKTI</strong><div className="cad-export"><button disabled={hasMeasured && !measuredReady} onClick={exportPdf}>PDF<span>A3 kurumsal pafta</span></button><button disabled={hasMeasured && !measuredReady} onClick={exportDxf}>CAD<span>DWG uyumlu DXF</span></button><button onClick={exportJson}>JSON<span>Model verisi</span></button><button disabled={hasMeasured && !measuredReady} onClick={exportCsv}>CSV<span>Ön metraj</span></button></div></section>
        </aside>
      </div>
      <div className="cad-editor-foot"><b>Model statüsü · Konsept</b><p>Bu editör nesne yerleşimi, veri hazırlığı ve disiplinler arası karar kaydı içindir. Mimari uygulama projesi, statik analiz modeli, yangın projesi veya ruhsat paftası değildir. Kesitler, yükler ve düzensizlikler yetkili proje müelliflerince doğrulanmalıdır.</p></div>
    </div>
    {DEMO_ENABLED && <nav className="bim-next" aria-label="Sonraki modüller"><Link href="/mimari-program-studyosu#mimari-motor">← Mimari programa dön</Link><Link href="/yapi-sistemi-karsilastirma#sistem-karsilastirma">Sistem seçimine devam et →</Link></nav>}
  </section>;
}
