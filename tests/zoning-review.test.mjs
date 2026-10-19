import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyParcelPlanning, restorePlanningScopes } from '../app/lib/parcel-zoning-scope.ts';
import { zoningReviewMissing } from '../app/lib/zoning-review.ts';
import { createMunicipalResearchClient, createMunicipalResearchScope } from '../app/lib/municipal-plan-research.ts';
const identity={province:'Kastamonu',district:'Merkez',neighborhood:'Test',block:'1',parcelNo:'2'};
const points=[{lat:41,lng:33},{lat:41.001,lng:33},{lat:41,lng:33.001}];
const geometry=JSON.stringify(points);
const valid=()=>({...emptyParcelPlanning(),documentReference:'Fixture plan',documentDate:'2026-10-19',sourceGeometryKey:geometry,netPlotArea:1000,netAreaBasis:'Fixture net area',inputsConfirmed:true,zoning:{...emptyParcelPlanning().zoning,taks:.3,kaks:1.2,hmax:9,frontSetback:5,sideSetback:3,rearSetback:3}});
test('review can continue only with the current geometry and a complete declared source',()=>{
 assert.deepEqual(zoningReviewMissing(valid(),geometry),[]);
 assert.ok(zoningReviewMissing(valid(),'new geometry').some(x=>x.includes('sınırı')));
 for(const patch of [{documentReference:''},{documentDate:'2026-02-31'},{inputsConfirmed:false},{netPlotArea:null},{netAreaBasis:''}]) assert.ok(zoningReviewMissing({...valid(),...patch},geometry).length);
});
test('source and geometry binding survive the identity-scoped restore without upgrading approval',()=>{
 const key=JSON.stringify(Object.values(identity));const restored=restorePlanningScopes({[key]:valid()})[key];
 assert.equal(restored.documentReference,'Fixture plan');assert.equal(restored.documentDate,'2026-10-19');assert.equal(restored.sourceGeometryKey,geometry);assert.equal(restored.zoning.verification,'user-declared');
});
test('legacy parcel drafts keep their conditions and require an explicit new source review',()=>{
 const key=JSON.stringify(Object.values(identity));const old=valid();delete old.documentReference;delete old.documentDate;delete old.sourceGeometryKey;
 const restored=restorePlanningScopes({[key]:old})[key];assert.equal(restored.zoning.kaks,1.2);assert.ok(zoningReviewMissing(restored,geometry).length);
});
test('demo 403 is a demo restriction instead of a false cadastral mismatch',async()=>{
 const client=createMunicipalResearchClient(async()=>new Response(JSON.stringify({demo:true,error:'demo restriction'}),{status:403,headers:{'content-type':'application/json'}}));
 const scope=createMunicipalResearchScope(identity,points,'fixture','R01');const r=await client(identity,points,scope,new AbortController().signal);
 assert.equal(r.status,'demo-disabled');assert.equal(r.authoritative,false);assert.equal(r.automaticConditions,null);assert.equal(r.scope.identityKey,scope.identityKey);assert.doesNotMatch(r.message,/eşleşmedi/);
});
test('a non-demo unscoped response is still rejected',async()=>{
 const client=createMunicipalResearchClient(async()=>new Response(JSON.stringify({error:'invalid'}),{status:403,headers:{'content-type':'application/json'}}));
 const scope=createMunicipalResearchScope(identity,points,'fixture','R01');const r=await client(identity,points,scope,new AbortController().signal);
 assert.equal(r.status,'unavailable');assert.equal(r.automaticConditions,null);
});
