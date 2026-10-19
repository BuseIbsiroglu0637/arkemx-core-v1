import test from 'node:test';
import assert from 'node:assert/strict';
import {lookupTkgmParcel,TkgmAccessError} from '../app/lib/tkgm-client.ts';
import {GET} from '../app/api/tkgm/route.ts';

// Synthetic boundary for transport/identity validation; not the real Budamış geometry.
const query={province:'Kastamonu',district:'Merkez',neighborhood:'Budamış Mahallesi',block:'210',parcelNo:'15'};
const feature=()=>({type:'Feature',properties:{ilId:59,ilceId:585,mahalleId:130341,adaNo:'210',parselNo:'15',alan:'1.605,42'},geometry:{type:'Polygon',coordinates:[[[33.77,41.37],[33.771,41.37],[33.771,41.371],[33.77,41.371],[33.77,41.37]]]}});
const directory=rows=>({type:'FeatureCollection',features:rows.map(([id,text])=>({type:'Feature',properties:{id,text}}))});

test('automatic lookup resolves names inside official parents and validates the returned parcel before exposing geometry',async()=>{
 const original=globalThis.fetch,calls=[];
 globalThis.fetch=async(url,options)=>{
  calls.push(String(url));assert.equal(options.credentials,'omit');assert.equal(options.redirect,'error');
  assert.deepEqual(options.headers,{Accept:'application/json'});
  assert.ok(String(url).startsWith('/api/tkgm?path='));
  const path = new URL(String(url),'https://arkem.test').searchParams.get('path');
  if(path==='idariYapi/ilceListe/59') return Response.json(directory([[585,'Merkez']]));
  if(path==='idariYapi/mahalleListe/585') return Response.json(directory([[130341,'Budamış']]));
  if(path==='parsel/130341/210/15') return Response.json(feature(),{headers:{'X-TKGM-Source-URL':'https://cbsapi.tkgm.gov.tr/megsiswebapi.v3.1/api/'+path}});
  throw new Error('Unexpected URL');
 };
 try{
  const result=await lookupTkgmParcel(query);
  assert.deepEqual(result.resolvedIds,{provinceId:'59',districtId:'585',neighborhoodId:'130341',block:'210',parcelNo:'15'});
  assert.equal(result.points.length,4);assert.equal(result.properties.alan,'1.605,42');
  assert.match(result.sourceUrl,/\/parsel\/130341\/210\/15$/);assert.ok(Number.isFinite(Date.parse(result.capturedAt)));
  assert.equal(calls.length,3);assert.ok(calls.every(url=>!url.includes('directory-')));
 }finally{globalThis.fetch=original;}
});

test('mismatched cadastral IDs, invalid geometry and empty records never yield a boundary',async()=>{
 const original=globalThis.fetch;
 try{
  for(const body of [
   {...feature(),properties:{...feature().properties,mahalleId:130342}},
   {...feature(),properties:{...feature().properties,parselNo:'16'}},
   {...feature(),geometry:{type:'Polygon',coordinates:[[[33,41],[34,41]]]}},
   {type:'FeatureCollection',features:[]},
  ]){
   globalThis.fetch=async()=>Response.json(body);
   await assert.rejects(lookupTkgmParcel(query));
  }
 }finally{globalThis.fetch=original;}
});

test('ambiguous official district names stop before choosing a neighborhood or parcel',async()=>{
 const original=globalThis.fetch;let calls=0;
 globalThis.fetch=async()=>{calls++;return Response.json(directory([[901,'Merkez'],[902,'MERKEZ']]));};
 try{await assert.rejects(lookupTkgmParcel({...query,province:'Sakarya'}),/birden fazla/);assert.equal(calls,1);}finally{globalThis.fetch=original;}
});

test('access denial and cancellation remain terminal during automatic resolution',async()=>{
 const original=globalThis.fetch;let calls=0;
 globalThis.fetch=async()=>{calls++;return new Response('',{status:403});};
 try{
  await assert.rejects(lookupTkgmParcel({...query,province:'Ankara'}),e=>e instanceof TkgmAccessError&&e.status===403);
  assert.equal(calls,1);
  const controller=new AbortController();controller.abort();
  await assert.rejects(lookupTkgmParcel(query,controller.signal),{name:'AbortError'});assert.equal(calls,1);
 }finally{globalThis.fetch=original;}
});

test('invalid name or parcel input makes no network request',async()=>{
 const original=globalThis.fetch;let calls=0;globalThis.fetch=async()=>{calls++;throw new Error('Unexpected request');};
 try{for(const patch of [{neighborhood:''},{block:'../210'},{parcelNo:'15&x=1'},{province:'x'.repeat(121)}]) await assert.rejects(lookupTkgmParcel({...query,...patch}));assert.equal(calls,0);}finally{globalThis.fetch=original;}
});

test('proxy identifies the actual fixed upstream and does not pass credentials or accept unbounded IDs',async()=>{
 const original=globalThis.fetch;let calls=0;
 globalThis.fetch=async(url,options)=>{calls++;assert.equal(options.credentials,'omit');assert.equal(options.redirect,'manual');return Response.json(feature());};
 try{
  const response=await GET(new Request('https://test.invalid/api/tkgm?path=parsel/130341/210/15'));
  assert.equal(response.status,200);assert.match(response.headers.get('X-TKGM-Source-URL'),/^https:\/\/cbsapi\.tkgm\.gov\.tr\/megsiswebapi\.v3\.1\/api\/parsel\/130341\/210\/15$/);
  assert.equal((await GET(new Request('https://test.invalid/api/tkgm?path=parsel/1234567890123/210/15'))).status,400);assert.equal(calls,1);
 }finally{globalThis.fetch=original;}
});

test('single gateway preserves a permitted source and ignores an unrelated source header',async()=>{
 const original=globalThis.fetch;
 try{
  for(const source of ['https://cbsapi.tkgm.gov.tr/megsiswebapi.v3/api/parsel/130341/210/15','https://unrelated.invalid/fake']){
   let calls=0;
   globalThis.fetch=async(url)=>{calls++;if(!String(url).startsWith('/api/tkgm?')) throw new TypeError('Network unavailable');return Response.json(feature(),{headers:{'X-TKGM-Source-URL':source}});};
   const result=await lookupTkgmParcel(query);
   assert.equal(result.sourceUrl,source.startsWith('https://cbsapi.tkgm.gov.tr/')?source:'https://parselsorgu.tkgm.gov.tr/');
   assert.equal(calls,1);
  }
 }finally{globalThis.fetch=original;}
});
