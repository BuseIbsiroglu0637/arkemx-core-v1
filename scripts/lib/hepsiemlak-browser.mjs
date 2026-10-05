import { assessLandCandidate, landCriteriaKey, normalizeLandCandidate, parseLandCriteria } from '../../app/lib/land-research.ts';

export class LandBrowserError extends Error {
  constructor(code, message, cause) { super(message, cause ? { cause } : undefined); this.code = code; }
}
const source = 'Hepsiemlak · tarayıcı araştırması';
const number = value => Number(value.replace(/\./g, '').replace(',', '.'));
export function searchPageUrl(criteria) {
  const slug = value => value.toLocaleLowerCase('tr-TR').replace(/ı/g, 'i').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return `https://www.hepsiemlak.com/${[criteria.province, criteria.district].filter(Boolean).map(slug).join('-')}-satilik/arsa`;
}
export function isHepsiemlakListing(value) {
  try {
    const u = new URL(value);
    return u.protocol === 'https:' && !u.username && !u.password && !u.port
      && ['hepsiemlak.com', 'www.hepsiemlak.com'].includes(u.hostname)
      && /^\/[^/]+-satilik\/(tarla|bahce|arsa|bag|zeytinlik|imarli-[^/]+|konutticaret|muhtelif-arsa|depo-antrepo-izinli)\/\d+-\d+\/?$/.test(u.pathname);
  } catch { return false; }
}
export function parseHepsiemlakCard(card, retrievedAt) {
  if (!isHepsiemlakListing(card.url) || !card.title) return null;
  const text = String(card.text || '');
  const price = text.split(/Brüt\s*m[²2]|m[²2]\s*Fiyatı/i)[0].match(/([\d.,]+)\s*TL\b/);
  const area = text.match(/Brüt\s*m[²2]\s*([\d.,]+)\s*m[²2]/i);
  const location = text.match(/(?:^|\n)[ \t]*([\p{L}][\p{L} .'-]*)[ \t]*\/[ \t]*([\p{L}][\p{L} .'-]*)[ \t]*\/[^\n]+/u);
  const category = text.match(/Satılık\s+(Tarla|Bahçe|Bağ|Zeytinlik|İmarlı\s*-\s*Sanayi|İmarlı\s*-\s*Konut|İmarlı\s*-\s*Ticari|Konut\+Ticaret|Depo,?\s*Antrepo İzinli)/i)?.[1] || '';
  let use = '';
  if (/Tarla|Bahçe|Bağ|Zeytinlik/i.test(category)) use = 'agricultural';
  else if (/Sanayi|Antrepo/i.test(category)) use = 'industrial';
  else if (/Konut\+Ticaret/i.test(category)) use = 'mixed';
  else if (/Konut/i.test(category)) use = 'residential';
  else if (/Ticari/i.test(category)) use = 'commercial';
  let priceTRY = price ? number(price[1]) : null;
  const areaM2 = area ? number(area[1]) : null;
  const suspicious = priceTRY && areaM2 && priceTRY / areaM2 < 10;
  if (suspicious) priceTRY = null;
  return normalizeLandCandidate({ title: card.title, url: card.url, source,
    province: location?.[1]?.trim() || '', district: location?.[2]?.trim() || '', tenure: 'sale',
    priceTRY, areaM2, use, basis: 'browser-listing',
    description: `${category ? `İlan kategorisi: ${category}. ` : ''}Başlık ve ilan kartı okundu; ilan açıklaması, parsel, imar ve altyapı doğrulanmadı.${suspicious ? ' Fiyat/alan oranı olağan dışı; toplam fiyat teyit edilmeli.' : ''}`,
  }, retrievedAt);
}
export function classifySourcePage(text, { title = '', challengeDetected = false } = {}) {
  // The Turkish Cloudflare page observed in Codespaces has almost no body text.
  if (challengeDetected || /^(?:bir dakika lütfen|just a moment)\s*[.!…]*$/i.test(title.trim())
    || /olağan dışı.*erişim|otomatik.*erişim|verify you are human|checking your browser|just a moment|captcha|access denied|unusual traffic/i.test(text)) return 'blocked';
  if (/\b0\s+ilan bulundu|ilan bulunamadı|sonuç bulunamadı/i.test(text)) return 'empty';
  return 'unknown';
}

// Ordinary browser only: no stealth, CAPTCHA solving, proxies or retry loops.
export async function searchHepsiemlak(rawCriteria, { launchBrowser, signal } = {}) {
  const criteria = parseLandCriteria(rawCriteria);
  if (!criteria || criteria.tenure !== 'sale') throw new LandBrowserError('unsupported-criteria', 'Tarayıcı başlangıç sürümü yalnız satılık arsa araştırır.');
  let browser, context;
  const abort = () => { void browser?.close().catch(() => {}); };
  const timer = setTimeout(abort, 60000);
  signal?.addEventListener('abort', abort, { once: true });
  try {
    if (signal?.aborted) throw new LandBrowserError('cancelled', 'Arama iptal edildi.');
    try {
      const launch = launchBrowser || (async () => (await import('playwright')).chromium.launch({ headless: true }));
      browser = await launch();
    } catch { throw new LandBrowserError('browser-unavailable', 'Araştırma tarayıcısı açılamadı. Chromium kurulumunu kontrol edin.'); }
    if (signal?.aborted) throw new LandBrowserError('cancelled', 'Arama iptal edildi.');
    context = await browser.newContext({ locale: 'tr-TR', viewport: { width: 1366, height: 900 } });
    const page = await context.newPage();
    page.setDefaultTimeout(12000);
    async function inspectPage() {
      const text = await page.locator('body').innerText();
      const title = await page.title();
      const challengeDetected = await page.evaluate(() => !document.querySelector('main article, input#squareMin')
        && Boolean(document.querySelector('input[id^="cf-chl-widget-"][id$="_response"], input[name="cf-turnstile-response"]')));
      if (classifySourcePage(text, { title, challengeDetected }) === 'blocked') throw new LandBrowserError('source-blocked', 'Hepsiemlak bu araştırma tarayıcısında insan doğrulaması istedi veya erişimi engelledi. İlanlar okunamadı ve araştırma durduruldu.');
      return text;
    }
    await page.goto(searchPageUrl(criteria), { waitUntil: 'domcontentloaded', timeout: 20000 });
    await inspectPage();
    if (!['hepsiemlak.com', 'www.hepsiemlak.com'].includes(new URL(page.url()).hostname)) throw new LandBrowserError('layout-changed', 'Arama beklenen ilan sayfasına ulaşmadı.');
    const rejectCookies = page.getByText('Tümünü Reddet', { exact: true });
    if (await rejectCookies.isVisible()) await rejectCookies.click();
    async function fillFilter(id, placeholder, value, label) {
      if (value <= 0) return;
      // Stable IDs observed on the live district page; the wording may vary.
      const field = page.locator(`input#${id}`).or(page.getByPlaceholder(placeholder));
      try { await field.fill(String(value), { timeout: 25000 }); }
      catch (error) {
        if (signal?.aborted) throw error;
        await inspectPage(); // A late human-verification page is still a source block.
        const fields = await page.locator('input').evaluateAll(es => es.slice(0, 20).map(e => ({ id: e.id, placeholder: e.getAttribute('placeholder') })));
        const diagnostic = { page: new URL(page.url()).pathname, title: await page.title(), fields };
        console.warn('[ARKEMX land browser] Filter unavailable:', label, JSON.stringify(diagnostic));
        throw new LandBrowserError('layout-changed', `Hepsiemlak ${label} filtresi 25 saniye içinde kullanılamadı. Arama uygulanmadı; sayfa yüklenmesi veya filtre düzeni kontrol edilmeli.`, error);
      }
    }
    await fillFilter('priceMax', /^\s*En\s+Çok\s+TL\s*$/i, criteria.maxPrice, 'en fazla fiyat');
    await fillFilter('squareMin', /^\s*En\s+Az\s+m(?:²|2)\s*$/i, criteria.minArea, 'en az brüt alan');
    await fillFilter('squareMax', /^\s*En\s+Çok\s+m(?:²|2)\s*$/i, criteria.maxArea, 'en fazla brüt alan');
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 20000 }),
      page.getByRole('button', { name: 'Ara', exact: true }).click(),
    ]);
    await inspectPage();
    // Wait for the requested filters, not the previous page's advertisements.
    await page.waitForURL(url => (criteria.maxPrice === 0 || url.searchParams.get('p32') === String(criteria.maxPrice))
      && (criteria.minArea === 0 || url.searchParams.get('p25') === String(criteria.minArea))
      && (criteria.maxArea === 0 || url.searchParams.get('p26') === String(criteria.maxArea)), { timeout: 12000 });
    await page.waitForFunction(() => document.querySelector('main article')
      || /^(?:bir dakika lütfen|just a moment)\s*[.!…]*$/i.test(document.title.trim())
      || document.querySelector('input[id^="cf-chl-widget-"][id$="_response"], input[name="cf-turnstile-response"]')
      || /0\s+ilan bulundu|ilan bulunamadı|sonuç bulunamadı|captcha|verify you are human|access denied|olağan dışı/i.test(document.body.innerText), null, { timeout: 12000 });
    const text = await inspectPage();
    const raw = await page.getByRole('article').evaluateAll(elements => elements.slice(0, 24).map(element => ({
      title: element.querySelector('h3')?.textContent?.trim() || '', text: element.innerText,
      url: element.querySelector('a')?.href || '',
    })));
    if (!raw.length && classifySourcePage(text) !== 'empty') throw new LandBrowserError('layout-changed', 'İlan kartları okunamadı. Sayfa düzeni değişmiş olabilir; boş sonuç kabul edilmedi.');
    const searchedAt = new Date().toISOString();
    const parsed = raw.map(row => parseHepsiemlakCard(row, searchedAt)).filter(Boolean);
    if (raw.length && !parsed.length) throw new LandBrowserError('layout-changed', 'İlan kartlarının veri biçimi okunamadı; boş sonuç kabul edilmedi.');
    // A land-use mismatch remains visible for review, never a suitability approval.
    const candidates = [...new Map(parsed.map(c => [c.id, c])).values()].filter(c => {
      const a = assessLandCandidate(c, criteria);
      return !a.mismatch.some(message => message !== 'Kullanım beyanı farklı');
    }).sort((a, b) => (a.priceTRY ?? Infinity) - (b.priceTRY ?? Infinity));
    const total = text.match(/(?:için\s+)?(\d[\d.]*)\s+ilan bulundu/i)?.[1];
    return { schema: 'ARKEM-LAND-SEARCH/1.0', criteriaKey: landCriteriaKey(criteria), searchedAt, provider: source, candidates,
      sources: [{ name: 'Hepsiemlak', status: 'completed', readCount: raw.length, totalCount: total ? number(total) : null,
        note: 'Yalnız ilk sayfa okundu. Adaylar istenen toplam fiyata göre sıralı; kullanım ve altyapı uygunluğu doğrulanmadı.' }] };
  } catch (error) {
    if (error instanceof LandBrowserError) throw error;
    if (signal?.aborted) throw new LandBrowserError('cancelled', 'Arama iptal edildi.');
    throw new LandBrowserError('unavailable', 'Hepsiemlak araştırması tamamlanamadı. Bağlantı veya sayfa düzeni kontrol edilmeli; boş sonuç kabul edilmedi.', error);
  } finally {
    clearTimeout(timer); signal?.removeEventListener('abort', abort);
    await context?.close().catch(() => {}); await browser?.close().catch(() => {});
  }
}
