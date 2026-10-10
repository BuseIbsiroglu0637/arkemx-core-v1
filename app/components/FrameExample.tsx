"use client";
import { useState, useSyncExternalStore } from "react";
import { FrameWorkbenchView } from "./FrameWorkbench";
import { createFrameExample } from "../lib/frame-example";
import { calculateFloorPlateStudy } from "../lib/floor-plate-study";
const subscribeReady=()=>()=>{};
const browserReady=()=>true;
const serverReady=()=>false;
export function FrameExample(){
  const ready=useSyncExternalStore(subscribeReady,browserReady,serverReady);
  const [example,setExample]=useState(()=>createFrameExample()),[generation,setGeneration]=useState(0),[live,setLive]=useState("3.5"),[horizontal,setHorizontal]=useState("5"),[error,setError]=useState("");
  const [includeSelfWeight,setIncludeSelfWeight]=useState(false),[unitWeight,setUnitWeight]=useState("25");
  const study=calculateFloorPlateStudy(example.project,example.input).study;
  const apply=()=>{try{if(!live.trim()||!horizontal.trim())throw Error("Yük alanlarını doldurun; boş değer sıfır değildir.");setExample(createFrameExample(Number(live),Number(horizontal),includeSelfWeight?Number(unitWeight):undefined));setGeneration(g=>g+1);setError("");}catch(e){setError(e instanceof Error?e.message:"Örnek güncellenemedi.");}};
  const patch=(key:string,value:unknown)=>setExample(previous=>{
    // This page owns an in-memory example; only its calculation/document history changes.
    if(key!=="structural-concept"||!value||typeof value!=="object")return previous;
    const old=previous.project.modules[key] as Record<string,unknown>,incoming=value as Record<string,unknown>,merged={...old,...incoming};
    for(const field of ["frameRegistry","frameDocumentRegistry"])if(incoming[field])merged[field]={...(old[field] as Record<string,unknown>??{}),...(incoming[field] as Record<string,unknown>)};
    return {...previous,project:{...previous.project,modules:{...previous.project.modules,[key]:merged}}};
  });
  return <section data-testid="frame-example"><p role="note"><strong>ÖRNEK MODEL — Gerçek proje ve teknik onay değildir.</strong> Bu sayfa ayrı bir örnek çalışma alanıdır. Yükleri değiştirebilir, çözümü inceleyebilir ve örnek paftaları indirebilirsiniz. Sayfa yenilendiğinde örnek başlangıç değerlerine döner.</p>
    <h2>İki katlı örneğin varsayımları</h2><p>K1: 10 × 10 m, kot 0 m. K2: 20 × 10 m, kot 3,4 m. İki ankastre taban kotu −3,4 m; dört kolon ve iki kiriş. Döşeme yükleri her katta iki düğüme eşit dağıtılır; döşemenin gerçek davranışı çözülmez.</p>
    <p>Örnek malzeme: E=30.000.000, G=12.500.000 kN/m². Kesit: A=0,25 m²; Iy=Iz=1/192 m⁴; J=0,0088 m⁴. Bu değerler bir uygulama projesi için öneri değildir.</p>
    <label>Örnek hareketli yük Q (kN/m²)<input aria-label="Örnek hareketli yük Q (kN/m²)" type="number" min="0" max="50" step="0.5" value={live} onChange={e=>setLive(e.target.value)}/></label>
    <label>Örnek yatay düğüm yükü H (kN)<input aria-label="Örnek yatay düğüm yükü H (kN)" type="number" min="0" max="50" step="1" value={horizontal} onChange={e=>setHorizontal(e.target.value)}/></label>
    <button disabled={!ready} onClick={apply}>Örnek yüklerini uygula</button>{error&&<p role="alert">{error}</p>}
    <label><input type="checkbox" disabled={!ready} checked={includeSelfWeight} onChange={e=>setIncludeSelfWeight(e.target.checked)}/>Kolon ve kiriş öz ağırlığını G yüküne ekle</label>
    {includeSelfWeight&&<label>Örnek malzeme birim ağırlığı (kN/m³)<input type="number" min="0.01" step="0.5" value={unitWeight} onChange={e=>setUnitWeight(e.target.value)}/></label>}
    <p>Öz ağırlık seçimi “Örnek yüklerini uygula” ile uygulanır. 25 kN/m³ yalnız örnek varsayımıdır. Seçildiğinde götürü taşıyıcı payı kaldırılır ve açık kolon/kiriş ağırlığı bunun yerine uygulanır; döşeme öz ağırlığı ayrı kalır. Ek sabit yük girdisinde aynı kolon/kiriş ağırlığını tekrar tanımlamayın.</p>
    {study&&<div style={{overflowX:"auto"}}><table><caption>Ön çalışma kat alanları ve götürü pay dahil yükleri</caption><thead><tr><th>Kat</th><th>Alan (m²)</th><th>Ön çalışma G (kN)</th><th>Q (kN)</th></tr></thead><tbody>{study.floors.map(f=><tr key={f.level}><th scope="row">K{f.level}</th><td>{f.area}</td><td>{f.loads.permanentTotal}</td><td>{f.loads.liveTotal}</td></tr>)}</tbody></table><p>Toplam alan: {study.totals.grossArea} m². Ön çalışma G={study.totals.permanentLoad} kN, Q={study.totals.liveLoad} kN; üst kat kar yükü S={study.totals.roofSnowLoad} kN. Açık öz ağırlık seçildiyse çözüm G’si bu ön çalışma toplamından farklıdır; uygulanan bileşenler çözümden sonra aşağıdaki tabloda gösterilir.</p></div>}
    <FrameWorkbenchView key={generation} project={example.project} patchModule={patch} input={example.input}/>
  </section>;
}
