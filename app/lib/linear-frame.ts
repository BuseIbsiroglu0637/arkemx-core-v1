// Prismatic Euler–Bernoulli space frame: six global DOFs per node.
// kN, m, rad; E/G kN/m²; A m²; Iy/Iz/J m⁴. Rigid end connections.
// No shell, shear deformation, releases, P-delta, dynamics or design checks.
export type FrameNode = { id: string; x: number; y: number; z: number };
export type FrameMaterial = { id: string; name: string; E: number; G: number };
export type FrameSection = { id: string; name: string; A: number; Iy: number; Iz: number; J: number };
export type FrameMember = { id: string; sourceId: string; kind: "column" | "beam"; start: string; end: string; materialId: string; sectionId: string; localZ: [number, number, number] };
export type FrameSupport = { nodeId: string; fixed: [boolean, boolean, boolean, boolean, boolean, boolean] };
export type FrameLoad = { nodeId: string; values: [number, number, number, number, number, number] };
export type FrameCase = { id: string; loads: FrameLoad[] };
export type FrameModel = { nodes: FrameNode[]; materials: FrameMaterial[]; sections: FrameSection[]; members: FrameMember[]; supports: FrameSupport[]; cases: FrameCase[] };
const matrix = (n: number) => Array.from({ length: n }, () => Array(n).fill(0) as number[]);
const dot = (a: number[], b: number[]) => a.reduce((s, x, i) => s + x * b[i], 0);
const cross = (a: number[], b: number[]) => [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];
const normalize = (a: number[]) => { const norm = Math.hypot(...a); if (!Number.isFinite(norm) || norm < 1e-12) throw Error("Eleman yerel ekseni tanımsız veya paralel."); return a.map(x => x / norm); };
const positive = (n: unknown) => typeof n === "number" && Number.isFinite(n) && n > 0;
function unique(rows: {id:string}[], label: string) { if (!Array.isArray(rows) || rows.some(r => !r || typeof r.id !== "string" || !r.id.trim()) || new Set(rows.map(r=>r.id)).size !== rows.length) throw Error(`${label} kimlikleri geçersiz veya tekrarlı.`); }
export function validateFrameModel(model: FrameModel) {
  if(!model||typeof model!=="object")throw Error("3B model nesnesi gerekiyor.");
  if(Array.isArray(model)||Object.keys(model).some(k=>!["nodes","materials","sections","members","supports","cases"].includes(k)))throw Error("Modelde desteklenmeyen alan var; yalnız açık düğüm/eleman/mesnet/yük sözleşmesi kullanılabilir.");
  const fields=(rows:unknown,keys:string[],label:string)=>{if(!Array.isArray(rows)||rows.some(r=>!r||typeof r!=="object"||Array.isArray(r)||Object.keys(r).some(k=>!keys.includes(k))))throw Error(`${label}: desteklenmeyen alan veya nesne; uç serbestliği/öteleme/kabuk bu modelde yok.`);};
  fields(model.nodes,["id","x","y","z"],"Düğüm");fields(model.materials,["id","name","E","G"],"Malzeme");fields(model.sections,["id","name","A","Iy","Iz","J"],"Kesit");fields(model.members,["id","sourceId","kind","start","end","materialId","sectionId","localZ"],"Eleman");fields(model.supports,["nodeId","fixed"],"Mesnet");fields(model.cases,["id","loads"],"Yük durumu");
  for (const [rows, label] of [[model.nodes,"Düğüm"],[model.materials,"Malzeme"],[model.sections,"Kesit"],[model.members,"Eleman"],[model.cases,"Yük durumu"]] as const) unique(rows,label);
  if (model.nodes.length < 2 || model.nodes.length > 60 || !model.members.length || model.members.length > 150 || !model.cases.length || model.cases.length > 12) throw Error("Lineer çözüm sınırı: 2–60 düğüm, 1–150 eleman ve 1–12 yük durumu.");
  if (model.nodes.some(n => ![n.x,n.y,n.z].every(v=>typeof v === "number" && Number.isFinite(v)))) throw Error("Düğüm koordinatları sonlu sayı olmalı.");
  for(let i=0;i<model.nodes.length;i++)for(let j=0;j<i;j++){const a=model.nodes[i],b=model.nodes[j];if(Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z)<=1e-8)throw Error("Aynı konumdaki rijit bağlantılar aynı düğüm kimliğini kullanmalı.");}
  if (model.materials.some(m=>typeof m.name!=="string"||!m.name.trim()||!positive(m.E)||!positive(m.G)||m.G >= m.E)) throw Error("Malzeme adı ve pozitif E/G gerekiyor; bu izotrop modelde G < E olmalı.");
  if (model.sections.some(s=>typeof s.name!=="string"||!s.name.trim()||![s.A,s.Iy,s.Iz,s.J].every(positive))) throw Error("Kesit adı ve pozitif A/Iy/Iz/J gerekiyor.");
  const ids = new Set(model.nodes.map(n=>n.id));
  for (const m of model.members) if (!ids.has(m.start)||!ids.has(m.end)||m.start===m.end||!model.materials.some(a=>a.id===m.materialId)||!model.sections.some(s=>s.id===m.sectionId)||!Array.isArray(m.localZ)||m.localZ.length!==3||!m.localZ.every(Number.isFinite)||!["column","beam"].includes(m.kind)||typeof m.sourceId!=="string") throw Error(`${m.id}: düğüm, malzeme, kesit veya yerel eksen bağlantısı geçersiz.`);
  if(new Set(model.members.map(m=>[m.start,m.end].sort().join("\u0000"))).size!==model.members.length)throw Error("Aynı düğüm çifti için eleman tekrarlanamaz.");
  if (!Array.isArray(model.supports)||!model.supports.length||new Set(model.supports.map(s=>s.nodeId)).size!==model.supports.length||model.supports.some(s=>!ids.has(s.nodeId)||!Array.isArray(s.fixed)||s.fixed.length!==6||s.fixed.some(v=>typeof v!=="boolean")||!s.fixed.some(Boolean))) throw Error("Mesnetler altı açık boolean kısıtla ve gerçek düğüm kimliğiyle tanımlanmalı.");
  for (const c of model.cases) {fields(c.loads,["nodeId","values"],"Düğüm yükü");if (!c.loads.length||c.loads.some(l=>!ids.has(l.nodeId)||!Array.isArray(l.values)||l.values.length!==6||l.values.some(v=>typeof v!=="number"||!Number.isFinite(v)))) throw Error(`${c.id}: sonlu altı bileşenli düğüm yükleri gerekiyor.`);}
  const used = new Set(model.members.flatMap(m=>[m.start,m.end]));
  if (model.nodes.some(n=>!used.has(n.id))) throw Error("Bağlantısız düğüm var.");
  const reached = new Set(model.supports.map(s=>s.nodeId));
  for (let i=0;i<model.nodes.length;i++) for(const m of model.members) { if(reached.has(m.start))reached.add(m.end); if(reached.has(m.end))reached.add(m.start); }
  if (model.nodes.some(n=>!reached.has(n.id))) throw Error("Mesnete ulaşmayan eleman/yük yolu var.");
}

function element(model: FrameModel, member: FrameMember) {
  const a=model.nodes.find(n=>n.id===member.start)!,b=model.nodes.find(n=>n.id===member.end)!,s=model.sections.find(s=>s.id===member.sectionId)!,m=model.materials.find(m=>m.id===member.materialId)!;
  const vector=[b.x-a.x,b.y-a.y,b.z-a.z],L=Math.hypot(...vector);
  if(!Number.isFinite(L)||L <= .001) throw Error(`${member.id}: eleman boyu 1 mm’den büyük olmalı.`);
  const x=normalize(vector),y=normalize(cross(member.localZ,x)),z=normalize(cross(x,y)),R=[x,y,z],T=matrix(12),k=matrix(12);
  for(let block=0;block<4;block++)for(let i=0;i<3;i++)for(let j=0;j<3;j++)T[3*block+i][3*block+j]=R[i][j];
  const pair=(i:number,j:number,v:number)=>{k[i][i]+=v;k[j][j]+=v;k[i][j]-=v;k[j][i]-=v;};
  pair(0,6,m.E*s.A/L);pair(3,9,m.G*s.J/L);
  const bending=(idx:number[],EI:number,sign:number)=>{
    const h=[[12,sign*6*L,-12,sign*6*L],[sign*6*L,4*L*L,-sign*6*L,2*L*L],[-12,-sign*6*L,12,-sign*6*L],[sign*6*L,2*L*L,-sign*6*L,4*L*L]];
    for(let i=0;i<4;i++)for(let j=0;j<4;j++)k[idx[i]][idx[j]]+=EI/(L*L*L)*h[i][j];
  };
  bending([1,5,7,11],m.E*s.Iz,1);bending([2,4,8,10],m.E*s.Iy,-1);
  const global=matrix(12);
  for(let i=0;i<12;i++)for(let j=0;j<12;j++)for(let a=0;a<12;a++)for(let b=0;b<12;b++)if(T[a][i]&&T[b][j])global[i][j]+=T[a][i]*k[a][b]*T[b][j];
  if(global.some(r=>r.some(v=>!Number.isFinite(v))))throw Error("Eleman rijitliği sonlu değil.");
  const dofs=[member.start,member.end].flatMap(id=>{const n=model.nodes.findIndex(n=>n.id===id);return Array.from({length:6},(_,i)=>6*n+i);});
  return {member,L,R,T,k,global,dofs};
}

// Symmetric diagonal scaling and Cholesky: reject mechanisms/near singularity.
function factor(K:number[][],free:number[]) {
  const scales=free.map(i=>Math.sqrt(K[i][i]));
  if(scales.some(s=>!Number.isFinite(s)||s<=0))throw Error("Serbest doğrultuda rijitlik yok; mesnet veya bağlantı eksik.");
  const L=matrix(free.length);
  for(let i=0;i<free.length;i++)for(let j=0;j<=i;j++){
    let v=K[free[i]][free[j]]/(scales[i]*scales[j]);for(let k=0;k<j;k++)v-=L[i][k]*L[j][k];
    if(i===j){if(!Number.isFinite(v)||v<1e-10)throw Error("Model mekanizma veya kötü koşullu; sonuç üretilmedi.");L[i][j]=Math.sqrt(v);}else L[i][j]=v/L[j][j];
  }
  return (F:number[])=>{
    const y=Array(free.length).fill(0),u=Array(free.length).fill(0);
    for(let i=0;i<free.length;i++){y[i]=F[free[i]]/scales[i];for(let j=0;j<i;j++)y[i]-=L[i][j]*y[j];y[i]/=L[i][i];}
    for(let i=free.length-1;i>=0;i--){u[i]=y[i];for(let j=i+1;j<free.length;j++)u[i]-=L[j][i]*u[j];u[i]/=L[i][i];}
    return u.map((v,i)=>v/scales[i]);
  };
}
export function solveLinearFrame(model: FrameModel) {
  validateFrameModel(model);
  const elements=model.members.map(m=>element(model,m)),size=6*model.nodes.length,K=matrix(size);
  for(const e of elements)for(let i=0;i<12;i++)for(let j=0;j<12;j++)K[e.dofs[i]][e.dofs[j]]+=e.global[i][j];
  const fixed=new Set(model.supports.flatMap(s=>s.fixed.flatMap((v,i)=>v?[model.nodes.findIndex(n=>n.id===s.nodeId)*6+i]:[]))),free=Array.from({length:size},(_,i)=>i).filter(i=>!fixed.has(i));
  if(!free.length)throw Error("Modelde serbest hareket yok; kısıtlar gözden geçirilmeli.");
  const solve=factor(K,free);
  const cases=model.cases.map(c=>{
    const F=Array(size).fill(0),U=Array(size).fill(0);
    for(const l of c.loads){const n=model.nodes.findIndex(n=>n.id===l.nodeId);for(let i=0;i<6;i++)F[6*n+i]+=l.values[i];}
    const reduced=solve(F);free.forEach((id,i)=>U[id]=reduced[i]);
    const residual=K.map((row,i)=>dot(row,U)-F[i]);
    const norm=Math.max(1,...F.map(Math.abs)),relativeResidual=Math.max(0,...free.map(i=>Math.abs(residual[i])))/norm;
    if([...U,...residual].some(v=>!Number.isFinite(v))||relativeResidual>1e-7)throw Error("Çözüm sonlu değil veya denge artığı sınırı aşıldı.");
    const nodes=model.nodes.map((n,i)=>({id:n.id,displacements:U.slice(6*i,6*i+6),reactions:residual.slice(6*i,6*i+6).map((v,j)=>fixed.has(6*i+j)?v:0)}));
    const members=elements.map(e=>{const u=e.T.map(row=>dot(row,e.dofs.map(i=>U[i])));return {id:e.member.id,sourceId:e.member.sourceId,length:e.L,localAxes:e.R,localEndForces:e.k.map(row=>dot(row,u))};});
    const balance=Array(6).fill(0);
    model.nodes.forEach((n,i)=>{const f=Array.from({length:6},(_,j)=>F[6*i+j]+nodes[i].reactions[j]);const moment=cross([n.x,n.y,n.z],f.slice(0,3));for(let j=0;j<3;j++){balance[j]+=f[j];balance[j+3]+=f[j+3]+moment[j];}});
    const forceScale=Math.max(1,F.reduce((s,v)=>s+Math.abs(v),0)),momentScale=Math.max(forceScale,...model.nodes.map(n=>forceScale*(1+Math.hypot(n.x,n.y,n.z))));
    if(balance.some((v,i)=>!Number.isFinite(v)||Math.abs(v)>(i<3?forceScale:momentScale)*1e-7))throw Error("Global kuvvet/moment dengesi sağlanmadı; sonuç üretilmedi.");
    return {id:c.id,nodes,members,relativeResidual,globalBalance:balance};
  });
  return {schema:"ARKEM-LINEAR-SPACE-FRAME/1.0",engine:"Euler-Bernoulli/6DOF-linear-static-1.0",units:{length:"m",force:"kN",moment:"kNm",rotation:"rad"},cases,fullBuildingAnalysis:false,technicalApproval:false,limitations:["Yalnız prizmatik lineer elastik çerçeve ve rijit uç bağlantıları; kullanıcı tanımlı düğüm yükleri.","Döşeme kabuğu, ikinci mertebe, burkulma, plastikleşme, çatlama, deprem/dinamik ve kapasite hesabı yok.","Eleman öz ağırlığı kendiliğinden eklenmez; yüklerde açıkça tanımlanmalı."]};
}
