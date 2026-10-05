import type { ZoningForm } from './zoning.ts';
export type LandZoningDeclaration = {
  province: string; district: string; neighborhood: string;
  taks: number | null; kaks: number | null; hmax: number | null; landUse: string;
  sourceUrl: string; retrievedAt: string; evidence: string; basis: 'listing-declaration';
};
export function normalizeLandZoningDeclaration(value: unknown, url: string): LandZoningDeclaration | null {
  if (!value || typeof value !== 'object') return null;
  const v = value as Record<string, unknown>;
  const text = (n: unknown, max = 100) => typeof n === 'string' ? n.trim().replace(/[\u0000-\u001f]/g, ' ').slice(0, max) : '';
  const numeric = (n: unknown, max: number) => typeof n === 'number' && Number.isFinite(n) && n > 0 && n <= max ? n : null;
  if (v.basis !== 'listing-declaration' || v.sourceUrl !== url || !text(v.province) || !text(v.district) || !text(v.neighborhood) || !Number.isFinite(Date.parse(text(v.retrievedAt)))) return null;
  const taks = numeric(v.taks, 1), kaks = numeric(v.kaks, 10), hmax = numeric(v.hmax, 250), landUse = text(v.landUse);
  if (taks === null && kaks === null && hmax === null && !landUse) return null;
  return {province:text(v.province),district:text(v.district),neighborhood:text(v.neighborhood),taks,kaks,hmax,landUse,
    sourceUrl:url,retrievedAt:text(v.retrievedAt),evidence:text(v.evidence,600),basis:'listing-declaration'};
}
export function listingZoningPrefill(current: ZoningForm, declaration: LandZoningDeclaration) {
  // Keep existing source-backed work and review untouched. A listing cannot
  // establish or replace an official/municipal record or expert review.
  if (current.sourceDocument || current.sourceUrl || current.sourceType || current.sourceNote || current.expertReviewStatus !== 'not-reviewed' || current.verification !== 'user-declared') return null;
  if (["taks","kaks","hmax"].some(key => { const k = key as "taks" | "kaks" | "hmax"; return current[k] >= 0 && declaration[k] !== null && current[k] !== declaration[k]; })) return null;
  const next = { ...current };
  let changed = false;
  for (const key of ['taks','kaks','hmax'] as const) {
    if (current[key] < 0 && declaration[key] !== null) { next[key] = declaration[key]!; changed = true; }
  }
  if (!current.landUse && declaration.landUse) { next.landUse = declaration.landUse; changed = true; }
  if (!changed) return null;
  return {...next,sourceType:'İlan beyanı',sourceUrl:declaration.sourceUrl,
    sourceNote:`Otomatik ilan aktarımı · okuma: ${declaration.retrievedAt}. Resmî imar doğrulaması değildir. ${declaration.evidence}`,
    verification:'user-declared' as const};
}
