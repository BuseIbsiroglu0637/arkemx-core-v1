import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { registerHooks } from 'node:module';
registerHooks({ resolve(s, c, next) { if (s.startsWith('.') && !path.extname(s)) { const u = new URL(s + '.ts', c.parentURL); if (fs.existsSync(fileURLToPath(u))) return next(u.href, c); } return next(s, c); } });
const { createG05ReviewFixture } = await import('./fixtures/g05-review-project.mjs');
const { planGeometrySnapshot } = await import('../app/lib/source-reference-integrity.ts');
const { createDocumentIdentity, documentFingerprint } = await import('../app/lib/document-identity.ts');
const { prepareStructuralCalculation, recordStructuralCalculation, verifyStructuralCalculation, createStructuralDocument, sealStructuralDocument, verifyStructuralDocument, traceJson } = await import('../app/lib/structural-traceability.ts');
const { createGridDxf } = await import('../app/lib/engineering.ts');

export function uniformFixture() {
  const p = createG05ReviewFixture(); p.experience.autoHandoff = false;
  const plan = p.modules['plan-editor'], structure = p.modules['structural-concept'];
  plan.floorPlates = [{ level: 1, width: 10, depth: 10 }, { level: 2, width: 10, depth: 10 }];
  structure.inputGeometrySnapshot = planGeometrySnapshot(plan);
  structure.inputElementSnapshot = structuredClone(plan.elements);
  structure.modelContext.floorPlates = structuredClone(plan.floorPlates);
  structure.geometrySupport.status = 'uniform-concept-only';
  const input = { system: 'concrete', usage: 'industrial', width: 10, depth: 10, floors: 2, floorHeight: 3.4, baysX: 2, baysY: 2, columnSize: .5, beamDepth: .6, slabThickness: .16, superDeadLoad: 2.2, liveLoad: 3.5, roofSnowLoad: .75, basicWindSpeed: 30, sds: 1, sd1: .45, importance: 1, behaviorFactor: 6, concreteStrength: 30, steelYield: 355 };
  structure.input = input;
  const options = { designBasis: 'tr', soilClass: 'ZD', repetition: 70, transportDistance: 120, fireRating: 90 };
  return { p, input, options };
}
async function linked() {
  const f = uniformFixture();
  return { ...f, record: await recordStructuralCalculation(prepareStructuralCalculation(f.p, f.input, f.options)) };
}
test('B04 real uniform calculation binds complete source snapshots, inputs and actual results', async () => {
  const { p, input, options, record } = await linked();
  assert.equal(record.content.result.geometry.totalArea, 200);
  assert.deepEqual(record.content.source.elements.map(e => e.id).sort(), p.modules['plan-editor'].elements.map(e => e.id).sort());
  assert.equal(await verifyStructuralCalculation(record, p, input, options), true);
  assert.equal(record.content.technicalApproval, false);
});
test('B04 record identity survives JSON reload and source object/element order changes', async () => {
  const { p, input, options, record } = await linked();
  const next = JSON.parse(JSON.stringify(p)); next.modules['plan-editor'].elements.reverse(); next.modules['plan-editor'].floorPlates.reverse(); next.modules['structural-concept'].modelContext.floorPlates.reverse();
  assert.equal(await verifyStructuralCalculation(JSON.parse(JSON.stringify(record)), next, input, options), true);
  assert.equal((await recordStructuralCalculation(prepareStructuralCalculation(next, input, options))).id, record.id);
});
test('B04 input/load/standard changes invalidate old calculation and produce distinct records', async () => {
  const { p, input, options, record } = await linked();
  for (const change of [{ input: { ...input, liveLoad: 8 }, options }, { input, options: { ...options, soilClass: 'ZE' } }, { input, options: { ...options, designBasis: 'eu' } }]) {
    assert.equal(await verifyStructuralCalculation(record, p, change.input, change.options), false);
    assert.notEqual((await recordStructuralCalculation(prepareStructuralCalculation(p, change.input, change.options))).id, record.id);
  }
});
test('B04 changed source content and foreign project/revision cannot reuse a record', async () => {
  const { p, input, options, record } = await linked();
  for (const mutate of [p => p.id = 'FOREIGN', p => p.revision = 'P03', p => p.modules['plan-editor'].elements[0].load = 9]) {
    const next = structuredClone(p); mutate(next);
    assert.equal(await verifyStructuralCalculation(record, next, input, options), false);
  }
});
test('B04 tampered result is rejected even if its content hash was recomputed', async () => {
  const { p, input, options, record } = await linked();
  const content = structuredClone(record.content); content.result.geometry.totalArea = 999;
  assert.equal(await verifyStructuralCalculation(await recordStructuralCalculation(content), p, input, options), false);
  record.sha256 = 'fake'; assert.equal(await verifyStructuralCalculation(record, p, input, options), false);
});
test('B04 a new explicitly linked revision gets its own calculation and document identity', async () => {
  const { p, input, options, record } = await linked();
  const previous = await createStructuralDocument(record, p, input, options, 'JSON');
  p.revision = 'P03';
  for (const module of Object.values(p.modules)) module._kernel.projectRevision = 'P03';
  p.modules['structural-concept'].sourceRevision = 'P03';
  p.modules['structural-concept'].modelContext.planRevision = 'P03';
  const next = await recordStructuralCalculation(prepareStructuralCalculation(p, input, options));
  assert.notEqual(next.id, record.id);
  const document = await createStructuralDocument(next, p, input, options, 'JSON');
  assert.equal(document.revision, 'P03');
  assert.notEqual(document.identity.reference, previous.identity.reference);
  assert.equal(await verifyStructuralCalculation(record, p, input, options), false);
});
test('B04 missing source, invalid units, changed model and nonuniform floors create no linked calculation', () => {
  for (const mutate of [p => delete p.modules['structural-concept'].inputElementSnapshot, p => p.modules['structural-concept'].units.length = 'mm', p => p.modules['plan-editor'].floorPlates[1].width = 20, p => p.modules = {}]) {
    const { p, input, options } = uniformFixture(); mutate(p);
    assert.equal(prepareStructuralCalculation(p, input, options), null);
  }
  const { p, input, options } = uniformFixture(); assert.equal(prepareStructuralCalculation(p, { ...input, width: 11 }, options), null);
});
test('B04 all four document formats link the same calculation and verify downloaded file bytes', async () => {
  const { p, input, options, record } = await linked();
  for (const format of ['JSON', 'PDF', 'DXF', 'CSV']) {
    const manifest = await createStructuralDocument(record, p, input, options, format);
    const bytes = `${format} synthetic file`;
    const document = await sealStructuralDocument(manifest, `test.${format.toLowerCase()}`, bytes);
    assert.equal(manifest.identity.references.status, 'declared');
    assert.deepEqual(manifest.identity.references.calculationIds, [record.id]);
    assert.equal(await verifyStructuralDocument(document, { [record.id]: record }, p, input, options, bytes), true);
    assert.equal(await verifyStructuralDocument(document, {}, p, input, options, bytes), false);
    assert.equal(await verifyStructuralDocument(document, { [record.id]: record }, p, input, options, bytes + 'tampered'), false);
    document.manifest.elementIds = ['DANGLING'];
    assert.equal(await verifyStructuralDocument(document, { [record.id]: record }, p, input, options, bytes), false);
  }
});
test('B04 listing an ID without calculation source bindings never declares a complete chain', () => {
  const identity = createDocumentIdentity({ projectCode: 'P', module: 'STR', revision: 'P02', sourceRevision: 'P02', elementIds: ['E'], calculationIds: ['C'], sourceContext: { projectId: 'P', revision: 'P02', elementIds: ['E'], calculationIds: ['C'] } });
  assert.equal(identity.references.status, 'unsupported');
});
test('B04 legacy documents without content digest keep their existing fingerprints', () => {
  assert.equal(createDocumentIdentity({ projectCode: 'TEST', module: 'STR', revision: 'P02' }).fingerprint, documentFingerprint(['TEST', 'STR', undefined, 'P02', undefined, undefined, undefined, undefined]));
});
test('B04 DXF carries its source/calculation manifest as a standard comment', async () => {
  const { p, input, options, record } = await linked();
  const manifest = await createStructuralDocument(record, p, input, options, 'DXF');
  const drawing = createGridDxf(10, 10, 2, 2, { traceability: { calculationRecord: record, documentManifest: manifest } });
  const line = drawing.split('\n')[1];
  assert.equal(JSON.parse(line.slice('ARKEMX_TRACEABILITY '.length)).calculationRecord.id, record.id);
});
test('B04 nonfinite evidence is rejected rather than silently encoded as null', () => assert.throws(() => traceJson({ result: NaN }), /Unsupported/));
