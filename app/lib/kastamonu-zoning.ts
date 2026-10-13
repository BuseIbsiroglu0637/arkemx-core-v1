import { pointInPolygon, polygonEdgesCross, polygonSelfIntersects, type GeoPoint } from './geo.ts';
export const KASTAMONU_IMAR_ROOT = 'https://e-imar.kastamonuozelidare.gov.tr/arcgis/rest/services/IDARE_PUBLIC/IMAR_PUBLIC/FeatureServer';
const TKGM = 'https://cbsapi.tkgm.gov.tr/megsiswebapi.v3.1/api';
const record = (v: unknown): Record<string, unknown> => v && typeof v === 'object' ? v as Record<string, unknown> : {};
const text = (v: unknown) => typeof v === 'string' ? v.trim().slice(0,500) : '';
const name = (v: unknown) => text(v).toLocaleLowerCase('tr-TR').replace(/\s+/g,' ');
export type ZoningParcelInput = { province:string; district:string; neighborhood:string; neighborhoodId:string; block:string; parcelNo:string };
export class ZoningQueryError extends Error {
  code: string;
  constructor(code:string,message:string) { super(message); this.code=code; }
}
// Return only known transport categories; upstream messages may contain internal addresses.
export function officialConnectionFailure(error:unknown, signal?:AbortSignal):string {
  if (signal?.aborted || ['TimeoutError','AbortError'].includes(String(record(error).name))) return 'zaman aşımı veya iptal';
  let cause:unknown=error;
  for(let depth=0;depth<4 && cause;depth++) {
    const code=String(record(cause).code || '');
    if(['ENOTFOUND','EAI_AGAIN'].includes(code)) return 'DNS çözümleme hatası';
    if(['UND_ERR_CONNECT_TIMEOUT','ETIMEDOUT'].includes(code)) return 'bağlantı zaman aşımı';
    if(['ECONNREFUSED','ECONNRESET','ENETUNREACH','EHOSTUNREACH'].includes(code)) return 'bağlantı kurulamadı veya kesildi';
    if(['CERT_HAS_EXPIRED','UNABLE_TO_VERIFY_LEAF_SIGNATURE','DEPTH_ZERO_SELF_SIGNED_CERT','ERR_TLS_CERT_ALTNAME_INVALID','SELF_SIGNED_CERT_IN_CHAIN'].includes(code)) return 'TLS sertifikası doğrulanamadı';
    if (record(cause).message==='unexpected redirect') return 'kaynak başka adrese yönlendiriyor';
    cause=record(cause).cause;
  }
  return 'ağ isteği başarısız';
}
export function parseZoningParcelInput(raw: unknown): ZoningParcelInput | null {
  const v=record(raw);
  if (!['province','district','neighborhood'].every(k=>typeof v[k]==='string' && /^[\p{L}\p{N} .'-]{2,80}$/u.test(String(v[k])) && /\p{L}/u.test(String(v[k])))) return null;
  if (!['neighborhoodId','block','parcelNo'].every(k=>typeof v[k]==='string' && /^\d{1,10}$/.test(String(v[k])) && Number(v[k])>0)) return null;
  return {province:text(v.province),district:text(v.district),neighborhood:text(v.neighborhood),neighborhoodId:String(v.neighborhoodId),block:String(v.block),parcelNo:String(v.parcelNo)};
}
function ring(raw:unknown): GeoPoint[] {
  if (!Array.isArray(raw) || raw.length<4 || raw.length>4000) throw new ZoningQueryError('geometry-unsupported','İmar eşleştirmesi için geçerli tek parça sınır gerekli.');
  const points=raw.map(p=> {
    if (!Array.isArray(p) || typeof p[0]!=='number' || typeof p[1]!=='number' || !Number.isFinite(p[0]) || !Number.isFinite(p[1]) || p[0]<25 || p[0]>46 || p[1]<35 || p[1]>43) throw new ZoningQueryError('geometry-unsupported','Kaynak sınır koordinatları doğrulanamadı.');
    return {lng:p[0],lat:p[1]};
  });
  if (points[0].lat!==points.at(-1)!.lat || points[0].lng!==points.at(-1)!.lng) throw new ZoningQueryError('geometry-unsupported','Kaynak sınır halkası kapalı değil.');
  points.pop();
  if (points.length<3 || polygonSelfIntersects(points)) throw new ZoningQueryError('geometry-unsupported','Kaynak sınırı geçerli bir poligon değil.');
  return points;
}
export type OfficialZoningResult = {
  schema:'ARKEM-OFFICIAL-ZONING/1.0'; status:'found'|'not-found'|'ambiguous'|'unsupported'; message:string;
  identity:ZoningParcelInput; retrievedAt:string;
  conditions?: {taks:number|null;kaks:number|null;hmax:number|null;frontSetback:number|null;sideSetback:number|null;buildingOrder:string;landUse:string};
  source?: {url:string;authority:string;planId:string;planName:string;planScale:string;approvalDate:string;planStatus:string;featureId:number};
};
export async function queryKastamonuZoning(raw:unknown, fetcher:typeof fetch=fetch, signal?:AbortSignal):Promise<OfficialZoningResult> {
  const input=parseZoningParcelInput(raw);
  if (!input) throw new ZoningQueryError('invalid-input','İl, ilçe, mahalle/köy, resmî mahalle kodu ve ada/parsel gerekli.');
  const base={schema:'ARKEM-OFFICIAL-ZONING/1.0' as const,identity:input,retrievedAt:new Date().toISOString()};
  if (input.province!=='Kastamonu') return {...base,status:'unsupported',message:'Bu sürümde yalnız Kastamonu İl Özel İdaresi konut alanı bağlantısı etkin.'};
  const timeout=AbortSignal.timeout(25000);
  const combined=signal ? AbortSignal.any([signal,timeout]) : timeout;
  async function json(url:string,stage:string) {
    let response:Response;
    try { response=await fetcher(url,{headers:{Accept:'application/json'},redirect:'error',signal:combined,cache:'no-store'}); }
    catch(error) { throw new ZoningQueryError('unavailable',`${stage}: ${officialConnectionFailure(error,combined)}; değerler değiştirilmedi.`); }
    if ([401,403,429].includes(response.status)) throw new ZoningQueryError('access-restricted',`${stage}: HTTP ${response.status}; kaynak erişimi veya sorgu sıklığı sınırladı.`);
    if (!response.ok) throw new ZoningQueryError('unavailable',`${stage}: HTTP ${response.status}; kaynak sorguyu tamamlayamadı.`);
    const reader=response.body?.getReader(); if (!reader) throw new ZoningQueryError('layout-changed','Kaynak yanıtı boş.');
    let size=0; const chunks:Uint8Array[]=[];
    try { while(true) { const {done,value}=await reader.read(); if(done)break; size+=value.length; if(size>1_000_000) {await reader.cancel(); throw new ZoningQueryError('layout-changed','Kaynak yanıtı izin verilen boyutu aştı.');} chunks.push(value); } }
    catch(error) {
      if(error instanceof ZoningQueryError) throw error;
      throw new ZoningQueryError('unavailable',`${stage}: ${officialConnectionFailure(error,combined)}; kaynak yanıtı tamamlanamadı.`);
    }
    finally {reader.releaseLock();}
    const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
    let data:Record<string,unknown>;
    try {data=record(JSON.parse(new TextDecoder().decode(bytes)));} catch {throw new ZoningQueryError('layout-changed','Kaynak JSON verisi okunamadı.');}
    if(data.error)throw new ZoningQueryError('source-error','Resmî servis sorguyu reddetti; imar değerleri alınamadı.');
    return data;
  }
  function features(data:Record<string,unknown>) {
    if (!Array.isArray(data.features) || data.exceededTransferLimit) throw new ZoningQueryError('layout-changed','Kaynak kayıtları eksik veya şeması değişmiş.');
    return data.features.map(record);
  }
  // Re-read the cadastral geometry server-side. Browser coordinates never select zoning rights.
  const cadastral=await json(`${TKGM}/parsel/${input.neighborhoodId}/${input.block}/${input.parcelNo}`,'TKGM parsel servisi');
  const feature=cadastral.type==='FeatureCollection' ? features(cadastral) : [cadastral];
  if(feature.length!==1)throw new ZoningQueryError('parcel-mismatch','Tek bir kadastro parseli doğrulanamadı.');
  const props=record(feature[0].properties), geom=record(feature[0].geometry);
  if (name(props.ilAd)!==name(input.province) || name(props.ilceAd)!==name(input.district) || name(props.mahalleAd)!==name(input.neighborhood)) throw new ZoningQueryError('parcel-mismatch','TKGM konumu seçilen parsel ile eşleşmedi.');
  for (const [key,expected] of [['adaNo',input.block],['parselNo',input.parcelNo]]) if(props[key]!==undefined && String(props[key])!==expected) throw new ZoningQueryError('parcel-mismatch','TKGM ada/parsel kaydı eşleşmedi.');
  if (geom.type!=='Polygon' || !Array.isArray(geom.coordinates) || geom.coordinates.length!==1) throw new ZoningQueryError('geometry-unsupported','Çok parçalı veya delikli kadastro sınırı otomatik imar aktarımına uygun değil.');
  const parcel=ring(geom.coordinates[0]);
  const geometry=JSON.stringify({rings:[geom.coordinates[0]],spatialReference:{wkid:4326}});
  const params=new URLSearchParams({f:'json',where:'1=1',geometry,geometryType:'esriGeometryPolygon',inSR:'4326',spatialRel:'esriSpatialRelIntersects',outFields:'objectid,planid,taks,takstip,emsalkaks,emsalkakstip,yapiyuksekligi,yapiyuksekligitip,onbahcemesafesi,yanbahcemesafesi,yapiduzeni,konuttip',returnGeometry:'true',outSR:'4326',resultRecordCount:'20'});
  // 1826 belongs to Uygulama İmar Planları. 1942 is Mülga and is never queried.
  const zoneData=await json(`${KASTAMONU_IMAR_ROOT}/1826/query?${params}`,'Kastamonu e-İmar konut alanı servisi');
  const zones=features(zoneData);
  if(!zones.length) return {...base,status:'not-found',message:'Bu parsel için kaynakta konut imar kaydı bulunamadı. Bu sonuç parselin imarsız olduğu anlamına gelmez.'};
  if(zones.length!==1) return {...base,status:'ambiguous',message:'Parsel birden fazla imar alanıyla kesişiyor; tek değer otomatik aktarılmadı.'};
  const zone=record(zones[0].attributes), boundary=record(zones[0].geometry);
  if(!Array.isArray(boundary.rings)||boundary.rings.length!==1 || (record(zoneData.spatialReference).wkid ?? record(boundary.spatialReference).wkid)!==4326) throw new ZoningQueryError('geometry-unsupported','İmar sınırı WGS84 tek parça poligon olarak doğrulanamadı.');
  const polygon=ring(boundary.rings[0]);
  if (!parcel.every(p=>pointInPolygon(p,polygon)) || polygonEdgesCross(polygon,parcel)) return {...base,status:'ambiguous',message:'İmar alanı parsel sınırının tamamını kapsamıyor; koşullar otomatik aktarılmadı.'};
  if(!Number.isSafeInteger(zone.planid) || Number(zone.planid)<=0 || !Number.isSafeInteger(zone.objectid)) throw new ZoningQueryError('layout-changed','İmar kaydının plan kimliği doğrulanamadı.');
  const planParams=new URLSearchParams({f:'json',where:`planid=${zone.planid}`,outFields:'planid,planadi,pinid,planturid,planolcegi,plandurumu,planonaytarihi',returnGeometry:'false',resultRecordCount:'2'});
  const plans=features(await json(`${KASTAMONU_IMAR_ROOT}/1967/query?${planParams}`,'Kastamonu e-İmar plan servisi'));
  const plan=record(plans[0]?.attributes);
  if(plans.length!==1 || plan.planid!==zone.planid || plan.planturid!==1 || plan.planolcegi!=='1/1000' || plan.plandurumu!=='Onaylandi' || typeof plan.planonaytarihi!=='number' || !Number.isFinite(plan.planonaytarihi) || plan.planonaytarihi<=0 || plan.planonaytarihi>Date.now()) return {...base,status:'ambiguous',message:'Planın onay, ölçek veya kimlik bilgisi doğrulanamadı; imar formu değiştirilmedi.'};
  const numeric=(value:unknown,max:number) => typeof value==='number' && Number.isFinite(value) && value>=0 && value<=max ? value : null;
  return {...base,status:'found',message:'Resmî servis kaydı okundu; plan notu ve yetkili idare doğrulaması bekliyor.',
    conditions:{taks:zone.takstip==='Deger'?numeric(zone.taks,1):null,kaks:zone.emsalkakstip==='Deger'?numeric(zone.emsalkaks,10):null,hmax:zone.yapiyuksekligitip==='Deger'?numeric(zone.yapiyuksekligi,250):null,frontSetback:numeric(zone.onbahcemesafesi,100),sideSetback:numeric(zone.yanbahcemesafesi,100),buildingOrder:({Ayrik:'Ayrık',Bitisik:'Bitişik',Blok:'Blok'} as Record<string,string>)[text(zone.yapiduzeni)] || '',landUse:'Konut Alanı'},
    source:{url:`${KASTAMONU_IMAR_ROOT}/1826`,authority:'Kastamonu İl Özel İdaresi',planId:text(plan.pinid)||String(zone.planid),planName:text(plan.planadi),planScale:'1/1000 Uygulama İmar Planı',approvalDate:new Date(plan.planonaytarihi as number).toISOString().slice(0,10),planStatus:'Onaylandi',featureId:zone.objectid as number}};
}
