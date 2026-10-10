# B06 / S3 — Kabuk sonuç ekranı ve belge akışı

Tarih: 2026-10-10. Bu belge S2'nin bağımsız dikdörtgen, sentetik plaka hesabının kullanıcı ekranını ve belge sözleşmesini tanımlar. B06'nın tamamını veya resmî mühendislik kabulünü kapatmaz.

## Ekran ve kapsam

`/ornek-kabuk-modeli` iki bağımsız örnek plakayı sunar: P1 10 × 10 m / Z=0 m ve P2 20 × 10 m / Z=3,4 m. Dört ağ seviyesi, SS-H/CL kenar koşulları, kalınlık, malzeme ve alan yükleri değiştirilebilir. Ek inceltilmiş ağ varsayılandır. S2'nin üç ilk ağ için bazı senaryolardaki yakınsama başarısızlığı gizlenmez.

Hesap ve kaynak bu örnek bileşeninin belleğindedir; gerçek ProjectKernel ve proje depolaması değiştirilmez. Yenileme örnek girdilerini sıfırlar. Plakalar aynı kat/bina çözümünde birleştirilmez.

G_SW, G_SUP, Q, BENCH ve G ayrı çözümlerdir. G=G_SW+G_SUP; çerçeve öz ağırlığı bu plaka kapsamına dahil değildir. +Z yukarıdır, pozitif alan yükü aşağı uygulanır. Moment işareti M=-Dκ'dır.

Uz (m), Nx/Ny/Nxy/Qx/Qy (kN/m), Mxx/Myy/Mxy (kNm/m) seçilebilir. Uz haritası dört köşe düğümünün; diğer haritalar elemanın dört Gauss noktasının ortalamasıdır. Ham min/max, birim ve örnekleme yöntemi görünürdür. Mavi negatif, bakır pozitif, açık renk sıfırdır; renkler tasarım yeterliliği anlamına gelmez. Deforme ağ, seçilen 1–10000 büyütme ile kaynak ağ üzerinde gösterilir.

Ham düğüm ötelemeleri, dönmeleri ve reaksiyonları 25 düğümlük sayfalarda görüntülenir; seçilen elemanın dört Gauss noktasındaki sekiz sonuç bileşeni ayrı tabloda yer alır. Tam ham veri JSON'da korunur.

## Güncellik ve işlem yaşam döngüsü

Kaynak değişikliği giriş olayında mevcut sonucu ve belge listesini temizler, çalışan worker'ı sonlandırır ve üç indirmeyi kapatır. Boş sayısal alan sıfır sayılmaz. Sonradan tamamlanan bir işlem, işlem nesli değişmişse sonuç veya indirme yayımlayamaz. Açık iptal ve unmount da worker'ı sonlandırır.

Yük durumu/alan/büyütme/eleman seçimi hesabı değiştirmez; çalışan belge işlemini iptal eder. Geçersiz büyütme indirmeyi kapatır. Çözüm ve belge oluşturma/yeniden hesaplama web worker'dadır; sayfa girişleri kilitlenmez. Ağ sınırları S2 kaynak şemasının sınırlarıdır.

Her indirmede `verifyShellCalculation` kaynakla eşleşmeyi, SHA-256 kaydını ve yeniden çözülmüş hesap içeriğini doğrular. Kaynak veya ham sonuç değişmişse indirme reddedilir. Eski hesap için kullanıcıya yeniden çözüm gerekir.

## Belge sözleşmesi

Manifest `ARKEM-SHELL-DOCUMENT-MANIFEST/1.0` içerir: proje/revizyon, kaynak ve SHA-256, hesap kimliği/SHA-256, tüm eleman kimlikleri, seçilen yük/alan/büyütme/eleman, birimler, örnekleme ve çözüm durumu. `technicalApproval=false`, `fullBuildingAnalysis=false` bütün belge yollarında korunur.

* JSON: `ARKEM-SHELL-PACKAGE/1.0`; manifest, kaynak/ağ/mesnet modeli ve beş yük durumunun tüm ham hesap kaydı.
* PDF: kaynak ve hesap özeti, seçilen harita, büyütülmüş deformasyon, beş yük özeti, seçilen yükün tüm mesnet reaksiyonları ve seçilen elemanın Gauss tablosu. Aynı tam JSON paketi `arkemx-shell-package.json` adıyla gömülüdür. Görünen tabloların kapsamı açıkça belirtilir. Türkçe fontlar gömülür.
* DXF: AC1021, UTF-8, `$INSUNITS=6` (metre); `SOURCE_MESH`, `DEFORMED_MESH`, `SUPPORTS`, `RAW_RESULTS`, `LABELS` katmanları. Plakanın gerçek orta yüzey Z'si korunur. Kaynak/deforme 3DFACE ağları, mesnetler, seçilen ham düğüm/Gauss değerleri ve 999 yorum çiftleri içinde manifest bulunur. Manifest yorumları Unicode karakter sınırında, en fazla 220 UTF-8 bayta bölünür.

İndirilen gerçek baytlar `ARKEM-SHELL-DOCUMENT-RECORD/1.0` ile mühürlenir: dosya adı, bayt uzunluğu, SHA-256, manifest ve `SHELL-DOC-<SHA>` kimliği. Kullanıcı ayrı `.proof.json` indirmesi alabilir. `verifyShellDocument` güvenilen kaynak/hesap ve gerçek dosya baytlarıyla bu kaydı doğrular. Bu içerik bütünlüğü bağlantısıdır; dijital imza, yetkili onay veya kalıcı proje belge deposu değildir.

## Doğrulama ve açık işler

`tests/shell-documents.test.mjs`: tam JSON/PDF gömülü kayıt/DXF sözleşmesi, dosya değiştirme, sahte hesap, kaynak değişiklikleri ve ham görselleştirme verisinin korunması. `tests/shell-example-browser.mjs`: gerçek üç indirme ve bayt kanıtı, proje depolama ayrılığı, kaynak değişince eski sonuçların kaldırılması, boş giriş, yeniden çözüm kimliği, gerçek P2 kotu, mobil genişlik, çözüm/belge iptali ve yenileme. İki dosya mevcut G05/CI akışına eklenmiştir; çalıştırma sonucu ve GitHub CI kanıtı ana ilerleme kaydında ayrıca verilir.

S2'nin OpenSees ve analitik karşılaştırmaları sabit örnekler içindir; bu ekranda her yeni girdi için bağımsız referans veya ağ yakınsaması otomatik çalıştırılmaz. Ekrandaki denge geçişi bağımsız doğrulama veya mühendislik kabulü sayılmaz.

Sonraki iş: S4 için gerçek proje elemanı–kabuk hesabı–belge bağının, desteklenen geometri/mesnet türlerinin ve mühendislik kabul ölçütlerinin belirlenmesi. Boşluklar, düzensiz geometri, döşeme–kiriş/kolon ortak çözümü, yönetmelik kombinasyonları, donatı/tasarım ve resmî onay S3 kapsamı dışında açık kalır. S2 bağımsız doğrulama ve yakınsama kanıtı `B06_SHELL_SOLVER_2026-10-10.md` ile ilişkilidir.
