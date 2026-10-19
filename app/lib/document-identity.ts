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
}) {
  const fingerprint = documentFingerprint([
    input.projectCode,
    input.module,
    input.sheetNo,
    input.revision,
    input.coordinateSystem,
  ]);
  return {
    schema: "ARKEM-DOCUMENT-IDENTITY/2.0",
    reference: `AX-${input.projectCode || "PROJECT"}-${input.sheetNo || "SHEET"}-${input.revision || "P01"}-${fingerprint}`,
    fingerprint,
    state: "Kavramsal teknik çıktı",
    verification: "Proje kodu, pafta no, revizyon ve koordinat referansı birlikte kontrol edilmelidir.",
  };
}
