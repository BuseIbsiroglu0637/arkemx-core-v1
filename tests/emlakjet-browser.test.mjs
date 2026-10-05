import test from 'node:test';
import assert from 'node:assert/strict';
import { emlakjetSearchUrl, isEmlakjetListing, parseEmlakjetCard, searchEmlakjet } from '../scripts/lib/emlakjet-browser.mjs';
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
