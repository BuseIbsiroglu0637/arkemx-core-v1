# ARKEMX CORE V1 — İlk Aşama Test ve Kanıt Raporu

**Belge kodu:** ARKEMX-CORE-V1-TEST-20260926  
**Belge tarihi:** 26 Eylül 2026  
**Durum:** İlk aşama prototipinin tanımlı yazılım testleri tamamlandı; gerçek proje/üretim kabulü değildir.  
**Depo:** [BuseIbsiroglu0637/arkemx-core-v1](https://github.com/BuseIbsiroglu0637/arkemx-core-v1)  
**Çalıştırılan kod revizyonu:** `main` — kullanıcı terminal kaydında çekilen `5faaa9d` (kısa commit kimliği).  
**Kanıt türü:** Kullanıcının Codespaces terminalinden sağladığı derleme ve test çıktısı; bağımsız CI raporu veya imzalı kabul tutanağı değildir.  
**Ham kayıt:** [26 Eylül 2026 terminal test çıktısı](./test-evidence/ARKEMX_CORE_V1_TEST_LOG_2026-09-26.txt) (Git blob: `846bf266e117bbd28cf94f7731ff8906d6285816`).

## 1. Kapsam

İlk aşama yazılım doğrulaması, tek proje kimliği altında **Mimari Program → Plan/Aks → Taşıyıcı Ön Tasarım → BIM Disiplin Koordinasyonu → Proje OS → Dijital Teslim** akışını ve negatif/güvenlik senaryolarını kapsar.

Bu rapordaki «başarılı» ifadesi, aşağıdaki sentetik test vakalarının beklenen yazılım davranışını ürettiğini belirtir; ruhsat, yapı güvenliği veya resmî dijital teslim onayı verildiğini ifade etmez.

## 2. Çalıştırma ve sonuç özeti

| Kontrol | Kaydedilen sonuç | Dayanak |
|---|---|---|
| Derleme (`npm run build`) | **Başarılı**; Sites artifaktı doğrulandı | Ham log, «Build complete» ve «Validated Sites artifact» |
| Depo otomatik testleri (`npm test`) | **133 / 133 başarılı**, 0 başarısız, 0 atlanan | Ham log, Node test özeti |
| Tarayıcıda uçtan uca akış | **13 / 13 başarılı** | Ham log, «SONUC: 13/13» |
| Son durumda aktif kritik konu | **0** (testin ürettiği ve düzelttiği sentetik senaryoda) | `BILGI TESLIM`: `criticalIssueCount:0` |
| Son teslim kapısı | **`review-required`**; resmî yayın **uygun değil** | `officialReleaseEligible:false` |
| Çalışma manifestosu | **Üretilebilir**, fakat **onaylı teslim değildir** | `workingExportEligible:true` |

**Uygulanan komutlar:**

```bash
git pull --ff-only origin main
npm test
node scripts/arkemx-architecture-bim-handoff-test.mjs
```

Mevcut `package.json` içindeki otomatik test komutu: `npm run build && node --experimental-strip-types --test tests/rendered-html.test.mjs tests/zoning-access.test.mjs tests/issue-lifecycle.test.mjs tests/delivery-readiness.test.mjs tests/project-graph-eccentricity.test.mjs`.

## 3. Uçtan uca doğrulanan 13 vaka

Aşağıdaki adlar, depodaki tarayıcı testinin `check(...)` aşamalarından alınmıştır:

1. Bagimsiz taslak proje olusturuldu
2. Mimari alan ve kat revizyonu kaydedildi
3. Mimari sema plan aks modeline aktarildi
4. Aks ve mimari geometri tasiyici on tasarima aktarildi
5. Mimari ve tasiyici kaynaklari BIM koordinasyonuna baglandi
6. BIM kaydi yenileme sonrasi korundu
7. Kritik MEP yukseklik cakismasi gercekten yakalandi
8. Cakisma kaydi incelendi durumuyla saklandi
9. Proje OS kritik BIM kaydini kapatamadi ve 4B-5B kapisini bloke etti
10. Girdi duzeltmesi kural blokajini kaldirdi; teknik onay vermedi
11. Dijital teslim kapisi resmi yayini kilitledi
12. Eksik KM-KR nesneleri kritik yerine inceleme konusu oldu
13. Calisma teslim manifestosu resmi onay iddiasi uretmedi

**Özellikle doğrulanan karar sınırları:**

- Mimari şema ile taşıyıcı ön tasarımın ortak geometri/revizyon bağlantısı ve BIM kaydının sayfa yenilenmesinden sonra korunması.
- Sentetik negatif senaryoda kat yüksekliği **3,40 m**, MEP servis zonu **2,00 m** yapıldığında net yüksekliğin **0,65 m** olarak hesaplanması ve **iki kritik çakışma** kaydı oluşması.
- Kritik issue «incelendi» durumuna alınsa da açık kalması; Proje OS üzerinde 4B/5B onay kapısının bloke kalması ve teknik onayın otomatik verilmemesi.
- Test girdileri başlangıç durumuna döndürüldüğünde parametrik çakışma blokajının kalkması; bu işlemin mühendislik onayı yerine geçmemesi.
- Kütle merkezi/rijitlik merkezi (KM–KR) için kolon/perde nesneleri eksik olan kavramsal planda **BIM-052** sahte kritik uyarısının oluşmaması; **BIM-053** inceleme kaydının açık bırakılması.
- Nihai çalışma manifestosunda `state:"review-required"`, `officialReleaseEligible:false`, `workingExportEligible:true`, `criticalIssueCount:0` ve `blockingIssues:[]` olması.

## 4. Teslim edilebilir yazılım kanıtları

| Kaynak | İşlev |
|---|---|
| `scripts/arkemx-architecture-bim-handoff-test.mjs` | 13 adımlık uçtan uca Playwright testi |
| `tests/rendered-html.test.mjs` | Render, rota ve mevcut web sözleşmesi kontrolleri |
| `tests/zoning-access.test.mjs` | Güvenilmeyen imar girdisinin yetkili onaya dönüşmesini engelleyen kontrol |
| `tests/issue-lifecycle.test.mjs` | Kritik BIM issue inceleme/çözüm ayrımı |
| `tests/delivery-readiness.test.mjs` | Resmî teslim yetkisi ve çalışma manifestosu sınırı |
| `tests/project-graph-eccentricity.test.mjs` | KM–KR hesaplanabilirliği ve eksik kaynak nesnesi senaryoları |
| `app/lib/delivery-readiness.ts` | Dijital teslim hazırlık kapısı ve taslak manifesto |
| `app/lib/project-graph.ts` | Modüller arası veri zinciri ve disiplin uyarıları |
| `app/lib/issue-lifecycle.ts` | Issue inceleme ile teknik çözüm ayrımı |

## 5. Sınırlamalar, açık konular ve sonraki aşama

1. **Sentetik test:** Geometri ve mühendislik girdileri test amaçlıdır. Geçerli imar hakkı, ruhsat, statik emniyet, yangın veya geoteknik yeterlilik doğrulanmamıştır.
2. **Model teslimi:** Üretilen IFC/BCF çıktısı hazırlık manifestosu niteliğindedir; onaylı native IFC modeli, BCFZIP, doğrulanmış GUID ve yetkili model incelemesi bulunmaz.
3. **Yetkilendirme:** Yerel proje kaydı değiştirilebilir. Gerçek elektronik imza, sunucu tarafı rol/yetki, doğrulanmış dosya bütünlüğü ve kurumsal CDE onay iş akışı ayrıca geliştirilmelidir.
4. **Açık inceleme:** **BIM-053** eksik kolon/perde verisine ilişkin kavramsal inceleme konusudur; test sonunda kritik olmaması çözülmüş veya imzalanmış mühendislik hesabı anlamına gelmez.
5. **Teknik iyileştirme:** Build çıktısında bazı istemci parçalarının **500 kB üstünde** olduğu uyarısı ve Vinext'in kimi rotaları statik analizle sınıflandıramadığı notu vardır. Bunlar mevcut test geçişini engellememiştir; üretim öncesi performans/rota kontrollerinde değerlendirilmelidir.
6. **Kanıt seviyesi:** Bu raporun sonuçları **kullanıcının yüklediği terminal kaydına** dayanır; GitHub Actions çalışması, farklı cihaz/tarayıcı matrisi, yük/penetrasyon testi veya bağımsız üçüncü taraf kabulü kaydedilmiş değildir.

**İlk aşama kapanış notu:** Tanımlı prototip yazılım ve entegrasyon testleri 26.09.2026 tarihli kullanıcı terminal kaydında başarılıdır. Sıradaki geliştirme, gerçek kaynak belge ve model kanıtının sunucu tarafında doğrulanması, rol bazlı inceleme ve gerçek proje pilotu ile kapsam genişletilmesidir.

---
Bu belge test kanıtı envanteri içindir; yetkili mühendis onayı, resmî yapı belgesi veya hukuki uygunluk görüşü değildir.
