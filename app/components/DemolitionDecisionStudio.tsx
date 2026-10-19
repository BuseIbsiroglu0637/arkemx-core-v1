"use client";

import { useMemo, useState } from "react";
import { downloadTextFile } from "../lib/engineering";
import { ProjectKernelBar, useProjectKernel } from "./ProjectKernel";

type HazardState = "unknown" | "possible" | "not-observed";
const hazardActive = (value: HazardState) => value !== "not-observed";
const hazardLabels = { unknown: "Bilinmiyor", possible: "Şüphe var", "not-observed": "Şüphe beyan edilmedi; yokluğu doğrulanmadı" };

type MethodId = "selective" | "mechanical" | "explosive";
const methods: { id: MethodId; title: string; copy: string; strengths: string[] }[] = [
  { id: "selective", title: "Seçici söküm", copy: "Bileşen, tehlikeli malzeme ve yeniden kullanım akışlarını ayrıştıran aşamalı söküm.", strengths: ["Kaynak geri kazanımı", "Düşük ani çevre etkisi", "Malzeme izlenebilirliği"] },
  { id: "mechanical", title: "Kat bazlı mekanik yıkım", copy: "Geçici stabilite ve ekipman çalışma sınırlarıyla üstten alta kontrollü azaltma.", strengths: ["Aşama kontrolü", "Kentsel sahaya uyarlama", "Görsel kalite kaydı"] },
  { id: "explosive", title: "Kontrollü patlatmalı yıkım", copy: "Yalnız yetkili uzman, ayrıntılı yapı analizi, idari izin ve çevre güvenlik planıyla incelenen yöntem.", strengths: ["Çok yüksek yapılarda program", "Uzaktan icra potansiyeli", "Önceden tanımlı olay penceresi"] },
];

const gateLabels = ["Arşiv proje + güncel rölöve", "Malzeme / donatı doğrulaması", "Tehlikeli madde envanteri", "Aktif altyapı izolasyonu", "Komşu yapı durum tespiti", "Zemin / bodrum / temel bilgisi", "İzin ve kurum ön görüşmesi", "Geçici stabilite / aşamalı söküm incelemesi", "Yetkili yöntem + izleme planı"];

export function DemolitionDecisionStudio() {
  const { patchModule } = useProjectKernel();
  const [height, setHeight] = useState(38);
  const [floors, setFloors] = useState(11);
  const [neighbor, setNeighbor] = useState(24);
  const [access, setAccess] = useState("Geniş çevre erişimi");
  const [structure, setStructure] = useState("Betonarme çerçeve");
  const [occupancy, setOccupancy] = useState("Tamamen boşaltılmış");
  const [condition, setCondition] = useState("Yerel hasar / belirsizlik");
  const [sensitivity, setSensitivity] = useState("Karma kentsel çevre");
  const [hazards, setHazards] = useState<Record<"asbestos" | "utilities" | "unstable" | "public" | "contamination" | "fire", HazardState>>({ asbestos: "unknown", utilities: "unknown", unstable: "unknown", public: "unknown", contamination: "unknown", fire: "unknown" });
  const [checks, setChecks] = useState(Array<boolean>(gateLabels.length).fill(false));
  const [activeMethod, setActiveMethod] = useState<MethodId>("selective");
  const [view, setView] = useState<"scenario" | "risk" | "gate">("scenario");

  const analysis = useMemo(() => {
    const dense = neighbor < 12;
    const tall = height > 28;
    const open = access === "Geniş çevre erişimi";
    const occupied = occupancy !== "Tamamen boşaltılmış";
    const fragile = condition !== "Doğrulanmış / stabil";
    const hazardCount = Object.values(hazards).filter(hazardActive).length;
    const separationFactor = neighbor >= 40 ? 18 : neighbor >= 25 ? 14 : neighbor >= 15 ? 7 : neighbor >= 8 ? -6 : -22;
    const sensitivityFactor = sensitivity === "Endüstriyel / ayrık saha" ? 12 : sensitivity === "Karma kentsel çevre" ? 1 : -18;
    const structuralFactor = structure.includes("Betonarme") ? 8 : structure.includes("Çelik") ? -8 : -4;
    const explosiveReadiness = checks.filter(Boolean).length / checks.length;
    const scores: Record<MethodId, number> = {
      selective: Math.max(20, Math.min(96, 63 - height * .16 + (dense ? 11 : 0) + (structure.includes("Çelik") ? 13 : 0) + hazardCount * 2)),
      mechanical: Math.max(20, Math.min(96, 74 + (dense ? 5 : 0) - (height > 42 ? 16 : 0) + (access === "Kısıtlı erişim" ? -9 : 2) - (fragile ? 5 : 0))),
      explosive: Math.max(5, Math.min(97, 49 + (tall ? 22 : -7) + (height > 55 ? 8 : 0) + (open ? 13 : -11) + separationFactor + sensitivityFactor + structuralFactor - (occupied ? 38 : 0) - hazardCount * 1.5 + explosiveReadiness * 8)),
    };
    const environmentConsequence = neighbor < 8 ? 5 : neighbor < 18 ? 4 : sensitivity === "Hassas alıcı / tarihi çevre" ? 4 : 3;
    const structuralLikelihood = condition === "İleri hasar / stabilite şüphesi" ? 5 : condition === "Yerel hasar / belirsizlik" ? 4 : 2;
    const rows = [
      { id: "RSK-01", hazard: "Kontrolsüz kısmi göçme", likelihood: structuralLikelihood, consequence: 5, control: "Rölöve, analiz, geçici stabilite ve aşama serbest bırakma" },
      { id: "RSK-02", hazard: "Komşu yapı / kamusal alan etkisi", likelihood: dense || hazardActive(hazards.public) ? 4 : 2, consequence: environmentConsequence, control: "Durum tespiti, izleme eşikleri, bariyer ve trafik planı" },
      { id: "RSK-03", hazard: "Tehlikeli madde maruziyeti", likelihood: hazardActive(hazards.asbestos) ? 4 : 2, consequence: hazardActive(hazards.asbestos) ? 5 : 3, control: "Yetkili envanter, kontrollü söküm ve atık zinciri" },
      { id: "RSK-04", hazard: "Aktif enerji / altyapı", likelihood: hazardActive(hazards.utilities) ? 4 : 1, consequence: 5, control: "Yetkili izolasyon, kilitleme ve sıfır enerji doğrulaması" },
      { id: "RSK-05", hazard: "Toz, gürültü ve titreşim", likelihood: 4, consequence: sensitivity === "Hassas alıcı / tarihi çevre" ? 5 : 3, control: "Baz ölçüm, sınır değer, bastırma ve gerçek zamanlı izleme" },
    ].map((row) => ({ ...row, inherent: row.likelihood * row.consequence, illustrativeResidual: Math.max(2, Math.round(row.likelihood * .55) * Math.max(1, row.consequence - 1)) }));
    const maxRisk = Math.max(...rows.map((row) => row.inherent));
    const recommendedMethod = (Object.entries(scores) as [MethodId, number][]).sort((a, b) => b[1] - a[1])[0][0];
    const recommendationNote = "Bu sıralama yalnız örnek kuralların gösterimidir; yöntem tavsiyesi veya saha güvenliği kararı değildir. Yetkili yapı, çevre ve geçici stabilite incelemesi gerekir.";
    return { scores, rows, maxRisk, hazardCount, recommendedMethod, recommendationNote };
  }, [access, checks, condition, hazards, height, neighbor, occupancy, sensitivity, structure]);

  const readiness = Math.round(checks.filter(Boolean).length / checks.length * 100);
  const selected = methods.find((item) => item.id === activeMethod) ?? methods[0];
  const projectData = useMemo(() => ({ input: { height, floors, neighbor, access, structure, occupancy, condition, sensitivity, hazards }, analysis, selectedMethod: activeMethod, readiness, gates: gateLabels.map((label, index) => ({ label, userDeclared: checks[index], complete: false, verification: "expert-review-pending" })), status: "method-screening-only" }), [access, activeMethod, analysis, checks, condition, floors, hazards, height, neighbor, occupancy, readiness, sensitivity, structure]);
  const saveScenario = () => patchModule("demolition-screening", { demonstration: { ...projectData, exampleOnly: true, needsReview: true, method: "illustrative-rule-based", boundary: "Yöntem seçimi, güvenli uygulama veya mühendislik onayı değildir." } });

  const exportJson = () => downloadTextFile("arkem-yikim-on-degerlendirme.json", JSON.stringify({ schema: "ARKEM-DEMOLITION-SCREEN/1.0", exampleOnly: true, method: "illustrative-rule-based", boundary: "Temsili puanlar; belge doğrulaması, yöntem seçimi veya saha güvenliği onayı değildir.", ...projectData }, null, 2), "application/json");
  const exportRisk = () => downloadTextFile("arkem-yikim-risk-kaydi.csv", ["id,hazard,illustrative_likelihood,illustrative_consequence,illustrative_inherent,illustrative_residual,control,boundary", ...analysis.rows.map((row) => `${row.id},"${row.hazard}",${row.likelihood},${row.consequence},${row.inherent},${row.illustrativeResidual},"${row.control}","Kontrol yaklaşımı örneği; kontrol etkinliği doğrulanmadı; güvenli uygulama veya yöntem onayı değildir"`)].join("\n"), "text/csv;charset=utf-8");

  return <section className="demolition-studio demolition-professional" data-testid="demolition-decision-studio">
    <ProjectKernelBar module="DEMOLITION RISK ENGINE" confidence="Örnek senaryo · uzman değerlendirmesi gerekir" /><div className="module-example-notice"><b>Bu alan bir çalışma örneğidir.</b><p>Başlangıç değerleri sizin yapınıza ait değildir. Puanlar temsili kuralları gösterir; uygunluk oranı, güvenli mesafe veya yıkım yöntemi kararı vermez. Belge işaretlemek doğrulama ya da çalışma izni değildir.</p><a href="/dijital-donusum">Kendi ihtiyaç dosyamı hazırlayacağım →</a></div>
    <header className="demolition-head"><div><span>ARKEM / CONTROLLED DEMOLITION INTELLIGENCE</span><b>Yapı–Çevre–Yöntem Ön Karar Stüdyosu</b></div><div><i></i><span>YÜKSEK SEVİYE TARAMA</span><small>Operasyon veya patlayıcı tasarımı değildir</small></div></header>
    <div className="demolition-command"><nav>{(["scenario", "risk", "gate"] as const).map((item) => <button key={item} className={view === item ? "active" : ""} onClick={() => setView(item)}>{item === "scenario" ? "Yöntem senaryosu" : item === "risk" ? "5×5 risk kaydı" : "Karar kapıları"}</button>)}</nav><div><button type="button" onClick={saveScenario}>Örnek senaryoyu proje notuna ekle</button><button onClick={exportJson}>JSON ↓</button><button onClick={exportRisk}>RİSK CSV ↓</button></div></div>
    <div className="demolition-body">
      <aside className="demolition-controls"><span>01 / YAPI & ÇEVRE</span><label>Taşıyıcı sistem<select value={structure} onChange={(event) => setStructure(event.target.value)}><option>Betonarme çerçeve</option><option>Betonarme perde-çerçeve</option><option>Yapısal çelik</option><option>Yığma / karma</option></select></label><div className="demolition-field-pair"><label>Kat<input type="number" min="1" max="80" value={floors} onChange={(event) => setFloors(Number(event.target.value))}/></label><label>Yükseklik<input type="number" min="3" max="300" value={height} onChange={(event) => setHeight(Number(event.target.value))}/><i>m</i></label></div><label>En yakın komşu<input type="range" min="2" max="100" value={neighbor} onChange={(event) => setNeighbor(Number(event.target.value))}/><b>{neighbor} m</b></label><label>Yapısal durum<select value={condition} onChange={(event) => setCondition(event.target.value)}><option>Doğrulanmış / stabil</option><option>Yerel hasar / belirsizlik</option><option>İleri hasar / stabilite şüphesi</option></select></label><label>Saha erişimi<select value={access} onChange={(event) => setAccess(event.target.value)}><option>Geniş çevre erişimi</option><option>Tek cepheden erişim</option><option>Kısıtlı erişim</option></select></label><label>Kullanım / tahliye<select value={occupancy} onChange={(event) => setOccupancy(event.target.value)}><option>Tamamen boşaltılmış</option><option>Komşu yapılar kullanımda</option><option>Alan kısmen kullanımda</option></select></label><label>Çevre hassasiyeti<select value={sensitivity} onChange={(event) => setSensitivity(event.target.value)}><option>Endüstriyel / ayrık saha</option><option>Karma kentsel çevre</option><option>Hassas alıcı / tarihi çevre</option></select></label><span>02 / TEHLİKE ÖN İŞARETLERİ</span><div className="demolition-hazard-list">{Object.entries({ asbestos: "Tehlikeli malzeme şüphesi", utilities: "Aktif altyapı olasılığı", unstable: "Düşme / kopma riski", public: "Kamusal arayüz", contamination: "Kirlenmiş zemin", fire: "Yangın kalıntısı / hasarı" }).map(([key, label]) => <button key={key} className={hazardActive(hazards[key as keyof typeof hazards]) ? "active" : ""} onClick={() => setHazards((current) => ({ ...current, [key]: current[key as keyof typeof current] === "unknown" ? "possible" : current[key as keyof typeof current] === "possible" ? "not-observed" : "unknown" }))}><i>{hazards[key as keyof typeof hazards] === "unknown" ? "?" : hazardActive(hazards[key as keyof typeof hazards]) ? "!" : "○"}</i><span>{label}<small>{hazardLabels[hazards[key as keyof typeof hazards]]}</small></span></button>)}</div></aside>

      <main className="demolition-analysis">
        {view === "scenario" && <><div className="demolition-scene"><div className="demolition-tower" style={{ height: `${Math.min(82, 28 + height * .45)}%` }}>{Array.from({ length: 24 }, (_, index) => <i key={index}></i>)}</div><div className="demolition-neighbor left" style={{ left: `${Math.max(1.5, 18 - neighbor * .16)}%` }}></div><div className="demolition-neighbor right" style={{ right: `${Math.max(1.5, 18 - neighbor * .16)}%` }}></div><div className="demolition-zone" style={{ inset: `auto ${Math.max(4, 22 - neighbor * .18)}% 7%` }}></div><span className="demolition-distance">KOMŞU MESAFE · {neighbor} m</span><small>Mesafe arttıkça komşu kütleler şematik olarak uzaklaşır · gerçek güvenlik sınırı değildir</small></div><div className="demolition-recommendation"><span>TEMSİLİ KURAL GÖSTERİMİ</span><b>{methods.find((item) => item.id === analysis.recommendedMethod)?.title}</b><p>{analysis.recommendationNote} Bu sonuç uygulama kararı değil, yetkili uzman incelemesine yönlendiren ön elemedir.</p></div><div className="demolition-methods"><span>03 / YÖNTEM KARŞILAŞTIRMASI</span>{methods.map((item) => <button key={item.id} className={`${activeMethod === item.id ? "active " : ""}${analysis.recommendedMethod === item.id ? "recommended" : ""}`.trim()} onClick={() => setActiveMethod(item.id)}><div><b>{item.title}{analysis.recommendedMethod === item.id && <em>ÖRNEK PUAN</em>}</b><small>{item.copy}</small></div><i><span style={{ width: `${analysis.scores[item.id]}%` }}></span></i><strong>{Math.round(analysis.scores[item.id])}/100<small>temsili puan · uygunluk değildir</small></strong></button>)}</div></>}
        {view === "risk" && <section className="demolition-risk-register"><header><div><span>5×5 OLASILIK × SONUÇ</span><h3>Ön risk kaydı</h3></div><strong className={analysis.maxRisk >= 20 ? "critical" : "watch"}>{analysis.maxRisk}<small>en yüksek doğal risk</small></strong></header><div className="risk-register-table"><div className="head"><span>KOD / TEHLİKE</span><span>O</span><span>S</span><span>DOĞAL</span><span>KONTROL STRATEJİSİ</span><span>ARTIK</span></div>{analysis.rows.map((row) => <article key={row.id}><div><b>{row.id}</b><span>{row.hazard}</span></div><strong>{row.likelihood}</strong><strong>{row.consequence}</strong><i className={row.inherent >= 20 ? "critical" : row.inherent >= 10 ? "high" : "medium"}>{row.inherent}</i><p>{row.control}</p><i className={row.illustrativeResidual >= 10 ? "high" : "medium"}>{row.illustrativeResidual}</i></article>)}</div><p className="demolition-register-note">Artık risk puanı yalnız kontrol yaklaşımını örnekler. Kontrol etkinliği kanıtlanmadan ve sorumlu atanıp doğrulanmadan risk kapanmış sayılmaz.</p></section>}
        {view === "gate" && <section className="demolition-gate-board"><header><div><span>BEYAN LİSTESİ · İZİN DEĞİLDİR</span><h3>Uzman incelemesi için belge başlıkları</h3></div><strong>%{readiness}<small>veri hazırlığı</small></strong></header>{gateLabels.map((label, index) => <button key={label} className={checks[index] ? "done" : ""} onClick={() => setChecks((values) => values.map((value, itemIndex) => itemIndex === index ? !value : value))}><i>{checks[index] ? "✓" : String(index + 1).padStart(2, "0")}</i><div><b>{label}</b><small>{index < 4 ? "Saha doğrulaması" : index < 7 ? "Çevre / idari hazırlık" : "Uzman incelemesi bekliyor"}</small></div><strong>{checks[index] ? "BEYAN · DOĞRULANMADI" : "BİLGİ EKSİK"}</strong></button>)}<p>Yöntem incelemesi için tüm kapıların tamamlanması yeterli değildir; bağımsız uzman değerlendirmesi ve yetkili idare onayı ayrıca gerekir.</p></section>}
      </main>

      <aside className="demolition-output"><span>04 / KARAR NOTU</span><div className="demolition-risk"><small>ÖN RİSK BANTI</small><b className={analysis.maxRisk >= 20 ? "critical" : "watch"}>{analysis.maxRisk >= 20 ? "KRİTİK İNCELEME" : "YÜKSEK İNCELEME"}</b><p>{analysis.hazardCount} tehlike ön işareti açık; en yüksek doğal risk puanı {analysis.maxRisk}/25. Ölçüm, rölöve ve uzman kontrolü olmadan yöntem uygunluğu kurulamaz.</p></div><article><small>SEÇİLEN SENARYO</small><h4>{selected.title}</h4><p>{selected.copy}</p>{selected.strengths.map((item) => <span className="demolition-strength" key={item}>+ {item}</span>)}</article><div className="demolition-checks"><span>VERİ HAZIRLIĞI · %{readiness}</span>{gateLabels.slice(0, 5).map((item, index) => <button key={item} className={checks[index] ? "done" : ""} onClick={() => setChecks((values) => values.map((value, itemIndex) => itemIndex === index ? !value : value))}><i>{checks[index] ? "✓" : ""}</i>{item}</button>)}</div><a href="/iletisim">Uzman ön değerlendirme isteyin ↗</a></aside>
    </div>
    <footer><b>Güvenlik ve yetki sınırı</b><p>Modül yöntem alternatiflerini, bilgi eksiklerini ve ön risk kaydını görünür kılar. Patlayıcı miktarı, ateşleme, delik düzeni, devrilme, ekipman kapasitesi veya saha operasyon talimatı üretmez. Uygulama; yetkili kurumlar, ruhsatlı uzmanlar, proje özelindeki yapı–zemin–çevre analizleri, iş sağlığı ve güvenliği planı ve ölçüm sistemiyle yürütülür.</p></footer>
  </section>;
}
