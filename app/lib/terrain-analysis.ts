import { localBounds, type GeoPoint } from "./geo";

export type TerrainAnalysis = {
  schema: "ARKEM-TERRAIN-SCREEN/1.0";
  basis: "measured-z" | "parametric-slope";
  elevationRange: number;
  indicativeGrade: number;
  buildingLevelDifference: number;
  indicativeEarthwork: number;
  accessibility: "low-gradient" | "review" | "steep";
  confidence: "measured-input" | "conceptual";
};

export function analyzeTerrain(
  parcel: GeoPoint[],
  slope: number,
  buildingWidth: number,
  buildingDepth: number,
  rotation: number,
): TerrainAnalysis {
  const bounds = localBounds(parcel);
  const measured = parcel.map((point) => point.alt).filter((value): value is number => Number.isFinite(value));
  const elevationRange = measured.length >= 3
    ? Math.max(...measured) - Math.min(...measured)
    : bounds.depth * Math.abs(slope) / 100;
  const angle = rotation * Math.PI / 180;
  const effectiveDepth = Math.abs(buildingDepth * Math.cos(angle)) + Math.abs(buildingWidth * Math.sin(angle));
  const buildingLevelDifference = effectiveDepth * Math.abs(slope) / 100;
  const footprint = Math.max(0, buildingWidth * buildingDepth);
  const indicativeEarthwork = footprint * buildingLevelDifference * .25;
  return {
    schema: "ARKEM-TERRAIN-SCREEN/1.0",
    basis: measured.length >= 3 ? "measured-z" : "parametric-slope",
    elevationRange,
    indicativeGrade: Math.abs(slope),
    buildingLevelDifference,
    indicativeEarthwork,
    accessibility: Math.abs(slope) <= 5 ? "low-gradient" : Math.abs(slope) <= 12 ? "review" : "steep",
    confidence: measured.length >= 3 ? "measured-input" : "conceptual",
  };
}
