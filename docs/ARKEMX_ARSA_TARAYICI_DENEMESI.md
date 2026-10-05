# Arsa tarayıcı araştırması — başlangıç sürümü

Bu sürüm ARKEMX yerel demo/Codespaces geliştirme sunucusunda, normal Chromium ile Emlakjet’in filtreli ilan sayfasını açar. ChatGPT'nin tarayıcısına veya OpenAI API anahtarına ihtiyaç duymaz. Üretim Cloudflare dağıtımında etkinleşmez; mevcut sunucu agent/feed bağlantısı korunur.

## Açılış

Node.js 22.13+ ve mevcut `npm ci` kurulumu gerekir. İlk kez Chromium kurun:

```bash
npx playwright install chromium
npm run demo:land
```

Linux'ta Chromium sistem bağımlılıkları eksikse `npx playwright install --with-deps chromium` kullanın. Codespaces'te 5173 portunun görünürlüğünü **Private** tutun.

ARKEMX demo oturumunu açın. Henüz arsa yok durumundaki projeden **Arsa araştırması** ekranına geçin. İl, isteğe bağlı ilçe, satın alma, minimum/maksimum alan ve arsa bütçesini belirleyip **Adayları getir** düğmesine basın. Örnek deneme kriterleri: Kastamonu, en az 3.000 m², en fazla 10.000.000 TL. Bunlar gerçek proje bütçesi kabul edilmez.

Normal demo için `npm run demo:local` kullanın. Tarayıcı denemesi yalnız `demo:land` komutuyla açılır. Sunucu 127.0.0.1'e bağlı kalır; demo cookie'si, aynı origin ve yerel günlük 10 arama sınırı uygulanır. Bu sınır geliştirme sunucusu belleğindedir; üretim hesap kotası değildir.

## Kapsam

- Yalnız satın alma; varsayılan kaynak Emlakjet; ilk sayfada en fazla 24 ilan kartı.
- İl/ilçe, fiyat ve alan kriterleri sitenin kendi formunda gözlenen filtreli sayfa adresine aktarılır. Sayfa açılınca URL ve formdaki değerlerin istenen kriterlerle eşleştiği doğrulanır. Okunan kartlar konum/alan/bütçeye göre ayrıca kontrol edilir.
- İstenen toplam fiyata göre artan sıralama. Eksik veya olağan dışı fiyat en sona bırakılır ve doğrulama ister.
- Kullanım bilgisi varsa bir ilan beyanı olarak korunur. Emlakjet kartında açık kategori bulunmadığı için yalnız belirgin başlık beyanları alınır; diğerlerinde kullanım eksik gösterilir. Tarla/bahçe üretim alanı sayılmaz; kullanım uyuşmazlığı kartta gösterilir ve mevcut incelemeye alma kapısı bunu engeller.
- Karttaki başlık, URL, alan, fiyat ve konum okunur. Ayrıntılı açıklama, fotoğraf, iletişim bilgisi ve altyapı doğrulaması bu sürüme dahil değildir.
- Kısa liste mevcut proje kaydında tutulur. Aday seçimi resmî parsel/imar verisini otomatik değiştirmez.
- Kaynakta toplam sonuç sayısı ile gerçekten okunan kart sayısı ayrı gösterilir. İlk sayfada aday bulunmaması bütün kaynağın tarandığı anlamına gelmez.

## Hata durumları

İnsan doğrulaması veya otomatik erişim engeli `source-blocked` olarak döner ve araştırma durur. Codespaces denemesinde görülen Cloudflare “Bir dakika lütfen…” başlığı ve doğrulama alanı da bu kapsamdadır. Bu durumda tarayıcı kurulumu tamamlanmış olsa bile ilanlara erişim yoktur; filtre veya kriter değiştirerek sonuç alındığı varsayılmaz. CAPTCHA çözülmez, stealth/proxy kullanılmaz ve döngüsel tekrar yapılmaz. Bu durum boş sonuç değildir. Eksik Chromium `browser-unavailable`; okunamayan düzen `layout-changed`; bağlantı/zaman aşımı `unavailable` olarak gösterilir. Yalnız açık boş sonuç veya başarıyla okunan kartların kriter dışı kalması tamamlanmış boş arama sayılır.

## Emlakjet erişim denemesi

2026-10-05 tarihinde ChatGPT bulut tarayıcısında Kastamonu/Merkez, satılık arsa ve en az 1.000 m² filtresi 80 sonuç gösterdi. Düşük fiyat sıralaması, maksimum alan ve fiyat alanları da çalıştı. Codespaces ikinci denemesinde sayfa ve 30 kart açıldı, ancak form etkileşimi URL’ye uygulanmadı. Adaptör bu yüzden doğrulanmış filtreli sonuç URL’sini tek sefer açar; ekrandaki alan ve fiyat değerlerini ayrıca kontrol eder. Bu gözlem Codespaces Playwright erişimini kanıtlamaz. Codespaces için tek, sınırlı arama:

```bash
npm run probe:land
```

Komut yalnız Emlakjet'i dener; JSON içinde kaynak durumu, okunan kartlar ve arama kriterleri bulunur. İlk sayfadan en fazla 24 kart okur, kişisel iletişim bilgisi toplamaz. Erişim engelinde başarısız çıkış kodu ve `blocked` durumu verir. İnsan doğrulamasını aşmaya çalışmaz. Hepsiemlak adaptörü kodda korunur; varsayılan demoda tekrar denenmez. `ARKEMX_LAND_BROWSER_SOURCE=hepsiemlak` yalnız o kaynağı açıkça seçmek içindir.

## Doğrulama

```bash
npm run test:land-browser
npm run test:land-browser:e2e
npm run test:land-research
```

Chromium testleri sentetik sayfalar kullanır; canlı ilanlara otomatik CI isteği göndermez. Canlı kaynağın erişimi ve düzeni zamanla değişebilir. Üretim için ayrı, yetkili ve korumalı tarayıcı servisi ile kalıcı hesap kotası gerekir; bu geliştirme middleware'i üretime taşınmamalıdır.

## Seçilen ilandan ada/parsel aktarımı

Parsel incelemesine geçildiğinde Emlakjet adayının detay sayfası bir kez okunur. İlan numarası ve il/ilçe yolu eşleşirse açık mahalle/köy, Ada ve Parsel alanları proje kaydında ilan beyanı olarak tutulur. Boş ve uyumlu parsel seçim alanları otomatik doldurulur; mevcut kimlikle çelişen bilgiler veya sınır geometrisi üzerine yazılmaz. Kaynak bilgisi sayfada gösterilir. Eksik alan veya erişim engeli açıkça belirtilir. İlan alanı, fiyatı ve imar beyanı bu işlemle mühendislik hesabına veya onaylı imar verisine aktarılmaz. Resmî idari liste eşleşmesinden sonra mevcut TKGM sorgusu çalıştırılabilir. Detay okuma yalnız `demo:land` yerel prototipinde etkindir; günlük en fazla 30 detay isteği ve aynı oturum/origin denetimleri uygulanır.

## Proje brüt alanından arsa arama alt sınırı

Yeni aramada hedef brüt alan ve kat adedi başlangıç briefinden alınır. Ön varsayımlar %30 taban oranı ve 1,50 emsaldir; imar verisi değildir ve arama ekranında değiştirilebilir. Hesap: `max((hedef brüt alan / kat adedi) / taban oranı, hedef brüt alan / emsal)`; sonuç 50 m² adımlarla yukarı yuvarlanır. Hedef brüt alanın tamamı emsale dahil varsayılır. Sonuç arama alt sınırına otomatik uygulanır; kullanıcı elle değiştirirse değeri korunur. Otomatik moddaki kayıt, brief güncellendiğinde yeniden hesaplanır. Önceden kaydedilmiş sıfırdan büyük alt sınırlar elle seçilmiş kabul edilir. Eksik/geçersiz brief için öneri üretilmez. Kat izni, çekme mesafeleri, otopark, açık alan, gerçek TAKS/KAKS ve emsale dahil alanlar parsel bazında ayrıca incelenmelidir. Bu varsayımlar parsel/imar modülüne aktarılmaz.

## Otomatik ilan imar beyanı

Seçilen Emlakjet ilanının özellik satırları ve yalnız kendi açıklama bölümü otomatik okunur. Açık TAKS, KAKS/Emsal, Hmax/Yençok etiketleri bulunan tekil sayısal değerler imar formunun boş alanlarına aktarılır. Yüzde TAKS oran olarak, metre belirtilen Hmax yükseklik olarak saklanır. Çelişen/range değerler, kat sayıları ve etiketsiz yüzdelerden imar değeri türetilmez. İmar Durumu satırı arazi kullanım beyanına aktarılabilir. Kaynak URL ve okuma zamanı kaynak notuna bağlanır; statü kullanıcı beyanı ve uzman incelemesi bekliyor olarak kalır. Kaynaklı, incelemesi yapılmış veya çelişen mevcut imar verisi üzerine yazılmaz. Arsa araştırmasındaki taban/emsal varsayımları bu aktarımda kullanılmaz. Daha önce yalnız kimliği okunmuş adaylar yeni detay sürümünde bir kez yeniden okunur.


## Resmî imar kaynağı – Kastamonu başlangıcı

Resmî idari seçim ve ada/parsel tamamlandığında `/api/zoning-conditions` otomatik çağrılır. Oturum ve aynı kaynak kontrolü sunucudadır. Sunucu TKGM v3.1 üzerinden parsel geometrisini yeniden okur; tarayıcıdan geometri veya kaynak URL kabul etmez. Kastamonu İl Özel İdaresi FeatureServer 1826 (Uygulama İmar Planları / Konut Alanı) sorgulanır. Mülga katman 1942 kullanılmaz. Tek imar alanı bütün kadastro sınırını kapsamalıdır; delikli/çok parçalı sınırlar, kesişen alanlar ve eksik kayıtlar açık sonuç verir. Plan 1967 tablosunda kimlik, 1/1000 uygulama planı, Onaylandı durumu ve onay tarihi kontrol edilir. Bu, resmî imar durumu belgesi veya uzman onayı üretmez.

TAKS, emsal ve yükseklik yalnız `Deger` tipli alanlardan; ön/yan mesafeler ve nizam varsa kaynaktan aktarılır. Arka çekme mesafesi ve plan notları çıkarılmaz. Boş form veya değişmemiş otomatik ilan aktarımı güncellenebilir; manuel/sourced/reviewed çalışma korunur ve kaynak değerleri ayrıca gösterilir. Sonuç parsel kimliğiyle 24 saat yerel olarak saklanır; yeniden sorgulama düğmesi erişimi tekrar dener. Başka il veya kullanım türü desteklenmiş sayılmaz. Kaynakta kayıt yokluğu “imarsız parsel” değildir. Hata ve erişim kısıtı boş başarı değildir.

`npm run test:zoning-source` sentetik servis yanıtlarıyla kaynak eşleştirmesi ve hata senaryolarını doğrular. Canlı Kuzyaka 143/11 sorgusu bu ortamda zaman aşımı nedeniyle doğrulanamadı; sayısal sonuç veya ülke genelinde kapsama iddiası yoktur.


Codespaces `demo:land` çalışmasında `/api/zoning-conditions` aynı yerel middleware üzerinden sunulur. Origin kontrolü worker adres dönüşümünden önce gerçek Host üzerinden yapılır; demo oturumu, aynı kaynak, 2 KB gövde, iptal ve günlük 60 sorgu sınırı korunur. Worker tarafından görülen localhost adresi Codespaces origin'iyle karşılaştırılmaz. Güvensiz forwarded-host başlığı kabul edilen kaynakları genişletmez.

### Resmî imar bağlantısının teşhisi

`npm run probe:zoning`, Codespaces/yerel Node ortamından TKGM il listesini ve Kastamonu e-İmar'ın konut alanı/plan katmanı metadatasını ayrı ayrı sınar. En fazla 25 saniye sürer; her kaynak için HTTP durumu veya DNS, bağlantı zaman aşımı, TLS ya da yönlendirme nedenini gösterir. TLS doğrulaması kapatılmaz ve başka adreslere yönlendirme izlenmez. Başarılı metadata kontrolü, seçilen parselin imar kaydının bulunduğu anlamına gelmez.

Parsel sorgusundaki bağlantı hatası artık hangi aşamanın (TKGM parsel, e-İmar konut alanı, e-İmar plan) başarısız olduğunu belirtir. Tek başına ağ hatası bot engeli olarak yorumlanmaz; formdaki değerler değiştirilmez.

### Eksik ada/parsel ile konum aktarımı

İlanın doğrulanan il/ilçe ve mahalle/köy bilgisi, ada veya parsel belirtilmese de Arazi ve Parsel sayfasına aktarılır. Eksik ya da birden fazla farklı değer içeren numara alanı boş kalır; ilandaki metrekare, fiyat veya harita konumundan numara türetilmez. Kullanıcı seçimleri ve mevcut sınır geometrisi korunur. Önceki sürümün eksik detay önbelleği, detay sürümü 3 ile bir kez yeniden okunur. Mahalle/köy aktarılması parsel sınırı veya imar doğrulaması sayılmaz.
