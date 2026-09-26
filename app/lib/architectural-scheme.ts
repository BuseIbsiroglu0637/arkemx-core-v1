export type ArchitecturalCoreStrategy = "central" | "split" | "perimeter";

export type ArchitecturalSpaceInput = {
  id: string;
  code: string;
  name: string;
  zone: string;
  count: number;
  unitArea: number;
  density: number;
  daylight: boolean;
  accessible: boolean;
};

export type ArchitecturalRelationshipInput = {
  id: string;
  from: string;
  to: string;
  priority: "Zorunlu" | "Tercih";
  confirmed: boolean;
};

export type ArchitecturalSchemeInput = {
  reference: string;
  use: string;
  targetGross: number;
  netRatio: number;
  floors: number;
  floorHeight: number;
  aspect: number;
  corridorWidth: number;
  targetTravel: number;
  stairs: number;
  elevators: number;
  coreStrategy: ArchitecturalCoreStrategy;
  spaces: ArchitecturalSpaceInput[];
  relationships: ArchitecturalRelationshipInput[];
  massingModel?: unknown;
  selectedMassingId?: string;
  generatedAt?: string;
};

type UnknownRecord = Record<string, unknown>;

const record = (value: unknown): UnknownRecord => value && typeof value === "object" && !Array.isArray(value) ? value as UnknownRecord : {};
const numberValue = (value: unknown, fallback = 0) => typeof value === "number" && Number.isFinite(value) ? value : fallback;
const stringValue = (value: unknown, fallback = "") => typeof value === "string" ? value : fallback;
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, Number.isFinite(value) ? value : min));
const round = (value: number, digits = 2) => Number(value.toFixed(digits));

function perimeterPosition(index: number, count: number) {
  const progress = ((index + .5) / Math.max(count, 1)) * 4;
  const side = Math.min(3, Math.floor(progress));
  const local = progress - side;
  if (side === 0) return { x: 12 + local * 76, y: 10, edge: "north" as const };
  if (side === 1) return { x: 90, y: 12 + local * 76, edge: "east" as const };
  if (side === 2) return { x: 88 - local * 76, y: 90, edge: "south" as const };
  return { x: 10, y: 88 - local * 76, edge: "west" as const };
}

function innerPosition(index: number, count: number) {
  const columns = Math.max(1, Math.ceil(Math.sqrt(count)));
  const rows = Math.max(1, Math.ceil(count / columns));
  const column = index % columns;
  const row = Math.floor(index / columns);
  return {
    x: 30 + (column + .5) * (40 / columns),
    y: 28 + (row + .5) * (44 / rows),
    edge: "interior" as const,
  };
}

function createCorePositions(strategy: ArchitecturalCoreStrategy, plateWidth: number, plateDepth: number) {
  if (strategy === "split") {
    return plateWidth >= plateDepth
      ? [{ x: 25, y: 50 }, { x: 75, y: 50 }]
      : [{ x: 50, y: 25 }, { x: 50, y: 75 }];
  }
  if (strategy === "perimeter") return [{ x: plateWidth >= plateDepth ? 86 : 50, y: plateWidth >= plateDepth ? 50 : 86 }];
  return [{ x: 50, y: 50 }];
}

function createExitPositions(count: number) {
  const candidates = [
    { x: 5, y: 5, edge: "north-west" },
    { x: 95, y: 95, edge: "south-east" },
    { x: 95, y: 5, edge: "north-east" },
    { x: 5, y: 95, edge: "south-west" },
  ];
  return candidates.slice(0, clamp(Math.round(count), 1, candidates.length));
}

function metricDistance(a: { x: number; y: number }, b: { x: number; y: number }, width: number, depth: number) {
  const deltaX = ((a.x - b.x) / 100) * width;
  const deltaY = ((a.y - b.y) / 100) * depth;
  return Math.hypot(deltaX, deltaY);
}

function routeDistance(a: { x: number; y: number }, b: { x: number; y: number }, width: number, depth: number) {
  return (Math.abs(a.x - b.x) / 100 * width + Math.abs(a.y - b.y) / 100 * depth) * 1.12;
}

export function createArchitecturalScheme(input: ArchitecturalSchemeInput) {
  const floors = clamp(Math.round(input.floors), 1, 60);
  const targetGross = Math.max(1, numberValue(input.targetGross, 1));
  const netRatio = clamp(numberValue(input.netRatio, 75), 40, 95) / 100;
  const aspect = clamp(numberValue(input.aspect, 1.45), .5, 4);
  const corridorWidth = clamp(numberValue(input.corridorWidth, 1.8), 1.2, 5);
  const targetTravel = clamp(numberValue(input.targetTravel, 30), 10, 80);
  const stairs = clamp(Math.round(input.stairs), 1, 12);
  const elevators = clamp(Math.round(input.elevators), 0, 12);
  const floorHeight = clamp(numberValue(input.floorHeight, 3), 2.4, 12);
  const spaces = input.spaces.filter((space) => space && space.id && space.name);
  const netArea = spaces.reduce((sum, space) => sum + Math.max(1, space.count) * Math.max(0, space.unitArea), 0);
  const grossDemand = netArea / netRatio;
  const targetPlateArea = Math.max(targetGross, grossDemand) / floors;

  const massing = record(input.massingModel);
  const massingSource = record(massing.source);
  const envelope = record(massing.envelope);
  const alternatives = Array.isArray(massing.alternatives) ? massing.alternatives.map(record) : [];
  const requestedMassingId = input.selectedMassingId || stringValue(massing.recommendedAlternativeId);
  const selectedMassing = alternatives.find((item) => stringValue(item.id) === requestedMassingId)
    ?? alternatives.find((item) => stringValue(item.status) === "fits")
    ?? alternatives[0]
    ?? {};
  const selectedMassingId = stringValue(selectedMassing.id, requestedMassingId);
  const massingConnected = massing.schema === "ARKEM-ZONING-MASSING/1.0";
  const maximumWidth = numberValue(selectedMassing.width) || numberValue(envelope.width);
  const maximumDepth = numberValue(selectedMassing.depth) || numberValue(envelope.depth);
  const desiredWidth = Math.sqrt(targetPlateArea * aspect);
  const desiredDepth = desiredWidth / aspect;
  const fitScale = maximumWidth > 0 && maximumDepth > 0
    ? Math.min(1, maximumWidth / Math.max(desiredWidth, .001), maximumDepth / Math.max(desiredDepth, .001))
    : 1;
  const plateWidth = desiredWidth * fitScale;
  const plateDepth = desiredDepth * fitScale;
  const plateArea = plateWidth * plateDepth;
  const grossCapacity = plateArea * floors;
  const programFit = grossCapacity / Math.max(grossDemand, 1) * 100;

  const daylightSpaces = spaces.filter((space) => space.daylight);
  const internalSpaces = spaces.filter((space) => !space.daylight);
  const daylightIndex = new Map(daylightSpaces.map((space, index) => [space.id, index]));
  const internalIndex = new Map(internalSpaces.map((space, index) => [space.id, index]));
  const nodes = spaces.map((space) => {
    const totalArea = Math.max(0, space.count * space.unitArea);
    const share = totalArea / Math.max(netArea, 1);
    const position = space.daylight
      ? perimeterPosition(daylightIndex.get(space.id) ?? 0, daylightSpaces.length)
      : innerPosition(internalIndex.get(space.id) ?? 0, internalSpaces.length);
    return {
      id: space.id,
      code: space.code,
      name: space.name,
      zone: space.zone,
      count: space.count,
      totalArea: round(totalArea),
      floorArea: round(totalArea / floors),
      occupants: Math.ceil(totalArea / Math.max(.5, space.density)),
      daylightRequired: space.daylight,
      accessibleRoute: space.accessible,
      position: { x: round(position.x, 1), y: round(position.y, 1), edge: position.edge },
      visual: {
        width: round(clamp(10 + Math.sqrt(share) * 24, 11, 25), 1),
        height: round(clamp(7 + Math.sqrt(share) * 15, 8, 18), 1),
      },
    };
  });

  const totalCoreArea = stairs * 18 + elevators * 7 + 10;
  const corePositions = createCorePositions(input.coreStrategy, plateWidth, plateDepth);
  const cores = corePositions.map((position, index) => ({
    id: `CORE-${index + 1}`,
    label: corePositions.length > 1 ? `Çekirdek ${index + 1}` : "Ana çekirdek",
    strategy: input.coreStrategy,
    position,
    area: round(totalCoreArea / corePositions.length),
    stairs: Math.max(1, Math.round(stairs / corePositions.length)),
    elevators: Math.round(elevators / corePositions.length),
  }));
  const exits = createExitPositions(stairs).map((exit, index) => ({ id: `EXIT-${index + 1}`, label: `Çıkış ${index + 1}`, ...exit }));

  const routes = nodes.map((node) => {
    const nearestExit = exits.reduce((best, exit) => {
      const distance = routeDistance(node.position, exit, plateWidth, plateDepth);
      return distance < best.distance ? { id: exit.id, distance } : best;
    }, { id: exits[0]?.id ?? "EXIT-1", distance: Number.POSITIVE_INFINITY });
    const nearestCore = cores.reduce((best, core) => {
      const distance = routeDistance(node.position, core.position, plateWidth, plateDepth);
      return distance < best.distance ? { id: core.id, distance } : best;
    }, { id: cores[0]?.id ?? "CORE-1", distance: Number.POSITIVE_INFINITY });
    return {
      nodeId: node.id,
      exitId: nearestExit.id,
      coreId: nearestCore.id,
      travelDistance: round(Number.isFinite(nearestExit.distance) ? nearestExit.distance : 0, 1),
      coreDistance: round(Number.isFinite(nearestCore.distance) ? nearestCore.distance : 0, 1),
    };
  });
  const maximumTravelDistance = routes.reduce((maximum, route) => Math.max(maximum, route.travelDistance), 0);
  const averageTravelDistance = routes.length ? routes.reduce((sum, route) => sum + route.travelDistance, 0) / routes.length : 0;
  const occupants = nodes.reduce((sum, node) => sum + node.occupants, 0);
  const exitCapacity = stairs * 120;

  const relationshipItems = input.relationships.map((relationship) => {
    const from = nodes.find((node) => node.name === relationship.from);
    const to = nodes.find((node) => node.name === relationship.to);
    const distance = from && to ? metricDistance(from.position, to.position, plateWidth, plateDepth) : 0;
    const diagonal = Math.hypot(plateWidth, plateDepth);
    const threshold = diagonal * (relationship.priority === "Zorunlu" ? .3 : .45);
    const satisfied = Boolean(from && to && relationship.confirmed && distance <= threshold + .01);
    return {
      ...relationship,
      fromNodeId: from?.id ?? null,
      toNodeId: to?.id ?? null,
      distance: round(distance, 1),
      targetDistance: round(threshold, 1),
      satisfied,
    };
  });
  const relationshipWeight = relationshipItems.reduce((sum, item) => sum + (item.priority === "Zorunlu" ? 2 : 1), 0);
  const satisfiedWeight = relationshipItems.reduce((sum, item) => sum + (item.satisfied ? item.priority === "Zorunlu" ? 2 : 1 : 0), 0);
  const adjacencyScore = relationshipWeight ? satisfiedWeight / relationshipWeight * 100 : 100;

  const daylightRequiredArea = daylightSpaces.reduce((sum, space) => sum + space.count * space.unitArea, 0);
  const daylightDepth = Math.min(6, plateWidth / 2, plateDepth / 2);
  const daylightCapacity = Math.max(0, 2 * (plateWidth + plateDepth) * daylightDepth * .62 * floors);
  const daylightAssignedArea = Math.min(daylightRequiredArea, daylightCapacity);
  const daylightCoverage = daylightRequiredArea > 0 ? daylightAssignedArea / daylightRequiredArea * 100 : 100;
  const accessibleArea = spaces.filter((space) => space.accessible).reduce((sum, space) => sum + space.count * space.unitArea, 0);
  const accessibleCoverage = accessibleArea / Math.max(netArea, 1) * 100;
  const coreRatio = totalCoreArea * floors / Math.max(grossCapacity, 1) * 100;
  const massingFits = !massingConnected || (fitScale > 0 && programFit >= 98);
  const exitCountFits = occupants <= 50 || stairs >= 2;
  const exitCapacityFits = occupants <= exitCapacity;

  const checks = [
    {
      code: "ARC-113-01",
      label: "Kütle / program uyumu",
      value: `%${round(programFit, 0)}`,
      state: massingFits ? "pass" as const : programFit >= 85 ? "review" as const : "risk" as const,
      note: massingConnected ? "Program talebi seçili V112 kütlesinin kat alanı kapasitesiyle karşılaştırıldı." : "V112 kütle verisi yok; plaka program hedefinden kavramsal olarak türetildi.",
    },
    {
      code: "ARC-113-02",
      label: "Komşuluk gerçekleşmesi",
      value: `%${round(adjacencyScore, 0)}`,
      state: adjacencyScore >= 75 ? "pass" as const : adjacencyScore >= 50 ? "review" as const : "risk" as const,
      note: "Kararlaştırılmış ilişkiler, şema üzerindeki gerçek düğüm mesafeleriyle tarandı.",
    },
    {
      code: "ARC-113-03",
      label: "Günışığı çevre kapasitesi",
      value: `%${round(daylightCoverage, 0)}`,
      state: daylightCoverage >= 80 ? "pass" as const : daylightCoverage >= 60 ? "review" as const : "risk" as const,
      note: "Günışığı isteyen alanlar kavramsal cephe bandı kapasitesiyle karşılaştırıldı; simülasyon değildir.",
    },
    {
      code: "ARC-113-04",
      label: "En uzak kaçış yolu",
      value: `${round(maximumTravelDistance, 1)} / ${round(targetTravel, 0)} m`,
      state: maximumTravelDistance <= targetTravel ? "pass" as const : maximumTravelDistance <= targetTravel * 1.15 ? "review" as const : "risk" as const,
      note: "Mahal düğümünden en yakın kavramsal çıkışa ortogonal rota göstergesidir; yangın tahliye hesabı değildir.",
    },
    {
      code: "ARC-113-05",
      label: "Çıkış adedi / kapasitesi",
      value: `${occupants} / ${exitCapacity} kişi`,
      state: exitCountFits && exitCapacityFits ? "pass" as const : "risk" as const,
      note: "Kullanıcı yükü, merdiven adedi ve ön kapasite katsayısı birlikte kontrol edildi.",
    },
    {
      code: "ARC-113-06",
      label: "Çekirdek ve erişilebilir rota",
      value: `%${round(coreRatio, 1)} · E%${round(accessibleCoverage, 0)}`,
      state: coreRatio >= 4 && coreRatio <= 16 && accessibleCoverage >= 60 ? "pass" as const : "review" as const,
      note: "Düşey çekirdek rezervi ve erişilebilir rota hedefli program alanı birlikte gösterilir.",
    },
  ];

  return {
    schema: "ARKEM-ARCH-SCHEME/3.0" as const,
    reference: input.reference,
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    source: {
      massingConnected,
      authoritativeMassing: massingConnected && massingSource.authoritative === true,
      selectedMassingId: selectedMassingId || null,
      massingTrust: stringValue(massingSource.trust, massingConnected ? "conceptual" : "missing"),
    },
    plate: {
      width: round(plateWidth),
      depth: round(plateDepth),
      area: round(plateArea),
      floors,
      floorHeight: round(floorHeight),
      grossCapacity: round(grossCapacity),
      targetGross: round(targetGross),
      grossDemand: round(grossDemand),
      programFit: round(programFit, 1),
      aspect: round(plateWidth / Math.max(plateDepth, .001), 2),
      massingFitScale: round(fitScale, 3),
    },
    program: {
      use: input.use,
      netArea: round(netArea),
      spaceTypeCount: nodes.length,
      zoneCount: new Set(nodes.map((node) => node.zone)).size,
      occupants,
      accessibleCoverage: round(accessibleCoverage, 1),
    },
    nodes,
    cores,
    exits,
    circulation: {
      corridorWidth: round(corridorWidth),
      targetTravel: round(targetTravel),
      maximumTravelDistance: round(maximumTravelDistance, 1),
      averageTravelDistance: round(averageTravelDistance, 1),
      routes,
      exitCapacity,
    },
    relationships: {
      score: round(adjacencyScore, 1),
      satisfied: relationshipItems.filter((item) => item.satisfied).length,
      total: relationshipItems.length,
      items: relationshipItems,
    },
    daylight: {
      requiredArea: round(daylightRequiredArea),
      perimeterCapacity: round(daylightCapacity),
      assignedArea: round(daylightAssignedArea),
      coverage: round(daylightCoverage, 1),
      conceptualDepth: round(daylightDepth, 1),
    },
    core: {
      strategy: input.coreStrategy,
      totalArea: round(totalCoreArea),
      ratio: round(coreRatio, 1),
      stairs,
      elevators,
    },
    checks,
    limitations: [
      "Bu çıktı avan tasarım için kavramsal mekânsal şemadır; ölçülü mimari plan, uygulama veya ruhsat projesi değildir.",
      "Komşuluk, dolaşım ve günışığı göstergeleri mahal türü düğümleri üzerinden üretilir; gerçek kapı, duvar, cephe ve engel geometrisi ayrıca modellenir.",
      "Kaçış mesafesi ve çıkış kapasitesi yangın projesi hesabı değildir; kullanım sınıfı, sprinkler, kaçış genişliği ve güncel mevzuat yetkili uzman tarafından doğrulanır.",
    ],
  };
}
