import {
  createEGovernmentZoningSearch,
  resolveZoningAuthority,
  resolveZoningPortal,
} from "../data/zoning-authorities.ts";
import {
  polygonArea,
  polygonSelfIntersects,
  type GeoPoint,
} from "./geo.ts";

export type ParcelSourceKind =
  | "sample"
  | "tkgm-open-service"
  | "user-file"
  | "manual-drawing"
  | "coordinate";

export type ParcelRecordTrust = "verified" | "declared" | "derived";
export type ParcelRecordState =
  | "preview"
  | "identified"
  | "user-supplied"
  | "needs-review";

export type ParcelIdentity = {
  province: string;
  district: string;
  neighborhood: string;
  block: string;
  parcelNo: string;
};

export type ParcelRecord = {
  schema: "ARKEM-PARCEL-RECORD/1.0";
  reference: string;
  state: ParcelRecordState;
  projectEligible: boolean;
  identity: ParcelIdentity;
  geometry: {
    coordinateReferenceSystem: "EPSG:4326";
    points: GeoPoint[];
    vertexCount: number;
    valid: boolean;
    computedArea: number;
    reportedArea: number | null;
    areaVariancePercent: number | null;
  };
  evidence: {
    sourceKind: ParcelSourceKind;
    authority: string;
    label: string;
    capturedAt: string;
    url: string | null;
    trust: ParcelRecordTrust;
    officialCadastre: false;
    sourceIdentity?: ParcelIdentity | null;
    identityMatches?: boolean;
    limitations: string[];
  };
};

export type ParcelRecordInput = {
  identity: ParcelIdentity;
  geometry: GeoPoint[];
  source: {
    kind: ParcelSourceKind;
    authority: string;
    label: string;
    capturedAt: string;
    url: string;
    reportedArea?: number;
    identity?: ParcelIdentity;
  };
};

export type ParcelSourceRecord = {
  id: string;
  label: string;
  authority: string;
  purpose: string;
  href: string | null;
  state: "available" | "matched" | "verification-required";
  verifiedAt: string | null;
  limitation: string;
};

export function parcelIdentityKey(identity: ParcelIdentity) {
  return JSON.stringify(["province", "district", "neighborhood", "block", "parcelNo"].map(key => String(identity[key as keyof ParcelIdentity] ?? "").trim().replace(/\s+/g, " ").toLocaleLowerCase("tr-TR")));
}

function cleanText(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function finitePoint(point: GeoPoint) {
  return Number.isFinite(point.lat)
    && Number.isFinite(point.lng)
    && (point.alt === undefined || Number.isFinite(point.alt))
    && Math.abs(point.lat) <= 90
    && Math.abs(point.lng) <= 180;
}

function parcelReference(identity: ParcelIdentity) {
  return [
    identity.province,
    identity.district,
    identity.neighborhood,
    identity.block,
    identity.parcelNo,
  ].map(cleanText).filter(Boolean).join(" / ") || "Parsel seçimi bekleniyor";
}

function sourceTrust(kind: ParcelSourceKind): ParcelRecordTrust {
  if (kind === "tkgm-open-service") return "verified";
  if (kind === "sample") return "derived";
  return "declared";
}

function sourceLimitations(kind: ParcelSourceKind) {
  const common = [
    "Tapu veya mülkiyet kaydı değildir.",
    "İmar uygunluk belgesi değildir.",
    "Ruhsat projesi veya aplikasyon krokisi değildir.",
  ];
  if (kind === "tkgm-open-service") {
    return [
      "TKGM açık servis yanıtı parseli bulma ve sınır ön kontrolü içindir.",
      "Resmî proje sınırı yetkili harita mühendisi ve güncel aplikasyon verisiyle doğrulanır.",
      ...common,
    ];
  }
  if (kind === "user-file") {
    return [
      "Dosyanın koordinat sistemi, üretim tarihi ve ölçüm yetkisi kullanıcı tarafından doğrulanmalıdır.",
      ...common,
    ];
  }
  if (kind === "manual-drawing" || kind === "coordinate") {
    return [
      "Kullanıcı tarafından çizilen veya koordinat çevresinde üretilen geometri resmî sınır kabul edilmez.",
      ...common,
    ];
  }
  return [
    "Temsili başlangıç geometrisi yalnız arayüz önizlemesidir ve aktif proje verisi sayılmaz.",
    ...common,
  ];
}

export function createParcelRecord(input: ParcelRecordInput): ParcelRecord {
  const identity = {
    province: cleanText(input.identity.province),
    district: cleanText(input.identity.district),
    neighborhood: cleanText(input.identity.neighborhood),
    block: cleanText(input.identity.block),
    parcelNo: cleanText(input.identity.parcelNo),
  };
  const intact = input.geometry.length <= 400 && input.geometry.every(finitePoint);
  const points = intact ? input.geometry.map(point => ({ ...point })) : [];
  const computedArea = polygonArea(points);
  const valid = points.length >= 3
    && computedArea > 1
    && !polygonSelfIntersects(points);
  const reportedArea = Number.isFinite(input.source.reportedArea)
    && Number(input.source.reportedArea) > 0
    ? Number(input.source.reportedArea)
    : null;
  const areaVariancePercent = reportedArea && computedArea
    ? Math.abs(computedArea - reportedArea) / reportedArea * 100
    : null;
  const identityComplete = Boolean(
    identity.province
    && identity.district
    && identity.neighborhood
    && identity.block
    && identity.parcelNo,
  );
  const identityMatches = !input.source.identity || parcelIdentityKey(input.source.identity) === parcelIdentityKey(identity);
  const projectEligible = identityMatches && !["sample", "coordinate"].includes(input.source.kind)
    && valid
    && (
      identityComplete
      || input.source.kind === "user-file"
      || input.source.kind === "manual-drawing"
    );
  const state: ParcelRecordState = !identityMatches ? "needs-review" : input.source.kind === "sample"
    ? "preview"
    : input.source.kind === "tkgm-open-service" && identityComplete && valid
      ? "identified"
      : input.source.kind === "user-file" && valid
        ? "user-supplied"
        : "needs-review";

  return {
    schema: "ARKEM-PARCEL-RECORD/1.0",
    reference: parcelReference(identity),
    state,
    projectEligible,
    identity,
    geometry: {
      coordinateReferenceSystem: "EPSG:4326",
      points,
      vertexCount: points.length,
      valid,
      computedArea,
      reportedArea,
      areaVariancePercent,
    },
    evidence: {
      sourceKind: input.source.kind,
      authority: cleanText(input.source.authority),
      label: cleanText(input.source.label),
      capturedAt: input.source.capturedAt,
      url: input.source.url || null,
      trust: sourceTrust(input.source.kind),
      officialCadastre: false,
      sourceIdentity: input.source.identity ?? null,
      identityMatches,
      limitations: [...sourceLimitations(input.source.kind), ...(!intact ? ["Geçersiz veya 400 köşeden büyük sınır reddedildi; noktalar atlanarak ya da kesilerek yeni sınır üretilmedi."] : []), ...(!identityMatches ? ["Geometri kaynağının parsel kimliği mevcut seçimle eşleşmiyor; yeni parsele aktarılmadı."] : [])],
    },
  };
}

export function resolveParcelSourceNetwork(province: string, district = "", neighborhood = "") {
  const authority = resolveZoningAuthority(province, district, neighborhood);
  const localPortal = resolveZoningPortal(province, district, neighborhood);
  const sources: ParcelSourceRecord[] = [
    {
      id: "tkgm-parcel",
      label: "TKGM Parsel Sorgu",
      authority: "Tapu ve Kadastro Genel Müdürlüğü",
      purpose: "Parsel kimliği, idari kayıt ve sınır ön kontrolü",
      href: "https://parselsorgu.tkgm.gov.tr/",
      state: "available",
      verifiedAt: null,
      limitation: "Açık ekran ve servis yanıtı tapu kaydı veya aplikasyon verisi değildir.",
    },
    {
      id: "e-plan",
      label: "e-Plan Otomasyon",
      authority: "Çevre, Şehircilik ve İklim Değişikliği Bakanlığı",
      purpose: "Plan, pafta, plan işlem numarası ve plan notu araştırması",
      href: "https://eplan.csb.gov.tr/",
      state: "available",
      verifiedAt: null,
      limitation: "Parsel bazlı uygulama koşulları yetkili idare belgesiyle birlikte doğrulanır.",
    },
  ];

  if (localPortal) {
    sources.push({
      id: localPortal.id,
      label: localPortal.label,
      authority: localPortal.authority,
      purpose: localPortal.scope === "parcel-zoning"
        ? "Parsel bazlı yerel imar kaydı"
        : "Büyükşehir plan durumu araştırması",
      href: localPortal.href,
      state: "matched",
      verifiedAt: localPortal.verifiedAt,
      limitation: localPortal.limitation,
    });
  } else {
    sources.push({
      id: "local-authority",
      label: authority?.administrativeRoute || "Yetkili yerel idare",
      authority: authority?.primaryAuthority || "İlgili belediye veya yetkili idare",
      purpose: "Parsel bazlı uygulama imar koşulları ve onaylı imar durumu",
      href: null,
      state: "verification-required",
      verifiedAt: null,
      limitation: authority?.limitation || "İl ve ilçe seçilerek yetkili idare rotası belirlenmelidir.",
    });
  }

  sources.push({
    id: "e-government-directory",
    label: "e-Devlet belediye hizmetleri",
    authority: "T.C. Cumhurbaşkanlığı Dijital Dönüşüm Ofisi / ilgili belediye",
    purpose: "İmar Durum Bilgisi Sorgulama hizmetini resmî dizinde bulma",
    href: createEGovernmentZoningSearch(province, district),
    state: "available",
    verifiedAt: null,
    limitation: "Hizmet kapsamı belediyeye göre değişir; sonuç onaylı imar belgesi yerine geçmez.",
  });

  return {
    schema: "ARKEM-PARCEL-SOURCE-NETWORK/1.0" as const,
    coverage: "81-province-routing" as const,
    province,
    district,
    neighborhood,
    authority: authority?.administrativeRoute || "",
    sources,
    limitation: "Kaynaklar çelişirse otomatik seçim yapılmaz; uzman incelemesi ve güncel resmî belge gerekir.",
  };
}
