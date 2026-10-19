"use client";
import { createDirectoryRequestTracker, type DirectoryLevel } from '../lib/directory-request-tracker';

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { parseGeoCsv } from "../lib/geo-csv";
import { restoreParcelGeometry } from "../lib/parcel-geometry-restore";
import { PARCEL_JOURNEY, parcelOperationMatches, parseParcelGeoJson, parseKmlCoordinateRing } from "../lib/parcel-experience";
import { ParcelBoundaryPreview } from "./ParcelBoundaryPreview";
import { ParcelZoningGuide } from "./ParcelZoningGuide";
import { ParcelAreaBudget } from './ParcelAreaBudget';
import { ParcelZoningCapture } from './ParcelZoningCapture';
import { MunicipalPlanResearch } from './MunicipalPlanResearch';
import { ParcelOutcomePanel } from './ParcelOutcomePanel';
import { createParcelConcept, geometricAreaRatios, CONCEPT_ASSUMPTIONS } from '../lib/parcel-concept';
import { FileText, Files, Ruler, ArrowRight } from 'lucide-react';
import { ParcelLocationStep } from "./ParcelLocationStep";
import { administrativeOptions as parseAdministrativeOptions } from '../lib/administrative-options';
import { fetchTkgmJson, lookupTkgmParcel, assertParcelResponseIdentity } from '../lib/tkgm-client';
import { loadLocationDistricts, loadLocationNeighborhoods, locationDirectoryLookupName, type LocationDirectoryOption } from '../lib/location-directory';
import { PARCEL_BASEMAPS, webMercatorPoint, type ParcelBasemap } from '../lib/parcel-basemaps';
import { isParcelIdentityReady, parcelJourneyGate } from "../lib/parcel-journey-gates";
import { parcelDesignReady, planningForParcel, restorePlanningScopes, type ParcelPlanningDraft, type ParcelPlanningScopes } from "../lib/parcel-zoning-scope";
import type { LayerGroup, Map as LeafletMap, Polygon as LeafletPolygon, TileLayer } from "leaflet";
import { GeoTerrainViewer } from "./GeoTerrainViewer";
import { buildingFootprint, fromLocalMeters, geoCentroid, localBounds, minimumBoundaryDistance, pointInPolygon, polygonArea, polygonPerimeter, polygonSelfIntersects, sampleParcel, toLocalMeters, type GeoPoint } from "../lib/geo";
import { createLayeredDxf } from "../lib/engineering";
import { useExportFeedback } from "./useExportFeedback";
import { createGeoProvenance, GEO_CONNECTORS } from "../lib/geo-integration";
import {
  createParcelRecord,
  parcelIdentityKey,
  resolveParcelSourceNetwork,
  type ParcelRecord,
  type ParcelSourceKind,
} from "../lib/parcel-record";
import { createZoningProvenance, ZONING_CONNECTORS, zoningVerificationLabel, type ZoningForm, type ZoningVerification } from "../lib/zoning";
import {
  DEFAULT_TERRAIN_LAYERS,
  createTerrainContours,
  createTerrainElevationSampler,
  createTerrainModel,
  normalizeTerrainLayers,
  type TerrainLayerId,
  type TerrainLayerVisibility,
} from "../lib/terrain-model";
import { createZoningMassingModel, containsFootprint, completeBoundaryDistance, type ParcelFrontEdge } from "../lib/zoning-massing";
import { ProjectKernelBar, useProjectKernel } from "./ProjectKernel";

type Stage = "locate" | "import" | "draw" | "zoning" | "design" | "terrain" | "export";
type ViewMode = "map" | "terrain" | "data";
type LeafletModule = typeof import("leaflet");
type TkgmFeature = { type?: string; geometry?: unknown; properties?: Record<string, unknown> };
type AdministrativeOption = { id: string; label: string };

const stages: { id: Stage; no: string; label: string; sub: string }[] = [
  { id: "locate", no: "01", label: "Parseli bul", sub: "Ada / parsel veya koordinat" },
  { id: "import", no: "02", label: "Veriyi al", sub: "KML · GeoJSON · CSV" },
  { id: "draw", no: "03", label: "Sınırı düzenle", sub: "Haritada nokta ve poligon" },
  { id: "zoning", no: "04", label: "İmarı doğrula", sub: "TAKS · KAKS · Hmax · nizam" },
  { id: "design", no: "05", label: "Yapıyı yerleştir", sub: "Kütle · sistem · yön" },
  { id: "terrain", no: "06", label: "Araziyi incele", sub: "Eğim · kot · 3B" },
  { id: "export", no: "07", label: "Teknik çıktıyı al", sub: "PDF · DXF · KML" },
];

const defaultCenter: GeoPoint = { lat: 40.7607, lng: 30.3675 };
type ParcelSourceState = {
  identity?: { province: string; district: string; neighborhood: string; block: string; parcelNo: string };
  kind: ParcelSourceKind;
  authority: string;
  label: string;
  capturedAt: string;
  url: string;
  reportedArea?: number;
};

function normalizeAdministrativeName(value: unknown) {
  return String(value ?? "").trim().toLocaleLowerCase("tr-TR").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/ı/g, "i").replace(/\b(mahallesi|mah\.?|köyü|koyu|köy|koy)\b/g, "").replace(/[^a-z0-9çğıöşü]+/g, "");
}

function administrativeId(feature?: TkgmFeature) {
  const properties = feature?.properties ?? {};
  return properties.id ?? properties.ilId ?? properties.ilceId ?? properties.mahalleId;
}

function administrativeOptions(data: Record<string, unknown>, level: 'province' | 'district' | 'neighborhood' = 'province') {
  const options = parseAdministrativeOptions(data, level);
  if (!options.length) throw new Error('İdari liste boş veya desteklenmeyen biçimde.');
  return options;
}

function validPoint(lat: number, lng: number, alt?: number): GeoPoint | null {
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return { lat, lng, alt: Number.isFinite(alt) ? alt : undefined };
}

function extractGeoJsonPoints(value: unknown): GeoPoint[] {
  return parseParcelGeoJson(value);
}

function parcelFeature(value: unknown): TkgmFeature {
  if (!value || typeof value !== "object") return {};
  const data = value as Record<string, unknown>;
  if (data.type === "FeatureCollection" && Array.isArray(data.features)) {
    const feature = data.features[0];
    return feature && typeof feature === "object" ? feature as TkgmFeature : {};
  }
  return data as TkgmFeature;
}

function parseReportedArea(value: unknown) {
  const raw = String(value ?? "").trim().replace(/[^\d.,-]/g, "");
  if (!raw) return undefined;
  const normalized = raw.includes(",") ? raw.replace(/\./g, "").replace(",", ".") : raw;
  const area = Number(normalized);
  return Number.isFinite(area) && area > 0 ? area : undefined;
}

function dedupeClosingPoint(points: GeoPoint[]) {
  if (points.length > 3) {
    const first = points[0];
    const last = points[points.length - 1];
    if (Math.abs(first.lat - last.lat) < 1e-9 && Math.abs(first.lng - last.lng) < 1e-9) return points.slice(0, -1);
  }
  return points;
}

function parseSpatialFile(fileName: string, text: string): GeoPoint[] {
  const lowerName = fileName.toLowerCase();
  if (lowerName.endsWith(".geojson") || lowerName.endsWith(".json")) return dedupeClosingPoint(extractGeoJsonPoints(JSON.parse(text)));
  if (lowerName.endsWith(".kml")) {
    if (/<!DOCTYPE|<!ENTITY/i.test(text)) throw new Error('Harici XML tanımları desteklenmez.');
    const document = new DOMParser().parseFromString(text, 'application/xml');
    const elements = Array.from(document.getElementsByTagName('*'));
    const named = (name: string) => elements.filter(element => element.localName === name);
    const polygons = named('Polygon'), coordinates = named('coordinates'), outer = named('outerBoundaryIs');
    if (named('parsererror').length || polygons.length !== 1 || coordinates.length !== 1 || outer.length !== 1 || named('innerBoundaryIs').length || named('MultiGeometry').length || named('LineString').length || named('Point').length || !polygons[0].contains(outer[0]) || !outer[0].contains(coordinates[0])) throw new Error('Tek Polygon ve tek dış sınır içeren KML seçin. Delikler ve ek geometriler sessizce atılmadı.');
    return parseKmlCoordinateRing(coordinates[0].textContent ?? '');
  }
  if (lowerName.endsWith(".csv") || lowerName.endsWith(".txt")) return dedupeClosingPoint(parseGeoCsv(text));
  return [];
}

function downloadFileBlob(name: string, content: string | Uint8Array, type: string) {
  const anchor = document.createElement("a");
  anchor.href = URL.createObjectURL(new Blob([content as BlobPart], { type }));
  anchor.download = name;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(anchor.href), 1_000);
}

function ascii(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/ı/g, "i").replace(/İ/g, "I").replace(/ş/g, "s").replace(/Ş/g, "S").replace(/ğ/g, "g").replace(/Ğ/g, "G").replace(/ç/g, "c").replace(/Ç/g, "C").replace(/ö/g, "o").replace(/Ö/g, "O").replace(/ü/g, "u").replace(/Ü/g, "U").replace(/[^\x20-\x7E]/g, "");
}

export function GeoParcelStudio() {
  const { project, hydrated } = useProjectKernel();
  const context = (project.modules["geo-parcel"] as { briefContext?: {signature?: string} } | undefined)?.briefContext;
  if (!hydrated) return <p role="status">Parsel kaydı açılıyor…</p>;
  return <ScopedGeoParcelStudio key={`${project.id}:${context?.signature ?? ""}`} />;
}

function ScopedGeoParcelStudio() {
  const { runExport, exportState, exportMessage } = useExportFeedback();
  const mapHostRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const leafletRef = useRef<LeafletModule | null>(null);
  const parcelLayerRef = useRef<LeafletPolygon | null>(null);
  const buildingLayerRef = useRef<LeafletPolygon | null>(null);
  const pointsLayerRef = useRef<LayerGroup | null>(null);
  const contourLayerRef = useRef<LayerGroup | null>(null);
  const basemapLayerRef = useRef<TileLayer | null>(null);
  const drawingRef = useRef(false);
  const operationSequence = useRef(0);
  const transferApplied = useRef(false);
  const persistedGeoRef = useRef(false);
  const pendingFitRef = useRef<GeoPoint[] | null>(null);
  const { patchModule, project, hydrated } = useProjectKernel();
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState("");
  const [activeStage, setActiveStage] = useState<Stage>("locate");
  const [expertMode, setExpertMode] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("map");
  const [parcel, setParcel] = useState<GeoPoint[]>([]);
  const drawingGeometry = useRef(parcel);
  useLayoutEffect(() => { drawingGeometry.current = parcel; }, [parcel]);
  const [parcelSource, setParcelSourceState] = useState<ParcelSourceState>({
    kind: "sample",
    authority: "ARKEMX",
    label: "Temsili başlangıç geometrisi",
    capturedAt: new Date(0).toISOString(),
    url: "",
  });
  const [drawEnabled, setDrawEnabled] = useState(false);
  const [latitude, setLatitude] = useState(defaultCenter.lat.toFixed(7));
  const [longitude, setLongitude] = useState(defaultCenter.lng.toFixed(7));
  const [province, setProvince] = useState("");
  const [district, setDistrict] = useState("");
  const [neighborhood, setNeighborhood] = useState("");
  const [provinceId, setProvinceId] = useState("");
  const [districtId, setDistrictId] = useState("");
  const [neighborhoodId, setNeighborhoodId] = useState("");
  const [provinceOptions, setProvinceOptions] = useState<AdministrativeOption[]>([]);
  const [districtOptions, setDistrictOptions] = useState<LocationDirectoryOption[]>([]);
  const [neighborhoodOptions, setNeighborhoodOptions] = useState<LocationDirectoryOption[]>([]);
  const [directoryAttempt, setDirectoryAttempt] = useState(0);
  const [directoryError, setDirectoryError] = useState("");
  const [basemapMode, setBasemapMode] = useState<ParcelBasemap>('osm');
  const [basemapNotice, setBasemapNotice] = useState('');
  const [administrativeLoading, setAdministrativeLoading] = useState<"province" | "district" | "neighborhood" | "idle">("province");
  const administrativeRequests = useRef(createDirectoryRequestTracker());
  function startAdministrativeRequest(level: DirectoryLevel) {
    const finish = administrativeRequests.current.begin(level);
    setAdministrativeLoading(administrativeRequests.current.level());
    return () => { finish(); setAdministrativeLoading(administrativeRequests.current.level()); };
  }
  const [administrativeSource, setAdministrativeSource] = useState<"official" | "fallback">("fallback");
  const [block, setBlock] = useState("");
  const [parcelNo, setParcelNo] = useState("");
  const [fileNotice, setFileNotice] = useState("İlk adım: parselinizin konumunu seçin. Haritada henüz size ait bir sınır yok.");
  const [buildingWidth, setBuildingWidth] = useState(24);
  const [buildingDepth, setBuildingDepth] = useState(38);
  const [floors, setFloors] = useState(2);
  const [rotation, setRotation] = useState(15);
  const [offsetEast, setOffsetEast] = useState(0);
  const [offsetNorth, setOffsetNorth] = useState(0);
  const [system, setSystem] = useState("Yapısal Çelik");
  const [usage, setUsage] = useState("Sanayi / Depo");
  const [slope, setSlope] = useState(4);
  const [exaggeration, setExaggeration] = useState(1.5);
  const [terrainLayers, setTerrainLayers] = useState<TerrainLayerVisibility>(() => ({ ...DEFAULT_TERRAIN_LAYERS }));
  const [floorHeight, setFloorHeight] = useState(4.5);
  const [sourceCrs, setSourceCrs] = useState("EPSG:4326 / WGS84");
  const [dataStatus, setDataStatus] = useState("Kavramsal / doğrulanmamış");
  const [lookupState, setLookupState] = useState<{ key: string; status: "idle" | "loading" | "found" | "error" }>({ key: "", status: "idle" });
  const [planningScopes, setPlanningScopes] = useState<ParcelPlanningScopes>({});
  const legacyPlanning = useRef<unknown>(null);
  const [planningHydrated, setPlanningHydrated] = useState(false);
  const [frontEdge, setFrontEdge] = useState<ParcelFrontEdge>("north");
  const [selectedMassingId, setSelectedMassingId] = useState("none");
  const currentIdentity = { province, district, neighborhood, block, parcelNo };
  const geometryIdentity = useRef(currentIdentity);
  const queryIdentity = parcelIdentityKey(currentIdentity);
  // Select synchronously: a render for parcel B can never see parcel A's planning values.
  const planningDraft = useMemo(() => planningForParcel(planningScopes, queryIdentity), [planningScopes, queryIdentity]);
  const zoning = planningDraft.zoning;
  const maxCoverage = zoning.taks * 100;
  const maxFar = zoning.kaks;
  const maxHeight = zoning.hmax;
  const requiredSetback = Math.max(zoning.frontSetback, zoning.sideSetback, zoning.rearSetback);
  const parkingPer100 = planningDraft.parkingPer100;
  const updatePlanning = (change: Partial<ParcelPlanningDraft>) => setPlanningScopes(current => ({
    ...current, [queryIdentity]: { ...planningForParcel(current, queryIdentity), inputsConfirmed: false, ...change },
  }));
  const setZoning = (change: ZoningForm | ((current: ZoningForm) => ZoningForm)) => setPlanningScopes(current => {
    const draft = planningForParcel(current, queryIdentity);
    return { ...current, [queryIdentity]: { ...draft, inputsConfirmed: false, zoning: typeof change === 'function' ? change(draft.zoning) : change } };
  });
  const setParkingPer100 = (value: number) => updatePlanning({ parkingPer100: value });
  useLayoutEffect(() => { geometryIdentity.current = { province, district, neighborhood, block, parcelNo }; }, [province, district, neighborhood, block, parcelNo]);
  const lookupKey = `${queryIdentity}|${sourceCrs}`;
  const parcelLookup = lookupState.key === lookupKey ? lookupState.status : "idle";
  const setParcelLookup = (status: "idle" | "loading" | "found" | "error") => setLookupState({ key: lookupKey, status });
  const currentQuery = useRef(queryIdentity);
  const currentCrs = useRef(sourceCrs);
  useLayoutEffect(() => { currentCrs.current = sourceCrs; operationSequence.current++; }, [sourceCrs]);
  useLayoutEffect(() => { currentQuery.current = queryIdentity; operationSequence.current++; }, [queryIdentity]);
  const setParcelSource = (value: ParcelSourceState) => setParcelSourceState({ ...value, identity: value.identity ?? geometryIdentity.current });
  const parcelRecord = useMemo<ParcelRecord>(() => createParcelRecord({
    identity: { province, district, neighborhood, block, parcelNo },
    geometry: parcel,
    source: parcelSource,
  }), [block, district, neighborhood, parcel, parcelNo, parcelSource, province]);

  useEffect(() => {
    if (!hydrated || transferApplied.current) return;
    const timer = window.setTimeout(() => {
    // Mark only when the callback actually runs; a cancelled effect may retry safely.
    if (transferApplied.current) return;
    transferApplied.current = true;
    const saved = project.modules["geo-parcel"] as {
      parcel?: GeoPoint[];
      previewParcel?: GeoPoint[];
      province?: string;
      provinceId?: string;
      district?: string;
      districtId?: string;
      neighborhood?: string;
      neighborhoodId?: string;
      block?: string;
      parcelNo?: string;
      buildingWidth?: number;
      buildingDepth?: number;
      rotation?: number;
      offsetEast?: number;
      offsetNorth?: number;
      usage?: string;
      system?: string;
      floors?: number;
      floorHeight?: number;
      sourceCrs?: string;
      dataStatus?: string;
      planning?: Record<string, unknown>;
      zoning?: Partial<ZoningForm>;
      planningScopes?: unknown;
      legacyPlanning?: unknown;
      terrain?: Record<string, unknown>;
      frontEdge?: ParcelFrontEdge;
      selectedMassingId?: string;
      parcelRecord?: ParcelRecord;
      _kernel?: { recordedAt?: string };
    } | undefined;
    const restoredGeometry = restoreParcelGeometry(saved);
    persistedGeoRef.current = Boolean(saved && restoredGeometry);
    if (!saved) { setPlanningHydrated(true); return; }
    if (saved.parcelRecord?.schema === "ARKEM-PARCEL-RECORD/1.0") {
      setParcelSource({
        kind: saved.parcelRecord.evidence.sourceKind,
        identity: saved.parcelRecord.evidence.sourceIdentity ?? saved.parcelRecord.identity,
        authority: saved.parcelRecord.evidence.authority,
        label: saved.parcelRecord.evidence.label,
        capturedAt: saved.parcelRecord.evidence.capturedAt,
        url: saved.parcelRecord.evidence.url ?? "",
        reportedArea: saved.parcelRecord.geometry.reportedArea ?? undefined,
      });
    } else if (saved.parcel?.length) {
      const savedStatus = saved.dataStatus ?? "";
      const kind: ParcelSourceKind = "user-file"; // Legacy labels alone cannot prove a service response.
      setParcelSource({
        kind,
        identity: { province: saved.province ?? "", district: saved.district ?? "", neighborhood: saved.neighborhood ?? "", block: saved.block ?? "", parcelNo: saved.parcelNo ?? "" },
        authority: "Önceki ARKEMX proje kaydı",
        label: savedStatus || "Önceki proje geometrisi",
        capturedAt: saved._kernel?.recordedAt ?? new Date(0).toISOString(),
        url: "",
      });
    }
    if (saved.province) setProvince(saved.province);
    if (saved.provinceId) setProvinceId(saved.provinceId);
    if (saved.district) setDistrict(saved.district);
    if (saved.districtId) setDistrictId(saved.districtId);
    if (saved.neighborhood) setNeighborhood(saved.neighborhood);
    if (saved.neighborhoodId) setNeighborhoodId(saved.neighborhoodId);
    if (saved.block) setBlock(saved.block);
    if (saved.parcelNo) setParcelNo(saved.parcelNo);
    if (restoredGeometry) {
      setParcel(restoredGeometry);
      const savedCenter = geoCentroid(restoredGeometry);
      setLatitude(savedCenter.lat.toFixed(7));
      setLongitude(savedCenter.lng.toFixed(7));
    }
    if (typeof saved.buildingWidth === "number") setBuildingWidth(saved.buildingWidth);
    if (typeof saved.buildingDepth === "number") setBuildingDepth(saved.buildingDepth);
    if (typeof saved.rotation === "number") setRotation(saved.rotation);
    if (typeof saved.offsetEast === "number") setOffsetEast(saved.offsetEast);
    if (typeof saved.offsetNorth === "number") setOffsetNorth(saved.offsetNorth);
    if (saved.usage) setUsage(saved.usage);
    if (saved.system) setSystem(saved.system);
    if (typeof saved.floors === "number") setFloors(saved.floors);
    if (typeof saved.floorHeight === "number") setFloorHeight(saved.floorHeight);
    if (saved.sourceCrs) setSourceCrs(saved.sourceCrs);
    if (saved.dataStatus) setDataStatus(saved.dataStatus);
    setPlanningScopes(restorePlanningScopes(saved.planningScopes));
    // Keep old data recoverable, but do not silently assign unscoped evidence to this parcel.
    legacyPlanning.current = saved.legacyPlanning ?? (saved.zoning || saved.planning
      ? { identity: saved.parcelRecord?.identity ?? null, zoning: saved.zoning, planning: saved.planning }
      : null);
    if (typeof saved.terrain?.slope === "number") setSlope(saved.terrain.slope);
    if (typeof saved.terrain?.exaggeration === "number") setExaggeration(saved.terrain.exaggeration);
    if (saved.terrain?.layers) setTerrainLayers(normalizeTerrainLayers(saved.terrain.layers));
    if (saved.frontEdge && ["north", "east", "south", "west"].includes(saved.frontEdge)) setFrontEdge(saved.frontEdge);
    if (saved.selectedMassingId) setSelectedMassingId(saved.selectedMassingId);
    setPlanningHydrated(true);
    setFileNotice(saved.planningScopes ? "Kayıtlı çalışma açıldı; parsel kimliği ve sınır eşleşmesini kontrol edin." : "Kayıtlı çalışma açıldı. Eski kapsamlanmamış imar bilgileri arşivde korundu; bu parsel için girdileri yeniden kontrol edin.");
    }, 0);
    return () => window.clearTimeout(timer);
  }, [hydrated, project.modules]);

  useEffect(() => {
    if (!provinceOptions.length || !province) return;
    const current = provinceOptions.find((option) => option.id === provinceId);
    if (current && normalizeAdministrativeName(current.label) === normalizeAdministrativeName(province)) return;
    const match = provinceOptions.find((option) => normalizeAdministrativeName(option.label) === normalizeAdministrativeName(province));
    if (!match) return;
    const timer = window.setTimeout(() => setProvinceId(match.id), 0);
    return () => window.clearTimeout(timer);
  }, [province, provinceId, provinceOptions]);

  useEffect(() => {
    if (!districtOptions.length || !district) return;
    const current = districtOptions.find((option) => option.id === districtId);
    if (current && normalizeAdministrativeName(current.label) === normalizeAdministrativeName(district)) return;
    const match = districtOptions.find((option) => normalizeAdministrativeName(option.label) === normalizeAdministrativeName(district));
    if (!match) return;
    const timer = window.setTimeout(() => setDistrictId(match.id), 0);
    return () => window.clearTimeout(timer);
  }, [district, districtId, districtOptions]);

  useEffect(() => {
    if (!neighborhoodOptions.length || !neighborhood) return;
    const current = neighborhoodOptions.find((option) => option.id === neighborhoodId);
    if (current && normalizeAdministrativeName(current.label) === normalizeAdministrativeName(neighborhood)) return;
    const matches = neighborhoodOptions.filter((option) => normalizeAdministrativeName(option.label) === normalizeAdministrativeName(neighborhood));
    // A legacy name is not enough to choose between two different settlements.
    if (matches.length !== 1) return;
    const match = matches[0];
    const timer = window.setTimeout(() => setNeighborhoodId(match.id), 0);
    return () => window.clearTimeout(timer);
  }, [neighborhood, neighborhoodId, neighborhoodOptions]);

  useEffect(() => {
    drawingRef.current = drawEnabled;
  }, [drawEnabled]);

  useEffect(() => {
    const controller = new AbortController();
    const finish = startAdministrativeRequest('province'); setDirectoryError("");
    fetchTkgmJson("idariYapi/ilListe", controller.signal).then(data => {
      if (controller.signal.aborted) return;
      setProvinceOptions(administrativeOptions(data)); setAdministrativeSource("fallback");
    }).catch(error => {
      if (!controller.signal.aborted) { setProvinceOptions([]); setAdministrativeSource("fallback"); setDirectoryError(error.message); }
    }).finally(finish);
    return () => { controller.abort(); finish(); };
  }, [directoryAttempt]);

  useEffect(() => {
    if (!province.trim()) { setDistrictOptions([]); setAdministrativeLoading(administrativeRequests.current.level()); return; }
    const controller = new AbortController();
    const finish = startAdministrativeRequest('district'); setDirectoryError("");
    loadLocationDistricts(province, controller.signal).then(options => {
      if (!controller.signal.aborted) { setDistrictOptions(options); setAdministrativeSource("fallback"); }
    }).catch(error => {
      if (!controller.signal.aborted) { setDistrictOptions([]); setDirectoryError(error.message); }
    }).finally(finish);
    return () => { controller.abort(); finish(); };
  }, [province, directoryAttempt]);

  useEffect(() => {
    if (!districtId.startsWith('directory-district-')) { setNeighborhoodOptions([]); setAdministrativeLoading(administrativeRequests.current.level()); return; }
    const controller = new AbortController();
    const finish = startAdministrativeRequest('neighborhood'); setDirectoryError("");
    loadLocationNeighborhoods(districtId, controller.signal).then(options => {
      if (!controller.signal.aborted) setNeighborhoodOptions(options);
    }).catch(error => {
      if (!controller.signal.aborted) { setNeighborhoodOptions([]); setDirectoryError(error.message); }
    }).finally(finish);
    return () => { controller.abort(); finish(); };
  }, [districtId, directoryAttempt]);
  const center = useMemo(() => geoCentroid(parcel.length ? parcel : [defaultCenter]), [parcel]);
  const building = useMemo(() => buildingFootprint(center, buildingWidth, buildingDepth, rotation, offsetEast, offsetNorth), [center, buildingWidth, buildingDepth, rotation, offsetEast, offsetNorth]);
  const metrics = useMemo(() => {
    const area = polygonArea(parcel);
    const perimeter = polygonPerimeter(parcel);
    const bounds = localBounds(parcel);
    const footprint = buildingWidth * buildingDepth;
    const gross = footprint * floors;
    const altitudes = parcel.map((point) => point.alt).filter((value): value is number => Number.isFinite(value));
    const buildingFits = containsFootprint(parcel, building);
    const boundaryDistance = completeBoundaryDistance(parcel, building);
    const planningArea = planningDraft.netPlotArea ?? 0;
    const coverage = planningArea ? (footprint / planningArea) * 100 : 0;
    const far = planningArea ? gross / planningArea : 0;
    const buildingHeight = floors * floorHeight;
    const allowedFootprint = planningArea * maxCoverage / 100;
    const allowedGross = planningArea * maxFar;
    const parkingNeed = Math.ceil(gross / 100 * parkingPer100);
    const rainwaterReview = area > 2_000 || footprint > 1_000;
    const geometryValid = parcel.length >= 3 && !polygonSelfIntersects(parcel) && area > 1;
    const setbackPass = buildingFits && boundaryDistance >= requiredSetback;
    return { area, perimeter, width: bounds.width, depth: bounds.depth, footprint, gross, coverage, far, buildingHeight, allowedFootprint, allowedGross, parkingNeed, rainwaterReview, geometryValid, buildingFits, setbackPass, boundaryDistance, minAlt: altitudes.length ? Math.min(...altitudes) : null, maxAlt: altitudes.length ? Math.max(...altitudes) : null };
  }, [parcel, building, buildingWidth, buildingDepth, floors, floorHeight, maxCoverage, maxFar, parkingPer100, requiredSetback, planningDraft.netPlotArea]);
  const reference = `${province || "IL"}-${district || "ILCE"}-${block || "ADA"}-${parcelNo || "PARSEL"}`.replace(/\s+/g, "-").toLocaleUpperCase("tr-TR");
  const sourceNetwork = useMemo(
    () => resolveParcelSourceNetwork(province, district, neighborhood),
    [district, province, neighborhood],
  );
  const terrainContours = useMemo(() => createTerrainContours(parcel, slope), [parcel, slope]);
  const terrainModel = useMemo(() => createTerrainModel({
    reference,
    parcel,
    slope,
    exaggeration,
    sourceCrs,
    dataStatus,
    source: {
      kind: parcelSource.kind,
      authority: parcelSource.authority,
      label: parcelSource.label,
      capturedAt: parcelSource.capturedAt,
    },
    projectEligible: parcelRecord.projectEligible && metrics.geometryValid,
    layers: terrainLayers,
  }), [dataStatus, exaggeration, metrics.geometryValid, parcel, parcelRecord.projectEligible, parcelSource, reference, slope, sourceCrs, terrainLayers]);
  const designReady = parcelDesignReady(parcelRecord.projectEligible && isParcelIdentityReady(currentIdentity), metrics.geometryValid, planningDraft);
  const conceptMode = planningDraft.mode === 'concept';
  const massingModel = useMemo(() => conceptMode ? createParcelConcept(reference, designReady ? parcel : [], floorHeight, frontEdge) : createZoningMassingModel({
    reference,
    parcel: designReady ? parcel : [],
    netPlotArea: planningDraft.netPlotArea,
    zoning,
    frontEdge,
    floorHeight,
  }), [conceptMode, designReady, floorHeight, frontEdge, parcel, reference, zoning, planningDraft.netPlotArea]);
  const activeMassingId = useMemo(() => {
    if (selectedMassingId === 'none') return 'none';
    const alternative = massingModel.alternatives.find((item) => item.id === selectedMassingId);
    if (!alternative) return "manual";
    const matches = Math.abs(alternative.width - buildingWidth) < .11
      && Math.abs(alternative.depth - buildingDepth) < .11
      && alternative.floors === floors
      && Math.abs(alternative.rotation - rotation) < .1
      && Math.abs(alternative.offsetEast - offsetEast) < .11
      && Math.abs(alternative.offsetNorth - offsetNorth) < .11;
    return matches ? alternative.id : "manual";
  }, [buildingDepth, buildingWidth, floors, massingModel.alternatives, offsetEast, offsetNorth, rotation, selectedMassingId]);
  const placementReady = designReady && metrics.buildingFits && Number.isInteger(floors) && floors >= 1 && floors <= 20
    && [buildingWidth, buildingDepth, floorHeight].every(n => Number.isFinite(n) && n > 0)
    && [rotation, offsetEast, offsetNorth].every(Number.isFinite);
  const parcelOutputReady = parcelRecord.projectEligible && metrics.geometryValid && isParcelIdentityReady(currentIdentity);
  const hasPlacedModel = placementReady && selectedMassingId !== 'none';
  const terrainPreviewReady = parcelRecord.projectEligible && metrics.geometryValid && parcel.length >= 3;
  const outputBuilding = hasPlacedModel ? building : [];
  const outputRatios = hasPlacedModel ? geometricAreaRatios(metrics.area, metrics.footprint, metrics.gross) : null;
  const outputStatus = !hasPlacedModel ? 'PARSEL ÖN İNCELEMESİ · YAPI YERLEŞTİRİLMEDİ' : conceptMode ? 'KAVRAMSAL ÖN ÇALIŞMA · İMAR BİLİNMİYOR' : 'BEYAN EDİLEN GİRDİLERLE ÖN ÇALIŞMA';
  const exportDisabled = !parcelOutputReady || exportState === "busy";
  const startConcept = () => {
    if (!parcelRecord.projectEligible || !metrics.geometryValid || !isParcelIdentityReady(currentIdentity)) return;
    updatePlanning({ mode: 'concept' });
    setActiveStage('design'); setViewMode('map');
    setFileNotice('İmar bilgisi olmadan kavramsal çalışmaya geçildi. İnşaat hakkı hesaplanmadı; tüm çıktılar bu durumu gösterir.');
  };
  const saveContinuation = () => {
    if (!parcelOutputReady || exportState === 'busy') return;
    patchModule('parcel-continuation', { schema: 'ARKEM-PARCEL-CONTINUATION/1', projectId: project.id,
      identityKey: queryIdentity, reference: parcelRecord.reference, selectedMassingId: hasPlacedModel ? activeMassingId : 'none',
      sourceSignature: JSON.stringify([queryIdentity, parcel, outputBuilding, planningScopes[queryIdentity], usage, system, hasPlacedModel ? floors : null, hasPlacedModel ? floorHeight : null]),
      sourceRevision: project.revision, mode: conceptMode ? 'concept' : 'zoning', authoritative: false,
      zoningPending: conceptMode || !planningDraft.inputsConfirmed, parcelOnly: !hasPlacedModel, boundaryArea: metrics.area, grossArea: hasPlacedModel ? metrics.gross : 0, footprint: hasPlacedModel ? metrics.footprint : 0,
      floors: hasPlacedModel ? floors : 0, floorHeight: hasPlacedModel ? floorHeight : 0, usage, system, width: hasPlacedModel ? buildingWidth : 0, depth: hasPlacedModel ? buildingDepth : 0,
      limitations: conceptMode ? [CONCEPT_ASSUMPTIONS, 'İmar ve uygulama incelemesi gerekli.'] : massingModel.limitations,
    });
  };
  // Long-running PDF generation must still belong to its original input revision.
  const exportContext = JSON.stringify({ project: project.id, projectName: project.name, projectRevision: project.revision, queryIdentity, planningDraft, parcel, parcelSource, building, floors, floorHeight, frontEdge, slope, exaggeration, terrainLayers, usage, system, selectedMassingId, sourceCrs, dataStatus, designReady });
  const currentExportContext = useRef(exportContext);
  useLayoutEffect(() => { currentExportContext.current = exportContext; return () => { currentExportContext.current = ""; }; }, [exportContext]);
  const downloadBlob = (name: string, content: string | Uint8Array, type: string) => {
    if (!parcelOutputReady || currentExportContext.current !== exportContext) {
      throw new Error("Parsel veya girdiler değişti. Güncel sınır ve imar girdilerini kontrol edip çıktıyı yeniden oluşturun.");
    }
    downloadFileBlob(name, content, type);
  };
  const toggleTerrainLayer = (layer: TerrainLayerId) => setTerrainLayers((current) => ({ ...current, [layer]: !current[layer] }));
  const applyMassingAlternative = (alternativeId: string) => {
    if (!designReady) {
      setFileNotice("Önce bu parsele ait sınırı bağlayın ve imar girdilerini kontrol edin. Temsili veya farklı parsele ait veriyle yerleşim uygulanmaz.");
      return;
    }
    const alternative = massingModel.alternatives.find((item) => item.id === alternativeId);
    if (!alternative || alternative.status !== "fits") {
      setFileNotice("Bu alternatif parsel geometrisi veya imar sınırlarından en az birini sağlamıyor; uzman incelemesi gerekli.");
      return;
    }
    setSelectedMassingId(alternative.id);
    setBuildingWidth(alternative.width);
    setBuildingDepth(alternative.depth);
    setFloors(alternative.floors);
    setRotation(alternative.rotation);
    setOffsetEast(alternative.offsetEast);
    setOffsetNorth(alternative.offsetNorth);
    setActiveStage("design");
    setViewMode("map");
    setFileNotice(`${alternative.label} projeye uygulandı · ${alternative.footprint.toFixed(0)} m² taban · ${alternative.floors} kat`);
  };

  const automaticPlacement = useRef("");
  const placementKey = JSON.stringify([project.id, currentIdentity, parcel, planningDraft, frontEdge, floorHeight]);
  useEffect(() => {
    if (activeStage !== "design" || !designReady || automaticPlacement.current === placementKey) return;
    automaticPlacement.current = placementKey;
    const choice = massingModel.recommendedAlternativeId;
    if (choice) applyMassingAlternative(choice);
    else setFileNotice("Girilen koşullarda güvenli bir öneri üretilemedi. Uzman incelemesi ve uygun bir yerleşim gerekli.");
  }, [activeStage, designReady, placementKey, massingModel.recommendedAlternativeId]);

  useEffect(() => {
    if (!hydrated || !planningHydrated) return;
    if (parcelRecord.projectEligible) persistedGeoRef.current = true;
    const projectMetrics = { ...metrics,
      ...(conceptMode ? { allowedFootprint: 0, allowedGross: 0, coverage: 0, far: 0 } : {}),
      ...(!parcelRecord.projectEligible ? { area: 0, geometryValid: false } : {}),
      ...(!hasPlacedModel ? { footprint: 0, gross: 0, coverage: 0, far: 0, buildingHeight: 0, parkingNeed: 0, buildingFits: false, setbackPass: false } : {}),
    };
    patchModule("geo-parcel", {
      reference: parcelRecord.reference,
      needsReview: parcelRecord.evidence.identityMatches === false,
      province,
      provinceId,
      district,
      districtId,
      neighborhood,
      neighborhoodId,
      block,
      parcelNo,
      sourceCrs,
      dataStatus,
      planningMode: planningDraft.mode ?? 'zoning',
      entitlementAvailable: false,
      parcel: parcelRecord.projectEligible ? parcel : [],
      previewParcel: parcelRecord.projectEligible ? [] : parcel,
      center,
      hasPlacedModel,
      building: hasPlacedModel ? building : [],
      buildingWidth: hasPlacedModel ? buildingWidth : null,
      buildingDepth: hasPlacedModel ? buildingDepth : null,
      rotation: designReady ? rotation : null,
      offsetEast: designReady ? offsetEast : null,
      offsetNorth: designReady ? offsetNorth : null,
      usage,
      system,
      floors: hasPlacedModel ? floors : null,
      floorHeight: hasPlacedModel ? floorHeight : null,
      planning: conceptMode ? null : { requiredSetback, maxCoverage, maxFar, maxHeight, parkingPer100 },
      zoning,
      planningScopes,
      legacyPlanning: legacyPlanning.current,
      terrain: { slope, exaggeration, layers: terrainLayers, contourSegments: terrainContours.length },
      terrainModel,
      frontEdge,
      selectedMassingId: hasPlacedModel ? activeMassingId : "none",
      massingModel: designReady && !conceptMode ? massingModel : null,
      conceptModel: designReady && conceptMode ? massingModel : null,
      designReady: hasPlacedModel,
      placementInputsReady: designReady,
      metrics: projectMetrics,
      previewMetrics: parcelRecord.projectEligible ? null : metrics,
      parcelRecord,
      parcelSourceNetwork: sourceNetwork,
      provenance: createGeoProvenance({ reference: parcelRecord.reference, sourceCrs, dataStatus, administrativeSource, geometryValid: parcelRecord.projectEligible && metrics.geometryValid, vertexCount: parcelRecord.projectEligible ? parcel.length : 0 }),
      zoningProvenance: createZoningProvenance(zoning, parcelRecord.reference),
      status: parcelRecord.projectEligible ? "Parsel kaynağı ve sınırı aktif projeye bağlı" : "Temsili geometri · aktif proje verisi değildir",
    });
  }, [hasPlacedModel, activeMassingId, administrativeSource, block, building, buildingDepth, buildingWidth, center, dataStatus, designReady, district, districtId, exaggeration, floorHeight, floors, frontEdge, hydrated, massingModel, maxCoverage, maxFar, maxHeight, metrics, neighborhood, neighborhoodId, offsetEast, offsetNorth, parcel, parcelNo, parcelRecord, parkingPer100, patchModule, planningScopes, planningHydrated, province, provinceId, requiredSetback, rotation, slope, sourceCrs, sourceNetwork, system, terrainContours.length, terrainLayers, terrainModel, usage, zoning]);

  useEffect(() => {
    let disposed = false;
    import("leaflet").then((leaflet) => {
      if (disposed || !mapHostRef.current || mapRef.current) return;
      leafletRef.current = leaflet;
      const map = leaflet.map(mapHostRef.current, { zoomControl: false, attributionControl: true, preferCanvas: false }).setView([defaultCenter.lat, defaultCenter.lng], 17);
      leaflet.control.zoom({ position: "bottomright" }).addTo(map);
      pointsLayerRef.current = leaflet.layerGroup().addTo(map);
      contourLayerRef.current = leaflet.layerGroup().addTo(map);
      map.on("click", (event) => {
        if (!drawingRef.current) return;
        if (drawingGeometry.current.length >= 400) { setFileNotice("400 köşe sınırına ulaşıldı. Mevcut sınır korundu; hiçbir köşe atılmadı."); return; }
        operationSequence.current++;
        setLookupState({ key: "", status: "idle" });
        setParcel((points) => points.length >= 400 ? points : [...points, { lat: event.latlng.lat, lng: event.latlng.lng }]);
        setParcelSource({
          kind: "manual-drawing",
          authority: "Kullanıcı",
          label: "Harita üzerinde düzenlenen sınır",
          capturedAt: new Date().toISOString(),
          url: "",
        });
        setDataStatus("Kullanıcı çizimi · resmî sınır doğrulaması gerekli");
        setFileNotice("Haritadan yeni sınır noktası eklendi");
      });
      mapRef.current = map;
      setMapReady(true);
    }).catch(() => setMapError("Harita motoru yüklenemedi. Koordinat ve dosya araçları çalışmaya devam eder."));
    return () => {
      disposed = true;
      mapRef.current?.remove();
      mapRef.current = null;
      leafletRef.current = null;
      basemapLayerRef.current = null;
      contourLayerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const leaflet = leafletRef.current;
    const map = mapRef.current;
    if (!leaflet || !map || !mapReady) return;
    parcelLayerRef.current?.remove();
    buildingLayerRef.current?.remove();
    pointsLayerRef.current?.clearLayers();
    contourLayerRef.current?.clearLayers();
    const showBoundary = parcelRecord.projectEligible || drawEnabled;
    if (showBoundary && terrainLayers["parcel-boundary"] && parcel.length >= 2) {
      parcelLayerRef.current = leaflet.polygon(parcel.map((point) => [point.lat, point.lng]), { color: "#b96636", weight: 3, fillColor: "#d98a5d", fillOpacity: .16, dashArray: parcel.length < 3 ? "6 6" : undefined }).addTo(map);
    }
    if (showBoundary && (terrainLayers["parcel-boundary"] || terrainLayers["elevation-points"])) parcel.forEach((point, index) => {
      const hasElevation = Number.isFinite(point.alt);
      if (!terrainLayers["parcel-boundary"] && !(terrainLayers["elevation-points"] && hasElevation)) return;
      leaflet.circleMarker([point.lat, point.lng], { radius: hasElevation && terrainLayers["elevation-points"] ? 6 : 5, color: "#ffffff", weight: 2, fillColor: hasElevation && terrainLayers["elevation-points"] ? "#c66e3d" : "#0a2639", fillOpacity: 1 })
        .bindTooltip(`P${index + 1}<br>${point.lat.toFixed(6)}, ${point.lng.toFixed(6)}${hasElevation && terrainLayers["elevation-points"] ? `<br>Z ${point.alt?.toFixed(2)} m` : ""}`)
        .addTo(pointsLayerRef.current!);
    });
    if (designReady && expertMode && terrainLayers.contours) terrainContours.forEach((segment) => {
      const start = fromLocalMeters(segment.start.east, segment.start.north, center);
      const end = fromLocalMeters(segment.end.east, segment.end.north, center);
      leaflet.polyline([[start.lat, start.lng], [end.lat, end.lng]], { color: "#557f75", weight: 1.1, opacity: .68 })
        .bindTooltip(`Eş yükselti ${segment.elevation.toFixed(2)} m`)
        .addTo(contourLayerRef.current!);
    });
    if (hasPlacedModel && terrainLayers["building-mass"] && parcel.length >= 3) buildingLayerRef.current = leaflet.polygon(building.map((point) => [point.lat, point.lng]), { color: "#ffffff", weight: 2, fillColor: "#0a2639", fillOpacity: .64 }).bindTooltip(`${usage}<br>${system}<br>${buildingWidth} × ${buildingDepth} m · ${floors} kat`).addTo(map);
  }, [hasPlacedModel, expertMode, parcelRecord.projectEligible, drawEnabled, parcel, building, center, mapReady, usage, system, buildingWidth, buildingDepth, floors, terrainContours, terrainLayers]);

  useEffect(() => {
    const map = mapRef.current, leaflet = leafletRef.current;
    if (!map || !leaflet || !mapReady) return;
    basemapLayerRef.current?.remove();
    const definition = PARCEL_BASEMAPS[basemapMode];
    const layer = leaflet.tileLayer(definition.url, { maxZoom: 21, maxNativeZoom: definition.maxNativeZoom, attribution: definition.attribution });
    basemapLayerRef.current = layer;
    let errors = 0;
    layer.on('tileerror', () => {
      if (++errors < 3) return;
      setBasemapNotice('Altlık harita yüklenemedi. Parsel sınırı korunur; bağlantınızı kontrol edin.');
    });
    if (terrainLayers.basemap) layer.addTo(map);
    return () => { layer.off(); layer.remove(); };
  }, [mapReady, basemapMode]);

  useEffect(() => {
    const map = mapRef.current;
    const basemap = basemapLayerRef.current;
    if (!map || !basemap || !mapReady) return;
    if (terrainLayers.basemap && !map.hasLayer(basemap)) basemap.addTo(map);
    if (!terrainLayers.basemap && map.hasLayer(basemap)) map.removeLayer(basemap);
  }, [mapReady, basemapMode, terrainLayers.basemap]);

  useEffect(() => {
    if (viewMode !== "map" || !mapReady) return;
    const map = mapRef.current, leaflet = leafletRef.current;
    const resize = () => {
      if (!map || !leaflet) return;
      map.invalidateSize();
      if (parcel.length >= 3) map.fitBounds(leaflet.latLngBounds(parcel.map(point => [point.lat, point.lng])), { padding: [36, 36], maxZoom: 19, animate: false });
    };
    const timer = window.setTimeout(resize, 40);
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(() => map?.invalidateSize());
    if (mapHostRef.current) observer?.observe(mapHostRef.current);
    return () => { window.clearTimeout(timer); observer?.disconnect(); };
  }, [viewMode, mapReady, parcel]);

  const fitMapToPoints = (points: GeoPoint[], delay = 0) => {
    const run = () => {
      const leaflet = leafletRef.current;
      const map = mapRef.current;
      if (!points.length || !leaflet || !map) {
        pendingFitRef.current = points;
        return;
      }
      pendingFitRef.current = null;
      map.invalidateSize();
      map.fitBounds(leaflet.latLngBounds(points.map((point) => [point.lat, point.lng])), { padding: [36, 36], maxZoom: 21 });
    };
    if (delay > 0) window.setTimeout(run, delay);
    else run();
  };
  const fitToParcel = () => fitMapToPoints(parcel);

  useEffect(() => {
    if (!mapReady || !pendingFitRef.current?.length) return;
    const pending = pendingFitRef.current;
    const timer = window.setTimeout(() => fitMapToPoints(pending), 40);
    return () => window.clearTimeout(timer);
  }, [mapReady]);
  const moveToCoordinate = () => {
    const point = validPoint(Number(latitude.replace(",", ".")), Number(longitude.replace(",", ".")));
    if (!point) { setFileNotice("Koordinat WGS84 enlem / boylam aralığında değil"); return; }
    mapRef.current?.setView([point.lat, point.lng], 18);
    setFileNotice(`Harita ${point.lat.toFixed(6)}, ${point.lng.toFixed(6)} koordinatına merkezlendi`);
  };
  const useDeviceLocation = () => {
    if (!navigator.geolocation) { setFileNotice("Bu tarayıcı konum servisini desteklemiyor"); return; }
    setFileNotice("Cihaz konumu bekleniyor…");
    navigator.geolocation.getCurrentPosition((position) => {
      const point = { lat: position.coords.latitude, lng: position.coords.longitude };
      setLatitude(point.lat.toFixed(7));
      setLongitude(point.lng.toFixed(7));
      mapRef.current?.setView([point.lat, point.lng], 18);
      setFileNotice(`Cihaz konumu ±${Math.round(position.coords.accuracy)} m doğrulukla alındı`);
    }, () => setFileNotice("Konum izni verilmedi veya konum alınamadı"), { enableHighAccuracy: true, timeout: 10_000 });
  };
  const markBoundaryAsManual = (label: string) => {
    setParcelSource({
      kind: "manual-drawing",
      authority: "Kullanıcı",
      label,
      capturedAt: new Date().toISOString(),
      url: "",
    });
    setDataStatus("Kullanıcı çizimi · resmî sınır doğrulaması gerekli");
  };
  const removeLastBoundaryPoint = () => {
    operationSequence.current++;
    setParcelLookup("idle");
    setParcel((points) => points.slice(0, -1));
    markBoundaryAsManual("Haritada düzenlenen sınır");
    setFileNotice("Son sınır noktası kaldırıldı; geometri kullanıcı düzenlemesi olarak işaretlendi");
  };
  const clearBoundary = () => {
    operationSequence.current++;
    setParcelLookup("idle");
    setParcel([]);
    markBoundaryAsManual("Temizlenmiş sınır");
    setFileNotice("Parsel sınırı temizlendi; aktif proje geometrisi doğrulama bekliyor");
  };
  const loadSample = () => {
    operationSequence.current++;
    setParcelLookup("idle");
    setDrawEnabled(false);
    const point = validPoint(Number(latitude.replace(",", ".")), Number(longitude.replace(",", "."))) ?? defaultCenter;
    const nextParcel = sampleParcel(point);
    setParcel(nextParcel);
    setParcelSource({
      kind: "sample",
      authority: "ARKEMX",
      label: "Koordinat çevresinde üretilen temsili geometri",
      capturedAt: new Date().toISOString(),
      url: "",
    });
    setDataStatus("Koordinat çevresinde temsili geometri · projeye bağlı değil");
    setFileNotice("Koordinat çevresine temsili, düzensiz örnek parsel üretildi");
    fitMapToPoints(nextParcel, 40);
  };
  const startManualBoundary = () => {
    operationSequence.current++;
    setParcelLookup("idle");
    setParcel([]);
    markBoundaryAsManual("Yeni kullanıcı çizimi · aplikasyon değildir");
    setTerrainLayers(current => ({ ...current, "parcel-boundary": true }));
    setDrawEnabled(true);
    setActiveStage("draw");
    setViewMode("map");
    setFileNotice("Yeni çizim başladı. Haritaya en az üç nokta ekleyin; çizim resmî parsel sınırı değildir.");
  };
  const locateOfficialParcel = async () => {
    if (!provinceId || !districtId || !neighborhoodId || !block.trim() || !parcelNo.trim()) {
      setParcelLookup("error");
      setFileNotice("Sırayla il, ilçe ve mahalle/köy seçin; ardından ada ve parsel numarasını girin");
      return;
    }
    const requestedIdentity = currentQuery.current;
    const requestedSequence = ++operationSequence.current;
    setParcelLookup("loading");
    setFileNotice("TKGM idari kayıtları ve parsel geometrisi sorgulanıyor…");
    try {
      const districtName = locationDirectoryLookupName(districtOptions.find(option => option.id === districtId), 'district');
      const neighborhoodName = locationDirectoryLookupName(neighborhoodOptions.find(option => option.id === neighborhoodId), 'neighborhood');
      const lookup = await lookupTkgmParcel({ province, district: districtName, neighborhood: neighborhoodName, block, parcelNo });
      const response = lookup.response;
      if (!parcelOperationMatches(requestedSequence, operationSequence.current, requestedIdentity, currentQuery.current)) return;
      const feature = parcelFeature(response);
      const points = dedupeClosingPoint(extractGeoJsonPoints(response));
      if (points.length < 3) throw new Error("Parsel kaydı bulundu ancak geçerli sınır geometrisi alınamadı");
      if (points.length > 400) throw new Error("Parsel 400 köşe sınırını aşıyor. Sınır kesilmedi; mevcut parsel korundu. Tam dosyayı harita uzmanıyla değerlendirin");
      const properties = feature.properties ?? {};
      assertParcelResponseIdentity(properties, lookup.resolvedIds);
      const parcelCenter = geoCentroid(points);
      const nextParcel = points;
      const nextIdentity = { province: String(properties.ilAd ?? province), district: String(properties.ilceAd ?? district), neighborhood: String(properties.mahalleAd ?? neighborhood), block, parcelNo };
      const nextSourceCrs = "EPSG:4326 / WGS84";
      setSelectedMassingId('none');
      setParcel(nextParcel);
      setTerrainLayers(current => ({ ...current, "parcel-boundary": true }));
      setLatitude(parcelCenter.lat.toFixed(7));
      setLongitude(parcelCenter.lng.toFixed(7));
      setSourceCrs(nextSourceCrs);
      setProvince(nextIdentity.province);
      setDistrict(nextIdentity.district);
      setNeighborhood(nextIdentity.neighborhood);
      const reportedArea = parseReportedArea(properties.alan);
      setParcelSource({
        kind: "tkgm-open-service",
        identity: nextIdentity,
        authority: "Tapu ve Kadastro Genel Müdürlüğü",
        label: "TKGM MEGSİS açık servis yanıtı",
        capturedAt: lookup.capturedAt,
        url: lookup.sourceUrl,
        reportedArea,
      });
      setDataStatus("TKGM MEGSİS açık servis geometrisi · tapu/aplikasyon belgesi değildir");
      setLookupState({ key: `${parcelIdentityKey(nextIdentity)}|${nextSourceCrs}`, status: "found" });
      setFileNotice(`TKGM kaydı bulundu · ${String(properties.ozet ?? `${block}/${parcelNo}`)} · ${String(properties.alan ?? "alan bilgisi yok")} m²`);
      setActiveStage("draw");
      setViewMode("map");
      setDrawEnabled(false);
      fitMapToPoints(nextParcel, 40);
    } catch (error) {
      if (!parcelOperationMatches(requestedSequence, operationSequence.current, requestedIdentity, currentQuery.current)) return;
      setParcelLookup("error");
      setFileNotice(`${error instanceof Error ? error.message : "Parsel bulunamadı"}. Bilgilerinizi kontrol edip yeniden deneyin. Sınır dosyası yüklemeniz zorunlu değildir.`);
    }
  };
  const handleFile = async (file?: File) => {
    if (!file) return;
    const requestedSequence = ++operationSequence.current;
    const requestedIdentity = currentQuery.current;
    setParcelLookup("idle");
    const sourceIdentity = { ...geometryIdentity.current };
    const requestedCrs = sourceCrs;
    try {
      if (sourceCrs !== "EPSG:4326 / WGS84") throw new Error("Bu araç koordinat dönüşümü yapmaz. Dosyayı kaynak datumuyla uzman tarafından WGS84'e dönüştürüp EPSG:4326 seçin; mevcut parsel korundu.");
      if (file.size > 5_000_000) throw new Error("Mekânsal dosya 5 MB sınırını aşıyor; mevcut parsel korundu.");
      const points = parseSpatialFile(file.name, await file.text());
      if (!parcelOperationMatches(requestedSequence, operationSequence.current, requestedIdentity, currentQuery.current, requestedCrs, currentCrs.current)) return;
      if (points.length < 3) throw new Error("Bu dosyada WGS84 Polygon için en az üç geçerli nokta bulunamadı.");
      if (points.length > 200) throw new Error("Dosya 200 köşe sınırını aşıyor. Sınır kesilmedi; mevcut parsel korundu. Tam dosyayı harita uzmanıyla değerlendirin.");
      const nextParcel = points;
      if (polygonArea(points) <= 1 || polygonSelfIntersects(points)) throw new Error("Sınır geçersiz veya kendiyle kesişiyor; mevcut geometri korundu.");
      setParcel(nextParcel);
      setTerrainLayers(current => ({ ...current, "parcel-boundary": true }));
      setDrawEnabled(false);
      setLatitude(geoCentroid(points).lat.toFixed(7));
      setLongitude(geoCentroid(points).lng.toFixed(7));
      setParcelSource({
        kind: "user-file",
        identity: sourceIdentity,
        authority: "Kullanıcı tarafından sağlanan mekânsal dosya",
        label: file.name,
        capturedAt: new Date().toISOString(),
        url: "",
      });
      setDataStatus(`${file.name} · kullanıcı dosyası · CRS ve ölçüm statüsü doğrulanmalı`);
      setFileNotice(`${file.name}: ${points.length} sınır noktası içe alındı`);
      setActiveStage("draw");
      setViewMode("map");
      fitMapToPoints(nextParcel, 80);
    } catch (error) {
      if (!parcelOperationMatches(requestedSequence, operationSequence.current, requestedIdentity, currentQuery.current, requestedCrs, currentCrs.current)) return;
      setFileNotice(error instanceof Error ? error.message : "Mekânsal dosya okunamadı");
    }
  };

  const updateZoning = <K extends keyof ZoningForm>(key: K, value: ZoningForm[K]) => {
    setZoning((current) => ({ ...current, [key]: value }));
  };

  const updateSetback = (key: "frontSetback" | "sideSetback" | "rearSetback", value: number) => {
    const next = { ...zoning, [key]: value };
    setZoning(next);
  };

  const handleZoningDocument = (file?: File) => {
    if (!file) return;
    setZoning((current) => ({
      ...current,
      sourceDocument: file.name,
      verification: "certified-document",
    }));
    setFileNotice(`${file.name}: yalnız dosya adı referans olarak kaydedildi. Belgenin içeriği saklanmadı, okunmadı veya doğrulanmadı. Gerçek belge gönderimi için İmar kaynağını bağla adımındaki inceleme formunu kullanın.`);
  };

  const exportGeoJson = () => downloadBlob(`${reference}.geojson`, JSON.stringify({ type: "FeatureCollection", name: reference, metadata: { schema: "ARKEM-GEO/1.3", sourceCrs, dataStatus, generatedAt: new Date().toISOString(), parcelRecord, terrainModel, outputStatus, hasPlacedModel, authoritative: false, massingModel: !conceptMode && hasPlacedModel ? massingModel : null, conceptModel: conceptMode && hasPlacedModel ? massingModel : null, planning: conceptMode || !planningDraft.inputsConfirmed ? null : { requiredSetback, maxCoverage, maxFar, maxHeight, parkingPer100 }, zoning: createZoningProvenance(zoning, reference) }, features: [{ type: "Feature", properties: { reference, source: "Arkem Parcel Studio", crs: "EPSG:4326", validation: metrics.geometryValid ? "geometry-pass" : "review" }, geometry: { type: "Polygon", coordinates: [[...parcel, parcel[0]].map((point) => [point.lng, point.lat, point.alt].filter((value) => value !== undefined))] } }, ...(hasPlacedModel ? [{ type: "Feature", properties: { reference: `${reference}-ON-YAPI`, system, usage, floors, floorHeight, selectedMassingId: activeMassingId, coverage: conceptMode ? null : metrics.coverage, far: conceptMode ? null : metrics.far, geometricRatios: outputRatios }, geometry: { type: "Polygon", coordinates: [[...building, building[0]].map((point) => [point.lng, point.lat])] } }] : [])] }, null, 2), "application/geo+json");
  const exportKml = () => downloadBlob(`${reference}.kml`, `<?xml version="1.0" encoding="UTF-8"?><kml xmlns="http://www.opengis.net/kml/2.2"><Document><name>${reference}</name><Placemark><name>Parsel</name><Style><LineStyle><color>ff3666b9</color><width>3</width></LineStyle><PolyStyle><color>443666b9</color></PolyStyle></Style><Polygon><outerBoundaryIs><LinearRing><coordinates>${[...parcel, parcel[0]].map((point) => `${point.lng},${point.lat},${point.alt ?? 0}`).join(" ")}</coordinates></LinearRing></outerBoundaryIs></Polygon></Placemark>${hasPlacedModel ? `<Placemark><name>On Yapi Kutlesi</name><Polygon><outerBoundaryIs><LinearRing><coordinates>${[...building, building[0]].map((point) => `${point.lng},${point.lat},0`).join(" ")}</coordinates></LinearRing></outerBoundaryIs></Polygon></Placemark>` : ""}</Document></kml>`, "application/vnd.google-earth.kml+xml");
  const exportCsv = () => downloadBlob(`${reference}-koordinatlar.csv`, `point,latitude,longitude,elevation_m\n${parcel.map((point, index) => `P${index + 1},${point.lat.toFixed(8)},${point.lng.toFixed(8)},${point.alt ?? ""}`).join("\n")}`, "text/csv;charset=utf-8");
  const exportDxf = () => {
    const origin = geoCentroid(parcel);
    const parcelLocal = parcel.map((point, index) => { const local = toLocalMeters(point, origin); return { x: local.east, y: local.north, label: `P${index + 1}` }; });
    const buildingLocal = outputBuilding.map((point) => { const local = toLocalMeters(point, origin); return { x: local.east, y: local.north }; });
    // Parametric contours are a visual exercise, not survey evidence: omit from CAD delivery.
    const contourLocal: { x: number; y: number }[][] = [];
    const all = [...parcelLocal, ...buildingLocal, ...contourLocal.flat()];
    const minX = Math.min(...all.map((point) => point.x));
    const minY = Math.min(...all.map((point) => point.y));
    // Preserve signed local-metre coordinates and the declared WGS84 origin.
    const shiftedParcel = parcelLocal;
    const shiftedBuilding = buildingLocal;
    const shiftedContours = contourLocal;
    const width = Math.max(...all.map((point) => point.x)) - minX;
    const depth = Math.max(...all.map((point) => point.y)) - minY;
    const dxf = createLayeredDxf({
      title: `ARKEM ${hasPlacedModel ? 'PARSEL VE ON YAPI' : 'PARSEL SINIR PAFTASI'} / ${reference}`,
      width: Math.max(width, 1),
      depth: Math.max(depth, 1),
      polylines: [{ layer: "PARSEL", points: shiftedParcel }, ...(hasPlacedModel ? [{ layer: "ON_YAPI", points: shiftedBuilding }] : []), ...shiftedContours.map((points) => ({ layer: "ESYUKSELTI", points, closed: false }))],
      notes: [
        `WGS84 ORIGIN: ${origin.lat.toFixed(8)}, ${origin.lng.toFixed(8)}`,
        `PARSEL ALANI: ${metrics.area.toFixed(1)} m2 / CEVRE: ${metrics.perimeter.toFixed(1)} m`,
        hasPlacedModel ? `ON YAPI: ${buildingWidth} x ${buildingDepth} m / ${floors} KAT / ${system}` : 'YAPI YERLESTIRILMEDI. BU PAFTA YALNIZ PARSEL SINIRINI ICERIR.',
        'ARAZI: KAYNAKLI PLANKOTE YOK; TEMSILI ESYUKSELTI CIZGILERI CIKARIYORUZ.',
        conceptMode || !planningDraft.inputsConfirmed ? 'IMAR BILINMIYOR / DOGRULANMADI. INSAAT HAKKI HESAPLANMADI.' : `IMAR GIRDILERI: ${ascii(zoning.landUse)} / ${ascii(zoning.buildingOrder)} / TAKS ${zoning.taks.toFixed(2)} / KAKS ${zoning.kaks.toFixed(2)} / HMAX ${zoning.hmax.toFixed(1)} m`,
        `IMAR KAYNAGI: ${ascii(zoningVerificationLabel(zoning.verification))}`,
        hasPlacedModel ? `YERLESIM: ${ascii(activeMassingId)} / ON CEPHE ${ascii(frontEdge)}` : 'YAPI ALANI VE KAT SAYISI BELIRLENMEDI.',
      ],
      sheet: {
        projectName: project.name,
        projectCode: project.id,
        module: "GEO / PARSEL VE ARAZI",
        drawingTitle: `${hasPlacedModel ? 'PARSEL VE ON YAPI YERLESIM PLANI' : 'PARSEL SINIR PAFTASI'} / ${reference}`,
        drawingNo: "GEO-001",
        revision: project.revision,
        status: outputStatus,
        coordinateSystem: `YEREL METRE / KAYNAK ${sourceCrs}`,
        scale: "MODEL 1:1",
        preparedBy: "ARKEMX",
        checkedBy: "UZMAN KONTROLU BEKLIYOR",
      },
    });
    downloadBlob(`${reference}.dxf`, dxf, "application/dxf");
    setFileNotice(`Katmanlı CAD paftası oluşturuldu · ${parcel.length} parsel noktası · PARSEL / ON_YAPI / NOKTA_YAZI katmanları`);
  };
  const exportPdfFormat = (summary = false) => runExport(async () => {
    const { createCorporateTechnicalPdf, createCorporateSummaryPdf } = await import("../lib/technical-sheet");
    const origin = geoCentroid(parcel);
    const toSheet = (points: GeoPoint[], labelPoints = false) => points.map((point, index) => {
      const local = toLocalMeters(point, origin);
      return { x: local.east, y: local.north, label: labelPoints ? `P${index + 1}` : undefined };
    });
    const pdf = await (summary ? createCorporateSummaryPdf : createCorporateTechnicalPdf)({
      projectName: project.name,
      projectCode: project.id,
      module: "ARKEMX / GEO PARSEL STUDYOSU",
      drawingTitle: hasPlacedModel ? "Parsel ve Ön Yapı Yerleşim Paftası" : "Parsel Sınır ve Kaynak Paftası",
      drawingSubtitle: hasPlacedModel ? `${reference} / ${usage} / ${system}` : `${reference} / Yapı yerleşimi yapılmadı`,
      revision: project.revision,
      status: outputStatus,
      sheetNo: "GEO-001",
      scale: "OTOMATIK / METRE",
      coordinateSystem: `Yerel metre / kaynak ${sourceCrs}`,
      northAngleDegrees: 0,
      polylines: [
        { role: "secondary", points: toSheet(parcel, true) },
        ...(hasPlacedModel ? [{ role: "primary" as const, points: toSheet(outputBuilding) }] : []),
      ],
      metrics: [
        ["Geometriden hesaplanan alan", `${metrics.area.toFixed(1)} m²`],
        ["Kaynak kaydındaki alan", parcelSource.reportedArea ? `${parcelSource.reportedArea.toFixed(2)} m²` : 'Kaynakta belirtilmedi'],
        ["Parsel çevresi", `${metrics.perimeter.toFixed(1)} m`],
        ["Yapı tabanı", hasPlacedModel ? `${metrics.footprint.toFixed(1)} m²` : 'Yapı yerleştirilmedi'],
        ["Ön brüt alan", hasPlacedModel ? `${metrics.gross.toFixed(1)} m²` : 'Hesaplanmadı'],
        ["Kat / yükseklik", hasPlacedModel ? `${floors} / ${metrics.buildingHeight.toFixed(1)} m` : 'Belirlenmedi'],
        ["Geometrik taban / brüt alan oranı", outputRatios ? `%${outputRatios.coveragePercent.toFixed(1)} / ${outputRatios.grossAreaRatio.toFixed(2)}` : hasPlacedModel ? 'Hesaplanmadı' : 'Yerleşim yok'],
        ["En kısa geometrik sınır mesafesi", hasPlacedModel ? `${metrics.boundaryDistance.toFixed(1)} m` : 'Yerleşim yok'],
        ["Yapı nizamı", zoning.buildingOrder || 'Bilgi yok'],
        ["İmar kaynağı", zoningVerificationLabel(zoning.verification)],
        ["Arazi temeli", terrainModel.basis === "measured-z" ? `${terrainModel.samples.measured} kaynaklı Z kotu` : 'Plankote verisi yok'],
        ["Kot farkı", terrainModel.basis === "measured-z" ? `${terrainModel.elevation.range.toFixed(2)} m` : 'Hesaplanmadı'],
        ["Yerleşim", hasPlacedModel ? `${activeMassingId} / ön cephe ${frontEdge}` : 'Yapı yerleştirilmedi'],
      ],
      coordinates: parcel.map((point, index) => [
        `P${String(index + 1).padStart(2, "0")}`,
        point.lat.toFixed(7),
        point.lng.toFixed(7),
      ]),
      notes: [
        `${sourceCrs} koordinat sistemi ve ${dataStatus} veri statüsü kullanılmıştır.`,
        hasPlacedModel ? `Kütle: ${buildingWidth.toFixed(1)} × ${buildingDepth.toFixed(1)} m, ${floors} kat, ${rotation}° yönlenme.` : 'Yapı yerleşimi yapılmadı. Bu çıktıda yapı alanı, kat adedi ve yerleşim uygunluğu hesaplanmamıştır.',
        conceptMode ? CONCEPT_ASSUMPTIONS : planningDraft.inputsConfirmed ? `İmar girdisi: TAKS ${zoning.taks.toFixed(2)}, KAKS ${zoning.kaks.toFixed(2)}, Hmax ${zoning.hmax.toFixed(1)} m, ${zoning.buildingOrder}.` : 'İmar bilgisi bulunmadı veya gözden geçirilmedi. İnşaat hakkı hesaplanmadı.',
        `Plan: ${zoning.planName || "belirtilmedi"} / ${zoning.planScale} / ${zoning.planId || "plan işlem no belirtilmedi"}.`,
        `Kaynak statüsü: ${zoningVerificationLabel(zoning.verification)}${zoning.sourceDocument ? ` / ${zoning.sourceDocument}` : ""}.`,
        `Arazi modeli: ${terrainModel.basis === "measured-z" ? `${terrainModel.samples.measured} kaynaklı Z kotu, IDW ön yüzeyi` : `%${slope} parametrik eğim`}; ${terrainModel.limitations[0]}`,
        hasPlacedModel ? `Kütle motoru: ${massingModel.envelope.width.toFixed(1)} × ${massingModel.envelope.depth.toFixed(1)} m kavramsal yapı zarfı; ${massingModel.limitations[0]}` : 'Sınır alanı, tapu alanı ve imara esas net parsel alanı birbirinden farklı olabilir. Bu paftanın geometrik alanı otomatik olarak imara esas net alan kabul edilmez.',
        "Parsel sınırı, aplikasyon ve imar koşulları yetkili meslek mensubu ve resmî belgelerle doğrulanmalıdır.",
      ],
      legend: hasPlacedModel ? [["Ön yapı kütlesi", "primary"], ["Parsel sınırı", "secondary"]] : [["Parsel sınırı", "secondary"]],
    });
    downloadBlob(`${reference}-arkem-${summary ? 'A4-ozet-rapor' : 'A3-teknik-pafta'}.pdf`, pdf, "application/pdf");
    setFileNotice(`${summary ? 'A4 özet rapor' : 'A3 teknik pafta'}; proje kimliği, revizyon, metrik, kaynak ve teknik notlarla oluşturuldu.`);
  });
  const exportPdf = () => exportPdfFormat(false);
  const exportSummaryPdf = () => exportPdfFormat(true);
  const exportLandXml = () => {
    if (terrainModel.basis !== "measured-z") {
      setFileNotice("LandXML yüzeyi için en az üç kaynaklı Z kotu gerekir; parametrik eğim onaylı plankote olarak dışa aktarılmaz");
      return;
    }
    const origin = geoCentroid(parcel);
    const sampler = createTerrainElevationSampler(parcel, slope);
    const points = parcel.map((point, index) => { const local = toLocalMeters(point, origin); const elevation = point.alt ?? sampler.absoluteAt(local.east, local.north); return `<P id="${index + 1}">${elevation.toFixed(3)} ${local.north.toFixed(4)} ${local.east.toFixed(4)}</P>`; }).join("");
    const faces = parcel.length >= 3 ? Array.from({ length: parcel.length - 2 }, (_, index) => `<F>1 ${index + 2} ${index + 3}</F>`).join("") : "";
    downloadBlob(`${reference}.xml`, `<?xml version="1.0" encoding="UTF-8"?><LandXML xmlns="http://www.landxml.org/schema/LandXML-1.2" version="1.2" date="${new Date().toISOString().slice(0,10)}"><Units><Metric linearUnit="meter" areaUnit="squareMeter" volumeUnit="cubicMeter"/></Units><Project name="${ascii(reference)}"/><CoordinateSystem name="Local ENU from WGS84" desc="Origin ${origin.lat.toFixed(8)},${origin.lng.toFixed(8)}"/><Surfaces><Surface name="PARSEL_ON_YUZEY"><Definition surfType="TIN"><Pnts>${points}</Pnts><Faces>${faces}</Faces></Definition></Surface></Surfaces></LandXML>`, "application/xml");
  };
  const exportManifest = () => downloadBlob(`${reference}-veri-manifestosu.json`, JSON.stringify({ schema: "ARKEM-GEO-MANIFEST/2.4", previousSchema: "ARKEM-GEO-MANIFEST/2.3", legacySchema: "ARKEM-GEO-MANIFEST/2.0", reference, sourceCrs, dataStatus, coordinateOrigin: center, parcelRecord, parcelSourceNetwork: sourceNetwork, terrainModel, terrainLayers, outputStatus, hasPlacedModel, massingModel: hasPlacedModel && !conceptMode ? massingModel : null, conceptModel: hasPlacedModel && conceptMode ? massingModel : null, selectedMassingId: activeMassingId, frontEdge, counts: { parcelVertices: parcel.length, buildingVertices: outputBuilding.length, contourSegments: terrainContours.length, massingAlternatives: massingModel.alternatives.length }, planningInputs: conceptMode || !planningDraft.inputsConfirmed ? null : { requiredSetback, maxCoverage, maxFar, maxHeight, parkingPer100 }, zoning: createZoningProvenance(zoning, reference), metrics: { area: metrics.area, perimeter: metrics.perimeter, proposedFootprint: hasPlacedModel ? metrics.footprint : null, proposedGrossArea: hasPlacedModel ? metrics.gross : null }, provenance: createGeoProvenance({ reference, sourceCrs, dataStatus, administrativeSource, geometryValid: metrics.geometryValid, vertexCount: parcel.length }), connectors: [...GEO_CONNECTORS, ...ZONING_CONNECTORS], verification: { officialCadastre: false, licensedSurvey: false, licensedSurveyDeclared: dataStatus === "Harita mühendisi ölçümü" || dataStatus === "Onaylı aplikasyon verisi", zoningCertificate: false, zoningCertificateDeclared: zoning.verification === "certified-document", measuredElevation: false, elevationInputHasZ: terrainModel.basis === "measured-z", massingAuthoritative: massingModel.source.authoritative }, limitations: ["Kadastro sınırı değildir", "İmar uygunluk belgesi değildir", "Aplikasyon veya ruhsat projesi değildir", ...terrainModel.limitations, ...massingModel.limitations] }, null, 2), "application/json");

  const stageContent: Record<Stage, React.ReactNode> = {
    locate: <div className="geo-control-section"><span>01 / PARSELİ BUL</span><h3>Konumunuzu sırayla seçin.</h3><div className="geo-cascade-guide"><b>İl</b><i>→</i><b>İlçe</b><i>→</i><b>Mahalle/Köy</b><i>→</i><b>Ada</b><i>→</i><b>Parsel</b></div><div className="geo-field-grid geo-cascade-fields"><label>İl<select value={provinceId} onChange={(event) => { const selected = provinceOptions.find((item) => item.id === event.target.value); setProvinceId(event.target.value); setProvince(selected?.label ?? ""); setAdministrativeLoading("district"); setDistrictOptions([]); setDistrictId(""); setDistrict(""); setNeighborhoodOptions([]); setNeighborhoodId(""); setNeighborhood(""); }} disabled={!provinceOptions.length}><option value="">{administrativeLoading === "province" ? "İller yükleniyor…" : "İl seçin"}</option>{provinceOptions.map((item) => <option value={item.id} key={item.id}>{item.label}</option>)}</select></label><label>İlçe<select value={districtId} onChange={(event) => { const selected = districtOptions.find((item) => item.id === event.target.value); setDistrictId(event.target.value); setDistrict(selected?.label ?? ""); setAdministrativeLoading("neighborhood"); setNeighborhoodOptions([]); setNeighborhoodId(""); setNeighborhood(""); }} disabled={!provinceId || !districtOptions.length}><option value="">{administrativeLoading === "district" ? "İlçeler yükleniyor…" : provinceId ? "İlçe seçin" : "Önce il seçin"}</option>{districtOptions.map((item) => <option value={item.id} key={item.id}>{item.label}</option>)}</select></label><label>Mahalle / Köy<select value={neighborhoodId} onChange={(event) => { const selected = neighborhoodOptions.find((item) => item.id === event.target.value); setNeighborhoodId(event.target.value); setNeighborhood(selected?.label ?? ""); }} disabled={!districtId || !neighborhoodOptions.length}><option value="">{administrativeLoading === "neighborhood" ? "Mahalleler yükleniyor…" : districtId ? "Mahalle / köy seçin" : "Önce ilçe seçin"}</option>{neighborhoodOptions.map((item) => <option value={item.id} key={item.id}>{item.label}</option>)}</select></label><label>Ada<input value={block} onChange={(event) => setBlock(event.target.value.replace(/\D/g, ""))} inputMode="numeric" placeholder="Ada numarası" disabled={!neighborhoodId} /></label><label>Parsel<input value={parcelNo} onChange={(event) => setParcelNo(event.target.value.replace(/\D/g, ""))} inputMode="numeric" placeholder="Parsel numarası" disabled={!neighborhoodId} /></label></div><p className={`geo-cascade-status ${administrativeSource === "fallback" ? "fallback" : "official"}`}><i className={neighborhoodId ? "ready" : ""}></i>{administrativeSource === "fallback" ? "Bağımsız konum dizini açık · sınır ve imar ayrıca doğrulanır." : neighborhoodId ? `${province} / ${district} / ${neighborhood} seçildi. Ada ve parsel numarasını girin.` : "Her seçim bir sonraki konum listesini açar."}</p><button className={`geo-parcel-query ${parcelLookup}`} onClick={locateOfficialParcel} disabled={parcelLookup === "loading" || !neighborhoodId}><span>{parcelLookup === "loading" ? "…" : parcelLookup === "found" ? "✓" : "TKGM"}</span><b>{parcelLookup === "loading" ? "Parsel aranıyor" : parcelLookup === "found" ? "Parsel bulundu · haritaya işlendi" : "Seçili kayıtta ada / parseli bul"}</b><i>↗</i></button><a className="geo-official-link" href="https://parselsorgu.tkgm.gov.tr/" target="_blank" rel="noreferrer"><span>R</span><b>Resmî Parsel Sorgu’da doğrula</b><i>↗</i></a><p className="geo-caution">İl listesi TKGM kaynak kaydından, ilçe ve mahalle/köy listeleri bağımsız yerleşim dizininden sunulur. Konum dizini kimlikleri TKGM kadastro kimliği değildir. Sınır ve imar için ayrıca kaynak belge gerekir.</p><div className="geo-coordinate-fields"><label>Enlem<input value={latitude} onChange={(event) => setLatitude(event.target.value)} inputMode="decimal" /></label><label>Boylam<input value={longitude} onChange={(event) => setLongitude(event.target.value)} inputMode="decimal" /></label></div><div className="geo-inline-actions"><button onClick={moveToCoordinate}>Koordinata git</button><button onClick={useDeviceLocation}>Cihaz konumu</button></div></div>,
    import: <div className="geo-control-section"><span>02 / MEKÂNSAL VERİ</span><h3>Sınırı kaynağı ve statüsüyle içe alın.</h3><label>Kaynak koordinat sistemi<select value={sourceCrs} onChange={(event) => setSourceCrs(event.target.value)}><option>EPSG:4326 / WGS84</option><option>ITRF96 / 3° TM — dönüşüm gerekli</option><option>ED50 / UTM — dönüşüm gerekli</option><option>Yerel aplikasyon — sabit nokta gerekli</option></select></label><label>Veri statüsü<select value={dataStatus} onChange={(event) => setDataStatus(event.target.value)}><option>Kavramsal / doğrulanmamış</option><option>TKGM ekranından yaklaşık</option><option>Harita mühendisi ölçümü</option><option>Onaylı aplikasyon verisi</option></select></label><label className="geo-file-drop"><input type="file" accept=".kml,.geojson,.json,.csv,.txt" onChange={(event) => handleFile(event.target.files?.[0])} /><b>KML, GeoJSON veya CSV seçin</b><small>Dosya tarayıcıda okunur; sunucuya yüklenmez.</small></label><div className="geo-format-list"><p><b>KML / KMZ</b><span>Google Earth çalışma akışı</span><i>CANLI: KML</i></p><p><b>GeoJSON</b><span>WGS84 Polygon / MultiPolygon</span><i>CANLI</i></p><p><b>CSV</b><span>enlem, boylam, opsiyonel kot</span><i>CANLI</i></p><p><b>SHP / LandXML</b><span>proje dönüşüm hattı</span><i className="planned">KISMİ</i></p></div><p className="geo-caution">Tarayıcı EPSG:4326 enlem / boylam verisini doğrudan işler. ITRF/TM, ED50 veya yerel koordinatlar doğru EPSG, dönüşüm parametreleri ve sabit aplikasyon noktası olmadan WGS84 kabul edilmez.</p></div>,
    draw: <div className="geo-control-section"><span>02 / SINIRI GÖR</span><h3>{parcelRecord.projectEligible ? "Bu sınırın kaynağını kontrol edin." : "Bu parsele ait sınır henüz hazır değil."}</h3><p>{parcelRecord.projectEligible ? `${parcelRecord.evidence.label} · ${parcelRecord.geometry.vertexCount} köşe. Görünüm aplikasyon veya mülkiyet belgesi değildir.` : "Parseli sorgulayın veya doğru koordinat sistemindeki sınır dosyasını yükleyin."}</p><button className="geo-wide-action" onClick={() => { setTerrainLayers(current => ({ ...current, 'parcel-boundary': true })); setViewMode('map'); fitToParcel(); }} disabled={!parcelRecord.projectEligible}>Kaynak sınırını haritada göster</button><ParcelBoundaryPreview points={parcel} eligible={parcelRecord.projectEligible} label={parcelRecord.reference} /><details className="parcel-advanced"><summary>Sınırı kendim çizmek / düzenlemek istiyorum</summary><p>Kaynak sınırı üzerinde değişiklik yapılırsa veri kullanıcı çizimi olur; resmî sınır olarak gösterilmez.</p><button type="button" onClick={startManualBoundary}>Boş bir sınır çizimine başla</button><button className={`geo-toggle-draw${drawEnabled ? " active" : ""}`} onClick={() => { if (!drawEnabled && parcelSource.kind === 'sample') startManualBoundary(); else setDrawEnabled(value => !value); }}><i></i>{drawEnabled ? "Nokta eklemeyi bitir" : "Mevcut sınırı düzenle"}</button><div className="geo-inline-actions"><button onClick={removeLastBoundaryPoint} disabled={!parcel.length || parcelSource.kind === 'sample'}>Son noktayı geri al</button><button onClick={clearBoundary} disabled={!parcel.length}>Sınırı temizle</button></div><button className="geo-wide-action" onClick={loadSample}>Yalnız örnek geometriyi dene</button><div className="geo-point-table"><header><span>Nokta</span><span>Enlem</span><span>Boylam</span></header>{parcel.slice(0, 12).map((point, index) => <p key={`${point.lat}-${point.lng}-${index}`}><b>P{String(index + 1).padStart(2, "0")}</b><span>{point.lat.toFixed(6)}</span><span>{point.lng.toFixed(6)}</span></p>)}</div></details></div>,
    zoning: <div className="geo-control-section geo-zoning-control">
      <span>04 / PARSEL BAZLI İMAR</span>
      <h3>Plan kararını kaynağıyla birlikte projeye bağlayın.</h3>
      <div className="geo-zoning-status" data-state={zoning.verification}>
        <i></i>
        <div><b>{zoningVerificationLabel(zoning.verification)}</b><small>{reference}</small></div>
      </div>
      <div className="geo-zoning-source-grid">
        {ZONING_CONNECTORS.map((connector) => connector.href
          ? <a href={connector.href} target="_blank" rel="noreferrer" key={connector.id}><b>{connector.label}</b><small>{connector.purpose}</small><i>↗</i></a>
          : <article key={connector.id}><b>{connector.label}</b><small>{connector.purpose}</small><i>PROJE BAĞLANTISI</i></article>)}
      </div>
      <label>Doğrulama statüsü
        <select value={zoning.verification} onChange={(event) => updateZoning("verification", event.target.value as ZoningVerification)}>
          <option value="user-declared">Kullanıcı girdisi · doğrulanmadı</option>
          <option value="municipal-viewer">{zoningVerificationLabel("municipal-viewer")}</option>
          <option value="approved-plan">{zoningVerificationLabel("approved-plan")}</option>
          <option value="certified-document">{zoningVerificationLabel("certified-document")}</option>
        </select>
      </label>
      <label>Arazi kullanım kararı<input value={zoning.landUse} onChange={(event) => updateZoning("landUse", event.target.value)} placeholder="Konut, ticaret, sanayi…" /></label>
      <div className="geo-field-grid">
        <label>Plan adı<input value={zoning.planName} onChange={(event) => updateZoning("planName", event.target.value)} placeholder="Uygulama imar planı" /></label>
        <label>Plan ölçeği<select value={zoning.planScale} onChange={(event) => updateZoning("planScale", event.target.value)}><option>1/1000 Uygulama İmar Planı</option><option>1/5000 Nazım İmar Planı</option><option>1/25000 Çevre Düzeni Planı</option><option>Diğer / plan paftasına göre</option></select></label>
        <label>Plan işlem / pafta no<input value={zoning.planId} onChange={(event) => updateZoning("planId", event.target.value)} placeholder="PIN, pafta veya karar no" /></label>
        <label>Yapı nizamı<select value={zoning.buildingOrder} onChange={(event) => updateZoning("buildingOrder", event.target.value)}><option value="">Belirtilmedi</option><option>Ayrık nizam</option><option>Bitişik nizam</option><option>Blok nizam</option><option>İkiz nizam</option><option>Serbest nizam</option><option>Plan notuna göre</option></select></label>
      </div>
      <div className="geo-planning-grid geo-zoning-values">
        <label>TAKS<input type="number" min=".01" max="1" step=".01" value={zoning.taks > 0 ? zoning.taks : ''} onChange={(event) => updateZoning("taks", Number(event.target.value))}/></label>
        <label>KAKS / Emsal<input type="number" min=".05" max="10" step=".05" value={zoning.kaks > 0 ? zoning.kaks : ''} onChange={(event) => updateZoning("kaks", Number(event.target.value))}/></label>
        <label>Hmax / Yençok<input type="number" min="0" max="250" step=".5" value={zoning.hmax > 0 ? zoning.hmax : ''} onChange={(event) => updateZoning("hmax", Number(event.target.value))}/><b>m</b></label>
      </div>
      <div className="geo-planning-grid geo-zoning-values">
        <label>Ön bahçe<input type="number" min="0" max="100" step=".5" value={zoning.frontSetback >= 0 ? zoning.frontSetback : ''} onChange={(event) => updateSetback("frontSetback", Number(event.target.value))}/><b>m</b></label>
        <label>Yan bahçe<input type="number" min="0" max="100" step=".5" value={zoning.sideSetback >= 0 ? zoning.sideSetback : ''} onChange={(event) => updateSetback("sideSetback", Number(event.target.value))}/><b>m</b></label>
        <label>Arka bahçe<input type="number" min="0" max="100" step=".5" value={zoning.rearSetback >= 0 ? zoning.rearSetback : ''} onChange={(event) => updateSetback("rearSetback", Number(event.target.value))}/><b>m</b></label>
      </div>
      <label>Plan notu referansı<textarea rows={3} value={zoning.planNoteReference} onChange={(event) => updateZoning("planNoteReference", event.target.value)} placeholder="Madde, özel hüküm, açıklama…" /></label>
      <label>Kaynak bağlantısı<input type="url" value={zoning.sourceUrl} onChange={(event) => updateZoning("sourceUrl", event.target.value)} placeholder="Belediye e-İmar veya e-Plan bağlantısı" /></label>
      <label className="geo-file-drop"><input type="file" accept=".pdf,.png,.jpg,.jpeg" onChange={(event) => handleZoningDocument(event.target.files?.[0])} /><b>Belge adını referanslayın</b><small>Yalnız dosya adı tutulur. Belge içeriği burada yüklenmez veya doğrulanmaz.</small></label>
      <label>100 m² başına otopark · plandaki koşul<input type="number" min="0" max="10" step=".25" value={parkingPer100} onChange={event => setParkingPer100(Number(event.target.value))} /></label>
      <label className="parcel-input-confirmation"><input type="checkbox" checked={planningDraft.inputsConfirmed} onChange={event => updatePlanning({ mode: 'zoning', inputsConfirmed: event.target.checked })} disabled={!isParcelIdentityReady(currentIdentity)} /><span>Girilen imar ve otopark bilgilerini bu parsel için gözden geçirdim. Bu işaret belediye veya uzman onayı değildir.</span></label>
      {!designReady && <p className="geo-caution">Ön çalışma için bu parsele ait sınır, pozitif TAKS/KAKS/yükseklik değerleri ve yukarıdaki girdi kontrolü gerekir. Sıfır çekme mesafesi ancak plan koşulu gerçekten sıfırsa girilmelidir. Her değişiklik kontrol işaretini kaldırır.</p>}
      <p className="geo-caution"><b>Türkiye geneli entegrasyon sınırı:</b> Ulusal ölçekte tek ve açık bir TAKS/KAKS/Hmax servisi bulunmadığından TKGM parsel kimliği; e-Plan/TUCBS, belediye e-İmar adaptörü ve onaylı imar durumu belgesiyle eşleştirilir. Kaynaksız değer resmî imar hakkı olarak gösterilmez.</p>
    </div>,
    design: <div className="geo-control-section">
      <span>05 / YAPI YERLEŞİMİ</span>
      <h3>Beyan edilen girdilerle yapıyı deneyin.</h3>
      <div className="geo-zoning-summary">
        <span>BU PARSEL İÇİN GİRİLEN KOŞULLAR · RESMÎ ONAY DEĞİLDİR</span>
        <b>{zoning.buildingOrder} · TAKS {zoning.taks.toFixed(2)} · KAKS {zoning.kaks.toFixed(2)}</b>
        <small>Hmax {zoning.hmax.toFixed(1)} m · Ön/yan/arka {zoning.frontSetback}/{zoning.sideSetback}/{zoning.rearSetback} m</small>
        <button onClick={() => setActiveStage("zoning")}>İmar girdilerini düzenleyin</button>
      </div>
      <section className="v112-massing-engine" aria-label="Girilen koşullara göre kütle alternatifleri">
        <header>
          <div><span>GİRDİLERE GÖRE KÜTLE ALTERNATİFLERİ</span><b>Girilen çekme mesafeleri ve alan oranlarından üç açıklanabilir alternatif.</b></div>
          <em data-trust={massingModel.source.trust}>{massingModel.source.authoritative ? "İMAR KAYNAĞI DOĞRULANDI" : "ÖN DEĞERLENDİRME"}</em>
        </header>
        <label className="v112-front-edge">Ön cephe yönü
          <select value={frontEdge} onChange={(event) => setFrontEdge(event.target.value as ParcelFrontEdge)}>
            <option value="north">Kuzey</option><option value="east">Doğu</option><option value="south">Güney</option><option value="west">Batı</option>
          </select>
          <small>Yol cephesi resmî aplikasyon veya halihazır haritayla doğrulanmalıdır.</small>
        </label>
        <div className="v112-envelope-ledger">
          <p><span>YAPI ZARFI</span><b>{massingModel.envelope.width.toFixed(1)} × {massingModel.envelope.depth.toFixed(1)} m</b></p>
          <p><span>GİRİLEN TAKS'A GÖRE TABAN</span><b>{massingModel.limits.allowedFootprint.toFixed(0)} m²</b></p>
          <p><span>GİRİLEN KAKS'A GÖRE ALAN</span><b>{massingModel.limits.allowedGrossArea.toFixed(0)} m²</b></p>
          <p><span>GİRİLEN YÜKSEKLİĞE GÖRE KAT</span><b>{massingModel.limits.maxFloors} kat / {massingModel.limits.allowedHeight.toFixed(1)} m</b></p>
        </div>
        <div className="v112-massing-options">
          {massingModel.alternatives.map((alternative) => <article key={alternative.id} data-state={alternative.status} data-selected={activeMassingId === alternative.id}>
            <div><span>{alternative.status === "fits" ? "ÖN UYUMLU" : "İNCELEME"}</span><b>{alternative.label}</b></div>
            <strong>{alternative.grossArea.toFixed(0)} <i>m²</i></strong>
            <p>{alternative.width.toFixed(1)} × {alternative.depth.toFixed(1)} m · {alternative.floors} kat</p>
            <dl><div><dt>TAKS</dt><dd>%{alternative.coverage.toFixed(1)}</dd></div><div><dt>KAKS</dt><dd>{alternative.far.toFixed(2)}</dd></div><div><dt>Hak kullanımı</dt><dd>%{alternative.utilization.toFixed(0)}</dd></div></dl>
            <small>{alternative.note}</small>
            <button onClick={() => applyMassingAlternative(alternative.id)} disabled={!designReady || alternative.status !== "fits"}>{activeMassingId === alternative.id ? "Projede seçili" : "Bu alternatifi uygula"}</button>
          </article>)}
        </div>
        <footer><b>Sınırlayıcı veri:</b> {massingModel.alternatives.find((item) => item.id === activeMassingId)?.governingConstraint ?? "manuel yerleşim / uzman incelemesi"}. {massingModel.limitations[0]}</footer>
      </section>
      <label>Kullanım<select value={usage} onChange={(event) => setUsage(event.target.value)}><option>Sanayi / Depo</option><option>Konut / Villa</option><option>Ticari Yapı</option><option>Tarımsal Yapı</option><option>Sosyal Tesis</option></select></label>
      <label>Taşıyıcı sistem<select value={system} onChange={(event) => setSystem(event.target.value)}><option>Karar Bekleniyor</option><option>Betonarme</option><option>Betonarme Prefabrik</option><option>Yapısal Çelik</option><option>Hafif Çelik</option><option>Karma Sistem</option></select></label>
      <label>Yapı genişliği <b>{buildingWidth.toFixed(1)} m</b><input type="range" min="6" max="70" step=".1" value={buildingWidth} onChange={(event) => setBuildingWidth(Number(event.target.value))} /></label>
      <label>Yapı derinliği <b>{buildingDepth.toFixed(1)} m</b><input type="range" min="8" max="100" step=".1" value={buildingDepth} onChange={(event) => setBuildingDepth(Number(event.target.value))} /></label>
      <div className="geo-planning-grid"><label>Kat adedi<input type="number" min="1" max="20" value={floors} onChange={(event) => setFloors(Number(event.target.value))}/></label><label>Kat yüksekliği<input type="number" min="2.6" max="12" step=".1" value={floorHeight} onChange={(event) => setFloorHeight(Number(event.target.value))}/><b>m</b></label><label>100 m² başına park<input type="number" min="0" max="10" step=".25" value={parkingPer100} onChange={(event) => setParkingPer100(Number(event.target.value))}/></label></div>
      <label>Kuzeye göre açı <b>{rotation}°</b><input type="range" min="0" max="345" step="5" value={rotation} onChange={(event) => setRotation(Number(event.target.value))} /></label>
      <label>Doğu / batı ofseti <b>{offsetEast} m</b><input type="range" min="-35" max="35" value={offsetEast} onChange={(event) => setOffsetEast(Number(event.target.value))} /></label>
      <label>Kuzey / güney ofseti <b>{offsetNorth} m</b><input type="range" min="-35" max="35" value={offsetNorth} onChange={(event) => setOffsetNorth(Number(event.target.value))} /></label>
    </div>,
    terrain: <div className="geo-control-section">
      <span>06 / GIS + 3B ARAZİ</span>
      <h3>Kot, eş yükselti ve kütleyi tek modelde okuyun.</h3>
      <div className="v111-terrain-basis" data-basis={terrainModel.basis}>
        <span>ARAZİ VERİ TEMELİ</span>
        <b>{terrainModel.basis === "measured-z" ? `${terrainModel.samples.measured} kaynaklı kot noktası` : "Parametrik eğim önizlemesi"}</b>
        <small>{terrainModel.basis === "measured-z" ? `${terrainModel.source.label} · düşey datum doğrulanmalı` : "Ölçüm ve onaylı plankote değildir"}</small>
      </div>
      <label>Temsili boyuna eğim <b>%{slope}</b><input type="range" min="0" max="30" value={slope} onChange={(event) => setSlope(Number(event.target.value))} disabled={terrainModel.basis === "measured-z"} /></label>
      <label>Düşey abartı <b>{exaggeration.toFixed(1)}×</b><input type="range" min="0.5" max="4" step="0.5" value={exaggeration} onChange={(event) => setExaggeration(Number(event.target.value))} /></label>
      <button className="geo-wide-action" onClick={() => setViewMode("terrain")}>Ortak 3B arazi modelini açın</button>
      <div className="geo-source-stack"><p><i className={terrainModel.basis === "parametric-slope" ? "live" : ""}></i><span><b>Parametrik yüzey</b><small>{terrainModel.basis === "parametric-slope" ? "Kavramsal çalışma yüzeyi aktif" : "Ölçülmüş kotlar varken kullanılmıyor"}</small></span></p><p><i className={terrainModel.basis === "measured-z" ? "live" : ""}></i><span><b>CSV / KML kot noktası</b><small>{terrainModel.basis === "measured-z" ? `${terrainModel.elevation.minimum?.toFixed(1)}–${terrainModel.elevation.maximum?.toFixed(1)} m · ${terrainModel.surface.contourSegments} eş yükselti parçası` : "Dosyada en az üç Z değeri bekliyor"}</small></span></p><p><i></i><span><b>Cesium / fotogrametri</b><small>Token ve proje veri setiyle bağlanır</small></span></p><p><i></i><span><b>Google 3B Tiles</b><small>API anahtarı + faturalandırma gerekir</small></span></p></div>
    </div>,
    export: <div className="geo-control-section"><span>07 / TEKNİK ÇIKTI</span><h3>Geometriyi, imar kaynağını ve veri statüsünü kurumsal paftayla aktarın.</h3><div className="geo-export-list"><button onClick={exportPdf} disabled={exportDisabled}><span>PDF</span><b>A3 kurumsal teknik pafta</b><i>↓</i></button><button onClick={exportDxf} disabled={exportDisabled}><span>CAD</span><b>DWG uyumlu antetli DXF</b><i>↓</i></button><button onClick={exportKml} disabled={exportDisabled}><span>KML</span><b>Google Earth aktarımı</b><i>↓</i></button><button onClick={exportGeoJson} disabled={exportDisabled}><span>GJSON</span><b>GeoJSON + arazi metadata</b><i>↓</i></button><button onClick={exportLandXml} disabled={exportDisabled || terrainModel.basis !== "measured-z"}><span>XML</span><b>{terrainModel.basis === "measured-z" ? "LandXML kaynaklı TIN başlangıcı" : "LandXML için üç kaynaklı Z kotu gerekli"}</b><i>↓</i></button><button onClick={exportCsv} disabled={exportDisabled}><span>CSV</span><b>WGS84 koordinat ve kot listesi</b><i>↓</i></button><button onClick={exportManifest} disabled={exportDisabled}><span>MAN</span><b>Parsel · imar · arazi kanıt manifestosu</b><i>↓</i></button></div>{!parcelRecord.projectEligible && <p className="geo-caution"><b>Çıktı bekliyor:</b> Temsili başlangıç geometrisi teknik teslim üretmez. TKGM sınırı, doğrulanmış mekânsal dosya veya kullanıcı sınır düzenlemesi kaynağıyla kaydedilmelidir.</p>}<p className="geo-caution"><b>DWG notu:</b> İndirilen katmanlı DXF; pafta çerçevesi, antet, proje kimliği, imar kaynağı ve revizyon bilgilerini içerir ve CAD ortamında DWG olarak kaydedilebilir. Doğrudan DWG üretimi için lisanslı dönüşüm servisi gerekir.</p></div>,
  };

  const journeyIndex = activeStage === "locate" || activeStage === "import" ? 0 : activeStage === "draw" ? 1 : activeStage === "zoning" ? 2 : 3;
  const identityReady = isParcelIdentityReady(currentIdentity);
  const nextIndex = journeyIndex === 0 && !parcelRecord.projectEligible ? 2 : Math.min(3, journeyIndex + 1);
  const nextDisabled = !parcelJourneyGate(nextIndex, identityReady, parcelRecord.projectEligible);
  return <section className="geo-parcel-studio" data-guided={!expertMode} data-stage={journeyIndex} data-concept={conceptMode}>
    <p className={`module-feedback ${exportState}`} role="status">{exportMessage}</p>
    {expertMode && <ProjectKernelBar module="GEO·BIM PARCEL ENGINE" confidence={dataStatus} />}
    <header className="geo-studio-top"><div><span>01 / PARSEL REHBERİ</span><b>Parselinizi bulun ve inceleyin</b><p>Konum ve tapu bilgilerini girin. Kaynak sınır bulunduğunda harita, 3B arazi ve koordinatları inceleyin.</p></div></header>
    {(expertMode || parcelOutputReady) && <div className="parcel-output-promise"><Files aria-hidden="true"/><p><b>Yapı yerleştirmeden de teknik çıktınızı alın.</b><span>Sınır bulunduğunda A3 parsel paftası, A4 özet rapor ve DXF hazırdır. Yapı eklerseniz yerleşiminiz de çıktılara işlenir.</span></p><a href={parcelOutputReady ? '#parsel-teknik-ciktilar' : undefined} aria-disabled={!parcelOutputReady}>{parcelOutputReady ? 'Çıktılara git' : 'Sınır bulununca hazır'}<ArrowRight aria-hidden="true"/></a></div>}
    <nav className="parcel-journey" aria-label="Arsa değerlendirme adımları"><ol>{PARCEL_JOURNEY.map((step, index) => <li key={step.id}><button type="button" aria-current={journeyIndex === index ? 'step' : undefined} disabled={!parcelJourneyGate(index, identityReady, parcelRecord.projectEligible)} onClick={() => { setActiveStage(step.id); setDrawEnabled(false); }}><span className="parcel-step-number">{String(index + 1).padStart(2, '0')}</span><div><b>{step.label}</b><small>{step.note}</small></div></button></li>)}</ol></nav>

    {journeyIndex === 0 && activeStage === 'import' && <button type="button" className="parcel-expert-toggle" onClick={() => setActiveStage('locate')}>← Ada / parsel bilgilerine dön</button>}
    {identityReady && parcelRecord.evidence.identityMatches === false && <div className="module-example-notice" role="alert"><b>Seçtiğiniz parsel ile geometri kaynağı eşleşmiyor.</b><p>Eski geometri yalnız önizlemedir ve yeni parsele aktarılmadı. Yeni parseli tekrar sorgulayın; önceki sınır yeni parsele aktarılmaz.</p></div>}

    {expertMode && <nav className="geo-workflow" aria-label="Uzman araçları">{stages.map((stage) => <button key={stage.id} className={activeStage === stage.id ? "active" : ""} onClick={() => setActiveStage(stage.id)} disabled={stage.id === 'export' ? !parcelOutputReady : ['design', 'terrain'].includes(stage.id) ? !designReady : stage.id === 'zoning' ? !identityReady : false}><i>{stage.no}</i><span><b>{stage.label}</b><small>{stage.sub}</small></span></button>)}</nav>}
    <details className="gis-source-disclosure"><summary>Veri kaynakları ve yetki durumu <span>Detayları incele</span></summary>
    <section className="geo-integration-map" aria-label="Coğrafi veri entegrasyon haritası"><header><span>V81 / VERİ KAYNAĞI HARİTASI · V91 İMAR KATMANI</span><b>Her sonuç kaynağı ve yetki sınırıyla taşınır</b></header><div>{GEO_CONNECTORS.map((connector) => <article key={connector.id} data-state={connector.id === "tkgm" && administrativeSource === "fallback" ? "protocol-required" : connector.state}><i></i><span><b>{connector.label}</b><small>{connector.purpose}</small></span><em>{connector.id === "tkgm" && administrativeSource === "fallback" ? "SERVİS BEKLİYOR" : connector.state.replaceAll("-", " ").toLocaleUpperCase("tr-TR")}</em></article>)}</div><div className="geo-zoning-connector-row">{ZONING_CONNECTORS.map((connector) => <article key={connector.id} data-state={connector.state}><i></i><span><b>{connector.label}</b><small>{connector.purpose}</small></span><em>{connector.state.replaceAll("-", " ").toLocaleUpperCase("tr-TR")}</em></article>)}</div><p>Resmî kadastro, imar, aplikasyon ve fotogerçekçi 3B katmanlar; yalnız yetkili protokol, güncel plan veya onaylı belge sağlandığında proje kanıtı olarak işaretlenir.</p></section>
    </details>
    <div className="parcel-auto-research" hidden={activeStage !== 'zoning' && !expertMode}><MunicipalPlanResearch sourceRevision={`${parcelSource.kind}:${parcelSource.capturedAt}:${sourceCrs}`} identity={currentIdentity} points={parcel} eligible={parcelRecord.projectEligible && identityReady} /></div>
    {activeStage === 'zoning' && <section className="parcel-zoning-paths" aria-label="İmar bilgisi olmadan devam"><div><h3>İmar belgeniz henüz yok mu?</h3><p>Çalışmanızı durdurmanıza gerek yok. Parsel sınırı üzerinde kavramsal yerleşim hazırlayın; imar belgesi geldiğinde bu projede güncelleyin.</p>{!parcelRecord.projectEligible && <p>Sınır henüz bağlı değil. 1. adımda parseli haritada sorgulayın. Gerçek sınır alınmadan temsili çizim bu parsele bağlanmaz.</p>}</div><button type="button" disabled={!parcelRecord.projectEligible || !metrics.geometryValid} onClick={startConcept}>İmar bilgisi olmadan devam et<ArrowRight aria-hidden="true"/></button></section>}
    <div className="geo-workspace">
      <aside className="geo-controls">{activeStage === 'locate' ? <ParcelLocationStep
        province={{ value: provinceId, options: provinceOptions, onChange: id => { setProvinceId(id); setProvince(provinceOptions.find(item => item.id === id)?.label ?? ''); setAdministrativeLoading('district'); setDistrictOptions([]); setDistrictId(''); setDistrict(''); setNeighborhoodOptions([]); setNeighborhoodId(''); setNeighborhood(''); } }}
        district={{ value: districtId, options: districtOptions, onChange: id => { setDistrictId(id); setDistrict(districtOptions.find(item => item.id === id)?.label ?? ''); setAdministrativeLoading('neighborhood'); setNeighborhoodOptions([]); setNeighborhoodId(''); setNeighborhood(''); } }}
        neighborhood={{ value: neighborhoodId, options: neighborhoodOptions, onChange: id => { setNeighborhoodId(id); setNeighborhood(neighborhoodOptions.find(item => item.id === id)?.label ?? ''); } }}
        error={directoryError} neighborhoodName={neighborhood} onNeighborhoodName={name => { setNeighborhoodId('manual-neighborhood'); setNeighborhood(name); }} onRetry={() => { setAdministrativeLoading('province'); setDirectoryAttempt(value => value + 1); }}
        block={block} parcelNo={parcelNo} onBlock={setBlock} onParcel={setParcelNo} loading={administrativeLoading ?? ''} searching={parcelLookup === 'loading'} found={parcelLookup === 'found'} identityReady={identityReady}
        onSearch={locateOfficialParcel} onImport={() => setActiveStage('import')} onZoning={() => setActiveStage('zoning')} />
        : !expertMode && activeStage === 'draw' ? <div className="parcel-selection-summary"><span>02 / SEÇİLİ PARSEL</span><h3>Sınırınızı kontrol edin.</h3><p>{parcelRecord.reference}</p><dl><div><dt>Kaynak sınır alanı</dt><dd>{metrics.area.toLocaleString('tr-TR', {maximumFractionDigits: 1})} m²</dd></div><div><dt>Sınır noktaları</dt><dd>{parcel.length} köşe</dd></div><div><dt>Konum</dt><dd>{neighborhood} / {district}</dd></div></dl><p>Haritadaki çizgi sorgu kaynağının sınırıdır. Tapu alanı veya aplikasyon ölçüsü yerine geçmez.</p><button type="button" className="geo-wide-action" onClick={() => setActiveStage('zoning')}>İmar ve plan notlarını incele →</button><button type="button" onClick={fitToParcel}>Sınırın tamamını göster</button></div>
        : activeStage === 'zoning' ? <div className="parcel-zoning-manual"><h3>Bilginiz varsa ekleyin; yoksa devam edin.</h3><p>Otomatik araştırmanın sonucu yukarıda görünür. Elinizde imar belgesi varsa bilgileri girebilirsiniz; bu adım kavramsal yerleşim ve parsel çıktısı için zorunlu değildir.</p><details className="parcel-manual-entry"><summary>İmar bilgilerini kendim gireceğim</summary><ParcelAreaBudget key={`${project.id}:${parcelIdentityKey(currentIdentity)}`} identity={currentIdentity} measuredArea={parcelRecord.projectEligible ? metrics.area : null} far={zoning.kaks} onFarChange={value => updateZoning('kaks', Number.isFinite(value) ? value : 0)} netPlotArea={planningDraft.netPlotArea} netAreaBasis={planningDraft.netAreaBasis} onNetAreaChange={(netPlotArea, netAreaBasis) => updatePlanning({ netPlotArea, netAreaBasis })} />{stageContent.zoning}<ParcelZoningCapture key={`${project.id}:${queryIdentity}`} onApply={patch => updatePlanning({ mode: 'zoning', zoning: { ...zoning, ...patch } })}/></details><details className="parcel-source-details"><summary>Resmî kaynaklar ve belge inceleme seçenekleri</summary><ParcelZoningGuide identity={currentIdentity} eligible={identityReady}/></details></div>
        : !expertMode && journeyIndex === 3 ? <div className="parcel-selection-summary"><h3>{hasPlacedModel ? 'Seçili yerleşiminiz' : 'Parseliniz hazır'}</h3><p>{parcelRecord.reference}</p><dl><div><dt>Öneri brüt alanı</dt><dd>{hasPlacedModel ? `${metrics.gross.toLocaleString('tr-TR')} m²` : 'Yapı yerleştirilmedi'}</dd></div><div><dt>Yapı boyutları</dt><dd>{hasPlacedModel ? `${buildingWidth.toFixed(1)} × ${buildingDepth.toFixed(1)} m · ${floors} kat` : 'Henüz belirlenmedi'}</dd></div><div><dt>Çalışmanın dayanağı</dt><dd>{conceptMode ? 'İmar bekleniyor · tasarım denemesi' : 'Beyan edilen imar girdileri'}</dd></div></dl><p>Haritanın altında üç yerleşimi karşılaştırabilir, A3 pafta ve A4 raporu indirebilirsiniz.</p><button type="button" className="geo-wide-action" onClick={startConcept} disabled={!parcelOutputReady}>İsteğe bağlı yapı yerleşimini dene</button><a href="#parsel-teknik-ciktilar">Teknik çıktıları görüntüle ↓</a><button type="button" onClick={() => setActiveStage('zoning')}>İmar bilgilerine dön</button><button type="button" onClick={fitToParcel}>Sınırın tamamını göster</button></div>
        : stageContent[activeStage]}<div className="geo-control-notice" role="status"><i></i><span><b>Çalışma durumu</b><small>{fileNotice}</small></span></div></aside>
      <section className="geo-stage" aria-label="Parsel çalışma görünümü" hidden={!expertMode && activeStage === 'zoning'}>
        <div className="geo-stage-toolbar"><div className="gis-view-tabs">{([{"id":"map","label":"Harita"},{"id":"terrain","label":"3B arazi"},{"id":"data","label":"Koordinatlar"}] as const).map((view) => <button type="button" key={view.id} aria-pressed={viewMode === view.id} className={viewMode === view.id ? "active" : ""} onClick={() => setViewMode(view.id)}>{view.label}</button>)}</div><div className="gis-map-settings"><span>Görünüm:</span><div className="parcel-basemap-choices" role="group" aria-label="Harita görünümü">{([{"id":"osm","label":"Sokak"},{"id":"satellite","label":"Uydu"},{"id":"topographic","label":"Topoğrafik"}] as const).map(mode => <button type="button" key={mode.id} aria-pressed={basemapMode === mode.id} onClick={() => { setBasemapMode(mode.id); setBasemapNotice(""); setViewMode("map"); }}>{mode.label}</button>)}</div><button type="button" className="gis-fit-map" onClick={fitToParcel}>Parsele odaklan</button></div></div>
        <div className="parcel-basemap-bar"><b>Parsel haritası</b><p>{parcelRecord.projectEligible ? `${parcelRecord.evidence.label} · ${PARCEL_BASEMAPS[basemapMode].label} altlığı. Harita bilgilendirme amaçlıdır.` : `${PARCEL_BASEMAPS[basemapMode].label} altlığı · Henüz bu parsele bağlı sınır yok.`}</p></div>
        {basemapNotice && <p className="parcel-map-notice" role="status">{basemapNotice}</p>}
        {parcelRecord.projectEligible || expertMode ? <div className="parcel-coordinate-summary"><span>{parcelRecord.projectEligible ? 'Kaynak geometrisinin merkezi' : 'Önizleme merkezi · seçili parsel verisi değil'}</span><b>WGS84 / EPSG:4326 · {center.lat.toFixed(6)}, {center.lng.toFixed(6)}</b><small>Web Mercator / EPSG:3857 · X {webMercatorPoint(center.lat, center.lng)?.x.toFixed(2) ?? '—'} / Y {webMercatorPoint(center.lat, center.lng)?.y.toFixed(2) ?? '—'} m · aplikasyon koordinatı değildir.</small></div> : <div className="parcel-map-welcome"><b>Parseliniz burada görünecek.</b><span>Konum ve ada / parsel bilgilerinizi tamamlayın. “Parseli haritada göster” düğmesiyle sınır otomatik sorgulanır.</span></div>}
        <details className="gis-layers-disclosure"><summary>Harita ve 3B arazi katmanlarını düzenle</summary><section className="v111-layer-dock" aria-label="Ortak GIS ve 3B arazi katmanları">
          <header><div><span>V111 / ORTAK HARİTA + 3B KATMANLARI</span><b>Bir seçim, iki görünüm, tek proje kaydı.</b></div><em data-trust={terrainModel.trust}>{terrainModel.basis === "measured-z" ? `${terrainModel.samples.measured} KOT · ${terrainModel.trust === "verified" ? "YETKİLİ BEYAN" : "KAYNAK DOSYA"}` : "KAVRAMSAL YÜZEY"}</em></header>
          <div>{terrainModel.layers.map((layer) => <label key={layer.id} data-available={layer.available}><input type="checkbox" checked={terrainLayers[layer.id]} onChange={() => toggleTerrainLayer(layer.id)} disabled={!layer.available} /><span><b>{layer.label}</b><small>{layer.available ? terrainLayers[layer.id] ? "Görünür" : "Gizli" : "Veri bekliyor"}</small></span></label>)}</div>
          <footer><span>{terrainModel.source.authority}</span><b>{terrainModel.basis === "measured-z" ? `Kot ${terrainModel.elevation.minimum?.toFixed(2)}–${terrainModel.elevation.maximum?.toFixed(2)} m · ${terrainContours.length} eş yükselti parçası` : `%${slope} temsili eğim · plankote değildir`}</b></footer>
        </section></details>
        <div className={`geo-map-frame${viewMode !== "map" ? " hidden-view" : ""}`}><div ref={mapHostRef} className="geo-leaflet-map"></div>{!mapReady && <div className="geo-map-loading"><b>{mapError || "Harita hazırlanıyor"}</b><small>Kaynak sınır önizlemesi harita servisinden bağımsızdır.</small></div>}<div className="parcel-map-inset"><ParcelBoundaryPreview points={parcel} eligible={parcelRecord.projectEligible} label={parcelRecord.reference} /></div><div className="geo-map-legend"><span><i></i>Kaynak sınırı</span><span><i></i>Kavramsal yapı</span><span><i></i>Sınır noktası</span></div>{drawEnabled && <div className="geo-map-crosshair" aria-hidden="true">+</div>}</div>
        {viewMode === "terrain" && (terrainPreviewReady ? <GeoTerrainViewer parcel={parcel} hasBuilding={hasPlacedModel} buildingWidth={buildingWidth} buildingDepth={buildingDepth} floors={floors} rotation={rotation} offsetEast={offsetEast} offsetNorth={offsetNorth} slope={slope} exaggeration={exaggeration} layers={terrainLayers} terrainModel={terrainModel} /> : <div className="gis-terrain-empty" role="status"><b>3B arazi için geçerli parsel sınırı gerekli.</b><p>Önce konum ve ada/parsel sorgusunu tamamlayın veya kaynaklı KML/GeoJSON sınırı içe aktarın. Örnek geometri bu parsele bağlanmaz.</p></div>)}
        {viewMode === "data" && <div className="geo-data-view"><header><div><span>KAYNAK CRS BEYANI</span><b>{sourceCrs}</b></div><div><span>İŞLEME DÜZLEMİ</span><b>WGS84 → lokal ENU · metre</b></div><div><span>VERİ STATÜSÜ</span><b>{dataStatus}</b></div></header><section className="v111-terrain-ledger"><article><span>YÜZEY TEMELİ</span><b>{terrainModel.basis === "measured-z" ? "Ölçülmüş Z / IDW" : "Parametrik eğim"}</b><small>{terrainModel.trust.toLocaleUpperCase("tr-TR")}</small></article><article><span>KOT ÖRNEĞİ</span><b>{terrainModel.samples.measured} / {terrainModel.samples.total}</b><small>Ölçülmüş / toplam nokta</small></article><article><span>KOT ARALIĞI</span><b>{terrainModel.elevation.range.toFixed(2)} m</b><small>{terrainModel.elevation.datum === "source-declared" ? "Kaynak datum beyanı" : "Yerel bağıl düzlem"}</small></article><article><span>EŞ YÜKSELTİ</span><b>{terrainContours.length}</b><small>Marching-squares önizleme parçası</small></article></section><div className="geo-data-table"><div className="head"><span>ID</span><span>LATITUDE</span><span>LONGITUDE</span><span>EAST / m</span><span>NORTH / m</span><span>Z / m</span></div>{parcel.map((point, index) => { const local = toLocalMeters(point, center); return <div key={`${point.lat}-${point.lng}-${index}`}><b>P{String(index + 1).padStart(2, "0")}</b><span>{point.lat.toFixed(8)}</span><span>{point.lng.toFixed(8)}</span><span>{local.east.toFixed(3)}</span><span>{local.north.toFixed(3)}</span><span>{point.alt?.toFixed(2) ?? "—"}</span></div>; })}</div><footer><p><b>CRS kontrolü</b> Hesap motoru koordinatları coğrafi derece olarak yorumlar ve parsel merkezi çevresinde lokal ENU düzlemine alır. Kaynak veri WGS84 değilse doğru EPSG dönüşümü yapılmadan alan ve mesafe sonuçları proje verisi sayılmaz.</p><p><b>Arazi kontrolü</b> {terrainModel.limitations[0]}</p></footer></div>}
        <div className="gis-map-facts" aria-label="Parsel kaynak ve durum özeti"><span><small>Kaynak</small><b>{parcelRecord.projectEligible ? parcelRecord.evidence.label : "Kaynak sınır bekleniyor"}</b></span><span><small>{parcelRecord.projectEligible ? "Parsel merkez koordinatı" : "Harita önizleme merkezi"}</small><b>{center.lat.toFixed(6)}, {center.lng.toFixed(6)}</b></span><span><small>Durum</small><b>{parcelRecord.projectEligible ? "Kaynak sınır · ön inceleme" : "Sınır henüz doğrulanmadı"}</b></span></div>
        <details className="gis-external-tools"><summary>Haritayı başka uygulamada aç / KML</summary><div className="geo-connectors"><a href={`https://www.google.com/maps/search/?api=1&query=${center.lat},${center.lng}`} target="_blank" rel="noreferrer"><span>G</span><div><b>Google Maps’te aç</b><small>{center.lat.toFixed(6)}, {center.lng.toFixed(6)}</small></div><i>↗</i></a><a href={`https://earth.google.com/web/search/${center.lat},${center.lng}`} target="_blank" rel="noreferrer"><span>E</span><div><b>Google Earth’te aç</b><small>KML ile sınır ve kütle aktarın</small></div><i>↗</i></a><button onClick={exportKml} disabled={exportDisabled}><span>K</span><div><b>Earth KML paketini indir</b><small>{exportDisabled ? "Önce kaynaklı bir parsel sınırı oluşturun" : hasPlacedModel ? "Parsel + ön yapı poligonu" : "Yalnız kaynaklı parsel sınırı"}</small></div><i>↓</i></button></div></details>
      </section>
      {hasPlacedModel ? <aside className="geo-results"><span>CANLI TEKNİK ÖZET</span><div className="geo-primary-metric"><small>HESAPLANAN PARSEL ALANI</small><strong>{metrics.area.toLocaleString("tr-TR", { maximumFractionDigits: 1 })}<i>m²</i></strong><p>{parcel.length} köşe · {metrics.perimeter.toFixed(1)} m çevre</p></div><div className="geo-metric-grid"><article><span>Sınır kutusu</span><b>{metrics.width.toFixed(1)} × {metrics.depth.toFixed(1)} m</b></article><article><span>Yapı tabanı</span><b>{metrics.footprint.toLocaleString("tr-TR")} m²</b></article><article><span>TAKS / girdi · imar</span><b className={metrics.coverage > maxCoverage ? "risk" : "good"}>%{metrics.coverage.toFixed(1)} / %{maxCoverage}</b></article><article><span>KAKS / girdi · imar</span><b className={metrics.far > maxFar ? "risk" : "good"}>{metrics.far.toFixed(2)} / {maxFar.toFixed(2)}</b></article><article><span>Yükseklik</span><b className={metrics.buildingHeight > maxHeight ? "risk" : "good"}>{metrics.buildingHeight.toFixed(1)} / {maxHeight.toFixed(1)} m</b></article><article><span>Yapı nizamı</span><b>{zoning.buildingOrder}</b></article></div><div className="geo-current-design"><span>İMAR & KÜTLE KONTROLÜ</span><h4>{usage}</h4><p>{system} · {floors} kat · {rotation}° yönlenme</p><div><small>İmar kaynağı</small><b>{zoningVerificationLabel(zoning.verification)}</b></div><div><small>Girilen TAKS'a göre taban</small><b>{metrics.allowedFootprint.toFixed(0)} m²</b></div><div><small>Girilen KAKS'a göre alan</small><b>{metrics.allowedGross.toFixed(0)} m²</b></div><div><small>En yakın sınır / hedef</small><b className={metrics.setbackPass ? "good" : "risk"}>{metrics.boundaryDistance.toFixed(1)} / {requiredSetback.toFixed(1)} m</b></div></div><div className="geo-validation"><span>SAYISAL ÖN KONTROL / KAYNAK BEYANI</span>{[[metrics.geometryValid, "Kapalı ve kesişmesiz geometri"],[metrics.setbackPass, "Yapı parsel / çekme kontrolü"],[metrics.coverage <= maxCoverage && metrics.far <= maxFar && metrics.buildingHeight <= maxHeight, "İmar girdileriyle ön uyum"],[Boolean(block && parcelNo), "Ada / parsel referansı"],[zoning.verification === "approved-plan" || zoning.verification === "certified-document", "Onaylı imar kaynağı beyanı · incelenmedi"],[dataStatus === "Onaylı aplikasyon verisi", "Aplikasyon statüsü beyanı · incelenmedi"]].map(([done, label]) => <p key={String(label)} className={done ? "done" : ""}><i>{done ? "✓" : ""}</i><span>{label}</span></p>)}</div><button className="geo-result-cta" onClick={() => { setActiveStage("export"); setViewMode("data"); }}>Teknik çıktı paketini hazırlayın <span>↗</span></button></aside> : <aside className="geo-results"><span>PARSELİNİZİN DURUMU</span><h3>{parcelRecord.projectEligible ? "Sınır bağlandı" : "Sınır bekleniyor"}</h3>{parcelRecord.projectEligible && <p>{metrics.area.toLocaleString('tr-TR', { maximumFractionDigits: 1 })} m² kaynak sınırı</p>}<p>Sınır bağlandıysa yapı yerleştirmeden de teknik çıktınızı alabilirsiniz. İmar bulunamadığında kavramsal çalışmayla devam edebilirsiniz.</p><button type="button" onClick={() => setActiveStage(identityReady ? 'zoning' : 'locate')}>{identityReady ? 'İmar adımına dönün' : 'Parsel bilgilerini tamamlayın'}</button><small>Bu çalışma resmî imar durumu veya mühendislik onayı değildir.</small></aside>}
    </div>
    <div className="parcel-next-action"><div><b>{PARCEL_JOURNEY[journeyIndex].label}</b><small>{nextDisabled ? journeyIndex === 2 ? 'Sınır sorgusu henüz tamamlanmadı. İmar araştırmasına devam edebilirsiniz; yerleşim için kaynak sınırı gerekir.' : 'Konum, mahalle, ada ve parsel bilgilerini tamamlayın.' : journeyIndex === 2 ? 'İmar koşulları incelenmeden sonuç yalnız kavramsal ön çalışmadır.' : 'Seçimleriniz bu projede korunur.'}</small></div><div><button type="button" disabled={journeyIndex === 0} onClick={() => setActiveStage(journeyIndex === 2 && !parcelRecord.projectEligible ? 'locate' : PARCEL_JOURNEY[Math.max(0, journeyIndex - 1)].id)}>Geri</button>{journeyIndex < 3 ? <button type="button" disabled={nextDisabled} onClick={() => { setActiveStage(PARCEL_JOURNEY[nextIndex].id); setDrawEnabled(false); }}>{nextIndex === 3 ? 'Ön çalışmaya geç →' : `${PARCEL_JOURNEY[nextIndex].label} →`}</button> : <button type="button" disabled={exportDisabled} onClick={exportPdf}>Ön çalışma PDF’ini indir ↓</button>}</div></div>
    <details className="gis-expert-disclosure"><summary>Gelişmiş GIS işlemleri</summary><p>Kaynak, çizim ve teknik aşama araçlarına ihtiyacınız varsa buradan erişebilirsiniz.</p><button type="button" onClick={() => setExpertMode(value => !value)}>{expertMode ? "Sade görünüme dön" : "Teknik düzenleme araçlarını aç"}</button></details>
    <details className="v109-parcel-center parcel-advanced" data-record-state={parcelRecord.state}><summary>Parsel kaydı ve kaynak ayrıntıları</summary>
      <header>
        <div><span>V109 / PARSEL VERİ MERKEZİ</span><h3>Parsel kimliği, sınırı ve kaynağı tek kayıtta.</h3></div>
        <aside data-eligible={parcelRecord.projectEligible}>
          <i>{parcelRecord.projectEligible ? "✓" : "i"}</i>
          <span><b>{parcelRecord.projectEligible ? "Aktif projeye bağlı" : "Önizleme · projeye aktarılmadı"}</b><small>{project.id} · {project.revision}</small></span>
        </aside>
      </header>
      <div className="v109-parcel-summary">
        <article><span>PARSEL KAYDI</span><b>{parcelRecord.reference}</b><small>{parcelRecord.state === "identified" ? "TKGM açık servis kaydı" : parcelRecord.state === "user-supplied" ? "Kullanıcı mekânsal dosyası" : parcelRecord.state === "needs-review" ? "Uzman doğrulaması gerekli" : "Temsili başlangıç görünümü"}</small></article>
        <article><span>SINIR GEOMETRİSİ</span><b>{parcelRecord.geometry.valid ? `${parcelRecord.geometry.vertexCount} köşe · ${parcelRecord.geometry.computedArea.toLocaleString("tr-TR", { maximumFractionDigits: 1 })} m²` : "Geçerli sınır bekleniyor"}</b><small>{parcelRecord.geometry.coordinateReferenceSystem} · {parcelRecord.evidence.officialCadastre ? "resmî kadastro" : "aplikasyon değildir"}</small></article>
        <article><span>KAYNAK VE KANIT</span><b>{parcelRecord.evidence.label}</b><small>{parcelRecord.evidence.sourceKind === "sample" ? "Örnek veri · resmî sorgu zamanı yok" : `${parcelRecord.evidence.authority} · ${parcelRecord.evidence.capturedAt.replace("T", " ").slice(0, 16)}`}</small></article>
      </div>
      <div className="v109-source-network" aria-label="Parsel ve imar resmî kaynak ağı">
        <header><div><span>Kaynak ve kanıt</span><b>{sourceNetwork.authority || `${province} için yetkili idare rotası`}</b></div><small>81 il yönlendirmesi · kaynaklar çelişirse uzman incelemesi</small></header>
        <div>{sourceNetwork.sources.map((source) => <article key={source.id} data-state={source.state}>
          <i></i><span><b>{source.label}</b><small>{source.purpose}</small><em>{source.state === "matched" ? "EŞLEŞTİ" : source.state === "available" ? "ERİŞİLEBİLİR" : "DOĞRULAMA GEREKLİ"}</em></span>
          {source.href ? <a href={source.href} target="_blank" rel="noreferrer" aria-label={`${source.label} kaynağını açın`}>↗</a> : <strong>—</strong>}
        </article>)}</div>
      </div>
    </details>
    {parcelOutputReady && <>
      <ParcelOutcomePanel parcel={parcel} alternatives={massingModel.alternatives} selectedId={activeMassingId} concept={conceptMode} showAlternatives={journeyIndex === 3 && designReady} hasBuilding={hasPlacedModel} onRemove={() => { setSelectedMassingId('none'); setFileNotice('Yapı çıktıdan ve haritadan çıkarıldı. Parsel paftasını indirebilir veya yeni bir yerleşim seçebilirsiniz.'); }} onSelect={applyMassingAlternative} onPdf={exportPdf} onSummary={exportSummaryPdf} onDxf={exportDxf} onKml={exportKml} disabled={exportDisabled} busy={exportState === 'busy'} projectName={project.name} onContinue={saveContinuation}/>
      {!expertMode && journeyIndex === 3 && designReady && <details className="parcel-edit-placement"><summary>Ölçüleri, yönü ve kullanım türünü düzenle</summary>{stageContent.design}</details>}
    </>}
    <footer className="geo-studio-foot"><b>Hukuki ve teknik sınır</b><p>Bu çalışma alanı erken karar, veri hazırlığı ve disiplinler arası koordinasyon içindir. Tapu/kadastro kaydı, aplikasyon, imar uygunluğu, zemin etüdü, mühendislik hesabı veya ruhsat projesi yerine geçmez. TKGM parsel kimliği; e-Plan/TUCBS katmanları, belediye e-İmar adaptörleri ve onaylı imar durumu belgesiyle kaynaklandırılır. Yetkili servis, protokol veya belge bulunmadan TAKS, KAKS, Hmax ve nizam değeri resmî hak olarak sunulmaz.</p></footer>
  </section>;
}
