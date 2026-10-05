import test from 'node:test';
import assert from 'node:assert/strict';
import { parseHepsiemlakCard, searchPageUrl, isHepsiemlakListing, classifySourcePage, searchHepsiemlak, LandBrowserError } from '../scripts/lib/hepsiemlak-browser.mjs';
import { assessLandCandidate, readLandResearch, readLandSourceStatus } from '../app/lib/land-research.ts';
import { landBrowserLocalPlugin } from '../scripts/lib/land-browser-local-plugin.mjs';
import { createServer } from 'node:http';
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
