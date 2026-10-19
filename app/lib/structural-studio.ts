import {
  calculateStructuralConcept,
  SYSTEM_LABELS,
  type StructuralConceptInput,
  type StructuralSystem,
} from "./engineering.ts";

type UnknownRecord = Record<string, unknown>;

export type StructuralStudioInput = {
  reference: string;
  input: StructuralConceptInput;
  architecturalScheme?: unknown;
  geometryMode?: "input" | "architecture";
  repetition: number;
  transportDistance: number;
  fireRating: number;
  generatedAt?: string;
};

type SystemProfile = {
  costBase: number;
  mobilizationWeeks: number;
  weeksPerThousandM2: number;
  factoryShare: number;
  spanGuidance: number;
  heightGuidance: number;
  repetitionAffinity: number;
  carbonConcrete: number;
  carbonMetal: number;
  description: string;
};

const SYSTEM_ORDER: StructuralSystem[] = ["concrete", "precast", "steel", "light", "hybrid"];

const PROFILES: Record<StructuralSystem, SystemProfile> = {
  concrete: {
    costBase: 100,
    mobilizationWeeks: 3,
    weeksPerThousandM2: 6.8,
    factoryShare: 12,
    spanGuidance: 8,
    heightGuidance: 60,
    repetitionAffinity: .15,
    carbonConcrete: 300,
    carbonMetal: 1_800,
    description: "Yerinde dökme çerçeve / perde ve betonarme döşeme.",
  },
  precast: {
    costBase: 108,
    mobilizationWeeks: 5,
    weeksPerThousandM2: 2.8,
    factoryShare: 78,
    spanGuidance: 16,
    heightGuidance: 36,
    repetitionAffinity: .75,
    carbonConcrete: 270,
    carbonMetal: 1_750,
    description: "Fabrika üretimli kolon, kiriş ve döşeme; sahada montajlı sistem.",
  },
  steel: {
    costBase: 122,
    mobilizationWeeks: 4,
    weeksPerThousandM2: 3.2,
    factoryShare: 72,
    spanGuidance: 18,
    heightGuidance: 45,
    repetitionAffinity: .45,
    carbonConcrete: 300,
    carbonMetal: 1_700,
    description: "Sıcak hadde / kaynaklı çelik çerçeve ve kompozit ya da hafif döşeme.",
  },
  light: {
    costBase: 105,
    mobilizationWeeks: 3,
    weeksPerThousandM2: 2.5,
    factoryShare: 82,
    spanGuidance: 6,
    heightGuidance: 15,
    repetitionAffinity: .8,
    carbonConcrete: 300,
    carbonMetal: 1_650,
    description: "Soğuk şekillendirilmiş ince cidarlı panel, makas ve döşeme kirişleri.",
  },
  hybrid: {
    costBase: 132,
    mobilizationWeeks: 5,
    weeksPerThousandM2: 3.8,
    factoryShare: 58,
    spanGuidance: 14,
    heightGuidance: 50,
    repetitionAffinity: .4,
    carbonConcrete: 285,
    carbonMetal: 1_700,
    description: "Betonarme çekirdek ile çelik / prefabrik çerçevenin birlikte çalışması.",
  },
};

const record = (value: unknown): UnknownRecord => value && typeof value === "object" && !Array.isArray(value) ? value as UnknownRecord : {};
const numberValue = (value: unknown, fallback = 0) => typeof value === "number" && Number.isFinite(value) ? value : fallback;
const stringValue = (value: unknown, fallback = "") => typeof value === "string" ? value : fallback;
const clamp = (value: number, minimum: number, maximum: number) => Math.min(maximum, Math.max(minimum, Number.isFinite(value) ? value : minimum));
const round = (value: number, digits = 2) => Number(value.toFixed(digits));
const step = (value: number, increment: number) => Math.ceil(value / increment) * increment;

function preliminarySizes(system: StructuralSystem, input: StructuralConceptInput) {
  const span = Math.max(input.width / Math.max(1, input.baysX), input.depth / Math.max(1, input.baysY));
  const heightFactor = Math.max(0, input.floors - 2);
  if (system === "concrete") {
    const column = clamp(step(.3 + heightFactor * .025 + span * .014, .05), .35, 1.2);
    const beamDepth = clamp(step(span / 10, .05), .4, 1.5);
    const beamWidth = clamp(step(Math.max(.25, column * .65), .05), .25, .8);
    const slab = clamp(step(span / 35, .01), .14, .32);
    return {
      column: `${Math.round(column * 100)}×${Math.round(column * 100)} cm kolon sınıfı`,
      beam: `${Math.round(beamWidth * 100)}×${Math.round(beamDepth * 100)} cm kiriş sınıfı`,
      floor: `${Math.round(slab * 100)} cm plak / kirişli döşeme`,
      lateral: "Betonarme çerçeve + proje özelinde perde / çekirdek",
      basis: "Açıklık, kat ve düşey yük göstergesinden türetilen başlangıç kesiti",
      numeric: { columnSize: round(column), beamDepth: round(beamDepth), slabThickness: round(slab) },
    };
  }
  if (system === "precast") {
    const column = clamp(step(.35 + heightFactor * .025 + span * .01, .05), .4, 1.1);
    const beamDepth = clamp(step(span / 12, .05), .55, 1.6);
    const beamWidth = clamp(step(Math.max(.3, column * .7), .05), .3, .8);
    const floorDepth = clamp(step(span / 32, .05), .2, .55);
    return {
      column: `${Math.round(column * 100)}×${Math.round(column * 100)} cm prefabrik kolon sınıfı`,
      beam: `${Math.round(beamWidth * 100)}×${Math.round(beamDepth * 100)} cm prefabrik kiriş sınıfı`,
      floor: span > 14 ? `${Math.round(floorDepth * 100)} cm TT / öngerilmeli döşeme sınıfı` : `${Math.round(floorDepth * 100)} cm boşluklu döşeme sınıfı`,
      lateral: "Mafsallı / yarı rijit çerçeve + diyafram ve yatay yük sistemi doğrulaması",
      basis: "Taşıma, montaj, mesnet, birleşim ve üretici kalıbı belirlenmeden kavramsal boyut",
      numeric: { columnSize: round(column), beamDepth: round(beamDepth), slabThickness: round(Math.min(.28, floorDepth)) },
    };
  }
  if (system === "steel") {
    const columnDepth = clamp(step(.24 + heightFactor * .025 + span * .012, .05), .3, .9);
    const beamDepth = clamp(step(span / 18, .05), .3, 1.2);
    const deck = clamp(step(span / 75, .01), .1, .2);
    return {
      column: `H / kutu kesit ≈ ${Math.round(columnDepth * 100)} cm gövde derinliği sınıfı`,
      beam: `H / kaynaklı kiriş ≈ ${Math.round(beamDepth * 100)} cm gövde derinliği sınıfı`,
      floor: `${Math.round(deck * 100)} cm kompozit / kuru döşeme toplam sınıfı`,
      lateral: "Moment çerçevesi, çaprazlı çerçeve veya çekirdek ile doğrulanacak",
      basis: "Kesit serisi, burkulma boyu, birleşim ve sehim hesabından önce geometrik ön seçim",
      numeric: { columnSize: round(columnDepth), beamDepth: round(beamDepth), slabThickness: round(deck) },
    };
  }
  if (system === "light") {
    const studDepth = clamp(step(.12 + heightFactor * .02 + Math.max(0, span - 4) * .025, .025), .15, .35);
    const joistDepth = clamp(step(span / 18, .025), .2, .6);
    return {
      column: `C panel dikmesi ≈ ${Math.round(studDepth * 1_000)} mm @ 400–600 mm sınıfı`,
      beam: `C / sigma döşeme kirişi ≈ ${Math.round(joistDepth * 1_000)} mm sınıfı`,
      floor: `${Math.round(joistDepth * 1_000)} mm kiriş + levha / şap katmanı`,
      lateral: "Kaplamalı panel, çapraz veya hold-down düzeni proje özelinde",
      basis: "Kesit kalınlığı, delikler, yerel burkulma ve bağlantı hesabından önce panel sınıfı",
      numeric: { columnSize: round(studDepth), beamDepth: round(joistDepth), slabThickness: .1 },
    };
  }
  const core = clamp(step(.3 + heightFactor * .02, .05), .35, .8);
  const steelBeam = clamp(step(span / 19, .05), .35, 1.2);
  const deck = clamp(step(span / 70, .01), .11, .22);
  return {
    column: `Çelik kolon ≈ ${Math.round(Math.max(.3, core) * 100)} cm + betonarme çekirdek`,
    beam: `Kompozit / çelik kiriş ≈ ${Math.round(steelBeam * 100)} cm derinlik sınıfı`,
    floor: `${Math.round(deck * 100)} cm kompozit döşeme sınıfı`,
    lateral: "Betonarme çekirdek + çelik / prefabrik gravitasyon çerçevesi",
    basis: "Arayüz kuvvetleri ve yapım sırası çözülmeden bileşen sınıfı",
    numeric: { columnSize: round(core), beamDepth: round(steelBeam), slabThickness: round(deck) },
  };
}

function useModifier(system: StructuralSystem, usage: StructuralConceptInput["usage"]) {
  if (usage === "industrial" && (system === "precast" || system === "steel")) return 7;
  if (usage === "storage" && (system === "precast" || system === "steel")) return 6;
  if (usage === "residential" && (system === "light" || system === "concrete")) return 5;
  if (usage === "office" && (system === "steel" || system === "hybrid")) return 4;
  if (usage === "assembly" && (system === "steel" || system === "hybrid")) return 5;
  return 0;
}

export function createStructuralStudio(sourceInput: StructuralStudioInput) {
  const scheme = record(sourceInput.architecturalScheme);
  const schemeSource = record(scheme.source);
  const plate = record(scheme.plate);
  const core = record(scheme.core);
  const program = record(scheme.program);
  const circulation = record(scheme.circulation);
  const architecturalSchemeConnected = scheme.schema === "ARKEM-ARCH-SCHEME/3.0";
  // Interactive form, primary calculation, alternatives and exports must use one geometry.
  const useArchitecturalGeometry = architecturalSchemeConnected && sourceInput.geometryMode !== "input";
  const width = useArchitecturalGeometry ? numberValue(plate.width, sourceInput.input.width) : sourceInput.input.width;
  const depth = useArchitecturalGeometry ? numberValue(plate.depth, sourceInput.input.depth) : sourceInput.input.depth;
  const floors = useArchitecturalGeometry ? numberValue(plate.floors, sourceInput.input.floors) : sourceInput.input.floors;
  const floorHeight = useArchitecturalGeometry ? numberValue(plate.floorHeight, sourceInput.input.floorHeight) : sourceInput.input.floorHeight;
  const repetition = clamp(sourceInput.repetition, 0, 100);
  const transportDistance = clamp(sourceInput.transportDistance, 0, 2_000);
  const fireRating = clamp(sourceInput.fireRating, 30, 240);
  const geometryInput = { ...sourceInput.input, width, depth, floors, floorHeight };
  const spanX = width / Math.max(1, geometryInput.baysX);
  const spanY = depth / Math.max(1, geometryInput.baysY);
  const maximumSpan = Math.max(spanX, spanY);
  const totalArea = width * depth * floors;
  const totalHeight = floors * floorHeight;

  const rawAlternatives = SYSTEM_ORDER.map((system) => {
    const profile = PROFILES[system];
    const preliminary = preliminarySizes(system, { ...geometryInput, system });
    const calculated = calculateStructuralConcept({
      ...geometryInput,
      system,
      columnSize: preliminary.numeric.columnSize,
      beamDepth: preliminary.numeric.beamDepth,
      slabThickness: preliminary.numeric.slabThickness,
    });
    const criticalChecks = calculated.checks.filter((check) => check.state === "block").length;
    const reviewChecks = calculated.checks.filter((check) => check.state === "review").length;
    const spanExcess = Math.max(0, maximumSpan / profile.spanGuidance - 1);
    const heightExcess = Math.max(0, totalHeight / profile.heightGuidance - 1);
    const repetitionGain = repetition / 100 * profile.repetitionAffinity;
    const transportFactor = system === "precast" ? Math.max(0, transportDistance - 150) / 500 : system === "steel" || system === "light" ? Math.max(0, transportDistance - 350) / 1_000 : 0;
    const relativeCost = profile.costBase * (1 + spanExcess * .18 + heightExcess * .12 + transportFactor * .08 - repetitionGain * .08);
    const durationWeeks = profile.mobilizationWeeks + totalArea / 1_000 * profile.weeksPerThousandM2 * (1 - repetitionGain * .16);
    const embodiedCarbonProxy = calculated.quantities.concreteVolume * profile.carbonConcrete
      + (calculated.quantities.reinforcementTonnage + calculated.quantities.steelTonnage) * profile.carbonMetal;
    let score = 84 + useModifier(system, geometryInput.usage) - criticalChecks * 17 - reviewChecks * 4 - spanExcess * 30 - heightExcess * 24;
    score += repetitionGain * 10;
    if (system === "precast" && transportDistance > 300) score -= Math.min(10, (transportDistance - 300) / 50);
    if ((system === "steel" || system === "light") && fireRating >= 120) score -= 5;
    if (system === "hybrid" && stringValue(core.strategy) === "split") score += 3;
    score = clamp(score, 0, 100);
    const risks: string[] = [];
    if (maximumSpan > profile.spanGuidance) risks.push(`${round(maximumSpan, 1)} m açıklık, ${profile.spanGuidance} m kavramsal tarama eşiğini aşıyor.`);
    if (totalHeight > profile.heightGuidance) risks.push(`${round(totalHeight, 1)} m toplam yükseklik sistem karmaşıklığını artırıyor.`);
    if (system === "precast" && transportDistance > 250) risks.push("Taşıma güzergâhı, eleman boyutu, ağırlık ve vinç erişimi doğrulanmalı.");
    if ((system === "steel" || system === "light") && fireRating >= 90) risks.push(`${fireRating} dakika yangın hedefi koruma katmanı ve birleşim detayı gerektiriyor.`);
    if (system === "hybrid") risks.push("Sistem arayüzü, yapım sırası ve farklı rijitliklerin birlikte çalışması çözülmeli.");
    if (!risks.length) risks.push("Zemin, yük, stabilite, birleşim ve temel verileriyle ayrıntılı doğrulama gerekli.");
    return {
      system,
      label: SYSTEM_LABELS[system],
      description: profile.description,
      score: round(score, 1),
      status: criticalChecks || score < 55 ? "risk" as const : reviewChecks > 1 || score < 74 ? "review" as const : "fits" as const,
      preliminary,
      demand: {
        serviceAreaLoad: round(calculated.loads.serviceAreaLoad),
        ulsAreaLoad: round(calculated.loads.ulsAreaLoad),
        seismicWeight: round(calculated.loads.seismicWeight),
        baseShearProxy: round(calculated.dynamics.baseShearProxy),
        maximumSpan: round(maximumSpan),
      },
      indices: {
        relativeCost: round(relativeCost, 1),
        durationWeeks: round(durationWeeks, 1),
        embodiedCarbonProxy: round(embodiedCarbonProxy),
        factoryShare: profile.factoryShare,
        massIndex: 0,
      },
      quantities: calculated.quantities,
      checks: calculated.checks,
      criticalChecks,
      reviewChecks,
      risks,
    };
  });
  const minimumWeight = Math.max(1, Math.min(...rawAlternatives.map((item) => item.demand.seismicWeight)));
  const alternatives = rawAlternatives.map((item) => ({
    ...item,
    indices: { ...item.indices, massIndex: round(item.demand.seismicWeight / minimumWeight * 100, 1) },
  }));
  const recommendation = [...alternatives].sort((left, right) => right.score - left.score)[0];
  const active = alternatives.find((item) => item.system === sourceInput.input.system) ?? recommendation;
  const checks = [
    {
      code: "STR-114-01",
      label: "Hesap geometri kaynağı",
      value: `${round(width, 1)} × ${round(depth, 1)} m · ${useArchitecturalGeometry ? "V113" : "Form girdisi"}`,
      state: "review" as const,
      note: useArchitecturalGeometry ? "Hesap geometrisi V113 şemasından alındı; mimari ve mühendislik uygunluğu ayrıca doğrulanır." : "Hesap ve alternatiflerin tamamı form geometrisini kullanır; bağlantılı mimari şema geometriyi değiştirmez.",
    },
    {
      code: "STR-114-02",
      label: "Aks ve açıklık çözünürlüğü",
      value: `${geometryInput.baysX}×${geometryInput.baysY} · ${round(maximumSpan, 1)} m`,
      state: maximumSpan <= 18 ? "pass" as const : maximumSpan <= 24 ? "review" as const : "risk" as const,
      note: "Aks adedi ve en büyük açıklık beş sistemin aynı geometrisi üzerinde karşılaştırılır.",
    },
    {
      code: "STR-114-03",
      label: "Seçili sistem ön taraması",
      value: `${active.label} · ${active.score.toFixed(1)}`,
      state: active.status === "fits" ? "pass" as const : active.status === "review" ? "review" as const : "risk" as const,
      note: "Puan yalnız sistemleri aynı kabul setinde önceliklendirir; statik uygunluk kararı değildir.",
    },
    {
      code: "STR-114-04",
      label: "Deprem ve zemin girdisi",
      value: `SDS ${round(geometryInput.sds, 2)} · SD1 ${round(geometryInput.sd1, 2)}`,
      state: geometryInput.sds > 0 && geometryInput.sd1 > 0 ? "review" as const : "risk" as const,
      note: "Spektral değerler ve zemin sınıfı resmî koordinat verisi ile zemin etüdünden doğrulanmalıdır.",
    },
    {
      code: "STR-114-05",
      label: "Yangın performansı girdisi",
      value: `${fireRating} dk`,
      state: fireRating >= 60 ? "review" as const : "risk" as const,
      note: "Yangın dayanımı kesit, kaplama, birleşim, kullanım ve güncel mevzuatla ayrıca tasarlanır.",
    },
    {
      code: "STR-114-06",
      label: "Üretim ve lojistik girdisi",
      value: `%${round(repetition, 0)} tekrar · ${round(transportDistance, 0)} km`,
      state: repetition > 0 && transportDistance > 0 ? "pass" as const : "review" as const,
      note: "Fabrika kapasitesi, eleman boyutu, nakliye güzergâhı, vinç ve saha erişimi henüz teklif verisi değildir.",
    },
  ];

  return {
    schema: "ARKEM-STRUCTURAL-STUDIO/3.0" as const,
    reference: sourceInput.reference,
    generatedAt: sourceInput.generatedAt ?? new Date().toISOString(),
    source: {
      architecturalSchemeConnected,
      carbonBasis: "Temsili katsayılar: beton kgCO2e/m³, metal kgCO2e/t; ürün EPD doğrulaması ve kapsamlı yaşam döngüsü analizi yok.",
      geometryOrigin: useArchitecturalGeometry ? "architectural-scheme" : "form-input",
      authoritativeGeometry: false,
      needsReview: true,
      selectedMassingId: stringValue(schemeSource.selectedMassingId) || null,
      coreStrategy: stringValue(core.strategy) || null,
      architectureTrust: useArchitecturalGeometry ? "derived" : "missing",
    },
    geometry: {
      width: round(width),
      depth: round(depth),
      floors: round(floors, 0),
      floorHeight: round(floorHeight),
      totalArea: round(totalArea),
      totalHeight: round(totalHeight),
      baysX: geometryInput.baysX,
      baysY: geometryInput.baysY,
      spanX: round(spanX),
      spanY: round(spanY),
      maximumSpan: round(maximumSpan),
      spaceNodes: Array.isArray(scheme.nodes) ? scheme.nodes.length : 0,
      occupants: numberValue(program.occupants),
      maximumTravelDistance: numberValue(circulation.maximumTravelDistance),
    },
    production: { repetition: round(repetition, 0), transportDistance: round(transportDistance), fireRating: round(fireRating, 0) },
    alternatives,
    recommendation: {
      system: recommendation.system,
      label: recommendation.label,
      score: recommendation.score,
      reason: `${recommendation.label}; açıklık, kullanım, tekrar, üretim süresi ve ön kontrol sonuçlarında en yüksek bileşik puanı aldı.`,
    },
    activeSystem: active.system,
    checks,
    assumptions: {
      cost: "Göreli maliyet endeksi; yerel keşif, kur, işçilik, üretici teklifi ve temel maliyetini içermez.",
      duration: "Yalnız taşıyıcı sistem için parametrik süre göstergesidir; iş programı değildir.",
      carbon: "Genel malzeme katsayılarıyla yön karşılaştırmasıdır; EPD veya EN 15978 LCA sonucu değildir.",
    },
    limitations: [
      "Montaj aşaması stabilitesi, kaldırma, geçici destek, kalıp/iskele ve yapım aşaması yükleri değerlendirilmemiştir; ayrı mühendislik çalışması gerektirir.",
      "Kesitler ön boyutlandırma sınıfıdır; eleman dayanım, stabilite, sehim, titreşim, birleşim ve detay hesabı değildir.",
      "Deprem sonucu yalnız talep göstergesidir; TBDY uyumlu üç boyutlu statik analiz, düzensizlik, ikinci mertebe ve temel–zemin etkileşimi içermez.",
      "Göreli maliyet, süre ve karbon göstergeleri teklif, iş programı veya sertifikalı yaşam döngüsü değerlendirmesi değildir.",
      "Uygulama ve ruhsat projesi, yetkili inşaat mühendisi tarafından doğrulanmış geometri, yük, zemin, malzeme ve detaylarla hazırlanır.",
    ],
  };
}
