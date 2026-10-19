export type AreaCategory = 'included' | 'excluded-limited' | 'excluded-independent' | 'unknown';
export type AreaEntry = { id: string; name: string; area: string; category: AreaCategory; countsInConstruction: 'yes' | 'no' | 'unknown'; basis: string };
export type AreaBudgetInput = { netPlotArea: string; netAreaBasis: string; far: string; sourceReference: string; sourceDate: string; entries: AreaEntry[] };
export function restoreAreaBudgetInput(value: unknown): AreaBudgetInput | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const input = value as AreaBudgetInput;
  if (['netPlotArea','netAreaBasis','far','sourceReference','sourceDate'].some(key => typeof input[key as keyof AreaBudgetInput] !== 'string' || String(input[key as keyof AreaBudgetInput]).length > 500)) return null;
  if (!Array.isArray(input.entries) || input.entries.length > 50) return null;
  if (input.entries.some(row => !row || typeof row !== 'object' || ['id','name','area','basis'].some(key => typeof row[key as keyof AreaEntry] !== 'string' || row[key as keyof AreaEntry].length > 500) || !['included','excluded-limited','excluded-independent','unknown'].includes(row.category) || !['yes','no','unknown'].includes(row.countsInConstruction))) return null;
  return { ...input, entries: input.entries.map(row => ({ ...row })) };
}
export function positiveArea(value: string) {
  if (!/^\d+(?:[.,]\d{1,4})?$/.test(value.trim())) return null;
  const number = Number(value.replace(',', '.'));
  return Number.isFinite(number) && number > 0 && number <= 1e8 ? number : null;
}
/** This is a declared schedule, never an automatic legal allowance or certified entitlement. */
export function calculateAreaBudget(input: AreaBudgetInput) {
  if (!restoreAreaBudgetInput(input)) return { capacity: null, included: 0, limited: 0, independent: 0, construction: null, completeRows: false, issues: ['Kaydedilmiş alan cetveli geçersiz; yeniden girin.'], authoritative: false as const };
  const plot = positiveArea(input.netPlotArea), far = positiveArea(input.far);
  const capacity = plot !== null && far !== null && far <= 10 ? plot * far : null;
  const issues: string[] = [];
  if (!input.netAreaBasis.trim()) issues.push('Net imar parsel alanının belge dayanağı eksik.');
  const date = /^\d{4}-\d{2}-\d{2}$/.test(input.sourceDate) ? new Date(input.sourceDate + 'T00:00:00Z') : null;
  if (!input.sourceReference.trim() || !date || !Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== input.sourceDate) issues.push('İmar kaynağı / geçerli belge tarihi eksik.');
  if (capacity === null) issues.push('Net imar parsel alanı ve emsal değeri tamamlanmalı.');
  let included = 0, limited = 0, independent = 0, construction = 0;
  const ids = new Set<string>(), names = new Set<string>();
  let completeRows = input.entries.length > 0;
  for (const row of input.entries) {
    const area = positiveArea(row.area);
    const name = row.name.trim().toLocaleLowerCase('tr-TR').replace(/\s+/g, ' ');
    if (ids.has(row.id) || names.has(name) || !name || area === null || row.category === 'unknown' || row.countsInConstruction === 'unknown' || !row.basis.trim()) {
      completeRows = false; issues.push(`${row.name || 'Alan kalemi'}: tekrar eden kayıt, eksik sınıf, alan veya dayanak kontrol edilmeli.`); continue;
    }
    ids.add(row.id); names.add(name);
    if (row.category === 'included') included += area;
    if (row.category === 'excluded-limited') limited += area;
    if (row.category === 'excluded-independent') independent += area;
    if (row.countsInConstruction === 'yes') construction += area;
  }
  if (!input.entries.length) issues.push('Toplam alan için tekil kat / mahal cetveli ekleyin.');
  if (capacity !== null && included > capacity) issues.push('Emsale dahil cetvel alanı girilen kapasiteyi aşıyor.');
  return { capacity, included, limited, independent, construction: issues.length ? null : construction, completeRows, issues, authoritative: false as const };
}
