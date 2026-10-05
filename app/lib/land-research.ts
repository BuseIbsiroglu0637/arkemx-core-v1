import { readLandAreaSizing, type LandAreaSizing } from "./land-area-sizing.ts";
import { normalizeLandParcelIdentity, type LandParcelIdentity } from "./land-parcel-prefill.ts";
export type LandCriteria = {
  province: string; district: string; tenure: "sale" | "rent";
  minArea: number; maxArea: number; maxPrice: number;
  use: "industrial" | "residential" | "commercial" | "agricultural" | "mixed";
  needs: string[];
};
export type LandCandidate = {
  id: string; title: string; url: string; source: string;
  province: string; district: string; tenure: "sale" | "rent" | null;
  areaM2: number | null; priceTRY: number | null;
  parcelIdentity?: LandParcelIdentity | null;
  use: string; description: string; retrievedAt: string;
  basis: "provider-listing" | "search-index" | "ai-search" | "browser-listing";
};
export type LandSourceStatus = { name: string; status: "completed" | "blocked" | "failed"; readCount: number; totalCount: number | null; note?: string };
export type LandSearchResponse = {
  schema: "ARKEM-LAND-SEARCH/1.0"; candidates: LandCandidate[];
  searchedAt: string; provider: string; criteriaKey: string; sources?: LandSourceStatus[];
};
export type LandResearch = {
  schema: "ARKEM-LAND-RESEARCH/1.0"; criteria: LandCriteria;
  shortlist: LandCandidate[]; selectedId: string | null; searchedAt: string;
  areaSizing?: LandAreaSizing | null;
};
export const LAND_NEEDS = ["Tır erişimi", "Enerji kapasitesi", "Su bağlantısı", "Genişleme alanı"] as const;
export const LAND_USES = { industrial: "Üretim / depo", residential: "Konut", commercial: "Ticari", agricultural: "Tarımsal", mixed: "Karma kullanım" } as const;
export function object(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}
function clean(value: unknown, limit = 100) {
  return typeof value === "string" ? value.replace(/[\u0000-\u001f]/g, " ").trim().slice(0, limit) : "";
}
export function parseLandCriteria(value: unknown): LandCriteria | null {
  const v = object(value);
  const province = clean(v.province, 60), district = clean(v.district, 60);
  if (!/^[\p{L} .'-]{2,60}$/u.test(province) || (district && !/^[\p{L} .'-]{2,60}$/u.test(district))) return null;
  if (v.tenure !== "sale" && v.tenure !== "rent") return null;
  if (typeof v.use !== "string" || !Object.hasOwn(LAND_USES, v.use)) return null;
  const numbers = [v.minArea, v.maxArea, v.maxPrice];
  if (!numbers.every(n => typeof n === "number" && Number.isFinite(n) && n >= 0) || Number(v.maxArea) > 1e8 || Number(v.minArea) > 1e8 || Number(v.maxPrice) > 1e12) return null;
  if (Number(v.maxArea) > 0 && Number(v.minArea) > Number(v.maxArea)) return null;
  const needs = Array.isArray(v.needs) ? [...new Set(v.needs.filter((n): n is string => typeof n === "string" && LAND_NEEDS.includes(n as typeof LAND_NEEDS[number])))] : [];
  return { province, district, tenure: v.tenure, use: v.use as LandCriteria["use"], minArea: Number(v.minArea), maxArea: Number(v.maxArea), maxPrice: Number(v.maxPrice), needs };
}
export function landCriteriaKey(criteria: LandCriteria) {
  return JSON.stringify({ province: criteria.province, district: criteria.district, tenure: criteria.tenure, use: criteria.use,
    minArea: criteria.minArea, maxArea: criteria.maxArea, maxPrice: criteria.maxPrice, needs: [...criteria.needs].sort() });
}
export function safeListingUrl(value: unknown) {
  try {
    const u = new URL(String(value));
    if (u.protocol !== "https:" || u.username || u.password || u.port || !u.hostname.includes(".") || /^(localhost|127\.|10\.|192\.168\.|169\.254\.)/.test(u.hostname)) return null;
    u.hash = "";
    for (const key of [...u.searchParams.keys()]) if (/^(utm_|fbclid|gclid)/i.test(key)) u.searchParams.delete(key);
    return u.toString();
  } catch { return null; }
}
export function normalizeLandCandidate(value: unknown, retrievedAt: string): LandCandidate | null {
  const v = object(value), url = safeListingUrl(v.url), title = clean(v.title, 220);
  if (!url || !title || (v.tenure !== "sale" && v.tenure !== "rent" && v.tenure !== null)) return null;
  const identity = normalizeLandParcelIdentity(v.parcelIdentity, url);
  const positive = (n: unknown) => typeof n === "number" && Number.isFinite(n) && n > 0 ? n : null;
  return { id: url, url, title, source: clean(v.source, 100) || new URL(url).hostname,
    province: clean(v.province, 60), district: clean(v.district, 60), tenure: v.tenure as LandCandidate["tenure"],
    parcelIdentity: identity && identity.province === clean(v.province, 60) && identity.district === clean(v.district, 60) ? identity : null,
    areaM2: positive(v.areaM2), priceTRY: v.tenure === null ? null : positive(v.priceTRY), use: clean(v.use, 40),
    description: clean(v.description, 600).replace(/<[^>]*>/g, ""), retrievedAt,
    basis: v.basis === "browser-listing" ? "browser-listing" : v.basis === "search-index" ? "search-index" : v.basis === "ai-search" ? "ai-search" : "provider-listing" };
}
export function assessLandCandidate(candidate: LandCandidate, criteria: LandCriteria) {
  const mismatch: string[] = [], missing: string[] = [];
  const equal = (a: string, b: string) => a.toLocaleLowerCase("tr-TR") === b.toLocaleLowerCase("tr-TR");
  if (candidate.tenure === null) missing.push("Satış / kiralama bilgisi eksik");
  else if (candidate.tenure !== criteria.tenure) mismatch.push("İşlem türü farklı");
  if (!candidate.province) missing.push("İl doğrulanmadı");
  else if (!equal(candidate.province, criteria.province)) mismatch.push("İl farklı");
  if (criteria.district) {
    if (!candidate.district) missing.push("İlçe doğrulanmadı");
    else if (!equal(candidate.district, criteria.district)) mismatch.push("İlçe farklı");
  }
  if (criteria.minArea > 0 || criteria.maxArea > 0) {
    if (candidate.areaM2 === null) missing.push("Alan bilgisi eksik");
    else if (candidate.areaM2 < criteria.minArea || (criteria.maxArea > 0 && candidate.areaM2 > criteria.maxArea)) mismatch.push("Alan aralığı dışında");
  }
  if (criteria.maxPrice > 0) {
    if (candidate.priceTRY === null) missing.push("Fiyat bilgisi eksik");
    else if (candidate.priceTRY > criteria.maxPrice) mismatch.push("Arsa bütçesini aşıyor");
  }
  if (!candidate.use) missing.push("Kullanım beyanı eksik");
  else if (candidate.use !== criteria.use) mismatch.push("Kullanım beyanı farklı");
  return { mismatch, missing, matchesDeclaredCriteria: mismatch.length === 0 && missing.length === 0,
    review: ["Parsel ve imar doğrulanmadı", ...criteria.needs.map(n => `${n}: doğrulama bekliyor`)],
    unitPrice: candidate.areaM2 && candidate.priceTRY ? candidate.priceTRY / candidate.areaM2 : null };
}
export function readLandResearch(value: unknown): LandResearch | null {
  const v = object(value), criteria = parseLandCriteria(v.criteria);
  if (v.schema !== "ARKEM-LAND-RESEARCH/1.0" || !criteria) return null;
  const shortlist = Array.isArray(v.shortlist) ? v.shortlist.slice(0, 30).map(c => normalizeLandCandidate(c, clean(object(c).retrievedAt, 40))).filter((c): c is LandCandidate => Boolean(c)) : [];
  const unique = [...new Map(shortlist.map(c => [c.id, c])).values()];
  return { schema: "ARKEM-LAND-RESEARCH/1.0", criteria, shortlist: unique, areaSizing: readLandAreaSizing(v.areaSizing),
    selectedId: typeof v.selectedId === "string" && unique.some(c => c.id === v.selectedId) ? v.selectedId : null,
    searchedAt: clean(v.searchedAt, 40) };
}


export function readLandSourceStatus(value: unknown): LandSourceStatus[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 10).flatMap(item => {
    const v = object(item), name = clean(v.name, 80);
    if (!name || !["completed", "blocked", "failed"].includes(String(v.status))) return [];
    const count = (n: unknown) => typeof n === "number" && Number.isInteger(n) && n >= 0 ? n : null;
    return [{ name, status: v.status as LandSourceStatus["status"], readCount: count(v.readCount) ?? 0, totalCount: count(v.totalCount), note: clean(v.note, 300) }];
  });
}
