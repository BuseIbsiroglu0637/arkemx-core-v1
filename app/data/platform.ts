export type PlatformCard = { title: string; category: string; description: string; meta?: string; price?: string; href?: string; image?: string; imageAlt?: string };

export const documents: PlatformCard[] = [
  { title: "Hafif Çelik Yapı Sistemleri Teknik Rehberi", category: "Teknik Rehber", description: "Sistem seçimi, katmanlar, detay prensipleri ve uygulama kontrol noktaları.", meta: "PDF · 32 sayfa" },
  { title: "Yapı Ön Değerlendirme Formu", category: "Kontrol Listesi", description: "Arsa, ihtiyaç programı, açıklık, yük ve bütçe verilerini proje öncesinde toparlayın.", meta: "PDF · Doldurulabilir" },
  { title: "Çelik Yapı Teklif Karşılaştırma Şablonu", category: "Şablon", description: "Teklifleri kapsam, tonaj, kaplama, montaj ve teslim koşullarına göre karşılaştırın.", meta: "XLSX · Şablon" },
];

export const designs: (PlatformCard & { image: string; imageAlt: string })[] = [
  { title: "Hafif Çelik Konut Sistemi", category: "Sistem Tasarımı", description: "Taşıyıcı karkas, cephe katmanları ve tamamlanmış mimariyi birlikte gösteren temsili çalışma.", meta: "Temsili Arkem çalışma alanı", image: "/portfolio/light-steel-house.webp", imageAlt: "Galvaniz hafif çelik karkası ve tamamlanmış cephesi görünen konut" },
  { title: "BIM ve Statik Koordinasyon", category: "Dijital Mühendislik", description: "Statik tasarım, imalat hazırlığı ve saha koordinasyonunun aynı model üzerinde birleştiği temsili çalışma.", meta: "Temsili Arkem çalışma alanı", image: "/portfolio/bim-engineering.webp", imageAlt: "BIM modeliyle koordine edilen çelik ve prefabrik yapı" },
  { title: "Geniş Açıklıklı Üretim Tesisi", category: "Çelik Yapı", description: "Çelik taşıyıcı sistem ve prefabrik elemanların birlikte değerlendirildiği endüstriyel yapı yaklaşımı.", meta: "Temsili Arkem çalışma alanı", image: "/portfolio/industrial-steel.webp", imageAlt: "Çelik taşıyıcı ve prefabrik panelli endüstriyel tesis" },
];

export const completedWorks: PlatformCard[] = [
  { title: "ROMON Group Yapı Modeli", category: "Prefabrik ve Çelik", description: "Taşıyıcı sistem geometrisi, çatı makasları ve yapı bileşenlerinin üç boyutlu teknik model üzerinden değerlendirildiği çalışma.", meta: "Gerçek proje arşivi · 3B model", image: "https://static.wixstatic.com/media/44ce0e_b689c732462945e78a9f4ed35d25f5d4~mv2.png", imageAlt: "ROMON Group prefabrik ve çelik yapı üç boyutlu teknik modeli", href: "https://static.wixstatic.com/media/44ce0e_b689c732462945e78a9f4ed35d25f5d4~mv2.png" },
  { title: "DİYANET Taşıyıcı Sistem Modeli", category: "3B Projelendirme", description: "Prefabrikasyon, çelik çerçeve ve yapı bileşenlerinin bütüncül olarak incelendiği dijital mühendislik çalışması.", meta: "Gerçek proje arşivi · Model ve PDF", image: "https://static.wixstatic.com/media/44ce0e_f81db79215f24f048da62f06351b4d60~mv2.png", imageAlt: "DİYANET üç boyutlu taşıyıcı sistem modeli", href: "https://d68d317f-d589-4260-b3db-f7c0dc79ed55.usrfiles.com/ugd/44ce0e_cf2016d3507743f182d18b46ec4e23e0.pdf" },
  { title: "Plaza Yapı İncelemesi", category: "Teknik Değerlendirme", description: "Taşıyıcı sistem ve saha verilerinin görsel kayıt üzerinden incelendiği teknik çalışma arşivi.", meta: "Gerçek proje arşivi · 64 sn video", image: "https://static.wixstatic.com/media/44ce0e_f4dbc637852345b4af72dc83dd8177c9f002.jpg", imageAlt: "Plaza projesi teknik inceleme videosu", href: "https://video.wixstatic.com/video/44ce0e_f4dbc637852345b4af72dc83dd8177c9/720p/mp4/file.mp4" },
];

export const posts: PlatformCard[] = [
  { title: "Hafif Çelik Ev Yaptırmadan Önce Bilmeniz Gereken 7 Konu", category: "Hafif Çelik", description: "Doğru proje, üretici seçimi, yalıtım katmanları ve maliyet karşılaştırmasına teknik bir bakış.", meta: "8 dk okuma", href: "/blog/hafif-celik-ev-rehberi", image: "/portfolio/light-steel-house.webp", imageAlt: "Hafif çelik konut sistemi teknik rehberi" },
  { title: "Çelik mi Betonarme mi? Karar Verirken Hangi Veriler Kullanılmalı?", category: "Projelendirme", description: "Taşıyıcı sistem kararını yalnızca ilk maliyete göre vermenin oluşturduğu riskler.", meta: "6 dk okuma", href: "/blog/celik-mi-betonarme-mi", image: "/visuals/projelendirme.webp", imageAlt: "Çelik ve betonarme sistemlerin mühendislik karşılaştırması" },
  { title: "Patlatmalı Bina Yıkımında Proje ve Güvenlik Yönetimi", category: "Yıkım Mühendisliği", description: "Yapısal inceleme, izin, çevresel risk ve uzman koordinasyonunun çerçevesi.", meta: "5 dk okuma", href: "/blog/patlatmali-yikim-guvenlik-yonetimi", image: "/visuals/kontrollu-yikim.webp", imageAlt: "Kontrollü yıkım güvenlik ve saha yönetimi" },
];

export const readyProjects: PlatformCard[] = [
  { title: "ARKEM HÇ–01 Tek Katlı Konut", category: "Hazır Proje Altyapısı", description: "Mimari, statik, üretim ve montaj paftalarının tek ürün paketi olarak sunulacağı tek katlı konut serisi.", meta: "Nihai plan ve proje dosyaları eklendiğinde satışa açılacak", price: "Ön talep alınıyor", image: "/visuals/hazir-hc01.webp", imageAlt: "Tek katlı hafif çelik hazır konut tasarımı" },
  { title: "ARKEM HÇ–02 Aile Evi", category: "Hazır Proje Altyapısı", description: "Farklı arsa ve ihtiyaçlara uyarlama seçenekleriyle sunulacak aile evi proje paketi.", meta: "Nihai plan ve proje dosyaları eklendiğinde satışa açılacak", price: "Ön talep alınıyor", image: "/visuals/hazir-hc02.webp", imageAlt: "Geniş aileler için hafif çelik konut tasarımı" },
  { title: "ARKEM HÇ–03 Dubleks Konut", category: "Hazır Proje Altyapısı", description: "İki katlı konut için taşıyıcı sistem, uygulama ve üretim dokümanlarını birleştirecek ürün paketi.", meta: "Nihai plan ve proje dosyaları eklendiğinde satışa açılacak", price: "Ön talep alınıyor", image: "/visuals/hazir-hc03.webp", imageAlt: "İki katlı hafif çelik dubleks konut tasarımı" },
];

export const trainings: PlatformCard[] = [
  { title: "Hafif Çelik Yapılara Giriş", category: "Video Eğitim Altyapısı", description: "Sistem bileşenleri, yük aktarımı, panelizasyon ve doğru detay okuma temelleri.", meta: "Ders videoları eklendiğinde üyelik erişimine açılacak", price: "Ön kayıt alınıyor", image: "/portfolio/light-steel-house.webp", imageAlt: "Hafif çelik yapı sistemi eğitim içeriği" },
  { title: "Uygulamacılar İçin Hafif Çelik Montaj", category: "Video Eğitim Altyapısı", description: "Şantiye hazırlığı, panel montajı, bağlantılar ve kalite kontrol adımları.", meta: "Ders videoları eklendiğinde üyelik erişimine açılacak", price: "Ön kayıt alınıyor", image: "/visuals/yapim.webp", imageAlt: "Çelik yapı montajı eğitim içeriği" },
  { title: "Mühendisler İçin Proje Okuma Atölyesi", category: "İleri Seviye", description: "Statik proje, üretim paftası ve saha uygulaması arasındaki koordinasyonu okuyun.", meta: "Ders videoları eklendiğinde üyelik erişimine açılacak", price: "Ön kayıt alınıyor", image: "/visuals/projelendirme.webp", imageAlt: "BIM ve statik proje okuma eğitimi" },
];
