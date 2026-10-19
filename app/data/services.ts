export type Service = {
  slug: string;
  no: string;
  title: string;
  shortTitle: string;
  summary: string;
  lead: string;
  punchline: string;
  image: string;
  imageAlt: string;
  secondaryImage: string;
  secondaryImageAlt: string;
  highlights: string[];
  items: string[];
  deliverables: string[];
  audiences: string[];
  process: { title: string; description: string }[];
  faqs: { question: string; answer: string }[];
};

export const services: Service[] = [
  {
    slug: "projelendirme", no: "01", title: "Projelendirme", shortTitle: "Mühendislik ve Projelendirme",
    punchline: "Fikri; hesaplanabilir, üretilebilir ve sahada uygulanabilir projeye dönüştürüyoruz.",
    image: "/visuals/projelendirme.webp",
    imageAlt: "Statik proje, BIM modeli ve teknik çizimlerin birlikte geliştirildiği temsili mühendislik sahnesi",
    secondaryImage: "/portfolio/bim-engineering.webp",
    secondaryImageAlt: "BIM ve statik proje koordinasyonunu gösteren temsili Arkem çalışması",
    highlights: ["Statik Tasarım", "BIM Koordinasyonu", "İmalat Detayı"],
    summary: "Mimari fikirden ruhsat, uygulama ve imalat projelerine kadar tüm teknik disiplinlerin koordinasyonu.",
    lead: "Yapının mimari, statik, mekanik ve elektrik kararlarını tek teknik yönetim altında birleştiriyor; ruhsata, üretime ve sahaya aktarılabilir eksiksiz proje setleri hazırlıyoruz.",
    items: ["Mimari ön tasarım ve avan proje", "Betonarme, prefabrik, çelik ve hafif çelik statik proje", "Mekanik ve elektrik proje koordinasyonu", "Zemin etüdü, harita ve aplikasyon koordinasyonu", "Ruhsat projesi ve resmî kurum dosyaları", "Uygulama, imalat ve birleşim detayları", "3B modelleme, görselleştirme ve VR sunumu"],
    deliverables: ["Sözleşme kapsamına göre hazırlanan proje paftaları", "Statik hesap raporları", "Uygulama ve imalat detayları", "Disiplinlerarası çakışma kontrolleri", "Ruhsat başvuru dokümanları; kurum onayı ayrıca yürütülür"],
    audiences: ["Arsa sahipleri", "Yatırımcılar", "Müteahhitler", "Mimarlık ofisleri", "Sanayi kuruluşları"],
    process: [
      { title: "İhtiyaç ve veri toplama", description: "Arsa, zemin, kullanım, kapasite, mimari beklenti ve hedef takvim birlikte tanımlanır." },
      { title: "Alternatiflerin geliştirilmesi", description: "Taşıyıcı sistem, açıklıklar, malzeme ve yapım yöntemi seçenekleri karşılaştırılır." },
      { title: "Disiplin koordinasyonu", description: "Mimari, statik, mekanik ve elektrik kararları aynı proje verisinde birleştirilir." },
      { title: "Onay ve uygulama seti", description: "Ruhsat, imalat ve saha için gereken pafta, hesap ve detaylar kapsamına göre teslim edilir." },
    ],
    faqs: [
      { question: "Projelendirme başlamadan önce hangi bilgiler gerekir?", answer: "Yapının konumu, kullanım amacı, yaklaşık alanı, kat adedi, varsa mimari çalışma ve mevcut arsa veya zemin verileri başlangıç için yeterlidir. Eksik teknik veriler ilk incelemede ayrıca listelenir." },
      { question: "Mimari ve statik proje birlikte yürütülebilir mi?", answer: "Evet. Mimari kararlarla taşıyıcı sistemin aynı süreçte koordine edilmesi, sonradan oluşabilecek ölçü, açıklık ve uygulama çakışmalarını azaltır." },
      { question: "Hazır bir proje her arsada uygulanabilir mi?", answer: "Hayır. Zemin, deprem ve rüzgâr etkileri, imar koşulları ve kullanım yükleri projeye özeldir. Hazır bir çalışma ancak bu veriler üzerinden kontrol edilip uyarlanarak kullanılmalıdır." },
    ],
  },
  {
    slug: "yapim", no: "02", title: "Yapım", shortTitle: "Üretim, Montaj ve Uygulama",
    punchline: "Projeyi; kontrollü üretim, planlı montaj ve kayıtlı saha yönetimiyle yapıya dönüştürüyoruz.",
    image: "/visuals/yapim.webp",
    imageAlt: "Çelik ve prefabrik elemanların planlı biçimde monte edildiği temsili endüstriyel şantiye",
    secondaryImage: "/portfolio/industrial-steel.webp",
    secondaryImageAlt: "Çelik ve prefabrik endüstriyel yapıyı gösteren temsili Arkem çalışması",
    highlights: ["Üretim", "Montaj", "Saha Yönetimi"],
    summary: "Doğru projeyi kontrollü üretim, planlı tedarik ve güçlü saha organizasyonuyla yapıya dönüştürüyoruz.",
    lead: "Hafif çelik, çelik, betonarme prefabrik, betonarme ve karma sistemlerde üretimden montaja; kaba yapıdan anahtar teslim uygulamaya kadar yapım sürecini yönetiyoruz.",
    items: ["Hafif çelik yapı üretimi ve montajı", "Çelik yapı imalat ve montajı", "Betonarme prefabrik yapı uygulamaları", "Betonarme konut ve ticari yapılar", "Sanayi tesisi, fabrika, depo ve tarımsal yapılar", "Kaba ve ince yapı imalatları", "Satın alma, lojistik ve şantiye yönetimi"],
    deliverables: ["Uygulama iş programı", "Malzeme ve imalat onayları", "Kalite kontrol kayıtları", "Hakediş ve ilerleme raporları", "Teslim ve kullanım dokümanları"],
    audiences: ["Konut yatırımcıları", "Sanayi yatırımcıları", "Müteahhitler", "Arsa sahipleri", "Kurumsal işverenler"],
    process: [
      { title: "Uygulama kapsamı", description: "Proje, mahal listesi, sorumluluklar ve teslim ölçütleri yazılı olarak netleştirilir." },
      { title: "Planlama ve tedarik", description: "İş programı, malzeme onayları, üretim sırası, lojistik ve saha hazırlığı planlanır." },
      { title: "Üretim ve montaj", description: "İmalat ve saha uygulaması proje, kalite ve iş güvenliği kontrolleriyle yürütülür." },
      { title: "Kontrol ve teslim", description: "Eksikler, testler, kayıtlar ve teslim belgeleri tamamlanarak yapı kullanıma hazırlanır." },
    ],
    faqs: [
      { question: "Yapım hizmeti anahtar teslim olabilir mi?", answer: "Kapsam; yalnızca taşıyıcı sistem, kaba yapı veya anahtar teslim olacak şekilde proje özelinde tanımlanabilir. Dahil ve hariç işler teklif öncesinde yazılı hale getirilir." },
      { question: "Hafif çelik ve ağır çelik yapım arasında nasıl karar verilir?", answer: "Yapının açıklıkları, kat adedi, yükleri, mimari hedefi, üretim olanakları ve saha koşulları birlikte değerlendirilir. Sistem seçimi yalnızca metrekare fiyatına göre yapılmaz." },
      { question: "İş programı ne zaman oluşturulur?", answer: "Onaylı proje, kapsam, tedarik süreleri ve saha teslim koşulları netleştikten sonra uygulanabilir iş programı hazırlanır ve kritik karar tarihleri belirlenir." },
    ],
  },
  {
    slug: "danismanlik", no: "03", title: "Danışmanlık", shortTitle: "Teknik ve Yatırım Danışmanlığı",
    punchline: "Teknik, mali ve operasyonel veriyi aynı karar tablosunda görünür kılıyoruz.",
    image: "/visuals/danismanlik.webp",
    imageAlt: "Yapı sistemi, maliyet ve proje risklerini birlikte değerlendiren temsili danışmanlık çalışması",
    secondaryImage: "/portfolio/commercial-social-facility.webp",
    secondaryImageAlt: "Ticari ve sosyal yapı sistemi alternatiflerini gösteren temsili Arkem çalışması",
    highlights: ["Fizibilite", "Maliyet ve Risk", "İşveren Temsili"],
    summary: "Yatırım kararlarını teknik, ekonomik ve hukuki süreçlerle uyumlu, ölçülebilir verilere dayandırıyoruz.",
    lead: "Yapıya başlamadan önce doğru sistemi, gerçekçi maliyeti ve proje risklerini görünür kılıyor; yatırım boyunca işverenin teknik tarafını temsil ediyoruz.",
    items: ["Ön fizibilite ve yapı sistemi karşılaştırması", "Detaylı metraj, keşif ve maliyet analizi", "İhale, teklif ve teknik şartname hazırlığı", "Ruhsat ve resmî kurum süreçleri koordinasyonu", "Proje yönetimi ve işveren temsilciliği", "Şantiye teknik kontrollüğü ve hakediş incelemesi", "Enerji performansı ve akustik proje danışmanlığı"],
    deliverables: ["Fizibilite raporu", "Karşılaştırmalı sistem analizi", "Metraj ve maliyet tabloları", "Teknik değerlendirme raporları", "Kontrol ve ilerleme raporları"],
    audiences: ["Yatırımcılar", "Arsa sahipleri", "Finans kuruluşları", "Müteahhitler", "Kurumsal işverenler"],
    process: [
      { title: "Karar sorusunu tanımlama", description: "Yatırımcının çözmek istediği teknik, mali veya operasyonel konu açıkça tarif edilir." },
      { title: "Veri ve saha incelemesi", description: "Projeler, teklifler, mevcut kayıtlar ve gerektiğinde saha koşulları birlikte incelenir." },
      { title: "Karşılaştırmalı analiz", description: "Alternatifler kapsam, maliyet, süre, risk ve uygulanabilirlik üzerinden değerlendirilir." },
      { title: "Rapor ve yol haritası", description: "Bulgular, eksikler, öncelikler ve önerilen sonraki adımlar karar verilebilir biçimde sunulur." },
    ],
    faqs: [
      { question: "Danışmanlık yalnızca proje başlangıcında mı alınır?", answer: "Hayır. Arsa ve fizibilite aşamasından ihale değerlendirmesine, devam eden şantiyenin teknik kontrolünden mevcut yapı incelemesine kadar farklı aşamalarda hizmet verilebilir." },
      { question: "Farklı firmalardan gelen teklifler karşılaştırılabilir mi?", answer: "Evet. Önce teklif kapsamları teknik olarak eşitlenir; ardından malzeme, metraj, süre, hariç işler, garanti ve teslim koşulları birlikte incelenir." },
      { question: "Danışmanlık raporu kesin yapım maliyeti verir mi?", answer: "Çalışmanın seviyesine göre yaklaşık veya detaylı maliyet analizi hazırlanabilir. Kesin bedel; onaylı proje, şartname, piyasa teklifleri ve sözleşme kapsamı netleştiğinde oluşur." },
    ],
  },
  {
    slug: "patlatmali-bina-yikimi", no: "04", title: "Patlatmalı Bina Yıkımı", shortTitle: "Kontrollü Patlatmalı Yıkım",
    punchline: "Yıkım anını değil; yapı analizinden saha teslimine kadar bütün güvenlik zincirini planlıyoruz.",
    image: "/visuals/kontrollu-yikim.webp",
    imageAlt: "Güvenlik çevresi ve çevresel tedbirlerle yönetilen temsili kontrollü yıkım mühendisliği sahnesi",
    secondaryImage: "/portfolio/controlled-demolition.webp",
    secondaryImageAlt: "Kontrollü yıkım öncesi güvenlik ve mühendislik hazırlığını gösteren temsili çalışma",
    highlights: ["Yapısal Analiz", "Emniyet Planı", "Saha Koordinasyonu"],
    summary: "Yapı, çevre ve saha koşullarına göre planlanan; izin, emniyet ve uygulama süreçleri birlikte yönetilen kontrollü yıkım hizmeti.",
    lead: "Yüksek veya hacimli yapıların patlatmalı yıkımını; yapısal analiz, çevresel risk değerlendirmesi, resmî izinler, uzman ekip koordinasyonu ve saha güvenliği çerçevesinde planlıyoruz.",
    items: ["Yapısal inceleme ve yıkılabilirlik değerlendirmesi", "Yıkım yöntemi ve devrilme yönü mühendisliği", "Çevre yapı, altyapı ve güvenlik risk analizi", "İzin, bildirim ve kurum koordinasyonu", "Yetkili patlayıcı madde uzmanı ve uygulama ekibi koordinasyonu", "Titreşim, toz, gürültü ve çevresel etki planlaması", "Enkaz kaldırma ve saha teslim organizasyonu"],
    deliverables: ["Yıkım mühendisliği raporu", "Risk ve emniyet planı", "Uygulama organizasyon planı", "Çevresel tedbirler dosyası", "Yıkım sonrası saha teslim kaydı"],
    audiences: ["Kamu kurumları", "Kentsel dönüşüm yatırımcıları", "Sanayi kuruluşları", "Müteahhitler", "Yapı sahipleri"],
    process: [
      { title: "Yapı ve çevre incelemesi", description: "Taşıyıcı sistem, yapı durumu, komşuluklar, altyapı ve saha erişimi değerlendirilir." },
      { title: "Yöntem ve risk kararı", description: "Patlatmalı yöntemin uygunluğu alternatif yıkım yöntemleriyle birlikte mühendislik açısından incelenir." },
      { title: "İzin ve emniyet planı", description: "Yetkili uzmanlar, kurum süreçleri, güvenlik çevresi ve çevresel tedbirler koordine edilir." },
      { title: "Uygulama ve saha teslimi", description: "Onaylı plan doğrultusunda saha yönetilir; uygulama sonrası güvenlik ve teslim kontrolleri tamamlanır." },
    ],
    faqs: [
      { question: "Her bina patlatmalı yöntemle yıkılabilir mi?", answer: "Hayır. Taşıyıcı sistem, yapı durumu, çevre yapılar, altyapı, güvenlik mesafeleri ve resmî gereklilikler incelenmeden yöntem kararı verilemez." },
      { question: "Patlatmalı yıkım için hangi uzmanlıklar gerekir?", answer: "Yapı mühendisliği, yetkili patlayıcı madde uzmanlığı, iş güvenliği, çevresel kontrol ve saha operasyonu tek bir onay ve iletişim planında koordine edilmelidir." },
      { question: "Titreşim, toz ve çevre etkileri nasıl yönetilir?", answer: "Projeye özel risk değerlendirmesiyle ölçüm, güvenlik çevresi, parçacık kontrolü, toz bastırma, trafik ve acil durum tedbirleri uygulama öncesinde planlanır." },
    ],
  },
];

export const getService = (slug: string) => services.find((service) => service.slug === slug)!;
