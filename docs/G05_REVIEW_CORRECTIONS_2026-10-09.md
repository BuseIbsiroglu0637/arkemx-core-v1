# G05 kod incelemesi düzeltmeleri — 9 Ekim 2026

İncelenen aralık: `4516e46389a47fa0f46ef562b4da6a82577f0557` → `d9730eb6c5eb73f08d36b83913000aabd6b7b814`. Bu ek kayıt önceki kararları ve donmuş kanıtları değiştirmez. İnceleme bağımsız kod okuması ve olumsuz/pozitif davranış sınamalarıyla yapılmıştır.

| Sorun | Son değişiklik |
|---|---|
| H03 tam eleman kümesine yeni eleman eklendiğinde eski kaynak görüntüsü tutarlı sayılıyordu. | Tam küme büyüklüğü de denetlenir; eski kaynak bağlantısı geçersiz kalır. |
| Aynı revizyonda geometri değişimi veya farklı kat plakalarının uniform bağlamla değiştirilmesi gözden kaçıyordu. | Gerçek planın seçili kat, grid, kat sayısı ve plakaları H03'te görüntülenir; güncel kaynak ile karşılaştırılır. Bağlamdaki plakalar mevcut kaynakla da karşılaştırılır; eski görüntüsüz kayıt kaynak gibi yeniden üretilmez. |
| Bozuk kat koleksiyonu grid'e düşebiliyor veya taşıyıcı ekranda `.map` hatası oluşturabiliyordu. | Koleksiyon şekli aktarımda reddedilir; ekran yalnız güvenli dizi görünümünü kullanır ve orijinal bozuk veriyi korur. |
| Analiz kapısı sıfır/negatif kat numarasını kabul ediyordu. | Kat numarası pozitif tam sayı olmalıdır; motor çağrılmaz. |
| H03 eski alternatifleri, stüdyoyu ve unsupported işaretini yeni girdilerde taşıyordu. | Sonuç, alternatifler ve stüdyo temizlenir; yeni geometri destek sınırı gözlenen girdilerden yeniden belirlenir. |
| Kaynak doğrulayıcı boşluklu kimlikleri kabul ederken üretici bunları trim edip çakışma buluyordu. | Kaynak kimlikleri boşluksuz, kanonik biçimde zorunludur; kimlik değiştirilmez, uyumsuz kaynak açıkça reddedilir. |
| Desteklenmeyen birimler veya kaynak uyuşmazlığı UI motorunu/teknik ihracı durdurmuyordu. | İlgili yapısal/plan kaynak bütünlüğü analiz kapısına bağlanır. Sonuç/stüdyo null olur; desteklenmeyen değerler metre olarak çizilmez. JSON gerçek birim beyanını korur. |
| RFI inceleme durumu bileşen açıkken revizyon değişiminde bellekte taşınıyordu. | Bellek durum anahtarı kalıcı RFI kimliği + revizyon ile sınırlandırılır. Kimlik korunur; önceki revizyonun durumu aktarılmaz. |

Yeni yedi olumsuz birim testi `d9730eb` üzerinde başarısız oldu; sonraki sürümde başarılı. Gerçek tarayıcıda bozuk kaynak, desteklenmeyen birim ve canlı revizyon değişimi de düzeltme öncesinde başarısızlık gösterdi. Desteklenen uniform bağımsız çalışmanın devam ettiği ayrıca pozitif gerçek ihracat kontrolüyle sınanır. Kaynak geometrisinin sıralaması kimlik değişikliği sayılmaz.

Testler durum geçişleri, reddetme, çağrı sayısı, gerçek indirilen JSON, kimlik ve yeniden yükleme davranışını sınar. Beklenen değerler yeniden üretim fonksiyonundan alınarak testin doğruluğu iddia edilmez. Kernel saf yardımcıları gerçek kaynak gövdesinden yüklenir; bu kontrol React bağlamının tamamının yerine geçmez. React davranışı ayrı tarayıcı kontrolleriyle sınanır. İki eski UI testi ise kaynak metni/regex varsayımlarına dayanan mevcut test borcudur; beklentiler yeni çıktıya uydurularak yeşile çevrilmedi.

## Ayrı kalan işler

**B04:** Anlık görüntü gerçek ve sınırlı plan girdilerini karşılaştırır; kalıcı eleman sürüm deposu, gerçek hesap yürütme kayıtları, belge sürümleri ve SHA-256 zinciri değildir. Eksik geçmiş pending kalır. Tam kapsam `G05_B04_VERSIONED_GRAPH_SCOPE_2026-10-09.md` belgesindedir.

**B06:** Farklı kat plakaları korunur ve desteklenmeyen motor/sonuç aktarımı engellenir. Kat bazlı yük yolu, taşıyıcı analiz ve bu analizden üretilen çizimler hâlâ geliştirilmelidir.

**Eski lint/test borcu:** Başlangıç sürümündeki 17 lint hatası/23 uyarı ayrı işlerdir. Ek UI taramasındaki iki eski başarısızlık, aynı test ve bağımlılıkları başlangıç commit'inde tekrar edilerek doğrulandı: sabit modül sayısı ve İngilizce metin beklentisi. Bu iki test ürün hata kanıtı olarak yorumlanmaz; davranış odaklı hale getirilmeleri gerekir.

Git geçmişi tam değildir; canlı yayın SHA'sı, G06 mühendislik kanıtları ve yetkili onay ayrı işlerdir. Bu düzeltmeler mühendislik veya genel pilot kabulü değildir. Sources ve donmuş MCP kayıtları değiştirilmez; push, PR oluşturma, merge veya yayın yoktur.
