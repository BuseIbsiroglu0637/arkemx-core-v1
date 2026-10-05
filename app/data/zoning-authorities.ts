export type ZoningAuthorityRoute = {
  province: string;
  plate: string;
  primaryAuthority: string;
  parcelSource: string;
  planSource: string;
  localSourceState: "adapter-required";
};

export type ZoningPortalAdapter = {
  id: string;
  province: string;
  districts?: string[];
  label: string;
  authority: string;
  href: string;
  scope: "parcel-zoning" | "metropolitan-plan";
  queryMode: "official-viewer" | "e-government-service";
  verifiedAt: string;
  limitation: string;
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
  localSourceState: "adapter-required",
}));

export const VERIFIED_ZONING_PORTALS: ZoningPortalAdapter[] = [
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
    verifiedAt: "2026-07-27",
    limitation: "Ada/parsel araması resmî belediye görüntüleyicisinde tamamlanır; ekrandaki bilgi ruhsat veya tapu belgesi yerine geçmez.",
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

export function resolveZoningPortal(province: string, district = "") {
  const normalizedProvince = province.toLocaleLowerCase("tr-TR");
  const normalizedDistrict = district.toLocaleLowerCase("tr-TR");
  return VERIFIED_ZONING_PORTALS.find((portal) => {
    if (portal.province.toLocaleLowerCase("tr-TR") !== normalizedProvince) return false;
    if (!portal.districts?.length) return true;
    return portal.districts.some((item) => item.toLocaleLowerCase("tr-TR") === normalizedDistrict);
  }) ?? null;
}

export function resolveZoningAuthority(province: string, district = "") {
  const record = ZONING_AUTHORITY_ROUTES.find((item) => item.province.toLocaleLowerCase("tr-TR") === province.toLocaleLowerCase("tr-TR"));
  if (!record) return null;
  return {
    ...record,
    district,
    administrativeRoute: district ? `${record.primaryAuthority} · ${district}` : record.primaryAuthority,
    sequence: [
      "TKGM parsel kimliği ve sınır ön kontrolü",
      "e-Plan plan/pafta/PIN araştırması",
      "Yetkili belediye veya idare e-İmar/doğrulama ekranı",
      "Onaylı imar durumu ve plan notu belgesi",
    ],
    limitation: "TAKS, KAKS/emsal, Hmax/Yençok ve nizam ancak güncel plan, plan notu ve yetkili idare belgesiyle resmî statü kazanır.",
  };
}
