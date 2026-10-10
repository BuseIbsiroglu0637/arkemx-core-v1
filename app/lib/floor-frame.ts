import { inspectFloorCoordination, floorCoordinationBasis } from "./floor-coordination.ts";
import { calculateFloorPlateStudy } from "./floor-plate-study.ts";
import { type StructuralConceptInput } from "./engineering.ts";
import { type FrameModel, type FrameCase, validateFrameModel, solveLinearFrame, frameSelfWeightLoads } from "./linear-frame.ts";
import { traceJson, traceSha256 } from "./structural-traceability.ts";

type Data=Record<string,unknown>;
const data=(v:unknown):Data=>v&&typeof v==="object"&&!Array.isArray(v)?v as Data:{};
export type FloorFrameSource={schema:"ARKEM-FLOOR-FRAME-SOURCE/1.0";basis:string;model:FrameModel;floorShares:Array<{level:number;nodeId:string;fraction:number}>;selfWeight?:boolean};
export function floorFrameBasis(value:unknown){const plan=data(value);return traceJson({plan:floorCoordinationBasis(plan),coordination:plan.floorCoordination??null,...(plan.example===undefined?{}:{example:plan.example})});}
export function frameDraft(value:unknown){
  const plan=data(value),g=inspectFloorCoordination(plan).geometry;
  if(!g)throw Error("Güncel ortak kat koordinatları gerekiyor.");
  return {
    schema:"ARKEM-FLOOR-FRAME-SOURCE/1.0",basis:floorFrameBasis(plan),
    model:{
      nodes:g.columns.flatMap(c=>[{id:c.id+":TOP",x:c.x,y:c.y,z:c.z},{id:c.id+":BASE",x:c.x,y:c.y,z:null}]),
      materials:[{id:"M1",name:"",E:null,G:null}],sections:[{id:"S1",name:"",A:null,Iy:null,Iz:null,J:null}],
      members:[...g.columns.map(c=>({id:"MEM-"+c.id,sourceId:c.id,kind:"column",start:c.id+":BASE",end:c.id+":TOP",materialId:"M1",sectionId:"S1",localZ:[0,1,0]})),...g.beams.map(b=>({id:"MEM-"+b.id,sourceId:b.id,kind:"beam",start:b.start.id+":TOP",end:b.end.id+":TOP",materialId:"M1",sectionId:"S1",localZ:[0,0,1]}))],
      supports:[],cases:[],
    },floorShares:g.floors.map(f=>({level:f.level,nodeId:"",fraction:null})),
  };
}
export function inspectFloorFrame(value:unknown){
  const plan=data(value),source=data(plan.floorFrame),g=inspectFloorCoordination(plan).geometry;
  try{
    if(!g)throw Error("Güncel ortak kat koordinatları gerekiyor.");
    if(source.schema!=="ARKEM-FLOOR-FRAME-SOURCE/1.0"||source.basis!==floorFrameBasis(plan))throw Error("3B eleman kaydı yok veya kaynak değişti; kot/kesit/malzeme ve bağlantılar yeniden doğrulanmalı.");
    const model=JSON.parse(traceJson(source.model)) as FrameModel;
    if(!model||!Array.isArray(model.cases))throw Error("Ek yük durumları açık bir cases dizisi olmalı; durum yoksa boş dizi kullanın.");
    // Gravity load cases are generated only from explicit floor shares below.
    validateFrameModel({...model,cases:model.cases?.length?model.cases:[{id:"VALIDATION",loads:[{nodeId:model.nodes?.[0]?.id,values:[0,0,0,0,0,0]}]}]});
    const sourceIds=[...g.columns.map(c=>c.id),...g.beams.map(b=>b.id)];
    if(new Set(model.members.map(m=>m.sourceId)).size!==sourceIds.length||model.members.some(m=>!sourceIds.includes(m.sourceId))||g.columns.some(c=>model.members.filter(m=>m.sourceId===c.id).length!==1))throw Error("Her kaynak kolon bir kez, her kiriş kesintisiz segmentlerle modele bağlanmalı; kaynaksız eleman eklenemez.");
    const near=(node:{x:number;y:number;z:number},point:{x:number;y:number;z:number})=>Math.hypot(node.x-point.x,node.y-point.y,node.z-point.z)<=1e-8;
    for(const member of model.members){
      const start=model.nodes.find(n=>n.id===member.start)!,end=model.nodes.find(n=>n.id===member.end)!;
      const c=g.columns.find(c=>c.id===member.sourceId),b=g.beams.find(b=>b.id===member.sourceId);
      if(c){if(member.kind!=="column"||!near(end,c)||Math.hypot(start.x-c.x,start.y-c.y)>1e-8||start.z>=end.z)throw Error(`${member.sourceId}: kolon bitiş kotu kaynak kat kotuna, başlangıç aynı X/Y’de alt kota bağlanmalı.`);}
      else if(b){if(member.kind!=="beam")throw Error(`${member.sourceId}: kaynak kiriş eleman türüyle eşleşmiyor.`);}
    }
    for(const beam of g.beams){
      const dx=beam.end.x-beam.start.x,dy=beam.end.y-beam.start.y,length2=dx*dx+dy*dy;
      const position=(id:string)=>{const n=model.nodes.find(n=>n.id===id)!;const t=((n.x-beam.start.x)*dx+(n.y-beam.start.y)*dy)/length2;if(t < -1e-8||t > 1+1e-8||!near(n,{x:beam.start.x+t*dx,y:beam.start.y+t*dy,z:beam.start.z}))throw Error(`${beam.id}: kiriş segmenti kaynak doğrultusu veya kotu dışında.`);return t;};
      const intervals=model.members.filter(m=>m.sourceId===beam.id).map(m=>{const a=position(m.start),b=position(m.end);return a<b?{a,b,start:m.start,end:m.end}:{a:b,b:a,start:m.end,end:m.start};}).sort((a,b)=>a.a-b.a);
      if(Math.abs(intervals[0]?.a??1)>1e-8||Math.abs((intervals.at(-1)?.b??0)-1)>1e-8||intervals.some((row,i)=>row.b-row.a<=1e-8||(i>0&&(Math.abs(row.a-intervals[i-1].b)>1e-8||row.start!==intervals[i-1].end))))throw Error(`${beam.id}: kiriş segmentleri boşluksuz, çakışmasız ve ortak düğümlerle iki kaynak uç arasında bağlanmalı.`);
    }
    if(!Array.isArray(source.floorShares))throw Error("Her kat için açık yük dağılım payları gerekiyor.");
    const shares=source.floorShares as FloorFrameSource["floorShares"];
    if(shares.some(s=>!g.floors.some(f=>f.level===s.level)||typeof s.fraction!=="number"||!Number.isFinite(s.fraction)||s.fraction<=0||s.fraction>1||!model.nodes.some(n=>n.id===s.nodeId))||new Set(shares.map(s=>`${s.level}\u0000${s.nodeId}`)).size!==shares.length)throw Error("Yük payı kat/düğüm bağlantıları geçersiz veya tekrarlı.");
    for(const f of g.floors){const rows=shares.filter(s=>s.level===f.level);if(Math.abs(rows.reduce((s,r)=>s+r.fraction,0)-1)>1e-8||!rows.length||rows.some(s=>Math.abs(model.nodes.find(n=>n.id===s.nodeId)!.z-f.z)>1e-8))throw Error(`K${f.level}: yük payları toplamı 1 olmalı ve kendi kat kotundaki düğümlere bağlanmalı.`);}
    if(model.cases.some(c=>["G","Q","S"].includes(c.id)))throw Error("G/Q/S kat yük durumları ayrılmıştır; ek durumlara farklı kimlik verin.");
    if(source.selfWeight !== undefined && typeof source.selfWeight !== "boolean")throw Error("Öz ağırlık seçimi açık boolean olmalı.");
    if(source.selfWeight === true)frameSelfWeightLoads(model);
    return {status:"declared-model" as const,issues:[],model,shares,selfWeight:source.selfWeight===true,geometry:g,fullBuildingAnalysis:false,technicalApproval:false};
  }catch(error){return {status:"pending" as const,issues:[error instanceof Error?error.message:"3B model kaynağı geçersiz."],model:null,shares:null,geometry:null,fullBuildingAnalysis:false,technicalApproval:false};}
}
export function prepareFloorFrame(project:unknown,input:StructuralConceptInput){
  const p=data(project),plan=data(data(p.modules)["plan-editor"]),source=inspectFloorFrame(plan),floor=calculateFloorPlateStudy(project,input);
  try{
    if(!source.model||!source.shares||!floor.study)throw Error([...source.issues,...floor.issues].join(" "));
    const loadCases:FrameCase[]=(["G","Q","S"] as const).map(id=>({id,loads:source.shares!.map(share=>{const f=floor.study!.floors.find(f=>f.level===share.level)!;const force=id==="G"?f.loads.permanentTotal:id==="Q"?f.loads.liveTotal:f.loads.roofSnowTotal;return {nodeId:share.nodeId,values:[0,0,-force*share.fraction,0,0,0] as [number,number,number,number,number,number]};})}));
    if(source.selfWeight)loadCases[0].memberLoads=frameSelfWeightLoads(source.model);
    const model={...source.model,cases:[...loadCases,...source.model.cases]},result=solveLinearFrame(model);
    const content={schema:"ARKEM-FLOOR-FRAME-CONTENT/1.0",projectId:p.id,revision:p.revision,scope:"linear-static-rigid-prismatic-space-frame",...(plan.example==="ARKEM-SYNTHETIC-B06/1.0"?{example:plan.example}:{}),source:{basis:floorFrameBasis(plan),frame:plan.floorFrame,floorStudy:floor.study},model,result,fullBuildingAnalysis:false,technicalApproval:false};
    return {content:JSON.parse(traceJson(content)) as typeof content,issues:[]};
  }catch(error){return {content:null,issues:[error instanceof Error?error.message:"3B çözüm oluşturulamadı."]};}
}
export async function recordFloorFrame(content:NonNullable<ReturnType<typeof prepareFloorFrame>["content"]>){const snapshot=JSON.parse(traceJson(content)) as typeof content,sha256=await traceSha256(traceJson(snapshot));return {schema:"ARKEM-FLOOR-FRAME-RECORD/1.0",id:`FRAME-${sha256}`,sha256,content:snapshot};}
export async function verifyFloorFrame(record:Awaited<ReturnType<typeof recordFloorFrame>>,project:unknown,input:StructuralConceptInput){try{const current=prepareFloorFrame(project,input).content,hash=await traceSha256(traceJson(record.content));return record.schema==="ARKEM-FLOOR-FRAME-RECORD/1.0"&&record.id===`FRAME-${hash}`&&record.sha256===hash&&!!current&&traceJson(current)===traceJson(record.content);}catch{return false;}}
