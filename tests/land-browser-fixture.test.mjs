import test from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { searchHepsiemlak } from '../scripts/lib/hepsiemlak-browser.mjs';
const criteria={province:'Kastamonu',district:'',tenure:'sale',minArea:3000,maxArea:0,maxPrice:10000000,use:'industrial',needs:[]};
const card=(i,price=620000)=>`<article><a href="https://www.hepsiemlak.com/kastamonu-ihsangazi-yeni-satilik/tarla/1-${i}"><p>${price.toLocaleString('tr-TR')} TL</p><h3>Sentetik tarla ${i}</h3><div>Satılık Tarla</div><div>Brüt m²</div><div>3.199 m²</div><div>Kastamonu / İhsangazi / Yeni Mah.</div></a></article>`;
function fixture(mode) {
  return async()=>{
    const browser=await chromium.launch();
    const create=browser.newContext.bind(browser);
    browser.newContext=async opts=>{const context=await create(opts);await context.route('https://www.hepsiemlak.com/**',route=>{
      const filtered=new URL(route.request().url()).searchParams.has('p25');
      let html=mode==='blocked'?'<main>Olağan dışı erişim tespit ettik</main>':mode==='layout'?'<main>Geçici hata</main>':`<main>${filtered?(mode==='empty'?'0 ilan bulundu':'131 ilan bulundu'+Array.from({length:30},(_,i)=>card(i+1, i===0?12000000:620000+i*1000)).join('')):'405 ilan bulundu'}</main><input placeholder="En Çok TL"><input placeholder="En Az m²"><input placeholder="En Çok m²"><button id="search">Ara</button><script>document.getElementById('search').addEventListener('click',()=>{const u=new URL(location.href);u.searchParams.set('p32',document.querySelector('[placeholder="En Çok TL"]').value);u.searchParams.set('p25',document.querySelector('[placeholder="En Az m²"]').value);location.href=u.href;});</script>`;
      return route.fulfill({contentType:'text/html',body:html});
    });return context;};return browser;
  };
}
test('actual Chromium fills filters, reads first 24 cards, excludes over-budget and preserves usage mismatch',async()=>{
  const out=await searchHepsiemlak(criteria,{launchBrowser:fixture('results')});assert.equal(out.sources[0].readCount,24);assert.equal(out.sources[0].totalCount,131);assert.equal(out.candidates.length,23);assert.equal(out.candidates[0].priceTRY,621000);assert.equal(out.candidates[0].use,'agricultural');assert.equal(out.candidates[0].basis,'browser-listing');
});
test('actual Chromium distinguishes explicit empty result from source block',async()=>{
  assert.deepEqual((await searchHepsiemlak(criteria,{launchBrowser:fixture('empty')})).candidates,[]);
  await assert.rejects(searchHepsiemlak(criteria,{launchBrowser:fixture('blocked')}),e=>e.code==='source-blocked');
});
