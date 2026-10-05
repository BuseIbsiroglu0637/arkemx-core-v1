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
