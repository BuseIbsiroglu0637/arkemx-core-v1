export type ExportReviewInput = {
  geometryValid: boolean;
  buildingFits: boolean;
  setbackPass: boolean;
  coverage: number;
  maxCoverage: number;
  far: number;
  maxFar: number;
  buildingHeight: number;
  maxHeight: number;
  zoningAuthoritative: boolean;
  officialCadastre: boolean;
  licensedSurvey: boolean;
  measuredTerrain: boolean;
};

export type ExportReview = {
  schema: "ARKEM-EXPORT-REVIEW/1.0";
  status: "review-required" | "preliminary-check-pass";
  officialReleaseEligible: false;
  checks: Record<string, boolean>;
  reasons: string[];
};

// Passing numerical checks is not permission for official release.
// That requires a separate, documented professional approval workflow.
export function assessExportReview(input: ExportReviewInput): ExportReview {
  const numericValues = [
    input.coverage,
    input.maxCoverage,
    input.far,
    input.maxFar,
    input.buildingHeight,
    input.maxHeight,
  ];
  const numericInputsValid = numericValues.every(
    (value) => typeof value === "number" && Number.isFinite(value) && value >= 0,
  );
  const checks = {
    geometry: input.geometryValid === true,
    parcelContainment: input.buildingFits === true,
    setback: input.setbackPass === true,
    taks: numericInputsValid && input.coverage <= input.maxCoverage,
    kaks: numericInputsValid && input.far <= input.maxFar,
    height: numericInputsValid && input.buildingHeight <= input.maxHeight,
    zoningSource: input.zoningAuthoritative === true,
    officialBoundary: input.officialCadastre === true && input.licensedSurvey === true,
    measuredTerrain: input.measuredTerrain === true,
  };
  const messages: Record<keyof typeof checks, string> = {
    geometry: "Parsel geometrisi incelenmeli.",
    parcelContainment: "Yapi parsel siniri disina cikiyor veya siniri kesiyor.",
    setback: "Yapi girilen cekme mesafesini karsilamiyor veya sinir disinda.",
    taks: "Hesaplanan TAKS girilen siniri asiyor.",
    kaks: "Hesaplanan KAKS girilen siniri asiyor.",
    height: "Yapi yuksekligi girilen siniri asiyor.",
    zoningSource: "Imar girdileri yetkili kaynaktan dogrulanmadi.",
    officialBoundary: "Onayli aplikasyon / resmî sinir dogrulanmadi.",
    measuredTerrain: "Olculmus kot ve arazi yuzu dogrulanmadi.",
  };
  const reasons = (Object.keys(checks) as Array<keyof typeof checks>)
    .filter((key) => !checks[key])
    .map((key) => messages[key]);
  return {
    schema: "ARKEM-EXPORT-REVIEW/1.0",
    status: reasons.length ? "review-required" : "preliminary-check-pass",
    officialReleaseEligible: false,
    checks,
    reasons,
  };
}

export function escapeXml(value: unknown) {
  return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}
