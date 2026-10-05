# Hepsiemlak tarayıcı araştırması — başlangıç sürümü

Bu sürüm ARKEMX yerel demo/Codespaces geliştirme sunucusunda, normal Chromium ile Hepsiemlak arama formunu kullanır. ChatGPT'nin tarayıcısına veya OpenAI API anahtarına ihtiyaç duymaz. Üretim Cloudflare dağıtımında etkinleşmez; mevcut sunucu agent/feed bağlantısı korunur.

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

- Yalnız satın alma; yalnız Hepsiemlak; ilk sayfada en fazla 24 ilan kartı.
- İl/ilçe sayfası açılır; fiyat ve alan filtreleri site formuna girilir. Okunan kartlar konum/alan/bütçeye göre ayrıca kontrol edilir.
- İstenen toplam fiyata göre artan sıralama. Eksik veya olağan dışı fiyat en sona bırakılır ve doğrulama ister.
- İlan kategorisi bir beyan olarak korunur. Tarla/bahçe üretim alanı sayılmaz; kullanım uyuşmazlığı kartta gösterilir ve mevcut incelemeye alma kapısı bunu engeller.
- Karttaki başlık, URL, alan, fiyat ve konum okunur. Ayrıntılı açıklama, fotoğraf, iletişim bilgisi ve altyapı doğrulaması bu sürüme dahil değildir.
- Kısa liste mevcut proje kaydında tutulur. Aday seçimi resmî parsel/imar verisini otomatik değiştirmez.
- Kaynakta toplam sonuç sayısı ile gerçekten okunan kart sayısı ayrı gösterilir. İlk sayfada aday bulunmaması bütün kaynağın tarandığı anlamına gelmez.

## Hata durumları

İnsan doğrulaması veya otomatik erişim engeli `source-blocked` olarak döner ve araştırma durur. CAPTCHA çözülmez, stealth/proxy kullanılmaz ve döngüsel tekrar yapılmaz. Bu durum boş sonuç değildir. Eksik Chromium `browser-unavailable`; okunamayan düzen `layout-changed`; bağlantı/zaman aşımı `unavailable` olarak gösterilir. Yalnız açık boş sonuç veya başarıyla okunan kartların kriter dışı kalması tamamlanmış boş arama sayılır.

## Doğrulama

```bash
npm run test:land-browser
npm run test:land-browser:e2e
npm run test:land-research
```

Chromium testleri sentetik sayfalar kullanır; canlı ilanlara otomatik CI isteği göndermez. Canlı kaynağın erişimi ve düzeni zamanla değişebilir. Üretim için ayrı, yetkili ve korumalı tarayıcı servisi ile kalıcı hesap kotası gerekir; bu geliştirme middleware'i üretime taşınmamalıdır.
