// Only the public, read-only TKGM paths listed here are proxied.
// A blocked or unauthenticated upstream must not be presented as a verified parcel.
const TKGM_ROOTS = [
  "https://cbsapi.tkgm.gov.tr/megsiswebapi.v3.1/api",
  "https://cbsapi.tkgm.gov.tr/megsiswebapi.v3/api",
];

const allowedPaths = [
  /^idariYapi\/ilListe$/,
  /^idariYapi\/ilceListe\/[0-9]+$/,
  /^idariYapi\/mahalleListe\/[0-9]+$/,
  /^parsel\/[0-9]+\/[0-9]+\/[0-9]+$/,
];

export async function GET(request: Request) {
  const url = new URL(request.url);
  const path = (url.searchParams.get("path") ?? "").replace(/^\/+|\/+$/g, "");
  if (!allowedPaths.some((pattern) => pattern.test(path))) {
    return Response.json({ error: "Desteklenmeyen TKGM sorgusu" }, { status: 400 });
  }

  let lastStatus = 502;
  for (const root of TKGM_ROOTS) {
    try {
      const response = await fetch(`${root}/${path}`, {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(5_500),
      });
      lastStatus = response.status;
      if (!response.ok) {
        // Respect access controls: do not attempt to emulate authenticated sessions.
        if (response.status === 401 || response.status === 403) {
          return Response.json(
            { error: "TKGM bu ortamdan doğrudan sorguya izin vermiyor. Resmî Parsel Sorgu'yu açın veya KML/GeoJSON sınır dosyası yükleyin.", upstreamStatus: response.status },
            { status: 503, headers: { "Cache-Control": "no-store" } },
          );
        }
        continue;
      }
      const body = await response.json();
      if (!body || typeof body !== "object") {
        lastStatus = 502;
        continue;
      }
      return Response.json(body, {
        status: 200,
        headers: {
          "Cache-Control": path === "idariYapi/ilListe" ? "public, max-age=86400" : path.startsWith("idariYapi/") ? "public, max-age=1800" : "no-store",
        },
      });
    } catch {
      lastStatus = 502;
    }
  }

  return Response.json(
    { error: "TKGM servisine şu anda erişilemiyor. Bu oturumda resmî mahalle veya parsel geometrisi doğrulanamadı.", upstreamStatus: lastStatus },
    { status: 503, headers: { "Cache-Control": "no-store" } },
  );
}
