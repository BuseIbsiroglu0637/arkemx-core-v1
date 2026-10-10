import assert from 'node:assert/strict';import test from 'node:test';import fs from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';import {registerHooks} from 'node:module';
registerHooks({resolve(s,c,next){if(s.startsWith('.')&&!path.extname(s)){const u=new URL(s+'.ts',c.parentURL);if(fs.existsSync(fileURLToPath(u)))return next(u.href,c);}return next(s,c);}});
const {prepareProjectShellSource,recordProjectShellSource,verifyProjectShellSource,recordProjectShellCalculation,verifyProjectShellCalculation}=await import('../app/lib/project-shell-calculation.ts');
const {createProjectShellFixture,createProjectShellFixtureSource}=await import('./fixtures/project-shell-project.mjs');
const {createShellExamples}=await import('../app/lib/shell-example.ts');
const {recordShellCalculation,solveShell}=await import('../app/lib/shell-solver.ts');
const {traceJson,traceSha256}=await import('../app/lib/structural-traceability.ts');
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} differs from ${b}`);

test('S4-A02 preserves four pre-extraction legacy calculation digests and rejects project sources through the legacy API',async()=>{
  const expected=['0e0df57e5a6cbaf39b5cc392f4620539d8d97692bd20298a2f043954359d9445','d87437fcd69a4f4482464c96727d2128933a8de8772eaf2786330e54c8b1b5c3','fce7956717dfc7715376bddc15225f23798463681d33be4281c625e56532e34b','eb503a040125610032abe9b46a1d6c506f304c98faa022709a313adb1cd4139c'];
  let i=0;for(const preset of ['SS-H','CL'])for(const s of createShellExamples(preset))assert.equal((await recordShellCalculation(s)).sha256,expected[i++]);
  const p=createProjectShellFixture();assert.throws(()=>solveShell(createProjectShellFixtureSource(p)));
});
test('S4-A02 mesh, source identities, true XYZ and explicit loads bind the two project plates without a synthetic adapter',async()=>{
  const p=createProjectShellFixture();
  for(const level of [1,2]){
    const s=createProjectShellFixtureSource(p,level),r=await recordProjectShellCalculation(p,s),prepared=r.content.sourceRecord.content;
    assert.equal(prepared.source.schema,'ARKEM-PROJECT-SHELL-SOURCE/1.0');assert.equal(prepared.source.fixture,undefined);
    assert.equal(prepared.source.sourcePlateId,s.sourcePlateId);assert.equal(prepared.source.projectId,p.id);assert.equal(prepared.source.revision,p.revision);
    assert.ok(prepared.model.elements.every(e=>e.sourcePlateId===s.sourcePlateId&&e.nodeIds.every(id=>prepared.model.nodes.some(n=>n.id===id))));
    assert.ok(prepared.model.nodes.every(n=>n.z===s.plate.origin[2]));assert.equal(prepared.area,level===1?100:200);
    for(const c of r.content.cases){near(c.nodes.reduce((v,n)=>v+n.reactions[2],0),c.areaLoad*prepared.area);assert.ok(c.equilibrium.forceResidual<1e-8&&c.equilibrium.momentResidual<1e-8);}
    assert.equal(r.content.cases.find(c=>c.id==='G').areaLoad,6.5);assert.equal(r.content.cases.find(c=>c.id==='Q').areaLoad,3.5);
    assert.equal(r.content.technicalApproval,false);assert.equal(r.content.fullBuildingAnalysis,false);
    assert.equal(await verifyProjectShellSource(r.content.sourceRecord,p,s),true);assert.equal(await verifyProjectShellCalculation(r,p,s),true);
  }
});
test('S4-A02 record identity survives JSON restore and source collection ordering while diagnostic timing stays outside the seal',async()=>{
  const p=createProjectShellFixture(),s=createProjectShellFixtureSource(p);s.sourceElementIds=['L-B','L-A'];
  const r=await recordProjectShellCalculation(p,s);p.modules['plan-editor'].elements.reverse();p.modules['plan-editor'].floorPlates.reverse();p.modules['plan-editor'].floorCoordination.placements.reverse();s.sourceElementIds.reverse();
  const next=await recordProjectShellCalculation(p,s);assert.equal(next.id,r.id);assert.equal(await verifyProjectShellCalculation(JSON.parse(JSON.stringify(r)),p,s),true);
  r.elapsedMs=12345;assert.equal(await verifyProjectShellCalculation(r,p,s),true);
  assert.equal(r.content.sourceRecord.content.source.provenance.kind,'synthetic-project');
});
test('S4-A02 material, thickness, load, mesh, support and element provenance changes invalidate old calculation/source records',async()=>{
  const p=createProjectShellFixture(),s=createProjectShellFixtureSource(p),r=await recordProjectShellCalculation(p,s);
  for(const mutate of [s=>s.material.E*=1.1,s=>s.plate.thickness=.25,s=>s.loads.liveLoad=4,s=>s.mesh.nx=9,s=>s.supports.preset='CL',s=>s.sourceElementIds=['L-B']]){
    const next=structuredClone(s);mutate(next);assert.equal(await verifyProjectShellCalculation(r,p,next),false);assert.equal(await verifyProjectShellSource(r.content.sourceRecord,p,next),false);
    assert.notEqual((await recordProjectShellCalculation(p,next)).id,r.id);
  }
  const stale=structuredClone(p);stale.modules['plan-editor'].floorPlates[0].width+=1;
  assert.equal(await verifyProjectShellCalculation(r,stale,s),false);assert.equal(await verifyProjectShellCalculation(r,p,{...s,projectId:'FOREIGN'}),false);
});
test('S4-A02 recomputation rejects rehashed fabricated displacement, Gauss resultants, diagnostics, prepared mesh and false approval',async()=>{
  const p=createProjectShellFixture(),s=createProjectShellFixtureSource(p),r=await recordProjectShellCalculation(p,s);
  for(const mutate of [r=>r.content.cases[0].nodes[0].displacements[2]=1,r=>r.content.cases[0].elements[0].points[0].resultants[3]+=1,r=>r.content.diagnostics.minScaledPivot+=1,r=>r.content.sourceRecord.content.model.nodes[0].z+=1,r=>r.content.technicalApproval=true]){
    const forged=structuredClone(r);mutate(forged);forged.sha256=await traceSha256(traceJson(forged.content));forged.id='PROJECT-SHELL-CALC-'+forged.sha256;
    assert.equal(await verifyProjectShellCalculation(forged,p,s),false);
  }
});
test('S4-A02 missing/untrusted source, invalid stiffness and aborted requests cannot produce accepted calculations',async()=>{
  const p=createProjectShellFixture(),s=createProjectShellFixtureSource(p);
  const noIdentity=createProjectShellFixture({legacy:true});assert.throws(()=>prepareProjectShellSource(noIdentity,s));
  const invalid=structuredClone(s);invalid.material.E=null;await assert.rejects(recordProjectShellCalculation(p,invalid));
  await assert.rejects(recordProjectShellCalculation(p,s,{drillingFactor:0}),/drilling/);
  const ac=new AbortController();ac.abort();await assert.rejects(recordProjectShellCalculation(p,s,{signal:ac.signal}),/iptal/);
  const sourceRecord=await recordProjectShellSource(p,s);sourceRecord.content.model.elements[0].nodeIds.reverse();sourceRecord.sha256=await traceSha256(traceJson(sourceRecord.content));sourceRecord.id='PROJECT-SHELL-SOURCE-'+sourceRecord.sha256;
  assert.equal(await verifyProjectShellSource(sourceRecord,p,s),false);
});
test('S4-A02 accepts explicit zero loads, keeps the caller unchanged and snapshots source input before async hashing',async()=>{
  const p=createProjectShellFixture(),s=createProjectShellFixtureSource(p);s.loads={slabSelfWeight:false,superDeadLoad:0,liveLoad:0,benchmarkLoad:0};
  const snapshot=structuredClone(s),pending=recordProjectShellCalculation(p,s);s.material.E*=2;const r=await pending;
  assert.equal(r.content.sourceRecord.content.source.material.E,snapshot.material.E);
  assert.ok(r.content.cases.every(c=>c.centerUz===0&&c.nodes.every(n=>n.displacements.every(v=>v===0))));
  assert.equal(await verifyProjectShellCalculation(r,p,snapshot),true);assert.equal(await verifyProjectShellCalculation(r,p,s),false);
});
