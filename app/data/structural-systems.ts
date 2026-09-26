import type { V3ProjectFact } from "./projects-v3";

export type StructuralSystem = {
  id: "light" | "steel" | "precast" | "concrete" | "hybrid";
  slug: string;
  no: string;
  name: string;
  shortName: string;
  eyebrow: string;
  summary: string;
  lead: string;
  description: string;
  image: string;
  imageAlt: string;
  overview: string[];
  suitableFor: string[];
  strengths: string[];
  watchouts: string[];
  designInputs: string[];
  process: { title: string; description: string }[];
  faqs: { question: string; answer: string }[];
  relatedServices: { title: string; description: string; href: string }[];
};

export const structuralSystems: StructuralSystem[] = [
  {
    id: "light",
    slug: "hafif-celik",
    no: "01",
    name: "Hafif Çelik Yapı Sistemi",
    shortName: "Hafif Çelik",
    eyebrow: "Düşük Ağırlık · Kontrollü Üretim",
    summary: "Az katlı konut, villa ve tekrarlı modüllerde hassas üretim ile hızlı kuru montaj olanağı sunan taşıyıcı sistem.",
    lead: "Hafif çelik; statik modelden üretim paftasına, temel ankrajından duvar katmanlarına kadar aynı veri zinciriyle yönetildiğinde güçlü ve öngörülebilir bir yapı çözümüne dönüşür.",
    description: "Hafif çelik yapı sistemi nedir, hangi projelere uygundur? Tasarım girdileri, avantajlar, kritik detaylar ve Arkem çalışma süreci.",
    image: "/portfolio/light-steel-house.webp",
    imageAlt: "Hafif çelik konut taşıyıcı sistemi için temsili Arkem çalışması",
    overview: [
      "Hafif çelik sistemde ince cidarlı galvanizli profiller, duvar ve döşeme panelleri içinde birlikte çalışacak şekilde modellenir. Düşük yapı ağırlığı ve sayısal üretim olanağı; nakliye, temel etkileri ve saha takvimi bakımından önemli seçenekler yaratabilir.",
      "Sistemin gerçek performansı yalnızca profil kalınlığıyla açıklanamaz. Yük aktarım yolu, çaprazlar, birleşimler, ankrajlar, kaplama katmanları ve yapı fiziği kararları tek bir mühendislik bütünü olarak ele alınmalıdır.",
    ],
    suitableFor: ["Az katlı konut ve villa projeleri", "Tekrarlı konut veya sosyal tesis modülleri", "Hafif ek kat ve genişleme çalışmaları", "Kuru montajın ve kontrollü üretimin öncelikli olduğu yapılar"],
    strengths: ["Düşük taşıyıcı sistem ağırlığı", "Sayısal modelden kontrollü üretime geçiş", "Kuru ve aşamalı saha montajı", "Tekrarlı modüllerde üretim verimliliği", "Tesisat ve kaplama katmanlarıyla koordinasyon esnekliği"],
    watchouts: ["Isı köprüleri ile yoğuşma riskinin katman bazında çözülmesi", "Yangın ve akustik hedeflerin belgeli sistemlerle tanımlanması", "Temel, su basmanı ve ankraj toleranslarının kontrolü", "Kesim, delik ve galvaniz kaplama hasarlarında korozyon koruması", "İmalat ve montaj paftalarının aynı statik modelle izlenmesi"],
    designInputs: ["Zemin ve temel verileri", "Mimari plan, açıklıklar ve kat adedi", "Kullanım yükleri ile deprem ve rüzgâr etkileri", "Isı, su, buhar, ses ve yangın performansı hedefleri", "Üretim, nakliye ve montaj sınırları", "Kaplama, tesisat ve sabit yük kararları"],
    process: [
      { title: "İhtiyaç ve veri analizi", description: "Arsa, kullanım programı, kat adedi, iklim ve teslim hedefleri birlikte tanımlanır." },
      { title: "Taşıyıcı sistem modeli", description: "Yükler, paneller, çaprazlar, döşemeler ve temel etkileşimi bütüncül olarak çözülür." },
      { title: "Üretim ve detay koordinasyonu", description: "Profil listeleri, birleşimler, ankrajlar ve yapı fiziği katmanları uygulamaya hazırlanır." },
      { title: "Saha kontrolü ve teslim", description: "Temel ölçüsü, montaj sırası, kalite kayıtları ve teslim belgeleri izlenir." },
    ],
    faqs: [
      { question: "Hafif çelik ev her arsaya uygulanabilir mi?", answer: "Her arsa ve proje ayrı değerlendirilir. Zemin, iklim, imar koşulları, kat adedi, mimari açıklıklar ve lojistik olanaklar çözümü doğrudan etkiler." },
      { question: "Hafif çelik yapıda teklifleri nasıl karşılaştırmalıyım?", answer: "Aynı mimari ve teknik şartname üzerinden; proje, temel, üretim, nakliye, montaj, kaplamalar, tesisat ve teslim belgeleri dahil-hariç listesiyle karşılaştırmak gerekir." },
      { question: "Isı ve ses yalıtımı taşıyıcı sistemle birlikte mi çözülür?", answer: "Evet. Taşıyıcı profil, kaplama, yalıtım, su ve buhar kontrol katmanları birlikte detaylandırılmalıdır. Tek bir malzeme değeri bütün duvar performansını açıklamaz." },
      { question: "Hazır proje doğrudan uygulanabilir mi?", answer: "Hazır plan önemli bir başlangıçtır; ancak statik sistem, temel, iklim ve ruhsat belgeleri uygulama yapılacak yere ve güncel proje verilerine göre doğrulanmalıdır." },
    ],
    relatedServices: [
      { title: "Projelendirme", description: "Statik model, uygulama ve üretim paftalarını tek veri zincirinde hazırlayın.", href: "/hizmetler/projelendirme" },
      { title: "Yapım", description: "Üretim, lojistik, montaj ve kalite sürecini bütünleşik yönetin.", href: "/hizmetler/yapim" },
      { title: "Hazır Projeler", description: "Satışa hazırlanmakta olan hafif çelik proje paketlerini inceleyin.", href: "/hazir-projeler" },
    ],
  },
  {
    id: "steel",
    slug: "celik",
    no: "02",
    name: "Yapısal Çelik Yapı Sistemi",
    shortName: "Yapısal Çelik",
    eyebrow: "Büyük Açıklık · Esnek Geometri",
    summary: "Sanayi, depo ve geniş açıklıklı yapılarda yüksek uyarlanabilirlik ve kontrollü imalat olanağı sunan sistem.",
    lead: "Yapısal çelik; geniş açıklık, ağır kullanım yükleri ve gelecekte büyüme beklentisi bulunan yatırımlarda güçlü bir adaydır. Sonuç, kesit kadar birleşim ve üretim kalitesine de bağlıdır.",
    description: "Yapısal çelik sistemlerin kullanım alanları, avantajları, tasarım girdileri, kritik detayları ve Arkem mühendislik süreci.",
    image: "/portfolio/industrial-steel.webp",
    imageAlt: "Geniş açıklıklı yapısal çelik endüstriyel yapı için temsili Arkem çalışması",
    overview: [
      "Çelik kolon, kiriş, makas ve çaprazların oluşturduğu taşıyıcı sistem; büyük açıklıkları daha az ara taşıyıcıyla geçme ve üretimi saha dışında kontrol etme olanağı sağlayabilir. Bu nitelikler üretim tesisi, depo, hangar ve ticari yapılarda esnek planlama avantajı yaratır.",
      "Güvenilir bir çözüm için eleman stabilitesi, birleşimler, deprem davranışı, yangın ve korozyon koruması ile montaj senaryosu birlikte tasarlanır. Yapı, yalnızca tamamlanmış hâliyle değil kurulum aşamalarıyla da değerlendirilir.",
    ],
    suitableFor: ["Fabrika, üretim tesisi ve depolar", "Geniş açıklıklı hangar ve spor yapıları", "Ticari ve sosyal tesisler", "Gelecekte büyüme veya kullanım değişikliği beklenen yapılar"],
    strengths: ["Büyük açıklık ve yüksek geometrik esneklik", "Kontrollü atölye imalatı", "Hızlı ve planlanabilir montaj potansiyeli", "Gelecekte ekleme ve uyarlamaya elverişli çözümler", "Yüksek dayanım / ağırlık oranı"],
    watchouts: ["Burkulma ve ikinci mertebe etkilerinin doğru modellenmesi", "Birleşim rijitliği ve yük aktarım detayları", "Yangın dayanımı hedefi ve koruyucu sistem seçimi", "Korozyon ortamına uygun yüzey koruması ve bakım planı", "Parça ölçüsü, nakliye, vinç erişimi ve montaj stabilitesi"],
    designInputs: ["Açıklık, aks düzeni ve net yükseklik", "Sabit, hareketli, ekipman ve vinç yükleri", "Deprem, rüzgâr ve zemin verileri", "Üretim kapasitesi ve birleşim tercihleri", "Yangın ve korozyon çevre koşulları", "Nakliye güzergâhı ve montaj ekipmanı"],
    process: [
      { title: "Yatırım senaryosu", description: "Kullanım, açıklık, ekipman, büyüme ve saha kısıtları sayısal girdilere dönüştürülür." },
      { title: "Alternatif sistem kurgusu", description: "Çerçeve, makas, çapraz ve karma seçenekler ön boyutlandırma ile karşılaştırılır." },
      { title: "Detay ve imalat hazırlığı", description: "Birleşimler, üretim paftaları, metraj ve montaj sırası koordineli biçimde geliştirilir." },
      { title: "Üretim ve saha yönetimi", description: "İmalat kontrolü, sevkiyat, kaldırma planı ve montaj kalite kayıtları takip edilir." },
    ],
    faqs: [
      { question: "Çelik yapı her zaman betonarmeden hızlı mıdır?", answer: "Atölye üretimi ve montaj modeli süre avantajı sağlayabilir; ancak proje onayı, malzeme tedariki, lojistik, temel işleri ve saha erişimi toplam programı belirler." },
      { question: "Çelik yapıda yangın güvenliği nasıl ele alınır?", answer: "Yapının kullanımına ve hedeflenen performansa göre kesit, kaplama veya koruyucu ürün çözümü belirlenir. Detaylar belgeli sistemler ve projeye özel değerlendirmeyle geliştirilir." },
      { question: "Korozyon yalnızca boya ile mi çözülür?", answer: "Hayır. Çevresel etki, yüzey hazırlığı, kaplama sistemi, detaylarda su tutma riski, uygulama kalitesi ve bakım erişimi birlikte planlanır." },
      { question: "Çelik ve betonarme sistem birlikte kullanılabilir mi?", answer: "Evet. Betonarme çekirdek, çelik çerçeve veya farklı döşeme çözümleri karma sistem oluşturabilir. Kritik konu iki sistemin arayüz ve deformasyon uyumudur." },
    ],
    relatedServices: [
      { title: "Projelendirme", description: "Sistem seçimi, statik çözüm ve imalat paftalarını birlikte geliştirin.", href: "/hizmetler/projelendirme" },
      { title: "Yapım", description: "Atölye, sevkiyat ve montaj süreçlerini tek teknik yönetimde izleyin.", href: "/hizmetler/yapim" },
      { title: "Danışmanlık", description: "Alternatif sistem, maliyet, süre ve risk kararlarını karşılaştırın.", href: "/hizmetler/danismanlik" },
    ],
  },
  {
    id: "precast",
    slug: "betonarme-prefabrik",
    no: "03",
    name: "Betonarme Prefabrik Yapı Sistemi",
    shortName: "Betonarme Prefabrik",
    eyebrow: "Tekrarlı Aks · Fabrika Üretimi",
    summary: "Tekrarlı taşıyıcı düzen ve endüstriyel üretim avantajını hızlı saha montajıyla birleştiren sistem.",
    lead: "Betonarme prefabrik sistem; aks düzeni, eleman tipleri, birleşimler ve montaj lojistiği erken aşamada netleştirildiğinde sanayi ve depo yatırımlarında güçlü bir program disiplini sağlar.",
    description: "Betonarme prefabrik yapı sistemi; kullanım alanları, avantajlar, deprem birleşimleri, lojistik ve Arkem proje süreci.",
    image: "/portfolio/agricultural-structure.webp",
    imageAlt: "Betonarme prefabrik taşıyıcı sistem için temsili endüstriyel yapı çalışması",
    overview: [
      "Kolon, kiriş, makas, döşeme ve cephe elemanlarının kontrollü fabrika koşullarında üretilip sahada birleştirilmesi; tekrarlı akslara sahip yapılarda üretim ve saha süreçlerinin paralel ilerlemesini mümkün kılabilir.",
      "Prefabrik çözümde erken karar kalitesi kritiktir. Eleman geometrileri, kaldırma noktaları, birleşimler, nakliye sınırları ve gelecekte açılması planlanan boşluklar üretimden önce koordineli biçimde çözülmelidir.",
    ],
    suitableFor: ["Sanayi ve üretim yapıları", "Depo ve lojistik tesisleri", "Tarımsal üretim ve depolama yapıları", "Tekrarlı aks ve modüler plana sahip ticari yapılar"],
    strengths: ["Kontrollü fabrika üretimi", "Tekrarlı elemanlarda verimlilik", "Saha imalatını azaltma potansiyeli", "Üretim ve temel işlerini paralel planlama", "Geniş açıklıklara uygun eleman seçenekleri"],
    watchouts: ["Deprem davranışı ve birleşim sürekliliğinin projelendirilmesi", "Eleman ağırlığına uygun vinç ve montaj planı", "Nakliye güzergâhı ve gabari sınırlamaları", "Üretim öncesi mimari, mekanik ve elektrik boşluk koordinasyonu", "Gelecekteki tadilat ve yeni açıklıkların önceden değerlendirilmesi"],
    designInputs: ["Aks sistemi, açıklıklar ve yapı yüksekliği", "Kullanım, ekipman ve hareketli yükler", "Zemin, temel ve deprem verileri", "Üretici olanakları ve standart eleman geometrileri", "Nakliye ve kaldırma sınırları", "Cephe, çatı ve tesisat bağlantıları"],
    process: [
      { title: "Aks ve modül optimizasyonu", description: "Mimari ihtiyaç, üretim olanakları ve açıklık hedefi ortak taşıyıcı düzende buluşturulur." },
      { title: "Eleman ve birleşim çözümü", description: "Kolon, kiriş, makas, döşeme ve deprem birleşimleri sistem olarak modellenir." },
      { title: "Üretim koordinasyonu", description: "Kalıp, donatı, gömülü parça, boşluk ve kaldırma detayları üretime hazırlanır." },
      { title: "Lojistik ve montaj", description: "Sevkiyat sırası, vinç yerleşimi, geçici stabilite ve saha kalite kontrolleri planlanır." },
    ],
    faqs: [
      { question: "Prefabrik yapı yalnızca fabrikalar için mi uygundur?", answer: "Hayır. Depo, tarımsal tesis, lojistik merkez ve uygun modüler düzene sahip ticari yapılarda da değerlendirilebilir. Uygunluk proje girdileriyle belirlenir." },
      { question: "Prefabrik sistemde proje neden erken tamamlanmalı?", answer: "Elemanlar saha dışında üretildiği için boşluk, gömülü parça, birleşim ve ölçü kararlarının üretimden önce dondurulması gerekir. Geç değişiklikler üretim ve montajı etkileyebilir." },
      { question: "Birleşimler deprem performansını etkiler mi?", answer: "Evet. Elemanların bir arada nasıl davrandığını birleşimler belirler. Birleşim hesabı, detay, üretim ve montaj kontrolü taşıyıcı çözümün ayrılmaz parçalarıdır." },
      { question: "Prefabrik teklifinde hangi kalemler kontrol edilmeli?", answer: "Proje, eleman üretimi, gömülü parçalar, nakliye, vinç, montaj, dolgu birleşimleri, çatı ve cephe bağlantıları ile saha sorumlulukları açıkça listelenmelidir." },
    ],
    relatedServices: [
      { title: "Projelendirme", description: "Aks, eleman, birleşim ve üretim paftalarını koordineli hazırlayın.", href: "/hizmetler/projelendirme" },
      { title: "Yapım", description: "Üretimden montaja uzanan kalite ve program zincirini yönetin.", href: "/hizmetler/yapim" },
      { title: "3B Tasarımlar", description: "Taşıyıcı sistemi ve kritik birleşimleri üç boyutlu inceleyin.", href: "/tasarim-calismalari" },
    ],
  },
  {
    id: "concrete",
    slug: "betonarme",
    no: "04",
    name: "Betonarme Yapı Sistemi",
    shortName: "Betonarme",
    eyebrow: "Çok Katlılık · Yaygın Uygulama",
    summary: "Konut, ticari ve çok katlı yapılarda geniş uygulama ekosistemi ve farklı taşıyıcı düzen seçenekleri sunan sistem.",
    lead: "Betonarme; mimari plan, zemin, kalıp düzeni ve saha üretim kalitesi birlikte yönetildiğinde çok farklı yapı türlerine uyarlanabilen köklü bir taşıyıcı sistemdir.",
    description: "Betonarme yapı sistemi; kullanım alanları, avantajlar, tasarım girdileri, saha kalite başlıkları ve Arkem mühendislik süreci.",
    image: "/portfolio/commercial-social-facility.webp",
    imageAlt: "Betonarme ticari ve sosyal yapı için temsili Arkem çalışması",
    overview: [
      "Beton ve donatının birlikte çalışmasıyla oluşan kolon, perde, kiriş ve döşeme sistemleri; konuttan ticari yapılara, çok katlı projelerden temel ve altyapı elemanlarına kadar geniş bir çözüm alanına sahiptir.",
      "Sistemin başarısı yalnızca hesap modeline değil, kalıp ve donatı uygulamasına, beton üretimi ile yerleştirilmesine, kür koşullarına ve kayıtlı saha kontrolüne bağlıdır. Proje kararları iş programı ve kalıp tekrarlarıyla birlikte ele alınmalıdır.",
    ],
    suitableFor: ["Konut ve apartman yapıları", "Ticari ve sosyal yapılar", "Çok katlı yapı programları", "Betonarme çekirdek veya temel gerektiren karma sistemler"],
    strengths: ["Yaygın malzeme ve uygulama ekosistemi", "Farklı plan ve kat düzenlerine uyarlanabilme", "Perde ve çekirdeklerle rijitlik oluşturma seçenekleri", "Kütle ve bütünlük gerektiren elemanlarda çözüm çeşitliliği", "Yerinde üretimle karmaşık geometrilere uyum"],
    watchouts: ["Kalıp, donatı ve pas payı uygulama kalitesi", "Beton dökümü, yerleştirme, numune ve kür süreci", "İş programında ardışık ıslak imalatlar", "Ağır sistemin zemin ve temel üzerindeki etkisi", "Sonradan açılacak boşluk ve tadilatların taşıyıcı sisteme etkisi"],
    designInputs: ["Zemin etüdü ve temel kabulleri", "Mimari akslar, kat yükseklikleri ve boşluklar", "Deprem, kullanım ve ekipman yükleri", "Malzeme ve saha üretim koşulları", "Kalıp sistemi, tekrar sayısı ve iş programı", "Mekanik-elektrik şaft ve geçiş ihtiyaçları"],
    process: [
      { title: "Veri ve düzen analizi", description: "Zemin, mimari, yük ve kullanım programı taşıyıcı sistem alternatifleriyle birlikte okunur." },
      { title: "Taşıyıcı model", description: "Perde, kolon, kiriş, döşeme ve temel sistemi birbiriyle uyumlu biçimde geliştirilir." },
      { title: "Uygulama projesi", description: "Donatı, kalıp, birleşim ve disiplin geçişleri sahada okunabilir paftalara dönüştürülür." },
      { title: "Saha kalite takibi", description: "Kalıp-donatı kontrolleri, beton kayıtları ve değişiklik yönetimi planlı biçimde izlenir." },
    ],
    faqs: [
      { question: "Betonarme sistem her yapı için en ekonomik çözüm müdür?", answer: "Hayır. Ekonomi; açıklık, kat, zemin, iş programı, yerel tedarik, kalıp tekrarı ve kullanım hedefiyle birlikte değerlendirilir. Alternatif sistemlerle aynı kapsamda karşılaştırma gerekir." },
      { question: "Beton sınıfı tek başına yapı kalitesini gösterir mi?", answer: "Tek başına göstermez. Donatı detayı, kalıp, yerleştirme, sıkıştırma, kür, pas payı ve saha kontrolleri tamamlanmış performansın parçalarıdır." },
      { question: "Mimari değişiklikler statik projeyi etkiler mi?", answer: "Taşıyıcı eleman, boşluk, şaft, cephe veya kullanım yükünü etkileyen değişiklikler statik çözümde doğrulanmalıdır. Disiplinler arası değişiklik kaydı önemlidir." },
      { question: "Betonarme yapıya çelik eleman eklenebilir mi?", answer: "Projeye göre mümkündür. Ek elemanın yük aktarımı, mevcut yapı kapasitesi, ankraj, deformasyon ve yangın detayları birlikte hesaplanmalıdır." },
    ],
    relatedServices: [
      { title: "Projelendirme", description: "Mimari, statik ve disiplin koordinasyonunu uygulama paftalarına taşıyın.", href: "/hizmetler/projelendirme" },
      { title: "Yapım", description: "Kalıp, donatı, beton ve saha kalite sürecini planlı yönetin.", href: "/hizmetler/yapim" },
      { title: "Danışmanlık", description: "Mevcut veri, sistem alternatifi, süre ve kapsam risklerini değerlendirin.", href: "/hizmetler/danismanlik" },
    ],
  },
  {
    id: "hybrid",
    slug: "karma-sistem",
    no: "05",
    name: "Karma Taşıyıcı Sistemler",
    shortName: "Karma Sistem",
    eyebrow: "Sistem Optimizasyonu · Arayüz Yönetimi",
    summary: "Çelik, betonarme, prefabrik veya hafif çelik çözümlerin güçlü yanlarını proje ihtiyacına göre bir araya getiren yaklaşım.",
    lead: "Karma sistem bir ürün adı değil, optimizasyon kararıdır. Her malzeme ve yapım yöntemi en verimli olduğu görevde kullanılır; başarıyı ise sistemler arasındaki arayüzler belirler.",
    description: "Karma taşıyıcı sistem nedir? Çelik, betonarme ve prefabrik çözümlerin birlikte kullanımı, kritik arayüzler ve Arkem koordinasyon süreci.",
    image: "/portfolio/bim-engineering.webp",
    imageAlt: "Karma taşıyıcı sistem ve BIM koordinasyonu için temsili Arkem çalışması",
    overview: [
      "Betonarme çekirdek ile çelik çerçeve, prefabrik elemanlarla yerinde dökme bölümler veya hafif çelik üst yapı ile farklı temel çözümleri bir arada kullanılabilir. Amaç, malzemeleri çoğaltmak değil proje hedeflerini daha dengeli karşılamaktır.",
      "Bu yaklaşımda farklı ekiplerin modelleri, toleransları, deformasyonları, yangın ve korozyon gereksinimleri ortak arayüzlerde buluşur. Sorumluluk matrisi ve değişiklik yönetimi, hesap kadar kritik hâle gelir.",
    ],
    suitableFor: ["Farklı açıklık ve kat gereksinimlerini aynı yapıda barındıran projeler", "Betonarme çekirdekli çelik yapılar", "Prefabrik üretim ile yerinde imalatın birlikte kullanıldığı tesisler", "Mevcut yapıya ek, güçlendirme veya büyüme projeleri"],
    strengths: ["Her sistemi uygun görevde kullanma olanağı", "Ağırlık, açıklık ve takvim hedeflerini birlikte optimize etme", "Mimari ve işlevsel farklılıklara uyarlanma", "Aşamalı yapım ve genişleme senaryoları geliştirme", "Yerel üretim ve saha olanaklarını birleştirme"],
    watchouts: ["Farklı sistemler arasındaki yük aktarımı ve birleşimler", "Diferansiyel hareket, rötre, sünme ve tolerans uyumu", "Yangın, korozyon, su ve hava bariyerlerinde arayüz sürekliliği", "Model, imalat ve montaj sorumluluklarının açık tanımı", "Disiplinler arası revizyon ve veri yönetimi"],
    designInputs: ["Her bölümün kullanım ve performans görevi", "Zemin, açıklık, kat ve yük verileri", "Malzeme ve üretici olanakları", "Arayüzlerde tolerans ve deformasyon kabulleri", "Montaj sırası ve geçici stabilite", "Sorumluluk, model paylaşımı ve onay akışı"],
    process: [
      { title: "Hedef ve kısıt haritası", description: "Yapının her bölümünde açıklık, ağırlık, hız, maliyet ve kullanım öncelikleri belirlenir." },
      { title: "Alternatif optimizasyon", description: "Tekil ve karma sistem seçenekleri ön boyutlandırma, süre ve risk matrisiyle karşılaştırılır." },
      { title: "Arayüz mühendisliği", description: "Yük aktarımı, birleşimler, deformasyonlar, toleranslar ve yapı fiziği geçişleri çözülür." },
      { title: "Ortak üretim ve saha planı", description: "Farklı imalatçı ve ekiplerin model, teslim, montaj ve kalite adımları tek planla yönetilir." },
    ],
    faqs: [
      { question: "Karma sistem neden tercih edilir?", answer: "Tek bir sistemin açıklık, ağırlık, kat, takvim veya mimari hedeflerin tamamını dengeli karşılamadığı projelerde farklı çözümlerin avantajlarını birleştirmek için değerlendirilir." },
      { question: "Karma sistem daha karmaşık mıdır?", answer: "Arayüz ve koordinasyon ihtiyacı daha yüksektir. Erken model paylaşımı, açık sorumluluklar ve üretim öncesi detay çözümü bu karmaşıklığı yönetilebilir hâle getirir." },
      { question: "Hangi sistemlerin birlikte kullanılacağı nasıl belirlenir?", answer: "Kullanım, açıklık, yük, zemin, yangın, tedarik, montaj ve bütçe girdileri için alternatifler ön boyutlandırılır; karar ölçülebilir karşılaştırma üzerinden verilir." },
      { question: "Mevcut yapıya eklerde karma çözüm kullanılabilir mi?", answer: "Evet; ancak mevcut yapının gerçek durumu, kapasitesi, temel sistemi ve yeni-eski yapı etkileşimi araştırılmadan çözüm kesinleştirilemez." },
    ],
    relatedServices: [
      { title: "Danışmanlık", description: "Alternatifleri süre, risk, maliyet ve uygulanabilirlik açısından karşılaştırın.", href: "/hizmetler/danismanlik" },
      { title: "Projelendirme", description: "Farklı sistemlerin hesap, arayüz ve uygulama belgelerini koordine edin.", href: "/hizmetler/projelendirme" },
      { title: "3B Tasarımlar", description: "Kritik birleşim ve disiplin arayüzlerini model üzerinde görün.", href: "/tasarim-calismalari" },
    ],
  },
];

const primarySystemIds: readonly StructuralSystem["id"][] = ["precast", "steel", "light", "hybrid"];

export const primaryStructuralSystems: readonly StructuralSystem[] = primarySystemIds
  .map((id) => structuralSystems.find((system) => system.id === id))
  .filter((system): system is StructuralSystem => Boolean(system));

export function matchesStructuralSystemEvidence(system: StructuralSystem, fact: V3ProjectFact) {
  if (fact.status !== "doğrulandı") return false;
  const value = fact.value.toLocaleLowerCase("tr-TR");
  if (system.id === "precast") return value.includes("prefabrik");
  if (system.id === "light") return value.includes("hafif çelik");
  if (system.id === "hybrid") return value.includes("hibrit") || value.includes("karma");
  if (system.id === "concrete") return value.includes("betonarme") && !value.includes("prefabrik");
  return value.includes("çelik") && !value.includes("hafif çelik");
}

export const getStructuralSystem = (slug: string) => structuralSystems.find((system) => system.slug === slug);
