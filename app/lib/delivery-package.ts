export type DeliveryFile = {
  name: string;
  format: "PDF" | "DXF" | "CSV" | "JSON" | "IFC" | "DWG";
  bytes?: number;
  revision?: string;
  coordinateReference?: string;
  sourceModule: string;
};

export function validateDeliveryPackage(files: DeliveryFile[]) {
  const checks = files.map((file) => {
    const issues: string[] = [];
    if (!file.name.trim()) issues.push("Dosya adı eksik");
    if ((file.bytes ?? 0) <= 0) issues.push("Dosya boş veya henüz üretilmedi");
    if (!file.revision) issues.push("Revizyon eksik");
    if (["DXF", "IFC", "DWG"].includes(file.format) && !file.coordinateReference) issues.push("Koordinat referansı eksik");
    if (file.format === "DWG") issues.push("Doğrudan DWG yalnız lisanslı dönüşüm servisiyle doğrulanabilir");
    return { ...file, valid: issues.length === 0, issues };
  });
  return {
    schema: "ARKEM-DELIVERY-PACKAGE/2.0",
    generatedAt: new Date().toISOString(),
    checks,
    summary: {
      total: checks.length,
      valid: checks.filter((item) => item.valid).length,
      blocked: checks.filter((item) => !item.valid).length,
    },
    policy: {
      emptyFilesRejected: true,
      revisionRequired: true,
      spatialReferenceRequired: true,
      nativeDwgRequiresLicensedConverter: true,
    },
  };
}
