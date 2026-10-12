import { FLOOR_PLATE_LENGTH_DECIMALS, FLOOR_PLATE_AREA_DECIMALS } from "./floor-plate-precision.ts";

export type ProgramSpaceInstance = {
  key: string;
  sourceSpaceId: string;
  sourceInstance: number;
  code: string;
  name: string;
  zone: string;
  unitArea: number;
  liveLoad: number;
  order: number;
};

export type ProgramRelationship = {
  id?: string;
  from?: string;
  to?: string;
  priority?: string;
  confirmed?: boolean;
};

export type ProgramFloorPlate = {
  id?: string;
  level: number;
  netArea: number;
  grossArea: number;
  width: number;
  depth: number;
};

export type ProgramPlanElementSeed = {
  id: string;
  type: "space" | "core";
  level: number;
  x: number;
  y: number;
  widthBays: number;
  heightBays: number;
  orientation: "x";
  label: string;
  load: number;
  fire: string;
  section: string;
  provenance: "program" | "program-derived";
  sourceSpaceId?: string;
  sourceFloorLevel?: number;
  derivedFromSpaceIds?: string[];
  sourceSpaceInstance?: number;
  sourceSpaceCode?: string;
  sourceZone: string;
  sourceUnitArea?: number;
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function asNumber(value: unknown, fallback = 0) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function asString(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

export function expandProgramSpaces(spaces: unknown[], fallbackLiveLoad = 3.5): ProgramSpaceInstance[] {
  const instances: ProgramSpaceInstance[] = [];
  const ids = spaces.map(value => asString(asRecord(value).id));
  if (ids.some(id => !id) || new Set(ids).size !== ids.length) throw new Error("Program identity missing or duplicated; stable source IDs required");
  spaces.forEach((value, sourceOrder) => {
    const space = asRecord(value);
    const sourceSpaceId = asString(space.id);
    const count = Math.max(1, Math.min(48, Math.round(asNumber(space.count, 1))));
    const name = asString(space.name, "Mahal");
    const code = asString(space.code, `A-${String(sourceOrder + 1).padStart(3, "0")}`);
    const zone = asString(space.zone, "Tanımsız");
    const unitArea = Math.max(0, asNumber(space.unitArea));
    const liveLoad = Math.max(0, asNumber(space.liveLoad, fallbackLiveLoad));
    for (let index = 1; index <= count; index += 1) {
      instances.push({
        key: `program-space:${encodeURIComponent(sourceSpaceId)}:${index}`,
        sourceSpaceId,
        sourceInstance: index,
        code,
        name: count > 1 ? `${name} ${index}` : name,
        zone,
        unitArea,
        liveLoad,
        order: sourceOrder * 100 + index,
      });
    }
  });
  return instances;
}

function distributeToFloors(
  instances: ProgramSpaceInstance[],
  floors: number,
  relationships: unknown[],
) {
  const buckets = Array.from({ length: floors }, () => ({
    netArea: 0,
    items: [] as ProgramSpaceInstance[],
  }));

  const mandatoryPairs = relationships
    .map((value) => asRecord(value))
    .filter((relation) => asString(relation.priority) === "Zorunlu")
    .map((relation) => [asString(relation.from), asString(relation.to)] as const)
    .filter(([from, to]) => from && to);

  const baseName = (name: string) => name.replace(/ \d+$/, "");
  const parent = new Map<string, string>();
  const find = (name: string): string => {
    const current = parent.get(name) ?? name;
    if (current === name) return name;
    const root = find(current);
    parent.set(name, root);
    return root;
  };
  const union = (a: string, b: string) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent.set(rb, ra);
  };
  mandatoryPairs.forEach(([from, to]) => {
    if (!parent.has(from)) parent.set(from, from);
    if (!parent.has(to)) parent.set(to, to);
    union(from, to);
  });

  const grouped = new Map<string, ProgramSpaceInstance[]>();
  const singles: ProgramSpaceInstance[] = [];
  instances.forEach((instance) => {
    const name = baseName(instance.name);
    if (!parent.has(name)) {
      singles.push(instance);
      return;
    }
    const root = find(name);
    const group = grouped.get(root) ?? [];
    group.push(instance);
    grouped.set(root, group);
  });

  const packages: ProgramSpaceInstance[][] = [
    ...[...grouped.values()],
    ...singles.map((item) => [item]),
  ].sort((a, b) => b.reduce((sum, item) => sum + item.unitArea, 0) - a.reduce((sum, item) => sum + item.unitArea, 0));

  packages.forEach((pack) => {
    const packageArea = pack.reduce((sum, item) => sum + item.unitArea, 0);
    const target = buckets
      .map((bucket, index) => ({ bucket, index }))
      .sort((a, b) => a.bucket.netArea - b.bucket.netArea || a.bucket.items.length - b.bucket.items.length || a.index - b.index)[0];
    if (!target) return;
    target.bucket.items.push(...pack);
    target.bucket.netArea += packageArea;
  });

  return buckets;
}

export function deriveProgramFloorPlates(
  spaces: unknown[],
  relationships: unknown[],
  floors: number,
  netRatioPercent: number,
  aspect: number,
  fallbackLiveLoad = 3.5,
): ProgramFloorPlate[] {
  const safeFloors = Math.max(1, Math.min(30, Math.round(floors)));
  const ratio = Math.max(.4, Math.min(.95, netRatioPercent / 100));
  const safeAspect = Math.max(.55, Math.min(2.5, aspect || 1.55));
  const instances = expandProgramSpaces(spaces, fallbackLiveLoad);
  const buckets = distributeToFloors(instances, safeFloors, relationships);

  return buckets.map((bucket, index) => {
    const grossArea = bucket.netArea / ratio;
    const depth = Math.sqrt(Math.max(grossArea, 1) / safeAspect);
    const width = depth * safeAspect;
    return {
      level: index + 1,
      netArea: Number(bucket.netArea.toFixed(2)),
      grossArea: Number(grossArea.toFixed(FLOOR_PLATE_AREA_DECIMALS)),
      width: Number(width.toFixed(FLOOR_PLATE_LENGTH_DECIMALS)),
      depth: Number(depth.toFixed(FLOOR_PLATE_LENGTH_DECIMALS)),
    };
  });
}

function splitIntoRows(items: ProgramSpaceInstance[], rowCount: number) {
  const rows = Array.from({ length: Math.max(1, rowCount) }, () => ({
    area: 0,
    items: [] as ProgramSpaceInstance[],
  }));
  [...items]
    .sort((a, b) => b.unitArea - a.unitArea || a.order - b.order)
    .forEach((item) => {
      const target = rows
        .map((row, index) => ({ row, index }))
        .sort((a, b) => a.row.area - b.row.area || a.row.items.length - b.row.items.length || a.index - b.index)[0];
      target.row.items.push(item);
      target.row.area += item.unitArea;
    });
  return rows.filter((row) => row.items.length);
}
function baseProgramName(name: string) {
  return name.replace(/ \d+$/, "");
}

function requiredAdjacencyLayout(
  items: ProgramSpaceInstance[],
  relationships: unknown[],
  roomWidthBays: number,
  roomHeightBays: number,
  bayArea: number,
) {
  const requiredPairs = relationships
    .map((value) => asRecord(value))
    .filter((relation) => asString(relation.priority) === "Zorunlu")
    .map((relation) => [asString(relation.from), asString(relation.to)] as const)
    .filter(([from, to]) => from && to);

  if (requiredPairs.length < 2 || items.length < 3) return null;

  const availableNames = new Set(items.map((item) => baseProgramName(item.name)));
  const degree = new Map<string, number>();
  requiredPairs.forEach(([from, to]) => {
    if (!availableNames.has(from) || !availableNames.has(to)) return;
    degree.set(from, (degree.get(from) ?? 0) + 1);
    degree.set(to, (degree.get(to) ?? 0) + 1);
  });

  const hubName = [...degree.entries()]
    .filter(([, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1])[0]?.[0];
  if (!hubName) return null;

  const hubItems = items.filter((item) => baseProgramName(item.name) === hubName);
  if (hubItems.length !== 1) return null;
  const hub = hubItems[0];

  const satelliteNames = new Set<string>();
  requiredPairs.forEach(([from, to]) => {
    if (from === hubName && availableNames.has(to)) satelliteNames.add(to);
    if (to === hubName && availableNames.has(from)) satelliteNames.add(from);
  });

  const satellites = items.filter((item) => satelliteNames.has(baseProgramName(item.name)));
  if (satellites.length < 2) return null;

  const clusterIds = new Set([hub.key, ...satellites.map((item) => item.key)]);
  const leftovers = items.filter((item) => !clusterIds.has(item.key));
  if (leftovers.length) return null;

  const roomCapacityArea = roomWidthBays * roomHeightBays * bayArea;
  const clusterArea = items.reduce((sum, item) => sum + item.unitArea, 0);
  if (clusterArea > roomCapacityArea * 1.005) return null;

  const hubWidth = hub.unitArea / Math.max(roomHeightBays * bayArea, .01);
  const satelliteStripWidth = roomWidthBays - hubWidth;
  if (hubWidth < .25 || satelliteStripWidth < .25) return null;

  const satelliteTotalHeight = satellites.reduce((sum, item) => (
    sum + item.unitArea / Math.max(satelliteStripWidth * bayArea, .01)
  ), 0);
  if (satelliteTotalHeight > roomHeightBays * 1.005) return null;

  const placements = [{
    instance: hub,
    x: 0,
    y: 0,
    widthBays: hubWidth,
    heightBays: roomHeightBays,
    role: "hub" as "hub" | "satellite",
  }];

  let yCursor = 0;
  satellites
    .sort((a, b) => b.unitArea - a.unitArea || a.order - b.order)
    .forEach((instance) => {
      const height = instance.unitArea / Math.max(satelliteStripWidth * bayArea, .01);
      placements.push({
        instance,
        x: hubWidth,
        y: yCursor,
        widthBays: satelliteStripWidth,
        heightBays: height,
        role: "satellite" as const,
      });
      yCursor += height;
    });

  return { hubName, placements };
}


/**
 * Generates a conceptual, area-aware plan from the Architectural Program.
 * Room rectangles use fractional bay dimensions so source unit areas are represented
 * geometrically instead of being displayed only as labels.
 */
export function coordinateProgramAxes(plates: ProgramFloorPlate[], baysX: number, baysY: number) {
  const count = (current: number, dimensions: number[]) => {
    const smallest = dimensions.length ? Math.min(...dimensions) : 0;
    return Math.max(2, Math.min(16, Math.round(current) || 2, Math.floor(smallest / 2)));
  };
  return {
    baysX: count(baysX, plates.map((plate) => plate.width)),
    baysY: count(baysY, plates.map((plate) => plate.depth)),
  };
}

export function buildProgramPlanElements(
  spaces: unknown[],
  baysX: number,
  baysY: number,
  floors: number,
  fallbackLiveLoad = 3.5,
  spanX = 5,
  spanY = 5,
  relationships: unknown[] = [],
  floorPlates: ProgramFloorPlate[] = [],
): ProgramPlanElementSeed[] {
  const safeBaysX = Math.max(2, Math.min(16, Math.round(baysX)));
  const safeBaysY = Math.max(2, Math.min(16, Math.round(baysY)));
  const safeFloors = Math.max(1, Math.min(30, Math.round(floors)));
  const safeSpanX = Math.max(.1, spanX);
  const safeSpanY = Math.max(.1, spanY);
  const instances = expandProgramSpaces(spaces, fallbackLiveLoad);
  const floorBuckets = distributeToFloors(instances, safeFloors, relationships);

  const elements: ProgramPlanElementSeed[] = [];
  floorBuckets.forEach((bucket, floorIndex) => {
    const level = floorIndex + 1;
    const profile = floorPlates.find((item) => item.level === level);
    const levelSpanX = profile?.width ? profile.width / safeBaysX : safeSpanX;
    const levelSpanY = profile?.depth ? profile.depth / safeBaysY : safeSpanY;
    const bayArea = levelSpanX * levelSpanY;
    const floorArea = safeBaysX * safeBaysY * bayArea;
    // Reserve the actual gross/net remainder rather than shrinking rooms to a fixed strip.
    const coreStripBays = Math.max(.01, Math.min(safeBaysX * .15, safeBaysX * Math.max(0, 1 - bucket.netArea / Math.max(floorArea, .01))));
    const roomWidthBays = safeBaysX - coreStripBays;
    const adjacencyLayout = requiredAdjacencyLayout(
      bucket.items,
      relationships,
      roomWidthBays,
      safeBaysY,
      bayArea,
    );

    const pushProgramSpace = (
      instance: ProgramSpaceInstance,
      x: number,
      y: number,
      width: number,
      height: number,
    ) => {
      elements.push({
        id: instance.key,
        type: "space",
        level,
        x: Number(x.toFixed(4)),
        y: Number(y.toFixed(4)),
        widthBays: Number(width.toFixed(4)),
        heightBays: Number(height.toFixed(4)),
        orientation: "x",
        label: instance.name,
        load: instance.liveLoad,
        fire: "Projede belirlenecek",
        section: "—",
        provenance: "program",
        sourceSpaceId: instance.sourceSpaceId,
        sourceSpaceInstance: instance.sourceInstance,
        sourceSpaceCode: instance.code,
        sourceZone: instance.zone,
        sourceUnitArea: instance.unitArea,
      });
    };

    if (adjacencyLayout) {
      adjacencyLayout.placements.forEach((placement) => {
        pushProgramSpace(
          placement.instance,
          placement.x,
          placement.y,
          placement.widthBays,
          placement.heightBays,
        );
      });
    } else {
      const desiredRows = Math.max(1, Math.min(safeBaysY, Math.round(Math.sqrt(Math.max(bucket.items.length, 1) * safeBaysY / Math.max(roomWidthBays, 1)))));
      const rows = splitIntoRows(bucket.items, desiredRows);
      let yCursor = 0;

      rows.forEach((row) => {
        const availableHeight = Math.max(0, safeBaysY - yCursor);
        const exactHeight = row.area / Math.max(roomWidthBays * bayArea, .01);
        const rowHeight = Math.min(availableHeight, exactHeight);
        let xCursor = 0;
        row.items
          .sort((a, b) => a.order - b.order)
          .forEach((instance, itemIndex) => {
            const remainingWidth = Math.max(0, roomWidthBays - xCursor);
            const isLast = itemIndex === row.items.length - 1;
            const exactWidth = instance.unitArea > 0 ? instance.unitArea / Math.max(rowHeight * bayArea, .01) : remainingWidth;
            const width = Math.min(remainingWidth, isLast ? remainingWidth : exactWidth);
            const exactRoomHeight = instance.unitArea > 0 ? instance.unitArea / Math.max(width * bayArea, .01) : rowHeight;
            const height = Math.min(rowHeight, exactRoomHeight);
            pushProgramSpace(instance, xCursor, yCursor, width, height);
            xCursor += width;
          });
        yCursor += rowHeight;
      });
    }

    const coreWidth = coreStripBays;
    const coreTargetArea = Math.min(
      Math.max(18, floorArea - bucket.netArea),
      coreWidth * safeBaysY * bayArea,
    );
    const coreHeight = Math.max(.65, Math.min(safeBaysY, coreTargetArea / Math.max(coreWidth * bayArea, .01)));
    elements.push({
      id: `program-core-${level}`,
      type: "core",
      level,
      x: Number((safeBaysX - coreWidth).toFixed(4)),
      y: Number(Math.max(0, (safeBaysY - coreHeight) / 2).toFixed(4)),
      widthBays: Number(coreWidth.toFixed(4)),
      heightBays: Number(coreHeight.toFixed(4)),
      orientation: "x",
      label: "Merdiven / asansör çekirdeği",
      load: fallbackLiveLoad,
      fire: "REI 120",
      section: "—",
      provenance: "program-derived",
      sourceFloorLevel: level,
      derivedFromSpaceIds: [...new Set(bucket.items.map(item => item.sourceSpaceId))],
      sourceZone: "Sirkülasyon",
    });
  });

  return elements;
}

export function evaluateRequiredAdjacency(
  elements: Array<{ level: number; x: number; y: number; widthBays?: number; heightBays?: number; sourceSpaceId?: string }>,
  spaces: unknown[],
  relationships: unknown[],
) {
  const spaceNameById = new Map<string, string>();
  spaces.forEach((value, index) => {
    const space = asRecord(value);
    spaceNameById.set(asString(space.id, `space-${index + 1}`), asString(space.name, "Mahal"));
  });
  const nameByElement = (element: { sourceSpaceId?: string }) => spaceNameById.get(element.sourceSpaceId ?? "") ?? "";

  const touches = (
    a: { x: number; y: number; widthBays?: number; heightBays?: number },
    b: { x: number; y: number; widthBays?: number; heightBays?: number },
  ) => {
    const aw = Math.max(.01, a.widthBays ?? 1);
    const ah = Math.max(.01, a.heightBays ?? 1);
    const bw = Math.max(.01, b.widthBays ?? 1);
    const bh = Math.max(.01, b.heightBays ?? 1);
    const overlapX = Math.min(a.x + aw, b.x + bw) - Math.max(a.x, b.x);
    const overlapY = Math.min(a.y + ah, b.y + bh) - Math.max(a.y, b.y);
    const gapX = Math.max(0, Math.max(a.x, b.x) - Math.min(a.x + aw, b.x + bw));
    const gapY = Math.max(0, Math.max(a.y, b.y) - Math.min(a.y + ah, b.y + bh));
    return (gapX <= .08 && overlapY > .08) || (gapY <= .08 && overlapX > .08);
  };

  const required = relationships
    .map((value, index) => {
      const relation = asRecord(value);
      return {
        id: asString(relation.id, `R-${index + 1}`),
        from: asString(relation.from),
        to: asString(relation.to),
        priority: asString(relation.priority),
      };
    })
    .filter((relation) => relation.priority === "Zorunlu" && relation.from && relation.to);

  const items = required.map((relation) => {
    const fromElements = elements.filter((element) => nameByElement(element) === relation.from);
    const toElements = elements.filter((element) => nameByElement(element) === relation.to);
    const satisfied = fromElements.some((from) => toElements.some((to) => from.level === to.level && touches(from, to)));
    return { ...relation, satisfied };
  });

  return {
    total: items.length,
    satisfied: items.filter((item) => item.satisfied).length,
    pass: items.every((item) => item.satisfied),
    items,
  };
}
