# B04 sürümlü eleman–hesap–belge zinciri: uygulanan kontroller ve kalan kapsam

Tarih: 9 Ekim 2026 (Europe/Istanbul). Dayanak: `a772857272ed422eaa2baae59d59691c35f89ba5` düzeltmesi, gerçek çalışma kodu, G04 veri sözlüğü ve CORE-V1 izlenebilirlik hedefi. Eski inceleme tabanı `4516e46389a47fa0f46ef562b4da6a82577f0557`. Bu belge teknik uygulama kararıdır; mühendislik onayı değildir.

## Şimdi uygulanan bölüm

H03 gerçek plan elemanlarının kimliklerini, kaynak revizyonunu ve eleman içeriklerinin JSON anlık görüntüsünü saklar. Denetim mevcut plan içeriğine bakar: bilinmeyen/silinmiş kimlik, yinelenen kimlik, proje veya kaynak revizyonu çatışması ve aynı revizyonda değiştirilmiş eleman içeriği geçerli kaynak bağlantısı sayılmaz. Kimliğe göre karşılaştırma eleman sıralamasına bağlı değildir. Eski, görüntüsüz kayıt `pending` kalır; eksik geçmiş yeniden üretilmez.

Bu karşılaştırma yalnız eleman içeriğini kapsar; planın bütün girdilerinin, yük kombinasyonlarının veya hesap çıktısının kriptografik bütünlük kanıtı değildir. Anlık görüntü bağımsız eleman sürüm deposu değildir. Kat plakaları/geometri, birimler ve mevcut modül damgaları kendi kontrolleriyle değerlendirilir.

Belge üretiminde verilen referanslar, yalnız mevcut gerçek kaynak kimlikleri ile doğrulanır. Taşıyıcı JSON ihracı gerçek plan kimliklerini kullanır. Hesap kayıt deposu bulunmadığından `calculationIds: null`, belge bağlantısı `unsupported` ve doğrulama `pending` kalır. Kaynak tutarlılığının `consistent` olması hesap doğruluğu veya belge zincirinin tamamlandığı anlamına gelmez. `calculationVerification` ve `technicalApproval` false kalır. Mevcut FNV tabanlı görüntüleme parmak izi SHA-256 veya kalıcı belge sürümü yerine kullanılamaz.

Kaynak doğrulaması H05 ve autosave sırasında bütün mevcut modüller bağlamında çalışır; yalnız kaydedilen/aktarılan kaynağın hatası o işlemi engeller. Başka modülün eski sonucu, güncel planın H03 ile yeniden aktarılmasını engellemez.

## Tam çözümün geliştirme paketleri

| Paket | Gereken gerçek kayıt ve davranış | Tamamlanma doğrulaması |
|---|---|---|
| Eleman sürümleri | Proje kimliği + kalıcı eleman kimliği + bağımsız eleman sürümü; kaynak revizyonu, kaynak bağlantısı, native birimler, kanonik içerik ve SHA-256. Kimlik görüntüleme sırasından bağımsızdır. | Aynı P02 içinde içerik değişikliği yeni sürüm oluşturur; sıra değişikliği oluşturmaz. Silme, kopyalama, yeniden yükleme ve eski sürüme erişim test edilir. |
| Hesap yürütme kaydı | Yalnız gerçek hesap çalıştırıldığında kalıcı kayıt: yöntem/motor sürümü ve kod commit'i, zaman, tam girdi kümesi, eleman kimliği+sürümü+hash'i, geometri, birimler, yük birleşimleri, çıktı şeması+hash'i, başarısızlık ve kapsam. | Her çıktı kendi tam girdilerine yeniden bağlanabilir; desteklenmeyen veri için başarılı hesap kaydı oluşturulmaz. Girdi değişikliği eski hesabı açıkça stale yapar. |
| Belge sürümleri | Gerçek ihraca ait belge kimliği/sürümü, şablon ve üretici sürümü, dosya hash'i, gerçek hesap sürümü ve eleman sürümü bağlantıları; supersedes ve yayın durumu. | Belge baytları kayıtlı hash ile eşleşir; var olmayan hesap/belge veya farklı proje/sürüm kenarı reddedilir. Eski belge ayrı sürüm olarak korunur. |
| Kalıcılık ve uzlaştırma | Yerel saklama, hesap çalıştırma ve hesap/belge API okuma-yazma modellerinde tutarlı referans deposu; atomik güncelleme, değişiklik etkisi, yedek/geri yükleme ve çok sekmeli uzlaştırma. | Kesintili kayıt, eski yedek, çatışma, silinen kaynak ve yeniden yüklemede dangling referans kalmaz; eski kayıtlar unsupported/pending olarak taşınır. |
| Uçtan uca sınama | Gerçek motor girdisi → gerçek hesap kaydı → gerçek dosya ihracı → yeniden yükleme; olumsuz referans ve değişiklik senaryoları. | Sahte kimliklerle başarılı zincir gösterilmez. Yazılım referans bütünlüğü testi, mühendislik hesabının doğrulanması ve yetkili onay ayrı kaydedilir. |

Bu paketler ortak veri modeli, hesap yürütme yaşam döngüsü, yerel/API kalıcılık ve bütün ihracat tüketicilerini kapsar. Mevcut yardımcı fonksiyonlara birkaç referans eklemek tam çözüm sağlamaz. Dolayısıyla B04 **kısmen çözüldü; tam sürümlü zincir açık**. Bu aşamada yeni kayıt deposu, SHA-256 zinciri, hesap yürütme kimliği veya belge sürüm deposu uygulanmadı. Bunların değerleri tahmin edilmedi.

## B06 ile sınır

H03 seçili katın ölçülerini ve bütün kat plakalarını korur. H05 artık UI açılmasa bile `unsupported` durumunu ve farklı kat ölçülerini denetler; kayıtlı eski pozitif sonuç 400 m² olsa da aktarmaz. Taşıyıcı ekranda sonuç/stüdyo null, alternatifler boş, PDF/CSV sonuç ihracı kapalıdır; gerçek JSON indirmesi yalnız girdileri ve destek sınırını verir. Farklı kat plakaları için ayrı yük yolu, kat bazlı model, sistem analizi ve bu modelden üretilen çizim/hesap desteği geliştirilmedi. B06 **kısmen çözüldü; tam analiz desteği açık**.

## Açık sınırlar ve sonraki adım

Önce yukarıdaki sürümlü kayıt sözleşmesi ve kalıcılık paketleri uygulanmalı; ardından gerçek hesap yürütme ve gerçek belge ihracı bu sözleşmeye bağlanmalıdır. G06 mühendislik veri/testleri ve yetkili teknik onay ayrı iş olarak kalır. Eksik Git geçmişi ve canlı yayın SHA doğrulaması bağımsız açık işlerdir. GitHub üzerinden içeriği alınamayan 11 public dosyası, kaynak ZIP'i salt okunur incelenerek bulundu; her dosya beklenen Git blob SHA'sı ve boyutuyla birebir eşleşti ve çalışma kopyasına tamamlandı. Bu yerel arşivden doğrulanmış geri yüklemedir; başarılı GitHub dosya içeriği çağrısı olarak sunulmaz. Kaynaklar ve donmuş MCP kayıtları bu çalışmada değiştirilmez; dışarı gönderim/yayın yoktur.
