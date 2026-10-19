import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { build } from 'esbuild';
import { Miniflare } from 'miniflare';

// Run the real route in workerd, not Node's fetch. Every outbound request is
// intercepted locally: this regression suite never requires TKGM availability.
const routePath = fileURLToPath(new URL('../app/api/tkgm/route.ts', import.meta.url));
const root = 'https://cbsapi.tkgm.gov.tr/megsiswebapi.v3.1/api/';
const parcelPath = 'parsel/130341/210/15';
const parcel = {
  type: 'Feature',
  properties: { ilId: 59, ilceId: 585, mahalleId: 130341, adaNo: '210', parselNo: '15' },
  // Synthetic square, intentionally not a representation of the named parcel.
  geometry: { type: 'Polygon', coordinates: [[[33.77, 41.37], [33.771, 41.37], [33.771, 41.371], [33.77, 41.371], [33.77, 41.37]]] },
};
const directory = (id, text) => ({ type: 'FeatureCollection', features: [{ type: 'Feature', properties: { id, text } }] });

async function scriptForRoute({ legacyRedirect = false, municipal = false } = {}) {
  const entryPath = municipal ? fileURLToPath(new URL('../app/api/parcel-plan-research/route.ts', import.meta.url)) : routePath;
  let source = await fs.readFile(entryPath, 'utf8');
  if (legacyRedirect) {
    source = source.replace(/redirect:\s*['"]manual['"]/, 'redirect: "error"');
    assert.match(source, /redirect:\s*['"]error['"]/, 'negative control must restore the old unsupported mode');
  }
  const result = await build({
    stdin: { contents: `${source}\nexport default { fetch: ${municipal ? 'POST' : 'GET'} };`, resolveDir: path.dirname(entryPath), sourcefile: entryPath, loader: 'ts' },
    bundle: true,
    platform: 'browser',
    format: 'esm',
    target: 'es2022',
    write: false,
  });
  return result.outputFiles[0].text;
}

async function withWorker(outboundService, callback, options = {}) {
  const worker = new Miniflare({
    modules: true,
    compatibilityDate: '2026-05-01',
    script: await scriptForRoute(options),
    outboundService,
  });
  try { return await callback(worker); }
  finally { await worker.dispose(); }
}

const dispatch = (worker, queryPath) => worker.dispatchFetch(`https://arkem.test/api/tkgm?path=${encodeURIComponent(queryPath)}`);

test('actual workerd route returns official-list IDs and an intact Polygon through bounded JSON decoding', { timeout: 30000 }, async () => {
  const calls = [];
  const responses = new Map([
    ['idariYapi/ilceListe/59', directory(585, 'Merkez')],
    ['idariYapi/mahalleListe/585', directory(130341, 'Budamış')],
    [parcelPath, parcel],
  ]);
  await withWorker(async request => {
    calls.push(request.url);
    assert.equal(request.headers.get('accept'), 'application/json');
    assert.equal(request.headers.has('authorization'), false);
    assert.equal(request.headers.has('cookie'), false);
    assert.ok(request.url.startsWith(root), 'only the fixed upstream is requested');
    const body = responses.get(request.url.slice(root.length));
    assert.ok(body, `unexpected outbound request: ${request.url}`);
    return Response.json(body);
  }, async worker => {
    for (const [queryPath, expected] of responses) {
      const response = await dispatch(worker, queryPath);
      assert.equal(response.status, 200, `${queryPath} must succeed in the deployed runtime`);
      assert.equal(response.headers.get('x-tkgm-source-url'), `${root}${queryPath}`);
      const body = await response.json();
      if (queryPath === parcelPath) assert.deepEqual(body, expected);
      else assert.deepEqual(body.features, expected.features.map(feature => ({ ...feature, properties: { ...feature.properties, id: String(feature.properties.id) } })));
    }
  });
  assert.deepEqual(calls, [...responses.keys()].map(queryPath => `${root}${queryPath}`));
});

test('negative control: old redirect:error fails inside workerd before any upstream request', { timeout: 30000 }, async () => {
  let calls = 0;
  await withWorker(async () => { calls++; return Response.json(parcel); }, async worker => {
    const response = await dispatch(worker, parcelPath);
    assert.equal(response.status, 502, 'the previous mode reproduces the live failure');
    assert.equal(response.headers.get('cache-control'), 'no-store');
  }, { legacyRedirect: true });
  assert.equal(calls, 0, 'workerd rejects redirect:error before transport begins');
});

test('workerd route rejects every redirect without following it or switching API roots', { timeout: 30000 }, async () => {
  let currentStatus = 302;
  const calls = [];
  await withWorker(async request => {
    calls.push(request.url);
    return new Response(null, { status: currentStatus, headers: { location: 'https://untrusted.invalid/not-a-parcel' } });
  }, async worker => {
    for (const status of [301, 302, 303, 307, 308]) {
      currentStatus = status;
      const countBefore = calls.length;
      const response = await dispatch(worker, parcelPath);
      assert.equal(response.status, 502);
      assert.equal(response.headers.get('cache-control'), 'no-store');
      assert.equal(response.headers.has('location'), false);
      assert.equal(calls.length - countBefore, 1, `${status} must be terminal`);
    }
  });
  assert.ok(calls.every(url => url === `${root}${parcelPath}`));
});

test('workerd route keeps explicit 401 and 403 access denial terminal', { timeout: 30000 }, async () => {
  let upstreamStatus = 401;
  let calls = 0;
  await withWorker(async () => { calls++; return new Response(null, { status: upstreamStatus }); }, async worker => {
    for (const status of [401, 403]) {
      upstreamStatus = status;
      const countBefore = calls;
      const response = await dispatch(worker, parcelPath);
      assert.equal(response.status, status);
      assert.equal((await response.json()).code, 'TKGM_ACCESS_DENIED');
      assert.equal(calls - countBefore, 1);
    }
  });
});

for (const province of ['İstanbul']) {
  test(`actual workerd ${province} plan research works and rejects redirects without inventing zoning rights`, { timeout: 30000 }, async () => {
    const istanbul = province === 'İstanbul';
    const service = istanbul
      ? 'https://haritaservis.ibb.gov.tr/planask/rest/services/PlanAskiGeo/MapServer/0/query'
      : 'https://e-imar.kastamonuozelidare.gov.tr/arcgis/rest/services/IDARE_PUBLIC/IMAR_PUBLIC/FeatureServer/1826/query';
    const points = istanbul
      ? [{ lat: 41, lng: 29 }, { lat: 41.001, lng: 29 }, { lat: 41, lng: 29.001 }]
      : [{ lat: 41.49, lng: 34.01 }, { lat: 41.491, lng: 34.01 }, { lat: 41.49, lng: 34.011 }];
    let upstreamStatus = 200;
    let calls = 0;
    await withWorker(async request => {
      calls++;
      const url = new URL(request.url);
      assert.equal(`${url.origin}${url.pathname}`, service);
      assert.equal(request.method, istanbul ? 'POST' : 'GET');
      const query = istanbul ? new URLSearchParams(await request.text()) : url.searchParams;
      assert.equal(query.get('inSR'), '4326');
      assert.equal(query.get('geometryType'), 'esriGeometryPolygon');
      if (upstreamStatus !== 200) return new Response(null, { status: upstreamStatus, headers: { location: 'https://untrusted.invalid/not-a-plan' } });
      return Response.json({ features: [{ attributes: istanbul
        ? { 'PLAN.PLAN_Aski.OBJECTID': 1, 'PLAN.PLAN_Aski.PLAN_ADI': 'Synthetic research fixture', KAKS: 3 }
        : { objectid: 1, planid: 2, taks: 0.4, emsalkaks: 1.2, katadedi: 3 }
      }] });
    }, async worker => {
      for (const status of [200, 302, 403]) {
        upstreamStatus = status;
        const countBefore = calls;
        const response = await worker.dispatchFetch('https://arkem.test/api/parcel-plan-research', {
          method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ province, points }),
        });
        assert.equal(response.status, status === 200 ? 200 : 503);
        assert.equal(calls - countBefore, 1, 'no redirect following or access-denial workaround');
        const body = await response.json();
        assert.equal(body.status, status === 200 ? 'research-only' : 'unavailable');
        assert.equal(body.authoritative, false);
        assert.equal(body.entitlementAvailable, false);
        assert.equal(body.automaticConditions, null);
        if (status === 200) assert.equal(body.plans.length, 1);
      }
    }, { municipal: true });
  });
}

test('actual workerd municipal jurisdiction gate stops wrong Kastamonu province-wide research', { timeout: 30000 }, async () => {
  let calls = 0;
  await withWorker(async () => { calls++; throw new Error('must not fetch'); }, async worker => {
    const points = [{ lat: 41.49, lng: 34.01 }, { lat: 41.491, lng: 34.01 }, { lat: 41.49, lng: 34.011 }];
    for (const identity of [
      { province: 'Kastamonu', district: 'Merkez', neighborhood: 'Budamış', block: '210', parcelNo: '15' },
      { province: 'İstanbul', district: 'Beşiktaş', neighborhood: 'Yıldız', block: '246', parcelNo: '2' },
    ]) {
      const scope = { projectId: 'fixture', projectRevision: 'R01', sourceRevision: '', identityKey: JSON.stringify(Object.values(identity).map(x => x.toLocaleLowerCase('tr-TR'))), geometryKey: JSON.stringify(points.map(p => [p.lng, p.lat])) };
      const response = await worker.dispatchFetch('https://arkem.test/api/parcel-plan-research', { method: 'POST', body: JSON.stringify({ province: identity.province, points, identity, scope }) });
      const result = await response.json();
      assert.equal(response.status, 200);
      assert.equal(result.status, 'action-required');
      assert.equal(result.entitlementAvailable, false);
      assert.equal(result.automaticConditions, null);
    }
  }, { municipal: true });
  assert.equal(calls, 0);
});
