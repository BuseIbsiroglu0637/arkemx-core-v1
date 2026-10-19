export type ZoningEvidenceSourceType =
  | "user-declaration"
  | "user-document"
  | "municipal-viewer"
  | "approved-plan"
  | "certified-document";

export type ZoningEvidenceVerification =
  | "self-declared"
  | "text-extraction"
  | "screen-record"
  | "plan-reviewed"
  | "document-reviewed";

export type ZoningEvidenceField =
  | "landUse"
  | "buildingOrder"
  | "taks"
  | "kaks"
  | "hmax"
  | "frontSetback"
  | "sideSetback"
  | "rearSetback";

export type ZoningEvidenceValue = string | number;
export type ZoningEvidenceConditions = Partial<Record<ZoningEvidenceField, ZoningEvidenceValue>>;

export type ZoningEvidenceRecord = {
  schema: "ARKEM-ZONING-EVIDENCE-RECORD/1.0";
  id: string;
  label: string;
  authority: string;
  sourceType: ZoningEvidenceSourceType;
  queriedAt: string;
  validUntil: string | null;
  freshness: "current" | "expired" | "undated";
  url: string | null;
  documentReference: string | null;
  verification: ZoningEvidenceVerification;
  trust: "declared" | "supported" | "verified";
  conditions: ZoningEvidenceConditions;
  limitation: string;
};

export type ZoningEvidenceRecordInput = Omit<
  ZoningEvidenceRecord,
  "schema" | "freshness" | "trust" | "limitation"
>;

export type ZoningEvidenceCandidate = {
  recordId: string;
  sourceLabel: string;
  authority: string;
  queriedAt: string;
  freshness: ZoningEvidenceRecord["freshness"];
  trust: ZoningEvidenceRecord["trust"];
  value: ZoningEvidenceValue;
};

export type ZoningEvidenceFieldResolution = {
  field: ZoningEvidenceField;
  label: string;
  unit: "" | "m";
  status: "missing" | "supported" | "verified" | "conflict";
  value: ZoningEvidenceValue | null;
  candidates: ZoningEvidenceCandidate[];
};

export type ZoningEvidenceBundle = {
  schema: "ARKEM-ZONING-EVIDENCE/1.0";
  parcelReference: string;
  generatedAt: string;
  status: "incomplete" | "review-ready" | "verified" | "conflict";
  records: ZoningEvidenceRecord[];
  conditions: Record<ZoningEvidenceField, ZoningEvidenceFieldResolution>;
  conflicts: ZoningEvidenceField[];
  missing: ZoningEvidenceField[];
  nextAction: string;
  limitation: string;
};

const FIELD_META: Record<ZoningEvidenceField, { label: string; unit: "" | "m" }> = {
  landUse: { label: "Arazi kullanım kararı", unit: "" },
  buildingOrder: { label: "Yapı nizamı", unit: "" },
  taks: { label: "TAKS", unit: "" },
  kaks: { label: "KAKS / Emsal", unit: "" },
  hmax: { label: "Hmax / Yençok", unit: "m" },
  frontSetback: { label: "Ön bahçe", unit: "m" },
  sideSetback: { label: "Yan bahçe", unit: "m" },
  rearSetback: { label: "Arka bahçe", unit: "m" },
};

const FIELDS = Object.keys(FIELD_META) as ZoningEvidenceField[];

function cleanText(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function validDate(value: string | null) {
  if (!value) return null;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : null;
}

function safeHttpUrl(value: string | null) {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function freshness(validUntil: string | null) {
  const expiry = validDate(validUntil);
  if (expiry === null) return "undated" as const;
  return expiry >= Date.now() ? "current" as const : "expired" as const;
}

function trustFor(sourceType: ZoningEvidenceSourceType, verification: ZoningEvidenceVerification) {
  if (sourceType === "certified-document" && verification === "document-reviewed") return "verified" as const;
  if (sourceType === "approved-plan" || sourceType === "municipal-viewer") return "supported" as const;
  return "declared" as const;
}

function limitationFor(sourceType: ZoningEvidenceSourceType) {
  if (sourceType === "certified-document") {
    return "Belge, geçerlilik tarihi ve parsel referansı yetkili idare kaydıyla birlikte kontrol edilmelidir.";
  }
  if (sourceType === "approved-plan") {
    return "Plan ve plan notu, parsel bazlı onaylı imar durumu belgesiyle birlikte değerlendirilmelidir.";
  }
  if (sourceType === "municipal-viewer") {
    return "Resmî görüntüleyici kaydı araştırma kanıtıdır; ruhsat eki onaylı belge yerine geçmez.";
  }
  if (sourceType === "user-document") {
    return "Belge metni otomatik olarak taranmıştır; değerler belgenin aslı ve yetkili idare kaydı üzerinden insan tarafından doğrulanmalıdır.";
  }
  return "Kullanıcı beyanı resmî imar kanıtı değildir ve tasarım limiti olarak doğrulanmadan kullanılmamalıdır.";
}

function normalizeValue(value: ZoningEvidenceValue) {
  if (typeof value === "number") return Number.isFinite(value) ? Number(value.toFixed(6)) : null;
  const normalized = cleanText(value).toLocaleLowerCase("tr-TR");
  return normalized || null;
}

function sameValue(left: ZoningEvidenceValue, right: ZoningEvidenceValue) {
  const normalizedLeft = normalizeValue(left);
  const normalizedRight = normalizeValue(right);
  if (typeof normalizedLeft === "number" && typeof normalizedRight === "number") {
    return Math.abs(normalizedLeft - normalizedRight) <= 0.000001;
  }
  return normalizedLeft === normalizedRight;
}

export function createZoningEvidenceRecord(input: ZoningEvidenceRecordInput): ZoningEvidenceRecord {
  const conditions = Object.fromEntries(
    Object.entries(input.conditions).filter(([, value]) => (
      typeof value === "number" ? Number.isFinite(value) : Boolean(cleanText(String(value)))
    )),
  ) as ZoningEvidenceConditions;

  return {
    schema: "ARKEM-ZONING-EVIDENCE-RECORD/1.0",
    id: cleanText(input.id),
    label: cleanText(input.label),
    authority: cleanText(input.authority),
    sourceType: input.sourceType,
    queriedAt: input.queriedAt,
    validUntil: input.validUntil,
    freshness: freshness(input.validUntil),
    url: safeHttpUrl(input.url),
    documentReference: input.documentReference ? cleanText(input.documentReference) : null,
    verification: input.verification,
    trust: trustFor(input.sourceType, input.verification),
    conditions,
    limitation: limitationFor(input.sourceType),
  };
}

function resolveField(field: ZoningEvidenceField, records: ZoningEvidenceRecord[]): ZoningEvidenceFieldResolution {
  const candidates = records.flatMap((record) => {
    const value = record.conditions[field];
    if (value === undefined || value === "") return [];
    return [{
      recordId: record.id,
      sourceLabel: record.label,
      authority: record.authority,
      queriedAt: record.queriedAt,
      freshness: record.freshness,
      trust: record.trust,
      value,
    } satisfies ZoningEvidenceCandidate];
  });
  if (!candidates.length) {
    return { field, ...FIELD_META[field], status: "missing", value: null, candidates };
  }
  const first = candidates[0].value;
  const conflict = candidates.some((candidate) => !sameValue(first, candidate.value));
  if (conflict) {
    return { field, ...FIELD_META[field], status: "conflict", value: null, candidates };
  }
  const verified = candidates.some((candidate) => candidate.trust === "verified" && candidate.freshness !== "expired");
  return {
    field,
    ...FIELD_META[field],
    status: verified ? "verified" : "supported",
    value: first,
    candidates,
  };
}

export function createZoningEvidenceBundle(input: {
  parcelReference: string;
  generatedAt: string;
  records: ZoningEvidenceRecord[];
}): ZoningEvidenceBundle {
  const conditions = Object.fromEntries(
    FIELDS.map((field) => [field, resolveField(field, input.records)]),
  ) as Record<ZoningEvidenceField, ZoningEvidenceFieldResolution>;
  const conflicts = FIELDS.filter((field) => conditions[field].status === "conflict");
  const missing = FIELDS.filter((field) => conditions[field].status === "missing");
  const allVerified = !missing.length && FIELDS.every((field) => conditions[field].status === "verified");
  const status: ZoningEvidenceBundle["status"] = conflicts.length
    ? "conflict"
    : missing.length
      ? "incomplete"
      : allVerified
        ? "verified"
        : "review-ready";
  const nextAction = status === "conflict"
    ? "Kaynak çatışması var; uzman incelemesi tamamlanmadan yapılaşma koşulu seçmeyin."
    : status === "incomplete"
      ? "Eksik alanları onaylı plan, plan notu veya yetkili idare belgesiyle tamamlayın."
      : status === "verified"
        ? "Kanıt seti eksiksiz; yetkili proje ekibinin son kontrolüne gönderin."
        : "Kaynaklar tutarlı; onaylı imar durumu belgesiyle resmî doğrulamayı tamamlayın.";

  return {
    schema: "ARKEM-ZONING-EVIDENCE/1.0",
    parcelReference: cleanText(input.parcelReference),
    generatedAt: input.generatedAt,
    status,
    records: input.records,
    conditions,
    conflicts,
    missing,
    nextAction,
    limitation: "Bu manifest kaynakları ve çelişkileri izler; ruhsat, aplikasyon veya yetkili idare onayı üretmez.",
  };
}
