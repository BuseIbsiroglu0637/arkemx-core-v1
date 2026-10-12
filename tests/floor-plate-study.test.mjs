import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { registerHooks } from 'node:module';
registerHooks({ resolve(s, c, next) { if (s.startsWith('.') && !path.extname(s)) { const u = new URL(s + '.ts', c.parentURL); if (fs.existsSync(fileURLToPath(u))) return next(u.href, c); } return next(s, c); } });
const { createG05ReviewFixture } = await import('./fixtures/g05-review-project.mjs');
const { planGeometrySnapshot, runSupportedStructuralAnalysis } = await import('../app/lib/source-reference-integrity.ts');
const { calculateFloorPlateStudy, recordFloorStudy, verifyFloorStudy, floorStudyDocument, sealFloorStudyDocument, verifyFloorStudyDocument } = await import('../app/lib/floor-plate-study.ts');
const { floorPlateAreaCheck } = await import('../app/lib/floor-plate-precision.ts');
const { deriveProgramFloorPlates } = await import('../app/lib/plan-program.ts');

test('program producer and area validator agree across floor sizes and aspect ratios',()=>{
  for(const unitArea of [12.345,87.65,416,1000,10000]) for(const aspect of [.55,1.55,2.5]) {
    const plates=deriveProgramFloorPlates([{id:'S1',name:'Sentetik mahal',unitArea,count:4}],[],4,78,aspect);
    for(const plate of plates) assert.equal(floorPlateAreaCheck(plate.width,plate.depth,plate.grossArea).valid,true,JSON.stringify(plate));
  }
});

test('rounded source dimensions accept 6JR differences while area and loads use actual geometry',()=>{
  const {p,input}=fixture();const plan=p.modules['plan-editor'];
  plan.floorPlates=[{level:1,width:28.752,depth:18.55,grossArea:533.33},{level:2,width:17.38,depth:11.213,grossArea:194.87}];refresh(p);
  const {study,issues}=calculateFloorPlateStudy(p,input);
  assert.deepEqual(issues,[]);assert.ok(study);
  assert.equal(study.floors[0].area,28.752*18.55);
  assert.equal(study.floors[1].area,17.38*11.213);
  assert.equal(study.floors[0].areaConsistency.roundingAccepted,true);
  assert.equal(study.floors[1].areaConsistency.roundingAccepted,true);
  assert.equal(study.floors[0].loads.liveTotal,study.floors[0].area*study.floors[0].loads.liveArea);
  assert.equal(study.fullBuildingAnalysis,false);assert.equal(study.technicalApproval,false);
  plan.floorPlates[0].grossArea=533.30;refresh(p);
  assert.equal(calculateFloorPlateStudy(p,input).study,null);
});
test('precision bound covers dimension rounding, not arbitrary percentage differences',()=>{
  assert.equal(floorPlateAreaCheck(28.752,18.55,533.33).valid,true);
  assert.equal(floorPlateAreaCheck(28.752,18.55,533.30).valid,false);
  assert.equal(floorPlateAreaCheck(28.752,18.55,533.32).valid,false);
  assert.equal(floorPlateAreaCheck(17.55,11.323,198.72).valid,true);
  assert.equal(floorPlateAreaCheck(17.3801,11.2131,194.87).basis,'unrounded-source-strict-0.01m2');
  assert.equal(floorPlateAreaCheck(17.3801,11.2131,194.87).valid,false);
  for(const area of [-1,0,NaN,Infinity,999]) assert.equal(floorPlateAreaCheck(10,10,area).valid,false);
  for(const size of [0,-1,NaN,Infinity]) assert.equal(floorPlateAreaCheck(size,10,100).valid,false);
  // Both upward and downward rounding at large dimensions exceed the old 0.01 limit.
  for(const [w,d] of [[120.12349,90.45649],[120.12351,90.45651]]) {
    const rw=Number(w.toFixed(3)),rd=Number(d.toFixed(3)),a=Number((w*d).toFixed(2));
    assert.equal(floorPlateAreaCheck(rw,rd,a).valid,true);
    assert.equal(floorPlateAreaCheck(rw,rd,a+1).valid,false);
  }
});
function fixture() {
  const p = createG05ReviewFixture();
  const input = { system: 'concrete', usage: 'industrial', width: 20, depth: 10, floors: 2, floorHeight: 3.4, baysX: 2, baysY: 2, columnSize: .5, beamDepth: .6, slabThickness: .16, superDeadLoad: 2.2, liveLoad: 3.5, roofSnowLoad: .75, basicWindSpeed: 30, sds: 1, sd1: .45, importance: 1, behaviorFactor: 6, concreteStrength: 30, steelYield: 355 };
  return { p, input };
}
function refresh(p) {
  const plan = p.modules['plan-editor'], s = p.modules['structural-concept'];
  s.inputGeometrySnapshot = planGeometrySnapshot(plan);
  s.inputElementSnapshot = structuredClone(plan.elements);
  s.modelContext.floorPlates = structuredClone(plan.floorPlates);
}
test('B06 first step uses 100 + 200 actual floor areas, loads and slab quantities instead of copying selected floor', () => {
  const { p, input } = fixture(); const { study, issues } = calculateFloorPlateStudy(p, input);
  assert.deepEqual(issues, []);
  assert.deepEqual(study.floors.map(f => f.area), [100, 200]);
  assert.equal(study.totals.grossArea, 300);
  assert.ok(Math.abs(study.totals.permanentLoad - 2205) < 1e-9);
  assert.equal(study.totals.liveLoad, 1050);
  assert.equal(study.totals.grossSlabConcreteVolume, 48);
  assert.equal(study.totals.roofSnowLoad, 150);
  assert.equal(study.fullBuildingAnalysis, false);
  assert.equal(study.technicalApproval, false);
  assert.equal(study.dynamics, undefined);
  assert.equal(study.checks, undefined);
});
test('B06 floor load follows the maximum real source load separately for each floor', () => {
  const { p, input } = fixture();
  const element = p.modules['plan-editor'].elements.find(e => e.level === 1); element.load = 6; refresh(p);
  const study = calculateFloorPlateStudy(p, input).study;
  assert.equal(study.floors[0].loads.liveArea, 6); assert.equal(study.floors[0].loads.liveTotal, 600);
  assert.equal(study.floors[1].loads.liveArea, 3.5); assert.equal(study.floors[1].loads.liveTotal, 700);
});
test('B06 missing element loads use the explicit global input and identify that source', () => {
  const { p, input } = fixture(); for (const e of p.modules['plan-editor'].elements) delete e.load; refresh(p);
  const study = calculateFloorPlateStudy(p, { ...input, liveLoad: 4 }).study;
  assert.equal(study.floors[0].liveLoadSource, 'global-input'); assert.equal(study.totals.liveLoad, 1200);
});
test('B06 incomplete, duplicate or out-of-range floor lists, invalid dimensions and contradictory areas are rejected', () => {
  for (const mutate of [p => p.modules['plan-editor'].floorPlates.pop(), p => p.modules['plan-editor'].floorPlates[1].level = 1, p => p.modules['plan-editor'].floorPlates[1].level = 3, p => p.modules['plan-editor'].floorPlates[0].width = 0, p => p.modules['plan-editor'].floorPlates[0].grossArea = 999, p => p.modules['plan-editor'].floorCount = '2', p => p.modules['plan-editor'].floorPlates[0].polygon = []]) {
    const { p, input } = fixture(); mutate(p); refresh(p);
    assert.equal(calculateFloorPlateStudy(p, input).study, null);
  }
});
test('B06 stale source, missing snapshots, invalid units and negative/nonfinite loads stay unavailable', () => {
  for (const mutate of [p => p.revision = 'P03', p => delete p.modules['structural-concept'].inputElementSnapshot, p => p.modules['structural-concept'].units.length = 'mm', p => p.modules['plan-editor'].elements[0].load = -1]) {
    const { p, input } = fixture(); mutate(p);
    assert.equal(calculateFloorPlateStudy(p, input).study, null);
  }
  const { p, input } = fixture(); assert.equal(calculateFloorPlateStudy(p, { ...input, liveLoad: NaN }).study, null);
});
test('B06 study identity survives reordered floors/elements and JSON reload', async () => {
  const { p, input } = fixture(); const record = await recordFloorStudy(calculateFloorPlateStudy(p, input).study);
  const next = JSON.parse(JSON.stringify(p)); next.modules['plan-editor'].floorPlates.reverse(); next.modules['plan-editor'].elements.reverse();
  assert.equal(await verifyFloorStudy(record, next, input), true);
  assert.equal((await recordFloorStudy(calculateFloorPlateStudy(next, input).study)).id, record.id);
});
test('B06 changed source or fabricated results cannot reuse a study, even with a recomputed hash', async () => {
  const { p, input } = fixture(); const record = await recordFloorStudy(calculateFloorPlateStudy(p, input).study);
  const fake = structuredClone(record.content); fake.totals.grossArea = 400;
  assert.equal(await verifyFloorStudy(await recordFloorStudy(fake), p, input), false);
  assert.equal(await verifyFloorStudy(record, p, { ...input, superDeadLoad: 3 }), false);
  p.modules['plan-editor'].floorPlates[1].width = 30;
  assert.equal(await verifyFloorStudy(record, p, input), false);
});
test('B06 documents link the actual study and selected drawing floor, reject missing floors', async () => {
  const { p, input } = fixture(); const record = await recordFloorStudy(calculateFloorPlateStudy(p, input).study);
  const doc = await floorStudyDocument(record, p, input, 'PDF', 2);
  assert.equal(doc.level, 2); assert.equal(doc.studyId, record.id); assert.equal(doc.identity.references.status, 'declared');
  assert.equal(doc.fullBuildingAnalysis, false);
  await assert.rejects(floorStudyDocument(record, p, input, 'DXF', 3));
});
test('B06 independent floor study cannot open the uniform whole-building engine', () => {
  const { p, input } = fixture(); assert.ok(calculateFloorPlateStudy(p, input).study);
  let calls = 0;
  assert.equal(runSupportedStructuralAnalysis(p.modules['structural-concept'], () => { calls++; return {}; }), null);
  assert.equal(calls, 0);
});
test('B06 floor document verification rejects missing studies, altered files and wrong drawing floors', async () => {
  const { p, input } = fixture(), record = await recordFloorStudy(calculateFloorPlateStudy(p, input).study);
  const manifest = await floorStudyDocument(record, p, input, 'DXF', 2);
  const document = await sealFloorStudyDocument(manifest, 'K2.dxf', 'synthetic DXF bytes');
  assert.equal(await verifyFloorStudyDocument(document, { [record.id]: record }, p, input, 'synthetic DXF bytes'), true);
  assert.equal(await verifyFloorStudyDocument(document, {}, p, input, 'synthetic DXF bytes'), false);
  assert.equal(await verifyFloorStudyDocument(document, { [record.id]: record }, p, input, 'altered bytes'), false);
  assert.equal(await verifyFloorStudyDocument({ ...document, technicalApproval: true }, { [record.id]: record }, p, input, 'synthetic DXF bytes'), false);
  assert.equal(await verifyFloorStudyDocument({ ...document, fullBuildingAnalysis: true }, { [record.id]: record }, p, input, 'synthetic DXF bytes'), false);
  document.manifest.level = 1;
  assert.equal(await verifyFloorStudyDocument(document, { [record.id]: record }, p, input, 'synthetic DXF bytes'), false);
});
test('B06 excessive axes and source elements outside declared floor count are rejected', () => {
  for (const mutate of [p => p.modules['plan-editor'].baysX = 100000, p => p.modules['plan-editor'].elements[0].level = 3]) {
    const { p, input } = fixture(); mutate(p); refresh(p);
    assert.equal(calculateFloorPlateStudy(p, input).study, null);
  }
});
