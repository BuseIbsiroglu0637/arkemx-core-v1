export type ZoningVerification =
  | "user-declared"
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
  sourceUrl: string;
  sourceDocument: string;
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
  landUse: "Kullanıcı girişi bekleniyor",
  planName: "",
  planScale: "1/1000 Uygulama İmar Planı",
  planId: "",
  buildingOrder: "Plan notuna göre",
  taks: 0.4,
  kaks: 1.2,
  hmax: 15.5,
  frontSetback: 5,
  sideSetback: 3,
  rearSetback: 3,
  planNoteReference: "",
  sourceUrl: "",
  sourceDocument: "",
  verification: "user-declared",
};

export function zoningVerificationLabel(value: ZoningVerification) {
  return {
    "user-declared": "Kullanıcı girdisi · doğrulanmadı",
    "municipal-viewer": "Belediye ekranı beyanı · inceleme bekleniyor",
    "approved-plan": "Plan / plan notu beyanı · inceleme bekleniyor",
    "certified-document": "İmar belgesi beyanı · inceleme bekleniyor",
  }[value];
}

export function createZoningProvenance(zoning: ZoningForm, parcelReference: string) {
  return {
    schema: "ARKEM-ZONING-PROVENANCE/1.0",
    // Target context is not evidence that the document belongs to this parcel.
    parcelReference: null,
    targetParcelReference: parcelReference,
    sourceParcelReference: null,
    parcelIdentityVerified: false,
    needsReview: true,
    evidenceKind: "customer-source-declaration",
    capturedAt: new Date().toISOString(),
    verification: zoning.verification,
    sourceUrl: zoning.sourceUrl || null,
    sourceDocument: zoning.sourceDocument || null,
    plan: {
      name: zoning.planName || null,
      scale: zoning.planScale,
      planId: zoning.planId || null,
      noteReference: zoning.planNoteReference || null,
    },
    conditions: {
      landUse: zoning.landUse,
      buildingOrder: zoning.buildingOrder,
      taks: zoning.taks,
      kaks: zoning.kaks,
      hmax: zoning.hmax,
      setbacks: {
        front: zoning.frontSetback,
        side: zoning.sideSetback,
        rear: zoning.rearSetback,
      },
    },
    authoritative: false,
    limitation:
      "Plan paftası, plan notları ve yetkili idarenin güncel imar durumu birlikte doğrulanmadan ruhsat veya yatırım kararı üretmez.",
  };
}
