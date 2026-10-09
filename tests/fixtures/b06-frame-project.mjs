import {createB06CoordinationFixture,refreshCoordinationSource} from './b06-coordination-project.mjs';
import {floorFrameBasis} from '../../app/lib/floor-frame.ts';
export function createB06FrameFixture(){
 const p=createB06CoordinationFixture(),plan=p.modules['plan-editor'];
 plan.floorFrame={schema:'ARKEM-FLOOR-FRAME-SOURCE/1.0',basis:floorFrameBasis(plan),model:{
 nodes:[{id:'A0',x:0,y:0,z:-3.4},{id:'B0',x:5,y:0,z:-3.4},{id:'A1',x:0,y:0,z:0},{id:'B1',x:5,y:0,z:0},{id:'A2',x:0,y:0,z:3.4},{id:'B2',x:5,y:0,z:3.4}],
 materials:[{id:'M',name:'synthetic elastic concrete',E:30e6,G:12.5e6}],sections:[{id:'S',name:'synthetic section',A:.25,Iy:.005208333333333333,Iz:.005208333333333333,J:.0088}],
 members:[...['L-A','L-B','U-A','U-B'].map((id,i)=>({id:'MEM-'+id,sourceId:id,kind:'column',start:['A0','B0','A1','B1'][i],end:['A1','B1','A2','B2'][i],materialId:'M',sectionId:'S',localZ:[0,1,0]})),...['B-L','B-U'].map((id,i)=>({id:'MEM-'+id,sourceId:id,kind:'beam',start:'A'+(i+1),end:'B'+(i+1),materialId:'M',sectionId:'S',localZ:[0,0,1]}))],
 supports:[{nodeId:'A0',fixed:[true,true,true,true,true,true]},{nodeId:'B0',fixed:[true,true,true,true,true,true]}],cases:[{id:'H',loads:[{nodeId:'A2',values:[5,0,0,0,0,0]}]}]},floorShares:[{level:1,nodeId:'A1',fraction:.5},{level:1,nodeId:'B1',fraction:.5},{level:2,nodeId:'A2',fraction:.5},{level:2,nodeId:'B2',fraction:.5}]};
 return refreshCoordinationSource(p);
}
export function frameInput(p){return {...p.modules['structural-concept'].input,system:'concrete',usage:'industrial',floorHeight:3.4,columnSize:.5,beamDepth:.6,slabThickness:.16,superDeadLoad:2.2,liveLoad:3.5,roofSnowLoad:.75,basicWindSpeed:30,sds:1,sd1:.45,importance:1,behaviorFactor:6,concreteStrength:30,steelYield:355};}
