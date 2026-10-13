import { ALL_RESEARCH_SOURCES, zoningResearchSources } from './zoning-research.ts';
import { officialConnectionFailure } from './kastamonu-zoning.ts';

export type ZoningSourceAccess = { id: string; checkedAt: string; status: 'page-received' | 'service-readable' | 'login-required' | 'restricted' | 'unavailable' | 'unexpected'; message: string; httpStatus?: number; sha256?: string };
/** Fixed public registry only: callers cannot supply fetch URLs, headers or credentials. */
export async function checkZoningSource(id: string, fetcher: typeof fetch = fetch, signal?: AbortSignal): Promise<ZoningSourceAccess> {
  const source = ALL_RESEARCH_SOURCES.find(s => s.id === id);
  if (!source) throw new Error('Bilinmeyen kaynak.');
  const base = { id, checkedAt: new Date().toISOString() };
  const timeout = AbortSignal.timeout(12000);
  const combined = signal ? AbortSignal.any([signal, timeout]) : timeout;
  try {
    const response = await fetcher(source.url + (source.method === 'service' ? '?f=json' : ''), { signal: combined, redirect: 'manual', cache: 'no-store', headers: { Accept: source.method === 'service' ? 'application/json' : 'text/html' } });
    const httpStatus = response.status;
    if ([401,403,429].includes(httpStatus)) return { ...base, httpStatus, status: 'restricted', message: `Kaynak HTTP ${httpStatus} döndürdü; erişim veya sorgu sınırı var. Resmî ekranı açarak kontrol edin.` };
    // Never follow an unchecked redirect, including redirects to an authentication provider.
    if (httpStatus >= 300 && httpStatus < 400) return { ...base, httpStatus, status: 'unexpected', message: 'Kaynak yönlendirme istiyor; resmî bağlantıyı tarayıcıda açın. İçerik okunmadı.' };
    if (!response.ok) return { ...base, httpStatus, status: 'unavailable', message: `Kaynak HTTP ${httpStatus} döndürdü; içerik alınamadı.` };
    const reader = response.body?.getReader();
    if (!reader) return { ...base, httpStatus, status: 'unexpected', message: 'Kaynak boş yanıt verdi.' };
    const chunks: Uint8Array[] = []; let size = 0;
    try {
      while (true) {
        const { done, value } = await reader.read(); if (done) break;
        size += value.length;
        if (size > 1_000_000) { await reader.cancel(); return { ...base, httpStatus, status: 'unexpected', message: 'Yanıt boyutu sınırı aşıldı; resmî ekranda inceleyin.' }; }
        chunks.push(value);
      }
    } finally { reader.releaseLock(); }
    const bytes = new Uint8Array(size); let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
    const text = new TextDecoder().decode(bytes);
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    const sha256 = Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2,'0')).join('');
    if (source.method === 'service') {
      let data; try { data = JSON.parse(text); } catch { /* schema failure below */ }
      if (data?.id !== 1826 || !Array.isArray(data.fields) || !['planid','taks','emsalkaks'].every(name => data.fields.some((f: { name?: string }) => f.name === name))) return { ...base, httpStatus, sha256, status: 'unexpected', message: 'Servis şeması doğrulanamadı; koşul aktarımı yapılmadı.' };
      return { ...base, httpStatus, sha256, status: 'service-readable', message: 'Konut katmanı şeması okundu. Bu bağlantı kontrolü parsel sorgusu veya imar sonucu değildir.' };
    }
    if (!/text\/html/i.test(response.headers.get('content-type') || '') || !/<(?:html|body|!doctype)/i.test(text)) return { ...base, httpStatus, sha256, status: 'unexpected', message: 'Beklenen web sayfası alınamadı.' };
    const visibleText = text.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,'').replace(/<[^>]*>/g,' ');
    if (/captcha|access denied|robot doğrulama|verify you are human/i.test(visibleText)) return { ...base, httpStatus, sha256, status: 'restricted', message: 'Kaynak erişim doğrulaması istiyor. Resmî ekranda devam edin.' };
    if (source.method === 'login' || /Henüz kimliğinizi doğrulamadınız|Kimliğimi Şimdi Doğrula/i.test(text)) return { ...base, httpStatus, sha256, status: 'login-required', message: 'Kaynakta kişisel oturum gerekiyor. Girişi resmî ekranda tamamlayın.' };
    return { ...base, httpStatus, sha256, status: 'page-received', message: 'Web sayfası alındı; parsel sonucu ve plan içeriği henüz doğrulanmadı.' };
  } catch (error) {
    return { ...base, status: 'unavailable', message: `Bu çalışma ortamından bağlantı kurulamadı: ${officialConnectionFailure(error, combined)}. Kaynağı tarayıcıda açarak kontrol edin.` };
  }
}
export async function checkZoningSources(province: string, district: string, fetcher: typeof fetch = fetch, signal?: AbortSignal) {
  return Promise.all(zoningResearchSources(province, district).map(s => checkZoningSource(s.id, fetcher, signal)));
}
