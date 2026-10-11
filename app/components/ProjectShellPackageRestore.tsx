"use client";
import {useEffect,useRef,useState} from "react";
import {useProjectKernel} from "./ProjectKernel";
import {PROJECT_SHELL_PACKAGE_MAX_BYTES,type ProjectShellPackage} from "../lib/project-shell-documents";
import {readProjectShellPackageInWorker} from "../lib/project-shell-worker-client";
import {readProjectShellStorage,saveProjectShellStorage} from "../lib/project-shell-storage";
import {downloadTextFile} from "../lib/engineering";
export function ProjectShellPackageRestore() {
  const {project,importProject}=useProjectKernel();
  const [preview,setPreview]=useState<{text:string;pkg:ProjectShellPackage}|null>(null),[busy,setBusy]=useState(false),[message,setMessage]=useState("");
  const active=useRef<AbortController|null>(null);
  useEffect(()=>()=>{active.current?.abort();active.current=null;},[]);
  const inspect=async(file?:File)=>{
    active.current?.abort();const controller=new AbortController();active.current=controller;setPreview(null);setMessage("");setBusy(true);
    try {
      if(!file)return;
      if(file.size>PROJECT_SHELL_PACKAGE_MAX_BYTES)throw Error("Proje kabuk yedeği 64 MiB sınırını aşıyor.");
      const text=await file.text();if(controller.signal.aborted)return;
      const pkg=await readProjectShellPackageInWorker(text,{signal:controller.signal});
      if(active.current===controller&&!controller.signal.aborted){setPreview({text,pkg});setMessage("Paket ve hesap yeniden çözülerek doğrulandı. Açık proje henüz değiştirilmedi.");}
    }catch(e){if(active.current===controller&&!controller.signal.aborted)setMessage(e instanceof Error?e.message:"Yedek okunamadı.");}
    finally{if(active.current===controller){active.current=null;setBusy(false);}}
  };
  const restore=async()=>{
    if(!preview)return;
    const controller=new AbortController();active.current?.abort();active.current=controller;setBusy(true);setMessage("");
    try {
      // Capture deletion epoch before re-solving; concurrent deletion rejects the write.
      const {session}=await readProjectShellStorage(preview.pkg.project,preview.pkg.manifest.source,controller.signal);
      const pkg=await readProjectShellPackageInWorker(preview.text,{signal:controller.signal});
      if(active.current!==controller||controller.signal.aborted)return;
      await saveProjectShellStorage(session,pkg.calculation,controller.signal);
      if(active.current!==controller||controller.signal.aborted)return;
      if(!importProject(pkg.project))throw Error("Hesap cihaza kaydedildi, ancak proje açılamadı; önceki açık proje korundu.");
      setPreview(null);setMessage("Paketin projesi açıldı ve seçili döşemenin doğrulanmış hesabı cihaza kaydedildi. Döşemeyi seçerek sonuçları açın.");
    }catch(e){if(active.current===controller&&!controller.signal.aborted)setMessage(e instanceof Error?e.message:"Yedek geri yüklenemedi.");}
    finally{if(active.current===controller){active.current=null;setBusy(false);}}
  };
  return <section data-testid="project-shell-package-restore" aria-label="Taşınabilir proje kabuk yedeği">
    <h3>Proje ve kabuk hesabı yedeğini aç</h3>
    <label>Proje kabuk yedeği<input aria-label="Proje kabuk yedeği" type="file" accept=".json,application/json" disabled={busy} onChange={e=>{void inspect(e.target.files?.[0]);e.target.value="";}}/></label>
    {preview&&<><p data-testid="project-shell-package-preview">Proje: {preview.pkg.manifest.projectId} · {preview.pkg.manifest.revision} · Döşeme: {preview.pkg.manifest.sourcePlateId}<br/>Hesap: {preview.pkg.calculation.id}</p>
      <p>Paketin projesini açmak mevcut açık proje anlık görüntüsünü değiştirir. Önce mevcut proje JSON’unu indirin. Paket yalnız bir döşemenin hesabını taşır.</p>
      <button disabled={busy} onClick={()=>downloadTextFile("arkemx-mevcut-proje.json",JSON.stringify(project,null,2),"application/json")}>Mevcut proje JSON yedeğini indir</button>
      <button disabled={busy} onClick={()=>void restore()}>Paketin projesini ve hesabını aç</button></>}
    {busy&&<button onClick={()=>{active.current?.abort();active.current=null;setBusy(false);setPreview(null);setMessage("Geri yükleme iptal edildi.");}}>Proje kabuk yedeğini iptal et</button>}
    <p role="status" data-testid="project-shell-package-status">{busy?"Yedek hesap doğrulanıyor…":message}</p>
  </section>;
}
