"use client";
import {useEffect,useMemo,useRef,useState} from "react";
import {useProjectKernel} from "./ProjectKernel";
import {ShellPlots} from "./ShellPlots";
import {downloadTextFile} from "../lib/engineering";
import {exportProjectShellInWorker} from "../lib/project-shell-worker-client";
import {projectShellRenderRecord,type ProjectShellArtifact} from "../lib/project-shell-documents";
import type {ProjectShellCalculationRecord} from "../lib/project-shell-calculation";
import type {ProjectShellSource} from "../lib/project-shell-source";
import type {ShellFormat} from "../lib/shell-documents";
import {SHELL_FIELDS,shellFieldUnit,type ShellView,type ShellField} from "../lib/shell-view";
export function ProjectShellDocumentsPanel({source,record}:{source:ProjectShellSource;record:ProjectShellCalculationRecord}) {
  const {project}=useProjectKernel(),rendered=useMemo(()=>projectShellRenderRecord(record),[record]);
  const [view,setView]=useState<ShellView>({caseId:"G",field:"Mxx",magnification:100,elementId:rendered.content.prepared.model.elements[0].id});
  const [busy,setBusy]=useState(false),[error,setError]=useState(""),[documents,setDocuments]=useState<ProjectShellArtifact["document"][]>([]);
  const active=useRef<AbortController|null>(null);
  useEffect(()=>()=>{active.current?.abort();active.current=null;},[]);
  const change=(next:Partial<ShellView>)=>{active.current?.abort();active.current=null;setBusy(false);setError("");setView(old=>({...old,...next}));};
  const output=async(format:ShellFormat)=>{
    const controller=new AbortController();active.current?.abort();active.current=controller;setBusy(true);setError("");
    try {
      const result=await exportProjectShellInWorker(project,source,record,format,view,{signal:controller.signal});
      if(active.current!==controller||controller.signal.aborted)return;
      downloadTextFile(result.name,result.bytes,format==="PDF"?"application/pdf":format==="DXF"?"application/dxf":"application/json");
      setDocuments(old=>[result.document,...old.filter(d=>d.id!==result.document.id)].slice(0,6));
    }catch(e){if(active.current===controller&&!controller.signal.aborted)setError(e instanceof Error?e.message:"Proje kabuk belgesi üretilemedi.");}
    finally{if(active.current===controller){active.current=null;setBusy(false);}}
  };
  return <section data-testid="project-shell-documents" aria-label="Proje kabuk sonuçları ve belgeleri">
    <h4>Proje döşemesi sonuçları ve taşınabilir yedek</h4>
    <label>Yük durumu<select aria-label="Proje kabuk yük durumu" value={view.caseId} onChange={e=>change({caseId:e.target.value})}>{record.content.cases.map(c=><option key={c.id}>{c.id}</option>)}</select></label>
    <label>Sonuç alanı<select aria-label="Proje kabuk sonuç alanı" value={view.field} onChange={e=>change({field:e.target.value as ShellField})}>{SHELL_FIELDS.map(f=><option key={f}>{f}</option>)}</select></label>
    <label>Deformasyon büyütmesi<input aria-label="Proje kabuk deformasyon büyütmesi" type="number" min={1} max={10000} value={view.magnification} onChange={e=>change({magnification:Number(e.target.value)})}/></label>
    <label>Ham sonuç elemanı<select aria-label="Proje kabuk ham sonuç elemanı" value={view.elementId} onChange={e=>change({elementId:e.target.value})}>{rendered.content.prepared.model.elements.map(e=><option key={e.id}>{e.id}</option>)}</select></label>
    <ShellPlots record={rendered} view={view}/>
    <div style={{overflowX:"auto"}}><table><caption>Seçili elemanın dört ham Gauss sonucu (N: kN/m; M: kNm/m; Q: kN/m)</caption><thead><tr><th>GP</th>{SHELL_FIELDS.slice(1).map(f=><th key={f}>{f}</th>)}</tr></thead><tbody>{record.content.cases.find(c=>c.id===view.caseId)!.elements.find(e=>e.id===view.elementId)!.points.map((p,i)=><tr key={i}><th>{i+1}</th>{p.resultants.map((v,k)=><td key={k}>{v.toExponential(5)}</td>)}</tr>)}</tbody></table></div>
    <p>JSON tam proje anlık görüntüsünü ve seçili döşemenin bütün ham hesap sonuçlarını taşır. Her döşeme için ayrı paket indirin. PDF aynı paketi ek olarak içerir; DXF metre biriminde kaynak ve deforme ağı korur.</p>
    {(["JSON","PDF","DXF"] as const).map(format=><button key={format} disabled={busy||view.magnification<1||view.magnification>10000||!Number.isFinite(view.magnification)} onClick={()=>void output(format)}>Proje kabuk {format} indir</button>)}
    {busy&&<button onClick={()=>{active.current?.abort();active.current=null;setBusy(false);setError("Belge üretimi iptal edildi.");}}>Proje kabuk belgesini iptal et</button>}
    {error&&<p role="alert">{error}</p>}
    <p role="status">{busy?"Güncel hesap doğrulanıyor ve belge hazırlanıyor…":`Alan: ${view.field} (${shellFieldUnit(view.field)})`}</p>
    {documents.map(doc=><p key={doc.id} data-testid="project-shell-document-proof">{doc.manifest.format} · {doc.artifact.byteLength} bayt · {doc.id}<button onClick={()=>downloadTextFile(doc.artifact.fileName+".proof.json",JSON.stringify(doc,null,2),"application/json")}>Proje kabuk {doc.manifest.format} kanıtını indir</button></p>)}
  </section>;
}
