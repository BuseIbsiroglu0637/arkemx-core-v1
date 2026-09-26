export function createZoningHandoff(input: {
  parcelReference: string; province: string; district: string;
  parcelArea: number; buildingOrder: string; taks: number; kaks: number; hmax: number;
  footprint: number; grossArea: number; floors: number; geometryStatus: string; evidenceStatus: string;
}) {
  return {
    schema: "ARKEM-ZONING-HANDOFF/1.0",
    createdAt: new Date().toISOString(),
    identity: { parcelReference: input.parcelReference, province: input.province, district: input.district },
    site: { parcelArea: input.parcelArea, geometryStatus: input.geometryStatus },
    zoning: { buildingOrder: input.buildingOrder, taks: input.taks, kaks: input.kaks, hmax: input.hmax, evidenceStatus: input.evidenceStatus },
    envelope: { footprint: input.footprint, grossArea: input.grossArea, floors: input.floors },
    consumers: [
      { module: "Mimari Program", route: "/mimari-program-studyosu", fields: ["parcelArea", "footprint", "grossArea", "floors"] },
      { module: "Taşıyıcı Ön Tasarım", route: "/tasarim-calismalari", fields: ["footprint", "floors", "hmax"] },
      { module: "Koordinasyon", route: "/muhendislik-koordinasyon", fields: ["parcelReference", "geometryStatus", "evidenceStatus"] },
      { module: "Proje OS", route: "/proje-os", fields: ["identity", "zoning", "envelope"] },
    ],
    gate: input.evidenceStatus === "certified-document" ? "verified" : "review-required",
  };
}
