"use client";

import { useEffect, useMemo, useState } from "react";
import { downloadTextFile } from "../lib/engineering";
import { ProjectKernelBar, useProjectKernel } from "./ProjectKernel";

type Tab = "brief" | "lca" | "dfma" | "site" | "passport" | "twin";
type System = "Betonarme" | "Betonarme Prefabrik" | "Yapısal Çelik" | "Hafif Çelik";

const tabs: { id: Tab; no: string; code: string; label: string }[] = [
  { id: "brief", no: "01", code: "BRF", label: "Teknik Brief" },
  { id: "lca", no: "02", code: "LCA", label: "Karbon Modülleri" },
  { id: "dfma", no: "03", code: "DFM", label: "DfMA & Lojistik" },
  { id: "site", no: "04", code: "RLT", label: "Saha Gerçekliği" },
  { id: "passport", no: "05", code: "AIM", label: "Varlık Pasaportu" },
  { id: "twin", no: "06", code: "DTW", label: "Senaryo İkizi" },
];

const systems: Record<System, { a1a3: number; mass: number; construction: number; reuse: number; lead: number; tolerance: number }> = {
  "Betonarme": { a1a3: 430, mass: .82, construction: 100, reuse: 22, lead: 18, tolerance: 20 },
  "Betonarme Prefabrik": { a1a3: 350, mass: .61, construction: 69, reuse: 54, lead: 28, tolerance: 12 },
  "Yapısal Çelik": { a1a3: 305, mass: .095, construction: 60, reuse: 84, lead: 35, tolerance: 5 },
  "Hafif Çelik": { a1a3: 238, mass: .052, construction: 47, reuse: 90, lead: 24, tolerance: 3 },
};

const assetFields = ["Model konumu / GUID", "Üretici ve ürün kodu", "EPD / malzeme kaydı", "Montaj ve test belgesi", "Garanti ve bakım planı", "Söküm / yeniden kullanım", "Yetkili sorumlu", "Revizyon geçmişi"];

export function ArkemXLab() {
  const { patchModule, thread } = useProjectKernel();
  const [tab, setTab] = useState<Tab>("brief");
  const [area, setArea] = useState(2400);
  const [type, setType] = useState("Sanayi / Üretim");
  const [priority, setPriority] = useState("Program kesinliği");
  const [system, setSystem] = useState<System>("Yapısal Çelik");
  const [transport, setTransport] = useState(180);
  const [recycled, setRecycled] = useState(35);
  const [epdQuality, setEpdQuality] = useState<"Ürün EPD" | "Sektör EPD" | "Genel katsayı">("Sektör EPD");
  const [serviceLife, setServiceLife] = useState(50);
  const [moduleWidth, setModuleWidth] = useState(3);
  const [moduleLength, setModuleLength] = useState(12);
  const [pieceWeight, setPieceWeight] = useState(8.5);
  const [craneCapacity, setCraneCapacity] = useState(25);
  const [repetition, setRepetition] = useState(72);
  const [planned, setPlanned] = useState(68);
  const [actual, setActual] = useState(63);
  const [captureCoverage, setCaptureCoverage] = useState(84);
  const [issues, setIssues] = useState(7);
  const [material, setMaterial] = useState("Ana taşıyıcı çelik kolon");
  const [assetChecks, setAssetChecks] = useState([true, true, false, true, true, false, true, true]);
  const [scenario, setScenario] = useState("Baz işletme");

  const lca = useMemo(() => {
    const profile = systems[system];
    const qualityUncertainty = epdQuality === "Ürün EPD" ? 8 : epdQuality === "Sektör EPD" ? 18 : 32;
    const recycledFactor = 1 - Math.min(55, recycled) * .0023;
    const a1a3 = profile.a1a3 * area * recycledFactor / 1000;
    const transportedTonnes = profile.mass * area;
    const a4 = transportedTonnes * transport * .00009;
    const a5 = a1a3 * (profile.construction / 100) * .035;
    const b4 = a1a3 * Math.max(0, serviceLife - 50) / 250;
    const c = a1a3 * (1 - profile.reuse / 100) * .08;
    const d = -a1a3 * profile.reuse / 100 * .16;
    const upfront = a1a3 + a4 + a5;
    const wholeLife = upfront + b4 + c + d;
    return { a1a3, a4, a5, b4, c, d, upfront, wholeLife, perM2: wholeLife * 1000 / area, qualityUncertainty, transportedTonnes };
  }, [area, epdQuality, recycled, serviceLife, system, transport]);

  const dfma = useMemo(() => {
    const moduleArea = moduleWidth * moduleLength;
    const moduleCount = Math.ceil(area / moduleArea);
    const craneUse = pieceWeight / craneCapacity * 100;
    const trips = Math.ceil(moduleCount / Math.max(1, Math.floor(13.6 / moduleLength) * 2));
    const toleranceBudget = systems[system].tolerance + (repetition < 50 ? 8 : 2);
    return { moduleArea, moduleCount, craneUse, trips, toleranceBudget, manufacturability: Math.max(28, Math.min(96, repetition * .55 + (100 - craneUse) * .24 + systems[system].reuse * .2)) };
  }, [area, craneCapacity, moduleLength, moduleWidth, pieceWeight, repetition, system]);

  const brief = useMemo(() => {
    const base = priority === "Program kesinliği"
      ? ["İşveren gereksinimleri / OIR–PIR", "4B baz program ve karar tarihleri", "Uzun terminli paket ön kaydı"]
      : priority === "Yatırım maliyeti"
        ? ["Aynı kapsamlı sistem alternatifleri", "5B sınıflandırılmış ön metraj", "Değişiklik ve risk karşılığı"]
        : ["LCA modül sınırı ve veri hiyerarşisi", "Pasif tasarım / enerji girdileri", "Sökülebilirlik ve malzeme pasaportu"];
    return [...base, "Koordinatlı parsel / imar veri paketi", "OpenBIM teslim ve onay matrisi"];
  }, [priority]);

  const passportCompleteness = Math.round(assetChecks.filter(Boolean).length / assetChecks.length * 100);
  const scheduleVariance = actual - planned;
  const scenarioMetrics = useMemo(() => {
    if (scenario === "Yoğun kullanım") return { energy: 129, occupancy: 91, alerts: 6, temperature: 25.8 };
    if (scenario === "Sıcak hava dalgası") return { energy: 143, occupancy: 62, alerts: 9, temperature: 31.4 };
    if (scenario === "Bakım modu") return { energy: 74, occupancy: 28, alerts: 3, temperature: 22.1 };
    return { energy: 100, occupancy: 58, alerts: 2, temperature: 23.6 };
  }, [scenario]);

  const projectData = useMemo(() => ({ input: { area, type, priority, system }, lca, dfma, site: { planned, actual, captureCoverage, issues }, asset: { material, completeness: passportCompleteness }, twin: { scenario, ...scenarioMetrics }, status: "pre-assessment" }), [actual, area, captureCoverage, dfma, issues, lca, material, passportCompleteness, planned, priority, scenario, scenarioMetrics, system, type]);

  useEffect(() => { patchModule("arkem-x", projectData); }, [patchModule, projectData]);
  const exportData = () => downloadTextFile("arkem-x-teknik-karar-kaydi.json", JSON.stringify({ schema: "ARKEM-X/2.0", generatedAt: new Date().toISOString(), ...projectData }, null, 2), "application/json");
  const importEngineeringData = () => {
    if (thread.canonical.architecture.grossArea > 0) setArea(Math.max(100, Math.round(thread.canonical.architecture.grossArea)));
    const sourceSystem = thread.canonical.structure.system as System;
    if (Object.prototype.hasOwnProperty.call(systems, sourceSystem)) setSystem(sourceSystem);
    const projectUse = thread.canonical.architecture.use.toLocaleLowerCase("tr-TR");
    if (projectUse.includes("konut")) setType("Konut / Karma yaşam"); else if (projectUse.includes("depo")) setType("Depo / Lojistik"); else if (projectUse.includes("ticari") || projectUse.includes("ofis")) setType("Ticari / Sosyal"); else if (projectUse) setType("Sanayi / Üretim");
    setIssues(thread.issues.length);
  };

  return <section className="arkem-x-lab xlab-professional" data-testid="arkem-x-lab">
    <ProjectKernelBar module="ARKEMX DECISION LAB" confidence="Altı teknik ön değerlendirme" />
    <header className="xlab-command"><div><span>ARKEMX / ENGINEERING DECISION LAB</span><b>Tek proje verisi · izlenebilir varsayım · açık çıktı</b></div><div><button onClick={importEngineeringData}>METRAJ / MODEL AKTAR ↘</button><button onClick={exportData}>TEKNİK KAYIT JSON ↓</button></div></header>
    <nav className="xlab-tabs" role="tablist" aria-label="ARKEMX teknik modülleri">{tabs.map((item) => <button type="button" role="tab" aria-label={item.label} id={`xlab-tab-${item.id}`} aria-controls="xlab-panel" aria-selected={tab === item.id} key={item.id} className={tab === item.id ? "active" : ""} onClick={() => setTab(item.id)}><i>{item.code}</i><span>{item.no}</span><b>{item.label}</b></button>)}</nav>
    <div className="xlab-body" id="xlab-panel" role="tabpanel" aria-labelledby={`xlab-tab-${tab}`} tabIndex={0}>
      {tab === "brief" && <><div className="xlab-controls"><p className="xlab-kicker">GEREKSİNİM & BİLGİ YÖNETİMİ</p><h3>Yatırım fikrini doğrulanabilir teknik gereksinime çevirin.</h3><label>Yapı kullanımı<select value={type} onChange={(event) => setType(event.target.value)}><option>Sanayi / Üretim</option><option>Depo / Lojistik</option><option>Konut / Karma yaşam</option><option>Ticari / Sosyal</option><option>Sağlık / Eğitim</option></select></label><label>Yaklaşık brüt alan<input type="number" min="100" max="100000" step="100" value={area} onChange={(event) => setArea(Number(event.target.value))}/><i>m²</i></label><label>Birincil karar ölçütü<select value={priority} onChange={(event) => setPriority(event.target.value)}><option>Program kesinliği</option><option>Yatırım maliyeti</option><option>Yaşam döngüsü / karbon</option></select></label><div className="xlab-gates"><span>G0 · İhtiyaç</span><span>G1 · Fizibilite</span><span>G2 · Konsept</span><span>G3 · Koordinasyon</span></div></div><div className="xlab-output xlab-brief-output"><span>ÖNERİLEN BİLGİ TESLİM PLANI</span><h3>{type} · Ön Fizibilite Sprinti</h3><div className="xlab-requirement-table">{brief.map((item, index) => <article key={item}><b>{String(index + 1).padStart(2, "0")}</b><div><strong>{item}</strong><small>{index < 2 ? "Karar kapısı G1" : index < 4 ? "Karar kapısı G2" : "Teslim standardı"}</small></div><i>{index < 3 ? "ÖNCELİKLİ" : "PLANLI"}</i></article>)}</div><p className="xlab-method-note">Her gereksinim; sorumlu, kaynak, kabul ölçütü, son tarih ve revizyonla CDE kayıt yapısına bağlanır.</p></div></>}

      {tab === "lca" && <><div className="xlab-controls"><p className="xlab-kicker">YAŞAM DÖNGÜSÜ KARBON ÖN MODELİ</p><h3>Tek toplam yerine yaşam döngüsü modüllerini ve veri kalitesini görün.</h3><label>Taşıyıcı sistem<select value={system} onChange={(event) => setSystem(event.target.value as System)}>{Object.keys(systems).map((item) => <option key={item}>{item}</option>)}</select></label><label>Brüt alan<input type="number" min="100" max="100000" step="100" value={area} onChange={(event) => setArea(Number(event.target.value))}/><i>m²</i></label><label>Taşıma mesafesi<input type="number" min="10" max="1500" step="10" value={transport} onChange={(event) => setTransport(Number(event.target.value))}/><i>km</i></label><label>Geri dönüştürülmüş içerik<input type="range" min="0" max="60" value={recycled} onChange={(event) => setRecycled(Number(event.target.value))}/><b>%{recycled}</b></label><label>Veri hiyerarşisi<select value={epdQuality} onChange={(event) => setEpdQuality(event.target.value as typeof epdQuality)}><option>Ürün EPD</option><option>Sektör EPD</option><option>Genel katsayı</option></select></label><label>Referans çalışma süresi<input type="number" min="30" max="100" step="5" value={serviceLife} onChange={(event) => setServiceLife(Number(event.target.value))}/><i>yıl</i></label></div><div className="xlab-output carbon xlab-lca-output"><header><div><span>EN 15978 MANTIKLI ÖN MODEL</span><b>{system} · {area.toLocaleString("tr-TR")} m²</b></div><strong>±%{lca.qualityUncertainty}<small>veri belirsizliği</small></strong></header><div className="xlab-lca-modules">{[["A1–A3",lca.a1a3,"Ürün aşaması"],["A4",lca.a4,"Taşıma"],["A5",lca.a5,"Şantiye"],["B4",lca.b4,"Değiştirme"],["C1–C4",lca.c,"Ömür sonu"],["D",lca.d,"Sınır ötesi fayda"]].map(([code,value,label]) => <article key={String(code)} className={Number(value) < 0 ? "credit" : ""}><span>{code}</span><b>{Number(value).toFixed(1)} tCO₂e</b><small>{label}</small></article>)}</div><div className="xlab-lca-total"><div><span>İlk yapım karbonu</span><b>{lca.upfront.toFixed(1)} tCO₂e</b></div><div><span>Yaşam döngüsü göstergesi</span><b>{lca.wholeLife.toFixed(1)} tCO₂e</b></div><div><span>Alan yoğunluğu</span><b>{lca.perM2.toFixed(0)} kgCO₂e/m²</b></div></div><p className="xlab-method-note">Katsayılar yöntem gösterimidir; ürün miktarı, EPD kapsamı, enerji modeli, senaryo ve doğrulanmış metraj olmadan sertifikalı LCA değildir.</p></div></>}

      {tab === "dfma" && <><div className="xlab-controls"><p className="xlab-kicker">ÜRETİM & MONTAJ MÜHENDİSLİĞİ</p><h3>Modül, kaldırma, tolerans ve lojistiği tasarımla birlikte sınayın.</h3><label>Sistem<select value={system} onChange={(event) => setSystem(event.target.value as System)}>{Object.keys(systems).map((item) => <option key={item}>{item}</option>)}</select></label><label>Modül genişliği<input type="number" min="1" max="5" step=".1" value={moduleWidth} onChange={(event) => setModuleWidth(Number(event.target.value))}/><i>m</i></label><label>Modül / eleman boyu<input type="number" min="3" max="18" step=".5" value={moduleLength} onChange={(event) => setModuleLength(Number(event.target.value))}/><i>m</i></label><label>En ağır kaldırma<input type="number" min=".5" max="60" step=".5" value={pieceWeight} onChange={(event) => setPieceWeight(Number(event.target.value))}/><i>t</i></label><label>Vinç kapasitesi<input type="number" min="5" max="120" step="5" value={craneCapacity} onChange={(event) => setCraneCapacity(Number(event.target.value))}/><i>t</i></label><label>Tekrarlı imalat oranı<input type="range" min="0" max="100" step="2" value={repetition} onChange={(event) => setRepetition(Number(event.target.value))}/><b>%{repetition}</b></label></div><div className="xlab-output xlab-dfma-output"><span>DFMA UYGULANABİLİRLİK PANOSU</span><div className="dfma-score"><strong>%{dfma.manufacturability.toFixed(0)}</strong><div><b>Üretilebilirlik göstergesi</b><small>Tekrar, kaldırma ve sistem varsayımlarından</small></div></div><div className="dfma-process">{[["01","Bölümlendir",`${dfma.moduleCount} modül`],["02","Üret",`${dfma.moduleArea.toFixed(1)} m² / modül`],["03","Taşı",`~${dfma.trips} sefer`],["04","Kaldır",`%${dfma.craneUse.toFixed(0)} kapasite`],["05","Birleştir",`${dfma.toleranceBudget} mm bütçe`]].map(([no,title,value]) => <article key={no}><span>{no}</span><b>{title}</b><strong>{value}</strong></article>)}</div><div className={`dfma-alert ${dfma.craneUse > 85 ? "risk" : "good"}`}><b>{dfma.craneUse > 100 ? "Kaldırma kapasitesi yetersiz" : dfma.craneUse > 85 ? "Kaldırma kapasitesi kritik bantta" : "Kaldırma için kapasite payı mevcut"}</b><p>Gerçek kontrol; çalışma yarıçapı, bom konfigürasyonu, zemin basıncı, rigging, rüzgâr ve üretici yük tablosuyla yapılır.</p></div></div></>}

      {tab === "site" && <><div className="xlab-controls"><p className="xlab-kicker">GERÇEKLİK YAKALAMA & PROGRAM</p><h3>Fotoğraf arşivini ölçülebilir ilerleme ve kalite kanıtına dönüştürün.</h3><label>Planlanan ilerleme<input type="range" min="0" max="100" value={planned} onChange={(event) => setPlanned(Number(event.target.value))}/><b>%{planned}</b></label><label>Doğrulanmış gerçekleşen<input type="range" min="0" max="100" value={actual} onChange={(event) => setActual(Number(event.target.value))}/><b>%{actual}</b></label><label>Yakalama kapsamı<input type="range" min="0" max="100" value={captureCoverage} onChange={(event) => setCaptureCoverage(Number(event.target.value))}/><b>%{captureCoverage}</b></label><label>Açık saha kaydı<input type="number" min="0" max="99" value={issues} onChange={(event) => setIssues(Number(event.target.value))}/><i>adet</i></label><div className="xlab-status-list"><span><i className="ok"></i>Model revizyonu bağlandı</span><span><i className={captureCoverage > 80 ? "ok" : "warn"}></i>360° kapsama %{captureCoverage}</span><span><i className={issues > 5 ? "warn" : "ok"}></i>{issues} açık kalite kaydı</span></div></div><div className="xlab-output site xlab-reality-output"><header><div><span>MODEL–SAHA–PROGRAM EŞLEME</span><b>22 TEM 2026 · Örnek veri seti</b></div><strong className={scheduleVariance < -3 ? "risk" : "good"}>{scheduleVariance > 0 ? "+" : ""}{scheduleVariance}<small>puan sapma</small></strong></header><div className="site-camera"><div className="site-build" style={{ clipPath: `inset(${100 - actual}% 0 0)` }}></div><b>360° / BLOK A / AKS C–F</b><small>Kaynak görünüm + koordinasyon modeli</small></div><div className="reality-progress"><p><span>Plan</span><i><b style={{ width: `${planned}%` }}></b></i><strong>%{planned}</strong></p><p><span>Gerçek</span><i><b className={scheduleVariance < -3 ? "risk" : ""} style={{ width: `${actual}%` }}></b></i><strong>%{actual}</strong></p></div><div className="site-kpis"><b>%{captureCoverage}<small>Görsel kapsama</small></b><b>{issues}<small>Açık kayıt</small></b><b>{Math.max(0, issues - 3)}<small>Kritik yol bağı</small></b></div></div></>}

      {tab === "passport" && <><div className="xlab-controls"><p className="xlab-kicker">AIM / DİJİTAL TESLİM</p><h3>Varlığı model GUID’inden bakım ve yeniden kullanıma kadar izleyin.</h3><label>Varlık / bileşen<select value={material} onChange={(event) => setMaterial(event.target.value)}><option>Ana taşıyıcı çelik kolon</option><option>Prefabrik cephe paneli</option><option>Çatı drenaj pompası</option><option>Yangın damperi</option><option>Hafif çelik duvar paneli</option></select></label><div className="asset-field-checks">{assetFields.map((field, index) => <button key={field} className={assetChecks[index] ? "done" : ""} onClick={() => setAssetChecks((values) => values.map((value, itemIndex) => itemIndex === index ? !value : value))}><i>{assetChecks[index] ? "✓" : "+"}</i><span>{field}</span><b>{assetChecks[index] ? "BAĞLI" : "EKSİK"}</b></button>)}</div></div><div className="xlab-output passport xlab-asset-output"><span>ARKEM ASSET INFORMATION MODEL</span><div className="passport-code">ARX-AIM-26-0041</div><h3>{material}</h3><div className="passport-ring" style={{ background: `conic-gradient(#b96636 ${passportCompleteness}%,#d8e0e1 0)` }}><i><b>%{passportCompleteness}</b><span>VERİ TAMLIĞI</span></i></div><div className="asset-state"><p><span>Model kimliği</span><b>ARK-A-GF-C-041</b></p><p><span>Bilgi durumu</span><b>{passportCompleteness >= 88 ? "Teslime yakın" : passportCompleteness >= 63 ? "Eksik veri var" : "Teslime hazır değil"}</b></p><p><span>Güvenlik sınıfı</span><b>İşveren / bakım ekibi</b></p></div><p className="xlab-method-note">Pasaport, belgeyi kopyalamaz; kontrollü kaynağa, sorumluya, revizyona ve fiziksel varlık konumuna bağlar.</p></div></>}

      {tab === "twin" && <><div className="xlab-controls"><p className="xlab-kicker">SENARYO TABANLI DİJİTAL İKİZ</p><h3>Sensör gerçeği ile simülasyon varsayımını ayırarak işletme senaryosu sınayın.</h3><label>İşletme senaryosu<select value={scenario} onChange={(event) => setScenario(event.target.value)}><option>Baz işletme</option><option>Yoğun kullanım</option><option>Sıcak hava dalgası</option><option>Bakım modu</option></select></label><div className="twin-data-contract"><span>VERİ SÖZLEŞMESİ</span>{["BMS / enerji sayacı", "İç ortam sensörleri", "Bakım iş emirleri", "Doluluk / kullanım", "As-built model"].map((item, index) => <p key={item}><i className={index < 3 ? "live" : "model"}></i><b>{item}</b><small>{index < 3 ? "Canlı bağlantı gerektirir" : "Senaryo girdisi"}</small></p>)}</div></div><div className="xlab-output twin xlab-twin-output"><header><div><span>DIGITAL TWIN / {scenario.toUpperCase()}</span><b>Canlı sensör yerine örnek senaryo verisi</b></div><strong>{scenarioMetrics.alerts}<small>uyarı</small></strong></header><div className="twin-model">{Array.from({ length: 30 }, (_, index) => <i key={index} className={(index + scenarioMetrics.alerts) % 9 === 0 ? "alert" : index % 5 === 0 ? "watch" : ""}></i>)}</div><div className="site-kpis"><b>{scenarioMetrics.temperature.toFixed(1)}°C<small>İç ortam</small></b><b>%{scenarioMetrics.occupancy}<small>Kapasite</small></b><b>{scenarioMetrics.energy}<small>Enerji endeksi</small></b></div><div className="twin-rule-log"><span>KURAL MOTORU</span><p><i>IF</i> sıcaklık &gt; 28°C ve doluluk &gt; %75 <b>THEN</b> zon set değeri + gölgeleme senaryosu incele</p><p><i>IF</i> enerji endeksi &gt; 125 <b>THEN</b> baz çizgi ve ekipman çalışma saatini karşılaştır</p></div></div></>}
    </div>
    <footer className="xlab-disclaimer"><b>Teknik statü</b><p>Laboratuvar; karar yöntemini, veri ihtiyacını ve açık çıktıyı gösteren ön değerlendirme sistemidir. Statik hesap, sertifikalı LCA, vinç planı, hakediş, iş güvenliği planı veya canlı bina otomasyonu değildir. Proje kararları yetkili uzman ve doğrulanmış kaynak verilerle kapatılır.</p></footer>
  </section>;
}
