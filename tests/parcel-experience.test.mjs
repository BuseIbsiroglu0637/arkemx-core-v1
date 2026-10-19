import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { parseParcelGeoJson, parseKmlCoordinateRing, parcelOperationMatches, parcelPreviewPoints, PARCEL_JOURNEY } from '../app/lib/parcel-experience.ts';
import { createParcelRecord } from '../app/lib/parcel-record.ts';
import { readBoundedJson } from '../app/lib/bounded-json.ts';
import { GET } from '../app/api/tkgm/route.ts';
const ring = [[30.36,40.76],[30.361,40.76],[30.361,40.761],[30.36,40.761],[30.36,40.76]];
const polygon = { type:'Polygon', coordinates:[ring] };
test('single intact GeoJSON boundary retains all vertices except exact closure', () => {
  const points = parseParcelGeoJson({type:'FeatureCollection',features:[{type:'Feature',geometry:polygon}]});
  assert.deepEqual(points, ring.slice(0,-1).map(([lng,lat])=>({lat,lng})));
  assert.deepEqual(parseParcelGeoJson({type:'MultiPolygon',coordinates:[polygon.coordinates]}),points);
});
test('GeoJSON holes, islands, multiple records and malformed points are rejected whole', () => {
  for(const value of [{...polygon,coordinates:[ring,ring]}, {type:'MultiPolygon',coordinates:[polygon.coordinates,polygon.coordinates]}, {type:'FeatureCollection',features:[{type:'Feature',geometry:polygon},{type:'Feature',geometry:polygon}]}, {...polygon,coordinates:[[...ring.slice(0,3),[NaN,40.76]]]}, {...polygon,coordinates:[[...ring.slice(0,3),[30.36,40.76,5,9]]]}, {...polygon,coordinates:[[[30.36,40.76],[30.361,40.761],[30.36,40.761],[30.361,40.76]]]}]) assert.throws(()=>parseParcelGeoJson(value));
});
test('over-limit boundary is not silently reduced to 400 vertices', () => {
  const circle = Array.from({length:401},(_,i)=>[30.36+.001*Math.cos(i*2*Math.PI/401),40.76+.001*Math.sin(i*2*Math.PI/401)]);
  assert.throws(()=>parseParcelGeoJson({...polygon,coordinates:[circle]}));
});
test('KML coordinate ring is strict and never skips invalid coordinates', () => {
  assert.equal(parseKmlCoordinateRing(ring.map(p=>p.join(',')).join(' ')).length,4);
  for(const value of ['30.36,40.76 30.361,NaN 30.36,40.761','30.36,40.76 30.361,,0 30.36,40.761','30.36,40.76,0,1 30.361,40.76 30.36,40.761']) assert.throws(()=>parseKmlCoordinateRing(value));
});
test('geometry inset exists only for a valid actual outer ring', () => {
  const points=parseParcelGeoJson(polygon);
  assert.equal(parcelPreviewPoints(points).split(' ').length,4);
  assert.equal(parcelPreviewPoints([]),null);
  assert.equal(parcelPreviewPoints([{lat:NaN,lng:30},...points]),null);
});
test('same-identity stale requests and changed CRS cannot overwrite current geometry', () => {
  assert.equal(parcelOperationMatches(2,2,'A','A','WGS84','WGS84'),true);
  assert.equal(parcelOperationMatches(1,2,'A','A'),false);
  assert.equal(parcelOperationMatches(2,2,'A','B'),false);
  assert.equal(parcelOperationMatches(2,2,'A','A','WGS84','UTM'),false);
});
test('parcel record rejects malformed and over-limit geometry rather than sanitising it', () => {
  const points=parseParcelGeoJson(polygon);
  const identity={province:'Sakarya',district:'Serdivan',neighborhood:'A',block:'12',parcelNo:'34'};
  const source={kind:'user-file',authority:'Customer',label:'File',capturedAt:'2026-10-03',url:''};
  for(const geometry of [[...points,{lat:NaN,lng:30}],[...points,{lat:40.76,lng:30.36,alt:NaN}],Array(401).fill(points[0])]) {
    const record=createParcelRecord({identity,geometry,source});
    assert.equal(record.projectEligible,false); assert.deepEqual(record.geometry.points,[]);
    assert.equal(record.geometry.valid,false);
  }
  assert.deepEqual(createParcelRecord({identity,geometry:points,source}).geometry.points,points);
});
test('guided journey and map source guards remain explicit in source, not a browser acceptance claim', () => {
  assert.equal(PARCEL_JOURNEY.length,4);
  const source=fs.readFileSync(new URL('../app/components/GeoParcelStudio.tsx',import.meta.url),'utf8');
  assert.doesNotMatch(source,/slice\(-40\)|text\.match\(\/\<coordinates/);
  assert.ok(/drawEnabled && <div className="geo-map-crosshair"/.test(source));
  assert.match(source,/new DOMParser/);
  assert.match(source,/named\('innerBoundaryIs'\)/);
});
test('bounded upstream reader rejects HTML, malformed data and oversized streamed bodies', async () => {
  assert.deepEqual(await readBoundedJson(Response.json({ok:true})),{ok:true});
  await assert.rejects(readBoundedJson(new Response('<html>',{headers:{'content-type':'text/html'}})));
  await assert.rejects(readBoundedJson(new Response('{oops',{headers:{'content-type':'application/json'}})));
  await assert.rejects(readBoundedJson(Response.json({long:'123456789'}),8));
  await assert.rejects(readBoundedJson(new Response('null',{headers:{'content-type':'application/json'}})));
});
test('TKGM proxy uses only fixed allowlisted endpoints with redirect refusal and fallback', async () => {
  const original=globalThis.fetch; let calls=[];
  globalThis.fetch=async (url,options)=>{ calls.push([url,options]); return calls.length===1?new Response('<html>',{headers:{'content-type':'text/html'}}):Response.json(polygon); };
  try {
    assert.equal((await GET(new Request('https://example.test/api/tkgm?path=https://evil.test'))).status,400);
    assert.equal(calls.length,0);
    const result=await GET(new Request('https://example.test/api/tkgm?path=parsel/1/12/34'));
    assert.equal(result.status,200); assert.deepEqual(await result.json(),polygon); assert.equal(calls.length,2);
    for(const [url,options] of calls){assert.match(url,/^https:\/\/cbsapi\.tkgm\.gov\.tr\//);assert.equal(options.redirect,'manual');assert.ok(options.signal);}
  } finally {globalThis.fetch=original;}
});
test('upstream errors are not cached as parcel success', async () => {
  const original=globalThis.fetch; globalThis.fetch=async()=>new Response('unavailable',{status:503});
  try {const result=await GET(new Request('https://example.test/api/tkgm?path=parsel/1/12/34'));assert.equal(result.status,502);assert.equal(result.headers.get('cache-control'),'no-store');} finally{globalThis.fetch=original;}
});
