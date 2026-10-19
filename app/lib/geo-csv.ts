import type { GeoPoint } from "./geo.ts";

/** Headered coordinates retain their column positions; no filtering that shifts axes. */
export function parseGeoCsv(text: string): GeoPoint[] {
  const lines = text.replace(/^\uFEFF/, "").trim().split(/\r?\n/).filter(line => line.trim());
  if (!lines.length) return [];
  const delimiter = lines[0].includes(";") ? ";" : lines[0].includes("\t") ? "\t" : lines[0].includes(",") ? "," : " ";
  const split = (line: string) => (delimiter === " " ? line.trim().split(/\s+/) : line.split(delimiter)).map(value => value.trim().replace(/^"|"$/g, ""));
  const header = split(lines[0]).map(value => value.toLocaleLowerCase("tr-TR"));
  const latitudeIndex = header.findIndex(value => ["lat", "latitude", "enlem", "y"].includes(value));
  const longitudeIndex = header.findIndex(value => ["lng", "lon", "longitude", "boylam", "x"].includes(value));
  const altitudeIndex = header.findIndex(value => ["alt", "altitude", "elevation", "kot", "z"].includes(value));
  const hasHeader = header.some(value => /[a-zçğıöşü]/i.test(value));
  if (hasHeader && (latitudeIndex < 0 || longitudeIndex < 0)) throw new Error("CSV başlığında enlem ve boylam kolonları ayrı tanımlanmalı.");
  const number = (value: string | undefined) => {
    const normalized = delimiter === ";" ? (value ?? "").replace(",", ".") : value ?? "";
    return /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(normalized) ? Number(normalized) : NaN;
  };
  return lines.slice(hasHeader ? 1 : 0).map(line => {
    const cells = split(line);
    const first = number(cells[0]), second = number(cells[1]);
    const reversed = !hasHeader && Math.abs(first) > 90 && Math.abs(second) <= 90;
    const lat = hasHeader ? number(cells[latitudeIndex]) : reversed ? second : first;
    const lng = hasHeader ? number(cells[longitudeIndex]) : reversed ? first : second;
    const alt = number(cells[hasHeader ? altitudeIndex : 2]);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) throw new Error("CSV koordinat satırı boş, geçersiz veya WGS84 aralığı dışında.");
    return { lat, lng, ...(Number.isFinite(alt) ? { alt } : {}) };
  });
}
