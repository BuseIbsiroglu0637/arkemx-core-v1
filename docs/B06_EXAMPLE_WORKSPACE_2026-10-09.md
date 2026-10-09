# B06 örnek çalışma alanı

9 Ekim 2026 — Gerçek proje dosyası bulunmadığı için kullanıcı onayıyla açıkça sentetik bir örnek hazırlanmıştır.

Plan ve Aks ekranındaki “iki katlı örnek modelle çalışın” bağlantısı `/ornek-kat-modeli` sayfasını açar. Örnek kendi geçici React durumunu kullanır; mevcut ProjectKernel projesine aktarılmaz. Sayfa yenilenince başlangıç örneği yüklenir. JSON/PDF/DXF indirmeleri ayrıca saklanabilir.

K1 10×10=100 m², K2 20×10=200 m². Kat kotları 0 ve 3,4 m; ankastre taban −3,4 m. Dört kolon ve iki kirişle tek örnek çerçeve vardır. Alan yükleri iki kat düğümüne %50/%50 açık payla dağıtılır. Bu dağılım gerçek döşeme davranışının çözümü değildir. Malzeme ve kesit değerleri yalnız örnek içindir; uygulama projesi önerisi değildir.

Başlangıç Q=3,5 kN/m², H=5 kN; Q ve H kullanıcı tarafından 0–50 aralığında değiştirilebilir. Boş giriş sıfır olmaz. Uygulanan yeni yükler eski ekrandaki sonucu kaldırır; yeniden çözüm gerekir. Başlangıç toplamları G=2205, Q=1050, S=150 kN; G mevcut ön alan yükü yaklaşımıdır. Q=7 durumunda toplam düşey Q reaksiyonu 2100 kN olur.

Örnek kimliği hem ekranda hem hesap/belge JSON içeriğinde ve DXF manifestinde bulunur. PDF'de açık örnek uyarısı ve gömülü kaynak kaydı vardır. Kaynak örnek etiketi kaldırılırsa eski model bağlantısı geçerli sayılmaz. technicalApproval/fullBuildingAnalysis false kalır.

Kontroller: dört yeni birim testi; iki yeni gerçek tarayıcı senaryosu (mevcut proje değişmezliği, üç biçimde indirme, PDF gömülü kayıt, yük değişikliği, boş giriş, reload); bağımsız OpenSees referansına gerçek yayımlanan örnek modeli eklendi. Paket toplamı 90 G05 birim, 27 tarayıcı ve 11 bağımsız referans yük durumudur. Son CI durumu ayrı ilerleme kaydında gösterilir.

Bu adım B06'nın gerçek proje veya yetkili mühendis kabulünü kapatmaz. Gerçek veri geldiğinde ayrı proje modeli kurulup kabul ölçütleriyle doğrulanır; kabuk/deprem/kapasite kapsamı ayrıca açıktır. Ana MCP kayıtları ve deneme görevi değiştirilmemiştir.
