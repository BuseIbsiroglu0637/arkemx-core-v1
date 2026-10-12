import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {registerHooks} from 'node:module';
registerHooks({resolve(s,c,next){if(s.startsWith('.')&&!path.extname(s)){const u=new URL(s+'.ts',c.parentURL);if(fs.existsSync(fileURLToPath(u)))return next(u.href,c);}return next(s,c);}});
const {bimSourceTransfer}=await import('../app/lib/bim-source-transfer.ts');
const {createBimCoordinationModel}=await import('../app/lib/bim-coordination.ts');
const {planGeometrySnapshot}=await import('../app/lib/source-reference-integrity.ts');
const {createG05ReviewFixture}=await import('./fixtures/g05-review-project.mjs');
function fixture(){
  const p=createG05ReviewFixture(),s=p.modules['structural-concept'],plan=p.modules['plan-editor'];
  p.modules['architectural-program'].architecturalScheme={schema:'ARKEM-ARCH-SCHEME/3.0',reference:p.id,plate:{floorHeight:3.2}};
  plan.floorPlates[1]={...plan.floorPlates[1],width:10,grossArea:100};
  s.inputGeometrySnapshot=planGeometrySnapshot(plan);s.modelContext.floorPlates=structuredClone(plan.floorPlates);s.geometrySupport.status='uniform-concept-only';s.input.system='concrete';
  s.structuralStudio={schema:'ARKEM-STRUCTURAL-STUDIO/3.0',reference:p.id,recommendation:{system:'steel'},alternatives:[{system:'steel',preliminary:{numeric:{beamDepth:.3,slabThickness:.12}}},{system:'concrete',preliminary:{numeric:{beamDepth:.65,slabThickness:.18}}}]};
  return p;
}
test('no source never claims transfer or supplies canonical defaults',()=>{
  const t=bimSourceTransfer({id:'TEST',revision:'P01',modules:{}});
  assert.equal(t.architectureConnected,false);assert.equal(t.structureConnected,false);
  assert.equal(t.floorHeight,undefined);assert.equal(t.beamDepth,undefined);assert.equal(t.slabDepth,undefined);
  assert.match(t.message,/aktarılmadı/);assert.doesNotMatch(t.message,/yenilendi|alındı/);
});
test('partial architecture transfer explicitly leaves missing structural cuts untouched',()=>{
  const p=fixture();p.modules['structural-concept'].structuralStudio=null;
  const t=bimSourceTransfer(p);
  assert.equal(t.floorHeight,3.2);assert.equal(t.beamDepth,undefined);assert.equal(t.slabDepth,undefined);
  assert.match(t.message,/V113 kat yüksekliği alındı/);assert.match(t.message,/V114.*aktarılmadı/);
});
test('current source transfers actual selected system rather than recommendation',()=>{
  const t=bimSourceTransfer(fixture());assert.equal(t.architectureConnected,true);assert.equal(t.structureConnected,true);
  assert.equal(t.beamDepth,.65);assert.equal(t.slabDepth,.18);assert.equal(t.technicalApproval,false);
  assert.equal(t.structuralStudio.activeSystem,'concrete');
  const model=createBimCoordinationModel({projectId:'G05-BROWSER',projectRevision:'P02',coordinateReference:'LOCAL',architecturalScheme:t.architecturalScheme,structuralStudio:t.structuralStudio,floorHeight:3.2,beamDepth:t.beamDepth,slabDepth:t.slabDepth,serviceZone:.45,ceilingBuildUp:.12,raisedFloor:.08,shaftArea:32,plantArea:110,factoredGravity:0,soilBearing:200,rainfallIntensity:80,outletCapacity:4,sprinkler:true,facadeTolerance:20});
  assert.equal(model.source.selectedStructuralSystem,'concrete');
});
test('missing cuts, blocked geometry, foreign project, old revision and units fail closed',()=>{
  for(const mutate of [p=>delete p.modules['structural-concept'].structuralStudio.alternatives[1].preliminary.numeric.slabThickness,
    p=>p.modules['structural-concept'].geometrySupport.status='unsupported-source-integrity',
    p=>p.modules['structural-concept'].structuralStudio.reference='OTHER',
    p=>p.modules['structural-concept']._kernel.projectRevision='P00',
    p=>p.modules['structural-concept'].units.length='mm',
    p=>p.modules['plan-editor'].elements[0].load=99]){
    const p=fixture();mutate(p);const t=bimSourceTransfer(p);assert.equal(t.structureConnected,false);assert.equal(t.beamDepth,undefined);assert.equal(t.slabDepth,undefined);
  }
});
test('changed source or revision changes the transfer key; stored coordination edits do not',()=>{
  const p=fixture(),key=bimSourceTransfer(p).key;
  p.modules['engineering-coordination']={input:{beamDepth:.8}};
  assert.equal(bimSourceTransfer(p).key,key);
  p.modules['structural-concept'].structuralStudio.alternatives[1].preliminary.numeric.beamDepth=.7;
  assert.notEqual(bimSourceTransfer(p).key,key);
  const next=bimSourceTransfer(p).key;p.revision='P03';assert.notEqual(bimSourceTransfer(p).key,next);
});
