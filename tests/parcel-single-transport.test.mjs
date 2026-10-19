import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchTkgmJson, TkgmAccessError } from '../app/lib/tkgm-client.ts';

// Transport fixtures only: no real parcel geometry or outside network is used.
for (const failure of [401, 403, 302, 404, 429, 502, 'network']) {
  test(`one application gateway only; ${failure} never changes transport`, async () => {
    const original = globalThis.fetch;
    const calls = [];
    globalThis.fetch = async (url, options) => {
      calls.push(String(url));
      assert.equal(options.credentials, 'omit');
      assert.equal(options.redirect, 'error');
      assert.deepEqual(options.headers, { Accept: 'application/json' });
      if (failure === 'network') throw new TypeError('Synthetic network failure');
      return new Response('', { status: failure });
    };
    try {
      await assert.rejects(fetchTkgmJson('parsel/130341/210/15'), error => {
        if (failure === 401 || failure === 403) assert.ok(error instanceof TkgmAccessError);
        return true;
      });
      assert.deepEqual(calls, ['/api/tkgm?path=parsel%2F130341%2F210%2F15']);
    } finally { globalThis.fetch = original; }
  });
}

test('cancelled late directory response is not returned or cached', async () => {
  const original = globalThis.fetch;
  const controller = new AbortController();
  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    if (calls === 1) controller.abort();
    return Response.json({ features: [{ properties: { id: 999, text: 'Synthetic district' } }] });
  };
  try {
    await assert.rejects(fetchTkgmJson('idariYapi/ilceListe/90909', controller.signal), { name: 'AbortError' });
    const result = await fetchTkgmJson('idariYapi/ilceListe/90909');
    assert.equal(result.features[0].properties.id, '999');
    assert.equal(calls, 2, 'an aborted response must not populate the directory cache');
  } finally { globalThis.fetch = original; }
});
