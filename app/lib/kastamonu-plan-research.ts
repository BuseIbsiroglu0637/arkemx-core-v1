import { readBoundedJson } from './bounded-json.ts';
import type { GeoPoint } from './geo.ts';
export const KASTAMONU_LAYER = 'https://e-imar.kastamonuozelidare.gov.tr/arcgis/rest/services/IDARE_PUBLIC/IMAR_PUBLIC/FeatureServer/1826';
const value = (x: unknown) => typeof x === 'number' && Number.isFinite(x) ? x : typeof x === 'string' && x.trim() && Number.isFinite(Number(x)) ? Number(x) : null;
export async function researchKastamonu(points: GeoPoint[], signal: AbortSignal) {
  const ring = points.map(p => [p.lng, p.lat]); ring.push(ring[0]);
  const query = new URLSearchParams({ f: 'json', geometry: JSON.stringify({rings:[ring], spatialReference:{wkid:4326}}), geometryType:'esriGeometryPolygon', inSR:'4326', spatialRel:'esriSpatialRelIntersects', outFields:'objectid,planid,emsalkaks,taks,katadedi,yapiyuksekligi,onbahcemesafesi,yanbahcemesafesi', returnGeometry:'false', resultRecordCount:'15' });
  // Workerd supports manual redirects; reject non-success responses without following them.
  const response = await fetch(`${KASTAMONU_LAYER}/query?${query}`, {signal, redirect:'manual', headers:{Accept:'application/json'}, credentials:'omit'});
  if (!response.ok) { await response.body?.cancel(); throw new Error('upstream'); }
  const data = await readBoundedJson(response) as {error?:unknown;features?:{attributes?:Record<string,unknown>}[];exceededTransferLimit?:boolean};
  if (data.error || !Array.isArray(data.features)) throw new Error('invalid');
  return {status:'research-only', source:KASTAMONU_LAYER, authority:'Kastamonu İl Özel İdaresi · konut plan katmanı', observedAt:new Date().toISOString(), authoritative:false, entitlementAvailable:false, partial:true,
    limitation:'Yalnız İl Özel İdaresinin bu konut katmanı araştırılır; belediye yetki alanlarının tamamı, diğer kullanımlar ve yürürlükteki plan notları doğrulanmaz.',
    plans:data.features.slice(0,15).map(f => {
      const a=f.attributes??{}, taks=value(a.taks), far=value(a.emsalkaks);
      const issues=['Planın yürürlük durumu, parselin tamamını kapsaması ve plan notları incelenmedi.'];
      if (taks===null || taks<=0 || taks>1) issues.push('TAKS boş/geçersiz; hesapta kullanılamaz.');
      if (far===null || far<=0 || far>10) issues.push('Emsal boş/geçersiz; hesapta kullanılamaz.');
      return {id:String(a.objectid??'').slice(0,40),name:`Konut plan adayı · Plan ${String(a.planid??'—').slice(0,40)}`,scale:'Kaynakta doğrulanmadı',date:'',decision:'',qualityIssues:issues,rawConditions:{taks,far,floors:value(a.katadedi),height:value(a.yapiyuksekligi)}};
    })};
}
