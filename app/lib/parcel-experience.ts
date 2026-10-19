import { geoCentroid, polygonArea, polygonSelfIntersects, toLocalMeters, type GeoPoint } from './geo.ts';

/** A single intact outer ring only. Never silently drop islands, holes or bad coordinates. */
export function parseParcelGeoJson(value: unknown): GeoPoint[] {
  if (!value || typeof value !== 'object') throw new Error('Geometri verisi okunamadı.');
  const data = value as Record<string, unknown>;
  if (data.type === 'Feature') return parseParcelGeoJson(data.geometry);
  if (data.type === 'FeatureCollection') {
    if (!Array.isArray(data.features) || data.features.length !== 1) throw new Error('Birden fazla kayıt var. Tek parsel içeren dosya seçin; sınır kesilmedi.');
    return parseParcelGeoJson(data.features[0]);
  }
  if (data.type === 'MultiPolygon') {
    if (!Array.isArray(data.coordinates) || data.coordinates.length !== 1) throw new Error('Çok parçalı parsel uzman aktarımı gerektirir; yalnız ilk parça alınmadı.');
    return parseParcelGeoJson({ type: 'Polygon', coordinates: data.coordinates[0] });
  }
  if (data.type !== 'Polygon' || !Array.isArray(data.coordinates) || data.coordinates.length !== 1) throw new Error('Tek dış sınır desteklenir. Delikli veya desteklenmeyen geometri değiştirilmedi.');
  const ring = data.coordinates[0];
  if (!Array.isArray(ring) || ring.length > 401) throw new Error('Sınır en fazla 400 köşe içermelidir; geometri kesilmedi.');
  const points = ring.map((coordinate): GeoPoint => {
    if (!Array.isArray(coordinate) || coordinate.length < 2 || coordinate.length > 3 || coordinate.some(v => typeof v !== 'number' || !Number.isFinite(v))) throw new Error('Sınırda geçersiz koordinat var; hiçbir nokta atlanmadı.');
    const [lng, lat, alt] = coordinate;
    if (Math.abs(lat) > 90 || Math.abs(lng) > 180) throw new Error('WGS84 koordinat aralığı dışında veri var.');
    return { lat, lng, ...(alt === undefined ? {} : { alt }) };
  });
  if (points.length > 3 && points[0].lat === points.at(-1)!.lat && points[0].lng === points.at(-1)!.lng) points.pop();
  if (points.length < 3 || points.length > 400 || polygonArea(points) <= 1 || polygonSelfIntersects(points)) throw new Error('En fazla 400 köşeli, geçerli ve kesişmeyen bir parsel sınırı gerekli.');
  return points;
}

/** Geometry-only inset, independent of map tiles and Leaflet. Not a cadastral image. */
export function parcelPreviewPoints(points: GeoPoint[]) {
  if (points.length < 3 || points.length > 400 || points.some(p => !Number.isFinite(p.lat) || !Number.isFinite(p.lng) || Math.abs(p.lat) > 90 || Math.abs(p.lng) > 180)) return null;
  if (polygonArea(points) <= 1 || polygonSelfIntersects(points)) return null;
  const origin = geoCentroid(points);
  const local = points.map(point => toLocalMeters(point, origin));
  const east = local.map(p => p.east), north = local.map(p => p.north);
  const minX = Math.min(...east), maxX = Math.max(...east), minY = Math.min(...north), maxY = Math.max(...north);
  const scale = 160 / Math.max(maxX - minX, maxY - minY);
  return local.map(p => `${(100 + (p.east - (minX + maxX) / 2) * scale).toFixed(2)},${(100 - (p.north - (minY + maxY) / 2) * scale).toFixed(2)}`).join(' ');
}

export function parcelOperationMatches(sequence: number, currentSequence: number, identity: string, currentIdentity: string, crs?: string, currentCrs?: string) {
  return sequence === currentSequence && identity === currentIdentity && (crs === undefined || crs === currentCrs);
}

export const PARCEL_JOURNEY = [
  { id: 'locate', label: 'Parselini bul', note: 'Konumu ve ada / parseli seçin' },
  { id: 'draw', label: 'Sınırı gör', note: 'Geometriyi ve kaynağını kontrol edin' },
  { id: 'zoning', label: 'İmarı incele', note: 'Plan notları ve alan hesabı' },
  { id: 'design', label: 'Yapıyı yerleştir', note: 'Önerilen yerleşim ve proje çıktısı' },
] as const;

export function parseKmlCoordinateRing(text: string): GeoPoint[] {
  const entries = text.trim().split(/\s+/);
  if (!text.trim() || entries.length > 401) throw new Error('Tek parselin en fazla 400 köşeli dış sınırı gerekli.');
  const coordinates = entries.map(entry => {
    const parts = entry.split(',');
    if (parts.length < 2 || parts.length > 3 || parts.some(part => !part.trim() || !Number.isFinite(Number(part)))) throw new Error('KML koordinatı geçersiz; hiçbir nokta atlanmadı.');
    return parts.map(Number);
  });
  return parseParcelGeoJson({ type: 'Polygon', coordinates: [coordinates] });
}
