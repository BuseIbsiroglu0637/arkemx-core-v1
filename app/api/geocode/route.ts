type NominatimAddress = {
  province?: string;
  state?: string;
  city?: string;
  town?: string;
  county?: string;
  city_district?: string;
  district?: string;
  village?: string;
  suburb?: string;
  neighbourhood?: string;
  quarter?: string;
};

type NominatimResult = {
  lat?: string;
  lon?: string;
  display_name?: string;
  address?: NominatimAddress;
};

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeResult(value: NominatimResult) {
  const address = value.address ?? {};
  const province = clean(address.province) || clean(address.state);
  const district = clean(address.town)
    || clean(address.city_district)
    || clean(address.district)
    || clean(address.county)
    || clean(address.city);
  const neighborhood = clean(address.neighbourhood)
    || clean(address.quarter)
    || clean(address.suburb)
    || clean(address.village);

  return {
    lat: Number(value.lat),
    lng: Number(value.lon),
    displayName: clean(value.display_name),
    province,
    district,
    neighborhood,
  };
}

async function nominatim(url: URL) {
  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      "Accept-Language": "tr",
      "User-Agent": "ARKEMX/0.1 development geocoder",
    },
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Geocoding service returned ${response.status}`);
  return response.json();
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const q = clean(requestUrl.searchParams.get("q"));
  const lat = Number(requestUrl.searchParams.get("lat"));
  const lng = Number(requestUrl.searchParams.get("lng"));

  try {
    if (q) {
      const url = new URL("https://nominatim.openstreetmap.org/search");
      url.searchParams.set("format", "jsonv2");
      url.searchParams.set("addressdetails", "1");
      url.searchParams.set("countrycodes", "tr");
      url.searchParams.set("limit", "1");
      url.searchParams.set("q", q);
      const results = await nominatim(url) as NominatimResult[];
      const result = results[0];
      if (!result) return Response.json({ error: "Konum bulunamadı." }, { status: 404 });
      return Response.json(normalizeResult(result));
    }

    if (Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
      const url = new URL("https://nominatim.openstreetmap.org/reverse");
      url.searchParams.set("format", "jsonv2");
      url.searchParams.set("addressdetails", "1");
      url.searchParams.set("zoom", "18");
      url.searchParams.set("lat", String(lat));
      url.searchParams.set("lon", String(lng));
      const result = await nominatim(url) as NominatimResult;
      return Response.json(normalizeResult(result));
    }

    return Response.json({ error: "Geçerli bir q veya lat/lng parametresi gerekli." }, { status: 400 });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Konum servisine ulaşılamadı." },
      { status: 503 },
    );
  }
}
