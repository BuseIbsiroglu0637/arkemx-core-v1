import test from 'node:test';
import assert from 'node:assert/strict';
import {assessZoningResearch,zoningResearchSources} from '../app/lib/zoning-research.ts';
import {checkZoningSource,checkZoningSources} from '../app/lib/zoning-source-access.ts';
import {DEFAULT_ZONING} from '../app/lib/zoning.ts';
import {parseZoningParcelInput} from '../app/lib/kastamonu-zoning.ts';
const identity={province:'Kastamonu',district:'Merkez',neighborhood:'Test',neighborhoodId:'1',block:'2',parcelNo:'3'};
const now=Date.parse('2026-10-12T10:00:00Z');
const result={schema:'ARKEM-OFFICIAL-ZONING/1.0',status:'found',identity,retrievedAt:new Date(now).toISOString(),conditions:{taks:.25,kaks:.75,hmax:9.5,frontSetback:5,sideSetback:3,buildingOrder:'Ayrık',landUse:'Konut Alanı'},source:{url:zoningResearchSources('Kastamonu')[0].url,planStatus:'Onaylandi',planId:'TEST',planScale:'1/1000 Uygulama İmar Planı',approvalDate:'2025-01-01'}};
test('numbered Turkish neighborhood names remain valid parcel identities',()=>{
 assert.ok(parseZoningParcelInput({...identity,province:'Sakarya',district:'Adapazarı',neighborhood:'15 Temmuz Camili',block:'1606',parcelNo:'1'}));
 assert.equal(parseZoningParcelInput({...identity,neighborhood:'<script>'}),null);
});
test('routing distinguishes municipality, special administration and district providers',()=>{
 assert.equal(zoningResearchSources('Kastamonu').filter(s=>s.method==='service').length,1);
 assert.ok(zoningResearchSources('Kastamonu').some(s=>s.id==='kastamonu-belediye'&&s.method==='login'));
 for(const [district,id] of [['Adapazarı','adapazari'],['Serdivan','serdivan'],['Sapanca','sapanca']]){
  const sources=zoningResearchSources('Sakarya',district);assert.ok(sources.some(s=>s.id===id));assert.equal(sources.filter(s=>['adapazari','serdivan','sapanca'].includes(s.id)).length,1);assert.ok(sources.some(s=>s.id==='sakarya-plan'));assert.ok(sources.every(s=>s.method!=='service'));
 }
 assert.ok(!zoningResearchSources('Sakarya','Karasu').some(s=>['adapazari','serdivan','sapanca'].includes(s.id)));
 assert.deepEqual(zoningResearchSources('Ankara').map(s=>s.id),['tkgm','eplan']);
});
test('missing, partial and conflicting source values never become official approval',()=>{
 const form={...DEFAULT_ZONING,taks:.4,rearSetback:3};const a=assessZoningResearch(identity,result,form,now);
 assert.equal(a.available,7);assert.equal(a.conflicts,1);assert.equal(a.authoritative,false);
 assert.equal(a.fields.find(f=>f.key==='rearSetback').value,null);assert.equal(form.taks,.4);
 assert.equal(assessZoningResearch(identity,result,{...DEFAULT_ZONING,buildingOrder:'Ayrık nizam'},now).conflicts,0);
 assert.equal(assessZoningResearch(identity,{...result,conditions:{...result.conditions,taks:0,kaks:null,hmax:Infinity}},DEFAULT_ZONING,now).available,5);
});
test('foreign parcel, expired, future or unsupported records cannot supply current values',()=>{
 for(const r of [null,{...result,identity:{...identity,parcelNo:'4'}},{...result,retrievedAt:new Date(now-86400000).toISOString()},{...result,retrievedAt:new Date(now+1000).toISOString()},{...result,status:'not-found'},{...result,source:{...result.source,url:'https://evil.example'}},{...result,source:{...result.source,planScale:'1/5000'}},{...result,source:{...result.source,approvalDate:'2030-01-01'}}]) assert.equal(assessZoningResearch(identity,r,DEFAULT_ZONING,now).available,0);
});
test('public page access never reports a parcel result; evidence hashes response bytes',async()=>{
 const r=await checkZoningSource('adapazari',async(url,opts)=>{assert.ok(url.startsWith('https://www.turkiye.gov.tr/'));assert.equal(opts.redirect,'manual');assert.equal(opts.headers.Cookie,undefined);return new Response('<!doctype html><html>Form</html>',{headers:{'Content-Type':'text/html'}});});
 assert.equal(r.status,'page-received');assert.equal(r.sha256.length,64);assert.match(r.message,/henüz doğrulanmadı/);
 assert.equal((await checkZoningSource('kastamonu-belediye',async()=>new Response('<html>Login</html>',{headers:{'content-type':'text/html'}}))).status,'login-required');
});
test('allowlist and redirects cannot be used to fetch user supplied or internal URLs',async()=>{
 let calls=0;await assert.rejects(checkZoningSource('http://127.0.0.1',async()=>{calls++;}));assert.equal(calls,0);
 const r=await checkZoningSource('eplan',async()=>{calls++;return new Response(null,{status:302,headers:{Location:'http://127.0.0.1/private'}});});assert.equal(r.status,'unexpected');assert.equal(calls,1);
});
test('errors, block pages, schema changes and oversized responses remain explicit',async()=>{
 for(const status of [401,403,429]) assert.equal((await checkZoningSource('eplan',async()=>new Response('',{status}))).status,'restricted');
 assert.equal((await checkZoningSource('eplan',async()=>new Response('<html>captcha</html>',{headers:{'content-type':'text/html'}}))).status,'restricted');
 assert.equal((await checkZoningSource('eplan',async()=>new Response('<html><script>captcha()</script>Normal page</html>',{headers:{'content-type':'text/html'}}))).status,'page-received');
 assert.equal((await checkZoningSource('eplan',async()=>{throw new TypeError('secret',{cause:{code:'ENOTFOUND'}});})).status,'unavailable');
 assert.equal((await checkZoningSource('kastamonu-ioi',async()=>Response.json({id:1826,fields:[]}))).status,'unexpected');
 assert.equal((await checkZoningSource('kastamonu-ioi',async()=>Response.json({id:1826,fields:['planid','taks','emsalkaks'].map(name=>({name}))}))).status,'service-readable');
 assert.equal((await checkZoningSource('eplan',async()=>new Response('x'.repeat(1000001)))).status,'unexpected');
});
test('one inaccessible provider does not discard other provider observations',async()=>{
 const checks=await checkZoningSources('Sakarya','Serdivan',async url=>url.includes('serdivan')?Promise.reject(Error('down')):new Response('<html>Public</html>',{headers:{'content-type':'text/html'}}));
 assert.equal(checks.find(s=>s.id==='serdivan').status,'unavailable');assert.equal(checks.find(s=>s.id==='sakarya-plan').status,'page-received');
});
