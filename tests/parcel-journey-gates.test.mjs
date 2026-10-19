import test from 'node:test';
import assert from 'node:assert/strict';
import { isParcelIdentityReady, parcelJourneyGate } from '../app/lib/parcel-journey-gates.ts';

const parcel = { province: 'Sakarya', district: 'Serdivan', neighborhood: 'Bahçelievler', block: '123', parcelNo: '4' };
test('a complete parcel identity can reach zoning even when the geometry service is unavailable', () => {
  assert.equal(isParcelIdentityReady(parcel), true);
  assert.equal(parcelJourneyGate(2, true, false), true);
  assert.equal(parcelJourneyGate(1, true, false), false);
  assert.equal(parcelJourneyGate(3, true, false), false);
});
test('placeholder, missing or malformed identity cannot create an imar intake target', () => {
  for (const change of [{ neighborhood: '' }, { neighborhood: 'Merkez / mahalle-köy bilgisini proje notunda belirtin' }, { district: '' }, { block: '-12' }, { parcelNo: '1/2' }, { block: '9'.repeat(11) }]) assert.equal(isParcelIdentityReady({ ...parcel, ...change }), false);
  assert.equal(parcelJourneyGate(2, false, true), false);
});
test('a source boundary enables inspection and concept study, not official planning approval', () => {
  assert.equal(parcelJourneyGate(0, false, false), true);
  assert.equal(parcelJourneyGate(1, false, true), true);
  assert.equal(parcelJourneyGate(3, true, true), true);
});

test('unknown or malformed journey indices stay closed regardless of available data', () => {
  for (const index of [-1, 4, 0.5, NaN, Infinity]) assert.equal(parcelJourneyGate(index, true, true), false);
});
