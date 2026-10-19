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


## Referansa göre parsel/arsa paneli — 2026-10-19

Dayanak: kullanıcı Parsel ve Arazi İnceleme Paneli.png görselini esas almayı ve düğmelerin yeşil olmasını istedi. Mevcut kodun son GIS iyileştirmeleri korundu. Üst başlık ve proje/brief satırı yenilendi; solda form, sağda harita ve teknik çıktılar, altta sonraki modüller kuruldu. Sokak/Uydu/Topoğrafik görünüm düğmeleri, 3B/koordinat sekmeleri, ölçek, odak ve katman düğmesi görünür hale geldi. KML/GeoJSON aktarımı formda doğrudan erişilebilir. Dört mevcut çıktı türü korundu; kaynak sınırı yokken indirme ve devam kapıları açılmaz. Yeni CSS yalnız demo GIS sayfasına uygulanır.

Bulunan hata: altlık temizliğinde layer.off() önce çalışınca Leaflet map dinleyicileri kalıyordu; remove/off sırası düzeltildi. Uydu native zoom 18 yapıldı; aşırı yakınlaştırmada boş görüntü yerine mevcut çözünürlük kullanılır. Kayıtlı Budamış 210/15 verisi korundu; referansın Kuzeykent 218/11 örneği kaydedilmedi.

Kontrol: 31/31 GIS, konum, parsel akışı ve imar kapsam testi geçti. TypeScript ve üretim/Worker derlemesi başarılı. Eski arazi testi, önceki arazi önizleme düzeltmesindeki bağımsız terrainPreviewReady ve hasBuilding kapılarını kontrol edecek şekilde güncellendi. Tarayıcıda altlık değişimleri, odaklama, katman aç/kapa, 3B, koordinatlar ve KML kartından indirme doğrulandı. 375 px mobil genişlikte yatay taşma yok. Son etkileşim aralığında konsol hatası yok. Görsel karşılaştırma ve sınırları design-qa.md kaydında; ekranlar çalışma alanı output/ARKEMX_Parsel_Panel*.png altında. Test viewport değişikliği kaldırıldı.

Açık işler: bu çalışmada yeni canlı TKGM sorgusu yapılmadı; mevcut kaynak sınırı kullanıldı. PDF/DXF içerikleri tekrar incelenmedi. Uydu çözünürlüğü kaynak ve bölgeyle sınırlı. GIS modülünün tüm senaryolarının tamamlandığı veya resmî teknik onay alındığı anlamına gelmez. Sonraki adım: kullanıcı görsel değerlendirmesi ve GIS → MAS veri devri.


## İmar ön incelemesi — 2026-10-19

Dayanak: kullanıcı 2026-10-19 sistem/arayüz incelemesindeki önerileri uygulamayı onayladı.

Yapılan iş: imar adımı harita yan sütunundan ayrıldı. Belgem var / Resmî kaynağı bul / İmar bilgisi olmadan devam et yolları eklendi. Geniş ana panelde belge referansı ve tarihi, imar koşulları, alan özeti ve kayıt; sağda kaynak sınır alanı, net imar alanı, brief hedefi ve belge durumu var. Mobil tek sütun. Teknik çıktılar ve sonraki modül kartları bu adımda ana formu daraltmaz. Belge dosyası yüklenmez; yalnız referans tutulduğu açıkça yazılıdır.

Belge referansı/tarihi imar taslağının parsel kapsamına taşındı; kaynak bağlantısı tek alanda. Kaynak alanları değişince belge eşleşmesi ve kullanıcı girdi kontrolü geçersizleşir. Belge eşleşmesi kaynak CRS, geometri kaynağı/tarihi ve mevcut sınır kaydı anahtarına bağlıdır. Emsal tek yerde girilir; alan cetveli aynı değeri ve belge kaynağını kullanır. Geometri alanı net alana otomatik yazılmaz. Alan bilgisi yokken dört büyük boş sonuç kutusu yerine tek açıklama var. Ayrıntılı kat/mahal cetveli isteğe bağlıdır; belge/kaynak yolları arasında geçişte belge formu unmount edilmez, kaydedilmemiş satırlar korunur.

Kayıt: ana eylem taslağı kaydeder; sınır, kaynak tarihi/referansı, mevcut sınır eşleşmesi, net alan/dayanak ve imar girdi kontrolü eksikse eksikleri listeler, hesaplı yerleşime geçmez. Eksikler tamamlandığında mevcut design adımını açar. İmar bilinmiyorsa ayrı kavramsal yol korunur. Kullanıcı kontrolü uzman/idare onayı değildir. Önceki imar koşulları geri yüklenir; yeni belge eşleşmesi açıkça tekrar istenir.

Demo: MunicipalPlanResearch demo bayrağını kontrol ederek otomatik POST göndermeden doğru durum metnini gösterir. API istemcisi ayrıca 403/demo:true yanıtını ayrı demo-disabled durumuna çevirir; sahte parsel eşleşme hatası üretmez. Genel API POST engeli kaldırılmadı; kapsam doğrulaması ve bilinmeyen kaynakları reddetme korumaları devam eder.

Kontrol: 53/53 test geçti (zoning-review, municipal-plan-research, parcel-enhancements, parcel-zoning-scope, gis-map-terrain-ui, project-library). Belge tarihi, güncel kaynak/sınır eşleşmesi, eski taslağı koruma, demo 403 ile gerçek kapsam hatasını ayırma ve veri onayını yükseltmeme test edildi. TypeScript --noEmit ve üretim/Worker derlemesi başarılı. Sonrasında yalnız açıklama ve CSS durum metni düzenlendi; diff kontrolü temiz.

Tarayıcı: masaüstü formu 947 px, viewport 1351 px, yatay taşma yok; önceki form 392 px idi. Demo kaynak mesajı doğru. Ayrı TEST — Proje kayıt kontrolü projesinde Ankara/Çankaya/100.Yıl 1/2 sentetik kimliği kullanıldı, parsel sorgusu yapılmadı. TEST olarak işaretli belge referansı, 2026-10-19 tarihi, 1000 m² net alan, 1.20 emsal girildi; 1200 m² aritmetik kapasite görüldü. Eksik kaynak sınırı/koşullarla taslak kaydedildi ama yerleşim açılmadı. Belge referansı/net alan/emsal yenilemede korundu; tarih ayrı giriş ve kayıtla kontrol edildi. 375 px mobilde sayfa genişliği 375 px. Asıl DEMO — Kastamonu Konut projesi geri açıldı; sentetik girdiler bu projeye aktarılmadı. Geliştirme güncellemesi sonrası proje açmada ilk denemede doğrulama hatası görüldü; temiz proje listesi yenilemesinden sonra iki proje açıldı. Bu geçici geliştirme durumunun nedeni ayrı stabilizasyon incelemesinde doğrulanabilir.

Kanıt: çalışma alanı output/ARKEMX_Imar_On_Inceleme_2026-10-19.png ve output/ARKEMX_Imar_Yeni_Mobil_2026-10-19.png. Test viewport ayarı kaldırıldı. Kod incelemesinde hook sırası, form etiketleri, kontrollü girdiler, parsel anahtarıyla state izolasyonu ve kaynak değişiminde kontrol iptali gözden geçirildi.

Açık işler: canlı belediye sorgusu demo modunda kapalıdır. Belge içeriği/uzman onayı eklenmedi. Tam koşullarla gerçek proje üzerinden yerleşim ve PDF/DXF içeriklerinin uçtan uca doğrulaması sonraki adımdır; bu kayıt resmî teknik onay değildir.


## Yerleşim ve çıktılar düzeni — 2026-10-19

Dayanak: kullanıcı paylaştığı 4. adım ekranlarının önceki imar adımıyla aynı sade, yeşil ve anlaşılır düzende düzenlenmesini istedi.

Yapılan iş: seçili yerleşim, brüt alan, boyutlar ve çalışma dayanağı üstte tek özette toplandı. Kullanım, taşıyıcı sistem, genişlik/derinlik ve kat alanları harita yanındaki düzenleme paneline taşındı. Yön, konum, ön cephe ve otopark aynı panelde açılır ayrıntı olarak korundu. Alttaki ikinci düzenleme alanı ve eski yinelenen alternatif paneli kaldırıldı. Üç alternatiften sonra PDF/DXF/KML çıktı kartları, ardından sonraki modül bağlantıları gelir. Alternatif çizimleri gerçek geometri üzerinden devam eder; renkleri yeşil temaya uyarlandı. Yalnız parsel durumunda seçili alternatif işareti gösterilmez ve yapı düzenleme alanları kapanır. Geçersiz yerleşimde alanlar düzeltmeye açık kalır; uygun olmayan yapı geometri çıktısına eklenmez. Mevcut hesap, parsel kapsamı, kavramsal çalışma ve dışa aktarma korumaları değiştirilmedi.

Kontrol: 45/45 test başarılı (parcel-customer-workflow, parcel-enhancements, parcel-zoning-scope, gis-map-terrain-ui, parcel-journey-gates, zoning-review). Önceki imar bileşeni ayrımından kalan bir kaynak-konumu testi yeni bileşene yönlendirildi. TypeScript --noEmit ve üretim/Worker derlemesi başarılı; sonrasında yalnız genişlik/derinlik alanlarının adımı .01 olarak ayarlandı. Diff kontrolü temiz.

Tarayıcı: DEMO — Kastamonu Konut üzerinde genişlik 29.6 m'den 28 m'ye değiştirilince Özel ölçüler ve 1057.3 m² brüt alan görüldü; seçili alternatif işareti kalktı. Dengeli kütle seçilince 24.26 × 17.97 m / 2 kat ve 871.9 m² görüldü. Yapı kaldırılınca yalnız parsel açıklaması, sıfır seçili alternatif ve kapalı ölçü alanları doğrulandı. Sonunda ilk Geniş taban seçimi geri yüklendi (29.6 × 18.88 m / 2 kat; 1117.7 m²). Yeni sekmede aynı kayıt geri geldi. Masaüstü 1351/1351, tablet 805/805, mobil 375/375 px sayfa/kaydırma genişliği: yatay taşma yok. Mobil alternatifler tek sütun ve çıktılardan önce; masaüstünde üç sütun. Kontrollü input etiketleri, fieldset kapıları ve kaynak durumları gözden geçirildi; test viewport ayarı kaldırıldı.

Geliştirme sunucusu: yeni CSS importu ve derleme sonrasında geliştirme önbelleği çakışması görüldü; yalnız bu repo için 5175 sunucusu --force ile yeniden başlatıldı ve temiz sekmede etkileşimler çalıştı. Tarayıcı ekran görüntüsü API'si yeni sekmelerde Unable to capture screenshot döndürdüğünden bu adımın görsel kanıt dosyası üretilemedi; tarayıcı kontrolü DOM, ölçüler, hesaplanmış stiller ve kullanıcı etkileşimleriyle yapıldı. Görsel ekran görüntüsü incelemesi doğrulanacak.

Açık işler / sonraki adım: tam belgeye dayalı imar koşullarıyla yerleşim ve indirilen PDF/DXF içerikleri ayrıca uçtan uca incelenecek. Bu düzenleme hesaplı imar onayı veya 13 modülün tamamlandığı anlamına gelmez. Sonraki modüle aynı parsel/yerleşim kaydının aktarımını birlikte denemek.


## Kaynak bölümünün sadeleştirilmesi — 2026-10-19

Dayanak: kullanıcı büyük Parsel veri merkezi panelinin kaldırılması, kaynak bilgisinin küçük bir açılır alanda korunması ve resmî bağlantıların imar adımına alınması önerisini onayladı.

Yapılan iş: tekrar eden parsel/alan/proje kartları ve koyu kaynak şeridi kaldırıldı. Kaynak ayrıntıları altında geometri kaynağı, kurum ve kaynak zamanı gösterilir; zaman Europe/Istanbul olarak biçimlenir, örnek veri sorgu yapılmış gibi sunulmaz. TKGM, e-Plan, belediye ve e-Devlet bağlantıları İmar bilgisi → Resmî kaynağı bul bölümüne taşındı. Uzun alt metin kısa ön inceleme notuyla değiştirildi. Proje state'i, provenance, hesaplar ve rapor/export üretimi değiştirilmedi.

Kanıt: 38/38 ilgili test ve TypeScript --noEmit başarılı; diff kontrolü temiz. Tarayıcıda kaynak ayrıntıları açılarak kurum/tarih okundu, imar adımına dönüş ve dört resmî bağlantı doğrulandı; büyük panel metni bulunmuyor. Mobil görünüm ekran görüntüsü çalışma alanı output/ARKEMX_Kaynak_Ayrintilari_2026-10-19.png dosyasına kaydedildi ve görsel olarak incelendi.

Açık işler: bu değişiklik için üretim derlemesi ve indirilen dosyaların içerik incelemesi tekrarlanmadı; hesap/export kodunda değişiklik yok. Sonraki adım aynı proje verisiyle sonraki modül aktarımını denemek. Bu çalışma resmî teknik onay değildir.


## GIS boş ana harita — kapanış doğrulaması, 2026-10-19

Durum: mevcut yerel sürümde yeniden test edildi; boş ana harita açık işi kapatıldı. Dayanak: kullanıcı sorunun düzeldiğini bildirerek test ve kapanış istedi.

Tarayıcı kontrolü: DEMO — Kastamonu Konut, Kastamonu/Merkez/Budamış 210/15 kaydında sokak altlığı, ana parsel poligonu/köşe noktaları ve seçili yapı görünür. İki kademe uzaklaştırınca yol/dere/çevre altlığı da görüldü. Uydu görünümüne geçiş ve uydu üzerinde parsele odaklanma başarılı. Tam sayfa yenilemesinden sonra kayıt tekrar açıldı; sokak altlığı, parsel ve yapı yine görünür, parsele odaklanma çalışıyor. Test aralığında yeni tarayıcı konsol hatası yok.

Kod kontrolü: gis-map-terrain-ui 3/3 test geçti. Bu tur uygulama koduna düzeltme yapılmadı; çalışma dalı fix/gis-harita-arazi-onizleme-2026-10-19, uygulama kodu 5d22dd4. Önceki boş görünümün kök nedeni doğrulanmadı; kapanış mevcut sürümde sorunun tekrarlanmaması ve görsel/etkileşim kanıtlarına dayanıyor. Uydu görüntüsü yakın ölçekte düşük çözünürlüklü olabilir; görüntü kalitesi ayrı bir konudur.

Kanıt: çalışma alanı output/gis-harita-kapanis-2026-10-19/ altında 01-sokak.png, 02-sokak-cevre.png, 03-uydu.png, 04-uydu-odak.png, 05-yenileme-sonrasi.png; dosyalar açılarak incelendi.

Kapsam sınırı: yalnız boş harita işi kapandı. Bu kontrol GIS modülünün tamamı, çıktı dosyaları, resmî kadastro/aplikasyon doğruluğu veya teknik/idari onay anlamına gelmez. Sonraki adım MAS modülünde brief/GIS girdilerinin örnek başlangıç değerleri yerine kontrollü aktarımı.


## MAS — GIS kaynaklı karşılaştırma başlangıcı, 2026-10-19

Dayanak: kullanıcı GIS boş harita işi kapandıktan sonra MAS modülüne geçilmesini istedi. İlk kontrolde proje adı doğru olmasına rağmen eski MAS formunun 46×72 m sentetik parsel, Sanayi/Depo, Yapısal Çelik ve .60/1.20/12.5 imar varsayımlarıyla otomatik kayıt ürettiği görülmüştü.

Yapılan iş: demo MAS ekranı brief/GIS bilgileri, çalışma dayanağı, üç geometri tabanlı alternatif ve açık kayıt/JSON akışıyla değiştirildi. Eski SiteIntelligenceStudio demo dışı kullanım için korundu. Yeni akış varsayılan sentetik dikdörtgen veya sistem seçmez; güncel projeye bağlı GIS kaynak sınırını yeniden doğrular. Kayıtlı parsel kimliği, kaynak kimliği, ham sınır, CRS, geçerli geometri ve kaynak türü kontrol edilir. Örnek, koordinat çevresi, kimliği eksik/çelişkili veya değişmiş kaynak kabul edilmez.

Üç alternatif mevcut createParcelConcept/createZoningMassingModel motorlarını ve ParcelAlternativePreview geometri çizimini kullanır. Kaynak sınır alanı, PIR hedefi ve GIS seçimi ayrı tutulur; kartlarda hedefe fark gösterilir. Kullanıcı kavramsal modu açıkça seçer. İmar modu yalnız güncel geometriyle eşleşmiş belge/tarih/net alan/koşul kontrolü tamam ise açılır. Bilinmeyen imar alanları doldurulmaz. Kat yüksekliği GIS'ten gelir, eksikse 3.4 m açık tasarım varsayımıdır; cephe yönü düzenlenebilir.

Kayıt: açılışta otomatik quick-site-scenario yazımı yok. Kaydetmeden seçimler yereldir; eski MAS kaydı üzerine yazılmaz. Seçim açık kaydet eylemiyle ARKEM-MAS/1 olarak aynı projede tutulur, GIS veya mimari program değiştirilmez. Geri yükleme proje/kaynak/brief imzasını, sonuç geometrisini ve onay statüsünü doğrular; eski sentetik veya değişmiş sonuç kayıtları uygulanmaz. JSON snapshot'ı undefined koordinat alanları içermez ve tam JSON round-trip testinden geçer. Mimari programa bağlantı ancak güncel seçim kaydedilmişse görünür. Bu bağlantı sonraki modülün girdilerini otomatik değiştirmez.

Arayüz: yeşil/beyaz tema, tek proje özeti, üç kart ve kayıt alanı. Eski 7 adımlı teknik başlık demo MAS'ta kullanılmaz. İletişim katmanı bu demo sayfasında gizlendi; kartları örtmez. Modül merkezi MAS notu doğrulanan akışa göre güncellendi; tüm modül Hazır olarak işaretlenmedi.

Kontrol: 24/24 massing-workspace, parcel-customer-workflow ve zoning-review testi geçti. Kaynak sınırını koruma, yanlış kimlik/CRS/örnek kaynağı engelleme, kavramsal sonuçta imar uydurmama, farklı proje/eski kaynak/tahrif edilmiş sonucu reddetme ve geçerli kaynaklı imar modu test edildi. TypeScript --noEmit ve üretim/Worker derlemesi başarılı; derlemeden sonra yalnız modül notu ve iletişim görünürlük listesi düzenlendi. Hook sırası, proje/kaynak anahtarıyla state izolasyonu, etiketler, düğme kapıları ve JSON güvenliği React kontrolünde incelendi. Diff kontrolü temiz.

Tarayıcı: DEMO — Kastamonu Konut için Budamış 210/15 kaynak sınırı 1597.8 m², brief hedefi 600 m² ve GIS seçimi 1117.7 m² doğru geldi. Kavramsal üç alternatif 1117.7 / 871.9 / 648 m²; hedef farkları +517.7 / +271.9 / +48 m² gösterildi. GIS ile aynı Geniş taban MAS'a kaydedildi; yenilemede geri geldi. JSON indirilip dosya okundu: doğru proje/kimlik, 5 sınır noktası, 4 yapı noktası, authoritative:false, zoningPending:true ve planning:null. GIS girdileri değiştirilmedi. Masaüstü 1351/1351 px ve mobil 375/375 px sayfa/kaydırma genişliği; taşma yok. Viewport ayarı kaldırıldı. Kanıtlar çalışma alanı output/ARKEMX_MAS_Yeni_Masaustu_2026-10-19.png, ARKEMX_MAS_Yeni_Mobil_2026-10-19.png ve ARKEMX_MAS_Karsilastirma_2026-10-19.png; kaydedilip açılarak incelendi.

Açık işler / sonraki adım: belgeye dayalı imar modunun gerçek projede tarayıcı testi bekliyor. Kaynak parsel yokken bu yeni demo akışı geometri hesabı üretmez; arsasız bağımsız senaryo ayrıca ele alınacak. MAS seçiminden ARC girdilerine kontrollü aktarım sonraki adımdır; mevcut mahal programı otomatik ezilmedi. Bu tur MAS'ın tüm işlevlerinin veya 13 modülün tamamlandığı iddiası değildir; teknik/idari onay verilmedi.

## MAS → ARC kontrollü aktarım — 2026-10-19

Dayanak: kullanıcı MAS sonrasında sıradaki adıma geçilmesini istedi. Yapılan iş: mimari programa mevcut girdiler ile kayıtlı MAS seçimini karşılaştıran yeşil/beyaz aktarım paneli eklendi. Alan, kat, kat yüksekliği, plaka oranı ve eşleşen kullanım yalnız açık uygulama düğmesiyle alınır; mahal türleri, adetleri, alanları ve komşuluk kayıtları korunur. Proje değişiminde mimari yerel state proje anahtarıyla ayrılır; kayıt yüklenmeden otomatik yazılmaz.

Kaynak kontrolü: ARKEM-MAS-ARC/1 makbuzu proje, güncel brief/GIS/MAS imzası ve kütle geometrisine bağlıdır. Eski, farklı projeye ait veya değiştirilmiş kayıt uygulanmaz. Güncelliğini kaybeden kaynak şema hesabına katılmaz; çıktı ve H-02 sonraki aktarımı bekletilir. H-01 otomatik GIS aktarımı, açıkça uygulanmış MAS bağlantısını ezmez. Kavramsal çalışma authoritative:false / zoningPending:true olarak korunur; boyut sınırları sessizce kırpılmaz.

Kanıt: 29/29 mas-architecture, massing-workspace ve module-data-integrity testi geçti. TypeScript --noEmit, üretim/Worker derlemesi başarılı. React kontrolünde hook sırası, proje izolasyonu, açık eylemle aktarım ve erişilebilir düğme durumları incelendi.

Tarayıcı: DEMO — Kastamonu Konut / Budamış 210/15 için Geniş taban seçimi 1117.7 m², 2 kat, 4.5 m olarak uygulandı. Önce/sonra indirilen JSON karşılaştırmasında üç mahal türü ve üç komşuluk kaydı aynen eşit. Şema kütle bağlantısı true, resmî/onaylı kütle false. Sayfa yenilemesi ve GIS ekranını ziyaret edip ARC'ye dönme sonrasında uygulanmış bağlantı korundu. Masaüstü 1351/1351 px ve mobil 375/375 px sayfa/kaydırma genişliği; yatay taşma yok. Geçici viewport ayarı kaldırıldı. Kanıtlar: çalışma alanı output/ARKEMX_MAS_ARC_Aktarim_2026-10-19.png ve output/ARKEMX_MAS_ARC_Mobil_2026-10-19.png; kaydedilip açılarak incelendi.

Açık işler / sonraki adım: ARC'nin eski yoğun arayüzünü sadeleştirerek mahal programının yeni hedef alana uyumunu ve düzenleme/şema/çıktı akışını değerlendirmek. Belgeye dayalı imar modu ve tüm mimari işlevler bu tur uçtan uca doğrulanmadı. Bu kayıt 13 modülün tamamlandığı veya teknik/idari onay alındığı anlamına gelmez.

## ARC — sade mahal düzenleme akışı, 2026-10-19

Dayanak: kullanıcı mimari program ekranını sadeleştirip mahal düzenleme akışını denememizi istedi. Demo görünümünde tekrarlanan proje/teknik başlıkları ve tanıtım bölümleri kaldırıldı; MAS bağlantısı ile program ayarları/çıktılar açılır bölümlerde korundu. Mahal listesi ana içerik oldu. Yerleşim hedef brütü, mahal toplam neti, program brüt ihtiyacı ve hedefe kalan/aşan alan ayrı gösterilir. Altı tasarım sekmesi korunur; eski hesap motorları değiştirilmedi.

Düzenleme: mahal adı, zon, adet, birim alan kartlardan; günışığı/erişilebilirlik/yoğunluk ayrıntılardan düzenlenir. İsim değişiminde ilgili komşuluk uçları güncellenir. Silme ilgili ilişkileri kaldırır; son silme geri alınabilir. Arada yeni mahal eklenmiş olsa da geri alma çakışan kod üretmez. Boş/tekrarlanan isimler kontrol edilir; geçersiz mahal programı çıktıya ve otomatik sonraki aktarıma verilmez. Kullanım şablonunu uygulamadan önce mevcut listenin değişeceği açıklanır. JSON mevcut şemasını korur; CSV ortak güvenli alıntılama yordamını kullanır.

Komşuluk: demo bölümüne uç/öncelik seçimi ve ilişki ekleme/kaldırma eklendi. Mevcut Kastamonu kaydında Yaşam alanı, Banyo ve Ortak giriş gibi mahal listesinde olmayan eski uçlar bulundu; bunlar kendiliğinden eşleştirilmedi. Seçim alanında “listede yok” olarak gösterilir; geçersiz eşleşme gözden geçirilmiş olarak işaretlenemez. Eski beyanlar korunur; bu kontrol fiziksel yakınlık veya mühendislik onayı değildir.

Kanıt: 35/35 architectural-programme, mas-architecture, massing-workspace ve module-data-integrity testi başarılı. TypeScript --noEmit, üretim derlemesi ve Worker/artifact kontrolü başarılı. Derlemeden sonra yalnız ARC modül kartının doğrulama notu güncellendi. React kontrolünde anahtarlar, kontrollü alanlar, proje yükleme/yazma kapısı, etiketler ve geri alma bütünlüğü incelendi.

Tarayıcı: DEMO — Kastamonu Konut üzerinde geçici A-001 mahali eklendi, adı/2 adet/18.5 m² alanı düzenlendi; toplam 37 m² ve proje neti 341 m² oldu. Yenilemede değerler korundu. Mutfak adı geçici değiştirilince R-01 hedefi yeni adı izledi; sonra eski adına döndürüldü. Geçici mahal silindi/geri alındı; alanı 18.5 m² korundu. Boş isimde uyarı ve devam bağlantısı engeli doğrulandı. Yeni ilişki ekleme/kaldırma denendi. Tüm geçici veriler temizlendi; test öncesi/sonrası indirilen JSON karşılaştırmasında üç mahal, üç ilişki ve tüm mimari girdiler birebir eşit. Son net 304 m², hedef 1117.7 m² ve program brütü 422.2 m². CSV dosyası üç satır olarak tekrar okundu.

Responsive: masaüstü 1351/1351 px, tablet 805/805 px, mobil 375/375 px sayfa/kaydırma genişliği; taşma yok. Mobilde sekmelerin sabit yüksekliği başlıkla çakışıyordu; yükseklik otomatik yapılıp tekrar kontrol edildi. Mobil komşuluk alanı da 375 px sınırında kaldı. Geçici viewport kaldırıldı. Görsel kanıt: çalışma alanı output/ARKEMX_ARC_Mahal_Masaustu_2026-10-19.png ve output/ARKEMX_ARC_Mahal_Mobil_2026-10-19.png; kaydedilip açılarak incelendi.

Açık işler / sonraki adım: mevcut projenin üç komşuluk ilişkisindeki eksik mahal eşleştirmeleri kullanıcı tasarım kararı bekliyor. Plan şeması, alternatifler, cephe ve performans hesaplarının tamamı bu tur uçtan uca doğrulanmadı. Sonraki çalışma gerçek mahal programı/komşuluk kararlarını netleştirip plan aşamasına kontrollü devam etmek. Bu çalışma 13 modülün veya ARC'nin tüm işlevlerinin tamamlandığı ya da resmî teknik onay alındığı anlamına gelmez.

## ARC — eksik mahalleri ekleyerek komşuluk eşleştirme, 2026-10-19

Dayanak / karar: kullanıcı mevcut üç ilişkiyi eşleştirmeyi istedi; Banyo ve Ortak giriş listede bulunmadığı için seçenek soruldu. Kullanıcı açıkça “eksik mahalleri ekleyerek eski ilişki anlamlarını koruyalım” dedi. Yaşam alanı mevcut Salon ile eşleştirildi; Banyo ve Ortak giriş başka odayla değiştirilmedi.

Yapılan iş: DEMO — Kastamonu Konut projesinin bu tarayıcıdaki kaydına A-001 Banyo (Servis, 4 × 5 m²) ve A-002 Ortak giriş (Ortak, 1 × 12 m²) eklendi. Adet/alanlar kullanıcı tarafından verilmiş gereksinim veya doğrulanmış ölçü değildir; açıkça bildirilen, düzenlenebilir demo başlangıç varsayımlarıdır. Net toplam 304 → 336 m², program brüt ihtiyacı 466.7 m² oldu; hedef 1117.7 m² ve mevcut üç mahalin tüm değerleri korundu.

Üç ilişki: R-01 Salon ↔ Mutfak / Zorunlu; R-02 Yatak odası ↔ Banyo / Tercih; R-03 Ortak giriş ↔ Salon / Tercih. Üçü de inceleme bekleyen taslak olarak confirmed:false; otomatik onay verilmedi. Sayfa yenilemesinden sonra uçlar korundu, “listede yok” ve eksik eşleşme uyarısı kalmadı.

Teknik kanıt: uygulamadan önce/sonra indirilen arkem-mimari-sema (4).json ve (5).json karşılaştırıldı: mevcut üç mahal ve tüm mimari input değerleri birebir eşit; beş mahal türü, üç ilişki, sıfır kayıp/kendisine bağlı uç, sıfır gözden geçirilmiş işareti. Yeni kayıt çalışma alanı output/ARKEMX_ARC_Eslesmis_Mahal_Kaydi_2026-10-19.json dosyasına yedeklendi. Görsel output/ARKEMX_ARC_Uc_Komsuluk_Eslestirme_2026-10-19.png olarak kaydedilip açılarak incelendi; geçici viewport kaldırıldı. İlişki kartlarının footer alanına genel site footer'ının koyu arka plan/padding kuralları sızıyordu; yalnız bu bölümde transparan arka plan/sıfır padding ile düzeltildi. Üç kartta footer yüksekliği 44 px olarak doğrulandı.

Açık işler / sonraki adım: isim/uç eşleştirmesi tamamdır; kavramsal şemadaki fiziksel yakınlıklar sağlanmış değildir. İndirilen hesapta Salon–Mutfak 20.3 m, Yatak odası–Banyo 22 m, Ortak giriş–Salon 11.4 m ve üçü de satisfied:false. Sonraki adım plan yerleşiminde yakınlıkları düzenlemek; yeni mahal adet/alanları ve ihtiyaç etiketleri de tasarım incelemesi bekler. Bu çalışma resmî mimari/teknik onay değildir. Proje verisi bu tarayıcıdadır; kod deposuna proje verisi gömülmedi.

Doğrulama: bu tur uygulama hesabı değiştirilmedi; yalnız ilişki kartı CSS düzeltmesi için üretim/Worker derlemesi tekrar çalıştırıldı ve başarılı oldu. Diff kontrolü temiz.


## ARC — yakınlık hedeflerine göre kavramsal yerleşim, 2026-10-19

Dayanak: kullanıcı eşleştirilmiş ilişkilerin plan yerleşiminde sağlanmasını istedi. Eski motor günışığı isteyen mahalleri liste sırasıyla sabit çevre noktalarına dağıtıyor, ilişkileri yer seçerken kullanmıyordu. Ayrıca eski satisfied alanı hem mesafe hem confirmed gerektiriyordu; önceki kayıttaki üç false sonucu, üç mesafenin de hedef dışında olduğu anlamına gelmiyordu. Ayrı ölçümde başlangıçta Ortak giriş–Salon zaten kavramsal mesafe hedefindeydi (1/3), fakat inceleme 0/3 idi.

Yapılan iş: Plan şeması sekmesine açık “İlişkilere göre yerleştir” ve “Başlangıç dağılımına dön” eylemleri eklendi. input.layoutStrategy aynı proje kaydına alınır; eski kayıtlar başlangıç dağılımıyla açılır. Yeni yöntem zorunlu/tercih ağırlıklarıyla mahal türü sembollerini yeniden konumlandırır. Sınır, semboller arası boşluk ve çekirdek rezervleri korunur; günışığı isteyen semboller çevrede tutulur. İterasyonlar sınırlı ve deterministiktir. Değişen program/plaka/çekirdek girdileriyle yeniden hesaplanır; eski koordinat snapshot'ı uygulanmaz. 1–40 mahal/geçerli plaka sınırı ve yoğun yerleşimde açık başarısızlık/fallback var; başarısız yeni mod çıktıya/sonraki otomatik aktarıma verilmez.

Gösterim ve güven: withinTarget/geometricallySatisfied fiziksel merkez mesafesini, confirmed/satisfied kullanıcı gözden geçirmesini ayrı tutar. Eksik, kendisine bağlı veya aynı isimle belirsiz uçlar hedefi sağlamış sayılmaz. Eski karar skoru ve onay işaretleri otomatik yükseltilmez. Plaka oranı çizime uygulanır, sembol boyutları sabit sınırlarda çizilir; mobilde kodlar ve tam isimli anahtar listesi kullanılır. Çekirdek düğmeleri/plan lejandı yeşil temaya uyarlandı, global footer etkisi bu bölümde giderildi.

Tarayıcı: DEMO — Kastamonu Konut üzerinde yeni mod uygulandı. Salon–Mutfak 7.4/10.5 m; Yatak odası–Banyo 3.2/15.8 m; Ortak giriş–Salon 8.3/15.8 m. Mesafe hedefi 3/3, gözden geçirme 0/3. Yenilemede mod/konumlar korundu. Başlangıç dağılımına dönünce 1/3, tekrar uygulayınca 3/3 geldi. Önce/sonra JSON karşılaştırması: beş mahal, adet/alanlar ve üç ilişki birebir aynı; net 336 m², hedef 1117.7 m² aynı. Yeni kayıtta layoutStrategy:adjacency ve authoritative:false var. JSON çalışma alanı output/ARKEMX_ARC_Komsuluk_Yerlesimi_2026-10-19.json dosyasına yedeklendi.

Kanıt: 43/43 ilgili test, V113 mevcut şema regresyon testi (1/1), TypeScript --noEmit, üretim/Worker/artifact derlemesi ve diff kontrolü başarılı. Testler üç gerçek hedefi, alanları/kararları korumayı, sınır/çakışma/çekirdek kontrolünü, deterministik yeniden hesabı, belirsiz/eksik uçları, yoğunluk başarısızlığını, iç mahal ve farklı çekirdekleri kapsar. Masaüstü 1351/1351 px, mobil 375/375 px sayfa/kaydırma genişliği; beş gerçek DOM sembolü de plaka içinde ve birbirine çakışmıyor. Geçici viewport kaldırıldı. output/ARKEMX_ARC_Komsuluk_Yerlesimi_Masaustu_2026-10-19.png ve output/ARKEMX_ARC_Komsuluk_Yerlesimi_Mobil_2026-10-19.png kaydedilip açılarak incelendi. Derlemeden sonra yalnız ARC modül kartının doğrulama notu güncellendi.

Açık işler / sonraki adım: sonuç mahal türü düğümleriyle kavramsal yakınlık şemasıdır. Sembollerin çizim alanı gerçek oda alanı, çakışma testi de duvar/kapı/geçiş veya çıkış güvenliği doğrulaması değildir. Mahal adetlerinin katlara dağılımı, gerçek odalar/kapılar/duvarlar ve giriş/koridor bağlantıları ayrıca modellenmeli. Plan editöründeki mevcut elle düzenlenmiş nesneler bu tur yeniden yerleştirilmedi veya üzerine yazılmadı; şema aynı proje bağlamında akar. Sonraki adım bu şemadan nesne tabanlı plan aktarımını kontrollü düzenlemek. Resmî teknik onay veya ARC/13 modül tamamlandı iddiası yok.
