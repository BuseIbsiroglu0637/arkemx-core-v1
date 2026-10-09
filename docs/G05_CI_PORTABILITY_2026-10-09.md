# G05 CI ve tarayıcı testlerinin taşınabilirliği

Tarih: 9 Ekim 2026, Europe/Istanbul. İnceleme tabanı: yerel `708921ab5fb057c726e4d5af00fd5d6923d0adad`, PR #18 uzak `742f7e24b2889318183a5929f149fdeba7ca46db`.

## Yapılan değişiklik

ARKEMX CI, `main` yanında PR #18'in hedefi olan `fix/prototip-final-2026-10-06` dalına açılan PR'ları da kapsar. CI Node sürümü, mevcut G05 kanıtında kullanılan ve `registerHooks` destekleyen `24.19.0` olarak sabitlendi. Mevcut UI/build/TypeScript işi korunur. Ayrı G05 işi, 37 kaynak bütünlüğü testini ve 7+4 gerçek tarayıcı kontrolünü çalıştırıp tarayıcı kanıtlarını saklar.

İnceleme tarayıcı testi, depo dışındaki önceki `browser_result.json` dosyasını okumaz. Başlangıç projesi `tests/fixtures/g05-review-project.mjs` içindeki sentetik veriyle oluşturulur. Bu veri gerçek proje veya mühendislik kabulü değildir.

`npm run test:g05:e2e`, kendisine ait strict-port localhost sunucusunu 5187 portunda başlatır; hazır olmasını bekler, iki tarayıcı testini sırasıyla çalıştırır ve sunucuyu sonlandırır. Başka demo sunucusu kullanılmaz. Uzak D1 seçimi devre dışıdır. Çıktı `test-artifacts/g05/` altında tutulur ve Git'e eklenmez. İki testin başarılı sonucu birbirinin çıktı dosyasına bağlı değildir.

## Tekrarlama

CI ile aynı test ortamı için Node 24.19.0 ve lockfile bağımlılıklarını kullanın:

```sh
npm ci
npx playwright install --with-deps chromium
npm run test:g05
npm run test:g05:e2e
```

Yerel tarayıcı çalıştırılabilir dosyası gerekiyorsa `ARKEMX_E2E_BROWSER` verilebilir; port `ARKEMX_E2E_PORT`, kanıt dizini `ARKEMX_G05_EVIDENCE_DIR` ile değiştirilebilir. Testler kendi tarayıcı bağlamlarını kullanır ve yalnız sentetik yerel saklamayı değiştirir.

## Yerel doğrulama ve ilerleme kaydı

9 Ekim 2026: Node 24.19.0 altında 37/37 G05 birim testi, Vite yerel build ve `tsc --noEmit` başarılı. Yeni bağımsız tarayıcı paketi aynı Node sürümü ve gerçek Edge ile 7/7 + 4/4 kontrolü geçti; rapor zamanları 17:38:51 ve 17:39:06 Türkiye saati. Kanıtlar: `test-artifacts/g05-node24/browser_result.json`, `review-browser-result.json`, ekran görüntüleri ve sunucu logu. Bu kanıtlar yereldir; Ubuntu/Chromium GitHub Actions çalışması veya yetkili mühendislik kabulü değildir. Sunucu çalıştırma sonunda sonlandırıldı. Sources, donmuş MCP kayıtları ve canlı karar/görevler değiştirilmedi.

Yapılan iş: CI tetikleyicisi, G05 kapsamı, sabit Node sürümü ve bağımsız tarayıcı başlangıç verisi düzeltildi. Açık işler: değişikliğin PR #18 dalına aktarılması ve gerçek GitHub CI sonucu; eski genel UI/lint borcu; B04/B06 tam kapsamı. Sonraki adım: PR aktarımı ve CI çıktısının incelenmesi.

## Açık kalan kapsam

Mevcut genel UI işindeki iki tarihsel metin/modül sayısı kontrolü başarısız kalabilir. Bu paket test beklentilerini değiştirmez, kontrolleri atlamaz ve başarılı genel CI iddiası üretmez. B04 tam sürümlü eleman–hesap–belge zinciri, B06 kat bazlı analiz/çizim, gerçek mühendislik testi, canlı sürüm ilişkisi ve yetkili kabul ayrı işlerdir. GitHub CI'nin gerçekleşmiş sonucu ancak bu değişikliğin uzak PR dalına aktarılmasından sonra okunabilir.
