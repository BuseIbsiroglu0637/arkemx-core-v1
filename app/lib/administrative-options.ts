export type AdministrativeOption = { id: string; label: string };
export function normalizeAdministrativeName(value: unknown) {
  return String(value ?? '').trim().toLocaleLowerCase('tr-TR').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/ı/g, 'i').replace(/\b(mahallesi|mah\.?|köyü|koyu|köy|koy)\b/g, '').replace(/[^a-z0-9çğıöşü]+/g, '');
}
/** TKGM identifiers are not Turkish plate codes. Only accept IDs actually supplied by the service. */
export function administrativeOptions(data: unknown, level: 'province' | 'district' | 'neighborhood' = 'province'): AdministrativeOption[] {
  const value = data as { features?: unknown[]; data?: unknown[] } | null;
  const rows = Array.isArray(data) ? data : Array.isArray(value?.features) ? value.features : Array.isArray(value?.data) ? value.data : [];
  const seen = new Set<string>();
  return rows.flatMap(row => {
    if (!row || typeof row !== 'object') return [];
    const raw = row as Record<string, unknown>;
    const item = raw.properties && typeof raw.properties === 'object' ? raw.properties as Record<string, unknown> : raw;
    const prefix = {province:'il', district:'ilce', neighborhood:'mahalle'}[level];
    const id = String(item[`${prefix}Id`] ?? item.id ?? '');
    const label = String(item[`${prefix}Ad`] ?? item.text ?? item.ad ?? item.name ?? '').trim();
    if (!/^\d{1,12}$/.test(id) || !label || label.length > 120 || seen.has(id)) return [];
    seen.add(id); return [{ id, label }];
  }).sort((a, b) => a.label.localeCompare(b.label, 'tr'));
}
