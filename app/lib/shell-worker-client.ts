import { validateShellSource, type ShellSource } from "./shell-source.ts";
import type { ShellCalculationRecord } from "./shell-solver.ts";
import type {ShellArtifact,ShellFormat} from "./shell-documents.ts";
import type {ShellView} from "./shell-view.ts";

/** Dedicated disposable worker keeps the UI responsive; cancellation terminates the calculation. */
export function calculateShellInWorker(source:ShellSource,options:{signal?:AbortSignal;drillingFactor?:number;timeoutMs?:number}={}):Promise<ShellCalculationRecord> {
  validateShellSource(source);
  return runShellWorker({source,drillingFactor:options.drillingFactor??1},"record",options);
}
export function exportShellInWorker(source:ShellSource,record:ShellCalculationRecord,format:ShellFormat,view:ShellView,options:{signal?:AbortSignal;timeoutMs?:number}={}):Promise<ShellArtifact>{
  validateShellSource(source);
  return runShellWorker({operation:"export",source,record,format,view},"artifact",options);
}
export function runShellWorker<T>(payload:unknown,resultKey:"record"|"artifact",options:{signal?:AbortSignal;timeoutMs?:number}):Promise<T>{
  const timeout=options.timeoutMs??30000;
  if(!Number.isFinite(timeout)||timeout<100||timeout>60000)throw Error("Kabuk worker zaman sınırı 100–60000 ms olmalı.");
  if(options.signal?.aborted)return Promise.reject(new DOMException("Kabuk çözümü iptal edildi.","AbortError"));
  return new Promise((resolve,reject)=>{
    const worker=new Worker(new URL("./shell-worker.ts",import.meta.url),{type:"module"});
    const cleanup=()=>{clearTimeout(timer);options.signal?.removeEventListener("abort",abort);worker.terminate();};
    const fail=(error:Error)=>{cleanup();reject(error);};
    const abort=()=>fail(new DOMException("Kabuk çözümü iptal edildi.","AbortError"));
    const timer=setTimeout(()=>fail(new Error("Kabuk çözümü zaman sınırını aştı; doğrulanmış sonuç yok.")),timeout);
    options.signal?.addEventListener("abort",abort,{once:true});
    worker.onerror=event=>fail(new Error(event.message||"Kabuk worker hatası."));
    worker.onmessageerror=()=>fail(new Error("Kabuk worker sonucu okunamadı."));
    worker.onmessage=event=>{cleanup();if(event.data.ok)resolve(event.data[resultKey]);else reject(new Error(event.data.error));};
    try {worker.postMessage(payload);}catch(error){fail(error instanceof Error?error:new Error("Kabuk kaynağı gönderilemedi."));}
  });
}
