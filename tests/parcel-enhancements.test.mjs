import test from 'node:test';
import assert from 'node:assert/strict';
import { administrativeOptions } from '../app/lib/administrative-options.ts';
import { webMercatorPoint } from '../app/lib/parcel-basemaps.ts';
import { calculateAreaBudget, positiveArea, restoreAreaBudgetInput } from '../app/lib/parcel-area-budget.ts';
import { createZoningMassingModel } from '../app/lib/zoning-massing.ts';
import { readFileSync } from 'node:fs';
import { POST } from '../app/api/parcel-plan-research/route.ts';
const basic = { netPlotArea: '1000', netAreaBasis: 'Net imar alanı belgesi', far: '1.2', sourceReference: 'Örnek girdi / plan', sourceDate: '2026-10-07', entries: [] };
const row = (id, area, category, countsInConstruction='yes') => ({ id, name: 'Kat / '+id, area, category, countsInConstruction, basis: 'Belge sayfa / ölçüm dayanağı' });
test('canonical child IDs take precedence over parent administrative fields',()=>{
  assert.equal(administrativeOptions([{ ilId:76, ilAd:'Sakarya', ilceId:6151, ilceAd:'Serdivan' }], 'district')[0].id,'6151');
  assert.equal(administrativeOptions([{ ilId:76, ilceId:6151, mahalleId:123, mahalleAd:'Test' }], 'neighborhood')[0].id,'123');
});
test('invalid persisted schedules and impossible dates fail closed',()=>{
  for(const value of [null,{}, {...basic,entries:[{id:'a'}]}, {...basic,entries:[{...row('a','20','included'),category:'bad'}]}, {...basic,entries:Array(51).fill(row('a','20','included'))}]) assert.equal(restoreAreaBudgetInput(value),null);
  assert.equal(calculateAreaBudget({...basic,sourceDate:'2026-02-31',entries:[row('a','10','included')]}).construction,null);
  assert.equal(calculateAreaBudget({...basic,entries:[row('a','10','included'),{...row('b','20','included'),name:'Kat / a'}]}).completeRows,false);
});
test('massing uses explicit net area and never falls back to geometric parcel area',()=>{
  const input={reference:'Fixture',parcel:[{lat:40.7605,lng:30.3672},{lat:40.7605,lng:30.3682},{lat:40.7613,lng:30.3682},{lat:40.7613,lng:30.3672}],zoning:{taks:.4,kaks:1.2,hmax:15,frontSetback:3,sideSetback:3,rearSetback:3,buildingOrder:'Test',verification:'user-declared'},frontEdge:'north',floorHeight:3};
  const model=createZoningMassingModel({...input,netPlotArea:600});
  assert.equal(model.limits.allowedGrossArea,720);assert.equal(model.limits.allowedFootprint,240);
  assert.notEqual(model.parcel.area,600);assert.equal(model.parcel.netPlotArea,600);
  for(const netPlotArea of [undefined,null,NaN,Infinity,-1,1e9]) assert.equal(createZoningMassingModel({...input,netPlotArea}).limits.allowedGrossArea,0);
});
test('supplied web model is a valid self-contained GLB without source client identifiers',()=>{
  const bytes=readFileSync(new URL('../public/models/arkem-residential.glb',import.meta.url));
  assert.equal(bytes.toString('utf8',0,4),'glTF');assert.equal(bytes.readUInt32LE(4),2);assert.equal(bytes.readUInt32LE(8),bytes.length);
  const json=JSON.parse(bytes.toString('utf8',20,20+bytes.readUInt32LE(12)));
  assert.ok(json.meshes.length>0);assert.ok(bytes.length<2_000_000);
  assert.doesNotMatch(JSON.stringify(json),/Murat|Konuk|Kiyan|Users|Desktop/i);
  assert.ok((json.images??[]).every(image=>image.bufferView!==undefined));
});
test('TKGM actual IDs are preserved rather than plate codes', () => {
  assert.deepEqual(administrativeOptions({features:[{properties:{id:76,text:'Sakarya'}}]}),[{id:'76',label:'Sakarya'}]);
  assert.deepEqual(administrativeOptions([{id:6151,text:'Serdivan'}]),[{id:'6151',label:'Serdivan'}]);
  assert.equal(administrativeOptions({data:[{mahalleId:122428,ilId:76,ilceId:6151,mahalleAd:'Cumhuriyet'}]},'neighborhood')[0].id,'122428');
  assert.equal(administrativeOptions([{id:'offline-1',text:'Yanlış'}]).length,0);
});
test('blank and duplicate administrative records never become usable query IDs',()=>{
  assert.deepEqual(administrativeOptions({features:[]}),[]);
  assert.equal(administrativeOptions([{id:76,text:'Sakarya'},{id:76,text:'Sakarya'},{id:99,text:''}]).length,1);
});
test('map boundary is not drawn from an unbound sample after a missing parcel',()=>{
  const source=readFileSync(new URL('../app/components/GeoParcelStudio.tsx',import.meta.url),'utf8');
  assert.match(source,/const showBoundary = parcelRecord.projectEligible \|\| drawEnabled/);
  assert.match(source,/if \(showBoundary && terrainLayers\["parcel-boundary"\]/);
});
test('Esri map display conversion is EPSG3857 and bounds checked',()=>{
  const point=webMercatorPoint(0,0); assert.ok(Math.abs(point.x)<1e-7); assert.ok(Math.abs(point.y)<1e-7);
  assert.ok(Math.abs(webMercatorPoint(0,180).x-20037508.342789244)<.01);
  assert.equal(webMercatorPoint(90,0),null); assert.equal(webMercatorPoint(NaN,1),null);
});
test('area inputs accept comma decimals, reject missing/negative/non-finite',()=>{
  assert.equal(positiveArea('120,5'),120.5);
  for (const value of ['', '-1', 'NaN','Infinity','1e8','1.234,56']) assert.equal(positiveArea(value),null);
});
test('capacity is not automatically multiplied by 1.3 or treated as scheduled total',()=>{
  const result=calculateAreaBudget(basic); assert.equal(result.capacity,1200); assert.equal(result.construction,null); assert.equal(result.authoritative,false);
});
test('included and excluded schedule counts construction separately',()=>{
  const result=calculateAreaBudget({...basic,entries:[row('a','800','included'),row('b','120','excluded-limited'),row('c','60','excluded-independent','no')]});
  assert.equal(result.included,800); assert.equal(result.limited,120); assert.equal(result.independent,60); assert.equal(result.construction,920);
});
test('unknown classifications, duplicate ids, absent evidence and excess capacity fail closed',()=>{
  for(const patch of [{entries:[row('a','200','unknown')]},{entries:[row('a','200','included','unknown')]},{entries:[row('a','800','included'),row('a','10','included')]},{entries:[row('a','1300','included')]},{sourceReference:'',entries:[row('a','100','included')]}]) assert.equal(calculateAreaBudget({...basic,...patch}).construction,null);
});
test('municipal research rejects invalid geometry and unsupported provinces without outbound fetch',async()=>{
  const old=globalThis.fetch;globalThis.fetch=()=>{throw new Error('Must not fetch');};
  try{
    const unsupported=await POST(new Request('https://example.test/api',{method:'POST',body:JSON.stringify({province:'Sakarya',points:[]})}));
    assert.equal((await unsupported.json()).status,'unsupported');
    const invalid=await POST(new Request('https://example.test/api',{method:'POST',body:JSON.stringify({province:'İstanbul',points:[{lat:50,lng:30},{lat:40,lng:29},{lat:41,lng:29}]})}));
    assert.equal(invalid.status,400);
  }finally{globalThis.fetch=old;}
});
test('municipal adapter always returns research evidence, never zoning entitlement',async()=>{
  const old=globalThis.fetch;
  globalThis.fetch=async(url,options)=>{
    assert.equal(url,'https://haritaservis.ibb.gov.tr/planask/rest/services/PlanAskiGeo/MapServer/0/query');
    assert.equal(options.redirect,'manual'); assert.equal(options.body.get('inSR'),'4326');
    assert.ok(options.body.get('outFields').includes('PLAN.PLAN_Aski.OBJECTID'));
    return Response.json({features:[{attributes:{'PLAN.PLAN_Aski.OBJECTID':1,'PLAN.PLAN_Aski.PLAN_ADI':'Test fixture',KAKS:3}}]});
  };
  try{
    const response=await POST(new Request('https://example.test/api',{method:'POST',body:JSON.stringify({province:'İstanbul',points:[{lat:41,lng:29},{lat:41.001,lng:29},{lat:41,lng:29.001}]})}));
    const data=await response.json(); assert.equal(data.status,'research-only'); assert.equal(data.entitlementAvailable,false); assert.equal(data.authoritative,false); assert.equal(data.plans[0].KAKS,undefined); assert.equal(data.plans[0].name,'Test fixture');
  }finally{globalThis.fetch=old;}
});
