# Arsa araştırma agentı — ilk sürüm

Başlangıç: `test/07-plan-ve-aks` dalı. Çalışma: `fix/07-plan-ve-aks-duzenlemeleri`.

## Kullanıcı akışı

“Henüz arsa yok” veya “Arsa araştırılıyor” başlangıcı `/arsa-arastirma` sayfasına yönlenir. Kullanıcı il, isteğe bağlı ilçe, satın alma/kiralama, arsa alanı ve ayrı arsa bütçesini belirler. “Adayları getir” sunucu üzerinde araştırma başlatır. İlanları tek tek kullanıcının girmesi gerekmez.

Agent ilk sürümde yalnızca arsa ilanı araştırır. Sahibinden alanındaki erişilebilir kaynaklarla en fazla 8 aday üretir. En fazla 3 web aracı çağrısı ve 4.000 çıktı tokenı kullanır. Fiyat ve alan bulunamıyorsa boş kalır. Sonuçların URL'leri web aramasının kaynak listesiyle karşılaştırılır; kaynakta olmayan URL veya kategori sayfası aday olarak kabul edilmez. Kaynak metinleri talimat olarak değerlendirilmez. Bu doğrulama ilan bilgilerinin doğruluğunu veya güncelliğini onaylamaz.

Kullanıcı adayları kısa listeye alır ve birini incelemeye seçer. Kriterler değiştiğinde adaylar tekrar değerlendirilir. Çelişen aday seçilemez; eksik bilgilerin doğrulanması gerekir. Seçim parsel veya imar kapısını kapatmaz. İlanın alanı, koordinatı veya imar beyanı teknik hesaplara aktarılmaz. Parsel ekranında seçilen adayın kaynak bağlantısı görünür. Araştırmaya geri dönülebilir. Kriterler/kısa liste mevcut proje kaydında tutulur ve mevcut proje yedeklerine dahildir. Proje değiştirilince araştırma state'i ayrılır.

## Canlı AI araştırmasını etkinleştirme

Bir OpenAI API projesinde API erişimi ve kullanılabilir bakiye gerekir; ChatGPT aboneliği API kullanımı sağlamaz. Anahtarı tarayıcıya veya GitHub'a yazmayın. Codespaces/yerel Cloudflare geliştirmede git tarafından dışlanan `.dev.vars` dosyasına sunucu değişkeni olarak ekleyin:

```dotenv
ARKEMX_LAND_OPENAI_API_KEY=BURAYA_SUNUCU_API_ANAHTARI
ARKEMX_LAND_OPENAI_MODEL=gpt-5.5
```

Model erişimi hesabınızda yoksa `web_search` ve yapılandırılmış çıktıyı destekleyen erişilebilir bir model seçin. Sunucuyu yeniden başlatın. OpenAI Responses API ve web araması ücretlidir; ilk sürüm hesabın günde en fazla 10 araştırma isteğine izin verir. Kota D1'de atomik olarak saklanır; başarısız sağlayıcı isteği de kotayı tüketir. Aynı çalışanda eş zamanlı aynı kullanıcı araması engellenir. Üretimde işletmenin bütçesine göre limit belirlenmeli; API projesinde harcama takibi yapılmalıdır.

API anahtarı yoksa bağlantı bekleniyor durumu gösterilir. Gerçek ilan yerine örnek adaylar getirilmez. Canlı sağlayıcı erişimi olmadan kaynak kapsamı ve gerçek sonuç kalitesi doğrulanmış sayılmaz. API modeli erişilemeyen sayfalarda sonuç üretemeyebilir; boş sonuç, başarısız bağlantı ve kota dolması ayrı durumlardır.

## Alternatif sağlayıcılar

Öncelik: yetkili yapılandırılmış ilan beslemesi → AI web araştırması → Brave arama dizini. Yalnızca ilgili işletmenin kullanım hakkına sahip olduğu besleme yapılandırılmalıdır:

```dotenv
ARKEMX_LAND_FEED_URL=https://yetkili-saglayici.example/land/search
ARKEMX_LAND_FEED_TOKEN=SUNUCU_ERISIM_ANAHTARI
```

Sunucu bu adrese POST ile `{schema:"ARKEM-LAND-QUERY/1.0", criteria, limit:40}` gönderir. Yanıt sözleşmesi:

```json
{
  "schema": "ARKEM-LAND-FEED/1.0",
  "listings": [{
    "propertyType": "land", "active": true,
    "title": "Sağlayıcıdan gelen ilan başlığı",
    "url": "https://yetkili-saglayici.example/ilan/123",
    "source": "Yetkili ilan sağlayıcısı",
    "province": "Kastamonu", "district": "Merkez",
    "tenure": "sale", "areaM2": 3000, "priceTRY": 9000000,
    "use": "industrial", "description": "Kısa kaynak özeti"
  }]
}
```

Bu JSON yalnızca teknik sözleşme örneğidir, gerçek bir ilan değildir. Satış fiyatı toplam TL; kiralamada fiyat aylık TL olmalıdır. Farklı para birimi veya kira dönemi kullanılıyorsa fiyat `null` gönderilmelidir. `use` resmî imar onayı değil ilan beyanıdır. Kaynağı bilinmeyen bilgi boş/null kalır. Mükerrer URL'ler, pasif kayıtlar, arsa olmayan kayıtlar ve bilinen kriter çelişkileri elenir.

Brave için sunucu değişkenleri `ARKEMX_BRAVE_SEARCH_API_KEY` ve `ARKEMX_BRAVE_STORAGE_RIGHTS=1` gerekir. İkinci değer yalnızca alınan plan sonuçları projede saklama hakkı sağlıyorsa ayarlanır. Arama dizini kayıtlarından fiyat/alan/işlem türü tahmin edilmez. Doğrudan Sahibinden taraması veya giriş/erişim engeli aşma uygulanmaz.

## Kontroller

`npm run test:land-research` kriter/aday normalizasyonunu, eksik bilgileri, kaynak URL doğrulamasını, sağlayıcı hatalarını, agent isteğini ve yönlendirmeleri sınar. `npm run test:land-research:e2e` sentetik sağlayıcı yanıtıyla araştırma, kısa liste, seçim, yenileme, proje ayrımı ve mobil görünüm akışını sınar. Bunlar canlı Sahibinden/OpenAI erişim testi değildir.
