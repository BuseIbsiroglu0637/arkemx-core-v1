# B06 S2 — doğrusal düz dikdörtgen kabuk çözücüsü

Tarih: 10 Ekim 2026. Kaynaklar sentetik, bağımsız ve düz dikdörtgendir. Bu sürüm mühendislik tasarımı/onayı veya birleşik bina modeli değildir. S1 kaynakları korunur; S2 kaynak → hesap kaydı ve bağımsız sayısal doğrulama ekler. S3 sonuç ekranı ve PDF/DXF akışı sonraki adımdır.

## Formülasyon ve sonuç sözleşmesi

ARKEM-RECT-MITC4/1.0: dört düğümlü düzlem gerilmeli bilineer membran ve Reissner–Mindlin eğilme/kesme. Fiziksel serbestlikler ux/uy/uz/rx/ry/rz; orta yüzey XY, normal +Z. Elemanlar yalnız eksenlere paralel düzenli dikdörtgenlerdir. Ağ güncel kaynak sözleşmesinden yeniden üretilir; dışarıdan hazır eleman/mesnet/sonuç alınmaz. İdeal düzenli ağdan koordinat yuvarlamasıyla sapma çözümde reddedilir.

MITC kesmesi: γxz=w,x+ry, γyz=w,y−rx; γxz doğal (0,±1), γyz (±1,0) kenar orta noktalarında örneklenip karşı yönde interpolasyonla taşınır. Membran εxx=u,x, εyy=v,y, γxy=u,y+v,x. Eğrilik κxx=−ry,x, κyy=rx,y, κxy=rx,x−ry,y. 2×2 Gauss integrasyonu; kayma düzeltmesi 5/6; E/ν'den türetilen G. Membran kesiti Et/(1−ν²), eğilme D=Et³/[12(1−ν²)], enine kesme 5Gt/6.

Drilling rz stabilizasyonu açık ceza terimidir: Gt α [0,5(v,x−u,y)−rz]². α=1 varsayılan; 0,01–100 aralığı ayrı hesap kimliğine dahil edilir. Bu terim fiziksel bir döşeme torsiyon parametresi olarak sunulmaz. Altı rijit hareket, tek/çok eleman membran çekme ve kayma, sabit kesme/eğilme alanları test edilir.

Ham sonuçlar dört Gauss noktasında Nx/Ny/Nxy (kN/m), Mxx/Myy/Mxy (kNm/m), Qx/Qy (kN/m). Moment işareti OpenSees kesit sözleşmesiyle M=−Dκ; eğilme iç düğüm kuvvetleri enerjiyle uyumlu işarette kuruludur. Dönmeler rad, ötelemeler m; mesnet kuvveti kN, mesnet momenti kNm. İç kuvvetler grafik için yumuşatılmadan kaydedilir. Yakınsama momentleri x/a,y/b∈{0,25;0,5;0,75} noktalarında Gauss bilineer ekstrapolasyonu ve komşu eleman ortalamasıyla örneklenir; aynı kural tüm ağlara uygulanır.

Alan yükü eleman şekil fonksiyonlarıyla tutarlı biçimde entegre edilir; düzgün dikdörtgende dört köşeye −qA/4 kN. G_SW/G_SUP/Q/BENCH ayrı; G türetilmiş durumdur. Birim yük çözümü doğrusal durumlara ölçeklenir; bağımsız referansta varsayılan dört geometri/mesnet için G_SW/G_SUP/G/Q ayrıca gerçek yüklerle çalıştırılır. Sıfır yük tam sıfır üretir; sayısal yük/deplasman alt taşması kabul edilmez.

## Çözüm ve güvenilir sonuç koşulları

Serbest denklemler simetrik alt bant içinde saklanır. Diyagonal ölçekleme ve bant Cholesky; pozitif olmayan/küçük pivot, mekanizma, sonlu olmayan değer, geçersiz kaynak veya kuvvet/moment denge artığı >1e−8 sonucu engeller. Global moment hesabı hem mesnet momentlerini hem kuvvetlerin kollarını içerir. Kuvvet ve moment artıkları ayrı ölçeklenir.

Hesap kaydı ARKEM-SHELL-CALCULATION-RECORD/1.0, kimlik SHELL-CALC-SHA256. Kaynak, ağ, formülasyon/ceza katsayısı ve tüm ham sonuçlar mühürlü içeriktedir; süre ve bellek tanıları ayrıca saklanır. Yeniden çözüm kimliği doğrular; içerik tekrar hash'lense de tahrif edilmiş sonuç güncel hesabı geçmez. Çözücü durumu solved-pilot-awaiting-independent-validation olarak kalır; bağımsız kabul raporu ayrı ARKEM-SHELL-VALIDATION/1.0 kaydıdır. Genel kaynaklar için bir test raporunun geçmesi otomatik doğrulanmış tasarım sonucu oluşturmaz.

## Ağ inceltme kararı

S1'in üç ağı değiştirilmedi: P1 4×4/8×8/16×16; P2 8×4/16×8/32×16; varsayılan orta örnek ve kaynak kimlikleri korunur. İlk üç ağda P2-CL merkez sehim farkı %3,605 ve iç bölge moment farkı yaklaşık %4,958 bulundu; %1/%3 hedefleri karşılanmadı. Toleranslar gevşetilmedi.

Açık kaynak 1.1 ve ORNEK-SHELL-01-R1 revizyonunda dördüncü refined yoğunluğu eklendi: P1 32×32 / 1.089 düğüm; P2 64×32 / 2.145 düğüm. 1.1 sınırı her yönde 64, toplam 2.048 dörtgen / 2.145 düğüm; eski 1.0 sınırı 512 / 561 aynıdır. Hazırlanan dış şema alanları aynı olduğundan prepared/1.0 korunur; içerikteki kaynak sürümü ve revizyon kaynak/hash farkını açıkça taşır.

Dördüncü ağ son iki ağ arasında bütün senaryolarda sehim ≤%1 ve iç bölge moment norm farkı ≤%3 verir. %3 ölçütü seçili üç moment bileşeninin alan normuna göre maksimum mutlak farktır; sıfıra yakın nokta bileşenlerinde anlamsız bağıl hata kullanılmaz. %1 bağımsız sehim/reaksiyon, %5 ham iç kuvvet hedefi tüm alan bileşenleri için uygulanır. Yerel sayılar ve CI sonucu tarihli ilerleme kaydına yazılır.

## Worker ve performans

calculateShellInWorker her çağrıda ayrı module worker açar; sonuç/hata/zaman aşımı/iptalde worker kapatılır. AbortSignal iptalinde AbortError ve sonuç yoktur. Varsayılan zaman sınırı 30 saniye, en fazla 60 saniye; sınır aşılınca sonuç kabul edilmez. Worker tarayıcıya bağlanmış yardımcı API'dir; kullanıcı ekranına S3'te bağlanacaktır.

diagnostics.elapsedMs çözücü süresidir, hash/kopyalama dahil değildir. factorStorageBytes iki bant matrisi ve ölçek vektörünün gerçek byteLength toplamıdır; uygulamanın toplam heap ölçümü değildir. Maksimum örnek worker'da ayrıca uçtan uca süre, ana iş parçacığı zamanlayıcısı ve iptal test edilir; 30 s / 120 MB sayısal faktör depolama sınırı uygulanır. Nesneler, JSON, worker başlatma ve mesaj kopyası ek bellek kullanır.

## Bağımsız doğrulama ve kanıt

Sabitlenmiş openseespy/openseespywin/openseespylinux 3.7.1.2, raporlanan motor 3.7.1. Python oracle kaynak beyanından kendi düğüm, eleman, mesnet ve tutarlı yükünü kurar; ARKEMX matrisi veya sonuçlarını kullanmaz. ElasticMembranePlateSection dinamik yoğunluğu 0'dır; γ doğrudan kütle yoğunluğu alanına geçirilmez. Malzeme, mesnet, yük, sıra ve ham Gauss sonuçları eşlenir.

37 bağımsız model/yük karşılaştırması: 16 plaka–mesnet–ağ, 16 ek gerçek yük durumu, dört tek/çok eleman membran benchmarkı, bir ince plaka. Navier Fourier çözümü SS-H merkez sehmini ve ince Kirchhoff limitini ayrıca doğrular. Dört yakınsama raporu tüm dört ağı, toleransları ve önceki yetersiz farkları korur. Drilling α=0,01/1/100 duyarlılığı ayrıca kaydedilir.

npm run test:g05 → kaynak + çözücü birim testleri. tests/shell-reference.mjs → bağımsız rapor, dört refined mühürlü hesap JSON'u ve ham oracle dosyaları. shell-worker-browser → responsive tarayıcı, iptal, hatalı rijitlik, timeout ve önceden iptal kontrolleri. CI aynı commit üzerinde bu paketleri mevcut çerçeve ve UI testleriyle beraber çalıştırır; test-artifacts/g05 artifact'i bütün JSON kanıtını kapsar.

Birincil dayanaklar: [OpenSees ShellMITC4](https://openseespydoc.readthedocs.io/en/latest/src/ShellMITC4.html), [ElasticMembranePlateSection](https://openseespydoc.readthedocs.io/en/latest/src/elasticMembranePlateSection.html), [sabit 3.7.1 eleman kaynağı](https://github.com/OpenSees/OpenSees/blob/v3.7.1/SRC/element/shell/ShellMITC4.cpp), [sabit kesit kaynağı](https://github.com/OpenSees/OpenSees/blob/v3.7.1/SRC/material/section/ElasticMembranePlateSection.cpp). Navier serisi ve membran el hesabı bağımsız test yardımcısında açık kodla saklanır.

## Açık kapsam

S3: örnek kabuk ekranı, sonuç haritaları, JSON/PDF/DXF ve kullanıcı girdisi değişiminde eski hesabın engellenmesi. S4: kolon/kiriş bağlantısı, kaçıklık/destek alanı ve birleşik çerçeve–kabuk/diyafram davranışı. Gerçek proje, poligon/boşluk, çatlama/donatı/kapasite/zımbalama, dinamik/deprem, yönetmelik birleşimleri ve yetkili mühendis kabulü bu çözümün sonucu değildir. fullBuildingAnalysis=false ve technicalApproval=false.
