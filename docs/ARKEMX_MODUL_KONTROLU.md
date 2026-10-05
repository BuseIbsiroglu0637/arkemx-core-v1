# ARKEMX modül kontrolü — 5 Ekim 2026

## Düzeltilen davranışlar

- Modül yönlendirmesi artık başlıktaki İngilizce kelimeler yerine modül kimliğine bağlıdır. Sistem seçimi → taşıyıcı ön tasarım → BIM koordinasyon akışı döngüye girmez.
- Bilgi teslim planı ve performans laboratuvarı tanıtım sayfaları yerine doğrudan çalışan araçlarını açar.
- Yedi editör kayıtlı veriyi yüklemeden varsayılan değerlerini proje kaydına yazmaz. Sıfır, boş metin ve işaretlenmemiş seçenekler korunur. Performans laboratuvarının bütün düzenlenebilir girdileri kaydedilir.
- Model kütüphanesi kaydedilmiş seçimi harici akış geldikten sonra korur. Yayın tarihi UTC ile gösterilir; sunucu/tarayıcı saat dilimi farkı React açılış hatasına yol açmaz.
- Arazi ekranından başlangıç özetine dönüş ve sistem/taşıyıcı ekranlarının önceki adım bağlantıları düzeltildi.
- Katalog ve proje grafiği aynı araç rotalarını kullanır. Kayıt bulunması, aşama kontrolünün geçmesi ve teknik/resmî onay farklı kavramlardır.

## 13 araç rotası

| Modül | Çalışma sayfası |
| --- | --- |
| Yatırım briefi | /proje-karar-asistani |
| Parsel ve bağlam | /arsa-fizibilite-studyosu?stage=zoning&focus=source |
| Yapı yerleşimi | /arsa-fizibilite-studyosu?stage=design |
| Mimari program | /mimari-program-studyosu |
| Plan ve aks | /plan-ve-aks |
| Sistem seçimi | /sistem-karsilastirma |
| Taşıyıcı ön tasarım | /tasiyici-on-tasarim |
| Disiplin koordinasyonu | /bim-koordinasyon |
| Bilgi teslim planı | /bilgi-teslim-plani |
| Performans laboratuvarı | /performans-laboratuvari |
| Proje OS | /proje-takibi |
| 3B model inceleme | /3b-model-kutuphanesi |
| Yıkım risk modeli | /yikim-karar-studyosu |

## Doğrulama

- Yerel TypeScript kontrolü ve üretim derlemesi geçti.
- 112 veri, kayıt ve mühendislik kuralı testi; 89 sayfa/modül rotası testi geçti.
- 12 Chromium ilan adaptörü testi geçti.
- Gerçek tarayıcıda 13 modül açıldı; kayıtlı brief, BEP, laboratuvar, yıkım, model incelemesi ve OS verileri yenileme sonrasında korundu. Tarayıcı JavaScript hatası görülmedi.
- Testler sentetik projeler ve HTTP yanıtları kullanır. Canlı ilan erişimi, kadastro doğruluğu veya resmî imar/mühendislik onayı bu sonuçlardan çıkarılamaz.
- Boş proje testi ayrı proje kimliği kullanır. Aynı projede modülleri ham depodan silmek, kayıp veri koruması nedeniyle yedekten geri tamamlanabilir; bu güvenlik davranışı korunmuştur.

Dal CI kontrolüne modül rotası, geri yükleme ve tarayıcı regresyon testleri eklendi.

