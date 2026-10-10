import type { ProjectKernelState } from "../components/ProjectKernel";
import type { StructuralConceptInput } from "./engineering";
import { stampProjectModule } from "./project-core";
import { declaredModuleUnits } from "./project-integrity";
import { floorCoordinationBasis } from "./floor-coordination";
import { floorFrameBasis, type FloorFrameSource } from "./floor-frame";
import { planGeometrySnapshot } from "./source-reference-integrity";
export const FRAME_EXAMPLE="ARKEM-SYNTHETIC-B06/1.0";
export function createFrameExample(liveLoad=3.5,horizontalLoad=5,unitWeight?:number):{project:ProjectKernelState;input:StructuralConceptInput}{
  if(unitWeight!==undefined&&(!Number.isFinite(unitWeight)||unitWeight<=0))throw Error("Öz ağırlık için pozitif kN/m³ birim ağırlığı girin.");
  if(![liveLoad,horizontalLoad].every(v=>Number.isFinite(v)&&v>=0&&v<=50))throw Error("Örnek yükleri 0–50 aralığında sonlu sayı olmalı.");
  const id="ARKEMX-ORNEK-B06",revision="ORNEK-01",time="2026-10-09T00:00:00.000Z";
  const stamp=(key:string,value:unknown)=>stampProjectModule(value,{projectId:id,projectRevision:revision,sourceModule:key,recordedAt:time,action:"created"});
  const input:StructuralConceptInput={system:"concrete",usage:"industrial",width:20,depth:10,floors:2,floorHeight:3.4,baysX:2,baysY:2,columnSize:.5,beamDepth:.6,slabThickness:.16,superDeadLoad:2.2,liveLoad,roofSnowLoad:.75,basicWindSpeed:30,sds:1,sd1:.45,importance:1,behaviorFactor:6,concreteStrength:30,steelYield:355};
  const plates=[{level:1,width:10,depth:10,grossArea:100},{level:2,width:20,depth:10,grossArea:200}];
  const elements=[...[["L-A",1,0],["L-B",1,1],["U-A",2,0],["U-B",2,.5]] as const].map(([id,level,x])=>({id,type:"column",level,x,y:0,provenance:"manual",label:"Örnek "+id}));
  const plan=stamp("plan-editor",{example:FRAME_EXAMPLE,level:2,floorCount:2,baysX:2,baysY:2,spanX:5,spanY:5,floorPlates:plates,elements,units:declaredModuleUnits("plan-editor")}) as Record<string,unknown>;
  plan.floorCoordination={schema:"ARKEM-FLOOR-COORDINATION/1.0",basis:floorCoordinationBasis(plan),placements:[{level:1,x:0,y:0,z:0},{level:2,x:0,y:0,z:3.4}],beams:[{id:"B-L",startColumnId:"L-A",endColumnId:"L-B"},{id:"B-U",startColumnId:"U-A",endColumnId:"U-B"}]};
  const frame:FloorFrameSource={schema:"ARKEM-FLOOR-FRAME-SOURCE/1.0",basis:floorFrameBasis(plan),model:{
    nodes:[{id:"A0",x:0,y:0,z:-3.4},{id:"B0",x:5,y:0,z:-3.4},{id:"A1",x:0,y:0,z:0},{id:"B1",x:5,y:0,z:0},{id:"A2",x:0,y:0,z:3.4},{id:"B2",x:5,y:0,z:3.4}],
    materials:[{id:"M",name:"Örnek elastik malzeme",E:30e6,G:12.5e6}],sections:[{id:"S",name:"Örnek prizmatik kesit",A:.25,Iy:1/192,Iz:1/192,J:.0088}],
    members:[...["L-A","L-B","U-A","U-B"].map((sourceId,i)=>({id:"MEM-"+sourceId,sourceId,kind:"column" as const,start:["A0","B0","A1","B1"][i],end:["A1","B1","A2","B2"][i],materialId:"M",sectionId:"S",localZ:[0,1,0] as [number,number,number]})),...["B-L","B-U"].map((sourceId,i)=>({id:"MEM-"+sourceId,sourceId,kind:"beam" as const,start:"A"+(i+1),end:"B"+(i+1),materialId:"M",sectionId:"S",localZ:[0,0,1] as [number,number,number]}))],
    supports:[{nodeId:"A0",fixed:[true,true,true,true,true,true]},{nodeId:"B0",fixed:[true,true,true,true,true,true]}],cases:[{id:"H",loads:[{nodeId:"A2",values:[horizontalLoad,0,0,0,0,0]}]}]},floorShares:[{level:1,nodeId:"A1",fraction:.5},{level:1,nodeId:"B1",fraction:.5},{level:2,nodeId:"A2",fraction:.5},{level:2,nodeId:"B2",fraction:.5}]};
  plan.floorFrame=frame;
  if(unitWeight!==undefined){frame.selfWeight=true;frame.model.materials[0].unitWeight=unitWeight;}
  const structure=stamp("structural-concept",{units:declaredModuleUnits("structural-concept"),sourceRevision:revision,inputElementIds:elements.map(e=>e.id),inputElementSnapshot:structuredClone(elements),inputGeometrySnapshot:planGeometrySnapshot(plan),modelContext:{floorPlates:structuredClone(plates)},input,result:null,calculationId:null});
  return {input,project:{schema:"ARKEM-PROJECT/1.0",id,name:"ÖRNEK MODEL — İki farklı kat plakası",revision,phase:"Ön fizibilite",coordinateReference:"ÖRNEK ORTAK X/Y/Z — m",updatedAt:time,experience:{mode:"technical",autoHandoff:false,lastSynchronizedAt:""},events:[],modules:{"plan-editor":plan,"structural-concept":structure}}};
}
