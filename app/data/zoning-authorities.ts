import { PRIORITY_ZONING_REGIONS, normalizeZoningPlace, priorityZoningRegion } from './zoning-regions.ts';

export type ZoningAuthorityRoute = {
  province: string;
  plate: string;
  primaryAuthority: string;
  parcelSource: string;
  planSource: string;
  localSourceState: "adapter-required" | "official-source-handoff";
};

export type ZoningPortalAdapter = {
  id: string;
  province: string;
  districts?: string[];
  neighborhoods?: string[];
  label: string;
  authority: string;
  href: string;
  scope: "parcel-zoning" | "metropolitan-plan";
  queryMode: "official-viewer" | "e-government-service";
  verifiedAt: string;
  limitation: string;
  sourcePage?: string;
  portalHref?: string;
  verification?: string;
  integrationMode?: 'official-source-handoff';
  authorizedApi?: 'not-verified';
  certifiedDocument?: 'not-verified';
};

const PROVINCES = [
  "Adana","Adıyaman","Afyonkarahisar","Ağrı","Amasya","Ankara","Antalya","Artvin","Aydın","Balıkesir","Bilecik","Bingöl","Bitlis","Bolu","Burdur","Bursa","Çanakkale","Çankırı","Çorum","Denizli","Diyarbakır","Edirne","Elazığ","Erzincan","Erzurum","Eskişehir","Gaziantep","Giresun","Gümüşhane","Hakkâri","Hatay","Isparta","Mersin","İstanbul","İzmir","Kars","Kastamonu","Kayseri","Kırklareli","Kırşehir","Kocaeli","Konya","Kütahya","Malatya","Manisa","Kahramanmaraş","Mardin","Muğla","Muş","Nevşehir","Niğde","Ordu","Rize","Sakarya","Samsun","Siirt","Sinop","Sivas","Tekirdağ","Tokat","Trabzon","Tunceli","Şanlıurfa","Uşak","Van","Yozgat","Zonguldak","Aksaray","Bayburt","Karaman","Kırıkkale","Batman","Şırnak","Bartın","Ardahan","Iğdır","Yalova","Karabük","Kilis","Osmaniye","Düzce",
] as const;

const METROPOLITAN = new Set(["Adana","Ankara","Antalya","Aydın","Balıkesir","Bursa","Denizli","Diyarbakır","Erzurum","Eskişehir","Gaziantep","Hatay","İstanbul","İzmir","Kahramanmaraş","Kayseri","Kocaeli","Konya","Malatya","Manisa","Mardin","Mersin","Muğla","Ordu","Sakarya","Samsun","Şanlıurfa","Tekirdağ","Trabzon","Van"]);

export const ZONING_AUTHORITY_ROUTES: ZoningAuthorityRoute[] = PROVINCES.map((province, index) => ({
  province,
  plate: String(index + 1).padStart(2, "0"),
  primaryAuthority: METROPOLITAN.has(province) ? `${province} Büyükşehir Belediyesi + ilçe belediyesi` : `${province} il/ilçe belediyesi veya yetkili idare`,
  parcelSource: "https://parselsorgu.tkgm.gov.tr/",
  planSource: "https://eplan.csb.gov.tr/",
  localSourceState: priorityZoningRegion(province)?.routingScope === 'district-directory-only' ? "adapter-required" : priorityZoningRegion(province) ? "official-source-handoff" : "adapter-required",
}));

export const VERIFIED_ZONING_PORTALS: ZoningPortalAdapter[] = [
  ...PRIORITY_ZONING_REGIONS.filter(region => region.routingScope !== 'district-directory-only').map(region => ({
    id: region.portalId,
    province: region.province,
    label: region.label,
    authority: region.authority,
    href: region.href,
    scope: 'metropolitan-plan' as const,
    queryMode: 'official-viewer' as const,
    verifiedAt: region.verifiedAt,
    limitation: region.limitation,
    sourcePage: region.sourcePage,
    verification: region.verification,
    integrationMode: 'official-source-handoff' as const,
    authorizedApi: 'not-verified' as const,
    certifiedDocument: 'not-verified' as const,
  })),
  {
    id: 'kastamonu-belediyesi',
    province: 'Kastamonu',
    districts: ['Merkez'],
    neighborhoods: ['Budamış'],
    label: 'Kastamonu Belediyesi E-İmar',
    authority: 'Kastamonu Belediyesi',
    href: 'https://www.kastamonu.bel.tr/e-uygulama/',
    sourcePage: 'https://www.kastamonu.bel.tr/e-uygulama/',
    portalHref: 'https://keos.kastamonu.bel.tr:1443/imardurumu/',
    scope: 'parcel-zoning',
    queryMode: 'official-viewer',
    verifiedAt: '2026-10-11',
    verification: 'Belediyenin e-uygulama yönlendirmesi ve Budamış mahalle bağlamı kontrol edildi. Bu kayıt parselin imar haklarını veya nihai yetki sınırını doğrulamaz.',
    limitation: 'Budamış için belediye kaynağına yönlendirilir; il genelindeki veya Merkez ilçesindeki diğer yerleşimlere genellenmez. Güncel parsel sonucu, plan notları ve yetki durumu ayrıca doğrulanmalıdır.',
    integrationMode: 'official-source-handoff',
    authorizedApi: 'not-verified',
    certifiedDocument: 'not-verified',
  },
  {
    id: 'besiktas-keos',
    province: 'İstanbul',
    districts: ['Beşiktaş'],
    label: 'Beşiktaş Belediyesi E-İmar',
    authority: 'Beşiktaş Belediyesi',
    href: 'https://besiktas.bel.tr/',
    sourcePage: 'https://besiktas.bel.tr/',
    portalHref: 'https://keos.besiktas.bel.tr/imardurumu/index.aspx',
    scope: 'parcel-zoning',
    queryMode: 'official-viewer',
    verifiedAt: '2026-10-11',
    verification: 'Belediye ana sayfasındaki E-İmar yönlendirmesi kontrol edildi. Kaynak kullanım koşulları gereği resmî ana sayfadan ilerlenir; parsel sonucu ve sayısal haklar doğrulanmış sayılmaz.',
    limitation: 'Güvenlik doğrulaması ve kaynak koşulları uygulanabilir. Boğaziçi ve diğer özel yetki alanlarındaki parseller ayrıca ilgili idareden doğrulanmalıdır; ilçe eşleşmesi tek başına nihai yetki veya imar hakkı kanıtı değildir.',
    integrationMode: 'official-source-handoff',
    authorizedApi: 'not-verified',
    certifiedDocument: 'not-verified',
  },
  {
    id: "adapazari-e-devlet-imar",
    province: "Sakarya",
    districts: ["Adapazarı"],
    label: "Adapazarı Belediyesi İmar Durumu",
    authority: "T.C. Adapazarı Belediyesi / e-Devlet",
    href: "https://www.turkiye.gov.tr/adapazari-belediyesi-imar-durum-sorgulama",
    scope: "parcel-zoning",
    queryMode: "e-government-service",
    verifiedAt: "2026-07-28",
    limitation: "Kimlik doğrulama ve belediye servisinin erişilebilirliği gerekir. Sonuç araştırma girdisidir; ruhsat eki onaylı imar durumu belgesi ayrıca yetkili idareden alınır.",
  },
  {
    id: "sapanca-e-devlet-imar",
    province: "Sakarya",
    districts: ["Sapanca"],
    label: "Sapanca Belediyesi İmar Durumu",
    authority: "T.C. Sapanca Belediyesi / e-Devlet",
    href: "https://www.turkiye.gov.tr/sapanca-belediyesi-imar-durum-sorgulama",
    scope: "parcel-zoning",
    queryMode: "e-government-service",
    verifiedAt: "2026-07-28",
    limitation: "Kimlik doğrulama ve belediye servisinin erişilebilirliği gerekir. Sonuç araştırma girdisidir; plan notları ve onaylı belgeyle birlikte değerlendirilir.",
  },
  {
    id: "serdivan-keos",
    province: "Sakarya",
    districts: ["Serdivan"],
    label: "Serdivan Belediyesi İmar Durumu",
    authority: "T.C. Serdivan Belediyesi",
    href: "https://keos.serdivan.bel.tr/imardurumu/",
    scope: "parcel-zoning",
    queryMode: "official-viewer",
    verifiedAt: "2026-10-03",
    limitation: "Belediye ekranı ön bilgi sunar; işlem tesis etmeye esas resmî imar durumu belediyeden alınır. Bu kayıt otomatik API erişimi veya parselin imar koşullarının doğrulandığı anlamına gelmez.",
  },
  {
    id: "ibb-eplan",
    province: "İstanbul",
    label: "İBB Plan Durumu Sorgulama",
    authority: "İstanbul Büyükşehir Belediyesi",
    href: "https://eplan.ibb.istanbul/sorgu/",
    scope: "metropolitan-plan",
    queryMode: "official-viewer",
    verifiedAt: "2026-07-27",
    limitation: "İBB görüntüleyicisi üst ölçek ve plan durumu araştırmasını destekler; parselin uygulama imar koşulları ayrıca ilgili ilçe belediyesinden doğrulanır.",
  },
];

export function createEGovernmentZoningSearch(province: string, district = "") {
  const location = [province, district].filter(Boolean).join(" ");
  const query = `${location} İmar Durum Bilgisi Sorgulama`.trim();
  return `https://www.turkiye.gov.tr/arama?aranan=${encodeURIComponent(query)}`;
}

function normalizeZoningNeighborhood(value: string) {
  return normalizeZoningPlace(value).replace(/\s+(?:mahallesi|mah\.?)$/, '').trim();
}

export function resolveZoningPortal(province: string, district = "", neighborhood = "") {
  const normalizedProvince = normalizeZoningPlace(province);
  const normalizedDistrict = normalizeZoningPlace(district);
  const normalizedNeighborhood = normalizeZoningNeighborhood(neighborhood);
  const candidates = VERIFIED_ZONING_PORTALS.filter(portal => normalizeZoningPlace(portal.province) === normalizedProvince);
  const districtCandidates = candidates.filter(portal => portal.districts?.some(item => normalizeZoningPlace(item) === normalizedDistrict));
  const neighborhoodSpecific = districtCandidates.find(portal => portal.neighborhoods?.some(item => normalizeZoningNeighborhood(item) === normalizedNeighborhood));
  if (neighborhoodSpecific) return neighborhoodSpecific;
  const specific = districtCandidates.find(portal => !portal.neighborhoods?.length);
  if (specific) return specific;
  const region = priorityZoningRegion(province);
  // A district directory does not prove municipal or provincial jurisdiction.
  if (region?.routingScope === 'district-directory-only') return null;
  // A mistyped or unknown district must not be presented as covered.
  if (region && normalizedDistrict && !region.districts.some(item => normalizeZoningPlace(item) === normalizedDistrict)) return null;
  return candidates.find(portal => !portal.districts?.length) ?? null;
}

export function resolveZoningAuthority(province: string, district = "", neighborhood = "") {
  const record = ZONING_AUTHORITY_ROUTES.find((item) => normalizeZoningPlace(item.province) === normalizeZoningPlace(province));
  if (!record) return null;
  const portal = resolveZoningPortal(province, district, neighborhood);
  const primaryAuthority = portal?.authority ?? record.primaryAuthority;
  return {
    ...record,
    primaryAuthority,
    district,
    neighborhood,
    localSourceState: portal ? "official-source-handoff" as const : "adapter-required" as const,
    jurisdictionVerified: false as const,
    administrativeRoute: district ? `${primaryAuthority} · ${district}` : primaryAuthority,
    sequence: [
      "TKGM parsel kimliği ve sınır ön kontrolü",
      "e-Plan plan/pafta/PIN araştırması",
      "Yetkili belediye veya idare e-İmar/doğrulama ekranı",
      "Onaylı imar durumu ve plan notu belgesi",
    ],
    limitation: [portal?.limitation, "Kaynak yönlendirmesi nihai idare yetkisi tespiti değildir. TAKS, KAKS/emsal, Hmax/Yençok ve nizam ancak güncel plan, plan notu ve yetkili idare belgesiyle resmî statü kazanır."].filter(Boolean).join(' '),
  };
}
