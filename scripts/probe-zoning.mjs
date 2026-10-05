import { KASTAMONU_IMAR_ROOT, officialConnectionFailure } from '../app/lib/kastamonu-zoning.ts';

// Connectivity checks only. These responses do not establish any parcel's zoning rights.
const targets = [
  { name: 'TKGM', url: 'https://cbsapi.tkgm.gov.tr/megsiswebapi.v3.1/api/idariYapi/ilListe', valid: data => Array.isArray(data?.features) && data.features.length > 0 },
  { name: 'Kastamonu e-İmar konut alanı', url: `${KASTAMONU_IMAR_ROOT}/1826?f=json`, valid: data => data?.id === 1826 && Array.isArray(data.fields) },
  { name: 'Kastamonu e-İmar plan kaydı', url: `${KASTAMONU_IMAR_ROOT}/1967?f=json`, valid: data => data?.id === 1967 && Array.isArray(data.fields) },
];
async function check({ name, url, valid }) {
  const started = Date.now();
  const signal = AbortSignal.timeout(25000);
  let status;
  try {
    const response = await fetch(url, { headers: { Accept: 'application/json' }, redirect: 'error', signal });
    status = response.status;
    const reader = response.body?.getReader();
    if (!reader) throw new Error('empty-response');
    const chunks = []; let size = 0;
    try {
      while (true) {
        const { done, value } = await reader.read(); if (done) break;
        size += value.length;
        if (size > 1_000_000) { await reader.cancel(); throw new Error('oversize-response'); }
        chunks.push(value);
      }
    } finally { reader.releaseLock(); }
    const bytes = new Uint8Array(size); let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
    const responseText = new TextDecoder().decode(bytes);
    if (!response.ok) return { name, url, ok: false, status,
      reason: /Günlük sorgu limitini aştınız/i.test(responseText) ? `HTTP ${status}: kaynak günlük sorgu limitinin aşıldığını bildirdi` : `HTTP ${status}`,
      elapsedMs: Date.now() - started };
    let data;
    try { data = JSON.parse(responseText); }
    catch { return { name, url, ok: false, status, reason: 'JSON yanıtı alınamadı', elapsedMs: Date.now() - started }; }
    return { name, url, ok: valid(data), status, reason: valid(data) ? 'Beklenen kaynak yanıtı okundu' : 'Kaynak şeması doğrulanamadı', elapsedMs: Date.now() - started };
  } catch (error) {
    return { name, url, ok: false, status, reason: officialConnectionFailure(error, signal), elapsedMs: Date.now() - started };
  }
}
console.log('TKGM ve Kastamonu e-İmar bağlantıları kontrol ediliyor (en fazla 25 saniye).');
const sources = await Promise.all(targets.map(check));
console.log(JSON.stringify({ note: 'Bu kontrol bağlantıyı sınar; ada/parsel ve imar koşulları ayrıca doğrulanmalıdır.', sources }, null, 2));
if (sources.some(source => !source.ok)) process.exitCode = 1;
