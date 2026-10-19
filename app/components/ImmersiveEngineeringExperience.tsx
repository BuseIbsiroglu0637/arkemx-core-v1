"use client";

import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Download,
  Expand,
  Layers3,
  Leaf,
  Maximize2,
  Ruler,
  ShieldCheck,
  Timer,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { downloadTextFile } from "../lib/engineering";
import { useProjectKernel } from "./ProjectKernel";

type SystemKey = "concrete" | "steel" | "light" | "hybrid";
type LayerKey = "architecture" | "structure" | "mep" | "performance";

const systems: Record<SystemKey, {
  label: string;
  short: string;
  duration: number;
  carbon: number;
  flexibility: number;
  certainty: number;
  summary: string;
}> = {
  concrete: { label: "Betonarme", short: "RC", duration: 58, carbon: 46, flexibility: 68, certainty: 86, summary: "Yerel tedarik gücü, yüksek kütle ve tanıdık uygulama ekosistemi." },
  steel: { label: "Yapısal Çelik", short: "ST", duration: 82, carbon: 68, flexibility: 94, certainty: 78, summary: "Büyük açıklık, kuru imalat ve hızlı montaj için güçlü alternatif." },
  light: { label: "Hafif Çelik", short: "LGS", duration: 91, carbon: 81, flexibility: 74, certainty: 84, summary: "Hafiflik, fabrikasyon hassasiyeti ve seri üretim avantajı." },
  hybrid: { label: "Karma Sistem", short: "HYB", duration: 76, carbon: 63, flexibility: 88, certainty: 73, summary: "Her yapı parçasında en uygun sistemin birlikte kullanılması." },
};

const layers: Record<LayerKey, {
  code: string;
  label: string;
  title: string;
  copy: string;
  facts: string[];
}> = {
  architecture: {
    code: "ARC",
    label: "Mimari",
    title: "Program, dolaşım ve kabuk",
    copy: "Mahal programı, net–brüt alan, çekirdek, kaçış ve cephe kararları tek görünümde okunur.",
    facts: ["Mahal ilişkileri", "Cephe modülü", "Günışığı girdileri"],
  },
  structure: {
    code: "STR",
    label: "Taşıyıcı",
    title: "Aks, yük yolu ve sistem",
    copy: "Kolon, kiriş, makas, döşeme ve temel katmanları; açıklık ve yük kararlarıyla birlikte izlenir.",
    facts: ["Aks ve açıklık", "Yük aktarımı", "Ön boyutlandırma"],
  },
  mep: {
    code: "MEP",
    label: "MEP",
    title: "Tesisat rezervasyonları",
    copy: "Mekanik, elektrik ve yangın hatları taşıyıcı sistemle aynı koordinat düzleminde denetlenir.",
    facts: ["Şaft ve rezervasyon", "Çakışma kaydı", "Bakım erişimi"],
  },
  performance: {
    code: "ENV",
    label: "Performans",
    title: "Enerji, karbon ve yaşam döngüsü",
    copy: "Kabuk performansı, gömülü karbon, işletme verisi ve yeniden kullanım potansiyeli birlikte değerlendirilir.",
    facts: ["Kabuk senaryosu", "Karbon bütçesi", "Yapı pasaportu"],
  },
};

const presentationSteps = [
  { code: "01", label: "ARAZİ", title: "Koordinattan karar alanına", copy: "Parsel sınırı, yönlenme, çekme mesafesi ve topoğrafya; tasarımın ortak başlangıç verisi olur.", href: "/arsa-fizibilite-studyosu" },
  { code: "02", label: "TASARIM", title: "Mimari ve taşıyıcı tek masada", copy: "Mahal programı, aks sistemi, yükler ve yapı sistemi aynı senaryonun parçaları olarak gelişir.", href: "/tasarim-calismalari" },
  { code: "03", label: "KOORDİNASYON", title: "Çakışma değil, karar kaydı", copy: "Mimari, statik ve MEP arayüzleri sorumlusu, tarihi ve etkisiyle izlenebilir hale gelir.", href: "/muhendislik-koordinasyon" },
  { code: "04", label: "TESLİM", title: "Yapı biter, bilgi yaşamaya devam eder", copy: "Saha kanıtı, bakım verisi, garanti ve as-built kayıtları dijital yapı pasaportunda devredilir.", href: "/proje-os" },
] as const;

function metricScore(key: SystemKey, area: number, floors: number, span: number) {
  const base = systems[key];
  const scalePenalty = Math.max(0, (area - 2500) / 500);
  const floorPenalty = key === "light" ? Math.max(0, floors - 4) * 4 : Math.max(0, floors - 12);
  const spanPenalty = key === "concrete" ? Math.max(0, span - 8) * 3 : key === "light" ? Math.max(0, span - 6) * 4 : Math.max(0, span - 18) * 2;
  return {
    duration: Math.max(28, Math.round(base.duration - scalePenalty - floorPenalty - spanPenalty)),
    carbon: Math.max(24, Math.round(base.carbon - scalePenalty * .5 - floorPenalty)),
    flexibility: Math.max(30, Math.round(base.flexibility - spanPenalty * .4)),
    certainty: Math.max(35, Math.round(base.certainty - floorPenalty - scalePenalty * .5)),
  };
}

export function ImmersiveEngineeringExperience() {
  const { patchModule, setIdentity } = useProjectKernel();
  const [systemA, setSystemA] = useState<SystemKey>("concrete");
  const [systemB, setSystemB] = useState<SystemKey>("steel");
  const [area, setArea] = useState(1800);
  const [floors, setFloors] = useState(3);
  const [span, setSpan] = useState(9);
  const [layer, setLayer] = useState<LayerKey>("structure");
  const [presentationOpen, setPresentationOpen] = useState(false);
  const [presentationStep, setPresentationStep] = useState(0);
  const [saved, setSaved] = useState(false);

  const comparison = useMemo(() => ({
    a: metricScore(systemA, area, floors, span),
    b: metricScore(systemB, area, floors, span),
  }), [area, floors, span, systemA, systemB]);

  const recommendation = useMemo(() => {
    const total = (value: ReturnType<typeof metricScore>) => value.duration + value.carbon + value.flexibility + value.certainty;
    return total(comparison.b) > total(comparison.a) ? systemB : systemA;
  }, [comparison, systemA, systemB]);

  useEffect(() => {
    document.body.classList.toggle("presentation-mode-open", presentationOpen);
    return () => document.body.classList.remove("presentation-mode-open");
  }, [presentationOpen]);

  const saveDecision = () => {
    setIdentity({ name: `${area.toLocaleString("tr-TR")} m² · ${floors} kat yapı senaryosu` });
    patchModule("immersive-decision-room", {
      input: { area, floors, span, alternatives: [systemA, systemB] },
      result: { comparison, recommendation, selectedLayer: layer },
      status: "scenario-compared",
    });
    setSaved(true);
  };

  const downloadBrief = () => {
    const winner = systems[recommendation];
    const html = `<!doctype html><html lang="tr"><head><meta charset="utf-8"><title>Arkem Yönetici Konsept Briefi</title><style>body{font:15px Arial;color:#173243;max-width:850px;margin:50px auto;line-height:1.6}h1{font-size:36px}h2{margin-top:38px;border-bottom:2px solid #b96636;padding-bottom:8px}table{width:100%;border-collapse:collapse}td,th{padding:12px;border:1px solid #ccd3d3;text-align:left}.note{background:#f2eee7;padding:18px}</style></head><body><p>ARKEM YAPI SİSTEMLERİ / ÖN DEĞERLENDİRME</p><h1>Yönetici Konsept Briefi</h1><p>${new Date().toLocaleDateString("tr-TR")} tarihinde tarayıcıdaki temsili karar stüdyosunda üretilmiştir.</p><h2>Proje girdileri</h2><table><tr><th>Yaklaşık alan</th><th>Kat</th><th>Hedef açıklık</th></tr><tr><td>${area.toLocaleString("tr-TR")} m²</td><td>${floors}</td><td>${span} m</td></tr></table><h2>Alternatifler</h2><table><tr><th>Sistem</th><th>Süre</th><th>Karbon</th><th>Esneklik</th><th>Öngörülebilirlik</th></tr><tr><td>${systems[systemA].label}</td><td>${comparison.a.duration}</td><td>${comparison.a.carbon}</td><td>${comparison.a.flexibility}</td><td>${comparison.a.certainty}</td></tr><tr><td>${systems[systemB].label}</td><td>${comparison.b.duration}</td><td>${comparison.b.carbon}</td><td>${comparison.b.flexibility}</td><td>${comparison.b.certainty}</td></tr></table><h2>Ön yönelim</h2><p><strong>${winner.label}</strong> — ${winner.summary}</p><p class="note">Bu belge sertifikalı statik hesap, keşif, teklif veya LCA değildir. Kesin karar; zemin, mimari, yük, mevzuat, tedarik ve maliyet verileri doğrulandıktan sonra verilmelidir.</p></body></html>`;
    downloadTextFile("arkem-yonetici-konsept-briefi.html", html, "text/html;charset=utf-8");
  };

  const activeLayer = layers[layer];
  const metrics = [
    { key: "duration", label: "Program avantajı", icon: Timer },
    { key: "carbon", label: "Karbon potansiyeli", icon: Leaf },
    { key: "flexibility", label: "Tasarım esnekliği", icon: Expand },
    { key: "certainty", label: "Uygulama öngörüsü", icon: ShieldCheck },
  ] as const;

  return <section className="immersive-engineering" id="canli-karar-deneyimi">
    <div className="shell immersive-heading">
      <div><p className="eyebrow light">Arkem Immersive Engineering</p><h2>Projenizi yalnızca görmeyin.<br/><em>Kararların içine girin.</em></h2></div>
      <div><p>Aynı yatırım için alternatif sistemleri karşılaştırın, yapının dijital katmanlarını açın ve sonucu yönetici briefine dönüştürün.</p><button type="button" onClick={() => { setPresentationStep(0); setPresentationOpen(true); }}><Maximize2 size={17}/> Müşteri sunum modunu başlat</button></div>
    </div>

    <div className="shell immersive-workspace">
      <div className="scenario-lab">
        <header><div><span>ARKEM / LIVE SCENARIO LAB</span><b>A/B YAPI SİSTEMİ KARAR MASASI</b></div><i>CANLI</i></header>
        <div className="scenario-inputs">
          <label><span>Yaklaşık toplam alan</span><div><input type="range" min="200" max="12000" step="100" value={area} onChange={(event)=>{setArea(Number(event.target.value));setSaved(false);}}/><b>{area.toLocaleString("tr-TR")} m²</b></div></label>
          <label><span>Kat sayısı</span><div><input type="range" min="1" max="20" value={floors} onChange={(event)=>{setFloors(Number(event.target.value));setSaved(false);}}/><b>{floors} kat</b></div></label>
          <label><span>Hedef serbest açıklık</span><div><input type="range" min="3" max="30" value={span} onChange={(event)=>{setSpan(Number(event.target.value));setSaved(false);}}/><b>{span} m</b></div></label>
        </div>
        <div className="scenario-columns">
          {(["a","b"] as const).map((side) => {
            const key = side === "a" ? systemA : systemB;
            const setKey = side === "a" ? setSystemA : setSystemB;
            const result = comparison[side];
            return <article key={side} className={recommendation === key ? "recommended" : ""}>
              <header><span>SENARYO {side.toUpperCase()}</span><select aria-label={`Senaryo ${side.toUpperCase()} yapı sistemi`} value={key} onChange={(event)=>{setKey(event.target.value as SystemKey);setSaved(false);}}>{Object.entries(systems).map(([value,item])=><option key={value} value={value}>{item.label}</option>)}</select>{recommendation === key && <b><Check size={13}/> ÖN YÖNELİM</b>}</header>
              <div className="scenario-system-title"><i>{systems[key].short}</i><div><h3>{systems[key].label}</h3><p>{systems[key].summary}</p></div></div>
              <div className="scenario-metrics">{metrics.map(({key:metricKey,label,icon:Icon})=><div key={metricKey}><span><Icon size={14}/>{label}</span><i><b style={{width:`${result[metricKey]}%`}}/></i><strong>{result[metricKey]}</strong></div>)}</div>
            </article>;
          })}
        </div>
        <footer><p><ShieldCheck size={15}/><span><b>Ön değerlendirme motoru</b> Sonuçlar kıyas mantığını gösterir; statik hesap, teklif veya sertifikalı LCA değildir.</span></p><div><button type="button" onClick={saveDecision}>{saved ? <Check size={16}/> : <Layers3 size={16}/>} {saved ? "Proje zincirine eklendi" : "Kararı proje zincirine ekle"}</button><button type="button" onClick={downloadBrief}><Download size={16}/> Yönetici briefi</button></div></footer>
      </div>

      <div className="digital-xray">
        <header><div><span>ARKEM / DIGITAL X-RAY</span><b>YAPI KATMANI İNCELEME</b></div><i>{activeLayer.code}</i></header>
        <div className={`xray-visual layer-${layer}`}>
          <img src="/visuals/arkem-premium-command-center.png" alt="Taşıyıcı, temel, cephe ve tesisat katmanları ayrıştırılmış endüstriyel yapı BIM modeli"/>
          <span className="xray-scan"/>
          <div className="xray-readout"><small>AKTİF KATMAN</small><strong>{activeLayer.title}</strong><p>{activeLayer.copy}</p></div>
          <div className="xray-coordinate"><Ruler size={13}/> WGS84 · BIM ORIGIN · LOD 300</div>
        </div>
        <nav aria-label="Dijital yapı katmanları">{Object.entries(layers).map(([key,item])=><button type="button" key={key} className={layer === key ? "active" : ""} onClick={()=>setLayer(key as LayerKey)}><span>{item.code}</span><b>{item.label}</b><ArrowRight size={14}/></button>)}</nav>
        <div className="xray-facts">{activeLayer.facts.map((fact,index)=><span key={fact}><small>0{index+1}</small><b>{fact}</b></span>)}</div>
      </div>
    </div>

    {presentationOpen && <div className="client-presentation" role="dialog" aria-modal="true" aria-labelledby="presentation-title">
      <button className="presentation-close" type="button" onClick={()=>setPresentationOpen(false)} aria-label="Müşteri sunum modunu kapat"><X size={22}/></button>
      <div className="presentation-brand"><span>ARKEM</span><b>IMMERSIVE PROJECT STORY</b></div>
      <div className="presentation-progress">{presentationSteps.map((step,index)=><button type="button" key={step.code} className={presentationStep === index ? "active" : ""} onClick={()=>setPresentationStep(index)}><span>{step.code}</span><b>{step.label}</b></button>)}</div>
      <main>
        <div className="presentation-copy"><p>{presentationSteps[presentationStep].code} / {presentationSteps[presentationStep].label}</p><h2 id="presentation-title">{presentationSteps[presentationStep].title}</h2><p>{presentationSteps[presentationStep].copy}</p><Link href={presentationSteps[presentationStep].href} onClick={()=>setPresentationOpen(false)}>İlgili çalışma alanını aç <ArrowRight size={17}/></Link></div>
        <div className="presentation-image"><img src="/visuals/arkem-premium-command-center.png" alt="Arkem bütünleşik mühendislik sürecini temsil eden ayrıştırılmış BIM yapı modeli"/><span>{presentationSteps[presentationStep].code}</span></div>
      </main>
      <footer><button type="button" disabled={presentationStep === 0} onClick={()=>setPresentationStep((current)=>Math.max(0,current-1))}><ArrowLeft size={17}/> Önceki</button><span>Parsel → Tasarım → Koordinasyon → Dijital Teslim</span><button type="button" onClick={()=>presentationStep === presentationSteps.length-1 ? setPresentationOpen(false) : setPresentationStep((current)=>Math.min(presentationSteps.length-1,current+1))}>{presentationStep === presentationSteps.length-1 ? "Deneyimi tamamla" : "Sonraki"} <ArrowRight size={17}/></button></footer>
    </div>}
  </section>;
}
