# G05-B06 ikinci adım: ortak kat konumları ve geometrik taşıyıcı bağlantıları

Tarih: 2026-10-09. Önceki bağımsız plaka alan/yük çalışmasını tamamlayan kaynak koordinasyonu adımıdır; B06 bütünü açık kalır.

## Uygulama

Plan ve Aks ekranında her kat için açıkça X/Y/kot (metre) girilir. Boş değer sıfıra dönüştürülmez. Kat eksenleri paraleldir; dönme desteklenmez. Kirişler kullanıcının seçtiği aynı kattaki iki farklı gerçek plan kolonuna bağlanır; otomatik kolon/kiriş üretilmez. Taslak ekleme veya silme işlemi ancak Kaydet komutuyla proje kaydına geçer.

Kaynak `plan-editor.floorCoordination` içinde saklanır. Kayda plaka/aks geometrisi ve tüm eleman içeriklerinin kanonik bağlantısı eklenir. Plan geometrisi veya elemanlar değişirse eski konum ve kiriş kaydı silinmez; geometrik rapor kapanır ve yeniden inceleme/kayıt beklenir. Aktif kat seçimi ve kaynak dizilerinin sırası bu bağlantıyı değiştirmez.

H03 ortak koordinasyon verisini kaynak geometri anlık görüntüsü ve model bağlamıyla taşır. Kaynak tutarlılık kontrolü koordinasyon değişikliğini de algılar. B06 çalışma ve dosya kimlikleri bu kaynağı kapsar; JSON ve PDF/DXF içindeki izlenebilirlik eki ayrıca geometrik raporu içerir. Mevcut PDF/DXF paftaları seçili katın **yerel** çizimi olmaya devam eder; ortak yerleşim üstten görünümü uygulama ekranındadır.

## Kontroller ve sınır

- Kolonların grid-bay koordinatları kendi katının gerçek genişlik/derinliğine göre metreye çevrilir ve ortak X/Y başlangıcına eklenir.
- Ardışık kat kolonları 1 mm sabit geometrik toleransla karşılaştırılır. Tek eşleşme yalnız geometrik adaydır; çoklu eşleşme belirsizdir.
- Alt kolon eşleşmesi olmayan üst kolon, tanımlı alt kat kiriş segmentinde bulunuyorsa transfer incelemesi olarak işaretlenir. Diğer durumda alt destek kaynağı yoktur.
- Üst katta karşılığı bulunmayan alt kolonlar ve alt katta geometrik karşılığı olmayan kirişler gösterilir. Kiriş uç sırası eşleşmeyi değiştirmez.
- Eksik kat konumu, sırasız/eşit kotlar, geçersiz birim/aks/kolon koordinatı, eski kaynak bağlantısı, olmayan veya farklı katlardaki kiriş uçları, tekrarlı/çok kısa kiriş reddedilir.
- Kolon/kiriş kaynağı eksikse bununla ilgili uyarı gösterilir. Temsilî kolonlar açıkça belirtilir.

`fullBuildingAnalysis=false`, `technicalApproval=false` kalır. Ortak koordinasyon kaydı eklendiğinde, plakalar eşit boyutlu olsa da mevcut tek tip bütün yapı motoru açılmaz. Geometrik rapor rijitlik, kapasite, yük yolu, kesit, birleşim veya transfer çözümü değildir; H05 teknik aktarımına uygun hesap üretmez.

## Doğrulama ve sonraki adım

10 yeni birim kontrolü: toplam 70 G05/B04/B06 testi. Genel UI paketi 136 kontrol; TypeScript ve yeni bileşen/kütüphane lint kontrolü. Üç yeni tarayıcı senaryosu ile toplam 22: açık kullanıcı girişi/kiriş kaydı, H03 ve yeniden açılış, gerçek JSON indirmesinde ortak koordinat raporu, kaymış kat uyarısı, değişen kaynağın engellenmesi ve eşit fakat kaymış plakada bütün yapı engeli. Sentetik projeler ayrı test bağlamlarındadır.

Sonraki adım: geometrik adayları taşıyıcı eleman başlangıç/bitiş kotları, kesit/malzeme ve açık bağlantı verileriyle ilişkilendirmek; eksik yük yolu/transfer kararlarını kayıt altına almak. Ortak yerleşimin ayrı PDF/DXF paftası, mühendis tarafından değerlendirme ve 3B/FEM çözümü açık işlerdir. Test sonucu resmî teknik onay değildir. Gerçek CI sonucu ve commit kimliği ayrı ilerleme kaydında tutulur.
