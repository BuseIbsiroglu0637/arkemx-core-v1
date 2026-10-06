"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { LayerGroup, Map as LeafletMap, Polygon as LeafletPolygon } from "leaflet";
import { GeoTerrainViewer } from "./GeoTerrainViewer";
import { buildingFootprint, fromLocalMeters, geoCentroid, localBounds, polygonArea, polygonPerimeter, polygonSelfIntersects, sampleParcel, toLocalMeters, type GeoPoint } from "../lib/geo";
import { createLayeredDxf } from "../lib/engineering";
import { assessExportReview, escapeXml } from "../lib/export-review";
import { createCorporateTechnicalPdf } from "../lib/technical-sheet";
import { createGeoProvenance, GEO_CONNECTORS } from "../lib/geo-integration";
import {
  createParcelRecord,
  resolveParcelSourceNetwork,
  type ParcelRecord,
  type ParcelSourceKind,
} from "../lib/parcel-record";
import { createZoningProvenance, DEFAULT_ZONING, normalizeUntrustedZoningVerification, normalizeZoningSourceUrl, ZONING_CONNECTORS, zoningVerificationLabel, type ZoningExpertReviewStatus, type ZoningForm, type ZoningVerification } from "../lib/zoning";
import {
  DEFAULT_TERRAIN_LAYERS,
  createTerrainContours,
  createTerrainElevationSampler,
  createTerrainModel,
  normalizeTerrainLayers,
  type TerrainLayerId,
  type TerrainLayerVisibility,
} from "../lib/terrain-model";
import { assessParcelEdgeSetbacks, createZoningMassingModel, type ParcelFrontEdge } from "../lib/zoning-massing";
import { ProjectKernelBar, useProjectKernel } from "./ProjectKernel";
import { assessLandCandidate, object, readLandResearch } from "../lib/land-research";
import { officialZoningPrefill } from "../lib/official-zoning-prefill";
import type { OfficialZoningResult } from "../lib/kastamonu-zoning";
import { listingZoningPrefill } from "../lib/land-zoning-declaration";
import { landParcelPrefill, type LandParcelIdentity } from "../lib/land-parcel-prefill";
import { decodeProjectEnvelope, PROJECT_BACKUP_KEY } from "../lib/project-storage";

type Stage = "locate" | "import" | "draw" | "zoning" | "design" | "terrain" | "export";
type ViewMode = "map" | "terrain" | "data";
type BasemapMode = "satellite" | "street" | "hybrid";

type GeoParcelSavedState = {
  listingIdentitySource?: LandParcelIdentity | null;
  reference?: string;
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
  center?: GeoPoint;
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
  officialZoningResult?: OfficialZoningResult | null;
  terrain?: Record<string, unknown>;
  frontEdge?: ParcelFrontEdge;
  selectedMassingId?: string;
  parcelRecord?: ParcelRecord;
  officialBoundaryEvidence?: OfficialBoundaryEvidence;
  _kernel?: { recordedAt?: string };
};

type GeoDraftEnvelope = {
  projectId: string;
  savedAt: string;
  payload: GeoParcelSavedState;
};

const geoDraftKey = (projectId: string) => `arkemx-geo-draft:${projectId}`;


const normalizeSignedRotation = (value: number) => {
  if (!Number.isFinite(value)) return 0;
  return ((value + 180) % 360 + 360) % 360 - 180;
};

const normalizeMassingDimension = (value: number) =>
  Number.isFinite(value) ? Math.round(value * 10) / 10 : 0;


const setbackRoleLabel = (role: "front" | "side" | "rear") =>
  role === "front" ? "ön cephe" : role === "rear" ? "arka cephe" : "yan cephe";

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

function keepSelectedAdministrativeOption(
  options: AdministrativeOption[],
  id: string,
  label: string,
) {
  if (!id || !label || options.some((option) => option.id === id)) return options;
  return [{ id, label }, ...options];
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

const defaultCenter: GeoPoint = { lat: 39.0, lng: 35.0 };
type ParcelSourceState = {
  kind: ParcelSourceKind;
  authority: string;
  label: string;
  capturedAt: string;
  url: string;
  reportedArea?: number;
};

type OfficialBoundaryEvidence = {
  geometry: GeoPoint[];
  source: ParcelSourceState;
  identity: {
    province: string;
    district: string;
    neighborhood: string;
    block: string;
    parcelNo: string;
  };
  capturedAt: string;
};

function normalizeAdministrativeName(value: unknown) {
  return String(value ?? "").trim().toLocaleLowerCase("tr-TR").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\b(mahallesi|mah\.?|köyü|koyu|köy|koy)\b/g, "").replace(/[^a-z0-9çğıöşü]+/g, "");
}

function parseDeclaredLocation(value: unknown) {
  const raw = String(value ?? "").replace(/\s+/g, " ").trim();
  if (!raw) return { province: "", district: "" };

  const slashParts = raw.split(/[\/|,]/).map((part) => part.trim()).filter(Boolean);
  if (slashParts.length >= 2) {
    const provinceMatch = FALLBACK_PROVINCE_NAMES.find((name) =>
      normalizeAdministrativeName(name) === normalizeAdministrativeName(slashParts[0]),
    );
    if (provinceMatch) return { province: provinceMatch, district: slashParts[1] ?? "" };
  }

  const normalized = raw.toLocaleLowerCase("tr-TR");
  const provinceMatch = FALLBACK_PROVINCE_NAMES.find((name) => {
    const candidate = name.toLocaleLowerCase("tr-TR");
    return normalized === candidate || normalized.startsWith(`${candidate} `);
  });
  if (!provinceMatch) return { province: raw, district: "" };

  return {
    province: provinceMatch,
    district: raw.slice(provinceMatch.length).trim(),
  };
}

type GeocodeResult = {
  lat?: number;
  lng?: number;
  displayName?: string;
  province?: string;
  district?: string;
  neighborhood?: string;
  error?: string;
};

async function fetchGeocode(params: { q?: string; lat?: number; lng?: number }) {
  const search = new URLSearchParams();
  if (params.q) search.set("q", params.q);
  if (Number.isFinite(params.lat) && Number.isFinite(params.lng)) {
    search.set("lat", String(params.lat));
    search.set("lng", String(params.lng));
  }
  const response = await fetch(`/api/geocode?${search.toString()}`, { cache: "no-store" });
  const body = await response.json() as GeocodeResult;
  if (!response.ok) throw new Error(body.error || "Konum bilgisi çözümlenemedi.");
  return body;
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
  const basemapUrlRef = useRef<string | null>(null);
  const parcelLayerRef = useRef<LeafletPolygon | null>(null);
  const setbackEnvelopeLayerRef = useRef<LeafletPolygon | null>(null);
  const buildingLayerRef = useRef<LeafletPolygon | null>(null);
  const pointsLayerRef = useRef<LayerGroup | null>(null);
  const contourLayerRef = useRef<LayerGroup | null>(null);
  const drawingRef = useRef(!simple);
  const officialBoundaryLockedRef = useRef(false);
  const transferApplied = useRef(false);
  const persistedGeoRef = useRef(false);
  const pendingFitRef = useRef<GeoPoint[] | null>(null);
  const pendingCenterRef = useRef<GeoPoint | null>(null);
  const projectLocationAppliedRef = useRef(false);
  const { patchModule, project, hydrated } = useProjectKernel();
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState("");
  const [basemapStatus, setBasemapStatus] = useState<"none" | "loading" | "ready" | "error">("none");
  const [basemapMode, setBasemapMode] = useState<BasemapMode>("satellite");
  const [basemapWarning, setBasemapWarning] = useState("");
  const [activeStage, setActiveStage] = useState<Stage>("locate");
  const [zoningFocus, setZoningFocus] = useState<"taks" | "kaks" | "hmax" | "source" | null>(null);
  const [zoningPanel, setZoningPanel] = useState<"conditions" | "source" | "expert" | "notes" | null>("conditions");
  useEffect(() => {
    const search = new URLSearchParams(window.location.search);
    const requestedStage = search.get("stage");
    const requestedFocus = search.get("focus");
    const timer = window.setTimeout(() => {
      if (requestedStage && stages.some((stage) => stage.id === requestedStage)) {
        setActiveStage(requestedStage as Stage);
      }
      if (requestedFocus === "taks" || requestedFocus === "kaks" || requestedFocus === "hmax" || requestedFocus === "source") {
        setZoningFocus(requestedFocus);
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);
  useEffect(() => {
    if (zoningFocus === "source") setZoningPanel("source");
    else if (zoningFocus === "taks" || zoningFocus === "kaks" || zoningFocus === "hmax") setZoningPanel("conditions");
  }, [zoningFocus]);
  const [showSources, setShowSources] = useState(false);
  const [showLayers, setShowLayers] = useState(false);
  const [showResults, setShowResults] = useState(false);
  // The streamlined parcel page opens with only the actual map and boundary.
  // Conceal conceptual overlays visually without deleting their saved inputs.
  const [showConceptualOverlays, setShowConceptualOverlays] = useState(!simple);
  // The 3D terrain view opens as terrain-only. A conceptual building mass is opt-in.
  const [showTerrainMassing, setShowTerrainMassing] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("map");
  const [designPanel, setDesignPanel] = useState<"summary" | "massing" | "adjust">("summary");
  const extraToolsRef = useRef<HTMLDetailsElement | null>(null);
  const openFocusedStage = (stage: Stage) => {
    setActiveStage(stage);
    if (!simple) return;
    if (stage === "design") setDesignPanel("summary");
    // The large viewport is shared by all steps. Do not leave a stale
    // coordinates/3D view visible when the user moves to parcel, zoning or
    // placement work; those steps need the parcel map as their visual context.
    setViewMode(stage === "terrain" ? "terrain" : "map");
    setShowSources(false);
    setShowLayers(false);
    setShowResults(false);
  };
  const [parcel, setParcel] = useState<GeoPoint[]>([]);
  const [parcelSource, setParcelSource] = useState<ParcelSourceState>({
    kind: "coordinate",
    authority: "Kullanıcı",
    label: "Başlangıç konumu / kullanıcı beyanı",
    capturedAt: new Date(0).toISOString(),
    url: "",
  });
  const [officialBoundaryEvidence, setOfficialBoundaryEvidence] = useState<OfficialBoundaryEvidence | null>(null);
  const [drawEnabled, setDrawEnabled] = useState(!simple);
  const [latitude, setLatitude] = useState(defaultCenter.lat.toFixed(7));
  const [longitude, setLongitude] = useState(defaultCenter.lng.toFixed(7));
  const [province, setProvince] = useState("");
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
  const [parcelHydrated, setParcelHydrated] = useState(false);
  const [listingIdentitySource, setListingIdentitySource] = useState<LandParcelIdentity | null>(null);
  const candidatePrefillApplied = useRef("");
  const research = readLandResearch(object(project.modules["decision-assistant"]).landResearch);
  const selectedCandidate = research?.shortlist.find(c => c.id === research.selectedId);
  const selectedCandidateId = selectedCandidate?.id ?? "";
  const listingIdentity = selectedCandidate && research && !assessLandCandidate(selectedCandidate, research.criteria).mismatch.length ? selectedCandidate.parcelIdentity : null;
  const listingZoning = selectedCandidate && research && !assessLandCandidate(selectedCandidate, research.criteria).mismatch.length ? selectedCandidate.zoningDeclaration : null;
  const listingZoningApplied = useRef("");
  const currentListingZoning = useRef(listingZoning); currentListingZoning.current = listingZoning;
  const [block, setBlock] = useState("");
  const [parcelNo, setParcelNo] = useState("");
  const [fileNotice, setFileNotice] = useState("Proje başlangıç konumu yükleniyor. Mahalle/köy, ada ve parsel seçimini tamamlayın.");
  const [buildingWidth, setBuildingWidth] = useState(24);
  const [buildingDepth, setBuildingDepth] = useState(38);
  const [floors, setFloors] = useState(2);
  const [rotation, setRotation] = useState(15);
  const [offsetEast, setOffsetEast] = useState(0);
  const [offsetNorth, setOffsetNorth] = useState(0);
  const [system, setSystem] = useState("Karar Bekleniyor");
  const [usage, setUsage] = useState("Sanayi / Depo");
  const [slope, setSlope] = useState(4);
  const [exaggeration, setExaggeration] = useState(1.5);
  const [terrainLayers, setTerrainLayers] = useState<TerrainLayerVisibility>(() => ({
    ...DEFAULT_TERRAIN_LAYERS,
    basemap: true,
    "building-mass": false,
  }));
  const [requiredSetback, setRequiredSetback] = useState(-1);
  const [maxCoverage, setMaxCoverage] = useState(-1);
  const [maxFar, setMaxFar] = useState(-1);
  const [maxHeight, setMaxHeight] = useState(-1);
  const [floorHeight, setFloorHeight] = useState(4.5);
  const [parkingPer100, setParkingPer100] = useState(1);
  const [draftBuildingInputs, setDraftBuildingInputs] = useState(() => ({
    width: String(buildingWidth),
    depth: String(buildingDepth),
    floors: String(floors),
    floorHeight: String(floorHeight),
    parking: String(parkingPer100),
  }));
  const [sourceCrs, setSourceCrs] = useState("EPSG:4326 / WGS84");
  const [dataStatus, setDataStatus] = useState("Kavramsal / doğrulanmamış");
  const [parcelLookup, setParcelLookup] = useState<"idle" | "loading" | "found" | "error">("idle");
  const [zoning, setZoning] = useState<ZoningForm>(DEFAULT_ZONING);
  const [officialZoningResult, setOfficialZoningResult] = useState<OfficialZoningResult | null>(null);
  const [officialZoningNotice, setOfficialZoningNotice] = useState("");
  const [officialZoningLoading, setOfficialZoningLoading] = useState(false);
  const [officialZoningRefresh, setOfficialZoningRefresh] = useState(0);
  const officialZoningAttempt = useRef("");
  const currentZoning = useRef(zoning); currentZoning.current = zoning;
  const currentOfficialZoning = useRef(officialZoningResult); currentOfficialZoning.current = officialZoningResult;

  useEffect(() => {
    setDraftBuildingInputs({
      width: String(buildingWidth),
      depth: String(buildingDepth),
      floors: String(floors),
      floorHeight: String(floorHeight),
      parking: String(parkingPer100),
    });
  }, [buildingWidth, buildingDepth, floors, floorHeight, parkingPer100]);

  const commitDraftBuildingInput = (field: keyof typeof draftBuildingInputs) => {
    const parsed = Number(draftBuildingInputs[field].replace(",", "."));
    if (!Number.isFinite(parsed) || draftBuildingInputs[field].trim() === "") {
      setDraftBuildingInputs({
        width: String(buildingWidth),
        depth: String(buildingDepth),
        floors: String(floors),
        floorHeight: String(floorHeight),
        parking: String(parkingPer100),
      });
      return;
    }
    if (field === "width") {
      setSelectedMassingId("manual");
      setBuildingWidth(normalizeMassingDimension(Math.max(6, Math.min(70, parsed))));
    } else if (field === "depth") {
      setSelectedMassingId("manual");
      setBuildingDepth(normalizeMassingDimension(Math.max(8, Math.min(100, parsed))));
    } else if (field === "floors") {
      setSelectedMassingId("manual");
      setFloors(Math.max(1, Math.min(20, Math.round(parsed))));
    } else if (field === "floorHeight") {
      setSelectedMassingId("manual");
      setFloorHeight(Math.max(2.6, Math.min(12, parsed)));
    } else {
      setParkingPer100(Math.max(0, Math.min(10, parsed)));
    }
  };

  const zoningNumericReady = [
    zoning.taks,
    zoning.kaks,
    zoning.hmax,
    zoning.frontSetback,
    zoning.sideSetback,
    zoning.rearSetback,
  ].every((value) => Number.isFinite(value) && value >= 0);
  const zoningFormReady = zoningNumericReady && Boolean(zoning.planScale && zoning.buildingOrder);
  const normalizedZoningSourceUrl = normalizeZoningSourceUrl(zoning.sourceUrl);
  const zoningSourceReferenceReady = Boolean(
    zoning.sourceDocument
    || normalizedZoningSourceUrl
    || zoning.planId
    || (zoning.sourceType === "Kullanıcı beyanı" && zoning.sourceNote.trim()),
  );
  const zoningSourceReady = Boolean(
    zoning.sourceType
    && zoning.sourceDate
    && zoningSourceReferenceReady,
  );
  const zoningExpertReviewComplete = Boolean(
    zoning.expertReviewStatus === "reviewed-consistent"
    && zoning.expertReviewer.trim()
    && zoning.expertReviewerRole.trim()
    && zoning.expertReviewDate
    && zoning.expertReviewBasis.trim(),
  );
  const manualBuildingHeight = floors * floorHeight;
  const manualHeightExceedsZoning = zoningFormReady && manualBuildingHeight > zoning.hmax + 0.001;
  const [frontEdge, setFrontEdge] = useState<ParcelFrontEdge>("north");
  const [selectedMassingId, setSelectedMassingId] = useState("manual");
  const [massingPreviewId, setMassingPreviewId] = useState("balanced");
  const parcelRecord = useMemo<ParcelRecord>(() => createParcelRecord({
    identity: { province, district, neighborhood, block, parcelNo },
    geometry: parcel,
    source: parcelSource,
  }), [block, district, neighborhood, parcel, parcelNo, parcelSource, province]);
  const parcelIdentityComplete = Boolean(
    province.trim()
    && district.trim()
    && neighborhood.trim()
    && block.trim()
    && parcelNo.trim(),
  );
  const visibleProvinceOptions = useMemo(
    () => keepSelectedAdministrativeOption(provinceOptions, provinceId, province),
    [province, provinceId, provinceOptions],
  );
  const visibleDistrictOptions = useMemo(
    () => keepSelectedAdministrativeOption(districtOptions, districtId, district),
    [district, districtId, districtOptions],
  );
  const visibleNeighborhoodOptions = useMemo(
    () => keepSelectedAdministrativeOption(neighborhoodOptions, neighborhoodId, neighborhood),
    [neighborhood, neighborhoodId, neighborhoodOptions],
  );

  const officialBoundaryLocked = parcelSource.kind === "tkgm-open-service" && parcel.length >= 3;
  const terrainViewerLayers = useMemo<TerrainLayerVisibility>(() => ({
    ...terrainLayers,
    "building-mass": showTerrainMassing,
  }), [showTerrainMassing, terrainLayers]);

  useEffect(() => {
    if (!hydrated || transferApplied.current) return;
    const timer = window.setTimeout(() => {
      const currentSaved = project.modules["geo-parcel"] as GeoParcelSavedState | undefined;
      let saved = currentSaved;
      let recoverySource: "project" | "draft" | "backup" = "project";

      if (!saved) {
        try {
          const rawDraft = window.localStorage.getItem(geoDraftKey(project.id));
          const draft = rawDraft ? JSON.parse(rawDraft) as GeoDraftEnvelope : null;
          if (draft?.projectId === project.id && draft.payload) {
            saved = draft.payload;
            recoverySource = "draft";
          }
        } catch {
          // A damaged local draft must never block normal project hydration.
        }
      }

      if (!saved) {
        try {
          const backup = decodeProjectEnvelope<{ id?: string; modules?: Record<string, unknown> }>(
            window.localStorage.getItem(PROJECT_BACKUP_KEY),
          );
          const backupGeo = backup.value?.id === project.id
            ? backup.value.modules?.["geo-parcel"] as GeoParcelSavedState | undefined
            : undefined;
          if (backupGeo) {
            saved = backupGeo;
            recoverySource = "backup";
          }
        } catch {
          // Backup recovery is best-effort; the active project remains authoritative.
        }
      }

      const decision = project.modules["decision-assistant"] as {
        input?: { location?: string };
      } | undefined;
      const declaredLocation = String(decision?.input?.location ?? saved?.reference ?? "").trim();
      const declared = parseDeclaredLocation(declaredLocation);

      if (!saved) {
        // hydrated=true means ProjectKernel storage hydration is complete.
        // An empty module map is a valid clean project, so persistence must be
        // enabled before the first parcel edit or spatial-file import.
        transferApplied.current = true;
      setParcelHydrated(true);
        persistedGeoRef.current = false;
        setProvince(declared.province);
        setDistrict(declared.district);
        setProvinceId("");
        setDistrictId("");
        setNeighborhood("");
        setNeighborhoodId("");
        setBlock("");
        setParcelNo("");
        setFileNotice(declared.province
          ? `${declared.province}${declared.district ? ` / ${declared.district}` : ""} proje başlangıcından aktarıldı. Mahalle/köy, ada ve parsel seçimini tamamlayın.`
          : "Proje başlangıç konumu aktarıldı. İl, ilçe, mahalle/köy, ada ve parsel seçimini tamamlayın.");
        return;
      }

      transferApplied.current = true;
      setParcelHydrated(true);
      persistedGeoRef.current = true;
      if (recoverySource !== "project") {
        patchModule("geo-parcel", saved);
      }

      const hasSavedBoundary = Boolean(saved.parcel && saved.parcel.length >= 3);
      const savedPreviewParcel = saved.previewParcel ?? [];
      const hasSavedPreviewBoundary = savedPreviewParcel.length >= 3;
      const restoredOfficialEvidence = saved.officialBoundaryEvidence ?? (
        hasSavedBoundary && saved.parcelRecord?.evidence.sourceKind === "tkgm-open-service"
          ? {
            geometry: (saved.parcel ?? []).map((point) => ({ ...point })),
            source: {
              kind: "tkgm-open-service" as ParcelSourceKind,
              authority: saved.parcelRecord.evidence.authority,
              label: saved.parcelRecord.evidence.label,
              capturedAt: saved.parcelRecord.evidence.capturedAt,
              url: saved.parcelRecord.evidence.url ?? "",
              reportedArea: saved.parcelRecord.geometry.reportedArea ?? undefined,
            },
            identity: {
              province: saved.province ?? "",
              district: saved.district ?? "",
              neighborhood: saved.neighborhood ?? "",
              block: saved.block ?? "",
              parcelNo: saved.parcelNo ?? "",
            },
            capturedAt: saved.parcelRecord.evidence.capturedAt,
          }
          : null
      );
      setOfficialBoundaryEvidence(restoredOfficialEvidence);

      if (saved.parcelRecord?.schema === "ARKEM-PARCEL-RECORD/1.0") {
        setParcelSource({
          kind: saved.parcelRecord.evidence.sourceKind,
          authority: saved.parcelRecord.evidence.authority,
          label: saved.parcelRecord.evidence.label,
          capturedAt: saved.parcelRecord.evidence.capturedAt,
          url: saved.parcelRecord.evidence.url ?? "",
          reportedArea: saved.parcelRecord.geometry.reportedArea ?? undefined,
        });
      } else if (hasSavedBoundary || hasSavedPreviewBoundary) {
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
      } else {
        setParcelSource({
          kind: "coordinate",
          authority: "Kullanıcı",
          label: "Başlangıç konumu / kullanıcı beyanı",
          capturedAt: saved._kernel?.recordedAt ?? new Date(0).toISOString(),
          url: "",
        });
        setDataStatus("Kullanıcı beyanı · resmî parsel doğrulaması bekleniyor");
      }

      // Identity fields are user work too; restore them even before an official
      // parcel boundary has been found. Previously they were erased unless a
      // project-eligible polygon already existed.
      setProvince(saved.province || declared.province);
      setDistrict(saved.district || declared.district);
      setProvinceId(saved.provinceId ?? "");
      setDistrictId(saved.districtId ?? "");
      setNeighborhood(saved.neighborhood ?? "");
      setNeighborhoodId(saved.neighborhoodId ?? "");
      setListingIdentitySource(saved.listingIdentitySource ?? null);
      setBlock(saved.block ?? "");
      setParcelNo(saved.parcelNo ?? "");
      setParcelLookup(hasSavedBoundary || hasSavedPreviewBoundary ? "found" : "idle");

      const restoredParcel = hasSavedBoundary
        ? (saved.parcel ?? [])
        : hasSavedPreviewBoundary
          ? savedPreviewParcel
          : [];
      setParcel(restoredParcel);
      if (restoredParcel.length) {
        const savedCenter = geoCentroid(restoredParcel);
        setLatitude(savedCenter.lat.toFixed(7));
        setLongitude(savedCenter.lng.toFixed(7));
        pendingCenterRef.current = savedCenter;
      } else {
        const savedCenter = saved.center && validPoint(Number(saved.center.lat), Number(saved.center.lng));
        if (savedCenter) {
          setLatitude(savedCenter.lat.toFixed(7));
          setLongitude(savedCenter.lng.toFixed(7));
          pendingCenterRef.current = savedCenter;
          mapRef.current?.setView([savedCenter.lat, savedCenter.lng], 16);
        }
      }

      if (typeof saved.buildingWidth === "number") setBuildingWidth(normalizeMassingDimension(saved.buildingWidth));
      if (typeof saved.buildingDepth === "number") setBuildingDepth(normalizeMassingDimension(saved.buildingDepth));
      if (typeof saved.rotation === "number") setRotation(normalizeSignedRotation(saved.rotation));
      if (typeof saved.offsetEast === "number") setOffsetEast(saved.offsetEast);
      if (typeof saved.offsetNorth === "number") setOffsetNorth(saved.offsetNorth);
      if (saved.usage) setUsage(saved.usage);
      if (!simple && saved.system) setSystem(saved.system);
      else if (simple) setSystem("Karar Bekleniyor");
      if (typeof saved.floors === "number") setFloors(saved.floors);
      if (typeof saved.floorHeight === "number") setFloorHeight(saved.floorHeight);
      if (saved.sourceCrs) setSourceCrs(saved.sourceCrs);
      if (saved.dataStatus) setDataStatus(saved.dataStatus);
      if (typeof saved.planning?.parkingPer100 === "number") setParkingPer100(saved.planning.parkingPer100);
      setOfficialZoningResult(saved.officialZoningResult ?? null);
      if (saved.zoning) {
        const looksLikeLegacyPlaceholder =
          (!saved.zoning.verification || saved.zoning.verification === "user-declared")
          && !saved.zoning.sourceDocument
          && !saved.zoning.sourceUrl
          && !saved.zoning.sourceType
          && !saved.zoning.sourceDate
          && !saved.zoning.sourceNote
          && !saved.zoning.planId
          && !saved.zoning.planNoteReference
          && (!saved.zoning.landUse || saved.zoning.landUse === "Kullanıcı girişi bekleniyor")
          && saved.zoning.planScale === "1/1000 Uygulama İmar Planı"
          && saved.zoning.buildingOrder === "Plan notuna göre"
          && saved.zoning.taks === 0.4
          && saved.zoning.kaks === 1.2
          && saved.zoning.hmax === 15.5
          && saved.zoning.frontSetback === 5
          && saved.zoning.sideSetback === 3
          && saved.zoning.rearSetback === 3;

        const restoredZoning: ZoningForm = looksLikeLegacyPlaceholder
          ? { ...DEFAULT_ZONING }
          : {
            ...DEFAULT_ZONING,
            ...saved.zoning,
            taks: typeof saved.zoning.taks === "number" ? saved.zoning.taks : -1,
            kaks: typeof saved.zoning.kaks === "number" ? saved.zoning.kaks : -1,
            hmax: typeof saved.zoning.hmax === "number" ? saved.zoning.hmax : -1,
            frontSetback: typeof saved.zoning.frontSetback === "number" ? saved.zoning.frontSetback : -1,
            sideSetback: typeof saved.zoning.sideSetback === "number" ? saved.zoning.sideSetback : -1,
            rearSetback: typeof saved.zoning.rearSetback === "number" ? saved.zoning.rearSetback : -1,
            sourceUrl: normalizeZoningSourceUrl(saved.zoning.sourceUrl),
            verification: normalizeUntrustedZoningVerification(saved.zoning?.verification, Boolean(saved.zoning?.sourceDocument)),
          };
        setZoning(restoredZoning);
        setMaxCoverage(restoredZoning.taks >= 0 ? restoredZoning.taks * 100 : -1);
        setMaxFar(restoredZoning.kaks >= 0 ? restoredZoning.kaks : -1);
        setMaxHeight(restoredZoning.hmax >= 0 ? restoredZoning.hmax : -1);
        const setbacks = [restoredZoning.frontSetback, restoredZoning.sideSetback, restoredZoning.rearSetback];
        setRequiredSetback(setbacks.every((value) => value >= 0) ? Math.max(...setbacks) : -1);
        if (looksLikeLegacyPlaceholder) {
          setFileNotice("Eski örnek imar değerleri temizlendi. TAKS, KAKS, Hmax, çekme mesafeleri ve plan bilgilerini kaynağıyla birlikte girin.");
        }
      } else {
        setZoning({ ...DEFAULT_ZONING });
        setRequiredSetback(-1);
        setMaxCoverage(-1);
        setMaxFar(-1);
        setMaxHeight(-1);
      }
      if (typeof saved.terrain?.slope === "number") setSlope(saved.terrain.slope);
      if (typeof saved.terrain?.exaggeration === "number") setExaggeration(saved.terrain.exaggeration);
      if (saved.terrain?.layers) setTerrainLayers({
        ...normalizeTerrainLayers(saved.terrain.layers),
        basemap: true,
        "parcel-boundary": restoredParcel.length >= 3 ? true : normalizeTerrainLayers(saved.terrain.layers)["parcel-boundary"],
        "building-mass": false,
      });
      else if (restoredParcel.length >= 3) {
        setTerrainLayers((current) => ({ ...current, "parcel-boundary": true, "building-mass": false }));
      }
      if (saved.frontEdge && ["north", "east", "south", "west"].includes(saved.frontEdge)) setFrontEdge(saved.frontEdge);
      if (saved.selectedMassingId) setSelectedMassingId(saved.selectedMassingId);
      setFileNotice(recoverySource !== "project"
        ? "Önceki yerel çalışma yedeği kurtarıldı; parsel ve tasarım girdileri yeniden yüklendi."
        : hasSavedBoundary
          ? "Kayıtlı parsel, yapı yerleşimi ve planlama verileri otomatik açıldı."
          : saved.neighborhood || saved.block || saved.parcelNo
            ? "Kayıtlı parsel seçimleri ve tasarım girdileri otomatik açıldı; sınır doğrulaması bekleniyor."
            : declared.province
              ? `${declared.province}${declared.district ? ` / ${declared.district}` : ""} proje başlangıcından aktarıldı. Mahalle/köy, ada ve parsel seçimini tamamlayın.`
              : "Proje başlangıç konumu aktarıldı. İl, ilçe, mahalle/köy, ada ve parsel seçimini tamamlayın.");
    }, 0);
    return () => window.clearTimeout(timer);
  }, [hydrated, patchModule, project.id, project.modules]);

  useEffect(() => {
    if (!parcelHydrated || !selectedCandidateId || !listingIdentitySource || listingIdentitySource.sourceUrl === selectedCandidateId) return;

    // A newly selected research candidate must never inherit identity fields
    // that were auto-filled from the previous listing. Preserve user/official
    // work, but clear only values that still match the previous listing source.
    if (parcel.length || officialBoundaryEvidence) {
      candidatePrefillApplied.current = "";
      listingZoningApplied.current = "";
      setFileNotice("Yeni ilan adayı seçildi. Mevcut doğrulanmış/sınırlandırılmış parsel çalışması otomatik değiştirilmedi; yeni adayı ayrı incelemek için mevcut parsel kaydını bilinçli olarak sıfırlayın.");
      return;
    }

    const previous = listingIdentitySource;
    const equal = (left: string, right: string) =>
      normalizeAdministrativeName(left) === normalizeAdministrativeName(right);

    setNeighborhood((current) => current && previous.neighborhood && equal(current, previous.neighborhood) ? "" : current);
    setNeighborhoodId("");
    setBlock((current) => current && previous.block && current === previous.block ? "" : current);
    setParcelNo((current) => current && previous.parcelNo && current === previous.parcelNo ? "" : current);
    setListingIdentitySource(null);
    setParcelLookup("idle");
    setOfficialZoningResult(null);
    setOfficialZoningNotice("");
    officialZoningAttempt.current = "";
    candidatePrefillApplied.current = "";
    listingZoningApplied.current = "";

    if (currentZoning.current.sourceType === "İlan beyanı" && currentZoning.current.sourceUrl === previous.sourceUrl) {
      setZoning({ ...DEFAULT_ZONING });
      setRequiredSetback(-1);
      setMaxCoverage(-1);
      setMaxFar(-1);
      setMaxHeight(-1);
    }
    setFileNotice("Yeni ilan adayı seçildi. Önceki ilandan otomatik taşınan mahalle/köy, ada, parsel ve ilan-imar beyanları temizlendi; yeni adayın detayları okunuyor.");
  }, [parcelHydrated, selectedCandidateId, listingIdentitySource, parcel.length, officialBoundaryEvidence]);

  useEffect(() => {
    if (!parcelHydrated || !listingIdentity) return;
    const key = `${listingIdentity.sourceUrl}:${listingIdentity.retrievedAt}`;
    if (candidatePrefillApplied.current === key) return;
    const prefill = landParcelPrefill({ province, district, neighborhood, block, parcelNo, parcel }, listingIdentity);
    if (!prefill) return;
    const timer = window.setTimeout(() => {
      candidatePrefillApplied.current = key;
      setProvince(prefill.province); setDistrict(prefill.district);
      setNeighborhood(prefill.neighborhood);
      if (!neighborhoodId && administrativeSource === "fallback") setNeighborhoodId("offline-neighborhood-manual");
      setBlock(prefill.block); setParcelNo(prefill.parcelNo);
      setListingIdentitySource(listingIdentity);
      setFileNotice(listingIdentity.block && listingIdentity.parcelNo ? "Mahalle/köy, ada ve parsel ilandan otomatik dolduruldu. TKGM sorgusuyla parsel sınırını doğrulayın." : "İlanda bulunan mahalle/köy bilgisi otomatik dolduruldu. İlanda belirtilmeyen ada/parsel numaraları boş bırakıldı.");
    }, 0);
    return () => window.clearTimeout(timer);
  }, [administrativeSource, neighborhoodId, parcelHydrated, listingIdentity?.sourceUrl, listingIdentity?.retrievedAt, province, district, neighborhood, block, parcelNo, parcel]);

  useEffect(() => {
    if (!parcelHydrated || !listingZoning) return;
    const key = `${listingZoning.sourceUrl}:${listingZoning.retrievedAt}`;
    if (listingZoningApplied.current === key) return;
    if ((province && normalizeAdministrativeName(province) !== normalizeAdministrativeName(listingZoning.province))
      || (district && normalizeAdministrativeName(district) !== normalizeAdministrativeName(listingZoning.district))
      || (neighborhood && normalizeAdministrativeName(neighborhood) !== normalizeAdministrativeName(listingZoning.neighborhood))) return;
    if ((block || parcelNo || parcel.length) && (!listingIdentity || (block && block !== listingIdentity.block) || (parcelNo && parcelNo !== listingIdentity.parcelNo))) return;
    const next = listingZoningPrefill(zoning, listingZoning);
    if (!next) return;
    const timer = window.setTimeout(() => {
      listingZoningApplied.current = key;
      setZoning(next);
      setMaxCoverage(next.taks >= 0 ? next.taks * 100 : -1);
      setMaxFar(next.kaks); setMaxHeight(next.hmax);
      setFileNotice("İlanda açıkça belirtilen imar değerleri otomatik dolduruldu. Kaynak ilan beyanıdır; resmî plan ve uzman doğrulaması bekleniyor.");
    }, 0);
    return () => window.clearTimeout(timer);
  }, [parcelHydrated, listingZoning?.sourceUrl, listingZoning?.retrievedAt, listingIdentity?.block, listingIdentity?.parcelNo, province, district, neighborhood, block, parcelNo, parcel, zoning]);

  const officialZoningEligible = parcelHydrated && administrativeSource === "official"
    && province === "Kastamonu" && /^\d+$/.test(neighborhoodId) && /^\d+$/.test(block) && /^\d+$/.test(parcelNo)
    && Boolean(district && neighborhood) && (!parcel.length || (officialBoundaryLocked && Boolean(officialBoundaryEvidence)
      && officialBoundaryEvidence?.identity.province === province && officialBoundaryEvidence.identity.district === district
      && officialBoundaryEvidence.identity.neighborhood === neighborhood && officialBoundaryEvidence.identity.block === block
      && officialBoundaryEvidence.identity.parcelNo === parcelNo));
  useEffect(() => {
    if (!officialZoningEligible) return;
    const input = {province,district,neighborhood,neighborhoodId,block,parcelNo};
    const identityKey = JSON.stringify(input);
    const key = `${project.id}:${identityKey}:${officialZoningRefresh}`;
    if (officialZoningAttempt.current === key) return;
    officialZoningAttempt.current = key;
    const cached = currentOfficialZoning.current;
    if (!officialZoningRefresh && cached && JSON.stringify(cached.identity) === identityKey
      && Date.now() - Date.parse(cached.retrievedAt) >= 0 && Date.now() - Date.parse(cached.retrievedAt) < 86400000) {
      setOfficialZoningNotice(cached.message); return;
    }
    const controller = new AbortController(); let completed = false;
    setOfficialZoningLoading(true); setOfficialZoningNotice("Parsel için resmî imar kaynağı otomatik sorgulanıyor…");
    fetch("/api/zoning-conditions",{method:"POST",headers:{"Content-Type":"application/json"},body:identityKey,signal:controller.signal})
      .then(async response => {
        const result = await response.json() as OfficialZoningResult & {error?:string};
        if (!response.ok) throw Error(result.error || "Resmî imar bağlantısı kullanılamıyor.");
        if (result.schema !== "ARKEM-OFFICIAL-ZONING/1.0" || JSON.stringify(result.identity) !== identityKey
          || !["found","not-found","ambiguous","unsupported"].includes(result.status)) throw Error("İmar yanıtının parsel kimliği doğrulanamadı.");
        if (controller.signal.aborted) return;
        setOfficialZoningResult(result);
        const next = officialZoningPrefill(currentZoning.current,result,currentListingZoning.current);
        if (next) {setZoning(next);setMaxCoverage(next.taks >= 0 ? next.taks * 100 : -1);setMaxFar(next.kaks);setMaxHeight(next.hmax);}
        setOfficialZoningNotice(result.message + (result.status === "found" && !next ? " Mevcut imar çalışması korundu; kaynak değerleri aşağıda gösteriliyor." : ""));
      }).catch(error => {if (!controller.signal.aborted) setOfficialZoningNotice(error instanceof Error ? error.message : "İmar sorgusu tamamlanamadı.");})
      .finally(() => {completed = true;if (!controller.signal.aborted) setOfficialZoningLoading(false);});
    return () => {controller.abort();if (!completed) officialZoningAttempt.current = "";};
  }, [officialZoningEligible, project.id, province, district, neighborhood, neighborhoodId, block, parcelNo, officialZoningRefresh]);

  useEffect(() => {
    if (!provinceOptions.length || !province) return;
    const current = provinceOptions.find((option) => option.id === provinceId);
    if (current && normalizeAdministrativeName(current.label) === normalizeAdministrativeName(province)) return;
    const match = provinceOptions.find((option) => normalizeAdministrativeName(option.label) === normalizeAdministrativeName(province));
    if (!match) return;
    const timer = window.setTimeout(() => {
      setProvinceId(match.id);
      setAdministrativeLoading("district");
    }, 0);
    return () => window.clearTimeout(timer);
  }, [province, provinceId, provinceOptions]);

  useEffect(() => {
    if (!districtOptions.length || !district) return;
    const current = districtOptions.find((option) => option.id === districtId);
    if (current && normalizeAdministrativeName(current.label) === normalizeAdministrativeName(district)) return;
    const match = districtOptions.find((option) => normalizeAdministrativeName(option.label) === normalizeAdministrativeName(district));
    if (!match) return;
    const timer = window.setTimeout(() => {
      setDistrictId(match.id);
      setAdministrativeLoading("neighborhood");
    }, 0);
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
    officialBoundaryLockedRef.current = officialBoundaryLocked;
    if (!officialBoundaryLocked || !drawEnabled) return;
    const timer = window.setTimeout(() => setDrawEnabled(false), 0);
    return () => window.clearTimeout(timer);
  }, [drawEnabled, officialBoundaryLocked]);

  useEffect(() => {
    let cancelled = false;
    fetchTkgmJson("idariYapi/ilListe").then((data) => {
      if (cancelled) return;
      const options = administrativeOptions(data);
      if (!options.length) throw new Error("TKGM il listesi boş döndü");
      setProvinceOptions(options);
      setAdministrativeSource("official");
      setAdministrativeLoading("idle");
    }).catch((error: unknown) => {
      if (cancelled) return;
      setProvinceOptions(FALLBACK_PROVINCES);
      setAdministrativeSource("fallback");
      setAdministrativeLoading("idle");
      setFileNotice(`${error instanceof Error ? error.message : "TKGM il listesi yüklenemedi"}. Projedeki konum korunur; yerel il/ilçe seçimi yapılabilir. Resmî parsel verisi yalnızca erişilebilir TKGM yanıtı veya kullanıcı dosyasıyla gösterilir.`);
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
    if (!neighborhood.includes("mahalle-köy bilgisini proje notunda belirtin")) return;
    const timer = window.setTimeout(() => {
      setNeighborhood("");
      setNeighborhoodId("");
    }, 0);
    return () => window.clearTimeout(timer);
  }, [administrativeSource, neighborhood]);

  useEffect(() => {
    if (!hydrated || projectLocationAppliedRef.current) return;
    const saved = project.modules["geo-parcel"] as {
      parcel?: GeoPoint[];
      previewParcel?: GeoPoint[];
      reference?: string;
      neighborhood?: string;
      block?: string;
      parcelNo?: string;
    } | undefined;

    // A declared project location is only a map-centering hint. It must never
    // overwrite a parcel identity that the user has already selected or typed.
    const hasExplicitParcelIdentity = Boolean(
      saved?.parcel?.length
      || saved?.previewParcel?.length
      || saved?.neighborhood
      || saved?.block
      || saved?.parcelNo
      || neighborhood
      || block
      || parcelNo,
    );
    if (hasExplicitParcelIdentity) {
      projectLocationAppliedRef.current = true;
      return;
    }

    const decision = project.modules["decision-assistant"] as { input?: { location?: string } } | undefined;
    const declaredLocation = String(decision?.input?.location ?? saved?.reference ?? "").trim();
    if (!declaredLocation) {
      projectLocationAppliedRef.current = true;
      return;
    }

    projectLocationAppliedRef.current = true;
    let cancelled = false;
    void fetchGeocode({ q: declaredLocation }).then((result) => {
      if (cancelled) return;
      const point = validPoint(Number(result.lat), Number(result.lng));
      if (point) {
        pendingCenterRef.current = point;
        setLatitude(point.lat.toFixed(7));
        setLongitude(point.lng.toFixed(7));
        mapRef.current?.setView([point.lat, point.lng], 12);
      }

      // Only fill missing coarse location labels. Never clear neighborhood,
      // block or parcel fields as a side effect of geocoding.
      if (result.province && !province) setProvince(result.province);
      if (result.district && !district) setDistrict(result.district);
      setFileNotice(`${result.province || province || "Proje konumu"}${result.district ? ` / ${result.district}` : ""} haritada açıldı. Mevcut parsel seçimleri korunur.`);
    }).catch(() => {
      // The declared administrative labels remain useful even if map geocoding is unavailable.
    });

    return () => { cancelled = true; };
  }, [block, district, hydrated, neighborhood, parcelNo, project.modules, province]);

  const coordinateCenter = useMemo(
    () => validPoint(Number(latitude.replace(",", ".")), Number(longitude.replace(",", "."))) ?? defaultCenter,
    [latitude, longitude],
  );
  const center = useMemo(() => geoCentroid(parcel.length ? parcel : [coordinateCenter]), [coordinateCenter, parcel]);
  const building = useMemo(() => buildingFootprint(center, buildingWidth, buildingDepth, rotation, offsetEast, offsetNorth), [center, buildingWidth, buildingDepth, rotation, offsetEast, offsetNorth]);
  const metrics = useMemo(() => {
    const area = polygonArea(parcel);
    const perimeter = polygonPerimeter(parcel);
    const bounds = localBounds(parcel);
    // Manual rectangular massing uses the displayed 0.1 m dimensions as the
    // canonical calculation basis. The map polygon is a geometric validation,
    // not a second source for TAKS/KAKS area.
    const canonicalWidth = normalizeMassingDimension(buildingWidth);
    const canonicalDepth = normalizeMassingDimension(buildingDepth);
    const footprint = canonicalWidth * canonicalDepth;
    const gross = footprint * floors;
    const altitudes = parcel.map((point) => point.alt).filter((value): value is number => Number.isFinite(value));
    const setbackAssessment = assessParcelEdgeSetbacks({
      parcel,
      building,
      frontEdge,
      front: zoning.frontSetback,
      side: zoning.sideSetback,
      rear: zoning.rearSetback,
    });
    const buildingFits = setbackAssessment.buildingFits;
    const boundaryDistance = setbackAssessment.minimumDistance;
    const coverage = area ? (footprint / area) * 100 : 0;
    const far = area ? gross / area : 0;
    const buildingHeight = floors * floorHeight;
    const allowedFootprint = zoningFormReady ? area * maxCoverage / 100 : 0;
    const allowedGross = zoningFormReady ? area * maxFar : 0;
    const parkingDemand = gross / 100 * parkingPer100;
    const parkingNeed = Math.ceil(parkingDemand);
    const rainwaterReview = area > 2_000 || footprint > 1_000;
    const geometryValid = parcel.length >= 3 && !polygonSelfIntersects(parcel) && area > 1;
    const setbackPass = zoningFormReady && setbackAssessment.pass;
    return { area, perimeter, width: bounds.width, depth: bounds.depth, footprint, gross, coverage, far, buildingHeight, allowedFootprint, allowedGross, parkingDemand, parkingNeed, rainwaterReview, geometryValid, buildingFits, setbackPass, boundaryDistance, setbackAssessment, minAlt: altitudes.length ? Math.min(...altitudes) : null, maxAlt: altitudes.length ? Math.max(...altitudes) : null };
  }, [parcel, building, buildingWidth, buildingDepth, floors, floorHeight, maxCoverage, maxFar, parkingPer100, zoningFormReady, frontEdge, zoning.frontSetback, zoning.sideSetback, zoning.rearSetback]);
  // Compare the same canonical areas shown to the user. This makes the
  // threshold exact at the displayed dimension step instead of depending on
  // ratio rounding/tolerances.
  const taksExceeded = zoningFormReady && metrics.footprint > metrics.allowedFootprint + .01;
  const kaksExceeded = zoningFormReady && metrics.gross > metrics.allowedGross + .01;
  const hmaxExceeded = zoningFormReady && metrics.buildingHeight > maxHeight + .01;
  const zoningPrecheckPass = zoningFormReady && !taksExceeded && !kaksExceeded && !hmaxExceeded;
  const placementPrecheckWarning = zoningFormReady && (!metrics.setbackPass || !zoningPrecheckPass);
  const setbackDecision = useMemo(() => {
    const distanceFor = (role: "front" | "side" | "rear") => {
      const distances = metrics.setbackAssessment.edges
        .filter((edge) => edge.role === role)
        .map((edge) => edge.distance);
      return distances.length ? Math.min(...distances) : null;
    };
    return {
      front: distanceFor("front"),
      side: distanceFor("side"),
      rear: distanceFor("rear"),
    };
  }, [metrics.setbackAssessment.edges]);
  const placementDecisionPass = zoningPrecheckPass && metrics.setbackPass;
  const placementDecisionLabel = placementDecisionPass
    ? (zoningSourceReady
      ? "Parametrik ön kontrolde açık ihlal bulunmadı · kaynak uzman doğrulaması bekliyor."
      : "Parametrik ön kontrolde açık ihlal bulunmadı · imar kaynağı eksik.")
    : "Parametrik ön kontrolde inceleme gerekli · bir veya daha fazla sınır aşılıyor.";
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
  const previewMassingAlternative = useMemo(
    () => massingModel.alternatives.find((item) => item.id === massingPreviewId)
      ?? massingModel.alternatives.find((item) => item.id === massingModel.recommendedAlternativeId)
      ?? massingModel.alternatives[0],
    [massingModel.alternatives, massingModel.recommendedAlternativeId, massingPreviewId],
  );
  const exportReview = assessExportReview({
    geometryValid: metrics.geometryValid,
    buildingFits: metrics.buildingFits,
    setbackPass: metrics.setbackPass,
    coverage: metrics.coverage,
    maxCoverage,
    far: metrics.far,
    maxFar,
    buildingHeight: metrics.buildingHeight,
    maxHeight,
    zoningAuthoritative: createZoningProvenance(zoning, reference).authoritative,
    officialCadastre: parcelRecord.evidence.officialCadastre,
    licensedSurvey: dataStatus === "Onaylı aplikasyon verisi" || dataStatus === "Harita mühendisi ölçümü",
    measuredTerrain: terrainModel.basis === "measured-z",
  });
  const exportReviewMessage = exportReview.status === "review-required"
    ? `İNCELEME GEREKLİ – ${exportReview.reasons.join(" ")}`
    : "Ön kontroller geçti; resmî teslim için yetkili meslek mensubu onayı gerekir.";
  const exportDisabled = !parcelRecord.projectEligible || !metrics.geometryValid;
  const toggleTerrainLayer = (layer: TerrainLayerId) => { if (layer === "basemap") return; setTerrainLayers((current) => ({ ...current, [layer]: !current[layer] })); };
  const applyMassingAlternative = (alternativeId: string) => {
    const alternative = massingModel.alternatives.find((item) => item.id === alternativeId);
    if (!alternative || alternative.status !== "fits") {
      setFileNotice("Bu alternatif parsel geometrisi veya imar sınırlarından en az birini sağlamıyor; uzman incelemesi gerekli.");
      return;
    }
    const width = normalizeMassingDimension(alternative.width);
    const depth = normalizeMassingDimension(alternative.depth);
    setSelectedMassingId(alternative.id);
    setBuildingWidth(width);
    setBuildingDepth(depth);
    setFloors(alternative.floors);
    setRotation(alternative.rotation);
    setOffsetEast(alternative.offsetEast);
    setOffsetNorth(alternative.offsetNorth);
    setActiveStage("design");
    setViewMode("map");
    setFileNotice(`${alternative.label} projeye uygulandı · ${(width * depth).toFixed(1)} m² taban · ${alternative.floors} kat`);
  };

  useEffect(() => {
    if (!hydrated || !transferApplied.current) return;
    if (parcelRecord.projectEligible) persistedGeoRef.current = true;
    const projectMetrics = parcelRecord.projectEligible
      ? metrics
      : { ...metrics, area: 0, geometryValid: false };
    const moduleSnapshot = {
      listingIdentitySource,
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
      buildingWidth: normalizeMassingDimension(buildingWidth),
      buildingDepth: normalizeMassingDimension(buildingDepth),
      calculationBasis: "displayed-rectangular-dimensions-0.1m",
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
      officialBoundaryEvidence,
      officialZoningResult,
      parcelSourceNetwork: sourceNetwork,
      provenance: createGeoProvenance({ reference: parcelRecord.reference, sourceCrs, dataStatus, administrativeSource, geometryValid: parcelRecord.projectEligible && metrics.geometryValid, vertexCount: parcelRecord.projectEligible ? parcel.length : 0 }),
      zoningProvenance: createZoningProvenance(zoning, parcelRecord.reference),
      status: parcelRecord.projectEligible ? "Parsel kaynağı ve sınırı aktif projeye bağlı" : parcel.length ? "Önizleme geometrisi · doğrulama bekliyor" : "Parsel seçimi bekleniyor",
    };

    // Save an independent per-project draft before the ProjectKernel write.
    // This protects in-progress selections and design inputs from reloads,
    // development hot-reloads, or a transient kernel hydration failure.
    try {
      const draft: GeoDraftEnvelope = {
        projectId: project.id,
        savedAt: new Date().toISOString(),
        payload: moduleSnapshot as GeoParcelSavedState,
      };
      window.localStorage.setItem(geoDraftKey(project.id), JSON.stringify(draft));
    } catch {
      // ProjectKernel remains the primary persistence channel if localStorage fails.
    }

    patchModule("geo-parcel", moduleSnapshot);
  }, [officialZoningResult, listingIdentitySource, activeMassingId, administrativeSource, block, building, buildingDepth, buildingWidth, center, dataStatus, district, districtId, exaggeration, floorHeight, floors, frontEdge, hydrated, massingModel, maxCoverage, maxFar, maxHeight, metrics, neighborhood, neighborhoodId, offsetEast, offsetNorth, officialBoundaryEvidence, parcel, parcelNo, parcelRecord, parkingPer100, patchModule, project.id, province, provinceId, requiredSetback, rotation, slope, sourceCrs, sourceNetwork, system, terrainContours.length, terrainLayers, terrainModel, usage, zoning]);

  useEffect(() => {
    let disposed = false;
    import("leaflet").then((leaflet) => {
      if (disposed || !mapHostRef.current || mapRef.current) return;
      leafletRef.current = leaflet;
      const initialCenter = pendingCenterRef.current ?? defaultCenter;
      const map = leaflet.map(mapHostRef.current, { zoomControl: false, attributionControl: true, preferCanvas: false }).setView(
        [initialCenter.lat, initialCenter.lng],
        pendingCenterRef.current ? 12 : 6,
      );
      // No automatic calls to third-party map tiles: the demo shows a local coordinate preview.
      // Streets and satellite imagery require a separately configured, authorized tile provider.
      leaflet.control.zoom({ position: "bottomright" }).addTo(map);
      pointsLayerRef.current = leaflet.layerGroup().addTo(map);
      contourLayerRef.current = leaflet.layerGroup().addTo(map);
      map.on("click", (event) => {
        if (officialBoundaryLockedRef.current) {
          setFileNotice("TKGM sınırı salt okunurdur. Haritada değişiklik yapmak için önce Düzenlenebilir Kopya Oluştur seçeneğini kullanın.");
          return;
        }
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
      basemapUrlRef.current = null;
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
    const streets = "https://services.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}";
    const labels = "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}";
    if (!map.getPane("arkemx-basemap-labels")) {
      const pane = map.createPane("arkemx-basemap-labels");
      pane.style.zIndex = "350";
      pane.style.pointerEvents = "none";
    }
    if (!basemapTileRef.current) {
      const tile = leaflet.tileLayer(imagery, {
        maxNativeZoom: 18, maxZoom: 20,
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
      basemapUrlRef.current = imagery;
      tile.addTo(map).bringToBack();
    }
    if (!basemapLabelsRef.current) {
      const labelLayer = leaflet.tileLayer(labels, {
        maxNativeZoom: 18, maxZoom: 20, pane: "arkemx-basemap-labels",
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
      ? "Tiles &copy; Esri, World Street Map contributors"
      : "Tiles &copy; Esri and its imagery providers";
    if (basemapUrlRef.current !== targetUrl) {
      basemapUrlRef.current = targetUrl;
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
    setbackEnvelopeLayerRef.current?.remove();
    buildingLayerRef.current?.remove();
    pointsLayerRef.current?.clearLayers();
    contourLayerRef.current?.clearLayers();
    if (terrainLayers["parcel-boundary"] && parcel.length >= 2) {
      parcelLayerRef.current = leaflet.polygon(parcel.map((point) => [point.lat, point.lng]), { color: "#b96636", weight: 3, fillColor: "#d98a5d", fillOpacity: .16, dashArray: parcel.length < 3 ? "6 6" : undefined }).addTo(map);
    }
    if (showConceptualOverlays && zoningFormReady && massingModel.envelope.polygon.length >= 3) {
      setbackEnvelopeLayerRef.current = leaflet.polygon(
        massingModel.envelope.polygon.map((point) => [point.lat, point.lng]),
        { color: "#73aeb7", weight: 2, opacity: .95, fillColor: "#73aeb7", fillOpacity: .04, dashArray: "7 6" },
      ).bindTooltip(
        `${massingModel.source.authoritative ? "Yapılaşabilir çekme zarfı" : "Kavramsal çekme zarfı · ön kontrol"}<br>Ön/yan/arka: ${zoning.frontSetback}/${zoning.sideSetback}/${zoning.rearSetback} m`,
      ).addTo(map);
    }
    if (showConceptualOverlays && (terrainLayers["parcel-boundary"] || terrainLayers["elevation-points"])) parcel.forEach((point, index) => {
      const hasElevation = Number.isFinite(point.alt);
      if (!terrainLayers["parcel-boundary"] && !(terrainLayers["elevation-points"] && hasElevation)) return;
      const readOnlyOfficialPoint = officialBoundaryLocked && !hasElevation;
      leaflet.circleMarker([point.lat, point.lng], {
        radius: readOnlyOfficialPoint ? 4 : hasElevation && terrainLayers["elevation-points"] ? 6 : 5,
        color: readOnlyOfficialPoint ? "#d7e1e4" : "#ffffff",
        weight: readOnlyOfficialPoint ? 1.5 : 2,
        fillColor: readOnlyOfficialPoint ? "#6f8791" : hasElevation && terrainLayers["elevation-points"] ? "#c66e3d" : "#0a2639",
        fillOpacity: readOnlyOfficialPoint ? .72 : 1,
      })
        .bindTooltip(`P${index + 1}<br>${point.lat.toFixed(6)}, ${point.lng.toFixed(6)}${readOnlyOfficialPoint ? "<br>TKGM sınır noktası · salt okunur" : ""}${hasElevation && terrainLayers["elevation-points"] ? `<br>Z ${point.alt?.toFixed(2)} m` : ""}`)
        .addTo(pointsLayerRef.current!);
    });
    if (showConceptualOverlays && terrainLayers.contours) terrainContours.forEach((segment) => {
      const start = fromLocalMeters(segment.start.east, segment.start.north, center);
      const end = fromLocalMeters(segment.end.east, segment.end.north, center);
      leaflet.polyline([[start.lat, start.lng], [end.lat, end.lng]], { color: "#557f75", weight: 1.1, opacity: .68 })
        .bindTooltip(`Eş yükselti ${segment.elevation.toFixed(2)} m`)
        .addTo(contourLayerRef.current!);
    });
    if (showConceptualOverlays && zoningFormReady && parcel.length >= 3) {
      const placementWarning = placementPrecheckWarning;
      buildingLayerRef.current = leaflet.polygon(
        building.map((point) => [point.lat, point.lng]),
        {
          color: placementWarning ? "#e27b42" : "#ffffff",
          weight: placementWarning ? 3 : 2,
          fillColor: placementWarning ? "#7a3422" : "#0a2639",
          fillOpacity: placementWarning ? .48 : .64,
        },
      ).bindTooltip(
        `Temsili Ön Kütle<br>${usage}<br>${system}<br>${buildingWidth} × ${buildingDepth} m · ${floors} kat${!metrics.setbackPass ? "<br>KENAR BAZLI ÇEKME UYARISI" : ""}${taksExceeded ? "<br>TAKS ÖN KONTROL UYARISI" : ""}${kaksExceeded ? "<br>KAKS ÖN KONTROL UYARISI" : ""}${hmaxExceeded ? "<br>HMAX ÖN KONTROL UYARISI" : ""}`,
      ).addTo(map);
    }
  }, [parcel, building, center, mapReady, usage, system, buildingWidth, buildingDepth, floors, terrainContours, terrainLayers, showConceptualOverlays, zoningFormReady, zoning.frontSetback, zoning.sideSetback, zoning.rearSetback, massingModel, officialBoundaryLocked, metrics.setbackPass, placementPrecheckWarning, taksExceeded, kaksExceeded, hmaxExceeded]);

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
    setFileNotice("Cihaz konumu alınıyor ve idari konum çözümleniyor…");
    navigator.geolocation.getCurrentPosition((position) => {
      const point = { lat: position.coords.latitude, lng: position.coords.longitude };
      pendingCenterRef.current = point;
      setLatitude(point.lat.toFixed(7));
      setLongitude(point.lng.toFixed(7));
      mapRef.current?.setView([point.lat, point.lng], 16);
      setParcel([]);
      setBlock("");
      setParcelNo("");
      setParcelLookup("idle");
      setParcelSource({
        kind: "coordinate",
        authority: "Cihaz konumu",
        label: "Cihaz koordinatı / kullanıcı seçimi",
        capturedAt: new Date().toISOString(),
        url: "",
      });
      setDataStatus("Cihaz konumu · resmî parsel doğrulaması bekleniyor");

      void fetchGeocode({ lat: point.lat, lng: point.lng }).then((result) => {
        setProvinceId("");
        setDistrictId("");
        setNeighborhoodId("");
        setDistrictOptions([]);
        setNeighborhoodOptions([]);
        setProvince(result.province ?? "");
        setDistrict(result.district ?? "");
        setNeighborhood(result.neighborhood ?? "");
        setAdministrativeLoading(result.province ? "district" : "idle");
        setFileNotice(
          result.province
            ? `Cihaz konumu ±${Math.round(position.coords.accuracy)} m doğrulukla alındı · ${result.province}${result.district ? ` / ${result.district}` : ""}${result.neighborhood ? ` / ${result.neighborhood}` : ""}. Ada ve parsel seçimini tamamlayın.`
            : `Cihaz konumu ±${Math.round(position.coords.accuracy)} m doğrulukla alındı. İdari konum bulunamadı; il ve ilçeyi elle seçin.`,
        );
      }).catch(() => {
        setProvince("");
        setDistrict("");
        setNeighborhood("");
        setProvinceId("");
        setDistrictId("");
        setNeighborhoodId("");
        setDistrictOptions([]);
        setNeighborhoodOptions([]);
        setFileNotice(`Cihaz konumu ±${Math.round(position.coords.accuracy)} m doğrulukla alındı. İdari konum çözümlenemedi; il ve ilçeyi elle seçin.`);
      });
    }, () => setFileNotice("Konum izni verilmedi veya konum alınamadı"), { enableHighAccuracy: true, timeout: 10_000 });
  };
  const resetParcelSelection = (message: string) => {
    setParcel([]);
    setOfficialBoundaryEvidence(null);
    setShowTerrainMassing(false);
    setTerrainLayers((current) => ({ ...current, "building-mass": false }));
    setParcelLookup("idle");
    setDrawEnabled(false);
    setShowConceptualOverlays(false);
    setParcelSource({
      kind: "coordinate",
      authority: "Kullanıcı",
      label: "Parsel kimliği kayıtlı / sınır sorgusu bekleniyor",
      capturedAt: new Date().toISOString(),
      url: "",
    });
    setDataStatus("Kullanıcı seçimi · resmî parsel doğrulaması bekleniyor");
    setFileNotice(message);
  };

  const markBoundaryAsManual = (label: string) => {
    setParcelSource({
      kind: "manual-drawing",
      authority: officialBoundaryEvidence ? "Kullanıcı · TKGM sınırından türetildi" : "Kullanıcı",
      label,
      capturedAt: new Date().toISOString(),
      url: "",
    });
    setDataStatus(officialBoundaryEvidence
      ? "TKGM kaynaklı kullanıcı kopyası · uzman doğrulaması gerekli"
      : "Kullanıcı çizimi · resmî sınır doğrulaması gerekli");
  };
  const createEditableBoundaryCopy = () => {
    if (!officialBoundaryLocked) return;
    setParcel((points) => points.map((point) => ({ ...point })));
    markBoundaryAsManual("TKGM kaynaklı düzenlenebilir kopya");
    setDrawEnabled(true);
    setFileNotice("Düzenlenebilir kopya oluşturuldu. Orijinal TKGM sınırı kanıt olarak korundu; bu kopyadaki değişiklikler uzman doğrulaması gerektirir.");
  };
  const restoreOfficialBoundary = () => {
    if (!officialBoundaryEvidence?.geometry.length) return;
    const restored = officialBoundaryEvidence.geometry.map((point) => ({ ...point }));
    setParcel(restored);
    setParcelSource({ ...officialBoundaryEvidence.source });
    setDataStatus("TKGM MEGSİS açık servis geometrisi · tapu/aplikasyon belgesi değildir");
    setDrawEnabled(false);
    setParcelLookup("found");
    setFileNotice("Orijinal TKGM sınırı geri yüklendi; kullanıcı düzenleme kopyası aktif geometriden kaldırıldı.");
    fitMapToPoints(restored, 120);
  };
  const removeLastBoundaryPoint = () => {
    if (officialBoundaryLocked) {
      setFileNotice("TKGM sınırı salt okunurdur. Değişiklik için önce Düzenlenebilir Kopya Oluştur seçeneğini kullanın.");
      return;
    }
    setParcel((points) => points.slice(0, -1));
    markBoundaryAsManual("Haritada düzenlenen sınır");
    setFileNotice("Son sınır noktası kaldırıldı; geometri kullanıcı düzenlemesi olarak işaretlendi");
  };
  const clearBoundary = () => {
    if (officialBoundaryLocked) {
      setFileNotice("TKGM sınırı salt okunurdur. Değişiklik için önce Düzenlenebilir Kopya Oluştur seçeneğini kullanın.");
      return;
    }
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
      setShowTerrainMassing(false);
      setTerrainLayers((current) => ({ ...current, "parcel-boundary": true, "building-mass": false }));
      setLatitude(parcelCenter.lat.toFixed(7));
      setLongitude(parcelCenter.lng.toFixed(7));
      setProvince(String(properties.ilAd ?? province));
      setDistrict(String(properties.ilceAd ?? district));
      setNeighborhood(String(properties.mahalleAd ?? neighborhood));
      const reportedArea = parseReportedArea(properties.alan);
      const capturedAt = new Date().toISOString();
      const officialSource: ParcelSourceState = {
        kind: "tkgm-open-service",
        authority: "Tapu ve Kadastro Genel Müdürlüğü",
        label: "TKGM MEGSİS açık servis yanıtı",
        capturedAt,
        url: "https://parselsorgu.tkgm.gov.tr/",
        reportedArea,
      };
      setParcelSource(officialSource);
      setOfficialBoundaryEvidence({
        geometry: nextParcel.map((point) => ({ ...point })),
        source: { ...officialSource },
        identity: {
          province: String(properties.ilAd ?? province),
          district: String(properties.ilceAd ?? district),
          neighborhood: String(properties.mahalleAd ?? neighborhood),
          block: block.trim(),
          parcelNo: parcelNo.trim(),
        },
        capturedAt,
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

  const parseOptionalZoningNumber = (value: string) => value.trim() === "" ? -1 : Number(value);
  const displayOptionalZoningNumber = (value: number) => value >= 0 && Number.isFinite(value) ? value : "";
  const formatZoningNumber = (value: number, digits = 2, suffix = "") => value >= 0 && Number.isFinite(value)
    ? `${value.toFixed(digits)}${suffix}`
    : "GİRİLMEDİ";

  const updateZoning = <K extends keyof ZoningForm>(key: K, value: ZoningForm[K]) => {
    const expertKeys = new Set<keyof ZoningForm>([
      "expertReviewStatus",
      "expertReviewer",
      "expertReviewerRole",
      "expertReviewDate",
      "expertReviewBasis",
      "expertReviewNote",
    ]);
    setZoning((current) => {
      const next = key === "verification"
        ? { ...current, verification: normalizeUntrustedZoningVerification(value, Boolean(current.sourceDocument)) }
        : { ...current, [key]: value };
      if (expertKeys.has(key)) return next;
      return {
        ...next,
        expertReviewStatus: "not-reviewed",
        expertReviewer: "",
        expertReviewerRole: "",
        expertReviewDate: "",
        expertReviewBasis: "",
        expertReviewNote: "",
      };
    });
    if (key === "taks") setMaxCoverage(Number(value) >= 0 ? Number(value) * 100 : -1);
    if (key === "kaks") setMaxFar(Number(value) >= 0 ? Number(value) : -1);
    if (key === "hmax") setMaxHeight(Number(value) >= 0 ? Number(value) : -1);
  };

  const updateSetback = (key: "frontSetback" | "sideSetback" | "rearSetback", value: number) => {
    const next = {
      ...zoning,
      [key]: value,
      expertReviewStatus: "not-reviewed" as const,
      expertReviewer: "",
      expertReviewerRole: "",
      expertReviewDate: "",
      expertReviewBasis: "",
      expertReviewNote: "",
    };
    setZoning(next);
    const entered = [next.frontSetback, next.sideSetback, next.rearSetback].filter((item) => Number.isFinite(item) && item >= 0);
    setRequiredSetback(entered.length === 3 ? Math.max(...entered) : -1);
  };

  const handleZoningDocument = (file?: File) => {
    if (!file) return;
    // A browser upload proves only that a file was selected. It cannot establish
    // authenticity, current plan status or correspondence to this parcel.
    setZoning((current) => ({
      ...current,
      sourceDocument: file.name,
      verification: "document-pending-review",
      expertReviewStatus: "not-reviewed",
      expertReviewer: "",
      expertReviewerRole: "",
      expertReviewDate: "",
      expertReviewBasis: "",
      expertReviewNote: "",
    }));
    setFileNotice(`${file.name}: belge adı proje kaydına eklendi; içeriği veya resmî geçerliliği doğrulanmadı. Yetkili idare ve uzman incelemesi bekleniyor.`);
  };

  const exportGeoJson = () => downloadBlob(`${reference}.geojson`, JSON.stringify({
    type: "FeatureCollection", name: reference,
    metadata: {
      schema: "ARKEM-GEO/1.4", sourceCrs, dataStatus, generatedAt: new Date().toISOString(),
      parcelRecord, terrainModel, massingModel, exportReview,
      planning: { requiredSetback, maxCoverage, maxFar, maxHeight, parkingPer100 },
      zoning: createZoningProvenance(zoning, reference),
    },
    features: [
      {
        type: "Feature",
        properties: { reference, source: "Arkem Parcel Studio", crs: "EPSG:4326", geometryValidation: metrics.geometryValid ? "geometry-pass" : "review-required", officialCadastre: false },
        geometry: { type: "Polygon", coordinates: [[...parcel, parcel[0]].map((point) => [point.lng, point.lat, point.alt].filter((value) => value !== undefined))] },
      },
      {
        type: "Feature",
        properties: {
          reference: `${reference}-ON-YAPI`, system, usage, floors, floorHeight,
          selectedMassingId: activeMassingId, coverage: metrics.coverage, far: metrics.far,
          reviewStatus: exportReview.status, officialReleaseEligible: false,
          reviewReasons: exportReview.reasons,
        },
        geometry: { type: "Polygon", coordinates: [[...building, building[0]].map((point) => [point.lng, point.lat])] },
      },
    ],
  }, null, 2), "application/geo+json");
  const exportKml = () => {
    const reviewReasons = exportReview.reasons.join(" | ");
    const text = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2"><Document>
<name>${escapeXml(reference)}</name>
<description>${escapeXml(exportReviewMessage)} Resmî teslim onayı yoktur.</description>
<ExtendedData>
  <Data name="reviewStatus"><value>${exportReview.status}</value></Data>
  <Data name="officialReleaseEligible"><value>false</value></Data>
  <Data name="reviewReasons"><value>${escapeXml(reviewReasons)}</value></Data>
</ExtendedData>
<Placemark><name>Parsel</name>
<ExtendedData><Data name="geometryValidation"><value>${metrics.geometryValid ? "geometry-pass" : "review-required"}</value></Data></ExtendedData>
<Style><LineStyle><color>ff3666b9</color><width>3</width></LineStyle><PolyStyle><color>443666b9</color></PolyStyle></Style>
<Polygon><outerBoundaryIs><LinearRing><coordinates>${[...parcel, parcel[0]].map((point) => `${point.lng},${point.lat},${point.alt ?? 0}`).join(" ")}</coordinates></LinearRing></outerBoundaryIs></Polygon></Placemark>
<Placemark><name>On Yapi Kutlesi – ${exportReview.status}</name>
<description>${escapeXml(exportReviewMessage)}</description>
<ExtendedData><Data name="reviewStatus"><value>${exportReview.status}</value></Data><Data name="officialReleaseEligible"><value>false</value></Data></ExtendedData>
<Polygon><outerBoundaryIs><LinearRing><coordinates>${[...building, building[0]].map((point) => `${point.lng},${point.lat},0`).join(" ")}</coordinates></LinearRing></outerBoundaryIs></Polygon></Placemark>
</Document></kml>`;
    downloadBlob(`${reference}.kml`, text, "application/vnd.google-earth.kml+xml");
  };
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
      warningNotes: ["INCELEME GEREKLI / RESMI TESLIM ONAYI YOK", ...exportReview.reasons.slice(0, 2)],
      notes: [
        `CIKTI STATU: ${exportReview.status} / RESMI TESLIM: HAYIR`,
        `WGS84 ORIGIN: ${origin.lat.toFixed(8)}, ${origin.lng.toFixed(8)}`,
        `PARSEL ALANI: ${metrics.area.toFixed(1)} m2 / CEVRE: ${metrics.perimeter.toFixed(1)} m`,
        `ON YAPI: ${buildingWidth} x ${buildingDepth} m / ${floors} KAT / ${system}`,
        `ARAZI: ${terrainModel.basis === "measured-z" ? "KAYNAKLI Z / IDW" : `PARAMETRIK %${slope}`} / ${terrainContours.length} ESYUKSELTI PARCASI`,
        `IMAR: ${ascii(zoning.landUse || "GIRILMEDI")} / ${ascii(zoning.buildingOrder || "GIRILMEDI")} / TAKS ${formatZoningNumber(zoning.taks)} / KAKS ${formatZoningNumber(zoning.kaks)} / HMAX ${formatZoningNumber(zoning.hmax, 1, " m")}`,
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
      reviewBanner: exportReview.status === "review-required" ? "İNCELEME GEREKLİ / RESMÎ TESLİME UYGUN DEĞİL" : "ÖN KONTROLLER GEÇTİ / RESMÎ ONAY BEKLİYOR",
      polylines: [
        { role: "secondary", points: toSheet(parcel, true) },
        { role: "primary", points: toSheet(building) },
      ],
      metrics: [
        ["Parsel alanı", `${metrics.area.toFixed(1)} m²`],
        ["Parsel çevresi", `${metrics.perimeter.toFixed(1)} m`],
        ["Yapı tabanı", `${metrics.footprint.toFixed(1)} m²`],
        ["Ön brüt alan", `${metrics.gross.toFixed(1)} m²`],
        ["Kat / yükseklik / Hmax", `${floors} / ${metrics.buildingHeight.toFixed(1)} / ${zoning.hmax.toFixed(1)} m`],
        ["Kütle / imar TAKS-KAKS", `%${metrics.coverage.toFixed(1)} / %${maxCoverage.toFixed(1)} · ${metrics.far.toFixed(2)} / ${maxFar.toFixed(2)}`],
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
        exportReviewMessage,
        `${sourceCrs} koordinat sistemi ve ${dataStatus} veri statüsü kullanılmıştır.`,
        `Kütle: ${buildingWidth.toFixed(1)} × ${buildingDepth.toFixed(1)} m, ${floors} kat, ${rotation}° yönlenme.`,
        `İmar girdisi: TAKS ${formatZoningNumber(zoning.taks)}, KAKS ${formatZoningNumber(zoning.kaks)}, Hmax ${formatZoningNumber(zoning.hmax, 1, " m")}, ${zoning.buildingOrder || "nizam girilmedi"}.`,
        `Plan: ${zoning.planName || "belirtilmedi"} / ${zoning.planScale || "ölçek girilmedi"} / ${zoning.planId || "plan işlem no belirtilmedi"}.`,
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
  const exportManifest = () => downloadBlob(`${reference}-veri-manifestosu.json`, JSON.stringify({ schema: "ARKEM-GEO-MANIFEST/2.4", previousSchema: "ARKEM-GEO-MANIFEST/2.3", legacySchema: "ARKEM-GEO-MANIFEST/2.0", reference, sourceCrs, dataStatus, exportReview, officialReleaseEligible: false, coordinateOrigin: center, parcelRecord, parcelSourceNetwork: sourceNetwork, terrainModel, terrainLayers, massingModel, selectedMassingId: activeMassingId, frontEdge, counts: { parcelVertices: parcel.length, buildingVertices: building.length, contourSegments: terrainContours.length, massingAlternatives: massingModel.alternatives.length }, planningInputs: { requiredSetback, maxCoverage, maxFar, maxHeight, parkingPer100 }, zoning: createZoningProvenance(zoning, reference), metrics, provenance: createGeoProvenance({ reference, sourceCrs, dataStatus, administrativeSource, geometryValid: metrics.geometryValid, vertexCount: parcel.length }), connectors: [...GEO_CONNECTORS, ...ZONING_CONNECTORS], verification: { officialCadastre: false, licensedSurvey: dataStatus === "Harita mühendisi ölçümü" || dataStatus === "Onaylı aplikasyon verisi", zoningCertificate: zoning.verification === "certified-document", measuredElevation: terrainModel.basis === "measured-z", massingAuthoritative: massingModel.source.authoritative }, limitations: ["Kadastro sınırı değildir", "İmar uygunluk belgesi değildir", "Aplikasyon veya ruhsat projesi değildir", ...terrainModel.limitations, ...massingModel.limitations] }, null, 2), "application/json");

  const draftArchitectureAction = <div className="geo-stage-next" data-ready="draft" aria-label="Taslak mimari geçiş">
    <div><span>İMAR / YERLEŞİM İNCELEMESİ BEKLİYOR</span><b>Mimari ihtiyaç programını taslak olarak hazırlayın.</b><small>İmar ve yerleşim kontrolü beklemede kalır.</small></div>
    <a href="/mimari-program-studyosu">Taslak olarak mimariye devam et →</a>
  </div>;
  const stageContent: Record<Stage, React.ReactNode> = {
    locate: <div className="geo-control-section"><span>01 / PARSELİ BUL</span><h3>Resmî sorgudaki sırayla konumu seçin.</h3>{administrativeSource === "fallback" && <div className="arx-geo-offline-alert" role="status">
      <b>TKGM bağlantısı yok: mahalleler resmî kaynaktan yüklenemedi.</b>
      <p>İlçe listesi yalnızca seçim kolaylığı içindir. Mahalle/köy adını elle girebilir, ada ve parseli not edebilirsiniz; bu bilgiler otomatik olarak doğrulanmış sınır üretmez.</p>
      <button type="button" onClick={() => { void retryOfficialLists(); }} disabled={administrativeLoading === "province"}>
        {administrativeLoading === "province" ? "Bağlantı deneniyor…" : "Resmî listeleri yeniden dene"}
      </button>
      <small>{fileNotice}</small>
    </div>}
    <div className="geo-cascade-guide"><b>İl</b><i>→</i><b>İlçe</b><i>→</i><b>Mahalle/Köy</b><i>→</i><b>Ada</b><i>→</i><b>Parsel</b></div><div className="geo-field-grid geo-cascade-fields"><label>İl<select value={provinceId} onChange={(event) => { const selected = visibleProvinceOptions.find((item) => item.id === event.target.value); setProvinceId(event.target.value); setProvince(selected?.label ?? ""); setAdministrativeLoading("district"); setDistrictOptions([]); setDistrictId(""); setDistrict(""); setNeighborhoodOptions([]); setNeighborhoodId(""); setNeighborhood(""); setBlock(""); setParcelNo(""); resetParcelSelection("İl değişti. İlçe, mahalle/köy, ada ve parsel seçimini yeniden tamamlayın."); }} disabled={!visibleProvinceOptions.length}><option value="">{administrativeLoading === "province" ? "İller yükleniyor…" : "İl seçin"}</option>{visibleProvinceOptions.map((item) => <option value={item.id} key={item.id}>{item.label}</option>)}</select></label><label>İlçe<select value={districtId} onChange={(event) => { const selected = visibleDistrictOptions.find((item) => item.id === event.target.value); setDistrictId(event.target.value); setDistrict(selected?.label ?? ""); setAdministrativeLoading("neighborhood"); setNeighborhoodOptions([]); setNeighborhoodId(""); setNeighborhood(""); setBlock(""); setParcelNo(""); resetParcelSelection("İlçe değişti. Mahalle/köy, ada ve parsel seçimini yeniden tamamlayın."); }} disabled={!provinceId || !visibleDistrictOptions.length}><option value="">{administrativeLoading === "district" ? "İlçeler yükleniyor…" : provinceId ? "İlçe seçin" : "Önce il seçin"}</option>{visibleDistrictOptions.map((item) => <option value={item.id} key={item.id}>{item.label}</option>)}</select></label><label>Mahalle / Köy{administrativeSource === "fallback"
      ? <><input value={neighborhood} onChange={(event) => { const value = event.target.value; setNeighborhood(value); setNeighborhoodId(value.trim() ? "offline-neighborhood-manual" : ""); setBlock(""); setParcelNo(""); resetParcelSelection("Mahalle/köy değişti. Ada ve parsel numarasını yeniden girin."); }}
          placeholder="Mahalle veya köy adını kendiniz yazın" disabled={!districtId} autoComplete="off" />
          <small className="arx-geo-field-warning">Elle girilen ad resmî mahalle kimliği değildir.</small></>
      : <select value={neighborhoodId} onChange={(event) => { const selected = visibleNeighborhoodOptions.find((item) => item.id === event.target.value); setNeighborhoodId(event.target.value); setNeighborhood(selected?.label ?? ""); setBlock(""); setParcelNo(""); resetParcelSelection("Mahalle/köy değişti. Ada ve parsel numarasını girin."); }} disabled={!districtId || !visibleNeighborhoodOptions.length}>
          <option value="">{administrativeLoading === "neighborhood" ? "Mahalleler yükleniyor…" : districtId ? "Mahalle / köy seçin" : "Önce ilçe seçin"}</option>
          {visibleNeighborhoodOptions.map((item) => <option value={item.id} key={item.id}>{item.label}</option>)}
        </select>}</label><label>Ada<input value={block} onChange={(event) => { setBlock(event.target.value.replace(/\D/g, "")); resetParcelSelection("Ada numarası değişti. Parsel numarasını kontrol edip sorguyu çalıştırın."); }} inputMode="numeric" placeholder="Ada numarası" disabled={!neighborhoodId} /></label><label>Parsel<input value={parcelNo} onChange={(event) => { setParcelNo(event.target.value.replace(/\D/g, "")); resetParcelSelection("Parsel numarası değişti. TKGM sorgusunu çalıştırarak sınırı yükleyin."); }} inputMode="numeric" placeholder="Parsel numarası" disabled={!neighborhoodId} /></label></div><p className={`geo-cascade-status ${administrativeSource === "fallback" ? "fallback" : "official"}`}><i className={neighborhoodId ? "ready" : ""}></i>{administrativeSource === "fallback" ? "Çevrimdışı seçim listesi açık · resmî geometri TKGM/KML ile doğrulanacak." : neighborhoodId ? `${province} / ${district} / ${neighborhood} seçildi. Ada ve parsel numarasını girin.` : "Her seçim bir sonraki resmî idari listeyi açar."}</p>{listingIdentitySource && !block.trim() && parcelNo.trim() ? <p className="arx-geo-field-warning" role="status">Kaynak ilanda ada bilgisi belirtilmemiş; Parsel {parcelNo} aktarıldı. TKGM sınır sorgusu için ada numarasını resmî kaynaktan tamamlayın.</p> : null}{listingIdentitySource && block.trim() && !parcelNo.trim() ? <p className="arx-geo-field-warning" role="status">Kaynak ilanda Ada {block} belirtilmiş; parsel numarası eksik. TKGM sınır sorgusu için parsel numarasını resmî kaynaktan tamamlayın.</p> : null}{administrativeSource === "official" && !districtId.startsWith("offline-") && !neighborhoodId.startsWith("offline-")
      ? parcelLookup === "found"
        ? <div className="geo-parcel-query-success" role="status">
            <span><i>✓</i><b>Parsel yüklendi</b><small>TKGM sınırı haritaya ve proje kaydına işlendi.</small></span>
            <button type="button" onClick={() => { void locateOfficialParcel(); }}>Yeniden sorgula</button>
          </div>
        : <button className={"geo-parcel-query " + parcelLookup} onClick={locateOfficialParcel}
            disabled={parcelLookup === "loading" || !neighborhoodId || !block.trim() || !parcelNo.trim()}>
            <span>{parcelLookup === "loading" ? "…" : "TKGM"}</span>
            <b>{parcelLookup === "loading" ? "Parsel aranıyor" : parcelLookup === "error" ? "TKGM sorgusunu yeniden dene" : "TKGM'den parseli sorgula"}</b><i>↗</i>
          </button>
      : <p className="arx-geo-offline-query">Doğrudan parsel sorgusu bu oturumda kullanılamıyor. Resmî Parsel Sorgu üzerinden kaydı kontrol edin. Varsa sınır KML / GeoJSON dosyasını Dosya Yükle bölümüne aktarın.</p>}<a className="geo-official-link" href="https://parselsorgu.tkgm.gov.tr/" target="_blank" rel="noreferrer"><span>R</span><b>TKGM Parsel Sorgu'da kaydı aç</b><i>↗</i></a><p className="geo-caution">İl, ilçe ve mahalle/köy listeleri TKGM MEGSİS servisinden bağımlı olarak yüklenir. Ada ve parsel numarası seçili mahalle kimliğiyle sorgulanır. Alınan sınır bilgilendirme amaçlıdır; resmî proje sınırı yetkili harita mühendisi ve aplikasyon verisiyle doğrulanır.</p><details className="geo-coordinate-tools"><summary>İsteğe bağlı koordinat araçları</summary><div className="geo-coordinate-tools-body"><div className="geo-coordinate-fields"><label>Enlem<input value={latitude} onChange={(event) => setLatitude(event.target.value)} inputMode="decimal" /></label><label>Boylam<input value={longitude} onChange={(event) => setLongitude(event.target.value)} inputMode="decimal" /></label></div><div className="geo-inline-actions"><button onClick={moveToCoordinate}>Koordinata git</button><button onClick={useDeviceLocation}>Cihaz konumu</button></div><p>Parsel kimliği bilinmiyorsa haritayı yaklaşık konuma taşımak için kullanın. Koordinat seçimi resmî parsel doğrulaması değildir.</p></div></details></div>,
    import: <div className="geo-control-section"><span>02 / MEKÂNSAL VERİ</span><h3>Sınırı kaynağı ve statüsüyle içe alın.</h3><label>Kaynak koordinat sistemi<select value={sourceCrs} onChange={(event) => setSourceCrs(event.target.value)}><option>EPSG:4326 / WGS84</option><option>ITRF96 / 3° TM — dönüşüm gerekli</option><option>ED50 / UTM — dönüşüm gerekli</option><option>Yerel aplikasyon — sabit nokta gerekli</option></select></label><label>Veri statüsü<select value={dataStatus} onChange={(event) => setDataStatus(event.target.value)}><option>Kavramsal / doğrulanmamış</option><option>TKGM ekranından yaklaşık</option><option>Harita mühendisi ölçümü</option><option>Onaylı aplikasyon verisi</option></select></label><label className="geo-file-drop"><input type="file" accept=".kml,.geojson,.json,.csv,.txt" onChange={(event) => handleFile(event.target.files?.[0])} /><b>KML, GeoJSON veya CSV seçin</b><small>Dosya tarayıcıda okunur; sunucuya yüklenmez.</small></label><div className="geo-format-list"><p><b>KML / KMZ</b><span>Google Earth çalışma akışı</span><i>CANLI: KML</i></p><p><b>GeoJSON</b><span>WGS84 Polygon / MultiPolygon</span><i>CANLI</i></p><p><b>CSV</b><span>enlem, boylam, opsiyonel kot</span><i>CANLI</i></p><p><b>SHP / LandXML</b><span>proje dönüşüm hattı</span><i className="planned">KISMİ</i></p></div><p className="geo-caution">Tarayıcı EPSG:4326 enlem / boylam verisini doğrudan işler. ITRF/TM, ED50 veya yerel koordinatlar doğru EPSG, dönüşüm parametreleri ve sabit aplikasyon noktası olmadan WGS84 kabul edilmez.</p></div>,
    draw: <div className="geo-control-section"><span>03 / SINIR EDİTÖRÜ</span><h3>{officialBoundaryLocked ? "TKGM sınırını inceleyin." : "Noktaları harita üzerinde düzenleyin."}</h3>{officialBoundaryLocked ? <div className="geo-official-boundary-lock" role="status"><b>TKGM sınırı salt okunur</b><p>Bu geometri açık servis yanıtından geldi. Orijinal kanıt korunur ve doğrudan değiştirilemez.</p><button type="button" onClick={createEditableBoundaryCopy}>Düzenlenebilir Kopya Oluştur</button></div> : <><button className={`geo-toggle-draw${drawEnabled ? " active" : ""}`} onClick={() => setDrawEnabled((value) => !value)}><i></i>{drawEnabled ? "Haritaya tıklayarak nokta ekleniyor" : "Nokta ekleme kapalı"}</button><div className="geo-inline-actions"><button onClick={removeLastBoundaryPoint} disabled={!parcel.length}>Son noktayı geri al</button><button onClick={clearBoundary} disabled={!parcel.length}>Sınırı temizle</button></div>{officialBoundaryEvidence && <button className="geo-wide-action geo-restore-official" type="button" onClick={restoreOfficialBoundary}>Orijinal TKGM Sınırına Dön</button>}{!simple && <button className="geo-wide-action" onClick={loadSample}>Koordinatta örnek poligon üret</button>}</>}<div className="geo-point-table"><header><span>Nokta</span><span>Enlem</span><span>Boylam</span></header>{parcel.slice(0, 12).map((point, index) => <p key={`${point.lat}-${point.lng}-${index}`}><b>P{String(index + 1).padStart(2, "0")}</b><span>{point.lat.toFixed(6)}</span><span>{point.lng.toFixed(6)}</span></p>)}{parcel.length > 12 && <small>+ {parcel.length - 12} ek nokta</small>}</div></div>,
    zoning: <div className="geo-control-section geo-zoning-control">
      <span>{simple ? "03 / PARSEL BAZLI İMAR" : "04 / PARSEL BAZLI İMAR"}</span>
      <h3>Plan kararını kaynağıyla birlikte projeye bağlayın.</h3>
      <div className="geo-zoning-status" data-state={zoning.verification}>
        <i></i>
        <div><b>{zoningVerificationLabel(zoning.verification)}</b><small>{reference}</small></div>
      </div>

      <details
        className="geo-collapsible-block geo-zoning-primary-block"
        open={zoningPanel === "conditions"}
        onToggle={(event) => {
          if (event.currentTarget.open) setZoningPanel("conditions");
          else if (zoningPanel === "conditions") setZoningPanel(null);
        }}
      >
        <summary><span>İmar koşulları</span><small>{zoningFormReady ? "Temel imar girdileri tamam" : "TAKS, KAKS, Hmax ve çekme mesafeleri"}</small></summary>
        <div className="geo-collapsible-body">
          <div className="geo-zoning-core">
        <label>Arazi kullanım kararı<input value={zoning.landUse} onChange={(event) => updateZoning("landUse", event.target.value)} placeholder="Konut, ticaret, sanayi…" /></label>
        <label>Yapı nizamı<select value={zoning.buildingOrder} onChange={(event) => updateZoning("buildingOrder", event.target.value)}><option value="" disabled>Yapı nizamını seçin</option><option>Ayrık nizam</option><option>Bitişik nizam</option><option>Blok nizam</option><option>İkiz nizam</option><option>Serbest nizam</option><option>Plan notuna göre</option></select></label>
        <div className="geo-planning-grid geo-zoning-values">
          <label className={zoningFocus === "taks" ? "geo-zoning-focus-target" : ""}>TAKS<input type="number" min=".01" max="1" step=".01" value={displayOptionalZoningNumber(zoning.taks)} onChange={(event) => updateZoning("taks", parseOptionalZoningNumber(event.target.value))} placeholder="TAKS girin"/></label>
          <label className={zoningFocus === "kaks" ? "geo-zoning-focus-target" : ""}>KAKS / Emsal<input type="number" min=".05" max="10" step=".05" value={displayOptionalZoningNumber(zoning.kaks)} onChange={(event) => updateZoning("kaks", parseOptionalZoningNumber(event.target.value))} placeholder="KAKS / emsal girin"/></label>
          <label className={zoningFocus === "hmax" ? "geo-zoning-focus-target" : ""}>Hmax / Yençok<input type="number" min="0" max="250" step=".5" value={displayOptionalZoningNumber(zoning.hmax)} onChange={(event) => updateZoning("hmax", parseOptionalZoningNumber(event.target.value))} placeholder="Hmax girin"/><b>m</b></label>
        </div>
        <div className="geo-planning-grid geo-zoning-values">
          <label>Ön bahçe<input type="number" min="0" max="100" step=".5" value={displayOptionalZoningNumber(zoning.frontSetback)} onChange={(event) => updateSetback("frontSetback", parseOptionalZoningNumber(event.target.value))} placeholder="Ön çekme"/></label>
          <label>Yan bahçe<input type="number" min="0" max="100" step=".5" value={displayOptionalZoningNumber(zoning.sideSetback)} onChange={(event) => updateSetback("sideSetback", parseOptionalZoningNumber(event.target.value))} placeholder="Yan çekme"/></label>
          <label>Arka bahçe<input type="number" min="0" max="100" step=".5" value={displayOptionalZoningNumber(zoning.rearSetback)} onChange={(event) => updateSetback("rearSetback", parseOptionalZoningNumber(event.target.value))} placeholder="Arka çekme"/></label>
        </div>
          </div>
        </div>
      </details>

      {zoningFocus ? <div className="geo-zoning-focus-note">
        <span>{zoningFocus === "kaks" ? "PLN-012 · KAKS GİRDİSİ" : zoningFocus === "taks" ? "PLN-011 · TAKS GİRDİSİ" : zoningFocus === "hmax" ? "PLN-013 · HMAX GİRDİSİ" : "İMAR KAYNAĞI"}</span>
        <b>{zoningFocus === "kaks"
          ? `Bu değer brüt alan KAKS/emsal kontrolünde kullanılır · ${metrics.area.toLocaleString("tr-TR", { maximumFractionDigits: 1 })} m² × ${zoning.kaks >= 0 ? zoning.kaks.toLocaleString("tr-TR") : "—"} ≈ ${metrics.allowedGross.toLocaleString("tr-TR", { maximumFractionDigits: 1 })} m² azami emsal alan`
          : zoningFocus === "taks"
            ? `Bu değer taban alanı kontrolünde kullanılır · ${metrics.area.toLocaleString("tr-TR", { maximumFractionDigits: 1 })} m² × ${zoning.taks >= 0 ? zoning.taks.toLocaleString("tr-TR") : "—"} ≈ ${metrics.allowedFootprint.toLocaleString("tr-TR", { maximumFractionDigits: 1 })} m² azami taban`
            : zoningFocus === "hmax"
              ? `Bu değer yapı yüksekliği ön kontrolünde kullanılır · kayıtlı Hmax ${zoning.hmax >= 0 ? zoning.hmax.toLocaleString("tr-TR") : "—"} m`
              : "Bu görünüm imar koşulunun kaynak ve doğrulama kaydını incelemek için açıldı."}</b>
        <small>Değeri yalnız yetkili kaynak farklıysa değiştirin; açık konu kapansın diye imar girdisini yükseltmeyin.</small>
      </div> : null}

      <div className="geo-zoning-source-status" aria-label="Resmî imar sorgusu">
        <span>OTOMATİK İMAR ARAŞTIRMASI</span>
        <b>{officialZoningEligible ? "Kastamonu İl Özel İdaresi · konut alanı" : "Parsel konumu doğrulandıktan sonra imar kaynağı sorgulanır"}</b>
        <small role="status">{officialZoningEligible ? officialZoningNotice : province !== "Kastamonu" ? "Bu sürümde Kastamonu bağlantısı etkin; diğer bölgeler için kaynak bağlantısı bekleniyor." : "Resmî il, ilçe ve mahalle/köy seçimini ve ada/parsel bilgisini tamamlayın. Sorgu TKGM sınırını sunucuda doğrular."}</small>
        {officialZoningEligible && officialZoningResult?.status === "found" && officialZoningResult.conditions && <p>Kaynak değerleri: TAKS {officialZoningResult.conditions.taks ?? "bilgi yok"} · KAKS {officialZoningResult.conditions.kaks ?? "bilgi yok"} · Hmax {officialZoningResult.conditions.hmax ?? "bilgi yok"} · Plan {officialZoningResult.source?.planId}. Plan notu doğrulaması bekleniyor.</p>}
        {officialZoningEligible && <button type="button" disabled={officialZoningLoading} onClick={() => setOfficialZoningRefresh(v => v + 1)}>{officialZoningLoading ? "İmar kaynağı sorgulanıyor…" : "Resmî imar kaynağını yeniden sorgula"}</button>}
      </div>

      <div className={`geo-zoning-source-status${zoningFocus ? " geo-zoning-source-focus" : ""}`} data-ready={zoningSourceReady ? "ready" : "missing"} data-reviewed={zoningExpertReviewComplete ? "true" : "false"}>
        <span>İMAR KAYNAĞI</span>
        <b>{zoningExpertReviewComplete
          ? "Uzman inceleme kaydı tamamlandı · resmî onay değildir"
          : zoningSourceReady
            ? "Kaynak bilgisi eklendi · uzman doğrulaması gerekli"
            : "Kaynak bilgisi eksik"}</b>
        <small>{zoningExpertReviewComplete
          ? `${zoning.expertReviewer} · ${zoning.expertReviewerRole} · ${zoning.expertReviewDate}`
          : zoningSourceReady
            ? "Kaynak kaydı mevcut; resmî doğrulama yapılmış sayılmaz."
            : "Plan ve kaynak bölümünden kaynak bilgilerini tamamlayın."}</small>
      </div>

      <details
        className="geo-collapsible-block"
        open={zoningPanel === "source"}
        onToggle={(event) => {
          if (event.currentTarget.open) setZoningPanel("source");
          else if (zoningPanel === "source") setZoningPanel(null);
        }}
      >
        <summary><span>Plan ve kaynak</span><small>{zoning.planScale || "Plan ölçeği ve kaynak bilgileri"}</small></summary>
        <div className="geo-collapsible-body">
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
          <div className="geo-field-grid">
            <label>Kaynak türü<select value={zoning.sourceType} onChange={(event) => updateZoning("sourceType", event.target.value)}><option value="" disabled>Kaynak türünü seçin</option><option>Belediye imar durumu</option><option>e-Plan / plan paftası</option><option>Plan notu / meclis kararı</option><option>Kullanıcı beyanı</option><option>İlan beyanı</option><option>Resmî e-İmar servisi</option><option>Diğer</option></select></label>
            <label>Belge / kaynak tarihi<input type="date" value={zoning.sourceDate} onChange={(event) => updateZoning("sourceDate", event.target.value)} /></label>
            <label>Plan adı<input value={zoning.planName} onChange={(event) => updateZoning("planName", event.target.value)} placeholder="Uygulama imar planı" /></label>
            <label>Plan ölçeği<select value={zoning.planScale} onChange={(event) => updateZoning("planScale", event.target.value)}><option value="" disabled>Plan ölçeğini seçin</option><option>1/1000 Uygulama İmar Planı</option><option>1/5000 Nazım İmar Planı</option><option>1/25000 Çevre Düzeni Planı</option><option>Diğer / plan paftasına göre</option></select></label>
            <label>Plan işlem / pafta no<input value={zoning.planId} onChange={(event) => updateZoning("planId", event.target.value)} placeholder="PIN, pafta veya karar no" /></label>
          </div>
        </div>
      </details>

      <details
        className="geo-collapsible-block geo-expert-review-block"
        open={zoningPanel === "expert"}
        onToggle={(event) => {
          if (event.currentTarget.open) setZoningPanel("expert");
          else if (zoningPanel === "expert") setZoningPanel(null);
        }}
      >
        <summary>
          <span>Uzman incelemesi</span>
          <small>{zoningExpertReviewComplete ? "İnceleme kaydı tamamlandı" : "PLN-010 için gerekli"}</small>
        </summary>
        <div className="geo-collapsible-body">
          <p className="geo-expert-review-warning"><b>Proje içi inceleme kaydı:</b> Bu bölüm belediye/onay makamı statüsü oluşturmaz. Yalnız uzman tarafından yapılan kaynak ve koşul karşılaştırmasını projeye kaydeder.</p>
          <label>İnceleme sonucu
            <select value={zoning.expertReviewStatus} onChange={(event) => updateZoning("expertReviewStatus", event.target.value as ZoningExpertReviewStatus)}>
              <option value="not-reviewed">İnceleme bekliyor</option>
              <option value="reviewed-consistent">Kaynak ile girilen imar koşulları uyumlu</option>
              <option value="reviewed-revision-required">Kaynak ile fark bulundu · revizyon gerekli</option>
            </select>
          </label>
          <div className="geo-field-grid">
            <label>İnceleyen / uzman adı<input value={zoning.expertReviewer} onChange={(event) => updateZoning("expertReviewer", event.target.value)} placeholder="Ad Soyad" /></label>
            <label>Rol / uzmanlık<input value={zoning.expertReviewerRole} onChange={(event) => updateZoning("expertReviewerRole", event.target.value)} placeholder="Şehir plancısı, mimar, yetkili uzman…" /></label>
            <label>İnceleme tarihi<input type="date" value={zoning.expertReviewDate} onChange={(event) => updateZoning("expertReviewDate", event.target.value)} /></label>
            <label>Dayanak / referans<input value={zoning.expertReviewBasis} onChange={(event) => updateZoning("expertReviewBasis", event.target.value)} placeholder="Plan paftası, plan notu, imar durumu belge no…" /></label>
          </div>
          <label>Uzman inceleme notu<textarea rows={3} value={zoning.expertReviewNote} onChange={(event) => updateZoning("expertReviewNote", event.target.value)} placeholder="Karşılaştırılan hükümler, kapsam, istisna veya revizyon notu…" /></label>
          <div className="geo-expert-review-result" data-state={zoning.expertReviewStatus}>
            <b>{zoningExpertReviewComplete
              ? "PLN-010 kapanmaya hazır"
              : zoning.expertReviewStatus === "reviewed-revision-required"
                ? "Revizyon gerekli · PLN-010 açık kalır"
                : "Uzman inceleme kaydı tamamlanmadı"}</b>
            <small>{zoningExpertReviewComplete
              ? "İnceleme kaydı tamamlandığında proje grafiği PLN-010'u açık konulardan çıkarır; imar kaynağı yine resmî/onaylı sayılmaz."
              : "Uyumlu inceleme sonucu ile inceleyen, rol, tarih ve dayanak alanlarının tamamı gereklidir."}</small>
          </div>
        </div>
      </details>

      <details
        className="geo-collapsible-block"
        open={zoningPanel === "notes"}
        onToggle={(event) => {
          if (event.currentTarget.open) setZoningPanel("notes");
          else if (zoningPanel === "notes") setZoningPanel(null);
        }}
      >
        <summary><span>Belge ve notlar</span><small>{zoning.sourceDocument || zoning.planNoteReference || zoning.sourceNote ? "Kayıt mevcut" : "İsteğe bağlı teknik kanıtlar"}</small></summary>
        <div className="geo-collapsible-body">
          <label>Plan notu referansı<textarea rows={3} value={zoning.planNoteReference} onChange={(event) => updateZoning("planNoteReference", event.target.value)} placeholder="Madde, özel hüküm, açıklama…" /></label>
          <label>Kaynak bağlantısı<input type="url" value={zoning.sourceUrl} onChange={(event) => updateZoning("sourceUrl", event.target.value)} onBlur={() => updateZoning("sourceUrl", normalizeZoningSourceUrl(zoning.sourceUrl))} placeholder="https://… Belediye e-İmar veya e-Plan bağlantısı" /></label>
          <label>Kaynak açıklaması<textarea rows={2} value={zoning.sourceNote} onChange={(event) => updateZoning("sourceNote", event.target.value)} placeholder="Belgenin kapsamı, nereden alındığı veya kontrol notu…" /></label>
          <label className="geo-file-drop"><input type="file" accept=".pdf,.png,.jpg,.jpeg" onChange={(event) => handleZoningDocument(event.target.files?.[0])} /><b>İmar durumu / plan notu belgesi ekleyin</b><small>Belge yalnızca oturumda referanslanır; sunucuya yüklenmez.</small></label>
          <p className="geo-caution"><b>Türkiye geneli entegrasyon sınırı:</b> Yetkili servis veya belge bulunmadan TAKS, KAKS, Hmax ve nizam değeri resmî hak olarak sunulmaz.</p>
        </div>
      </details>
      {!zoningFormReady && <p className="geo-caution"><b>İmar girdileri bekleniyor:</b> Plan ölçeği, yapı nizamı, TAKS, KAKS/Hmax ve çekme mesafeleri tamamlanmadan yapı zarfı hesabı üretilmez.</p>}
    </div>,

    design: zoningFormReady ? <div className="geo-control-section geo-design-control">
      <span>{simple ? "04 / YAPI YERLEŞİMİ" : "05 / YAPI YERLEŞİMİ"}</span>
      <h3>{massingModel.source.authoritative ? "Doğrulanan imar koşullarında kütleyi sınayın." : "Girilen imar koşullarında ön kütleyi sınayın."}</h3>

      <nav className="geo-design-tabs" aria-label="Yapı yerleşimi bölümleri">
        <button type="button" className={designPanel === "summary" ? "active" : ""} onClick={() => setDesignPanel("summary")}>Özet</button>
        <button type="button" className={designPanel === "massing" ? "active" : ""} onClick={() => setDesignPanel("massing")}>Kütle</button>
        <button type="button" className={designPanel === "adjust" ? "active" : ""} onClick={() => setDesignPanel("adjust")}>İnce ayar</button>
      </nav>

      {!placementDecisionPass && draftArchitectureAction}
      {simple && placementDecisionPass && <div className="geo-stage-next geo-stage-next-prominent" data-ready="true">
        <div>
          <span>✓ ARAZİ ADIMI TAMAMLANDI</span>
          <b>Mimari programı kur</b>
          <small>Seçili kütle ve imar bağlamıyla Mimari aşamasına devam edin.</small>
        </div>
        <a href="/mimari-program-studyosu">Mimariye Geç <i>→</i></a>
      </div>}

      {designPanel === "summary" && <>
        <div className="geo-zoning-summary">
          <span>AKTARILAN İMAR KOŞULLARI</span>
          <b>{zoning.buildingOrder} · TAKS {zoning.taks.toFixed(2)} · KAKS {zoning.kaks.toFixed(2)}</b>
          <small>Hmax {zoning.hmax.toFixed(1)} m · Ön/yan/arka {zoning.frontSetback}/{zoning.sideSetback}/{zoning.rearSetback} m</small>
          <small>Kaynak: {zoningSourceReady ? "bilgisi kayıtlı · uzman doğrulaması gerekli" : "eksik · kullanıcı girdisi"}</small>
          <button onClick={() => openFocusedStage("zoning")}>İmar girdilerini düzenleyin</button>
        </div>
        <section className="geo-placement-decision" aria-label="Yerleşim ön kontrolü karar özeti" data-state={placementDecisionPass ? "pass" : "review"}>
          <header><div><span>YERLEŞİM ÖN KONTROLÜ</span><b>İmar girdisi ve kavramsal kütle tek karar özetinde.</b></div><em>{placementDecisionPass ? "ÖN KONTROL GEÇTİ" : "İNCELEME GEREKLİ"}</em></header>
          <div className="geo-placement-decision-grid">
            <p><span>TAKS</span><b className={taksExceeded ? "fail" : "pass"}>{taksExceeded ? "⚠" : "✓"} %{metrics.coverage.toFixed(1)} / %{maxCoverage.toFixed(1)}</b></p>
            <p><span>KAKS</span><b className={kaksExceeded ? "fail" : "pass"}>{kaksExceeded ? "⚠" : "✓"} {metrics.far.toFixed(2)} / {maxFar.toFixed(2)}</b></p>
            <p><span>Hmax</span><b className={hmaxExceeded ? "fail" : "pass"}>{hmaxExceeded ? "⚠" : "✓"} {metrics.buildingHeight.toFixed(1)} / {maxHeight.toFixed(1)} m</b></p>
            <p><span>Ön çekme</span><b className={setbackDecision.front !== null && setbackDecision.front + .01 >= zoning.frontSetback ? "pass" : "fail"}>{setbackDecision.front !== null && setbackDecision.front + .01 >= zoning.frontSetback ? "✓" : "⚠"} {setbackDecision.front?.toFixed(1) ?? "—"} / {zoning.frontSetback.toFixed(1)} m</b></p>
            <p><span>Yan çekme</span><b className={setbackDecision.side !== null && setbackDecision.side + .01 >= zoning.sideSetback ? "pass" : "fail"}>{setbackDecision.side !== null && setbackDecision.side + .01 >= zoning.sideSetback ? "✓" : "⚠"} {setbackDecision.side?.toFixed(1) ?? "—"} / {zoning.sideSetback.toFixed(1)} m</b></p>
            <p><span>Arka çekme</span><b className={setbackDecision.rear !== null && setbackDecision.rear + .01 >= zoning.rearSetback ? "pass" : "fail"}>{setbackDecision.rear !== null && setbackDecision.rear + .01 >= zoning.rearSetback ? "✓" : "⚠"} {setbackDecision.rear?.toFixed(1) ?? "—"} / {zoning.rearSetback.toFixed(1)} m</b></p>
          </div>
          <div className="geo-placement-source"><span>Kaynak</span><b>{massingModel.source.authoritative ? "Yetkili kaynak doğrulandı" : zoningSourceReady ? "Kaynak bilgisi kayıtlı · uzman doğrulaması gerekli" : "Kaynak eksik · kullanıcı girdisi"}</b></div>
          <footer><b>SONUÇ</b><span>{placementDecisionLabel}</span><small>Bu sonuç parametrik ön kontroldür; imar uygunluğu, aplikasyon, ruhsat veya resmî onay değildir.</small></footer>
        </section>
      </>}

      {designPanel === "massing" && <>
        <section className="v112-massing-engine" aria-label="İmar uyumlu kütle alternatifleri">
          <header><div><span>{massingModel.source.authoritative ? "V112 / İMAR UYUMLU KÜTLE MOTORU" : "V112 / İMAR GİRDİLİ KÜTLE ÖN KONTROLÜ"}</span><b>Üç açıklanabilir yerleşim alternatifi.</b></div><em data-trust={massingModel.source.trust}>{massingModel.source.authoritative ? "İMAR KAYNAĞI DOĞRULANDI" : "ÖN DEĞERLENDİRME"}</em></header>
          <label className="v112-front-edge">Ön cephe yönü<select value={frontEdge} onChange={(event) => setFrontEdge(event.target.value as ParcelFrontEdge)}><option value="north">Kuzey</option><option value="east">Doğu</option><option value="south">Güney</option><option value="west">Batı</option></select><small>Yol cephesi resmî aplikasyon veya halihazır haritayla doğrulanmalıdır.</small></label>
          <div className="v112-envelope-ledger">
            <p><span>YAPI ZARFI</span><b>{massingModel.envelope.width.toFixed(1)} × {massingModel.envelope.depth.toFixed(1)} m</b></p>
            <p><span>{massingModel.source.authoritative ? "İZİNLİ TABAN" : "GİRDİYE GÖRE AZAMİ TABAN"}</span><b>{massingModel.limits.allowedFootprint.toFixed(0)} m²</b></p>
            <p><span>{massingModel.source.authoritative ? "İZİNLİ EMSAL" : "GİRDİYE GÖRE AZAMİ EMSAL ALAN"}</span><b>{massingModel.limits.allowedGrossArea.toFixed(0)} m²</b></p>
            <p><span>{massingModel.source.authoritative ? "KAT SINIRI" : "GİRDİYE GÖRE YÜKSEKLİK / KAT SINIRI"}</span><b>{massingModel.limits.maxFloors} kat / {massingModel.limits.allowedHeight.toFixed(1)} m</b></p>
          </div>
          <div className="v112-massing-choice">
            <nav aria-label="Kütle alternatifi seçimi">
              {massingModel.alternatives.map((alternative) => <button
                type="button"
                key={alternative.id}
                className={previewMassingAlternative?.id === alternative.id ? "active" : ""}
                data-state={alternative.status}
                onClick={() => setMassingPreviewId(alternative.id)}
              >
                <span>{alternative.label}</span>
                <small>{alternative.status === "fits" ? "Uygun" : "İncele"}</small>
              </button>)}
            </nav>
            {previewMassingAlternative && <article className="v112-massing-preview" data-state={previewMassingAlternative.status} data-selected={activeMassingId === previewMassingAlternative.id}>
              <header>
                <div><span>{previewMassingAlternative.status === "fits" ? (massingModel.source.authoritative ? "ÖN UYUMLU" : "GİRDİLERLE ÖN UYUMLU") : "İNCELEME"}</span><b>{previewMassingAlternative.label}</b></div>
                {massingModel.recommendedAlternativeId === previewMassingAlternative.id && <em>ÖNERİLEN</em>}
              </header>
              <div className="v112-massing-preview-main">
                <strong>{previewMassingAlternative.grossArea.toFixed(0)} <i>m²</i></strong>
                <p>{previewMassingAlternative.width.toFixed(1)} × {previewMassingAlternative.depth.toFixed(1)} m · {previewMassingAlternative.floors} kat</p>
              </div>
              <dl>
                <div><dt>TAKS</dt><dd>%{previewMassingAlternative.coverage.toFixed(1)}</dd></div>
                <div><dt>KAKS</dt><dd>{previewMassingAlternative.far.toFixed(2)}</dd></div>
                <div><dt>{massingModel.source.authoritative ? "Hak kullanımı" : "Girdi kullanımı"}</dt><dd>%{previewMassingAlternative.utilization.toFixed(0)}</dd></div>
              </dl>
              <small>{previewMassingAlternative.note}</small>
              <button onClick={() => applyMassingAlternative(previewMassingAlternative.id)} disabled={previewMassingAlternative.status !== "fits"}>
                {activeMassingId === previewMassingAlternative.id ? "Projede seçili" : "Bu alternatifi uygula"}
              </button>
            </article>}
          </div>
          {!massingModel.source.authoritative && <p className="v112-unverified-note">Doğrulanmamış kullanıcı imar girdilerine göre hesaplanmıştır.</p>}
        </section>
        <label>Kullanım<select value={usage} onChange={(event) => setUsage(event.target.value)}><option>Sanayi / Depo</option><option>Konut / Villa</option><option>Ticari Yapı</option><option>Tarımsal Yapı</option><option>Sosyal Tesis</option></select></label>
        <div className="geo-system-deferred" role="note"><span>TAŞIYICI SİSTEM</span><b>Karar bekleniyor</b><small>Taşıyıcı sistem seçimi Arazi aşamasında yapılmaz; Sistem adımında karşılaştırma ve gerekçe kaydıyla belirlenir.</small></div>
      </>}

      {designPanel === "adjust" && <>
        <label>Yapı genişliği <b>{buildingWidth.toFixed(1)} m</b><input type="range" min="6" max="70" step=".1" value={buildingWidth} onChange={(event) => setBuildingWidth(normalizeMassingDimension(Number(event.target.value)))} /></label>
        <label>Yapı derinliği <b>{buildingDepth.toFixed(1)} m</b><input type="range" min="8" max="100" step=".1" value={buildingDepth} onChange={(event) => setBuildingDepth(normalizeMassingDimension(Number(event.target.value)))} /></label>
        {(taksExceeded || kaksExceeded) && <p className="geo-inline-warning" role="alert"><b>İmar oranı ön kontrolü aşılıyor.</b>{taksExceeded && <> TAKS %{metrics.coverage.toFixed(1)} &gt; %{maxCoverage.toFixed(1)}.</>}{kaksExceeded && <> KAKS {metrics.far.toFixed(2)} &gt; {maxFar.toFixed(2)}.</>}</p>}
        <div className="geo-planning-grid"><label>Kat adedi<input type="number" min="1" max="20" value={draftBuildingInputs.floors} onChange={(event) => setDraftBuildingInputs((current) => ({ ...current, floors: event.target.value }))} onBlur={() => commitDraftBuildingInput("floors")}/></label><label>Kat yüksekliği<input type="number" min="2.6" max="12" step=".1" value={draftBuildingInputs.floorHeight} onChange={(event) => setDraftBuildingInputs((current) => ({ ...current, floorHeight: event.target.value }))} onBlur={() => commitDraftBuildingInput("floorHeight")}/><b>m</b></label><label>100 m² başına park<input type="number" min="0" max="10" step=".25" value={draftBuildingInputs.parking} onChange={(event) => setDraftBuildingInputs((current) => ({ ...current, parking: event.target.value }))} onBlur={() => commitDraftBuildingInput("parking")}/></label></div>
        <div className="geo-parking-result" aria-live="polite"><span>Hesaplanan park ihtiyacı</span><b>{metrics.parkingNeed} araç</b><small>{metrics.gross.toLocaleString("tr-TR", { maximumFractionDigits: 1 })} m² toplam alan ÷ 100 × {parkingPer100.toLocaleString("tr-TR", { maximumFractionDigits: 2 })} = {metrics.parkingDemand.toLocaleString("tr-TR", { maximumFractionDigits: 2 })} → yukarı yuvarlandı</small></div>
        {manualHeightExceedsZoning && <p className="geo-inline-warning" role="alert"><b>Yükseklik sınırı aşılıyor.</b> {manualBuildingHeight.toFixed(2)} m → Hmax {zoning.hmax.toFixed(2)} m.</p>}
        <label>Kuzeye göre açı <b>{rotation}°</b><input type="range" min="-180" max="180" step="5" value={rotation} onChange={(event) => setRotation(Number(event.target.value))} /></label>
        <label>Doğu / batı ofseti <b>{offsetEast} m</b><input type="range" min="-35" max="35" value={offsetEast} onChange={(event) => setOffsetEast(Number(event.target.value))} /></label>
        <label>Kuzey / güney ofseti <b>{offsetNorth} m</b><input type="range" min="-35" max="35" value={offsetNorth} onChange={(event) => setOffsetNorth(Number(event.target.value))} /></label>
      </>}

    </div> : <div className="geo-control-section geo-zoning-required">
      <span>{simple ? "04 / YAPI YERLEŞİMİ" : "05 / YAPI YERLEŞİMİ"}</span><h3>Taslak yapı bilgilerini girin.</h3>
      <p className="geo-caution"><b>İmar bilgileri bekleniyor.</b> Yapı bilgilerini şimdi kaydedebilirsiniz. Plan ölçeği, yapı nizamı, TAKS, KAKS/Hmax ve çekme mesafeleri tamamlandığında yerleşim ön kontrolü açılır.</p>
      <section aria-label="Taslak yapı bilgileri">
        <label>Kullanım<select aria-label="Kullanım" value={usage} onChange={(event) => setUsage(event.target.value)}><option>Sanayi / Depo</option><option>Konut / Villa</option><option>Ticari Yapı</option><option>Tarımsal Yapı</option><option>Sosyal Tesis</option></select></label>
        <div className="geo-field-grid">
          <label>Yapı genişliği (m)<input type="number" min="6" max="70" step=".1" value={draftBuildingInputs.width} onChange={(event) => setDraftBuildingInputs((current) => ({ ...current, width: event.target.value }))} onBlur={() => commitDraftBuildingInput("width")} /></label>
          <label>Yapı derinliği (m)<input type="number" min="8" max="100" step=".1" value={draftBuildingInputs.depth} onChange={(event) => setDraftBuildingInputs((current) => ({ ...current, depth: event.target.value }))} onBlur={() => commitDraftBuildingInput("depth")} /></label>
          <label>Kat adedi<input type="number" min="1" max="20" value={draftBuildingInputs.floors} onChange={(event) => setDraftBuildingInputs((current) => ({ ...current, floors: event.target.value }))} onBlur={() => commitDraftBuildingInput("floors")} /></label>
          <label>Kat yüksekliği (m)<input type="number" min="2.6" max="12" step=".1" value={draftBuildingInputs.floorHeight} onChange={(event) => setDraftBuildingInputs((current) => ({ ...current, floorHeight: event.target.value }))} onBlur={() => commitDraftBuildingInput("floorHeight")} /></label>
          <label>100 m² başına park<input type="number" min="0" max="10" step=".25" value={draftBuildingInputs.parking} onChange={(event) => setDraftBuildingInputs((current) => ({ ...current, parking: event.target.value }))} onBlur={() => commitDraftBuildingInput("parking")} /></label>
        </div>
        <p>Bilgiler proje taslağına kaydedilir. İmar uygunluğu ve yapı zarfı henüz hesaplanmadı.</p>
      </section>
      <button className="geo-wide-action" type="button" onClick={() => openFocusedStage("zoning")}>İmar bilgilerine dön</button>
      {draftArchitectureAction}
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
    export: <div className="geo-control-section"><span>07 / TEKNİK ÇIKTI</span><h3>Geometriyi, imar kaynağını ve veri statüsünü kurumsal paftayla aktarın.</h3><p className="geo-caution" role="status"><b>{exportReview.status === "review-required" ? "İNCELEME GEREKLİ" : "ÖN KONTROLLER TAMAM"}</b> · Resmî teslim onayı yoktur. {exportReview.reasons.slice(0, 3).join(" ")}</p><div className="geo-export-list"><button onClick={exportPdf} disabled={exportDisabled}><span>PDF</span><b>A3 kurumsal teknik pafta</b><i>↓</i></button><button onClick={exportDxf} disabled={exportDisabled}><span>CAD</span><b>DWG uyumlu antetli DXF</b><i>↓</i></button><button onClick={exportKml} disabled={exportDisabled}><span>KML</span><b>Google Earth aktarımı</b><i>↓</i></button><button onClick={exportGeoJson} disabled={exportDisabled}><span>GJSON</span><b>GeoJSON + arazi metadata</b><i>↓</i></button><button onClick={exportLandXml} disabled={exportDisabled || terrainModel.basis !== "measured-z"}><span>XML</span><b>{terrainModel.basis === "measured-z" ? "LandXML kaynaklı TIN başlangıcı" : "LandXML için üç kaynaklı Z kotu gerekli"}</b><i>↓</i></button><button onClick={exportCsv} disabled={exportDisabled}><span>CSV</span><b>WGS84 koordinat ve kot listesi</b><i>↓</i></button><button onClick={exportManifest} disabled={exportDisabled}><span>MAN</span><b>Parsel · imar · arazi kanıt manifestosu</b><i>↓</i></button></div>{!parcelRecord.projectEligible && <p className="geo-caution"><b>Çıktı bekliyor:</b> Temsili başlangıç geometrisi teknik teslim üretmez. TKGM sınırı, doğrulanmış mekânsal dosya veya kullanıcı sınır düzenlemesi kaynağıyla kaydedilmelidir.</p>}<p className="geo-caution"><b>DWG notu:</b> İndirilen katmanlı DXF; pafta çerçevesi, antet, proje kimliği, imar kaynağı ve revizyon bilgilerini içerir ve CAD ortamında DWG olarak kaydedilebilir. Doğrudan DWG üretimi için lisanslı dönüşüm servisi gerekir.</p></div>,
  };

  return <section className={simple ? "geo-parcel-studio arx-geo-simple" : "geo-parcel-studio"} data-arx-sources={showSources ? "open" : "closed"} data-arx-layers={showLayers ? "open" : "closed"} data-arx-results={showResults ? "open" : "closed"}>
    {simple ? <ProjectKernelBar moduleKey="geo-parcel" module="GEO·BIM PARCEL ENGINE" confidence={dataStatus} compact /> : <ProjectKernelBar moduleKey="geo-parcel" module="GEO·BIM PARCEL ENGINE" confidence={dataStatus} />}
    <header className="geo-studio-top"><div><span>ARKEM / GEO·BIM WORKSPACE · V111 GIS + 3B</span><b>Parsel, Kot & Arazi Stüdyosu</b></div><div><span className="geo-status live">ORTAK KATMAN MOTORU</span><small>2B + 3B · WGS84 / yerel ENU</small></div></header>
    {simple && <>
      <nav className="arx-geo-quick-nav" aria-label="Arazi parsel temel işlemleri">
        {([["locate","01","Parsel bul"],["import","02","Dosya yükle"],["zoning","03","İmar bilgileri"],["design","04","Yapı yerleşimi"]] as const).map(([id,no,label]) =>
          <button key={id} type="button" className={activeStage === id ? "active" : ""} aria-current={activeStage === id ? "step" : undefined}
            onClick={() => openFocusedStage(id)}><span>{no}</span><b>{label}</b></button>
        )}
        <details className="arx-geo-extra" ref={extraToolsRef}>
          <summary>Diğer araçlar ▾</summary>
          <div onClickCapture={(event) => {
            if ((event.target as HTMLElement).closest("button")) {
              window.requestAnimationFrame(() => {
                if (extraToolsRef.current) extraToolsRef.current.open = false;
              });
            }
          }}>
            {([["draw","Sınır düzenle"],["terrain","3B arazi"],["export","Teknik çıktılar"]] as const).map(([id,label]) =>
              <button type="button" key={id} className={activeStage === id ? "active" : ""}
                onClick={() => openFocusedStage(id)}>{label}</button>
            )}
            <button type="button" aria-pressed={showSources} onClick={() => setShowSources((current) => !current)}>
              {showSources ? "Kaynak ayrıntılarını gizle" : "Kaynak ayrıntılarını göster"}</button>
            <button type="button" aria-pressed={showLayers} onClick={() => setShowLayers((current) => !current)}>
              {showLayers ? "Harita katmanlarını gizle" : "Harita katmanlarını göster"}</button>
            {parcel.length >= 3 && <button type="button" aria-pressed={showConceptualOverlays} onClick={() => {
              setShowConceptualOverlays((visible) => !visible);
              if (!showConceptualOverlays) setTerrainLayers((current) => ({ ...current, contours: true }));
            }}>
              {showConceptualOverlays ? "Kavramsal yerleşimi gizle" : "Kavramsal yerleşimi göster"}
            </button>}
            <button type="button" aria-pressed={showResults} onClick={() => setShowResults((current) => !current)}>
              {showResults ? "Hesap sonuçlarını gizle" : "Hesap sonuçlarını göster"}</button>
          </div>
        </details>
      </nav>
      <p className="arx-geo-source-note" role="note">{parcel.length
        ? "Sınır kaynağını ve imar doğrulama durumunu teknik sonuçlardan önce kontrol edin."
        : `${province || "Proje konumu"}${district ? ` / ${district}` : ""} başlangıç verisinden aktarıldı. Önce mahalle/köy, ada ve parseli seçin; harita yalnız seçilen parsel bulunduğunda sınır gösterecek.`}</p>
    </>}
    <section className="v109-parcel-center" data-record-state={parcelRecord.state}>
      <header>
        <div><span>V109 / PARSEL VERİ MERKEZİ</span><h3>Parsel kimliği, sınırı ve kaynağı tek kayıtta.</h3></div>
        <aside data-eligible={parcelRecord.projectEligible}>
          <i>{parcelRecord.projectEligible ? "✓" : "i"}</i>
          <span><b>{parcelRecord.projectEligible ? "Aktif projeye bağlı" : parcel.length ? "Sınır doğrulaması bekleniyor" : parcelIdentityComplete ? "Parsel kimliği hazır · sınır bekleniyor" : "Ada / parsel seçimi bekleniyor"}</b><small>{project.id} · {project.revision}</small></span>
        </aside>
      </header>
      <div className="v109-parcel-summary">
        <article><span>PARSEL KAYDI</span><b>{parcelRecord.reference}</b><small>{!block || !parcelNo ? "Ada / parsel seçimi bekleniyor" : !parcelRecord.geometry.valid ? "Parsel kimliği kayıtlı · sınır sorgusu bekleniyor" : parcelRecord.state === "identified" ? "TKGM açık servis kaydı" : parcelRecord.state === "user-supplied" ? "Kullanıcı mekânsal dosyası" : "Uzman doğrulaması gerekli"}</small></article>
        <article><span>SINIR GEOMETRİSİ</span><b>{parcelRecord.geometry.valid ? `${parcelRecord.geometry.vertexCount} köşe · ${parcelRecord.geometry.computedArea.toLocaleString("tr-TR", { maximumFractionDigits: 1 })} m²` : "Geçerli sınır bekleniyor"}</b><small>{parcelRecord.geometry.coordinateReferenceSystem} · {parcelRecord.evidence.officialCadastre ? "resmî kadastro" : "aplikasyon değildir"}</small>{parcelRecord.geometry.reportedArea !== null && <small>TKGM bildirilen: {parcelRecord.geometry.reportedArea.toLocaleString("tr-TR", { maximumFractionDigits: 2 })} m² · Fark: {Math.abs(parcelRecord.geometry.reportedArea - parcelRecord.geometry.computedArea).toLocaleString("tr-TR", { maximumFractionDigits: 2 })} m² (%{parcelRecord.geometry.areaVariancePercent?.toLocaleString("tr-TR", { maximumFractionDigits: 2 })}). Hesap, WGS84 koordinatlarından yerel düzlem yaklaşımıdır; aplikasyon alanı değildir.</small>}</article>
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
        <div className="geo-stage-toolbar"><div>{([{"id":"map","label":"2B Harita"},{"id":"terrain","label":"3B Arazi"},{"id":"data","label":"Veri / Koordinat"}] as const).map((view) => <button key={view.id} className={viewMode === view.id ? "active" : ""} onClick={() => setViewMode(view.id)}>{view.label}</button>)}</div>{simple && viewMode === "map" && parcel.length >= 3 && <button type="button" className="arx-geo-concept-toggle" aria-pressed={showConceptualOverlays} onClick={() => setShowConceptualOverlays((current) => !current)}>{showConceptualOverlays ? "Kavramsal yerleşimi gizle" : "Kavramsal yerleşimi göster"}</button>}<button onClick={fitToParcel} disabled={!parcel.length}>Parseli ekrana sığdır ⛶</button></div>
        <section className="v111-layer-dock" aria-label="Ortak GIS ve 3B arazi katmanları">
          <header><div><span>V111 / ORTAK HARİTA + 3B KATMANLARI</span><b>Bir seçim, iki görünüm, tek proje kaydı.</b></div><em data-trust={terrainModel.trust}>{terrainModel.basis === "measured-z" ? `${terrainModel.samples.measured} KOT · ${terrainModel.trust === "verified" ? "YETKİLİ BEYAN" : "KAYNAK DOSYA"}` : "KAVRAMSAL YÜZEY"}</em></header>
          <div>{terrainModel.layers.map((layer) => <label key={layer.id} data-available={layer.available}><input type="checkbox" checked={terrainLayers[layer.id]} onChange={() => toggleTerrainLayer(layer.id)} disabled={layer.id === "basemap" || !layer.available} /><span><b>{layer.label}</b><small>{layer.id === "basemap" ? (basemapStatus === "ready" ? "Uydu / sokak servisi erişilebilir" : "Harita altlığı hazırlanıyor") : layer.available ? terrainLayers[layer.id] ? "Görünür" : "Gizli" : "Veri bekliyor"}</small></span></label>)}</div>
          <footer><span>{terrainModel.source.authority}</span><b>{terrainModel.basis === "measured-z" ? `Kot ${terrainModel.elevation.minimum?.toFixed(2)}–${terrainModel.elevation.maximum?.toFixed(2)} m · ${terrainContours.length} eş yükselti parçası` : `%${slope} temsili eğim · plankote değildir`}</b></footer>
        </section>
        <div className={`geo-map-frame${viewMode !== "map" ? " hidden-view" : ""}`}><div ref={mapHostRef} className="geo-leaflet-map"></div><div className="geo-basemap-switch" role="group" aria-label="Harita altlığı">{([{ id: "satellite", label: "Uydu" }, { id: "street", label: "Sokak" }, { id: "hybrid", label: "Hibrit" }] as const).map((mode) => <button key={mode.id} type="button" className={basemapMode === mode.id ? "active" : ""} aria-pressed={basemapMode === mode.id} onClick={() => setBasemapMode(mode.id)}>{mode.label}</button>)}</div>{basemapWarning && <p className="geo-basemap-warning" role="status">{basemapWarning}</p>}<div className="geo-basemap-offline-label" role="note">{basemapStatus === "error" ? "Harita altlığı yüklenemedi · Koordinat görünümü açık" : !parcel.length ? (basemapStatus === "ready" ? `Harita altlığı · ${province || "konum"}${district ? ` / ${district}` : ""} · parsel seçimi bekleniyor` : "Harita yükleniyor · parsel seçimi bekleniyor") : parcelRecord.evidence.sourceKind === "tkgm-open-service" ? (basemapStatus === "ready" ? "Harita altlığı · Seçili parsel sınırı TKGM kaydından" : "Harita yükleniyor · seçili parsel sınırı mevcut") : (basemapStatus === "ready" ? "Harita altlığı · seçili sınır önizlemesi" : "Harita yükleniyor · sınır önizlemesi mevcut")}</div>{!mapReady && <div className="geo-map-loading"><i></i><b>{mapError || "Harita katmanı hazırlanıyor"}</b><small>Koordinat araçları çevrimdışı da kullanılabilir.</small></div>}<div className="geo-map-legend">{parcel.length ? <span className="parcel"><i></i>{parcelRecord.evidence.sourceKind === "tkgm-open-service" ? "TKGM parsel sınırı" : "Seçili parsel sınırı"}</span> : <span>Parsel seçimi bekleniyor</span>}{parcel.length >= 3 && showConceptualOverlays && <>{zoningFormReady && <span className="setback"><i></i>{massingModel.source.authoritative ? "Yapılaşabilir çekme zarfı" : "Kavramsal çekme zarfı · ön kontrol"}</span>}<span className="building"><i></i>Kavramsal ön kütle</span><span className={officialBoundaryLocked ? "point readonly" : "point"}><i></i>{officialBoundaryLocked ? "TKGM sınır noktası · salt okunur" : "Sınır noktası"}</span></>}</div>{!simple && <div className="geo-map-crosshair">+</div>}</div>
        {viewMode === "map" && showConceptualOverlays && zoningFormReady && !metrics.setbackPass && <p role="alert" className="geo-map-placement-warning"><b>Yerleşim ön kontrolü uyarısı.</b> {metrics.buildingFits && metrics.setbackAssessment.governing ? `Temsili Ön Kütle parsel içinde; en kritik ${setbackRoleLabel(metrics.setbackAssessment.governing.role)} kenarında mesafe ${metrics.setbackAssessment.governing.distance.toFixed(1)} m, gerekli ön kontrol mesafesi ${metrics.setbackAssessment.governing.required.toFixed(1)} m.` : "Temsili Ön Kütle parsel sınırını aşıyor veya sınırla kesişiyor."} Ön/yan/arka çekmeler kenar bazında ayrı kontrol edilir; bu sonuç kesin aplikasyon ve imar uygunluğu değildir.</p>}
        {viewMode === "map" && showConceptualOverlays && zoningFormReady && !zoningPrecheckPass && <p role="alert" className="geo-map-placement-warning geo-map-zoning-warning"><b>İmar ön kontrolü uyarısı.</b>{taksExceeded && <> TAKS %{metrics.coverage.toFixed(1)} &gt; girilen sınır %{maxCoverage.toFixed(1)}. Taban alanı {metrics.footprint.toFixed(0)} m², girdiye göre azami taban {metrics.allowedFootprint.toFixed(0)} m².</>}{kaksExceeded && <> KAKS {metrics.far.toFixed(2)} &gt; girilen sınır {maxFar.toFixed(2)}. Toplam alan {metrics.gross.toFixed(0)} m², girdiye göre azami emsal alan {metrics.allowedGross.toFixed(0)} m².</>}{hmaxExceeded && <> Yapı yüksekliği {metrics.buildingHeight.toFixed(1)} m &gt; girilen Hmax {maxHeight.toFixed(1)} m.</>} Bu sonuç doğrulanmamış imar girdileriyle yapılan ön kontroldür.</p>}
        {viewMode === "terrain" && <div className="geo-terrain-massing-control">
          <div><b>Temsili Ön Kütle</b><small>İmar ve yerleşim doğrulanmadan otomatik gösterilmez. Yalnız kavramsal ön yerleşimi incelemek için açın.</small></div>
          <button type="button" aria-pressed={showTerrainMassing} onClick={() => {
            setShowTerrainMassing((visible) => {
              const next = !visible;
              setTerrainLayers((current) => ({ ...current, "building-mass": next }));
              setFileNotice(next
                ? "Temsili ön kütle açıldı. Bu gösterim imar uygunluğu veya yerleşim onayı değildir."
                : "Temsili ön kütle gizlendi; 3B görünüm yalnız arazi ve parsel verisini gösteriyor.");
              return next;
            });
          }}>{showTerrainMassing ? "Temsili kütleyi gizle" : "Temsili kütleyi göster"}</button>
        </div>}
        {viewMode === "terrain" && showTerrainMassing && placementPrecheckWarning && <p role="alert" className="geo-caution"><b>Temsili ön kütle ön kontrol uyarısı:</b>{!metrics.setbackPass && <> Yapı parsel/çekme kontrolünü karşılamıyor.</>}{taksExceeded && <> TAKS %{metrics.coverage.toFixed(1)} / sınır %{maxCoverage.toFixed(1)}.</>}{kaksExceeded && <> KAKS {metrics.far.toFixed(2)} / sınır {maxFar.toFixed(2)}.</>}{hmaxExceeded && <> Yükseklik {metrics.buildingHeight.toFixed(1)} / Hmax {maxHeight.toFixed(1)} m.</>} Bu kavramsal yerleşim teknik uygunluk onayı değildir.</p>}
        {viewMode === "terrain" && <GeoTerrainViewer parcel={parcel} buildingWidth={buildingWidth} buildingDepth={buildingDepth} floors={floors} rotation={rotation} offsetEast={offsetEast} offsetNorth={offsetNorth} slope={slope} exaggeration={exaggeration} layers={terrainViewerLayers} terrainModel={terrainModel} />}
        {viewMode === "data" && <div className="geo-data-view"><header><div><span>KAYNAK CRS BEYANI</span><b>{sourceCrs}</b></div><div><span>İŞLEME DÜZLEMİ</span><b>WGS84 → lokal ENU · metre</b></div><div><span>VERİ STATÜSÜ</span><b>{dataStatus}</b></div></header><section className="v111-terrain-ledger"><article><span>YÜZEY TEMELİ</span><b>{terrainModel.basis === "measured-z" ? "Ölçülmüş Z / IDW" : "Parametrik eğim"}</b><small>{terrainModel.trust.toLocaleUpperCase("tr-TR")}</small></article><article><span>KOT ÖRNEĞİ</span><b>{terrainModel.samples.measured} / {terrainModel.samples.total}</b><small>Ölçülmüş / toplam nokta</small></article><article><span>{terrainModel.basis === "measured-z" ? "KOT ARALIĞI" : "PARAMETRİK KOT FARKI"}</span><b>{terrainModel.elevation.range.toFixed(2)} m</b><small>{terrainModel.basis === "measured-z" ? (terrainModel.elevation.datum === "source-declared" ? "Kaynak datum beyanı" : "Yerel bağıl düzlem") : "Ölçülmüş Z verisi yok"}</small></article><article><span>{terrainModel.basis === "measured-z" ? "EŞ YÜKSELTİ" : "TEMSİLİ EŞ YÜKSELTİ"}</span><b>{terrainContours.length}{terrainModel.basis === "measured-z" ? "" : " önizleme parçası"}</b><small>{terrainModel.basis === "measured-z" ? "Marching-squares önizleme parçası" : "Parametrik yüzeyden üretildi"}</small></article></section><div className="geo-data-table"><div className="head"><span>ID</span><span>LATITUDE</span><span>LONGITUDE</span><span>EAST / m</span><span>NORTH / m</span><span>Z / m</span></div>{parcel.map((point, index) => { const local = toLocalMeters(point, center); return <div key={`${point.lat}-${point.lng}-${index}`}><b>P{String(index + 1).padStart(2, "0")}</b><span>{point.lat.toFixed(8)}</span><span>{point.lng.toFixed(8)}</span><span>{local.east.toFixed(3)}</span><span>{local.north.toFixed(3)}</span><span>{point.alt?.toFixed(2) ?? "—"}</span></div>; })}</div><footer><p><b>Yerel ENU başlangıcı</b> Parsel merkezi (0,0) kabul edilir. East / North değerleri resmî pafta koordinatı değil, bu merkeze göre metre cinsinden yerel çalışma koordinatlarıdır.</p><p><b>CRS kontrolü</b> Hesap motoru koordinatları coğrafi derece olarak yorumlar ve parsel merkezi çevresinde lokal ENU düzlemine alır. Kaynak veri WGS84 değilse doğru EPSG dönüşümü yapılmadan alan ve mesafe sonuçları proje verisi sayılmaz.</p><p><b>Arazi kontrolü</b> {terrainModel.limitations[0]}</p></footer></div>}
        <div className="geo-connectors"><a href={`https://www.google.com/maps/search/?api=1&query=${center.lat},${center.lng}`} target="_blank" rel="noreferrer"><span>G</span><div><b>Google Maps’te aç</b><small>{parcelSource.kind === "sample" ? `ÖRNEK KONUM · ${center.lat.toFixed(6)}, ${center.lng.toFixed(6)}` : `${center.lat.toFixed(6)}, ${center.lng.toFixed(6)}`}</small></div><i>↗</i></a><a href={`https://earth.google.com/web/search/${center.lat},${center.lng}`} target="_blank" rel="noreferrer"><span>E</span><div><b>Google Earth’te aç</b><small>KML ile sınır ve kütle aktarın</small></div><i>↗</i></a><button onClick={exportKml} disabled={exportDisabled}><span>K</span><div><b>Earth KML paketini indir</b><small>{exportDisabled ? "Önce kaynaklı bir parsel sınırı oluşturun" : "Parsel + ön yapı poligonu"}</small></div><i>↓</i></button></div>
      </main>
      <aside className="geo-results"><span>CANLI TEKNİK ÖZET</span><div className="geo-primary-metric"><small>HESAPLANAN PARSEL ALANI</small><strong>{metrics.area.toLocaleString("tr-TR", { maximumFractionDigits: 1 })}<i>m²</i></strong><p>{parcel.length} köşe · {metrics.perimeter.toFixed(1)} m çevre</p></div><div className="geo-metric-grid"><article><span>Sınır kutusu</span><b>{metrics.width.toFixed(1)} × {metrics.depth.toFixed(1)} m</b></article><article><span>Yapı tabanı</span><b>{metrics.footprint.toLocaleString("tr-TR")} m²</b></article><article><span>TAKS / girdi · imar</span><b className={zoningFormReady ? (metrics.coverage > maxCoverage ? "risk" : "good") : ""}>{zoningFormReady ? `%${metrics.coverage.toFixed(1)} / %${maxCoverage.toFixed(1)}` : "İmar girdisi bekleniyor"}</b></article><article><span>KAKS / girdi · imar</span><b className={zoningFormReady ? (metrics.far > maxFar ? "risk" : "good") : ""}>{zoningFormReady ? `${metrics.far.toFixed(2)} / ${maxFar.toFixed(2)}` : "İmar girdisi bekleniyor"}</b></article><article><span>Yükseklik</span><b className={zoningFormReady ? (metrics.buildingHeight > maxHeight ? "risk" : "good") : ""}>{zoningFormReady ? `${metrics.buildingHeight.toFixed(1)} / ${maxHeight.toFixed(1)} m` : "İmar girdisi bekleniyor"}</b></article><article><span>Yapı nizamı</span><b>{zoning.buildingOrder || "Girilmedi"}</b></article></div><div className="geo-current-design"><span>İMAR & KÜTLE KONTROLÜ</span><h4>{usage}</h4><p>{system} · {floors} kat · {rotation}° yönlenme</p><div><small>İmar kaynağı</small><b>{zoningVerificationLabel(zoning.verification)}</b></div><div><small>İzinli taban / imar</small><b>{zoningFormReady ? `${metrics.allowedFootprint.toFixed(0)} m²` : "İmar girdisi bekleniyor"}</b></div><div><small>İzinli emsal alan / imar</small><b>{zoningFormReady ? `${metrics.allowedGross.toFixed(0)} m²` : "İmar girdisi bekleniyor"}</b></div><div><small>Park ihtiyacı</small><b>{metrics.parkingNeed} araç</b></div><div><small>Kritik kenar / çekme</small><b className={zoningFormReady ? (metrics.setbackPass ? "good" : "risk") : ""}>{zoningFormReady && metrics.setbackAssessment.governing ? `${setbackRoleLabel(metrics.setbackAssessment.governing.role)} · ${metrics.setbackAssessment.governing.distance.toFixed(1)} / ${metrics.setbackAssessment.governing.required.toFixed(1)} m` : "Çekme mesafeleri bekleniyor"}</b></div></div><div className="geo-validation"><span>VERİ DOĞRULAMA ZİNCİRİ</span>{[[metrics.geometryValid, "Kapalı ve kesişmesiz geometri"],[metrics.setbackPass, "Yapı parsel / çekme kontrolü"],[zoningFormReady && !taksExceeded && !kaksExceeded && !hmaxExceeded, "İmar girdileriyle ön uyum"],[Boolean(block && parcelNo), "Ada / parsel referansı"],[zoningSourceReady, "İmar kaynak bilgisi kayıtlı"],[zoning.verification === "approved-plan" || zoning.verification === "certified-document", "Onaylı imar kaynağı"],[dataStatus === "Onaylı aplikasyon verisi", "Resmî aplikasyon statüsü"]].map(([done, label]) => <p key={String(label)} className={done ? "done" : ""}><i>{done ? "✓" : ""}</i><span>{label}</span></p>)}</div><button className="geo-result-cta" onClick={() => {
        setActiveStage("export");
        setViewMode("data");
        setFileNotice("07 / Teknik çıktı paneli açıldı. İndirmek istediğiniz çıktı türünü seçin.");
        window.requestAnimationFrame(() => {
          document.querySelector(".geo-controls")?.scrollIntoView({ behavior: "smooth", block: "start" });
        });
      }}>Teknik çıktı paketini hazırlayın <span>↗</span></button></aside>
    </div>
    {!simple ? <footer className="geo-studio-foot"><b>Hukuki ve teknik sınır</b><p>Bu çalışma alanı erken karar, veri hazırlığı ve disiplinler arası koordinasyon içindir. Tapu/kadastro kaydı, aplikasyon, imar uygunluğu, zemin etüdü, mühendislik hesabı veya ruhsat projesi yerine geçmez. TKGM parsel kimliği; e-Plan/TUCBS katmanları, belediye e-İmar adaptörleri ve onaylı imar durumu belgesiyle kaynaklandırılır. Yetkili servis, protokol veya belge bulunmadan TAKS, KAKS, Hmax ve nizam değeri resmî hak olarak sunulmaz.</p></footer> : null}
  </section>;
}


