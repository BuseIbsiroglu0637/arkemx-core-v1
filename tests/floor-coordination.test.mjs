import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { registerHooks } from 'node:module';
registerHooks({resolve(s,c,next){if(s.startsWith('.')&&!path.extname(s)){const u=new URL(s+'.ts',c.parentURL);if(fs.existsSync(fileURLToPath(u)))return next(u.href,c);}return next(s,c);}});
const {createB06CoordinationFixture,refreshCoordinationSource} = await import('./fixtures/b06-coordination-project.mjs');
const {inspectFloorCoordination,floorCoordinationBasis} = await import('../app/lib/floor-coordination.ts');
const {planGeometrySnapshot,structuralAnalysisBlockers} = await import('../app/lib/source-reference-integrity.ts');
const {calculateFloorPlateStudy,recordFloorStudy,verifyFloorStudy} = await import('../app/lib/floor-plate-study.ts');
const planOf = p => p.modules['plan-editor'];
test('B06 common coordinates use each floor dimensions and actual source column IDs',()=>{
  const r=inspectFloorCoordination(planOf(createB06CoordinationFixture()));
  assert.equal(r.status,'geometry-only'); assert.deepEqual(r.issues,[]);
  assert.equal(r.geometry.columns.find(c=>c.id==='U-B').x,5);
  assert.deepEqual(r.geometry.columnLinks.map(l=>l.status),['aligned-candidate','aligned-candidate']);
  assert.deepEqual(r.geometry.beamLinks,[{upperBeamId:'B-U',lowerBeamIds:['B-L'],status:'aligned-candidate'}]);
  assert.equal(r.fullBuildingAnalysis,false); assert.equal(r.technicalApproval,false);
});
test('B06 no common coordinates means pending, with no invented geometry',()=>{
  const r=inspectFloorCoordination(planOf(createB06CoordinationFixture({saved:false})));
  assert.equal(r.status,'pending'); assert.equal(r.geometry,null);
});
test('B06 nonzero offset affects world coordinates and flags missing support and terminated columns',()=>{
  const plan=planOf(createB06CoordinationFixture()); plan.floorCoordination.placements[1].x=7;
  const r=inspectFloorCoordination(plan);
  assert.equal(r.geometry.columns.find(c=>c.id==='U-A').x,7);
  assert.ok(r.geometry.columnLinks.every(l=>l.status==='no-support-source'));
  assert.deepEqual(r.geometry.terminatedColumnIds,['L-A','L-B']);
  assert.equal(r.geometry.beamLinks[0].status,'no-matching-beam-source');
});
test('B06 upper column over lower beam is transfer-review, never continuity acceptance',()=>{
  const plan=planOf(createB06CoordinationFixture());plan.elements.find(e=>e.id==='U-A').x=.25;
  plan.floorCoordination.basis=floorCoordinationBasis(plan);
  const link=inspectFloorCoordination(plan).geometry.columnLinks.find(l=>l.upperColumnId==='U-A');
  assert.equal(link.status,'transfer-review');assert.deepEqual(link.transferBeamIds,['B-L']);assert.deepEqual(link.lowerColumnIds,[]);
});
test('B06 duplicate column positions are ambiguous and tolerance does not become approval',()=>{
  const plan=planOf(createB06CoordinationFixture());plan.elements.push({...plan.elements.find(e=>e.id==='L-A'),id:'L-dup'});plan.floorCoordination.basis=floorCoordinationBasis(plan);
  assert.equal(inspectFloorCoordination(plan).geometry.columnLinks[0].status,'ambiguous');
  plan.elements.pop();plan.floorCoordination.basis=floorCoordinationBasis(plan);plan.floorCoordination.placements[1].x=.0009;
  assert.equal(inspectFloorCoordination(plan).geometry.columnLinks[0].status,'aligned-candidate');
  plan.floorCoordination.placements[1].x=.0011;
  assert.notEqual(inspectFloorCoordination(plan).geometry.columnLinks[0].status,'aligned-candidate');
});
test('B06 changed plates or columns invalidate coordination; selecting a floor or reordering sources does not',()=>{
  const plan=planOf(createB06CoordinationFixture());plan.level=1;plan.elements.reverse();plan.floorPlates.reverse();
  assert.equal(inspectFloorCoordination(plan).status,'geometry-only');
  plan.floorPlates[0].width=21;assert.equal(inspectFloorCoordination(plan).geometry,null);
  plan.floorPlates[0].width=20;plan.elements.find(e=>e.id==='U-A').x=.1;assert.equal(inspectFloorCoordination(plan).geometry,null);
  plan.elements.find(e=>e.id==='U-A').x=0;plan._kernel.projectRevision='P03';assert.equal(inspectFloorCoordination(plan).geometry,null);
});
test('B06 malformed placements, elevations, units, rotations and columns are rejected',()=>{
  for(const mutate of [p=>p.floorCoordination.placements.pop(),p=>p.floorCoordination.placements[1].level=1,p=>p.floorCoordination.placements[1].z=0,p=>p.floorCoordination.placements[0].x=NaN,p=>p.floorCoordination.placements[1].x=1e308,p=>p.floorCoordination.placements[1].rotation=90,p=>p.units.length='mm',p=>p.elements.find(e=>e.id==='L-A').x=3]){
    const plan=planOf(createB06CoordinationFixture());mutate(plan);try{plan.floorCoordination.basis=floorCoordinationBasis(plan);}catch{}
    assert.equal(inspectFloorCoordination(plan).geometry,null);
  }
});
test('B06 missing, cross-floor, repeated and zero-length beam endpoints are rejected',()=>{
  for(const mutate of [p=>p.floorCoordination.beams[0].startColumnId='missing',p=>p.floorCoordination.beams[0].endColumnId='U-A',p=>p.floorCoordination.beams[0].endColumnId='L-A',p=>p.floorCoordination.beams.push({...p.floorCoordination.beams[0],id:'duplicate-pair'}),p=>p.elements.find(e=>e.id==='L-B').x=0]){
    const plan=planOf(createB06CoordinationFixture());mutate(plan);plan.floorCoordination.basis=floorCoordinationBasis(plan);assert.equal(inspectFloorCoordination(plan).geometry,null);
  }
});
test('B06 coordination is part of source snapshot and blocks uniform engine even for identical plates',()=>{
  const p=createB06CoordinationFixture();const plan=planOf(p);plan.floorPlates[1]={...plan.floorPlates[0],level:2};
  plan.floorCoordination.basis=floorCoordinationBasis(plan);refreshCoordinationSource(p);
  assert.deepEqual(planGeometrySnapshot(plan).floorCoordination,plan.floorCoordination);
  assert.ok(structuralAnalysisBlockers(p.modules['structural-concept']).includes('floor coordination whole-building analysis unsupported'));
});
test('B06 changed common placement changes study identity and invalidates previous source-bound study',async()=>{
  const p=createB06CoordinationFixture(), plan=planOf(p), input={...p.modules['structural-concept'].input,system:'concrete',usage:'industrial',floorHeight:3.4,columnSize:.5,beamDepth:.6,slabThickness:.16,superDeadLoad:2.2,liveLoad:3.5,roofSnowLoad:.75,basicWindSpeed:30,sds:1,sd1:.45,importance:1,behaviorFactor:6,concreteStrength:30,steelYield:355};
  const old=await recordFloorStudy(calculateFloorPlateStudy(p,input).study);assert.equal(old.content.coordination.status,'geometry-only');
  plan.floorCoordination.placements[1].x=2;refreshCoordinationSource(p);
  assert.equal(await verifyFloorStudy(old,p,input),false);
  assert.notEqual((await recordFloorStudy(calculateFloorPlateStudy(p,input).study)).id,old.id);
});
