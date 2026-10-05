import test from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { searchEmlakjet } from '../scripts/lib/emlakjet-browser.mjs';
const criteria = { province: 'Kastamonu', district: 'Merkez', tenure: 'sale', minArea: 1000, maxArea: 5000, maxPrice: 1000000, use: 'residential', needs: [] };
const card = (i, area=2000, price=600000) => `<article><h3><a href="https://www.emlakjet.com/ilan/sentetik-tarla-${10000000+i}">Sentetik tarla ${i}</a></h3><p>Merkez, Örnek Köyü</p><p>${area} m² · 300/m² · 05.10.2026</p><div>${price.toLocaleString('tr-TR')} ₺</div></article>`;
function fixture(mode, visits) {
  return async () => {
    const browser = await chromium.launch();
    const create = browser.newContext.bind(browser);
    browser.newContext = async options => {
      const context = await create(options);
      await context.route('https://www.emlakjet.com/**', route => {
        const url = new URL(route.request().url()); visits.push(url.href);
        const filters = new URLSearchParams(url.searchParams.get('filtreler') || '');
        const value = key => filters.get(key) || url.searchParams.get(key) || '';
        const sorted = url.searchParams.has('siralama');
        let html = `<main><h1>Kastamonu Merkez Satılık Arsa</h1><div>${mode === 'empty' ? '0 ilan bulundu' : '80 ilan bulundu' + (sorted ? Array.from({length:30}, (_,i) => card(i, i===0?500:2000, i===1?1200000:600000+i*1000)).join('') : card(100))}</div></main>`;
        for (const [group, minLabel, maxLabel, minKey, maxKey] of [['Fiyat','En Az Fiyat','En Fazla Fiyat','min-fiyat','max-fiyat'],['Metrekare','En Az Metrekare','En Fazla Metrekare','min-m2','max-m2']]) {
          html += `<button aria-expanded="true" data-toggle>${group}</button><fieldset><button aria-label="${minLabel}"></button><button aria-label="${maxLabel}"></button><input placeholder="En Az" data-key="${minKey}" value="${value(minKey)}"><input placeholder="En Fazla" data-key="${maxKey}" value="${value(maxKey)}"></fieldset>`;
        }
        html += `<button id="sort">Düşük Fiyat</button><script>
          let changed=false;
          document.querySelectorAll('input').forEach(e=>e.addEventListener('input',()=>changed=true));
          document.querySelectorAll('[data-toggle]').forEach(e=>e.addEventListener('click',()=>{
            if(!changed){e.setAttribute('aria-expanded','true');return;}
            const u=new URL(location.href);u.search='';let first=true;
            document.querySelectorAll('input').forEach(i=>{if(i.value){if(first){u.searchParams.set('filtreler',i.dataset.key+'='+i.value);first=false;}else u.searchParams.set(i.dataset.key,i.value);}});
            location.href=u.href;
          }));
          document.querySelector('#sort').addEventListener('click',()=>{const u=new URL(location.href);u.searchParams.set('siralama','dusuk-fiyat');location.href=u.href;});
        </script>`;
        if (mode === 'malformed') html = html.replaceAll('/ilan/sentetik-tarla-', '/other/');
        if (mode === 'wrong-scope') html = html.replace('Kastamonu Merkez Satılık Arsa', 'Ankara Satılık Arsa');
        if (mode === 'blocked' || (mode === 'late-block' && value('max-fiyat'))) html = '<html><head><title>Bir dakika lütfen...</title></head><body><input type="hidden" name="cf-turnstile-response"></body></html>';
        return route.fulfill({ contentType: 'text/html; charset=utf-8', body: html });
      });
      return context;
    };
    return browser;
  };
}
test('Emlakjet Chromium applies all range filters, sorts and bounds card reading', async () => {
  const visits=[];
  const out = await searchEmlakjet(criteria, { launchBrowser: fixture('results', visits) });
  assert.equal(out.sources[0].name, 'Emlakjet'); assert.equal(out.sources[0].readCount,24); assert.equal(out.sources[0].totalCount,80);
  assert.equal(out.candidates.length,22); assert.equal(out.candidates[0].priceTRY,602000); assert.equal(out.candidates[0].use,'agricultural');
  const last = new URL(visits.at(-1));
  assert.equal(new URLSearchParams(last.searchParams.get('filtreler')).get('max-fiyat'),'1000000');
  assert.equal(last.searchParams.get('min-m2'),'1000'); assert.equal(last.searchParams.get('max-m2'),'5000');
  assert.equal(last.searchParams.get('siralama'),'dusuk-fiyat');
});
test('Emlakjet explicit empty result is completed, challenge stops initial and filter navigation', async () => {
  assert.deepEqual((await searchEmlakjet(criteria, { launchBrowser: fixture('empty',[]) })).candidates,[]);
  for (const mode of ['blocked','late-block']) await assert.rejects(searchEmlakjet(criteria, { launchBrowser: fixture(mode,[]) }), e=>e.code==='source-blocked');
});
test('Emlakjet unknown card layout or wrong location cannot become successful empty research', async () => {
  for (const mode of ['malformed','wrong-scope']) await assert.rejects(searchEmlakjet(criteria, { launchBrowser: fixture(mode,[]) }), e=>e.code==='layout-changed');
});
