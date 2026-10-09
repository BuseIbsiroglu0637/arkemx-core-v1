"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import {
  calculateStructuralConcept,
  createGridDxf,
  DESIGN_BASIS,
  downloadTextFile,
  SYSTEM_LABELS,
  type StructuralConceptInput,
  type StructuralSystem,
} from "../lib/engineering";
import { createCorporateTechnicalPdf, type TechnicalSheetPolyline } from "../lib/technical-sheet";
import { createStructuralStudio } from "../lib/structural-studio";
import { createDocumentIdentity } from "../lib/document-identity";
import { inspectStructuralSourceReferences, runSupportedStructuralAnalysis, structuralAnalysisBlockers } from "../lib/source-reference-integrity";
import { projectIntegrityIssues } from "../lib/project-integrity";
import { ProjectKernelBar, useProjectKernel } from "./ProjectKernel";

type Props = { home?: boolean; compactKernel?: boolean };
type WorkspaceView = "model" | "alternatives" | "loads" | "checks" | "quantities";
type StructuralShortlistItem = { id: StructuralSystem; name: string; score: number };

const structuralSystemIds: StructuralSystem[] = ["concrete", "precast", "steel", "light", "hybrid"];
const isStructuralSystem = (value: unknown): value is StructuralSystem => structuralSystemIds.includes(value as StructuralSystem);

const usageLabels: Record<StructuralConceptInput["usage"], string> = {
  residential: "Konut",
  office: "Ofis / ticari",
  industrial: "Sanayi / üretim",
  storage: "Depo / lojistik",
  assembly: "Toplanma / sosyal",
};

function resolveStructuralUsage(value: unknown): StructuralConceptInput["usage"] {
  const label = String(value ?? "").trim().toLocaleLowerCase("tr-TR");
  if (label === "residential" || label.includes("konut") || label.includes("villa") || label.includes("yaşam")) return "residential";
  if (label === "office" || label === "commercial" || label.includes("ofis") || label.includes("ticari")) return "office";
  if (label === "storage" || label.includes("depo") || label.includes("lojistik")) return "storage";
  if (label === "assembly" || label.includes("toplanma") || label.includes("sosyal") || label.includes("eğitim")) return "assembly";
  return "industrial";
}

function addMember(group: THREE.Group, size: [number, number, number], position: [number, number, number], material: THREE.Material) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
  mesh.position.set(...position);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  group.add(mesh);
}

function StructuralFallback({ input }: { input: StructuralConceptInput }) {
  const xs = Array.from({ length: input.baysX + 1 }, (_, index) => 74 + index * (510 / input.baysX));
  const levels = Array.from({ length: input.floors + 1 }, (_, index) => 390 - index * (280 / input.floors));
  return <div className="structural-fallback" role="img" aria-label="Taşıyıcı aks, kolon ve kat düzlemlerinin teknik şeması">
    <svg viewBox="0 0 700 450" aria-hidden="true">
      <defs><pattern id="cad-grid" width="18" height="18" patternUnits="userSpaceOnUse"><path d="M18 0H0V18" fill="none" stroke="rgba(151,190,205,.12)" strokeWidth=".7"/></pattern><linearGradient id="frame-fill" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#89b4c4" stopOpacity=".08"/><stop offset="1" stopColor="#b96636" stopOpacity=".13"/></linearGradient></defs>
      <rect width="700" height="450" fill="url(#cad-grid)"/>
      <path d="M74 390L584 390L635 348L125 348Z" fill="url(#frame-fill)" stroke="#507889" strokeWidth="1"/>
      {levels.map((y, levelIndex) => <g key={y}>{xs.map((x) => <line key={`${x}-${y}`} x1={x} y1={390} x2={x + (390 - y) * .18} y2={y} stroke={levelIndex === 0 ? "#d98a5d" : "#8eb2c0"} strokeWidth={levelIndex === 0 ? 1.2 : .8}/>) }<line x1={74 + (390 - y) * .18} y1={y} x2={584 + (390 - y) * .18} y2={y} stroke="#d98a5d" strokeWidth="2"/><line x1={125 + (390 - y) * .18} y1={y - 42} x2={635 + (390 - y) * .18} y2={y - 42} stroke="#799dac" strokeWidth="1.2"/><line x1={74 + (390 - y) * .18} y1={y} x2={125 + (390 - y) * .18} y2={y - 42} stroke="#799dac"/><line x1={584 + (390 - y) * .18} y1={y} x2={635 + (390 - y) * .18} y2={y - 42} stroke="#799dac"/></g>)}
      {xs.map((x, index) => <g key={x}><circle cx={x} cy="414" r="11" fill="#0a2639" stroke="#b96636"/><text x={x} y="418" textAnchor="middle" fill="#f2c1a4" fontSize="9">{String.fromCharCode(65 + index)}</text></g>)}
      {levels.slice(0, -1).map((y, index) => <text key={y} x="645" y={y - 14} fill="#93aab4" fontSize="9">K{index + 1} · {(input.floorHeight * (index + 1)).toFixed(2)} m</text>)}
      <text x="73" y="34" fill="#df8d5c" fontSize="10" letterSpacing="2">ARKEM ANALYTICAL FRAME / SVG FALLBACK</text>
      <text x="73" y="53" fill="#8ea5af" fontSize="9">{SYSTEM_LABELS[input.system].toUpperCase()} · {input.baysX} × {input.baysY} AKS · {input.floors} KAT</text>
      <path d="M74 421H584" stroke="#b96636"/><text x="329" y="441" fill="#df8d5c" fontSize="9" textAnchor="middle">{input.width.toFixed(2)} m</text>
    </svg>
    <div><b>Uyumlu 3B grafik bağlamı bulunamadı.</b><span>Teknik aks şeması, hesap ve çıktılar eksiksiz çalışmaya devam ediyor.</span></div>
  </div>;
}

function NumericField({ label, value, min, max, step, unit, onChange }: { label: string; value: number; min: number; max: number; step: number; unit?: string; onChange: (value: number) => void }) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => { setDraft(String(value)); }, [value]);
  const commit = () => {
    if (!draft.trim()) { setDraft(String(value)); return; }
    const parsed = Number(draft);
    if (!Number.isFinite(parsed)) { setDraft(String(value)); return; }
    const next = Math.min(max, Math.max(min, parsed));
    onChange(next);
    setDraft(String(next));
  };
  return <label className="engineering-number-field"><span>{label}</span><div><input type="number" min={min} max={max} step={step} value={draft} onChange={(event) => setDraft(event.target.value)} onBlur={commit} onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); }} /><b>{unit}</b></div></label>;
}

export function StructuralDesigner({ home = false, compactKernel = false }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const transferApplied = useRef(false);
  const handoffSeen = useRef("");
  const { patchModule, thread, project, hydrated } = useProjectKernel();
  const sourceGeometry = project.modules["structural-concept"] as { units?: unknown; sourceRevision?: string | null; inputElementIds?: string[] | null; modelContext?: { floorPlates?: Array<{ level: number; width: number; depth: number }>; selectedLevel?: number }; input?: Partial<StructuralConceptInput>; handoff?: { id?: string } } | undefined;
  const planSourceElements = (project.modules["plan-editor"] as { elements?: Array<{ id: string }> } | undefined)?.elements;
  const sourceElementIds = Array.isArray(planSourceElements) ? planSourceElements.filter(element => element && typeof element.id === "string").map(element => element.id) : [];
  const floorSource = sourceGeometry?.modelContext?.floorPlates;
  const floorGeometry = useMemo(() => Array.isArray(floorSource) ? floorSource.filter(plate => !!plate && typeof plate === "object" && !Array.isArray(plate)) : [], [floorSource]);
  const invalidSource = projectIntegrityIssues(project).some(issue => issue.startsWith("structural-concept:") || (sourceGeometry?.sourceRevision && issue.startsWith("plan-editor:")));
  const invalidFloors = structuralAnalysisBlockers(sourceGeometry).length > 0;
  const analysisBlocked = invalidSource || invalidFloors;
  const geometrySupport = useMemo(() => ({ status: analysisBlocked ? invalidFloors ? new Set(floorGeometry.map(plate => `${plate.width}/${plate.depth}`)).size > 1 ? "unsupported-nonuniform-floor-analysis" : "unsupported-invalid-floor-geometry" : "unsupported-source-integrity" : "uniform-concept-only", floorPlates: floorSource ?? [], selectedLevel: sourceGeometry?.modelContext?.selectedLevel ?? null, fullBuildingAnalysis: false, technicalApproval: false }), [floorGeometry, floorSource, analysisBlocked, invalidFloors, sourceGeometry?.modelContext?.selectedLevel]);
  const [view, setView] = useState<WorkspaceView>("model");
  const [webglState, setWebglState] = useState<"checking" | "ready" | "fallback">("checking");
  const [system, setSystem] = useState<StructuralSystem>("concrete");
  const [usage, setUsage] = useState<StructuralConceptInput["usage"]>("office");
  const [designBasis, setDesignBasis] = useState<keyof typeof DESIGN_BASIS>("tr");
  const [soilClass, setSoilClass] = useState("ZD");
  const [width, setWidth] = useState(24);
  const [depth, setDepth] = useState(18);
  const [floors, setFloors] = useState(4);
  const [floorHeight, setFloorHeight] = useState(3.4);
  const [baysX, setBaysX] = useState(5);
  const [baysY, setBaysY] = useState(4);
  const [columnSize, setColumnSize] = useState(.5);
  const [beamDepth, setBeamDepth] = useState(.6);
  const [slabThickness, setSlabThickness] = useState(.16);
  const [superDeadLoad, setSuperDeadLoad] = useState(2.2);
  const [liveLoad, setLiveLoad] = useState(3.5);
  const [roofSnowLoad, setRoofSnowLoad] = useState(.75);
  const [basicWindSpeed, setBasicWindSpeed] = useState(30);
  const [sds, setSds] = useState(1.0);
  const [sd1, setSd1] = useState(.45);
  const [importance, setImportance] = useState(1);
  const [behaviorFactor, setBehaviorFactor] = useState(6);
  const [concreteStrength, setConcreteStrength] = useState(30);
  const [steelYield, setSteelYield] = useState(355);
  const [repetition, setRepetition] = useState(70);
  const [transportDistance, setTransportDistance] = useState(120);
  const [fireRating, setFireRating] = useState(90);
  const [showSlabs, setShowSlabs] = useState(true);
  const [showLoads, setShowLoads] = useState(false);
  const [syncStatus, setSyncStatus] = useState("Bağımsız ön tasarım girdileri");
  const [modelHydrated, setModelHydrated] = useState(false);
  const [mcdaShortlist, setMcdaShortlist] = useState<StructuralShortlistItem[]>([]);

  const input = useMemo<StructuralConceptInput>(() => ({
    system, usage, width, depth, floors, floorHeight, baysX, baysY, columnSize, beamDepth, slabThickness,
    superDeadLoad, liveLoad, roofSnowLoad, basicWindSpeed, sds, sd1, importance, behaviorFactor,
    concreteStrength, steelYield,
  }), [basicWindSpeed, baysX, baysY, beamDepth, behaviorFactor, columnSize, concreteStrength, depth, floorHeight, floors, importance, liveLoad, roofSnowLoad, sds, sd1, slabThickness, steelYield, superDeadLoad, system, usage, width]);
  // Unsupported geometry returns before result consumers render; no uniform engine is invoked.
  const result = useMemo(() => analysisBlocked ? null : runSupportedStructuralAnalysis({ modelContext: { floorPlates: floorSource } }, () => calculateStructuralConcept(input)), [analysisBlocked, floorSource, input])!;
  const architecturalScheme = useMemo(() => {
    const architecture = project.modules["architectural-program"] as { architecturalScheme?: unknown } | undefined;
    return architecture?.architecturalScheme;
  }, [project.modules]);
  const structuralStudio = useMemo(() => analysisBlocked ? null : runSupportedStructuralAnalysis({ modelContext: { floorPlates: floorSource } }, () => createStructuralStudio({
    reference: project.id,
    input,
    architecturalScheme,
    repetition,
    transportDistance,
    fireRating,
  })), [analysisBlocked, architecturalScheme, fireRating, floorSource, input, project.id, repetition, transportDistance])!;
  const alternatives = useMemo(() => structuralStudio?.alternatives ?? [], [structuralStudio]);
  const activeAlternative = alternatives.find((alternative) => alternative.system === system) ?? alternatives[0];
  const checkCounts = useMemo(() => result?.checks.reduce((totals, check) => ({ ...totals, [check.state]: totals[check.state] + 1 }), { pass: 0, review: 0, block: 0 }) ?? { pass: 0, review: 0, block: 0 }, [result]);

  useEffect(() => {
    if (!hydrated || !modelHydrated) return;
    patchModule("structural-concept", { schema: "ARKEM-STRUCTURAL-CONCEPT/3.0", previousSchema: "ARKEM-STRUCTURAL-CONCEPT/2.0", input, designBasis, soilClass, result: analysisBlocked ? null : result, alternatives: analysisBlocked ? [] : alternatives, structuralStudio: analysisBlocked ? null : structuralStudio, geometrySupport, architectureContext: { architecturalScheme }, mcdaShortlist, status: analysisBlocked ? "Katlara göre değişen geometri analizi desteklenmiyor; hesap aktarımı engellendi" : "v114-preliminary-system-comparison" });
  }, [alternatives, architecturalScheme, designBasis, hydrated, input, mcdaShortlist, modelHydrated, patchModule, result, soilClass, structuralStudio, analysisBlocked, geometrySupport]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let renderer: THREE.WebGLRenderer | null = null;
    let controls: OrbitControls | null = null;
    let observer: ResizeObserver | null = null;
    let scene: THREE.Scene | null = null;
    let stateFrame = 0;
    try {
      const probe = document.createElement("canvas");
      const context = probe.getContext("webgl2") || probe.getContext("webgl");
      if (!context) throw new Error("WebGL unavailable");
      scene = new THREE.Scene();
      scene.background = new THREE.Color(0x061a2b);
      scene.fog = new THREE.Fog(0x061a2b, 90, 260);
      const camera = new THREE.PerspectiveCamera(38, 1, .1, 400);
      const span = Math.max(width, depth, floors * floorHeight);
      camera.position.set(width * .95, Math.max(16, floors * floorHeight * 1.05), depth * 1.55);
      renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
      renderer.shadowMap.enabled = true;
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.domElement.setAttribute("aria-label", "Parametrik taşıyıcı sistem üç boyutlu ön modeli");
      renderer.domElement.setAttribute("role", "img");
      host.appendChild(renderer.domElement);
      controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.dampingFactor = .055;
      controls.target.set(0, floors * floorHeight * .42, 0);
      controls.minDistance = span * .5;
      controls.maxDistance = span * 5;
      scene.add(new THREE.HemisphereLight(0xd9edf4, 0x102536, 2.2));
      const light = new THREE.DirectionalLight(0xffdfc8, 4);
      light.position.set(18, 30, 16);
      light.castShadow = true;
      scene.add(light);
      const ground = new THREE.Mesh(new THREE.PlaneGeometry(110, 110), new THREE.MeshStandardMaterial({ color: 0x0a2a3e, roughness: .95 }));
      ground.rotation.x = -Math.PI / 2;
      ground.position.y = -.14;
      scene.add(ground, new THREE.GridHelper(90, 90, 0x3c6075, 0x17394d));
      const frame = new THREE.Group();
      scene.add(frame);
      const concrete = new THREE.MeshStandardMaterial({ color: 0xd0cbc1, roughness: .82 });
      const steel = new THREE.MeshStandardMaterial({ color: 0xb96839, metalness: .72, roughness: .28 });
      const secondary = new THREE.MeshStandardMaterial({ color: 0x9db6c2, metalness: .42, roughness: .42 });
      const slabMaterial = new THREE.MeshStandardMaterial({ color: 0x4b829d, transparent: true, opacity: .22, roughness: .45 });
      const loadMaterial = new THREE.MeshBasicMaterial({ color: 0xe49a70, transparent: true, opacity: .72 });
      const xs = Array.from({ length: baysX + 1 }, (_, index) => -width / 2 + index * (width / baysX));
      const zs = Array.from({ length: baysY + 1 }, (_, index) => -depth / 2 + index * (depth / baysY));
      const primary = system === "concrete" || system === "precast" ? concrete : steel;
      const columnWidth = system === "light" ? .12 : system === "steel" ? .3 : columnSize;
      addMember(frame, [width + 1, .24, depth + 1], [0, 0, 0], concrete);
      for (let level = 0; level < floors; level += 1) {
        const base = level * floorHeight;
        const top = base + floorHeight;
        xs.forEach((x) => zs.forEach((z) => addMember(frame, [columnWidth, floorHeight, columnWidth], [x, base + floorHeight / 2, z], primary)));
        zs.forEach((z) => addMember(frame, [width + .2, system === "concrete" || system === "precast" ? beamDepth : .3, columnWidth], [0, top - beamDepth / 2, z], primary));
        xs.forEach((x) => addMember(frame, [columnWidth, system === "concrete" || system === "precast" ? beamDepth : .3, depth + .2], [x, top - beamDepth / 2, 0], primary));
        if (showSlabs) addMember(frame, [width, slabThickness, depth], [0, top, 0], system === "concrete" || system === "precast" ? concrete : slabMaterial);
        if (showLoads) {
          const arrowCount = Math.min(10, baysX * 2);
          for (let arrow = 0; arrow < arrowCount; arrow += 1) {
            const x = -width / 2 + width * ((arrow + .5) / arrowCount);
            addMember(frame, [.04, .8, .04], [x, top + .9, 0], loadMaterial);
          }
        }
        if (system === "light") {
          for (let x = -width / 2; x <= width / 2; x += .6) {
            addMember(frame, [.065, floorHeight, .08], [x, base + floorHeight / 2, -depth / 2], secondary);
            addMember(frame, [.065, floorHeight, .08], [x, base + floorHeight / 2, depth / 2], secondary);
          }
        }
      }
      if (system === "hybrid") addMember(frame, [Math.min(3.5, width / 4), floors * floorHeight + .3, Math.min(3.5, depth / 3)], [-width * .28, floors * floorHeight / 2, 0], concrete);
      const resize = () => {
        if (!renderer) return;
        const viewportWidth = Math.max(host.clientWidth, 1);
        const viewportHeight = Math.max(host.clientHeight, 1);
        renderer.setSize(viewportWidth, viewportHeight, false);
        camera.aspect = viewportWidth / viewportHeight;
        camera.updateProjectionMatrix();
      };
      observer = new ResizeObserver(resize);
      observer.observe(host);
      resize();
      renderer.setAnimationLoop(() => { controls?.update(); renderer?.render(scene!, camera); });
      stateFrame = window.requestAnimationFrame(() => setWebglState("ready"));
    } catch {
      stateFrame = window.requestAnimationFrame(() => setWebglState("fallback"));
    }
    return () => {
      window.cancelAnimationFrame(stateFrame);
      observer?.disconnect();
      renderer?.setAnimationLoop(null);
      controls?.dispose();
      scene?.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          object.geometry.dispose();
          (Array.isArray(object.material) ? object.material : [object.material]).forEach((material) => material.dispose());
        }
      });
      renderer?.dispose();
      renderer?.domElement.remove();
    };
  }, [baysX, baysY, beamDepth, columnSize, depth, floorHeight, floors, showLoads, showSlabs, slabThickness, system, width]);

  const exportJson = () => downloadTextFile("arkem-v114-tasiyici-sistem-studyosu.json", JSON.stringify({
    schema: "ARKEM-STRUCTURAL-CONCEPT/3.0", previousSchema: "ARKEM-STRUCTURAL-CONCEPT/2.0", projectId: project.id, revision: project.revision, units: sourceGeometry?.units ?? null,
    documentIdentity: createDocumentIdentity({ projectCode: project.id, module: "STR", revision: project.revision, sourceRevision: sourceGeometry?.sourceRevision ?? undefined, elementIds: inspectStructuralSourceReferences(project).status === "invalid" ? undefined : sourceGeometry?.inputElementIds ?? undefined, sourceContext: { projectId: project.id, revision: project.revision, elementIds: sourceElementIds } }),
    sourceReferenceValidation: inspectStructuralSourceReferences(project), designBasis, soilClass, input, result: analysisBlocked ? null : result, structuralStudio: analysisBlocked ? null : structuralStudio, geometrySupport, architecturalScheme, generatedAt: new Date().toISOString(),
  }, null, 2), "application/json");
  const exportCsv = () => { if (analysisBlocked) { setSyncStatus("CSV reddedildi: katlara göre değişen geometri analizi desteklenmiyor."); return; } return downloadTextFile("arkem-v114-on-boyutlandirma.csv", [
    "system,score,status,column,beam,floor,relative_cost,duration_weeks,carbon_proxy_kgco2e,factory_share,mass_index",
    ...alternatives.map((alternative) => [
      alternative.label,
      alternative.score.toFixed(1),
      alternative.status,
      alternative.preliminary.column,
      alternative.preliminary.beam,
      alternative.preliminary.floor,
      alternative.indices.relativeCost.toFixed(1),
      alternative.indices.durationWeeks.toFixed(1),
      alternative.indices.embodiedCarbonProxy.toFixed(0),
      alternative.indices.factoryShare.toFixed(0),
      alternative.indices.massIndex.toFixed(1),
    ].map((value) => `"${String(value).replaceAll('"', '""')}"`).join(",")),
  ].join("\n"), "text/csv;charset=utf-8"); };
  const exportDxf = () => downloadTextFile("arkem-kurumsal-aks-plani.dxf", createGridDxf(width, depth, baysX, baysY, {
    projectName: project.name,
    projectCode: project.id,
    module: "STR / YAPISAL ON TASARIM",
    drawingTitle: `${SYSTEM_LABELS[system].toUpperCase()} AKS VE ON BOYUTLANDIRMA PLANI`,
    drawingNo: "STR-001",
    revision: project.revision,
    status: "KAVRAMSAL / ON BOYUTLANDIRMA",
    coordinateSystem: project.coordinateReference,
    scale: "MODEL 1:1",
    preparedBy: "ARKEMX",
    checkedBy: "YETKILI MUHENDIS",
  }), "application/dxf");
  const exportPdf = async () => {
    if (analysisBlocked) { setSyncStatus("PDF reddedildi: katlara göre değişen geometri analizi desteklenmiyor."); return; }
    const gridLines: TechnicalSheetPolyline[] = [];
    for (let x = 0; x <= baysX; x += 1) {
      const px = width / Math.max(1, baysX) * x;
      gridLines.push({ role: "grid", closed: false, points: [{ x: px, y: 0, label: String.fromCharCode(65 + x) }, { x: px, y: depth }] });
    }
    for (let y = 0; y <= baysY; y += 1) {
      const py = depth / Math.max(1, baysY) * y;
      gridLines.push({ role: "grid", closed: false, points: [{ x: 0, y: py, label: String(y + 1) }, { x: width, y: py }] });
    }
    const pdf = await createCorporateTechnicalPdf({
      projectName: project.name,
      projectCode: project.id,
      module: "ARKEMX / YAPISAL ON TASARIM",
      drawingTitle: `${SYSTEM_LABELS[system]} Aks ve Ön Boyutlandırma Paftası`,
      drawingSubtitle: `${DESIGN_BASIS[designBasis].label} / ${soilClass} zemin / ${floors} kat`,
      revision: project.revision,
      status: "Kavramsal / ön boyutlandırma",
      sheetNo: "STR-001",
      scale: "OTOMATIK / METRE",
      coordinateSystem: project.coordinateReference,
      checkedBy: "Yetkili mühendis doğrulaması gerekli",
      polylines: [
        ...gridLines,
        { role: "primary", points: [{ x: 0, y: 0 }, { x: width, y: 0 }, { x: width, y: depth }, { x: 0, y: depth }] },
      ],
      metrics: [
        ["Toplam alan", `${result.geometry.totalArea.toFixed(1)} m²`],
        ["Kat / yükseklik", `${floors} / ${result.geometry.height.toFixed(2)} m`],
        ["Aks düzeni", `${baysX} × ${baysY}`],
        ["Maks. açıklık", `${result.geometry.maxSpan.toFixed(2)} m`],
        ["G + Q", `${result.loads.serviceAreaLoad.toFixed(2)} kN/m²`],
        ["Sismik kütle", `${Math.round(result.loads.seismicMassTonnes)} t`],
        ["V114 sistem puanı", `${activeAlternative.score.toFixed(1)} / 100`],
        ["Göreli maliyet / süre", `${activeAlternative.indices.relativeCost.toFixed(0)} / ${activeAlternative.indices.durationWeeks.toFixed(1)} hf`],
        ["Kontrol özeti", `${checkCounts.pass}G / ${checkCounts.review}İ / ${checkCounts.block}K`],
      ],
      notes: [
        `${DESIGN_BASIS[designBasis].references.join(", ")} referans ailesi ön değerlendirme için seçilmiştir.`,
        `Malzeme girdileri: fck ${concreteStrength} MPa, fy ${steelYield} MPa; taşıyıcı sistem ${SYSTEM_LABELS[system]}.`,
        `Ön miktarlar: beton ${result.quantities.concreteVolume.toFixed(1)} m³, donatı ${result.quantities.reinforcementTonnage.toFixed(1)} t, çelik ${result.quantities.steelTonnage.toFixed(1)} t.`,
        `V114 ön boyutlandırma: ${activeAlternative.preliminary.column}; ${activeAlternative.preliminary.beam}; ${activeAlternative.preliminary.floor}.`,
        "Nihai analiz; geometri, zemin, yük, stabilite, birleşim, temel, yangın ve uygulama verileriyle yetkili mühendis tarafından kurulmalıdır.",
      ],
      legend: [["Yapı oturumu", "primary"], ["Aks sistemi", "grid"]],
    });
    downloadTextFile("arkem-yapisal-on-tasarim-kurumsal-pafta.pdf", pdf, "application/pdf");
  };
  const importUpstream = useCallback(() => {
    const source = thread.canonical;
    const architecture = project.modules["architectural-program"] as { architecturalScheme?: { schema?: string; plate?: { width?: number; depth?: number; floors?: number; floorHeight?: number }; program?: { use?: string } } } | undefined;
    const scheme = architecture?.architecturalScheme;
    const plate = scheme?.schema === "ARKEM-ARCH-SCHEME/3.0" ? scheme.plate : undefined;
    const comparison = project.modules["system-comparison"] as { shortlist?: unknown[]; ranking?: Array<{ id?: unknown; name?: unknown; score?: unknown }> } | undefined;
    const shortlistIds = Array.isArray(comparison?.shortlist) ? comparison.shortlist.filter(isStructuralSystem) : [];
    const rankedShortlist = Array.isArray(comparison?.ranking)
      ? comparison.ranking.filter((item) => isStructuralSystem(item.id) && shortlistIds.includes(item.id as StructuralSystem)).map((item) => ({
          id: item.id as StructuralSystem,
          name: typeof item.name === "string" ? item.name : SYSTEM_LABELS[item.id as StructuralSystem],
          score: typeof item.score === "number" ? item.score : 0,
        }))
      : [];
    const shortlistItems: StructuralShortlistItem[] = rankedShortlist.length
      ? rankedShortlist
      : shortlistIds.map((id) => ({ id, name: SYSTEM_LABELS[id], score: 0 }));
    setMcdaShortlist(shortlistItems);
    const planInput = sourceGeometry?.handoff?.id === "H-03" ? sourceGeometry.input : undefined;
    if (typeof planInput?.width === "number") setWidth(planInput.width); else if (typeof plate?.width === "number") setWidth(Math.max(6, Math.min(80, plate.width))); else if (source.structure.width > 0) setWidth(Math.max(6, Math.min(80, source.structure.width)));
    if (typeof planInput?.depth === "number") setDepth(planInput.depth); else if (typeof plate?.depth === "number") setDepth(Math.max(6, Math.min(60, plate.depth))); else if (source.structure.depth > 0) setDepth(Math.max(6, Math.min(60, source.structure.depth)));
    if (typeof plate?.floors === "number") setFloors(Math.max(1, Math.min(20, plate.floors))); else if (source.architecture.floors > 0) setFloors(Math.max(1, Math.min(20, source.architecture.floors)));
    if (typeof plate?.floorHeight === "number") setFloorHeight(Math.max(2.6, Math.min(8, plate.floorHeight))); else if (source.architecture.floorHeight > 0) setFloorHeight(Math.max(2.6, Math.min(8, source.architecture.floorHeight)));
    if (source.structure.baysX > 0) setBaysX(Math.max(1, Math.min(12, source.structure.baysX)));
    if (source.structure.baysY > 0) setBaysY(Math.max(1, Math.min(10, source.structure.baysY)));
    const recommended = source.structure.recommendedSystem.toLocaleLowerCase("tr-TR");
    if (shortlistItems[0]) setSystem(shortlistItems[0].id);
    else if (recommended.includes("hafif")) setSystem("light"); else if (recommended.includes("prefabrik")) setSystem("precast"); else if (recommended === "betonarme" || recommended.includes("concrete")) setSystem("concrete"); else if (recommended.includes("karma")) setSystem("hybrid"); else if (recommended.includes("çelik")) setSystem("steel");
    const projectUse = scheme?.program?.use || source.architecture.use;
    if (projectUse) setUsage(resolveStructuralUsage(projectUse));
    setSyncStatus(shortlistItems.length
      ? "Plan geometrisi ve MCDA kısa listesi aktarıldı · " + shortlistItems.length + " sistem"
      : plate ? "V113 mekânsal şeması, çekirdek ve plaka geometrisi aktarıldı"
      : source.structure.baysX || source.architecture.grossArea ? "Plan ve mimari program verisi aktarıldı"
      : "Aktarılacak üst model verisi bulunamadı");
  }, [project.modules, thread.canonical, sourceGeometry]);

  useEffect(() => {
    if (!hydrated || !project.experience.autoHandoff) return;
    const saved = project.modules["structural-concept"] as { handoff?: { synchronizedAt?: string } } | undefined;
    const synchronizedAt = saved?.handoff?.synchronizedAt ?? "";
    if (!synchronizedAt || handoffSeen.current === synchronizedAt) return;
    handoffSeen.current = synchronizedAt;
    importUpstream();
  }, [hydrated, importUpstream, project.experience.autoHandoff, project.modules]);

  useEffect(() => {
    if (!hydrated || transferApplied.current) return;
    transferApplied.current = true;
    const timer = window.setTimeout(() => {
    const saved = project.modules["structural-concept"] as { input?: Partial<StructuralConceptInput>; designBasis?: keyof typeof DESIGN_BASIS; soilClass?: string; structuralStudio?: { production?: { repetition?: number; transportDistance?: number; fireRating?: number } }; mcdaShortlist?: StructuralShortlistItem[] } | undefined;
    const value = saved?.input;
    let explicitShortlist: StructuralShortlistItem[] = [];
    try {
      const key = "arkemx-structural-transfer:" + project.id;
      const raw = window.sessionStorage.getItem(key);
      const parsed = raw ? JSON.parse(raw) as { schema?: string; projectId?: string; shortlist?: Array<{ id?: unknown; name?: unknown; score?: unknown }> } : {};
      if (parsed.schema === "ARKEM-MCDA-STRUCTURAL-TRANSFER/1.0" && parsed.projectId === project.id && Array.isArray(parsed.shortlist)) {
        explicitShortlist = parsed.shortlist.filter((item) => isStructuralSystem(item.id)).map((item) => ({
          id: item.id as StructuralSystem,
          name: typeof item.name === "string" ? item.name : SYSTEM_LABELS[item.id as StructuralSystem],
          score: typeof item.score === "number" ? item.score : 0,
        }));
        window.sessionStorage.removeItem(key);
      }
    } catch {
      explicitShortlist = [];
    }
    if (explicitShortlist.length) {
      importUpstream();
      setMcdaShortlist(explicitShortlist);
      setSystem(explicitShortlist[0].id);
      if (typeof saved?.structuralStudio?.production?.repetition === "number") setRepetition(saved.structuralStudio.production.repetition);
      if (typeof saved?.structuralStudio?.production?.transportDistance === "number") setTransportDistance(saved.structuralStudio.production.transportDistance);
      if (typeof saved?.structuralStudio?.production?.fireRating === "number") setFireRating(saved.structuralStudio.production.fireRating);
      if (saved?.designBasis) setDesignBasis(saved.designBasis);
      if (saved?.soilClass) setSoilClass(saved.soilClass);
      setSyncStatus("MCDA kısa listesi ve güncel plan geometrisi aktarıldı · " + explicitShortlist.length + " sistem");
    } else if (value) {
      if (value.system) setSystem(value.system);
      if (value.usage) setUsage(value.usage);
      if (typeof value.width === "number") setWidth(value.width);
      if (typeof value.depth === "number") setDepth(value.depth);
      if (typeof value.floors === "number") setFloors(value.floors);
      if (typeof value.floorHeight === "number") setFloorHeight(value.floorHeight);
      if (typeof value.baysX === "number") setBaysX(value.baysX);
      if (typeof value.baysY === "number") setBaysY(value.baysY);
      if (typeof value.columnSize === "number") setColumnSize(value.columnSize);
      if (typeof value.beamDepth === "number") setBeamDepth(value.beamDepth);
      if (typeof value.slabThickness === "number") setSlabThickness(value.slabThickness);
      if (typeof value.superDeadLoad === "number") setSuperDeadLoad(value.superDeadLoad);
      if (typeof value.liveLoad === "number") setLiveLoad(value.liveLoad);
      if (typeof saved?.structuralStudio?.production?.repetition === "number") setRepetition(saved.structuralStudio.production.repetition);
      if (typeof saved?.structuralStudio?.production?.transportDistance === "number") setTransportDistance(saved.structuralStudio.production.transportDistance);
      if (typeof saved?.structuralStudio?.production?.fireRating === "number") setFireRating(saved.structuralStudio.production.fireRating);
      if (saved?.designBasis) setDesignBasis(saved.designBasis);
      if (saved?.soilClass) setSoilClass(saved.soilClass);
      if (Array.isArray(saved?.mcdaShortlist)) setMcdaShortlist(saved.mcdaShortlist.filter((item) => isStructuralSystem(item.id)));
      setSyncStatus("Kayıtlı taşıyıcı ön tasarım otomatik açıldı");
    } else {
      importUpstream();
    }
    setModelHydrated(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [hydrated, importUpstream, project.modules]);

  const activateAlternative = (alternative: (typeof alternatives)[number]) => {
    setSystem(alternative.system);
    setColumnSize(alternative.preliminary.numeric.columnSize);
    setBeamDepth(alternative.preliminary.numeric.beamDepth);
    setSlabThickness(alternative.preliminary.numeric.slabThickness);
  };

  if (analysisBlocked) return <section className="structural-designer engineering-workbench" data-testid="structural-designer">
    <p role="alert" data-testid="nonuniform-floor-warning">Kaynak veya kat geometrisi mevcut uniform kat motoruyla analiz edilemiyor; kaynak doğrulaması veya kat bazlı analiz gerekiyor. Hesap aktarımı ve PDF/CSV teknik sonuç ihracı engellendi.</p>
    <ProjectKernelBar module="STRUCTURAL" moduleKey="structural-concept" confidence="Kat bazlı analiz bekleniyor" compact={compactKernel} />
    <h2>Kayıtlı kaynak</h2>
    {invalidSource ? <p>Kaynak ölçüleri doğrulanmadı; geometri sonucu gösterilmiyor.</p> : <><p>Seçili kat: K{sourceGeometry?.modelContext?.selectedLevel} · {width} × {depth} m</p>
    <ul>{floorGeometry.map(plate => <li key={plate.level}>K{plate.level}: {plate.width} × {plate.depth} m</li>)}</ul></>}
    <a href="/plan-ve-aks">Plan ve aks ekranına dön</a>
    <button type="button" onClick={exportJson}>Girdileri ve analiz sınırını indir</button>
  </section>;
  return <section className={`structural-designer engineering-workbench${home ? " home-designer" : ""}`} data-testid="structural-designer">
    {analysisBlocked ? <p role="alert" data-testid="nonuniform-floor-warning">Katlara göre değişen geometri korunuyor; bu ön hesap motoru farklı kat plakalarını analiz edemiyor. Görüntü kavramsaldır; hesap aktarımı ve PDF/CSV teknik sonuç ihracı engellendi.</p> : null}
    <ProjectKernelBar moduleKey="structural-concept" module="STRUCTURAL CONCEPT STUDIO 2.0" confidence="Beş sistem / ön boyutlandırma" compact={compactKernel} />
    <div className="designer-head"><div><p className="eyebrow">V114 / Taşıyıcı Sistem Stüdyosu 2.0</p><h2>Aynı geometriyi kurun.<br/><em>Beş sistemi ölçerek karşılaştırın.</em></h2></div><p>Betonarme, Betonarme Prefabrik, yapısal çelik, hafif çelik ve karma sistemi aynı aks, yük ve mimari şema üzerinde ön boyutlandırın. Maliyet, süre, karbon, kütle ve üretilebilirlik göstergelerini birlikte okuyun; sonuç nihai statik analiz veya uygulama projesi değildir.</p><div className="engineering-sync"><span>DİJİTAL DEVİR TESLİM</span><b>{syncStatus}</b><button onClick={importUpstream}>V113 / Plan / program verisini aktar ↘</button></div></div>
    <div className="v114-source-band" data-state={structuralStudio.source.architecturalSchemeConnected ? structuralStudio.source.authoritativeGeometry ? "verified" : "derived" : "missing"}><div><span>V114 / TAŞIYICI SİSTEM STÜDYOSU 2.0</span><b>{structuralStudio.source.architecturalSchemeConnected ? "V113 mekânsal şeması bağlı" : "V113 mekânsal şeması bulunamadı"}</b><small>{structuralStudio.geometry.width.toFixed(1)} × {structuralStudio.geometry.depth.toFixed(1)} m · {structuralStudio.geometry.floors} kat · {structuralStudio.geometry.maximumSpan.toFixed(1)} m en büyük açıklık</small></div><div><span>{mcdaShortlist.length ? "MCDA KISA LİSTE BAŞLANGICI" : "ÖNERİLEN ÖN İNCELEME"}</span><b>{mcdaShortlist[0]?.name ?? structuralStudio.recommendation.label}</b><small>{mcdaShortlist[0] ? mcdaShortlist[0].score.toFixed(1) + " / 100 · kullanıcı kısa listesi" : structuralStudio.recommendation.score.toFixed(1) + " / 100 · sistem kararı değildir"}</small></div><div><span>AKTİF ÖN BOYUTLANDIRMA</span><b>{activeAlternative.preliminary.column}</b><small>{activeAlternative.preliminary.beam}</small></div></div>
    {mcdaShortlist.length ? <div className="engineering-mcda-handoff" role="status"><div><span>MCDA KISA LİSTESİ · {mcdaShortlist.length}</span><b>Ön tasarım seçili alternatiflerle başladı.</b></div><div>{mcdaShortlist.map((item) => <span key={item.id} className={system === item.id ? "active" : ""}>{item.name}<small>{item.score.toFixed(1)}</small></span>)}</div></div> : null}
    <div className="designer-workspace engineering-layout">
      <aside className="engineering-controls">
        <div className="designer-tabs">{(Object.keys(SYSTEM_LABELS) as StructuralSystem[]).map((key) => <button key={key} className={[system === key ? "active" : "", mcdaShortlist.some((item) => item.id === key) ? "shortlisted" : ""].filter(Boolean).join(" ")} onClick={() => { const alternative = alternatives.find((item) => item.system === key); if (alternative) activateAlternative(alternative); }}>{SYSTEM_LABELS[key]}</button>)}</div>
        <div className="engineering-control-scroll">
          <section><strong>01 / TASARIM ESASI</strong><label><span>Kullanım sınıfı</span><select value={usage} onChange={(event) => setUsage(event.target.value as StructuralConceptInput["usage"])}>{Object.entries(usageLabels).map(([key, label]) => <option value={key} key={key}>{label}</option>)}</select></label><label><span>Standart paketi</span><select value={designBasis} onChange={(event) => setDesignBasis(event.target.value as keyof typeof DESIGN_BASIS)}>{Object.entries(DESIGN_BASIS).map(([key, value]) => <option value={key} key={key}>{value.label}</option>)}</select></label><div className="basis-reference">{DESIGN_BASIS[designBasis].references.map((reference) => <span key={reference}>{reference}</span>)}</div></section>
          <section><strong>02 / GEOMETRİ & AKS</strong><div className="engineering-field-grid"><NumericField label="Genişlik" value={width} min={6} max={80} step={.5} unit="m" onChange={setWidth}/><NumericField label="Derinlik" value={depth} min={6} max={60} step={.5} unit="m" onChange={setDepth}/><NumericField label="Kat adedi" value={floors} min={1} max={20} step={1} onChange={setFloors}/><NumericField label="Kat yüksekliği" value={floorHeight} min={2.6} max={8} step={.1} unit="m" onChange={setFloorHeight}/><NumericField label="X açıklık adedi" value={baysX} min={1} max={12} step={1} onChange={setBaysX}/><NumericField label="Y açıklık adedi" value={baysY} min={1} max={10} step={1} onChange={setBaysY}/></div><div className="engineering-inline-output"><span>X açıklığı<b>{result.geometry.spanX.toFixed(2)} m</b></span><span>Y açıklığı<b>{result.geometry.spanY.toFixed(2)} m</b></span><span>Toplam yükseklik<b>{result.geometry.height.toFixed(2)} m</b></span></div></section>
          <section><strong>03 / KESİT & MALZEME</strong><div className="engineering-field-grid"><NumericField label="Kolon eni" value={columnSize} min={.12} max={1.2} step={.05} unit="m" onChange={setColumnSize}/><NumericField label="Kiriş yüksekliği" value={beamDepth} min={.25} max={1.5} step={.05} unit="m" onChange={setBeamDepth}/><NumericField label="Döşeme" value={slabThickness} min={.08} max={.4} step={.01} unit="m" onChange={setSlabThickness}/></div><div className="engineering-field-grid"><label><span>Beton</span><select value={concreteStrength} onChange={(event) => setConcreteStrength(Number(event.target.value))}>{[25,30,35,40,45,50].map((value) => <option value={value} key={value}>C{value}/{value + (value < 40 ? 7 : 10)}</option>)}</select></label><label><span>Yapı çeliği</span><select value={steelYield} onChange={(event) => setSteelYield(Number(event.target.value))}>{[275,355,460].map((value) => <option value={value} key={value}>S{value}</option>)}</select></label></div></section>
          <section><strong>04 / YÜKLER</strong><div className="engineering-field-grid"><NumericField label="Ek sabit yük" value={superDeadLoad} min={.5} max={8} step={.1} unit="kN/m²" onChange={setSuperDeadLoad}/><NumericField label="Hareketli yük" value={liveLoad} min={1.5} max={15} step={.5} unit="kN/m²" onChange={setLiveLoad}/><NumericField label="Kar yükü" value={roofSnowLoad} min={0} max={5} step={.05} unit="kN/m²" onChange={setRoofSnowLoad}/><NumericField label="Temel rüzgâr hızı" value={basicWindSpeed} min={20} max={55} step={1} unit="m/s" onChange={setBasicWindSpeed}/></div></section>
          <section><strong>05 / DEPREM ÖN GİRDİSİ</strong><div className="engineering-field-grid"><NumericField label="SDS" value={sds} min={.1} max={2.5} step={.05} onChange={setSds}/><NumericField label="SD1" value={sd1} min={.05} max={1.5} step={.05} onChange={setSd1}/><NumericField label="I" value={importance} min={1} max={1.5} step={.1} onChange={setImportance}/><NumericField label="R" value={behaviorFactor} min={2} max={8} step={.5} onChange={setBehaviorFactor}/></div><label><span>Zemin sınıfı</span><select value={soilClass} onChange={(event) => setSoilClass(event.target.value)}>{["ZA","ZB","ZC","ZD","ZE","ZF / sahaya özel"].map((value) => <option key={value}>{value}</option>)}</select></label><p className="engineering-caution">SDS ve SD1 değerleri burada kullanıcı girdisidir. Koordinata bağlı AFAD tehlike verisi ve zemin etüdü doğrulanmadan proje değeri sayılmaz.</p></section>
          <section><strong>06 / ÜRETİM, YANGIN & LOJİSTİK</strong><div className="engineering-field-grid"><NumericField label="Tekrar oranı" value={repetition} min={0} max={100} step={5} unit="%" onChange={setRepetition}/><NumericField label="Taşıma mesafesi" value={transportDistance} min={0} max={2000} step={10} unit="km" onChange={setTransportDistance}/><NumericField label="Yangın hedefi" value={fireRating} min={30} max={240} step={30} unit="dk" onChange={setFireRating}/></div><p className="engineering-caution">Süre ve maliyet değerleri göreli ön göstergedir. Fabrika kapasitesi, taşıma güzergâhı, vinç erişimi, yangın senaryosu ve güncel tekliflerle doğrulanmalıdır.</p></section>
        </div>
      </aside>
      <main className="engineering-stage">
        <header className="engineering-toolbar"><div>{(["model","alternatives","loads","checks","quantities"] as WorkspaceView[]).map((item) => <button key={item} className={view === item ? "active" : ""} onClick={() => setView(item)}>{item === "model" ? "Analitik model" : item === "alternatives" ? "Sistem alternatifleri" : item === "loads" ? "Yük izi" : item === "checks" ? "Ön kontroller" : "Miktar / çıktı"}</button>)}</div><div><button className={showSlabs ? "active" : ""} onClick={() => setShowSlabs((value) => !value)}>Döşeme</button><button className={showLoads ? "active" : ""} onClick={() => setShowLoads((value) => !value)}>Yük oku</button></div></header>
        <div className="engineering-viewport">
          <div className={`designer-canvas${webglState === "fallback" ? " is-fallback" : ""}`} ref={hostRef}>{webglState !== "ready" && <StructuralFallback input={input}/>}<div className="engineering-model-id"><span>{webglState === "ready" ? "CANLI WEBGL MODEL" : "TEKNİK SVG MODEL"}</span><b>{SYSTEM_LABELS[system]} · {floors} kat · {baysX}×{baysY} açıklık</b></div><small>{webglState === "ready" ? "Döndür: sürükle · Yaklaş: kaydır · Kaydır: sağ tuş" : "Grafik desteğinden bağımsız hesap ve çıktı modu"}</small></div>
          <div className="engineering-kpis"><article><small>Toplam alan</small><strong>{structuralStudio.geometry.totalArea.toLocaleString("tr-TR")} m²</strong></article><article><small>En büyük açıklık</small><strong>{structuralStudio.geometry.maximumSpan.toFixed(2)} m</strong></article><article><small>{mcdaShortlist.length ? "Kısa liste başlangıcı" : "Önerilen ön inceleme"}</small><strong>{mcdaShortlist[0]?.name ?? structuralStudio.recommendation.label}</strong></article><article><small>Aktif maliyet / süre*</small><strong>{activeAlternative.indices.relativeCost.toFixed(0)} · {activeAlternative.indices.durationWeeks.toFixed(1)} hf</strong></article></div>
        </div>
        {view === "model" && <section className="engineering-panel model-panel"><header><div><span>MODEL ÖZETİ</span><b>Parametrik taşıyıcı sistem veri tablosu</b></div><small>{DESIGN_BASIS[designBasis].label} · {soilClass}</small></header><div className="engineering-data-grid">{[["Kat alanı", `${result.geometry.floorArea.toFixed(1)} m²`],["Kolon / kat", `${result.geometry.columnsPerFloor}`],["En büyük açıklık", `${result.geometry.maxSpan.toFixed(2)} m`],["Yükseklik / genişlik", `${(result.geometry.height / Math.max(width, depth)).toFixed(3)}`],["Sismik ağırlık", `${Math.round(result.loads.seismicWeight).toLocaleString("tr-TR")} kN`],["Rüzgâr basınç göstergesi", `${result.loads.windPressureProxy.toFixed(2)} kN/m²`]].map(([label, value]) => <p key={label}><span>{label}</span><b>{value}</b></p>)}</div><p className="engineering-definition">Analitik model; geometri, yük kabulleri ve ön boyutlandırma arasındaki tutarlılığı sınar. Rijit diyafram, düzensizlik, temel–zemin etkileşimi, birleşim ve ikinci mertebe etkileri nihai analiz modelinde ayrıca tanımlanır.</p></section>}
        {view === "alternatives" && <section className="engineering-panel structural-alternatives v114-alternatives" data-previous-contract="V84 / TAŞIYICI SİSTEM KARŞILAŞTIRMASI"><header><div><span>V114 / TAŞIYICI SİSTEM STÜDYOSU 2.0</span><b>Aynı V113 geometrisi üzerinde beş sistem ve Ön boyutlandırma</b></div><small>Ön eleme · nihai sistem kararı değildir</small></header><div className="v114-recommendation"><span>EN YÜKSEK BİLEŞİK PUAN</span><b>{structuralStudio.recommendation.label} · {structuralStudio.recommendation.score.toFixed(1)}</b><p>{structuralStudio.recommendation.reason}</p></div><div className="v114-alternative-grid">{alternatives.map((alternative, index) => <article className={system === alternative.system ? "active" : ""} data-state={alternative.status} key={alternative.system}><header><span>{String(index + 1).padStart(2, "0")} / {alternative.system.toLocaleUpperCase("tr-TR")}</span><b>{alternative.label}</b>{system === alternative.system && <em>MODELLENİYOR</em>}</header><p className="v114-system-description">{alternative.description}</p><div className="v114-score"><strong>{alternative.score.toFixed(1)}</strong><span>{alternative.status === "fits" ? "uygun ön inceleme" : alternative.status === "review" ? "uzman incelemesi" : "kritik kısıt"}</span></div><dl><div><dt>Göreli maliyet*</dt><dd>{alternative.indices.relativeCost.toFixed(0)}</dd></div><div><dt>Taşıyıcı süre*</dt><dd>{alternative.indices.durationWeeks.toFixed(1)} hf</dd></div><div><dt>Karbon göstergesi*</dt><dd>{(alternative.indices.embodiedCarbonProxy / 1000).toFixed(0)} tCO₂e</dd></div><div><dt>Fabrika payı</dt><dd>%{alternative.indices.factoryShare.toFixed(0)}</dd></div><div><dt>Göreli kütle</dt><dd>{alternative.indices.massIndex.toFixed(0)}</dd></div><div><dt>Ön kontrol</dt><dd className={alternative.criticalChecks ? "risk" : alternative.reviewChecks ? "watch" : "good"}>{alternative.criticalChecks} kritik · {alternative.reviewChecks} incele</dd></div></dl><div className="v114-preliminary"><span>ÖN BOYUTLANDIRMA</span><p><b>Kolon</b>{alternative.preliminary.column}</p><p><b>Kiriş</b>{alternative.preliminary.beam}</p><p><b>Döşeme</b>{alternative.preliminary.floor}</p><p><b>Yatay sistem</b>{alternative.preliminary.lateral}</p></div><p className="v114-risk"><i>!</i>{alternative.risks[0]}</p><button onClick={() => activateAlternative(alternative)}>{system === alternative.system ? "Aktif model ✓" : "Kesitleri modele uygula"}</button></article>)}</div><footer><b>* Göreli göstergeler:</b><p>Maliyet, süre ve karbon; aynı geometri üzerindeki yön karşılaştırmasıdır. Güncel keşif / teklif, üretici EPD’si, nakliye senaryosu, şantiye programı ve EN 15978 kapsamlı sertifikalı LCA sonucu değildir.</p></footer></section>}
        {view === "loads" && <section className="engineering-panel"><header><div><span>YÜK İZİ & KOMBİNASYONLAR</span><b>Her sonucun formülü ve birimi görünür</b></div><small>Ön değerlendirme</small></header><div className="load-trace-table"><div className="head"><span>KOD</span><span>FORMÜL / KABUL</span><span>SONUÇ</span></div>{result.trace.map((row) => <div key={row.code}><b>{row.code}</b><span>{row.formula}</span><strong>{row.result}</strong></div>)}</div><div className="engineering-load-cards"><article><span>SERVİS</span><b>{result.loads.serviceAreaLoad.toFixed(2)} kN/m²</b><small>G + Q</small></article><article><span>DEPREM KÜTLESİ</span><b>{Math.round(result.loads.seismicMassTonnes).toLocaleString("tr-TR")} t</b><small>Kullanım katılım katsayılı</small></article><article><span>TABAN KESME*</span><b>{Math.round(result.dynamics.baseShearProxy).toLocaleString("tr-TR")} kN</b><small>Spektral talep göstergesi</small></article><article><span>KOLON PAYI*</span><b>{Math.round(result.loads.tributaryColumn).toLocaleString("tr-TR")} kN</b><small>Eşit dağılım varsayımı</small></article></div></section>}
        {view === "checks" && <section className="engineering-panel v114-check-panel"><header><div><span>V114 / KARAR VE KAYNAK KONTROLLERİ</span><b>Geometri · sistem · deprem · yangın · üretim</b></div><small>{structuralStudio.checks.filter((check) => check.state === "pass").length}/{structuralStudio.checks.length} doğrudan geçti</small></header><div className="engineering-checks v114-checks">{structuralStudio.checks.map((check) => <article className={check.state === "risk" ? "block" : check.state} key={check.code}><i>{check.state === "pass" ? "✓" : check.state === "review" ? "!" : "×"}</i><div><span>{check.code}</span><b>{check.label}</b><p>{check.note}</p></div><strong>{check.value}</strong><small>{check.state === "pass" ? "kayıtlı" : check.state === "review" ? "doğrulama gerekli" : "kritik veri"}</small></article>)}</div><header className="v114-detail-head"><div><span>AKTİF SİSTEM ÖN KONTROLÜ</span><b>{activeAlternative.label} · kesit ve talep göstergeleri</b></div><small>{checkCounts.pass} geçti / {checkCounts.review} incele / {checkCounts.block} kritik</small></header><div className="engineering-checks">{result.checks.map((check) => <article className={check.state} key={check.id}><i>{check.state === "pass" ? "✓" : check.state === "review" ? "!" : "×"}</i><div><b>{check.title}</b><p>{check.note}</p></div><strong>{check.value}</strong><small>{check.limit}</small></article>)}</div></section>}
        {view === "quantities" && <section className="engineering-panel"><header><div><span>MİKTAR & AÇIK FORMAT ÇIKTI</span><b>Model girdisine bağlı ön miktarlar</b></div><small>Revizyonlanabilir veri</small></header><div className="quantity-board"><article><span>Beton</span><b>{result.quantities.concreteVolume.toFixed(1)} m³</b><small>Taşıyıcı ön hacim</small></article><article><span>Donatı</span><b>{result.quantities.reinforcementTonnage.toFixed(1)} t</b><small>Katsayılı ön miktar</small></article><article><span>Yapı çeliği</span><b>{result.quantities.steelTonnage.toFixed(1)} t</b><small>Sistem yoğunluk göstergesi</small></article><article><span>Çatı alanı</span><b>{result.quantities.rainRoofArea.toFixed(0)} m²</b><small>Su / enerji ön girdisi</small></article></div><div className="engineering-export-actions"><button onClick={exportPdf}><span>PDF</span><b>A3 kurumsal teknik pafta</b><i>↓</i></button><button onClick={exportDxf}><span>CAD</span><b>DWG uyumlu katmanlı DXF</b><i>↓</i></button><button onClick={exportJson}><span>JSON</span><b>Tüm girdiler + izlenebilir sonuç</b><i>↓</i></button><button onClick={exportCsv}><span>CSV</span><b>Ön boyutlandırma tablosu</b><i>↓</i></button></div></section>}
      </main>
    </div>
    <footer className="engineering-disclaimer"><b>Hesap sınırı</b><p>Bu motor ön fizibilite, veri hazırlığı ve alternatif karşılaştırması içindir. Sonuçlar; yetkili mühendis tarafından doğrulanmış geometri, zemin, deprem, rüzgâr, kar, kullanım, yangın, stabilite, birleşim ve temel verileriyle kurulacak hesap modelinin yerine geçmez. “*” işaretli değerler yönetmelik sonucu değil, talep büyüklüğünü görünür kılan göstergelerdir.</p></footer>
    {home && <div className="designer-home-more"><a href="/tasarim-calismalari">Tam ekran stüdyoyu, plan editörünü, BIM ve VR karar akışını açın <span>↗</span></a></div>}
  </section>;
}

