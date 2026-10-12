import { assessLandCandidate, landCriteriaKey, normalizeLandCandidate, parseLandCriteria } from '../../app/lib/land-research.ts';
import { LandBrowserError, classifySourcePage } from './hepsiemlak-browser.mjs';
import { launchLandBrowser } from './land-browser-launch.mjs';

const source = 'Emlakjet · tarayıcı araştırması';
const number = value => Number(value.replace(/\./g, '').replace(',', '.'));
const slug = value => value.toLocaleLowerCase('tr-TR').replace(/ı/g, 'i').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
export function emlakjetSearchUrl(criteria) {
  return `https://www.emlakjet.com/satilik-arsa/${[criteria.province, criteria.district].filter(Boolean).map(slug).join('-')}`;
}
export function emlakjetResultUrl(criteria) {
  const url = new URL(emlakjetSearchUrl(criteria));
  const filters = [['max-fiyat', criteria.maxPrice], ['min-m2', criteria.minArea], ['max-m2', criteria.maxArea]].filter(([, value]) => value > 0);
  filters.forEach(([key, value], index) => {
    if (index === 0) url.searchParams.set('filtreler', `${key}=${value}`);
    else url.searchParams.set(key, String(value));
  });
  url.searchParams.set('siralama', 'dusuk-fiyat');
  return url.href;
}
export function isEmlakjetListing(value) {
  try {
    const u = new URL(value);
    return u.protocol === 'https:' && !u.username && !u.password && !u.port
      && ['emlakjet.com', 'www.emlakjet.com'].includes(u.hostname)
      && /^\/ilan\/[a-z0-9-]+-\d+\/?$/.test(u.pathname);
  } catch { return false; }
}
export function parseEmlakjetCard(card, retrievedAt, province) {
  if (!isEmlakjetListing(card.url) || !card.title) return null;
  // Use the structured card paragraphs, never numbers in the advertisement title.
  const paragraphs = Array.isArray(card.paragraphs) ? card.paragraphs : [];
  const area = paragraphs.find(p => /[\d.,]+\s*m[²2](?:\s|$)/i.test(p))?.match(/([\d.,]+)\s*m[²2]/i);
  const location = paragraphs[0]?.split(',').map(s => s.trim()) || [];
  const price = String(card.text || '').split('\n').find(line => /^\s*[\d.,]+\s*₺\s*$/.test(line));
  let priceTRY = price ? number(price.replace(/[^\d.,]/g, '')) : null;
  const areaM2 = area ? number(area[1]) : null;
  const title = card.title.toLocaleLowerCase('tr-TR');
  // The broad arsa page does not publish an explicit usage category in each card.
  // Only retain clear title claims; zoning and infrastructure stay unverified.
  let use = '';
  if (/tarla|bahçe|bahce|bağ|\bbag\b|zeytinlik/.test(title)) use = 'agricultural';
  else if (/sanayi imarlı|sanayi imarli|depo izinli/.test(title)) use = 'industrial';
  else if (/konut.*ticaret|ticaret.*konut/.test(title)) use = 'mixed';
  else if (/konut imarlı|konut imarli|villa/.test(title)) use = 'residential';
  else if (/ticari imarlı|ticari imarli/.test(title)) use = 'commercial';
  const share = /hisse|koop\.?|kooperatif/.test(title);
  const suspicious = priceTRY && areaM2 && priceTRY / areaM2 < 10;
  if (share || suspicious) priceTRY = null;
  return normalizeLandCandidate({ title: card.title, url: card.url, source, province,
    district: location[0] || '', tenure: 'sale', priceTRY, areaM2, use, basis: 'browser-listing',
    description: `İl arama sayfasından, ilçe ve alan ilan kartından okundu. Kullanım varsa yalnız başlık beyanıdır; parsel, imar ve altyapı doğrulanmadı.${share ? ' Hisse/kooperatif ilanı; fiyatın bütün arsa bedeli olduğu doğrulanmadı.' : suspicious ? ' Fiyat/alan oranı olağan dışı; toplam fiyat teyit edilmeli.' : ''}`,
  }, retrievedAt);
}

// One bounded ordinary-browser search. No CAPTCHA solving, stealth or retries.
export async function searchEmlakjet(rawCriteria, { launchBrowser, signal } = {}) {
  const criteria = parseLandCriteria(rawCriteria);
  if (!criteria || criteria.tenure !== 'sale') throw new LandBrowserError('unsupported-criteria', 'Tarayıcı başlangıç sürümü yalnız satılık arsa araştırır.');
  let browser, context;
  const abort = () => { void browser?.close().catch(() => {}); };
  const timer = setTimeout(abort, 90000);
  signal?.addEventListener('abort', abort, { once: true });
  try {
    if (signal?.aborted) throw new LandBrowserError('cancelled', 'Arama iptal edildi.');
    try {
      browser = await (launchBrowser || launchLandBrowser)();
    } catch { throw new LandBrowserError('browser-unavailable', 'Araştırma tarayıcısı açılamadı. Chromium veya Microsoft Edge kurulumunu kontrol edin.'); }
    if (signal?.aborted) throw new LandBrowserError('cancelled', 'Arama iptal edildi.');
    context = await browser.newContext({ locale: 'tr-TR', viewport: { width: 1366, height: 900 } });
    const page = await context.newPage();
    page.setDefaultTimeout(12000);
    async function inspectPage() {
      const text = await page.locator('body').innerText();
      const challengeDetected = await page.evaluate(() => !document.querySelector('main article')
        && Boolean(document.querySelector('input[id^="cf-chl-widget-"][id$="_response"], input[name="cf-turnstile-response"]')));
      if (classifySourcePage(text, { title: await page.title(), challengeDetected }) === 'blocked') throw new LandBrowserError('source-blocked', 'Emlakjet bu araştırma tarayıcısında insan doğrulaması istedi veya erişimi engelledi. İlanlar okunamadı ve araştırma durduruldu.');
      if (new URL(page.url()).origin !== 'https://www.emlakjet.com') throw new LandBrowserError('layout-changed', 'Emlakjet araması beklenen ilan sayfasına ulaşmadı.');
      return text;
    }
    async function ready() {
      await inspectPage();
      try {
        await page.waitForFunction(() => document.querySelector('main article')
          || /0\s+ilan bulundu|ilan bulunamadı|sonuç bulunamadı|verify you are human|captcha|access denied/i.test(document.body.innerText)
          || /^(?:bir dakika lütfen|just a moment)\s*[.!…]*$/i.test(document.title.trim()), null, { timeout: 15000 });
      } catch (error) { await inspectPage(); throw new LandBrowserError('layout-changed', 'Emlakjet ilan kartları yüklenmedi; boş sonuç kabul edilmedi.', error); }
      return inspectPage();
    }
    const startUrl = emlakjetResultUrl(criteria);
    await page.goto(startUrl, { waitUntil: 'domcontentloaded', timeout: 25000 });
    await ready();
    // Scope is verified on the visible heading before adopting its province.
    const expectedHeading = [criteria.province, criteria.district, 'Satılık Arsa'].filter(Boolean).join(' ').toLocaleLowerCase('tr-TR');
    if ((await page.getByRole('heading', { level: 1 }).innerText()).trim().toLocaleLowerCase('tr-TR') !== expectedHeading) throw new LandBrowserError('layout-changed', 'Emlakjet il/ilçe araması doğrulanamadı.');
    // Use the public result URL observed on the site's own form. Reading does not
    // depend on client hydration, debounced input handlers or a full load event.
    const finalUrl = new URL(page.url());
    const encoded = new URLSearchParams(finalUrl.searchParams.get('filtreler') || '');
    for (const [key, value, button, placeholder] of [
      ['max-fiyat', criteria.maxPrice, 'En Fazla Fiyat', 'En Fazla'],
      ['min-m2', criteria.minArea, 'En Az Metrekare', 'En Az'],
      ['max-m2', criteria.maxArea, 'En Fazla Metrekare', 'En Fazla'],
    ]) {
      if (!value) continue;
      const field = page.locator('fieldset').filter({ has: page.getByRole('button', { name: button, exact: true }) }).getByPlaceholder(placeholder, { exact: true });
      try {
        const applied = number((await field.inputValue()).replace(/\s/g, ''));
        if ((encoded.get(key) || finalUrl.searchParams.get(key)) !== String(value) || applied !== value) throw Error('Requested filter differs from displayed result form');
      } catch (error) {
        await inspectPage();
        const failure = new LandBrowserError('layout-changed', `Emlakjet sonuç sayfasında ${key} filtresi doğrulanamadı; boş sonuç kabul edilmedi.`, error);
        failure.diagnostic = { stage: 'verify-result-filter', filter: key, path: finalUrl.pathname, title: await page.title(), articleCount: await page.locator('main article').count() };
        throw failure;
      }
    }
    if (finalUrl.searchParams.get('siralama') !== 'dusuk-fiyat') throw new LandBrowserError('layout-changed', 'Emlakjet sonuç sıralaması doğrulanamadı.');
    const text = await inspectPage();
    const raw = await page.locator('main article').evaluateAll(elements => elements.slice(0, 24).map(e => ({
      title: e.querySelector('h3')?.textContent?.trim() || '', url: e.querySelector('h3 a')?.href || '',
      // content-visibility:auto can omit offscreen descendants from innerText.
      // Keep price boundaries: unit prices and concatenated card text are not totals.
      text: Array.from(e.querySelectorAll('*')).map(n => n.textContent?.trim() || '')
        .filter(value => /^[\d.,]+\s*₺$/.test(value)).join('\n'),
      paragraphs: Array.from(e.querySelectorAll('p')).map(p => p.textContent?.trim() || ''),
    })));
    if (!raw.length && classifySourcePage(text) !== 'empty') throw new LandBrowserError('layout-changed', 'Emlakjet ilan kartları okunamadı; boş sonuç kabul edilmedi.');
    const searchedAt = new Date().toISOString();
    const parsed = raw.map(row => parseEmlakjetCard(row, searchedAt, criteria.province)).filter(Boolean);
    if (raw.length && !parsed.length) throw new LandBrowserError('layout-changed', 'Emlakjet kart biçimi okunamadı; boş sonuç kabul edilmedi.');
    const candidates = [...new Map(parsed.map(c => [c.id, c])).values()].filter(c => !assessLandCandidate(c, criteria).mismatch.some(m => m !== 'Kullanım beyanı farklı'))
      .sort((a, b) => (a.priceTRY ?? Infinity) - (b.priceTRY ?? Infinity));
    const total = text.match(/(\d[\d.]*)\s+ilan bulundu/i)?.[1];
    return { schema: 'ARKEM-LAND-SEARCH/1.0', criteriaKey: landCriteriaKey(criteria), searchedAt, provider: source, candidates,
      sources: [{ name: 'Emlakjet', status: 'completed', readCount: raw.length, totalCount: total ? number(total) : null,
        note: 'Yalnız ilk sayfadan en fazla 24 kart okundu. Kullanım, parsel ve imar doğrulanmadı.' }] };
  } catch (error) {
    if (error instanceof LandBrowserError) throw error;
    if (signal?.aborted) throw new LandBrowserError('cancelled', 'Arama iptal edildi.');
    throw new LandBrowserError('unavailable', 'Emlakjet araştırması tamamlanamadı. Bağlantı veya sayfa düzeni kontrol edilmeli; boş sonuç kabul edilmedi.', error);
  } finally {
    clearTimeout(timer); signal?.removeEventListener('abort', abort);
    await context?.close().catch(() => {}); await browser?.close().catch(() => {});
  }
}
