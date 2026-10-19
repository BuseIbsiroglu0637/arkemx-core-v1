import { parcelIdentityKey, type ParcelIdentity } from './parcel-record.ts';
import type { GeoPoint } from './geo.ts';
import { readBoundedJson } from './bounded-json.ts';
import { normalizeZoningPlace } from '../data/zoning-regions.ts';
import { resolveZoningPortal } from '../data/zoning-authorities.ts';

export type MunicipalResearchScope = {
  projectId: string;
  projectRevision: string;
  sourceRevision: string;
  identityKey: string;
  geometryKey: string;
};

export type MunicipalPlanCandidate = {
  id: string;
  name: string;
  scale: string;
  date: string;
  decision: string;
  district?: string;
  block?: string;
  parcel?: string;
  note?: string;
  qualityIssues?: string[];
  rawConditions?: { taks: number | null; far: number | null; floors: number | null; height: number | null };
};

export type MunicipalResearchResult = {
  status: 'demo-disabled' | 'idle' | 'loading' | 'research-only' | 'not-found' | 'unsupported' | 'unavailable' | 'action-required' | 'authority-required';
  scope: MunicipalResearchScope | null;
  authoritative: false;
  entitlementAvailable: false;
  /** Query identity is not proof that a plan covers the complete cadastral parcel. */
  parcelMatch: 'not-verified';
  automaticConditions: null;
  observedAt?: string;
  source?: string;
  authority?: string;
  partial?: boolean;
  limitation?: string;
  message?: string;
  plans: MunicipalPlanCandidate[];
};

export const MUNICIPAL_RESEARCH_SOURCES = {
  istanbul: 'https://haritaservis.ibb.gov.tr/planask/rest/services/PlanAskiGeo/MapServer/0',
  kastamonu: 'https://e-imar.kastamonuozelidare.gov.tr/arcgis/rest/services/IDARE_PUBLIC/IMAR_PUBLIC/FeatureServer/1826',
} as const;

export function createMunicipalResearchScope(identity: ParcelIdentity, points: GeoPoint[], projectId: string, projectRevision: string, sourceRevision = ''): MunicipalResearchScope {
  return { projectId, projectRevision, sourceRevision, identityKey: parcelIdentityKey(identity), geometryKey: JSON.stringify(points.map(p => [p.lng, p.lat])) };
}

export function municipalResearchKey(scope: MunicipalResearchScope) {
  return JSON.stringify([scope.projectId, scope.projectRevision, scope.sourceRevision, scope.identityKey, scope.geometryKey]);
}

export function sameMunicipalResearchScope(value: unknown, expected: MunicipalResearchScope): boolean {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const scope = value as Record<string, unknown>;
  return scope.projectId === expected.projectId && scope.projectRevision === expected.projectRevision
    && scope.sourceRevision === expected.sourceRevision && scope.identityKey === expected.identityKey && scope.geometryKey === expected.geometryKey;
}

export function municipalResearchState(status: MunicipalResearchResult['status'], scope: MunicipalResearchScope | null, message?: string): MunicipalResearchResult {
  return { status, scope, authoritative: false, entitlementAvailable: false, parcelMatch: 'not-verified', automaticConditions: null, plans: [], ...(message ? { message } : {}) };
}

/** A source directory is not jurisdiction proof or permission to call a protected portal. */
export function municipalResearchAccess(identity: Pick<ParcelIdentity, 'province' | 'district' | 'neighborhood'>, scope: MunicipalResearchScope | null): MunicipalResearchResult | null {
  const province = normalizeZoningPlace(identity.province);
  const portal = resolveZoningPortal(identity.province, identity.district, identity.neighborhood);
  if (portal?.id === 'kastamonu-belediyesi' || portal?.id === 'besiktas-keos') {
    return {
      ...municipalResearchState('action-required', scope, 'Belediyenin e-imar kaynağı belirlendi. Bu portalın üçüncü taraf veri aktarımı izni doğrulanmadığından güncel imar koşulları otomatik alınamadı. Bu, parselde imar olmadığı anlamına gelmez.'),
      authority: portal.authority, source: portal.href, limitation: portal.limitation,
    };
  }
  if (province === 'kastamonu') return municipalResearchState('authority-required', scope,
    'Bu konumun belediye veya İl Özel İdaresi yetki alanı henüz doğrulanmadı. Yalnız il/ilçe adına bakarak bir idarenin plan verisi parsele uygulanmadı.');
  return null;
}

const object = (value: unknown): Record<string, unknown> | null => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
const text = (value: unknown, max = 600) => typeof value === 'string' ? value.trim().slice(0, max) : '';
const number = (value: unknown) => typeof value === 'number' && Number.isFinite(value) ? value : null;

/** These providers expose research layers only. Never upgrade their flags or copy their values to rights. */
export function adaptMunicipalResearchResult(value: unknown, expected: MunicipalResearchScope, now = Date.now()): MunicipalResearchResult {
  const unavailable = (message: string) => municipalResearchState('unavailable', expected, message);
  const raw = object(value);
  if (!raw || !sameMunicipalResearchScope(raw.scope, expected)) return unavailable('Yanıtın parsel ve proje kapsamı eşleşmedi; sonuç kullanılmadı.');
  if (raw.authoritative !== false || raw.entitlementAvailable !== false) return unavailable('Kaynak doğrulama bilgisi geçersiz; imar değeri aktarılmadı.');
  if (raw.status === 'unsupported' || raw.status === 'unavailable') return municipalResearchState(raw.status, expected, text(raw.message));
  let identity: Pick<ParcelIdentity, 'province' | 'district' | 'neighborhood'>;
  try {
    const parts = JSON.parse(expected.identityKey);
    if (!Array.isArray(parts) || parts.length !== 5 || parts.some(part => typeof part !== 'string')) throw new Error('identity');
    identity = { province: parts[0], district: parts[1], neighborhood: parts[2] };
  }
  catch { return unavailable('Parsel kimliği okunamadı.'); }
  const access = municipalResearchAccess(identity, expected);
  if (access) {
    if (raw.status !== access.status || !Array.isArray(raw.plans) || raw.plans.length || raw.source !== access.source) return unavailable('Seçili parselin yetkili kaynak eşleşmesi doğrulanamadı.');
    // Recreate locally from the allowlist: remote text cannot invent a municipal URL or right.
    return access;
  }
  if (!['research-only', 'not-found'].includes(String(raw.status)) || !Array.isArray(raw.plans)) return unavailable('Kaynak yanıtı okunamadı.');
  const source = text(raw.source, 500);
  const province = normalizeZoningPlace(identity.province);
  const allowedSource = province === 'istanbul' ? MUNICIPAL_RESEARCH_SOURCES.istanbul : null;
  const observedAt = text(raw.observedAt, 40), observed = Date.parse(observedAt);
  if (source !== allowedSource || !Number.isFinite(observed) || observed > now + 60_000 || now - observed > 5 * 60_000) return unavailable('Kaynak veya sorgu zamanı doğrulanamadı; yeniden sorgulayın.');
  if (raw.plans.some(plan => { const candidate = object(plan); return !candidate || !text(candidate.id) && !text(candidate.name); }) || raw.status === 'not-found' && raw.plans.length > 0) return unavailable('Kaynak plan listesi geçersiz.');
  const plans = raw.plans.slice(0, 15).map((item): MunicipalPlanCandidate => {
    const plan = object(item)!;
    const conditions = object(plan.rawConditions);
    return {
      id: text(plan.id, 40), name: text(plan.name, 500), scale: text(plan.scale, 100), date: text(plan.date, 100), decision: text(plan.decision, 200),
      district: text(plan.district, 100), block: text(plan.block, 100), parcel: text(plan.parcel, 100), note: text(plan.note),
      qualityIssues: Array.isArray(plan.qualityIssues) ? plan.qualityIssues.filter(issue => typeof issue === 'string').slice(0, 10).map(issue => text(issue)) : [],
      ...(conditions ? { rawConditions: { taks: number(conditions.taks), far: number(conditions.far), floors: number(conditions.floors), height: number(conditions.height) } } : {}),
    };
  });
  return {
    ...municipalResearchState(plans.length ? 'research-only' : 'not-found', expected),
    source, observedAt, authority: text(raw.authority, 250), partial: raw.partial === true || raw.plans.length > 15,
    limitation: text(raw.limitation, 1000), plans,
  };
}

/** Small, memory-only cache: exact project/revision/parcel/geometry scope, never legal entitlement. */
export function createMunicipalResearchClient(fetcher: typeof fetch = (...args) => fetch(...args), now: () => number = Date.now) {
  const cache = new Map<string, { expires: number; result: MunicipalResearchResult }>();
  return async function query(identity: ParcelIdentity, points: GeoPoint[], scope: MunicipalResearchScope, signal: AbortSignal, refresh = false) {
    const key = municipalResearchKey(scope);
    signal.throwIfAborted();
    if (!sameMunicipalResearchScope(createMunicipalResearchScope(identity, points, scope.projectId, scope.projectRevision, scope.sourceRevision), scope)) throw new Error('Invalid research scope');
    if (refresh) cache.delete(key);
    const cached = cache.get(key);
    if (cached && cached.expires > now()) return structuredClone(cached.result);
    cache.delete(key);
    const response = await fetcher('/api/parcel-plan-research', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, cache: 'no-store',
      body: JSON.stringify({ province: identity.province, identity, points, scope }), signal,
    });
    const raw = await readBoundedJson(response, 120_000);
    signal.throwIfAborted();
    if (response.status === 403 && object(raw)?.demo === true) return municipalResearchState('demo-disabled', scope, 'Demo modunda otomatik imar sorgusu kapalı. Resmî kaynağı açabilir veya belge bilgilerinizi taslak olarak girebilirsiniz.');
    const result = adaptMunicipalResearchResult(raw, scope, now());
    if (!response.ok && result.status !== 'unavailable') return municipalResearchState('unavailable', scope, 'Kaynak sorgusu tamamlanamadı.');
    if (result.status === 'research-only' || result.status === 'not-found') {
      if (cache.size >= 8) cache.delete(cache.keys().next().value!);
      cache.set(key, { expires: now() + 120_000, result: structuredClone(result) });
    }
    return result;
  };
}

/** Commit-time key check also covers eligibility changes before passive effect cleanup. */
export function canCommitMunicipalResearch(cancelled: boolean, activeKey: string | null, requestKey: string, scope: MunicipalResearchScope, result: MunicipalResearchResult) {
  return !cancelled && activeKey === requestKey && sameMunicipalResearchScope(result.scope, scope);
}
