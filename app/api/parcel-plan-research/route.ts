import { readBoundedJson } from '../../lib/bounded-json.ts';
import { normalizeZoningPlace } from '../../data/zoning-regions.ts';
import { createMunicipalResearchScope, sameMunicipalResearchScope, municipalResearchAccess, type MunicipalResearchScope } from '../../lib/municipal-plan-research.ts';
import type { ParcelIdentity } from '../../lib/parcel-record.ts';
const SERVICE = 'https://haritaservis.ibb.gov.tr/planask/rest/services/PlanAskiGeo/MapServer/0';
// This joined municipal layer exposes fully qualified field names, not the display aliases.
const FIELDS = { id: 'PLAN.PLAN_Aski.OBJECTID', name: 'PLAN.PLAN_Aski.PLAN_ADI', scale: 'PLAN.PLAN_Aski.PLAN_OLCEK', date: 'PLAN.PLAN_Aski.TASDIK_TARIHI', decision: 'PLAN.PLAN_Aski.MECLIS_KARAR_NO', district: 'PLAN.VIMS_PLAN_ASKI_DEVAM_EDENLER.ILCE', block: 'PLAN.VIMS_PLAN_ASKI_DEVAM_EDENLER.ADA', parcel: 'PLAN.VIMS_PLAN_ASKI_DEVAM_EDENLER.PARSEL', note: 'PLAN.VIMS_PLAN_ASKI_DEVAM_EDENLER.ASKI_ACIKLAMASI' } as const;
const text = (value: unknown, max = 300) => typeof value === 'string' ? value.slice(0, max).trim() : value === null || value === undefined ? '' : String(value).slice(0, max);
export async function POST(request: Request) {
  let scope: MunicipalResearchScope | null = null;
  const respond = (payload: Record<string, unknown>, status = 200) => Response.json({ ...payload, scope, authoritative: false, entitlementAvailable: false, parcelMatch: 'not-verified', automaticConditions: null }, { status, headers: { 'Cache-Control': 'no-store' } });
  if (Number(request.headers.get('content-length') || 0) > 50000) return respond({ status: 'unavailable', error: 'İstek çok büyük.' }, 413);
  let body: { province?: string; points?: { lat: number; lng: number }[]; identity?: ParcelIdentity; scope?: MunicipalResearchScope };
  try {
    const raw = await readBoundedJson(new Response(request.body, { headers: { 'Content-Type': 'application/json' } }), 50000);
    if (!raw || typeof raw !== 'object' || Array.isArray(raw) || typeof (raw as {province?:unknown}).province !== 'string') throw new Error('shape');
    body = raw as typeof body;
  }
  catch { return respond({ status: 'unavailable', error: 'Geçersiz istek.' }, 400); }
  const province = normalizeZoningPlace(body.province || '');
  if (body.scope !== undefined) {
    const identity = body.identity;
    if (!identity || typeof identity !== 'object' || !['province', 'district', 'neighborhood', 'block', 'parcelNo'].every(field => typeof identity[field as keyof ParcelIdentity] === 'string' && identity[field as keyof ParcelIdentity].trim().length > 0 && identity[field as keyof ParcelIdentity].length <= 160)
      || !body.scope || typeof body.scope.projectId !== 'string' || !body.scope.projectId.trim() || body.scope.projectId.length > 160
      || typeof body.scope.projectRevision !== 'string' || !body.scope.projectRevision.trim() || body.scope.projectRevision.length > 40
      || typeof body.scope.sourceRevision !== 'string' || body.scope.sourceRevision.length > 1000
      || normalizeZoningPlace(identity.province) !== province || !Array.isArray(body.points) || body.points.length < 3 || body.points.length > 400
      || body.points.some(p => !p || !Number.isFinite(p.lat) || !Number.isFinite(p.lng))) return respond({ status: 'unavailable', error: 'Parsel sorgu kapsamı geçersiz.' }, 400);
    const expected = createMunicipalResearchScope(identity, body.points, body.scope.projectId, body.scope.projectRevision, body.scope.sourceRevision);
    if (!sameMunicipalResearchScope(body.scope, expected)) return respond({ status: 'unavailable', error: 'Parsel kimliği veya sınırı sorguyla eşleşmiyor.' }, 400);
    scope = expected;
  }
  // Only a validated scoped identity may select a local municipal source.
  // Province-wide Special Administration data must not be used for municipal parcels.
  const access = municipalResearchAccess(scope && body.identity ? body.identity : { province, district: '', neighborhood: '' }, scope);
  if (access) return respond(access);
  if (province !== 'istanbul') return respond({ status: 'unsupported', message: 'Bu ilde otomatik parsel imar koşulu bağlantısı henüz doğrulanmadı.' });
  const points = body.points;
  if (!Array.isArray(points) || points.length < 3 || points.length > 400 || points.some(p => !p || !Number.isFinite(p.lat) || !Number.isFinite(p.lng) || p.lat < 40 || p.lat > 42 || p.lng < 27 || p.lng > 31)) return respond({ status:'unavailable', error: 'Geçerli İstanbul parsel sınırı gerekli.' }, 400);
  const ring = points.map(p => [p.lng, p.lat]); ring.push(ring[0]);
  const query = new URLSearchParams({ f: 'json', where: '1=1', geometry: JSON.stringify({ rings: [ring], spatialReference: { wkid: 4326 } }), geometryType: 'esriGeometryPolygon', inSR: '4326', spatialRel: 'esriSpatialRelIntersects', outFields: Object.values(FIELDS).join(','), returnGeometry: 'false', resultRecordCount: '15' });
  const controller = new AbortController(), abort = () => controller.abort();
  const timer = setTimeout(abort, 7000); request.signal.addEventListener('abort', abort, { once: true });
  if (request.signal.aborted) controller.abort();
  try {
    // Workerd does not implement redirect:error; manual still rejects all 3xx below.
    const response = await fetch(`${SERVICE}/query`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' }, body: query, cache: 'no-store', redirect: 'manual', signal: controller.signal });
    if (!response.ok) { await response.body?.cancel(); throw new Error('upstream'); }
    const data = await readBoundedJson(response) as { error?: unknown; features?: { attributes?: Record<string, unknown> }[]; exceededTransferLimit?: boolean };
    if (data.error || !Array.isArray(data.features)) throw new Error('shape');
    return respond({ status: data.features.length ? 'research-only' : 'not-found', source: SERVICE, authority: 'İstanbul Büyükşehir Belediyesi · askı planları', observedAt: new Date().toISOString(), limitation: 'Yalnız askı planı katmanı araştırıldı; yürürlükteki tüm planlar ve parselin uygulama imar koşulları bu sorguyla belirlenemez. Boş sonuç, imar yok demek değildir.', partial: true, plans: data.features.slice(0, 15).map(feature => { const a = feature?.attributes ?? {}; const date = a[FIELDS.date]; return { id: text(a[FIELDS.id], 40), name: text(a[FIELDS.name], 500), scale: text(a[FIELDS.scale]), date: typeof date === 'number' && Number.isFinite(date) && Math.abs(date) < 8640000000000000 ? new Date(date).toISOString().slice(0, 10) : text(date), decision: text(a[FIELDS.decision]), district: text(a[FIELDS.district]), block: text(a[FIELDS.block]), parcel: text(a[FIELDS.parcel]), note: text(a[FIELDS.note], 600) }; }) });
  } catch { return respond({ status: 'unavailable', message: 'Belediye plan kaynağından bu sorguda sonuç alınamadı.' }, 503); }
  finally { clearTimeout(timer); request.signal.removeEventListener('abort', abort); }
}
