import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { emptyParcelPlanning, planningForParcel, planningInputsReady, parcelDesignReady, restorePlanningScopes } from '../app/lib/parcel-zoning-scope.ts';

const A = JSON.stringify(['sakarya', 'serdivan', 'bahçelievler', '123', '4']);
const B = JSON.stringify(['sakarya', 'serdivan', 'bahçelievler', '123', '5']);
const readyDraft = () => ({ ...emptyParcelPlanning(), inputsConfirmed: true, parkingPer100: 1, netPlotArea: 1000, netAreaBasis: 'Test fixture',
  zoning: { ...emptyParcelPlanning().zoning, taks: .4, kaks: 1.2, hmax: 12, frontSetback: 5, sideSetback: 3, rearSetback: 3, sourceDocument: 'A-plan.pdf' } });

test('A to B has no inherited planning, source evidence, parking or confirmation; return to A retains its own draft', () => {
  const scopes = { [A]: readyDraft() };
  assert.equal(planningForParcel(scopes, A).zoning.sourceDocument, 'A-plan.pdf');
  const b = planningForParcel(scopes, B);
  assert.equal(b.zoning.sourceDocument, '');
  assert.equal(b.zoning.sourceUrl, '');
  assert.equal(b.zoning.verification, 'user-declared');
  assert.equal(b.zoning.taks, 0);
  assert.equal(b.parkingPer100, 0);
  assert.equal(planningInputsReady(b), false);
  assert.equal(planningInputsReady(planningForParcel(scopes, A)), true);
});

test('geometry without parcel-scoped reviewed planning cannot create a design', () => {
  assert.equal(parcelDesignReady(true, true, emptyParcelPlanning()), false);
  assert.equal(parcelDesignReady(false, true, readyDraft()), false);
  assert.equal(parcelDesignReady(true, false, readyDraft()), false);
  assert.equal(parcelDesignReady(true, true, readyDraft()), true);
});

test('unknown and malformed input values fail closed even if checkbox is checked', () => {
  for (const change of [{ taks: 0 }, { taks: 1.1 }, { kaks: NaN }, { hmax: 0 }, { hmax: Infinity }, { sideSetback: -1 }, { rearSetback: 101 }]) {
    const draft = readyDraft(); draft.zoning = { ...draft.zoning, ...change };
    assert.equal(planningInputsReady(draft), false);
  }
  assert.equal(planningInputsReady({ ...readyDraft(), inputsConfirmed: false }), false);
  assert.equal(planningInputsReady({ ...readyDraft(), parkingPer100: NaN }), false);
});

test('only explicit complete identity-scoped data restores, never legacy unscoped records', () => {
  assert.deepEqual(restorePlanningScopes({ zoning: readyDraft().zoning, planning: { maxCoverage: 40 } }), {});
  assert.deepEqual(restorePlanningScopes({ '["sakarya","","","123","4"]': readyDraft() }), {});
  assert.deepEqual(restorePlanningScopes({ [A]: { zoning: {} } }), {});
  const restored = restorePlanningScopes(JSON.parse(JSON.stringify({ [A]: readyDraft() })));
  assert.equal(planningInputsReady(restored[A]), true);
  assert.equal(planningInputsReady(planningForParcel(restored, B)), false);
});

const source = readFileSync(new URL('../app/components/GeoParcelStudio.tsx', import.meta.url), 'utf8');
test('component uses synchronous identity scope and invalidates confirmation on every planning edit', () => {
  assert.match(source, /planningForParcel\(planningScopes, queryIdentity\)/);
  assert.match(source, /inputsConfirmed: false, zoning:/);
  assert.match(source, /inputsConfirmed: false, \.\.\.change/);
  assert.match(source, /if \(!hydrated \|\| !planningHydrated\) return/);
  assert.match(source, /legacyPlanning: legacyPlanning\.current/);
  assert.ok(source.includes('ScopedGeoParcelStudio key={`${project.id}:${context?.signature ?? ""}`}'));
  assert.match(source, /if \(!hydrated\)/);
});

test('model, apply, persistence and expert actions share the design readiness gate', () => {
  assert.match(source, /parcel: designReady \? parcel : \[\]/);
  assert.match(source, /applyMassingAlternative = .*=> \{\s+if \(!designReady\)/);
  assert.match(source, /building: hasPlacedModel \? building : \[\]/);
  assert.match(source, /massingModel: designReady && !conceptMode \? massingModel : null/);
  assert.match(source, /conceptModel: designReady && conceptMode \? massingModel : null/);
  assert.match(source, /selectedMassingId: hasPlacedModel \? activeMassingId : "none"/);
  assert.match(source, /index === 3 && !designReady/);
  assert.match(source, /stage.id === 'export' \? !parcelOutputReady : \['design', 'terrain'\].includes\(stage.id\) \? !designReady/);
});

test('download rejects stale async PDF context and is invalidated on unmount', () => {
  assert.match(source, /if \(!parcelOutputReady \|\| currentExportContext.current !== exportContext\)/);
  assert.match(source, /return \(\) => \{ currentExportContext.current = ""; \}/);
  assert.match(source, /const placementReady = designReady && metrics.buildingFits/);
  assert.match(source, /const exportDisabled = !parcelOutputReady/);
  assert.match(source, /const hasPlacedModel = placementReady && selectedMassingId !== 'none'/);
  const signature = source.match(/const exportContext = JSON.stringify\(\{([^\n]+)\}\)/)?.[1] ?? '';
  for (const field of ['usage', 'system', 'project.name', 'project.revision', 'planningDraft', 'parcel', 'exaggeration', 'terrainLayers']) assert.ok(signature.includes(field), field);
});

test('cancelled restore cannot mark hydration complete before its callback actually runs', () => {
  const start = source.indexOf('if (!hydrated || transferApplied.current) return;');
  const end = source.indexOf('}, [hydrated, project.modules]);', start);
  const restore = source.slice(start, end);
  assert.ok(restore.indexOf('const timer = window.setTimeout(() => {') < restore.indexOf('transferApplied.current = true;'));
  assert.match(restore, /return \(\) => window.clearTimeout\(timer\)/);
  assert.match(restore, /setPlanningHydrated\(true\)/);
});

test('declared plan values are not labelled as permission and gated rendering hides unready massing', () => {
  assert.doesNotMatch(source, /İZİNLİ TABAN|İZİNLİ EMSAL|İzinli taban \/ imar|İzinli emsal alan \/ imar/);
  assert.match(source, /belediye veya uzman onayı değildir/);
  assert.match(source, /if \(hasPlacedModel && terrainLayers\["building-mass"\]/);
  assert.match(source, /viewMode === "terrain" && hasPlacedModel/);
});
