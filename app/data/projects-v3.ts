export type ProjectEvidenceStatus = "doğrulandı" | "kısmi doğrulama" | "arşiv doğrulaması";

export type V3ProjectFact = {
  label: string;
  value: string;
  status: ProjectEvidenceStatus;
  source: string;
};

export type V3ProjectStage = {
  code: string;
  title: string;
  summary: string;
  evidenceNeeded: string;
  status: ProjectEvidenceStatus;
};

export type V3ProjectArchiveMedia = {
  id: string;
  caption: string;
  sourceLabel: string;
  fileName: string;
  contentType: string;
  href: string;
};

export type V3ProjectRecord = {
  slug: string;
  code: string;
  title: string;
  shortTitle: string;
  summary: string;
  archiveVisible: boolean;
  homepageFeatured?: boolean;
  homepagePriority?: number;
  heroFeatured?: boolean;
  heroPriority?: number;
  heroMediaOrder?: readonly string[];
  evidenceStatus: ProjectEvidenceStatus;
  facts: {
    location: V3ProjectFact;
    buildingType: V3ProjectFact;
    system: V3ProjectFact;
    year: V3ProjectFact;
    area: V3ProjectFact;
    client: V3ProjectFact;
    arkemRole: V3ProjectFact;
    projectStatus: V3ProjectFact;
  };
  caseStudy: readonly V3ProjectStage[];
  archiveMedia: readonly V3ProjectArchiveMedia[];
  media: {
    status: ProjectEvidenceStatus;
    note: string;
    items: readonly string[];
  };
  sourceManifest: readonly V3ProjectFact[];
  scopeBoundary: string;
  relatedSystem: { title: string; href: string };
  relatedService: { title: string; href: string };
};

type ProjectFacts = V3ProjectRecord["facts"];

const pendingSource = "Onaylı arşiv belgesi yayın manifestosuna henüz bağlanmadı";

const fact = (
  label: string,
  value: string,
  status: ProjectEvidenceStatus,
  source: string,
): V3ProjectFact => ({ label, value, status, source });

const pendingFact = (label: string, value: string): V3ProjectFact =>
  fact(label, value, "arşiv doğrulaması", pendingSource);

const baseCaseStudy: readonly V3ProjectStage[] = [
  ["01", "Proje İhtiyacı", "İşveren ihtiyacı ve yapı programı, onaylı brief ile eşleştirildiğinde yayınlanacaktır.", "Onaylı brief, ihtiyaç programı veya sözleşme eki"],
  ["02", "Teknik Kısıtlar", "Arsa, üretim, süre, lojistik ve mevzuat kısıtları kaynak belgesi olmadan tahmin edilmeyecektir.", "Yerleşim, takvim, lojistik ve mevzuat kayıtları"],
  ["03", "Sistem Kararı", "Taşıyıcı sistem seçimi ve değerlendirilen alternatifler, hesap veya karar kaydıyla doğrulanacaktır.", "Sistem kararı, hesap modeli veya onaylı proje paftası"],
  ["04", "Mühendislik Yaklaşımı", "Mühendislik kapsamı ve sorumluluk sınırı, sözleşme ile teknik dosya birlikte incelendiğinde açılacaktır.", "Sözleşme kapsamı, hesap raporu ve imzalı pafta"],
  ["05", "Detay / Üretim", "Uygulama, imalat ve üretim kapsamı; onaylı pafta, üretici ve sorumluluk kaydıyla ilişkilendirildiğinde gösterilecektir.", "Uygulama detayı, imalat paftası, üretim listesi veya revizyon kaydı"],
  ["06", "Saha", "Montaj ve saha rolü; günlük, fotoğraf, tutanak veya onay kaydıyla eşleştirilecektir.", "Saha günlüğü, montaj kaydı, fotoğraf veya tutanak"],
  ["07", "Sonuç", "Teslim durumu ve ölçülebilir sonuçlar, onaylı kapanış kaydı olmadan yayımlanmayacaktır.", "Teslim tutanağı, kapanış kaydı veya doğrulanmış sonuç verisi"],
].map(([code, title, summary, evidenceNeeded]) => ({
  code,
  title,
  summary,
  evidenceNeeded,
  status: "arşiv doğrulaması" as const,
}));

const caseStudyFor = (overrides: Readonly<Record<string, Partial<V3ProjectStage>>> = {}) =>
  baseCaseStudy.map((stage) => ({ ...stage, ...overrides[stage.code], code: stage.code, title: stage.title }));

const identityFact = (title: string): V3ProjectFact =>
  fact("Proje kimliği", title, "doğrulandı", "ARKEM kurumsal proje arşivi");

const manifest = (
  title: string,
  facts: ProjectFacts,
  archiveMedia: readonly V3ProjectArchiveMedia[],
): readonly V3ProjectFact[] => [
  identityFact(title),
  ...Object.values(facts),
  fact(
    "Medya ve yayın kaydı",
    `${archiveMedia.length} ARKEM proje arşivi görseli`,
    "doğrulandı",
    archiveMedia.map((item) => item.sourceLabel).filter((value, index, values) => values.indexOf(value) === index).join(" · "),
  ),
];

const mediaRecord = (items: readonly V3ProjectArchiveMedia[]) => ({
  status: "doğrulandı" as const,
  note: "Gerçek proje arşivi medyası, proje kimliği ve kaynak kaydıyla birlikte yayımlanır; teknik değer veya tamamlanma beyanı yerine geçmez.",
  items: items.map((item) => item.href),
});

const sharedScopeBoundary = "Bu teknik kayıt yalnız ARKEM kurumsal proje arşivinde açıkça tanımlanan bilgi ve medyayı yayımlar. Yıl, alan, teknik değer ve sözleşme kapsamı kaynak kaydı bulunmadan kesin veri olarak gösterilmez.";

const viakastaMedia: readonly V3ProjectArchiveMedia[] = [
  {
    id: "viakasta-archive-01",
    caption: "Viakasta fabrika binası yapım süreci · temel aksları saha kaydı",
    sourceLabel: "ARKEM proje arşivi · R-001 video kaydı",
    fileName: "viakasta-fabrika-binasi.webp",
    contentType: "image/webp",
    href: "/projects/v32/viakasta.webp",
  },
];

const viakastaFacts: ProjectFacts = {
  location: pendingFact("Lokasyon", "Konum bilgisi yayın kaydında açıklanmadı"),
  buildingType: fact("Yapı türü", "Endüstriyel yapı", "doğrulandı", "ARKEM proje arşivi · R-001 video kaydı"),
  system: fact("Taşıyıcı sistem", "Betonarme", "kısmi doğrulama", "ARKEM proje arşivi · R-001 görsel üstverisi"),
  year: pendingFact("Yıl", "Yıl bilgisi yayın kaydında açıklanmadı"),
  area: pendingFact("Alan", "Alan bilgisi yayın kaydında açıklanmadı"),
  client: fact("Proje kaydı", "Viakasta Entegre Orman Ürünleri A.Ş.", "doğrulandı", "ARKEM kurumsal proje arşivi"),
  arkemRole: fact("ARKEM kapsamı", "Yapım süreci ve saha arşivi", "kısmi doğrulama", "ARKEM proje arşivi · R-001 video kaydı"),
  projectStatus: fact("Proje durumu", "Yapım süreci kaydı mevcut", "kısmi doğrulama", "ARKEM proje arşivi · R-001 video kaydı"),
};

const cihanMedia: readonly V3ProjectArchiveMedia[] = [
  {
    id: "cihan-archive-01",
    caption: "Cihan Tat Gıda · taşıyıcı sistem ve çatı makasları saha kaydı",
    sourceLabel: "ARKEM proje arşivi · R-002 video kaydı",
    fileName: "cihan-tat-tasiyici-sistem.webp",
    contentType: "image/webp",
    href: "/projects/v32/cihan-tasiyici.webp",
  },
  {
    id: "cihan-archive-02",
    caption: "Cihan Tat Gıda · tamamlanan üretim tesisi arşiv kaydı",
    sourceLabel: "ARKEM proje arşivi · R-003 video kaydı",
    fileName: "cihan-tat-tamamlanan-yapi.webp",
    contentType: "image/webp",
    href: "/projects/v32/cihan-tamamlanan.webp",
  },
];

const cihanFacts: ProjectFacts = {
  location: fact("Lokasyon", "Seydiler OSB · Kastamonu", "doğrulandı", "ARKEM proje arşivi · R-002 video kaydı"),
  buildingType: fact("Yapı türü", "Endüstriyel üretim tesisi", "doğrulandı", "ARKEM proje arşivi · R-002 video kaydı"),
  system: fact("Taşıyıcı sistem", "Betonarme prefabrik", "doğrulandı", "ARKEM kurumsal proje kaydı ve R-002 saha medyası"),
  year: pendingFact("Yıl", "Yıl bilgisi yayın kaydında açıklanmadı"),
  area: pendingFact("Alan", "Alan bilgisi yayın kaydında açıklanmadı"),
  client: fact("Proje kaydı", "Cihan Tat Gıda", "doğrulandı", "ARKEM kurumsal proje arşivi"),
  arkemRole: fact("ARKEM kapsamı", "Projelendirme, üretim ve montaj", "doğrulandı", "ARKEM kurumsal proje kaydı"),
  projectStatus: fact("Proje durumu", "Tamamlanan yapı kaydı mevcut", "doğrulandı", "ARKEM proje arşivi · R-003 video kaydı"),
};

const yapikurMedia: readonly V3ProjectArchiveMedia[] = [
  {
    id: "yapikur-archive-01",
    caption: "Yapıkur Plaza · betonarme prefabrik temel üretim süreci",
    sourceLabel: "ARKEM proje arşivi · temel üretim video kaydı",
    fileName: "yapikur-plaza-temel.webp",
    contentType: "image/webp",
    href: "/projects/v32/yapikur-temel.webp",
  },
  {
    id: "yapikur-archive-02",
    caption: "Yapıkur Plaza · prefabrik eleman üretim ve montaj süreci",
    sourceLabel: "ARKEM proje arşivi · üretim ve montaj video kaydı",
    fileName: "yapikur-plaza-montaj.webp",
    contentType: "image/webp",
    href: "/projects/v32/yapikur-montaj.webp",
  },
];

const yapikurFacts: ProjectFacts = {
  location: fact("Lokasyon", "Kastamonu Merkez", "doğrulandı", "05.02.2025 Yapıkur Plaza statik hesap raporu · Yapı Bilgileri"),
  buildingType: fact("Yapı türü", "Ticari yapı · plaza", "doğrulandı", "ARKEM kurumsal proje arşivi"),
  system: fact("Taşıyıcı sistem", "Betonarme prefabrik · çatı ve arakat kirişleri mafsallı model", "doğrulandı", "05.02.2025 Yapıkur Plaza statik hesap raporu · bölüm 1.2"),
  year: fact("Belge tarihi", "05.02.2025 · statik hesap raporu; yapım/teslim yılı değil", "doğrulandı", "05.02.2025 Yapıkur Plaza statik hesap raporu · kapak"),
  area: pendingFact("Alan", "Alan bilgisi yayın kaydında açıklanmadı"),
  client: pendingFact("Müşteri", "Müşteri bilgisi yayın kaydında açıklanmadı"),
  arkemRole: fact("Müellif kaydı", "Özenç Öztürk · Yüksek İnşaat Mühendisi · statik proje müellifi", "doğrulandı", "05.02.2025 Yapıkur Plaza statik hesap raporu · Müellif Bilgileri"),
  projectStatus: fact("Proje durumu", "Temel, üretim ve montaj kayıtları mevcut", "kısmi doğrulama", "ARKEM proje arşivi"),
};

const devrekaniMedia: readonly V3ProjectArchiveMedia[] = [
  {
    id: "devrekani-archive-01",
    caption: "Devrekani BOSB · 100 baş betonarme prefabrik hayvancılık tesisi 3B proje kaydı",
    sourceLabel: "ARKEM proje arşivi · 3B proje video kaydı",
    fileName: "devrekani-bosb-3b-proje.webp",
    contentType: "image/webp",
    href: "/projects/v32/devrekani-3b.webp",
  },
];

const devrekaniFacts: ProjectFacts = {
  location: fact("Lokasyon", "Devrekani BOSB · Kastamonu", "doğrulandı", "ARKEM proje arşivi · 3B proje kaydı"),
  buildingType: fact("Yapı türü", "100 baş hayvancılık tesisi", "doğrulandı", "ARKEM proje arşivi · 3B proje kaydı"),
  system: fact("Taşıyıcı sistem", "Betonarme prefabrik", "doğrulandı", "ARKEM proje arşivi · 3B proje kaydı"),
  year: pendingFact("Yıl", "Yıl bilgisi yayın kaydında açıklanmadı"),
  area: pendingFact("Alan", "Alan bilgisi yayın kaydında açıklanmadı"),
  client: pendingFact("Müşteri", "Müşteri bilgisi yayın kaydında açıklanmadı"),
  arkemRole: fact("ARKEM kapsamı", "Proje geliştirme ve 3B proje kaydı", "kısmi doğrulama", "ARKEM kurumsal proje arşivi"),
  projectStatus: fact("Proje durumu", "3B proje kaydı", "doğrulandı", "ARKEM proje arşivi · 3B proje video kaydı"),
};

export const v3Projects: readonly V3ProjectRecord[] = [
  {
    slug: "viakasta",
    code: "P-001",
    title: "Viakasta Entegre Orman Ürünleri A.Ş.",
    shortTitle: "Viakasta Entegre Orman Ürünleri",
    summary: "Endüstriyel yapı yapım süreci; proje kimliği ve gerçek saha medyasıyla teknik kayıt düzeninde sunulur.",
    archiveVisible: true,
    evidenceStatus: "kısmi doğrulama",
    facts: viakastaFacts,
    caseStudy: caseStudyFor({
      "05": { summary: "Temel aksları ve yapım süreci, R-001 saha videosunda kayıtlıdır.", evidenceNeeded: "ARKEM proje arşivi · R-001 video kaydı", status: "kısmi doğrulama" },
      "06": { summary: "Saha ilerlemesi gerçek hava görüntüleriyle proje kaydına bağlanmıştır.", evidenceNeeded: "ARKEM proje arşivi · R-001 video kaydı", status: "kısmi doğrulama" },
    }),
    archiveMedia: viakastaMedia,
    media: mediaRecord(viakastaMedia),
    sourceManifest: manifest("Viakasta Entegre Orman Ürünleri A.Ş.", viakastaFacts, viakastaMedia),
    scopeBoundary: sharedScopeBoundary,
    relatedSystem: { title: "Yapı sistemleri yaklaşımı", href: "/yapi-sistemleri" },
    relatedService: { title: "Mühendislik hizmetleri", href: "/muhendislik" },
  },
  {
    slug: "cihan-tat",
    code: "P-002",
    title: "Cihan Tat Gıda — Seydiler OSB",
    shortTitle: "Cihan Tat Gıda",
    summary: "Seydiler OSB üretim tesisi; taşıyıcı sistem, üretim, montaj ve tamamlanan yapı kayıtlarıyla sunulur.",
    archiveVisible: true,
    homepageFeatured: true,
    homepagePriority: 1,
    heroFeatured: true,
    heroPriority: 1,
    heroMediaOrder: ["cihan-archive-02", "cihan-archive-01"],
    evidenceStatus: "kısmi doğrulama",
    facts: cihanFacts,
    caseStudy: caseStudyFor({
      "03": { summary: "Üretim tesisi betonarme prefabrik taşıyıcı sistemle kayıtlıdır.", evidenceNeeded: "ARKEM kurumsal proje kaydı ve R-002 saha medyası", status: "doğrulandı" },
      "04": { summary: "Projelendirme kapsamı, üretim ve montaj süreçleriyle aynı proje kaydında ilişkilendirilmiştir.", evidenceNeeded: "ARKEM kurumsal proje kaydı", status: "doğrulandı" },
      "05": { summary: "Taşıyıcı sistem, çatı makasları, üretim ve montaj süreçleri gerçek proje medyasında görülür.", evidenceNeeded: "ARKEM proje arşivi · R-002 video kaydı", status: "doğrulandı" },
      "06": { summary: "Saha ve montaj ilerlemesi gerçek hava görüntüleriyle kayıtlıdır.", evidenceNeeded: "ARKEM proje arşivi · R-002 video kaydı", status: "doğrulandı" },
      "07": { summary: "Tamamlanan üretim tesisine ait gerçek proje görüntüsü arşiv kaydına bağlanmıştır.", evidenceNeeded: "ARKEM proje arşivi · R-003 video kaydı", status: "doğrulandı" },
    }),
    archiveMedia: cihanMedia,
    media: mediaRecord(cihanMedia),
    sourceManifest: manifest("Cihan Tat Gıda — Seydiler OSB", cihanFacts, cihanMedia),
    scopeBoundary: sharedScopeBoundary,
    relatedSystem: { title: "Betonarme prefabrik", href: "/yapi-sistemleri/betonarme-prefabrik" },
    relatedService: { title: "Mühendislik hizmetleri", href: "/muhendislik" },
  },
  {
    slug: "yapikur-plaza",
    code: "P-003",
    title: "Yapıkur Plaza — Kastamonu Merkez",
    shortTitle: "Yapıkur Plaza",
    summary: "Kastamonu Merkez'de önüretimli betonarme taşıyıcı sistem: 05.02.2025 tarihli statik hesap raporu, temel ve montaj saha kayıtları.",
    archiveVisible: true,
    homepageFeatured: true,
    homepagePriority: 2,
    evidenceStatus: "kısmi doğrulama",
    facts: yapikurFacts,
    caseStudy: caseStudyFor({
      "03": { summary: "Statik hesap raporunda taşıyıcı sistem temelde ankastre, çatı ve arakat kirişleri mafsallı MFB1 model olarak tanımlanır. Bu bilgi tasarım modeline aittir.", evidenceNeeded: "05.02.2025 Yapıkur Plaza statik hesap raporu · bölüm 1.2", status: "doğrulandı" },
      "04": { summary: "05.02.2025 tarihli hesap raporunda proje müellifi Özenç Öztürk olarak kayıtlıdır. Statik proje müellifliği, saha yükleniciliği veya üretici rolü anlamına gelmez.", evidenceNeeded: "05.02.2025 Yapıkur Plaza statik hesap raporu · Müellif Bilgileri", status: "doğrulandı" },
      "05": { summary: "Temel üretimi ile prefabrik eleman üretim ve montaj süreçleri gerçek proje medyasında kayıtlıdır.", evidenceNeeded: "ARKEM proje arşivi · temel, üretim ve montaj video kayıtları", status: "doğrulandı" },
      "06": { summary: "Montaj sahası ve prefabrik eleman yerleşimi gerçek hava görüntülerinde görülür.", evidenceNeeded: "ARKEM proje arşivi · üretim ve montaj video kaydı", status: "doğrulandı" },
    }),
    archiveMedia: yapikurMedia,
    media: mediaRecord(yapikurMedia),
    sourceManifest: manifest("Yapıkur Plaza — Kastamonu Merkez", yapikurFacts, yapikurMedia),
    scopeBoundary: sharedScopeBoundary,
    relatedSystem: { title: "Betonarme prefabrik", href: "/yapi-sistemleri/betonarme-prefabrik" },
    relatedService: { title: "Uygulama ve imalat mühendisliği", href: "/muhendislik#uygulama-projeleri" },
  },
  {
    slug: "devrekani-bosb",
    code: "P-004",
    title: "100 Baş Hayvancılık Tesisi — Devrekani BOSB",
    shortTitle: "100 Baş Hayvancılık Tesisi",
    summary: "Devrekani BOSB için betonarme prefabrik hayvancılık tesisi; 3B proje kaydı ve sistem bilgisiyle sunulur.",
    archiveVisible: true,
    homepageFeatured: true,
    homepagePriority: 3,
    evidenceStatus: "kısmi doğrulama",
    facts: devrekaniFacts,
    caseStudy: caseStudyFor({
      "01": { summary: "Proje programı, 100 baş kapasiteli hayvancılık tesisi olarak arşiv kaydında tanımlıdır.", evidenceNeeded: "ARKEM proje arşivi · 3B proje kaydı", status: "doğrulandı" },
      "03": { summary: "Taşıyıcı sistem betonarme prefabrik olarak proje kaydında tanımlıdır.", evidenceNeeded: "ARKEM proje arşivi · 3B proje kaydı", status: "doğrulandı" },
      "04": { summary: "Yapı geometrisi ve kullanım kurgusu 3B proje sunumuyla kayıtlıdır; uygulama kapsamı ayrıca doğrulanacaktır.", evidenceNeeded: "ARKEM proje arşivi · 3B proje video kaydı", status: "kısmi doğrulama" },
    }),
    archiveMedia: devrekaniMedia,
    media: mediaRecord(devrekaniMedia),
    sourceManifest: manifest("100 Baş Hayvancılık Tesisi — Devrekani BOSB", devrekaniFacts, devrekaniMedia),
    scopeBoundary: `${sharedScopeBoundary} 3B proje görseli tamamlanmış yapı veya saha fotoğrafı olarak sunulmaz.`,
    relatedSystem: { title: "Betonarme prefabrik", href: "/yapi-sistemleri/betonarme-prefabrik" },
    relatedService: { title: "Mühendislik hizmetleri", href: "/muhendislik" },
  },
];

export function getV3Project(slug: string) {
  return v3Projects.find((project) => project.slug === slug);
}
