import { inspectFloorCoordination, floorCoordinationBasis } from "./floor-coordination.ts";
import { inspectFloorFrame, verifyFloorFrame, type recordFloorFrame } from "./floor-frame.ts";
import { traceJson, traceSha256 } from "./structural-traceability.ts";
import { createDocumentIdentity } from "./document-identity.ts";
import { projectIntegrityIssues } from "./project-integrity.ts";
import { type StructuralConceptInput } from "./engineering.ts";
type Data=Record<string,unknown>;
const data=(v:unknown):Data=>v&&typeof v==="object"&&!Array.isArray(v)?v as Data:{};
export type FrameRecord=Awaited<ReturnType<typeof recordFloorFrame>>;
export function frameSourceKey(project:unknown){const p=data(project),plan=data(data(p.modules)["plan-editor"]);return traceJson({id:p.id,revision:p.revision,basis:floorCoordinationBasis(plan),coordination:plan.floorCoordination??null,frame:plan.floorFrame??null});}
export async function prepareFrameDocument(project:unknown,input:StructuralConceptInput|undefined,record:FrameRecord|null,format:"PDF"|"DXF"|"JSON"){
  const p=data(project),plan=data(data(p.modules)["plan-editor"]),coordination=inspectFloorCoordination(plan),frame=inspectFloorFrame(plan);
  if(!coordination.geometry||projectIntegrityIssues(project).some(i=>i.startsWith("plan-editor:")))throw Error("Ortak çizim için güncel ve geçerli plan kaynağı gerekiyor.");
  if(record&&(!input||!await verifyFloorFrame(record,project,input)))throw Error("Çözüm güncel kaynakla eşleşmiyor.");
  const content={schema:"ARKEM-COMMON-FRAME-PACKAGE/1.0",projectId:p.id,revision:p.revision,sourceKey:frameSourceKey(project),coordination,frameDeclaration:frame,calculation:record,fullBuildingAnalysis:false,technicalApproval:false};
  const sha256=await traceSha256(traceJson(content)),sourceId=`COORD-${sha256}`,elementIds=(Array.isArray(plan.elements)?plan.elements:[]).map(e=>String(data(e).id));
  const calculationIds=record?[record.id]:[],bindings=record?[{id:record.id,projectId:String(p.id),revision:String(p.revision),elementIds}]:[];
  const identityInput={projectCode:String(p.id),revision:String(p.revision),module:"COMMON-FRAME",sheetNo:`COMMON-${format}`,sourceRevision:String(p.revision),elementIds,calculationIds,contentDigest:sha256,coordinateSystem:"PROJE ORTAK X/Y/Z / m",sourceContext:{projectId:String(p.id),revision:String(p.revision),elementIds,calculationIds,calculationBindings:bindings}};
  return {schema:"ARKEM-COMMON-FRAME-DOCUMENT/1.0",format,sourceId,sourceSha256:sha256,sourceKey:content.sourceKey,calculationId:record?.id??null,scope:record?"linear-frame-study":"geometry-only",identityInput,identity:createDocumentIdentity(identityInput),content,fullBuildingAnalysis:false,technicalApproval:false};
}
export type FrameManifest=Awaited<ReturnType<typeof prepareFrameDocument>>;
export async function sealFrameDocument(manifest:FrameManifest,fileName:string,bytes:string|Uint8Array){const sha256=await traceSha256(bytes);return {schema:"ARKEM-COMMON-FRAME-DOCUMENT-RECORD/1.0",id:`FRAME-DOC-${sha256}`,manifest,artifact:{fileName,sha256,byteLength:typeof bytes==="string"?new TextEncoder().encode(bytes).length:bytes.byteLength},fullBuildingAnalysis:false,technicalApproval:false};}
export async function verifyFrameDocument(document:Awaited<ReturnType<typeof sealFrameDocument>>,project:unknown,input:StructuralConceptInput|undefined,registry:Record<string,FrameRecord>,bytes:string|Uint8Array){try{
  const record=document.manifest.calculationId?registry[document.manifest.calculationId]:null;
  if(document.manifest.calculationId&&!record)return false;
  const expected=await prepareFrameDocument(project,input,record??null,document.manifest.format),sha=await traceSha256(bytes);
  return document.schema==="ARKEM-COMMON-FRAME-DOCUMENT-RECORD/1.0"&&document.fullBuildingAnalysis===false&&document.technicalApproval===false&&traceJson(expected)===traceJson(document.manifest)&&document.id===`FRAME-DOC-${sha}`&&document.artifact.sha256===sha&&document.artifact.byteLength===(typeof bytes==="string"?new TextEncoder().encode(bytes).length:bytes.byteLength);
}catch{return false;}}
export function commonFrameDxf(manifest:FrameManifest){
  const g=manifest.content.coordination.geometry!;
  const entities:string[]=[];
  const n=(v:number)=>{if(!Number.isFinite(v))throw Error("Çizim koordinatı sonlu değil.");return v.toFixed(8);};
  const point=(p:{x:number;y:number;z:number})=>`10\n${n(p.x)}\n20\n${n(p.y)}\n30\n${n(p.z)}\n`;
  for(const f of g.floors){entities.push(`0\nPOLYLINE\n8\nFLOOR_K${f.level}\n66\n1\n70\n9\n10\n0\n20\n0\n30\n0\n`);for(const p of [{x:f.x,y:f.y,z:f.z},{x:f.x+f.width,y:f.y,z:f.z},{x:f.x+f.width,y:f.y+f.depth,z:f.z},{x:f.x,y:f.y+f.depth,z:f.z}])entities.push(`0\nVERTEX\n8\nFLOOR_K${f.level}\n70\n32\n${point(p)}`);entities.push("0\nSEQEND\n");}
  const model=manifest.content.calculation?.content.model??manifest.content.frameDeclaration.model;
  if(model)for(const m of model.members){const a=model.nodes.find(n=>n.id===m.start)!,b=model.nodes.find(n=>n.id===m.end)!;entities.push(`0\nLINE\n8\n${m.kind==="column"?"COLUMNS":"BEAMS"}\n${point(a)}11\n${n(b.x)}\n21\n${n(b.y)}\n31\n${n(b.z)}\n`);}
  else for(const b of g.beams)entities.push(`0\nLINE\n8\nBEAMS\n${point(b.start)}11\n${n(b.end.x)}\n21\n${n(b.end.y)}\n31\n${n(b.end.z)}\n`);
  const layers=[...g.floors.map(f=>`FLOOR_K${f.level}`),"COLUMNS","BEAMS"];
  const table=layers.map((layer,i)=>`0\nLAYER\n2\n${layer}\n70\n0\n62\n${i%7+1}\n6\nCONTINUOUS\n`).join("");
  return `999\nARKEMX_TRACEABILITY ${JSON.stringify(manifest)}\n0\nSECTION\n2\nHEADER\n9\n$ACADVER\n1\nAC1015\n9\n$INSUNITS\n70\n6\n0\nENDSEC\n0\nSECTION\n2\nTABLES\n0\nTABLE\n2\nLAYER\n70\n${layers.length}\n${table}0\nENDTAB\n0\nENDSEC\n0\nSECTION\n2\nENTITIES\n${entities.join("")}0\nENDSEC\n0\nEOF\n`.replace(/\n/g,"\r\n");
}
