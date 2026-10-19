export type ZoningRuleInput = {
  parcelArea: number;
  taks: number;
  kaks: number;
  hmax: number;
  frontSetback: number;
  sideSetback: number;
  rearSetback: number;
  buildingOrder: string;
  requestedFootprint: number;
  requestedGrossArea: number;
  requestedHeight: number;
};

export function evaluateZoningRules(input: ZoningRuleInput) {
  const allowedFootprint = Math.max(0, input.parcelArea * input.taks);
  const allowedGrossArea = Math.max(0, input.parcelArea * input.kaks);
  const checks = [
    { code: "ZR-01", label: "Taban alanı / TAKS", pass: input.requestedFootprint <= allowedFootprint, actual: input.requestedFootprint, limit: allowedFootprint, unit: "m²" },
    { code: "ZR-02", label: "Emsal alanı / KAKS", pass: input.requestedGrossArea <= allowedGrossArea, actual: input.requestedGrossArea, limit: allowedGrossArea, unit: "m²" },
    { code: "ZR-03", label: "Yapı yüksekliği", pass: input.requestedHeight <= input.hmax, actual: input.requestedHeight, limit: input.hmax, unit: "m" },
    { code: "ZR-04", label: "Çekme mesafesi tanımı", pass: Math.min(input.frontSetback, input.sideSetback, input.rearSetback) >= 0, actual: Math.min(input.frontSetback, input.sideSetback, input.rearSetback), limit: 0, unit: "m" },
  ];
  return {
    schema: "ARKEM-ZONING-RULES/1.0",
    buildingOrder: input.buildingOrder,
    allowedFootprint,
    allowedGrossArea,
    checks,
    pass: checks.every((check) => check.pass),
    specialRules: [
      "Köşe parsel, yol genişliği, kotlandırma, bodrum/çatı, kullanım ve özel plan hükümleri ayrıca değerlendirilir.",
      "Plan notu ile yönetmelik çelişkisinde yetkili idarenin güncel plan ve uygulama yorumu doğrulanır.",
    ],
    limitation: "Bu motor erken ön kontroldür; imar çapı, ruhsat uygunluğu veya idari görüş değildir.",
  };
}
