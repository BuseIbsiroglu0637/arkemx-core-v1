export type ZoningVerification =
  | "user-declared"
  | "document-pending-review"
  | "municipal-viewer"
  | "approved-plan"
  | "certified-document";

export type ZoningForm = {
  landUse: string;
  planName: string;
  planScale: string;
  planId: string;
  buildingOrder: string;
  taks: number;
  kaks: number;
  hmax: number;
  frontSetback: number;
  sideSetback: number;
  rearSetback: number;
  planNoteReference: string;
  sourceType: string;
  sourceDate: string;
  sourceUrl: string;
  sourceDocument: string;
  sourceNote: string;
  verification: ZoningVerification;
};

export const ZONING_CONNECTORS = [
  {
    id: "eplan",
    label: "e-Plan Otomasyon",
    authority: "Çevre, Şehircilik ve İklim Değişikliği Bakanlığı",
    purpose: "Kesinleşen plan, plan işlem numarası, pafta ve plan notu araştırması",
    state: "official-viewer",
    href: "https://eplan.csb.gov.tr/",
  },
  {
    id: "tucbs",
    label: "Ulusal Coğrafi Bilgi Platformu",
    authority: "CBS Genel Müdürlüğü",
    purpose: "Yetkiye göre çevre düzeni planı ve diğer resmî coğrafi katmanlar",
    state: "authorization-dependent",
    href: "https://tucbs.gov.tr/",
  },
  {
    id: "municipality",
    label: "Belediye e-İmar",
    authority: "İlgili belediye / yetkili idare",
    purpose: "Parsel bazlı uygulama imar koşulları ve resmî imar durumu belgesi",
    state: "municipality-adapter",
    href: "",
  },
  {
    id: "document",
    label: "Onaylı imar durumu",
    authority: "İlgili belediye / yetkili idare",
    purpose: "TAKS, KAKS/emsal, Yençok/Hmax, nizam, çekme ve plan notu doğrulaması",
    state: "user-document",
    href: "",
  },
] as const;

export const DEFAULT_ZONING: ZoningForm = {
  landUse: "",
  planName: "",
  planScale: "",
  planId: "",
  buildingOrder: "",
  // -1 is the explicit "not entered" sentinel for numeric zoning fields.
  // It serializes safely, unlike NaN, and is never interpreted as a right.
  taks: -1,
  kaks: -1,
  hmax: -1,
  frontSetback: -1,
  sideSetback: -1,
  rearSetback: -1,
  planNoteReference: "",
  sourceType: "",
  sourceDate: "",
  sourceUrl: "",
  sourceDocument: "",
  sourceNote: "",
  verification: "user-declared",
};

/**
 * A browser form or legacy device-local record is user-supplied evidence only.
 * Verified states remain in the domain model for future authenticated source
 * adapters; they must never be minted by a dropdown or a local import.
 */
export function normalizeUntrustedZoningVerification(value: unknown, hasDocument: boolean): ZoningVerification {
  if (value === "municipal-viewer") return "municipal-viewer";
  if (hasDocument && (
    value === "document-pending-review" ||
    value === "approved-plan" ||
    value === "certified-document"
  )) return "document-pending-review";
  return "user-declared";
}

export function normalizeZoningSourceUrl(value: unknown) {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  try {
    const url = new URL(raw);
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : "";
  } catch {
    return "";
  }
}

export function zoningVerificationLabel(value: ZoningVerification) {
  return {
    "user-declared": "Kullanıcı girdisi · doğrulanmadı",
    "document-pending-review": "Belge eklendi · uzman doğrulaması bekliyor",
    "municipal-viewer": "Kullanıcı beyanı: belediye e-İmar ekranı · doğrulanmadı",
    "approved-plan": "Onaylı plan ve plan notundan aktarıldı",
    "certified-document": "Onaylı imar durumu belgesiyle doğrulandı",
  }[value];
}

export function createZoningProvenance(zoning: ZoningForm, parcelReference: string) {
  const sourceUrl = normalizeZoningSourceUrl(zoning.sourceUrl);
  return {
    schema: "ARKEM-ZONING-PROVENANCE/1.0",
    parcelReference,
    capturedAt: new Date().toISOString(),
    verification: zoning.verification,
    source: {
      type: zoning.sourceType || null,
      date: zoning.sourceDate || null,
      url: sourceUrl || null,
      document: zoning.sourceDocument || null,
      note: zoning.sourceNote || null,
    },
    sourceUrl: sourceUrl || null,
    sourceDocument: zoning.sourceDocument || null,
    plan: {
      name: zoning.planName || null,
      scale: zoning.planScale,
      planId: zoning.planId || null,
      noteReference: zoning.planNoteReference || null,
    },
    conditions: {
      landUse: zoning.landUse || null,
      buildingOrder: zoning.buildingOrder || null,
      taks: zoning.taks >= 0 ? zoning.taks : null,
      kaks: zoning.kaks >= 0 ? zoning.kaks : null,
      hmax: zoning.hmax >= 0 ? zoning.hmax : null,
      setbacks: {
        front: zoning.frontSetback >= 0 ? zoning.frontSetback : null,
        side: zoning.sideSetback >= 0 ? zoning.sideSetback : null,
        rear: zoning.rearSetback >= 0 ? zoning.rearSetback : null,
      },
    },
    authoritative:
      zoning.verification === "certified-document" ||
      zoning.verification === "approved-plan",
    limitation:
      "Plan paftası, plan notları ve yetkili idarenin güncel imar durumu birlikte doğrulanmadan ruhsat veya yatırım kararı üretmez.",
  };
}
