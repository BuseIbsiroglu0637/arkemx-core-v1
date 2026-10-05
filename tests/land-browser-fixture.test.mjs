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
      let html=mode==='blocked'?'<main>Olağan dışı erişim tespit ettik</main>':mode==='layout'?'<main>Geçici hata</main>':`<main>${filtered?(mode==='empty'?'0 ilan bulundu':'131 ilan bulundu'+Array.from({length:30},(_,i)=>card(i+1, i===0?12000000:620000+i*1000)).join('')):'405 ilan bulundu'}</main><input id="priceMax" data-filter="price" placeholder="En Çok TL"><input id="squareMin" data-filter="min" placeholder="En Az m²"><input id="squareMax" data-filter="max" placeholder="En Çok m²"><button id="search">Ara</button><script>document.getElementById('search').addEventListener('click',()=>{const u=new URL(location.href);u.searchParams.set('p32',document.querySelector('[data-filter="price"]').value);u.searchParams.set('p25',document.querySelector('[data-filter="min"]').value);const max=document.querySelector('[data-filter="max"]').value;if(max)u.searchParams.set('p26',max);location.href=u.href;});</script>`;
      if (mode==='cloudflare-tr') html='<html><head><title>Bir dakika lütfen...</title></head><body><input type="hidden" id="cf-chl-widget-example_response"></body></html>';
      if (mode==='challenge-field') html='<html><head><title>Doğrulama</title></head><body><input type="hidden" id="cf-chl-widget-example_response"></body></html>';
      if (mode==='ids') html=html.replace('placeholder="En Az m²"','placeholder="Minimum alan"').replace('placeholder="En Çok m²"','placeholder="Maksimum alan"');
      if (mode==='legacy') html=html.replace('id="priceMax"','').replace('id="squareMin"','').replace('id="squareMax"','').replace('placeholder="En Az m²"','placeholder="En az m2"');
      return route.fulfill({contentType:'text/html; charset=utf-8',body:html});
    });return context;};return browser;
  };
}
async function runFixture(mode, input=criteria) {
  try { return await searchHepsiemlak(input,{launchBrowser:fixture(mode)}); }
  catch (error) { if (error.cause) console.error(error.cause); throw error; }
}
test('actual Chromium fills filters, reads first 24 cards, excludes over-budget and preserves usage mismatch',async()=>{
  const out=await runFixture('results');assert.equal(out.sources[0].readCount,24);assert.equal(out.sources[0].totalCount,131);assert.equal(out.candidates.length,23);assert.equal(out.candidates[0].priceTRY,621000);assert.equal(out.candidates[0].use,'agricultural');assert.equal(out.candidates[0].basis,'browser-listing');
});
test('actual Chromium distinguishes explicit empty result from source block',async()=>{
  assert.deepEqual((await runFixture('empty')).candidates,[]);
  await assert.rejects(runFixture('blocked'),e=>e.code==='source-blocked');
});

test('area-only form works by live IDs despite placeholder wording and verifies maximum area',async()=>{
  const out=await runFixture('ids',{...criteria,minArea:1000,maxArea:5000,maxPrice:0});
  assert.equal(out.sources[0].readCount,24);assert.equal(out.candidates.length,24);
});
test('legacy form without IDs accepts plain m2 and mixed case placeholders',async()=>{
  assert.equal((await runFixture('legacy')).candidates.length,23);
});
test('missing form becomes explicit layout error rather than successful empty result',async()=>{
  await assert.rejects(runFixture('layout'),e=>e.code==='layout-changed' && /filtresi/.test(e.message));
});

test('Turkish Cloudflare title and challenge-only DOM stop before filter fill',async()=>{
  for(const mode of ['cloudflare-tr','challenge-field']) {
    await assert.rejects(runFixture(mode),e=>e.code==='source-blocked' && /İlanlar okunamadı/.test(e.message));
  }
});
