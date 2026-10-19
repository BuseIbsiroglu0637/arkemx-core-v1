export const ARKEMX_MODULE_STATUSES = [
  "AKTİF",
  "AKTİF · GELİŞTİRİLİYOR",
  "DOĞRULANIYOR",
  "GELİŞTİRME PROGRAMINDA",
] as const;

export type ArkemXModuleStatus = (typeof ARKEMX_MODULE_STATUSES)[number];

export type ArkemXModuleGroupId =
  | "modelleme-analiz"
  | "tasiyici-sistemler"
  | "temel-uretim"
  | "ekonomi-kontrol"
  | "yapim";

export type ArkemXModuleGroup = {
  id: ArkemXModuleGroupId;
  code: string;
  title: string;
  statement: string;
};

export type ArkemXRuntimeAcceptance = {
  checkedAt: string;
  routeOpens: boolean;
  acceptsCoreInput: boolean;
  runsCoreProcess: boolean;
  producesMeaningfulOutput: boolean;
  criticalErrorFree: boolean;
  minimumRegression: boolean;
  engineeringValidation: "tamamlandı" | "kısmi" | "planlanıyor";
  evidence: string;
};

export type ArkemXModuleRegistryItem = {
  id: string;
  code: string;
  title: string;
  groupId: ArkemXModuleGroupId;
  version: string;
  status: ArkemXModuleStatus;
  description: string;
  seoDescription: string;
  problem: string;
  capabilities: readonly string[];
  lastUpdated: string;
  validationStatus: string;
  dependencies: readonly string[];
  connectedModules: readonly string[];
  inputs: readonly string[];
  process: readonly string[];
  connections: readonly string[];
  outputs: readonly string[];
  recentUpdates: readonly string[];
  workingRoute: string;
  webVisible: boolean;
  developmentNote: string;
  runtimeAcceptance: ArkemXRuntimeAcceptance;
  boundary: string;
};

export const arkemXModuleGroups: readonly ArkemXModuleGroup[] = [
  {
    id: "modelleme-analiz",
    code: "A",
    title: "Modelleme ve Analiz",
    statement: "Ortak proje modelini, yapısal davranışı ve deprem mühendisliği kayıtlarını aynı çözüm zincirinde ele alır.",
  },
  {
    id: "tasiyici-sistemler",
    code: "B",
    title: "Taşıyıcı Sistemler",
    statement: "Betonarme, prefabrik, çelik, hafif çelik ve hibrit sistemleri ortak proje verisine bağlar.",
  },
  {
    id: "temel-uretim",
    code: "C",
    title: "Temel ve Üretim",
    statement: "Üstyapı kararını temel, detay, imalat ve üretim hazırlığıyla ilişkilendirir.",
  },
  {
    id: "ekonomi-kontrol",
    code: "D",
    title: "Proje Ekonomisi ve Kontrol",
    statement: "Miktar değişimini, maliyet bağlantısını, doğrulamayı ve revizyon izini görünür tutar.",
  },
  {
    id: "yapim",
    code: "E",
    title: "Yapım",
    statement: "Üretimden montaja ve saha revizyonuna uzanan yapım durumlarını proje kaydına geri bağlar.",
  },
] as const;

const arkemXModuleDefinitions = [
  {
    id: "proje-modeli",
    code: "01",
    title: "Proje Modeli",
    groupId: "modelleme-analiz",
    version: "v1.0 veri omurgası",
    description: "Aks, kat, geometri, eleman, malzeme ve revizyon verisini tek proje kimliğinde ilişkilendiren ortak omurga.",
    problem: "Aynı proje bilgisinin farklı çalışma alanlarında tekrar ve kopuk biçimde tutulmasını azaltır.",
    capabilities: ["Aks ve kat tanımı", "Plan ve taşıyıcı nesneler", "Proje oturumu ve revizyon kaydı"],
    lastUpdated: "Ağustos 2026",
    validationStatus: "Çalışan plan ve aks arayüzü aktif; ortak veri sözleşmesi doğrulaması genişletiliyor.",
    dependencies: [],
    connectedModules: ["02", "03", "04", "05", "06", "07", "08", "09", "10", "11", "12", "13"],
    inputs: ["Aks ve kat düzeni", "Geometri ve elemanlar", "Malzeme ve yük kabulleri"],
    process: ["Fiziksel ve analitik veriyi ilişkilendirir", "Proje kimliğini ve revizyon izini korur"],
    connections: ["02 Yapısal Analiz", "04–08 Taşıyıcı Sistemler", "10 Detay ve İmalat"],
    outputs: ["Ortak proje veri seti", "Eleman kimlikleri", "Revizyon kaydı"],
    recentUpdates: ["Plan ve aks çalışma alanı yeniden aktif modül bağlantısına alındı.", "Durum, sürüm ve kullanım sınırı merkezi registry kaydında birleştirildi."],
    workingRoute: "/tasarim-calismalari#plan-editor",
    boundary: "Çalışan işlev proje ön değerlendirmesi içindir; yetkili uygulama modeli yerine geçmez.",
  },
  {
    id: "yapisal-analiz",
    code: "02",
    title: "Yapısal Analiz",
    groupId: "modelleme-analiz",
    version: "v2.5 analiz çekirdeği",
    description: "Geometri, yük, kesit ve sınır koşullarından kavramsal taşıyıcı davranış ve ön boyutlandırma üretir.",
    problem: "Taşıyıcı sistem kararının geometri ve yük verisinden kopuk alınmasını önler.",
    capabilities: ["Geometri ve yük girdisi", "Taşıyıcı ön boyutlandırma", "Kavramsal sonuç ve miktar özeti"],
    lastUpdated: "Ağustos 2026",
    validationStatus: "Ön tasarım hesap akışı aktif; benchmark ve regresyon kapsamı geliştiriliyor.",
    dependencies: ["01"],
    connectedModules: ["01", "03", "04", "05", "06", "07", "08"],
    inputs: ["Proje modeli", "Yük kabulleri", "Kesit ve malzeme", "Sınır koşulları"],
    process: ["Taşıyıcı ön modeli kurar", "Davranış göstergelerini ve ön boyutları hesaplar"],
    connections: ["01 Proje Modeli", "03 Deprem Mühendisliği", "04–08 Taşıyıcı Sistemler"],
    outputs: ["Ön boyutlar", "Yük ve davranış izi", "Kavramsal metraj"],
    recentUpdates: ["Taşıyıcı ön tasarım arayüzü aktif modül kaydına bağlandı.", "Çıktı sınırları ve uzman kontrol gereksinimi görünür hale getirildi."],
    workingRoute: "/tasarim-calismalari#tasiyici-on-tasarim",
    boundary: "Sonuçlar ruhsat, uygulama projesi veya yapı güvenliği kararı değildir; yetkili mühendis kontrolü gerektirir.",
  },
  {
    id: "deprem-muhendisligi",
    code: "03",
    title: "Deprem Mühendisliği",
    groupId: "modelleme-analiz",
    version: "Sürüm kaydı doğrulanıyor",
    description: "Deprem girdileri, sistem davranışı ve kontrol kayıtlarını ortak analiz zincirinde düzenler.",
    problem: "Deprem kararlarının model, sistem ve doğrulama kayıtlarından ayrılmasını önler.",
    capabilities: ["Deprem kapsam kaydı", "Sistem davranışı ön göstergeleri", "Kontrol ve doğrulama bağlantısı"],
    lastUpdated: "Ağustos 2026",
    validationStatus: "Deprem girdisi, spektral talep göstergesi ve hesap izi çalışır durumda; yönetmelik ve benchmark kapsamı doğrulanıyor.",
    dependencies: ["01", "02"],
    connectedModules: ["01", "02", "04", "05", "06"],
    inputs: ["Proje modeli", "Deprem parametreleri", "Kütle ve rijitlik kabulleri"],
    process: ["Deprem kapsamını analiz kaydına bağlar", "Davranış ve kontrol ihtiyaçlarını sınıflandırır"],
    connections: ["02 Yapısal Analiz", "04 Betonarme", "05 Prefabrik Betonarme", "06 Yapısal Çelik"],
    outputs: ["Deprem kapsam kaydı", "Kontrol listesi", "Doğrulama ihtiyacı"],
    recentUpdates: ["Deprem girdisinin spektral talep ve taban kesme göstergesine etkisi regresyon kapsamına alındı.", "Doğrulama sınırı modül detayında açıklandı."],
    workingRoute: "/tasarim-calismalari#tasiyici-on-tasarim",
    boundary: "Çalışan kapsam ön değerlendirmedir; yönetmeliğe göre nihai deprem hesabı üretmez.",
  },
  {
    id: "betonarme",
    code: "04",
    title: "Betonarme",
    groupId: "tasiyici-sistemler",
    version: "Sürüm kaydı doğrulanıyor",
    description: "Betonarme sistem, eleman ve miktar kararlarını proje modeliyle birlikte ön değerlendirir.",
    problem: "Betonarme sistem kararının açıklık, yük, malzeme ve uygulama koşullarından kopuk değerlendirilmesini azaltır.",
    capabilities: ["Sistem seçimi karşılaştırması", "Betonarme taşıyıcı ön modeli", "Kavramsal miktar özeti"],
    lastUpdated: "Ağustos 2026",
    validationStatus: "Betonarme ön boyutlandırma ve kavramsal miktar çıktısı çalışır durumda; eleman ve yönetmelik doğrulaması genişletiliyor.",
    dependencies: ["01", "02", "03"],
    connectedModules: ["01", "02", "03", "09"],
    inputs: ["Geometri ve açıklıklar", "Yük kabulleri", "Malzeme", "Sistem ölçütleri"],
    process: ["Sistem uygunluğunu karşılaştırır", "Taşıyıcı ön boyutları proje verisine bağlar"],
    connections: ["02 Yapısal Analiz", "03 Deprem Mühendisliği", "09 Temel ve Zemin Etkileşimi"],
    outputs: ["Sistem karar kaydı", "Ön boyutlar", "Kavramsal miktar verisi"],
    recentUpdates: ["Betonarme ön boyutlandırma, miktar ve talep çıktıları modül bazlı regresyon kapsamına alındı.", "Sistem ve çıktı sınırları tek registry kaydında toplandı."],
    workingRoute: "/tasarim-calismalari#tasiyici-on-tasarim",
    boundary: "Çalışan işlev betonarme uygulama projesi veya donatı tasarımı üretmez.",
  },
  {
    id: "prefabrik-betonarme",
    code: "05",
    title: "Prefabrik Betonarme",
    groupId: "tasiyici-sistemler",
    version: "v1.6 araştırma çekirdeği",
    description: "Prefabrik sistem kararını eleman, üretim, lojistik, montaj ve saha koşullarıyla birlikte ele alır.",
    problem: "Prefabrik kararların yalnız nihai sistem üzerinden değerlendirilmesini önler.",
    capabilities: ["Sistem uygunluğu karşılaştırması", "Lojistik ve montaj ölçütleri", "Geçici durum kapsam kaydı"],
    lastUpdated: "Ağustos 2026",
    validationStatus: "Çalışan sistem değerlendirmesi aktif; eleman, bağlantı ve yapım aşaması doğrulaması genişletiliyor.",
    dependencies: ["01", "02", "03"],
    connectedModules: ["01", "02", "03", "10", "13"],
    inputs: ["Açıklık ve geometri", "Üretim ve lojistik ölçütleri", "Montaj kabulleri"],
    process: ["Prefabrik sistem uygunluğunu karşılaştırır", "Üretim ve yapım aşaması gereksinimlerini kaydeder"],
    connections: ["02 Yapısal Analiz", "10 Detay ve İmalat", "13 Yapım Aşaması ve Saha"],
    outputs: ["Gerekçeli sistem kaydı", "Üretim ve montaj ön gereksinimleri", "Geliştirme sınırı"],
    recentUpdates: ["Prefabrik sistem değerlendirmesi aktif registry bağlantısına alındı.", "Yapım aşaması ve saha bağı modül detayına eklendi."],
    workingRoute: "/yapi-sistemi-karsilastirma#sistem-karsilastirma",
    boundary: "Çalışan işlev bağlantı hesabı, üretim onayı veya montaj talimatı değildir.",
  },
  {
    id: "yapisal-celik",
    code: "06",
    title: "Yapısal Çelik",
    groupId: "tasiyici-sistemler",
    version: "Sürüm kaydı doğrulanıyor",
    description: "Çelik sistem kararını açıklık, ağırlık, imalat, birleşim ve montaj ölçütleriyle ilişkilendirir.",
    seoDescription: "ARKEMX Yapısal Çelik modülü, çelik sistem kararlarını analiz, imalat ve metraj süreçleriyle ilişkilendirmek üzere doğrulanmaktadır.",
    problem: "Çelik sistem kararının üretim ve birleşim gerçeklerinden kopuk alınmasını azaltır.",
    capabilities: ["Sistem karşılaştırması", "Çelik taşıyıcı ön modeli", "Kavramsal tonaj özeti"],
    lastUpdated: "Ağustos 2026",
    validationStatus: "Çelik ön boyutlandırma ve kavramsal tonaj çıktısı çalışır durumda; stabilite ve birleşim doğrulama kapsamı geliştiriliyor.",
    dependencies: ["01", "02", "03"],
    connectedModules: ["01", "02", "03", "08", "10"],
    inputs: ["Geometri ve açıklıklar", "Yük kabulleri", "Kesit ve imalat ölçütleri"],
    process: ["Sistem uygunluğunu karşılaştırır", "Taşıyıcı ön model ve miktar göstergesi üretir"],
    connections: ["02 Yapısal Analiz", "08 Hibrit Sistemler", "10 Detay ve İmalat"],
    outputs: ["Sistem karar kaydı", "Ön boyutlar", "Kavramsal tonaj"],
    recentUpdates: ["Çelik ön boyutlandırma, miktar ve talep çıktıları modül bazlı regresyon kapsamına alındı.", "İmalat ve birleşim sınırları görünür hale getirildi."],
    workingRoute: "/tasarim-calismalari#tasiyici-on-tasarim",
    boundary: "Çalışan işlev nihai stabilite, birleşim veya imalat tasarımı üretmez.",
  },
  {
    id: "hafif-celik",
    code: "07",
    title: "Hafif Çelik",
    groupId: "tasiyici-sistemler",
    version: "v1.6 araştırma çekirdeği",
    description: "Hafif çelik sistem kararını panelizasyon, profil, açıklık, üretim ve montaj ölçütleriyle birlikte değerlendirir.",
    problem: "Panel, profil ve üretim kararlarının proje modelinden ayrılmasını azaltır.",
    capabilities: ["Sistem uygunluğu karşılaştırması", "Panel ve profil kapsam kaydı", "Üretim ölçütleri"],
    lastUpdated: "Ağustos 2026",
    validationStatus: "Çalışan sistem değerlendirmesi aktif; panel, profil ve bağlantı doğrulaması genişletiliyor.",
    dependencies: ["01", "02"],
    connectedModules: ["01", "02", "10", "11"],
    inputs: ["Yapı programı", "Açıklık ve kat adedi", "Panelizasyon ve üretim ölçütleri"],
    process: ["Hafif çelik uygunluğunu karşılaştırır", "Panel ve üretim gereksinimlerini sınıflandırır"],
    connections: ["02 Yapısal Analiz", "10 Detay ve İmalat", "11 Metraj ve Maliyet"],
    outputs: ["Sistem karar kaydı", "Panelizasyon ön gereksinimleri", "Geliştirme sınırı"],
    recentUpdates: ["Hafif çelik sistem değerlendirmesi aktif modül bağlantısına alındı.", "Panel, profil ve üretim kapsamı registry’de ayrıştırıldı."],
    workingRoute: "/yapi-sistemi-karsilastirma#sistem-karsilastirma",
    boundary: "Çalışan işlev panel üretim listesi veya yetkili hafif çelik projesi değildir.",
  },
  {
    id: "hibrit-sistemler",
    code: "08",
    title: "Hibrit Sistemler",
    groupId: "tasiyici-sistemler",
    version: "Sürüm kaydı doğrulanıyor",
    description: "Farklı taşıyıcı sistemleri tek proje geometrisi, arayüz ve revizyon mantığında birlikte değerlendirir.",
    problem: "Sistemler arası yük aktarımı, sorumluluk ve revizyon sınırlarının görünmez kalmasını önler.",
    capabilities: ["Çoklu sistem karşılaştırması", "Hibrit sistem kapsam kaydı", "Arayüz ve sorumluluk listesi"],
    lastUpdated: "Ağustos 2026",
    validationStatus: "Hibrit sistem ön boyutlandırma ve arayüz risk kaydı çalışır durumda; bütünleşik çözüm doğrulaması geliştiriliyor.",
    dependencies: ["01", "02", "04", "05", "06", "07"],
    connectedModules: ["01", "02", "04", "05", "06", "07", "10", "12"],
    inputs: ["Ortak proje modeli", "Sistem sınırları", "Arayüz ve yük aktarım kabulleri"],
    process: ["Sistem alternatiflerini birlikte değerlendirir", "Arayüz ve sorumluluk kayıtlarını ilişkilendirir"],
    connections: ["04–07 Taşıyıcı Sistemler", "10 Detay ve İmalat", "12 Doğrulama ve İzlenebilirlik"],
    outputs: ["Hibrit sistem karar kaydı", "Arayüz listesi", "Etkilenen modüller"],
    recentUpdates: ["Hibrit sistem ön boyutlandırma, miktar ve arayüz riskleri modül bazlı regresyon kapsamına alındı.", "Bağlı taşıyıcı sistemler tek detay panelinde görünür hale getirildi."],
    workingRoute: "/tasarim-calismalari#tasiyici-on-tasarim",
    boundary: "Çalışan işlev sistem arayüzlerinin nihai hesabı veya uygulama detayı değildir.",
  },
  {
    id: "temel-zemin",
    code: "09",
    title: "Temel ve Zemin Etkileşimi",
    groupId: "temel-uretim",
    version: "Sürüm kaydı doğrulanıyor",
    description: "Üstyapı tepkileri, temel geometrisi ve doğrulanmış zemin girdileri arasındaki veri bağını kurar.",
    problem: "Arsa, zemin girdisi ve üstyapı kararlarının ayrı kayıtlarda kalmasını azaltır.",
    capabilities: ["Koordinatlı parsel girdisi", "Zemin veri durumu kaydı", "Üstyapı–temel kapsam bağlantısı"],
    lastUpdated: "Ağustos 2026",
    validationStatus: "Üstyapı talebi ile kullanıcı kaynaklı zemin taşıma girdisinin ön karşılaştırması çalışır durumda; geoteknik ve temel hesabı kapsamı doğrulanıyor.",
    dependencies: ["01", "02", "04", "05"],
    connectedModules: ["01", "02", "04", "05"],
    inputs: ["Parsel ve konum", "Zemin veri kaynağı", "Üstyapı tepkileri", "Temel kabulleri"],
    process: ["Zemin girdisinin kaynağını kaydeder", "Üstyapı talebi ile zemin girdisini ön karşılaştırır"],
    connections: ["01 Proje Modeli", "02 Yapısal Analiz", "04 Betonarme", "05 Prefabrik Betonarme"],
    outputs: ["Zemin veri durumu", "Temel basınç ve kullanım ön göstergesi", "Eksik veri listesi"],
    recentUpdates: ["Üstyapı talebi, temel basınç göstergesi ve zemin girdisi modül bazlı regresyon kapsamına alındı.", "Geoteknik tasarım ile veri hazırlığı arasındaki sınır görünürleştirildi."],
    workingRoute: "/muhendislik-koordinasyon#koordinasyon-motoru",
    boundary: "Çalışan işlev geoteknik rapor, taşıma gücü hesabı veya temel tasarımı üretmez.",
  },
  {
    id: "detay-imalat",
    code: "10",
    title: "Detay ve İmalat",
    groupId: "temel-uretim",
    version: "Sürüm kaydı doğrulanıyor",
    description: "Analiz ve sistem kararını eleman, bağlantı, model inceleme ve imalat hazırlığına taşır.",
    problem: "Hesap kararının uygulanabilir detay ve üretim bilgisine dönüşürken izini kaybetmesini önler.",
    capabilities: ["3B model inceleme", "Revizyon notu", "Detay ve imalat kapsam kaydı"],
    lastUpdated: "Ağustos 2026",
    validationStatus: "Çalışan model inceleme arayüzü aktif; detay ve imalat veri sözleşmesi geliştiriliyor.",
    dependencies: ["01", "02", "04", "05", "06", "07", "08"],
    connectedModules: ["01", "02", "04", "05", "06", "07", "08", "11", "13"],
    inputs: ["Eleman ve model verisi", "Bağlantı kararları", "Revizyon ve tolerans kayıtları"],
    process: ["Model ve revizyon bilgisini inceler", "Detay ve imalat gereksinimini proje elemanına bağlar"],
    connections: ["04–08 Taşıyıcı Sistemler", "11 Metraj ve Maliyet", "13 Yapım Aşaması ve Saha"],
    outputs: ["Model inceleme kaydı", "Revizyon notu", "Detay ve imalat gereksinimi"],
    recentUpdates: ["3B model inceleme çalışma alanı aktif registry bağlantısına alındı.", "Detay, revizyon ve imalat kapsamı aynı kayıt altında toplandı."],
    workingRoute: "/3b-model-kutuphanesi#model-kutuphanesi",
    boundary: "Çalışan işlev yetkili imalat paftası veya üretim onayı değildir.",
  },
  {
    id: "metraj-maliyet",
    code: "11",
    title: "Metraj ve Maliyet",
    groupId: "ekonomi-kontrol",
    version: "Sürüm kaydı doğrulanıyor",
    description: "Proje değişikliğini kavramsal miktar, maliyet bağlantısı ve karar kaydıyla ilişkilendirir.",
    problem: "Metraj ve maliyet senaryosunun model revizyonundan kopmasını azaltır.",
    capabilities: ["Kavramsal miktar özeti", "Revizyon etkisi kaydı", "Proje OS maliyet bağlantısı"],
    lastUpdated: "Ağustos 2026",
    validationStatus: "Çalışan miktar ve proje kaydı aktif; birim fiyat ve maliyet entegrasyonu geliştiriliyor.",
    dependencies: ["01", "02", "10"],
    connectedModules: ["01", "02", "10", "12"],
    inputs: ["Proje modeli", "Eleman ve malzeme kimlikleri", "Revizyon ve miktar verisi"],
    process: ["Miktar göstergelerini sınıflandırır", "Değişiklik etkisini proje kaydına bağlar"],
    connections: ["01 Proje Modeli", "02 Yapısal Analiz", "10 Detay ve İmalat", "12 Doğrulama"],
    outputs: ["Kavramsal miktar listesi", "Değişiklik kaydı", "Maliyet bağlantısı için veri"],
    recentUpdates: ["Kavramsal metraj çıktısı aktif modül kaydına bağlandı.", "Maliyet bağlantısının mevcut ve geliştirilen kapsamı ayrıştırıldı."],
    workingRoute: "/tasarim-calismalari#tasiyici-on-tasarim",
    boundary: "Çalışan işlev kesin metraj, keşif, teklif veya birim fiyat sonucu değildir.",
  },
  {
    id: "dogrulama-izlenebilirlik",
    code: "12",
    title: "Doğrulama ve İzlenebilirlik",
    groupId: "ekonomi-kontrol",
    version: "v1.6 doğrulama altyapısı",
    description: "Girdi, kaynak, ara karar, kontrol, revizyon ve sonuç zincirini incelenebilir proje kaydına dönüştürür.",
    problem: "Bir sonucun hangi veri, kaynak ve revizyondan üretildiğinin kaybolmasını önler.",
    capabilities: ["Issue ve revizyon kaydı", "Bağımlılık ve teslim izi", "Doğrulama durumu"],
    lastUpdated: "Ağustos 2026",
    validationStatus: "Çalışan koordinasyon ve iz kayıtları aktif; regresyon ve benchmark kapsamı genişletiliyor.",
    dependencies: ["01", "02"],
    connectedModules: ["01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11", "13"],
    inputs: ["Teknik girdiler", "Kaynak ve revizyon", "Kontrol kayıtları", "Modül çıktıları"],
    process: ["Kararı kaynağına bağlar", "Doğrulama durumu ve kullanım sınırını izler"],
    connections: ["Tüm mühendislik modülleri", "11 Metraj ve Maliyet", "13 Yapım Aşaması ve Saha"],
    outputs: ["İzlenebilir karar kaydı", "Doğrulama durumu", "Revizyon ve kapanış izi"],
    recentUpdates: ["Koordinasyon ve izlenebilirlik çalışma alanı aktif registry bağlantısına alındı.", "Modül durumlarının merkezi kaynaktan yayımlanması sağlandı."],
    workingRoute: "/muhendislik-koordinasyon#koordinasyon-motoru",
    boundary: "Çalışan kayıt altyapısı tek başına bir mühendislik sonucunun yetkili olarak doğrulandığı anlamına gelmez.",
  },
  {
    id: "yapim-saha",
    code: "13",
    title: "Yapım Aşaması ve Saha",
    groupId: "yapim",
    version: "v1.6 araştırma çekirdeği",
    description: "Üretim, taşıma, kaldırma, geçici durum, montaj ve saha revizyonlarını proje kaydıyla ilişkilendirir.",
    problem: "Yapım sırasında değişen mühendislik durumlarının nihai modelin dışında kalmasını önler.",
    capabilities: ["Program ve saha kaydı", "Karar ve revizyon takibi", "Dijital teslim bağlantısı"],
    lastUpdated: "Ağustos 2026",
    validationStatus: "Çalışan Proje OS kayıtları aktif; yapım aşaması kontrol ve entegrasyon kapsamı geliştiriliyor.",
    dependencies: ["05", "10", "11", "12"],
    connectedModules: ["05", "10", "11", "12"],
    inputs: ["Eleman ve bağlantı verisi", "Yapım programı", "Saha ve revizyon kayıtları"],
    process: ["Yapım durumlarını sıralı kayda dönüştürür", "Saha değişikliğini proje omurgasına geri bağlar"],
    connections: ["05 Prefabrik Betonarme", "10 Detay ve İmalat", "12 Doğrulama ve İzlenebilirlik"],
    outputs: ["Aşama bazlı durum kaydı", "Saha karar listesi", "Teslim ve revizyon izi"],
    recentUpdates: ["Proje OS çalışma alanı yapım ve saha modülünün aktif rotası olarak bağlandı.", "Üretimden nihai sisteme yapım aşamaları tek kapsam altında toplandı."],
    workingRoute: "/proje-os#proje-os-motoru",
    boundary: "Çalışan işlev saha talimatı, iş güvenliği kararı veya yetkili montaj kontrolü yerine geçmez.",
  },
] as const;

type ModuleAcceptanceProfile = {
  status: ArkemXModuleStatus;
  developmentNote: string;
  engineeringValidation: ArkemXRuntimeAcceptance["engineeringValidation"];
  evidence: string;
};

const moduleAcceptanceProfiles: Record<string, ModuleAcceptanceProfile> = {
  "proje-modeli": {
    status: "AKTİF · GELİŞTİRİLİYOR",
    developmentNote: "Plan, aks, eleman ve proje oturumu işlevleri çalışır durumda; ortak veri sözleşmesi genişletiliyor.",
    engineeringValidation: "kısmi",
    evidence: "Plan düzenleyici rotası, girdi/çıktı sözleşmeleri ve regresyon testleri",
  },
  "yapisal-analiz": {
    status: "DOĞRULANIYOR",
    developmentNote: "Kavramsal ön tasarım akışı çalışır durumda; benchmark ve yönetmelik doğrulaması tamamlanmadan nihai analiz olarak sunulmaz.",
    engineeringValidation: "kısmi",
    evidence: "Taşıyıcı ön tasarım rotası, yapısal stüdyo hesap testleri ve açık kullanım sınırı",
  },
  "deprem-muhendisligi": {
    status: "DOĞRULANIYOR",
    developmentNote: "Deprem girdisi, spektral talep göstergesi ve hesap izi çalışır durumda; nihai deprem hesabı ve benchmark seti doğrulanıyor.",
    engineeringValidation: "kısmi",
    evidence: "Taşıyıcı stüdyo deprem girdileri, spektral talep çıktısı ve modül bazlı regresyon testi",
  },
  betonarme: {
    status: "DOĞRULANIYOR",
    developmentNote: "Betonarme ön boyutlandırma ve kavramsal miktar çıktısı çalışır durumda; eleman ve yönetmelik kontrolleri doğrulanıyor.",
    engineeringValidation: "kısmi",
    evidence: "Taşıyıcı stüdyo betonarme girdileri, ön boyut/miktar çıktıları ve modül bazlı regresyon testi",
  },
  "prefabrik-betonarme": {
    status: "DOĞRULANIYOR",
    developmentNote: "Prefabrik sistem karşılaştırması çalışır durumda; bağlantı ve yapım aşaması doğrulaması tamamlanmadan nihai tasarım olarak sunulmaz.",
    engineeringValidation: "kısmi",
    evidence: "Sistem karşılaştırma rotası, lojistik/montaj girdileri ve gerekçeli karar çıktısı",
  },
  "yapisal-celik": {
    status: "DOĞRULANIYOR",
    developmentNote: "Çelik ön boyutlandırma ve kavramsal tonaj çıktısı çalışır durumda; stabilite, birleşim ve imalat doğrulaması tamamlanmadan nihai tasarım olarak sunulmaz.",
    engineeringValidation: "kısmi",
    evidence: "Taşıyıcı stüdyo çelik girdileri, ön boyut/tonaj çıktıları ve modül bazlı regresyon testi",
  },
  "hafif-celik": {
    status: "DOĞRULANIYOR",
    developmentNote: "Hafif çelik sistem karşılaştırması çalışır durumda; panel, profil ve bağlantı doğrulaması tamamlanıyor.",
    engineeringValidation: "kısmi",
    evidence: "Sistem karşılaştırma rotası, hafif çelik ölçütleri ve gerekçeli karar çıktısı",
  },
  "hibrit-sistemler": {
    status: "DOĞRULANIYOR",
    developmentNote: "Hibrit ön boyutlandırma ve arayüz risk kaydı çalışır durumda; bütünleşik çözüm ve yük aktarımı doğrulaması tamamlanmadan nihai tasarım olarak sunulmaz.",
    engineeringValidation: "kısmi",
    evidence: "Taşıyıcı stüdyo hibrit girdileri, ön boyut/miktar/arayüz çıktıları ve modül bazlı regresyon testi",
  },
  "temel-zemin": {
    status: "DOĞRULANIYOR",
    developmentNote: "Üstyapı talebi ile kullanıcı kaynaklı zemin taşıma girdisinin ön karşılaştırması çalışır durumda; geoteknik rapor, temel modeli ve oturma doğrulaması tamamlanmadan tasarım olarak sunulmaz.",
    engineeringValidation: "kısmi",
    evidence: "Koordinasyon stüdyosu zemin girdisi, temel basınç/kullanım çıktısı ve modül bazlı regresyon testi",
  },
  "detay-imalat": {
    status: "AKTİF · GELİŞTİRİLİYOR",
    developmentNote: "3B model inceleme ve teknik not akışı çalışır durumda; imalat veri sözleşmesi genişletiliyor.",
    engineeringValidation: "kısmi",
    evidence: "3B model inceleme rotası, inceleme girdileri ve teknik kayıt çıktısı",
  },
  "metraj-maliyet": {
    status: "DOĞRULANIYOR",
    developmentNote: "Kavramsal miktar çıktısı çalışır durumda; kesin metraj, birim fiyat ve maliyet entegrasyonu doğrulanıyor.",
    engineeringValidation: "kısmi",
    evidence: "Taşıyıcı ön tasarım rotası, miktar özeti ve yapısal stüdyo regresyon testleri",
  },
  "dogrulama-izlenebilirlik": {
    status: "AKTİF · GELİŞTİRİLİYOR",
    developmentNote: "Kaynak, konu, revizyon ve teslim izi çalışır durumda; benchmark kapsamı genişletiliyor.",
    engineeringValidation: "kısmi",
    evidence: "Koordinasyon rotası, issue/revizyon girdileri ve izlenebilir paket çıktısı",
  },
  "yapim-saha": {
    status: "DOĞRULANIYOR",
    developmentNote: "Program, saha kararı ve teslim kayıtları çalışır durumda; yapım aşaması entegrasyonunun mühendislik doğrulaması tamamlanıyor.",
    engineeringValidation: "kısmi",
    evidence: "Proje OS rotası, program/saha girdileri ve teslim-revizyon çıktısı",
  },
};

// Wix CMS ArkemXModules kaydındaki 11 Ağustos 2026 çalışırlık kabul alanlarının
// yayın anlık görüntüsü. Statü ile işlev kabulü aynı şey değildir: DOĞRULANIYOR
// durumundaki bir modülün temel işlev kapısı henüz kapalı olabilir.
const coreFunctionAcceptedModuleIds = new Set([
  "proje-modeli",
  "yapisal-analiz",
  "prefabrik-betonarme",
  "hafif-celik",
  "detay-imalat",
  "metraj-maliyet",
  "dogrulama-izlenebilirlik",
  "yapim-saha",
  "deprem-muhendisligi",
  "betonarme",
  "yapisal-celik",
  "temel-zemin",
  "hibrit-sistemler",
]);

const runtimeAcceptance = (
  moduleId: string,
  profile: ModuleAcceptanceProfile,
): ArkemXRuntimeAcceptance => {
  const coreFunctionAccepted = coreFunctionAcceptedModuleIds.has(moduleId);
  return {
    checkedAt: "2026-08-11",
    routeOpens: true,
    acceptsCoreInput: coreFunctionAccepted,
    runsCoreProcess: coreFunctionAccepted,
    producesMeaningfulOutput: coreFunctionAccepted,
    criticalErrorFree: true,
    minimumRegression: coreFunctionAccepted,
    engineeringValidation: profile.engineeringValidation,
    evidence: profile.evidence,
  };
};

export const arkemXModuleRegistry: readonly ArkemXModuleRegistryItem[] = arkemXModuleDefinitions.map((module) => {
  const profile = moduleAcceptanceProfiles[module.id];
  if (!profile) throw new Error(`ARKEMX modül kabul kaydı eksik: ${module.id}`);
  const seoDescription = "seoDescription" in module
    ? module.seoDescription
    : `ARKEMX ${module.title} modülü; ${module.description.charAt(0).toLocaleLowerCase("tr-TR")}${module.description.slice(1)}`;
  return {
    ...module,
    seoDescription,
    status: profile.status,
    webVisible: true,
    developmentNote: profile.developmentNote,
    runtimeAcceptance: runtimeAcceptance(module.id, profile),
  };
});

export const arkemXDevelopmentJournal = [
  {
    period: "AĞUSTOS 2026",
    title: "Çalışan modüller merkezi kayda bağlandı.",
    summary: "13 müşteri modülünün durum, sürüm, kullanım sınırı ve erişim bilgisi tek registry içinde birleştirildi; yalnız kabulü geçen rotalar çalışan işlev olarak sunuldu.",
  },
  {
    period: "AĞUSTOS 2026",
    title: "Çalışırlık ile mühendislik doğrulaması ayrıştırıldı.",
    summary: "Doğrulama kapıları tamamlanmayan modüller DOĞRULANIYOR veya GELİŞTİRME PROGRAMINDA statülerine ayrıldı; çalışan işlev kabulü ayrı kaydedildi.",
  },
  {
    period: "AĞUSTOS 2026",
    title: "Regresyon ilkesi sürüm sözleşmesine eklendi.",
    summary: "Yeni geliştirmelerin aktif işlevleri kapatmaması; çalışan rotalar, testler ve görünür kullanım sınırlarıyla korunacak şekilde kayıt altına alındı.",
  },
] as const;

export const arkemXRoadmap = [
  {
    stage: "ŞİMDİ",
    summary: "Çalışan işlevleri korumak, registry ile web durumunu senkron tutmak ve regresyon kapsamını genişletmek.",
  },
  {
    stage: "SONRAKİ GELİŞİM",
    summary: "Modül doğrulama setlerini, ortak proje veri sözleşmelerini ve CMS üzerinden yönetilen güncelleme kayıtlarını geliştirmek.",
  },
  {
    stage: "UZUN VADELİ",
    summary: "Yetkili doğrulama kapıları tamamlanan modülleri ortak proje omurgasında daha derin ve kontrollü biçimde bütünleştirmek.",
  },
] as const;

export const arkemXRegistryMeta = {
  name: "ARKEMX MODULE REGISTRY",
  version: "v0.4",
  updatedAt: "2026-08-11",
  source: "Wix CMS / ArkemXModules",
  syncState: "11 Ağustos 2026 doğrulanmış registry anlık görüntüsü",
  moduleCount: arkemXModuleRegistry.length,
  groupCount: arkemXModuleGroups.length,
} as const;
