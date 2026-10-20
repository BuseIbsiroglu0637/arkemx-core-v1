export type PlanObject = {
  id: string; type: string; level: number; x: number; y: number;
  label: string; sourceSpaceId?: string;
};
type Room = { id: string; name: string; count: number; liveLoad?: number };
const record = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" ? value as Record<string, unknown> : {};

// Only proposes additions. Existing objects and their coordinates are never rewritten.
export function planProgramSync(source: unknown, elements: PlanObject[], grid: { floors: number; x: number; y: number }) {
  const raw = record(source);
  const rows = Array.isArray(raw.spaces) ? raw.spaces.map(record) : [];
  const rooms: Room[] = rows.filter(r => typeof r.id === "string" && typeof r.name === "string" && Number.isInteger(r.count) && Number(r.count) > 0 && Number(r.count) <= 100)
    .map(r => ({ id: String(r.id), name: String(r.name), count: Number(r.count), liveLoad: typeof r.liveLoad === "number" ? r.liveLoad : undefined }));
  const ids = new Set(rooms.map(r => r.id));
  const names = new Set(rooms.map(r => r.name));
  const valid = rooms.length > 0 && rooms.length === rows.length && ids.size === rooms.length && names.size === rooms.length &&
    [grid.floors, grid.x, grid.y].every(n => Number.isInteger(n) && n > 0 && n <= 30) && raw.needsReview !== true;
  const occupied = new Set(elements.filter(e => ["space","core","opening"].includes(e.type)).map(e => `${e.level}:${e.x}:${e.y}`));
  const cells: { level: number; x: number; y: number }[] = [];
  if (valid) for (let level = 1; level <= grid.floors; level++) for (let y = 0; y < grid.y; y++) for (let x = 0; x < grid.x; x++)
    if (!occupied.has(`${level}:${x}:${y}`)) cells.push({ level, x, y });
  const summary = rooms.map(r => {
    const placed = elements.filter(e => e.type === "space" && (e.sourceSpaceId ? e.sourceSpaceId === r.id : e.label === r.name)).length;
    return { ...r, placed, missing: Math.max(0, r.count - placed), extra: Math.max(0, placed - r.count) };
  });
  const missing = summary.reduce((sum, r) => sum + r.missing, 0);
  const additions = [];
  const usedIds = new Set(elements.map(e => e.id));
  let cellIndex = 0;
  if (valid && cells.length >= missing) for (const r of summary) for (let i = 0; i < r.missing; i++) {
    let suffix = r.placed + i + 1;
    let id = `arc-add-${r.id}-${suffix}`;
    while (usedIds.has(id)) id = `arc-add-${r.id}-${++suffix}`;
    usedIds.add(id);
    additions.push({ id, type: "space" as const, ...cells[cellIndex++], orientation: "x" as const,
      label: r.name, load: Number.isFinite(r.liveLoad) ? r.liveLoad! : 3.5,
      fire: "Projede belirlenecek", section: "—", sourceSpaceId: r.id });
  }
  return { valid, summary, missing, free: cells.length, additions, canApply: valid && missing > 0 && cells.length >= missing };
}
