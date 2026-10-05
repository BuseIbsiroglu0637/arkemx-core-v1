import { assessLandCandidate, landCriteriaKey, normalizeLandCandidate, parseLandCriteria } from '../../app/lib/land-research.ts';
import { LandBrowserError, classifySourcePage } from './hepsiemlak-browser.mjs';

const source = 'Emlakjet · tarayıcı araştırması';
const number = value => Number(value.replace(/\./g, '').replace(',', '.'));
const slug = value => value.toLocaleLowerCase('tr-TR').replace(/ı/g, 'i').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
export function emlakjetSearchUrl(criteria) {
  return `https://www.emlakjet.com/satilik-arsa/${[criteria.province, criteria.district].filter(Boolean).map(slug).join('-')}`;
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
      browser = await (launchBrowser || (async () => (await import('playwright')).chromium.launch({ headless: true })))();
    } catch { throw new LandBrowserError('browser-unavailable', 'Araştırma tarayıcısı açılamadı. Chromium kurulumunu kontrol edin.'); }
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
    const startUrl = emlakjetSearchUrl(criteria);
    await page.goto(startUrl, { waitUntil: 'domcontentloaded', timeout: 25000 });
    await ready();
    // Scope is verified on the visible heading before adopting its province.
    const expectedHeading = [criteria.province, criteria.district, 'Satılık Arsa'].filter(Boolean).join(' ').toLocaleLowerCase('tr-TR');
    if ((await page.getByRole('heading', { level: 1 }).innerText()).trim().toLocaleLowerCase('tr-TR') !== expectedHeading) throw new LandBrowserError('layout-changed', 'Emlakjet il/ilçe araması doğrulanamadı.');
    async function fillFilter(group, button, placeholder, key, value) {
      if (!value) return;
      try {
        const toggle = page.getByRole('button', { name: group, exact: true });
        if (await toggle.getAttribute('aria-expanded') === 'false') await toggle.click();
        const field = page.locator('fieldset').filter({ has: page.getByRole('button', { name: button, exact: true }) }).getByPlaceholder(placeholder, { exact: true });
        await field.fill(String(value));
        await toggle.click(); // Blur commits the value; the site applies automatic search.
        await page.waitForURL(url => {
          const params = new URLSearchParams(url.searchParams.get('filtreler') || '');
          // The live UI serializes the first filter under filtreler and later ones as query parameters.
          return (params.get(key) || url.searchParams.get(key)) === String(value);
        }, { timeout: 15000 });
        await ready();
      } catch (error) {
        if (error instanceof LandBrowserError || signal?.aborted) throw error;
        await inspectPage();
        throw new LandBrowserError('layout-changed', `Emlakjet ${group.toLocaleLowerCase('tr-TR')} filtresi uygulanamadı; boş sonuç kabul edilmedi.`, error);
      }
    }
    await fillFilter('Fiyat', 'En Fazla Fiyat', 'En Fazla', 'max-fiyat', criteria.maxPrice);
    await fillFilter('Metrekare', 'En Az Metrekare', 'En Az', 'min-m2', criteria.minArea);
    await fillFilter('Metrekare', 'En Fazla Metrekare', 'En Fazla', 'max-m2', criteria.maxArea);
    await page.getByRole('button', { name: 'Düşük Fiyat', exact: true }).click();
    await page.waitForURL(url => url.searchParams.get('siralama') === 'dusuk-fiyat');
    // Load the committed result URL once to avoid reading the preceding SPA render.
    const resultUrl = page.url();
    const finalUrl = new URL(resultUrl);
    const encoded = new URLSearchParams(finalUrl.searchParams.get('filtreler') || '');
    for (const [key, value] of [['max-fiyat', criteria.maxPrice], ['min-m2', criteria.minArea], ['max-m2', criteria.maxArea]]) {
      if (value && (encoded.get(key) || finalUrl.searchParams.get(key)) !== String(value)) throw new LandBrowserError('layout-changed', 'Emlakjet sonuç filtreleri doğrulanamadı.');
    }
    await page.goto(resultUrl, { waitUntil: 'domcontentloaded', timeout: 25000 });
    const text = await ready();
    if ((await page.getByRole('heading', { level: 1 }).innerText()).trim().toLocaleLowerCase('tr-TR') !== expectedHeading) throw new LandBrowserError('layout-changed', 'Emlakjet sonuç konumu doğrulanamadı.');
    const raw = await page.locator('main article').evaluateAll(elements => elements.slice(0, 24).map(e => ({
      title: e.querySelector('h3')?.textContent?.trim() || '', url: e.querySelector('h3 a')?.href || '',
      text: e.innerText, paragraphs: Array.from(e.querySelectorAll('p')).map(p => p.innerText),
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
