# ARKEMX CORE V1 — Bilgisayardan Yerel Demo Kurulumu

**Amaç:** Teknokent görüşmesinde uygulamayı GitHub Codespaces veya yayımlanmış internet sitesi olmadan **kendi bilgisayarında** göstermek. Uygulama yerel tarayıcıda açılır; henüz Windows .exe / macOS .app biçiminde bağımsız bir masaüstü yazılımı değildir.

## Windows ZIP kurulumunda eksik Vite dosyaları (26.09.2026 düzeltmesi)

GitHub ZIP sürümünde sunucuya özgü `.openai/hosting.json` ve `build/sites-vite-plugin` dosyaları bulunmaz. Bu nedenle eskiden `vite.config.ts` kullanan başlatıcı **UNRESOLVED_IMPORT** hatası verebiliyordu.

Güncel ZIP'te bu sorun için `vite.local.config.mjs` dosyası ve yerel başlatıcı düzeltmesi vardır. **Mevcut bir kurulumu güncellerken** yalnızca kökteki `vite.local.config.mjs` ile `scripts/start-local-demo.mjs` dosyasını yeni sürümle değiştirin; `node_modules` klasörünü veya tarayıcıdaki proje kaydınızı silmeyin. Ardından terminalde:

```powershell
npm run demo:local
```

Başlatıcı artık `vite.local.config.mjs` üzerinden çalışır ve iki eksik sunucu dosyasını istemez. Lokal demodaki D1 bağlantısı yalnızca geliştirme için ayrılmış yerel bağlamdır; gerçek müşteri kayıtları veya kurumsal kimlik doğrulama altyapısı değildir.

## 1. Bir defalık hazırlık (internet gerekir)

**Gereksinim:** Node.js **22.13.0 veya üzeri**, npm ve güncel Chrome/Edge (veya desteklenen tarayıcı).

1. Kodun bilgisayara alınması:
   - Tek seferlik ZIP yöntemi: GitHub deposu → **Code → Download ZIP** → ZIP'i kalıcı bir klasöre çıkarın (ör. `Belgeler/ARKEMX-DEMO`). `node_modules` ZIP'te bulunmaz.
   - Sürekli geliştirme yöntemi (Git kuruluysa): `git clone https://github.com/BuseIbsiroglu0637/arkemx-core-v1.git`; özel depoya erişim gerektiğinde GitHub kimlik doğrulaması yapılır.
2. Bilgisayardaki proje klasöründe bir terminal açın ve bir defa `npm ci` çalıştırın.
3. Kurulum bitince `npm run demo:local` ile açın.

**Windows:** İlk kurulum sonrasında proje klasöründeki `ARKEMX_DEMO_BASLAT_WINDOWS.cmd` dosyasını çift tıklayın. Komut İstemi penceresini açık tutun.

**macOS/Linux:** Terminalde `bash ARKEMX_DEMO_BASLAT_MAC_LINUX.command` çalıştırın. macOS'ta Finder'dan çift tıklamak isterseniz önce terminalden `chmod +x ARKEMX_DEMO_BASLAT_MAC_LINUX.command` uygulayın.

Tarayıcı kendiliğinden açılmazsa şu adrese gidin:

**http://127.0.0.1:5173/dijital-proje-merkezi**

Uygulama yalnızca kendi cihazının `127.0.0.1` adresini dinler. Aynı ağdaki diğer bilgisayarlar bu bağlantı üzerinden bağlanamaz. Kapatmak için terminal penceresinde **Ctrl+C** kullanın.

## 2. Önceden hazırlanacak sentetik demo projesi

Jüri günü canlı proje oluşturmakla vakit kaybetmemek için ilk provada şu çalışma verisini kaydedin:

| Alan | Demo değeri |
|---|---|
| Proje adı | ARKEMX DEMO — SENTETİK ÜRETİM TESİSİ |
| Kullanım | Sanayi / üretim |
| Hedef brüt alan | 3.000 m² |
| Kat | 3 |
| Başlangıç kat yüksekliği | 6,00 m |
| Başlangıç MEP servis zonu | 0,45 m |
| Konum | Ankara / Test — **gerçek parsel veya yetkili imar verisi değildir** |

1. `/proje-baslat` adresinden proje oluşturun; `/mimari-program-studyosu` üzerinden mimari şemayı ve kat bilgilerini kontrol edin.
2. `/tasarim-calismalari` ekranında mimari şemayı plan/aks modeline, ardından **V113 / Plan / program verisini aktar** düğmesiyle taşıyıcı ön tasarıma bağlayın.
3. `/muhendislik-koordinasyon` ekranında **V113 + V114 modelini yenile** düğmesine basın; mimari ve taşıyıcı kaynakların bağlı ve geometrinin eşleşmiş olduğunu kontrol edin.
4. Herhangi bir teknik modüldeki **Proje JSON ↓** düğmesiyle proje dosyasını indirip proje klasörünüzün **dışında** yedekleyin (örn. `Belgeler/ARKEMX-DEMO-YEDEK/ARKEMX-DEMO.arkem.json`). Bu dosya internet bağlantısı olmadan başka cihazda da yüklenebilir.
5. Bir sonraki provada `/dijital-proje-merkezi` üzerinden **Proje JSON yükle ↑** düğmesiyle aynı dosyayı içe aktarın. Aynı tarayıcı profilini kullanırsanız yerel proje kasası da kaydı korur; **JSON yedeği yine de alınmalıdır**.

**Güvenlik:** Canlı müşteri dosyası, gizli belge, gerçek kişisel veri, erişim anahtarı veya üretim yetkisi içeren `.env` dosyası demo klasörüne konmamalıdır. Demo yalnızca sentetik veriyle yapılır.

## 3. Jüri önünde beş dakikalık gösterim

| Süre | Ekran | Gösterilecek davranış |
|---|---|---|
| 0:00–1:00 | Mimari program ve plan | Hazır projenin 3.000 m² / 3 kat şeması ve ortak aksları |
| 1:00–1:45 | Taşıyıcı ön tasarım | Mimari ve plan verisinin aynı proje kimliğinde kullanılması |
| 1:45–3:00 | BIM koordinasyonu | **Kat yüksekliği 3,40 m** ve **MEP zonu 2,00 m** ile sentetik net yüksekliğin **0,65 m** olması; kritik çakışmaların kayda geçmesi |
| 3:00–4:00 | Proje OS | «İncelendi» işaretinin teknik çözüm sayılmaması; kritik konu nedeniyle 4B/5B onay kapısının bloke kalması |
| 4:00–5:00 | BIM + Dijital Proje Merkezi | Kat yüksekliğini **6,00 m** ve MEP zonunu **0,45 m** yaparak kuralı yeniden çalıştırma; çalışma manifestosunu indirme ve resmî teslim kilidini gösterme |

**Beklenen son durum:** Sentetik kritik çakışma sayısı sıfır; eksik kolon/perde verisi için **BIM-053** inceleme kaydı açık; çalışma manifestosu `review-required` ve `officialReleaseEligible:false`. Bu sonuç **teknik onay değildir**.

## 4. Görüşmeden önce yapılacak iki prova

- İlk prova: Kendi bilgisayarınızda bütün ekranları dolaşın, JSON dosyasını başka bir tarayıcı profiline içe aktarın ve demo akışını beş dakikada tamamlamayı deneyin.
- İkinci prova: **İnternet bağlantısını kapatıp** yerel sunucuyu yeniden başlatın. Uygulama açılıyor, sentetik veri ekranları erişiliyor ve kritik kural çalışıyorsa yedek ekran videosu alın. Harita, uzaktan görseller, gerçek kimlik/doğrulama ve üçüncü taraf API çağrıları internet gerektirebilir; **bütün sitenin çevrimdışı çalıştığı varsayılmamalıdır**.

İlk kurulum (`npm ci`) internet gerektirir. Daha sonra bilgisayarda mevcut bağımlılıklarla localhost'ta çalışma amaçlanır; seçilen işletim sistemi ve ağsız çalışma ayrıca provada doğrulanmalıdır.

## 5. Güncelleme ve arşiv

GitHub **yalnızca kodun sürümlenmesi ve gerektiğinde güncellenmesi** için kullanılır; jüri günü sunumu açmak için GitHub oturumuna ihtiyaç yoktur.

- Git ile alınmış klasörde: `git pull --ff-only origin main`; bağımlılık değişmişse `npm ci`.
- ZIP ile alınmış klasörde: yeni sürümü yeniden çıkarın, eski klasörünüzdeki kullanıcı verilerini **silmeden** yeni kurulum yapın. JSON proje yedeğini proje klasörü dışında saklayın.
- Kurulumdan sonra ilk aşama kanıtları: [Test ve Kanıt Raporu](./ARKEMX_CORE_V1_ILK_ASAMA_TEST_KANIT_RAPORU_2026-09-26.md) ve [ham test kaydı](./test-evidence/ARKEMX_CORE_V1_TEST_LOG_2026-09-26.txt).
- Bu başlatıcı, mevcut `npm run dev` ve GitHub Codespaces iş akışını değiştirmez.

**Sorun giderme:** `5173` portu doluysa önce o porttaki eski demo sunucusunu kapatın. `node_modules` eksikse internet açıkken `npm ci` çalıştırın. Proje boş görünürse önce aynı tarayıcı profilini kontrol edin, ardından yedek `.arkem.json` dosyasını içe aktarın. `npm test` içindeki mevcut build araçları Linux/GNU `timeout` gerektirebilir; Windows yerel açılışını sınamak için önce `npm run demo:local` kullanın.

**Belge sınırı:** Gerçek üretim hizmeti, resmî elektronik teslim, kurumsal çok kullanıcılı sunucu ve native Windows/macOS dağıtımı bu paketin kapsamı dışındadır.
