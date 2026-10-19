import { readBoundedJson } from "../../lib/bounded-json.ts";
import { administrativeOptions } from '../../lib/administrative-options.ts';
import { TKGM_PROVINCES, TKGM_PROVINCE_SOURCE } from '../../data/tkgm-provinces.ts';

const TKGM_ROOTS = [
  "https://cbsapi.tkgm.gov.tr/megsiswebapi.v3.1/api",
  "https://cbsapi.tkgm.gov.tr/megsiswebapi.v3/api",
];

const allowedPaths = [
  /^idariYapi\/ilListe$/,
  /^idariYapi\/ilceListe\/[0-9]{1,12}$/,
  /^idariYapi\/mahalleListe\/[0-9]{1,12}$/,
  /^parsel\/[0-9]{1,12}\/[0-9]{1,10}\/[0-9]{1,10}$/,
];

export async function GET(request: Request) {
  const url = new URL(request.url);
  const path = (url.searchParams.get("path") ?? "").replace(/^\/+|\/+$/g, "");
  if (!allowedPaths.some((pattern) => pattern.test(path))) {
    return Response.json({ error: "Desteklenmeyen TKGM sorgusu" }, { status: 400 });
  }

  if (path === 'idariYapi/ilListe') return Response.json(TKGM_PROVINCES, { headers: {
    'Cache-Control': 'public, max-age=86400',
    'X-Directory-Captured-At': TKGM_PROVINCE_SOURCE.capturedAt,
  } });

  let lastStatus = 502;
  const deadline = Date.now() + 8000;
  const targets = TKGM_ROOTS.map(root => `${root}/${path}`);
  for (const target of targets) {
    const remaining = deadline - Date.now();
    if (remaining <= 0) break;
    const controller = new AbortController();
    const abort = () => controller.abort();
    request.signal.addEventListener('abort', abort, { once: true });
    if (request.signal.aborted) controller.abort();
    const timer = setTimeout(abort, remaining);
    try {
      const response = await fetch(target, {
        headers: { Accept: "application/json", "User-Agent": "Arkem-Parcel-Studio/1.0" },
        signal: controller.signal,
        // Workerd accepts only follow/manual. Never follow an upstream redirect.
        redirect: "manual",
        credentials: "omit",
      });
      lastStatus = response.status;
      if (response.status >= 300 && response.status < 400) {
        await response.body?.cancel().catch(() => undefined);
        return Response.json({ error: 'TKGM kaynağı beklenmeyen bir yönlendirme döndürdü.', code: 'TKGM_REDIRECT_REJECTED', upstreamStatus: response.status }, { status: 502, headers: { 'Cache-Control': 'no-store' } });
      }
      if (response.status === 401 || response.status === 403) {
        await response.body?.cancel().catch(() => undefined);
        return Response.json({ error: 'TKGM sorguya erişim vermedi.', code: 'TKGM_ACCESS_DENIED', upstreamStatus: response.status }, { status: response.status, headers: { 'Cache-Control': 'no-store' } });
      }
      if (!response.ok) { await response.body?.cancel(); continue; }
      const body = await readBoundedJson(response);
      let result = body;
      if (path.startsWith('idariYapi/')) {
        const level = path.includes('/mahalleListe/') ? 'neighborhood' : path.includes('/ilceListe/') ? 'district' : 'province';
        const options = administrativeOptions(body, level);
        if (!options.length) throw new Error('Empty administrative directory');
        // Lists do not need large administrative polygons; keep the official IDs and names only.
        result = { features: options.map(option => ({ type: 'Feature', properties: { id: option.id, text: option.label } })) };
      }
      return Response.json(result, {
        status: 200,
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "X-TKGM-Source-URL": target,
          "Cache-Control": path === "idariYapi/ilListe" ? "public, max-age=86400" : "public, max-age=1800",
        },
      });
    } catch {
      lastStatus = 502;
    } finally {
      clearTimeout(timer);
      request.signal.removeEventListener('abort', abort);
    }
  }

  return Response.json(
    { error: "TKGM servisi şu anda yanıt vermiyor", upstreamStatus: lastStatus },
    { status: 502, headers: { "Cache-Control": "no-store" } },
  );
}
