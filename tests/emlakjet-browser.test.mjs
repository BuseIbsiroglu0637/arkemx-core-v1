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
  assert.equal(parseEmlakjetParcelDetail({ ...detailRaw, rows: detailRaw.rows.filter(r => r.label !== 'Ada') }, detailInput, detailAt).block, '');
  assert.equal(parseEmlakjetParcelDetail({ ...detailRaw, rows: [...detailRaw.rows, {label:'Parsel',value:'12'}] }, detailInput, detailAt).parcelNo, '');
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

import { parseEmlakjetZoningDeclaration } from '../scripts/lib/emlakjet-parcel-detail.mjs';
import { listingZoningPrefill } from '../app/lib/land-zoning-declaration.ts';
test('explicit listing zoning labels retain decimals and units without inferring values from floors or search assumptions', () => {
 const raw={...detailRaw,description:'TAKS: %30; KAKS: 1,50; Hmax: 10,50 m. 3 kat villa.'};
 const zoning=parseEmlakjetZoningDeclaration(raw,detailInput,detailAt);
 assert.equal(zoning.taks,0.3);assert.equal(zoning.kaks,1.5);assert.equal(zoning.hmax,10.5);
 assert.equal(parseEmlakjetZoningDeclaration({...detailRaw,description:'%40, 2,5 Kat Villa imarlı'},detailInput,detailAt),null);
 assert.equal(parseEmlakjetZoningDeclaration({...raw,description:raw.description+' KAKS: 2,00'},detailInput,detailAt).kaks,null);
 const ambiguous=parseEmlakjetZoningDeclaration({...detailRaw,description:'TAKS: 0,30-0,40; Hmax: 3 kat; Emsal: belirsiz'},detailInput,detailAt);
 assert.equal(ambiguous,null);
});
test('listing zoning prefill fills missing fields with source evidence and keeps reviewed or conflicting work', () => {
 const declaration=parseEmlakjetZoningDeclaration({...detailRaw,description:'TAKS: 0,30; Emsal: 1,50; Yençok: 9 m'},detailInput,detailAt);
 const current={taks:-1,kaks:-1,hmax:-1,landUse:'',sourceDocument:'',sourceUrl:'',sourceType:'',sourceNote:'',expertReviewStatus:'not-reviewed',verification:'user-declared'};
 const next=listingZoningPrefill(current,declaration);
 assert.equal(next.taks,0.3);assert.equal(next.kaks,1.5);assert.equal(next.hmax,9);assert.equal(next.sourceType,'İlan beyanı');assert.equal(next.sourceUrl,card.url);assert.equal(next.verification,'user-declared');
 for(const patch of [{taks:0.2},{sourceDocument:'plan.pdf'},{sourceUrl:'https://municipality.test/'},{expertReviewStatus:'reviewed-consistent'},{verification:'approved-plan'}]) assert.equal(listingZoningPrefill({...current,...patch},declaration),null);
});

test('missing ada/parsel retains independently declared village and fills only compatible missing fields',()=>{
  const raw={...detailRaw,rows:[detailRaw.rows[0]],breadcrumbs:detailRaw.breadcrumbs.map(row=>({...row,text:row.text.replace('Kuzyaka','Göcen')}))};
  const identity=parseEmlakjetParcelDetail(raw,detailInput,detailAt);
  assert.equal(identity.neighborhood,'Göcen Köyü');assert.equal(identity.block,'');assert.equal(identity.parcelNo,'');
  const next=landParcelPrefill({province:'Kastamonu',district:'Merkez'},identity);
  assert.equal(next.neighborhood,'Göcen Köyü');assert.equal(next.block,'');assert.equal(next.parcelNo,'');
  assert.equal(landParcelPrefill({...next},identity),null);
  assert.equal(landParcelPrefill({province:'Kastamonu',district:'Merkez',block:'210',parcelNo:'15'},identity).block,'210');
  for(const current of [{neighborhood:'Başka Köy'},{province:'Sakarya'},{parcel:[{}]},{previewParcel:[{}]}])assert.equal(landParcelPrefill(current,identity),null);
  assert.equal(normalizeLandParcelIdentity({...identity,block:'unknown'},card.url),null);
  const candidate=normalizeLandCandidate({...parseEmlakjetCard(card,detailAt,'Kastamonu'),parcelIdentity:identity,listingDetailVersion:3},detailAt);
  assert.equal(readLandResearch({schema:'ARKEM-LAND-RESEARCH/1.0',criteria,shortlist:[candidate],selectedId:candidate.id}).shortlist[0].parcelIdentity.neighborhood,'Göcen Köyü');
});
