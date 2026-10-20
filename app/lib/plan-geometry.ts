// Editor rows increase downwards; CAD / PDF local metre coordinates increase northwards.
export function planCellBounds(x: number, y: number, spanX: number, spanY: number, depth: number) {
  return { left: x * spanX, right: (x + 1) * spanX, bottom: depth - (y + 1) * spanY, top: depth - y * spanY };
}
export const PLAN_LOCAL_CRS = "Yerel plan / metre; coğrafi dönüşüm yok";
export function planCellConflicts(elements: {type: string; level: number; x: number; y: number}[]) {
  const cells = new Map<string, number>();
  for (const e of elements) if (["space", "core", "opening"].includes(e.type)) {
    const key = `${e.level}:${e.x}:${e.y}`;
    cells.set(key, (cells.get(key) ?? 0) + 1);
  }
  return [...cells.values()].filter(count => count > 1).length;
}
