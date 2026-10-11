import type { CoupledModel } from "./coupled-frame-shell";
// Declared synthetic geometry only; never LHM model inputs.
export function createCoupledExample(cells=2,twoFloors=false): CoupledModel {
  const model: CoupledModel={nodes:[],materials:[{id:'M',name:'synthetic elastic',E:30e6,G:12.5e6}],sections:[{id:'S',name:'synthetic section',A:.16,Iy:.0021333333333333334,Iz:.0021333333333333334,J:.0036}],members:[],shells:[],supports:[],cases:[]};
  const node=(id: string,x: number,y: number,z: number)=>{model.nodes.push({id,x,y,z});return id;};
  const member=(id: string,start: string,end: string,kind: "column" | "beam")=>model.members.push({id,sourceId:'SYNTHETIC-'+id,kind,start,end,materialId:'M',sectionId:'S',localZ:kind==='column'?[1,0,0]:[0,0,1]});
  const grid=(level: number,width: number,nx: number,ny: number)=>{
    for(let j=0;j<=ny;j++)for(let i=0;i<=nx;i++)node(`L${level}-${i}-${j}`,i*width/nx,j*3/ny,level*3);
    for(let j=0;j<ny;j++)for(let i=0;i<nx;i++)model.shells.push({id:`P${level}-${i}-${j}`,sourceId:`SYNTHETIC-FLOOR-${level}`,nodeIds:[`L${level}-${i}-${j}`,`L${level}-${i+1}-${j}`,`L${level}-${i+1}-${j+1}`,`L${level}-${i}-${j+1}`],E:30e6,nu:.2,thickness:.18});
    for(const j of [0,ny])for(let i=0;i<nx;i++)member(`BX${level}-${i}-${j}`,`L${level}-${i}-${j}`,`L${level}-${i+1}-${j}`,'beam');
    for(const i of [0,nx])for(let j=0;j<ny;j++)member(`BY${level}-${i}-${j}`,`L${level}-${i}-${j}`,`L${level}-${i}-${j+1}`,'beam');
  };
  grid(1,4,cells,cells);
  for(const i of [0,cells])for(const j of [0,cells]){const base=node(`BASE-${i}-${j}`,i*4/cells,j*3/cells,0);model.supports.push({nodeId:base,fixed:[true,true,true,true,true,true]});member(`C1-${i}-${j}`,base,`L1-${i}-${j}`,'column');}
  if(twoFloors){if(cells%2)throw Error('Two-floor fixture requires even mesh');grid(2,2,cells/2,cells);for(const i of [0,cells/2])for(const j of [0,cells])member(`C2-${i}-${j}`,`L1-${i}-${j}`,`L2-${i}-${j}`,'column');}
  const pressure=(q: number)=>model.shells.map(s=>({shellId:s.id,pressure:q}));
  model.cases=[{id:'G',loads:[],shellPressures:pressure(5)},{id:'Q',loads:[],shellPressures:pressure(2)},
    {id:'H',loads:[{nodeId:`L${twoFloors?2:1}-0-0`,values:[10,3,0,0,0,0]}],shellPressures:[]},
    {id:'MEMBER',loads:[],memberLoads:[{memberId:model.members[0].id,values:[0,0,-2]}],shellPressures:[]},
    {id:'ZERO',loads:[],shellPressures:pressure(0)},
    {id:'MIXED',loads:[{nodeId:`L${twoFloors?2:1}-0-0`,values:[10,3,0,0,0,0]}],memberLoads:[{memberId:model.members[0].id,values:[0,0,-2]}],shellPressures:pressure(7)}];
  return model;
}
