import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import {LOCATION_DIRECTORY_SOURCE as source, LOCATION_DIRECTORY_PROVINCES as provinces} from '../app/data/location-directory-source.ts';

const base = new URL('../public/data/location-directory/',import.meta.url);
let sequence = 0;
const fresh = () => import(`../app/lib/location-directory.ts?test=${++sequence}`);
const readShard = async plate => JSON.parse(await fs.readFile(new URL(provinces.find(row=>row.id===plate).file,base),'utf8'));
async function staticFetch(url,options) {
  assert.match(url,/^\/data\/location-directory\/2025\/[1-9]\d?\.[a-f0-9]{12}\.json$/);
  assert.equal(options.credentials,'omit');assert.equal(options.redirect,'error');
  return new Response(await fs.readFile(new URL(url.replace('/data/location-directory/',''),base)),{headers:{'content-type':'application/json'}});
}
async function mockedFetch(implementation,run) {
  const previous=globalThis.fetch;globalThis.fetch=implementation;
  try {await run();} finally {globalThis.fetch=previous;}
}

test('MIT source manifest, SHA256 and all81 shards retain complete source counts',async()=>{
  assert.equal(provinces.length,81);assert.equal(new Set(provinces.map(row=>row.id)).size,81);
  assert.deepEqual(provinces.map(row=>row.id).toSorted((a,b)=>a-b),Array.from({length:81},(_,i)=>i+1));
  const manifest=JSON.parse(await fs.readFile(new URL('source.json',base),'utf8'));
  assert.equal(manifest.sourceCommit,'a0ad8351cb52153e7a92aa7ba9a5bc1e3294da8d');
  assert.equal(manifest.capturedAt,source.capturedAt);assert.equal(source.license,'MIT');
  assert.match(await fs.readFile(new URL('LICENSE.txt',base),'utf8'),/Copyright \(c\) 2022-2026 Ubeyde Emir Özdemir/);
  const totals={districts:0,neighborhoods:0,villages:0};
  for (const province of provinces) {
    const bytes=await fs.readFile(new URL(province.file,base));
    assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),province.sha256);
    assert.ok(bytes.length<2*1024*1024);
    const shard=JSON.parse(bytes);assert.equal(shard.province.id,province.id);
    assert.equal(shard.districts.length,province.districtCount);assert.equal(shard.settlements.length,province.settlementCount);
    const districtIds=new Set(shard.districts.map(row=>row[0]));
    for (const row of shard.districts) assert.equal(row[1],province.id);
    for (const row of shard.settlements) {assert.equal(row[1],province.id);assert.ok(districtIds.has(row[2]));totals[row[3]==='n'?'neighborhoods':'villages']++;}
    totals.districts+=shard.districts.length;
  }
  assert.deepEqual(totals,{districts:973,neighborhoods:32254,villages:18183});
  assert.deepEqual(source.counts,{provinces:81,...totals,settlements:50437});
  assert.equal(manifest.sources.length,5);
  for (const item of manifest.sources) {assert.match(item.url,/^https:\/\/raw\.githubusercontent\.com\/ubeydeozdmr\/turkiye-api\/a0ad8351cb52153e7a92aa7ba9a5bc1e3294da8d\//);assert.match(item.sha256,/^[a-f0-9]{64}$/);}
});

test('every province and district loads using only81 local shards with namespaced options',async()=>{
  const api=await fresh();let calls=0, districtCount=0, settlementCount=0;
  await mockedFetch(async(...args)=>{calls++;return staticFetch(...args);},async()=>{
    for (const province of provinces) {
      const districts=await api.loadLocationDistricts(province.name);
      assert.equal(districts.length,province.districtCount);districtCount+=districts.length;
      for (const district of districts) {
        assert.match(district.id,new RegExp(`^directory-district-${province.id}-[1-9]\\d*$`));
        const settlements=await api.loadLocationNeighborhoods(district.id);
        const numericDistrict=district.id.split('-').at(-1);
        for (const settlement of settlements) assert.match(settlement.id,new RegExp(`^directory-(?:neighborhood|village)-${province.id}-${numericDistrict}-[1-9]\\d*$`));
        assert.equal(new Set(settlements.map(row=>row.id)).size,settlements.length);settlementCount+=settlements.length;
      }
    }
  });
  assert.equal(calls,81);assert.equal(districtCount,973);assert.equal(settlementCount,50437);
});

test('Turkish normalization, Istanbul39 and Serdivan24 preserve distinct provider IDs',async()=>{
  const api=await fresh();let calls=0;
  await mockedFetch(async(...args)=>{calls++;return staticFetch(...args);},async()=>{
    assert.equal((await api.loadLocationDistricts(' İSTANBUL ')).length,39);
    assert.equal((await api.loadLocationDistricts('ISTANBUL')).length,39);
    const sakarya=await api.loadLocationDistricts('SAKARYA');assert.equal(sakarya.length,16);
    const serdivan=sakarya.find(row=>row.label==='Serdivan');assert.equal(serdivan.id,'directory-district-54-2071');
    const neighborhoods=await api.loadLocationNeighborhoods(serdivan.id);assert.equal(neighborhoods.length,24);
    assert.deepEqual(neighborhoods.find(row=>row.label==='Bahçelievler'),{id:'directory-neighborhood-54-2071-61592',label:'Bahçelievler',sourceName:'Bahçelievler',kind:'neighborhood',ambiguous:false});
    assert.equal(calls,2);
    sakarya[0].label='changed';assert.notEqual((await api.loadLocationDistricts('Sakarya'))[0].label,'changed');
  });
});

test('invalid namespace, traversal and cross-province parent selection are rejected',async()=>{
  const api=await fresh();let calls=0;
  await mockedFetch(async(...args)=>{calls++;return staticFetch(...args);},async()=>{
    for (const id of ['2071','directory-district-54-2071/../','directory-district-054-2071','directory-district-54-0','directory-district-82-2071','https://example.com/2071']) await assert.rejects(api.loadLocationNeighborhoods(id));
    assert.equal(calls,0);
    await assert.rejects(api.loadLocationNeighborhoods('directory-district-34-2071'),/bu ile bağlı değil/);assert.equal(calls,1);
    await assert.rejects(api.loadLocationDistricts('../Sakarya'));assert.equal(calls,1);
  });
});

test('malformed parent IDs, duplicate records and wrong counts never enter the cache',async()=>{
  for (const mutate of [
    shard=>{shard.province.id=76;},
    shard=>{shard.districts[0][1]=34;},
    shard=>{shard.settlements[0][2]=999999;},
    shard=>{shard.settlements[1]=shard.settlements[0];},
    shard=>{shard.settlements.pop();},
    shard=>{shard.districts[0][2]='bad\u0000label';}
  ]) {
    const api=await fresh();const bad=await readShard(54);mutate(bad);let calls=0;
    await mockedFetch(async(...args)=>{calls++;return calls===1?new Response(JSON.stringify(bad)):staticFetch(...args);},async()=>{
      await assert.rejects(api.loadLocationDistricts('Sakarya'),/doğrulanamadı/);
      assert.equal((await api.loadLocationDistricts('Sakarya')).length,16);assert.equal(calls,2);
    });
  }
});

test('failed fetch is retryable without caching a403 or calling an external service',async()=>{
  const api=await fresh();let calls=0;
  await mockedFetch(async(...args)=>{calls++;return calls===1?new Response('',{status:403}):staticFetch(...args);},async()=>{
    await assert.rejects(api.loadLocationDistricts('Sakarya'),/403/);assert.equal(calls,1);
    assert.equal((await api.loadLocationDistricts('Sakarya')).length,16);assert.equal(calls,2);
  });
});

test('stream and Content-Length limits reject oversized payload before caching',async()=>{
  for (const response of [new Response('{}',{headers:{'content-length':String(3*1024*1024)}}),new Response(' '.repeat(2*1024*1024+1))]) {
    const api=await fresh();let calls=0;
    await mockedFetch(async(...args)=>{calls++;return calls===1?response:staticFetch(...args);},async()=>{
      await assert.rejects(api.loadLocationDistricts('Sakarya'),/doğrulanamadı/);
      assert.equal((await api.loadLocationDistricts('Sakarya')).length,16);
    });
  }
});

test('pre-aborted, in-flight and cached requests honor cancellation without failed cache',async()=>{
  const api=await fresh();const early=new AbortController();early.abort();let calls=0;
  await mockedFetch(async(...args)=>{calls++;return staticFetch(...args);},async()=>{
    await assert.rejects(api.loadLocationDistricts('Sakarya',early.signal),{name:'AbortError'});assert.equal(calls,0);
    await api.loadLocationDistricts('Sakarya');
    await assert.rejects(api.loadLocationDistricts('Sakarya',early.signal),{name:'AbortError'});
    await assert.rejects(api.loadLocationNeighborhoods('directory-district-54-2071',early.signal),{name:'AbortError'});assert.equal(calls,1);
  });
  const activeApi=await fresh();const active=new AbortController();let activeCalls=0;
  await mockedFetch(async(url,options)=>{
    activeCalls++;
    if (activeCalls>1) return staticFetch(url,options);
    return new Response(new ReadableStream({start(){queueMicrotask(()=>active.abort());}}));
  },async()=>{
    await assert.rejects(activeApi.loadLocationDistricts('Sakarya',active.signal),{name:'AbortError'});
    assert.equal((await activeApi.loadLocationDistricts('Sakarya')).length,16);assert.equal(activeCalls,2);
  });
});

test('village options retain a separate type namespace and visible kind label',async()=>{
  const api=await fresh();
  await mockedFetch(staticFetch,async()=>{
    const districts=await api.loadLocationDistricts('Kastamonu');assert.equal(districts.length,20);
    const settlements=(await Promise.all(districts.map(row=>api.loadLocationNeighborhoods(row.id)))).flat();
    const villages=settlements.filter(row=>row.id.startsWith('directory-village-37-'));
    assert.equal(villages.length,1054);assert.ok(villages.every(row=>row.label.includes('Köy')));
  });
});

test('actual Kıyan village sends its raw source name while preserving the displayed selection',async()=>{
  const api=await fresh();
  await mockedFetch(staticFetch,async()=>{
    const district=(await api.loadLocationDistricts('Kastamonu')).find(row=>row.label==='Araç');
    assert.equal(api.locationDirectoryLookupName(district,'district'),'Araç');
    const village=(await api.loadLocationNeighborhoods(district.id)).find(row=>row.id==='directory-village-37-1140-18215');
    assert.deepEqual(village,{id:'directory-village-37-1140-18215',label:'Kıyan (Köy)',sourceName:'Kıyan',kind:'village',ambiguous:false});
    const before=structuredClone(village);
    assert.equal(api.locationDirectoryLookupName(village,'neighborhood'),'Kıyan');
    assert.deepEqual(village,before);
    assert.throws(()=>api.locationDirectoryLookupName(undefined,'neighborhood'),/güncel listeden/);
    assert.throws(()=>api.locationDirectoryLookupName(district,'neighborhood'),/güncel listeden/);
  });
});

test('actual same-parent village and neighborhood duplicates require a verified cadastral crosswalk',async()=>{
  const api=await fresh();
  await mockedFetch(staticFetch,async()=>{
    const district=(await api.loadLocationDistricts('Adıyaman')).find(row=>row.label==='Besni');
    const rows=await api.loadLocationNeighborhoods(district.id);
    const mixed=rows.filter(row=>row.sourceName==='Pınarbaşı');
    assert.equal(mixed.length,2);
    assert.deepEqual(mixed.map(row=>row.kind).toSorted(),['neighborhood','village']);
    assert.ok(mixed.some(row=>row.label==='Pınarbaşı (Mahalle)'));
    assert.ok(mixed.some(row=>row.label==='Pınarbaşı (Köy)'));
    const sameKind=rows.filter(row=>row.sourceName==='Fatih');
    assert.equal(sameKind.length,2);
    assert.ok(sameKind.every(row=>row.label.startsWith('Fatih (Mahalle · ')));
    for (const row of [...mixed,...sameKind]) {
      assert.equal(row.ambiguous,true);
      assert.throws(()=>api.locationDirectoryLookupName(row,'neighborhood'),/aynı adlı birden fazla kayıt/);
    }
  });
});
