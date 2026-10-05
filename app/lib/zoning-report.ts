export function createZoningReportIndex(input: {
  projectCode: string; parcelReference: string; authority: string; evidence: string;
  taks: number; kaks: number; hmax: number; buildingOrder: string;
}) {
  return {
    schema: "ARKEM-ZONING-REPORT/1.0",
    document: { title: "Parsel Bazlı İmar Ön Değerlendirme", sheet: "IMR-001", revision: "R00", projectCode: input.projectCode },
    parcel: { reference: input.parcelReference, authority: input.authority },
    zoning: { taks: input.taks, kaks: input.kaks, hmax: input.hmax, buildingOrder: input.buildingOrder },
    evidence: input.evidence,
    outputSet: [
      { format: "PDF", purpose: "Kurumsal A3 ön değerlendirme paftası" },
      { format: "DXF", purpose: "Katmanlı CAD imar zarfı ve antet" },
      { format: "JSON", purpose: "Makinece okunabilir imar veri manifestosu" },
    ],
    disclaimer: "Ön değerlendirme çıktısıdır; onaylı imar durumu, aplikasyon veya ruhsat projesi değildir.",
  };
}
