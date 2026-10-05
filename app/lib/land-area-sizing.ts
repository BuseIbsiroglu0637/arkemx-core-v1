export type LandAreaSizing = { mode: 'auto' | 'manual'; coverage: number; far: number };
export const DEFAULT_LAND_AREA_SIZING: LandAreaSizing = { mode: 'auto', coverage: 0.30, far: 1.50 };
export function readLandAreaSizing(value: unknown): LandAreaSizing | null {
  if (!value || typeof value !== 'object') return null;
  const v = value as Record<string, unknown>;
  if (v.mode !== 'auto' && v.mode !== 'manual') return null;
  if (typeof v.coverage !== 'number' || !Number.isFinite(v.coverage) || v.coverage <= 0 || v.coverage > 1) return null;
  if (typeof v.far !== 'number' || !Number.isFinite(v.far) || v.far <= 0 || v.far > 20) return null;
  return { mode: v.mode, coverage: v.coverage, far: v.far };
}
export function estimateMinimumLandArea(targetArea: unknown, floors: unknown, assumptions: LandAreaSizing = DEFAULT_LAND_AREA_SIZING) {
  if (typeof targetArea !== 'number' || !Number.isFinite(targetArea) || targetArea <= 0 || targetArea > 1e8) return null;
  if (typeof floors !== 'number' || !Number.isInteger(floors) || floors <= 0 || floors > 200 || !readLandAreaSizing(assumptions)) return null;
  const footprint = targetArea / floors;
  const byCoverage = footprint / assumptions.coverage;
  const byFar = targetArea / assumptions.far;
  const minimumArea = Math.ceil(Math.max(byCoverage, byFar) / 50) * 50;
  if (!Number.isFinite(minimumArea) || minimumArea > 1e8) return null;
  return { targetArea, floors, footprint, byCoverage, byFar, minimumArea, coverage: assumptions.coverage, far: assumptions.far };
}
