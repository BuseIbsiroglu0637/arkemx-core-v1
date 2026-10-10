/// <reference lib="webworker" />
import { recordShellCalculation } from "./shell-solver.ts";
declare const self: DedicatedWorkerGlobalScope;
self.onmessage=async (event:MessageEvent) => {
  try {
    const record=await recordShellCalculation(event.data.source,event.data.drillingFactor??1);
    self.postMessage({ok:true,record});
  } catch(error) {
    self.postMessage({ok:false,error:error instanceof Error?error.message:"Kabuk çözümü başarısız."});
  }
};
