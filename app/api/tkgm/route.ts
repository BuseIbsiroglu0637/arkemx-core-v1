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
        headers: { Accept: "application/json", "User-Agent": "Arkem-Parcel-Studio/1.0" },
      });
      lastStatus = response.status;
      if (!response.ok) continue;
      const body = await response.text();
      return new Response(body, {
        status: 200,
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Cache-Control": path === "idariYapi/ilListe" ? "public, max-age=86400" : "public, max-age=1800",
        },
      });
    } catch {
      lastStatus = 502;
    }
  }

  return Response.json(
    { error: "TKGM servisi şu anda yanıt vermiyor", upstreamStatus: lastStatus },
    { status: 502 },
  );
}
