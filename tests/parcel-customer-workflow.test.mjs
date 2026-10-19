import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {emptyParcelPlanning,parcelDesignReady,restorePlanningScopes} from '../app/lib/parcel-zoning-scope.ts';
import {createParcelConcept,geometricAreaRatios} from '../app/lib/parcel-concept.ts';
import {parcelContinuationState,preliminaryCost} from '../app/lib/parcel-continuation.ts';
import {parcelIdentityKey} from '../app/lib/parcel-record.ts';
import {fromLocalMeters} from '../app/lib/geo.ts';
import {extractZoningConditions} from '../app/lib/zoning-document-parser.ts';
const identity={province:'Sakarya',district:'Serdivan',neighborhood:'Test Mahallesi',block:'123',parcelNo:'4'};
const key=parcelIdentityKey(identity);
const origin={lat:40.76,lng:30.36};
const parcel=[[-40,-30],[40,-30],[40,30],[-40,30]].map(([east,north])=>fromLocalMeters(east,north,origin));
test('Concept output ratios use actual boundary area, not absent net zoning area',()=>{
 const result=geometricAreaRatios(4800,500,1000);
 assert.ok(Math.abs(result.coveragePercent-10.416666666666666)<1e-10);
 assert.ok(Math.abs(result.grossAreaRatio-0.20833333333333334)<1e-10);
 for(const area of [0,-1,NaN,Infinity]) assert.equal(geometricAreaRatios(area,500,1000),null);
 assert.equal(geometricAreaRatios(4800,0,0),null);
 const source=readFileSync(new URL('../app/components/GeoParcelStudio.tsx',import.meta.url),'utf8');
 assert.ok(source.includes('geometricAreaRatios(metrics.area, metrics.footprint, metrics.gross)'));
 assert.ok(source.includes('outputRatios.coveragePercent.toFixed(1)'));
});
test('Missing zoning explicitly permits concept only with identity-bound valid geometry; zoning fields remain empty',()=>{
 const empty=emptyParcelPlanning(), draft={...empty,mode:'concept'};
 assert.equal(parcelDesignReady(true,true,empty),false);
 assert.equal(parcelDesignReady(true,true,draft),true);
 assert.equal(parcelDesignReady(false,true,draft),false);
 assert.equal(parcelDesignReady(true,false,draft),false);
 const restored=restorePlanningScopes({[key]:draft});assert.equal(restored[key].mode,'concept');
 assert.equal(restored[key].zoning.kaks,0);assert.equal(restored[key].netPlotArea,null);assert.equal(restored[key].inputsConfirmed,false);
});
test('Concept alternatives fit geometry without creating authoritative zoning rights',()=>{
 const result=createParcelConcept('TEST',parcel,3.5,'north');
 assert.equal(result.entitlementAvailable,false);assert.equal(result.source.authoritative,false);
 assert.equal(result.alternatives.length,3);assert.ok(result.alternatives.some(x=>x.status==='fits'));
 assert.ok(result.limitations.join(' ').includes('imar koşulu değildir'));
 assert.ok(result.alternatives.every(a=>a.floors<=2));
});
function fixture(){const draft={...emptyParcelPlanning(),mode:'concept'};
 const geo={...identity,parcel,building:parcel.slice(0,3),planningScopes:{[key]:draft},usage:'Sanayi / Depo',system:'Karar Bekleniyor',floors:2,floorHeight:3.5,designReady:true,buildingWidth:25,buildingDepth:20,selectedMassingId:'balanced',metrics:{area:4800,gross:1000,footprint:500,buildingFits:true}};
 const value={schema:'ARKEM-PARCEL-CONTINUATION/1',projectId:'TEST',identityKey:key,reference:'TEST PARSEL',selectedMassingId:'balanced',sourceRevision:'P01',mode:'concept',authoritative:false,zoningPending:true,boundaryArea:4800,grossArea:1000,footprint:500,floors:2,floorHeight:3.5,usage:geo.usage,system:geo.system,width:25,depth:20,limitations:['İmar bilinmiyor'],sourceSignature:JSON.stringify([key,geo.parcel,geo.building,draft,geo.usage,geo.system,geo.floors,geo.floorHeight])};
 return {'geo-parcel':geo,'parcel-continuation':value};}
test('Continuation preserves source snapshot and rejects stale parcel, height, storey and project changes',()=>{
 const modules=fixture();const initial=parcelContinuationState('TEST',modules);assert.equal(initial.stale,false);
 initial.value.limitations.push('mutation');assert.equal(modules['parcel-continuation'].limitations.length,1);
 for(const patch of [{floors:3},{floorHeight:4},{parcelNo:'5'},{usage:'Konut / Villa'},{designReady:false}]) assert.equal(parcelContinuationState('TEST',{...modules,'geo-parcel':{...modules['geo-parcel'],...patch}}).stale,true);
 assert.equal(parcelContinuationState('OTHER',modules).value,null);
 assert.equal(parcelContinuationState('TEST',{...modules,'parcel-continuation':{...modules['parcel-continuation'],grossArea:999999}}).stale,true);
 assert.equal(parcelContinuationState('TEST',{...modules,'parcel-continuation':{...modules['parcel-continuation'],sourceRevision:''}}).value,null);
});
test('Continuation keeps concept provenance and marks an escalated zoning snapshot stale',()=>{
 const modules=fixture();
 const current=parcelContinuationState('TEST',modules);
 assert.equal(current.stale,false);
 assert.equal(current.value.mode,'concept');
 assert.equal(current.value.zoningPending,true);
 assert.equal(current.value.authoritative,false);
 const changed={...modules,'parcel-continuation':{...modules['parcel-continuation'],mode:'zoning',zoningPending:false}};
 const escalated=parcelContinuationState('TEST',changed);
 assert.notEqual(escalated.value,null);
 assert.equal(escalated.stale,true);
 assert.equal(modules['geo-parcel'].planningScopes[key].mode,'concept');
});
test('Unknown and invalid prices never become a zero-price estimate',()=>{
 for(const rate of [null,0,-1,NaN,Infinity]) assert.equal(preliminaryCost(1000,rate),null);
 assert.equal(preliminaryCost(1000,20000),20000000);
});
test('Parcel-only continuation has no invented building; missing zoning does not block the next workspace',()=>{
 const modules=fixture(),geo=modules['geo-parcel'];
 const draft=emptyParcelPlanning();
 Object.assign(geo,{building:[],planningScopes:{[key]:draft},designReady:false,hasPlacedModel:false,buildingWidth:null,buildingDepth:null,floors:null,floorHeight:null,selectedMassingId:'none',parcelRecord:{projectEligible:true},metrics:{area:4800,geometryValid:true,gross:0,footprint:0,buildingFits:false}});
 Object.assign(modules['parcel-continuation'],{parcelOnly:true,mode:'zoning',zoningPending:true,selectedMassingId:'none',grossArea:0,footprint:0,width:0,depth:0,floors:0,floorHeight:0,sourceSignature:JSON.stringify([key,geo.parcel,[],draft,geo.usage,geo.system,null,null])});
 const result=parcelContinuationState('TEST',modules);assert.equal(result.stale,false);assert.equal(result.value.parcelOnly,true);assert.equal(preliminaryCost(result.value.grossArea,20000),null);
 assert.equal(parcelContinuationState('TEST',{...modules,'geo-parcel':{...geo,hasPlacedModel:true}}).stale,true);
 assert.equal(parcelContinuationState('TEST',{...modules,'parcel-continuation':{...modules['parcel-continuation'],grossArea:100}}).value,null);
});
test('Absent setback values remain unknown rather than silently becoming zero',()=>{
 const draft=emptyParcelPlanning();assert.equal(draft.zoning.frontSetback,-1);assert.equal(draft.zoning.sideSetback,-1);assert.equal(draft.zoning.rearSetback,-1);
 assert.equal(parcelDesignReady(true,true,{...draft,inputsConfirmed:true}),false);
});
test('Document extraction flags conflicting or invalid FAR and percentage notation',()=>{
 assert.equal(extractZoningConditions('KAKS: 1,20 Emsal: 2,00').find(x=>x.field==='kaks').confidence,'review');
 assert.equal(extractZoningConditions('TAKS: 4,00').find(x=>x.field==='taks').confidence,'review');
 assert.equal(extractZoningConditions('TAKS %40').find(x=>x.field==='taks').confidence,'review');
 assert.equal(extractZoningConditions('KAKS: 1,20').find(x=>x.field==='kaks').value,1.2);
});
test('Customer delivery is visible, with four formats and real continuation routes',()=>{
 const source=readFileSync(new URL('../app/components/ParcelOutcomePanel.tsx',import.meta.url),'utf8');
 for(const text of ['A3 teknik pafta','A4 özet rapor','Düzenlenebilir DXF','Harita KML dosyası','/proje-on-planlama','/yapi-sistemi-karsilastirma']) assert.ok(source.includes(text));
 assert.ok(!source.includes('<details'));
 const geo=readFileSync(new URL('../app/components/GeoParcelStudio.tsx',import.meta.url),'utf8');
 const zoningReview=readFileSync(new URL('../app/components/ParcelZoningReview.tsx',import.meta.url),'utf8');
 assert.ok(zoningReview.includes('İmar bilgisi olmadan devam et'));assert.ok(geo.includes('const contourLocal: { x: number; y: number }[][] = []'));
});
