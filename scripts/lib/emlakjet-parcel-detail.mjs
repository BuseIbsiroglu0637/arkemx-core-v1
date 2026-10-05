import { isEmlakjetListing } from './emlakjet-browser.mjs';
import { LandBrowserError, classifySourcePage } from './hepsiemlak-browser.mjs';
import { normalizeLandParcelIdentity } from '../../app/lib/land-parcel-prefill.ts';

export function parseEmlakjetParcelDetail(raw, { url, province, district }, retrievedAt) {
  const values = label => raw.rows.filter(row => row.label === label).map(row => row.value.trim());
  const single = label => { const entries = values(label); return entries.length === 1 ? entries[0] : ''; };
  const listingId = new URL(url).pathname.match(/-(\d+)\/?$/)?.[1];
  if (single('İlan Numarası') !== listingId) throw new LandBrowserError('layout-changed', 'İlan numarası doğrulanamadı; ada/parsel aktarılmadı.');
  const locations = raw.breadcrumbs.filter(row => /^\/satilik-[a-z-]+\/[a-z0-9-]+\/?$/.test(new URL(row.url, url).pathname))
    .map(row => row.text.replace(/\s+Satılık\s+.+$/, '').trim());
  if (locations.length !== 3 || locations[0] !== province || locations[1] !== `${province} ${district}` || !locations[2].startsWith(`${district} `)) {
    throw new LandBrowserError('layout-changed', 'İlanın il/ilçe bilgileri seçilen adayla eşleşmedi; ada/parsel aktarılmadı.');
  }
  return normalizeLandParcelIdentity({ province, district, neighborhood: locations[2].slice(district.length).trim(),
    block: single('Ada'), parcelNo: single('Parsel'), sourceUrl: url, retrievedAt, basis: 'listing-declaration' }, url);
}

export async function readEmlakjetParcelDetail(input, { launchBrowser, signal } = {}) {
  if (!input || !isEmlakjetListing(input.url) || !/^[\p{L} .'-]{2,60}$/u.test(input.province || '') || !/^[\p{L} .'-]{2,60}$/u.test(input.district || '')) {
    throw new LandBrowserError('unsupported-criteria', 'Ada/parsel okumak için Emlakjet ilanı, il ve ilçe gerekli.');
  }
  let browser, context;
  const abort = () => { void browser?.close().catch(() => {}); };
  const timer = setTimeout(abort, 45000);
  signal?.addEventListener('abort', abort, { once: true });
  try {
    if (signal?.aborted) throw new LandBrowserError('cancelled', 'İlan okuması iptal edildi.');
    try { browser = await (launchBrowser || (async () => (await import('playwright')).chromium.launch({ headless: true })))(); }
    catch { throw new LandBrowserError('browser-unavailable', 'İlan detayını okumak için Chromium açılamadı.'); }
    if (signal?.aborted) throw new LandBrowserError('cancelled', 'İlan okuması iptal edildi.');
    context = await browser.newContext({ locale: 'tr-TR', viewport: { width: 1366, height: 900 } });
    const page = await context.newPage();
    async function inspect() {
      const body = await page.locator('body').innerText();
      const challengeDetected = await page.locator('input[name="cf-turnstile-response"], input[id^="cf-chl-widget-"]').count() > 0;
      if (classifySourcePage(body, { title: await page.title(), challengeDetected }) === 'blocked') throw new LandBrowserError('source-blocked', 'Emlakjet ilan detayına erişimi engelledi veya insan doğrulaması istedi. Ada/parsel okunamadı.');
      if (!isEmlakjetListing(page.url()) || new URL(page.url()).pathname !== new URL(input.url).pathname) throw new LandBrowserError('layout-changed', 'Seçilen ilan detayına ulaşılamadı.');
    }
    await page.goto(input.url, { waitUntil: 'domcontentloaded', timeout: 25000 });
    await inspect();
    try { await page.getByText('İlan Numarası', { exact: true }).waitFor({ timeout: 12000 }); }
    catch (error) { await inspect(); throw new LandBrowserError('layout-changed', 'İlan detay alanları yüklenmedi; ada/parsel aktarılmadı.', error); }
    await inspect();
    const rows = await page.locator('ul').filter({ has: page.getByText('İlan Numarası', { exact: true }) }).locator('li').evaluateAll(elements => elements.map(e => ({
      label: e.children[0]?.textContent?.trim() || '', value: e.children[1]?.textContent?.trim() || '',
    })));
    const breadcrumbs = await page.getByRole('navigation', { name: 'Sayfa yolu' }).locator('a').evaluateAll(elements => elements.map(e => ({ text: e.textContent?.trim() || '', url: e.href })));
    const retrievedAt = new Date().toISOString();
    const parcelIdentity = parseEmlakjetParcelDetail({ rows, breadcrumbs }, input, retrievedAt);
    return { schema: 'ARKEM-LAND-PARCEL-DETAIL/1.0', url: input.url, parcelIdentity, status: parcelIdentity ? 'found' : 'missing', retrievedAt };
  } catch (error) {
    if (error instanceof LandBrowserError) throw error;
    if (signal?.aborted) throw new LandBrowserError('cancelled', 'İlan okuması iptal edildi.');
    throw new LandBrowserError('unavailable', 'İlan detayı okunamadı; ada/parsel aktarılmadı.', error);
  } finally {
    clearTimeout(timer); signal?.removeEventListener('abort', abort);
    await context?.close().catch(() => {}); await browser?.close().catch(() => {});
  }
}
