export type StructuralSystem = "concrete" | "precast" | "steel" | "light" | "hybrid";

export type StructuralConceptInput = {
  system: StructuralSystem;
  usage: "residential" | "office" | "industrial" | "storage" | "assembly";
  width: number;
  depth: number;
  floors: number;
  floorHeight: number;
  baysX: number;
  baysY: number;
  columnSize: number;
  beamDepth: number;
  slabThickness: number;
  superDeadLoad: number;
  liveLoad: number;
  roofSnowLoad: number;
  basicWindSpeed: number;
  sds: number;
  sd1: number;
  importance: number;
  behaviorFactor: number;
  concreteStrength: number;
  steelYield: number;
};

export type EngineeringCheck = {
  id: string;
  title: string;
  value: string;
  limit: string;
  state: "pass" | "review" | "block";
  note: string;
};

export const SYSTEM_LABELS: Record<StructuralSystem, string> = {
  concrete: "Betonarme",
  precast: "Betonarme Prefabrik",
  steel: "Yapısal Çelik",
  light: "Hafif Çelik",
  hybrid: "Karma Sistem",
};

export const DESIGN_BASIS = {
  tr: {
    label: "TR / Ulusal esaslar",
    references: ["TBDY 2018", "TS 500", "TS 498", "Çelik Yapılar Yönetmeliği", "TS EN 1993-1-3"],
  },
  eu: {
    label: "EN / Eurocode",
    references: ["EN 1990", "EN 1991", "EN 1992", "EN 1993", "EN 1998"],
  },
} as const;

const useParticipation: Record<StructuralConceptInput["usage"], number> = {
  residential: 0.3,
  office: 0.3,
  industrial: 0.3,
  storage: 0.8,
  assembly: 0.6,
};

const spanGuidance: Record<StructuralSystem, number> = {
  concrete: 8,
  precast: 16,
  steel: 18,
  light: 6,
  hybrid: 14,
};

const heightGuidance: Record<StructuralSystem, number> = {
  concrete: 60,
  precast: 36,
  steel: 45,
  light: 15,
  hybrid: 50,
};

const frameAllowance: Record<StructuralSystem, number> = {
  concrete: 1.15,
  precast: 1,
  steel: 0.75,
  light: 0.42,
  hybrid: 0.95,
};

const floorSelfWeight: Record<StructuralSystem, number> = {
  concrete: 0,
  precast: 3.8,
  steel: 1.15,
  light: 0.72,
  hybrid: 2.1,
};

export function permanentAreaLoadComponents(input: StructuralConceptInput) {
  const slabSelfWeight = input.system === "concrete" || input.system === "hybrid"
    ? input.slabThickness * 25
    : floorSelfWeight[input.system];
  return { slabSelfWeight, superDeadLoad: input.superDeadLoad, frameAllowance: frameAllowance[input.system] };
}

function round(value: number, digits = 2) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

export function calculateStructuralConcept(input: StructuralConceptInput) {
  const floorArea = input.width * input.depth;
  const totalArea = floorArea * input.floors;
  const height = input.floors * input.floorHeight;
  const spanX = input.width / Math.max(1, input.baysX);
  const spanY = input.depth / Math.max(1, input.baysY);
  const maxSpan = Math.max(spanX, spanY);
  const columnsPerFloor = (input.baysX + 1) * (input.baysY + 1);
  const permanentComponents = permanentAreaLoadComponents(input);
  const { slabSelfWeight } = permanentComponents;
  const permanentLoad = slabSelfWeight + permanentComponents.superDeadLoad + permanentComponents.frameAllowance;
  const variableLoad = input.liveLoad;
  const ulsAreaLoad = 1.4 * permanentLoad + 1.6 * variableLoad;
  const serviceAreaLoad = permanentLoad + variableLoad;
  const seismicAreaLoad = permanentLoad + useParticipation[input.usage] * variableLoad;
  const seismicWeight = seismicAreaLoad * totalArea;
  const seismicMassTonnes = seismicWeight / 9.80665;
  const periodCoefficient = input.system === "concrete" ? 0.075 : input.system === "precast" ? 0.08 : input.system === "light" ? 0.09 : 0.085;
  const period = periodCoefficient * height ** 0.75;
  const elasticSpectrum = Math.min(input.sds, input.sd1 / Math.max(period, 0.05));
  const reducedSpectrum = elasticSpectrum * input.importance / Math.max(input.behaviorFactor, 1);
  const baseShearProxy = seismicWeight * reducedSpectrum;
  const totalFactoredGravity = ulsAreaLoad * totalArea;
  const tributaryColumn = totalFactoredGravity / Math.max(1, columnsPerFloor) / Math.max(1, input.floors);
  const concreteVolume = input.system === "concrete" || input.system === "hybrid"
    ? totalArea * input.slabThickness
      + columnsPerFloor * input.columnSize ** 2 * input.floorHeight * input.floors
      + ((input.baysX + 1) * input.depth + (input.baysY + 1) * input.width) * input.beamDepth * Math.max(0.25, input.columnSize * 0.65) * input.floors
    : input.system === "precast"
      ? totalArea * .1
        + columnsPerFloor * input.columnSize ** 2 * input.floorHeight * input.floors
        + ((input.baysX + 1) * input.depth + (input.baysY + 1) * input.width) * input.beamDepth * Math.max(.28, input.columnSize * .65) * input.floors
      : 0;
  const steelTonnage = input.system === "steel"
    ? totalArea * (maxSpan > 12 ? 0.075 : 0.055)
    : input.system === "light"
      ? totalArea * 0.034
      : input.system === "hybrid"
        ? totalArea * 0.032
        : 0;
  const reinforcementTonnage = concreteVolume * (input.system === "hybrid" ? 0.095 : input.system === "precast" ? .085 : 0.115);
  const concreteCapacityProxy = 0.35 * (input.concreteStrength / 1.5) * input.columnSize ** 2 * 1_000;
  const gravityDemandRatio = input.system === "concrete" || input.system === "precast" || input.system === "hybrid"
    ? tributaryColumn / Math.max(concreteCapacityProxy, 1)
    : tributaryColumn / Math.max(input.steelYield * (input.system === "light" ? 3.2 : 14.5), 1);
  const slendernessProxy = input.floorHeight / Math.max(input.columnSize, input.system === "light" ? 0.12 : 0.2);
  const driftDemandProxy = Math.max(0.15, reducedSpectrum * height / Math.max(input.width, input.depth) * 100);
  const windPressureProxy = 0.000613 * input.basicWindSpeed ** 2;
  const rainRoofArea = floorArea;

  const checks: EngineeringCheck[] = [
    {
      id: "span",
      title: "Aks açıklığı",
      value: `${round(maxSpan)} m`,
      limit: `ön tarama ≤ ${spanGuidance[input.system]} m`,
      state: maxSpan <= spanGuidance[input.system] ? "pass" : maxSpan <= spanGuidance[input.system] * 1.25 ? "review" : "block",
      note: "Kesin açıklık sınırı seçilen kesit, yük, stabilite, titreşim ve yangın tasarımıyla belirlenir.",
    },
    {
      id: "height",
      title: "Sistem yüksekliği",
      value: `${round(height)} m`,
      limit: `ön tarama ≤ ${heightGuidance[input.system]} m`,
      state: height <= heightGuidance[input.system] ? "pass" : "review",
      note: "Bu değer yönetmelik sınırı değildir; sistem karmaşıklığı ve analiz kapsamı için erken uyarıdır.",
    },
    {
      id: "gravity",
      title: "Düşey yük talep endeksi",
      value: round(gravityDemandRatio, 3).toFixed(3),
      limit: "ön boyutlandırma hedefi < 0,65",
      state: gravityDemandRatio < 0.5 ? "pass" : gravityDemandRatio < 0.75 ? "review" : "block",
      note: "Burkulma, ikinci mertebe, birleşim, moment ve donatı koşulları bu endekse dahil değildir.",
    },
    {
      id: "drift",
      title: "Yanal ötelenme duyarlılığı",
      value: `${round(driftDemandProxy, 2)} endeks`,
      limit: "göreli ön tarama < 1,00",
      state: driftDemandProxy < 0.7 ? "pass" : driftDemandProxy < 1.2 ? "review" : "block",
      note: "Gerçek göreli kat ötelenmesi ancak üç boyutlu analiz ve rijitlik modeliyle hesaplanabilir.",
    },
    {
      id: "slenderness",
      title: "Kolon narinlik göstergesi",
      value: round(slendernessProxy, 1).toFixed(1),
      limit: "kesit ve mesnet koşuluyla doğrula",
      state: slendernessProxy < 12 ? "pass" : slendernessProxy < 24 ? "review" : "block",
      note: "Etkin boy, atalet yarıçapı ve uç koşulları tanımlanmadan yönetmelik narinlik kontrolü değildir.",
    },
  ];

  return {
    geometry: { floorArea, totalArea, height, spanX, spanY, maxSpan, columnsPerFloor },
    loads: {
      slabSelfWeight,
      permanentLoad,
      variableLoad,
      serviceAreaLoad,
      ulsAreaLoad,
      seismicAreaLoad,
      roofSnowLoad: input.roofSnowLoad,
      windPressureProxy,
      totalFactoredGravity,
      seismicWeight,
      seismicMassTonnes,
      tributaryColumn,
    },
    dynamics: { period, elasticSpectrum, reducedSpectrum, baseShearProxy, driftDemandProxy },
    quantities: { concreteVolume, steelTonnage, reinforcementTonnage, rainRoofArea },
    checks,
    trace: [
      { code: "Gk", formula: "döşeme öz ağırlığı + sabit yük + taşıyıcı payı", result: `${round(permanentLoad)} kN/m²` },
      { code: "Qk", formula: "kullanım hareketli yükü", result: `${round(variableLoad)} kN/m²` },
      { code: "ULS-01", formula: "1,40G + 1,60Q", result: `${round(ulsAreaLoad)} kN/m²` },
      { code: "MASS", formula: `G + ${useParticipation[input.usage].toFixed(2)}Q`, result: `${Math.round(seismicMassTonnes).toLocaleString("tr-TR")} t` },
      { code: "T₁", formula: `${periodCoefficient.toFixed(3)}·H^0,75`, result: `${round(period, 3)} s` },
      { code: "V*", formula: "W·Sae(T)·I/R", result: `${Math.round(baseShearProxy).toLocaleString("tr-TR")} kN` },
    ],
  };
}

export function downloadTextFile(name: string, content: string | Uint8Array, type = "text/plain;charset=utf-8") {
  const anchor = document.createElement("a");
  const payload = typeof content === "string" && type.includes("csv") && !content.startsWith("\uFEFF")
    ? `\uFEFF${content}`
    : content;
  const url = URL.createObjectURL(new Blob([payload as BlobPart], { type }));
  anchor.href = url;
  anchor.download = name;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

export type DxfPoint = { x: number; y: number; label?: string };
export type DxfPolyline = { layer: string; points: DxfPoint[]; closed?: boolean };
export type DxfSheetMeta = {
  projectName?: string;
  projectCode?: string;
  module?: string;
  drawingTitle?: string;
  drawingNo?: string;
  revision?: string;
  status?: string;
  coordinateSystem?: string;
  scale?: string;
  preparedBy?: string;
  checkedBy?: string;
  traceability?: unknown;
};

function dxfAscii(value: string) {
  return value.normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[ıİ]/g, "I").replace(/[şŞ]/g, "S").replace(/[ğĞ]/g, "G")
    .replace(/[çÇ]/g, "C").replace(/[öÖ]/g, "O").replace(/[üÜ]/g, "U")
    .replace(/[^\x20-\x7E]/g, "");
}

export function createLayeredDxf(input: {
  title: string;
  width: number;
  depth: number;
  polylines?: DxfPolyline[];
  grid?: { baysX: number; baysY: number };
  notes?: string[];
  warningNotes?: string[];
  sheet?: DxfSheetMeta;
}) {
  const entities: string[] = [];
  const n = (value: number) => Number.isFinite(value) ? value.toFixed(4) : "0.0000";
  const normalizedLayer = (layer: string) => dxfAscii(layer).replace(/\s+/g, "_").toUpperCase();
  const line = (x1: number, y1: number, x2: number, y2: number, layer: string) =>
    entities.push(`0\nLINE\n8\n${normalizedLayer(layer)}\n10\n${n(x1)}\n20\n${n(y1)}\n30\n0.0000\n11\n${n(x2)}\n21\n${n(y2)}\n31\n0.0000\n`);
  const circle = (x: number, y: number, radius: number, layer: string) =>
    entities.push(`0\nCIRCLE\n8\n${normalizedLayer(layer)}\n10\n${n(x)}\n20\n${n(y)}\n30\n0.0000\n40\n${n(radius)}\n`);
  const text = (
    x: number,
    y: number,
    height: number,
    value: string,
    layer = "YAZI",
    rotation = 0,
    style = "ARKEM_SANS",
  ) => entities.push(
    `0\nTEXT\n8\n${normalizedLayer(layer)}\n7\n${style}\n10\n${n(x)}\n20\n${n(y)}\n30\n0.0000\n40\n${n(height)}\n41\n0.8200\n1\n${dxfAscii(value)}\n50\n${n(rotation)}\n`,
  );
  const polyline = (points: DxfPoint[], layer: string, closed = true) => {
    if (points.length < 2) return;
    const safeLayer = normalizedLayer(layer);
    entities.push(`0\nPOLYLINE\n8\n${safeLayer}\n66\n1\n70\n${closed ? 1 : 0}\n`);
    points.forEach((point) => entities.push(`0\nVERTEX\n8\n${safeLayer}\n10\n${n(point.x)}\n20\n${n(point.y)}\n30\n0.0000\n`));
    entities.push(`0\nSEQEND\n8\n${safeLayer}\n`);
  };

  const margin = Math.max(2, Math.max(input.width, input.depth) * .08);
  const textHeight = Math.max(.25, Math.min(.55, Math.min(input.width, input.depth) * .0125));
  const textWidth = (value: string, height: number) => dxfAscii(value).length * height * .48;
  const fitTextHeight = (value: string, preferred: number, maxWidth: number, minimum = .16) => {
    const estimated = textWidth(value, preferred);
    if (estimated <= maxWidth) return preferred;
    return Math.max(minimum, preferred * maxWidth / Math.max(estimated, .001));
  };
  const fittedText = (
    x: number,
    y: number,
    preferredHeight: number,
    value: string,
    maxWidth: number,
    layer = "YAZI",
    rotation = 0,
    style = "ARKEM_SANS",
    minimum = .16,
  ) => {
    const safe = dxfAscii(value);
    text(x, y, fitTextHeight(safe, preferredHeight, maxWidth, minimum), safe, layer, rotation, style);
  };
  const wrapText = (value: string, preferredHeight: number, maxWidth: number, maxLines: number) => {
    const words = dxfAscii(value).replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
    const lines: string[] = [];
    let current = "";
    for (const word of words) {
      const candidate = current ? `${current} ${word}` : word;
      if (!current || textWidth(candidate, preferredHeight) <= maxWidth) current = candidate;
      else {
        lines.push(current);
        current = word;
      }
    }
    if (current) lines.push(current);
    if (lines.length <= maxLines) return lines;
    const clipped = lines.slice(0, maxLines);
    let last = clipped[maxLines - 1];
    while (last.length > 3 && textWidth(`${last}...`, preferredHeight) > maxWidth) last = last.slice(0, -1);
    clipped[maxLines - 1] = `${last.trimEnd()}...`;
    return clipped;
  };
  const multiline = (
    x: number,
    y: number,
    preferredHeight: number,
    value: string,
    maxWidth: number,
    maxLines: number,
    lineGap: number,
    layer: string,
    style = "ARKEM_SANS",
  ) => {
    const lines = wrapText(value, preferredHeight, maxWidth, maxLines);
    lines.forEach((row, index) => fittedText(x, y - index * lineGap, preferredHeight, row, maxWidth, layer, 0, style));
    return lines.length;
  };

  if (input.grid) {
    for (let x = 0; x <= input.grid.baysX; x += 1) {
      const px = input.width / Math.max(1, input.grid.baysX) * x;
      line(px, -margin * .25, px, input.depth + margin * .25, "AKS");
      circle(px, -margin * .55, textHeight * 1.1, "AKS_BALON");
      text(px - textHeight * .22, -margin * .67, textHeight, String.fromCharCode(65 + x), "AKS_YAZI", 0, "ARKEM_SANS_BOLD");
    }
    for (let y = 0; y <= input.grid.baysY; y += 1) {
      const py = input.depth / Math.max(1, input.grid.baysY) * y;
      line(-margin * .25, py, input.width + margin * .25, py, "AKS");
      circle(-margin * .55, py, textHeight * 1.1, "AKS_BALON");
      text(-margin * .72, py - textHeight * .28, textHeight, String(y + 1), "AKS_YAZI", 0, "ARKEM_SANS_BOLD");
    }
  }
  (input.polylines ?? []).forEach((item) => {
    polyline(item.points, item.layer, item.closed ?? true);
    item.points.forEach((point, index) => {
      if (point.label) text(point.x + textHeight * .45, point.y + textHeight * .45, textHeight * .7, point.label, "NOKTA_YAZI", 0, "ARKEM_SANS_BOLD");
      else if (normalizedLayer(item.layer) === "PARSEL") text(point.x + textHeight * .45, point.y + textHeight * .45, textHeight * .7, `P${index + 1}`, "NOKTA_YAZI", 0, "ARKEM_SANS_BOLD");
    });
  });
  line(0, -margin, input.width, -margin, "OLCU");
  fittedText(input.width / 2 - textHeight * 2, -margin + textHeight * .35, textHeight, `${input.width.toFixed(2)} m`, textHeight * 8, "OLCU_YAZI", 0, "ARKEM_SANS_BOLD");
  line(input.width + margin, 0, input.width + margin, input.depth, "OLCU");
  fittedText(input.width + margin - textHeight * .35, input.depth / 2, textHeight, `${input.depth.toFixed(2)} m`, textHeight * 8, "OLCU_YAZI", 90, "ARKEM_SANS_BOLD");

  const sheet = input.sheet ?? {};
  const frameLeft = -margin * 1.45;
  const frameBottom = -margin * 4.2;
  const drawingRight = input.width + margin * 1.45;
  const frameTop = input.depth + margin * 1.45;
  const titleWidth = Math.max(17, input.width * .42);
  const frameRight = drawingRight + titleWidth;
  const titleX = drawingRight;
  const innerPad = Math.max(.45, margin * .19);
  const titleInnerWidth = titleWidth - innerPad * 2;
  const frameHeight = frameTop - frameBottom;
  const brandHeight = Math.max(2.8, frameHeight * .13);
  const identityHeight = Math.max(5.8, frameHeight * .25);
  const drawingHeight = Math.max(5.1, frameHeight * .22);
  const notesHeight = Math.max(6.1, frameHeight * .26);
  const metaHeight = Math.max(3.8, frameHeight - brandHeight - identityHeight - drawingHeight - notesHeight);
  const brandBottom = frameTop - brandHeight;
  const identityBottom = brandBottom - identityHeight;
  const drawingBottom = identityBottom - drawingHeight;
  const notesBottom = drawingBottom - notesHeight;
  const metaTop = notesBottom;

  line(frameLeft, frameBottom, frameRight, frameBottom, "ARKEM_CERCEVE");
  line(frameRight, frameBottom, frameRight, frameTop, "ARKEM_CERCEVE");
  line(frameRight, frameTop, frameLeft, frameTop, "ARKEM_CERCEVE");
  line(frameLeft, frameTop, frameLeft, frameBottom, "ARKEM_CERCEVE");
  line(drawingRight, frameBottom, drawingRight, frameTop, "ARKEM_ANTET");
  [brandBottom, identityBottom, drawingBottom, notesBottom].forEach((y) => line(titleX, y, frameRight, y, "ARKEM_ANTET"));
  line(titleX + titleWidth * .5, frameBottom, titleX + titleWidth * .5, metaTop, "ARKEM_ANTET");

  const topTitle = dxfAscii(input.title);
  fittedText(
    frameLeft + innerPad,
    frameTop - textHeight * 1.6,
    textHeight * 1.18,
    topTitle,
    drawingRight - frameLeft - innerPad * 2,
    "PAFTA_YAZI",
    0,
    "ARKEM_SANS_BOLD",
    textHeight * .7,
  );
  fittedText(
    frameLeft + innerPad,
    frameTop - textHeight * 2.8,
    textHeight * .58,
    "BIRIM: METRE  /  FORMAT: AUTOCAD R12 ASCII DXF  /  KATMANLI TEKNIK CIKTI",
    drawingRight - frameLeft - innerPad * 2,
    "PAFTA_YAZI",
  );

  if (input.warningNotes?.length) {
    const warnings = input.warningNotes.slice(0, 3);
    warnings.forEach((warning, index) => fittedText(
      frameLeft + innerPad, frameTop - textHeight * (4.4 + index * .95),
      textHeight * .62, warning, drawingRight - frameLeft - innerPad * 2,
      "ARKEM_UYARI", 0, "ARKEM_SANS_BOLD",
    ));
  }

  const logoX = titleX + innerPad;
  const logoY = brandBottom + brandHeight * .23;
  const logoW = Math.min(brandHeight * .55, titleWidth * .13);
  const logoH = logoW * .78;
  polyline([
    { x: logoX, y: logoY },
    { x: logoX + logoW * .48, y: logoY + logoH },
    { x: logoX + logoW * .7, y: logoY + logoH },
    { x: logoX + logoW * 1.2, y: logoY },
    { x: logoX + logoW * .92, y: logoY },
    { x: logoX + logoW * .6, y: logoY + logoH * .63 },
    { x: logoX + logoW * .37, y: logoY + logoH * .2 },
  ], "ARKEM_LOGO", false);
  fittedText(logoX + logoW * 1.52, frameTop - brandHeight * .48, textHeight * 1.35, "ARKEM", titleInnerWidth - logoW * 1.52, "ARKEM_LOGO", 0, "ARKEM_SANS_BOLD", textHeight * .8);
  fittedText(logoX + logoW * 1.54, brandBottom + brandHeight * .18, textHeight * .48, "YAPI SISTEMLERI / ARKEMX", titleInnerWidth - logoW * 1.54, "ARKEM_LOGO");

  const labelHeight = textHeight * .42;
  const valueHeight = textHeight * .69;
  fittedText(titleX + innerPad, brandBottom - innerPad * 1.1, labelHeight, "PROJE", titleInnerWidth, "ARKEM_BILGI", 0, "ARKEM_SANS_BOLD");
  multiline(titleX + innerPad, brandBottom - innerPad * 2.35, valueHeight, sheet.projectName ?? "ARKEMX PROJESI", titleInnerWidth, 2, valueHeight * 1.35, "ARKEM_BILGI", "ARKEM_SANS_BOLD");
  const identityMetaY = identityBottom + identityHeight * .28;
  fittedText(titleX + innerPad, identityMetaY + valueHeight, labelHeight, "PROJE KODU / MODUL", titleInnerWidth, "ARKEM_BILGI", 0, "ARKEM_SANS_BOLD");
  multiline(titleX + innerPad, identityMetaY, textHeight * .54, `${sheet.projectCode ?? "ARK-26-0001"} / ${sheet.module ?? "TEKNIK CALISMA"}`, titleInnerWidth, 2, textHeight * .72, "ARKEM_BILGI");

  fittedText(titleX + innerPad, identityBottom - innerPad * 1.15, labelHeight, "PAFTA ADI", titleInnerWidth, "ARKEM_BILGI", 0, "ARKEM_SANS_BOLD");
  multiline(titleX + innerPad, identityBottom - innerPad * 2.45, valueHeight, sheet.drawingTitle ?? input.title, titleInnerWidth, 2, valueHeight * 1.36, "ARKEM_BILGI", "ARKEM_SANS_BOLD");
  fittedText(titleX + innerPad, drawingBottom + drawingHeight * .25, labelHeight, "VERI STATUSU / KOORDINAT SISTEMI", titleInnerWidth, "ARKEM_BILGI", 0, "ARKEM_SANS_BOLD");
  multiline(titleX + innerPad, drawingBottom + drawingHeight * .11, textHeight * .49, `${sheet.status ?? "KAVRAMSAL"} / ${sheet.coordinateSystem ?? "YEREL"}`, titleInnerWidth, 2, textHeight * .65, "ARKEM_BILGI");

  fittedText(titleX + innerPad, drawingBottom - innerPad * 1.15, labelHeight, "PAFTA NOTLARI", titleInnerWidth, "ARKEM_BILGI", 0, "ARKEM_SANS_BOLD");
  const standardNotes = [
    ...(input.notes ?? []).slice(0, 3),
    "CIZIM BIRIMI METREDIR.",
    "RUHSAT, APLIKASYON VEYA UYGULAMA PROJESI YERINE GECMEZ.",
  ];
  let noteY = drawingBottom - innerPad * 2.45;
  for (const [index, note] of standardNotes.entries()) {
    const prefix = `${String(index + 1).padStart(2, "0")}  `;
    const lines = wrapText(`${prefix}${note}`, textHeight * .43, titleInnerWidth, 2);
    lines.forEach((row, rowIndex) => fittedText(titleX + innerPad, noteY - rowIndex * textHeight * .63, textHeight * .43, row, titleInnerWidth, "ARKEM_NOTLAR"));
    noteY -= lines.length * textHeight * .63 + textHeight * .36;
    if (noteY < notesBottom + innerPad) break;
  }

  const metaCellWidth = titleWidth * .5;
  const metaLabelY = metaTop - metaHeight * .34;
  const metaValueY = frameBottom + metaHeight * .24;
  fittedText(titleX + innerPad, metaLabelY, labelHeight, "REV / PAFTA / OLCEK", metaCellWidth - innerPad * 2, "ARKEM_BILGI", 0, "ARKEM_SANS_BOLD");
  fittedText(titleX + innerPad, metaValueY, textHeight * .58, `${sheet.revision ?? "P01"} / ${sheet.drawingNo ?? "A-001"} / ${sheet.scale ?? "MODEL 1:1"}`, metaCellWidth - innerPad * 2, "ARKEM_REVIZYON", 0, "ARKEM_SANS_BOLD");
  fittedText(titleX + metaCellWidth + innerPad, metaLabelY, labelHeight, "TARIH / HAZIRLAYAN / KONTROL", metaCellWidth - innerPad * 2, "ARKEM_BILGI", 0, "ARKEM_SANS_BOLD");
  fittedText(titleX + metaCellWidth + innerPad, metaValueY, textHeight * .5, `${new Date().toISOString().slice(0, 10)} / ${sheet.preparedBy ?? "ARKEMX"} / ${sheet.checkedBy ?? "PROJEYE OZEL"}`, metaCellWidth - innerPad * 2, "ARKEM_REVIZYON", 0, "ARKEM_SANS_BOLD");

  multiline(
    frameLeft + innerPad,
    frameBottom + textHeight * 1.45,
    textHeight * .42,
    "KAVRAMSAL KARAR VE KOORDINASYON PAFTASIDIR; RUHSAT, APLIKASYON VEYA UYGULAMA PROJESI YERINE GECMEZ.",
    drawingRight - frameLeft - innerPad * 2,
    1,
    textHeight * .6,
    "ARKEM_NOTLAR",
  );
  multiline(
    frameLeft + innerPad,
    frameBottom + textHeight * .65,
    textHeight * .42,
    "DWG ICIN BU KATMANLI DXF DOSYASINI CAD ORTAMINDA ACIP KAYDEDIN. YAZI STILI: ARKEM_SANS / ARIAL.",
    drawingRight - frameLeft - innerPad * 2,
    1,
    textHeight * .6,
    "ARKEM_NOTLAR",
  );

  const dynamicLayers = Array.from(new Set((input.polylines ?? []).map((item) => normalizedLayer(item.layer))));
  const layers: [string, number][] = [
    ["0", 7], ["AKS", 8], ["AKS_BALON", 8], ["AKS_YAZI", 7], ["PARSEL", 1],
    ["ON_YAPI", 30], ["KOLON", 1], ["PERDE", 3], ["MAHAL", 5], ["CEKIRDEK", 4],
    ["BOSLUK", 6], ["NOKTA_YAZI", 7], ["YAZI", 7], ["OLCU", 8], ["OLCU_YAZI", 7], ["PAFTA_YAZI", 7],
    ["ARKEM_CERCEVE", 8], ["ARKEM_ANTET", 8], ["ARKEM_UYARI", 1], ["ARKEM_LOGO", 30], ["ARKEM_BILGI", 7], ["ARKEM_REVIZYON", 30], ["ARKEM_NOTLAR", 8],
    ...dynamicLayers.filter((name) => !["0", "AKS", "AKS_BALON", "AKS_YAZI", "PARSEL", "ON_YAPI", "KOLON", "PERDE", "MAHAL", "CEKIRDEK", "BOSLUK", "NOKTA_YAZI", "YAZI", "OLCU", "OLCU_YAZI", "PAFTA_YAZI"].includes(name)).map((name) => [name, 7] as [string, number]),
  ];
  const layerTable = layers.map(([name, color]) => `0\nLAYER\n2\n${name}\n70\n0\n62\n${color}\n6\nCONTINUOUS\n`).join("");
  const header = `0\nSECTION\n2\nHEADER\n9\n$ACADVER\n1\nAC1009\n9\n$INSUNITS\n70\n6\n9\n$TEXTSTYLE\n7\nARKEM_SANS\n9\n$LIMMIN\n10\n${n(frameLeft)}\n20\n${n(frameBottom)}\n9\n$LIMMAX\n10\n${n(frameRight)}\n20\n${n(frameTop)}\n9\n$EXTMIN\n10\n${n(frameLeft)}\n20\n${n(frameBottom)}\n9\n$EXTMAX\n10\n${n(frameRight)}\n20\n${n(frameTop)}\n0\nENDSEC\n`;
  const styleTable = `0\nTABLE\n2\nSTYLE\n70\n2\n0\nSTYLE\n2\nARKEM_SANS\n70\n0\n40\n0.0\n41\n0.82\n50\n0.0\n71\n0\n42\n0.25\n3\nArial.ttf\n4\n\n0\nSTYLE\n2\nARKEM_SANS_BOLD\n70\n0\n40\n0.0\n41\n0.82\n50\n0.0\n71\n0\n42\n0.25\n3\nArialbd.ttf\n4\n\n0\nENDTAB\n`;
  const tables = `0\nSECTION\n2\nTABLES\n0\nTABLE\n2\nLTYPE\n70\n1\n0\nLTYPE\n2\nCONTINUOUS\n70\n0\n3\nSolid line\n72\n65\n73\n0\n40\n0.0\n0\nENDTAB\n0\nTABLE\n2\nLAYER\n70\n${layers.length}\n${layerTable}0\nENDTAB\n${styleTable}0\nENDSEC\n`;
  return `${header}${tables}0\nSECTION\n2\nBLOCKS\n0\nENDSEC\n0\nSECTION\n2\nENTITIES\n${entities.join("")}0\nENDSEC\n0\nEOF\n`.replace(/\n/g, "\r\n");
}

export function createGridDxf(width: number, depth: number, baysX: number, baysY: number, sheet?: DxfSheetMeta) {
  const drawing = createLayeredDxf({
    title: "ARKEM AKS VE ON BOYUTLANDIRMA PLANI",
    width,
    depth,
    grid: { baysX, baysY },
    polylines: [{ layer: "ON_YAPI", points: [{ x: 0, y: 0 }, { x: width, y: 0 }, { x: width, y: depth }, { x: 0, y: depth }] }],
    notes: [`AKS DUZENI: ${baysX} x ${baysY}`],
    sheet,
  });
  // DXF 999 comments carry the full machine-readable link without changing CAD geometry.
  return sheet?.traceability ? `999\nARKEMX_TRACEABILITY ${JSON.stringify(sheet.traceability)}\n${drawing}` : drawing;
}
