export type LandParcelIdentity = {
  province: string; district: string; neighborhood: string; block: string; parcelNo: string;
  sourceUrl: string; retrievedAt: string; basis: 'listing-declaration';
};
const text = (value: unknown) => typeof value === 'string' ? value.trim().replace(/\s+/g, ' ').slice(0, 100) : '';
export function normalizeLandParcelIdentity(value: unknown, listingUrl: string): LandParcelIdentity | null {
  if (!value || typeof value !== 'object') return null;
  const v = value as Record<string, unknown>;
  if (v.basis !== 'listing-declaration' || v.sourceUrl !== listingUrl) return null;
  const province = text(v.province), district = text(v.district), neighborhood = text(v.neighborhood);
  const block = text(v.block), parcelNo = text(v.parcelNo);
  if (!province || !district || !neighborhood || !/^\d{1,10}$/.test(block) || !/^\d{1,10}$/.test(parcelNo)) return null;
  if (!Number(parcelNo) || !text(v.retrievedAt) || !Number.isFinite(Date.parse(text(v.retrievedAt)))) return null;
  return { province, district, neighborhood, block, parcelNo, sourceUrl: listingUrl, retrievedAt: text(v.retrievedAt), basis: 'listing-declaration' };
}
export function landParcelPrefill(current: { province?: string; district?: string; neighborhood?: string; block?: string; parcelNo?: string; parcel?: unknown[]; previewParcel?: unknown[] }, identity: LandParcelIdentity | null) {
  if (!identity || current.parcel?.length || current.previewParcel?.length) return null;
  const keys = ['province', 'district', 'neighborhood', 'block', 'parcelNo'] as const;
  const equal = (a: string, b: string) => a.trim().toLocaleLowerCase('tr-TR') === b.trim().toLocaleLowerCase('tr-TR');
  if (keys.some(key => current[key] && !equal(current[key]!, identity[key]))) return null;
  if (keys.every(key => current[key])) return null;
  return Object.fromEntries(keys.map(key => [key, current[key] || identity[key]])) as Pick<LandParcelIdentity, typeof keys[number]>;
}
