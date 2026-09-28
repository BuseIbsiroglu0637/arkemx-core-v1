"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { LayerGroup, Map as LeafletMap, Polygon as LeafletPolygon } from "leaflet";
import { GeoTerrainViewer } from "./GeoTerrainViewer";
import { buildingFootprint, fromLocalMeters, geoCentroid, localBounds, minimumBoundaryDistance, pointInPolygon, polygonArea, polygonPerimeter, polygonSelfIntersects, sampleParcel, toLocalMeters, type GeoPoint } from "../lib/geo";
import { createLayeredDxf } from "../lib/engineering";
import { createCorporateTechnicalPdf } from "../lib/technical-sheet";
import { createGeoProvenance, GEO_CONNECTORS } from "../lib/geo-integration";
import {
  createParcelRecord,
  resolveParcelSourceNetwork,
  type ParcelRecord,
  type ParcelSourceKind,
} from "../lib/parcel-record";
import { createZoningProvenance, DEFAULT_ZONING, normalizeUntrustedZoningVerification, ZONING_CONNECTORS, zoningVerificationLabel, type ZoningForm, type ZoningVerification } from "../lib/zoning";
import {
  DEFAULT_TERRAIN_LAYERS,
  createTerrainContours,
  createTerrainElevationSampler,
  createTerrainModel,
  normalizeTerrainLayers,
  type TerrainLayerId,
  type TerrainLayerVisibility,
} from "../lib/terrain-model";
import { createZoningMassingModel, type ParcelFrontEdge } from "../lib/zoning-massing";
import { ProjectKernelBar, useProjectKernel } from "./ProjectKernel";

type Stage = "locate" | "import" | "draw" | "zoning" | "design" | "terrain" | "export";
type ViewMode = "map" | "terrain" | "data";
type BasemapMode = "satellite" | "street" | "hybrid";
type LeafletModule = typeof import("leaflet");
type TkgmFeature = { type?: string; geometry?: unknown; properties?: Record<string, unknown> };
type AdministrativeOption = { id: string; label: string };

const FALLBACK_PROVINCE_NAMES = [
  "Adana", "Adıyaman", "Afyonkarahisar", "Ağrı", "Amasya", "Ankara", "Antalya", "Artvin", "Aydın", "Balıkesir",
  "Bilecik", "Bingöl", "Bitlis", "Bolu", "Burdur", "Bursa", "Çanakkale", "Çankırı", "Çorum", "Denizli",
  "Diyarbakır", "Edirne", "Elazığ", "Erzincan", "Erzurum", "Eskişehir", "Gaziantep", "Giresun", "Gümüşhane", "Hakkâri",
  "Hatay", "Isparta", "Mersin", "İstanbul", "İzmir", "Kars", "Kastamonu", "Kayseri", "Kırklareli", "Kırşehir",
  "Kocaeli", "Konya", "Kütahya", "Malatya", "Manisa", "Kahramanmaraş", "Mardin", "Muğla", "Muş", "Nevşehir",
  "Niğde", "Ordu", "Rize", "Sakarya", "Samsun", "Siirt", "Sinop", "Sivas", "Tekirdağ", "Tokat",
  "Trabzon", "Tunceli", "Şanlıurfa", "Uşak", "Van", "Yozgat", "Zonguldak", "Aksaray", "Bayburt", "Karaman",
  "Kırıkkale", "Batman", "Şırnak", "Bartın", "Ardahan", "Iğdır", "Yalova", "Karabük", "Kilis", "Osmaniye", "Düzce",
] as const;

const FALLBACK_PROVINCES: AdministrativeOption[] = FALLBACK_PROVINCE_NAMES.map((label, index) => ({
  id: String(index + 1),
  label,
}));

const FALLBACK_DISTRICTS: Record<string, string[]> = {
  Sakarya: ["Adapazarı", "Akyazı", "Arifiye", "Erenler", "Ferizli", "Geyve", "Hendek", "Karapürçek", "Karasu", "Kaynarca", "Kocaali", "Pamukova", "Sapanca", "Serdivan", "Söğütlü", "Taraklı"],
  Kastamonu: ["Merkez", "Abana", "Ağlı", "Araç", "Azdavay", "Bozkurt", "Cide", "Çatalzeytin", "Daday", "Devrekani", "Doğanyurt", "Hanönü", "İhsangazi", "İnebolu", "Küre", "Pınarbaşı", "Seydiler", "Şenpazar", "Taşköprü", "Tosya"],
  İstanbul: ["Adalar", "Arnavutköy", "Ataşehir", "Avcılar", "Bağcılar", "Bahçelievler", "Bakırköy", "Başakşehir", "Bayrampaşa", "Beşiktaş", "Beykoz", "Beylikdüzü", "Beyoğlu", "Büyükçekmece", "Çatalca", "Çekmeköy", "Esenler", "Esenyurt", "Eyüpsultan", "Fatih", "Gaziosmanpaşa", "Güngören", "Kadıköy", "Kağıthane", "Kartal", "Küçükçekmece", "Maltepe", "Pendik", "Sancaktepe", "Sarıyer", "Silivri", "Sultanbeyli", "Sultangazi", "Şile", "Şişli", "Tuzla", "Ümraniye", "Üsküdar", "Zeytinburnu"],
  Ankara: ["Altındağ", "Ayaş", "Bala", "Beypazarı", "Çankaya", "Çubuk", "Elmadağ", "Etimesgut", "Gölbaşı", "Kahramankazan", "Keçiören", "Mamak", "Polatlı", "Pursaklar", "Sincan", "Şereflikoçhisar", "Yenimahalle"],
  İzmir: ["Aliağa", "Balçova", "Bayraklı", "Bornova", "Buca", "Çeşme", "Çiğli", "Gaziemir", "Güzelbahçe", "Karabağlar", "Karşıyaka", "Kemalpaşa", "Konak", "Menemen", "Narlıdere", "Seferihisar", "Selçuk", "Torbalı", "Urla"],
  Bursa: ["Gemlik", "Gürsu", "İnegöl", "Kestel", "Mudanya", "Mustafakemalpaşa", "Nilüfer", "Osmangazi", "Yıldırım"],
  Kocaeli: ["Başiskele", "Çayırova", "Darıca", "Derince", "Dilovası", "Gebze", "Gölcük", "İzmit", "Kandıra", "Karamürsel", "Kartepe", "Körfez"],
};

function fallbackDistrictOptions(provinceName: string) {
  return (FALLBACK_DISTRICTS[provinceName] ?? ["Merkez / ilçe adını proje notunda belirtin"]).map((label, index) => ({
    id: `offline-district-${index + 1}`,
    label,
  }));
}

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
  kind: ParcelSourceKind;
  authority: string;
  label: string;
  capturedAt: string;
  url: string;
  reportedArea?: number;
};

function normalizeAdministrativeName(value: unknown) {
  return String(value ?? "").trim().toLocaleLowerCase("tr-TR").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\b(mahallesi|mah\.?|köyü|koyu|köy|koy)\b/g, "").replace(/[^a-z0-9çğıöşü]+/g, "");
}

async function fetchTkgmJson(path: string) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 13_500);
  try {
    const response = await fetch(`/api/tkgm?path=${encodeURIComponent(path)}`, { headers: { Accept: "application/json" }, signal: controller.signal });
    if (!response.ok) {
      const detail = await response.json().catch(() => ({})) as { error?: string };
      throw new Error(detail.error ?? `TKGM ${response.status}`);
    }
    return await response.json() as Record<string, unknown>;
  } finally {
    window.clearTimeout(timeout);
  }
}

function administrativeId(feature?: TkgmFeature) {
  const properties = feature?.properties ?? {};
  return properties.id ?? properties.ilId ?? properties.ilceId ?? properties.mahalleId;
}

function administrativeOptions(data: Record<string, unknown>) {
  const features = Array.isArray(data.features) ? data.features as TkgmFeature[] : [];
  return features.map((feature) => {
    const properties = feature.properties ?? {};
    const id = administrativeId(feature);
    const label = String(properties.text ?? properties.ad ?? properties.name ?? properties.ilAd ?? properties.ilceAd ?? properties.mahalleAd ?? "").trim();
    return id === undefined || !label ? null : { id: String(id), label };
  }).filter((item): item is AdministrativeOption => Boolean(item)).sort((a, b) => a.label.localeCompare(b.label, "tr"));
}

function validPoint(lat: number, lng: number, alt?: number): GeoPoint | null {
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return { lat, lng, alt: Number.isFinite(alt) ? alt : undefined };
}

function extractGeoJsonPoints(value: unknown): GeoPoint[] {
  if (!value || typeof value !== "object") return [];
  const data = value as Record<string, unknown>;
  if (data.type === "Feature") return extractGeoJsonPoints(data.geometry);
  if (data.type === "FeatureCollection" && Array.isArray(data.features)) {
    for (const feature of data.features) {
      const points = extractGeoJsonPoints(feature);
      if (points.length >= 3) return points;
    }
  }
  if (data.type === "Polygon" && Array.isArray(data.coordinates)) {
    const ring = data.coordinates[0];
    if (Array.isArray(ring)) return ring.map((coordinate) => {
      if (!Array.isArray(coordinate)) return null;
      return validPoint(Number(coordinate[1]), Number(coordinate[0]), Number(coordinate[2]));
    }).filter((point): point is GeoPoint => Boolean(point));
  }
  if (data.type === "MultiPolygon" && Array.isArray(data.coordinates)) {
    const polygon = data.coordinates[0];
    const ring = Array.isArray(polygon) ? polygon[0] : null;
    if (Array.isArray(ring)) return ring.map((coordinate) => {
      if (!Array.isArray(coordinate)) return null;
      return validPoint(Number(coordinate[1]), Number(coordinate[0]), Number(coordinate[2]));
    }).filter((point): point is GeoPoint => Boolean(point));
  }
  return [];
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
    const coordinateBlock = text.match(/<coordinates[^>]*>([\s\S]*?)<\/coordinates>/i)?.[1] ?? "";
    return dedupeClosingPoint(coordinateBlock.trim().split(/\s+/).map((entry) => {
      const [lng, lat, alt] = entry.split(",").map(Number);
      return validPoint(lat, lng, alt);
    }).filter((point): point is GeoPoint => Boolean(point)));
  }
  if (lowerName.endsWith(".csv") || lowerName.endsWith(".txt")) {
    const lines = text.trim().split(/\r?\n/);
    const header = (lines[0] ?? "").toLocaleLowerCase("tr-TR");
    const longitudeFirst = /(^|[;,\t ])(lng|lon|longitude|boylam|x)([;,\t ]|$)/.test(header);
    return dedupeClosingPoint(lines.map((line) => (line.includes(";") ? line.split(";").map((value) => value.trim().replace(",", ".")) : line.split(/[,\t ]+/)).map((value) => Number(value.trim())).filter(Number.isFinite)).filter((values) => values.length >= 2).map((values) => {
      const first = values[0];
      const second = values[1];
      const lngFirst = longitudeFirst || (Math.abs(first) > 90 && Math.abs(second) <= 90);
      return validPoint(lngFirst ? second : first, lngFirst ? first : second, values[2]);
    }).filter((point): point is GeoPoint => Boolean(point)));
  }
  return [];
}

function downloadBlob(name: string, content: string | Uint8Array, type: string) {
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

export function GeoParcelStudio({ simple = false }: { simple?: boolean } = {}) {
  const mapHostRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const leafletRef = useRef<LeafletModule | null>(null);
  const basemapTileRef = useRef<import("leaflet").TileLayer | null>(null);
  const basemapLabelsRef = useRef<import("leaflet").TileLayer | null>(null);
  const parcelLayerRef = useRef<LeafletPolygon | null>(null);
  const buildingLayerRef = useRef<LeafletPolygon | null>(null);
  const pointsLayerRef = useRef<LayerGroup | null>(null);
  const contourLayerRef = useRef<LayerGroup | null>(null);
  const drawingRef = useRef(!simple);
  const transferApplied = useRef(false);
  const persistedGeoRef = useRef(false);
  const pendingFitRef = useRef<GeoPoint[] | null>(null);
  const { patchModule, project, hydrated } = useProjectKernel();
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState("");
  const [basemapStatus, setBasemapStatus] = useState<"none" | "loading" | "ready" | "error">("none");
  const [basemapMode, setBasemapMode] = useState<BasemapMode>("satellite");
  const [basemapWarning, setBasemapWarning] = useState("");
  const [activeStage, setActiveStage] = useState<Stage>("locate");
  const [showSources, setShowSources] = useState(false);
  const [showLayers, setShowLayers] = useState(false);
  const [showResults, setShowResults] = useState(false);
  // The streamlined parcel page opens with only the actual map and boundary.
  // Conceal conceptual overlays visually without deleting their saved inputs.
  const [showConceptualOverlays, setShowConceptualOverlays] = useState(!simple);
  const [viewMode, setViewMode] = useState<ViewMode>("map");
  const [parcel, setParcel] = useState<GeoPoint[]>(() => sampleParcel(defaultCenter));
  const [parcelSource, setParcelSource] = useState<ParcelSourceState>({
    kind: "sample",
    authority: "ARKEMX",
    label: "Temsili başlangıç geometrisi",
    capturedAt: new Date(0).toISOString(),
    url: "",
  });
  const [drawEnabled, setDrawEnabled] = useState(!simple);
  const [latitude, setLatitude] = useState(defaultCenter.lat.toFixed(7));
  const [longitude, setLongitude] = useState(defaultCenter.lng.toFixed(7));
  const [province, setProvince] = useState("Sakarya");
  const [district, setDistrict] = useState("");
  const [neighborhood, setNeighborhood] = useState("");
  const [provinceId, setProvinceId] = useState("");
  const [districtId, setDistrictId] = useState("");
  const [neighborhoodId, setNeighborhoodId] = useState("");
  const [provinceOptions, setProvinceOptions] = useState<AdministrativeOption[]>(FALLBACK_PROVINCES);
  const [districtOptions, setDistrictOptions] = useState<AdministrativeOption[]>([]);
  const [neighborhoodOptions, setNeighborhoodOptions] = useState<AdministrativeOption[]>([]);
  const [administrativeLoading, setAdministrativeLoading] = useState<"province" | "district" | "neighborhood" | "idle">("province");
  const [administrativeSource, setAdministrativeSource] = useState<"official" | "fallback">("fallback");
  const [block, setBlock] = useState("");
  const [parcelNo, setParcelNo] = useState("");
  const [fileNotice, setFileNotice] = useState("Örnek parsel verisi yüklendi");
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
  const [terrainLayers, setTerrainLayers] = useState<TerrainLayerVisibility>(() => ({ ...DEFAULT_TERRAIN_LAYERS, basemap: true }));
  const [requiredSetback, setRequiredSetback] = useState(5);
  const [maxCoverage, setMaxCoverage] = useState(40);
  const [maxFar, setMaxFar] = useState(1.2);
  const [maxHeight, setMaxHeight] = useState(15.5);
  const [floorHeight, setFloorHeight] = useState(4.5);
  const [parkingPer100, setParkingPer100] = useState(1);
  const [sourceCrs, setSourceCrs] = useState("EPSG:4326 / WGS84");
  const [dataStatus, setDataStatus] = useState("Kavramsal / doğrulanmamış");
  const [parcelLookup, setParcelLookup] = useState<"idle" | "loading" | "found" | "error">("idle");
  const [zoning, setZoning] = useState<ZoningForm>(DEFAULT_ZONING);
  const [frontEdge, setFrontEdge] = useState<ParcelFrontEdge>("north");
  const [selectedMassingId, setSelectedMassingId] = useState("manual");
  const parcelRecord = useMemo<ParcelRecord>(() => createParcelRecord({
    identity: { province, district, neighborhood, block, parcelNo },
    geometry: parcel,
    source: parcelSource,
  }), [block, district, neighborhood, parcel, parcelNo, parcelSource, province]);

  useEffect(() => {
    if (!hydrated || transferApplied.current) return;
    transferApplied.current = true;
    const timer = window.setTimeout(() => {
    const saved = project.modules["geo-parcel"] as {
      parcel?: GeoPoint[];
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
      terrain?: Record<string, unknown>;
      frontEdge?: ParcelFrontEdge;
      selectedMassingId?: string;
      parcelRecord?: ParcelRecord;
      _kernel?: { recordedAt?: string };
    } | undefined;
    persistedGeoRef.current = Boolean(saved);
    if (!saved) return;
    if (saved.parcelRecord?.schema === "ARKEM-PARCEL-RECORD/1.0") {
      setParcelSource({
        kind: saved.parcelRecord.evidence.sourceKind,
        authority: saved.parcelRecord.evidence.authority,
        label: saved.parcelRecord.evidence.label,
        capturedAt: saved.parcelRecord.evidence.capturedAt,
        url: saved.parcelRecord.evidence.url ?? "",
        reportedArea: saved.parcelRecord.geometry.reportedArea ?? undefined,
      });
    } else if (saved.parcel?.length) {
      const savedStatus = saved.dataStatus ?? "";
      const kind: ParcelSourceKind = savedStatus.includes("TKGM")
        ? "tkgm-open-service"
        : savedStatus.includes("ölçüm") || savedStatus.includes("aplikasyon")
          ? "user-file"
          : "manual-drawing";
      setParcelSource({
        kind,
        authority: kind === "tkgm-open-service" ? "Tapu ve Kadastro Genel Müdürlüğü" : "Önceki ARKEMX proje kaydı",
        label: savedStatus || "Önceki proje geometrisi",
        capturedAt: saved._kernel?.recordedAt ?? new Date(0).toISOString(),
        url: kind === "tkgm-open-service" ? "https://parselsorgu.tkgm.gov.tr/" : "",
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
    if (saved.parcel?.length) {
      setParcel(saved.parcel);
      const savedCenter = geoCentroid(saved.parcel);
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
    if (typeof saved.planning?.requiredSetback === "number") setRequiredSetback(saved.planning.requiredSetback);
    if (typeof saved.planning?.maxCoverage === "number") setMaxCoverage(saved.planning.maxCoverage);
    if (typeof saved.planning?.maxFar === "number") setMaxFar(saved.planning.maxFar);
    if (typeof saved.planning?.maxHeight === "number") setMaxHeight(saved.planning.maxHeight);
    if (typeof saved.planning?.parkingPer100 === "number") setParkingPer100(saved.planning.parkingPer100);
    if (saved.zoning) {
      setZoning((current) => ({ ...current, ...saved.zoning, verification: normalizeUntrustedZoningVerification(saved.zoning?.verification, Boolean(saved.zoning?.sourceDocument)) }));
      if (typeof saved.zoning.taks === "number") setMaxCoverage(saved.zoning.taks * 100);
      if (typeof saved.zoning.kaks === "number") setMaxFar(saved.zoning.kaks);
      if (typeof saved.zoning.hmax === "number") setMaxHeight(saved.zoning.hmax);
      const setbacks = [saved.zoning.frontSetback, saved.zoning.sideSetback, saved.zoning.rearSetback].filter((value): value is number => typeof value === "number");
      if (setbacks.length) setRequiredSetback(Math.max(...setbacks));
    }
    if (typeof saved.terrain?.slope === "number") setSlope(saved.terrain.slope);
    if (typeof saved.terrain?.exaggeration === "number") setExaggeration(saved.terrain.exaggeration);
    if (saved.terrain?.layers) setTerrainLayers({ ...normalizeTerrainLayers(saved.terrain.layers), basemap: true });
    if (saved.frontEdge && ["north", "east", "south", "west"].includes(saved.frontEdge)) setFrontEdge(saved.frontEdge);
    if (saved.selectedMassingId) setSelectedMassingId(saved.selectedMassingId);
    setFileNotice("Kayıtlı parsel, yapı yerleşimi ve planlama verileri otomatik açıldı");
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
    const match = neighborhoodOptions.find((option) => normalizeAdministrativeName(option.label) === normalizeAdministrativeName(neighborhood));
    if (!match) return;
    const timer = window.setTimeout(() => setNeighborhoodId(match.id), 0);
    return () => window.clearTimeout(timer);
  }, [neighborhood, neighborhoodId, neighborhoodOptions]);

  useEffect(() => {
    drawingRef.current = drawEnabled;
  }, [drawEnabled]);

  useEffect(() => {
    let cancelled = false;
    fetchTkgmJson("idariYapi/ilListe").then((data) => {
      if (cancelled) return;
      const options = administrativeOptions(data);
      if (!options.length) throw new Error("TKGM il listesi boş döndü");
      setProvinceOptions(options);
      const preferred = options.find((option) => normalizeAdministrativeName(option.label) === normalizeAdministrativeName("Sakarya"));
      if (preferred) setProvinceId(preferred.id);
      setAdministrativeSource("official");
      setAdministrativeLoading("idle");
    }).catch((error: unknown) => {
      if (cancelled) return;
      setProvinceOptions(FALLBACK_PROVINCES);
      const preferred = FALLBACK_PROVINCES.find((option) => option.label === "Sakarya");
      if (preferred) setProvinceId(preferred.id);
      setAdministrativeSource("fallback");
      setAdministrativeLoading("idle");
      setFileNotice(`${error instanceof Error ? error.message : "TKGM il listesi yüklenemedi"}. Yerel il/ilçe seçimi mümkün; mahalle adı elle girilir. Resmî parsel verisi yalnızca erişilebilir TKGM yanıtı veya kullanıcı dosyasıyla gösterilir.`);
    });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!provinceId) return;
    const provinceName = provinceOptions.find((option) => option.id === provinceId)?.label ?? province;
    if (administrativeSource === "fallback") {
      const timer = window.setTimeout(() => {
        setDistrictOptions(fallbackDistrictOptions(provinceName));
        setAdministrativeLoading("idle");
      }, 0);
      return () => window.clearTimeout(timer);
    }
    let cancelled = false;
    fetchTkgmJson(`idariYapi/ilceListe/${encodeURIComponent(provinceId)}`).then((data) => {
      if (cancelled) return;
      const options = administrativeOptions(data);
      if (!options.length) throw new Error("TKGM ilçe listesi boş döndü");
      setDistrictOptions(options);
      setAdministrativeLoading("idle");
    }).catch(() => {
      if (!cancelled) {
        setAdministrativeSource("fallback");
        setDistrictOptions(fallbackDistrictOptions(provinceName));
        setAdministrativeLoading("idle");
        setFileNotice("İlçe listesi için çevrimdışı seçim modu açıldı; resmî parsel geometrisi TKGM servisiyle doğrulanmalıdır.");
      }
    });
    return () => { cancelled = true; };
  }, [administrativeSource, province, provinceId, provinceOptions]);

  useEffect(() => {
    if (!districtId) return;
    if (administrativeSource === "fallback" || districtId.startsWith("offline-")) {
      const timer = window.setTimeout(() => {
        setNeighborhoodOptions([]);
        setAdministrativeLoading("idle");
      }, 0);
      return () => window.clearTimeout(timer);
    }
    let cancelled = false;
    fetchTkgmJson(`idariYapi/mahalleListe/${encodeURIComponent(districtId)}`).then((data) => {
      if (cancelled) return;
      const options = administrativeOptions(data);
      if (!options.length) throw new Error("TKGM mahalle/köy listesi boş döndü");
      setNeighborhoodOptions(options);
      setAdministrativeLoading("idle");
    }).catch(() => {
      if (!cancelled) {
        setAdministrativeSource("fallback");
        setNeighborhoodOptions([]);
        setAdministrativeLoading("idle");
        setFileNotice("Mahalle/köy listesi için çevrimdışı seçim modu açıldı; proje notu ve resmî sorgu birlikte kullanılmalıdır.");
      }
    });
    return () => { cancelled = true; };
  }, [administrativeSource, districtId]);
  // Older local drafts may contain the previous fake offline-neighborhood label.
  // Discard it instead of treating it as an actual mahalle or parcel lookup ID.
  useEffect(() => {
    if (administrativeSource !== "fallback") return;
    if (neighborhood.includes("mahalle-köy bilgisini proje notunda belirtin")) {
      setNeighborhood("");
      setNeighborhoodId("");
    }
  }, [administrativeSource, neighborhood]);

  const center = useMemo(() => geoCentroid(parcel.length ? parcel : [defaultCenter]), [parcel]);
  const building = useMemo(() => buildingFootprint(center, buildingWidth, buildingDepth, rotation, offsetEast, offsetNorth), [center, buildingWidth, buildingDepth, rotation, offsetEast, offsetNorth]);
  const metrics = useMemo(() => {
    const area = polygonArea(parcel);
    const perimeter = polygonPerimeter(parcel);
    const bounds = localBounds(parcel);
    const footprint = buildingWidth * buildingDepth;
    const gross = footprint * floors;
    const altitudes = parcel.map((point) => point.alt).filter((value): value is number => Number.isFinite(value));
    const buildingFits = building.every((corner) => pointInPolygon(corner, parcel));
    const boundaryDistance = minimumBoundaryDistance(parcel, building);
    const coverage = area ? (footprint / area) * 100 : 0;
    const far = area ? gross / area : 0;
    const buildingHeight = floors * floorHeight;
    const allowedFootprint = area * maxCoverage / 100;
    const allowedGross = area * maxFar;
    const parkingNeed = Math.ceil(gross / 100 * parkingPer100);
    const rainwaterReview = area > 2_000 || footprint > 1_000;
    const geometryValid = parcel.length >= 3 && !polygonSelfIntersects(parcel) && area > 1;
    const setbackPass = buildingFits && boundaryDistance >= requiredSetback;
    return { area, perimeter, width: bounds.width, depth: bounds.depth, footprint, gross, coverage, far, buildingHeight, allowedFootprint, allowedGross, parkingNeed, rainwaterReview, geometryValid, buildingFits, setbackPass, boundaryDistance, minAlt: altitudes.length ? Math.min(...altitudes) : null, maxAlt: altitudes.length ? Math.max(...altitudes) : null };
  }, [parcel, building, buildingWidth, buildingDepth, floors, floorHeight, maxCoverage, maxFar, parkingPer100, requiredSetback]);
  const reference = `${province || "IL"}-${district || "ILCE"}-${block || "ADA"}-${parcelNo || "PARSEL"}`.replace(/\s+/g, "-").toLocaleUpperCase("tr-TR");
  const sourceNetwork = useMemo(
    () => resolveParcelSourceNetwork(province, district),
    [district, province],
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
  const massingModel = useMemo(() => createZoningMassingModel({
    reference,
    parcel,
    zoning,
    frontEdge,
    floorHeight,
  }), [floorHeight, frontEdge, parcel, reference, zoning]);
  const activeMassingId = useMemo(() => {
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
  const exportDisabled = !parcelRecord.projectEligible || !metrics.geometryValid;
  const toggleTerrainLayer = (layer: TerrainLayerId) => { if (layer === "basemap") return; setTerrainLayers((current) => ({ ...current, [layer]: !current[layer] })); };
  const applyMassingAlternative = (alternativeId: string) => {
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

  useEffect(() => {
    if (!hydrated) return;
    if (!parcelRecord.projectEligible && !persistedGeoRef.current) return;
    if (parcelRecord.projectEligible) persistedGeoRef.current = true;
    const projectMetrics = parcelRecord.projectEligible
      ? metrics
      : { ...metrics, area: 0, geometryValid: false };
    patchModule("geo-parcel", {
      reference: parcelRecord.reference,
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
      parcel: parcelRecord.projectEligible ? parcel : [],
      previewParcel: parcelRecord.projectEligible ? [] : parcel,
      center,
      building,
      buildingWidth,
      buildingDepth,
      rotation,
      offsetEast,
      offsetNorth,
      usage,
      system,
      floors,
      floorHeight,
      planning: { requiredSetback, maxCoverage, maxFar, maxHeight, parkingPer100 },
      zoning,
      terrain: { slope, exaggeration, layers: terrainLayers, contourSegments: terrainContours.length },
      terrainModel,
      frontEdge,
      selectedMassingId: activeMassingId,
      massingModel,
      metrics: projectMetrics,
      previewMetrics: parcelRecord.projectEligible ? null : metrics,
      parcelRecord,
      parcelSourceNetwork: sourceNetwork,
      provenance: createGeoProvenance({ reference: parcelRecord.reference, sourceCrs, dataStatus, administrativeSource, geometryValid: parcelRecord.projectEligible && metrics.geometryValid, vertexCount: parcelRecord.projectEligible ? parcel.length : 0 }),
      zoningProvenance: createZoningProvenance(zoning, parcelRecord.reference),
      status: parcelRecord.projectEligible ? "Parsel kaynağı ve sınırı aktif projeye bağlı" : "Temsili geometri · aktif proje verisi değildir",
    });
  }, [activeMassingId, administrativeSource, block, building, buildingDepth, buildingWidth, center, dataStatus, district, districtId, exaggeration, floorHeight, floors, frontEdge, hydrated, massingModel, maxCoverage, maxFar, maxHeight, metrics, neighborhood, neighborhoodId, offsetEast, offsetNorth, parcel, parcelNo, parcelRecord, parkingPer100, patchModule, province, provinceId, requiredSetback, rotation, slope, sourceCrs, sourceNetwork, system, terrainContours.length, terrainLayers, terrainModel, usage, zoning]);

  useEffect(() => {
    let disposed = false;
    import("leaflet").then((leaflet) => {
      if (disposed || !mapHostRef.current || mapRef.current) return;
      leafletRef.current = leaflet;
      const map = leaflet.map(mapHostRef.current, { zoomControl: false, attributionControl: true, preferCanvas: false }).setView([defaultCenter.lat, defaultCenter.lng], 17);
      // No automatic calls to third-party map tiles: the demo shows a local coordinate preview.
      // Streets and satellite imagery require a separately configured, authorized tile provider.
      leaflet.control.zoom({ position: "bottomright" }).addTo(map);
      pointsLayerRef.current = leaflet.layerGroup().addTo(map);
      contourLayerRef.current = leaflet.layerGroup().addTo(map);
      map.on("click", (event) => {
        if (!drawingRef.current) return;
        setParcel((points) => [...points, { lat: event.latlng.lat, lng: event.latlng.lng }].slice(-40));
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
      basemapTileRef.current = null;
      basemapLabelsRef.current = null;
      mapRef.current?.remove();
      mapRef.current = null;
      leafletRef.current = null;
      contourLayerRef.current = null;
    };
  }, []);

  // Keep tile layers mounted while switching modes. Removing/recreating a
  // Leaflet TileLayer during animated zoom can leave a pending _resetGrid callback
  // referring to a detached layer (null options).
  useEffect(() => {
    const map = mapRef.current;
    const leaflet = leafletRef.current;
    if (!mapReady || !map || !leaflet) return;
    const imagery = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";
    const streets = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
    const labels = "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}";
    if (!map.getPane("arkemx-basemap-labels")) {
      const pane = map.createPane("arkemx-basemap-labels");
      pane.style.zIndex = "350";
      pane.style.pointerEvents = "none";
    }
    if (!basemapTileRef.current) {
      const tile = leaflet.tileLayer(imagery, {
        maxNativeZoom: 19, maxZoom: 20,
        attribution: "Tiles &copy; Esri and its imagery providers",
      });
      tile.on("tileerror", () => {
        if (!mapRef.current) return;
        setBasemapStatus("error");
        setBasemapWarning("Harita karoları yüklenemedi. İnternet veya harita servisi erişimini kontrol edin.");
      });
      tile.on("load", () => {
        if (!mapRef.current) return;
        setBasemapStatus("ready");
        setBasemapWarning("");
      });
      basemapTileRef.current = tile;
      tile.addTo(map).bringToBack();
    }
    if (!basemapLabelsRef.current) {
      const labelLayer = leaflet.tileLayer(labels, {
        maxNativeZoom: 19, maxZoom: 20, pane: "arkemx-basemap-labels",
        attribution: "Labels &copy; Esri",
        opacity: 0,
      });
      basemapLabelsRef.current = labelLayer;
      labelLayer.addTo(map);
    }
    const base = basemapTileRef.current;
    const labelLayer = basemapLabelsRef.current;
    const targetUrl = basemapMode === "street" ? streets : imagery;
    const credit = basemapMode === "street"
      ? "&copy; OpenStreetMap contributors"
      : "Tiles &copy; Esri and its imagery providers";
    if (base.getTileUrl({x:0,y:0,z:0}).split("?")[0] !== targetUrl.replace("{s}", "a").replace("{z}", "0").replace("{y}", "0").replace("{x}", "0")) {
      setBasemapStatus("loading");
      base.setUrl(targetUrl);
    }
    base.options.attribution = credit;
    // The labels layer remains attached, preventing zoom-animation race conditions.
    base.setOpacity(terrainLayers.basemap ? 1 : 0);
    labelLayer.setOpacity(terrainLayers.basemap && basemapMode === "hybrid" ? 1 : 0);
  }, [basemapMode, mapReady, terrainLayers.basemap]);

  useEffect(() => {
    const leaflet = leafletRef.current;
    const map = mapRef.current;
    if (!leaflet || !map || !mapReady) return;
    parcelLayerRef.current?.remove();
    buildingLayerRef.current?.remove();
    pointsLayerRef.current?.clearLayers();
    contourLayerRef.current?.clearLayers();
    if (terrainLayers["parcel-boundary"] && parcel.length >= 2) {
      parcelLayerRef.current = leaflet.polygon(parcel.map((point) => [point.lat, point.lng]), { color: "#b96636", weight: 3, fillColor: "#d98a5d", fillOpacity: .16, dashArray: parcel.length < 3 ? "6 6" : undefined }).addTo(map);
    }
    if (showConceptualOverlays && (terrainLayers["parcel-boundary"] || terrainLayers["elevation-points"])) parcel.forEach((point, index) => {
      const hasElevation = Number.isFinite(point.alt);
      if (!terrainLayers["parcel-boundary"] && !(terrainLayers["elevation-points"] && hasElevation)) return;
      leaflet.circleMarker([point.lat, point.lng], { radius: hasElevation && terrainLayers["elevation-points"] ? 6 : 5, color: "#ffffff", weight: 2, fillColor: hasElevation && terrainLayers["elevation-points"] ? "#c66e3d" : "#0a2639", fillOpacity: 1 })
        .bindTooltip(`P${index + 1}<br>${point.lat.toFixed(6)}, ${point.lng.toFixed(6)}${hasElevation && terrainLayers["elevation-points"] ? `<br>Z ${point.alt?.toFixed(2)} m` : ""}`)
        .addTo(pointsLayerRef.current!);
    });
    if (showConceptualOverlays && terrainLayers.contours) terrainContours.forEach((segment) => {
      const start = fromLocalMeters(segment.start.east, segment.start.north, center);
      const end = fromLocalMeters(segment.end.east, segment.end.north, center);
      leaflet.polyline([[start.lat, start.lng], [end.lat, end.lng]], { color: "#557f75", weight: 1.1, opacity: .68 })
        .bindTooltip(`Eş yükselti ${segment.elevation.toFixed(2)} m`)
        .addTo(contourLayerRef.current!);
    });
    if (showConceptualOverlays && terrainLayers["building-mass"] && parcel.length >= 3) buildingLayerRef.current = leaflet.polygon(building.map((point) => [point.lat, point.lng]), { color: "#ffffff", weight: 2, fillColor: "#0a2639", fillOpacity: .64 }).bindTooltip(`${usage}<br>${system}<br>${buildingWidth} × ${buildingDepth} m · ${floors} kat`).addTo(map);
  }, [parcel, building, center, mapReady, usage, system, buildingWidth, buildingDepth, floors, terrainContours, terrainLayers, showConceptualOverlays]);

  // When an existing, sourced parcel is opened from local storage, fit the map
  // after Leaflet is ready. The initial demo geometry is never mistaken for a lookup result.
  useEffect(() => {
    if (!mapReady || parcel.length < 3 || parcelSource.kind === "sample") return;
    const timer = window.setTimeout(() => {
      const map = mapRef.current;
      const leaflet = leafletRef.current;
      if (!map || !leaflet) return;
      map.invalidateSize();
      map.fitBounds(leaflet.latLngBounds(parcel.map((point) => [point.lat, point.lng])), {
        padding: [48, 48],
        maxZoom: 19,
      });
    }, 180);
    return () => window.clearTimeout(timer);
  }, [mapReady, parcel, parcelSource.kind]);

  useEffect(() => {
    if (viewMode === "map") window.setTimeout(() => mapRef.current?.invalidateSize(), 20);
  }, [viewMode]);

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
      map.fitBounds(leaflet.latLngBounds(points.map((point) => [point.lat, point.lng])), { padding: [36, 36], maxZoom: 19 });
    };
    if (delay > 0) window.setTimeout(run, delay);
    else run();
  };
  const fitToParcel = () => fitMapToPoints(parcel);

  useEffect(() => {
    if (!mapReady || !pendingFitRef.current?.length) return;
    const pending = pendingFitRef.current;
    window.setTimeout(() => fitMapToPoints(pending), 40);
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
    setParcel((points) => points.slice(0, -1));
    markBoundaryAsManual("Haritada düzenlenen sınır");
    setFileNotice("Son sınır noktası kaldırıldı; geometri kullanıcı düzenlemesi olarak işaretlendi");
  };
  const clearBoundary = () => {
    setParcel([]);
    markBoundaryAsManual("Temizlenmiş sınır");
    setFileNotice("Parsel sınırı temizlendi; aktif proje geometrisi doğrulama bekliyor");
  };
  const loadSample = () => {
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
  const retryOfficialLists = async () => {
    setAdministrativeLoading("province");
    setFileNotice("TKGM il ve mahalle servislerine yeniden bağlanılıyor…");
    try {
      const data = await fetchTkgmJson("idariYapi/ilListe");
      const options = administrativeOptions(data);
      if (!options.length) throw new Error("TKGM geçerli il listesi döndürmedi");
      const currentProvince = options.find((option) =>
        normalizeAdministrativeName(option.label) === normalizeAdministrativeName(province),
      );
      setDistrictId("");
      setDistrict("");
      setDistrictOptions([]);
      setNeighborhoodId("");
      setNeighborhood("");
      setNeighborhoodOptions([]);
      setProvinceOptions(options);
      setAdministrativeSource("official");
      setProvinceId(currentProvince?.id ?? "");
      setAdministrativeLoading(currentProvince ? "district" : "idle");
      setParcelLookup("idle");
      setFileNotice(currentProvince
        ? "TKGM il listesi bağlandı. İlçe ve mahalle listelerini bekleyin; sonra seçimleri tamamlayın."
        : "TKGM il listesi bağlandı. Önce ilinizi seçin.");
    } catch (error) {
      setAdministrativeSource("fallback");
      setAdministrativeLoading("idle");
      setParcelLookup("error");
      setFileNotice(error instanceof Error ? error.message : "TKGM bağlantısı kurulamadı");
    }
  };
  const locateOfficialParcel = async () => {
    if (!provinceId || !districtId || !neighborhoodId || !block.trim() || !parcelNo.trim()) {
      setParcelLookup("error");
      setFileNotice("Sırayla il, ilçe ve mahalle/köy seçin; ardından ada ve parsel numarasını girin");
      return;
    }
    if (administrativeSource === "fallback" || districtId.startsWith("offline-") || neighborhoodId.startsWith("offline-")) {
      setParcelLookup("error");
      setFileNotice("Çevrimdışı idari seçim yapıldı. TKGM servisi erişilebilir olduğunda resmî geometri sorgulanabilir; şimdi koordinat, KML veya GeoJSON ile devam edin.");
      return;
    }
    setParcelLookup("loading");
    setFileNotice("TKGM idari kayıtları ve parsel geometrisi sorgulanıyor…");
    try {
      const response = await fetchTkgmJson(`parsel/${encodeURIComponent(neighborhoodId)}/${encodeURIComponent(block.trim())}/${encodeURIComponent(parcelNo.trim())}`);
      const feature = parcelFeature(response);
      const points = dedupeClosingPoint(extractGeoJsonPoints(response));
      if (points.length < 3) throw new Error("Parsel kaydı bulundu ancak geçerli sınır geometrisi alınamadı");
      const properties = feature.properties ?? {};
      const parcelCenter = geoCentroid(points);
      const nextParcel = points.slice(0, 400);
      setParcel(nextParcel);
      setTerrainLayers((current) => ({ ...current, "parcel-boundary": true }));
      setLatitude(parcelCenter.lat.toFixed(7));
      setLongitude(parcelCenter.lng.toFixed(7));
      setProvince(String(properties.ilAd ?? province));
      setDistrict(String(properties.ilceAd ?? district));
      setNeighborhood(String(properties.mahalleAd ?? neighborhood));
      const reportedArea = parseReportedArea(properties.alan);
      setParcelSource({
        kind: "tkgm-open-service",
        authority: "Tapu ve Kadastro Genel Müdürlüğü",
        label: "TKGM MEGSİS açık servis yanıtı",
        capturedAt: new Date().toISOString(),
        url: "https://parselsorgu.tkgm.gov.tr/",
        reportedArea,
      });
      setDataStatus("TKGM MEGSİS açık servis geometrisi · tapu/aplikasyon belgesi değildir");
      setParcelLookup("found");
      setFileNotice(`TKGM kaydı bulundu · ${String(properties.ozet ?? `${block}/${parcelNo}`)} · ${String(properties.alan ?? "alan bilgisi yok")} m²`);
      setActiveStage("draw");
      setViewMode("map");
      setDrawEnabled(false);
      fitMapToPoints(nextParcel, 120);
    } catch (error) {
      setParcelLookup("error");
      setFileNotice(`${error instanceof Error ? error.message : "Parsel bulunamadı"}. Resmî ekranda doğrulayın veya KML/GeoJSON yükleyin.`);
    }
  };
  const handleFile = async (file?: File) => {
    if (!file) return;
    try {
      const points = parseSpatialFile(file.name, await file.text());
      if (points.length < 3) throw new Error("Bu dosyada WGS84 Polygon için en az üç geçerli nokta bulunamadı.");
      const nextParcel = points.slice(0, 200);
      setParcel(nextParcel);
      setTerrainLayers((current) => ({ ...current, "parcel-boundary": true }));
      setLatitude(geoCentroid(points).lat.toFixed(7));
      setLongitude(geoCentroid(points).lng.toFixed(7));
      setParcelSource({
        kind: "user-file",
        authority: "Kullanıcı tarafından sağlanan mekânsal dosya",
        label: file.name,
        capturedAt: new Date().toISOString(),
        url: "",
      });
      setDataStatus(`${file.name} · kullanıcı dosyası · CRS ve ölçüm statüsü doğrulanmalı`);
      setFileNotice(`${file.name}: ${Math.min(points.length, 200)} sınır noktası içe alındı`);
      setActiveStage("draw");
      setViewMode("map");
      fitMapToPoints(nextParcel, 80);
    } catch (error) {
      setFileNotice(error instanceof Error ? error.message : "Mekânsal dosya okunamadı");
    }
  };

  const updateZoning = <K extends keyof ZoningForm>(key: K, value: ZoningForm[K]) => {
    setZoning((current) => key === "verification"
      ? { ...current, verification: normalizeUntrustedZoningVerification(value, Boolean(current.sourceDocument)) }
      : { ...current, [key]: value });
    if (key === "taks") setMaxCoverage(Number(value) * 100);
    if (key === "kaks") setMaxFar(Number(value));
    if (key === "hmax") setMaxHeight(Number(value));
  };

  const updateSetback = (key: "frontSetback" | "sideSetback" | "rearSetback", value: number) => {
    const next = { ...zoning, [key]: value };
    setZoning(next);
    setRequiredSetback(Math.max(next.frontSetback, next.sideSetback, next.rearSetback));
  };

  const handleZoningDocument = (file?: File) => {
    if (!file) return;
    // A browser upload proves only that a file was selected. It cannot establish
    // authenticity, current plan status or correspondence to this parcel.
    setZoning((current) => ({
      ...current,
      sourceDocument: file.name,
      verification: "document-pending-review",
    }));
    setFileNotice(`${file.name}: belge adı proje kaydına eklendi; içeriği veya resmî geçerliliği doğrulanmadı. Yetkili idare ve uzman incelemesi bekleniyor.`);
  };

  const exportGeoJson = () => downloadBlob(`${reference}.geojson`, JSON.stringify({ type: "FeatureCollection", name: reference, metadata: { schema: "ARKEM-GEO/1.3", sourceCrs, dataStatus, generatedAt: new Date().toISOString(), parcelRecord, terrainModel, massingModel, planning: { requiredSetback, maxCoverage, maxFar, maxHeight, parkingPer100 }, zoning: createZoningProvenance(zoning, reference) }, features: [{ type: "Feature", properties: { reference, source: "Arkem Parcel Studio", crs: "EPSG:4326", validation: metrics.geometryValid ? "geometry-pass" : "review" }, geometry: { type: "Polygon", coordinates: [[...parcel, parcel[0]].map((point) => [point.lng, point.lat, point.alt].filter((value) => value !== undefined))] } }, { type: "Feature", properties: { reference: `${reference}-ON-YAPI`, system, usage, floors, floorHeight, selectedMassingId: activeMassingId, coverage: metrics.coverage, far: metrics.far }, geometry: { type: "Polygon", coordinates: [[...building, building[0]].map((point) => [point.lng, point.lat])] } }] }, null, 2), "application/geo+json");
  const exportKml = () => downloadBlob(`${reference}.kml`, `<?xml version="1.0" encoding="UTF-8"?><kml xmlns="http://www.opengis.net/kml/2.2"><Document><name>${reference}</name><Placemark><name>Parsel</name><Style><LineStyle><color>ff3666b9</color><width>3</width></LineStyle><PolyStyle><color>443666b9</color></PolyStyle></Style><Polygon><outerBoundaryIs><LinearRing><coordinates>${[...parcel, parcel[0]].map((point) => `${point.lng},${point.lat},${point.alt ?? 0}`).join(" ")}</coordinates></LinearRing></outerBoundaryIs></Polygon></Placemark><Placemark><name>On Yapi Kutlesi</name><Polygon><outerBoundaryIs><LinearRing><coordinates>${[...building, building[0]].map((point) => `${point.lng},${point.lat},0`).join(" ")}</coordinates></LinearRing></outerBoundaryIs></Polygon></Placemark></Document></kml>`, "application/vnd.google-earth.kml+xml");
  const exportCsv = () => downloadBlob(`${reference}-koordinatlar.csv`, `point,latitude,longitude,elevation_m\n${parcel.map((point, index) => `P${index + 1},${point.lat.toFixed(8)},${point.lng.toFixed(8)},${point.alt ?? ""}`).join("\n")}`, "text/csv;charset=utf-8");
  const exportDxf = () => {
    const origin = geoCentroid(parcel);
    const parcelLocal = parcel.map((point, index) => { const local = toLocalMeters(point, origin); return { x: local.east, y: local.north, label: `P${index + 1}` }; });
    const buildingLocal = building.map((point) => { const local = toLocalMeters(point, origin); return { x: local.east, y: local.north }; });
    const contourLocal = terrainContours.map((segment) => [{ x: segment.start.east, y: segment.start.north }, { x: segment.end.east, y: segment.end.north }]);
    const all = [...parcelLocal, ...buildingLocal, ...contourLocal.flat()];
    const minX = Math.min(...all.map((point) => point.x));
    const minY = Math.min(...all.map((point) => point.y));
    const shift = <T extends { x: number; y: number },>(points: T[]) => points.map((point) => ({ ...point, x: point.x - minX, y: point.y - minY }));
    const shiftedParcel = shift(parcelLocal);
    const shiftedBuilding = shift(buildingLocal);
    const shiftedContours = contourLocal.map((segment) => shift(segment));
    const width = Math.max(...all.map((point) => point.x)) - minX;
    const depth = Math.max(...all.map((point) => point.y)) - minY;
    const dxf = createLayeredDxf({
      title: `ARKEM PARSEL VE ON YAPI / ${reference}`,
      width: Math.max(width, 1),
      depth: Math.max(depth, 1),
      polylines: [{ layer: "PARSEL", points: shiftedParcel }, { layer: "ON_YAPI", points: shiftedBuilding }, ...shiftedContours.map((points) => ({ layer: "ESYUKSELTI", points, closed: false }))],
      notes: [
        `WGS84 ORIGIN: ${origin.lat.toFixed(8)}, ${origin.lng.toFixed(8)}`,
        `PARSEL ALANI: ${metrics.area.toFixed(1)} m2 / CEVRE: ${metrics.perimeter.toFixed(1)} m`,
        `ON YAPI: ${buildingWidth} x ${buildingDepth} m / ${floors} KAT / ${system}`,
        `ARAZI: ${terrainModel.basis === "measured-z" ? "KAYNAKLI Z / IDW" : `PARAMETRIK %${slope}`} / ${terrainContours.length} ESYUKSELTI PARCASI`,
        `IMAR: ${ascii(zoning.landUse)} / ${ascii(zoning.buildingOrder)} / TAKS ${zoning.taks.toFixed(2)} / KAKS ${zoning.kaks.toFixed(2)} / HMAX ${zoning.hmax.toFixed(1)} m`,
        `IMAR KAYNAGI: ${ascii(zoningVerificationLabel(zoning.verification))}`,
        `V112 KUTLE: ${ascii(activeMassingId)} / ON CEPHE ${ascii(frontEdge)} / ZARF ${massingModel.envelope.width.toFixed(1)} x ${massingModel.envelope.depth.toFixed(1)} m`,
      ],
      sheet: {
        projectName: project.name,
        projectCode: project.id,
        module: "GEO / PARSEL VE ARAZI",
        drawingTitle: `PARSEL VE ON YAPI YERLESIM PLANI / ${reference}`,
        drawingNo: "GEO-001",
        revision: project.revision,
        status: dataStatus,
        coordinateSystem: sourceCrs,
        scale: "MODEL 1:1",
        preparedBy: "ARKEMX",
        checkedBy: "PROJEYE OZEL",
      },
    });
    downloadBlob(`${reference}.dxf`, dxf, "application/dxf");
    setFileNotice(`Katmanlı CAD paftası oluşturuldu · ${parcel.length} parsel noktası · PARSEL / ON_YAPI / NOKTA_YAZI katmanları`);
  };
  const exportPdf = async () => {
    const origin = geoCentroid(parcel);
    const toSheet = (points: GeoPoint[], labelPoints = false) => points.map((point, index) => {
      const local = toLocalMeters(point, origin);
      return { x: local.east, y: local.north, label: labelPoints ? `P${index + 1}` : undefined };
    });
    const pdf = await createCorporateTechnicalPdf({
      projectName: project.name,
      projectCode: project.id,
      module: "ARKEMX / GEO PARSEL STUDYOSU",
      drawingTitle: "Parsel ve Ön Yapı Yerleşim Paftası",
      drawingSubtitle: `${reference} / ${usage} / ${system}`,
      revision: project.revision,
      status: dataStatus,
      sheetNo: "GEO-001",
      scale: "OTOMATIK / METRE",
      coordinateSystem: sourceCrs,
      polylines: [
        { role: "secondary", points: toSheet(parcel, true) },
        { role: "primary", points: toSheet(building) },
      ],
      metrics: [
        ["Parsel alanı", `${metrics.area.toFixed(1)} m²`],
        ["Parsel çevresi", `${metrics.perimeter.toFixed(1)} m`],
        ["Yapı tabanı", `${metrics.footprint.toFixed(1)} m²`],
        ["Ön brüt alan", `${metrics.gross.toFixed(1)} m²`],
        ["Kat / yükseklik", `${floors} / ${metrics.buildingHeight.toFixed(1)} m`],
        ["TAKS / KAKS", `%${metrics.coverage.toFixed(1)} / ${metrics.far.toFixed(2)}`],
        ["Sınır mesafesi", `${metrics.boundaryDistance.toFixed(1)} m`],
        ["Yapı nizamı", zoning.buildingOrder],
        ["İmar kaynağı", zoningVerificationLabel(zoning.verification)],
        ["Arazi temeli", terrainModel.basis === "measured-z" ? `${terrainModel.samples.measured} kaynaklı Z kotu` : `Parametrik %${slope} eğim`],
        ["Kot farkı", `${terrainModel.elevation.range.toFixed(2)} m`],
        ["V112 kütle", `${activeMassingId} / ön cephe ${frontEdge}`],
      ],
      coordinates: parcel.slice(0, 6).map((point, index) => [
        `P${String(index + 1).padStart(2, "0")}`,
        point.lat.toFixed(7),
        point.lng.toFixed(7),
      ]),
      notes: [
        `${sourceCrs} koordinat sistemi ve ${dataStatus} veri statüsü kullanılmıştır.`,
        `Kütle: ${buildingWidth.toFixed(1)} × ${buildingDepth.toFixed(1)} m, ${floors} kat, ${rotation}° yönlenme.`,
        `İmar girdisi: TAKS ${zoning.taks.toFixed(2)}, KAKS ${zoning.kaks.toFixed(2)}, Hmax ${zoning.hmax.toFixed(1)} m, ${zoning.buildingOrder}.`,
        `Plan: ${zoning.planName || "belirtilmedi"} / ${zoning.planScale} / ${zoning.planId || "plan işlem no belirtilmedi"}.`,
        `Kaynak statüsü: ${zoningVerificationLabel(zoning.verification)}${zoning.sourceDocument ? ` / ${zoning.sourceDocument}` : ""}.`,
        `Arazi modeli: ${terrainModel.basis === "measured-z" ? `${terrainModel.samples.measured} kaynaklı Z kotu, IDW ön yüzeyi` : `%${slope} parametrik eğim`}; ${terrainModel.limitations[0]}`,
        `Kütle motoru: ${massingModel.envelope.width.toFixed(1)} × ${massingModel.envelope.depth.toFixed(1)} m kavramsal yapı zarfı; ${massingModel.limitations[0]}`,
        "Parsel sınırı, aplikasyon ve imar koşulları yetkili meslek mensubu ve resmî belgelerle doğrulanmalıdır.",
      ],
      legend: [["Ön yapı kütlesi", "primary"], ["Parsel sınırı", "secondary"]],
    });
    downloadBlob(`${reference}-arkem-kurumsal-pafta.pdf`, pdf, "application/pdf");
    setFileNotice("A3 kurumsal PDF paftası; proje kimliği, revizyon, metrik, koordinat ve teknik notlarla oluşturuldu");
  };
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
  const exportManifest = () => downloadBlob(`${reference}-veri-manifestosu.json`, JSON.stringify({ schema: "ARKEM-GEO-MANIFEST/2.4", previousSchema: "ARKEM-GEO-MANIFEST/2.3", legacySchema: "ARKEM-GEO-MANIFEST/2.0", reference, sourceCrs, dataStatus, coordinateOrigin: center, parcelRecord, parcelSourceNetwork: sourceNetwork, terrainModel, terrainLayers, massingModel, selectedMassingId: activeMassingId, frontEdge, counts: { parcelVertices: parcel.length, buildingVertices: building.length, contourSegments: terrainContours.length, massingAlternatives: massingModel.alternatives.length }, planningInputs: { requiredSetback, maxCoverage, maxFar, maxHeight, parkingPer100 }, zoning: createZoningProvenance(zoning, reference), metrics, provenance: createGeoProvenance({ reference, sourceCrs, dataStatus, administrativeSource, geometryValid: metrics.geometryValid, vertexCount: parcel.length }), connectors: [...GEO_CONNECTORS, ...ZONING_CONNECTORS], verification: { officialCadastre: false, licensedSurvey: dataStatus === "Harita mühendisi ölçümü" || dataStatus === "Onaylı aplikasyon verisi", zoningCertificate: zoning.verification === "certified-document", measuredElevation: terrainModel.basis === "measured-z", massingAuthoritative: massingModel.source.authoritative }, limitations: ["Kadastro sınırı değildir", "İmar uygunluk belgesi değildir", "Aplikasyon veya ruhsat projesi değildir", ...terrainModel.limitations, ...massingModel.limitations] }, null, 2), "application/json");

  const stageContent: Record<Stage, React.ReactNode> = {
    locate: <div className="geo-control-section"><span>01 / PARSELİ BUL</span><h3>Resmî sorgudaki sırayla konumu seçin.</h3>{administrativeSource === "fallback" && <div className="arx-geo-offline-alert" role="status">
      <b>TKGM bağlantısı yok: mahalleler resmî kaynaktan yüklenemedi.</b>
      <p>İlçe listesi yalnızca seçim kolaylığı içindir. Mahalle/köy adını elle girebilir, ada ve parseli not edebilirsiniz; bu bilgiler otomatik olarak doğrulanmış sınır üretmez.</p>
      <button type="button" onClick={() => { void retryOfficialLists(); }} disabled={administrativeLoading === "province"}>
        {administrativeLoading === "province" ? "Bağlantı deneniyor…" : "Resmî listeleri yeniden dene"}
      </button>
      <small>{fileNotice}</small>
    </div>}
    <div className="geo-cascade-guide"><b>İl</b><i>→</i><b>İlçe</b><i>→</i><b>Mahalle/Köy</b><i>→</i><b>Ada</b><i>→</i><b>Parsel</b></div><div className="geo-field-grid geo-cascade-fields"><label>İl<select value={provinceId} onChange={(event) => { const selected = provinceOptions.find((item) => item.id === event.target.value); setProvinceId(event.target.value); setProvince(selected?.label ?? ""); setAdministrativeLoading("district"); setDistrictOptions([]); setDistrictId(""); setDistrict(""); setNeighborhoodOptions([]); setNeighborhoodId(""); setNeighborhood(""); }} disabled={!provinceOptions.length}><option value="">{administrativeLoading === "province" ? "İller yükleniyor…" : "İl seçin"}</option>{provinceOptions.map((item) => <option value={item.id} key={item.id}>{item.label}</option>)}</select></label><label>İlçe<select value={districtId} onChange={(event) => { const selected = districtOptions.find((item) => item.id === event.target.value); setDistrictId(event.target.value); setDistrict(selected?.label ?? ""); setAdministrativeLoading("neighborhood"); setNeighborhoodOptions([]); setNeighborhoodId(""); setNeighborhood(""); }} disabled={!provinceId || !districtOptions.length}><option value="">{administrativeLoading === "district" ? "İlçeler yükleniyor…" : provinceId ? "İlçe seçin" : "Önce il seçin"}</option>{districtOptions.map((item) => <option value={item.id} key={item.id}>{item.label}</option>)}</select></label><label>Mahalle / Köy{administrativeSource === "fallback"
      ? <><input value={neighborhood} onChange={(event) => { const value = event.target.value; setNeighborhood(value); setNeighborhoodId(value.trim() ? "offline-neighborhood-manual" : ""); }}
          placeholder="Mahalle veya köy adını kendiniz yazın" disabled={!districtId} autoComplete="off" />
          <small className="arx-geo-field-warning">Elle girilen ad resmî mahalle kimliği değildir.</small></>
      : <select value={neighborhoodId} onChange={(event) => { const selected = neighborhoodOptions.find((item) => item.id === event.target.value); setNeighborhoodId(event.target.value); setNeighborhood(selected?.label ?? ""); }} disabled={!districtId || !neighborhoodOptions.length}>
          <option value="">{administrativeLoading === "neighborhood" ? "Mahalleler yükleniyor…" : districtId ? "Mahalle / köy seçin" : "Önce ilçe seçin"}</option>
          {neighborhoodOptions.map((item) => <option value={item.id} key={item.id}>{item.label}</option>)}
        </select>}</label><label>Ada<input value={block} onChange={(event) => setBlock(event.target.value.replace(/\D/g, ""))} inputMode="numeric" placeholder="Ada numarası" disabled={!neighborhoodId} /></label><label>Parsel<input value={parcelNo} onChange={(event) => setParcelNo(event.target.value.replace(/\D/g, ""))} inputMode="numeric" placeholder="Parsel numarası" disabled={!neighborhoodId} /></label></div><p className={`geo-cascade-status ${administrativeSource === "fallback" ? "fallback" : "official"}`}><i className={neighborhoodId ? "ready" : ""}></i>{administrativeSource === "fallback" ? "Çevrimdışı seçim listesi açık · resmî geometri TKGM/KML ile doğrulanacak." : neighborhoodId ? `${province} / ${district} / ${neighborhood} seçildi. Ada ve parsel numarasını girin.` : "Her seçim bir sonraki resmî idari listeyi açar."}</p>{administrativeSource === "official" && !districtId.startsWith("offline-") && !neighborhoodId.startsWith("offline-")
      ? <button className={"geo-parcel-query " + parcelLookup} onClick={locateOfficialParcel}
          disabled={parcelLookup === "loading" || !neighborhoodId || !block.trim() || !parcelNo.trim()}>
          <span>{parcelLookup === "loading" ? "…" : parcelLookup === "found" ? "✓" : "TKGM"}</span>
          <b>{parcelLookup === "loading" ? "Parsel aranıyor" : parcelLookup === "found" ? "Parsel bulundu · haritaya işlendi" : "TKGM üzerinden ada / parsel sorgula"}</b><i>↗</i>
        </button>
      : <p className="arx-geo-offline-query">Doğrudan parsel sorgusu bu oturumda kullanılamıyor. Resmî Parsel Sorgu üzerinden kaydı kontrol edin. Varsa sınır KML / GeoJSON dosyasını Dosya Yükle bölümüne aktarın.</p>}<a className="geo-official-link" href="https://parselsorgu.tkgm.gov.tr/" target="_blank" rel="noreferrer"><span>R</span><b>Resmî Parsel Sorgu’da doğrula</b><i>↗</i></a><p className="geo-caution">İl, ilçe ve mahalle/köy listeleri TKGM MEGSİS servisinden bağımlı olarak yüklenir. Ada ve parsel numarası seçili mahalle kimliğiyle sorgulanır. Alınan sınır bilgilendirme amaçlıdır; resmî proje sınırı yetkili harita mühendisi ve aplikasyon verisiyle doğrulanır.</p><div className="geo-coordinate-fields"><label>Enlem<input value={latitude} onChange={(event) => setLatitude(event.target.value)} inputMode="decimal" /></label><label>Boylam<input value={longitude} onChange={(event) => setLongitude(event.target.value)} inputMode="decimal" /></label></div><div className="geo-inline-actions"><button onClick={moveToCoordinate}>Koordinata git</button><button onClick={useDeviceLocation}>Cihaz konumu</button></div></div>,
    import: <div className="geo-control-section"><span>02 / MEKÂNSAL VERİ</span><h3>Sınırı kaynağı ve statüsüyle içe alın.</h3><label>Kaynak koordinat sistemi<select value={sourceCrs} onChange={(event) => setSourceCrs(event.target.value)}><option>EPSG:4326 / WGS84</option><option>ITRF96 / 3° TM — dönüşüm gerekli</option><option>ED50 / UTM — dönüşüm gerekli</option><option>Yerel aplikasyon — sabit nokta gerekli</option></select></label><label>Veri statüsü<select value={dataStatus} onChange={(event) => setDataStatus(event.target.value)}><option>Kavramsal / doğrulanmamış</option><option>TKGM ekranından yaklaşık</option><option>Harita mühendisi ölçümü</option><option>Onaylı aplikasyon verisi</option></select></label><label className="geo-file-drop"><input type="file" accept=".kml,.geojson,.json,.csv,.txt" onChange={(event) => handleFile(event.target.files?.[0])} /><b>KML, GeoJSON veya CSV seçin</b><small>Dosya tarayıcıda okunur; sunucuya yüklenmez.</small></label><div className="geo-format-list"><p><b>KML / KMZ</b><span>Google Earth çalışma akışı</span><i>CANLI: KML</i></p><p><b>GeoJSON</b><span>WGS84 Polygon / MultiPolygon</span><i>CANLI</i></p><p><b>CSV</b><span>enlem, boylam, opsiyonel kot</span><i>CANLI</i></p><p><b>SHP / LandXML</b><span>proje dönüşüm hattı</span><i className="planned">KISMİ</i></p></div><p className="geo-caution">Tarayıcı EPSG:4326 enlem / boylam verisini doğrudan işler. ITRF/TM, ED50 veya yerel koordinatlar doğru EPSG, dönüşüm parametreleri ve sabit aplikasyon noktası olmadan WGS84 kabul edilmez.</p></div>,
    draw: <div className="geo-control-section"><span>03 / SINIR EDİTÖRÜ</span><h3>Noktaları harita üzerinde düzenleyin.</h3><button className={`geo-toggle-draw${drawEnabled ? " active" : ""}`} onClick={() => setDrawEnabled((value) => !value)}><i></i>{drawEnabled ? "Haritaya tıklayarak nokta ekleniyor" : "Nokta ekleme kapalı"}</button><div className="geo-inline-actions"><button onClick={removeLastBoundaryPoint} disabled={!parcel.length}>Son noktayı geri al</button><button onClick={clearBoundary} disabled={!parcel.length}>Sınırı temizle</button></div><button className="geo-wide-action" onClick={loadSample}>Koordinatta örnek poligon üret</button><div className="geo-point-table"><header><span>Nokta</span><span>Enlem</span><span>Boylam</span></header>{parcel.slice(0, 12).map((point, index) => <p key={`${point.lat}-${point.lng}-${index}`}><b>P{String(index + 1).padStart(2, "0")}</b><span>{point.lat.toFixed(6)}</span><span>{point.lng.toFixed(6)}</span></p>)}{parcel.length > 12 && <small>+ {parcel.length - 12} ek nokta</small>}</div></div>,
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
      <label>Kaynak beyanı / inceleme durumu
        <select value={zoning.verification} onChange={(event) => updateZoning("verification", event.target.value as ZoningVerification)}>
          <option value="user-declared">Kullanıcı girdisi · doğrulanmadı</option>
          <option value="document-pending-review" disabled={!zoning.sourceDocument}>Belge eklendi · uzman doğrulaması bekliyor</option>
          <option value="municipal-viewer">Kullanıcı beyanı: e-İmar ekranı görüldü · doğrulanmadı</option>
        </select>
        <small>Bu seçimler resmî onay sağlamaz. Onaylı kaynak statüsü, yetkili doğrulama süreci kurulana kadar kullanıcı arayüzünden atanamaz.</small>
      </label>
      <label>Arazi kullanım kararı<input value={zoning.landUse} onChange={(event) => updateZoning("landUse", event.target.value)} placeholder="Konut, ticaret, sanayi…" /></label>
      <div className="geo-field-grid">
        <label>Plan adı<input value={zoning.planName} onChange={(event) => updateZoning("planName", event.target.value)} placeholder="Uygulama imar planı" /></label>
        <label>Plan ölçeği<select value={zoning.planScale} onChange={(event) => updateZoning("planScale", event.target.value)}><option>1/1000 Uygulama İmar Planı</option><option>1/5000 Nazım İmar Planı</option><option>1/25000 Çevre Düzeni Planı</option><option>Diğer / plan paftasına göre</option></select></label>
        <label>Plan işlem / pafta no<input value={zoning.planId} onChange={(event) => updateZoning("planId", event.target.value)} placeholder="PIN, pafta veya karar no" /></label>
        <label>Yapı nizamı<select value={zoning.buildingOrder} onChange={(event) => updateZoning("buildingOrder", event.target.value)}><option>Ayrık nizam</option><option>Bitişik nizam</option><option>Blok nizam</option><option>İkiz nizam</option><option>Serbest nizam</option><option>Plan notuna göre</option></select></label>
      </div>
      <div className="geo-planning-grid geo-zoning-values">
        <label>TAKS<input type="number" min=".01" max="1" step=".01" value={zoning.taks} onChange={(event) => updateZoning("taks", Number(event.target.value))}/></label>
        <label>KAKS / Emsal<input type="number" min=".05" max="10" step=".05" value={zoning.kaks} onChange={(event) => updateZoning("kaks", Number(event.target.value))}/></label>
        <label>Hmax / Yençok<input type="number" min="0" max="250" step=".5" value={zoning.hmax} onChange={(event) => updateZoning("hmax", Number(event.target.value))}/><b>m</b></label>
      </div>
      <div className="geo-planning-grid geo-zoning-values">
        <label>Ön bahçe<input type="number" min="0" max="100" step=".5" value={zoning.frontSetback} onChange={(event) => updateSetback("frontSetback", Number(event.target.value))}/><b>m</b></label>
        <label>Yan bahçe<input type="number" min="0" max="100" step=".5" value={zoning.sideSetback} onChange={(event) => updateSetback("sideSetback", Number(event.target.value))}/><b>m</b></label>
        <label>Arka bahçe<input type="number" min="0" max="100" step=".5" value={zoning.rearSetback} onChange={(event) => updateSetback("rearSetback", Number(event.target.value))}/><b>m</b></label>
      </div>
      <label>Plan notu referansı<textarea rows={3} value={zoning.planNoteReference} onChange={(event) => updateZoning("planNoteReference", event.target.value)} placeholder="Madde, özel hüküm, açıklama…" /></label>
      <label>Kaynak bağlantısı<input type="url" value={zoning.sourceUrl} onChange={(event) => updateZoning("sourceUrl", event.target.value)} placeholder="Belediye e-İmar veya e-Plan bağlantısı" /></label>
      <label className="geo-file-drop"><input type="file" accept=".pdf,.png,.jpg,.jpeg" onChange={(event) => handleZoningDocument(event.target.files?.[0])} /><b>İmar durumu / plan notu belgesi ekleyin</b><small>Belge yalnızca oturumda referanslanır; sunucuya yüklenmez.</small></label>
      <p className="geo-caution"><b>Türkiye geneli entegrasyon sınırı:</b> Ulusal ölçekte tek ve açık bir TAKS/KAKS/Hmax servisi bulunmadığından TKGM parsel kimliği; e-Plan/TUCBS, belediye e-İmar adaptörü ve onaylı imar durumu belgesiyle eşleştirilir. Kaynaksız değer resmî imar hakkı olarak gösterilmez.</p>
    </div>,
    design: <div className="geo-control-section">
      <span>05 / YAPI YERLEŞİMİ</span>
      <h3>Doğrulanan imar koşullarında kütleyi sınayın.</h3>
      <div className="geo-zoning-summary">
        <span>AKTARILAN İMAR KOŞULLARI</span>
        <b>{zoning.buildingOrder} · TAKS {zoning.taks.toFixed(2)} · KAKS {zoning.kaks.toFixed(2)}</b>
        <small>Hmax {zoning.hmax.toFixed(1)} m · Ön/yan/arka {zoning.frontSetback}/{zoning.sideSetback}/{zoning.rearSetback} m</small>
        <button onClick={() => setActiveStage("zoning")}>İmar girdilerini düzenleyin</button>
      </div>
      <section className="v112-massing-engine" aria-label="İmar uyumlu kütle alternatifleri">
        <header>
          <div><span>V112 / İMAR UYUMLU KÜTLE MOTORU</span><b>Çekme zarfı ve yapılaşma haklarından üç açıklanabilir alternatif.</b></div>
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
          <p><span>İZİNLİ TABAN</span><b>{massingModel.limits.allowedFootprint.toFixed(0)} m²</b></p>
          <p><span>İZİNLİ EMSAL</span><b>{massingModel.limits.allowedGrossArea.toFixed(0)} m²</b></p>
          <p><span>KAT SINIRI</span><b>{massingModel.limits.maxFloors} kat / {massingModel.limits.allowedHeight.toFixed(1)} m</b></p>
        </div>
        <div className="v112-massing-options">
          {massingModel.alternatives.map((alternative) => <article key={alternative.id} data-state={alternative.status} data-selected={activeMassingId === alternative.id}>
            <div><span>{alternative.status === "fits" ? "ÖN UYUMLU" : "İNCELEME"}</span><b>{alternative.label}</b></div>
            <strong>{alternative.grossArea.toFixed(0)} <i>m²</i></strong>
            <p>{alternative.width.toFixed(1)} × {alternative.depth.toFixed(1)} m · {alternative.floors} kat</p>
            <dl><div><dt>TAKS</dt><dd>%{alternative.coverage.toFixed(1)}</dd></div><div><dt>KAKS</dt><dd>{alternative.far.toFixed(2)}</dd></div><div><dt>Hak kullanımı</dt><dd>%{alternative.utilization.toFixed(0)}</dd></div></dl>
            <small>{alternative.note}</small>
            <button onClick={() => applyMassingAlternative(alternative.id)} disabled={alternative.status !== "fits"}>{activeMassingId === alternative.id ? "Projede seçili" : "Bu alternatifi uygula"}</button>
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

  return <section className={simple ? "geo-parcel-studio arx-geo-simple" : "geo-parcel-studio"} data-arx-sources={showSources ? "open" : "closed"} data-arx-layers={showLayers ? "open" : "closed"} data-arx-results={showResults ? "open" : "closed"}>
    {simple ? <details className="arx-geo-project-details"><summary>Proje bilgileri ve tam JSON yedeği</summary><ProjectKernelBar module="GEO·BIM PARCEL ENGINE" confidence={dataStatus} /></details> : <ProjectKernelBar module="GEO·BIM PARCEL ENGINE" confidence={dataStatus} />}
    <header className="geo-studio-top"><div><span>ARKEM / GEO·BIM WORKSPACE · V111 GIS + 3B</span><b>Parsel, Kot & Arazi Stüdyosu</b></div><div><span className="geo-status live">ORTAK KATMAN MOTORU</span><small>2B + 3B · WGS84 / yerel ENU</small></div></header>
    {simple && <>
      <nav className="arx-geo-quick-nav" aria-label="Arazi parsel temel işlemleri">
        {([["locate","Parsel bul"],["import","Dosya yükle"],["zoning","İmar bilgileri"],["design","Yapı yerleşimi"]] as const).map(([id,label]) =>
          <button key={id} type="button" className={activeStage === id ? "active" : ""} aria-current={activeStage === id ? "step" : undefined}
            onClick={() => setActiveStage(id)}>{label}</button>
        )}
        <details className="arx-geo-extra">
          <summary>Diğer araçlar ▾</summary>
          <div>
            {([["draw","Sınır düzenle"],["terrain","3B arazi"],["export","Teknik çıktılar"]] as const).map(([id,label]) =>
              <button type="button" key={id} className={activeStage === id ? "active" : ""}
                onClick={() => setActiveStage(id)}>{label}</button>
            )}
            <button type="button" aria-pressed={showSources} onClick={() => setShowSources((current) => !current)}>
              {showSources ? "Kaynak ayrıntılarını gizle" : "Kaynak ayrıntılarını göster"}</button>
            <button type="button" aria-pressed={showLayers} onClick={() => setShowLayers((current) => !current)}>
              {showLayers ? "Harita katmanlarını gizle" : "Harita katmanlarını göster"}</button>
            <button type="button" aria-pressed={showConceptualOverlays} onClick={() => {
              setShowConceptualOverlays((visible) => !visible);
              if (!showConceptualOverlays) setTerrainLayers((current) => ({ ...current, contours: true, "building-mass": true }));
            }}>
              {showConceptualOverlays ? "Temsili yapı ve eğrileri gizle" : "Temsili yapı ve eğrileri göster"}
            </button>
            <button type="button" aria-pressed={showResults} onClick={() => setShowResults((current) => !current)}>
              {showResults ? "Hesap sonuçlarını gizle" : "Hesap sonuçlarını göster"}</button>
          </div>
        </details>
      </nav>
      <p className="arx-geo-source-note" role="note">{parcelSource.kind === "sample"
        ? "Örnek parsel gösteriliyor. Bu sınır gerçek kadastro veya aplikasyon verisi değildir."
        : "Sınır kaynağını ve imar doğrulama durumunu teknik sonuçlardan önce kontrol edin."}</p>
    </>}
    <section className="v109-parcel-center" data-record-state={parcelRecord.state}>
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
    </section>
    <nav className="geo-workflow" aria-label="Parsel stüdyosu iş akışı">{stages.map((stage) => <button key={stage.id} className={activeStage === stage.id ? "active" : ""} onClick={() => setActiveStage(stage.id)}><i>{stage.no}</i><span><b>{stage.label}</b><small>{stage.sub}</small></span></button>)}</nav>
    <section className="geo-integration-map" aria-label="Coğrafi veri entegrasyon haritası"><header><span>V81 / VERİ KAYNAĞI HARİTASI · V91 İMAR KATMANI</span><b>Her sonuç kaynağı ve yetki sınırıyla taşınır</b></header><div>{GEO_CONNECTORS.map((connector) => <article key={connector.id} data-state={connector.id === "tkgm" && administrativeSource === "fallback" ? "protocol-required" : connector.state}><i></i><span><b>{connector.label}</b><small>{connector.purpose}</small></span><em>{connector.id === "tkgm" && administrativeSource === "fallback" ? "SERVİS BEKLİYOR" : connector.state.replaceAll("-", " ").toLocaleUpperCase("tr-TR")}</em></article>)}</div><div className="geo-zoning-connector-row">{ZONING_CONNECTORS.map((connector) => <article key={connector.id} data-state={connector.state}><i></i><span><b>{connector.label}</b><small>{connector.purpose}</small></span><em>{connector.state.replaceAll("-", " ").toLocaleUpperCase("tr-TR")}</em></article>)}</div><p>Resmî kadastro, imar, aplikasyon ve fotogerçekçi 3B katmanlar; yalnız yetkili protokol, güncel plan veya onaylı belge sağlandığında proje kanıtı olarak işaretlenir.</p></section>
    <div className="geo-workspace">
      <aside className="geo-controls">{stageContent[activeStage]}<div className="geo-control-notice"><i></i><span><b>OTURUM DURUMU</b><small>{fileNotice}</small></span></div></aside>
      <main className="geo-stage">
        <div className="geo-stage-toolbar"><div>{([{"id":"map","label":"2B Harita"},{"id":"terrain","label":"3B Arazi"},{"id":"data","label":"Veri / Koordinat"}] as const).map((view) => <button key={view.id} className={viewMode === view.id ? "active" : ""} onClick={() => setViewMode(view.id)}>{view.label}</button>)}</div>{simple && viewMode === "map" && <button type="button" className="arx-geo-concept-toggle" aria-pressed={showConceptualOverlays} onClick={() => setShowConceptualOverlays((current) => !current)}>{showConceptualOverlays ? "Temsili katmanları gizle" : "Temsili katmanları göster"}</button>}<button onClick={fitToParcel}>Parseli ekrana sığdır ⛶</button></div>
        <section className="v111-layer-dock" aria-label="Ortak GIS ve 3B arazi katmanları">
          <header><div><span>V111 / ORTAK HARİTA + 3B KATMANLARI</span><b>Bir seçim, iki görünüm, tek proje kaydı.</b></div><em data-trust={terrainModel.trust}>{terrainModel.basis === "measured-z" ? `${terrainModel.samples.measured} KOT · ${terrainModel.trust === "verified" ? "YETKİLİ BEYAN" : "KAYNAK DOSYA"}` : "KAVRAMSAL YÜZEY"}</em></header>
          <div>{terrainModel.layers.map((layer) => <label key={layer.id} data-available={layer.available}><input type="checkbox" checked={terrainLayers[layer.id]} onChange={() => toggleTerrainLayer(layer.id)} disabled={layer.id === "basemap" || !layer.available} /><span><b>{layer.label}</b><small>{layer.id === "basemap" ? (basemapStatus === "ready" ? "Uydu / sokak servisi erişilebilir" : "Harita altlığı hazırlanıyor") : layer.available ? terrainLayers[layer.id] ? "Görünür" : "Gizli" : "Veri bekliyor"}</small></span></label>)}</div>
          <footer><span>{terrainModel.source.authority}</span><b>{terrainModel.basis === "measured-z" ? `Kot ${terrainModel.elevation.minimum?.toFixed(2)}–${terrainModel.elevation.maximum?.toFixed(2)} m · ${terrainContours.length} eş yükselti parçası` : `%${slope} temsili eğim · plankote değildir`}</b></footer>
        </section>
        <div className={`geo-map-frame${viewMode !== "map" ? " hidden-view" : ""}`}><div ref={mapHostRef} className="geo-leaflet-map"></div><div className="geo-basemap-switch" role="group" aria-label="Harita altlığı">{([{ id: "satellite", label: "Uydu" }, { id: "street", label: "Sokak" }, { id: "hybrid", label: "Hibrit" }] as const).map((mode) => <button key={mode.id} type="button" className={basemapMode === mode.id ? "active" : ""} aria-pressed={basemapMode === mode.id} onClick={() => setBasemapMode(mode.id)}>{mode.label}</button>)}</div>{basemapWarning && <p className="geo-basemap-warning" role="status">{basemapWarning}</p>}<div className="geo-basemap-offline-label" role="note">{basemapStatus === "error" ? "Harita altlığı yüklenemedi · Koordinat görünümü açık" : parcelSource.kind === "sample" ? (basemapStatus === "ready" ? "Harita altlığı · ÖRNEK konum (seçili parsel değil)" : "Harita yükleniyor · ÖRNEK konum") : (basemapStatus === "ready" ? "Harita altlığı · Parsel sınırı TKGM kaydından alınmıştır" : "Harita yükleniyor · Parsel sınırı mevcut")}</div>{!mapReady && <div className="geo-map-loading"><i></i><b>{mapError || "Harita katmanı hazırlanıyor"}</b><small>Koordinat araçları çevrimdışı da kullanılabilir.</small></div>}<div className="geo-map-legend"><span><i></i>Parsel sınırı</span>{showConceptualOverlays && <><span><i></i>Temsili yapı</span><span><i></i>Sınır noktası</span></>}</div>{!simple && <div className="geo-map-crosshair">+</div>}</div>
        {viewMode === "terrain" && <GeoTerrainViewer parcel={parcel} buildingWidth={buildingWidth} buildingDepth={buildingDepth} floors={floors} rotation={rotation} offsetEast={offsetEast} offsetNorth={offsetNorth} slope={slope} exaggeration={exaggeration} layers={terrainLayers} terrainModel={terrainModel} />}
        {viewMode === "data" && <div className="geo-data-view"><header><div><span>KAYNAK CRS BEYANI</span><b>{sourceCrs}</b></div><div><span>İŞLEME DÜZLEMİ</span><b>WGS84 → lokal ENU · metre</b></div><div><span>VERİ STATÜSÜ</span><b>{dataStatus}</b></div></header><section className="v111-terrain-ledger"><article><span>YÜZEY TEMELİ</span><b>{terrainModel.basis === "measured-z" ? "Ölçülmüş Z / IDW" : "Parametrik eğim"}</b><small>{terrainModel.trust.toLocaleUpperCase("tr-TR")}</small></article><article><span>KOT ÖRNEĞİ</span><b>{terrainModel.samples.measured} / {terrainModel.samples.total}</b><small>Ölçülmüş / toplam nokta</small></article><article><span>KOT ARALIĞI</span><b>{terrainModel.elevation.range.toFixed(2)} m</b><small>{terrainModel.elevation.datum === "source-declared" ? "Kaynak datum beyanı" : "Yerel bağıl düzlem"}</small></article><article><span>EŞ YÜKSELTİ</span><b>{terrainContours.length}</b><small>Marching-squares önizleme parçası</small></article></section><div className="geo-data-table"><div className="head"><span>ID</span><span>LATITUDE</span><span>LONGITUDE</span><span>EAST / m</span><span>NORTH / m</span><span>Z / m</span></div>{parcel.map((point, index) => { const local = toLocalMeters(point, center); return <div key={`${point.lat}-${point.lng}-${index}`}><b>P{String(index + 1).padStart(2, "0")}</b><span>{point.lat.toFixed(8)}</span><span>{point.lng.toFixed(8)}</span><span>{local.east.toFixed(3)}</span><span>{local.north.toFixed(3)}</span><span>{point.alt?.toFixed(2) ?? "—"}</span></div>; })}</div><footer><p><b>CRS kontrolü</b> Hesap motoru koordinatları coğrafi derece olarak yorumlar ve parsel merkezi çevresinde lokal ENU düzlemine alır. Kaynak veri WGS84 değilse doğru EPSG dönüşümü yapılmadan alan ve mesafe sonuçları proje verisi sayılmaz.</p><p><b>Arazi kontrolü</b> {terrainModel.limitations[0]}</p></footer></div>}
        <div className="geo-connectors"><a href={`https://www.google.com/maps/search/?api=1&query=${center.lat},${center.lng}`} target="_blank" rel="noreferrer"><span>G</span><div><b>Google Maps’te aç</b><small>{parcelSource.kind === "sample" ? `ÖRNEK KONUM · ${center.lat.toFixed(6)}, ${center.lng.toFixed(6)}` : `${center.lat.toFixed(6)}, ${center.lng.toFixed(6)}`}</small></div><i>↗</i></a><a href={`https://earth.google.com/web/search/${center.lat},${center.lng}`} target="_blank" rel="noreferrer"><span>E</span><div><b>Google Earth’te aç</b><small>KML ile sınır ve kütle aktarın</small></div><i>↗</i></a><button onClick={exportKml} disabled={exportDisabled}><span>K</span><div><b>Earth KML paketini indir</b><small>{exportDisabled ? "Önce kaynaklı bir parsel sınırı oluşturun" : "Parsel + ön yapı poligonu"}</small></div><i>↓</i></button></div>
      </main>
      <aside className="geo-results"><span>CANLI TEKNİK ÖZET</span><div className="geo-primary-metric"><small>HESAPLANAN PARSEL ALANI</small><strong>{metrics.area.toLocaleString("tr-TR", { maximumFractionDigits: 1 })}<i>m²</i></strong><p>{parcel.length} köşe · {metrics.perimeter.toFixed(1)} m çevre</p></div><div className="geo-metric-grid"><article><span>Sınır kutusu</span><b>{metrics.width.toFixed(1)} × {metrics.depth.toFixed(1)} m</b></article><article><span>Yapı tabanı</span><b>{metrics.footprint.toLocaleString("tr-TR")} m²</b></article><article><span>TAKS / girdi · imar</span><b className={metrics.coverage > maxCoverage ? "risk" : "good"}>%{metrics.coverage.toFixed(1)} / %{maxCoverage}</b></article><article><span>KAKS / girdi · imar</span><b className={metrics.far > maxFar ? "risk" : "good"}>{metrics.far.toFixed(2)} / {maxFar.toFixed(2)}</b></article><article><span>Yükseklik</span><b className={metrics.buildingHeight > maxHeight ? "risk" : "good"}>{metrics.buildingHeight.toFixed(1)} / {maxHeight.toFixed(1)} m</b></article><article><span>Yapı nizamı</span><b>{zoning.buildingOrder}</b></article></div><div className="geo-current-design"><span>İMAR & KÜTLE KONTROLÜ</span><h4>{usage}</h4><p>{system} · {floors} kat · {rotation}° yönlenme</p><div><small>İmar kaynağı</small><b>{zoningVerificationLabel(zoning.verification)}</b></div><div><small>İzinli taban / imar</small><b>{metrics.allowedFootprint.toFixed(0)} m²</b></div><div><small>İzinli emsal alan / imar</small><b>{metrics.allowedGross.toFixed(0)} m²</b></div><div><small>En yakın sınır / hedef</small><b className={metrics.setbackPass ? "good" : "risk"}>{metrics.boundaryDistance.toFixed(1)} / {requiredSetback.toFixed(1)} m</b></div></div><div className="geo-validation"><span>VERİ DOĞRULAMA ZİNCİRİ</span>{[[metrics.geometryValid, "Kapalı ve kesişmesiz geometri"],[metrics.setbackPass, "Yapı parsel / çekme kontrolü"],[metrics.coverage <= maxCoverage && metrics.far <= maxFar && metrics.buildingHeight <= maxHeight, "İmar girdileriyle ön uyum"],[Boolean(block && parcelNo), "Ada / parsel referansı"],[zoning.verification === "approved-plan" || zoning.verification === "certified-document", "Onaylı imar kaynağı"],[dataStatus === "Onaylı aplikasyon verisi", "Resmî aplikasyon statüsü"]].map(([done, label]) => <p key={String(label)} className={done ? "done" : ""}><i>{done ? "✓" : ""}</i><span>{label}</span></p>)}</div><button className="geo-result-cta" onClick={() => { setActiveStage("export"); setViewMode("data"); }}>Teknik çıktı paketini hazırlayın <span>↗</span></button></aside>
    </div>
    <footer className="geo-studio-foot"><b>Hukuki ve teknik sınır</b><p>Bu çalışma alanı erken karar, veri hazırlığı ve disiplinler arası koordinasyon içindir. Tapu/kadastro kaydı, aplikasyon, imar uygunluğu, zemin etüdü, mühendislik hesabı veya ruhsat projesi yerine geçmez. TKGM parsel kimliği; e-Plan/TUCBS katmanları, belediye e-İmar adaptörleri ve onaylı imar durumu belgesiyle kaynaklandırılır. Yetkili servis, protokol veya belge bulunmadan TAKS, KAKS, Hmax ve nizam değeri resmî hak olarak sunulmaz.</p></footer>
  </section>;
}
