import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {registerHooks} from 'node:module';
registerHooks({resolve(s,c,next){if(s.startsWith('.')&&!path.extname(s)){const u=new URL(s+'.ts',c.parentURL);if(fs.existsSync(fileURLToPath(u)))return next(u.href,c);}return next(s,c);}});
const {createShellExamples}=await import('../app/lib/shell-example.ts');
const {prepareShellSource,recordShellSource,verifyShellSourceRecord}=await import('../app/lib/shell-source.ts');
const {traceJson,traceSha256}=await import('../app/lib/structural-traceability.ts');
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-8, a+' differs from '+b);
test('S1 two plate sources have independent rectangular meshes with positive orientation and complete identities',()=>{
 const fixture=JSON.parse(fs.readFileSync(new URL('../docs/examples/B06_SHELL_SOURCES_2026-10-10.json',import.meta.url),'utf8'));
 assert.deepEqual(fixture,createShellExamples());
 const [a,b]=createShellExamples().map(prepareShellSource);
 assert.deepEqual([a.area,b.area],[100,200]);assert.deepEqual([a.meshCounts,b.meshCounts],[{nodes:81,elements:64},{nodes:153,elements:128}]);
 assert.equal(b.model.nodes.at(-1).z,3.4);
 assert.deepEqual(a.conventions.dofOrder,['ux','uy','uz','rx','ry','rz']);assert.equal(a.conventions.surface,'mid-surface');
 for(const p of [a,b]){
  assert.equal(new Set(p.model.nodes.map(n=>n.id)).size,p.meshCounts.nodes);
  assert.equal(new Set(p.model.elements.map(e=>e.id)).size,p.meshCounts.elements);
  let area=0;
  for(const e of p.model.elements){
   const nodes=e.nodeIds.map(id=>p.model.nodes.find(n=>n.id===id));assert.ok(nodes.every(Boolean));
   const signed=nodes.reduce((s,n,i)=>s+n.x*nodes[(i+1)%4].y-n.y*nodes[(i+1)%4].x,0)/2;
   assert.ok(signed>0);area+=signed;assert.equal(e.sourcePlateId,p.source.plate.id);assert.equal(e.materialId,p.source.material.id);
  }
  near(area,p.area);assert.ok(p.model.nodes.every(n=>p.model.elements.some(e=>e.nodeIds.includes(n.id))));
 }
 assert.equal(a.model.nodes.some(n=>b.model.nodes.some(m=>m.id===n.id)),false);
});
test('S1 coarse medium and fine grids retain the same plate and stay within the separate mesh budget',()=>{
 for(const [density,expected] of [['coarse',[[25,16],[45,32]]],['medium',[[81,64],[153,128]]],['fine',[[289,256],[561,512]]]]){
  const p=createShellExamples('SS-H',density).map(prepareShellSource);
  p.forEach((s,i)=>{assert.deepEqual([s.meshCounts.nodes,s.meshCounts.elements],expected[i]);near(s.area,i===0?100:200);});
 }
});
test('S1 SS-H constrains physical rotations on the proper edges and only declared in-plane anchors',()=>{
 const p=prepareShellSource(createShellExamples()[0]),{nx,ny}=p.source.mesh;
 const at=(i,j)=>p.model.supports.find(s=>s.nodeId==='P1:N:'+i+':'+j)?.fixed??[false,false,false,false,false,false];
 assert.deepEqual(at(0,0),[true,true,true,true,true,false]);
 assert.deepEqual(at(nx,0),[false,true,true,true,true,false]);
 assert.deepEqual(at(0,ny/2),[false,false,true,true,false,false]);
 assert.deepEqual(at(nx/2,0),[false,false,true,false,true,false]);
 assert.deepEqual(at(nx/2,ny/2),[false,false,false,false,false,false]);
 assert.ok(p.model.supports.every(s=>s.fixed.length===6&&s.fixed.every(v=>typeof v==='boolean')));
});
test('S1 clamped edges add both bending constraints without inventing a rigid diaphragm',()=>{
 const p=prepareShellSource(createShellExamples('CL')[0]);
 for(const s of p.model.supports)assert.deepEqual(s.fixed.slice(2),[true,true,true,false]);
 assert.equal(p.calculation,null);assert.equal(p.status,'source-ready-analysis-pending');assert.equal(p.fullBuildingAnalysis,false);assert.equal(p.technicalApproval,false);
 assert.equal('displacements' in p,false);assert.equal('result' in p,false);
});
test('S1 dead-load cases use each component once and exclude frame allowance and frame nodal transfer',()=>{
 const p=createShellExamples().map(prepareShellSource),totals={};
 for(const s of p){
  assert.equal(s.model.material.G,12500000);assert.equal(s.model.loadComponents.length,4);
  assert.deepEqual(s.model.loadCases.find(c=>c.id==='G').componentIds,['G_SW','G_SUP']);
  for(const c of s.model.loadCases){assert.deepEqual(c.direction,[0,0,-1]);totals[c.id]=(totals[c.id]??0)-c.totalVerticalForce;}
  assert.deepEqual(s.loadPolicy,{frameAllowance:'excluded',frameLoads:'excluded',G:'derived-case-not-additional-component'});
 }
 near(totals.G_SW,1200);near(totals.G_SUP,660);near(totals.G,1860);near(totals.Q,1050);near(totals.BENCH,300);
});
test('S1 slab self weight and explicit density alter only derived G; zero load is explicit',()=>{
 const s=createShellExamples()[0];s.material.unitWeight=50;s.loads.liveLoad=0;
 const a=prepareShellSource(s);near(-a.model.loadCases.find(c=>c.id==='G').totalVerticalForce,1020);
 assert.equal(a.model.loadCases.find(c=>c.id==='Q').areaLoad,0);
 s.loads.slabSelfWeight=false;const b=prepareShellSource(s);near(-b.model.loadCases.find(c=>c.id==='G').totalVerticalForce,220);
 assert.equal(b.model.loadCases.find(c=>c.id==='G_SW').areaLoad,0);
});
test('S1 rejects missing fields unknown features wrong units nonfinite inputs and approval claims',()=>{
 const mutations=[
  s=>delete s.material.E,s=>s.material.E=null,s=>s.material.E='30000000',s=>s.material.E=0,s=>s.material.nu=.5,s=>s.material.nu=-.1,s=>s.material.unitWeight=NaN,
  s=>s.plate.width=-1,s=>s.plate.thickness=0,s=>s.plate.thickness=11,s=>s.plate.sourceLevel=1.5,s=>s.plate.origin=[0,0],s=>s.plate.origin=[0,0,Infinity],s=>s.plate.origin=Array(3),
  s=>s.mesh.nx=1,s=>s.mesh.ny=2.5,s=>s.mesh.nx=33,s=>s.mesh={nx:32,ny:32},
  s=>s.supports.preset='COLUMN',s=>s.units.length='mm',s=>s.fixture='real',s=>s.technicalApproval=true,s=>s.fullBuildingAnalysis=true,
  s=>s.loads.superDeadLoad=-1,s=>s.loads.liveLoad='',s=>s.loads.slabSelfWeight='true',s=>s.loads.permanentAreaLoad=6.2,
  s=>s.loads.frameAllowance=1.15,s=>s.floorShares=[],s=>s.plate.holes=[],s=>s.plate.polygon=[],s=>s.model={},s=>s.result={passed:true},s=>s.material.G=1,
 ];
 for(const mutate of mutations){const s=createShellExamples()[0];mutate(s);assert.throws(()=>prepareShellSource(s));}
 for(const s of [null,[],{},undefined])assert.throws(()=>prepareShellSource(s));
 assert.throws(()=>createShellExamples('invalid'));assert.throws(()=>createShellExamples('SS-H','unknown'));
});
test('S1 rejects coordinate precision collapse and overflowed geometry or loads',()=>{
 for(const mutate of [s=>s.plate.origin=[1e30,0,0],s=>{s.plate.width=1e308;s.plate.depth=1e308;},s=>s.loads.liveLoad=1e308,s=>{s.material.unitWeight=Number.MIN_VALUE;s.plate.thickness=.01;}]){
  const s=createShellExamples()[0];mutate(s);assert.throws(()=>prepareShellSource(s));
 }
});
test('S1 source identity is deterministic after JSON reload and caller mutations cannot alter a sealed record',async()=>{
 const s=createShellExamples()[0],r=await recordShellSource(s);
 assert.equal(await verifyShellSourceRecord(r,JSON.parse(JSON.stringify(s))),true);
 assert.equal((await recordShellSource(Object.fromEntries(Object.entries(s).reverse()))).id,r.id);
 s.plate.width=12;assert.equal(r.content.source.plate.width,10);assert.equal(await verifyShellSourceRecord(r,s),false);
});
test('S1 geometry material load mesh supports and revision changes invalidate previous source identities',async()=>{
 const base=createShellExamples()[0],r=await recordShellSource(base);
 for(const mutate of [s=>s.plate.origin[2]=1,s=>s.plate.thickness=.2,s=>s.material.E*=2,s=>s.material.nu=.3,s=>s.material.unitWeight=30,s=>s.loads.superDeadLoad=3,s=>s.loads.slabSelfWeight=false,s=>s.mesh.nx=16,s=>s.supports.preset='CL',s=>s.revision='ORNEK-SHELL-02',s=>s.projectId='OTHER']){
  const s=structuredClone(base);mutate(s);assert.equal(await verifyShellSourceRecord(r,s),false);assert.notEqual((await recordShellSource(s)).id,r.id);
 }
});
test('S1 rehashed mesh support load or approval tampering cannot masquerade as an original source record',async()=>{
 const base=createShellExamples()[0],record=await recordShellSource(base);
 for(const mutate of [c=>c.model.elements[0].nodeIds.reverse(),c=>c.model.nodes[0].x=1,c=>c.model.supports[0].fixed[0]=false,c=>c.model.loadCases.find(v=>v.id==='G').areaLoad=7.35,c=>c.technicalApproval=true,c=>c.calculation={id:'FAKE'}]){
  const r=structuredClone(record);mutate(r.content);r.sha256=await traceSha256(traceJson(r.content));r.id='SHELL-SOURCE-'+r.sha256;
  assert.equal(await verifyShellSourceRecord(r,base),false);
 }
 assert.equal(await verifyShellSourceRecord({...record,id:'FRAME-'+record.sha256},base),false);
});
test('S1 example sources are isolated and cannot be passed to the old frame solver',async()=>{
 const {solveLinearFrame}=await import('../app/lib/linear-frame.ts'),a=createShellExamples(),b=createShellExamples();
 a[0].plate.width=999;a[0].units.length='mm';assert.equal(b[0].plate.width,10);assert.equal(b[0].units.length,'m');assert.equal(a[1].plate.width,20);
 for(const s of b){assert.throws(()=>solveLinearFrame(s));assert.throws(()=>solveLinearFrame(prepareShellSource(s).model));}
});
