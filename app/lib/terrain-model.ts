import { localBounds, toLocalMeters, type GeoPoint } from "./geo.ts";

export const TERRAIN_MODEL_SCHEMA = "ARKEM-TERRAIN-MODEL/1.0" as const;

export const TERRAIN_LAYER_IDS = [
  "basemap",
  "terrain-surface",
  "contours",
  "parcel-boundary",
  "elevation-points",
  "building-mass",
] as const;

export type TerrainLayerId = typeof TERRAIN_LAYER_IDS[number];
export type TerrainLayerVisibility = Record<TerrainLayerId, boolean>;

export const DEFAULT_TERRAIN_LAYERS: TerrainLayerVisibility = {
  basemap: true,
  "terrain-surface": true,
  contours: true,
  "parcel-boundary": true,
  "elevation-points": true,
  "building-mass": true,
};

const LAYER_LABELS: Record<TerrainLayerId, string> = {
  basemap: "Altlık harita",
  "terrain-surface": "Arazi yüzeyi",
  contours: "Eş yükselti",
  "parcel-boundary": "Parsel sınırı",
  "elevation-points": "Kot noktaları",
  "building-mass": "Yapı kütlesi",
};

export type TerrainContourSegment = {
  id: string;
  elevation: number;
  start: { east: number; north: number };
  end: { east: number; north: number };
};

export type TerrainModel = {
  schema: typeof TERRAIN_MODEL_SCHEMA;
  reference: string;
  generatedAt: string;
  coordinateReferenceSystem: string;
  localPlane: "WGS84 → local ENU / metre";
  basis: "measured-z" | "parametric-slope";
  trust: "verified" | "declared" | "conceptual";
  projectEligible: boolean;
  officialTerrain: false;
  licensedSurvey: boolean;
  source: {
    kind: string;
    authority: string;
    label: string;
    capturedAt: string;
    declaredStatus: string;
  };
  samples: {
    total: number;
    measured: number;
    requiredForMeasuredSurface: 3;
  };
  elevation: {
    minimum: number | null;
    maximum: number | null;
    average: number | null;
    range: number;
    unit: "m";
    datum: "source-declared" | "relative-local";
  };
  parameters: {
    indicativeSlopePercent: number;
    verticalExaggeration: number;
  };
  surface: {
    method: "inverse-distance-weighting" | "parametric-gradient";
    contourMethod: "marching-squares-preview";
    contourSegments: number;
  };
  layers: Array<{
    id: TerrainLayerId;
    label: string;
    visible: boolean;
    available: boolean;
  }>;
  limitations: string[];
};

type TerrainSource = {
  kind: string;
  authority: string;
  label: string;
  capturedAt: string;
};

function round(value: number, digits = 3) {
  const factor = 10 ** digits;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

export function normalizeTerrainLayers(value: unknown): TerrainLayerVisibility {
  const candidate = value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
  return Object.fromEntries(TERRAIN_LAYER_IDS.map((id) => [
    id,
    typeof candidate[id] === "boolean" ? candidate[id] : DEFAULT_TERRAIN_LAYERS[id],
  ])) as TerrainLayerVisibility;
}

export function createTerrainElevationSampler(parcel: GeoPoint[], slope: number) {
  const bounds = localBounds(parcel);
  const measured = parcel.filter((point) => Number.isFinite(point.alt)).map((point) => ({
    ...toLocalMeters(point, bounds.origin),
    altitude: point.alt as number,
  }));
  const averageElevation = measured.length
    ? measured.reduce((sum, point) => sum + point.altitude, 0) / measured.length
    : 0;
  const basis = measured.length >= 3 ? "measured-z" as const : "parametric-slope" as const;

  const parametricRelativeAt = (east: number, north: number) => (
    north * (slope / 100)
    + (Math.sin(east * .075) + Math.cos(north * .061)) * .24
  );
  const measuredAbsoluteAt = (east: number, north: number) => {
    let weighted = 0;
    let weightTotal = 0;
    measured.forEach((sample) => {
      const distance = Math.max(.75, Math.hypot(east - sample.east, north - sample.north));
      const weight = 1 / (distance * distance);
      weighted += sample.altitude * weight;
      weightTotal += weight;
    });
    return weighted / Math.max(weightTotal, Number.EPSILON);
  };

  return {
    basis,
    bounds,
    measuredCount: measured.length,
    averageElevation,
    relativeAt(east: number, north: number) {
      return basis === "measured-z"
        ? measuredAbsoluteAt(east, north) - averageElevation
        : parametricRelativeAt(east, north);
    },
    absoluteAt(east: number, north: number) {
      return basis === "measured-z"
        ? measuredAbsoluteAt(east, north)
        : parametricRelativeAt(east, north);
    },
  };
}

export function createTerrainContours(parcel: GeoPoint[], slope: number, contourCount = 7): TerrainContourSegment[] {
  if (parcel.length < 3 || contourCount < 1) return [];
  const sampler = createTerrainElevationSampler(parcel, slope);
  const width = Math.max(20, sampler.bounds.width * 1.16);
  const depth = Math.max(20, sampler.bounds.depth * 1.16);
  const minEast = -width / 2;
  const minNorth = -depth / 2;
  const gridSize = 22;
  const grid = Array.from({ length: gridSize + 1 }, (_, row) => Array.from({ length: gridSize + 1 }, (_, column) => {
    const east = minEast + width * column / gridSize;
    const north = minNorth + depth * row / gridSize;
    return { east, north, value: sampler.relativeAt(east, north) };
  }));
  const values = grid.flat().map((point) => point.value);
  const minimum = Math.min(...values);
  const maximum = Math.max(...values);
  const range = maximum - minimum;
  if (!Number.isFinite(range) || range < .001) return [];

  const segments: TerrainContourSegment[] = [];
  const interpolate = (
    first: { east: number; north: number; value: number },
    second: { east: number; north: number; value: number },
    level: number,
  ) => {
    const ratio = Math.max(0, Math.min(1, (level - first.value) / (second.value - first.value || Number.EPSILON)));
    return {
      east: first.east + (second.east - first.east) * ratio,
      north: first.north + (second.north - first.north) * ratio,
    };
  };

  for (let levelIndex = 1; levelIndex <= contourCount; levelIndex += 1) {
    const level = minimum + range * levelIndex / (contourCount + 1);
    for (let row = 0; row < gridSize; row += 1) {
      for (let column = 0; column < gridSize; column += 1) {
        const corners = [
          grid[row][column],
          grid[row][column + 1],
          grid[row + 1][column + 1],
          grid[row + 1][column],
        ];
        const intersections: Array<{ east: number; north: number }> = [];
        for (let edge = 0; edge < 4; edge += 1) {
          const first = corners[edge];
          const second = corners[(edge + 1) % 4];
          if ((first.value <= level && second.value > level) || (first.value > level && second.value <= level)) {
            intersections.push(interpolate(first, second, level));
          }
        }
        for (let pair = 0; pair + 1 < intersections.length; pair += 2) {
          segments.push({
            id: `C${levelIndex}-${row}-${column}-${pair / 2}`,
            elevation: round(level + (sampler.basis === "measured-z" ? sampler.averageElevation : 0)),
            start: intersections[pair],
            end: intersections[pair + 1],
          });
        }
      }
    }
  }
  return segments;
}

export function createTerrainModel(input: {
  reference: string;
  parcel: GeoPoint[];
  slope: number;
  exaggeration: number;
  sourceCrs: string;
  dataStatus: string;
  source: TerrainSource;
  projectEligible: boolean;
  layers: TerrainLayerVisibility;
  generatedAt?: string;
}): TerrainModel {
  const sampler = createTerrainElevationSampler(input.parcel, input.slope);
  const measuredValues = input.parcel.map((point) => point.alt).filter((value): value is number => Number.isFinite(value));
  const contours = createTerrainContours(input.parcel, input.slope);
  const licensedSurvey = /harita mühendisi|onaylı aplikasyon/i.test(input.dataStatus);
  const measured = sampler.basis === "measured-z";
  const conceptualRange = sampler.bounds.depth * Math.abs(input.slope) / 100;
  const minimum = measured ? Math.min(...measuredValues) : null;
  const maximum = measured ? Math.max(...measuredValues) : null;
  const range = measured ? (maximum as number) - (minimum as number) : conceptualRange;

  return {
    schema: TERRAIN_MODEL_SCHEMA,
    reference: input.reference,
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    coordinateReferenceSystem: input.sourceCrs,
    localPlane: "WGS84 → local ENU / metre",
    basis: sampler.basis,
    trust: measured ? licensedSurvey ? "verified" : "declared" : "conceptual",
    projectEligible: input.projectEligible,
    officialTerrain: false,
    licensedSurvey,
    source: {
      ...input.source,
      declaredStatus: input.dataStatus,
    },
    samples: {
      total: input.parcel.length,
      measured: measuredValues.length,
      requiredForMeasuredSurface: 3,
    },
    elevation: {
      minimum: minimum === null ? null : round(minimum),
      maximum: maximum === null ? null : round(maximum),
      average: measured ? round(sampler.averageElevation) : null,
      range: round(range),
      unit: "m",
      datum: measured ? "source-declared" : "relative-local",
    },
    parameters: {
      indicativeSlopePercent: round(input.slope),
      verticalExaggeration: round(input.exaggeration, 1),
    },
    surface: {
      method: measured ? "inverse-distance-weighting" : "parametric-gradient",
      contourMethod: "marching-squares-preview",
      contourSegments: contours.length,
    },
    layers: TERRAIN_LAYER_IDS.map((id) => ({
      id,
      label: LAYER_LABELS[id],
      visible: input.layers[id],
      available: id === "elevation-points" ? measuredValues.length > 0 : input.parcel.length >= 3,
    })),
    limitations: measured
      ? [
        "Kotlar kaynak dosya beyanıdır; düşey datum ve ölçüm yetkisi doğrulanmalıdır.",
        "Yüzey enterpolasyonu zemin etüdü veya onaylı plankote değildir.",
        "Resmî aplikasyon ve ruhsat projesi yerine geçmez.",
      ]
      : [
        "Parametrik yüzey kavramsaldır ve onaylı plankote değildir.",
        "Gösterilen eğim, kot ve eş yükselti çizgileri arazi ölçümü değildir.",
        "Resmî aplikasyon ve ruhsat projesi yerine geçmez.",
      ],
  };
}
