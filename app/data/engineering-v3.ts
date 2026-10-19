export const ENGINEERING_CAPABILITY_IDS = [
  "tasiyici-sistem",
  "statik-analiz",
  "deprem-muhendisligi",
  "uygulama-projeleri",
  "imalat-cizimleri",
  "bim",
  "deger-muhendisligi",
  "saha",
] as const;

export type EngineeringCapabilityId = typeof ENGINEERING_CAPABILITY_IDS[number];

export type EngineeringCapability = {
  id: EngineeringCapabilityId;
  no: string;
  title: string;
  summary: string;
  input: string;
  decision: string;
  output: string;
  evidenceNeeded: string;
};

export const engineeringCapabilities: readonly EngineeringCapability[] = [
  {
    id: "tasiyici-sistem",
    no: "01",
    title: "Taşıyıcı Sistem Tasarımı",
    summary: "Yapı kullanımını, açıklıkları, yükleri, zemin verisini, üretim imkânını ve montaj koşullarını birlikte değerlendirir.",
    input: "İhtiyaç programı, mimari geometri, zemin, yükler, üretim ve saha sınırları.",
    decision: "Alternatif taşıyıcı düzenlerin davranış, üretilebilirlik ve yapım sırası açısından karşılaştırılması.",
    output: "Gerekçeli sistem kararı, ön boyutlar, kritik arayüzler ve doğrulama planı.",
    evidenceNeeded: "Onaylı sistem kararı, hesap modeli veya imzalı proje paftası.",
  },
  {
    id: "statik-analiz",
    no: "02",
    title: "Statik Analiz",
    summary: "Taşıyıcı sistem davranışını yük, iç kuvvet, deplasman, stabilite ve deprem etkileri üzerinden inceler.",
    input: "Analitik model, malzeme, mesnet, yükleme ve kombinasyon kabulleri.",
    decision: "Yük aktarımının, iç kuvvetlerin, deplasmanların ve stabilitenin mühendislik sınırları içinde değerlendirilmesi.",
    output: "Kaynağı izlenebilir analiz sonuçları, kontrol listesi ve tasarım girdileri.",
    evidenceNeeded: "İmzalı hesap raporu, analiz modeli ve kontrol edilen kombinasyon kaydı.",
  },
  {
    id: "deprem-muhendisligi",
    no: "03",
    title: "Deprem Mühendisliği",
    summary: "Yalnız eleman dayanımını değil; taşıyıcı sistemin bütünsel deprem davranışını ve düzensizliklerini değerlendirir.",
    input: "Yerel zemin ve deprem verileri, taşıyıcı sistem modeli, kütle ve rijitlik dağılımı.",
    decision: "Modal davranış, ötelenme, düzensizlik ve sistem sünekliğinin ilgili proje koşullarıyla birlikte incelenmesi.",
    output: "Deprem tasarım kabulleri, sistem kontrolleri ve gerekli proje revizyonları.",
    evidenceNeeded: "Deprem hesap özeti, spektrum kaynağı ve imzalı kontrol paftası.",
  },
  {
    id: "uygulama-projeleri",
    no: "04",
    title: "Uygulama Projeleri",
    summary: "Analiz kararlarını uygulama ve disiplin koordinasyonuna aktarılabilir teknik belgelere dönüştürür.",
    input: "Doğrulanmış analiz sonuçları, mimari ve disiplin modelleri, mevzuat ve proje kararları.",
    decision: "Eleman, kesit, birleşim, donatı ve disiplin geçişlerinin sahada okunabilir düzeyde çözülmesi.",
    output: "Revizyonlu uygulama paftaları, kesitler, detaylar ve kontrol notları.",
    evidenceNeeded: "İmzalı uygulama paftası, revizyon kaydı ve teknik kontrol onayı.",
  },
  {
    id: "imalat-cizimleri",
    no: "05",
    title: "İmalat Çizimleri",
    summary: "Eleman, birleşim, tolerans ve üretim gereksinimlerini okunabilir imalat verisi olarak düzenler.",
    input: "Onaylı uygulama projesi, üretici olanakları, toleranslar ve parça kimlikleri.",
    decision: "Geometri, bağlantı, gömülü parça ve üretim sırasının imalat gerçekliğiyle eşleştirilmesi.",
    output: "İmalat paftaları, eleman listeleri, parça kodları ve üretim kontrol noktaları.",
    evidenceNeeded: "Onaylı imalat paftası, üretim listesi veya fabrika kabul kaydı.",
  },
  {
    id: "bim",
    no: "06",
    title: "BIM ve Koordinasyon",
    summary: "Mimari, taşıyıcı, tesisat ve saha kararlarını ortak koordinat, eleman kimliği ve revizyon kaydında birleştirir.",
    input: "Disiplin modelleri, aks ve kot sistemi, eleman kimlikleri ve güncel revizyonlar.",
    decision: "Çakışma, açıklık, şaft, bağlantı ve montaj arayüzlerinin sorumlu ve tarihle kayıt altına alınması.",
    output: "Koordinasyon modeli, konu kaydı, revizyon izi ve disiplin teslim paketi.",
    evidenceNeeded: "Tarihli model manifestosu, koordinasyon raporu veya onaylı konu kaydı.",
  },
  {
    id: "deger-muhendisligi",
    no: "07",
    title: "Değer Mühendisliği",
    summary: "Alternatif sistemleri ilk yatırım bedeliyle sınırlamadan süre, üretim, lojistik, risk ve yaşam döngüsü etkileriyle karşılaştırır.",
    input: "Aynı ihtiyaç programı, sistem alternatifleri, süre, tedarik, lojistik ve maliyet kabulleri.",
    decision: "Alternatiflerin ortak kapsam ve açık varsayımlar altında karşılaştırılması.",
    output: "Karar matrisi, kabul ve riskler, kapsam sınırı ve önerilen sonraki doğrulama.",
    evidenceNeeded: "Onaylı karşılaştırma matrisi, karar tutanağı veya revizyon gerekçesi.",
  },
  {
    id: "saha",
    no: "08",
    title: "Saha Mühendisliği",
    summary: "Uygulama sorunlarını proje verisine geri bağlar; değişiklik, kalite, onay ve kapanış izini korur.",
    input: "Güncel paftalar, saha koşulları, kalite kayıtları, RFI ve revizyon talepleri.",
    decision: "Uygulama sapması ve değişikliğin taşıyıcı sistem, detay ve sorumluluk sınırına etkisinin değerlendirilmesi.",
    output: "Saha kararı, revizyon, kontrol tutanağı ve kapanış kaydı.",
    evidenceNeeded: "Saha günlüğü, fotoğraf, tutanak, RFI veya onaylı kapanış belgesi.",
  },
];
