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
  contentDigest?: string;
  sourceContext?: { projectId: string; revision: string; elementIds?: string[]; calculationIds?: string[]; calculationBindings?: Array<{ id: string; projectId: string; revision: string; elementIds: string[] }> };
}) {
  const validReferences = (ids: string[] | undefined) => !!ids?.length && ids.every(id => typeof id === "string" && !!id.trim()) && new Set(ids).size === ids.length;
  const issues: string[] = [], pending: string[] = [];
  const context = input.sourceContext;
  if (!context) pending.push("reference context unavailable");
  else {
    if (context.projectId !== input.projectCode) issues.push("source project identity conflict");
    if (context.revision !== input.revision || context.revision !== input.sourceRevision) issues.push("source revision conflict");
    if (!context.elementIds) pending.push("element registry unavailable");
    else for (const id of input.elementIds ?? []) if (!context.elementIds.includes(id)) issues.push("unknown element reference: " + id);
    if (!context.calculationIds) pending.push("calculation registry unavailable");
    else for (const id of input.calculationIds ?? []) if (!context.calculationIds.includes(id)) issues.push("unknown calculation reference: " + id);
    if (!context.calculationBindings?.length) pending.push("calculation source bindings unavailable");
    else for (const id of input.calculationIds ?? []) {
      const matches = context.calculationBindings.filter(binding => binding.id === id);
      if (matches.length !== 1) issues.push("calculation binding missing or duplicated: " + id);
      else {
        const binding = matches[0];
        if (binding.projectId !== input.projectCode || binding.revision !== input.sourceRevision) issues.push("calculation source identity conflict: " + id);
        if (!validReferences(binding.elementIds) || binding.elementIds.length !== input.elementIds?.length || binding.elementIds.some(elementId => !input.elementIds?.includes(elementId))) issues.push("calculation element binding conflict: " + id);
      }
    }
  }
  if (!validReferences(input.elementIds)) pending.push("valid element references unavailable");
  if (!validReferences(input.calculationIds)) pending.push("valid calculation references unavailable");
  const validation = { status: issues.length ? "invalid" : pending.length ? "pending" : "consistent", issues, pending, calculationVerification: false, technicalApproval: false };
  const fingerprint = documentFingerprint([
    input.projectCode,
    input.module,
    input.sheetNo,
    input.revision,
    input.coordinateSystem,
    input.sourceRevision,
    input.elementIds?.slice().sort().join(","),
    input.calculationIds?.slice().sort().join(","),
    ...(input.contentDigest ? [input.contentDigest] : []),
  ]);
  return {
    schema: "ARKEM-DOCUMENT-IDENTITY/2.0",
    references: {
      schema: "ARKEM-DOCUMENT-REFERENCES/1.0",
      status: !!input.revision && input.sourceRevision === input.revision && validation.status === "consistent" ? "declared" : "unsupported",
      validation,
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
