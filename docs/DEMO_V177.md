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

## PIR kartı hazır etiketi — 2026-10-19

Kullanıcının onayıyla PIR kartına “Hazır” etiketi ve “Demo akışı ve örnek çıktılar doğrulandı” notu eklendi. Önceki dosya/PDF testi bekliyor notu, kullanıcının sunduğu PDF/TXT/JSON örneğinin içerik ve görsel kontrolü tamamlandığından kaldırıldı. Dayanak: brief formu, rapor ve kopyalama tarayıcı kontrolleri, 24 test/derleme kaydı; çıktı incelemesi için output/ARKEMX_Brief_Cikti_Kontrolu_2026-10-19.md. Etiket demo kapsamındaki hazır olmayı belirtir; tüm senaryolar veya resmî mühendislik onayı değildir. Sonraki adım PIR → GIS veri aktarımını bağlayıp test etmek; hazır etiketinden modüller arası aktarımın tamamlandığı sonucu çıkarılmamalıdır.
Kontrol: PIR kartındaki Hazır etiketinin ve demo doğrulama notunun görünürlüğü tarayıcıda doğrulandı; kart brief ekranını açıyor. Bu etiket değişikliğinde hesap testleri tekrarlanmadı.


## GIS demo ve PIR veri devri — 2026-10-19

Dayanak: kullanıcı hazır PIR kartından sonraki modüle geçilmesini istedi.

Yapılan iş: GIS sayfası sadeleştirildi. Kayıtlı briefin bölgesi, kullanım amacı, hedef yapı alanı ve sistem tercihi görünür; hedef yapı alanı arsa alanı veya imar hakkı olarak kullanılmaz. Yeni projede bölge/kullanım/sistem hedefleri aktarılır; mevcut parsel kimliği, sınırı ve imar kanıtları değiştirilmez. Değişen brief için açık bir güncelleme düğmesi vardır. Arsam var mevcut harita/parsel stüdyosunu açar; Arsa arıyorum ayrı bölge/arsa alanı/bütçe ölçütlerini kaydeder. Ölçüt kaydı ilan getirmez ve seçilmiş arsa sayılmaz. MAS bağımsız /hizli-yerlesim rotasına taşındı; GIS açılırken MAS varsayılanlarının kaydedilmesi önlendi. Sonraki modül bağlantısı eklendi.

Kontrol: 29/29 test geçti (brief-site-context, project-library, module-workspaces, parcel-zoning-scope, parcel-journey-gates). Brief eşlemesi, mevcut parseli koruma, belirsiz sistem/alan, ölçüt doğrulaması, proje izolasyonu ve mevcut parsel geçiş kapıları kontrol edildi. Tarayıcıda Kastamonu/Merkez, 600 m² brief özeti görüldü; ters alan aralığı reddedildi; 700–900 m² / 2.000.000 TL deneme ölçütleri kaydedilip yenilemede korundu. Arsam var akışında Kastamonu/Merkez otomatik seçildi, 197 mahalle/köy listesi ve Leaflet haritası açıldı. Parselsiz projede ileri parsel adımları kilitli kaldı. Aktif demo proje Arsa arıyorum görünümünde bırakıldı. Dar ekran görüntüsü: output/ARKEMX_GIS_Demo_2026-10-19.png (çalışma alanı kökünde).

Açık işler: gerçek ada/parsel sorgusu, sınır geometrisi ve GIS çıktıları bu adımda uçtan uca doğrulanmadı; GIS kartı kısmen test edildi olarak işaretlidir. Otomatik ilan servisi bağlı değildir. Sonraki adım MAS kavramsal yerleşiminin bu proje bağlamıyla çalışmasını ve çıktısını test etmek. Bu kayıt resmî teknik onay değildir.
Son doğrulama: TypeScript --noEmit çıkış 0; üretim derlemesi ve Worker artifact doğrulaması çıkış 0. GIS değişiklikleri demo/v177-2026-10-18 dalına kaydedildi.


## Arsam var ekranının sadeleştirilmesi — 2026-10-19

Dayanak: kullanıcı mevcut Arsam var ekranını daha anlaşılır hale getirmeyi istedi. Brief özeti bu görünümde açılır hale getirildi; konum özeti kapalıyken de görünür. Yinelenen çıktı tanıtımı sınır hazır olana kadar gösterilmez. Dört adım çubuğu dar ekranda kısaltıldı, ana form yukarı alındı; ileri/geri gezinme ve kaynak kaydı ayrıntıları çalışma alanının altına taşındı. Form Konum ve Tapu bilgileri olarak ayrıldı; seçime göre eksik sonraki bilgiyi açıklayan durum metni eklendi. Sorgu açıklaması açılır bölüme alındı. Uzman araçları, kaynak açıklamaları, harita, sorgu işleyicileri ve parsel/imar geçiş kapıları korundu. Yeşil tema ve dokunma alanları düzenlendi.

Kontrol: 28/28 test geçti (location-directory-ui, parcel-journey-gates, parcel-zoning-scope, parcel-customer-workflow). TypeScript --noEmit çıkış 0, CRLF uyumlu diff kontrolü temiz. Dar ekran tarayıcıda briefin katlı hali, adımlar, konum/tapu formu ve açıklamalar incelendi. Kuzeykent + 123/4 yalnız form denemesi olarak girildi: sorgu düğmesi açıldı ve hazır yönlendirmesi göründü; sorgu yapılmadan deneme girdileri temizlendi. Eksik mahallede düğme tekrar kapandı ve ilgili yönlendirme geldi. Aktif proje Kastamonu/Merkez, boş mahalle/ada/parsel ile Arsam var görünümünde bırakıldı. Görüntü: çalışma alanı output/ARKEMX_Arsam_Var_Sade_Form_2026-10-19.png.

Açık işler: bu düzenleme gerçek ada/parsel sınırı veya imar çıktısı doğrulaması değildir. Canlı parsel sorgusu ve çıktılar için gerçek bir örnekle ayrı test gerekir. Sonraki adım kullanıcının ekran değerlendirmesi ve GIS → MAS veri devridir.
Son kontrol: üretim derlemesi ve Worker artifact doğrulaması çıkış 0. 479 px tarayıcı görünümünde sayfa genişliği 479 px; yatay taşma görülmedi. Sorgu açıklamasının açılıp kapandığı doğrulandı.

## Projelerim — kayıt doğrulama düzeltmesi — 2026-10-19

Dayanak: Kullanıcının Projelerim ekranında “Proje kaydı geçerli değil.” uyarısıyla karşılaşması; yeni proje oluşturma ve kayıtlı projeyi açma akışları mevcut projenin kütüphaneye kaydedilmesine bağlı. Hata ifadesi `saveLibraryProject` doğrulama kapısından gelir. Hangi tarayıcı veri alanının bu hataya yol açtığı henüz örnek kayıt üzerinde teşhis edilmedi.

Yapılan iş: `app/lib/project-library.ts` içinde kütüphaneye kaydetmeden önce gerçek JSON saklama temsilinin doğrulanması sağlandı. Bellekte bulunan, JSON'a yazılmayan isteğe bağlı `undefined` nesne özellikleri geçerli projeyi yanlışlıkla engellemez. Geçersiz kimlik/şema/modül bağlantısı yine reddedilir; sonlu olmayan sayılar veya JSON dışında kalan işlev/symbol/bigint değerleri sessizce değiştirilmez, kayıt reddedilir. Geçersiz kayıt durumunda mevcut kütüphane ve yedek üzerine yazılmaz.

Test kapsamı: `tests/project-library.test.mjs` içine JSON'da atlanan `undefined` alanlar, güvenli kayıt ve geçersiz sayı/başka projeye ait modül kaynak damgası için regresyon testleri eklendi. Kaynak metin kontrolleri olumlu; bu oturumda Node test koşumu, TypeScript derlemesi veya yerel tarayıcı testi yapılmadı. GitHub commit durumunda otomatik kontrol bulunmuyor.

Açık işler: Kullanıcının gerçek yerel proje verisinde doğrulama nedeninin saptanması; Projelerim ekranında yeni proje açma/oluşturma, yenileme ve altı modül verisinin korunması senaryolarının manuel doğrulanması. Resmî teknik onay değildir.

## GIS sade arayüz + Projelerim kayıt düzeltmesi tek branch'te — 2026-10-19

Dayanak: Kullanıcı sade GIS tasarım görselini onayladı, ardından `demo/v177-2026-10-18` branch'ini tek hedef olarak belirledi ve kayıt düzeltmeleriyle birlikte çalışmasını istedi. Bu kayıt yalnız erişilebilir kaynak kodu ve GitHub commit'lerinin kapsamını belirtir.

Yapılan iş: Önceden commit edilmiş Projelerim JSON kayıt doğrulama düzeltmeleri korunarak aynı branch'e sade GIS arayüzü işlendi. Sayfa başlığı “Parsel ve arazi incelemesi” oldu; proje/brief şeridi, dört adımlı iş akışı, il–ilçe–mahalle/ada/parsel formu, görünür KML/GeoJSON aktarımı, harita/3B/koordinat sekmeleri, Sokak/Esri Uydu/Esri Topoğrafik altlık seçenekleri, kaynak/durum özeti, teknik dosya ve sonraki modül kartları düzenlendi. Karmaşık veri kaynağı, 3B katman ve uzman seçenekleri silinmeyip açılır bölümlerde korundu. Yeni stil dosyası `app/gis-approved-design.css` yalnız GIS rotasına kapsamlı seçicilerle uygulandı.

Arazi modelinde geçerli/parsel kimliğiyle eşleşmiş sınır varsa bina seçilmemiş olsa da 3B kavramsal önizleme açılabilir; bina yokken yapı ve hafriyat sonuçları üretilmez. Geçerli sınır yokken eksik veri bildirimi gösterilir. Esri altlıkları yalnız görsel zemin sağlar; kadastro, kot, imar veya teknik onay kanıtı değildir. TKGM kimlik ve kaynak doğrulama kapıları korunmuştur. Kayıt düzeltmesindeki geçersiz proje reddi ve yedek koruması değiştirilmedi.

Kontrol: GitHub kaynak metni üzerinde 20/20 bütünlük ve 48/48 kaynak şartı eşleşmesi olumlu. `tests/gis-approved-design-ui.test.mjs` eklendi; `tests/parcel-refinement.test.mjs` harita görselleştirmeyi uydurma idari veriyle karıştırmayacak şekilde güncellendi. Bunlar bu oturumda çalıştırılmış Node/TypeScript/production testleri değildir. Gerçek uydu/topoğrafik karo yüklenmesi, tablet/mobil responsive, TKGM canlı parsel sorgusu ve GIS çıkışları tarayıcıda doğrulanmadı.

Açık işler: `node --test tests/project-library.test.mjs tests/gis-approved-design-ui.test.mjs tests/parcel-refinement.test.mjs`, `npx tsc --noEmit`, üretim derlemesi ve masaüstü/mobil kabul testi; kullanıcı yerel proje arşivinde eski 6 modül kaydının korunmasının doğrulanması. Yetkili resmî teknik onay yok.
