"use client";

import Link from "next/link";
import { parseParcelGeoJson, parcelOperationMatches } from "../lib/parcel-experience";
import { fetchTkgmJson as fetchTkgm, assertParcelResponseIdentity } from "../lib/tkgm-client";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createEGovernmentZoningSearch, resolveZoningAuthority, resolveZoningPortal, ZONING_AUTHORITY_ROUTES } from "../data/zoning-authorities";
import { polygonArea, type GeoPoint } from "../lib/geo";
import { createParcelRecord, resolveParcelSourceNetwork, parcelIdentityKey } from "../lib/parcel-record";
import { emptyParcelPlanning, restorePlanningScopes } from '../lib/parcel-zoning-scope';
import { isParcelIdentityReady } from '../lib/parcel-journey-gates';
import { createZoningDocumentAudit, extractZoningConditions, type ParsedZoningCondition } from "../lib/zoning-document-parser";
import {
  createZoningEvidenceBundle,
  createZoningEvidenceRecord,
  type ZoningEvidenceConditions,
  type ZoningEvidenceSourceType,
  type ZoningEvidenceVerification,
} from "../lib/zoning-evidence";
import { createZoningEnvelope } from "../lib/zoning-envelope";
import { createZoningHandoff } from "../lib/zoning-handoff";
import { createZoningReportIndex } from "../lib/zoning-report";
import { evaluateZoningRules } from "../lib/zoning-rule-engine";
import { analyzeParcelEdges } from "../lib/parcel-edge-analysis";
import { createLayeredDxf, downloadTextFile } from "../lib/engineering";
import { createCorporateTechnicalPdf } from "../lib/technical-sheet";
import { DEFAULT_ZONING, zoningVerificationLabel, type ZoningForm, type ZoningVerification } from "../lib/zoning";
import { useProjectKernel } from "./ProjectKernel";

type Step = "parcel" | "conditions" | "analysis" | "handoff";
type Option = { id: string; label: string };
type TkgmFeature = { geometry?: unknown; properties?: Record<string, unknown> };
type RecordValue = Record<string, unknown>;
type AdministrativeSource = "official" | "fallback";
type ParcelState = "idle" | "loading" | "identified" | "found" | "error";
type DiscoveryState = "idle" | "scanning" | "ready";
type DiscoverySource = {
  id: string;
  label: string;
  detail: string;
  status: "matched" | "available" | "verification-required";
  statusLabel: string;
  href?: string;
};

const STEPS: Array<{ id: Step; no: string; label: string; note: string }> = [
  { id: "parcel", no: "01", label: "Parsel", note: "Resmî kimlik ve geometri" },
  { id: "conditions", no: "02", label: "İmar koşulları", note: "Plan, nizam ve sınırlar" },
  { id: "analysis", no: "03", label: "Tasarım kontrolü", note: "Zarf ve uygunluk" },
  { id: "handoff", no: "04", label: "Aktarım & çıktı", note: "Proje zinciri ve pafta" },
];

function record(value: unknown): RecordValue {
  return value && typeof value === "object" && !Array.isArray(value) ? value as RecordValue : {};
}

function numberValue(value: unknown, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function textValue(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function administrativeOptions(data: RecordValue): Option[] {
  const features = Array.isArray(data.features) ? data.features as TkgmFeature[] : [];
  return features.map((feature) => {
    const properties = feature.properties ?? {};
    const id = properties.id ?? properties.ilId ?? properties.ilceId ?? properties.mahalleId;
    const label = String(properties.text ?? properties.ad ?? properties.name ?? properties.ilAd ?? properties.ilceAd ?? properties.mahalleAd ?? "").trim();
    return id === undefined || !label ? null : { id: String(id), label };
  }).filter((item): item is Option => Boolean(item)).sort((a, b) => a.label.localeCompare(b.label, "tr"));
}


function pointsFromGeometry(value: unknown): GeoPoint[] {
  const geometry = record(value);
  const type = String(geometry.type || "");
  const coordinates = geometry.coordinates;
  let ring: unknown = null;
  if (type === "Polygon" && Array.isArray(coordinates)) ring = coordinates[0];
  if (type === "MultiPolygon" && Array.isArray(coordinates) && Array.isArray(coordinates[0])) ring = coordinates[0][0];
  if (!Array.isArray(ring)) return [];
  const points = ring.map((item) => {
    if (!Array.isArray(item) || item.length < 2) return null;
    const lng = Number(item[0]);
    const lat = Number(item[1]);
    return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
  }).filter((point): point is GeoPoint => Boolean(point));
  if (points.length > 3) {
    const first = points[0];
    const last = points[points.length - 1];
    if (Math.abs(first.lat - last.lat) < 1e-9 && Math.abs(first.lng - last.lng) < 1e-9) points.pop();
  }
  return points;
}

function clampPositive(value: number, fallback: number) {
  return Number.isFinite(value) && value >= 0 ? value : fallback;
}

function evidenceSourceType(value: ZoningVerification): ZoningEvidenceSourceType {
  return {
    "user-declared": "user-declaration",
    "municipal-viewer": "municipal-viewer",
    "approved-plan": "approved-plan",
    "certified-document": "certified-document",
  }[value] as ZoningEvidenceSourceType;
}

function evidenceVerification(_value: ZoningVerification): ZoningEvidenceVerification {
  // Selecting a source type is only a declaration, never a completed expert review.
  return "self-declared";
}

function dateInputToIso(value: string, endOfDay = false) {
  if (!value) return null;
  return `${value}T${endOfDay ? "23:59:59" : "12:00:00"}.000Z`;
}

export function ZoningIntegrationCenter() {
  const { project, hydrated, patchModule } = useProjectKernel();
  const transferApplied = useRef("");
  const discoveryRef = useRef<HTMLElement>(null);
  const [step, setStep] = useState<Step>("parcel");
  const [provinceOptions, setProvinceOptions] = useState<Option[]>([]);
  const [districtOptions, setDistrictOptions] = useState<Option[]>([]);
  const [neighborhoodOptions, setNeighborhoodOptions] = useState<Option[]>([]);
  const [administrativeSource, setAdministrativeSource] = useState<AdministrativeSource>("fallback");
  const [provinceId, setProvinceId] = useState("");
  const [districtId, setDistrictId] = useState("");
  const [neighborhoodId, setNeighborhoodId] = useState("");
  const [province, setProvince] = useState("");
  const [district, setDistrict] = useState("");
  const [neighborhood, setNeighborhood] = useState("");
  const [block, setBlock] = useState("");
  const [parcelNo, setParcelNo] = useState("");
  const [parcelArea, setParcelArea] = useState(1000);
  const [parcelWidth, setParcelWidth] = useState(25);
  const [parcelDepth, setParcelDepth] = useState(40);
  const [parcelGeometry, setParcelGeometry] = useState<GeoPoint[]>([]);
  const [parcelState, setParcelState] = useState<ParcelState>("idle");
  const [parcelMessage, setParcelMessage] = useState("İl, ilçe, mahalle/köy, ada ve parsel seçerek resmî TKGM geometrisini çağırın.");
  const [discoveryState, setDiscoveryState] = useState<DiscoveryState>("idle");
  const [discoverySources, setDiscoverySources] = useState<DiscoverySource[]>([]);
  const [discoveryCheckedAt, setDiscoveryCheckedAt] = useState("");
  const [discoveryRequest, setDiscoveryRequest] = useState(0);
  const [zoning, setZoning] = useState<ZoningForm>(DEFAULT_ZONING);
  const [requestedFootprint, setRequestedFootprint] = useState(360);
  const [requestedGrossArea, setRequestedGrossArea] = useState(1080);
  const [requestedHeight, setRequestedHeight] = useState(12.5);
  const [typicalFloorHeight, setTypicalFloorHeight] = useState(3.1);
  const [roadWidth, setRoadWidth] = useState(15);
  const [cornerParcel, setCornerParcel] = useState(false);
  const [documentName, setDocumentName] = useState("");
  const [documentText, setDocumentText] = useState("");
  const [parsed, setParsed] = useState<ParsedZoningCondition[]>([]);
  const [documentMessage, setDocumentMessage] = useState("Metin katmanı olan belge metnini yapıştırabilir veya TXT yükleyebilirsiniz.");
  const [evidenceQueryDate, setEvidenceQueryDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [evidenceValidUntil, setEvidenceValidUntil] = useState("");
  const [handoffMessage, setHandoffMessage] = useState("");

  const parcelRequest = useRef({ key: "", sequence: 0, controller: null as AbortController | null });
  const selectedParcelKey = JSON.stringify([project.id, provinceId, districtId, neighborhoodId, block, parcelNo]);
  useLayoutEffect(() => {
    parcelRequest.current.controller?.abort();
    parcelRequest.current.sequence++;
    const previousKey = parcelRequest.current.key;
    parcelRequest.current.key = selectedParcelKey;
    if (previousKey && previousKey !== selectedParcelKey) {
      setParcelGeometry([]); setParcelArea(0); setParcelWidth(0); setParcelDepth(0);
      setParcelState("idle"); setDiscoveryState("idle"); setDiscoverySources([]);
      setZoning({...DEFAULT_ZONING, taks:0, kaks:0, hmax:0, frontSetback:0, sideSetback:0, rearSetback:0, verification:"user-declared", sourceDocument:""});
      setDocumentName(""); setDocumentText(""); setParsed([]);
      setParcelMessage("Parsel seçimi değişti. Yeni parseli sorgulayın; önceki geometri ve imar değerleri temizlendi.");
    }
    return () => { parcelRequest.current.controller?.abort(); parcelRequest.current.sequence++; };
  }, [selectedParcelKey]);

  const [directoryAttempt, setDirectoryAttempt] = useState(0);
  useEffect(() => {
    const c = new AbortController();
    fetchTkgm("idariYapi/ilListe", c.signal).then(data => {
      if (c.signal.aborted) return;
      setProvinceOptions(administrativeOptions(data)); setAdministrativeSource("official");
    }).catch(() => { if (!c.signal.aborted) { setProvinceOptions([]); setParcelMessage("İl listesi yüklenemedi. Yeniden deneyin."); } });
    return () => c.abort();
  }, [directoryAttempt]);
  useEffect(() => {
    const c = new AbortController();
    if (!/^\d+$/.test(provinceId)) return;
    fetchTkgm(`idariYapi/ilceListe/${provinceId}`, c.signal).then(data => {
      if (!c.signal.aborted) setDistrictOptions(administrativeOptions(data));
    }).catch(() => { if (!c.signal.aborted) { setDistrictOptions([]); setParcelMessage("İlçe listesi yüklenemedi. Yeniden deneyin."); } });
    return () => c.abort();
  }, [provinceId, directoryAttempt]);
  useEffect(() => {
    const c = new AbortController();
    if (!/^\d+$/.test(districtId)) return;
    fetchTkgm(`idariYapi/mahalleListe/${districtId}`, c.signal).then(data => {
      if (!c.signal.aborted) setNeighborhoodOptions(administrativeOptions(data));
    }).catch(() => { if (!c.signal.aborted) { setNeighborhoodOptions([]); setParcelMessage("Mahalle listesi yüklenemedi. Yeniden deneyin."); } });
    return () => c.abort();
  }, [districtId, directoryAttempt]);

  useEffect(() => {
    if (!hydrated || transferApplied.current === project.id) return;
    const restoreSequence = parcelRequest.current.sequence;
    const timer = window.setTimeout(() => {
      if (parcelRequest.current.sequence !== restoreSequence || provinceId || districtId || neighborhoodId || block || parcelNo) return;
      transferApplied.current = project.id;
      const saved = record(project.modules["geo-parcel"]);
      const metrics = record(saved.metrics);
      const savedZoning = record(saved.zoning);
      const savedParcel = Array.isArray(saved.parcel) ? saved.parcel.filter((point): point is GeoPoint => {
        const item = record(point);
        return Number.isFinite(Number(item.lat)) && Number.isFinite(Number(item.lng));
      }).map((point) => ({ lat: Number(point.lat), lng: Number(point.lng) })) : [];
      if (!Object.keys(saved).length) return;
      // Accept exactly this restore batch, without suppressing subsequent user-selection resets.
      parcelRequest.current.key = JSON.stringify([project.id, textValue(saved.provinceId), textValue(saved.districtId), textValue(saved.neighborhoodId), textValue(saved.block), textValue(saved.parcelNo)]);
      setProvince((current) => current || textValue(saved.province));
      setDistrict((current) => current || textValue(saved.district));
      setNeighborhood((current) => current || textValue(saved.neighborhood));
      setProvinceId((current) => current || textValue(saved.provinceId));
      setDistrictId((current) => current || textValue(saved.districtId));
      setNeighborhoodId((current) => current || textValue(saved.neighborhoodId));
      setBlock((current) => current || textValue(saved.block));
      setParcelNo((current) => current || textValue(saved.parcelNo));
      setParcelArea((current) => clampPositive(numberValue(metrics.area, current), current));
      setParcelWidth((current) => clampPositive(numberValue(saved.parcelWidth, numberValue(metrics.width, current)), current));
      setParcelDepth((current) => clampPositive(numberValue(saved.parcelDepth, numberValue(metrics.depth, current)), current));
      setParcelGeometry(savedParcel);
      if (Object.keys(savedZoning).length) setZoning((current) => ({
        ...current,
        ...savedZoning,
        taks: numberValue(savedZoning.taks, current.taks),
        kaks: numberValue(savedZoning.kaks, current.kaks),
        hmax: numberValue(savedZoning.hmax, current.hmax),
        frontSetback: numberValue(savedZoning.frontSetback, current.frontSetback),
        sideSetback: numberValue(savedZoning.sideSetback, current.sideSetback),
        rearSetback: numberValue(savedZoning.rearSetback, current.rearSetback),
        verification: textValue(savedZoning.verification, current.verification) as ZoningVerification,
      }));
      setParcelState(savedParcel.length >= 3 ? "found" : "idle");
      setParcelMessage(savedParcel.length >= 3 ? "Kayıtlı ARKEMX parsel geometrisi ve imar girdileri çalışma alanına aktarıldı." : "Kayıtlı proje kimliği aktarıldı; resmî sınır doğrulaması bekleniyor.");
      if (textValue(saved.block) && textValue(saved.parcelNo)) {
        setDiscoveryState("scanning");
        setDiscoveryRequest((current) => current + 1);
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [hydrated, project.modules]);

  const parcelReference = [province, district, neighborhood, block && `Ada ${block}`, parcelNo && `Parsel ${parcelNo}`].filter(Boolean).join(" / ") || "Parsel seçimi bekleniyor";
  const authority = useMemo(() => resolveZoningAuthority(province, district, neighborhood), [province, district, neighborhood]);
  const localPortal = useMemo(() => resolveZoningPortal(province, district, neighborhood), [province, district, neighborhood]);
  const hasSourceConditions = zoning.verification !== "user-declared" && Boolean(
    zoning.sourceDocument || zoning.sourceUrl || zoning.planId || zoning.planName,
  );
  const envelope = useMemo(() => createZoningEnvelope({
    parcelWidth,
    parcelDepth,
    parcelArea,
    taks: zoning.taks,
    kaks: zoning.kaks,
    hmax: zoning.hmax,
    front: zoning.frontSetback,
    side: zoning.sideSetback,
    rear: zoning.rearSetback,
    typicalFloorHeight,
  }), [parcelArea, parcelDepth, parcelWidth, typicalFloorHeight, zoning]);
  const ruleResult = useMemo(() => evaluateZoningRules({
    parcelArea,
    taks: zoning.taks,
    kaks: zoning.kaks,
    hmax: zoning.hmax,
    frontSetback: zoning.frontSetback,
    sideSetback: zoning.sideSetback,
    rearSetback: zoning.rearSetback,
    buildingOrder: zoning.buildingOrder,
    requestedFootprint,
    requestedGrossArea,
    requestedHeight,
  }), [parcelArea, requestedFootprint, requestedGrossArea, requestedHeight, zoning]);
  const edgeAnalysis = useMemo(() => analyzeParcelEdges([
    { length: parcelWidth, road: true, roadWidth, direction: "Ön cephe" },
    { length: parcelDepth, road: cornerParcel, roadWidth: cornerParcel ? roadWidth : undefined, direction: "Yan cephe" },
    { length: parcelWidth, road: false, direction: "Arka cephe" },
    { length: parcelDepth, road: false, direction: "Yan komşu" },
  ]), [cornerParcel, parcelDepth, parcelWidth, roadWidth]);
  const handoff = useMemo(() => createZoningHandoff({
    parcelReference,
    province,
    district,
    parcelArea,
    buildingOrder: zoning.buildingOrder,
    taks: zoning.taks,
    kaks: zoning.kaks,
    hmax: zoning.hmax,
    footprint: envelope.footprint,
    grossArea: envelope.grossArea,
    floors: envelope.floors,
    geometryStatus: parcelGeometry.length >= 3 ? "official-or-imported-geometry" : "conceptual",
    evidenceStatus: zoning.verification,
  }), [district, envelope, parcelArea, parcelGeometry.length, parcelReference, province, zoning]);

  const zoningEvidenceBundle = useMemo(() => {
    const authorityLabel = authority?.administrativeRoute || localPortal?.authority || "Kullanıcı / kaynak kurumu bekleniyor";
    const hasExplicitSource = zoning.verification !== "user-declared" || Boolean(
      zoning.sourceDocument || zoning.sourceUrl || zoning.planId || zoning.planName,
    );
    const records = [createZoningEvidenceRecord({
      id: `active-${zoning.verification}`,
      label: zoning.sourceDocument || zoningVerificationLabel(zoning.verification),
      authority: authorityLabel,
      sourceType: evidenceSourceType(zoning.verification),
      queriedAt: dateInputToIso(evidenceQueryDate) || new Date().toISOString(),
      validUntil: dateInputToIso(evidenceValidUntil, true),
      url: zoning.sourceUrl || (zoning.verification === "municipal-viewer" ? localPortal?.href : null) || null,
      documentReference: zoning.sourceDocument || zoning.planId || null,
      verification: evidenceVerification(zoning.verification),
      conditions: hasExplicitSource ? {
        landUse: zoning.landUse,
        buildingOrder: zoning.buildingOrder,
        taks: zoning.taks,
        kaks: zoning.kaks,
        hmax: zoning.hmax,
        frontSetback: zoning.frontSetback,
        sideSetback: zoning.sideSetback,
        rearSetback: zoning.rearSetback,
      } : {},
    })];
    if (parsed.length) {
      const parsedConditions = Object.fromEntries(
        parsed.map((item) => [item.field, item.value]),
      ) as ZoningEvidenceConditions;
      records.push(createZoningEvidenceRecord({
        id: "document-extraction",
        label: documentName || "Belge metni koşul adayları",
        authority: authorityLabel,
        sourceType: "user-document",
        queriedAt: dateInputToIso(evidenceQueryDate) || new Date().toISOString(),
        validUntil: dateInputToIso(evidenceValidUntil, true),
        url: zoning.sourceUrl || null,
        documentReference: documentName || zoning.planId || null,
        verification: "text-extraction",
        conditions: parsedConditions,
      }));
    }
    return createZoningEvidenceBundle({
      parcelReference,
      generatedAt: dateInputToIso(evidenceQueryDate) || new Date().toISOString(),
      records,
    });
  }, [authority?.administrativeRoute, documentName, evidenceQueryDate, evidenceValidUntil, localPortal?.authority, localPortal?.href, parcelReference, parsed, zoning]);

  useEffect(() => {
    if (!discoveryRequest || !province || !district || !block || !parcelNo) return;
    const timer = window.setTimeout(() => {
      const sources: DiscoverySource[] = [
        {
          id: "parcel",
          label: "TKGM parsel kimliği",
          detail: parcelGeometry.length >= 3
            ? `${parcelGeometry.length} köşeli sınır geometrisi proje çekirdeğine bağlandı.`
            : "Ada/parsel kimliği kaydedildi; resmî sınır geometrisi bağlantı veya doğrulanmış dosya bekliyor.",
          status: parcelGeometry.length >= 3 ? "matched" : "verification-required",
          statusLabel: parcelGeometry.length >= 3 ? "EŞLEŞTİ" : "SINIR BEKLİYOR",
          href: "https://parselsorgu.tkgm.gov.tr/",
        },
        {
          id: "plan",
          label: "Bakanlık e-Plan",
          detail: "Plan, pafta, plan işlem numarası ve plan notu araştırma rotası hazır.",
          status: "available",
          statusLabel: "RESMÎ GÖRÜNTÜLEYİCİ",
          href: "https://eplan.csb.gov.tr/",
        },
        {
          id: "municipality",
          label: localPortal?.label || "Yetkili yerel idare",
          detail: localPortal
            ? `${localPortal.limitation} Bağlantı ${localPortal.verifiedAt} tarihinde kontrol edildi.`
            : `${authority?.administrativeRoute || "Yetkili belediye/idare"} için parsel bazlı e-İmar adaptörü veya onaylı belge gerekir.`,
          status: localPortal ? "available" : "verification-required",
          statusLabel: localPortal ? (localPortal.queryMode === "e-government-service" ? "E-DEVLET SERVİSİ" : "RESMÎ KAYNAĞA YÖNLENDİRME") : "YETKİ / KAYNAK DOĞRULANMALI",
          href: localPortal?.href,
        },
        {
          id: "government-directory",
          label: "e-Devlet belediye hizmetleri",
          detail: `${province} ${district} için resmî “İmar Durum Bilgisi Sorgulama” hizmeti dizininde arama bağlantısı hazır. Hizmet kapsamı belediyeye göre değişebilir.`,
          status: "available",
          statusLabel: "RESMÎ HİZMET DİZİNİ",
          href: createEGovernmentZoningSearch(province, district),
        },
        {
          id: "conditions",
          label: "Yapılaşma koşulları",
          detail: hasSourceConditions
            ? `${zoningVerificationLabel(zoning.verification)}. Kayıtlı koşullar otomatik sonuç kartına alındı.`
            : "TAKS, KAKS/emsal, Hmax/Yençok, nizam ve çekmeler için onaylı plan veya imar durumu belgesi bekleniyor.",
          status: hasSourceConditions ? "matched" : "verification-required",
          statusLabel: hasSourceConditions ? "KAYNAK BEYANI VAR / İNCELEME GEREKLİ" : "DOĞRULAMA GEREKLİ",
        },
      ];
      setDiscoverySources(sources);
      setDiscoveryCheckedAt(new Intl.DateTimeFormat("tr-TR", {
        dateStyle: "short",
        timeStyle: "short",
      }).format(new Date()));
      setDiscoveryState("ready");
      window.requestAnimationFrame(() => discoveryRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }));
    }, 180);
    return () => window.clearTimeout(timer);
  }, [
    authority?.administrativeRoute,
    block,
    discoveryRequest,
    district,
    hasSourceConditions,
    localPortal,
    parcelGeometry.length,
    parcelNo,
    province,
    zoning.verification,
  ]);

  const findParcel = async () => {
    if (!neighborhoodId || !block.trim() || !parcelNo.trim()) {
      setParcelState("error");
      setParcelMessage("Parsel sorgusu için il, ilçe, mahalle/köy, ada ve parsel alanlarının tamamını seçin.");
      return;
    }
    if (!/^\d+$/.test(neighborhoodId)) return;
    const queryKey = parcelRequest.current.key;
    const sequence = ++parcelRequest.current.sequence;
    parcelRequest.current.controller?.abort();
    const controller = new AbortController(); parcelRequest.current.controller = controller;
    const isCurrent = () => !controller.signal.aborted && parcelOperationMatches(sequence, parcelRequest.current.sequence, queryKey, parcelRequest.current.key);
    setParcelState("loading");
    setParcelMessage("TKGM parsel geometrisi sorgulanıyor…");
    try {
      const data = await fetchTkgm(`parsel/${neighborhoodId}/${encodeURIComponent(block.trim())}/${encodeURIComponent(parcelNo.trim())}`, controller.signal);
      if (!isCurrent()) return;
      const features = Array.isArray(data.features) ? data.features as TkgmFeature[] : [];
      assertParcelResponseIdentity(record(features[0]?.properties ?? data.properties), { provinceId, districtId, neighborhoodId, block, parcelNo });
      const points = parseParcelGeoJson(data);
      if (points.length < 3) throw new Error("Parsel geometrisi bulunamadı.");
      const area = polygonArea(points);
      setParcelGeometry(points);
      if (area > 1) setParcelArea(Number(area.toFixed(2)));
      setParcelState("found");
      setParcelMessage(`Parsel bulundu. ${points.length} köşe ve ${area.toLocaleString("tr-TR", { maximumFractionDigits: 1 })} m² geometri proje çekirdeğine alındı.`);
      patchModule("geo-parcel", {
        ...record(project.modules["geo-parcel"]),
        reference: parcelReference,
        province, provinceId, district, districtId, neighborhood, neighborhoodId, block, parcelNo,
        parcel: points,
        metrics: { ...record(record(project.modules["geo-parcel"]).metrics), area, geometryValid: true },
        parcelRecord: createParcelRecord({
          identity: { province, district, neighborhood, block, parcelNo },
          geometry: points,
          source: {
            kind: "tkgm-open-service",
            authority: "Tapu ve Kadastro Genel Müdürlüğü",
            label: "TKGM MEGSİS açık servis yanıtı",
            capturedAt: new Date().toISOString(),
            url: "https://parselsorgu.tkgm.gov.tr/",
          },
        }),
        parcelSourceNetwork: resolveParcelSourceNetwork(province, district, neighborhood),
        dataStatus: "TKGM MEGSİS geometrisi bulundu · tapu/ruhsat belgesi değildir",
        status: "Resmî parsel geometrisi imar çalışma alanına bağlandı",
      });
      setDiscoveryState("scanning");
      setDiscoveryRequest((current) => current + 1);
    } catch (error) {
      if (!isCurrent()) return;
      setParcelState("error");
      setParcelMessage(error instanceof Error ? error.message : "Parsel bulunamadı.");
    }
  };

  const readDocument = async (file?: File) => {
    if (!file) return;
    setDocumentName(file.name);
    if (file.name.toLocaleLowerCase("tr-TR").endsWith(".pdf")) {
      setDocumentMessage("PDF için otomatik OCR bağlı değildir. Hatalı değer üretmemek için belgedeki metni aşağıdaki alana yapıştırın.");
      return;
    }
    const text = await file.text();
    setDocumentText(text);
    const values = extractZoningConditions(text);
    setParsed(values);
    setDocumentMessage(values.length ? `${values.length} koşul adayı bulundu; değerleri belgenin aslıyla doğrulayın.` : "Koşul bulunamadı; belge metnini kontrol edin.");
  };

  const applyParsedValues = () => {
    const next = { ...zoning };
    parsed.filter(item => item.confidence === 'high').forEach((item) => {
      if (item.field === "buildingOrder" && typeof item.value === "string") {
        next.buildingOrder = item.value;
        return;
      }
      const value = Number(String(item.value).replace(",", ".").match(/\d+(?:\.\d+)?/)?.[0]);
      if (!Number.isFinite(value)) return;
      if (item.field === "taks") next.taks = value;
      if (item.field === "kaks") next.kaks = value;
      if (item.field === "hmax") next.hmax = value;
      if (item.field === "frontSetback") next.frontSetback = value;
      if (item.field === "sideSetback") next.sideSetback = value;
      if (item.field === "rearSetback") next.rearSetback = value;
    });
    next.sourceDocument = documentName;
    next.verification = "user-declared";
    setZoning(next);
    setDocumentMessage("Okunan değerler forma aktarıldı. Kaynak belge ve yetkili idare kontrolü hâlâ zorunludur.");
  };

  const sendHandoff = () => {
    const identity = { province, district, neighborhood, block, parcelNo };
    if (!isParcelIdentityReady(identity)) { setHandoffMessage('İl, ilçe, mahalle, ada ve parsel bilgilerini tamamlayın. İmar değerleri belirsiz bir parsele bağlanmadı.'); return; }
    const scopeKey = parcelIdentityKey(identity);
    const geo = record(project.modules['geo-parcel']);
    const scopes = restorePlanningScopes(geo.planningScopes);
    const scopedDraft = scopes[scopeKey] ?? emptyParcelPlanning();
    patchModule("zoning-integration", {
      ...handoff,
      ruleResult,
      edgeAnalysis,
      zoningEvidenceBundle,
      handoffEligible: zoningEvidenceBundle.status !== "conflict",
      source: { authority: authority?.administrativeRoute || "", documentName, documentAudit: createZoningDocumentAudit(documentName, parsed) },
      status: zoningEvidenceBundle.status === "conflict"
        ? "Kaynak çatışması kaydedildi; uzman incelemesi bekleniyor"
        : "İmar koşulları ve yapı zarfı proje çekirdeğine aktarıldı",
    });
    patchModule("geo-parcel", {
      ...geo,
      // Conditions belong to this exact parcel; never reassign an existing boundary or guess net area.
      ...(zoningEvidenceBundle.status === 'conflict' ? {} : { planningScopes: { ...scopes, [scopeKey]: { ...scopedDraft, zoning: { ...zoning }, mode: 'zoning', inputsConfirmed: false } } }),
      zoningEvidenceBundle,
      status: zoningEvidenceBundle.status === "conflict"
        ? "Parsel kanıtları kaydedildi; çelişkili imar değeri projeye uygulanmadı"
        : "Parsel ve imar verisi doğrulama statüsüyle güncellendi",
    });
    setHandoffMessage(zoningEvidenceBundle.status === "conflict"
      ? "Kanıt seti kaydedildi. Çelişkili alanlar seçilmedi; uzman incelemesi tamamlanmadan tasarım limiti güncellenmedi."
      : "İmar girdileri bu parselin Arsa Rehberi kaydına aktarıldı. Net imar alanını, eksik değerleri ve kaynakları 3. adımda gözden geçirin; sınır geometrisi değiştirilmedi.");
  };

  const reportIndex = createZoningReportIndex({
    projectCode: project.id,
    parcelReference,
    authority: authority?.administrativeRoute || "",
    evidence: zoning.verification,
    taks: zoning.taks,
    kaks: zoning.kaks,
    hmax: zoning.hmax,
    buildingOrder: zoning.buildingOrder,
  });

  const exportReportPdf = async () => {
    const insetX = Math.min(zoning.sideSetback, parcelWidth / 2);
    const pdf = await createCorporateTechnicalPdf({
      projectName: `${province || "Türkiye"} / ${district || "İmar"} Çalışması`,
      projectCode: project.id,
      module: "ARKEMX / İMAR ENTEGRASYONU",
      drawingTitle: "Parsel Bazlı İmar Ön Değerlendirme",
      drawingSubtitle: parcelReference,
      revision: project.revision,
      status: zoningVerificationLabel(zoning.verification),
      sheetNo: "IMR-001",
      scale: "Şematik / ölçeksiz",
      coordinateSystem: project.coordinateReference,
      preparedBy: "ARKEMX",
      checkedBy: "Yetkili idare doğrulaması gerekli",
      polylines: [
        { role: "secondary", closed: true, points: [{ x: 0, y: 0 }, { x: parcelWidth, y: 0 }, { x: parcelWidth, y: parcelDepth }, { x: 0, y: parcelDepth }] },
        { role: "primary", closed: true, points: [{ x: insetX, y: zoning.frontSetback }, { x: parcelWidth - insetX, y: zoning.frontSetback }, { x: parcelWidth - insetX, y: parcelDepth - zoning.rearSetback }, { x: insetX, y: parcelDepth - zoning.rearSetback }] },
      ],
      metrics: [["Parsel", `${parcelArea.toFixed(1)} m²`], ["TAKS", zoning.taks.toFixed(2)], ["KAKS / Emsal", zoning.kaks.toFixed(2)], ["Hmax", `${zoning.hmax.toFixed(2)} m`], ["Nizam", zoning.buildingOrder]],
      notes: [zoningVerificationLabel(zoning.verification), authority?.limitation || "", reportIndex.disclaimer],
    });
    downloadTextFile(`${project.id}-imar-on-degerlendirme.pdf`, pdf, "application/pdf");
  };

  const exportReportDxf = () => {
    const insetX = Math.min(zoning.sideSetback, parcelWidth / 2);
    const dxf = createLayeredDxf({
      title: `ARKEM IMAR ZARFI / ${parcelReference}`,
      width: parcelWidth,
      depth: parcelDepth,
      polylines: [
        { layer: "PARSEL", points: [{ x: 0, y: 0 }, { x: parcelWidth, y: 0 }, { x: parcelWidth, y: parcelDepth }, { x: 0, y: parcelDepth }] },
        { layer: "IMAR_ZARFI", points: [{ x: insetX, y: zoning.frontSetback }, { x: parcelWidth - insetX, y: zoning.frontSetback }, { x: parcelWidth - insetX, y: parcelDepth - zoning.rearSetback }, { x: insetX, y: parcelDepth - zoning.rearSetback }] },
      ],
      notes: [`TAKS ${zoning.taks.toFixed(2)} / KAKS ${zoning.kaks.toFixed(2)} / HMAX ${zoning.hmax.toFixed(2)} m`, zoningVerificationLabel(zoning.verification), authority?.limitation || ""],
      sheet: { projectName: `${province} / ${district}`, projectCode: project.id, module: "IMAR ENTEGRASYONU", drawingTitle: "PARSEL VE IMAR ZARFI", drawingNo: "IMR-001", revision: project.revision, status: zoning.verification, coordinateSystem: project.coordinateReference, scale: "MODEL 1:1", preparedBy: "ARKEMX", checkedBy: "YETKILI IDARE DOGRULAMASI GEREKLI" },
    });
    downloadTextFile(`${project.id}-imar-zarfi.dxf`, dxf, "application/dxf");
  };

  return <div className="zoning-workbench">
    <div className="module-example-notice"><b>Kaynak türü seçimi belge doğrulaması değildir.</b><p>Bu alan beyan edilen koşullarla aritmetik ön kontrol üretir. Planın geçerliliği, gerçek çekme mesafesi geometrisi ve yetkili idare onayı incelenmedi. PDF ve DXF yetkili idare tarafından kontrol edilmiş belge değildir.</p></div>
    <header className="zoning-workbench-head">
      <div><span>ARKEMX / İMAR ÇALIŞMA ALANI</span><h2>Parseli seçin.<br/><em>Koşulu kanıtıyla yönetin.</em></h2></div>
      <aside><b>{ruleResult.pass ? "ÖN KONTROL UYUMLU" : "REVİZYON GEREKİYOR"}</b><small>{zoningVerificationLabel(zoning.verification)}</small><strong>{parcelReference}</strong></aside>
    </header>

    <nav className="zoning-steps" aria-label="İmar çalışma adımları">
      {STEPS.map((item) => <button type="button" key={item.id} className={step === item.id ? "active" : ""} onClick={() => setStep(item.id)}><i>{item.no}</i><span><b>{item.label}</b><small>{item.note}</small></span></button>)}
    </nav>

    {step === "parcel" && <section className="zoning-stage">
      <div className="zoning-stage-intro"><span>01 / RESMÎ PARSEL KİMLİĞİ</span><h3>İdari sırayla seçin; geometriyi tek seferde projeye alın.</h3><p>{administrativeSource === "official" ? "TKGM MEGSİS bağlantısı canlı. İl, ilçe ve mahalle/köy listeleri resmî servis kimlikleriyle yükleniyor." : "Seçim listesi bekleniyor. Kaynak yanıt vermediğinde gerçek dışı kimlik üretilmez."}</p></div>
      <button type="button" onClick={() => setDirectoryAttempt(n => n + 1)}>Seçim listesini yenile</button><div className="zoning-form-grid">
        <label>İl<select value={provinceId} onChange={(event) => { const id = event.target.value; const selectedProvince = provinceOptions.find((item) => item.id === id)?.label || ""; setProvinceId(id); setProvince(selectedProvince); setDistrictId(""); setDistrict(""); setDistrictOptions([]); setNeighborhoodId(""); setNeighborhood(""); setNeighborhoodOptions([]); }}><option value="">İl seçin</option>{provinceOptions.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
        <label>İlçe<select value={districtId} disabled={!provinceId} onChange={(event) => { const id = event.target.value; setDistrictId(id); setDistrict(districtOptions.find((item) => item.id === id)?.label || ""); setNeighborhoodId(""); setNeighborhood(""); setNeighborhoodOptions([]); }}><option value="">İlçe seçin</option>{districtOptions.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
        <label>Mahalle / köy<select value={neighborhoodId} disabled={!districtId} onChange={(event) => { const id = event.target.value; setNeighborhoodId(id); setNeighborhood(neighborhoodOptions.find((item) => item.id === id)?.label || ""); }}><option value="">Mahalle / köy seçin</option>{neighborhoodOptions.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
        <label>Ada<input value={block} inputMode="numeric" onChange={(event) => setBlock(event.target.value.replace(/[^\d/-]/g, ""))} placeholder="Örn. 115"/></label>
        <label>Parsel<input value={parcelNo} inputMode="numeric" onChange={(event) => setParcelNo(event.target.value.replace(/[^\d/-]/g, ""))} placeholder="Örn. 46"/></label>
        <button type="button" className="zoning-primary" onClick={() => void findParcel()} disabled={parcelState === "loading"}>{parcelState === "loading" ? "Parsel aranıyor…" : administrativeSource === "official" ? "Parseli bul ve projeye al" : "Parsel kimliğini projeye kaydet"} <span>→</span></button>
      </div>
      <div className={`zoning-status ${parcelState}`} role="status"><i>{parcelState === "found" || parcelState === "identified" ? "✓" : parcelState === "error" ? "!" : "i"}</i><div><b>{parcelReference}</b><p>{parcelMessage}</p></div><Link href="/arsa-fizibilite-studyosu">Harita stüdyosunu açın ↗</Link></div>
      {discoveryState !== "idle" && <section ref={discoveryRef} className={`zoning-auto-discovery ${discoveryState}`} aria-live="polite">
        <header><div><span>İMAR KAYNAKLARI VE BEYANLAR</span><h4>{discoveryState === "scanning" ? "Resmî kaynak rotası taranıyor…" : "İmar kaynakları ve kayıtlı beyanlar gösteriliyor."}</h4></div><aside><b>{discoveryState === "scanning" ? "KAYNAKLAR KONTROL EDİLİYOR" : `${discoverySources.filter((item) => item.status !== "verification-required").length}/${discoverySources.length} KAYNAK HAZIR`}</b><small>{discoveryCheckedAt || parcelReference}</small></aside></header>
        {discoveryState === "ready" && <>
          <div className="zoning-discovery-sources">{discoverySources.map((source, index) => <article key={source.id} data-status={source.status}><i>{String(index + 1).padStart(2, "0")}</i><div><b>{source.label}</b><p>{source.detail}</p><em>{source.statusLabel}</em></div>{source.href ? <a href={source.href} target="_blank" rel="noreferrer" aria-label={`${source.label} kaynağını açın`}>↗</a> : <span aria-hidden="true">—</span>}</article>)}</div>
          <div className="zoning-discovery-result">
            <div><span>KULLANIM</span><b>{hasSourceConditions ? zoning.landUse : "Resmî kayıt bekleniyor"}</b></div>
            <div><span>NİZAM</span><b>{hasSourceConditions ? zoning.buildingOrder : "—"}</b></div>
            <div><span>TAKS</span><b>{hasSourceConditions ? zoning.taks.toFixed(2) : "—"}</b></div>
            <div><span>KAKS / EMSAL</span><b>{hasSourceConditions ? zoning.kaks.toFixed(2) : "—"}</b></div>
            <div><span>HMAX / YENÇOK</span><b>{hasSourceConditions ? `${zoning.hmax.toFixed(2)} m` : "—"}</b></div>
            <button type="button" onClick={() => setStep("conditions")}>{hasSourceConditions ? "Beyan edilen koşulları inceleyin" : "Belge ve plan koşullarını tamamlayın"} <span>→</span></button>
          </div>
          <p className="zoning-discovery-note">Otomatik bulucu yalnız erişilebilen resmî görüntüleyici, kayıtlı proje verisi ve kullanıcı belgesini eşleştirir. Açık servis sunulmayan belediyelerde yapılaşma hakkı tahmin edilmez.</p>
        </>}
      </section>}
      <div className="zoning-geometry-summary"><article><span>PARSEL ALANI</span><b>{parcelArea.toLocaleString("tr-TR", { maximumFractionDigits: 1 })} m²</b><small>{parcelGeometry.length >= 3 ? `${parcelGeometry.length} köşe · geometri bağlı` : "Kullanıcı değeri"}</small></article><label>Yaklaşık genişlik<input type="number" min="1" step=".1" value={parcelWidth} onChange={(event) => setParcelWidth(clampPositive(Number(event.target.value), 1))}/><small>metre</small></label><label>Yaklaşık derinlik<input type="number" min="1" step=".1" value={parcelDepth} onChange={(event) => setParcelDepth(clampPositive(Number(event.target.value), 1))}/><small>metre</small></label></div>
      <div className="zoning-next"><button type="button" onClick={() => setStep("conditions")}>İmar koşullarına geçin <span>→</span></button></div>
    </section>}

    {step === "conditions" && <section className="zoning-stage">
      <div className="zoning-stage-intro"><span>02 / PLAN VE İMAR KOŞULLARI</span><h3>Değeri kaynağından ayırmadan kaydedin.</h3><p>Ulusal, açık ve tekil bir TAKS/KAKS/Hmax servisi bulunmadığı için resmî plan, plan notu ve yetkili idare belgesi birlikte izlenir.</p></div>
      <div className="zoning-condition-layout">
        <div className="zoning-form-grid conditions">
          <label>Kullanım kararı<input value={zoning.landUse} onChange={(event) => setZoning({ ...zoning, landUse: event.target.value })} placeholder="Konut, ticaret, sanayi…"/></label>
          <label>Yapı nizamı<select value={zoning.buildingOrder} onChange={(event) => setZoning({ ...zoning, buildingOrder: event.target.value })}><option>Ayrık nizam</option><option>Bitişik nizam</option><option>Blok nizam</option><option>Plan notuna göre</option></select></label>
          <label>TAKS<input type="number" min="0" max="1" step=".01" value={zoning.taks} onChange={(event) => setZoning({ ...zoning, taks: clampPositive(Number(event.target.value), 0) })}/></label>
          <label>KAKS / Emsal<input type="number" min="0" step=".05" value={zoning.kaks} onChange={(event) => setZoning({ ...zoning, kaks: clampPositive(Number(event.target.value), 0) })}/></label>
          <label>Hmax / Yençok (m)<input type="number" min="0" step=".1" value={zoning.hmax} onChange={(event) => setZoning({ ...zoning, hmax: clampPositive(Number(event.target.value), 0) })}/></label>
          <label>Ön bahçe (m)<input type="number" min="0" step=".1" value={zoning.frontSetback} onChange={(event) => setZoning({ ...zoning, frontSetback: clampPositive(Number(event.target.value), 0) })}/></label>
          <label>Yan bahçe (m)<input type="number" min="0" step=".1" value={zoning.sideSetback} onChange={(event) => setZoning({ ...zoning, sideSetback: clampPositive(Number(event.target.value), 0) })}/></label>
          <label>Arka bahçe (m)<input type="number" min="0" step=".1" value={zoning.rearSetback} onChange={(event) => setZoning({ ...zoning, rearSetback: clampPositive(Number(event.target.value), 0) })}/></label>
          <label>Plan adı<input value={zoning.planName} onChange={(event) => setZoning({ ...zoning, planName: event.target.value })}/></label>
          <label>Plan / PIN no<input value={zoning.planId} onChange={(event) => setZoning({ ...zoning, planId: event.target.value })}/></label>
          <label>Kanıt statüsü<select value={zoning.verification} onChange={(event) => setZoning({ ...zoning, verification: event.target.value as ZoningVerification })}><option value="user-declared">Kullanıcı girdisi</option><option value="municipal-viewer">Belediye e-İmar ekranı</option><option value="approved-plan">Onaylı plan / plan notu</option><option value="certified-document">Onaylı imar durumu belgesi</option></select></label>
          <label>Kaynak belge<input value={zoning.sourceDocument} onChange={(event) => setZoning({ ...zoning, sourceDocument: event.target.value })} placeholder="Belge tarih ve sayısı"/></label>
          <label>Kaynak bağlantısı<input type="url" value={zoning.sourceUrl} onChange={(event) => setZoning({ ...zoning, sourceUrl: event.target.value })} placeholder="https:// resmî belge veya servis"/></label>
        </div>
        <aside className="zoning-source-card">
          <span>YETKİLİ KAYNAK ROTASI</span><h4>{authority?.administrativeRoute || "Önce parsel konumunu seçin"}</h4>
          {authority && <ol>{authority.sequence.map((item, index) => <li key={item}><i>{String(index + 1).padStart(2, "0")}</i><span>{item}</span></li>)}</ol>}
          <div><a href={authority?.parcelSource || "https://parselsorgu.tkgm.gov.tr/"} target="_blank" rel="noreferrer">TKGM ↗</a><a href={authority?.planSource || "https://eplan.csb.gov.tr/"} target="_blank" rel="noreferrer">e-Plan ↗</a><a href={createEGovernmentZoningSearch(province, district)} target="_blank" rel="noreferrer">e-Devlet ↗</a></div>
          <div className="v110-evidence-dates"><label>Sorgu / belge tarihi<input type="date" value={evidenceQueryDate} onChange={(event) => setEvidenceQueryDate(event.target.value)}/></label><label>Geçerlilik sonu<input type="date" value={evidenceValidUntil} onChange={(event) => setEvidenceValidUntil(event.target.value)}/><small>Belgede belirtilmiyorsa boş bırakın.</small></label></div>
          <p>{authority?.limitation || "İl ve ilçe seçildiğinde yetkili idare rotası gösterilir."}</p>
        </aside>
      </div>
      <div className="zoning-document-reader">
        <div><span>BELGE DESTEKLİ GİRİŞ</span><h4>Metinden koşul adaylarını çıkarın.</h4><p>{documentMessage}</p><label>TXT / PDF seçin<input type="file" accept=".txt,.pdf" onChange={(event) => void readDocument(event.target.files?.[0])}/></label></div>
        <label>Belge metni<textarea value={documentText} onChange={(event) => setDocumentText(event.target.value)} placeholder="Plan notu veya imar durumu metnini buraya yapıştırın…"/><button type="button" onClick={() => { const values = extractZoningConditions(documentText); setParsed(values); setDocumentMessage(values.length ? `${values.length} koşul adayı bulundu.` : "Koşul bulunamadı."); }}>Koşulları tara</button></label>
        <div className="zoning-parsed">{parsed.length ? parsed.map((item) => <article key={item.field}><i>{item.confidence === "high" ? "✓" : "!"}</i><span><b>{item.label}</b><strong>{item.value}</strong><small>{item.evidence}</small></span></article>) : <p>Henüz koşul adayı yok.</p>}<button type="button" disabled={!parsed.length} onClick={applyParsedValues}>Bulunan değerleri forma aktar</button></div>
      </div>
      <section className="v110-evidence-center" data-status={zoningEvidenceBundle.status} aria-labelledby="v110-evidence-title">
        <header>
          <div><span>V110 / PARSEL VE İMAR KANIT MERKEZİ</span><h4 id="v110-evidence-title">Değer, kaynak ve güncellik aynı kayıtta.</h4><p>{parcelReference}</p></div>
          <aside><b>{zoningEvidenceBundle.status === "conflict" ? "KAYNAK ÇATIŞMASI" : zoningEvidenceBundle.status === "verified" ? "KAYNAK BEYANI" : zoningEvidenceBundle.status === "incomplete" ? "EKSİK KANIT" : "UZMAN KONTROLÜNE HAZIR"}</b><small>{zoningEvidenceBundle.records.length} kaynak · {zoningEvidenceBundle.conflicts.length} çatışma</small></aside>
        </header>
        {zoningEvidenceBundle.status === "conflict" && <div className="v110-evidence-alert" role="alert"><b>Kaynak çatışması</b><p>{zoningEvidenceBundle.nextAction}</p></div>}
        <div className="v110-evidence-section-head"><span>Kaynak sicili</span><small>Kurum · sorgu tarihi · belge/servis · geçerlilik</small></div>
        <div className="v110-evidence-source-grid">{zoningEvidenceBundle.records.map((source, index) => <article key={source.id} data-freshness={source.freshness}>
          <i>{String(index + 1).padStart(2, "0")}</i><div><b>{source.label}</b><p>{source.authority}</p><dl><div><dt>Sorgu</dt><dd>{source.queriedAt.slice(0, 10)}</dd></div><div><dt>Güncellik</dt><dd>{source.freshness === "current" ? "Geçerli" : source.freshness === "expired" ? "Süresi doldu" : "Bitiş tarihi yok"}</dd></div><div><dt>Belge / kayıt</dt><dd>{source.documentReference || "Referans bekleniyor"}</dd></div></dl><small>{source.limitation}</small></div>{source.url ? <a href={source.url} target="_blank" rel="noreferrer" aria-label={`${source.label} kaynağını açın`}>↗</a> : <span aria-hidden="true">—</span>}
        </article>)}</div>
        <div className="v110-evidence-section-head"><span>Alan bazlı kanıt</span><small>Çelişkide sistem değer seçmez.</small></div>
        <div className="v110-evidence-condition-grid">{Object.values(zoningEvidenceBundle.conditions).map((condition) => <article key={condition.field} data-status={condition.status}>
          <header><span>{condition.label}</span><em>{condition.status === "verified" ? "İNCELEME KAYDI" : condition.status === "supported" ? "KANITLI / KONTROL" : condition.status === "conflict" ? "ÇATIŞMA" : "EKSİK"}</em></header>
          <strong>{condition.value === null ? "—" : `${condition.value}${condition.unit ? ` ${condition.unit}` : ""}`}</strong>
          <div>{condition.candidates.map((candidate) => <p key={`${condition.field}-${candidate.recordId}`}><b>{candidate.value}{condition.unit ? ` ${condition.unit}` : ""}</b><span>{candidate.sourceLabel}</span></p>)}</div>
        </article>)}</div>
        <footer><p>{zoningEvidenceBundle.nextAction}</p><small>{zoningEvidenceBundle.limitation}</small></footer>
      </section>
      <div className="zoning-next dual"><button type="button" className="secondary" onClick={() => setStep("parcel")}>← Parsele dönün</button><button type="button" onClick={() => setStep("analysis")}>Tasarımı sınayın <span>→</span></button></div>
    </section>}

    {step === "analysis" && <section className="zoning-stage">
      <div className="zoning-stage-intro"><span>03 / CANLI TASARIM KONTROLÜ</span><h3>İstenen kütleyi gerçek proje değerleriyle sınayın.</h3><p>Bu ekran ruhsat uygunluk kararı değil; erken tasarım çelişkilerini görünür kılan bir mühendislik ön kontrolüdür.</p></div>
      <div className="zoning-analysis-grid">
        <div className="zoning-request-card"><span>TASARIM TALEBİ</span><label>İstenen taban alanı (m²)<input type="number" min="0" step="1" value={requestedFootprint} onChange={(event) => setRequestedFootprint(clampPositive(Number(event.target.value), 0))}/></label><label>İstenen toplam alan (m²)<input type="number" min="0" step="1" value={requestedGrossArea} onChange={(event) => setRequestedGrossArea(clampPositive(Number(event.target.value), 0))}/></label><label>İstenen yükseklik (m)<input type="number" min="0" step=".1" value={requestedHeight} onChange={(event) => setRequestedHeight(clampPositive(Number(event.target.value), 0))}/></label><label>Tipik kat yüksekliği (m)<input type="number" min="1" step=".1" value={typicalFloorHeight} onChange={(event) => setTypicalFloorHeight(clampPositive(Number(event.target.value), 1))}/></label><label>Yol genişliği (m)<input type="number" min="0" step=".5" value={roadWidth} onChange={(event) => setRoadWidth(clampPositive(Number(event.target.value), 0))}/></label><label className="zoning-check"><input type="checkbox" checked={cornerParcel} onChange={(event) => setCornerParcel(event.target.checked)}/><span>Köşe parsel / ikinci yol cephesi</span></label></div>
        <div className="zoning-rule-card"><header><span>KURAL SONUCU</span><b className={ruleResult.pass ? "pass" : "fail"}>{ruleResult.pass ? "4/4 ÖN KONTROL GEÇTİ" : `${ruleResult.checks.filter((item) => item.pass).length}/4 KONTROL GEÇTİ`}</b></header>{ruleResult.checks.map((check) => <article key={check.code} data-pass={check.pass}><i>{check.pass ? "✓" : "!"}</i><span><b>{check.label}</b><small>{check.actual.toLocaleString("tr-TR", { maximumFractionDigits: 1 })} / {check.limit.toLocaleString("tr-TR", { maximumFractionDigits: 1 })} {check.unit}</small></span><strong>{check.pass ? "UYGUN" : "REVİZE"}</strong></article>)}</div>
        <div className="zoning-envelope-card"><span>KAVRAMSAL YAPI ZARFI</span><svg viewBox="0 0 700 430" role="img" aria-label="Kavramsal üç boyutlu imar zarfı"><polygon points="80,290 310,170 610,270 375,395" className="parcel"/><polygon points="185,280 330,205 505,265 360,345" className="setback"/><polygon points="220,250 350,185 480,230 350,300" className="roof"/><polygon points="220,250 220,140 350,75 350,185" className="left"/><polygon points="350,185 350,75 480,120 480,230" className="right"/>{Array.from({ length: Math.min(8, envelope.floors) }).map((_, index) => <line key={index} x1="220" y1={250-index*22} x2="350" y2={185-index*22} className="floor"/>)}</svg><dl><div><dt>Taban</dt><dd>{envelope.footprint.toFixed(0)} m²</dd></div><div><dt>Kat</dt><dd>{envelope.floors}</dd></div><div><dt>Brüt</dt><dd>{envelope.grossArea.toFixed(0)} m²</dd></div><div><dt>Yükseklik</dt><dd>{envelope.height.toFixed(1)} m</dd></div></dl><p>{envelope.limitation}</p></div>
      </div>
      <div className="zoning-edge-summary"><article><span>YOL CEPHESİ</span><b>{edgeAnalysis.frontage.toFixed(1)} m</b></article><article><span>PARSEL TİPİ</span><b>{edgeAnalysis.cornerParcel ? "Köşe parsel" : "Tek yol cephesi"}</b></article><article><span>ANA YOL</span><b>{edgeAnalysis.primaryRoad?.roadWidth ?? 0} m</b></article><p>{edgeAnalysis.decisions.join(" ")}</p></div>
      <div className="zoning-next dual"><button type="button" className="secondary" onClick={() => setStep("conditions")}>← Koşullara dönün</button><button type="button" onClick={() => setStep("handoff")}>Aktarım ve çıktıya geçin <span>→</span></button></div>
    </section>}

    {step === "handoff" && <section className="zoning-stage">
      <div className="zoning-stage-intro"><span>04 / TEK PROJE VERİ ZİNCİRİ</span><h3>Aynı veriyi tekrar girmeden sonraki disipline geçin.</h3><p>Parsel kimliği, kanıt seviyesi, yapı zarfı ve tasarım limitleri aynı proje çekirdeğinde mimari, taşıyıcı ve koordinasyon modüllerine taşınır.</p></div>
      <div className="zoning-handoff-grid">{handoff.consumers.map((consumer, index) => <article key={consumer.module}><i>{String(index + 1).padStart(2, "0")}</i><span><b>{consumer.module}</b><small>{consumer.fields.join(" · ")}</small></span><Link href={consumer.route}>Modülü açın ↗</Link></article>)}</div>
      <div className="zoning-transfer-card"><div><span>PROJE ÇEKİRDEĞİ</span><b>{project.name}</b><small>{project.id} · {project.revision}</small></div><button type="button" onClick={sendHandoff}>Doğrulama statüsüyle kaydedin <span>→</span></button></div>
      {handoffMessage && <p className="zoning-transfer-message" role="status">{handoffMessage}</p>}
      <div className="zoning-exports"><button type="button" onClick={() => void exportReportPdf()}><i>PDF</i><span><b>Kurumsal imar paftası</b><small>IMR-001 · kaynak ve revizyon izli</small></span></button><button type="button" onClick={exportReportDxf}><i>DXF</i><span><b>Katmanlı imar zarfı</b><small>PARSEL · IMAR_ZARFI · ANTET</small></span></button><button type="button" onClick={() => downloadTextFile(`${project.id}-imar-manifestosu.json`, JSON.stringify({ ...reportIndex, zoningEvidenceBundle }, null, 2), "application/json")}><i>JSON</i><span><b>İmar veri manifestosu</b><small>Kanıt, çatışma ve kaynak sicili</small></span></button></div>
      <p className="zoning-legal-note">{reportIndex.disclaimer}</p>
      <div className="zoning-next dual"><button type="button" className="secondary" onClick={() => setStep("analysis")}>← Analize dönün</button><Link href="/mimari-program-studyosu">Mimari programa devam edin <span>→</span></Link></div>
    </section>}
  </div>;
}
