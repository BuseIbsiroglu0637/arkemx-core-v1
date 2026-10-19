# ARKEMX v177 demo

Giriş: `/dijital-proje-merkezi`. 13 modüle doğrudan bağlantı, örnek konut projesi yükleme, yeniden yükleme onayı ve JSON indirme bulunur. Örnekte yalnız yatırım hedefi, arama bölgesi ve mahal listesi vardır. Hesaplanmış sonuç, resmî parsel veya mühendislik onayı içermez.

Demo verisi `arkem-demo-v177-*` anahtarlarında saklanır. Önceki normal proje anahtarları okunmaz ve değiştirilmez. Worker, tüm API yazma isteklerini ve müşteri/başvuru/belge API okumalarını 403 ile kapatır; sahte başarılı gönderim yanıtı üretmez. Dış sorgular ve harita servisleri internet gerektirir. Tam çevrimdışı çalışma vaat edilmez.

Kurulum: `npm.cmd ci`. Başlatma: `npm.cmd run dev -- --host 127.0.0.1 --port 5175 --strictPort`. Başlatma sırasında demo bilgilendirmesi tüm sayfalarda görünür. Bu dal demo içindir; canlı siteye uygulanmamalıdır.

## İlerleme kaydı — 2026-10-19

Kullanıcı v177 dosyasını demo haline getirmemizi istedi. Demo ana sayfası, 13 modül bağlantısı, üç başlangıç modülünde örnek veri, JSON indirme, tekrar yükleme onayı, ayrı tarayıcı kayıt anahtarları ve sunucu tarafında gerçek kayıt engeli eklendi. Hesaba kaydet bağlantısı modül çubuğunda kaldırıldı.

Kontroller: 3 demo testi ve 7 müşteri akışı regresyon testi geçti (10/10). TypeScript --noEmit başarılı. Demo bileşeni, demo/veri saklama dosyaları, giriş sayfası ve Worker için ESLint tamamlandı; hata çıkmadı. Yerel çalışan sunucuda başvuru POST, hesap GET ve belge POST istekleri demo 403 yanıtıyla reddedildi. Tarayıcıda örnek yükleme, yeniden yükleme onayı ve vazgeçme, yenilemede kaydın korunması, indirme bildirimi, mimari programda örnek hedef/mahallerin açılması ve demo ana sayfasına dönüş görüldü. Dar ekranın giriş görünümü kontrol edildi. İlk HMR sırasında Provider hata katmanı görüldü; tam sayfa yenileme sonrası akış çalıştı.

Açık işler: 13 modülün bütün hesap, aktarım ve çıktı yolları tek tek test edilmedi. Masaüstü/tablet görsel kontrolleri ve üretim derlemesi yapılmadı. Bu çalışma sunulabilir bir demo giriş akışı sağlar; tüm mühendislik modüllerinin tamamlandığı veya resmen onaylandığı iddiası değildir. Sonraki adım, sunum senaryosuna göre kalan modüllerin giriş ve çıktı akışlarını doğrulamaktır.
