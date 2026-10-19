# ARKEM Web V3.0 proje denetimi

Tarih: 8 Ağustos 2026  
Dayanak: Kullanıcı tarafından onaylanan “Web V3.0 — Nihai Master Strateji, Tasarım ve Uygulama Raporu”  
Denetlenen taban: Canlı V2.2 kaynak durumu ve son kullanıcı mobil menü ekranı

## Taban durumu

- Kaynak çalışma ağacı temizdir ve uzak ana dalla aynıdır.
- Mevcut canlı sürüm geri dönüş noktası olarak korunmaktadır.
- Ana menü sırası ve ana sayfanın 00–08 bölüm hiyerarşisi V3.0 ile büyük ölçüde uyumludur.
- ARKEMX bugün üretime hazır yazılım gibi sunulmamakta; geliştirme önizlemesi ve kullanım sınırları açıkça belirtilmektedir.
- Davranış, rota, veri devamlılığı, mobil stil ve ürün doğruluğu için geniş bir regresyon paketi bulunmaktadır.

## Kritik bulgular

### C-01 — ARKEMX ürün sözleşmesi V3.0 ile çelişiyor

- Önem: Kritik
- Kanıt: `app/data/arkemx-v22.ts` dört geçici üst katman tanımlar. `tests/rendered-html.test.mjs` Web V2.2 sözleşmesinde “13 modül” ifadesini açıkça yasaklar.
- Etki: Onaylanan 13 Proje Mühendisliği Modülü yayınlanamaz; ürün mimarisi ve testler birbirini engeller.
- Güven: Yüksek
- Karar: V3.0’ın 13 modüllü müşteri taksonomisi tek kaynak olarak dondurulacak; kaynak kodu teknik modül sayısıyla karıştırılmadığını açıklayan zorunlu ürün sınırı korunacak.
- Sonraki modül: Ürün planlama → uygulama

### C-02 — Kurumsal gerçek veri kaynağı tamamlanmamış

- Önem: Kritik
- Kanıt: `app/data/site.ts` marka adını aynı zamanda `legalName` olarak kullanıyor; kurumsal e-posta yerine genel Gmail adresi bulunuyor. Resmî tüzel unvan, kuruluş/marka başlangıç tarihi ve Öztürk İnşaat ilişkisi için doğrulanmış tek kaynak yok.
- Etki: Footer, yapılandırılmış veri, kurumsal sayfa ve dış kanallar çelişebilir.
- Güven: Yüksek
- Karar: Doğrulanmamış alanlar gerçek bilgi gibi yayımlanmayacak; marka adı ile hukuki unvan ayrılacak.
- Sonraki modül: Bağlam doğrulama → uygulama

### C-03 — Dört öncelikli proje henüz case study kanıtına sahip değil

- Önem: Kritik
- Kanıt: `app/page.tsx` ve `app/projeler/page.tsx` Viakasta, Cihan Tat Gıda, Yapıkur Plaza ve Devrekani BOSB kayıtlarını “arşiv doğrulaması” sınırıyla gösteriyor; yıl, alan, taşıyıcı sistem, ARKEM kapsamı ve gerçek proje görseli yok.
- Etki: Sitenin birinci stratejik ekseni olan gerçek proje kanıtı henüz dönüşüm üreten düzeyde değil.
- Güven: Yüksek
- Karar: Veri gelene kadar sınır korunacak; sahte tamamlanmış case study üretilmeyecek.
- Sonraki modül: İçerik toplama → uygulama

## İzlenmesi gereken bulgular

### W-01 — Türkçe ana arayüzde İngilizce teknik sunum kalıntıları var

- Önem: İzle
- Kanıt: `tasarim-calismalari`, `mimari-program-studyosu`, `muhendislik-koordinasyon`, `proje-os` ve bazı ortak bileşenlerde `ENGINE`, `WORKSPACE`, `DELIVERY`, `PROJECT OS` gibi ziyaretçiye dönük etiketler bulunuyor.
- Etki: V3.0 Türkçe ana dil kuralı ve marka bütünlüğü zayıflıyor.
- Güven: Yüksek
- Karar: Teknik şema/ürün kimliği gereken yerler dışında arayüz metni Türkçeleştirilecek; iç veri kodları ziyaretçi metninden ayrılacak.
- Sonraki modül: Uygulama

### W-02 — Stil katmanı sürüm eklemeleriyle kırılgan hale gelmiş

- Önem: İzle
- Kanıt: `app/layout.tsx` çok sayıda ardışık `vXX.css` dosyası ile sonradan yüklenen `responsive.css`, `v21.css` ve `v22.css` katmanlarını birlikte taşıyor. Aynı menü seçicileri birkaç dosyada `!important` ile tekrar ediliyor.
- Etki: Bir iç sayfaya geçildiğinde menü, renk, taşma veya tipografi önceki sürümden etkilenebiliyor; mobil hataların kök nedeni zor izleniyor.
- Güven: Yüksek
- Karar: V3 tasarım sözleşmesi son ve tek sahipli katman olarak kurulacak; eski dosyalar aşamalı biçimde emekliye ayrılacak.
- Sonraki modül: Yeniden düzenleme

### W-03 — Mobil menü okunabilirliği kaynakta düzeltilmiş olsa da gerçek cihaz kanıtı eksik

- Önem: İzle
- Kanıt: Kullanıcı ekranında 01–06 satırlarında başlıklar görünmüyordu. Son kaynak `SiteChrome.tsx` içinde başlıkları yazıyor ve `v22.css` açık/koyu durum kontrastını zorluyor; ancak güncel 375/390/430 px tarayıcı kanıtı yeniden alınmalıdır.
- Etki: Birincil navigasyon kullanılamaz hale gelebilir.
- Güven: Orta
- Karar: Menü başlığı, normal/hover/focus/açık durumları ve iç sayfa bağlamı gerçek mobil ölçülerde kabul testine bağlanacak.
- Sonraki modül: Uygulama → değişiklik inceleme

### W-04 — Referans medyası eski Wix dosyalarına bağımlı

- Önem: İzle
- Kanıt: `app/data/references.ts` görsel, video ve PDF için dış Wix alanlarını kullanıyor.
- Etki: Görsel kırılması, üçüncü taraf gecikmesi ve arşiv bağlantısı kaybı oluşabilir.
- Güven: Yüksek
- Karar: Kullanım hakkı doğrulanan dosyalar yerel/kurumsal medyaya taşınacak; kopyalanamayan bağlantılar sağlık kontrolüne bağlanacak.
- Sonraki modül: Uygulama

### W-05 — Proje dosyası yükleme gerçek bir yükleme değil

- Önem: İzle
- Kanıt: `app/iletisim/page.tsx` ve `ProjectBriefForm` dosyanın sunucuya yüklenmediğini, kullanıcının e-posta veya WhatsApp’a kendisinin eklemesi gerektiğini bildiriyor.
- Etki: V3.0 dönüşüm formunun belge toplama hedefi tamamlanmıyor.
- Güven: Yüksek
- Karar: Güvenli depolama, izin verilen uzantı, boyut, zararlı dosya taraması, KVKK ve CRM hedefi belirlenmeden gerçek yükleme açılmayacak.
- Sonraki modül: Teknik planlama

### W-06 — Çok dilli SEO ayrı URL sözleşmesini karşılamıyor

- Önem: İzle
- Kanıt: `app/layout.tsx` dil alternatiflerini `?lang=` sorgu parametresiyle tanımlıyor; V3.0 ayrı URL ister.
- Etki: Canonical/hreflang sinyalleri ve lokalize indekslenebilirlik zayıf kalabilir.
- Güven: Yüksek
- Karar: `/en`, `/az`, `/ru`, `/it`, `/de`, `/fr` rota stratejisi içerik sözlüğü ve canonical göç planıyla birlikte uygulanacak.
- Sonraki modül: Teknik planlama → uygulama

## Bilgilendirici bulgular

### I-01 — Ana bilgi mimarisi doğru yönde

- Kanıt: `app/data/site.ts` ana menüyü V3 sırasıyla; `app/page.tsx` ana sayfayı 00–08 sırasıyla tanımlar.
- Etki: V3’ün ilk dikey dilimi yeniden platform kurmadan uygulanabilir.
- Güven: Yüksek

### I-02 — ARKEMX dürüstlük sınırı korunmaya değer

- Kanıt: Ürün korumaları gerçek yapı/ruhsat/saha/güvenlik kararında kullanılamayacağını açıklar; geçmiş projelere geriye dönük ARKEMX etiketi basılmaz.
- Etki: V3 modül taksonomisi eklenirken güvenilir ürün konumlandırması kaybedilmemelidir.
- Güven: Yüksek

## Denetim kararı

V3.0 uygulaması için engel yoktur; fakat ilk dikey dilim ürün sözleşmesi, kurumsal veri sınırı ve mobil tasarım sözleşmesini birlikte ele almalıdır. Gerçek proje verisi gerektiren alanlar “doğrulama bekliyor” olarak kalacak ve yayın iddiası genişletilmeyecektir.

