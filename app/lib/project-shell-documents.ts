import { isPortalProject } from "./customer-portal.ts";
import { canonicalProjectShellSource, verifyProjectShellCalculation, type ProjectShellCalculationRecord } from "./project-shell-calculation.ts";
import type { ProjectShellSource } from "./project-shell-source.ts";
import { renderShellDxf, type ShellFormat } from "./shell-documents.ts";
import type { ShellRenderRecord } from "./shell-render.ts";
import type { ShellPdfAssets } from "./shell-pdf.ts";
import { validateShellView, type ShellView } from "./shell-view.ts";
import { traceJson, traceSha256 } from "./structural-traceability.ts";
import { PROJECT_SHELL_MAX_BYTES } from "./project-shell-storage.ts";

export const PROJECT_SHELL_PACKAGE_MAX_BYTES=64*1024*1024;
export function projectShellRenderRecord(record:ProjectShellCalculationRecord):ShellRenderRecord {
  const {engine,formulation,cases,sourceRecord}=record.content;
  return {id:record.id,content:{engine,formulation,cases,prepared:sourceRecord.content}};
}
export async function prepareProjectShellDocument(project:unknown,source:unknown,record:ProjectShellCalculationRecord,format:ShellFormat,view:ShellView) {
  if(!["JSON","PDF","DXF"].includes(format))throw Error("Desteklenmeyen proje kabuk belge biçimi.");
  const canonical=canonicalProjectShellSource(project,source);
  validateShellView(projectShellRenderRecord(record),view);
  if(!await verifyProjectShellCalculation(record,project,canonical))throw Error("Proje kabuk hesabı güncel kaynak ve yeniden hesaplanan sonuçla eşleşmiyor.");
  return {schema:"ARKEM-PROJECT-SHELL-DOCUMENT-MANIFEST/1.0" as const,format,
    projectId:canonical.projectId,revision:canonical.revision,coordinateReference:(project as {coordinateReference:string}).coordinateReference,sourcePlateId:canonical.sourcePlateId,
    sourceElementIds:canonical.sourceElementIds,source:canonical,provenance:canonical.provenance,
    sourceId:record.content.sourceRecord.id,sourceSha256:record.content.sourceRecord.sha256,
    calculationId:record.id,calculationSha256:record.sha256,
    elementIds:record.content.sourceRecord.content.model.elements.map(e=>e.id),view:{...view},
    scope:"independent-project-floor-plate" as const,units:record.content.formulation.units,
    sampling:"Uz: nodal / map cell mean; section: 4 raw Gauss / map mean",
    fullBuildingAnalysis:false as const,technicalApproval:false as const};
}
export type ProjectShellManifest=Awaited<ReturnType<typeof prepareProjectShellDocument>>;
async function portablePackage(project:unknown,record:ProjectShellCalculationRecord,manifest:ProjectShellManifest) {
  if(!isPortalProject(project))throw Error("Taşınabilir yedekteki proje veri paketi geçersiz.");
  if(new TextEncoder().encode(traceJson(record)).length>PROJECT_SHELL_MAX_BYTES)throw Error("Hesap kaydı 32 MiB sınırını aşıyor.");
  const snapshot=JSON.parse(traceJson(project));
  const plan=snapshot.modules["plan-editor"];
  plan.projectShellSources={...plan.projectShellSources,[manifest.sourcePlateId]:manifest.source};
  if(!isPortalProject(snapshot))throw Error("Kaynak eklenen proje anlık görüntüsü geçersiz.");
  const result={schema:"ARKEM-PROJECT-SHELL-PACKAGE/1.0" as const,project:snapshot as typeof project,
    projectSha256:await traceSha256(traceJson(snapshot)),manifest,calculation:record,
    fullBuildingAnalysis:false as const,technicalApproval:false as const};
  if(new TextEncoder().encode(JSON.stringify(result)).length>PROJECT_SHELL_PACKAGE_MAX_BYTES)throw Error("Proje kabuk paketi 64 MiB sınırını aşıyor.");
  return result;
}
export type ProjectShellPackage=Awaited<ReturnType<typeof portablePackage>>;
/** Everything is frozen before the first await, including view and raw fields. */
export async function createProjectShellArtifact(project:unknown,source:unknown,record:ProjectShellCalculationRecord,format:ShellFormat,view:ShellView,assets?:ShellPdfAssets) {
  validateShellView(projectShellRenderRecord(record),view);
  const frozen=JSON.parse(traceJson({project,source,record,view})) as {project:unknown;source:ProjectShellSource;record:ProjectShellCalculationRecord;view:ShellView};
  const manifest=await prepareProjectShellDocument(frozen.project,frozen.source,frozen.record,format,frozen.view);
  const pkg=await portablePackage(frozen.project,frozen.record,manifest);
  const banner=manifest.provenance.kind==="synthetic-project"?"SENTETİK PROJE - Bağımsız plaka; tam bina analizi ve teknik onay değildir.":"BEYAN EDİLEN PROJE - Bağımsız plaka; tam bina analizi ve teknik onay değildir.";
  const rendered=projectShellRenderRecord(frozen.record);
  const name="arkemx-proje-kabuk-"+manifest.sourcePlateId.replace(/[^a-zA-Z0-9_-]/g,"_").slice(0,60)+"-"+manifest.view.caseId+"-"+manifest.view.field+"."+format.toLowerCase();
  let bytes:string|Uint8Array;
  if(format==="JSON")bytes=JSON.stringify(pkg);
  else if(format==="DXF")bytes=renderShellDxf(manifest,rendered,banner);
  else {
    const {renderShellPdf}=await import("./shell-pdf.ts");
    bytes=await renderShellPdf(manifest,rendered,{title:"ARKEMX - Proje döşemesi kabuk sonuçları",banner,attachmentName:"arkemx-project-shell-package.json",package:JSON.stringify(pkg),
      identityLines:["Kalıcı döşeme kimliği: "+manifest.sourcePlateId,"İlişkili proje elemanları: "+manifest.sourceElementIds.join(", "),"Kaynak beyanı: "+manifest.provenance.reference,"Eleman kimliği bağlantısı fiziksel çerçeve–kabuk mesnedi anlamına gelmez."]},assets);
  }
  const sha256=await traceSha256(bytes);
  return {name,format,bytes,document:{schema:"ARKEM-PROJECT-SHELL-DOCUMENT-RECORD/1.0" as const,id:"PROJECT-SHELL-DOC-"+sha256,manifest,
    artifact:{fileName:name,sha256,byteLength:typeof bytes==="string"?new TextEncoder().encode(bytes).length:bytes.byteLength},fullBuildingAnalysis:false as const,technicalApproval:false as const}};
}
export type ProjectShellArtifact=Awaited<ReturnType<typeof createProjectShellArtifact>>;
export async function verifyProjectShellDocument(document:ProjectShellArtifact["document"],project:unknown,source:unknown,record:ProjectShellCalculationRecord,bytes:string|Uint8Array) {
  try {
    const expected=await prepareProjectShellDocument(project,source,record,document.manifest.format,document.manifest.view),sha=await traceSha256(bytes);
    return document.schema==="ARKEM-PROJECT-SHELL-DOCUMENT-RECORD/1.0"&&document.id==="PROJECT-SHELL-DOC-"+sha&&document.artifact.sha256===sha&&
      document.artifact.byteLength===(typeof bytes==="string"?new TextEncoder().encode(bytes).length:bytes.byteLength)&&
      document.fullBuildingAnalysis===false&&document.technicalApproval===false&&traceJson(expected)===traceJson(document.manifest);
  }catch{return false;}
}
/** Preflight is read-only. Callers may write only after this independent re-solve succeeds. */
export async function readProjectShellPackage(text:string,currentProject?:unknown,currentSource?:unknown):Promise<ProjectShellPackage> {
  if(typeof text!=="string"||new TextEncoder().encode(text).length>PROJECT_SHELL_PACKAGE_MAX_BYTES)throw Error("Proje kabuk yedeği 64 MiB sınırını aşıyor.");
  const pkg=JSON.parse(text) as ProjectShellPackage;
  if(!pkg||Object.keys(pkg).sort().join(",")!=="calculation,fullBuildingAnalysis,manifest,project,projectSha256,schema,technicalApproval"||
    pkg.schema!=="ARKEM-PROJECT-SHELL-PACKAGE/1.0"||pkg.fullBuildingAnalysis!==false||pkg.technicalApproval!==false||!isPortalProject(pkg.project))throw Error("Proje kabuk yedek şeması veya proje verileri geçersiz.");
  if(pkg.projectSha256!==await traceSha256(traceJson(pkg.project)))throw Error("Proje yedeğinin SHA-256 değeri eşleşmiyor.");
  if(new TextEncoder().encode(traceJson(pkg.calculation)).length>PROJECT_SHELL_MAX_BYTES)throw Error("Hesap kaydı 32 MiB sınırını aşıyor.");
  const manifest=await prepareProjectShellDocument(pkg.project,pkg.manifest.source,pkg.calculation,pkg.manifest.format,pkg.manifest.view);
  if(traceJson(manifest)!==traceJson(pkg.manifest))throw Error("Yedek belge–proje–döşeme bağlantısı eşleşmiyor.");
  if(currentProject!==undefined||currentSource!==undefined) {
    const active=canonicalProjectShellSource(currentProject,currentSource);
    if(traceJson(active)!==traceJson(manifest.source))throw Error("Yedek güncel proje, revizyon veya seçili döşeme kaynağına ait değil. Önce paketin proje JSON'unu proje merkezinden açın.");
    // Source validation against the live project rejects changed coordination and geometry.
  }
  return pkg;
}
