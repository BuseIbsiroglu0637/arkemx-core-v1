import test from 'node:test';
import assert from 'node:assert/strict';
import { PROJECT_MODULES } from '../app/lib/project-graph.ts';
const selectors = {
  'decision-assistant':'decision-assistant',
  'geo-parcel':'geo-parcel-studio',
  'quick-site-scenario':'geo-parcel-studio',
  'architectural-program':'architectural-program-studio',
  'plan-editor':'advanced-plan-editor',
  'system-comparison':'system-comparison',
  'structural-concept':'structural-designer',
  'engineering-coordination':'engineering-coordination-studio',
  'digital-delivery-scope':'innovation-lab',
  'arkem-x':'arkem-x-lab',
  'project-os':'project-operating-system',
  'model-library-review':'sketchfab-library',
  'demolition-screening':'demolition-decision-studio',
};
for (const moduleEntry of PROJECT_MODULES) test(moduleEntry.code+' '+moduleEntry.label+' opens its working module route',async()=>{
  const {default:worker}=await import('../dist/server/index.js');
  const response=await worker.fetch(new Request('http://localhost'+moduleEntry.route,{headers:{accept:'text/html'}}),{ASSETS:{fetch:async()=>new Response('Not found',{status:404})}},{waitUntil(){},passThroughOnException(){}});
  assert.equal(response.status,200,moduleEntry.route);
  const html=await response.text();
  assert.ok(html.includes(selectors[moduleEntry.id]), moduleEntry.route+' must mount the working tool');
});

