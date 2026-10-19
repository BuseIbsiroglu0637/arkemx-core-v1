# ARKEMX v177 demo

## Başlangıç ekranı

`/dijital-proje-merkezi` yalnız ARKEMX başlığı ve 13 modül kartı içerir. Kurumsal menü, footer, WhatsApp bağlantısı, örnek proje yükleme/indirme düğmeleri ve teknik açıklamalar bu sayfadan kaldırıldı. Masaüstünde dört, orta genişlikte üç, dar ekranda iki sütun kullanılır. Modül içi kayıt ve çıktı araçları korunur.

Bilgi teslim planı `/bilgi-teslim-plani#teslim-kapsami`, performans laboratuvarı `/performans-laboratuvari#laboratuvar` adreslerinden mevcut bileşenleri doğrudan açar. Önceki iki bağlantı yalnız tanıtım sayfasına gidiyor, araçları göstermiyordu.

## Demo sınırı

Proje çekirdeği `arkem-demo-v177-*` tarayıcı anahtarlarını kullanır. Gerçek müşteri/başvuru/belge API erişimi ve API yazma işlemleri Worker tarafından engellenir. Modül içindeki varsayımlar ve hesaplar uzman incelemesi gerektirir. Harita ve dış kaynaklar için internet gerekir.

Kurulum: `npm.cmd ci`.
Başlatma: `npm.cmd run dev -- --host 127.0.0.1 --port 5175 --strictPort`.

## İlerleme — 2026-10-19

Dayanak: kullanıcının ilk sayfada fazlalıkları kaldırıp yalnız 13 modülü istemesi.

Kontrol: 13/13 modül bağlantısının hedefi HTTP 200 ve ilgili bölüm kimliği döndürdü. Sade başlangıç DOM'unda 13 modül bağlantısı görüldü; genel site menüsü, footer, örnek düğmeleri ve WhatsApp bulunmuyor. BEP yetkinlik seçimi 4/6'dan 5/6'ya ve bilgi kapsamı %68'den %77'ye güncellendi; test seçimi geri alındı. LCA karbon paneli tarayıcıda açıldı. TypeScript --noEmit geçti. Dar ekran görünümü kontrol edildi.

Önceki demo çalışmasında 10 test geçti. Bu düzenleme, 13 modülün tüm mühendislik hesaplarının ve bütün dış servis/çıktı yollarının doğrulandığı anlamına gelmez. Tam üretim derlemesi yapılmadı. Açık işler: modül bazında tam senaryo ve çıktı testleri; sonraki adım kullanıcının belirleyeceği modül üzerinde düzenlemelerdir.

## Kart durum notları — 2026-10-19

Kullanıcının isteğiyle her kart altına küçük doğrulama notu eklendi. 13/13 açılış kontrolü dayanak alındı; genel kartlar “Sayfa açılıyor / İşlev ve çıktı testleri bekliyor” gösterir. ARC örnek veri açılışını, BEP seçim ve sonuç güncellemesini, LCA karbon paneli açılışını belirtir. Bu notlar tam işlev onayı değildir; doğrulanmış bir arıza olmadan “çalışmıyor” etiketi eklenmedi. Kalan hesap ve çıktı senaryoları modül bazında doğrulanacak; sonuçlara göre kart notları güncellenecek.
