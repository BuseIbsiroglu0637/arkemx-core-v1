import { frameElement, frameConsistentUniformLoad, validateFrameModel, type FrameModel, type FrameCase } from "./linear-frame.ts";
import { rectangularShellElement, factorShellBand, SHELL_GAUSS } from "./shell-solver.ts";

// Small-model pilot: shared global [ux,uy,uz,rx,ry,rz], explicit physical connectivity.
// No automatic snapping, eccentric links, multipoint constraints or project acceptance.
export type CoupledShell = {
  id: string; sourceId: string; nodeIds: [string,string,string,string];
  E: number; nu: number; thickness: number;
};
export type CoupledCase = FrameCase & { shellPressures: { shellId: string; pressure: number }[] };
export type CoupledModel = Omit<FrameModel,"cases"> & { shells: CoupledShell[]; cases: CoupledCase[] };
const allFixed: [boolean,boolean,boolean,boolean,boolean,boolean] = [true,true,true,true,true,true];
const dot = (a: ArrayLike<number>,b: ArrayLike<number>) => {let s=0;for(let i=0;i<a.length;i++)s+=a[i]*b[i];return s;};
function fields(value: unknown, keys: string[], label: string): asserts value is Record<string,unknown> {
  if(!value||typeof value!=="object"||Array.isArray(value)||Object.keys(value).some(k=>!keys.includes(k)))throw Error(`${label}: desteklenmeyen alan veya nesne.`);
}
function unique(rows: {id:string}[],label:string) {
  if(!Array.isArray(rows)||rows.some(r=>!r||typeof r.id!=="string"||!r.id.trim())||new Set(rows.map(r=>r.id)).size!==rows.length)throw Error(`${label}: geçersiz veya tekrarlı kimlik.`);
}
function shellGeometry(model: CoupledModel,shell:CoupledShell) {
  const points=shell.nodeIds.map(id=>model.nodes.find(n=>n.id===id)!);
  const [a,b,c,d]=points,width=b.x-a.x,depth=d.y-a.y;
  const close=(x:number,y:number)=>Math.abs(x-y)<=1e-9;
  if(width<=.001||depth<=.001||!points.every(p=>close(p.z,a.z))||
    !close(b.y,a.y)||!close(d.x,a.x)||!close(c.x,b.x)||!close(c.y,d.y))throw Error(`${shell.id}: yalnız XY düzleminde CCW eksen hizalı dikdörtgen kabuk desteklenir.`);
  return {points,width,depth};
}
export function validateCoupledModel(model: CoupledModel) {
  fields(model,["nodes","materials","sections","members","supports","cases","shells"],"Ortak model");
  unique(model.nodes,"Düğüm");unique(model.shells,"Kabuk");unique(model.cases,"Yük durumu");
  if(model.nodes.length<4||model.nodes.length>160||!model.shells.length||model.shells.length>100||!model.cases.length||model.cases.length>12)throw Error("Ortak pilot sınırı: 4–160 düğüm, 1–100 kabuk, 1–12 yük durumu; çerçeve alt modeli en fazla 60 düğüm.");
  for(const n of model.nodes){fields(n,["id","x","y","z"],"Düğüm");if(![n.x,n.y,n.z].every(v=>typeof v==="number"&&Number.isFinite(v)))throw Error("Sonlu düğüm koordinatları gerekiyor.");}
  for(let i=0;i<model.nodes.length;i++)for(let j=0;j<i;j++){const a=model.nodes[i],b=model.nodes[j];if(Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z)<=1e-8)throw Error("Aynı konum aynı düğüm kimliğini kullanmalı; örtük bağlantı yok.");}
  if(!Array.isArray(model.members)||!model.members.length)throw Error("Ortak çözüm için çerçeve elemanı gerekiyor.");
  const ids=new Set(model.nodes.map(n=>n.id)),frameIds=new Set(model.members.flatMap(m=>[m.start,m.end]));
  // Reuse frame geometry/material validation with validation-only supports. These
  // supports NEVER enter the assembled model; actual supports are checked below.
  validateFrameModel({nodes:model.nodes.filter(n=>frameIds.has(n.id)),materials:model.materials,sections:model.sections,members:model.members,
    supports:model.nodes.filter(n=>frameIds.has(n.id)).map(n=>({nodeId:n.id,fixed:allFixed})),cases:[{id:"VALIDATION",loads:[{nodeId:model.members[0].start,values:[0,0,0,0,0,0]}]}]});
  if(!Array.isArray(model.supports)||!model.supports.length||new Set(model.supports.map(s=>s.nodeId)).size!==model.supports.length)throw Error("Geçerli tekil mesnetler gerekiyor.");
  for(const s of model.supports){fields(s,["nodeId","fixed"],"Mesnet");if(!ids.has(s.nodeId)||!Array.isArray(s.fixed)||s.fixed.length!==6||s.fixed.some(v=>typeof v!=="boolean")||!s.fixed.some(Boolean))throw Error("Mesnet altı açık boolean kısıt içermeli.");}
  for(const s of model.shells){
    fields(s,["id","sourceId","nodeIds","E","nu","thickness"],"Kabuk");
    if(typeof s.sourceId!=="string"||!s.sourceId.trim()||!Array.isArray(s.nodeIds)||s.nodeIds.length!==4||new Set(s.nodeIds).size!==4||s.nodeIds.some(id=>!ids.has(id)))throw Error("Kabuk için kaynak ve dört gerçek düğüm gerekiyor.");
    if(![s.E,s.thickness].every(v=>typeof v==="number"&&Number.isFinite(v)&&v>0)||typeof s.nu!=="number"||!Number.isFinite(s.nu)||s.nu<0||s.nu>=.5)throw Error("Geçersiz kabuk malzemesi veya kalınlığı.");
    shellGeometry(model,s);
    const g=shellGeometry(model,s),a=g.points[0];
    for(const p of model.nodes)if(!s.nodeIds.includes(p.id)&&Math.abs(p.z-a.z)<=1e-9&&p.x>=a.x-1e-9&&p.x<=a.x+g.width+1e-9&&p.y>=a.y-1e-9&&p.y<=a.y+g.depth+1e-9)throw Error(`${s.id}: kabuk üzerindeki ${p.id} düğümü için uyumlu ağ gerekiyor.`);
  }
  for(let i=0;i<model.shells.length;i++)for(let j=0;j<i;j++){
    const a=shellGeometry(model,model.shells[i]).points[0],b=shellGeometry(model,model.shells[j]).points[0];
    const sa=shellGeometry(model,model.shells[i]),sb=shellGeometry(model,model.shells[j]);
    if(Math.abs(a.z-b.z)<=1e-9&&Math.min(a.x+sa.width,b.x+sb.width)-Math.max(a.x,b.x)>1e-9&&Math.min(a.y+sa.depth,b.y+sb.depth)-Math.max(a.y,b.y)>1e-9)throw Error("Üst üste kabuklar rijitlik ve yükü çift sayar; reddedildi.");
  }
  // A shell node lying inside a member must be an explicit member end: split
  // the beam, rather than quietly leaving the shell attached only at corners.
  for(const m of model.members){const a=model.nodes.find(n=>n.id===m.start)!,b=model.nodes.find(n=>n.id===m.end)!,v=[b.x-a.x,b.y-a.y,b.z-a.z],l2=dot(v,v);
    for(const n of model.nodes){if(n.id===a.id||n.id===b.id)continue;const w=[n.x-a.x,n.y-a.y,n.z-a.z],t=dot(w,v)/l2;if(t>1e-9&&t<1-1e-9&&Math.hypot(...w.map((x,i)=>x-t*v[i]))<=1e-8)throw Error(`${m.id}: iç düğüm ${n.id} için elemanı açıkça bölün.`);}}
  const groups=[...model.members.map(m=>[m.start,m.end]),...model.shells.map(s=>s.nodeIds)];
  const used=new Set(groups.flat()),reached=new Set(model.supports.map(s=>s.nodeId));
  for(let i=0;i<model.nodes.length;i++)for(const g of groups)if(g.some(id=>reached.has(id)))g.forEach(id=>reached.add(id));
  if(model.nodes.some(n=>!used.has(n.id)||!reached.has(n.id)))throw Error("Bağlantısız veya mesnete ulaşmayan düğüm var.");
  // Every connected shell region must reach a frame through shared node IDs.
  const coupled=new Set(frameIds);
  for(let i=0;i<model.shells.length;i++)for(const s of model.shells)if(s.nodeIds.some(id=>coupled.has(id)))s.nodeIds.forEach(id=>coupled.add(id));
  if(model.shells.some(s=>s.nodeIds.some(id=>!coupled.has(id))))throw Error("Çerçeveyle fiziksel düğüm paylaşmayan kabuk bölgesi var.");
  for(const c of model.cases){
    fields(c,["id","loads","memberLoads","shellPressures"],"Yük durumu");
    if(!Array.isArray(c.loads)||!Array.isArray(c.shellPressures)||c.memberLoads!==undefined&&!Array.isArray(c.memberLoads))throw Error("Açık düğüm, eleman ve kabuk yük listeleri gerekiyor.");
    for(const l of c.loads){fields(l,["nodeId","values"],"Düğüm yükü");if(!ids.has(l.nodeId)||!Array.isArray(l.values)||l.values.length!==6||!l.values.every(v=>typeof v==="number"&&Number.isFinite(v)))throw Error("Geçersiz düğüm yükü.");}
    const loads=c.memberLoads??[];
    if(new Set(loads.map(l=>l.memberId)).size!==loads.length)throw Error("Tekrarlı yayılı eleman yükü.");
    for(const l of loads){fields(l,["memberId","values"],"Eleman yükü");if(!model.members.some(m=>m.id===l.memberId)||!Array.isArray(l.values)||l.values.length!==3||!l.values.every(v=>typeof v==="number"&&Number.isFinite(v)))throw Error("Geçersiz eleman yükü.");}
    if(new Set(c.shellPressures.map(l=>l.shellId)).size!==c.shellPressures.length)throw Error("Tekrarlı kabuk basıncı.");
    for(const l of c.shellPressures){fields(l,["shellId","pressure"],"Kabuk yükü");if(!model.shells.some(s=>s.id===l.shellId)||typeof l.pressure!=="number"||!Number.isFinite(l.pressure))throw Error("Geçersiz kabuk basıncı.");}
    if(!c.loads.length&&!loads.length&&!c.shellPressures.length)throw Error("Yük durumu boş olamaz; sıfır yük açıkça tanımlanmalı.");
  }
}

export function solveCoupledFrameShell(model: CoupledModel) {
  validateCoupledModel(model);
  const n=model.nodes.length*6,nodeIndex=new Map(model.nodes.map((v,i)=>[v.id,i]));
  const frames=model.members.map(m=>frameElement({...model,cases:model.cases},m));
  const shells=model.shells.map(s=>{const g=shellGeometry(model,s);return {shell:s,kernel:rectangularShellElement(g.width,g.depth,s.E,s.nu,s.thickness),dofs:s.nodeIds.flatMap(id=>Array.from({length:6},(_,k)=>6*nodeIndex.get(id)!+k))};});
  const K=Array.from({length:n},()=>new Float64Array(n));
  for(const e of frames)for(let i=0;i<12;i++)for(let j=0;j<12;j++)K[e.dofs[i]][e.dofs[j]]+=e.global[i][j];
  for(const e of shells)for(let i=0;i<24;i++)for(let j=0;j<24;j++)K[e.dofs[i]][e.dofs[j]]+=e.kernel.K[i*24+j];
  const fixed=new Set(model.supports.flatMap(s=>s.fixed.flatMap((v,k)=>v?[6*nodeIndex.get(s.nodeId)!+k]:[])));
  const free=Array.from({length:n},(_,i)=>i).filter(i=>!fixed.has(i)),count=free.length;
  if(!count)throw Error("Ortak modelde serbest hareket yok.");
  const lower=new Float64Array(count*count);
  for(let i=0;i<count;i++)for(let j=0;j<=i;j++)lower[i*count+i-j]=K[free[i]][free[j]];
  const factor=factorShellBand(lower,count,count);
  const cases=model.cases.map(c=>{
    const F=new Float64Array(n),U=new Float64Array(n),equivalent=new Map<string,number[]>();
    for(const l of c.loads)for(let k=0;k<6;k++)F[6*nodeIndex.get(l.nodeId)!+k]+=l.values[k];
    for(const l of c.memberLoads??[]){const e=frames.find(e=>e.member.id===l.memberId)!,f=frameConsistentUniformLoad(e.L,l.values);equivalent.set(l.memberId,f);for(let i=0;i<12;i++)for(let j=0;j<12;j++)F[e.dofs[i]]+=e.T[j][i]*f[j];}
    for(const l of c.shellPressures){const e=shells.find(e=>e.shell.id===l.shellId)!;for(let i=0;i<24;i++){const applied=e.kernel.pressure[i]*l.pressure;if(!Number.isFinite(applied)||(e.kernel.pressure[i]!==0&&l.pressure!==0&&applied===0))throw Error("Kabuk yükü sayısal sınır dışında.");F[e.dofs[i]]+=applied;}}
    const reduced=factor.solve(Float64Array.from(free,i=>F[i]));free.forEach((id,i)=>U[id]=reduced[i]);
    if(free.some(i=>F[i]!==0)&&U.every(v=>v===0))throw Error("Ortak deplasman sayısal alt taşmaya uğradı.");
    const residual=Float64Array.from(K,(row,i)=>dot(row,U)-F[i]);
    const origin=model.nodes[0],length=Math.max(1,...model.nodes.map(p=>Math.hypot(p.x-origin.x,p.y-origin.y,p.z-origin.z)));
    const forceNorm=Math.max(1,...Array.from(F,(v,i)=>i%6<3?Math.abs(v):Math.abs(v)/length));
    const relativeResidual=Math.max(...free.map(i=>Math.abs(residual[i])/(forceNorm*(i%6<3?1:length))));
    if(relativeResidual>1e-8||![...U,...residual,...F].every(Number.isFinite))throw Error("Ortak çözüm sonlu değil veya serbest düğüm dengesi geçersiz.");
    const nodes=model.nodes.map((p,i)=>({id:p.id,displacements:Array.from(U.slice(6*i,6*i+6)),reactions:Array.from({length:6},(_,k)=>fixed.has(6*i+k)?residual[6*i+k]:0),appliedLoad:Array.from(F.slice(6*i,6*i+6))}));
    const globalBalance=Array(6).fill(0);let scale=1;
    model.nodes.forEach((p,i)=>{const f=nodes[i].appliedLoad.map((v,k)=>v+nodes[i].reactions[k]),arm=[p.x-origin.x,p.y-origin.y,p.z-origin.z];for(let k=0;k<3;k++){globalBalance[k]+=f[k];globalBalance[k+3]+=f[k+3];scale+=Math.abs(F[6*i+k])+Math.abs(F[6*i+k+3])/length;}globalBalance[3]+=arm[1]*f[2]-arm[2]*f[1];globalBalance[4]+=arm[2]*f[0]-arm[0]*f[2];globalBalance[5]+=arm[0]*f[1]-arm[1]*f[0];});
    if(globalBalance.some((v,k)=>!Number.isFinite(v)||Math.abs(v)>1e-8*scale*(k<3?1:length)))throw Error("Ortak kuvvet/moment dengesi sağlanmadı.");
    const members=frames.map(e=>{const u=e.T.map(row=>dot(row,e.dofs.map(i=>U[i])));return {id:e.member.id,sourceId:e.member.sourceId,localEndForces:e.k.map((row,i)=>dot(row,u)-(equivalent.get(e.member.id)?.[i]??0))};});
    const elements=shells.map(e=>({id:e.shell.id,sourceId:e.shell.sourceId,points:SHELL_GAUSS.map(([xi,eta])=>({xi,eta,...e.kernel.sample(e.dofs.map(i=>U[i]),xi,eta)}))}));
    return {id:c.id,nodes,members,elements,relativeResidual,globalBalance};
  });
  return {schema:"ARKEM-COUPLED-FRAME-SHELL/1.0" as const,engine:"shared-6DOF-linear-static/1.0",cases,
    diagnostics:{nodes:model.nodes.length,freeDofs:count,minScaledPivot:factor.minPivot},
    units:{length:"m",force:"kN",moment:"kNm",pressure:"kN/m2",rotation:"rad"},
    fullBuildingAnalysis:false as const,technicalApproval:false as const,
    limitations:["Küçük model pilotu: XY dikdörtgen kabuklar ve rijit uçlu doğrusal çerçeveler; açık ortak düğümler.","Öz ağırlık otomatik eklenmez; basınç ve eleman yüklerinde açıkça beyan edilmelidir.","Proje bağlantısı, deprem, ikinci mertebe, kapasite ve yetkili kabul bu çözüm kapsamında yok."]};
}
