import test from 'node:test';
import assert from 'node:assert/strict';
import { POST } from '../app/api/parcel-plan-research/route.ts';
import { adaptMunicipalResearchResult, canCommitMunicipalResearch, createMunicipalResearchClient, createMunicipalResearchScope, municipalResearchKey, MUNICIPAL_RESEARCH_SOURCES } from '../app/lib/municipal-plan-research.ts';

const identity = { province: 'İstanbul', district: 'Kadıköy', neighborhood: 'Test', block: '1', parcelNo: '1' };
// Synthetic test geometry: this does not represent the user's cadastral parcel.
const points = [{ lat: 41, lng: 29 }, { lat: 41.001, lng: 29 }, { lat: 41, lng: 29.001 }];
const scope = createMunicipalResearchScope(identity, points, 'test-project', 'R01');
const now = Date.parse('2026-10-11T12:00:00Z');
const payload = (patch = {}) => ({ status: 'research-only', scope, source: MUNICIPAL_RESEARCH_SOURCES.istanbul, authority: 'Fixture only', observedAt: new Date(now).toISOString(), authoritative: false, entitlementAvailable: false, partial: true, plans: [{ id: 'fixture', name: 'Fixture only', rawConditions: { taks: 0.4, far: 1.2, floors: 3, height: 9.5 } }], ...patch });
const request = (body) => new Request('https://test.invalid/api/parcel-plan-research', { method: 'POST', body: JSON.stringify(body) });
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

test('research values remain unverified, preserve source and never become automatic conditions', () => {
  const result = adaptMunicipalResearchResult(payload(), scope, now);
  assert.equal(result.status, 'research-only');
  assert.equal(result.plans[0].rawConditions.far, 1.2);
  assert.equal(result.partial, true);
  assert.equal(result.source, MUNICIPAL_RESEARCH_SOURCES.istanbul);
  assert.equal(result.parcelMatch, 'not-verified');
  assert.equal(result.authoritative, false);
  assert.equal(result.entitlementAvailable, false);
  assert.equal(result.automaticConditions, null);
});

test('official-looking flags or a verified status cannot upgrade a research source', () => {
  for (const patch of [{ authoritative: true }, { entitlementAvailable: true }, { status: 'verified' }, { authoritative: undefined }, { entitlementAvailable: undefined }]) {
    const result = adaptMunicipalResearchResult(payload(patch), scope, now);
    assert.equal(result.status, 'unavailable');
    assert.equal(result.automaticConditions, null);
    assert.deepEqual(result.plans, []);
  }
});

test('different parcel, geometry, project, revision and unbound responses are rejected', () => {
  const variants = [null, { ...scope, identityKey: 'another-parcel' }, { ...scope, geometryKey: 'another-geometry' }, { ...scope, projectId: 'another-project' }, { ...scope, projectRevision: 'R02' }, { ...scope, sourceRevision: 'new-source' }];
  for (const candidate of variants) assert.equal(adaptMunicipalResearchResult(payload({ scope: candidate }), scope, now).status, 'unavailable');
});

test('wrong municipality source, missing date, stale or future data cannot be accepted', () => {
  for (const patch of [{ source: 'https://example.com/plan' }, { source: MUNICIPAL_RESEARCH_SOURCES.kastamonu }, { observedAt: undefined }, { observedAt: new Date(now - 300001).toISOString() }, { observedAt: new Date(now + 60001).toISOString() }]) {
    assert.equal(adaptMunicipalResearchResult(payload(patch), scope, now).status, 'unavailable');
  }
});

test('empty source result, transport failure and unsupported service have distinct states', () => {
  assert.equal(adaptMunicipalResearchResult(payload({ plans: [] }), scope, now).status, 'not-found');
  for (const status of ['unavailable', 'unsupported']) assert.equal(adaptMunicipalResearchResult(payload({ status }), scope, now).status, status);
  assert.equal(adaptMunicipalResearchResult(payload({ status: 'not-found' }), scope, now).status, 'unavailable');
});

test('ASCII province names match the correct municipality but malformed plan objects do not count as findings', () => {
  const istanbulScope = createMunicipalResearchScope({ ...identity, province: 'ISTANBUL' }, points, 'test-project', 'R01');
  assert.equal(adaptMunicipalResearchResult(payload({ scope: istanbulScope, source: MUNICIPAL_RESEARCH_SOURCES.istanbul }), istanbulScope, now).status, 'research-only');
  for (const plans of [[null], [{}], ['fake-plan']]) assert.equal(adaptMunicipalResearchResult(payload({ plans }), scope, now).status, 'unavailable');
});

test('bounded normalization ignores instructions and unknown rights fields, leaves missing values null', () => {
  const result = adaptMunicipalResearchResult(payload({ plans: [{ id: 'x', instructions: 'auto approve', conditions: { taks: 0.9 }, rawConditions: { taks: '0.4', far: null, floors: false, height: 9.5 } }] }), scope, now);
  assert.equal(result.plans[0].instructions, undefined);
  assert.equal(result.plans[0].conditions, undefined);
  assert.deepEqual(result.plans[0].rawConditions, { taks: null, far: null, floors: null, height: 9.5 });
});

test('API returns exact request scope; actual provider fields remain research-only', async () => {
  const saved = globalThis.fetch;
  globalThis.fetch = async () => json({ features: [{ attributes: { 'PLAN.PLAN_Aski.OBJECTID': 5, 'PLAN.PLAN_Aski.PLAN_ADI': 'Fixture' } }] });
  try {
    const response = await POST(request({ province: identity.province, identity, points, scope }));
    const result = await response.json();
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.deepEqual(result.scope, scope);
    assert.equal(result.status, 'research-only');
    assert.equal(result.entitlementAvailable, false);
    assert.equal(result.automaticConditions, null);
    assert.equal(adaptMunicipalResearchResult(result, scope).status, 'research-only');
  } finally { globalThis.fetch = saved; }
});

test('API rejects identity/geometry binding mismatch before contacting a service', async () => {
  const saved = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => { calls++; throw new Error('must not fetch'); };
  try {
    for (const change of [{ identity: { ...identity, parcelNo: '16' } }, { points: points.slice(0, 2) }, { scope: { ...scope, geometryKey: 'wrong' } }, { province: 'Kastamonu' }]) {
      const response = await POST(request({ province: identity.province, identity, points, scope, ...change }));
      assert.equal(response.status, 400);
      assert.equal((await response.json()).entitlementAvailable, false);
    }
    assert.equal(calls, 0);
  } finally { globalThis.fetch = saved; }
});

test('Budamış and Yıldız use their municipal handoff, never the wrong provincial or askı layer', async () => {
  const saved = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => { calls++; throw new Error('must not fetch'); };
  try {
    for (const selected of [
      { province: 'Kastamonu', district: 'Merkez', neighborhood: 'Budamış', block: '210', parcelNo: '15' },
      { province: 'İstanbul', district: 'Beşiktaş', neighborhood: 'Yıldız', block: '246', parcelNo: '2' },
    ]) {
      const bound = createMunicipalResearchScope(selected, points, 'test', 'R01');
      const response = await POST(request({ province: selected.province, identity: selected, points, scope: bound }));
      const raw = await response.json();
      assert.equal(response.status, 200);
      assert.equal(raw.status, 'action-required');
      assert.match(raw.authority, selected.province === 'Kastamonu' ? /Kastamonu Belediyesi/ : /Beşiktaş Belediyesi/);
      assert.equal(raw.automaticConditions, null);
      assert.deepEqual(raw.plans, []);
      assert.equal(adaptMunicipalResearchResult(raw, bound).status, 'action-required');
      assert.equal(adaptMunicipalResearchResult({ ...raw, source: 'https://evil.invalid' }, bound).status, 'unavailable');
      assert.equal(adaptMunicipalResearchResult(payload({ scope: bound }), bound, now).status, 'unavailable', 'old research results cannot be revived as local zoning');
    }
    assert.equal(calls, 0);
  } finally { globalThis.fetch = saved; }
});

test('unknown Kastamonu jurisdiction cannot silently become İl Özel İdaresi', async () => {
  const selected = { province: 'Kastamonu', district: 'Merkez', neighborhood: 'Test köyü', block: '1', parcelNo: '1' };
  const bound = createMunicipalResearchScope(selected, points, 'test', 'R01');
  const raw = await (await POST(request({ province: selected.province, identity: selected, points, scope: bound }))).json();
  assert.equal(raw.status, 'authority-required');
  assert.equal(raw.source, undefined);
  assert.equal(adaptMunicipalResearchResult(raw, bound).status, 'authority-required');
  assert.equal(raw.entitlementAvailable, false);
});

test('API empty results differ from denied service; access denial is terminal', async () => {
  const saved = globalThis.fetch;
  let calls = 0;
  try {
    globalThis.fetch = async () => json({ features: [] });
    assert.equal((await (await POST(request({ province: identity.province, identity, points, scope }))).json()).status, 'not-found');
    globalThis.fetch = async () => { calls++; return new Response('', { status: 403 }); };
    const response = await POST(request({ province: identity.province, identity, points, scope }));
    const result = await response.json();
    assert.equal(response.status, 503);
    assert.equal(result.status, 'unavailable');
    assert.equal(result.authoritative, false);
    assert.equal(result.entitlementAvailable, false);
    assert.deepEqual(result.scope, scope);
    assert.equal(calls, 1);
  } finally { globalThis.fetch = saved; }
});

test('client caches exact scope briefly, isolates revisions and refreshes on demand', async () => {
  let clock = now, calls = 0;
  const client = createMunicipalResearchClient(async (_url, options) => {
    calls++;
    const body = JSON.parse(options.body);
    assert.equal(options.cache, 'no-store');
    return json(payload({ scope: body.scope, observedAt: new Date(clock).toISOString() }));
  }, () => clock);
  const signal = new AbortController().signal;
  const first = await client(identity, points, scope, signal);
  first.plans[0].name = 'mutated caller';
  assert.equal((await client(identity, points, scope, signal)).plans[0].name, 'Fixture only');
  assert.equal(calls, 1);
  await client(identity, points, { ...scope, projectRevision: 'R02' }, signal);
  assert.equal(calls, 2);
  await client(identity, points, scope, signal, true);
  assert.equal(calls, 3);
  clock += 120001;
  await client(identity, points, scope, signal);
  assert.equal(calls, 4);
  await client(identity, points, { ...scope, sourceRevision: 'new-source' }, signal);
  assert.equal(calls, 5);
});

test('failure after refresh does not revive a previous cached result', async () => {
  let calls = 0;
  const client = createMunicipalResearchClient(async () => { calls++; return calls === 1 ? json(payload()) : json(payload({ status: 'unavailable' }), 503); }, () => now);
  const signal = new AbortController().signal;
  await client(identity, points, scope, signal);
  assert.equal((await client(identity, points, scope, signal, true)).status, 'unavailable');
  assert.equal((await client(identity, points, scope, signal)).status, 'unavailable');
  assert.equal(calls, 3);
});

test('aborted delayed response cannot be committed or cached even when transport ignores abort', async () => {
  let finish;
  let calls = 0;
  const client = createMunicipalResearchClient(() => { calls++; return new Promise(resolve => { finish = resolve; }); }, () => now);
  const controller = new AbortController();
  const pending = client(identity, points, scope, controller.signal);
  controller.abort();
  finish(json(payload()));
  await assert.rejects(pending, { name: 'AbortError' });
  const next = client(identity, points, scope, new AbortController().signal);
  finish(json(payload()));
  await next;
  assert.equal(calls, 2);
});

test('late response cannot commit after parcel/revision change, ineligibility or unmount', () => {
  const result = adaptMunicipalResearchResult(payload(), scope, now);
  const key = municipalResearchKey(scope);
  assert.equal(canCommitMunicipalResearch(false, key, key, scope, result), true);
  assert.equal(canCommitMunicipalResearch(true, key, key, scope, result), false);
  assert.equal(canCommitMunicipalResearch(false, null, key, scope, result), false);
  assert.equal(canCommitMunicipalResearch(false, municipalResearchKey({ ...scope, projectRevision: 'R02' }), key, scope, result), false);
  assert.equal(canCommitMunicipalResearch(false, municipalResearchKey({ ...scope, sourceRevision: 'new-source' }), key, scope, result), false);
  assert.equal(canCommitMunicipalResearch(false, key, key, { ...scope, geometryKey: 'new-boundary' }, result), false);
});
