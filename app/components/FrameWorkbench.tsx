"use client";
import { useEffect, useRef, useState } from "react";
import { useProjectKernel } from "./ProjectKernel";
import { inspectFloorCoordination } from "../lib/floor-coordination";
import { floorFrameBasis, frameDraft, inspectFloorFrame, prepareFloorFrame, recordFloorFrame } from "../lib/floor-frame";
import { commonFrameDxf, frameSourceKey, prepareFrameDocument, sealFrameDocument, type FrameRecord } from "../lib/frame-documents";
import { createCorporateTechnicalPdf, type TechnicalSheetPolyline } from "../lib/technical-sheet";
import { downloadTextFile, type StructuralConceptInput } from "../lib/engineering";
import { traceJson } from "../lib/structural-traceability";
type Plan=Record<string,unknown>;
export function FrameWorkbench({editable=false,input}:{editable?:boolean;input?:StructuralConceptInput}){
  const {project,patchModule}=useProjectKernel(),plan=(project.modules["plan-editor"]??{}) as Plan;
  const g=inspectFloorCoordination(plan).geometry,declared=inspectFloorFrame(plan);
  let key="",basis="";try{key=frameSourceKey(project)+traceJson(input??null);basis=floorFrameBasis(plan);}catch{/* Unusable source remains pending. */}
  const latest=useRef(key);useEffect(()=>{latest.current=key;},[key]);
  const [computed,setComputed]=useState<{key:string;record:FrameRecord}|null>(null),[error,setError]=useState(""),[caseId,setCaseId]=useState("G"),[busy,setBusy]=useState(false);
  const record=computed?.key===key?computed.record:null;
  const resultCase=record?.content.result.cases.find(c=>c.id===caseId)??record?.content.result.cases[0];
  const solve=async()=>{
    if(!input||busy)return;
    setBusy(true);setError("");
    try{
      const prepared=prepareFloorFrame(project,input);if(!prepared.content)throw Error(prepared.issues.join(" "));
      const next=await recordFloorFrame(prepared.content);if(latest.current!==key)throw Error("Kaynak çözüm sırasında değişti.");
      const saved=((project.modules["structural-concept"]??{}) as {frameRegistry?:Record<string,FrameRecord>}).frameRegistry?.[next.id];
      if(saved&&traceJson(saved)!==traceJson(next))throw Error("Kayıtlı 3B çözüm bozulmuş.");
      patchModule("structural-concept",{frameRegistry:{[next.id]:next}});setComputed({key,record:next});
    }catch(e){setComputed(null);setError(e instanceof Error?e.message:"Model çözülemedi.");}finally{setBusy(false);}
  };
  const exportDocument=async(format:"PDF"|"DXF"|"JSON")=>{
    setError("");try{
      const manifest=await prepareFrameDocument(project,input,record,format);let bytes:string|Uint8Array;
      const name=`arkem-ortak-kat-${record?"lineer-cozum":"geometri"}.${format.toLowerCase()}`;
      if(format==="DXF")bytes=commonFrameDxf(manifest);
      else if(format==="JSON")bytes=JSON.stringify(manifest,null,2);
      else{
        const geometry=manifest.content.coordination.geometry!,polylines:TechnicalSheetPolyline[]=geometry.floors.map(f=>({closed:true,role:"primary",points:[{x:f.x,y:f.y},{x:f.x+f.width,y:f.y},{x:f.x+f.width,y:f.y+f.depth},{x:f.x,y:f.y+f.depth}]}));
        for(const b of geometry.beams)polylines.push({role:"secondary",points:[{x:b.start.x,y:b.start.y},{x:b.end.x,y:b.end.y}]});
        for(const c of geometry.columns)polylines.push({role:"secondary",points:[{x:c.x-.1,y:c.y},{x:c.x+.1,y:c.y}]});
        bytes=await createCorporateTechnicalPdf({...manifest.identityInput,projectName:project.name,drawingTitle:"Ortak Kat Yerleşimi ve Taşıyıcı Kaynakları",drawingSubtitle:"Üstten ortak X/Y görünümü; Z kotları koordinat tablosundadır",status:record?"Lineer elastik çalışma / teknik onay bekliyor":"Geometrik kaynak çizimi / hesap yok",reviewBanner:"KAPASİTE, DEPREM VE RESMÎ TEKNİK ONAY YOK",checkedBy:"Yetkili mühendis değerlendirmesi bekleniyor",polylines,coordinates:geometry.floors.map(f=>[`K${f.level} · Z=${f.z} m`,String(f.x),String(f.y)]),metrics:[["Kat sayısı",String(geometry.floors.length)],["Kolon/kiriş kaynakları",`${geometry.columns.length} / ${geometry.beams.length}`],["Model sonucu",record?"Lineer 3B çerçeve":"Hesaplanmadı"]],notes:[...geometry.floors.map(f=>`K${f.level}: (${f.x}, ${f.y}, ${f.z}) m; ${f.width} × ${f.depth} m`),...manifest.content.coordination.issues,...(record?.content.result.limitations??["Bu pafta yalnız kaynak geometrisini gösterir; analiz sonucu yoktur."])],traceability:manifest});
      }
      const doc=await sealFrameDocument(manifest,name,bytes);if(latest.current!==key)throw Error("Kaynak çıktı sırasında değişti.");
      patchModule("structural-concept",{frameDocumentRegistry:{[doc.id]:doc}});downloadTextFile(name,bytes,format==="PDF"?"application/pdf":format==="DXF"?"application/dxf":"application/json");
    }catch(e){setError(e instanceof Error?e.message:"Ortak pafta oluşturulamadı.");}
  };
  const nodes=record?.content.model.nodes??declared.model?.nodes;
  const members=record?.content.model.members??declared.model?.members;
  const projection=(p:{x:number;y:number;z:number})=>({x:p.x-.6*p.y,y:.3*(p.x+p.y)-p.z});
  const points=nodes?.map(projection)??[],minX=points.length?Math.min(...points.map(p=>p.x)):0,minY=points.length?Math.min(...points.map(p=>p.y)):0;
  const plotScale=points.length?Math.min(450/Math.max(1,...points.map(p=>p.x-minX)),260/Math.max(1,...points.map(p=>p.y-minY))):1;
  return <section className="engineering-panel" data-testid="frame-workbench">
    <h2>Eleman kotları, yük yolu ve lineer 3B çalışma</h2>
    <p>m / kN / kNm / rad. E ve G: kN/m²; A: m²; Iy/Iz/J: m⁴. Her kaynak kolon/kiriş bir elemana bağlanır. Ortak düğüm kimliği bağlantıyı, açık mesnet kısıtları yük yolunu tanımlar.</p>
    <p>Bu çözüm rijit uçlu, prizmatik lineer elastik çerçeve içindir. Döşeme kabuğu, çatlama, ikinci mertebe, deprem/dinamik ve taşıma kapasitesi analizi içermez.</p>
    {error&&<p role="alert" data-testid="frame-error">{error}</p>}
    <p role="status" data-testid="frame-source-status">{declared.model?"Eleman ve yük yolu kaynağı tanımlı; çözüm ve mühendis değerlendirmesi ayrı.":"Eleman/mesnet/yük kaynağı doğrulanacak."}</p>
    {!declared.model&&<ul>{declared.issues.map((issue,i)=><li key={i}>{issue}</li>)}</ul>}
    {editable&&g&&basis&&<FrameModelEditor key={basis+traceJson(plan.floorFrame??null)} plan={plan}/>}
    {declared.model&&<div style={{overflowX:"auto"}}><table><caption>Kaynak elemanlar ve gerçek başlangıç/bitiş kotları</caption><thead><tr><th>Kaynak</th><th>Başlangıç</th><th>Bitiş</th><th>Malzeme / kesit</th></tr></thead><tbody>{declared.model.members.map(m=>{const a=declared.model!.nodes.find(n=>n.id===m.start)!,b=declared.model!.nodes.find(n=>n.id===m.end)!;return <tr key={m.id}><th scope="row">{m.sourceId}</th><td>{m.start} · ({a.x}, {a.y}, {a.z}) m</td><td>{m.end} · ({b.x}, {b.y}, {b.z}) m</td><td>{m.materialId} / {m.sectionId}</td></tr>;})}</tbody></table></div>}
    {nodes&&members&&<svg viewBox="0 0 520 330" role="img" aria-label="Kaynak elemanların 3B şematik görünümü" style={{width:"100%",maxWidth:700}}>{members.map(m=>{const a=projection(nodes.find(n=>n.id===m.start)!),b=projection(nodes.find(n=>n.id===m.end)!);return <line key={m.id} x1={30+(a.x-minX)*plotScale} y1={30+(a.y-minY)*plotScale} x2={30+(b.x-minX)*plotScale} y2={30+(b.y-minY)*plotScale} stroke={m.kind==="column"?"#b96636":"#173143"} strokeWidth="2"><title>{m.sourceId}</title></line>;})}</svg>}
    {input&&<button type="button" disabled={!declared.model||busy} onClick={solve}>{busy?"Lineer model çözülüyor":"Lineer 3B modeli çöz"}</button>}
    {record&&resultCase&&<div data-testid="frame-results"><p>Çalışma kimliği: {record.id}. Tam yapı analizi ve teknik onay: yok.</p><label>Yük durumu<select aria-label="Yük durumu" value={resultCase.id} onChange={e=>setCaseId(e.target.value)}>{record.content.result.cases.map(c=><option key={c.id}>{c.id}</option>)}</select></label><p>Denge artığı: {resultCase.relativeResidual.toExponential(3)}</p><div style={{overflowX:"auto"}}><table><caption>Düğüm ötelenmeleri (m) ve reaksiyon kuvvetleri (kN)</caption><thead><tr><th>Düğüm</th><th>Ux / Uy / Uz</th><th>Rx / Ry / Rz</th></tr></thead><tbody>{resultCase.nodes.map(n=><tr key={n.id}><th scope="row">{n.id}</th><td>{n.displacements.slice(0,3).map(v=>v.toExponential(4)).join(" / ")}</td><td>{n.reactions.slice(0,3).map(v=>v.toFixed(4)).join(" / ")}</td></tr>)}</tbody></table></div><details><summary>Eleman uç kuvvetleri ve momentleri</summary>{resultCase.members.map(m=><p key={m.id}>{m.sourceId}: {m.localEndForces.map(v=>v.toExponential(4)).join(" / ")}</p>)}<p>Sıra: başlangıç Fx/Fy/Fz (kN), Mx/My/Mz (kNm), ardından aynı sırada bitiş değerleri; yerel eksenler JSON’dadır.</p></details></div>}
    <div className="engineering-export-actions">{(["PDF","DXF","JSON"] as const).map(format=><button key={format} disabled={!g} aria-label={`Ortak kat ve eleman paketini indir (${format})`} onClick={()=>exportDocument(format)}><span>{format}</span><b>Ortak kat ve eleman paketi</b><i aria-hidden="true">↓</i></button>)}</div>
    <p>Çözüm yapılmadıysa çıktı yalnız geometridir. PDF üstten ortak yerleşimi; DXF gerçek X/Y/Z kotlarını içerir. Gerçek proje ve yetkili mühendis kabulü ayrıca doğrulanmalıdır.</p>
  </section>;
}
function FrameModelEditor({plan}:{plan:Plan}){
  const {patchModule}=useProjectKernel();
  const [text,setText]=useState(()=>plan.floorFrame?JSON.stringify(plan.floorFrame,null,2):""),[error,setError]=useState("");
  const save=()=>{try{const source=JSON.parse(text),report=inspectFloorFrame({...plan,floorFrame:source});if(!report.model)throw Error(report.issues.join(" "));patchModule("plan-editor",{floorFrame:source});setError("");}catch(e){setError(e instanceof Error?e.message:"Model JSON geçersiz.");}};
  return <div data-testid="frame-model-editor"><h3>Eleman / mesnet / yük modelini içe aktar</h3><p>Taslakta bilinmeyen değerler null bırakılır. Alt düğüm kotlarını, ortak bağlantı kimliklerini, malzeme/kesitleri ve mesnetleri doldurun. Kat yük payları her katta 1’e tamamlanmalıdır; G/Q/S yükleri gerçek kat alanlarından üretilir. Ek durumlar açık düğüm yükleridir.</p><button type="button" onClick={()=>{setText(JSON.stringify(frameDraft(plan),null,2));setError("");}}>Kaynaklardan boş eleman taslağı oluştur</button><label>Model dosyası (JSON)<input aria-label="3B model JSON dosyası" type="file" accept=".json,application/json" onChange={async e=>{const file=e.target.files?.[0];if(file)setText(await file.text());}}/></label><label>3B eleman modeli (JSON)<textarea aria-label="3B eleman modeli (JSON)" rows={18} style={{width:"100%",fontFamily:"monospace"}} value={text} onChange={e=>setText(e.target.value)}/></label>{error&&<p role="alert">{error}</p>}<button type="button" onClick={()=>{try{const source=JSON.parse(text);source.basis=floorFrameBasis(plan);setText(JSON.stringify(source,null,2));setError("");}catch{setError("Önce geçerli bir JSON modeli girin.");}}}>Taslağı güncel kaynakla yeniden bağla</button><button type="button" onClick={save}>Eleman modelini doğrula ve kaydet</button></div>;
}
