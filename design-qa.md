# Parsel ve arazi paneli — görsel kontrol

Tarih: 2026-10-19

Kaynak görsel: C:/Users/busei/OneDrive/Masaüstü/Parsel ve Arazi İnceleme Paneli.png (1086 × 1448 px).
Uygulama: http://127.0.0.1:5175/arsa-fizibilite-studyosu#geo-studyo
Son üst panel görüntüsü: çalışma alanı output/ARKEMX_Parsel_Panel_2026-10-19.png.
Tam düzen karşılaştırması: output/ARKEMX_Parsel_Panel_Tam_2026-10-19.png (1086 × 2390 px; son küçük önizleme kartı zemini son üst panel görüntüsünde doğrulandı).
Mobil: output/ARKEMX_Parsel_Panel_Mobil_2026-10-19.png (375 × 4335 px).

## Karşılaştırma kapsamı

Referans ile uygulama görüntüleri aynı görsel karşılaştırma girdisinde açıldı; ana form/harita, araç çubuğu, proje satırı, çıktı kartları ve sonraki adımlar karşılaştırıldı. Masaüstü testinde 1101 × 1448 viewport isteği, kaydırma çubuğuyla 1086 CSS px içerik verdi. Son normal ekran yakalaması 1101 × 1093 px; tarayıcı yakalama alanının yüksekliği nedeniyle alt kartlar ayrıca tam sayfa görüntüsünde incelendi. Yoğunluk için ek ölçekleme yapılmadı. Mobil 390 × 844 isteğinde 375 CSS px içerik ve aynı genişlikte scrollWidth görüldü. Test ölçüleri sonunda kaldırıldı.

Durum: Arsam var, kayıtlı Kastamonu/Merkez/Budamış 210/15, Uydu seçili, yapı yerleştirilmemiş. Referanstaki Kuzeykent 218/11 örneği ve örnek proje adı canlı veriye kopyalanmadı. Referans Sokak seçili görünmesine rağmen uydu fotoğrafı içeriyor; uygulama gerçek seçimi Uydu olarak gösteriyor. Kaynak sınır önizlemesi gerçek geometri çizimidir, ikinci bir canlı uydu haritası değildir.

## Bulgular ve düzeltme geçmişi

1. [P1, düzeltildi] Eski !important kuralları başlıkları ve düğme renklerini eziyordu. Sayfaya özel son stil dosyasıyla yeşil kontroller, 36 px masaüstü/28 px mobil başlık, açık kartlar ve sınırlar uygulandı. Çıktı başlığının beyaz zeminde kaybolması giderildi.
2. [P2, düzeltildi] Görünüm seçicisi grid biçiminde üç satıra taşıyordu. Eski grid/min-width kuralları etkisizleştirildi; masaüstünde sekmeler ve Sokak/Uydu/Topoğrafik aynı araç çubuğunda, mobilde ayrı satırlarda.
3. [P1, düzeltildi] Altlık değişimi sonrası odaklama kaldırılmış Leaflet katmanına olay gönderebiliyordu. Önce layer.remove(), sonra layer.off() sıralandı. Temiz yüklemede Sokak → Uydu → Sokak → Uydu ve odaklama çalıştı; son etkileşim zaman aralığında tarayıcı hata kaydı yoktu.
4. [P2, düzeltildi] Uydu yüksek detay seviyesinde boş servis görseli veriyordu. Uydu native seviyesi 18 ile sınırlandı; mevcut görüntü yeniden ölçeklenir. Bu bölgedeki gerçek görüntünün netliği referanstaki örnek fotoğraftan düşüktür; yapay veya farklı parsel fotoğrafıyla değiştirilmedi.
5. [P2, düzeltildi] Katman paneli kapalıyken görünür kalabiliyordu; açık/kapalı durumları açık CSS seçicileriyle ayrıldı. Başlık ve kutu renkleri okunur hale getirildi.
6. [P3, düzeltildi] Sağ üst sınır kartı gereğinden büyüktü; 150 px masaüstü/110 px mobil ölçüsüne indirildi, beyaz zemini ve kaynak notu korundu.

## Beş görsel yüzey

- Tipografi: mevcut Inter/Manrope sistemi korundu; ana başlık ve kart başlıkları referans hiyerarşisine yaklaştırıldı. Metinler gerçek proje durumunu anlatır.
- Düzen: solda yaklaşık %32 form, sağda yaklaşık %68 harita ve altında çıktılar; tek satır proje özeti, dört adım, altta iki sütun sonraki modüller. Mobilde tek sütun, yatay taşma yok.
- Renkler: koyu yeşil etkin düğmeler, açık yeşil durum zeminleri, beyaz kartlar ve ince soğuk gri sınırlar. Parsel çizgisi referanstaki gibi ayırt edici turuncu kaldı.
- Görseller: gerçek altlık servisi ve mevcut kaynak geometrisi kullanıldı. Kayıtlı parselin çözünürlük sınırı dış veri koşuludur. Simgeler mevcut Lucide kütüphanesinden; dekoratif yapay parsel görseli üretilmedi.
- İçerik: üç yerine dört çıktı kartı var; çalışan DXF kaldırılmadı. Yerleşim işlevi korunarak dördüncü adım Yerleşim ve çıktılar olarak adlandırıldı. Demo bandı, kaynak ayrıntıları ve mevcut geçiş kontrolleri korundu; bu yüzden sayfa referanstan daha uzun.

## Etkileşim ve kontrol

Sokak/Uydu/Topoğrafik seçimi; odak, ölçek ve katman paneli; 3B sahne; koordinat sekmesi; KML indirme çalıştı. KML dosyası KASTAMONU-MERKEZ-210-15.kml adıyla indirildi. 31/31 ilgili test ve TypeScript kontrolü geçti. Üretim derlemesi ve Worker paket doğrulaması geçti; bundan sonraki değişiklikler küçük CSS önizleme kartı düzeltmeleridir. PDF/DXF içerikleri bu görsel yenilemede yeniden uçtan uca incelenmedi. Bu kayıt teknik veya hukuki parsel onayı değildir.

## Sonuç

Uygulanabilir P0/P1/P2 görsel bulgu kalmadı. Dış görüntü çözünürlüğü, gerçek proje verisi ve korunan araçlar nedeniyle piksel eşitliği hedeflenmedi. Sonraki isteğe bağlı iyileştirme: lisanslı daha yüksek çözünürlüklü görüntü kaynağı sağlandığında altlık kalitesini artırmak.

final result: passed
