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

export type ProgramPlanElementSeed = {
  id: string;
  type: "space" | "core";
  level: number;
  x: number;
  y: number;
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

export function buildProgramPlanElements(
  spaces: unknown[],
  baysX: number,
  baysY: number,
  floors: number,
  fallbackLiveLoad = 3.5,
): ProgramPlanElementSeed[] {
  const safeBaysX = Math.max(2, Math.min(16, Math.round(baysX)));
  const safeBaysY = Math.max(2, Math.min(16, Math.round(baysY)));
  const safeFloors = Math.max(1, Math.min(30, Math.round(floors)));
  const coreX = Math.max(0, Math.floor(safeBaysX / 2) - 1);
  const coreY = Math.max(0, Math.floor(safeBaysY / 2) - 1);
  const instances = expandProgramSpaces(spaces, fallbackLiveLoad);
  const floorBuckets = Array.from({ length: safeFloors }, () => ({
    netArea: 0,
    items: [] as ProgramSpaceInstance[],
  }));
  const capacityPerFloor = Math.max(1, safeBaysX * safeBaysY - 1);

  [...instances]
    .sort((a, b) => b.unitArea - a.unitArea || a.order - b.order)
    .forEach((instance) => {
      const candidates = floorBuckets
        .map((bucket, index) => ({ bucket, index }))
        .filter(({ bucket }) => bucket.items.length < capacityPerFloor)
        .sort((a, b) => a.bucket.netArea - b.bucket.netArea || a.bucket.items.length - b.bucket.items.length || a.index - b.index);
      const target = candidates[0];
      if (!target) return;
      target.bucket.items.push(instance);
      target.bucket.netArea += instance.unitArea;
    });

  const elements: ProgramPlanElementSeed[] = [];
  floorBuckets.forEach((bucket, floorIndex) => {
    const level = floorIndex + 1;
    const cells: Array<{ x: number; y: number }> = [];
    for (let y = 0; y < safeBaysY; y += 1) {
      for (let x = 0; x < safeBaysX; x += 1) {
        if (x === coreX && y === coreY) continue;
        cells.push({ x, y });
      }
    }
    bucket.items
      .sort((a, b) => a.order - b.order)
      .forEach((instance, index) => {
        const cell = cells[index];
        if (!cell) return;
        elements.push({
          id: instance.key,
          type: "space",
          level,
          x: cell.x,
          y: cell.y,
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
      });

    elements.push({
      id: `program-core-${level}`,
      type: "core",
      level,
      x: coreX,
      y: coreY,
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
