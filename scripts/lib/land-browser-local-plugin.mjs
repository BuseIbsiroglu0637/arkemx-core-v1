import { queryKastamonuZoning, parseZoningParcelInput, ZoningQueryError } from '../../app/lib/kastamonu-zoning.ts';
import { readEmlakjetParcelDetail } from './emlakjet-parcel-detail.mjs';
import { searchHepsiemlak, LandBrowserError } from './hepsiemlak-browser.mjs';
import { searchEmlakjet } from './emlakjet-browser.mjs';
import { parseLandCriteria } from '../../app/lib/land-research.ts';

// This middleware is installed only by the opt-in localhost demo config.
export function landBrowserLocalPlugin({ sourceName = process.env.ARKEMX_LAND_BROWSER_SOURCE === 'hepsiemlak' ? 'Hepsiemlak' : 'Emlakjet', search = sourceName === 'Hepsiemlak' ? searchHepsiemlak : searchEmlakjet, detail = readEmlakjetParcelDetail, zoning = (input, { signal }) => queryKastamonuZoning(input, fetch, signal) } = {}) {
  let busy = false, day = '', searches = 0, details = 0, zoningReads = 0;
  return { name: 'arkemx-local-land-browser', apply: 'serve', enforce: 'pre',
    configureServer(server) {
      if (server.config.server.host !== '127.0.0.1') throw Error('Land browser demo must bind to localhost');
      server.middlewares.use(async (req, res, next) => {
        const isDetail = req.url?.split('?')[0] === '/api/land-candidate-detail';
        const isZoning = req.url?.split('?')[0] === '/api/zoning-conditions';
        if (!isDetail && !isZoning && req.url?.split('?')[0] !== '/api/land-candidates') return next();
        const json = (status, body) => { res.statusCode = status; res.setHeader('Content-Type', 'application/json; charset=utf-8'); res.setHeader('Cache-Control', 'no-store'); res.end(JSON.stringify(body)); };
        if (!/(?:^|;\s*)arkemx_prototype_session=1(?:;|$)/.test(req.headers.cookie || '')) return json(401, { error: 'Arsa araştırması için demo oturumunu açın.' });
        if (!isDetail && !isZoning && req.method === 'GET') return json(200, { ready: true, provider: `${sourceName} · tarayıcı araştırması`, mode: 'local-browser' });
        if (req.method !== 'POST') return json(405, { error: 'Geçersiz işlem.' });
        try {
          const origin = new URL(req.headers.origin || '');
          if (!['http:', 'https:'].includes(origin.protocol) || origin.host !== req.headers.host) throw Error();
        } catch { return json(403, { error: 'Geçersiz istek kaynağı.' }); }
        if (!req.headers['content-type']?.includes('application/json')) return json(415, { error: 'Geçersiz istek.' });
        const chunks = []; let bytes = 0, criteria;
        try {
          for await (const chunk of req) { bytes += chunk.length; if (bytes > (isZoning ? 2000 : 6000)) return json(413, { error: 'Arama kriterleri çok büyük.' }); chunks.push(Buffer.from(chunk)); }
          const payload = JSON.parse(Buffer.concat(chunks).toString('utf8'));
          criteria = isZoning ? parseZoningParcelInput(payload) : isDetail ? payload : parseLandCriteria(payload);
        } catch { return json(400, { error: 'Arama kriterleri okunamadı.' }); }
        if (!criteria) return json(400, { error: 'Arama kriterlerini kontrol edin.' });
        if (!isDetail && !isZoning && criteria.tenure !== 'sale') return json(400, { code: 'unsupported-criteria', error: 'Tarayıcı başlangıç sürümü yalnız satın alma araştırır.' });
        if (busy) return json(429, { code: 'rate-limited', error: 'Önceki tarayıcı araştırmasının tamamlanmasını bekleyin.' });
        const today = new Date().toISOString().slice(0, 10); if (day !== today) { day = today; searches = 0; details = 0; zoningReads = 0; }
        if ((!isDetail && !isZoning && searches >= 10) || (isDetail && details >= 30) || (isZoning && zoningReads >= 60)) return json(429, { code: 'rate-limited', error: 'Yerel demo için günlük araştırma sınırına ulaşıldı.' });
        busy = true; if (isZoning) zoningReads++; else if (isDetail) details++; else searches++;
        const controller = new AbortController();
        const disconnected = () => { if (!res.writableEnded) controller.abort(); };
        res.on('close', disconnected);
        try { return json(200, await (isZoning ? zoning : isDetail ? detail : search)(criteria, { signal: controller.signal })); }
        catch (error) {
          const known = error instanceof LandBrowserError || error instanceof ZoningQueryError;
          return json(502, { code: known ? error.code : 'unavailable', error: known ? error.message : 'Tarayıcı araştırması tamamlanamadı.',
            sources: [{ name: isZoning ? 'Kastamonu İl Özel İdaresi' : isDetail ? 'Emlakjet' : sourceName, status: known && error.code === 'source-blocked' ? 'blocked' : 'failed', readCount: 0, totalCount: null }] });
        } finally { busy = false; res.off('close', disconnected); }
      });
    },
  };
}
