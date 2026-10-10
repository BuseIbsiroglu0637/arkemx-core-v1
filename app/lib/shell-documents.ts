import { verifyShellCalculation, type ShellCalculationRecord } from "./shell-solver.ts";
import { prepareShellSource, type ShellSource } from "./shell-source.ts";
import { traceJson, traceSha256 } from "./structural-traceability.ts";
import { shellCase, validateShellView, type ShellView, type ShellField, SHELL_FIELDS } from "./shell-view.ts";
import type { ShellPdfAssets } from "./shell-pdf.ts";
export type ShellFormat="JSON"|"PDF"|"DXF";
export async function prepareShellDocument(source:ShellSource,record:ShellCalculationRecord,format:ShellFormat,view:ShellView){
 if(!["JSON","PDF","DXF"].includes(format))throw Error("Desteklenmeyen kabuk belge biçimi.");
 validateShellView(record,view);
 if(!await verifyShellCalculation(record,source))throw Error("Kabuk hesabı güncel kaynakla eşleşmiyor; yeniden çözün.");
 const prepared=prepareShellSource(source);
 return {schema:"ARKEM-SHELL-DOCUMENT-MANIFEST/1.0" as const,format,projectId:source.projectId,revision:source.revision,
 sourceSha256:await traceSha256(traceJson(prepared)),source:prepared.source,calculationId:record.id,calculationSha256:record.sha256,
 elementIds:prepared.model.elements.map(e=>e.id),view:{...view},scope:"independent-synthetic-rectangular-shell" as const,
 sampling:"Uz: nodal / map cell mean; section: 4 raw Gauss / map mean",analysisStatus:record.content.status,
 units:record.content.formulation.units,fullBuildingAnalysis:false as const,technicalApproval:false as const};
}
export type ShellManifest=Awaited<ReturnType<typeof prepareShellDocument>>;
export function shellPackage(manifest:ShellManifest,record:ShellCalculationRecord){
 if(manifest.calculationId!==record.id||manifest.calculationSha256!==record.sha256)throw Error("Belge hesap bağlantısı eşleşmiyor.");
 return {schema:"ARKEM-SHELL-PACKAGE/1.0",manifest,calculation:record,technicalApproval:false,fullBuildingAnalysis:false};
}
export async function sealShellDocument(manifest:ShellManifest,fileName:string,bytes:string|Uint8Array){
 const sha256=await traceSha256(bytes);
 return {schema:"ARKEM-SHELL-DOCUMENT-RECORD/1.0" as const,id:"SHELL-DOC-"+sha256,manifest,
 artifact:{fileName,sha256,byteLength:typeof bytes==="string"?new TextEncoder().encode(bytes).length:bytes.byteLength},fullBuildingAnalysis:false as const,technicalApproval:false as const};
}
export type ShellDocumentRecord=Awaited<ReturnType<typeof sealShellDocument>>;
export async function verifyShellDocument(doc:ShellDocumentRecord,source:ShellSource,record:ShellCalculationRecord,bytes:string|Uint8Array){
 try{
  const expected=await prepareShellDocument(source,record,doc.manifest.format,doc.manifest.view),sha=await traceSha256(bytes),size=typeof bytes==="string"?new TextEncoder().encode(bytes).length:bytes.byteLength;
  return doc.schema==="ARKEM-SHELL-DOCUMENT-RECORD/1.0"&&doc.fullBuildingAnalysis===false&&doc.technicalApproval===false&&traceJson(expected)===traceJson(doc.manifest)&&
    doc.id==="SHELL-DOC-"+sha&&doc.artifact.sha256===sha&&doc.artifact.byteLength===size;
 }catch{return false;}
}
export function shellDxf(manifest:ShellManifest,record:ShellCalculationRecord){
 const c=shellCase(record,manifest.view),model=record.content.prepared.model,byId=new Map(model.nodes.map((n,i)=>[n.id,{...n,index:i}]));
 const lines:string[]=["999","ARKEMX_SHELL_TRACE_BEGIN"];
 // Split on code points with a UTF-8 byte bound, preserving Unicode identifiers.
 const meta=JSON.stringify(manifest),encoder=new TextEncoder();let chunk="",size=0;
 for(const character of meta){const bytes=encoder.encode(character).length;if(size+bytes>220){lines.push("999",chunk);chunk="";size=0;}chunk+=character;size+=bytes;}
 if(chunk)lines.push("999",chunk);
 lines.push("999","ARKEMX_SHELL_TRACE_END","0","SECTION","2","HEADER","9","$ACADVER","1","AC1021","9","$INSUNITS","70","6","9","$DWGCODEPAGE","3","UTF-8","0","ENDSEC","0","SECTION","2","TABLES");
 const layers=["SOURCE_MESH","DEFORMED_MESH","SUPPORTS","RAW_RESULTS","LABELS"];
 lines.push("0","TABLE","2","LAYER","70",String(layers.length));layers.forEach((l,i)=>lines.push("0","LAYER","2",l,"70","0","62",String(i+1),"6","CONTINUOUS"));lines.push("0","ENDTAB","0","ENDSEC","0","SECTION","2","ENTITIES");
 const number=(v:number)=>{if(!Number.isFinite(v))throw Error("DXF koordinatı geçersiz.");return v.toFixed(10);};
 const point=(x:number,y:number,z:number,k=0)=>lines.push(String(10+k),number(x),String(20+k),number(y),String(30+k),number(z));
 const text=(x:number,y:number,z:number,label:string)=>{lines.push("0","TEXT","8","LABELS");point(x,y,z);lines.push("40","0.12","1",label.replace(/[\r\n\t]+/g," ").slice(0,200));};
 model.elements.forEach((e,i)=>{
  for(const deformed of [false,true]){
   lines.push("0","3DFACE","8",deformed?"DEFORMED_MESH":"SOURCE_MESH");
   e.nodeIds.forEach((id,k)=>{const n=byId.get(id)!,u=c.nodes[n.index].displacements;const f=deformed?manifest.view.magnification:0;point(n.x+u[0]*f,n.y+u[1]*f,n.z+u[2]*f,k);});
  }
  const a=byId.get(e.nodeIds[0])!,b=byId.get(e.nodeIds[2])!;
  if(manifest.view.field!=="Uz")c.elements[i].points.forEach((p,g)=>{
   const x=a.x+(b.x-a.x)*(p.xi+1)/2,y=a.y+(b.y-a.y)*(p.eta+1)/2,v=p.resultants[SHELL_FIELDS.indexOf(manifest.view.field)-1];
   lines.push("0","POINT","8","RAW_RESULTS");point(x,y,a.z);text(x,y,a.z,e.id+" GP"+(g+1)+" "+manifest.view.field+"="+v.toExponential(5));
  });
 });
 if(manifest.view.field==="Uz")model.nodes.forEach((n,i)=>{lines.push("0","POINT","8","RAW_RESULTS");point(n.x,n.y,n.z);text(n.x,n.y,n.z,n.id+" Uz="+c.nodes[i].displacements[2].toExponential(5));});
 model.supports.forEach(s=>{const n=byId.get(s.nodeId)!;lines.push("0","POINT","8","SUPPORTS");point(n.x,n.y,n.z);text(n.x,n.y,n.z,s.nodeId+" fixed="+s.fixed.map(Number).join(""));});
 const p=manifest.source.plate;
 text(p.origin[0],p.origin[1]-.5,p.origin[2],"SYNTHETIC / NO TECHNICAL APPROVAL / CASE "+manifest.view.caseId+" / FIELD "+manifest.view.field+" / DEFORMATION x"+manifest.view.magnification);
 lines.push("0","ENDSEC","0","EOF");return lines.join("\r\n")+"\r\n";
}
export async function createShellArtifact(source:ShellSource,record:ShellCalculationRecord,format:ShellFormat,view:ShellView,assets?:ShellPdfAssets){
 const manifest=await prepareShellDocument(source,record,format,view),name="arkemx-ornek-kabuk-"+source.plate.id.replace(/[^a-zA-Z0-9_-]/g,"_").slice(0,60)+"-"+view.caseId+"-"+view.field+"."+format.toLowerCase();
 let bytes:string|Uint8Array;
 if(format==="JSON")bytes=JSON.stringify(shellPackage(manifest,record));
 else if(format==="DXF")bytes=shellDxf(manifest,record);
 else {const {shellPdf}=await import("./shell-pdf.ts");bytes=await shellPdf(manifest,record,assets);}
 return {name,format,bytes,document:await sealShellDocument(manifest,name,bytes)};
}
export type ShellArtifact=Awaited<ReturnType<typeof createShellArtifact>>;
export type {ShellView,ShellField};
