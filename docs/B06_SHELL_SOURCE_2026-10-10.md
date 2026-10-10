# B06 S1 — ayrı kabuk kaynak sözleşmesi

Tarih: 10 Ekim 2026. Bu adım girdi, ağ ve kaynak kimliği üretir; kabuk rijitlik matrisi, sehim/moment çözümü veya resmî kabul üretmez. S0 götürü pay/açık öz ağırlık ayrımından sonra gelir.

## Girdi ve sınır

ARKEM-SHELL-SOURCE/1.0 yalnız sentetik, bağımsız, düz ve dikdörtgen bir plaka içindir. Gerekli alanlar: proje/revizyon, plaka kimliği/katı/XYZ başlangıcı, boyut/kalınlık, malzeme E/ν/γ, nx/ny, SS-H veya CL mesneti, açık yük bileşenleri ve metre/kN birimleri. G = E/[2(1+ν)] türetilir; farklı G girilmesi kabul edilmez.

Eksik/ek alan, gerçek proje veya teknik onay beyanı, poligon/boşluk, çubuk/kolon bağı, floorShares, götürü taşıyıcı payı, hazır hesap sonucu reddedilir. Sıfır yük sayısal 0 olmalıdır; boş alan/string/null sıfıra çevrilmez. Kalınlık ve E/γ pozitif, 0≤ν<0,5; kalınlık küçük plaka boyutunu geçmez.

Her yönde 2–32 eleman; en fazla 512 dörtgen / 561 düğüm. Düğüm ve eleman kimlikleri plaka kimliğine bağlıdır. Dörtgenler +Z'den bakıldığında saat yönünün tersine oluşturulur. Koordinatların birbirinden ayırt edilememesi, sayısal taşma veya alt-taşma kaynak üretimini engeller. Bu sınır henüz kabuk çözücüsünün performansının doğrulandığı anlamına gelmez.

Orijin plakanın orta yüzeyindedir; ağ XY düzleminde ve normal +Z'dir. Serbestlik sırası ux/uy/uz/rx/ry/rz; dönmeler fiziksel sağ el kuralı bileşenleridir. Bu sabit sözleşmeler hazırlanan kayıtta conventions alanında saklanır; kolon bağlantısı veya kalınlık kaçıklığı varsayılmaz.

## Mesnetler

SS-H: X kenarlarında uz/rx, Y kenarlarında uz/ry sabit; öteki eğilme dönmeleri serbest. CL: dört kenarda uz/rx/ry sabit. Dönmeler fiziksel sağ el kuralı bileşenleridir. A=(0,0) ux/uy, B=(a,0) uy sabit; düzlem içi rijit hareket için iki açık ankraj. rz kısıtlanmaz; ileride eleman drilling davranışı ve stabilizasyonu S2'de ayrıca doğrulanacak. Hazırlanan model her mesnet için altı boolean kısıtı açıkça içerir; rijit diyafram kısıtı eklenmez.

## Yükler

Döşeme öz ağırlığı seçiliyse γt; ek sabit yük, Q ve BENCH açık alan yükleridir. G_SW, G_SUP, Q ve BENCH fiziksel bileşenlerdir; G yalnız G_SW+G_SUP'tan türetilen ayrı bir yük durumudur. Bileşen listesine G tekrar eklenmez. Her durum bağımsız çözülmelidir; beş durum birlikte tek fiziksel yük olarak toplanmaz.

Yön [0,0,-1], yük büyüklüğü kN/m², totalVerticalForce=-qA kN. Bu adım kabuk elemanına eşdeğer düğüm yükü dağıtmaz; tutarlı yüzey yükü integrasyonu S2 çözücüsünün işidir. Çerçeve götürü payı ve çerçeve floorShares yük aktarımı bu modelde yoktur.

## İki örnek ve kayıt

| Kaynak | Plaka/kot | Orta ağ | G_SW / G_SUP / G / Q / BENCH (kN büyüklüğü) |
| --- | --- | --- | --- |
| P1 | 10×10 m / Z=0 | 8×8; 81 düğüm, 64 eleman | 400 / 220 / 620 / 350 / 100 |
| P2 | 20×10 m / Z=3,4 | 16×8; 153 düğüm, 128 eleman | 800 / 440 / 1.240 / 700 / 200 |

E=30.000.000 kN/m², ν=0,20, γ=25 kN/m³, h=0,16 m. Örnek değerler gerçek proje önerisi değildir. Kaba/orta/ince ağlar P1'de 4×4/8×8/16×16; P2'de 8×4/16×8/32×16. Kaynak fabrikası SS-H ve CL üretir; iki plaka ayrı tutulur.

İncelenebilir girdiler: docs/examples/B06_SHELL_SOURCES_2026-10-10.json. Kaynak hazırlama: app/lib/shell-source.ts; örnekler: app/lib/shell-example.ts. SHELL-SOURCE-SHA256 kimliği kaynak ve türetilmiş ağ/mesnet/yük içeriğine bağlıdır. Farklı JSON anahtar sırası veya yeniden yükleme aynı kimliği verir. Girdi değişimi veya düğüm/eleman/mesnet/yük tahrifatı, içerik yeniden hash'lense de güncel kaynak karşılaştırmasında reddedilir.

Çıktı durumu source-ready-analysis-pending; calculation=null, fullBuildingAnalysis=false, technicalApproval=false. Bu bir hesap kimliği değildir; kaynağın mühürlenmiş kimliğidir. Eski çerçeve çözücüsü bu kaynağı/modeli kabul etmez.

## Doğrulama ve kanıt üretimi

tests/shell-source.test.mjs 12 kontrol: geometri/eleman yönü/kaynak bağları, üç ağ, iki mesnet, fiziksel yük toplamları, geçersiz girdiler/sayısal taşma, kaynak kimliği/değişimi/tahrifat ve çerçeve motorundan ayrım. Bunlar kaynak testleridir; kabuk çözümü veya bağımsız FEM kabulü değildir.

test:g05 mevcut testlerle beraber bu paketi de çalıştırır; tüm testler geçerse scripts/export-shell-sources.mjs iki JSON kaynağını ve mühürlü hazır kaynak kayıtlarını test-artifacts/g05 altına yazar. CI'ın mevcut kanıt artifact'i bu dosyaları kapsar. shellAnalysisRun=false açıkça saklanır. CI sonucu, commit ve test sayıları tarihli ilerleme kaydında verilir.

## Sonraki adım

S2: düz kabuk elemanı/rijitlik/çözüm, tutarlı yüzey yükü, temel membran çekme-kayma testleri, analitik/OpenSees karşılaştırması ve ağ yakınsaması. Açık mesnetler tek başına sayısal kararlılık veya mühendislik yeterliliği onayı değildir. S3 ekran/belge ve S4 birleşik çerçeve/diyafram kapsamları daha sonra gelir.
