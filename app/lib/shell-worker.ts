/// <reference lib="webworker" />
import { recordShellCalculation } from "./shell-solver.ts";
declare const self: DedicatedWorkerGlobalScope;
self.onmessage=async (event:MessageEvent) => {
  try {
    if(event.data.operation==="project-export") {
      const {createProjectShellArtifact}=await import("./project-shell-documents.ts");
      const artifact=await createProjectShellArtifact(event.data.project,event.data.source,event.data.record,event.data.format,event.data.view);
      self.postMessage({ok:true,artifact});return;
    }
    if(event.data.operation==="project-package") {
      const {readProjectShellPackage}=await import("./project-shell-documents.ts");
      const record=await readProjectShellPackage(event.data.text,event.data.project,event.data.source);
      self.postMessage({ok:true,record});return;
    }
    if(event.data.operation==="project-verify") {
      const {verifyProjectShellCalculation}=await import("./project-shell-calculation.ts");
      const record=await verifyProjectShellCalculation(event.data.record,event.data.project,event.data.source);
      self.postMessage({ok:true,record});return;
    }
    if(event.data.operation==="project-calculate") {
      const {recordProjectShellCalculation}=await import("./project-shell-calculation.ts");
      const record=await recordProjectShellCalculation(event.data.project,event.data.source,{drillingFactor:event.data.drillingFactor??1});
      self.postMessage({ok:true,record});return;
    }
    if(event.data.operation==="export") {
      const {createShellArtifact}=await import("./shell-documents.ts");
      const artifact=await createShellArtifact(event.data.source,event.data.record,event.data.format,event.data.view);
      self.postMessage({ok:true,artifact});return;
    }
    const record=await recordShellCalculation(event.data.source,event.data.drillingFactor??1);
    self.postMessage({ok:true,record});
  } catch(error) {
    self.postMessage({ok:false,error:error instanceof Error?error.message:"Kabuk çözümü başarısız."});
  }
};
