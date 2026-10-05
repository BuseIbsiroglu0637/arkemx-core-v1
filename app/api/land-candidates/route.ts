import { getArkemAccountSession } from "../../chatgpt-auth";
import { LandProviderError, landProviderStatus, searchLandCandidates, type LandProviderConfig } from "../../lib/land-candidate-provider";
import { parseLandCriteria } from "../../lib/land-research";
import { LAND_QUOTA_TABLE, LAND_QUOTA_RESERVATION } from "../../lib/land-search-quota";

async function configuration(): Promise<LandProviderConfig> {
  let worker: Record<string, unknown> = {};
  try { worker = (await import("cloudflare:workers")).env as unknown as Record<string, unknown>; } catch { /* Node runtime uses server environment. */ }
  const value = (key: string) => typeof worker[key] === "string" ? String(worker[key]).trim() : process.env[key]?.trim();
  return { feedUrl: value("ARKEMX_LAND_FEED_URL"), feedToken: value("ARKEMX_LAND_FEED_TOKEN"),
    openaiKey: value("ARKEMX_LAND_OPENAI_API_KEY"), openaiModel: value("ARKEMX_LAND_OPENAI_MODEL"),
    braveKey: value("ARKEMX_BRAVE_SEARCH_API_KEY"), storageRights: value("ARKEMX_BRAVE_STORAGE_RIGHTS") };
}
const headers = { "Cache-Control": "no-store" };
export async function GET() {
  if (!(await getArkemAccountSession()).user) return Response.json({ error: "Arsa araştırması için oturum açın." }, { status: 401, headers });
  const status = landProviderStatus(await configuration());
  return Response.json(status, { headers });
}
// The quota is an atomic, per-account daily counter in D1; concurrent workers share it.
async function consumeQuota(owner: string) {
  const { env } = await import("cloudflare:workers");
  const db = env.DB;
  if (!db) throw Error("Quota storage unavailable");
  await db.prepare(LAND_QUOTA_TABLE).run();
  const day = new Date().toISOString().slice(0, 10);
  const result = await db.prepare(LAND_QUOTA_RESERVATION).bind(owner, day).first();
  return Boolean(result);
}
const running = new Set<string>();
export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin || origin !== new URL(request.url).origin) return Response.json({ error: "Geçersiz istek kaynağı." }, { status: 403, headers });
  const session = await getArkemAccountSession();
  if (!session.user) return Response.json({ error: "Arsa araştırması için oturum açın." }, { status: 401, headers });
  if (!request.headers.get("content-type")?.includes("application/json")) return Response.json({ error: "Geçersiz istek." }, { status: 415, headers });
  let input: unknown;
  try {
    const body = await request.text(); if (new TextEncoder().encode(body).length > 6000) throw Error();
    input = JSON.parse(body);
  } catch { return Response.json({ error: "Arama kriterleri okunamadı." }, { status: 400, headers }); }
  const criteria = parseLandCriteria(input);
  if (!criteria) return Response.json({ error: "İl, işlem türü, kullanım ve alan/bütçe aralıklarını kontrol edin." }, { status: 400, headers });
  const config = await configuration();
  if (!landProviderStatus(config).ready) return Response.json({ code: "not-configured", error: "Canlı ilan veri bağlantısı henüz etkin değil. Kriterlerinizi kaydedebilirsiniz; adaylar bağlantı etkinleştiğinde getirilecek." }, { status: 503, headers });
  const owner = session.user.email;
  if (running.has(owner)) return Response.json({ error: "Önceki aramanın tamamlanmasını bekleyin." }, { status: 429, headers });
  running.add(owner);
  try {
    if (!await consumeQuota(owner)) return Response.json({ code: "rate-limited", error: "Bugünkü 10 araştırma hakkı kullanıldı. Kaydedilen kısa listenizi inceleyebilirsiniz." }, { status: 429, headers });
    return Response.json(await searchLandCandidates(criteria, config, fetch, request.signal), { headers });
  } catch (error) {
    if (error instanceof LandProviderError) return Response.json({ code: error.code, error: error.message }, { status: error.code === "rate-limited" ? 429 : 502, headers });
    return Response.json({ error: "Araştırma bağlantısı şu anda kullanılamıyor. Daha sonra tekrar deneyin." }, { status: 503, headers });
  } finally { running.delete(owner); }
}
