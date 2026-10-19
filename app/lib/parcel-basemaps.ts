export const PARCEL_BASEMAPS = {
  osm: { label: 'Sokak', url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>', maxNativeZoom: 19 },
  satellite: { label: 'Uydu', url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', attribution: 'Tiles &copy; Esri, Maxar, Earthstar Geographics, and the GIS User Community', maxNativeZoom: 18 },
  topographic: { label: 'Topoğrafik', url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}', attribution: 'Tiles &copy; Esri and its data providers', maxNativeZoom: 19 },
} as const;
export type ParcelBasemap = keyof typeof PARCEL_BASEMAPS;
/** Display transformation only. Web Mercator is not a cadastral survey/grid coordinate. */
export function webMercatorPoint(lat: number, lng: number) {
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 85.05112878 || Math.abs(lng) > 180) return null;
  const radians = Math.PI / 180, radius = 6378137;
  return { x: radius * lng * radians, y: radius * Math.log(Math.tan(Math.PI / 4 + lat * radians / 2)) };
}
