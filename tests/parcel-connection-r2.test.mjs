import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {fetchTkgmJson,TkgmAccessError} from '../app/lib/tkgm-client.ts';
import {TKGM_PROVINCES,TKGM_PROVINCE_SOURCE} from '../app/data/tkgm-provinces.ts';
import {GET} from '../app/api/tkgm/route.ts';
import {createDirectoryRequestTracker} from '../app/lib/directory-request-tracker.ts';

test('instant province completion cannot hide pending district or neighborhood requests',()=>{
 const tracker=createDirectoryRequestTracker();const province=tracker.begin('province');const district=tracker.begin('district');const neighborhood=tracker.begin('neighborhood');
 province();assert.equal(tracker.level(),'neighborhood');neighborhood();assert.equal(tracker.level(),'district');district();assert.equal(tracker.level(),'idle');
});
test('late cancellation cannot clear a newer request of the same level',()=>{
 const tracker=createDirectoryRequestTracker();const old=tracker.begin('district');const current=tracker.begin('district');old();assert.equal(tracker.level(),'district');current();old();assert.equal(tracker.level(),'idle');
});

test('81 official province IDs load without calling the rejected API method',async()=>{
 const old=globalThis.fetch;globalThis.fetch=async()=>{throw new Error('province lookup must not need network');};
 try {const data=await fetchTkgmJson('idariYapi/ilListe');assert.equal(data.features.length,81);assert.equal(new Set(data.features.map(f=>f.properties.id)).size,81);assert.equal(String(data.features.find(f=>f.properties.text.toLocaleLowerCase('tr-TR')==='sakarya').properties.id),'76');assert.match(TKGM_PROVINCE_SOURCE.url,/^https:\/\/parselsorgu.tkgm.gov.tr\//);assert.match(TKGM_PROVINCE_SOURCE.sha256,/^[a-f0-9]{64}$/);assert.ok(TKGM_PROVINCES.features.every(f=>!f.geometry)); const response=await GET(new Request('https://test.invalid/api/tkgm?path=idariYapi%2FilListe'));assert.equal(response.status,200);assert.equal((await response.json()).features.length,81);} finally {globalThis.fetch=old;}
});
test('client gateway 401 and 403 are terminal, not followed by another request',async()=>{
 const old=globalThis.fetch;
 try{for(const status of [401,403]){let calls=0;globalThis.fetch=async()=>{calls++;return new Response('',{status});};await assert.rejects(fetchTkgmJson(`idariYapi/mahalleListe/902${status}`),e=>e instanceof TkgmAccessError&&e.status===status);assert.equal(calls,1);}}finally{globalThis.fetch=old;}
});
test('server preserves explicit access denial and does not try an alternate API version',async()=>{
 const old=globalThis.fetch;let calls=0;globalThis.fetch=async()=>{calls++;return new Response('',{status:403});};
 try{const response=await GET(new Request('https://test.invalid/api/tkgm?path=idariYapi%2FilceListe%2F76'));assert.equal(response.status,403);assert.equal((await response.json()).code,'TKGM_ACCESS_DENIED');assert.equal(calls,1);}finally{globalThis.fetch=old;}
});
test('even a locally cached directory respects caller cancellation',async()=>{const c=new AbortController();c.abort();await assert.rejects(fetchTkgmJson('idariYapi/ilListe',c.signal),{name:'AbortError'});});
test('step rail is ordered, numbers are single labels, and premature mismatch is suppressed',()=>{
 const source=fs.readFileSync(new URL('../app/components/GeoParcelStudio.tsx',import.meta.url),'utf8');assert.match(source,/aria-label="Arsa değerlendirme adımları"><ol>/);assert.match(source,/className="parcel-step-number">\{String\(index \+ 1\)\.padStart/);assert.match(source,/identityReady && parcelRecord.evidence.identityMatches === false/);assert.match(source,/Parseliniz burada görünecek/);
});
test('model uses a wider desktop stage without distorting the original model axes',()=>{
 const css=fs.readFileSync(new URL('../app/parcel-refinement.css',import.meta.url),'utf8');const source=fs.readFileSync(new URL('../app/lib/project-model-viewer.ts',import.meta.url),'utf8');assert.match(css,/aspect-ratio:16\/9/);assert.match(css,/minmax\(0,\.82fr\) minmax\(0,1\.18fr\)/);assert.doesNotMatch(source,/model.scene.scale/);assert.match(source,/Presentation plinth only/);
});
