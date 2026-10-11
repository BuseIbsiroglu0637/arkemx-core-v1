"use client";
import {useEffect,useRef,useState} from "react";
import {useProjectKernel} from "./ProjectKernel";
import {calculateProjectShellInWorker,verifyProjectShellInWorker} from "../lib/project-shell-worker-client";
import {readProjectShellStorage,saveProjectShellStorage} from "../lib/project-shell-storage";
import type {ShellStorageSession} from "../lib/project-shell-storage";
import type {ProjectShellCalculationRecord} from "../lib/project-shell-calculation";
import type {ProjectShellSource} from "../lib/project-shell-source";

/** The parent remounts whenever the validated source changes; stale workers and writes are aborted. */
export function ProjectShellCalculationPanel({source}:{source:ProjectShellSource}) {
  const {project}=useProjectKernel();
  const [record,setRecord]=useState<ProjectShellCalculationRecord|null>(null);
  const [busy,setBusy]=useState(true),[error,setError]=useState("");
  const [savedAt,setSavedAt]=useState(""),[restoring,setRestoring]=useState(true);
  const session=useRef<ShellStorageSession|null>(null);
  const active=useRef<AbortController|null>(null);
  const snapshot=useRef({project,source});
  useEffect(()=>{
    const controller=new AbortController();active.current=controller;
    const {project:initialProject,source:initialSource}=snapshot.current;
    void (async()=>{
      try{
        const result=await readProjectShellStorage(initialProject,initialSource,controller.signal);
        if(active.current!==controller||controller.signal.aborted)return;
        session.current=result.session;
        if(result.error)throw Error(result.error);
        if(result.stored){
          if(!await verifyProjectShellInWorker(initialProject,initialSource,result.stored.record,{signal:controller.signal}))throw Error("Kalıcı kabuk kaydı güncel kaynak ve yeniden hesaplanan sonuçla eşleşmiyor; geri yüklenmedi.");
          if(active.current===controller&&!controller.signal.aborted){setRecord(result.stored.record);setSavedAt(result.stored.savedAt);}
        }
      }catch(e){if(active.current===controller&&!controller.signal.aborted)setError(e instanceof Error?e.message:"Kabuk kaydı geri yüklenemedi.");}
      finally{if(active.current===controller){active.current=null;setBusy(false);setRestoring(false);}}
    })();
    return()=>{controller.abort();if(active.current===controller)active.current=null;};
  },[]);
  useEffect(()=>()=>{active.current?.abort();active.current=null;},[]);
  const calculate=async()=>{
    const controller=new AbortController();active.current?.abort();active.current=controller;
    setBusy(true);setRestoring(false);setError("");setRecord(null);setSavedAt("");
    try{
      let storageError="";
      // Capture the deletion epoch before computation, never after a potentially concurrent clear.
      if(!session.current){try{session.current=(await readProjectShellStorage(project,source,controller.signal)).session;}
        catch(e){storageError=e instanceof Error?e.message:"depo hatası";}}
      if(controller.signal.aborted)return;
      const result=await calculateProjectShellInWorker(project,source,{signal:controller.signal});
      if(active.current!==controller||controller.signal.aborted)return;
      setRecord(result);
      try{
        if(!session.current)throw Error(storageError||"Kalıcı kabuk deposu kullanılamıyor.");
        const date=await saveProjectShellStorage(session.current,result,controller.signal);
        if(active.current===controller&&!controller.signal.aborted)setSavedAt(date);
      }catch(e){if(active.current===controller&&!controller.signal.aborted)setError("Hesap geçerli, ancak cihaza kaydedilemedi: "+(e instanceof Error?e.message:"depo hatası"));}
    }catch(e){if(active.current===controller&&!controller.signal.aborted)setError(e instanceof Error?e.message:"Proje kabuk hesabı başarısız.");}
    finally{if(active.current===controller){active.current=null;setBusy(false);}}
  };
  const content=record?.content,prepared=content?.sourceRecord.content;
  return <section data-testid="project-shell-calculation" aria-label="Proje döşemesi kabuk hesabı">
    <h3>Bağımsız döşeme kabuk hesabı</h3>
    <p>Bu hesap yalnız seçili döşemenin beyan edilen kenar mesnetleri için yapılır. Katlar ve çerçeve birlikte çözülmez; mühendislik onayı değildir.</p>
    <button disabled={busy} onClick={calculate}>Proje döşemesinin kabuk hesabını çalıştır</button>
    {busy&&<button onClick={()=>active.current?.abort()}>Proje kabuk hesabını iptal et</button>}
    <p role="status" data-testid="project-shell-calculation-status">{busy?(restoring?"Kalıcı kabuk kaydı doğrulanıyor…":"Kabuk hesabı çalışıyor…"):record?"Kaynağa bağlı kabuk hesabı oluşturuldu.":"Bu oturumda geçerli proje kabuk hesabı yok."}</p>
    {record&&<p data-testid="project-shell-storage-status">{savedAt?`Cihaza kaydedildi · ${new Date(savedAt).toLocaleString("tr-TR")}`:"Hesap yalnız bu oturumda; kalıcı kayıt tamamlanmadı."}</p>}
    {error&&<p role="alert">{error}</p>}
    {content&&prepared&&<>
      <p data-testid="project-shell-calculation-id">Hesap: {record.id}<br/>Kaynak: {content.sourceRecord.id}<br/>Proje: {prepared.source.projectId} · Revizyon: {prepared.source.revision} · Döşeme: {prepared.source.sourcePlateId}</p>
      <p>Ağ: {prepared.meshCounts.nodes} düğüm / {prepared.meshCounts.elements} eleman · Alan: {prepared.area} m²</p>
      <div style={{overflowX:"auto"}}><table><caption>Kaynağa bağlı yük durumu özetleri</caption><thead><tr><th>Durum</th><th>Alan yükü (kN/m²)</th><th>Merkez uz (m)</th><th>Maksimum |uz| (m)</th><th>Kuvvet / moment denge artığı</th></tr></thead><tbody>{content.cases.map(c=><tr key={c.id}><th scope="row">{c.id}</th><td>{c.areaLoad}</td><td>{c.centerUz.toExponential(6)}</td><td>{c.maxAbsUz.toExponential(6)}</td><td>{c.equilibrium.forceResidual.toExponential(3)} / {c.equilibrium.momentResidual.toExponential(3)}</td></tr>)}</tbody></table></div>
    </>}
    <p>Hesaplar bu cihazın tarayıcı deposunda saklanır. Yenilemede güncel proje kaynağı ve yeniden hesaplanan sonuç doğrulanır. Tarayıcı verileri silinirse kayıtlar kaybolur; bu depo bulut yedeği değildir. Mevcut proje JSON yedeği büyük hesap kayıtlarını içermez. Proje belge akışı sonraki adımda tamamlanacak.</p>
  </section>;
}
