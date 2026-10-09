# B06: ortak pafta ve açık lineer 3B eleman modeli

Tarih: 9 Ekim 2026. Önceki B06 kat çalışması ve ortak koordinasyon adımlarını genişletir. Kayıtlı proje belgeleri ve canlı görev durumları değiştirilmedi.

## Yapılan iş

- Kat/kolon/kiriş kaynaklarından boş, bilinmeyen değerleri null olan JSON taslağı; kullanıcı tarafından girilen gerçek düğüm kotu, kesit, malzeme, mesnet ve yük payı sözleşmesi. Varsayılan mühendislik değerleri gerçek projeye yazılmaz.
- Her kaynak kolon tek düşey elemana, kaynak kiriş ortak düğümlerle kesintisiz segmentlere bağlanır. Transfer kolonunun alt düğümü kirişin ara düğümüne açıkça bağlanabilir. Geometrik eşleşme tek başına taşıyıcı kabulü değildir.
- 6 serbestlikli prizmatik Euler–Bernoulli lineer elastik uzay çerçevesi: eksenel kuvvet, iki doğrultuda eğilme ve burulma. Açık sıfır deplasmanlı mesnetler; gerçek kat alanlarından G/Q/S düşey düğüm yükleri ve kullanıcının ek düğüm yük durumları. Eksik/bağlantısız kaynak, serbest mekanizma, kötü koşullu rijitlik ve denge hatası sonuç üretmez.
- Ortak PDF üstten X/Y yerleşimini ve kat Z tablosunu; DXF metre birimiyle gerçek X/Y/Z plaka ve eleman koordinatlarını; JSON kaynakları ve mevcut çözümü içerir. Çözüm yoksa belge açıkça geometry-only olur.
- FRAME hesap kimliği kaynak ve yeniden hesaplanan sonuç özetiyle; FRAME-DOC belge kimliği indirilen gerçek dosya baytlarıyla bağlanır. Kaynak/yük değişiklikleri önceki sonucu geçersiz kılar; kayıt geçmişi korunur. Eski tek tip yapı motoru bu model için kullanılamaz.

## Doğrulama ve kanıt

- G05 birim paketi: 86 test; analitik konsol eğilmesi/eksenel/burulma, ortası yüklü basit kiriş, eksen dönüşümü, transfer segmentleri, denge, kaynak ve dosya tahrifat kontrolleri.
- Bağımsız OpenSeesPy 3.7.1.2: 4 sentetik modelde 7 yük durumu; tüm düğüm deplasmanları, reaksiyonlar ve yerel eleman uç kuvvetleri karşılaştırılır. Tolerans: 1e-10 mutlak + referans büyüklüğünün 1e-7 katı. Referans gerçek OpenSees çözümüdür; uygulama motorundan üretilmiş beklenen değer değildir.
- Tarayıcıya üç B06 senaryosu eklendi: açık taslak/gerçek kaynak kaydı, çözüm ve üç biçimde gerçek indirme, kaynak değişikliğinde bloke sonuç/geometri çıktısı. Önceki senaryolarla paket toplamı 25 kontroldür.
- CI, bağımsız Python referansını da zorunlu adım olarak çalıştırır. Son çalıştırmanın durumu ve bağlantısı ayrıca ilerleme kaydına yazılır; bu belge CI başarısını peşinen ilan etmez.
- Sentetik kanıtlar test-artifacts/g05 altında bulunur: frame-reference-result.json, b06-frame-result.json, b06-common-frame.pdf/.dxf/.json ve ekran görüntüsü. Bu veriler gerçek müşteri projesi veya resmî teknik onay değildir.

Referans eleman/eksen sözleşmesi: [OpenSees elasticBeamColumn](https://opensees.github.io/OpenSeesDocumentation/user/manual/model/elements/elasticBeamColumn.html), [Linear transformation](https://opensees.github.io/OpenSeesDocumentation/user/manual/model/geomTransf/Linear.html).

## Kapanış sınırı ve açık işler

Bu sürüm 2–60 düğüm, 1–150 eleman ve toplam 1–12 yük durumuyla sınırlı, rijit uçlu lineer statik bir çalışma motorudur. Döşeme kabuğu/rijit diyafram, çatlama, kesme deformasyonu, uç serbestlikleri, ikinci mertebe, burkulma, plastikleşme, deprem/dinamik, yük birleşimleri ve taşıma kapasitesi tasarımı içermez. Kolon/kiriş öz ağırlığı otomatik eklenmez; açık yüklerde mühendis tarafından tanımlanmalıdır. Katın en büyük kaynak eleman yükünün brüt plakaya uygulanması önceki ön çalışma yaklaşımıdır; gerçek yük dağılımı kabulü değildir.

B06'nın geniş kapsamlı kat bazlı nihai yapı analizi olarak kapatılması doğrulanmış değildir. Gerçek proje eleman/mesnet/yük verisi, bağımsız kabul modeli ve yetkili mühendisin kabul ölçütleri/kararı beklenir. Bu veri gelene kadar otomatik olarak proje modeli doldurulmaz ve technicalApproval/fullBuildingAnalysis alanları false kalır. Gerekli kabuk/deprem/kapasite kapsamı gerçek proje kabul ölçütleriyle ayrıca belirlenmelidir.

## Ana kayda eklenebilecek ilerleme

9 Ekim 2026 — B06 için kaynak bağlı lineer 3B eleman sözleşmesi, çözüm motoru ve ortak PDF/DXF/JSON çıktıları eklendi. Dayanak: analitik kontroller, bağımsız OpenSees karşılaştırması ve gerçek tarayıcı indirmelerinin bayt doğrulaması. Açık işler: gerçek proje verisi, kapsam kabulü ve yetkili mühendis değerlendirmesi. Sonraki adım: doğrulanmış proje modelini içe aktarmak, bağımsız kabul hesabıyla karşılaştırmak; gerekiyorsa kabuk/deprem/kapasite kapsamını tamamlamak. Test sonucu resmî teknik onay değildir.
