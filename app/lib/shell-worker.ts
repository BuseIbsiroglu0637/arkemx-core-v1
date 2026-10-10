/// <reference lib="webworker" />
import { recordShellCalculation } from "./shell-solver.ts";
declare const self: DedicatedWorkerGlobalScope;
self.onmessage=async (event:MessageEvent) => {
  try {
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
