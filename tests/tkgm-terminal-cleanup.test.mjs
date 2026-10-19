import test from 'node:test';
import assert from 'node:assert/strict';
import { GET } from '../app/api/tkgm/route.ts';
import { fetchTkgmJson, TkgmAccessError } from '../app/lib/tkgm-client.ts';

const parcelPath = 'parsel/130341/210/15';
const upstream = `https://cbsapi.tkgm.gov.tr/megsiswebapi.v3.1/api/${parcelPath}`;

// Entirely synthetic transport responses: no network or cadastral geometry is used.
// Even failed response-body disposal must preserve the access/redirect decision.
function failingCleanupResponse(status, onCancel) {
  return new Response(new ReadableStream({
    cancel() {
      onCancel();
      throw new Error('Synthetic response-body cleanup failure');
    },
  }), {
    status,
    headers: status === 302 ? { location: 'https://untrusted.invalid/not-a-parcel' } : {},
  });
}

for (const status of [401, 403, 302]) {
  test(`TKGM route keeps ${status} terminal when body cancellation rejects`, { concurrency: false }, async () => {
    const originalFetch = globalThis.fetch;
    const calls = [];
    let cancellations = 0;
    globalThis.fetch = async (url, options) => {
      calls.push(String(url));
      assert.equal(options.redirect, 'manual');
      assert.equal(options.credentials, 'omit');
      return failingCleanupResponse(status, () => { cancellations++; });
    };
    try {
      const response = await GET(new Request(`https://arkem.test/api/tkgm?path=${parcelPath}`));
      assert.equal(response.status, status === 302 ? 502 : status);
      assert.equal(response.headers.get('cache-control'), 'no-store');
      assert.equal(response.headers.has('location'), false);
      const body = await response.json();
      assert.equal(body.code, status === 302 ? 'TKGM_REDIRECT_REJECTED' : 'TKGM_ACCESS_DENIED');
      assert.equal(body.upstreamStatus, status);
      assert.equal(cancellations, 1, 'the failing cleanup path must actually run');
      assert.deepEqual(calls, [upstream], 'no alternate API root or redirect target may be requested');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
}

for (const status of [401, 403]) {
  test(`TKGM client keeps its single gateway ${status} terminal after cleanup rejection`, { concurrency: false }, async () => {
    const originalFetch = globalThis.fetch;
    const calls = [];
    let cancellations = 0;
    globalThis.fetch = async (url, options) => {
      calls.push(String(url));
      assert.equal(options.credentials, 'omit');
      return failingCleanupResponse(status, () => { cancellations++; });
    };
    try {
      await assert.rejects(fetchTkgmJson(parcelPath), error => {
        assert.ok(error instanceof TkgmAccessError);
        assert.equal(error.status, status);
        return true;
      });
      assert.equal(cancellations, 1, 'the failing cleanup path must actually run');
      assert.deepEqual(calls, [`/api/tkgm?path=${encodeURIComponent(parcelPath)}`], 'an explicit denial must never trigger a direct request or alternate transport');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
}
