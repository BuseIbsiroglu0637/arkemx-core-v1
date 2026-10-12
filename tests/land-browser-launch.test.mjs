import test from 'node:test';
import assert from 'node:assert/strict';
import { landBrowserLaunchOptions } from '../scripts/lib/land-browser-launch.mjs';
const options = patch => landBrowserLaunchOptions({chromiumPath:'/test/chromium',platform:'win32',channel:'',exists:()=>false,...patch});
test('Windows without packaged Chromium uses installed Edge channel in headless mode',()=>{
  assert.deepEqual(options({}),{headless:true,channel:'msedge'});
});
test('packaged Chromium and non-Windows environments retain the original browser',()=>{
  assert.deepEqual(options({exists:()=>true}),{headless:true});
  assert.deepEqual(options({platform:'linux'}),{headless:true});
});
test('explicit channel selection is respected and unsupported channels fail closed',()=>{
  assert.deepEqual(options({channel:'chromium'}),{headless:true});
  assert.deepEqual(options({channel:'msedge',exists:()=>true}),{headless:true,channel:'msedge'});
  assert.throws(()=>options({channel:'custom-browser'}),/Unsupported/);
});
