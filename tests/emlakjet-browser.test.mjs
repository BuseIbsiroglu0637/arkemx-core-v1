import test from 'node:test';
import assert from 'node:assert/strict';
import { emlakjetSearchUrl, emlakjetResultUrl, isEmlakjetListing, parseEmlakjetCard, searchEmlakjet } from '../scripts/lib/emlakjet-browser.mjs';
const criteria = { province: 'Kastamonu', district: 'Merkez', tenure: 'sale', minArea: 1000, maxArea: 0, maxPrice: 0, use: 'residential', needs: [] };
const card = { title: 'Sentetik tarla 9999 m²', url: 'https://www.emlakjet.com/ilan/sentetik-tarla-12345678',
  paragraphs: ['Merkez, Örnek Köyü', '3935 m² · Yolu Açılmış · 107/m² · 24.06.2025'], text: 'Sentetik tarla 9999 m²\n3935 m² · 107/m²\n420.000 ₺\n450.000 ₺' };
test('Emlakjet card reads structured area and current total price, retains title claim only', () => {
  const c = parseEmlakjetCard(card, '2026-10-05T12:00:00Z', 'Kastamonu');
  assert.equal(c.areaM2, 3935); assert.equal(c.priceTRY, 420000); assert.equal(c.district, 'Merkez'); assert.equal(c.province, 'Kastamonu');
  assert.equal(c.use, 'agricultural'); assert.equal(c.basis, 'browser-listing');
  assert.equal(parseEmlakjetCard({ ...card, title: 'Sentetik imarlı arsa' }, 'date', 'Kastamonu').use, '');
});
test('unit prices, share asking prices and missing values cannot become whole-land prices', () => {
  assert.equal(parseEmlakjetCard({ ...card, text: '107 ₺/m²' }, 'date', 'Kastamonu').priceTRY, null);
  assert.equal(parseEmlakjetCard({ ...card, title: 'Koop. hissesi' }, 'date', 'Kastamonu').priceTRY, null);
  assert.equal(parseEmlakjetCard({ ...card, paragraphs: ['Merkez, Örnek Köyü'] }, 'date', 'Kastamonu').areaM2, null);
});
test('Emlakjet search and listing URL validation stay on the intended source', () => {
  assert.equal(emlakjetSearchUrl({ ...criteria, province: 'İstanbul', district: 'Şişli' }), 'https://www.emlakjet.com/satilik-arsa/istanbul-sisli');
  assert.equal(isEmlakjetListing(card.url), true);
  for (const bad of [card.url.replace('emlakjet.com','emlakjet.com.evil.test'), card.url.replace('https://','https://user:pass@'), 'https://www.emlakjet.com/satilik-arsa/kastamonu']) assert.equal(isEmlakjetListing(bad), false);
});
test('unsupported criteria do not launch, missing Chromium stays explicit', async () => {
  let launched = false;
  await assert.rejects(searchEmlakjet({ ...criteria, tenure: 'rent' }, { launchBrowser: async () => { launched = true; } }), e => e.code === 'unsupported-criteria');
  assert.equal(launched, false);
  await assert.rejects(searchEmlakjet(criteria, { launchBrowser: async () => { throw Error('missing'); } }), e => e.code === 'browser-unavailable');
});

test('public result URL carries the site-observed filter serialization and low-price sort', () => {
  const u = new URL(emlakjetResultUrl({...criteria, maxPrice:10000000, maxArea:5000}));
  assert.equal(new URLSearchParams(u.searchParams.get('filtreler')).get('max-fiyat'),'10000000');
  assert.equal(u.searchParams.get('min-m2'),'1000'); assert.equal(u.searchParams.get('max-m2'),'5000');
  assert.equal(u.searchParams.get('siralama'),'dusuk-fiyat');
  assert.equal(new URLSearchParams(new URL(emlakjetResultUrl(criteria)).searchParams.get('filtreler')).get('min-m2'),'1000');
});

import { parseEmlakjetParcelDetail, readEmlakjetParcelDetail } from '../scripts/lib/emlakjet-parcel-detail.mjs';
import { landParcelPrefill, normalizeLandParcelIdentity } from '../app/lib/land-parcel-prefill.ts';
import { normalizeLandCandidate, readLandResearch } from '../app/lib/land-research.ts';
const detailInput = { url: card.url, province: 'Kastamonu', district: 'Merkez' };
const detailRaw = { rows: [{ label: 'İlan Numarası', value: '12345678' }, { label: 'Ada', value: '143' }, { label: 'Parsel', value: '11' }],
  breadcrumbs: [['Kastamonu', 'kastamonu'], ['Kastamonu Merkez', 'kastamonu-merkez'], ['Merkez Kuzyaka Köyü', 'kastamonu-merkez-kuzyaka-koyu']].map(([text, path]) => ({text: text + ' Satılık Konut İmarlı', url: 'https://www.emlakjet.com/satilik-konut-imarli-arsa/' + path})) };
const detailAt = '2026-10-05T13:00:00Z';
test('parcel identity comes from explicit listing fields and matched breadcrumb, survives shortlist storage', () => {
  const identity = parseEmlakjetParcelDetail(detailRaw, detailInput, detailAt);
  assert.equal(identity.block, '143'); assert.equal(identity.parcelNo, '11'); assert.equal(identity.neighborhood, 'Kuzyaka Köyü');
  const candidate = normalizeLandCandidate({ ...parseEmlakjetCard(card, detailAt, 'Kastamonu'), parcelIdentity: identity }, detailAt);
  assert.deepEqual(readLandResearch({ schema:'ARKEM-LAND-RESEARCH/1.0', criteria, shortlist:[candidate], selectedId:candidate.id }).shortlist[0].parcelIdentity, identity);
  assert.equal(normalizeLandParcelIdentity({ ...identity, sourceUrl: 'https://other.test/' }, card.url), null);
});
test('absent or ambiguous parcel fields stay missing, wrong listing or administrative scope is rejected', () => {
  assert.equal(parseEmlakjetParcelDetail({ ...detailRaw, rows: detailRaw.rows.filter(r => r.label !== 'Ada') }, detailInput, detailAt), null);
  assert.equal(parseEmlakjetParcelDetail({ ...detailRaw, rows: [...detailRaw.rows, {label:'Parsel',value:'12'}] }, detailInput, detailAt), null);
  assert.throws(() => parseEmlakjetParcelDetail(detailRaw, {...detailInput, district:'Araç'}, detailAt), e => e.code === 'layout-changed');
  assert.throws(() => parseEmlakjetParcelDetail(detailRaw, {...detailInput, url:card.url.replace('12345678','99999999')}, detailAt), e => e.code === 'layout-changed');
});
test('parcel prefill preserves user edits and geometry and does not introduce area or zoning', () => {
  const identity = parseEmlakjetParcelDetail(detailRaw, detailInput, detailAt);
  const prefill = landParcelPrefill({ province:'Kastamonu', district:'Merkez' }, identity);
  assert.equal(prefill.block,'143'); assert.deepEqual(Object.keys(prefill), ['province','district','neighborhood','block','parcelNo']);
  for (const current of [{block:'210'}, {province:'Sakarya'}, {parcel:[{}]}, {previewParcel:[{}]}, prefill]) assert.equal(landParcelPrefill(current, identity),null);
});
test('invalid detail URL cannot launch a browser', async () => {
  let launched = false;
  await assert.rejects(readEmlakjetParcelDetail({...detailInput,url:'https://evil.test/ilan/test-12345678'}, { launchBrowser:async()=>{launched=true;} }), e => e.code === 'unsupported-criteria');
  assert.equal(launched,false);
});
