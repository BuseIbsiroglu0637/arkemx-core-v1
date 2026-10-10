import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { registerHooks } from 'node:module';
registerHooks({resolve(s,c,next){if(s.startsWith('.')&&!path.extname(s)){const u=new URL(s+'.ts',c.parentURL);if(fs.existsSync(fileURLToPath(u)))return next(u.href,c);}return next(s,c);}});
const { migrateFloorPlateIds, reconcileFloorPlateIds } = await import('../app/lib/floor-plate-identity.ts');
const { createProjectShellDraft, projectShellBasis, inspectProjectShellSource, validateProjectShellSource } = await import('../app/lib/project-shell-source.ts');
const { floorCoordinationBasis } = await import('../app/lib/floor-coordination.ts');
const { prepareShellSource } = await import('../app/lib/shell-source.ts');
const { createProjectShellFixture, createProjectShellFixtureSource } = await import('./fixtures/project-shell-project.mjs');
const rebasis = project => { const plan = project.modules['plan-editor']; plan.floorCoordination.basis = floorCoordinationBasis(plan); };
const rejected = (project, source) => { const report = inspectProjectShellSource(project, source); assert.equal(report.status, 'pending'); assert.equal(report.source, null); assert.equal(report.calculation, null); return report.issues.join(' '); };

test('S4-A01 legacy identity migration is explicit, deterministic, immutable and survives JSON restore', () => {
  const p = createProjectShellFixture({legacy:true}), plates = p.modules['plan-editor'].floorPlates, original = structuredClone(plates);
  assert.throws(() => createProjectShellDraft(p, 'unknown'), /kimlik/);
  const migrated = migrateFloorPlateIds(plates, p.id);
  assert.deepEqual(plates, original);
  assert.deepEqual(migrated.map(({id,...geometry}) => { void id; return geometry; }), original);
  assert.deepEqual(migrateFloorPlateIds(JSON.parse(JSON.stringify(migrated)), p.id), migrated);
  assert.notEqual(migrated[0].id, migrated[1].id);
  assert.notEqual(migrateFloorPlateIds(plates, 'OTHER')[0].id, migrated[0].id);
  for (const bad of [[{level:1,id:'x'},{level:2,id:'x'}],[{level:1},{level:1}],[{level:1,id:' '}],[{level:1,id:null}]]) assert.throws(() => migrateFloorPlateIds(bad, p.id));
});
test('S4-A01 floor identity follows resizing and reorder; deleting then recreating allocates a fresh identity', () => {
  let serial=0; const next=()=>`PLATE:test:${++serial}`;
  const first=reconcileFloorPlateIds([{level:1,width:10},{level:2,width:20}],[],next);
  const edited=reconcileFloorPlateIds([{level:2,width:25},{level:1,width:12}],first,next);
  assert.deepEqual(edited.map(p=>p.id),[first[1].id,first[0].id]); assert.equal(serial,2);
  const deleted=reconcileFloorPlateIds([{level:1,width:12}],edited,next);
  const recreated=reconcileFloorPlateIds([{level:1,width:12},{level:2,width:25}],deleted,next);
  assert.equal(recreated[0].id,first[0].id); assert.notEqual(recreated[1].id,first[1].id);
  assert.throws(()=>reconcileFloorPlateIds([{level:1},{level:2}],[],()=> 'duplicate'));
});
test('S4-A01 both synthetic project plates validate with explicit independent boundary and mid-surface declarations', () => {
  const p=createProjectShellFixture();
  for(const level of [1,2]) {
    const s=createProjectShellFixtureSource(p,level), r=inspectProjectShellSource(p,s);
    assert.equal(r.status,'source-validated',r.issues.join(' ')); assert.equal(r.calculation,null);
    assert.equal(r.technicalApproval,false); assert.equal(r.fullBuildingAnalysis,false);
    assert.equal(s.plate.width*s.plate.depth,level===1?100:200);
    assert.throws(()=>prepareShellSource(s),/eksik|desteklenmeyen/);
    r.source.plate.width=123; assert.notEqual(s.plate.width,123);
  }
});
test('S4-A01 drafts leave unknown physical inputs and source provenance blank; explicit zero loads and offset are accepted', () => {
  const p=createProjectShellFixture(), s=createProjectShellFixtureSource(p);
  const draft=createProjectShellDraft(p,s.sourcePlateId); assert.equal(draft.material.E,null); assert.equal(draft.supports.preset,null); assert.equal(draft.midSurfaceReference.offsetZ,null);
  rejected(p,draft);
  for(const mutate of [s=>s.material.E=null,s=>s.plate.thickness='',s=>s.loads.liveLoad=null,s=>s.supports.preset=null,s=>s.midSurfaceReference.offsetZ=null,s=>s.provenance.reference='']) { const bad=structuredClone(s); mutate(bad); rejected(p,bad); }
  s.loads={slabSelfWeight:false,superDeadLoad:0,liveLoad:0,benchmarkLoad:0}; validateProjectShellSource(p,s);
  s.midSurfaceReference.offsetZ=.1; s.plate.origin[2]=.1; validateProjectShellSource(p,s);
});
test('S4-A01 rejects foreign projects, revisions, stamps, unsupported units and mismatched plate identity/geometry', () => {
  const p=createProjectShellFixture(), s=createProjectShellFixtureSource(p);
  for(const mutate of [s=>s.projectId='FOREIGN',s=>s.revision='P99',s=>s.sourcePlateId='FOREIGN',s=>s.plate.id='OTHER',s=>s.plate.sourceLevel=2,s=>s.plate.width+=1,s=>s.plate.origin[0]+=1,s=>s.plate.origin[2]=3.4,s=>s.units={...s.units,length:'mm'},s=>s.technicalApproval=true,s=>s.fullBuildingAnalysis=true]) { const bad=structuredClone(s); mutate(bad); rejected(p,bad); }
  for(const mutate of [p=>p.modules['plan-editor']._kernel.projectId='FOREIGN',p=>delete p.modules['plan-editor']._kernel,p=>p.coordinateReference='',p=>p.modules['plan-editor'].floorPlates[1].id=p.modules['plan-editor'].floorPlates[0].id]) { const bad=structuredClone(p);mutate(bad);rejected(bad,s); }
});
test('S4-A01 rejects unknown/duplicate/cross-floor element references, sparse arrays and hidden unsupported geometry', () => {
  const p=createProjectShellFixture(), s=createProjectShellFixtureSource(p);
  for(const refs of [['foreign'],['L-A','L-A'],['U-A'],new Array(1)]) rejected(p,{...s,sourceElementIds:refs});
  for(const mutate of [s=>s.geometry.rotation=10,s=>s.geometry.plane='XZ',s=>s.plate.holes=[],s=>s.supports={preset:'point-column'},s=>s.loads.extra=1]) { const bad=structuredClone(s); mutate(bad);rejected(p,bad); }
  for(const change of ['opening','polygon']) { const bad=structuredClone(p), plan=bad.modules['plan-editor']; if(change==='opening')plan.elements.push({id:'HOLE',type:'opening',level:1,x:0,y:0,provenance:'manual'}); else plan.floorPlates[0].polygon=[[0,0],[1,0],[1,1]]; rebasis(bad); const source=createProjectShellFixtureSource(bad); assert.match(rejected(bad,source),/Boşluk|Dikdörtgen/); }
});
test('S4-A01 requires revalidation after geometry, placement, material-source or project context changes', () => {
  const p=createProjectShellFixture(), s=createProjectShellFixtureSource(p);
  for(const mutate of [p=>p.modules['plan-editor'].floorPlates[0].width+=1,p=>p.modules['plan-editor'].floorCoordination.placements[0].x+=1,p=>p.modules['plan-editor'].elements[0].load+=1,p=>p.coordinateReference='OTHER DATUM',p=>p.revision='P99']) { const bad=structuredClone(p);mutate(bad);rejected(bad,s); }
  const rechecked=structuredClone(p); rechecked.modules['plan-editor'].floorPlates[0].width=12; rebasis(rechecked);
  rejected(rechecked,s); validateProjectShellSource(rechecked,createProjectShellFixtureSource(rechecked));
});
test('S4-A01 presentation selection and array order do not invalidate the source, and storing it does not change its basis', () => {
  const p=createProjectShellFixture(), s=createProjectShellFixtureSource(p), before=projectShellBasis(p), plan=p.modules['plan-editor'];
  plan.level=1;plan.floorPlates.reverse();plan.elements.reverse();plan.floorCoordination.placements.reverse();plan.floorCoordination.beams.reverse();
  plan.projectShellSources={[s.sourcePlateId]:structuredClone(s)};p.updatedAt='later';
  assert.equal(projectShellBasis(p),before);validateProjectShellSource(p,s);
});
test('S4-A01 refuses numerical overflow, underflow, collapsed mesh spacing and lost mid-surface offsets', () => {
  const p=createProjectShellFixture(), s=createProjectShellFixtureSource(p);
  for(const mutate of [s=>s.loads.liveLoad=1e308,s=>{s.material.unitWeight=1e308;s.plate.thickness=10;},s=>{s.plate.thickness=1e-300;s.material.unitWeight=1e-300;}]) { const bad=structuredClone(s);mutate(bad);assert.match(rejected(p,bad),/türev/); }
  const huge=structuredClone(p);huge.modules['plan-editor'].floorCoordination.placements[0].x=1e16;rebasis(huge); assert.match(rejected(huge,createProjectShellFixtureSource(huge)),/koordinat/);
  const offset=structuredClone(p);offset.modules['plan-editor'].floorCoordination.placements[1].z=1e16;const source=createProjectShellFixtureSource(offset,2); source.midSurfaceReference.offsetZ=.1;assert.match(rejected(offset,source),/kot/);
});
test('S4-A01 synthetic project cannot impersonate a real project, and real declarations cannot inherit synthetic provenance', () => {
  const p=createProjectShellFixture(), s=createProjectShellFixtureSource(p);
  assert.match(rejected(p,{...s,provenance:{kind:'user-declared-project',reference:'CLAIM'}}),/Sentetik/);
  delete p.modules['plan-editor'].example;
  assert.match(rejected(p,s),/işaretli/);
  const declared={...s,provenance:{kind:'user-declared-project',reference:'User declaration pending official review'}};
  validateProjectShellSource(p,declared); assert.equal(declared.technicalApproval,false);
});
