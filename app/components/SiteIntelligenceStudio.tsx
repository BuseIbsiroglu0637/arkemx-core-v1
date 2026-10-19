"use client";

import { useEffect, useMemo, useState } from "react";
import { downloadTextFile } from "../lib/engineering";
import { rectangularEnvelope } from "../lib/readiness-input";
import { ProjectKernelBar, useProjectKernel } from "./ProjectKernel";

const schemes = {
  "Kompakt": { coverage: .68, efficiency: .91, solar: 72, carbon: 78, note: "Kısa dolaşım, yüksek alan verimi ve daha küçük dış kabuk." },
  "Dengeli": { coverage: .58, efficiency: .87, solar: 84, carbon: 84, note: "Açık alan, işletme akışı ve yapım ekonomisi arasında denge." },
  "Düşük Karbon": { coverage: .49, efficiency: .82, solar: 93, carbon: 94, note: "Günışığı, sökülebilir sistem ve düşük malzeme yoğunluğu önceliği." },
} as const;

type Scheme = keyof typeof schemes;

const systemFactors = {
  "Betonarme": { carbon: 100, speed: 56, span: "orta açıklık" },
  "Betonarme Prefabrik": { carbon: 78, speed: 82, span: "orta / geniş açıklık" },
  "Yapısal Çelik": { carbon: 70, speed: 88, span: "geniş açıklık" },
  "Hafif Çelik": { carbon: 58, speed: 94, span: "küçük / orta açıklık" },
} as const;

export function SiteIntelligenceStudio() {
  const { patchModule } = useProjectKernel();
  const [width, setWidth] = useState(46);
  const [depth, setDepth] = useState(72);
  const [setback, setSetback] = useState(5);
  const [floors, setFloors] = useState(2);
  const [slope, setSlope] = useState(4);
  const [orientation, setOrientation] = useState(0);
  const [use, setUse] = useState("Sanayi / Depo");
  const [system, setSystem] = useState<keyof typeof systemFactors>("Yapısal Çelik");
  const [scheme, setScheme] = useState<Scheme>("Dengeli");
  const [layer, setLayer] = useState<"Günışığı" | "Rüzgâr" | "Dolaşım" | "Yapılabilirlik">("Günışığı");
  const [maxCoverage, setMaxCoverage] = useState(.6);
  const [maxFar, setMaxFar] = useState(1.2);
  const [maxHeight, setMaxHeight] = useState(12.5);

  const result = useMemo(() => {
    const { valid, plot, envelope } = rectangularEnvelope(width, depth, setback);
    const footprint = Math.round(envelope * schemes[scheme].coverage);
    const gross = footprint * floors;
    const open = valid ? Math.round((1 - footprint / plot) * 100) : 0;
    const parkingRatio = use === "Konut / Villa" ? 115 : use === "Ticari Yapı" ? 65 : 180;
    const parking = valid ? Math.max(2, Math.round(gross / parkingRatio)) : 0;
    const terrain = Math.round(plot * slope * .0032);
    const fit = Math.min(98, Math.round((schemes[scheme].efficiency * 100 + systemFactors[system].speed) / 2 - slope * .7));
    const carbon = Math.round(systemFactors[system].carbon * (1 - (schemes[scheme].carbon - 78) / 160));
    const coverage = valid ? footprint / plot : 0;
    const far = valid ? gross / plot : 0;
    const buildingHeight = floors * 3.4;
    return { valid, plot, envelope: Math.round(envelope), footprint, gross, open, parking, terrain, fit: valid ? fit : 0, carbon: valid ? carbon : 0, coverage, far, buildingHeight, compliance: { coverage: valid && coverage <= maxCoverage, far: valid && far <= maxFar, height: valid && buildingHeight <= maxHeight } };
  }, [width, depth, setback, floors, slope, use, system, scheme, maxCoverage, maxFar, maxHeight]);

  useEffect(() => {
    patchModule("quick-site-scenario", { input: { width, depth, setback, floors, slope, orientation, use, system, scheme, planning: { maxCoverage, maxFar, maxHeight } }, result, status: result.valid ? "synthetic-rectangular-plot" : "invalid-geometry" });
  }, [depth, floors, maxCoverage, maxFar, maxHeight, orientation, patchModule, result, scheme, setback, slope, system, use, width]);

  const exportScenario = () => { if (result.valid) downloadTextFile("arkem-hizli-arsa-senaryosu.json", JSON.stringify({ schema: "ARKEM-SITE-SCENARIO/1.0", dataStatus: "SYNTHETIC", units: "m", input: { width, depth, setback, floors, slope, orientation, use, system, scheme, maxCoverage, maxFar, maxHeight }, result }, null, 2), "application/json"); };

  const buildWidth = Math.max(30, Math.min(74, 36 + schemes[scheme].coverage * 46));
  const buildDepth = Math.max(28, Math.min(70, 31 + schemes[scheme].coverage * 42));
  const layerCopy = {
    "Günışığı": "Kütle yönlenmesi ve açık alan oranına göre erken aşama günışığı potansiyeli okunur.",
    "Rüzgâr": "Hakim rüzgâr, giriş ve servis alanlarında yaya konforu açısından temsili olarak görünür.",
    "Dolaşım": "Yaya, araç, servis ve yükleme hareketleri çakışma riski açısından ayrıştırılır.",
    "Yapılabilirlik": "Şantiye erişimi, kurulum alanı ve montaj sırası için gerekli boşluklar kontrol edilir.",
  };

  return <section className="site-intelligence-studio">
    <ProjectKernelBar module="QUICK SITE SCENARIO" confidence="Sentetik dikdörtgen parsel" />
    <header className="site-studio-head"><div><span>ARKEM / SITE INTELLIGENCE</span><b>Arsa & Ön Fizibilite Stüdyosu</b></div><div><i></i><span>CANLI SENARYO</span><small>Kalıcı veri saklanmaz</small></div></header>
    <div className="site-studio-body">
      <aside className="site-studio-controls">
        <div><span>01 / YATIRIM BRİEFİ</span><label>Yapı kullanımı<select value={use} onChange={(event)=>setUse(event.target.value)}><option>Sanayi / Depo</option><option>Ticari Yapı</option><option>Konut / Villa</option><option>Tarımsal Yapı</option></select></label><label>Taşıyıcı sistem<select value={system} onChange={(event)=>setSystem(event.target.value as keyof typeof systemFactors)}>{Object.keys(systemFactors).map((item)=><option key={item}>{item}</option>)}</select></label></div>
        <div><span>02 / PARSEL GEOMETRİSİ</span><label>Genişlik <b>{width} m</b><input type="range" min="18" max="100" value={width} onChange={(event)=>setWidth(Number(event.target.value))}/></label><label>Derinlik <b>{depth} m</b><input type="range" min="24" max="140" value={depth} onChange={(event)=>setDepth(Number(event.target.value))}/></label><label>Temsili çekme <b>{setback} m</b><input type="range" min="3" max="15" value={setback} onChange={(event)=>setSetback(Number(event.target.value))}/></label><label>Arazi eğimi <b>%{slope}</b><input type="range" min="0" max="24" value={slope} onChange={(event)=>setSlope(Number(event.target.value))}/></label></div>
        <div><span>03 / YAPI KURGUSU</span><label>Kat adedi <b>{floors}</b><input type="range" min="1" max="8" value={floors} onChange={(event)=>setFloors(Number(event.target.value))}/></label><label>Yönlenme <b>{orientation}°</b><input type="range" min="0" max="90" step="15" value={orientation} onChange={(event)=>setOrientation(Number(event.target.value))}/></label></div>
        <div><span>04 / PLANLAMA SINIRLARI</span><label>Azami TAKS<input type="number" min=".1" max="1" step=".05" value={maxCoverage} onChange={(event)=>setMaxCoverage(Number(event.target.value))}/></label><label>Azami KAKS / Emsal<input type="number" min=".1" max="8" step=".1" value={maxFar} onChange={(event)=>setMaxFar(Number(event.target.value))}/></label><label>Azami yapı yüksekliği<input type="number" min="3" max="100" step=".5" value={maxHeight} onChange={(event)=>setMaxHeight(Number(event.target.value))}/><i>m</i></label></div>
      </aside>
      <main className="site-studio-canvas">
        <div className="site-canvas-toolbar"><div>{(["Günışığı","Rüzgâr","Dolaşım","Yapılabilirlik"] as const).map((item)=><button key={item} className={layer===item?"active":""} onClick={()=>setLayer(item)}>{item}</button>)}</div><span>KUZEY ↑</span></div>
        <div className={`site-plan layer-${layer === "Günışığı" ? "gunisigi" : layer === "Rüzgâr" ? "ruzgar" : layer === "Dolaşım" ? "dolasim" : "yapilabilirlik"}`}>
          <div className="site-context-road"><span>ARAÇ / SERVİS YOLU</span></div>
          <div className="site-parcel" style={{aspectRatio:`${width}/${depth}`}}>
            <span className="site-dim width">{width} m</span><span className="site-dim depth">{depth} m</span>
            <div className="site-envelope" style={{inset:`${Math.min(16,6+setback*.55)}%`}}></div>
            {result.valid && <div className="site-building" style={{width:`${buildWidth}%`,height:`${buildDepth}%`,transform:`translate(-50%,-50%) rotate(${orientation}deg)`}}>
              <div>{Array.from({length:12},(_,index)=><i key={index}></i>)}</div><b>{use}</b><small>{system} · {floors} kat</small>
            </div>}
            <div className="site-loading"><i></i><i></i><i></i><span>YÜKLEME</span></div>
            <div className="site-circulation"><i></i></div>
            <div className="site-sun"><i></i><span>G</span></div>
            <div className="site-wind"><i></i><i></i><i></i></div>
          </div>
          <div className="site-layer-note"><span>{layer.toUpperCase()} KATMANI</span><p>{layerCopy[layer]}</p></div>
        </div>
        <div className="site-scheme-switch"><span>ÜRETİLEN ŞEMALAR</span>{(Object.keys(schemes) as Scheme[]).map((item,index)=><button key={item} className={scheme===item?"active":""} onClick={()=>setScheme(item)}><i>0{index+1}</i><b>{item}</b><small>{schemes[item].note}</small><strong>{item==="Kompakt"?"ALAN":item==="Dengeli"?"DENGE":"KARBON"} ODAKLI</strong></button>)}</div>
      </main>
      <aside className="site-studio-results">
        <span>04 / ANLIK GÖSTERGELER</span>
        {!result.valid ? <div className="module-feedback error" role="alert"><b>Bu çekme mesafesiyle yapı alanı kalmıyor.</b><p>Parsel genişliğini/derinliğini artırın veya temsili çekmeyi azaltın. Hesap ve dışa aktarım durduruldu.</p></div> : <>
        <div className="site-result-primary"><small>TAHMİNİ BRÜT ALAN</small><strong>{result.gross.toLocaleString("tr-TR")} <i>m²</i></strong><p>{result.footprint.toLocaleString("tr-TR")} m² taban · {result.plot.toLocaleString("tr-TR")} m² parsel</p></div>
        <div className="site-result-grid"><article><span>Açık alan</span><b>%{result.open}</b></article><article><span>Park ihtiyacı</span><b>~{result.parking}</b></article><article><span>TAKS / KAKS</span><b>{result.coverage.toFixed(2)} / {result.far.toFixed(2)}</b></article><article><span>Kazı/dolgu</span><b>~{result.terrain} m³</b></article></div>
        <div className="site-compliance"><span>GİRİLEN SINIRLARA GÖRE ÖN KONTROL</span>{[["TAKS", result.compliance.coverage, `${result.coverage.toFixed(2)} ≤ ${maxCoverage.toFixed(2)}`],["KAKS", result.compliance.far, `${result.far.toFixed(2)} ≤ ${maxFar.toFixed(2)}`],["Yükseklik", result.compliance.height, `${result.buildingHeight.toFixed(1)} ≤ ${maxHeight.toFixed(1)} m`]].map(([label, ok, value])=><p className={ok ? "pass" : "risk"} key={String(label)}><i>{ok ? "✓" : "!"}</i><b>{label}</b><span>{value}</span></p>)}</div>
        <div className="site-performance"><article><span>Günışığı potansiyeli</span><i><b style={{width:`${Math.max(45,schemes[scheme].solar-orientation*.12)}%`}}></b></i><strong>{Math.round(schemes[scheme].solar-orientation*.12)}</strong></article><article><span>Göreli karbon endeksi</span><i><b className="copper" style={{width:`${result.carbon}%`}}></b></i><strong>{result.carbon}</strong></article><article><span>Yapım hızı endeksi</span><i><b style={{width:`${systemFactors[system].speed}%`}}></b></i><strong>{systemFactors[system].speed}</strong></article></div>
        <div className="site-recommendation"><span>ARKEM ÖN NOTU</span><h4>{scheme} şema + {system}</h4><p>{slope>12?"Eğim nedeniyle kotlandırma, istinat ve zemin verisi ilk teknik pakete alınmalı.":"Parsel geometrisi erken sistem karşılaştırması ve yerleşim alternatifleri için elverişli görünüyor."} {systemFactors[system].span} gerektiren kullanım için açıklık ve aks kararları statik modelle doğrulanmalı.</p></div>
        </>}
        <button className="site-export-json" onClick={exportScenario} disabled={!result.valid}>Senaryo JSON indir</button><a href="/iletisim">Bu senaryoyla ön görüşme başlatın</a>
      </aside>
    </div>
    <footer><b>Kavramsal karar desteği</b><p>Bu araç imar durumu, ruhsat uygunluğu, zemin etüdü, kesin metraj, statik hesap veya sertifikalı çevresel analiz yerine geçmez. Gerçek çalışma, doğrulanmış parsel ve proje verileriyle hazırlanır.</p></footer>
  </section>;
}
