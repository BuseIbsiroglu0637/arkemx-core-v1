# ARKEMX v177 demo

## Başlangıç ekranı

`/dijital-proje-merkezi` yalnız ARKEMX başlığı ve 13 modül kartı içerir. Kurumsal menü, footer, WhatsApp bağlantısı, örnek proje yükleme/indirme düğmeleri ve teknik açıklamalar bu sayfadan kaldırıldı. Masaüstünde dört, orta genişlikte üç, dar ekranda iki sütun kullanılır. Modül içi kayıt ve çıktı araçları korunur.

Bilgi teslim planı `/bilgi-teslim-plani#teslim-kapsami`, performans laboratuvarı `/performans-laboratuvari#laboratuvar` adreslerinden mevcut bileşenleri doğrudan açar. Önceki iki bağlantı yalnız tanıtım sayfasına gidiyor, araçları göstermiyordu.

## Demo sınırı

Proje çekirdeği `arkem-demo-v177-*` tarayıcı anahtarlarını kullanır. Gerçek müşteri/başvuru/belge API erişimi ve API yazma işlemleri Worker tarafından engellenir. Modül içindeki varsayımlar ve hesaplar uzman incelemesi gerektirir. Harita ve dış kaynaklar için internet gerekir.

Kurulum: `npm.cmd ci`.
Başlatma: `npm.cmd run dev -- --host 127.0.0.1 --port 5175 --strictPort`.

## İlerleme — 2026-10-19

Dayanak: kullanıcının ilk sayfada fazlalıkları kaldırıp yalnız 13 modülü istemesi.

Kontrol: 13/13 modül bağlantısının hedefi HTTP 200 ve ilgili bölüm kimliği döndürdü. Sade başlangıç DOM'unda 13 modül bağlantısı görüldü; genel site menüsü, footer, örnek düğmeleri ve WhatsApp bulunmuyor. BEP yetkinlik seçimi 4/6'dan 5/6'ya ve bilgi kapsamı %68'den %77'ye güncellendi; test seçimi geri alındı. LCA karbon paneli tarayıcıda açıldı. TypeScript --noEmit geçti. Dar ekran görünümü kontrol edildi.

Önceki demo çalışmasında 10 test geçti. Bu düzenleme, 13 modülün tüm mühendislik hesaplarının ve bütün dış servis/çıktı yollarının doğrulandığı anlamına gelmez. Tam üretim derlemesi yapılmadı. Açık işler: modül bazında tam senaryo ve çıktı testleri; sonraki adım kullanıcının belirleyeceği modül üzerinde düzenlemelerdir.

## Kart durum notları — 2026-10-19

Kullanıcının isteğiyle her kart altına küçük doğrulama notu eklendi. 13/13 açılış kontrolü dayanak alındı; genel kartlar “Sayfa açılıyor / İşlev ve çıktı testleri bekliyor” gösterir. ARC örnek veri açılışını, BEP seçim ve sonuç güncellemesini, LCA karbon paneli açılışını belirtir. Bu notlar tam işlev onayı değildir; doğrulanmış bir arıza olmadan “çalışmıyor” etiketi eklenmedi. Kalan hesap ve çıktı senaryoları modül bazında doğrulanacak; sonuçlara göre kart notları güncellenecek.

## Yatırım briefi demo dönüşümü — 2026-10-19

Kullanıcı ilk modülün işlevleri korunarak demo haline getirilmesini istedi. PIR giriş sayfası sadeleştirildi; kurumsal üst/alt bölümler ve WhatsApp bağlantıları bu ekrandan kaldırıldı. Proje kimliği, kayıt, aktarım ve JSON araçları “Proje ayarları ve kayıt” açılır bölümünde korundu. Form seçenekleri, puanlama, riskler, yol haritası, belge listesi, kopyalama, yazdırma ve JSON çıktısı korunuyor. Örnek brief düğmesi yalnız formu doldurur; gerçek başvuru oluşturmaz. Özeti metin olarak indirme eklendi; rapor, kopya ve JSON çıktısı demo olarak işaretlenir. Girdi değişince önceki rapor gizlenir ve yeniden değerlendirme gerekir. Mevcut guided intake alanları değiştirilmeden readinessScreening kaydı güncellenir.

Kontrol: TypeScript --noEmit başarılı. npm run build ve paket doğrulaması başarılı. İlk test denemesinde dist henüz bulunmadığı için render testi çalışmadı; derleme sonrasında 24/24 test geçti (module-workspaces, hardening, demo). Render testi yeni PIR demo girişine uyarlandı; diğer modül beklentileri korundu.

Tarayıcı: örnek konut 76/100 ve Projelendirme sonucu; sıfır alanın reddi; 450,5 alanının kabulü; yıkım seçimiyle Patlatmalı Bina Yıkımı sonucu; konum değişince eski raporun gizlenmesi; demo işaretli özetin panoya kopyalanması doğrulandı. JSON/TXT indirme düğmeleri tetiklendi. PDF yazdırma diyalogu ve indirilen dosyaların disk üzerindeki içerikleri ayrıca doğrulanmadı; bu nedenle kartta dosya/PDF çıktıları test bekliyor notu korunuyor. Form dar ekranda görüntülendi. Bunlar mühendislik veya resmî teknik onay değildir.

Açık işler: PDF/dosya içerik kontrolleri ve kalan senaryolar. Sonraki adım: kullanıcının brief ekranı değerlendirmesine göre düzenleme veya sonraki modül.

## Brief ayar bölümünün kaldırılması — 2026-10-19

Kullanıcının sadeleştirme talebiyle PIR demo ekranındaki “Proje ayarları ve kayıt” bölümü kaldırıldı. Bu kayıt, önceki bölümde ayarların açılır alanda korunduğu bilgisini günceller. Yalnız bu ekranın demo görünümü değişti; proje çekirdeği, kayıt işlemleri, diğer modüller, brief formu ve rapor araçları değiştirilmedi. Sonraki adım: kullanıcının ekran değerlendirmesine göre ilerlemek.
Kontrol: tarayıcıda ayar bölümünün bulunmadığı, örnek brief düğmesi ve form gönderim düğmesinin korunduğu doğrulandı. Bu görünüm değişikliğinde hesap testleri yeniden çalıştırılmadı.

## Örnek doldurma bölümünün kaldırılması — 2026-10-19

Kullanıcının görselde belirttiği örnek veri açıklaması ve “Örnek briefi doldur” düğmesi PIR ekranından kaldırıldı. Kullanılmayan doldurma işlevi ve bu bölüme ait CSS temizlendi. Form girişleri, puanlama ve rapor araçları değiştirilmedi. Önceki örnek doldurma düğmesi beklentisi, render testinde düğmenin bulunmaması olarak güncellendi. Sonraki adım: kullanıcı değerlendirmesine göre devam etmek.
Kontrol: tarayıcıda örnek doldurma düğmesinin bulunmadığı ve form gönderim düğmesinin korunduğu doğrulandı; ekran görüntüsü alındı. Bu görünüm değişikliğinde üretim derlemesi ve hesap testleri yeniden çalıştırılmadı.

## Rapor görünümünün sadeleştirilmesi — 2026-10-19

Kullanıcı brief raporunu demo arayüzüne uygun düzenlememizi istedi. Koyu kurumsal başlık ve büyük puan paneli yerine açık renkli Brief özeti, altı proje bilgisi, kompakt bilgi tamlığı göstergesi ve önerilen ilk adım eklendi. Sonraki adımlar, açık konular, belge beyanları ve disiplin puanları sade bölümlerde korundu. Hizmet kapsamı ve sistem karşılaştırması bağlantıları ile TXT, PDF/yazdır, JSON ve kopyalama araçları korundu. Hesaplama, özet içeriği ve proje kaydı mantığı değiştirilmedi. Dar ekranda bölümler tek sütuna iner; yazdırma stilleri yeni rapora uyarlandı.

Kontrol: TypeScript --noEmit başarılı; demo/hardening testleri 18/18 geçti. Tarayıcıda mevcut konut girdileriyle aynı 76/100 sonucu, altı proje bilgisi, beş sonraki adım, açık riskler, belge durumları, disiplin göstergeleri ve kopyalandı geri bildirimi görüldü. Dar ekran görüntüsü alındı. Üretim derlemesi ve PDF yazdırma bu görünüm düzenlemesinde yeniden çalıştırılmadı; masaüstü ve yazdırma sayfalaması ayrıca doğrulanacak. Mühendislik hesabı veya resmî onay iddiası yoktur.

Sonraki adım: kullanıcının rapor değerlendirmesine göre düzenleme ve dosya/PDF kontrolü.

## Brief tema renkleri — 2026-10-19

Kullanıcı turuncu vurguların temaya uymasını istedi. Yalnız yatırım briefi ekranında başlık, adım numarası, seçim işaretleri, onay kutuları, odak çizgileri ve ana düğme orman yeşili paletine geçirildi. Seçili seçenekler açık yeşil zeminle, rapordaki açık konular muted yeşil çizgi ve metinle gösterilir. Hesap ve form mantığı değişmedi. Sonraki adım: kullanıcı görünüm değerlendirmesi.
Kontrol: dar ekran tarayıcı görünümünde seçimler, kutular ve ana düğme yeşil olarak doğrulandı; mevcut girdilerle rapor yeniden oluşturuldu ve 76/100 sonucu korundu. Yalnız CSS değiştiği için hesap testleri ve derleme tekrarlanmadı.

## PIR → GIS devam düğmesi — 2026-10-19

Kullanıcının istediği “Parsel ve arsa aşamasına devam et” düğmesi brief raporuna eklendi. `/arsa-fizibilite-studyosu#geo-studyo` çalışma alanına yönlendirir. Yeşil demo temasına ve dar ekrana uyar; yazdırılan raporda gizlenir. Mevcut rapor, kayıt ve çıktı araçları korundu. Bu değişiklik gezinme bağlantısıdır; brief alanlarının GIS girdilerine eşlenmesi ve aktarımın uçtan uca doğrulanması henüz tamamlanmış sayılmaz. Sonraki adım: bu veri devrini bağlayıp doğrulamak.
Kontrol: devam bağlantısının raporda göründüğü, dar ekran yerleşimi ve href hedefi tarayıcıda doğrulandı. Bu gezinme eklemesinde hesap testleri ve derleme tekrarlanmadı.

## Çoklu proje listesi — 2026-10-19

Dayanak: kullanıcı dijital proje merkezinin üstünde oluşturulan projelerin kayıtlarının tutulmasını istedi.

Yapılan iş: başlangıç sayfasına Projelerim, yeni proje adı/oluşturma formu, kayıtlı proje adı, son kayıt zamanı, veri bulunan modül sayısı ve Projeyi aç eklendi. Modül sayısı tamamlanma/onay değildir. Mevcut aktif proje ve doğrulanabilen son yedeği yeni yerel listeye aktarılır. Proje kimliğiyle güncellenir; listeye yinelenen proje eklenmez. Yeni proje oluşturma ve proje açma öncesi mevcut proje saklanır. Eski tarihli yedek daha yeni liste kaydının üzerine yazmaz. Liste anahtarı `arkem-demo-v177-projects`, yedeği `arkem-demo-v177-projects-backup` olur. Bozuk kayıt/yedek ve kapasite hataları görünür; mevcut liste boş veriyle değiştirilmez.

Brief: seçilen proje kimliğine göre form yeniden kurulur ve readinessScreening.input alanları geri yüklenir. Seçenekler ortak brief-draft tanımlarından doğrulanır. Hesap kuralları değiştirilmedi. Briefte açık proje adı görünür. Kaydedilmiş brief raporu yeniden oluşturularak görüntülenir; gönderilmeden formda yapılan değişiklikler bu çalışma kapsamında ayrıca otomatik taslaklaştırılmaz. Sunucu/hesap senkronu eklenmedi; kayıt bu tarayıcı/origin ile sınırlıdır.

Kontrol: 31/31 test geçti (project-library, demo, customer-journey, hardening). Çoklu kayıt, güncelleme, eski verinin yeni kaydı ezmemesi, yedekten kurtarma, bozuk kaydı koruma, kota hatası ve brief değerlerini geri yükleme test edildi. TypeScript --noEmit geçti. Üretim derlemesi ve Worker paket doğrulaması geçti; sonrasında boş/bozuk liste için hata gösterimi iyileştirildi ve TypeScript/testler tekrar geçti. CRLF dikkate alınan diff --check temiz.

Tarayıcı: mevcut DEMO — Kastamonu Konut projesi (600 m²/Kastamonu) listeye geldi. Ayrı TEST — Proje kayıt kontrolü oluşturuldu; Ankara/320 m², çelik ve bütçe önceliğiyle brief üretildi (68/100). Projeler arasında geçildi, liste yenilendi ve iki projenin alanları karışmadan geri geldi. Mevcut Kastamonu projesi yeniden açık seçildi; başlangıç sayfasında bırakıldı. TEST kaydı açık adıyla yerel listede duruyor. İlk geliştirme HMR güncellemesinde Provider hatası görüldü, temiz yenilemeyle akış çalıştı. Dar ekran görüntüsü alındı.

Açık işler: bulut/cihazlar arası kayıt bu demo kapsamına dahil değil. On üç modülün tüm devir ve geri yükleme senaryoları henüz test edilmedi. Sonraki adım: PIR → GIS veri eşlemesini ve sonraki modül geçişlerini doğrulamak.
