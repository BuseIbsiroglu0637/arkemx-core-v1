import test from 'node:test';
import assert from 'node:assert/strict';
import { restoreModuleValue } from '../app/lib/module-draft.ts';
import { MODULE_JOURNEY_INDEX } from '../app/lib/module-navigation.ts';

test('module draft restoration preserves deliberate false, zero and empty values without changing source', () => {
  const saved = { flags: { verified:false }, quantity:0, note:'', documents:[{code:'REV-2',status:'Revizyon'}] };
  const snapshot = structuredClone(saved);
  const restored = restoreModuleValue(saved, { flags:{verified:true}, quantity:10, note:'default', documents:[{code:'A',status:'Onaylı'}] });
  assert.deepEqual(restored,saved);
  assert.deepEqual(saved,snapshot);
});
test('malformed draft fields cannot replace the form shape or numeric values', () => {
  assert.deepEqual(restoreModuleValue({area:NaN,flags:null,notes:42},{area:1200,flags:{bim:false},notes:['memo']}),{area:1200,flags:{bim:false},notes:['memo']});
  assert.deepEqual(restoreModuleValue(['saved',null,42],[]),['saved']);
});
test('every project module has an explicit navigation stage; technical names cannot select the brief stage', () => {
  assert.equal(Object.keys(MODULE_JOURNEY_INDEX).length,13);
  assert.equal(MODULE_JOURNEY_INDEX['structural-concept'],3);
  assert.equal(MODULE_JOURNEY_INDEX['arkem-x'],4);
  assert.equal(MODULE_JOURNEY_INDEX['digital-delivery-scope'],4);
  assert.equal(MODULE_JOURNEY_INDEX['project-os'],5);
  assert.equal(MODULE_JOURNEY_INDEX['model-library-review'],6);
});

