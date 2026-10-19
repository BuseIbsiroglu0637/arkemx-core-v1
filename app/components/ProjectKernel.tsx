"use client";

import Link from "next/link";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { downloadTextFile } from "../lib/engineering";
import {
  deriveGuidedProjectRoadmap,
  type GuidedProjectIntake,
} from "../lib/guided-project";
import {
  deriveProjectCore,
  ensureProjectModuleStamps,
  stampProjectModule,
  type ProjectCoreSnapshot,
} from "../lib/project-core";
import { deriveProjectThread, type ProjectThread } from "../lib/project-graph";
import { loadProjectFromStorage, saveProjectToStorage } from "../lib/project-storage";
import { DEMO_ENABLED } from "../lib/demo";
import { loadProjectLibrary, saveLibraryProject } from "../lib/project-library";
import { decodeProjectEnvelope } from "../lib/project-storage";
import { isKernelProject } from "../lib/project-validation";

type ProjectPhase = "Fikir" | "Ön fizibilite" | "Avan proje" | "Uygulama projesi" | "Yapım" | "Teslim";
export type ProjectExperienceMode = "guided" | "technical";
export type ProjectExperience = {
  mode: ProjectExperienceMode;
  autoHandoff: boolean;
  lastSynchronizedAt: string;
};

export type ProjectKernelEvent = {
  id: string;
  module: string;
  action: "create" | "update" | "remove" | "import" | "handoff";
  revision: string;
  timestamp: string;
};

export type ProjectKernelState = {
  schema: "ARKEM-PROJECT/1.0";
  id: string;
  name: string;
  revision: string;
  phase: ProjectPhase;
  coordinateReference: string;
  updatedAt: string;
  experience: ProjectExperience;
  modules: Record<string, unknown>;
  events: ProjectKernelEvent[];
};

export type ProjectIntake = GuidedProjectIntake;

type ProjectKernelContextValue = {
  project: ProjectKernelState;
  thread: ProjectThread;
  core: ProjectCoreSnapshot;
  hydrated: boolean;
  savedProjects: ProjectKernelState[];
  libraryError: string;
  openSavedProject: (id: string) => boolean;
  createNamedProject: (name: string) => boolean;
  persistence: {
    state: "loading" | "device-saved" | "recovered" | "unavailable";
    integrity: "verified" | "legacy" | "missing";
    lastSavedAt: string;
    backupAvailable: boolean;
    cloud: "not-configured";
  };
  setIdentity: (patch: Partial<Pick<ProjectKernelState, "name" | "revision" | "phase" | "coordinateReference">>) => void;
  setExperience: (patch: Partial<ProjectExperience>) => void;
  patchModule: (key: string, value: unknown) => void;
  applyHandoff: (handoffId: string) => boolean;
  synchronizeProject: () => number;
  removeModule: (key: string) => void;
  importProject: (value: unknown) => boolean;
  startProject: (intake: ProjectIntake, updateExisting?: boolean) => void;
  reset: () => void;
};

const STORAGE_KEY = "arkem-demo-v177-legacy";
export const PROJECT_JOURNEY = [
  { label: "İhtiyacı tanımla", short: "Brief", output: "Proje hedefi", href: "/proje-baslat", modules: ["DECISION", "BRIEF", "START"], projectKeys: ["decision-assistant"] },
  { label: "Parseli doğrula", short: "Arazi", output: "Konum + sınır", href: "/arsa-fizibilite-studyosu", modules: ["GEO", "PARCEL", "SITE"], projectKeys: ["geo-parcel", "quick-site-scenario"] },
  { label: "Mimari programı kur", short: "Mimari", output: "Alan + mahal + plan", href: "/mimari-program-studyosu", modules: ["ARCHITECT", "PROGRAM", "PLAN"], projectKeys: ["architectural-program", "plan-editor"] },
  { label: "Sistemi ve yöntemi seç", short: "Sistem", output: "Taşıyıcı karar", href: "/yapi-sistemi-karsilastirma", modules: ["MCDA", "STRUCTURAL", "DEMOLITION", "SYSTEM"], projectKeys: ["system-comparison", "demolition-screening"] },
  { label: "Tasarımı koordine et", short: "Koordinasyon", output: "Ortak model", href: "/muhendislik-koordinasyon", modules: ["COORDINATION", "ENGINEERING", "CAD"], projectKeys: ["structural-concept", "engineering-coordination"] },
  { label: "Süre ve maliyeti yönet", short: "Planlama", output: "4B + bütçe", href: "/proje-os", modules: ["PROJECT OS", "4D", "COST"], projectKeys: ["project-os"] },
  { label: "Dijital teslimi tamamla", short: "Teslim", output: "Onaylı paket", href: "/dijital-proje-merkezi", modules: ["DIGITAL", "DELIVERY", "CDE"], projectKeys: ["digital-delivery-scope", "model-library-review"] },
] as const;

const createDefaultProject = (): ProjectKernelState => ({
  schema: "ARKEM-PROJECT/1.0",
  id: "ARK-26-0001",
  name: "Yeni Yapı Yatırımı",
  revision: "P01",
  phase: "Ön fizibilite",
  coordinateReference: "WGS84 / EPSG:4326",
  updatedAt: new Date(0).toISOString(),
  experience: {
    mode: "guided",
    autoHandoff: true,
    lastSynchronizedAt: "",
  },
  modules: {},
  events: [],
});

function createProjectCode(now = new Date()) {
  return `ARK-${String(now.getFullYear()).slice(-2)}-${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}-${Math.random().toString(36).slice(2, 5).toUpperCase()}`;
}

function createActiveProject() {
  const timestamp = new Date().toISOString();
  return { ...createDefaultProject(), id: createProjectCode(), updatedAt: timestamp };
}

type UnknownRecord = Record<string, unknown>;

function record(value: unknown): UnknownRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? value as UnknownRecord : {};
}

function numeric(value: unknown, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function stringValue(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function projectUse(value: string) {
  const normalized = value.toLocaleLowerCase("tr-TR");
  if (normalized.includes("konut")) return "residential";
  if (normalized.includes("ofis") || normalized.includes("ticari")) return "office";
  if (normalized.includes("eğitim") || normalized.includes("sosyal")) return "education";
  return normalized && ["industrial", "office", "residential", "education"].includes(normalized) ? normalized : "industrial";
}

function structuralUse(value: string): "residential" | "office" | "industrial" | "storage" | "assembly" {
  const normalized = value.toLocaleLowerCase("tr-TR");
  if (normalized.includes("konut") || normalized === "residential") return "residential";
  if (normalized.includes("ofis") || normalized.includes("ticari") || normalized === "office") return "office";
  if (normalized.includes("depo") || normalized.includes("lojistik") || normalized === "storage") return "storage";
  if (normalized.includes("eğitim") || normalized.includes("sosyal") || normalized.includes("toplanma") || normalized === "assembly") return "assembly";
  return "industrial";
}

function mergeModuleValue(previous: unknown, incoming: unknown) {
  const previousModule = record(previous);
  const incomingModule = record(incoming);
  if (!Object.keys(incomingModule).length) return incoming;
  const merged: UnknownRecord = { ...previousModule, ...incomingModule };
  ["input", "upstream", "source", "siteContext", "programContext", "architectureContext", "modelContext", "coordination"].forEach((key) => {
    if (incomingModule[key] && typeof incomingModule[key] === "object" && !Array.isArray(incomingModule[key])) {
      merged[key] = { ...record(previousModule[key]), ...record(incomingModule[key]) };
    }
  });
  return merged;
}

function structuralSystem(value: string) {
  const normalized = value.toLocaleLowerCase("tr-TR");
  if (normalized.includes("hafif")) return "light";
  if (normalized.includes("karma") || normalized.includes("hybrid")) return "hybrid";
  if (normalized.includes("prefabrik") || normalized.includes("precast")) return "precast";
  if (normalized.includes("çelik") || normalized.includes("steel")) return "steel";
  if (normalized.includes("beton") || normalized.includes("concrete")) return "concrete";
  return ["light", "hybrid", "steel", "precast", "concrete"].includes(normalized) ? normalized : "";
}

function programPlanElements(spaces: unknown[], baysX: number, baysY: number, floors: number, liveLoad: number) {
  const cellsPerFloor = Math.max(1, baysX * baysY);
  const maximumCells = Math.min(cellsPerFloor * Math.max(1, floors), 160);
  const expanded: UnknownRecord[] = [];
  spaces.forEach((value) => {
    const space = record(value);
    const count = Math.max(1, Math.min(24, numeric(space.count, 1)));
    for (let index = 0; index < count && expanded.length < maximumCells; index += 1) expanded.push(space);
  });
  const elements = expanded.map((space, index) => {
    const level = Math.floor(index / cellsPerFloor) + 1;
    const cell = index % cellsPerFloor;
    return {
      id: `program-${stringValue(space.id, "space")}-${index + 1}`,
      type: "space",
      level,
      x: cell % baysX,
      y: Math.floor(cell / baysX),
      orientation: "x",
      label: stringValue(space.name, "Mahal"),
      load: numeric(space.liveLoad, liveLoad),
      fire: "Projede belirlenecek",
      section: "—",
      sourceSpaceId: stringValue(space.id),
      sourceZone: stringValue(space.zone),
    };
  });
  for (let level = 1; level <= Math.max(1, floors); level += 1) {
    elements.push({
      id: `program-core-${level}`,
      type: "core",
      level,
      x: Math.max(0, Math.floor(baysX / 2) - 1),
      y: Math.max(0, Math.floor(baysY / 2) - 1),
      orientation: "x",
      label: "Merdiven / asansör çekirdeği",
      load: liveLoad,
      fire: "REI 120",
      section: "—",
      sourceSpaceId: "vertical-core",
      sourceZone: "Sirkülasyon",
    });
  }
  return elements;
}

const HANDOFF_IDS = ["H-01", "H-02", "H-03", "H-04", "H-05", "H-06"] as const;
const SOURCE_HANDOFFS: Record<string, string[]> = {
  "geo-parcel": ["H-01"],
  "architectural-program": ["H-02"],
  "plan-editor": ["H-03"],
  "system-comparison": ["H-04"],
  "structural-concept": ["H-05"],
  "engineering-coordination": ["H-06"],
};
const HANDOFF_MODULES: Record<string, { source: string; targets: string[] }> = {
  "H-01": { source: "geo-parcel", targets: ["architectural-program"] },
  "H-02": { source: "architectural-program", targets: ["plan-editor", "system-comparison"] },
  "H-03": { source: "plan-editor", targets: ["structural-concept"] },
  "H-04": { source: "system-comparison", targets: ["structural-concept"] },
  "H-05": { source: "structural-concept", targets: ["arkem-x", "engineering-coordination"] },
  "H-06": { source: "engineering-coordination", targets: ["project-os"] },
};

function stampHandoffModules(
  modules: Record<string, unknown>,
  handoffIds: readonly string[],
  identity: { projectId: string; projectRevision: string; recordedAt: string },
) {
  const stamped = { ...modules };
  handoffIds.forEach((handoffId) => {
    const contract = HANDOFF_MODULES[handoffId];
    if (!contract) return;
    contract.targets.forEach((target) => {
      if (!stamped[target]) return;
      stamped[target] = stampProjectModule(stamped[target], {
        ...identity,
        sourceModule: contract.source,
        action: "handoff",
      });
    });
  });
  return stamped;
}

function synchronizeModules(sourceModules: Record<string, unknown>, handoffIds: readonly string[]) {
  const modules = { ...sourceModules };
  const applied: string[] = [];
  const synchronizedAt = new Date().toISOString();

  handoffIds.forEach((handoffId) => {
    const contract = HANDOFF_MODULES[handoffId];
    if (contract && record(modules[contract.source]).needsReview === true) return;
    const thread = deriveProjectThread(modules);

    if (handoffId === "H-01" && modules["geo-parcel"]) {
      const geo = record(modules["geo-parcel"]);
      const metrics = record(geo.metrics);
      if (numeric(metrics.area) <= 1 || metrics.geometryValid === false) return;
      const target = record(modules["architectural-program"]);
      const input = record(target.input);
      const targetGross = numeric(metrics.gross)
        || numeric(metrics.allowedGross)
        || numeric(input.targetGross)
        || thread.canonical.site.proposedGross;
      const nextInput = {
        ...input,
        use: projectUse(stringValue(geo.usage) || thread.canonical.architecture.use),
        targetGross,
        floors: numeric(geo.floors) || numeric(input.floors) || thread.canonical.architecture.floors,
        floorHeight: numeric(geo.floorHeight) || numeric(input.floorHeight) || thread.canonical.architecture.floorHeight,
        parcelReference: stringValue(geo.reference, thread.canonical.site.reference),
        parcelArea: numeric(metrics.area),
        allowedFootprint: numeric(metrics.allowedFootprint),
        allowedGross: numeric(metrics.allowedGross),
        sourceCrs: stringValue(geo.sourceCrs, thread.canonical.site.crs),
        siteContext: {
          parcel: geo.parcel,
          centroid: geo.center,
          buildingFootprint: geo.building,
          buildingWidth: numeric(geo.buildingWidth),
          buildingDepth: numeric(geo.buildingDepth),
          rotation: numeric(geo.rotation),
          offsetEast: numeric(geo.offsetEast),
          offsetNorth: numeric(geo.offsetNorth),
          planning: geo.planning,
          terrain: geo.terrain,
          terrainModel: geo.terrainModel,
          massingModel: geo.massingModel,
          selectedMassingId: stringValue(geo.selectedMassingId),
          dataStatus: stringValue(geo.dataStatus),
        },
      };
      modules["architectural-program"] = {
        ...target,
        input: nextInput,
        handoff: { id: handoffId, source: "geo-parcel", target: "architectural-program", synchronizedAt, sourceRevision: stringValue(geo.revision, "current"), payload: ["parsel sınırı", "koordinat", "kot/topoğrafya", "imar girdisi", "yapı zarfı", "kütle alternatifleri", "kat", "kullanım"], state: "synchronized" },
        status: "Parsel verisi mimari programa bağlandı",
      };
      applied.push(handoffId);
    }

    if (handoffId === "H-02" && modules["architectural-program"]) {
      const architecture = record(modules["architectural-program"]);
      const architectureInput = record(architecture.input);
      const architectureResult = record(architecture.result);
      const architecturalScheme = record(architecture.architecturalScheme);
      const schemePlate = record(architecturalScheme.plate);
      const spaces = Array.isArray(architecture.spaces) ? architecture.spaces : [];
      if (numeric(schemePlate.width) <= 0 && numeric(architectureResult.plateWidth) <= 0 && numeric(architectureResult.grossDemand) <= 0 && !spaces.length) return;
      const target = record(modules["plan-editor"]);
      const targetGross = numeric(architectureInput.targetGross) || numeric(architectureResult.grossDemand) || thread.canonical.architecture.grossArea;
      const floors = numeric(architectureInput.floors) || thread.canonical.architecture.floors || 1;
      const aspect = Math.max(.5, numeric(architectureInput.aspect, 1.45));
      const floorArea = targetGross / Math.max(1, floors);
      const plateDepth = numeric(schemePlate.depth) || numeric(architectureResult.plateDepth) || Math.sqrt(Math.max(floorArea, 1) / aspect);
      const plateWidth = numeric(schemePlate.width) || numeric(architectureResult.plateWidth) || plateDepth * aspect;
      const baysX = Math.max(2, Math.min(16, Math.round(plateWidth / 5)));
      const baysY = Math.max(2, Math.min(16, Math.round(plateDepth / 5)));
      const existingElements = Array.isArray(target.elements) ? target.elements : [];
      const generatedElements = existingElements.length
        ? existingElements
        : programPlanElements(spaces, baysX, baysY, floors, numeric(architectureResult.liveLoad, 3.5));
      modules["plan-editor"] = {
        ...target,
        level: Math.min(numeric(target.level, 1), floors),
        floorCount: floors,
        baysX,
        baysY,
        spanX: Number((plateWidth / baysX).toFixed(3)),
        spanY: Number((plateDepth / baysY).toFixed(3)),
        elements: generatedElements,
        programContext: {
          spaces,
          relationships: architecture.relationships,
          architecturalScheme: architecture.architecturalScheme,
          checks: architecture.checks,
          siteContext: architectureInput.siteContext,
          generatedElementCount: existingElements.length ? 0 : generatedElements.length,
        },
        handoff: { id: handoffId, source: "architectural-program", target: "plan-editor", synchronizedAt, payload: ["mahal listesi", "zonlar", "komşuluk", "dolaşım", "çekirdek", "günışığı", "kaçış", "plaka", "kat", "aks başlangıcı"], state: "synchronized" },
        status: existingElements.length ? "Mimari program mevcut plan modeline bağlandı" : "Mimari programdan düzenlenebilir başlangıç planı üretildi",
      };
      if (modules["system-comparison"]) {
        const comparison = record(modules["system-comparison"]);
        modules["system-comparison"] = {
          ...comparison,
          input: {
            ...record(comparison.input),
            usage: projectUse(stringValue(architectureInput.use)),
            floors,
            area: targetGross,
            span: Math.max(plateWidth / baysX, plateDepth / baysY),
          },
          upstream: { source: "architectural-program", synchronizedAt },
          status: "Mimari geometri sistem karşılaştırmasına bağlandı",
        };
      }
      applied.push(handoffId);
    }

    if (handoffId === "H-03" && modules["plan-editor"]) {
      const plan = record(modules["plan-editor"]);
      const target = record(modules["structural-concept"]);
      const input = record(target.input);
      const baysX = numeric(plan.baysX);
      const baysY = numeric(plan.baysY);
      const spanX = numeric(plan.spanX);
      const spanY = numeric(plan.spanY);
      if (baysX <= 0 || baysY <= 0 || spanX <= 0 || spanY <= 0) return;
      const elements = Array.isArray(plan.elements) ? plan.elements.map(record) : [];
      const architecture = record(modules["architectural-program"]);
      const architectureResult = record(architecture.result);
      const planLoads = elements.map((element) => numeric(element.load)).filter((value) => value > 0);
      const liveLoad = planLoads.length ? Math.max(...planLoads) : numeric(architectureResult.liveLoad);
      modules["structural-concept"] = {
        ...target,
        input: {
          ...input,
          width: baysX * spanX || numeric(input.width),
          depth: baysY * spanY || numeric(input.depth),
          floors: numeric(plan.floorCount) || numeric(input.floors),
          floorHeight: thread.canonical.architecture.floorHeight || numeric(input.floorHeight),
          baysX: baysX || numeric(input.baysX),
          baysY: baysY || numeric(input.baysY),
          usage: structuralUse(thread.canonical.architecture.use),
          ...(liveLoad > 0 ? { liveLoad } : {}),
        },
        modelContext: {
          planRevision: stringValue(plan.revision, "current"),
          elementCount: elements.length,
          columns: elements.filter((element) => element.type === "column").length,
          walls: elements.filter((element) => element.type === "wall").length,
          cores: elements.filter((element) => element.type === "core").length,
          openings: elements.filter((element) => element.type === "opening").length,
          loadZones: elements.filter((element) => element.type === "load").length,
          metrics: plan.metrics,
        },
        architectureContext: {
          architecturalScheme: architecture.architecturalScheme,
          sourceModule: "architectural-program",
          synchronizedAt,
        },
        handoff: { id: handoffId, source: "plan-editor", target: "structural-concept", synchronizedAt, payload: ["aks", "geometri", "kat", "çekirdek", "boşluk", "yük bölgesi", "V113 mekânsal şema", "ön boyutlandırma"], state: "synchronized" },
        status: "V113 mimari şema, plan ve aks verisi taşıyıcı ön boyutlandırmaya bağlandı",
      };
      applied.push(handoffId);
    }

    if (handoffId === "H-04" && modules["system-comparison"]) {
      const comparison = record(modules["system-comparison"]);
      if (!Array.isArray(comparison.ranking) || !comparison.ranking.length) return;
      const winner = Array.isArray(comparison.ranking) ? record(comparison.ranking[0]) : {};
      const comparisonInput = record(comparison.input);
      const target = record(modules["structural-concept"]);
      const input = record(target.input);
      const selectedSystem = structuralSystem(stringValue(winner.id) || stringValue(winner.name) || stringValue(comparisonInput.preferredSystem));
      modules["structural-concept"] = {
        ...target,
        input: {
          ...input,
          ...(selectedSystem ? { system: selectedSystem } : {}),
          usage: stringValue(comparisonInput.usage, stringValue(input.usage, "office")),
        },
        systemDecision: {
          recommendedSystem: stringValue(winner.name),
          score: numeric(winner.score),
          shortlist: comparison.shortlist,
        },
        handoff: { id: handoffId, source: "system-comparison", target: "structural-concept", synchronizedAt, payload: ["sistem", "skor", "kısa liste", "kısıtlar"], state: "synchronized" },
        status: "Sistem kararı taşıyıcı ön tasarıma bağlandı",
      };
      applied.push(handoffId);
    }

    if (handoffId === "H-05" && modules["structural-concept"]) {
      const structure = record(modules["structural-concept"]);
      const structureResult = record(structure.result);
      const structureGeometry = record(structureResult.geometry);
      if (numeric(structureGeometry.totalArea) <= 0) return;
      const target = record(modules["arkem-x"]);
      modules["arkem-x"] = {
        ...target,
        source: {
          ...record(target.source),
          structure: thread.canonical.structure,
          architecture: thread.canonical.architecture,
          structuralStudio: structure.structuralStudio,
        },
        handoff: { id: handoffId, source: "structural-concept", target: "arkem-x", synchronizedAt, payload: ["metraj", "sistem", "alan", "ön performans", "ön boyutlandırma", "maliyet-süre-karbon göstergesi"], state: "synchronized" },
        status: "Taşıyıcı metrajı performans laboratuvarına bağlandı",
      };
      const coordination = record(modules["engineering-coordination"]);
      modules["engineering-coordination"] = {
        ...coordination,
        upstream: {
          ...record(coordination.upstream),
          architecture: thread.canonical.architecture,
          structure: thread.canonical.structure,
          structuralStudio: structure.structuralStudio,
          modelContext: structure.modelContext,
          synchronizedAt,
        },
        status: Object.keys(coordination).length ? stringValue(coordination.status, "Taşıyıcı veri koordinasyona bağlandı") : "Taşıyıcı veri hazır · disiplin kontrolleri bekleniyor",
      };
      applied.push(handoffId);
    }

    if (handoffId === "H-06" && modules["engineering-coordination"]) {
      const coordination = record(modules["engineering-coordination"]);
      if (!coordination.result && !coordination.issues) return;
      const bimCoordination = record(coordination.bimCoordination);
      const target = record(modules["project-os"]);
      modules["project-os"] = {
        ...target,
        coordination: {
          ...record(target.coordination),
          source: coordination,
          bimCoordination,
          openIssues: thread.canonical.coordination.openIssues,
          schedule4D: bimCoordination.schedule4D,
          cost5D: bimCoordination.cost5D,
          carbon: bimCoordination.carbon,
          quantities: bimCoordination.quantities,
          synchronizedAt,
        },
        handoff: { id: handoffId, source: "engineering-coordination", target: "project-os", synchronizedAt, payload: ["IFC/BCF hazırlık", "çakışma", "issue", "metraj", "karbon", "4B süre", "5B göreli maliyet"], state: "synchronized" },
        status: "V115 BIM koordinasyonu, 4B ve 5B göstergeleri Proje OS'e bağlandı",
      };
      applied.push(handoffId);
    }
  });

  return { modules, applied, synchronizedAt };
}

const ProjectKernelContext = createContext<ProjectKernelContextValue | null>(null);

export function ProjectKernelProvider({ children }: { children: React.ReactNode }) {
  const rejectedStorage = useRef(false);
  const [project, setProject] = useState<ProjectKernelState>(createDefaultProject);
  const [hydrated, setHydrated] = useState(false);
  const [savedProjects, setSavedProjects] = useState<ProjectKernelState[]>([]);
  const [libraryError, setLibraryError] = useState("");
  const [persistence, setPersistence] = useState<ProjectKernelContextValue["persistence"]>({
    state: "loading",
    integrity: "missing",
    lastSavedAt: "",
    backupAvailable: false,
    cloud: "not-configured",
  });

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        let library = loadProjectLibrary(window.localStorage);
        const backup = decodeProjectEnvelope<ProjectKernelState>(window.localStorage.getItem("arkem-demo-v177-backup")).value;
        if (backup && isKernelProject(backup) && (Object.keys(backup.modules).length || backup.events.length)) library = saveLibraryProject(window.localStorage, backup);
        setSavedProjects(library);
      } catch (error) {
        setLibraryError(error instanceof Error ? error.message : "Proje listesi açılamadı.");
      }
      try {
        const stored = loadProjectFromStorage<ProjectKernelState>(window.localStorage, STORAGE_KEY);
        if (stored.value) {
          if (!isKernelProject(stored.value)) {
            rejectedStorage.current = true;
            throw new Error("Stored project failed schema validation");
          }
          const parsed = stored.value;
          setProject((current) => ({
            ...parsed,
            experience: { ...current.experience, ...record(parsed.experience) },
            events: [...(Array.isArray(parsed.events) ? parsed.events : []), ...current.events].slice(-80),
            modules: ensureProjectModuleStamps({ ...current.modules, ...parsed.modules }, {
              projectId: parsed.id,
              projectRevision: parsed.revision || "P01",
              recordedAt: parsed.updatedAt || stored.savedAt || new Date().toISOString(),
            }),
          }));
          setPersistence({
            state: stored.source === "backup" ? "recovered" : "device-saved",
            integrity: stored.integrity,
            lastSavedAt: stored.savedAt,
            backupAvailable: stored.source === "backup" || Boolean(window.localStorage.getItem("arkem-demo-v177-backup")),
            cloud: "not-configured",
          });
        } else {
          setProject((current) => Object.keys(current.modules).length || current.id !== "ARK-26-0001"
            ? current
            : createActiveProject());
          setPersistence((current) => ({ ...current, state: "device-saved" }));
        }
      } catch {
        setPersistence((current) => ({ ...current, state: "unavailable" }));
      }
      setHydrated(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!hydrated || rejectedStorage.current) return;
    const timer = window.setTimeout(() => {
      try {
        setSavedProjects(Object.keys(project.modules).length || project.events.length
          ? saveLibraryProject(window.localStorage, project)
          : loadProjectLibrary(window.localStorage));
        setLibraryError("");
      } catch (error) {
        setLibraryError(error instanceof Error ? error.message : "Proje listesi kaydedilemedi. Tarayıcı depolamasını kontrol edin.");
      }
      try {
        const result = saveProjectToStorage(window.localStorage, project);
        setPersistence({
          state: "device-saved",
          integrity: "verified",
          lastSavedAt: result.savedAt,
          backupAvailable: result.backupAvailable,
          cloud: "not-configured",
        });
      } catch {
        setPersistence((current) => ({ ...current, state: "unavailable" }));
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [hydrated, project]);

  useEffect(() => {
    document.documentElement.dataset.arkemMode = project.experience.mode;
    document.documentElement.dataset.arkemAutoHandoff = project.experience.autoHandoff ? "on" : "off";
  }, [project.experience.autoHandoff, project.experience.mode]);

  const setIdentity = useCallback((patch: Partial<Pick<ProjectKernelState, "name" | "revision" | "phase" | "coordinateReference">>) => setProject((current) => ({ ...current, ...patch, updatedAt: new Date().toISOString() })), []);
  const setExperience = useCallback((patch: Partial<ProjectExperience>) => setProject((current) => ({
    ...current,
    experience: { ...current.experience, ...patch },
    updatedAt: new Date().toISOString(),
  })), []);
  const patchModule = useCallback((key: string, moduleValue: unknown) => {
    if (!hydrated) return;
    setProject((current) => {
      const mergedValue = mergeModuleValue(current.modules[key], moduleValue);
      if (JSON.stringify(current.modules[key]) === JSON.stringify(mergedValue)) return current;
      const timestamp = new Date().toISOString();
      const action = current.modules[key] ? "update" : "create";
      const storedValue = stampProjectModule(mergedValue, {
        projectId: current.id,
        projectRevision: current.revision,
        sourceModule: key,
        recordedAt: timestamp,
        action: action === "create" ? "created" : "updated",
      });
      const event: ProjectKernelEvent = { id: `${key}-${Date.now().toString(36)}`, module: key, action, revision: current.revision, timestamp };
      const nextModules = { ...current.modules, [key]: storedValue };
      const automatic = current.experience.autoHandoff
        ? synchronizeModules(nextModules, SOURCE_HANDOFFS[key] ?? [])
        : { modules: nextModules, applied: [] as string[], synchronizedAt: "" };
      const stampedModules = stampHandoffModules(automatic.modules, automatic.applied, {
        projectId: current.id,
        projectRevision: current.revision,
        recordedAt: timestamp,
      });
      const handoffEvents: ProjectKernelEvent[] = automatic.applied.map((handoffId) => ({
        id: `${handoffId}-${Date.now().toString(36)}`,
        module: handoffId,
        action: "handoff",
        revision: current.revision,
        timestamp,
      }));
      return {
        ...current,
        updatedAt: timestamp,
        experience: automatic.applied.length ? { ...current.experience, lastSynchronizedAt: automatic.synchronizedAt } : current.experience,
        modules: stampedModules,
        events: [...current.events, event, ...handoffEvents].slice(-80),
      };
    });
  }, [hydrated]);
  const applyHandoff = useCallback((handoffId: string) => {
    const preview = synchronizeModules(project.modules, [handoffId]);
    if (!preview.applied.length) return false;
    setProject((current) => {
      const result = synchronizeModules(current.modules, [handoffId]);
      if (!result.applied.length) return current;
      const timestamp = new Date().toISOString();
      return {
        ...current,
        updatedAt: timestamp,
        experience: { ...current.experience, lastSynchronizedAt: result.synchronizedAt },
        modules: stampHandoffModules(result.modules, result.applied, {
          projectId: current.id,
          projectRevision: current.revision,
          recordedAt: timestamp,
        }),
        events: [...current.events, {
          id: `${handoffId}-${Date.now().toString(36)}`,
          module: handoffId,
          action: "handoff" as const,
          revision: current.revision,
          timestamp,
        }].slice(-80),
      };
    });
    return true;
  }, [project.modules]);
  const synchronizeProject = useCallback(() => {
    const preview = synchronizeModules(project.modules, HANDOFF_IDS);
    if (!preview.applied.length) return 0;
    setProject((current) => {
      const result = synchronizeModules(current.modules, HANDOFF_IDS);
      if (!result.applied.length) return current;
      const timestamp = new Date().toISOString();
      return {
        ...current,
        updatedAt: timestamp,
        experience: { ...current.experience, lastSynchronizedAt: result.synchronizedAt },
        modules: stampHandoffModules(result.modules, result.applied, {
          projectId: current.id,
          projectRevision: current.revision,
          recordedAt: timestamp,
        }),
        events: [...current.events, ...result.applied.map((handoffId, index): ProjectKernelEvent => ({
          id: `${handoffId}-${Date.now().toString(36)}-${index}`,
          module: handoffId,
          action: "handoff",
          revision: current.revision,
          timestamp,
        }))].slice(-80),
      };
    });
    return preview.applied.length;
  }, [project.modules]);
  const removeModule = useCallback((key: string) => setProject((current) => {
    if (!current.modules[key]) return current;
    const timestamp = new Date().toISOString();
    const modules = { ...current.modules };
    delete modules[key];
    return { ...current, updatedAt: timestamp, modules, events: [...current.events, { id: `${key}-${Date.now().toString(36)}`, module: key, action: "remove" as const, revision: current.revision, timestamp }].slice(-80) };
  }), []);
  const importProject = useCallback((value: unknown) => {
    if (!value || typeof value !== "object") return false;
    const candidate = value as Partial<ProjectKernelState>;
    if (!isKernelProject(candidate)) return false;
    rejectedStorage.current = false;
    const timestamp = new Date().toISOString();
    const defaults = createDefaultProject();
    setProject({
      ...defaults,
      ...candidate,
      schema: "ARKEM-PROJECT/1.0",
      experience: { ...defaults.experience, ...record(candidate.experience) },
      modules: ensureProjectModuleStamps(candidate.modules, {
        projectId: candidate.id,
        projectRevision: candidate.revision ?? "P01",
        recordedAt: timestamp,
      }),
      events: [...(Array.isArray(candidate.events) ? candidate.events : []), { id: `project-${Date.now().toString(36)}`, module: "project", action: "import" as const, revision: candidate.revision ?? "P01", timestamp }].slice(-80),
      updatedAt: timestamp,
    });
    return true;
  }, []);
  const startProject = useCallback((intake: ProjectIntake, updateExisting = false) => {
    rejectedStorage.current = false;
    const now = new Date();
    const timestamp = now.toISOString();
    const projectCode = createProjectCode(now);
    const guidedJourney = deriveGuidedProjectRoadmap(intake);
    const geoUsageLabels: Record<ProjectIntake["usage"], string> = {
      residential: "Konut / Villa",
      industrial: "Sanayi / Depo",
      commercial: "Ticari Yapı",
      agricultural: "Tarımsal Yapı",
      mixed: "Sosyal Tesis",
    };
    const geoSystemLabels: Record<ProjectIntake["system"], string> = {
      undecided: "Karar Bekleniyor",
      concrete: "Betonarme",
      precast: "Betonarme Prefabrik",
      steel: "Yapısal Çelik",
      light: "Hafif Çelik",
      hybrid: "Karma Sistem",
    };
    const comparisonUsage: Record<ProjectIntake["usage"], string> = {
      residential: "residential",
      industrial: "industrial",
      commercial: "commercial",
      agricultural: "industrial",
      mixed: "commercial",
    };
    const floorArea = intake.targetArea / Math.max(1, intake.floors);
    const buildingWidth = Math.sqrt(floorArea * 1.45);
    const buildingDepth = floorArea / buildingWidth;
    const [province = "", district = ""] = intake.location.split("/").map((value) => value.trim());
    const comparisonWeights = {
      schedule: intake.priorities.includes("time") ? 5 : 3,
      certainty: intake.priorities.includes("cost") ? 5 : 3,
      span: 4,
      mass: intake.priorities.includes("safety") ? 5 : 3,
      carbon: intake.priorities.includes("carbon") ? 5 : 3,
      flexibility: intake.priorities.includes("flexibility") ? 5 : 3,
      supply: 3,
      fire: intake.priorities.includes("safety") ? 5 : 3,
    };
    const modules: Record<string, unknown> = {
      "decision-assistant": {
        schema: "ARKEM-GUIDED-INTAKE/1.0",
        input: intake,
        result: {
          service: intake.projectType === "demolition" ? "Kontrollü yıkım mühendisliği" : "Bütünleşik projelendirme",
          readiness: guidedJourney.readiness,
          guidedJourney,
          nextAction: guidedJourney.nextAction,
          missingDocuments: guidedJourney.missingDocuments,
        },
        status: `${guidedJourney.nextAction.title} · hazırlık %${guidedJourney.readiness}`,
      },
      "geo-parcel": {
        reference: intake.location || "Parsel seçimi bekleniyor",
        province,
        district,
        parcelStatus: intake.parcelStatus,
        declaredDocuments: intake.documents,
        usage: geoUsageLabels[intake.usage],
        dataStatus: intake.parcelStatus === "verified"
          ? "Kullanıcı beyanı · ada/parsel hazır · TKGM/MEGSİS doğrulaması bekleniyor"
          : intake.parcelStatus === "identified"
            ? "Kullanıcı beyanı · parsel biliniyor · koordinatlı sınır bekleniyor"
            : "Kullanıcı briefi · resmî parsel doğrulaması bekleniyor",
        sourceCrs: "WGS84 / EPSG:4326",
        buildingWidth,
        buildingDepth,
        floors: intake.floors,
        floorHeight: intake.floorHeight,
        system: geoSystemLabels[intake.system],
        metrics: {},
        status: "Konum aktarıldı · sınır bekleniyor",
      },
      "architectural-program": {
        input: {
          use: intake.usage === "commercial" || intake.usage === "mixed" ? "office" : intake.usage === "agricultural" ? "industrial" : intake.usage,
          targetGross: intake.targetArea,
          floors: intake.floors,
          floorHeight: intake.floorHeight,
        },
        result: {},
        status: "Brief verisi aktarıldı",
      },
      "system-comparison": {
        input: {
          usage: comparisonUsage[intake.usage],
          area: intake.targetArea,
          floors: intake.floors,
          preferredSystem: intake.system,
          priorities: intake.priorities,
          budget: intake.budget,
          timeline: intake.timeline,
        },
        weights: comparisonWeights,
        ranking: [],
        status: intake.system === "undecided" ? "Alternatif karşılaştırması bekleniyor" : "Ön sistem tercihi aktarıldı",
      },
    };
    if (intake.projectType === "demolition") modules["demolition-screening"] = {
      input: { location: intake.location, grossArea: intake.targetArea, floors: intake.floors },
      status: "Yapı ve çevre verisi bekleniyor",
    };
    const stampedModules = Object.fromEntries(Object.entries(modules).map(([key, value]) => [key, stampProjectModule(value, {
      projectId: projectCode,
      projectRevision: "P01",
      sourceModule: key,
      recordedAt: timestamp,
      action: "created",
    })]));
    const seededKeys = Object.keys(stampedModules);
    if (updateExisting) {
      setProject(current => {
        const merged = { ...current.modules };
        for (const [key, value] of Object.entries(modules)) {
          const previous = record(current.modules[key]);
          const incoming = record(value);
          const geoHasWork = key === "geo-parcel" && (Object.keys(record(previous.metrics)).length > 0 || Object.keys(previous).some(field => !Object.hasOwn(incoming, field) && !["_kernel", "needsReview", "input"].includes(field)));
          merged[key] = stampProjectModule({ ...incoming, ...previous, ...(key === "decision-assistant" || key === "geo-parcel" && !geoHasWork ? incoming : {}), input: { ...record(previous.input), ...record(incoming.input) }, ...(key === "geo-parcel" ? { parcelStatus: intake.parcelStatus, declaredDocuments: intake.documents } : {}), needsReview: key !== "decision-assistant", status: key === "decision-assistant" ? incoming.status : "Brief güncellendi; mevcut teknik çalışma yeniden kontrol edilmeli" }, { projectId: current.id, projectRevision: current.revision, sourceModule: key, recordedAt: timestamp, action: "updated" });
        }
        const journey = record(current.modules["customer-journey"]);
        if (current.modules["customer-journey"]) merged["customer-journey"] = { ...journey, systemDecision: intake.system };
        return { ...current, name: intake.name.trim(), updatedAt: timestamp, modules: merged, events: [...current.events, { id: `brief-${now.getTime().toString(36)}`, module: "decision-assistant", action: "update" as const, revision: current.revision, timestamp }].slice(-80) };
      });
      return;
    }
    setProject({
      ...createDefaultProject(),
      id: projectCode,
      name: intake.name.trim() || "Yeni ARKEMX Projesi",
      phase: guidedJourney.readiness >= 45 ? "Ön fizibilite" : "Fikir",
      revision: "P01",
      updatedAt: timestamp,
      experience: {
        mode: intake.experienceMode,
        autoHandoff: intake.experienceMode === "guided",
        lastSynchronizedAt: "",
      },
      modules: stampedModules,
      events: seededKeys.map((module, index) => ({
        id: `${module}-${now.getTime().toString(36)}-${index}`,
        module,
        action: "create" as const,
        revision: "P01",
        timestamp,
      })),
    });
    setHydrated(true);
  }, []);
  const openSavedProject = useCallback((id: string) => {
    if (!hydrated) return false;
    try {
      const library = Object.keys(project.modules).length || project.events.length
        ? saveLibraryProject(window.localStorage, project)
        : loadProjectLibrary(window.localStorage);
      const selected = library.find(item => item.id === id);
      if (!selected || !importProject(selected)) return false;
      setSavedProjects(library); setLibraryError(""); return true;
    } catch (error) {
      setLibraryError(error instanceof Error ? error.message : "Proje açılamadı."); return false;
    }
  }, [hydrated, importProject, project]);
  const createNamedProject = useCallback((name: string) => {
    if (!hydrated || !name.trim() || name.trim().length > 160) return false;
    try {
      if (Object.keys(project.modules).length || project.events.length) saveLibraryProject(window.localStorage, project);
      const next = { ...createActiveProject(), id: `DEMO-${crypto.randomUUID()}`, name: name.trim() };
      next.events = [{ id: crypto.randomUUID(), module: "project", action: "create", revision: next.revision, timestamp: next.updatedAt }];
      const library = saveLibraryProject(window.localStorage, next);
      setSavedProjects(library); setProject(next); rejectedStorage.current = false; setLibraryError(""); return true;
    } catch (error) {
      setLibraryError(error instanceof Error ? error.message : "Yeni proje kaydedilemedi."); return false;
    }
  }, [hydrated, project]);
  const reset = useCallback(() => { rejectedStorage.current = false; setProject(createActiveProject()); }, []);
  const thread = useMemo(() => deriveProjectThread(project.modules), [project.modules]);
  const core = useMemo(() => deriveProjectCore(project, thread), [project, thread]);

  const value = useMemo<ProjectKernelContextValue>(() => ({
    project,
    thread,
    core,
    hydrated,
    savedProjects,
    libraryError,
    openSavedProject,
    createNamedProject,
    persistence,
    setIdentity,
    setExperience,
    patchModule,
    applyHandoff,
    synchronizeProject,
    removeModule,
    importProject,
    startProject,
    reset,
  }), [savedProjects, libraryError, openSavedProject, createNamedProject, applyHandoff, core, hydrated, importProject, patchModule, persistence, project, removeModule, reset, setExperience, setIdentity, startProject, synchronizeProject, thread]);

  return <ProjectKernelContext.Provider value={value}>{children}</ProjectKernelContext.Provider>;
}

export function useProjectKernel() {
  const value = useContext(ProjectKernelContext);
  if (!value) throw new Error("useProjectKernel must be used inside ProjectKernelProvider");
  return value;
}

export function ProjectKernelBar({ module, confidence = "Ön değerlendirme" }: { module: string; confidence?: string }) {
  const { project, thread, persistence, setIdentity, setExperience, synchronizeProject, reset } = useProjectKernel();
  const [editing, setEditing] = useState(false);
  const journeyScrollerRef = useRef<HTMLDivElement>(null);
  const exportProject = () => downloadTextFile(`${project.id}-${project.revision}.arkem.json`, JSON.stringify(project, null, 2), "application/json");

  const normalizedModule = module.toUpperCase();
  const activeJourneyIndex = Math.max(0, PROJECT_JOURNEY.findIndex((step) => step.modules.some((keyword) => normalizedModule.includes(keyword))));
  useEffect(() => {
    const scroller = journeyScrollerRef.current;
    if (!scroller) return;
    const media = window.matchMedia("(max-width: 760px)");
    const revealActiveStep = () => {
      if (!media.matches) return;
      const activeStep = scroller.querySelector<HTMLElement>('[aria-current="step"]');
      if (activeStep) scroller.scrollLeft = Math.max(0, activeStep.offsetLeft);
    };
    const frame = window.requestAnimationFrame(revealActiveStep);
    media.addEventListener("change", revealActiveStep);
    return () => {
      window.cancelAnimationFrame(frame);
      media.removeEventListener("change", revealActiveStep);
    };
  }, [activeJourneyIndex]);
  const regularNextJourneyStep = PROJECT_JOURNEY[Math.min(activeJourneyIndex + 1, PROJECT_JOURNEY.length - 1)];
  const nextJourneyStep = normalizedModule.includes("ARCHITECT") || normalizedModule.includes("PROGRAM")
    ? { short: "Plan", href: "/tasarim-calismalari#plan-editor" }
    : normalizedModule.includes("PLAN")
      ? { short: "Taşıyıcı ön tasarım", href: "/tasarim-calismalari#tasiyici-on-tasarim" }
      : regularNextJourneyStep;
  const completedJourney = PROJECT_JOURNEY.map((step) => step.projectKeys.some((key) => thread.nodes.some((node) => node.id === key && node.active)));
  const completedCount = completedJourney.filter(Boolean).length;
  const architectureModule = record(project.modules["architectural-program"]);
  const planModule = record(project.modules["plan-editor"]);
  const spaceCount = Array.isArray(architectureModule.spaces) ? architectureModule.spaces.reduce((sum, value) => sum + Math.max(1, numeric(record(value).count, 1)), 0) : 0;
  const planElementCount = Array.isArray(planModule.elements) ? planModule.elements.length : 0;
  const structureSystemLabels: Record<string, string> = {
    undecided: "Karar bekleniyor",
    concrete: "Betonarme",
    precast: "Betonarme prefabrik",
    steel: "Yapısal çelik",
    light: "Hafif çelik",
    hybrid: "Karma sistem",
  };
  const structureSystem = thread.canonical.structure.system;
  const moduleMeta: Record<string, { code: string; label: string }> = {
    "PROJECT DEFINITION & READINESS": { code: "PIR", label: "Yatırım briefi" },
    "STRUCTURAL CONCEPT ENGINE": { code: "STR", label: "Taşıyıcı ön tasarım" },
    "QUICK SITE SCENARIO": { code: "MAS", label: "Hızlı yerleşim" },
    "ARKEMX DECISION LAB": { code: "MCDA", label: "Karar laboratuvarı" },
    "DIGITAL DELIVERY CONFIGURATOR": { code: "BEP", label: "Dijital teslim kapsamı" },
    "3D MODEL REVIEW": { code: "3D", label: "Model inceleme" },
    "GEO·BIM PARCEL ENGINE": { code: "GIS", label: "Parsel ve arazi" },
    "DEMOLITION RISK ENGINE": { code: "DEM", label: "Yıkım karar stüdyosu" },
    "INTEGRATED COORDINATION ENGINE": { code: "ICE", label: "Mühendislik koordinasyonu" },
    "FEDERATED DIGITAL THREAD": { code: "CDE", label: "Dijital proje merkezi" },
    "STRUCTURAL SYSTEM MCDA": { code: "SYS", label: "Yapı sistemi seçimi" },
    "ARCHITECTURAL PROGRAM ENGINE": { code: "ARC", label: "Mimari program" },
    "PARAMETRIC PLAN AUTHORING": { code: "BIM", label: "Parametrik plan" },
    "PROJECT DELIVERY OS": { code: "OS", label: "Proje işletim sistemi 2.0" },
  };
  const currentModule = moduleMeta[module] ?? { code: "ARKEMX", label: module };

  return <>{Object.values(project.modules).some(value => record(value).needsReview === true) && <div className="customer-resume" role="status">Proje girdileri değişti. Önceki teknik sonuçlar yeniden kontrol edilmeli; işaretli kayıtlardan otomatik aktarım durduruldu. <Link href="/arkemx">Proje rehberine dön</Link></div>}<div className="project-kernel-bar" data-testid="project-kernel-bar" data-system="ARKEM PROJECT KERNEL">
    <div className="kernel-brand"><span>ARKEMX / {currentModule.code}</span><b>{currentModule.label}</b><small>{module}</small></div>
    <div className="kernel-identity"><span>PROJE</span>{editing ? <input aria-label="Proje adı" value={project.name} onChange={(event) => setIdentity({ name: event.target.value })} onBlur={() => setEditing(false)} autoFocus /> : <button onClick={() => setEditing(true)}>{project.name}</button>}<small>{project.id}</small></div>
    <label><span>AŞAMA</span><select value={project.phase} onChange={(event) => setIdentity({ phase: event.target.value as ProjectPhase })}>{["Fikir", "Ön fizibilite", "Avan proje", "Uygulama projesi", "Yapım", "Teslim"].map((phase) => <option key={phase}>{phase}</option>)}</select></label>
    <label><span>REVİZYON</span><input aria-label="Proje revizyonu" value={project.revision} onChange={(event) => setIdentity({ revision: event.target.value.toUpperCase().slice(0, 8) })} /></label>
    <div className="kernel-state"><i></i><span>{thread.metrics.activeCount}/{thread.metrics.totalCount} MODÜL BAĞLI</span><b>{confidence}</b></div>
    <div className="kernel-persistence" title="Bu oturumun proje verisi bu cihazda bütünlük denetimli olarak saklanır. Kurumsal bulut senkronu henüz bağlı değildir.">
      <span>PROJE KASASI</span>
      <b>{persistence.state === "recovered" ? "Yedekten kurtarıldı" : persistence.state === "unavailable" ? "Tarayıcı kaydı kapalı" : "Bu cihazda kayıtlı"}</b>
      <small>{DEMO_ENABLED ? "Demo · yalnız bu tarayıcı" : persistence.cloud === "not-configured" ? "Bulut bağlantısı bekliyor" : ""}</small>
    </div>
    <div className="kernel-experience" aria-label="ARKEMX kullanım modu">
      <span>KULLANIM MODU</span>
      <div><button className={project.experience.mode === "guided" ? "active" : ""} onClick={() => setExperience({ mode: "guided", autoHandoff: true })}>Yönlendirmeli</button><button className={project.experience.mode === "technical" ? "active" : ""} onClick={() => setExperience({ mode: "technical" })}>Teknik</button></div>
      <small>{project.experience.autoHandoff ? "Veri aktarımı açık" : "Elle aktarım"}</small>
    </div>
    <div className="kernel-actions"><Link href="/arkemx">Proje rehberime dön</Link>{!DEMO_ENABLED && <Link href="/musteri-proje-portali">Hesaba kaydet</Link>}<button onClick={exportProject}>Proje JSON ↓</button><button onClick={() => { if (window.confirm("Yeni oturum açılsın mı? Mevcut projenizin yedeği önce indirilecek.")) { exportProject(); reset(); } }}>Yeni oturum</button></div>
  </div><nav className="project-guided-journey" aria-label="Rehberli proje akışı">
    <header><span>TEK PROJE · YEDİ BAĞLI ADIM</span><b>Her modül önceki adımın verisini kullanır</b><small>Şu an: {activeJourneyIndex + 1}. adım / {PROJECT_JOURNEY.length} · Sonuçlar aynı proje kaydında birleşir</small></header>
    <div ref={journeyScrollerRef}>{PROJECT_JOURNEY.map((step, index) => { const done = completedJourney[index]; return <Link key={step.href} href={step.href} onClick={() => synchronizeProject()} className={`${index === activeJourneyIndex ? "active " : ""}${done && index !== activeJourneyIndex ? "passed" : ""}`.trim()} aria-current={index === activeJourneyIndex ? "step" : undefined}><i>{done && index !== activeJourneyIndex ? "✓" : String(index + 1).padStart(2, "0")}</i><span><b>{step.short}</b><small>{step.label}</small><strong>{step.output}</strong></span>{index === activeJourneyIndex ? <em>BURADASIN</em> : index < PROJECT_JOURNEY.length - 1 ? <u aria-hidden="true">→</u> : null}</Link>; })}</div>
    <aside className="project-live-handoff" aria-label="Aktarılan proje verileri">
      <span className="project-continuity-score"><small>VERİ DEVAMLILIĞI</small><b>%{Math.round(completedCount / PROJECT_JOURNEY.length * 100)} · {completedCount}/{PROJECT_JOURNEY.length} adım</b></span>
      <span><small>PARSEL</small><b>{thread.canonical.site.reference}</b></span>
      <span><small>ÖNERİLEN ALAN</small><b>{thread.canonical.site.proposedGross > 0 ? `${thread.canonical.site.proposedGross.toLocaleString("tr-TR", { maximumFractionDigits: 0 })} m²` : "Sıradaki adımda oluşacak"}</b></span>
      <span><small>MİMARİ / PLAN</small><b>{spaceCount || planElementCount ? `${spaceCount} mahal · ${planElementCount} plan nesnesi` : "Program ve plan bekleniyor"}</b></span>
      <span><small>TAŞIYICI SİSTEM</small><b>{structureSystem ? structureSystemLabels[structureSystem] ?? structureSystem : "Sonraki adımda seçilecek"}</b></span>
      {activeJourneyIndex < PROJECT_JOURNEY.length - 1 && <Link className="project-next-step" href={nextJourneyStep.href} onClick={() => synchronizeProject()}><small>{project.experience.autoHandoff ? "VERİLER AKTARILDI VE KAYDEDİLDİ" : "VERİLER KAYDEDİLDİ"}</small><b>{nextJourneyStep.short} adımına geç</b><i>→</i></Link>}
    </aside>
  </nav></>;
}

export function ProjectThreadDock() {
  const { thread } = useProjectKernel();
  const empty = thread.metrics.activeCount === 0;
  return <aside className="project-thread-dock" aria-label="Arkem dijital proje zinciri">
    <Link href={empty ? "/proje-baslat" : "/dijital-proje-merkezi"} className={empty ? "is-empty" : ""} title={empty ? "ARKEMX yönlendirmeli projeyi başlatın" : "ARKEMX dijital proje merkezini açın"}>
      <span>ARKEMX</span>
      <strong>{empty ? "PROJE BAŞLAT" : `%${thread.metrics.readiness}`}</strong>
      <small>{empty ? "13 BAĞLI MODÜL" : `${thread.metrics.activeCount} MODÜL BAĞLI`}</small>
      <i>↗</i>
    </Link>
  </aside>;
}
