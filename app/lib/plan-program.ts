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
  provenance: "program";
  sourceSpaceId: string;
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
  spaces.forEach((value, sourceOrder) => {
    const space = asRecord(value);
    const sourceSpaceId = asString(space.id, `space-${sourceOrder + 1}`);
    const count = Math.max(1, Math.min(48, Math.round(asNumber(space.count, 1))));
    const name = asString(space.name, "Mahal");
    const code = asString(space.code, `A-${String(sourceOrder + 1).padStart(3, "0")}`);
    const zone = asString(space.zone, "Tanımsız");
    const unitArea = Math.max(0, asNumber(space.unitArea));
    const liveLoad = Math.max(0, asNumber(space.liveLoad, fallbackLiveLoad));
    for (let index = 1; index <= count; index += 1) {
      instances.push({
        key: `program-${sourceSpaceId}-${index}`,
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

function distributeToFloors(instances: ProgramSpaceInstance[], floors: number, floorRoomCapacity: number) {
  const buckets = Array.from({ length: floors }, () => ({
    netArea: 0,
    items: [] as ProgramSpaceInstance[],
  }));

  [...instances]
    .sort((a, b) => b.unitArea - a.unitArea || a.order - b.order)
    .forEach((instance) => {
      const candidates = buckets
        .map((bucket, index) => ({ bucket, index }))
        .filter(({ bucket }) => bucket.netArea + instance.unitArea <= floorRoomCapacity * 1.02)
        .sort((a, b) => a.bucket.netArea - b.bucket.netArea || a.bucket.items.length - b.bucket.items.length || a.index - b.index);
      const fallback = buckets
        .map((bucket, index) => ({ bucket, index }))
        .sort((a, b) => a.bucket.netArea - b.bucket.netArea || a.bucket.items.length - b.bucket.items.length || a.index - b.index)[0];
      const target = candidates[0] ?? fallback;
      if (!target) return;
      target.bucket.items.push(instance);
      target.bucket.netArea += instance.unitArea;
    });

  return buckets;
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

/**
 * Generates a conceptual, area-aware plan from the Architectural Program.
 * Room rectangles use fractional bay dimensions so source unit areas are represented
 * geometrically instead of being displayed only as labels.
 */
export function buildProgramPlanElements(
  spaces: unknown[],
  baysX: number,
  baysY: number,
  floors: number,
  fallbackLiveLoad = 3.5,
  spanX = 5,
  spanY = 5,
): ProgramPlanElementSeed[] {
  const safeBaysX = Math.max(2, Math.min(16, Math.round(baysX)));
  const safeBaysY = Math.max(2, Math.min(16, Math.round(baysY)));
  const safeFloors = Math.max(1, Math.min(30, Math.round(floors)));
  const safeSpanX = Math.max(.1, spanX);
  const safeSpanY = Math.max(.1, spanY);
  const bayArea = safeSpanX * safeSpanY;
  const floorArea = safeBaysX * safeBaysY * bayArea;
  const coreStripBays = Math.max(.45, Math.min(1, safeBaysX * .15));
  const roomWidthBays = Math.max(1, safeBaysX - coreStripBays);
  const roomCapacity = roomWidthBays * safeBaysY * bayArea;
  const instances = expandProgramSpaces(spaces, fallbackLiveLoad);
  const floorBuckets = distributeToFloors(instances, safeFloors, roomCapacity);

  const elements: ProgramPlanElementSeed[] = [];
  floorBuckets.forEach((bucket, floorIndex) => {
    const level = floorIndex + 1;
    const desiredRows = Math.max(1, Math.min(safeBaysY, Math.round(Math.sqrt(Math.max(bucket.items.length, 1) * safeBaysY / Math.max(roomWidthBays, 1)))));
    const rows = splitIntoRows(bucket.items, desiredRows);
    let yCursor = 0;

    rows.forEach((row, rowIndex) => {
      const remainingRows = Math.max(1, rows.length - rowIndex);
      const availableHeight = Math.max(.2, safeBaysY - yCursor);
      const exactHeight = row.area > 0 ? row.area / Math.max(roomWidthBays * bayArea, .01) : availableHeight / remainingRows;
      const rowHeight = Math.max(.2, Math.min(availableHeight / remainingRows * 1.35, exactHeight));
      let xCursor = 0;
      row.items
        .sort((a, b) => a.order - b.order)
        .forEach((instance, itemIndex) => {
          const remainingWidth = Math.max(.15, roomWidthBays - xCursor);
          const isLast = itemIndex === row.items.length - 1;
          const exactWidth = instance.unitArea > 0 ? instance.unitArea / Math.max(rowHeight * bayArea, .01) : remainingWidth;
          const width = Math.max(.15, Math.min(remainingWidth, isLast ? remainingWidth : exactWidth));
          const exactRoomHeight = instance.unitArea > 0 ? instance.unitArea / Math.max(width * bayArea, .01) : rowHeight;
          const height = Math.max(.15, Math.min(rowHeight, exactRoomHeight));
          elements.push({
            id: instance.key,
            type: "space",
            level,
            x: Number(xCursor.toFixed(4)),
            y: Number(yCursor.toFixed(4)),
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
          xCursor += width;
        });
      yCursor += rowHeight;
    });

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
      provenance: "program",
      sourceSpaceId: "vertical-core",
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
