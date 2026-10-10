"use client";
import {useEffect,useRef,useState} from "react";
import {useProjectKernel} from "./ProjectKernel";
import {calculateProjectShellInWorker} from "../lib/project-shell-worker-client";
import type {ProjectShellCalculationRecord} from "../lib/project-shell-calculation";
import type {ProjectShellSource} from "../lib/project-shell-source";

/** The parent remounts this session whenever the validated source changes. No large localStorage write. */
export function ProjectShellCalculationPanel({source}:{source:ProjectShellSource}) {
  const {project}=useProjectKernel();
  const [record,setRecord]=useState<ProjectShellCalculationRecord|null>(null);
  const [busy,setBusy]=useState(false),[error,setError]=useState("");
  const active=useRef<AbortController|null>(null);
  useEffect(()=>()=>{active.current?.abort();active.current=null;},[]);
  const calculate=async()=>{
    const controller=new AbortController();active.current?.abort();active.current=controller;
    setBusy(true);setError("");setRecord(null);
    try{
      const result=await calculateProjectShellInWorker(project,source,{signal:controller.signal});
      if(active.current===controller&&!controller.signal.aborted)setRecord(result);
    }catch(e){if(active.current===controller)setError(e instanceof Error?e.message:"Proje kabuk hesabı başarısız.");}
    finally{if(active.current===controller){active.current=null;setBusy(false);}}
  };
  const content=record?.content,prepared=content?.sourceRecord.content;
  return <section data-testid="project-shell-calculation" aria-label="Proje döşemesi kabuk hesabı">
    <h3>Bağımsız döşeme kabuk hesabı</h3>
    <p>Bu hesap yalnız seçili döşemenin beyan edilen kenar mesnetleri için yapılır. Katlar ve çerçeve birlikte çözülmez; mühendislik onayı değildir.</p>
    <button disabled={busy} onClick={calculate}>Proje döşemesinin kabuk hesabını çalıştır</button>
    {busy&&<button onClick={()=>active.current?.abort()}>Proje kabuk hesabını iptal et</button>}
    <p role="status" data-testid="project-shell-calculation-status">{busy?"Kabuk hesabı çalışıyor…":record?"Kaynağa bağlı kabuk hesabı oluşturuldu.":"Bu oturumda geçerli proje kabuk hesabı yok."}</p>
    {error&&<p role="alert">{error}</p>}
    {content&&prepared&&<>
      <p data-testid="project-shell-calculation-id">Hesap: {record.id}<br/>Kaynak: {content.sourceRecord.id}<br/>Proje: {prepared.source.projectId} · Revizyon: {prepared.source.revision} · Döşeme: {prepared.source.sourcePlateId}</p>
      <p>Ağ: {prepared.meshCounts.nodes} düğüm / {prepared.meshCounts.elements} eleman · Alan: {prepared.area} m²</p>
      <div style={{overflowX:"auto"}}><table><caption>Kaynağa bağlı yük durumu özetleri</caption><thead><tr><th>Durum</th><th>Alan yükü (kN/m²)</th><th>Merkez uz (m)</th><th>Maksimum |uz| (m)</th><th>Kuvvet / moment denge artığı</th></tr></thead><tbody>{content.cases.map(c=><tr key={c.id}><th scope="row">{c.id}</th><td>{c.areaLoad}</td><td>{c.centerUz.toExponential(6)}</td><td>{c.maxAbsUz.toExponential(6)}</td><td>{c.equilibrium.forceResidual.toExponential(3)} / {c.equilibrium.momentResidual.toExponential(3)}</td></tr>)}</tbody></table></div>
    </>}
    <p>Hesap kaydı bu oturumda tutulur. Sayfa yenilendiğinde veya kaynak değiştiğinde yeniden hesaplayın. Kalıcı sonuç saklama ve proje belge akışı sonraki adımlarda tamamlanacak.</p>
  </section>;
}
