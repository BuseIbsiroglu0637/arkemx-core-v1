export type ParsedZoningCondition = {
  field: "taks" | "kaks" | "hmax" | "buildingOrder" | "frontSetback" | "sideSetback" | "rearSetback";
  label: string;
  value: number | string;
  evidence: string;
  confidence: "high" | "review";
};

const number = String.raw`(\d+(?:[.,]\d+)?)`;

export function normalizeZoningDocumentText(value: string) {
  return value.replace(/\u0000/g, "").replace(/\s+/g, " ").trim();
}

export function extractZoningConditions(input: string): ParsedZoningCondition[] {
  const text = normalizeZoningDocumentText(input);
  const results: ParsedZoningCondition[] = [];
  const numericRules: Array<[ParsedZoningCondition["field"], string, RegExp]> = [
    ["taks", "TAKS", new RegExp(String.raw`\bTAKS\b\s*[:=%\-]?\s*${number}`, "i")],
    ["kaks", "KAKS / Emsal", new RegExp(String.raw`\b(?:KAKS|EMSAL|E)\b\s*[:=%\-]?\s*${number}`, "i")],
    ["hmax", "Hmax / Yençok", new RegExp(String.raw`\b(?:HMAX|YENÇOK|YEN\s*ÇOK)\b\s*[:=%\-]?\s*${number}\s*(?:m|metre)?`, "i")],
    ["frontSetback", "Ön bahçe", new RegExp(String.raw`\bÖN\s+BAHÇE\b[^0-9]{0,24}${number}\s*(?:m|metre)?`, "i")],
    ["sideSetback", "Yan bahçe", new RegExp(String.raw`\bYAN\s+BAHÇE\b[^0-9]{0,24}${number}\s*(?:m|metre)?`, "i")],
    ["rearSetback", "Arka bahçe", new RegExp(String.raw`\bARKA\s+BAHÇE\b[^0-9]{0,24}${number}\s*(?:m|metre)?`, "i")],
  ];
  for (const [field, label, regex] of numericRules) {
    const match = text.match(regex);
    if (!match) continue;
    results.push({ field, label, value: Number(match[1].replace(",", ".")), evidence: match[0].slice(0, 120), confidence: "high" });
  }
  const orderMatch = text.match(/\b(AYRIK|BİTİŞİK|BLOK|İKİZ|SERBEST)\s+NİZAM\b/i);
  if (orderMatch) results.push({ field: "buildingOrder", label: "Yapı nizamı", value: `${orderMatch[1].toLocaleLowerCase("tr-TR").replace(/^./, (value) => value.toLocaleUpperCase("tr-TR"))} nizam`, evidence: orderMatch[0], confidence: "high" });
  return results;
}

export function createZoningDocumentAudit(fileName: string, values: ParsedZoningCondition[]) {
  return {
    schema: "ARKEM-ZONING-DOCUMENT/1.0",
    fileName,
    parsedAt: new Date().toISOString(),
    extractionMode: "text-layer-and-user-review",
    values,
    requiresHumanReview: true,
    limitation: "Otomatik metin taraması; OCR, onaylı imar durumu veya yetkili idare doğrulaması yerine geçmez. Her değer kaynak belge üzerinde kontrol edilmelidir.",
  };
}
