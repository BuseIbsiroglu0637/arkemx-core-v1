export type ArkemXDevelopmentStatus =
  | "doğrulanmış geliştirme"
  | "prototip"
  | "geliştiriliyor"
  | "planlanıyor";

export type ArkemXCoreFamily = {
  code: "Core" | "Concrete" | "Precast" | "Steel" | "LightSteel" | "Hybrid";
  title: string;
  role: string;
  evidence: string;
  status: ArkemXDevelopmentStatus;
};

export type ArkemXProjectLayer = {
  code: string;
  title: string;
  purpose: string;
  areas: string[];
};

export type ArkemXValidationRecord = {
  label: string;
  result: string;
  boundary: string;
};

export const arkemXCoreFamilies: ArkemXCoreFamily[] = [
  {
    code: "Core",
    title: "Ortak Proje ve Analiz Çekirdeği",
    role: "Ortak proje verisi, temel analiz altyapısı, doğrulama ve güvenlik sınırlarının merkezidir.",
    evidence: "Yerel çekirdek, kaynak güvenliği ve masaüstü bütünleşme doğrulamaları kayıtlıdır.",
    status: "doğrulanmış geliştirme",
  },
  {
    code: "Concrete",
    title: "Betonarme",
    role: "Betonarme taşıyıcı eleman ve sistem kontrollerini ortak proje yapısına bağlamayı hedefler.",
    evidence: "Teknik modül sınıfı ve yönetmelik sorumlulukları ürün şartnamelerinde tanımlıdır.",
    status: "geliştiriliyor",
  },
  {
    code: "Precast",
    title: "Betonarme Prefabrik",
    role: "Eleman, bağlantı, taşıma, kaldırma, geçici durum ve montaj mühendisliğine odaklanır.",
    evidence: "Prefabrik bağlantı ve yapım aşaması doğrulama çalışmaları geliştirme kayıtlarında yer alır.",
    status: "doğrulanmış geliştirme",
  },
  {
    code: "Steel",
    title: "Yapısal Çelik",
    role: "Çelik eleman, stabilite, birleşim ve hibrit sistem ilişkilerini ortak veriye bağlamayı hedefler.",
    evidence: "Teknik ürün ailesi mevcut mimaride tanımlıdır; üretim kullanımına açık değildir.",
    status: "geliştiriliyor",
  },
  {
    code: "LightSteel",
    title: "Hafif Çelik",
    role: "Panel, profil, bağlantı, sistem davranışı ve üretime yönelik verileri birlikte ele alır.",
    evidence: "Hafif çelik, burkulma ve bağlantı doğrulamaları geliştirme testlerinde kayıtlıdır.",
    status: "doğrulanmış geliştirme",
  },
  {
    code: "Hybrid",
    title: "Hibrit Sistemler",
    role: "Farklı taşıyıcı sistemleri tek proje geometrisi, yük ve revizyon mantığında ilişkilendirmeyi hedefler.",
    evidence: "Teknik modül sınıfı ve sistemler arası sorumluluk sınırları ürün mimarisinde tanımlıdır.",
    status: "geliştiriliyor",
  },
];

export const arkemXProjectLayers: ArkemXProjectLayer[] = [
  {
    code: "01",
    title: "Model ve Analiz",
    purpose: "Proje geometrisi, malzeme, yük, analiz ve sistem davranışı için ortak mühendislik tabanı.",
    areas: ["Ortak proje modeli", "Yapısal analiz", "Deprem ve performans", "Kaynak ve revizyon izi"],
  },
  {
    code: "02",
    title: "Yapı Sistemleri",
    purpose: "Betonarme, prefabrik, çelik, hafif çelik ve hibrit yaklaşımların ortak veriyle ele alınması.",
    areas: ["Betonarme", "Betonarme prefabrik", "Yapısal çelik", "Hafif çelik", "Hibrit sistem"],
  },
  {
    code: "03",
    title: "Proje ve Üretim",
    purpose: "Mühendislik kararının detay, koordinasyon, miktar ve üretim hazırlığına taşınması.",
    areas: ["Detaylandırma", "BIM ve koordinasyon", "Metraj", "Üretim hazırlığı"],
  },
  {
    code: "04",
    title: "Doğrulama ve Saha",
    purpose: "Hesap kaynağı, benchmark, rapor, yapım aşaması, saha değişikliği ve revizyon takibi.",
    areas: ["Doğrulama", "İzlenebilir raporlama", "Yapım aşamaları", "Saha ve revizyon"],
  },
];

export const arkemXValidationRecords: ArkemXValidationRecord[] = [
  { label: "Masaüstü etkileşimleri", result: "55/55", boundary: "Geliştirme arayüzü etkileşim doğrulaması" },
  { label: "Yerel mühendislik regresyonları", result: "85/85", boundary: "Tanımlı geliştirme senaryoları" },
  { label: "C ABI regresyonları", result: "38/38", boundary: "Çekirdek arayüz sözleşmeleri" },
  { label: "Çekirdek / kaynak güvenliği", result: "97/97", boundary: "Kaynak ve güvenlik denetimleri" },
];

export const arkemXConstructionStages = [
  "Taşıma",
  "Kaldırma",
  "Geçici payanda",
  "Montaj",
  "Nihai kullanım",
] as const;

export const arkemXProductGuardrails = [
  "Gerçek yapı tasarımında kullanılamaz.",
  "Ruhsat projesi üretmez.",
  "Şantiye uygulama kararı için kullanılamaz.",
  "Taşıyıcı sistem güvenliği kararı yerine geçmez.",
  "Doğrulanmamış mühendislik fonksiyonları üretim kullanımına açılmaz.",
] as const;

export const arkemXDevelopmentRoadmap = [
  "Ürün ailelerinin kapsam ve sorumluluklarını dondurmak",
  "Benchmark ve regresyon kapsamını genişletmek",
  "Genel uçtan uca proje çözümünü doğrulamak",
  "Proje modülü kataloğunu resmî ürün kaynağına bağlamak",
  "Yetkili üretim kullanımı için bağımsız doğrulama kapılarını tamamlamak",
] as const;
