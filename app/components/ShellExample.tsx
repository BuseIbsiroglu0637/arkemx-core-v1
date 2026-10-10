"use client";
import {useEffect,useMemo,useRef,useState,useSyncExternalStore} from "react";
import {createShellExamples} from "../lib/shell-example";
import {validateShellSource,type ShellSource} from "../lib/shell-source";
import {calculateShellInWorker,exportShellInWorker} from "../lib/shell-worker-client";
import type {ShellCalculationRecord} from "../lib/shell-solver";
import type {ShellDocumentRecord,ShellFormat} from "../lib/shell-documents";
import {SHELL_FIELDS,shellFieldUnit,type ShellView,type ShellField} from "../lib/shell-view";
import {downloadTextFile} from "../lib/engineering";
import {ShellPlots} from "./ShellPlots";
const subscribe=()=>()=>{},client=()=>true,server=()=>false;
const defaults={plate:"0",preset:"SS-H",density:"refined",h:"0.16",E:"30000000",nu:"0.2",gamma:"25",super:"2.2",Q:"3.5",bench:"1",self:true};
type Draft=typeof defaults;
function sourceFrom(d:Draft):ShellSource{
 const source=createShellExamples(d.preset as "SS-H"|"CL",d.density as "coarse"|"medium"|"fine"|"refined")[Number(d.plate)];
 if(!source)throw Error("Örnek plaka seçimi geçersiz.");
 const num=(text:string)=>{if(!text.trim())throw Error("Boş alan sıfır değildir; bütün girdileri doldurun.");const v=Number(text);if(!Number.isFinite(v))throw Error("Sonlu sayısal değer gerekiyor.");return v;};
 source.plate.thickness=num(d.h);source.material={...source.material,E:num(d.E),nu:num(d.nu),unitWeight:num(d.gamma)};
 source.loads={slabSelfWeight:d.self,superDeadLoad:num(d.super),liveLoad:num(d.Q),benchmarkLoad:num(d.bench)};validateShellSource(source);return source;
}
export function ShellExample(){
 const ready=useSyncExternalStore(subscribe,client,server),[draft,setDraft]=useState(defaults),[record,setRecord]=useState<ShellCalculationRecord|null>(null),[error,setError]=useState(""),[busy,setBusy]=useState<""|"solve"|"export">(""),[caseId,setCaseId]=useState("G"),[field,setField]=useState<ShellField>("Uz"),[scale,setScale]=useState("100"),[elementId,setElementId]=useState(""),[page,setPage]=useState(0),[docs,setDocs]=useState<ShellDocumentRecord[]>([]);
 const epoch=useRef(0),operation=useRef<AbortController|null>(null);
 useEffect(()=>()=>{epoch.current++;operation.current?.abort();},[]);
 const sourceResult=useMemo(()=>{try{return {source:sourceFrom(draft),issue:""};}catch(e){return {source:null,issue:e instanceof Error?e.message:"Geçersiz kaynak."};}},[draft]);
 const edit=(patch:Partial<Draft>)=>{epoch.current++;operation.current?.abort();setBusy("");setRecord(null);setError("");setDocs([]);setPage(0);setDraft(d=>({...d,...patch}));};
 const view=useMemo<ShellView|null>(()=>record?{caseId,field,magnification:Number(scale),elementId:elementId||record.content.prepared.model.elements[0].id}:null,[record,caseId,field,scale,elementId]);
 const viewValid=!!view&&scale.trim()!==""&&Number.isFinite(view.magnification)&&view.magnification>=1&&view.magnification<=10000;
 const changeView=(fn:()=>void)=>{epoch.current++;operation.current?.abort();setBusy("");setError("");fn();};
 const solve=async()=>{
  if(!sourceResult.source||busy)return;const ticket=++epoch.current,controller=new AbortController();operation.current=controller;setBusy("solve");setError("");setRecord(null);setDocs([]);
  try{const next=await calculateShellInWorker(sourceResult.source,{signal:controller.signal});if(ticket!==epoch.current)return;setRecord(next);setElementId(next.content.prepared.model.elements[0].id);setPage(0);}
  catch(e){if(ticket===epoch.current)setError(e instanceof Error?e.message:"Kabuk çözülemedi.");}
  finally{if(ticket===epoch.current){setBusy("");operation.current=null;}}
 };
 const output=async(format:ShellFormat)=>{
  if(!record||!view||!viewValid||!sourceResult.source||busy)return;const ticket=++epoch.current,controller=new AbortController();operation.current=controller;setBusy("export");setError("");
  try{const artifact=await exportShellInWorker(sourceResult.source,record,format,view,{signal:controller.signal});if(ticket!==epoch.current)return;
   downloadTextFile(artifact.name,artifact.bytes,format==="PDF"?"application/pdf":format==="DXF"?"application/dxf":"application/json");
   setDocs(previous=>[artifact.document,...previous.filter(d=>d.id!==artifact.document.id)].slice(0,6));
  }catch(e){if(ticket===epoch.current)setError(e instanceof Error?e.message:"Kabuk belgesi oluşturulamadı.");}
  finally{if(ticket===epoch.current){setBusy("");operation.current=null;}}
 };
 const cancel=()=>{epoch.current++;operation.current?.abort();operation.current=null;setBusy("");setError("İşlem iptal edildi; yeni sonuç veya belge üretilmedi.");};
 const c=record?.content.cases.find(c=>c.id===caseId),selected=c?.elements.find(e=>e.id===view?.elementId),model=record?.content.prepared.model;
 return <section data-testid="shell-example" className="engineering-panel">
 <p role="note"><strong>ÖRNEK KABUK MODELİ</strong> · İki plaka bağımsızdır; bu çalışma gerçek proje verisini değiştirmez. Tam bina analizi ve teknik onay yoktur. Yenilemede başlangıç girdilerine döner.</p>
 <div className="shell-inputs">
  <label>Örnek plaka<select aria-label="Örnek plaka" value={draft.plate} onChange={e=>edit({plate:e.target.value})}><option value="0">P1 · 10 × 10 m · Z=0 m</option><option value="1">P2 · 20 × 10 m · Z=3,4 m</option></select></label>
  <label>Kenar mesneti<select aria-label="Kenar mesneti" value={draft.preset} onChange={e=>edit({preset:e.target.value})}><option>SS-H</option><option>CL</option></select></label>
  <label>Kabuk ağı<select aria-label="Kabuk ağı" value={draft.density} onChange={e=>edit({density:e.target.value})}><option value="coarse">Kaba</option><option value="medium">Orta</option><option value="fine">İnce</option><option value="refined">Ek inceltilmiş</option></select></label>
  {([["h","Kalınlık h (m)"],["E","Elastisite E (kN/m²)"],["nu","Poisson oranı ν"],["gamma","Birim ağırlık γ (kN/m³)"],["super","Ek sabit yük (kN/m²)"],["Q","Hareketli yük Q (kN/m²)"],["bench","Benchmark yükü (kN/m²)"]] as const).map(([key,label])=><label key={key}>{label}<input aria-label={label} type="number" step="any" value={draft[key]} onChange={e=>edit({[key]:e.target.value})}/></label>)}
  <label><input type="checkbox" checked={draft.self} onChange={e=>edit({self:e.target.checked})}/>Döşeme öz ağırlığını dahil et</label>
 </div>
 <p>SS-H: X kenarlarında uz/rx, Y kenarlarında uz/ry sabit. CL: dört kenarda uz/rx/ry sabit. Düzlem içi iki ankraj açıkça tanımlıdır; rz drilling cezası α=1. +Z yukarı, alan yükleri aşağıdır.</p>
 <p>G = döşeme öz ağırlığı + ek sabit yük. G_SW, G_SUP, Q ve BENCH ayrı bileşenlerdir; çerçeve ağırlığı bu plaka kapsamında yoktur.</p>
 {sourceResult.source&&<p data-testid="shell-source-status">Kaynak {sourceResult.source.schema}: {sourceResult.source.plate.id}, ağ {sourceResult.source.mesh.nx} × {sourceResult.source.mesh.ny}. Önceki üç ağ bazı senaryolarda yakınsama hedefini karşılamadı; ek inceltilmiş ağ varsayılandır.</p>}
 {sourceResult.issue&&<p role="alert">{sourceResult.issue}</p>}{error&&<p role="alert" data-testid="shell-error">{error}</p>}
 <button disabled={!ready||!sourceResult.source||!!busy} onClick={solve}>Kabuk modelini çöz</button>{busy&&<button onClick={cancel}>İşlemi iptal et</button>}
 <p role="status" data-testid="shell-status">{busy==="solve"?"Kabuk çözülüyor…":busy==="export"?"Güncel hesap doğrulanıyor ve belge hazırlanıyor…":record?"Çözüm hazır; denge kontrolü geçti.":"Güncel kabuk çözümü yok."}</p>
 {record&&c&&view&&model&&<div data-testid="shell-results">
  <p className="shell-id">Hesap kimliği: {record.id}</p><p>Bu oturumda bağımsız referans ve ağ yakınsaması çalıştırılmadı. S2’nin sabit örnekleri ayrı testlerle doğrulandı; değiştirilen girdilere otomatik onay verilmez.</p>
  <div className="shell-inputs"><label>Yük durumu<select aria-label="Kabuk yük durumu" value={caseId} onChange={e=>changeView(()=>setCaseId(e.target.value))}>{record.content.cases.map(c=><option key={c.id}>{c.id}</option>)}</select></label>
  <label>Sonuç alanı<select aria-label="Kabuk sonuç alanı" value={field} onChange={e=>changeView(()=>setField(e.target.value as ShellField))}>{SHELL_FIELDS.map(f=><option key={f} value={f}>{f} ({shellFieldUnit(f)})</option>)}</select></label>
  <label>Deformasyon büyütmesi<input aria-label="Deformasyon büyütmesi" type="number" min="1" max="10000" value={scale} onChange={e=>changeView(()=>setScale(e.target.value))}/></label></div>
  <p data-testid="shell-summary">Merkez Uz: {c.centerUz.toExponential(6)} m · En büyük |Uz|: {c.maxAbsUz.toExponential(6)} m · Kuvvet / moment denge artığı: {c.equilibrium.forceResidual.toExponential(3)} / {c.equilibrium.momentResidual.toExponential(3)}</p>
  {!viewValid&&<p role="alert">Büyütme 1–10000 arasında olmalı; boş değer kabul edilmez.</p>}{viewValid&&<ShellPlots record={record} view={view}/>}
  <div className="shell-table"><table><caption>Tüm mesnetlerin toplam reaksiyonu; global moment dengesi kuvvet kollarını ayrıca içerir</caption><thead><tr>{["Fx (kN)","Fy (kN)","Fz (kN)","Mx (kNm)","My (kNm)","Mz (kNm)"].map(h=><th key={h}>{h}</th>)}</tr></thead><tbody><tr>{Array.from({length:6},(_,k)=>c.nodes.reduce((v,n)=>v+n.reactions[k],0)).map((v,k)=><td key={k}>{v.toExponential(5)}</td>)}</tr></tbody></table></div>
  <details><summary>Ham düğüm ötelemeleri, dönmeleri ve reaksiyonları</summary><div className="shell-table"><table><caption>{c.id} · Düğümler {page*25+1}–{Math.min(c.nodes.length,(page+1)*25)} / {c.nodes.length}</caption><thead><tr><th>Düğüm</th><th>Ux / Uy / Uz (m)</th><th>rx / ry / rz (rad)</th><th>Fx / Fy / Fz (kN)</th><th>Mx / My / Mz (kNm)</th></tr></thead><tbody>{c.nodes.slice(page*25,(page+1)*25).map(n=><tr key={n.id}><th scope="row">{n.id}</th>{[n.displacements.slice(0,3),n.displacements.slice(3),n.reactions.slice(0,3),n.reactions.slice(3)].map((values,i)=><td key={i}>{values.map(v=>v.toExponential(4)).join(" / ")}</td>)}</tr>)}</tbody></table></div><button disabled={page===0} onClick={()=>setPage(v=>v-1)}>Önceki düğümler</button><button disabled={(page+1)*25>=c.nodes.length} onClick={()=>setPage(v=>v+1)}>Sonraki düğümler</button></details>
  <label>Ham sonuç elemanı<select aria-label="Ham sonuç elemanı" value={view.elementId} onChange={e=>changeView(()=>setElementId(e.target.value))}>{model.elements.map(e=><option key={e.id}>{e.id}</option>)}</select></label>
  {selected&&<div className="shell-table"><table><caption>{selected.id} · Ham 2×2 Gauss sonuçları; Nx/Ny/Nxy/Qx/Qy kN/m, Mxx/Myy/Mxy kNm/m; M=−Dκ</caption><thead><tr><th>GP / ξ / η</th>{SHELL_FIELDS.slice(1).map(f=><th key={f}>{f}</th>)}</tr></thead><tbody>{selected.points.map((p,i)=><tr key={i}><th scope="row">{i+1} / {p.xi.toFixed(3)} / {p.eta.toFixed(3)}</th>{p.resultants.map((v,k)=><td key={k}>{v.toExponential(4)}</td>)}</tr>)}</tbody></table></div>}
 </div>}
 <div className="engineering-export-actions">{(["JSON","PDF","DXF"] as const).map(format=><button key={format} disabled={!ready||!record||!viewValid||!!busy} aria-label={"Kabuk sonuçlarını indir ("+format+")"} onClick={()=>output(format)}>{format} · Kabuk sonuçları ↓</button>)}</div>
 <p>İndirme yalnız güncel, yeniden doğrulanan hesapla açılır. JSON tüm ham sonuçları; PDF kaynak, seçili sonuç haritası, deformasyon, mesnet ve Gauss tabloları ile gömülü JSON’u; DXF kaynak/deforme ağ, mesnetler ve seçili ham değerleri içerir.</p>
 {docs.length>0&&<details data-testid="shell-documents"><summary>Üretilen belgelerin bayt kanıtı</summary>{docs.map(doc=><div key={doc.id} className="shell-id"><p>{doc.artifact.fileName} · {doc.artifact.byteLength} bayt · {doc.id}</p><button onClick={()=>downloadTextFile(doc.artifact.fileName+".proof.json",JSON.stringify(doc,null,2),"application/json")}>Belge kanıtını indir: {doc.manifest.format}</button></div>)}</details>}
 </section>;
}
