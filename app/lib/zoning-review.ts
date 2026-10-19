import { planningInputsReady, type ParcelPlanningDraft } from './parcel-zoning-scope.ts';
export function zoningReviewMissing(draft: ParcelPlanningDraft, geometryKey: string) {
  const missing: string[] = [];
  if (!draft.documentReference?.trim()) missing.push('Belge adı veya numarası');
  const date = draft.documentDate ?? '';
  const parsed = /^\d{4}-\d{2}-\d{2}$/.test(date) ? new Date(date+'T00:00:00Z') : null;
  if (!parsed || !Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0,10) !== date) missing.push('Geçerli belge tarihi');
  if (!draft.netPlotArea || !draft.netAreaBasis.trim()) missing.push('Net alan ve belge dayanağı');
  if (draft.sourceGeometryKey !== geometryKey) missing.push('Belgenin mevcut parsel sınırıyla eşleşmesini kontrol etme');
  if (!planningInputsReady(draft)) missing.push('İmar koşulları ve parsel için girdi kontrolü');
  return missing;
}
