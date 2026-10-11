"use client";
import {useEffect,useMemo,useRef,useState} from "react";
import {useProjectKernel} from "./ProjectKernel";
import {createProjectShellDraft,inspectProjectShellSource} from "../lib/project-shell-source";
import {traceJson} from "../lib/structural-traceability";
import {ProjectShellCalculationPanel} from "./ProjectShellCalculationPanel";
import {ProjectShellPackageRestore} from "./ProjectShellPackageRestore";
export function ProjectShellSourcePanel(){
 const {project,patchModule,hydrated}=useProjectKernel(),[selected,setSelected]=useState(""),[text,setText]=useState(""),[message,setMessage]=useState("");
 const plan=(project.modules["plan-editor"]??{}) as {floorPlates?:Array<{id?:string;level:number}>;projectShellSources?:Record<string,unknown>},plates=plan.floorPlates??[],plateId=plates.some(p=>p.id===selected)?selected:plates.find(p=>p.id)?.id??"";
 const readVersion=useRef(0);
 useEffect(()=>()=>{readVersion.current++;},[plateId,project.id,project.revision]);
 const saved=plan.projectShellSources?.[plateId],report=useMemo(()=>saved?inspectProjectShellSource(project,saved):null,[project,saved]);
 const draft=()=>{readVersion.current++;try{setText(JSON.stringify(createProjectShellDraft(project,plateId),null,2));setMessage("Eksik fiziksel girdileri doldurun; boş değerler sıfır değildir.");}catch(e){setMessage(e instanceof Error?e.message:"Kaynak taslağı oluşturulamadı.");}};
 const save=()=>{try{const value=JSON.parse(text),checked=inspectProjectShellSource(project,value);if(!checked.source)throw Error(checked.issues.join(" "));if(checked.source.sourcePlateId!==plateId)throw Error("JSON seçilen döşemeye ait olmalı.");patchModule("plan-editor",{projectShellSources:{[plateId]:checked.source}});setMessage("Proje kabuk kaynağı doğrulandı ve kaydedildi; hesap çalıştırılmadı.");}catch(e){setMessage(e instanceof Error?e.message:"Kaynak JSON geçersiz.");}};
 return <section data-testid="project-shell-source" className="engineering-panel">
  <h2>Proje döşemesinin kabuk kaynağı</h2><p>Kaynak girdisini doğrulayın, ardından bağımsız döşeme kabuk hesabını çalıştırın. Ortak çerçeve çözümü ve teknik onay henüz yoktur. Kenar mesneti ve orta yüzey kotunu açıkça beyan edin; kolonlar otomatik mesnet sayılmaz.</p>
  <label>Kaynak döşemesi<select aria-label="Kabuk kaynak döşemesi" value={plateId} onChange={e=>{readVersion.current++;setSelected(e.target.value);setText("");setMessage("");}}>{!plateId&&<option value="">Kalıcı döşeme kimliği gerekiyor</option>}{plates.filter(p=>p.id).map(p=><option key={p.id} value={p.id}>K{p.level} · {p.id}</option>)}</select></label>
  <button disabled={!hydrated||!plateId} onClick={draft}>Boş proje kabuk kaynağı oluştur</button>
  {Boolean(saved)&&<button onClick={()=>{readVersion.current++;setText(JSON.stringify(saved,null,2));setMessage("");}}>Kayıtlı kabuk kaynağını aç</button>}
  <p data-testid="project-shell-status" role="status">{report?.source?"Kaynak güncel ve doğrulandı; hesap durumu aşağıda gösterilir.":report?"Kaynak güncel değil: "+report.issues.join(" "):"Doğrulanmış proje kabuk kaynağı yok."}</p>
  <label>Proje kabuk kaynağı dosyası<input aria-label="Proje kabuk kaynağı dosyası" type="file" accept=".json,application/json" onChange={async e=>{const file=e.target.files?.[0],version=++readVersion.current;if(file)try{const content=await file.text();if(version===readVersion.current){setText(content);setMessage("");}}catch{if(version===readVersion.current)setMessage("Kaynak dosyası okunamadı.");}}}/></label>
  <label>Proje kabuk kaynağı JSON<textarea aria-label="Proje kabuk kaynağı JSON" rows={12} value={text} onChange={e=>{readVersion.current++;setText(e.target.value);setMessage("");}} style={{width:"100%",fontFamily:"monospace"}}/></label>
  <button disabled={!hydrated||!text.trim()} onClick={save}>Kabuk kaynağını doğrula ve kaydet</button>{message&&<p data-testid="project-shell-message">{message}</p>}
  {report?.source&&<ProjectShellCalculationPanel key={traceJson(report.source)} source={report.source}/>}
  <ProjectShellPackageRestore key={project.id+":"+project.revision}/>
 </section>;
}
