import { validateProjectShellSource } from "./project-shell-source.ts";
import type { ProjectShellCalculationRecord } from "./project-shell-calculation.ts";
import { runShellWorker } from "./shell-worker-client.ts";
import type { ProjectShellArtifact, ProjectShellPackage } from "./project-shell-documents.ts";
import type { ShellFormat } from "./shell-documents.ts";
import type { ShellView } from "./shell-view.ts";
export function exportProjectShellInWorker(project:unknown,source:unknown,record:ProjectShellCalculationRecord,format:ShellFormat,view:ShellView,options:{signal?:AbortSignal;timeoutMs?:number}={}):Promise<ProjectShellArtifact> {
  validateProjectShellSource(project,source);
  return runShellWorker({operation:"project-export",project,source,record,format,view},"artifact",options);
}
export function readProjectShellPackageInWorker(text:string,options:{signal?:AbortSignal;timeoutMs?:number;project?:unknown;source?:unknown}={}):Promise<ProjectShellPackage> {
  return runShellWorker({operation:"project-package",text,project:options.project,source:options.source},"record",options);
}

export function calculateProjectShellInWorker(project:unknown,source:unknown,options:{signal?:AbortSignal;drillingFactor?:number;timeoutMs?:number}={}):Promise<ProjectShellCalculationRecord> {
  validateProjectShellSource(project,source);
  return runShellWorker({operation:"project-calculate",project,source,drillingFactor:options.drillingFactor??1},"record",options);
}

export function verifyProjectShellInWorker(project:unknown,source:unknown,record:unknown,options:{signal?:AbortSignal;timeoutMs?:number}={}):Promise<boolean> {
  validateProjectShellSource(project,source);
  return runShellWorker({operation:"project-verify",project,source,record},"record",options);
}
