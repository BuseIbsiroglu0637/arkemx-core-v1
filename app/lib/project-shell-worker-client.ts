import { validateProjectShellSource } from "./project-shell-source.ts";
import type { ProjectShellCalculationRecord } from "./project-shell-calculation.ts";
import { runShellWorker } from "./shell-worker-client.ts";

export function calculateProjectShellInWorker(project:unknown,source:unknown,options:{signal?:AbortSignal;drillingFactor?:number;timeoutMs?:number}={}):Promise<ProjectShellCalculationRecord> {
  validateProjectShellSource(project,source);
  return runShellWorker({operation:"project-calculate",project,source,drillingFactor:options.drillingFactor??1},"record",options);
}
