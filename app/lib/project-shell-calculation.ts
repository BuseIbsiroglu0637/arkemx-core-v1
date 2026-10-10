import { validateProjectShellSource, type ProjectShellSource } from "./project-shell-source.ts";
import { prepareRectangularShellModel, rectangularShellPhysical } from "./shell-source.ts";
import { solveRectangularShell } from "./shell-solver.ts";
import { traceJson, traceSha256 } from "./structural-traceability.ts";

export function canonicalProjectShellSource(project:unknown,value:unknown):ProjectShellSource {
  validateProjectShellSource(project,value);
  const source=JSON.parse(traceJson(value)) as ProjectShellSource;
  source.sourceElementIds.sort();
  return source;
}
export function prepareProjectShellSource(project:unknown,value:unknown) {
  const source=canonicalProjectShellSource(project,value);
  return {schema:"ARKEM-PROJECT-SHELL-PREPARED-SOURCE/1.0" as const,source,
    scope:"independent-project-floor-plate" as const,
    ...prepareRectangularShellModel(rectangularShellPhysical(source))};
}
export async function recordProjectShellSource(project:unknown,value:unknown) {
  const content=prepareProjectShellSource(project,value),sha256=await traceSha256(traceJson(content));
  return {schema:"ARKEM-PROJECT-SHELL-SOURCE-RECORD/1.0" as const,id:"PROJECT-SHELL-SOURCE-"+sha256,sha256,content};
}
export type ProjectShellSourceRecord=Awaited<ReturnType<typeof recordProjectShellSource>>;
export async function verifyProjectShellSource(record:ProjectShellSourceRecord,project:unknown,source:unknown) {
  try {
    const actual=await recordProjectShellSource(project,source),sha=await traceSha256(traceJson(record.content));
    return record.schema===actual.schema&&record.id===actual.id&&record.sha256===sha&&sha===actual.sha256;
  }catch{return false;}
}

export async function recordProjectShellCalculation(project:unknown,value:unknown,options:{drillingFactor?:number;signal?:AbortSignal}={}) {
  // Freeze the authorized source before the first await; callers may subsequently edit their draft.
  const source=canonicalProjectShellSource(project,value);
  const sourceRecord=await recordProjectShellSource(project,source);
  const {diagnostics,status,...numerical}=solveRectangularShell(rectangularShellPhysical(source),options);
  void status;
  const {elapsedMs,...deterministicDiagnostics}=diagnostics;
  const content={schema:"ARKEM-PROJECT-SHELL-CALCULATION/1.0" as const,sourceRecord,...numerical,
    diagnostics:deterministicDiagnostics,status:"solved-independent-project-plate" as const};
  const sha256=await traceSha256(traceJson(content));
  if(options.signal?.aborted)throw Error("Proje kabuk çözümü iptal edildi.");
  return {schema:"ARKEM-PROJECT-SHELL-CALCULATION-RECORD/1.0" as const,id:"PROJECT-SHELL-CALC-"+sha256,sha256,content,elapsedMs};
}
export type ProjectShellCalculationRecord=Awaited<ReturnType<typeof recordProjectShellCalculation>>;

/** Hash alone is insufficient: rerun the current declared source to reject rehashed fabricated fields. */
export async function verifyProjectShellCalculation(record:ProjectShellCalculationRecord,project:unknown,source:unknown) {
  try {
    const sha=await traceSha256(traceJson(record.content));
    if(record.schema!=="ARKEM-PROJECT-SHELL-CALCULATION-RECORD/1.0"||record.id!=="PROJECT-SHELL-CALC-"+sha||record.sha256!==sha)return false;
    const current=await recordProjectShellCalculation(project,source,{drillingFactor:record.content.formulation.drillingFactor});
    return current.sha256===sha;
  }catch{return false;}
}
