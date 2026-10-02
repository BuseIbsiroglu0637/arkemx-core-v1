export type CoordinationSectionStrategy = "stacked" | "integrated";

export function calculateConceptualClearHeight(
  floorHeight: number,
  beamDepth: number,
  serviceZone: number,
  ceilingBuildUp: number,
  raisedFloor: number,
  strategy: CoordinationSectionStrategy = "stacked",
) {
  const occupiedCeilingZone = strategy === "integrated"
    ? Math.max(beamDepth, serviceZone)
    : beamDepth + serviceZone;
  return {
    occupiedCeilingZone,
    clearHeight: floorHeight - occupiedCeilingZone - ceilingBuildUp - raisedFloor,
  };
}

export type BimCoordinationInput = {
  projectId: string;
  projectRevision: string;
  coordinateReference: string;
  architecturalScheme?: unknown;
  structuralStudio?: unknown;
  floorHeight?: number;
  beamDepth?: number;
  slabDepth?: number;
  serviceZone: number;
  ceilingBuildUp: number;
  raisedFloor: number;
  sectionStrategy?: CoordinationSectionStrategy;
  shaftArea: number;
  plantArea: number;
  factoredGravity: number;
  soilBearing: number;
  rainfallIntensity: number;
  outletCapacity: number;
  sprinkler: boolean;
  facadeTolerance: number;
  generatedAt?: string;
};

export type BimClash = {
  guid: string;
  type: "hard" | "soft" | "data" | "process";
  severity: "critical" | "review" | "info";
  title: string;
  disciplines: string[];
  location: string;
  evidence: string;
  requiredAction: string;
  assignee: string;
  status: "Open";
  sourceRefs: string[];
  nativeViewpoint: false;
};

type UnknownRecord = Record<string, unknown>;

const record = (value: unknown): UnknownRecord => value && typeof value === "object" && !Array.isArray(value) ? value as UnknownRecord : {};
const numberValue = (value: unknown, fallback = 0) => typeof value === "number" && Number.isFinite(value) ? value : fallback;
const stringValue = (value: unknown, fallback = "") => typeof value === "string" ? value : fallback;
const clamp = (value: number, minimum: number, maximum: number) => Math.min(maximum, Math.max(minimum, Number.isFinite(value) ? value : minimum));
const round = (value: number, digits = 2) => Number(value.toFixed(digits));

function stableGuid(seed: string) {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `BIM-${Math.abs(hash >>> 0).toString(16).padStart(8, "0").toUpperCase()}`;
}

function axisName(index: number) {
  let value = index;
  let label = "";
  do {
    label = String.fromCharCode(65 + value % 26) + label;
    value = Math.floor(value / 26) - 1;
  } while (value >= 0);
  return label;
}

function addClash(clashes: BimClash[], projectId: string, input: Omit<BimClash, "guid" | "status" | "nativeViewpoint">) {
  clashes.push({
    ...input,
    guid: stableGuid(`${projectId}:${input.type}:${input.title}:${input.location}`),
    status: "Open",
    nativeViewpoint: false,
  });
}

export function createBimCoordinationModel(input: BimCoordinationInput) {
  const architecture = record(input.architecturalScheme);
  const architectureSource = record(architecture.source);
  const plate = record(architecture.plate);
  const program = record(architecture.program);
  const cores = Array.isArray(architecture.cores) ? architecture.cores.map(record) : [];
  const structure = record(input.structuralStudio);
  const structureSource = record(structure.source);
  const structureGeometry = record(structure.geometry);
  const recommendation = record(structure.recommendation);
  const alternatives = Array.isArray(structure.alternatives) ? structure.alternatives.map(record) : [];
  const architectureConnected = architecture.schema === "ARKEM-ARCH-SCHEME/3.0";
  const structureConnected = structure.schema === "ARKEM-STRUCTURAL-STUDIO/3.0";
  const selectedSystem = stringValue(recommendation.system, stringValue(structure.activeSystem));
  const selectedAlternative = alternatives.find((alternative) => stringValue(alternative.system) === selectedSystem) ?? alternatives[0] ?? {};
  const preliminary = record(selectedAlternative.preliminary);
  const preliminaryNumeric = record(preliminary.numeric);
  const indices = record(selectedAlternative.indices);
  const structuralQuantities = record(selectedAlternative.quantities);

  const width = numberValue(plate.width, numberValue(structureGeometry.width, 1));
  const depth = numberValue(plate.depth, numberValue(structureGeometry.depth, 1));
  const floors = Math.max(1, Math.round(numberValue(plate.floors, numberValue(structureGeometry.floors, 1))));
  const floorHeight = numberValue(input.floorHeight, numberValue(plate.floorHeight, numberValue(structureGeometry.floorHeight, 3)));
  const floorPlate = Math.max(1, numberValue(plate.area, width * depth));
  const totalArea = Math.max(floorPlate * floors, numberValue(structureGeometry.totalArea));
  const baysX = Math.max(1, Math.round(numberValue(structureGeometry.baysX, 1)));
  const baysY = Math.max(1, Math.round(numberValue(structureGeometry.baysY, 1)));
  const beamDepth = numberValue(input.beamDepth, numberValue(preliminaryNumeric.beamDepth, .6));
  const slabDepth = numberValue(input.slabDepth, numberValue(preliminaryNumeric.slabThickness, .16));
  const serviceZone = clamp(input.serviceZone, .15, 2);
  const ceilingBuildUp = clamp(input.ceilingBuildUp, 0, .5);
  const raisedFloor = clamp(input.raisedFloor, 0, .5);
  const sectionStrategy: CoordinationSectionStrategy = input.sectionStrategy === "integrated" ? "integrated" : "stacked";
  const sectionBudget = calculateConceptualClearHeight(floorHeight, beamDepth, serviceZone, ceilingBuildUp, raisedFloor, sectionStrategy);
  const clearHeight = sectionBudget.clearHeight;
  const shaftArea = clamp(input.shaftArea, 1, 5_000);
  const plantArea = clamp(input.plantArea, 1, 20_000);
  const shaftRatio = shaftArea / floorPlate * 100;
  const serviceRatio = serviceZone / floorHeight * 100;
  const bearingPressure = input.factoredGravity > 0 ? input.factoredGravity / floorPlate : 0;
  const bearingUtilization = bearingPressure / Math.max(input.soilBearing, 1) * 100;
  const rainwaterFlow = clamp(input.rainfallIntensity, 0, 1_000) * floorPlate / 3_600;
  const outletCount = Math.max(1, Math.ceil(rainwaterFlow / Math.max(input.outletCapacity, .5)));
  const occupants = Math.max(0, Math.round(numberValue(program.occupants)));
  const coreArea = cores.reduce((sum, core) => sum + numberValue(core.area), 0);

  const spatial = {
    levels: Array.from({ length: floors + 1 }, (_, index) => ({
      id: index === 0 ? "LEVEL-00" : `LEVEL-${String(index).padStart(2, "0")}`,
      label: index === 0 ? "±0.000" : `Kat ${index}`,
      elevationM: round(index * floorHeight, 3),
    })),
    axes: {
      x: Array.from({ length: baysX + 1 }, (_, index) => ({ id: `AXIS-X-${index + 1}`, label: axisName(index), offsetM: round(index * width / baysX, 3) })),
      y: Array.from({ length: baysY + 1 }, (_, index) => ({ id: `AXIS-Y-${index + 1}`, label: String(index + 1), offsetM: round(index * depth / baysY, 3) })),
    },
    plate: { widthM: round(width), depthM: round(depth), floorAreaM2: round(floorPlate), floors, floorHeightM: round(floorHeight), slabDepthM: round(slabDepth) },
  };

  const coordinateReference = input.coordinateReference.trim() || "PROJECT LOCAL · ORIGIN UNVERIFIED";
  const coordinateVerified = /EPSG|ITRF|TUREF|UTM/i.test(coordinateReference) && !/UNVERIFIED|BİLİNMİYOR|UNKNOWN/i.test(coordinateReference);
  const geometryMatches = architectureConnected && structureConnected
    && Math.abs(numberValue(plate.width) - numberValue(structureGeometry.width)) <= .05
    && Math.abs(numberValue(plate.depth) - numberValue(structureGeometry.depth)) <= .05
    && Math.round(numberValue(plate.floors)) === Math.round(numberValue(structureGeometry.floors));

  const layers = [
    { code: "ARC", label: "Mimari mekânsal şema", state: architectureConnected ? "connected" as const : "missing" as const, revision: input.projectRevision, sourceSchema: stringValue(architecture.schema, "—") },
    { code: "STR", label: "Taşıyıcı sistem ve ön boyut", state: structureConnected ? "connected" as const : "missing" as const, revision: input.projectRevision, sourceSchema: stringValue(structure.schema, "—") },
    { code: "MEP", label: "Servis zonu ve şaft rezervi", state: "conceptual" as const, revision: input.projectRevision, sourceSchema: "ARKEM-MEP-ZONE/1.0" },
    { code: "FIRE", label: "Yangın koordinasyon senaryosu", state: "conceptual" as const, revision: input.projectRevision, sourceSchema: "ARKEM-FIRE-SCREEN/1.0" },
    { code: "GEO", label: "Koordinat ve zemin girdisi", state: coordinateVerified ? "connected" as const : "conceptual" as const, revision: input.projectRevision, sourceSchema: coordinateVerified ? coordinateReference : "PROJECT-LOCAL" },
    { code: "CDE", label: "Issue ve karar kaydı", state: "conceptual" as const, revision: input.projectRevision, sourceSchema: "DEVICE-LOCAL / PROJECT KERNEL" },
  ];

  const clashes: BimClash[] = [];
  if (clearHeight < 2.4) addClash(clashes, input.projectId, {
    type: "hard", severity: "critical", title: "Kiriş ve MEP zonu net kullanım yüksekliğini ihlal ediyor",
    disciplines: ["STR", "MEP", "ARC"], location: "Tip kat · ana servis koridoru",
    evidence: sectionStrategy === "integrated"
      ? `${floorHeight.toFixed(2)} m kat − max(${beamDepth.toFixed(2)} m kiriş, ${serviceZone.toFixed(2)} m MEP) − ${(ceilingBuildUp + raisedFloor).toFixed(2)} m paket = ${clearHeight.toFixed(2)} m net · entegre servis bandı`
      : `${floorHeight.toFixed(2)} m kat − ${beamDepth.toFixed(2)} m kiriş − ${serviceZone.toFixed(2)} m MEP − ${(ceilingBuildUp + raisedFloor).toFixed(2)} m paket = ${clearHeight.toFixed(2)} m net · ayrık servis bandı`,
    requiredAction: "Kiriş güzergâhını, kanal/boru kotunu veya kat yüksekliğini ortak kesitte yeniden çözün.", assignee: "BIM Koordinatörü", sourceRefs: ["ARC:LEVELS", "STR:PRELIMINARY-BEAM", "MEP:SERVICE-ZONE"],
  });
  else if (clearHeight < 2.7) addClash(clashes, input.projectId, {
    type: "soft", severity: "review", title: "Net kullanım yüksekliği inceleme bandında",
    disciplines: ["ARC", "MEP"], location: "Tip kat · asma tavan zonu", evidence: `${clearHeight.toFixed(2)} m net yükseklik · ${sectionStrategy === "integrated" ? "entegre servis bandı" : "ayrık servis bandı"}`,
    requiredAction: "Mahal kullanım hedefi ile bakım boşluklarını doğrulayın.", assignee: "Mimar", sourceRefs: ["ARC:LEVELS", "MEP:SERVICE-ZONE"],
  });
  if (shaftRatio < 1.5) addClash(clashes, input.projectId, {
    type: "soft", severity: shaftRatio < 1 ? "critical" : "review", title: "Düşey şaft rezervi disiplin taleplerinin altında",
    disciplines: ["ARC", "MEP", "FIRE"], location: cores.length ? `${cores[0].id ?? "CORE-1"} çevresi` : "Düşey çekirdek",
    evidence: `${shaftArea.toFixed(1)} m²/kat · kat alanının %${shaftRatio.toFixed(2)}'si`, requiredAction: "HVAC, elektrik, sıhhi tesisat ve yangın şaftlarını ayrı rezervlerle yerleştirin.",
    assignee: "MEP Koordinatörü", sourceRefs: ["ARC:CORES", "MEP:SHAFT-RESERVE"],
  });
  if (serviceRatio > 25) addClash(clashes, input.projectId, {
    type: "soft", severity: serviceRatio > 32 ? "critical" : "review", title: "MEP servis zonu kat kesitinde yüksek pay kullanıyor",
    disciplines: ["MEP", "ARC", "STR"], location: "Tüm tip katlar", evidence: `Servis zonu kat yüksekliğinin %${serviceRatio.toFixed(1)}'i`,
    requiredAction: "Ana kanal ve boru güzergâhlarını aks/kiriş boşluklarına göre bölümlendirin.", assignee: "MEP Koordinatörü", sourceRefs: ["MEP:SERVICE-ZONE", "STR:GRID"],
  });
  if (bearingUtilization > 70) addClash(clashes, input.projectId, {
    type: "data", severity: bearingUtilization > 100 ? "critical" : "review", title: "Temel basınç göstergesi zemin girdisiyle uyuşmuyor",
    disciplines: ["STR", "GEO"], location: "Temel / zemin arayüzü", evidence: `${bearingPressure.toFixed(1)} / ${input.soilBearing.toFixed(1)} kN/m² · %${bearingUtilization.toFixed(0)}`,
    requiredAction: "Zemin etüdü, temel modeli ve gerçek mesnet reaksiyonlarını doğrulayın.", assignee: "Geoteknik Uzmanı", sourceRefs: ["STR:GRAVITY-DEMAND", "GEO:BEARING-INPUT"],
  });
  if (outletCount > 8) addClash(clashes, input.projectId, {
    type: "soft", severity: "review", title: "Çatı drenajı bölümlendirme ve taşma senaryosu gerektiriyor",
    disciplines: ["ARC", "MEP"], location: "Çatı", evidence: `${rainwaterFlow.toFixed(1)} L/s gösterge · ${outletCount} çıkış`,
    requiredAction: "Dere, süzgeç, acil taşma ve yerel yağış tekerrürünü proje özelinde çözün.", assignee: "Mekanik Proje Müellifi", sourceRefs: ["ARC:ROOF-PLATE", "MEP:RAINWATER"],
  });
  if (!input.sprinkler && occupants > 100) addClash(clashes, input.projectId, {
    type: "process", severity: "review", title: "Yangın söndürme senaryosu kullanıcı yüküyle birlikte doğrulanmamış",
    disciplines: ["FIRE", "MEP", "ARC"], location: "Tüm yapı", evidence: `${occupants} kişi kavramsal yük · sprinkler senaryosu kapalı`,
    requiredAction: "Yetkili yangın danışmanı ile aktif ve pasif koruma stratejisini karara bağlayın.", assignee: "Yangın Danışmanı", sourceRefs: ["ARC:OCCUPANCY", "FIRE:SPRINKLER-SCENARIO"],
  });
  if (input.facadeTolerance < 12) addClash(clashes, input.projectId, {
    type: "soft", severity: "review", title: "Cephe montaj toleransı taşıyıcı arayüz için dar",
    disciplines: ["ARC", "STR"], location: "Cephe / döşeme kenarı", evidence: `${input.facadeTolerance.toFixed(0)} mm toplam tolerans bütçesi`,
    requiredAction: "Taşıyıcı, ankraj, panel ve ölçme toleranslarını paket bazında dağıtın.", assignee: "Cephe Koordinatörü", sourceRefs: ["ARC:FACADE", "STR:EDGE-TOLERANCE"],
  });

  const linkedToStructuralAlternative = Boolean(structureConnected && Object.keys(selectedAlternative).length);
  const structuralCarbon = numberValue(indices.embodiedCarbonProxy);
  const structuralDuration = numberValue(indices.durationWeeks, Math.max(2, totalArea / 1_000 * 4));
  const coordinationWeeks = Math.max(1, round(totalArea / 5_000 + clashes.length * .18, 1));
  const rawPhases = [
    { id: "4D-01", name: "Model dondurma ve koordinat onayı", durationWeeks: 1 },
    { id: "4D-02", name: "Taşıyıcı model / üretim koordinasyonu", durationWeeks: round(Math.max(1.5, structuralDuration * .22), 1) },
    { id: "4D-03", name: "MEP güzergâh ve şaft koordinasyonu", durationWeeks: round(Math.max(1.5, totalArea / 2_500), 1) },
    { id: "4D-04", name: "Çakışma kapatma çevrimleri", durationWeeks: coordinationWeeks },
    { id: "4D-05", name: "Federasyon kontrolü ve teslim manifestosu", durationWeeks: .8 },
  ];
  let cursor = 0;
  const phases = rawPhases.map((phase) => {
    const startWeek = round(cursor, 1);
    cursor += phase.durationWeeks;
    return { ...phase, startWeek, endWeek: round(cursor, 1), source: "parametric-indicator" as const };
  });

  const criticalClashes = clashes.filter((clash) => clash.severity === "critical").length;
  const checks = [
    { code: "BIM-115-01", label: "V113 mimari şema bağlantısı", state: architectureConnected ? "pass" as const : "risk" as const, value: architectureConnected ? `${width.toFixed(1)} × ${depth.toFixed(1)} m` : "Bağlantı yok", note: "Kat, çekirdek ve kullanıcı yükü mimari şemadan okunur." },
    { code: "BIM-115-02", label: "V114 taşıyıcı stüdyo bağlantısı", state: structureConnected ? "pass" as const : "risk" as const, value: structureConnected ? stringValue(recommendation.label, selectedSystem) : "Bağlantı yok", note: "Aks, kesit sınıfı, miktar ve göreli göstergeler taşıyıcı stüdyodan okunur." },
    { code: "BIM-115-03", label: "Ortak koordinat referansı", state: coordinateVerified ? "pass" as const : "review" as const, value: coordinateReference, note: "Gerçek IFC yerleşimi için proje baz noktası, kuzey ve düşey datum ayrıca doğrulanır." },
    { code: "BIM-115-04", label: "Aks, plaka ve kat eşleşmesi", state: geometryMatches ? "pass" as const : architectureConnected && structureConnected ? "risk" as const : "review" as const, value: `${baysX}×${baysY} aks · ${floors} kat`, note: "Mimari ve taşıyıcı geometri aynı revizyonda karşılaştırılır." },
    { code: "BIM-115-05", label: "Açık çakışma kapısı", state: criticalClashes ? "risk" as const : clashes.length ? "review" as const : "pass" as const, value: `${clashes.length} açık · ${criticalClashes} kritik`, note: "Kritik issue kapanmadan koordinasyon dondurma kapısı geçmez." },
    { code: "BIM-115-06", label: "IFC / BCF teslim sınırı", state: "review" as const, value: "Hazırlık manifestosu", note: "Yerel şema gerçek IFC modeli veya native BCFZIP üretmez; GUID, viewpoint ve CDE bağlantısı gerekir." },
  ];

  return {
    schema: "ARKEM-BIM-COORDINATION/3.0" as const,
    projectId: input.projectId,
    projectRevision: input.projectRevision,
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    source: {
      architectureConnected,
      structureConnected,
      authoritativeGeometry: architectureConnected && structureConnected && architectureSource.authoritativeMassing === true && structureSource.architectureTrust === "verified",
      geometryMatches,
      selectedMassingId: stringValue(architectureSource.selectedMassingId) || null,
      selectedStructuralSystem: selectedSystem || null,
    },
    coordinateSystem: {
      reference: coordinateReference,
      verified: coordinateVerified,
      origin: { x: 0, y: 0, z: 0, unit: "m" },
      trueNorthDeg: null,
      verticalDatum: coordinateVerified ? "source-reference-pending-survey-confirmation" : "unverified",
    },
    spatial,
    federation: {
      layers,
      connectedCount: layers.filter((layer) => layer.state === "connected").length,
      conceptualCount: layers.filter((layer) => layer.state === "conceptual").length,
      missingCount: layers.filter((layer) => layer.state === "missing").length,
      commonRevision: input.projectRevision,
    },
    coordination: {
      clearHeightM: round(clearHeight),
      sectionStrategy,
      occupiedCeilingZoneM: round(sectionBudget.occupiedCeilingZone),
      serviceZoneM: round(serviceZone),
      serviceRatioPct: round(serviceRatio, 1),
      shaftRatioPct: round(shaftRatio, 2),
      plantRatioPct: round(plantArea / totalArea * 100, 2),
      coreAreaM2: round(coreArea),
      bearingPressureKNM2: round(bearingPressure),
      bearingUtilizationPct: round(bearingUtilization, 1),
      rainwaterFlowLs: round(rainwaterFlow, 1),
      outletCount,
    },
    clashes,
    quantities: {
      linkedToStructuralAlternative,
      structural: {
        concreteVolumeM3: round(numberValue(structuralQuantities.concreteVolume)),
        reinforcementT: round(numberValue(structuralQuantities.reinforcementTonnage)),
        structuralSteelT: round(numberValue(structuralQuantities.steelTonnage)),
      },
      architectural: { grossFloorAreaM2: round(totalArea), floorPlateM2: round(floorPlate) },
      coordination: { serviceZoneVolumeM3: round(floorPlate * serviceZone * floors), shaftReserveM2: round(shaftArea * floors), plantAreaM2: round(plantArea) },
    },
    carbon: {
      structuralKgCO2e: round(structuralCarbon),
      intensityKgCO2eM2: totalArea > 0 ? round(structuralCarbon / totalArea, 1) : 0,
      coverage: linkedToStructuralAlternative ? "structural-indicator-only" as const : "missing" as const,
      certifiedLca: false as const,
    },
    schedule4D: { phases, totalWeeks: round(cursor, 1), baselineSchedule: false as const, linkedModelElements: false as const },
    cost5D: {
      linkedQuantities: linkedToStructuralAlternative,
      relativeStructuralCost: round(numberValue(indices.relativeCost)),
      packageIndices: [
        { package: "Taşıyıcı sistem", relativeIndex: round(numberValue(indices.relativeCost)) },
        { package: "MEP koordinasyon rezervi", relativeIndex: round(100 + serviceRatio * .8) },
        { package: "BIM koordinasyon yükü", relativeIndex: round(100 + clashes.length * 2.5) },
      ],
      currencyEstimate: false as const,
    },
    interoperability: {
      profile: "IFC4 hazırlık manifestosu + BCF uyumlu issue kaydı",
      nativeIfcModel: false as const,
      nativeBcfZip: false as const,
      ifcGuidCoveragePct: 0,
      viewpointCoveragePct: 0,
      cdeConnected: false as const,
      requiredForNativeExchange: ["Yetkili IFC model GUID'leri", "IfcProject / IfcSite yerleşimi", "BCF viewpoint ve snapshot", "CDE proje alanı ve yetkilendirme"],
    },
    checks,
    limitations: [
      "Bu kayıt IFC4 hazırlık manifestosudur; native IFC modelini üretmez, doğrulamaz veya dönüştürmez.",
      "Issue listesi BCF uyumluluğuna hazırlıktır; model GUID'leri, kamera viewpoint'leri ve yetkili CDE olmadan gerçek BCFZIP değildir.",
      "Metraj ve karbon yalnız V114 ön sistem göstergelerine bağlıdır; keşif, teklif, üretici EPD'si veya sertifikalı LCA değildir.",
      "4B ve 5B alanları göreli planlama göstergesidir; onaylı iş programı, hakediş veya maliyet kontrol sistemi değildir.",
      "Koordinasyon çıktısı uygulama projesi yerine geçmez; mimari, statik, MEP, yangın ve geoteknik ekiplerince gerçek modeller üzerinde doğrulanır.",
    ],
  };
}
