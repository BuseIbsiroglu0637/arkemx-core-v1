import { assessLandCandidate, landCriteriaKey, normalizeLandCandidate, object, type LandCandidate, type LandCriteria, type LandSearchResponse } from "./land-research.ts";
import { buildLandAgentRequest, readLandAgentCandidates } from "./land-research-agent.ts";

export type LandProviderConfig = { feedUrl?: string; feedToken?: string; braveKey?: string; storageRights?: string; openaiKey?: string; openaiModel?: string };
export class LandProviderError extends Error {
  code: "not-configured" | "access-denied" | "rate-limited" | "unavailable";
  constructor(code: LandProviderError["code"], message: string) { super(message); this.code = code; }
}
export function landProviderStatus(config: LandProviderConfig) {
  if (config.feedUrl) {
    try { const url = new URL(config.feedUrl); if (url.protocol !== "https:" || url.username || url.password) throw Error(); }
    catch { return { ready: false, provider: "İlan veri bağlantısı" }; }
    return { ready: true, provider: "Yetkili ilan veri bağlantısı" };
  }
  if (config.openaiKey) return { ready: true, provider: "AI arsa araştırma agentı" };
  return { ready: Boolean(config.braveKey && config.storageRights === "1"), provider: "Brave Search" };
}
function listingSearchQuery(criteria: LandCriteria) {
  const use = { industrial: "sanayi", residential: "konut", commercial: "ticari", agricultural: "tarım", mixed: "" }[criteria.use];
  return `${criteria.province} ${criteria.district} ${criteria.tenure === "sale" ? "satılık" : "kiralık"} arsa ${use} site:sahibinden.com/ilan/emlak-arsa`;
}
export async function searchLandCandidates(criteria: LandCriteria, config: LandProviderConfig, fetcher: typeof fetch = fetch, signal?: AbortSignal): Promise<LandSearchResponse> {
  const status = landProviderStatus(config);
  if (!status.ready) throw new LandProviderError("not-configured", "Canlı ilan veri bağlantısı henüz etkin değil. Kriterlerinizi kaydedebilirsiniz; adaylar bağlantı etkinleştiğinde getirilecek.");
  const searchedAt = new Date().toISOString();
  let rows: unknown[];
  try {
    const controller = new AbortController();
    const abort = () => controller.abort();
    signal?.addEventListener("abort", abort, { once: true });
    if (signal?.aborted) controller.abort();
    const timer = setTimeout(abort, config.openaiKey && !config.feedUrl ? 60000 : 12000);
    let response: Response;
    try {
      if (config.feedUrl) {
        response = await fetcher(config.feedUrl, { method: "POST", headers: { "Content-Type": "application/json", ...(config.feedToken ? { Authorization: `Bearer ${config.feedToken}` } : {}) }, body: JSON.stringify({ schema: "ARKEM-LAND-QUERY/1.0", criteria, limit: 40 }), cache: "no-store", redirect: "error", signal: controller.signal });
      } else if (config.openaiKey) {
        response = await fetcher("https://api.openai.com/v1/responses", {
          method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${config.openaiKey}` },
          body: JSON.stringify(buildLandAgentRequest(criteria, config.openaiModel)),
          cache: "no-store", redirect: "error", signal: controller.signal,
        });
      } else {
        const url = new URL("https://api.search.brave.com/res/v1/web/search");
        url.search = new URLSearchParams({ q: listingSearchQuery(criteria), country: "TR", search_lang: "tr", count: "20", safesearch: "strict" }).toString();
        response = await fetcher(url, { headers: { Accept: "application/json", "X-Subscription-Token": config.braveKey! }, cache: "no-store", redirect: "error", signal: controller.signal });
      }
      if (response.status === 429) throw new LandProviderError("rate-limited", "Arama hizmetinin kullanım sınırına ulaşıldı. Daha sonra tekrar deneyin.");
      if ([401, 403].includes(response.status)) throw new LandProviderError("access-denied", "İlan veri bağlantısına erişilemiyor. Bağlantı yetkisi kontrol edilmeli.");
      if (!response.ok) throw Error("upstream");
      const body = await response.text();
      if (body.length > 1_000_000) throw Error("oversized");
      const data = object(JSON.parse(body));
      if (config.feedUrl) {
        if (data.schema !== "ARKEM-LAND-FEED/1.0" || !Array.isArray(data.listings)) throw Error("invalid feed");
        rows = data.listings.slice(0, 100).filter(v => object(v).propertyType === "land" && object(v).active === true).map(v => ({ ...object(v), basis: "provider-listing" }));
      } else if (config.openaiKey) {
        rows = readLandAgentCandidates(data);
      } else {
        const results = object(data.web).results;
        if (results !== undefined && !Array.isArray(results)) throw Error("invalid search response");
        rows = (Array.isArray(results) ? results : []).filter(v => {
          try { const u = new URL(String(object(v).url)); return ["www.sahibinden.com", "sahibinden.com"].includes(u.hostname) && /^\/ilan\/emlak-arsa-[^/]+-\d{6,}\/detay\/?$/.test(u.pathname); } catch { return false; }
        }).map(v => ({ ...object(v), source: "Sahibinden · Brave arama dizini", tenure: null, basis: "search-index" }));
      }
    } finally { clearTimeout(timer); signal?.removeEventListener("abort", abort); }
  } catch (error) {
    if (error instanceof LandProviderError) throw error;
    throw new LandProviderError("unavailable", "Adaylar şu anda getirilemedi. Arama sonuçları yerine örnek ilan gösterilmez; tekrar deneyebilirsiniz.");
  }
  const candidates = rows.map(row => normalizeLandCandidate(row, searchedAt)).filter((c): c is LandCandidate => Boolean(c));
  const unique = [...new Map(candidates.map(c => [c.id, c])).values()].filter(c => assessLandCandidate(c, criteria).mismatch.length === 0).slice(0, 40);
  return { schema: "ARKEM-LAND-SEARCH/1.0", candidates: unique, searchedAt, provider: status.provider, criteriaKey: landCriteriaKey(criteria) };
}
