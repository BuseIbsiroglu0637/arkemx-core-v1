# G05-B06: bağımsız kat plakası ön çalışması

Tarih: 2026-10-09. Durum: ilk uygulama adımı; B06 bütünü tamamlanmadı.

## Sorun ve değişiklik

Tek tip kat motoru farklı kat plakalarına uygulanamaz. Seçili 20 × 10 m plakanın iki kata kopyalanması 400 m² üretirken, 10 × 10 m ve 20 × 10 m kaynak plakalarının gerçek toplamı 300 m² olur. Mevcut bütün yapı hesabı engeli korunur; ayrı bir kat alanı, yük ve brüt plaka miktarı çalışması eklenir.

- Her kat kaynak plakasının kendi ölçüleriyle hesaplanır. G ve Q toplamları gerçek alanların toplamından oluşur.
- Kaynak eleman yüklerinin kat içindeki en büyüğü tüm brüt kat alanına uygulanır. Hiç yük beyanı yoksa global girdi kullanılır; yöntem çalışma kaydında belirtilir.
- Kaynak planın aks adetleri her katın kendi boyutlarına uygulanır. Katlar yerel 0,0 başlangıcında bağımsızdır; katlar arası konum varsayılmaz.
- JSON/CSV tüm katları, PDF/DXF seçili katı içerir. PDF gömülü JSON eki ve DXF 999 yorum kaydı kaynak zincirini taşır.
- SHA-256 çalışma kimliği ve gerçek dosya baytları için belge kaydı tutulur. Kaynak değiştiğinde yeni çalışma oluşur; önceki kayıtlar korunur ve yeni kaynak için geçerli kabul edilmez.
- Eksik/tekrarlı kat listesi, eski kaynak revizyonu, geçersiz ölçü/birim/yük ve desteklenmeyen poligon/boşluk verisinde çalışma oluşturulmaz.

## Analiz sınırı

`fullBuildingAnalysis: false` ve `technicalApproval: false` korunur. Kat çalışması bütün yapı sonucu veya H05 teknik aktarımı açmaz. Alan yük ifadeleri mevcut ön motordan alınır; yapı dinamiği ve eleman kuvvetleri bu çalışmaya aktarılmaz. 1,40G + 1,60Q yalnız mevcut motorun ön yük göstergesidir. Kar yükü üst kat alanında ayrı gösterilir. Beton miktarı brüttür; precast için mevcut 0,10 m varsayımı kullanılır.

Katlar arası taşıyıcı sürekliliği, yük yolu, transfer katı, kolon/kiriş/temel hesabı, boşluklu veya düzensiz plaka ve 3B/FEM çözümü açık işlerdir. Test sonucu yetkili mühendis onayı değildir.

## Doğrulama

- `npm run test:g05`: B06 için 11 yeni birim kontrolü; B04 ve önceki G05 kontrolleriyle toplam 60.
- `npm run test:local:ui`: 136 UI kontrolü ve yerel derleme.
- `npm run typecheck`: TypeScript kontrolü.
- `npm run test:g05:e2e`: mevcut 16 ve yeni 3 B06 tarayıcı kontrolü. Yeni kontroller gerçek JSON/CSV/PDF/DXF indirmelerini, PDF ekini, DXF köşelerini, dosya karmalarını, kaynak değişimini, kayıtların korunmasını ve eski kaynak engelini inceler.
- `tests/b06-floor-study-browser.mjs` sentetik projeyi ayrı tarayıcı bağlamına yükler. Kullanıcının projesi değiştirilmez. Kanıt dosyaları `test-artifacts/g05/` altındadır; CI sonucu ve commit kimliği ayrı ilerleme kaydında tutulur.

## Sonraki adım

Katların ortak koordinat sistemindeki yerleşimini ve kolon/kiriş sürekliliğini kaynak veri olarak tanımlamak; uyumsuzlukları işaretlemek. Bu kaynak doğrulanmadan bütün yapı analiz engeli kaldırılmamalıdır.
