# B06 S0 — G yükü bileşenleri ve öz ağırlık

Tarih: 10 Ekim 2026. Kapsam: B06-LOAD-01 / örnek doğrusal çerçeve. Kabuk çözümü bu değişiklikte uygulanmaz.

Önceki açık öz ağırlık hesabı, döşeme alan yükündeki götürü taşıyıcı payının üzerine gerçek kolon/kiriş ağırlığını ekliyordu. Beton örneğinde 300 m² × 1,15 kN/m² = 345 kN götürü pay ile 147,5 kN açık eleman ağırlığı birlikte sayılıyordu.

## Yük kuralı

- Açık eleman öz ağırlığı kapalı: önceki alan yükü yaklaşımı korunur; döşeme + ek sabit yük + götürü taşıyıcı payı. Bu, eleman ağırlığını yaklaşık içerir.
- Açık eleman öz ağırlığı açık: alan G'si yalnız döşeme + ek sabit yüktür. Götürü taşıyıcı payı tamamen çıkarılır; her tanımlı kolon/kiriş için beyan edilmiş γ × A × L ağırlığı düzgün yayılı yükle uygulanır. Diğer yük durumları değişmez.
- Ek sabit yük girdisi, bu açık modelde zaten sayılan kolon/kiriş ağırlığını tekrar içermemelidir. Kullanıcının keyfi ek yükünün fiziksel kapsamı otomatik anlaşılamaz; modelde bulunmayan taşıyıcılar ayrı ve açıkça belirtilmelidir.

Ortak permanentAreaLoadComponents fonksiyonu, mevcut ön motor ile yeni çerçeve muhasebesinin aynı döşeme/götürü pay tanımlarını kullanmasını sağlar. Mevcut genel ön motorun çıktısı ve kat alan çalışmasının tarihçesi değişmez.

## Örnek toplamlar

| Bileşen | kN | Açık öz ağırlıkta |
| --- | --- | --- |
| Döşeme öz ağırlığı | 1.200 | Dahil |
| Ek sabit yük | 660 | Dahil |
| Götürü taşıyıcı payı | 345 | Hariç |
| Açık kolon/kiriş öz ağırlığı | 147,5 | Dahil |
| Toplam G | 2.007,5 | Uygulanan toplam |

Önceki çift sayımlı açık model G'si 2.352,5 kN'dı. Açık öz ağırlık kapalı örnek G'si 2.205 kN olarak korunur. Q=1.050 kN, S=150 kN ve H=5 kN değişmez.

## Kaynak, hesap ve belge

Açık öz ağırlıklı içerik sürümü ARKEM-FLOOR-FRAME-CONTENT/1.1 olur; loadAccounting her katın uygulanan ve çıkarılan bileşenleriyle her elemanın γ/A/L/ağırlığını içerir. Kaynak floorStudy önceki götürü yaklaşımın dayanağıdır; uygulanmış G ledger içinden okunur. Yeni yük dağılımı ve muhasebe özeti hesap kimliğine dahildir.

Önceki mühürlü kayıtlar yeniden yazılmaz. Çift sayımlı eski içerik, yeniden hesaplama ile eşleşmediğinden güncel belge olarak aktarılamaz. Öz ağırlık kapalı 1.0 içeriği aynı hesap yaklaşımını korur. Yoğunluk, ek sabit yük veya seçim değişimi önceki açık kaydı geçersiz kılar.

Uygulanan G bileşenleri çözüm ekranı ve görünür PDF tablosunda gösterilir. Yeni açık öz ağırlıklı örnek PDF'si yük bileşenleri sayfasıyla 15 sayfadır; gömülü hesap kaydı JSON ile eşleşir. Sayfa sayısı yalnız bu örnek için geçerlidir.

## Doğrulama kapsamı

Testler el hesabı yük toplamlarını, değişen yoğunluk/ek yükü, Q/S/H'nin korunmasını, açık seçim kapalıyken eski sonucu, eski çift sayımlı mühürlü kaydın reddini ve muhasebe tahrifatını inceler. Bağımsız OpenSees çözümü değişen gerçek G yükleriyle tekrar karşılaştırılır. Tarayıcı kontrolü gerçek JSON/PDF indirmesi ve yük bileşenlerinin ekranda gösterilmesini inceler.

Çalıştırılmış testlerin sayısı, son CI sonucu ve commit kimliği tarihli ilerleme kaydında yer alır; bu doküman CI başarısını peşinen ilan etmez.

## Sonraki adım

S1: ayrı kabuk kaynak sözleşmesi, açık mesnetler ve 10×10/20×10 m örnek plaka girdileri. Kabuk/diyafram, kapasite/deprem ve yetkili mühendis kabulü açık kalır. fullBuildingAnalysis=false ve technicalApproval=false.
