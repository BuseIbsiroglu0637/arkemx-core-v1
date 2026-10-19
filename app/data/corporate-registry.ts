export const corporateRegistry = {
  schemaVersion: "3.5.0",
  updatedAt: "2026-08-11",
  primaryLanguage: "tr",
  brand: {
    name: "ARKEM Yapı Sistemleri",
    shortName: "ARKEM",
    descriptor: "Mühendislikten sahaya, sahadan teknolojiye.",
  },
  legalEntity: {
    // Hukuki unvan ve marka/şirket ilişkisi resmî kayıtla doğrulanana kadar yayımlanmaz.
    name: null as string | null,
    relationshipStatement: null as string | null,
    verificationStatus: "DOĞRULANMADI",
    publicationNote: "Hukuki unvan ve marka/şirket ilişkisi resmî kayıtla doğrulandıktan sonra yayımlanır.",
  },
  history: {
    establishedAt: null,
    engineeringPracticeSince: null,
    publicationNote: "Kuruluş ve mühendislik geçmişi tarihleri resmî kayıtla kesinleştirilmeden yayımlanmaz.",
  },
  contact: {
    phoneDisplay: "+90 533 575 54 37",
    phoneHref: "+905335755437",
    whatsappHref: "905335755437",
    // Domain tabanlı kurumsal posta hesabı doğrulanana kadar yayımlanmaz.
    email: null as string | null,
    location: "Bahçelievler Mahallesi, Serdivan / Sakarya",
    postalCode: "54050",
  },
  domains: {
    canonical: "https://arkemyapisistemleri.com",
    application: "https://arkem-yapi-sistemleri.ozencztrk.chatgpt.site",
  },
  social: {
    instagram: "https://www.instagram.com/arkemyapisistemleri/",
    linkedin: "https://www.linkedin.com/company/arkemyapisistemleri/",
    youtube: "https://www.youtube.com/@arkemyapisistemleri",
    facebook: "https://www.facebook.com/arkemyapisistemleri/",
    tiktok: "https://www.tiktok.com/@arkemyapisistemleri",
    threads: "https://www.threads.net/@arkemyapisistemleri",
    sketchfab: "https://sketchfab.com/ozenczturk",
  },
  serviceAreas: [
    "Betonarme prefabrik yapı sistemleri",
    "Yapısal çelik sistemler",
    "Hafif çelik sistemler",
    "Hibrit yapı sistemleri",
    "Taşıyıcı sistem mühendisliği",
    "Uygulama ve saha mühendisliği",
  ],
  productionRelationships: {
    statement: "Üretim, imalat ve iş ortaklığı kapsamı proje kaydındaki sözleşme ve sorumluluk sınırıyla birlikte yayımlanır.",
    publishedPartners: [] as readonly string[],
  },
  arkemx: {
    name: "ARKEMX",
    position: "ARKEM’in mühendislik Ar-Ge ve dijital proje platformu",
    status: "AKTİF GELİŞTİRME",
    moduleCount: 13,
  },
} as const;

export type CorporateRegistry = typeof corporateRegistry;
