import {
  fromLocalMeters,
  geoCentroid,
  localBounds,
  pointInPolygon,
  polygonArea,
  polygonEdgesCross,
  polygonSelfIntersects,
  toLocalMeters,
  type GeoPoint,
} from "./geo.ts";
import type { ZoningVerification } from "./zoning.ts";

export type ParcelFrontEdge = "north" | "east" | "south" | "west";

export type ZoningMassingInput = {
  reference: string;
  parcel: GeoPoint[];
  zoning: {
    taks: number;
    kaks: number;
    hmax: number;
    frontSetback: number;
    sideSetback: number;
    rearSetback: number;
    buildingOrder: string;
    verification: ZoningVerification;
  };
  frontEdge: ParcelFrontEdge;
  floorHeight: number;
  generatedAt?: string;
};

type AlternativeProfile = {
  id: "maximum-footprint" | "balanced" | "compact";
  label: string;
  note: string;
  footprintFactor: number;
  aspect: number | "envelope";
};

const ALTERNATIVE_PROFILES: AlternativeProfile[] = [
  {
    id: "maximum-footprint",
    label: "Maksimum taban",
    note: "Yatay kullanım ve düşük katlı çözüm için taban hakkını öne çıkarır.",
    footprintFactor: 1,
    aspect: "envelope",
  },
  {
    id: "balanced",
    label: "Dengeli kütle",
    note: "Taban, kat adedi ve açık alan arasında dengeli bir başlangıç üretir.",
    footprintFactor: 0.78,
    aspect: 1.35,
  },
  {
    id: "compact",
    label: "Kompakt kütle",
    note: "Daha küçük tabanla açık alanı korur; yükseklik hakkını kontrollü kullanır.",
    footprintFactor: 0.58,
    aspect: 1,
  },
];

const finiteNonNegative = (value: number) => Number.isFinite(value) ? Math.max(0, value) : 0;
const round = (value: number, digits = 2) => Number(value.toFixed(digits));

type CardinalEdge = "north" | "east" | "south" | "west";
type SetbackRole = "front" | "side" | "rear";

const oppositeEdge: Record<CardinalEdge, CardinalEdge> = {
  north: "south",
  east: "west",
  south: "north",
  west: "east",
};

function classifyParcelEdge(midEast: number, midNorth: number, centerEast: number, centerNorth: number): CardinalEdge {
  const dx = midEast - centerEast;
  const dy = midNorth - centerNorth;
  if (Math.abs(dx) > Math.abs(dy)) return dx >= 0 ? "east" : "west";
  return dy >= 0 ? "north" : "south";
}

function setbackRoleForEdge(edge: CardinalEdge, frontEdge: ParcelFrontEdge): SetbackRole {
  if (edge === frontEdge) return "front";
  if (edge === oppositeEdge[frontEdge]) return "rear";
  return "side";
}

function distancePointToSegment(
  point: { east: number; north: number },
  a: { east: number; north: number },
  b: { east: number; north: number },
) {
  const dx = b.east - a.east;
  const dy = b.north - a.north;
  const lengthSquared = dx * dx + dy * dy;
  if (!lengthSquared) return Math.hypot(point.east - a.east, point.north - a.north);
  const t = Math.max(0, Math.min(1, ((point.east - a.east) * dx + (point.north - a.north) * dy) / lengthSquared));
  return Math.hypot(point.east - (a.east + t * dx), point.north - (a.north + t * dy));
}

function orientationsIntersect(
  a: { east: number; north: number },
  b: { east: number; north: number },
  c: { east: number; north: number },
  d: { east: number; north: number },
) {
  const cross = (p: { east: number; north: number }, q: { east: number; north: number }, r: { east: number; north: number }) =>
    (q.east - p.east) * (r.north - p.north) - (q.north - p.north) * (r.east - p.east);
  const abC = cross(a, b, c);
  const abD = cross(a, b, d);
  const cdA = cross(c, d, a);
  const cdB = cross(c, d, b);
  return abC * abD < -1e-9 && cdA * cdB < -1e-9;
}

function distanceSegmentToSegment(
  a: { east: number; north: number },
  b: { east: number; north: number },
  c: { east: number; north: number },
  d: { east: number; north: number },
) {
  if (orientationsIntersect(a, b, c, d)) return 0;
  return Math.min(
    distancePointToSegment(a, c, d),
    distancePointToSegment(b, c, d),
    distancePointToSegment(c, a, b),
    distancePointToSegment(d, a, b),
  );
}

export function assessParcelEdgeSetbacks(params: {
  parcel: GeoPoint[];
  building: GeoPoint[];
  frontEdge: ParcelFrontEdge;
  front: number;
  side: number;
  rear: number;
}) {
  const { parcel, building, frontEdge } = params;
  if (parcel.length < 3 || building.length < 3) {
    return {
      pass: false,
      buildingFits: false,
      minimumDistance: 0,
      governing: null,
      edges: [],
    };
  }

  const origin = geoCentroid(parcel);
  const parcelLocal = parcel.map((point) => toLocalMeters(point, origin));
  const buildingLocal = building.map((point) => toLocalMeters(point, origin));
  const center = parcelLocal.reduce((sum, point) => ({ east: sum.east + point.east, north: sum.north + point.north }), { east: 0, north: 0 });
  center.east /= parcelLocal.length;
  center.north /= parcelLocal.length;

  const buildingFits = building.every((corner) => pointInPolygon(corner, parcel)) && !polygonEdgesCross(parcel, building);
  const requiredByRole: Record<SetbackRole, number> = {
    front: finiteNonNegative(params.front),
    side: finiteNonNegative(params.side),
    rear: finiteNonNegative(params.rear),
  };

  const edges = parcelLocal.map((a, index) => {
    const b = parcelLocal[(index + 1) % parcelLocal.length];
    const midpoint = { east: (a.east + b.east) / 2, north: (a.north + b.north) / 2 };
    const cardinal = classifyParcelEdge(midpoint.east, midpoint.north, center.east, center.north);
    const role = setbackRoleForEdge(cardinal, frontEdge);
    const required = requiredByRole[role];
    const distance = Math.min(...buildingLocal.map((c, buildingIndex) => {
      const d = buildingLocal[(buildingIndex + 1) % buildingLocal.length];
      return distanceSegmentToSegment(a, b, c, d);
    }));
    const margin = distance - required;
    return {
      index,
      cardinal,
      role,
      required: round(required),
      distance: round(distance),
      margin: round(margin),
      pass: buildingFits && distance + .01 >= required,
    };
  });

  const governing = edges.reduce<typeof edges[number] | null>((worst, edge) =>
    !worst || edge.margin < worst.margin ? edge : worst, null);

  return {
    pass: buildingFits && edges.every((edge) => edge.pass),
    buildingFits,
    minimumDistance: round(Math.min(...edges.map((edge) => edge.distance))),
    governing,
    edges,
  };
}

function createEnvelope(parcel: GeoPoint[], frontEdge: ParcelFrontEdge, front: number, side: number, rear: number) {
  const bounds = localBounds(parcel);
  let minEast = bounds.minEast + side;
  let maxEast = bounds.maxEast - side;
  let minNorth = bounds.minNorth + side;
  let maxNorth = bounds.maxNorth - side;

  if (frontEdge === "north") {
    minNorth = bounds.minNorth + rear;
    maxNorth = bounds.maxNorth - front;
  } else if (frontEdge === "south") {
    minNorth = bounds.minNorth + front;
    maxNorth = bounds.maxNorth - rear;
  } else if (frontEdge === "east") {
    minEast = bounds.minEast + rear;
    maxEast = bounds.maxEast - front;
  } else {
    minEast = bounds.minEast + front;
    maxEast = bounds.maxEast - rear;
  }

  const width = Math.max(0, maxEast - minEast);
  const depth = Math.max(0, maxNorth - minNorth);
  const offsetEast = (minEast + maxEast) / 2;
  const offsetNorth = (minNorth + maxNorth) / 2;
  const polygon = width > 0 && depth > 0 ? [
    fromLocalMeters(minEast, minNorth, bounds.origin),
    fromLocalMeters(maxEast, minNorth, bounds.origin),
    fromLocalMeters(maxEast, maxNorth, bounds.origin),
    fromLocalMeters(minEast, maxNorth, bounds.origin),
  ] : [];

  return {
    frontEdge,
    method: "axis-aligned-bounding-envelope" as const,
    width: round(width),
    depth: round(depth),
    area: round(width * depth),
    offsetEast: round(offsetEast),
    offsetNorth: round(offsetNorth),
    rotation: 0,
    polygon,
    setbacks: { front: round(front), side: round(side), rear: round(rear) },
  };
}

function candidatePolygon(
  origin: GeoPoint,
  width: number,
  depth: number,
  offsetEast: number,
  offsetNorth: number,
) {
  return [
    fromLocalMeters(offsetEast - width / 2, offsetNorth - depth / 2, origin),
    fromLocalMeters(offsetEast + width / 2, offsetNorth - depth / 2, origin),
    fromLocalMeters(offsetEast + width / 2, offsetNorth + depth / 2, origin),
    fromLocalMeters(offsetEast - width / 2, offsetNorth + depth / 2, origin),
  ];
}

export function createZoningMassingModel(input: ZoningMassingInput) {
  const parcelArea = polygonArea(input.parcel);
  const geometryValid = input.parcel.length >= 3 && parcelArea > 1 && !polygonSelfIntersects(input.parcel);
  const taks = finiteNonNegative(input.zoning.taks);
  const kaks = finiteNonNegative(input.zoning.kaks);
  const hmax = finiteNonNegative(input.zoning.hmax);
  const floorHeight = Math.max(2.4, finiteNonNegative(input.floorHeight) || 3);
  const front = finiteNonNegative(input.zoning.frontSetback);
  const side = finiteNonNegative(input.zoning.sideSetback);
  const rear = finiteNonNegative(input.zoning.rearSetback);
  const envelope = createEnvelope(input.parcel, input.frontEdge, front, side, rear);
  const bounds = localBounds(input.parcel);
  const allowedFootprint = parcelArea * taks;
  const allowedGrossArea = parcelArea * kaks;
  const maxFloors = Math.floor(hmax / floorHeight);
  const maximumCandidateFootprint = Math.max(0, Math.min(allowedFootprint, allowedGrossArea, envelope.area));

  const alternatives = ALTERNATIVE_PROFILES.map((profile) => {
    const targetFootprint = maximumCandidateFootprint * profile.footprintFactor;
    const envelopeAspect = envelope.depth > 0 ? envelope.width / envelope.depth : 1;
    const aspect = profile.aspect === "envelope" ? Math.max(.5, Math.min(2.5, envelopeAspect)) : profile.aspect;
    let width = Math.sqrt(Math.max(0, targetFootprint) * aspect);
    let depth = width > 0 ? targetFootprint / width : 0;
    const boundScale = Math.min(1, envelope.width / Math.max(width, .001), envelope.depth / Math.max(depth, .001));
    width *= Math.max(0, boundScale);
    depth *= Math.max(0, boundScale);

    let polygon = candidatePolygon(bounds.origin, width, depth, envelope.offsetEast, envelope.offsetNorth);
    let setbackAssessment = assessParcelEdgeSetbacks({
      parcel: input.parcel,
      building: polygon,
      frontEdge: input.frontEdge,
      front,
      side,
      rear,
    });
    for (let attempt = 0; attempt < 14 && !setbackAssessment.pass; attempt += 1) {
      width *= .94;
      depth *= .94;
      polygon = candidatePolygon(bounds.origin, width, depth, envelope.offsetEast, envelope.offsetNorth);
      setbackAssessment = assessParcelEdgeSetbacks({
        parcel: input.parcel,
        building: polygon,
        frontEdge: input.frontEdge,
        front,
        side,
        rear,
      });
    }

    const footprint = width * depth;
    const floorLimitFromGross = footprint > 0 ? Math.floor((allowedGrossArea + .001) / footprint) : 0;
    const floors = Math.max(0, Math.min(maxFloors, floorLimitFromGross));
    const grossArea = footprint * floors;
    const height = floors * floorHeight;
    const checks = [
      { code: "ZM-01", label: "Parsel geometrisi", pass: geometryValid },
      { code: "ZM-02", label: "Kenar bazlı çekme", pass: envelope.area > 0 && setbackAssessment.pass },
      { code: "ZM-03", label: "TAKS", pass: footprint <= allowedFootprint + .01 },
      { code: "ZM-04", label: "KAKS / emsal", pass: grossArea <= allowedGrossArea + .01 },
      { code: "ZM-05", label: "Hmax / Yençok", pass: floors > 0 && height <= hmax + .01 },
    ];
    const fits = checks.every((check) => check.pass);
    const utilization = allowedGrossArea > 0 ? grossArea / allowedGrossArea : 0;

    return {
      id: profile.id,
      label: profile.label,
      note: profile.note,
      status: fits ? "fits" as const : "review" as const,
      width: round(width),
      depth: round(depth),
      footprint: round(footprint),
      floors,
      floorHeight: round(floorHeight),
      grossArea: round(grossArea),
      height: round(height),
      coverage: parcelArea > 0 ? round((footprint / parcelArea) * 100, 1) : 0,
      far: parcelArea > 0 ? round(grossArea / parcelArea, 2) : 0,
      utilization: round(utilization * 100, 1),
      rotation: envelope.rotation,
      offsetEast: envelope.offsetEast,
      offsetNorth: envelope.offsetNorth,
      boundaryDistance: setbackAssessment.minimumDistance,
      setbackAssessment,
      polygon,
      checks,
      governingConstraint: envelope.area < allowedFootprint
        ? "çekme zarfı"
        : maxFloors <= floorLimitFromGross
          ? "Hmax"
          : "KAKS / emsal",
    };
  });

  const authoritative = input.zoning.verification === "approved-plan" || input.zoning.verification === "certified-document";
  return {
    schema: "ARKEM-ZONING-MASSING/1.0" as const,
    reference: input.reference,
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    source: {
      verification: input.zoning.verification,
      authoritative,
      trust: authoritative ? "verified" as const : input.zoning.verification === "municipal-viewer" ? "declared" as const : "conceptual" as const,
    },
    parcel: { area: round(parcelArea), geometryValid },
    zoning: {
      buildingOrder: input.zoning.buildingOrder,
      taks: round(taks, 3),
      kaks: round(kaks, 3),
      hmax: round(hmax),
    },
    limits: {
      allowedFootprint: round(allowedFootprint),
      allowedGrossArea: round(allowedGrossArea),
      allowedHeight: round(hmax),
      maxFloors,
    },
    envelope,
    alternatives,
    recommendedAlternativeId: alternatives.find((item) => item.id === "balanced" && item.status === "fits")?.id
      ?? alternatives.find((item) => item.status === "fits")?.id
      ?? null,
    limitations: [
      "Çekme kontrolü parselin gerçek kenarlarına göre ön/yan/arka mesafeleri ayrı değerlendirir; ön cephe yönü kullanıcı seçimine dayanır ve yol cephesi/aplikasyon resmî kaynaktan doğrulanmalıdır.",
      "Plan notları, çıkmalar, bodrum ve çatı hükümleri, kotlandırma, yangın, otopark ve kullanım kararları ayrıca incelenir.",
      authoritative
        ? "Kaynak statüsü doğrulanmış olsa da bu sonuç ruhsat projesi veya resmî imar uygunluk belgesi değildir."
        : "Kaynaksız veya kullanıcı beyanlı değerler resmî yapılaşma hakkı ve ruhsat kararı olarak kullanılamaz.",
    ],
  };
}
