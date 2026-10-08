export function documentFingerprint(parts: Array<string | number | undefined>) {
  const value = parts.map((part) => String(part ?? "")).join("|");
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).toUpperCase().padStart(8, "0");
}

export function createDocumentIdentity(input: {
  projectCode: string;
  module: string;
  sheetNo?: string;
  revision?: string;
  coordinateSystem?: string;
  elementIds?: string[];
  calculationIds?: string[];
  sourceRevision?: string;
}) {
  const validReferences = (ids: string[] | undefined) => !!ids?.length && ids.every(id => typeof id === "string" && !!id.trim()) && new Set(ids).size === ids.length;
  const fingerprint = documentFingerprint([
    input.projectCode,
    input.module,
    input.sheetNo,
    input.revision,
    input.coordinateSystem,
    input.sourceRevision,
    input.elementIds?.slice().sort().join(","),
    input.calculationIds?.slice().sort().join(","),
  ]);
  return {
    schema: "ARKEM-DOCUMENT-IDENTITY/2.0",
    references: {
      schema: "ARKEM-DOCUMENT-REFERENCES/1.0",
      status: !!input.revision && input.sourceRevision === input.revision && validReferences(input.elementIds) && validReferences(input.calculationIds) ? "declared" : "unsupported",
      sourceRevision: input.sourceRevision ?? null,
      elementIds: validReferences(input.elementIds) ? input.elementIds : null,
      calculationIds: validReferences(input.calculationIds) ? input.calculationIds : null,
      technicalApproval: false,
      limitation: "Missing references are not inferred; declared references require separate calculation/model verification.",
    },
    reference: `AX-${input.projectCode || "UNSPECIFIED"}-${input.sheetNo || "UNSPECIFIED"}-${input.revision || "UNSPECIFIED"}-${fingerprint}`,
    fingerprint,
    state: "Kavramsal teknik çıktı",
    verification: "Proje kodu, pafta no, revizyon ve koordinat referansı birlikte kontrol edilmelidir.",
  };
}
