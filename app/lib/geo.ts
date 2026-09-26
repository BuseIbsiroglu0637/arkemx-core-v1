export type GeoPoint = { lat: number; lng: number; alt?: number };

const METERS_PER_DEGREE = 111_320;

export function geoCentroid(points: GeoPoint[]): GeoPoint {
  if (!points.length) return { lat: 40.7607, lng: 30.3675 };
  return {
    lat: points.reduce((sum, point) => sum + point.lat, 0) / points.length,
    lng: points.reduce((sum, point) => sum + point.lng, 0) / points.length,
    alt: points.some((point) => Number.isFinite(point.alt)) ? points.reduce((sum, point) => sum + (point.alt ?? 0), 0) / points.filter((point) => Number.isFinite(point.alt)).length : undefined,
  };
}

export function toLocalMeters(point: GeoPoint, origin: GeoPoint) {
  const latitudeFactor = Math.cos((origin.lat * Math.PI) / 180);
  return {
    east: (point.lng - origin.lng) * METERS_PER_DEGREE * latitudeFactor,
    north: (point.lat - origin.lat) * METERS_PER_DEGREE,
    elevation: point.alt,
  };
}

export function fromLocalMeters(east: number, north: number, origin: GeoPoint, alt?: number): GeoPoint {
  const latitudeFactor = Math.max(.2, Math.cos((origin.lat * Math.PI) / 180));
  return {
    lat: origin.lat + north / METERS_PER_DEGREE,
    lng: origin.lng + east / (METERS_PER_DEGREE * latitudeFactor),
    alt,
  };
}

export function polygonArea(points: GeoPoint[]) {
  if (points.length < 3) return 0;
  const origin = geoCentroid(points);
  const local = points.map((point) => toLocalMeters(point, origin));
  return Math.abs(local.reduce((sum, point, index) => {
    const next = local[(index + 1) % local.length];
    return sum + point.east * next.north - next.east * point.north;
  }, 0) / 2);
}

export function polygonPerimeter(points: GeoPoint[]) {
  if (points.length < 2) return 0;
  const origin = geoCentroid(points);
  const local = points.map((point) => toLocalMeters(point, origin));
  return local.reduce((sum, point, index) => {
    const next = local[(index + 1) % local.length];
    return sum + Math.hypot(next.east - point.east, next.north - point.north);
  }, 0);
}

export function polygonSelfIntersects(points: GeoPoint[]) {
  if (points.length < 4) return false;
  const origin = geoCentroid(points);
  const local = points.map((point) => toLocalMeters(point, origin));
  type LocalPoint = { east: number; north: number };
  const orientation = (a: LocalPoint, b: LocalPoint, c: LocalPoint) => {
    const cross = (b.east - a.east) * (c.north - a.north) - (b.north - a.north) * (c.east - a.east);
    return Math.abs(cross) < 1e-9 ? 0 : Math.sign(cross);
  };
  const onSegment = (a: LocalPoint, b: LocalPoint, point: LocalPoint) => point.east <= Math.max(a.east, b.east) + 1e-9 && point.east >= Math.min(a.east, b.east) - 1e-9 && point.north <= Math.max(a.north, b.north) + 1e-9 && point.north >= Math.min(a.north, b.north) - 1e-9;
  const intersects = (a: LocalPoint, b: LocalPoint, c: LocalPoint, d: LocalPoint) => {
    const abc = orientation(a, b, c);
    const abd = orientation(a, b, d);
    const cda = orientation(c, d, a);
    const cdb = orientation(c, d, b);
    if (abc !== abd && cda !== cdb) return true;
    return (abc === 0 && onSegment(a, b, c)) || (abd === 0 && onSegment(a, b, d)) || (cda === 0 && onSegment(c, d, a)) || (cdb === 0 && onSegment(c, d, b));
  };
  for (let first = 0; first < local.length; first += 1) {
    const firstNext = (first + 1) % local.length;
    for (let second = first + 1; second < local.length; second += 1) {
      const secondNext = (second + 1) % local.length;
      if (first === second || firstNext === second || secondNext === first) continue;
      if (first === 0 && secondNext === 0) continue;
      if (intersects(local[first], local[firstNext], local[second], local[secondNext])) return true;
    }
  }
  return false;
}

export function pointInPolygon(point: GeoPoint, polygon: GeoPoint[]) {
  if (polygon.length < 3) return false;
  const origin = geoCentroid(polygon);
  const target = toLocalMeters(point, origin);
  const local = polygon.map((corner) => toLocalMeters(corner, origin));
  let inside = false;
  for (let index = 0, previous = local.length - 1; index < local.length; previous = index, index += 1) {
    const a = local[index];
    const b = local[previous];
    const intersects = ((a.north > target.north) !== (b.north > target.north)) && target.east < ((b.east - a.east) * (target.north - a.north)) / (b.north - a.north || Number.EPSILON) + a.east;
    if (intersects) inside = !inside;
  }
  return inside;
}

export function minimumBoundaryDistance(polygon: GeoPoint[], object: GeoPoint[]) {
  if (polygon.length < 2 || !object.length) return 0;
  const origin = geoCentroid(polygon);
  const boundary = polygon.map((point) => toLocalMeters(point, origin));
  const targets = object.map((point) => toLocalMeters(point, origin));
  const distanceToSegment = (east: number, north: number, a: { east: number; north: number }, b: { east: number; north: number }) => {
    const dx = b.east - a.east;
    const dy = b.north - a.north;
    const lengthSquared = dx * dx + dy * dy;
    const factor = lengthSquared ? Math.max(0, Math.min(1, ((east - a.east) * dx + (north - a.north) * dy) / lengthSquared)) : 0;
    return Math.hypot(east - (a.east + factor * dx), north - (a.north + factor * dy));
  };
  return Math.min(...targets.flatMap((target) => boundary.map((corner, index) => distanceToSegment(target.east, target.north, corner, boundary[(index + 1) % boundary.length]))));
}

export function localBounds(points: GeoPoint[]) {
  const origin = geoCentroid(points);
  const local = points.map((point) => toLocalMeters(point, origin));
  if (!local.length) return { origin, minEast: -25, maxEast: 25, minNorth: -25, maxNorth: 25, width: 50, depth: 50 };
  const minEast = Math.min(...local.map((point) => point.east));
  const maxEast = Math.max(...local.map((point) => point.east));
  const minNorth = Math.min(...local.map((point) => point.north));
  const maxNorth = Math.max(...local.map((point) => point.north));
  return { origin, minEast, maxEast, minNorth, maxNorth, width: maxEast - minEast, depth: maxNorth - minNorth };
}

export function buildingFootprint(origin: GeoPoint, width: number, depth: number, rotation: number, offsetEast = 0, offsetNorth = 0): GeoPoint[] {
  const angle = (rotation * Math.PI) / 180;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return [
    [-width / 2, -depth / 2],
    [width / 2, -depth / 2],
    [width / 2, depth / 2],
    [-width / 2, depth / 2],
  ].map(([east, north]) => fromLocalMeters(
    offsetEast + east * cos - north * sin,
    offsetNorth + east * sin + north * cos,
    origin,
  ));
}

export function sampleParcel(center: GeoPoint): GeoPoint[] {
  return [
    [-31, -43], [27, -39], [35, 7], [22, 46], [-26, 42], [-36, 3],
  ].map(([east, north]) => fromLocalMeters(east, north, center));
}
