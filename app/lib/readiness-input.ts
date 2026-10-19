export function positiveArea(value: string): number | null {
  const normalized = value.trim().replace(",", ".");
  if (!normalized || !/^\d+(?:\.\d+)?$/.test(normalized)) return null;
  const area = Number(normalized);
  return Number.isFinite(area) && area > 0 ? area : null;
}

export function rectangularEnvelope(width: number, depth: number, setback: number) {
  const valid = [width, depth, setback].every(Number.isFinite)
    && width > 0 && depth > 0 && setback >= 0
    && width > 2 * setback && depth > 2 * setback;
  return { valid, plot: valid ? width * depth : 0, envelope: valid ? (width - 2 * setback) * (depth - 2 * setback) : 0 };
}
