import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {fetchTkgmJson,assertParcelResponseIdentity} from '../app/lib/tkgm-client.ts';
import {normalizeAdministrativeName} from '../app/lib/administrative-options.ts';
import {modelFitDistance} from '../app/lib/model-framing.ts';
import {createZoningMassingModel,containsFootprint,completeBoundaryDistance} from '../app/lib/zoning-massing.ts';
import {fromLocalMeters,buildingFootprint,pointInPolygon} from '../app/lib/geo.ts';
import {researchKastamonu} from '../app/lib/kastamonu-plan-research.ts';

test('TKGM client uses actual public identifiers through its only same-origin gateway without credentials',async()=>{
 const old=globalThis.fetch;const urls=[];
 globalThis.fetch=async(url,options)=>{urls.push(url);assert.equal(options.credentials,'omit');return Response.json({features:[{properties:{id:456,text:'Gerçek mahalle'}}]});};
 try {const result=await fetchTkgmJson('idariYapi/mahalleListe/90101');assert.equal(result.features[0].properties.id,'456');assert.deepEqual(urls,['/api/tkgm?path=idariYapi%2FmahalleListe%2F90101']);const n=urls.length;await fetchTkgmJson('idariYapi/mahalleListe/90101');assert.equal(urls.length,n);}finally{globalThis.fetch=old;}
});
test('TKGM rejects invented paths, empty directories, aborted requests',async()=>{
 const old=globalThis.fetch;globalThis.fetch=async()=>Response.json({features:[]});
 try {await assert.rejects(fetchTkgmJson('idariYapi/mahalleListe/fallback-1'));await assert.rejects(fetchTkgmJson('idariYapi/mahalleListe/90102'));const c=new AbortController();c.abort();await assert.rejects(fetchTkgmJson('idariYapi/mahalleListe/90103',c.signal));}finally{globalThis.fetch=old;}
});
test('ASCII official names match Turkish stored names',()=>{assert.equal(normalizeAdministrativeName('Istanbul'),normalizeAdministrativeName('İstanbul'));assert.equal(normalizeAdministrativeName('Adapazari'),normalizeAdministrativeName('Adapazarı'));});
test('mismatched returned administrative/parcel identifiers cannot replace a selected parcel',()=>{
 const expected={provinceId:'76',districtId:'6151',neighborhoodId:'148131',block:'0',parcelNo:'14845'};
 const properties={ilId:76,ilceId:6151,mahalleId:148131,adaNo:'',parselNo:'14845'};
 assert.doesNotThrow(()=>assertParcelResponseIdentity(properties,expected));
 for(const patch of [{ilId:1},{ilceId:5},{mahalleId:2},{adaNo:'3'},{parselNo:'14846'},{ilId:undefined}]) assert.throws(()=>assertParcelResponseIdentity({...properties,...patch},expected));
});
test('model fit respects portrait/wide aspect without altering geometry',()=>{
 const size={x:37.72,y:8.78,z:39.05},direction={x:.78,y:.75,z:.9};
 const portrait=modelFitDistance(size,direction,36,.65),wide=modelFitDistance(size,direction,36,1.7);
 assert.ok(portrait>wide);assert.ok(wide>40);assert.deepEqual(size,{x:37.72,y:8.78,z:39.05});
 const viewer=fs.readFileSync(new URL('../app/lib/project-model-viewer.ts',import.meta.url),'utf8');assert.match(viewer,/modelFitDistance/);assert.doesNotMatch(viewer,/scale\.set\(/);
});
const origin={lat:40.76,lng:30.36};const polygon=coords=>coords.map(([x,y])=>fromLocalMeters(x,y,origin));
const input={reference:'Synthetic QA fixture',parcel:polygon([[-50,-50],[50,-50],[50,50],[-50,50]]),netPlotArea:10000,zoning:{taks:.4,kaks:1.2,hmax:15,frontSetback:5,sideSetback:3,rearSetback:3,buildingOrder:'Fixture',verification:'user-declared'},frontEdge:'north',floorHeight:3};
test('proposed massing chooses greatest tested area and respects plate, FAR and height',()=>{
 const m=createZoningMassingModel(input);const valid=m.alternatives.filter(a=>a.status==='fits');assert.ok(valid.length);const selected=valid.find(a=>a.id===m.recommendedAlternativeId);assert.equal(selected.grossArea,Math.max(...valid.map(a=>a.grossArea)));
 for(const a of valid){assert.ok(a.width*a.depth<=4000+.01);assert.ok(a.width*a.depth*a.floors<=12000+.01);assert.ok(a.height<=15);assert.ok(a.boundaryDistance>=4.99);}assert.equal(m.source.authoritative,false);
});
test('a deep concave notch cannot be bridged by a supposedly valid building',()=>{
 const parcel=polygon([[-50,-50],[50,-50],[50,50],[3,50],[3,-40],[-3,-40],[-3,50],[-50,50]]);
 const m=createZoningMassingModel({...input,parcel});assert.equal(m.recommendedAlternativeId,null);assert.ok(m.alternatives.every(a=>a.status==='review'));
});
test('manual footprint uses complete edges and distance, including rotated/translated placements',()=>{
 const parcel=polygon([[-50,-50],[50,-50],[50,50],[3,50],[3,-40],[-3,-40],[-3,50],[-50,50]]);
 const bridged=buildingFootprint(origin,40,40,0,0,0);
 assert.ok(bridged.every(p=>pointInPolygon(p,parcel)));assert.equal(containsFootprint(parcel,bridged),false);
 const valid=buildingFootprint(origin,12,12,25,-25,-20);assert.equal(containsFootprint(parcel,valid),true);assert.ok(completeBoundaryDistance(parcel,valid)>3);
 const source=fs.readFileSync(new URL('../app/components/GeoParcelStudio.tsx',import.meta.url),'utf8');assert.match(source,/const buildingFits = containsFootprint\(parcel, building\)/);assert.match(source,/const boundaryDistance = completeBoundaryDistance\(parcel, building\)/);
});
test('secondary zoning query invalidates selection and ignores late or mismatched responses',()=>{
 const source=fs.readFileSync(new URL('../app/components/ZoningIntegrationCenter.tsx',import.meta.url),'utf8');
 for(const contract of ['const selectedParcelKey = JSON.stringify([project.id, provinceId, districtId, neighborhoodId, block, parcelNo])','parcelRequest.current.controller?.abort()','if (!isCurrent()) return','assertParcelResponseIdentity','parseParcelGeoJson(data)','setParcelGeometry([]); setParcelArea(0)','setZoning({...DEFAULT_ZONING, taks:0, kaks:0, hmax:0']) assert.ok(source.includes(contract),contract);
});
test('Kastamonu anomaly stays research-only, never copied to rights',async()=>{
 const old=globalThis.fetch;globalThis.fetch=async()=>Response.json({features:[{attributes:{objectid:639,planid:1,taks:1.5,emsalkaks:.5}}]});
 try{const body=await researchKastamonu([{lat:41.49,lng:34.01},{lat:41.491,lng:34.01},{lat:41.49,lng:34.011}],new AbortController().signal);assert.equal(body.status,'research-only');assert.equal(body.entitlementAvailable,false);assert.equal(body.authoritative,false);assert.ok(body.plans[0].qualityIssues.some(x=>x.includes('TAKS')));assert.equal(body.partial,true);}finally{globalThis.fetch=old;}
});
test('imagery is display-only and synthetic administrative fallbacks remain excluded',()=>{
 for(const file of ['app/lib/parcel-basemaps.ts','app/components/GeoParcelStudio.tsx','app/components/ZoningIntegrationCenter.tsx']){
  const text=fs.readFileSync(new URL('../'+file,import.meta.url),'utf8');
  assert.doesNotMatch(text,/FALLBACK_PROVINCES|FALLBACK_DISTRICTS|FALLBACK_NEIGHBORHOODS/);
 }
 const basemaps=fs.readFileSync(new URL('../app/lib/parcel-basemaps.ts',import.meta.url),'utf8');
 const studio=fs.readFileSync(new URL('../app/components/GeoParcelStudio.tsx',import.meta.url),'utf8');
 assert.match(basemaps,/World_Imagery/);
 assert.match(basemaps,/attribution:/);
 assert.match(studio,/Harita görünümü parselin kot veya imar verisini doğrulamaz/);
});
