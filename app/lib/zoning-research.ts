import type { OfficialZoningResult, ZoningParcelInput } from './kastamonu-zoning.ts';
import type { ZoningForm } from './zoning.ts';

export type ResearchSource = {
  id: string; label: string; url: string; authority: string; purpose: string;
  method: 'service' | 'viewer' | 'login' | 'documents';
  limitation: string; catalogCheckedAt: string;
};
const source = (item: Omit<ResearchSource, 'catalogCheckedAt'>): ResearchSource => ({ ...item, catalogCheckedAt: '2026-10-12' });
const common: ResearchSource[] = [
  source({ id: 'tkgm', label: 'TKGM Parsel Sorgu', url: 'https://parselsorgu.tkgm.gov.tr/', authority: 'Tapu ve Kadastro Genel Müdürlüğü', method: 'viewer', purpose: 'Parsel kimliği ve kadastro sınırı', limitation: 'Kadastro kaydı TAKS, emsal veya yapılaşma hakkı belirlemez.' }),
  source({ id: 'eplan', label: 'e-Plan', url: 'https://eplan.csb.gov.tr/', authority: 'Çevre, Şehircilik ve İklim Değişikliği Bakanlığı', method: 'viewer', purpose: 'Yürürlükteki / askıdaki plan, PIN ve plan notları', limitation: 'Askıdaki plan ile yürürlükteki plan ayrılmalı; ilgili 1/1000 plan ve değişiklikleri incelenmelidir.' }),
];
const kastamonu: ResearchSource[] = [
  source({ id: 'kastamonu-ioi', label: 'Kastamonu İl Özel İdaresi e-İmar', url: 'https://e-imar.kastamonuozelidare.gov.tr/arcgis/rest/services/IDARE_PUBLIC/IMAR_PUBLIC/FeatureServer/1826', authority: 'Kastamonu İl Özel İdaresi', method: 'service', purpose: 'Konut alanı koşulları ve bağlı 1/1000 plan kaydı', limitation: 'Otomatik okuma yalnız konut katmanını kapsar. Belediye yetki alanı, köy yerleşik alanı ve diğer kullanımlar için tam kapsam sağlanmaz.' }),
  source({ id: 'kastamonu-belediye', label: 'Kastamonu Belediyesi e-İmar', url: 'https://www.turkiye.gov.tr/kastamonu-belediyesi-eimar-8914', authority: 'Kastamonu Belediyesi / e-Devlet', method: 'login', purpose: 'Belediye yetki alanındaki parselin imar durumu', limitation: 'e-Devlet kimlik doğrulaması gerekir; İl Özel İdaresi sonucu bu hizmetin yerine geçmez.' }),
  source({ id: 'kastamonu-plan-notlari', label: 'Kastamonu imar komisyon kararları', url: 'https://www.kastamonu.bel.tr/kurumsal/meclis-kararlari/imar-komisyon-kararlari/', authority: 'Kastamonu Belediyesi', method: 'documents', purpose: 'Plan değişikliği ve karar dayanaklarını araştırma', limitation: 'Karar başlığı tek başına parsel için güncel yapılaşma koşulu sayılmaz; yürürlük ve parsel kapsamı kontrol edilmelidir.' }),
  source({ id: 'kastamonu-belge', label: 'İl Özel İdaresi imar belge başvurusu', url: 'https://www.kastamonuozelidare.gov.tr/formlar', authority: 'Kastamonu İl Özel İdaresi', method: 'documents', purpose: 'İmar durumu belgesi için gerekli evraklar', limitation: 'Veri alınamayan parselde yetkili birimden yazılı durum ve plan notu istenir. Bu bağlantı başvuru göndermez.' }),
];
const sakarya: ResearchSource[] = [
  source({ id: 'sakarya-plan', label: 'Sakarya Büyükşehir İmar Haritası', url: 'https://rehber.sakarya.bel.tr/harita/imar', authority: 'Sakarya Büyükşehir Belediyesi', method: 'viewer', purpose: 'Uygulama, nazım ve çevre düzeni plan katmanları', limitation: 'Harita araştırma içindir; parselin koşulları ve plan notları ilgili ilçe belediyesiyle karşılaştırılır. Otomatik koşul aktarımı bağlı değil.' }),
  source({ id: 'adapazari', label: 'Adapazarı İmar Durum Bilgisi', url: 'https://www.turkiye.gov.tr/adapazari-belediyesi-imar-durum-sorgulama', authority: 'Adapazarı Belediyesi / e-Devlet', method: 'viewer', purpose: 'Mahalle ve ada/parsel ile imar durumu ve plan notu', limitation: 'Sorgu resmî formda tamamlanır; ARKEMX bu formun sonucunu henüz otomatik okuyamaz.' }),
  source({ id: 'serdivan', label: 'Serdivan İmar Durumu', url: 'https://keos.serdivan.bel.tr/imardurumu/', authority: 'Serdivan Belediyesi', method: 'viewer', purpose: 'Tapu mahallesi ve tam ada/parsel eşleşmesi', limitation: 'Benzer parsel araması sonucu doğrudan kullanılamaz; tam kimlik eşleşmesi gerekir. Otomatik aktarım bağlı değil.' }),
  source({ id: 'sapanca', label: 'Sapanca İmar Durum Bilgisi', url: 'https://www.turkiye.gov.tr/sapanca-belediyesi-imar-durum-sorgulama', authority: 'Sapanca Belediyesi / e-Devlet', method: 'viewer', purpose: 'Mahalle ve ada/parsel ile imar durumu', limitation: 'Sorgu resmî formda tamamlanır; ARKEMX bu formun sonucunu henüz otomatik okuyamaz.' }),
  source({ id: 'sakarya-duyuru', label: 'Sakarya plan duyuruları', url: 'https://sakarya.bel.tr/tr/Haberler-Kategori/81/1', authority: 'Sakarya Büyükşehir Belediyesi', method: 'documents', purpose: 'Yeni planlar, değişiklikler ve askı duyuruları', limitation: 'Duyuru tarihi onay veya kesinleşme tarihi değildir. Plan notu ve yürürlük durumu ayrıca kontrol edilir.' }),
];
export function zoningResearchSources(province: string, district = ''): ResearchSource[] {
  const p = province.trim().toLocaleLowerCase('tr-TR'), d = district.trim().toLocaleLowerCase('tr-TR').replace(/ı/g,'i');
  const local = p === 'kastamonu' ? kastamonu : p === 'sakarya' ? sakarya.filter(s => !['adapazari','serdivan','sapanca'].includes(s.id) || !d || s.id === d) : [];
  return [...local, ...common];
}
export const ALL_RESEARCH_SOURCES = [...kastamonu, ...sakarya, ...common];
export const ZONING_FIELDS = [
  ['landUse','Kullanım kararı'], ['buildingOrder','Yapı nizamı'], ['taks','TAKS'], ['kaks','KAKS / emsal'], ['hmax','Yençok / Hmax (m)'], ['frontSetback','Ön çekme (m)'], ['sideSetback','Yan çekme (m)'], ['rearSetback','Arka çekme (m)'],
] as const;
export function zoningIdentityMatches(a: ZoningParcelInput, b: ZoningParcelInput) {
  return (['province','district','neighborhood','neighborhoodId','block','parcelNo'] as const).every(k => a[k] === b[k]);
}
export function assessZoningResearch(identity: ZoningParcelInput, result: OfficialZoningResult | null, form: ZoningForm, now = Date.now()) {
  const age = result ? now - Date.parse(result.retrievedAt) : NaN;
  const matching = !!result && result.schema === 'ARKEM-OFFICIAL-ZONING/1.0' && !!result.identity && zoningIdentityMatches(identity, result.identity);
  const fresh = matching && Number.isFinite(age) && age >= 0 && age < 86400000;
  const supported = fresh && result?.status === 'found' && result.source?.url === kastamonu[0].url && identity.province === 'Kastamonu'
    && result.source.planStatus === 'Onaylandi' && !!result.source.planId && result.source.planScale === '1/1000 Uygulama İmar Planı'
    && Number.isFinite(Date.parse(result.source.approvalDate)) && Date.parse(result.source.approvalDate) <= now;
  const fields = ZONING_FIELDS.map(([key,label]) => {
    const candidate = supported && result?.conditions && key !== 'rearSetback' ? result.conditions[key] : null;
    const max = key === 'taks' ? 1 : key === 'kaks' ? 10 : key === 'hmax' ? 250 : 100;
    const value = typeof candidate === 'number' ? Number.isFinite(candidate) && candidate >= 0 && candidate <= max ? candidate : null : typeof candidate === 'string' && candidate.trim() ? candidate : null;
    const current = form[key];
    const entered = typeof current === 'number' ? Number.isFinite(current) && current >= 0 : !!current.trim();
    const normalized = (v: string) => v.trim().toLocaleLowerCase('tr-TR').replace(key === 'buildingOrder' ? /\s+nizam$/ : /$^/,'');
    const equal = typeof value === 'number' && typeof current === 'number' ? Math.abs(value - current) < 0.000001 : typeof value === 'string' && typeof current === 'string' && normalized(value) === normalized(current);
    return { key, label, value, current: entered ? current : null, status: value === null ? 'missing' : entered && !equal ? 'conflict' : 'source-read' };
  });
  return { matching, fresh, fields, conflicts: fields.filter(f => f.status === 'conflict').length, available: fields.filter(f => f.value !== null).length, authoritative: false as const };
}
