import {LOCATION_DIRECTORY_PROVINCES, LOCATION_DIRECTORY_SOURCE} from '../data/location-directory-source.ts';

/** Deliberately namespaced: these selection IDs must never be sent to TKGM. */
export type LocationDirectoryOption = {
  id:string; label:string; sourceName:string;
  kind:'district'|'neighborhood'|'village'; ambiguous:boolean;
};
type DistrictRow = [id:number, provinceId:number, name:string];
type SettlementRow = [id:number, provinceId:number, districtId:number, kind:'n'|'v', name:string];
type ProvinceShard = {
  schemaVersion:1; datasetVersion:'2025'; province:{id:number;name:string};
  districts:DistrictRow[]; settlements:SettlementRow[];
};
type ProvinceIndex = typeof LOCATION_DIRECTORY_PROVINCES[number];
const MAX_BYTES = 2 * 1024 * 1024;
const successfulShards = new Map<number,ProvinceShard>();
const collator = new Intl.Collator('tr-TR');
const normalizeName = (name:string) => name.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('tr-TR').replaceAll('ı','i').trim().replace(/\s+/g,' ');
const record = (value:unknown):value is Record<string,unknown> => value !== null && typeof value === 'object' && !Array.isArray(value);
const positiveInt = (value:unknown):value is number => Number.isSafeInteger(value) && Number(value)>0;
const validName = (value:unknown):value is string => typeof value === 'string' && value.trim() === value && value.length > 0 && value.length <= 140 && !/[\u0000-\u001f\u007f]/u.test(value);
const invalid = () => new Error('Konum dizini doğrulanamadı. Lütfen yeniden deneyin.');

/** Display suffixes are not source names; duplicate names need a verified cadastral crosswalk. */
export function locationDirectoryLookupName(option:LocationDirectoryOption|undefined,level:'district'|'neighborhood'):string {
  if (!option || !validName(option.sourceName) || (level==='district' ? option.kind!=='district' : !['neighborhood','village'].includes(option.kind))) {
    throw new Error('Konum seçiminizi güncel listeden yeniden seçin.');
  }
  if (option.ambiguous) throw new Error('Seçtiğiniz konumun bağlı olduğu bölgede aynı adlı birden fazla kayıt var. Sınır seçilmedi; resmî kadastro kimliğiyle eşleştirme gerekiyor.');
  return option.sourceName;
}

function validateShard(value:unknown, province:ProvinceIndex):ProvinceShard {
  if (!record(value) || value.schemaVersion !== 1 || value.datasetVersion !== LOCATION_DIRECTORY_SOURCE.datasetVersion || !record(value.province) || value.province.id !== province.id || value.province.name !== province.name || !Array.isArray(value.districts) || !Array.isArray(value.settlements) || value.districts.length !== province.districtCount || value.settlements.length !== province.settlementCount) throw invalid();
  const districtIds = new Set<number>();
  for (const row of value.districts) {
    if (!Array.isArray(row) || row.length !== 3 || !positiveInt(row[0]) || row[1] !== province.id || !validName(row[2]) || districtIds.has(row[0])) throw invalid();
    districtIds.add(row[0]);
  }
  const settlementIds = new Set<string>();
  for (const row of value.settlements) {
    if (!Array.isArray(row) || row.length !== 5 || !positiveInt(row[0]) || row[1] !== province.id || !positiveInt(row[2]) || !districtIds.has(row[2]) || (row[3] !== 'n' && row[3] !== 'v') || !validName(row[4])) throw invalid();
    const key = `${row[3]}-${row[0]}`;
    if (settlementIds.has(key)) throw invalid();
    settlementIds.add(key);
  }
  return value as ProvinceShard;
}

async function readBoundedResponse(response:Response, signal:AbortSignal):Promise<unknown> {
  const length = Number(response.headers.get('content-length'));
  if (length > MAX_BYTES || !response.body) {await response.body?.cancel();throw invalid();}
  const reader = response.body.getReader();
  const abort = () => {void reader.cancel(signal.reason).catch(()=>{});};
  signal.addEventListener('abort',abort,{once:true});
  const chunks:Uint8Array[] = [];
  let bytes=0;
  try {
    while (true) {
      signal.throwIfAborted();
      const {done,value} = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes>MAX_BYTES) {await reader.cancel();throw invalid();}
      chunks.push(value);
    }
  } finally {signal.removeEventListener('abort',abort);reader.releaseLock();}
  signal.throwIfAborted();
  const result = new Uint8Array(bytes);
  let offset=0;
  for (const chunk of chunks) {result.set(chunk,offset);offset+=chunk.byteLength;}
  try {return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(result));}
  catch {throw invalid();}
}

async function loadProvince(province:ProvinceIndex,signal?:AbortSignal):Promise<ProvinceShard> {
  signal?.throwIfAborted();
  const cached = successfulShards.get(province.id);
  if (cached) return cached;
  // The only network target is a build-pinned, same-origin static file. No API,
  // public proxy, credentials, caller-defined URL, or 403 retry is involved.
  if (!/^2025\/[1-9]\d?\.[a-f0-9]{12}\.json$/.test(province.file)) throw invalid();
  const controller = new AbortController();
  const abort = () => controller.abort(signal?.reason);
  signal?.addEventListener('abort',abort,{once:true});
  const timer = setTimeout(()=>controller.abort(new DOMException('Konum dizini yükleme süresi doldu.','TimeoutError')),12_000);
  try {
    const response = await fetch(`/data/location-directory/${province.file}`,{headers:{Accept:'application/json'},credentials:'omit',redirect:'error',signal:controller.signal});
    if (!response.ok) {await response.body?.cancel();throw new Error(`Konum listesi yüklenemedi (${response.status}). Lütfen yeniden deneyin.`);}
    const parsed = validateShard(await readBoundedResponse(response,controller.signal),province);
    signal?.throwIfAborted();
    controller.signal.throwIfAborted();
    successfulShards.set(province.id,parsed);
    return parsed;
  } finally {clearTimeout(timer);signal?.removeEventListener('abort',abort);}
}

export async function loadLocationDistricts(provinceName:string,signal?:AbortSignal):Promise<LocationDirectoryOption[]> {
  signal?.throwIfAborted();
  if (typeof provinceName !== 'string' || provinceName.length > 140) throw new Error('Geçerli bir il seçin.');
  const name = normalizeName(provinceName);
  const province = LOCATION_DIRECTORY_PROVINCES.find(item=>normalizeName(item.name)===name);
  if (!province) throw new Error('Seçtiğiniz il konum dizininde bulunamadı.');
  const shard = await loadProvince(province,signal);
  signal?.throwIfAborted();
  const sameName = new Map<string,number>();
  for (const [, , name] of shard.districts) {const key=normalizeName(name);sameName.set(key,(sameName.get(key)??0)+1);}
  return shard.districts.map(([id,provinceId,label]):LocationDirectoryOption=>({
    id:`directory-district-${provinceId}-${id}`,label,sourceName:label,kind:'district',ambiguous:(sameName.get(normalizeName(label))??0)>1,
  })).sort((a,b)=>collator.compare(a.label,b.label));
}

export async function loadLocationNeighborhoods(districtId:string,signal?:AbortSignal):Promise<LocationDirectoryOption[]> {
  signal?.throwIfAborted();
  const match = typeof districtId === 'string' && /^directory-district-([1-9]\d?)-([1-9]\d{0,9})$/.exec(districtId);
  if (!match) throw new Error('Geçerli bir ilçe seçin.');
  const provinceId=Number(match[1]), id=Number(match[2]);
  const province = LOCATION_DIRECTORY_PROVINCES.find(item=>item.id===provinceId);
  if (!province) throw new Error('İlçe için geçerli il bulunamadı.');
  const shard = await loadProvince(province,signal);
  if (!shard.districts.some(row=>row[0]===id && row[1]===provinceId)) throw new Error('Seçtiğiniz ilçe bu ile bağlı değil.');
  signal?.throwIfAborted();
  const rows = shard.settlements.filter(row=>row[2]===id);
  const sameName = new Map<string,number>();
  const sameKindName = new Map<string,number>();
  for (const row of rows) {
    const key=normalizeName(row[4]);
    sameName.set(key,(sameName.get(key)??0)+1);
    sameKindName.set(`${row[3]}-${key}`,(sameKindName.get(`${row[3]}-${key}`)??0)+1);
  }
  return rows.map(([settlementId,plate,district,kind,name]):LocationDirectoryOption=>{
    const key=normalizeName(name);
    const isDuplicate=(sameName.get(key)??0)>1;
    const suffix = (sameKindName.get(`${kind}-${key}`)??0)>1 ? ` (${kind==='v'?'Köy':'Mahalle'} · ${settlementId})` : isDuplicate ? ` (${kind==='v'?'Köy':'Mahalle'})` : kind==='v'?' (Köy)':'';
    return {id:`directory-${kind==='v'?'village':'neighborhood'}-${plate}-${district}-${settlementId}`,label:name+suffix,
      sourceName:name,kind:kind==='v'?'village':'neighborhood',ambiguous:isDuplicate};
  }).sort((a,b)=>collator.compare(a.label,b.label));
}
