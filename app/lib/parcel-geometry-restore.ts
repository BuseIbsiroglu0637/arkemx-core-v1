import type { GeoPoint } from "./geo.ts";
/** Preserve valid source geometry, including quarantined preview geometry, on project reload. */
export function restoreParcelGeometry(value: unknown): GeoPoint[] | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const points = Array.isArray(record.parcel) && record.parcel.length ? record.parcel : record.previewParcel;
  if (!Array.isArray(points) || points.length < 3 || points.length > 400) return null;
  const valid = points.every(point => point && typeof point === "object" && !Array.isArray(point)
    && typeof point.lat === "number" && Number.isFinite(point.lat) && Math.abs(point.lat) <= 90
    && typeof point.lng === "number" && Number.isFinite(point.lng) && Math.abs(point.lng) <= 180
    && (point.alt == null || (typeof point.alt === "number" && Number.isFinite(point.alt))));
  return valid ? points.map(point => ({ lat: point.lat, lng: point.lng, ...(typeof point.alt === "number" ? { alt: point.alt } : {}) })) : null;
}
