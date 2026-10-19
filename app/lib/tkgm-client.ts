import { readBoundedJson } from './bounded-json.ts';
import { administrativeOptions, normalizeAdministrativeName, type AdministrativeOption } from './administrative-options.ts';
import { TKGM_PROVINCES } from '../data/tkgm-provinces.ts';
import { parseParcelGeoJson } from './parcel-experience.ts';

export function assertParcelResponseIdentity(properties: Record<string, unknown>, expected: { provinceId: string; districtId: string; neighborhoodId: string; block: string; parcelNo: string }) {
  const numberKey = (x: unknown) => /^\d+$/.test(String(x)) ? String(BigInt(String(x))) : null;
  for (const [field, id] of [['ilId', expected.provinceId], ['ilceId', expected.districtId], ['mahalleId', expected.neighborhoodId]] as const) {
    if (numberKey(properties[field]) !== numberKey(id) || numberKey(id) === null) throw new Error('Kaynak yanıtının idari kimliği seçtiğiniz parselle eşleşmiyor.');
  }
  // Official cadastral records without a block use blank adaNo and a query block of 0.
  const block = properties.adaNo === '' ? '0' : properties.adaNo;
  if (numberKey(block) !== numberKey(expected.block) || numberKey(properties.parselNo) !== numberKey(expected.parcelNo)) throw new Error('Kaynak yanıtının ada / parsel numarası sorguyla eşleşmiyor.');
}

const ROOT = 'https://cbsapi.tkgm.gov.tr/megsiswebapi.v3.1/api';
const allowed = /^(?:idariYapi\/(?:ilListe|ilceListe\/\d{1,12}|mahalleListe\/\d{1,12})|parsel\/\d{1,12}\/\d{1,10}\/\d{1,10})$/;
const directoryCache = new Map<string, { at: number; data: Record<string, unknown> }>();
const responseSources = new WeakMap<Record<string, unknown>, string>();

export class TkgmAccessError extends Error {
  readonly status: number;
  constructor(status: number) {
    super(`TKGM bu sorguya erişim vermedi (${status}). Resmî Parsel Sorgu ekranını açabilir veya elinizdeki sınır dosyasını görüntüleyebilirsiniz.`);
    this.name = 'TkgmAccessError';
    this.status = status;
  }
}

/** The application has one same-origin transport, as in versions 167–169.
 * The server owns the fixed public upstream contract. Never probe a browser-only
 * endpoint first or retry access denial through a different transport.
 */
export async function fetchTkgmJson(path: string, signal?: AbortSignal): Promise<Record<string, unknown>> {
  if (!allowed.test(path)) throw new Error('Geçersiz parsel sorgusu.');
  signal?.throwIfAborted();
  // TKGM's own app ships this directory as a public static asset. The similarly
  // named API method is not its public province-list contract and returns 403.
  if (path === 'idariYapi/ilListe') return TKGM_PROVINCES;
  const cached = directoryCache.get(path);
  if (cached && Date.now() - cached.at < 15 * 60_000) return cached.data;
  const url = `/api/tkgm?path=${encodeURIComponent(path)}`;
    const controller = new AbortController();
    const abort = () => controller.abort();
    signal?.addEventListener('abort', abort, { once: true });
    const timer = setTimeout(abort, 9500);
    try {
      const response = await fetch(url, { headers: { Accept: 'application/json' }, credentials: 'omit', redirect: 'error', signal: controller.signal });
      if (!response.ok) {
        // Cleanup failure must not change a terminal access denial.
        await response.body?.cancel().catch(() => undefined);
        if (response.status === 401 || response.status === 403) throw new TkgmAccessError(response.status);
        throw new Error(`Kaynak yanıtı: ${response.status}`);
      }
      const body = await readBoundedJson(response) as Record<string, unknown>;
      signal?.throwIfAborted();
      controller.signal.throwIfAborted();
      if (!body || typeof body !== 'object') throw new Error('Geçersiz kaynak yanıtı.');
      if (path.startsWith('idariYapi/')) {
        const level = path.includes('/mahalleListe/') ? 'neighborhood' : path.includes('/ilceListe/') ? 'district' : 'province';
        const options = administrativeOptions(body, level);
        if (!options.length) throw new Error('Kaynakta seçim listesi bulunamadı.');
        const data = { features: options.map(item => ({ type: 'Feature', properties: { id: item.id, text: item.label } })) };
        if (directoryCache.size > 160) directoryCache.delete(directoryCache.keys().next().value!);
        directoryCache.set(path, { at: Date.now(), data });
        return data;
      }
      const proxySource = response.headers.get('X-TKGM-Source-URL');
      const validProxySources = [ROOT, 'https://cbsapi.tkgm.gov.tr/megsiswebapi.v3/api'].map(root => `${root}/${path}`);
      responseSources.set(body, validProxySources.includes(proxySource ?? '') ? proxySource! : 'https://parselsorgu.tkgm.gov.tr/');
      return body;
    } catch (error) {
      signal?.throwIfAborted();
      if (error instanceof TkgmAccessError) throw error;
      const message = error instanceof Error ? error.message : 'Resmî kaynak şu anda yanıt vermiyor.';
      throw new Error(`TKGM bağlantısı kurulamadı. Yeniden deneyin veya resmî Parsel Sorgu ekranını açın. (${message})`);
    } finally { clearTimeout(timer); signal?.removeEventListener('abort', abort); }
}

export type TkgmParcelQuery = { province: string; district: string; neighborhood: string; block: string; parcelNo: string };

function uniqueOfficialOption(options: AdministrativeOption[], name: string, label: string) {
  const key = normalizeAdministrativeName(name);
  const matches = options.filter(option => normalizeAdministrativeName(option.label) === key);
  if (matches.length === 0) throw new Error(`${label} TKGM kaydında bulunamadı. Seçtiğiniz konumu kontrol edip yeniden sorgulayın.`);
  if (matches.length !== 1) throw new Error(`${label} için birden fazla TKGM kaydı var. Sınır seçilmedi; konumun uzman tarafından eşleştirilmesi gerekiyor.`);
  return matches[0];
}

/** Resolve names within their official parents; independent directory IDs are never cadastral IDs. */
export async function lookupTkgmParcel(query: TkgmParcelQuery, signal?: AbortSignal) {
  signal?.throwIfAborted();
  const { province, district, neighborhood } = query;
  const block = query.block.trim(), parcelNo = query.parcelNo.trim();
  if (![province, district, neighborhood].every(name => typeof name === 'string' && name.trim().length > 0 && name.length <= 120)
    || !/^\d{1,10}$/.test(block) || !/^\d{1,10}$/.test(parcelNo)) throw new Error('İl, ilçe, mahalle/köy ve geçerli ada / parsel bilgilerini tamamlayın.');
  const officialProvince = uniqueOfficialOption(administrativeOptions(await fetchTkgmJson('idariYapi/ilListe', signal)), province, 'İl');
  const officialDistrict = uniqueOfficialOption(administrativeOptions(await fetchTkgmJson(`idariYapi/ilceListe/${officialProvince.id}`, signal), 'district'), district, 'İlçe');
  const officialNeighborhood = uniqueOfficialOption(administrativeOptions(await fetchTkgmJson(`idariYapi/mahalleListe/${officialDistrict.id}`, signal), 'neighborhood'), neighborhood, 'Mahalle/köy');
  const resolvedIds = { provinceId: officialProvince.id, districtId: officialDistrict.id, neighborhoodId: officialNeighborhood.id, block, parcelNo };
  const response = await fetchTkgmJson(`parsel/${officialNeighborhood.id}/${block}/${parcelNo}`, signal);
  signal?.throwIfAborted();
  const feature = response.type === 'FeatureCollection' && Array.isArray(response.features) && response.features.length === 1 ? response.features[0] : response;
  if (!feature || typeof feature !== 'object' || feature.type !== 'Feature' || !feature.properties || typeof feature.properties !== 'object' || Array.isArray(feature.properties)) {
    throw new Error('Parsel bulunamadı veya tek parsele ait kimlik ve sınır bilgisi alınamadı.');
  }
  const properties = feature.properties as Record<string, unknown>;
  assertParcelResponseIdentity(properties, resolvedIds);
  const points = parseParcelGeoJson(response);
  return { response, properties, points, resolvedIds,
    sourceUrl: responseSources.get(response) ?? 'https://parselsorgu.tkgm.gov.tr/', capturedAt: new Date().toISOString() };
}
