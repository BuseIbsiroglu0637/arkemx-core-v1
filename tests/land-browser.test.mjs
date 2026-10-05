import test from 'node:test';
import assert from 'node:assert/strict';
import { parseHepsiemlakCard, searchPageUrl, isHepsiemlakListing, classifySourcePage, searchHepsiemlak, LandBrowserError } from '../scripts/lib/hepsiemlak-browser.mjs';
import { assessLandCandidate, readLandResearch, readLandSourceStatus } from '../app/lib/land-research.ts';
import { landBrowserLocalPlugin } from '../scripts/lib/land-browser-local-plugin.mjs';
import { createServer, request } from 'node:http';
const criteria = { province:'Kastamonu', district:'', tenure:'sale', minArea:3000, maxArea:0, maxPrice:10000000, use:'industrial', needs:['Tır erişimi'] };
const url = 'https://www.hepsiemlak.com/kastamonu-ihsangazi-dagyolu-yeni-satilik/tarla/151988-78';
// A small synthetic card fixture with the observed page structure; not a live listing.
const card = { url, title:'Sentetik yol cepheli tarla', text:'1 / 41\n620.000\nTL\n30/09/2026\nSentetik yol cepheli tarla\nKategori\nSatılık Tarla\n·\nBrüt m²\n3.199 m²\n·\nm² Fiyatı\n194 TL / m²\nKastamonu / İhsangazi / Dağyolu (Yeni) Mah.' };
test('card fields stay source claims, agricultural use is not industrial suitability', () => {
  const c = parseHepsiemlakCard(card, '2026-10-05T10:00:00Z');
  assert.equal(c.areaM2,3199); assert.equal(c.priceTRY,620000); assert.equal(c.province,'Kastamonu'); assert.equal(c.district,'İhsangazi'); assert.equal(c.basis,'browser-listing');
  assert.deepEqual(assessLandCandidate(c,criteria).mismatch,['Kullanım beyanı farklı']);
  assert.equal(readLandResearch({schema:'ARKEM-LAND-RESEARCH/1.0',criteria,shortlist:[c],selectedId:c.id}).shortlist[0].basis,'browser-listing');
});
test('unknown and suspicious prices stay unknown; never take the unit asking price as total', () => {
  assert.equal(parseHepsiemlakCard({...card,text:card.text.replace('620.000\nTL','').replace('194 TL / m²','620.000 TL / m²')},'date').priceTRY,null);
  assert.equal(parseHepsiemlakCard({...card,text:card.text.replace('620.000\nTL','6.500\nTL')},'date').priceTRY,null);
  assert.equal(parseHepsiemlakCard({...card,text:'Satılık Tarla\nBrüt m²\n3.199 m²\nKastamonu / İhsangazi / Yeni Mah.'},'date').priceTRY,null);
});
test('listing URLs exclude category, other property, credentials and lookalike domains', () => {
  assert.equal(isHepsiemlakListing(url),true);
  for (const bad of ['https://www.hepsiemlak.com/kastamonu-satilik/arsa','https://www.hepsiemlak.com/kastamonu-satilik/daire/1-2',url.replace('hepsiemlak.com','hepsiemlak.com.evil.test'),url.replace('https://','https://x:y@')]) assert.equal(isHepsiemlakListing(bad),false);
});
test('location slug handles Turkish names without embedding arbitrary search operators', () => {
  assert.equal(searchPageUrl({...criteria,province:'İstanbul',district:'Şişli'}),'https://www.hepsiemlak.com/istanbul-sisli-satilik/arsa');
});
test('blocking, explicitly empty results and unknown layouts remain distinct', () => {
  assert.equal(classifySourcePage('Olağan dışı erişim tespit ettik'), 'blocked');
  assert.equal(classifySourcePage('Verify you are human'), 'blocked');
  assert.equal(classifySourcePage('0 ilan bulundu'), 'empty');
  assert.equal(classifySourcePage('Site is currently unavailable'), 'unknown');
  assert.equal(classifySourcePage('', {title:'Bir dakika lütfen...'}), 'blocked');
  assert.equal(classifySourcePage('', {challengeDetected:true}), 'blocked');
  assert.equal(classifySourcePage('Bir dakika lütfen, sonuçlar yükleniyor', {title:'Arsa ilanları'}), 'unknown');
  assert.deepEqual(readLandSourceStatus([{name:'Hepsiemlak',status:'blocked',readCount:-1,totalCount:null}]),[{name:'Hepsiemlak',status:'blocked',readCount:0,totalCount:null,note:''}]);
});
test('browser unavailable does not become an empty successful response', async () => {
  await assert.rejects(searchHepsiemlak(criteria,{launchBrowser:async()=>{throw Error('no chromium');}}), e=>e instanceof LandBrowserError && e.code==='browser-unavailable');
});
test('rent requests never launch the browser', async () => {
  let launched=false; await assert.rejects(searchHepsiemlak({...criteria,tenure:'rent'},{launchBrowser:async()=>{launched=true;}}),e=>e.code==='unsupported-criteria'); assert.equal(launched,false);
});
test('local middleware requires demo session and same origin; preserves source-blocked status', async () => {
  let handler,calls=0;
  landBrowserLocalPlugin({sourceName:"Hepsiemlak",search:async()=>{calls++;throw new LandBrowserError('source-blocked','Hepsiemlak erişim engeli');}}).configureServer({config:{server:{host:'127.0.0.1'}},middlewares:{use(fn){handler=fn;}}});
  const server=createServer((req,res)=>handler(req,res,()=>{res.statusCode=404;res.end();})); await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const root='http://127.0.0.1:'+server.address().port;
  try {
    const headers={'content-type':'application/json',cookie:'arkemx_prototype_session=1',origin:root};
    assert.equal((await fetch(root+'/api/land-candidates')).status,401);
    assert.equal((await fetch(root+'/api/land-candidates',{headers})).status,200);
    assert.equal((await fetch(root+'/api/land-candidates',{method:'POST',headers:{...headers,origin:'https://evil.test'},body:JSON.stringify(criteria)})).status,403);
    const response=await fetch(root+'/api/land-candidates',{method:'POST',headers,body:JSON.stringify(criteria)});assert.equal(response.status,502);const data=await response.json();assert.equal(data.sources[0].status,'blocked');assert.equal(calls,1);
  } finally {await new Promise(resolve=>server.close(resolve));}
});

test('detail middleware uses session/origin guards and returns explicit Emlakjet block', async () => {
  let handler, calls = 0;
  landBrowserLocalPlugin({detail:async()=>{calls++;throw new LandBrowserError('source-blocked','Emlakjet detay erişim engeli');}}).configureServer({config:{server:{host:'127.0.0.1'}},middlewares:{use(fn){handler=fn;}}});
  const server=createServer((req,res)=>handler(req,res,()=>{res.statusCode=404;res.end();})); await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const root='http://127.0.0.1:'+server.address().port;
  const body=JSON.stringify({url:'https://www.emlakjet.com/ilan/sentetik-arsa-12345678',province:'Kastamonu',district:'Merkez'});
  try {
    const headers={'content-type':'application/json',cookie:'arkemx_prototype_session=1',origin:root};
    assert.equal((await fetch(root+'/api/land-candidate-detail',{method:'POST',headers:{'content-type':'application/json'},body})).status,401);
    assert.equal((await fetch(root+'/api/land-candidate-detail',{method:'POST',headers:{...headers,origin:'https://evil.test'},body})).status,403);
    assert.equal((await fetch(root+'/api/land-candidate-detail',{headers})).status,405);
    const response=await fetch(root+'/api/land-candidate-detail',{method:'POST',headers,body});
    assert.equal(response.status,502); const data=await response.json(); assert.equal(data.code,'source-blocked');assert.equal(data.sources[0].name,'Emlakjet');assert.equal(data.sources[0].status,'blocked');assert.equal(calls,1);
  } finally {await new Promise(resolve=>server.close(resolve));}
});


test('zoning middleware accepts the original Codespaces host before the worker rewrite; auth and origin checks remain enforced', async () => {
  let handler,calls=0;
  landBrowserLocalPlugin({zoning:async(input,{signal})=>{calls++;assert.equal(input.block,'143');assert.ok(signal);return {schema:'ARKEM-OFFICIAL-ZONING/1.0',status:'not-found',identity:input};}}).configureServer({config:{server:{host:'127.0.0.1'}},middlewares:{use(fn){handler=fn;}}});
  const server=createServer((req,res)=>handler(req,res,()=>{res.statusCode=404;res.end();}));await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const root='http://127.0.0.1:'+server.address().port;
  const body=JSON.stringify({province:'Kastamonu',district:'Merkez',neighborhood:'Kuzyaka Köyü',neighborhoodId:'123',block:'143',parcelNo:'11'});
  const headers={'content-type':'application/json',cookie:'arkemx_prototype_session=1',host:'arkemx-demo-5173.app.github.dev',origin:'https://arkemx-demo-5173.app.github.dev'};
  const send=options=>new Promise((resolve,reject)=>{
    const req=request(root+'/api/zoning-conditions',{method:options.method||'GET',headers:options.headers},res=>{
      let data='';res.setEncoding('utf8');res.on('data',chunk=>data+=chunk);res.on('end',()=>resolve({status:res.statusCode,json:async()=>JSON.parse(data)}));
    });req.on('error',reject);req.end(options.body);
  });
  try {
    assert.equal((await send({method:'POST',headers:{...headers,cookie:''},body})).status,401);
    assert.equal((await send({method:'POST',headers:{...headers,origin:'https://evil.test'},body})).status,403);
    assert.equal((await send({method:'POST',headers:{...headers,'x-forwarded-host':'evil.test',origin:'https://evil.test'},body})).status,403);
    assert.equal((await send({headers})).status,405);
    assert.equal((await send({method:'POST',headers,body:'{}'})).status,400);
    assert.equal((await send({method:'POST',headers,body:' '.repeat(2001)})).status,413);
    const response=await send({method:'POST',headers,body});assert.equal(response.status,200);assert.equal((await response.json()).status,'not-found');assert.equal(calls,1);
  } finally {await new Promise(resolve=>server.close(resolve));}
});

import { architecturePlacementPending, architectureSiteContext } from '../app/lib/architecture-draft.ts';
test('draft architecture can retain its program while missing zoning or failing placement stays pending',()=>{
 const complete={zoning:{taks:.3,kaks:1.5,hmax:12,frontSetback:5,sideSetback:3,rearSetback:3,planScale:'1/1000',buildingOrder:'Ayrık'},metrics:{geometryValid:true,setbackPass:true,area:1000,allowedFootprint:300,allowedGross:1500,footprint:200,gross:600,buildingHeight:9}};
 assert.equal(architecturePlacementPending(complete),false);
 const ctx={parcelReference:'143/11',massingModel:{schema:'ARKEM-ZONING-MASSING/1.0'},selectedMassingId:'balanced'};
 assert.deepEqual(architectureSiteContext(complete,ctx),ctx);
 for(const value of [{},{...complete,zoning:{...complete.zoning,hmax:-1}},{...complete,metrics:{...complete.metrics,setbackPass:false}},{...complete,metrics:{...complete.metrics,gross:2000}},{...complete,metrics:{...complete.metrics,geometryValid:false}}]) {
   assert.equal(architecturePlacementPending(value),true);
   assert.deepEqual(architectureSiteContext(value,ctx),{parcelReference:'143/11'});
 }
 assert.equal(ctx.selectedMassingId,'balanced');assert.ok(ctx.massingModel);
});

import { deriveProgramFloorPlates, buildProgramPlanElements, coordinateProgramAxes } from '../app/lib/plan-program.ts';
test('unequal program rooms retain their target area and stay inside their floor plate', () => {
  for (const areas of [[100,40,3], [100,100,100,1], [1000,100,50,10,1]]) {
    for (const netRatio of [78,90,95]) {
      const spaces = areas.map((unitArea,i) => ({ id: String(i), unitArea, count: 1 }));
      const plates = deriveProgramFloorPlates(spaces, [], 1, netRatio, 1.45);
      const elements = buildProgramPlanElements(spaces, 6, 5, 1, 3.5, 5, 5, [], plates);
      const rooms = elements.filter(element => element.type === 'space');
      assert.equal(rooms.length, areas.length);
      for (const room of rooms) {
        const area = room.widthBays * room.heightBays * plates[0].width / 6 * plates[0].depth / 5;
        assert.ok(Math.abs(area - room.sourceUnitArea) / room.sourceUnitArea <= .03, JSON.stringify({room,area,netRatio}));
        assert.ok(room.x >= 0 && room.y >= 0 && room.x + room.widthBays <= 6.001 && room.y + room.heightBays <= 5.001);
      }
    }
  }
});
test('axis coordination respects the smallest floor without changing its area', () => {
  const plates = [{level:1,width:20,depth:18,grossArea:360,netArea:280},{level:2,width:7,depth:5,grossArea:35,netArea:27}];
  const copy = structuredClone(plates);
  assert.deepEqual(coordinateProgramAxes(plates,6,5), {baysX:3,baysY:2});
  assert.deepEqual(plates, copy);
  // A plate narrower than 4 m remains insufficient for two 2 m bays.
  const narrow = [{level:1,width:3,depth:5,grossArea:15,netArea:11}];
  const axes = coordinateProgramAxes(narrow,6,5);
  assert.equal(axes.baysX,2);
  assert.ok(narrow[0].width / axes.baysX < 2);
});
