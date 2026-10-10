import { prepareShellSource, prepareRectangularShellModel, rectangularShellPhysical, type RectangularShellPhysical, type ShellSource } from "./shell-source.ts";
import { traceJson, traceSha256 } from "./structural-traceability.ts";

export const SHELL_ENGINE = "ARKEM-RECT-MITC4/1.0";
export const SHELL_FORMULATION = Object.freeze({
  element: "axis-aligned-flat-rectangle-Q4-MITC",
  integration: "2x2-Gauss",
  membrane: "plane-stress-bilinear",
  bending: "Reissner-Mindlin-physical-rx-ry",
  shearCorrection: 5 / 6,
  drilling: "penalty-G*h*(0.5*(dv/dx-du/dy)-rz)^2",
  resultants: Object.freeze(["Nx","Ny","Nxy","Mxx","Myy","Mxy","Qx","Qy"]),
  momentSign: "OpenSees-section: minus-D-times-curvature",
  units: Object.freeze({ displacement:"m",rotation:"rad",membrane:"kN/m",moment:"kNm/m",shear:"kN/m",reactionForce:"kN",reactionMoment:"kNm" }),
} as const);
const signs = [[-1,-1],[1,-1],[1,1],[-1,1]];
export const SHELL_GAUSS = Object.freeze(signs.map(([x,y]) => Object.freeze([x/Math.sqrt(3),y/Math.sqrt(3)])));
const dot = (a: ArrayLike<number>, b: ArrayLike<number>) => { let s=0; for(let i=0;i<a.length;i++) s+=a[i]*b[i]; return s; };
function shape(a:number,b:number,x:number,y:number) {
  const N=signs.map(([s,t])=>(1+s*x)*(1+t*y)/4);
  return { N, dx:signs.map(([s,t])=>s*(1+t*y)/(2*a)), dy:signs.map(([s,t])=>t*(1+s*x)/(2*b)) };
}
function matrices(a:number,b:number,x:number,y:number) {
  const s=shape(a,b,x,y), B=Array.from({length:9},()=>new Float64Array(24));
  for(let n=0;n<4;n++) {
    const k=6*n;
    B[0][k]=s.dx[n]; B[1][k+1]=s.dy[n]; B[2][k]=s.dy[n]; B[2][k+1]=s.dx[n];
    B[3][k+4]=-s.dx[n]; B[4][k+3]=s.dy[n]; B[5][k+3]=s.dx[n]; B[5][k+4]=-s.dy[n];
    // MITC transverse shear: gamma_x sampled at (0,+/-1), gamma_y at (+/-1,0).
    const sx=shape(a,b,0,signs[n][1]), sy=shape(a,b,signs[n][0],0);
    B[6][k+2]=s.dx[n]; B[6][k+4]=sx.N[n]*(1+signs[n][1]*y)/2;
    B[7][k+2]=s.dy[n]; B[7][k+3]=-sy.N[n]*(1+signs[n][0]*x)/2;
    B[8][k]=-s.dy[n]/2; B[8][k+1]=s.dx[n]/2; B[8][k+5]=-s.N[n];
  }
  return {B,N:s.N};
}
function constitutive(E:number,nu:number,h:number,drillingFactor:number) {
  if(![E,h].every(v=>Number.isFinite(v)&&v>0)||!Number.isFinite(nu)||nu<0||nu>=.5||
    !Number.isFinite(drillingFactor)||drillingFactor<.01||drillingFactor>100) throw Error("Geçersiz kabuk malzemesi veya drilling katsayısı.");
  const A=E*h/(1-nu*nu), D=E*h*h*h/(12*(1-nu*nu)), Gh=E*h/(2*(1+nu));
  if(![A,D,Gh].every(v=>Number.isFinite(v)&&v>0)) throw Error("Kabuk rijitliği sayısal sınırlar dışında.");
  const C=Array.from({length:9},()=>new Float64Array(9));
  for(const [k,v] of [[0,A],[3,D]]) {
    C[k][k]=C[k+1][k+1]=v; C[k][k+1]=C[k+1][k]=nu*v; C[k+2][k+2]=v*(1-nu)/2;
  }
  C[6][6]=C[7][7]=5/6*Gh; C[8][8]=drillingFactor*Gh;
  if(!C.flatMap(v=>Array.from(v)).every(Number.isFinite)) throw Error("Kabuk kesit matrisi taşması.");
  return C;
}

/** Numerical kernel only: rectangles in XY, CCW nodes [00,10,11,01], physical six DOFs. */
export function rectangularShellElement(a:number,b:number,E:number,nu:number,h:number,drillingFactor=1) {
  if(![a,b].every(v=>Number.isFinite(v)&&v>0)) throw Error("Pozitif dikdörtgen kenarları gerekiyor.");
  const C=constitutive(E,nu,h,drillingFactor), K=new Float64Array(24*24), pressure=new Float64Array(24), J=a*b/4;
  if(!Number.isFinite(J)||J<=0) throw Error("Geçersiz dikdörtgen Jacobian.");
  for(const [x,y] of SHELL_GAUSS) {
    const {B,N}=matrices(a,b,x,y);
    for(let i=0;i<24;i++) {
      for(let j=0;j<=i;j++) {
        let v=0;
        for(let p=0;p<9;p++) for(let q=0;q<9;q++) if(C[p][q]!==0) v+=B[p][i]*C[p][q]*B[q][j];
        K[i*24+j]+=v*J;
      }
      if(i%6===2) pressure[i]-=N[(i-2)/6]*J;
    }
  }
  for(let i=0;i<24;i++) for(let j=0;j<i;j++) K[j*24+i]=K[i*24+j];
  if(!K.every(Number.isFinite)||!pressure.every(Number.isFinite)) throw Error("Eleman matrisi sayısal taşması.");
  return {
    K, pressure,
    sample(displacements:ArrayLike<number>,x:number,y:number) {
      if(displacements.length!==24||!Array.from(displacements).every(Number.isFinite)||![x,y].every(v=>Number.isFinite(v)&&Math.abs(v)<=1)) throw Error("Geçersiz eleman örneklemesi.");
      const {B}=matrices(a,b,x,y), strain=B.map(row=>dot(row,displacements)), stress=C.map(row=>dot(row,strain));
      return {strain:strain.slice(0,8),resultants:stress.slice(0,8).map((v,i)=>i>=3&&i<=5?-v:v),drillingStrain:strain[8]};
    },
  };
}

/** Lower symmetric band, diagonal equilibration, checked positive definite Cholesky. */
export function factorShellBand(matrix:Float64Array,n:number,band:number) {
  if(!Number.isInteger(n)||n<1||!Number.isInteger(band)||band<1||band>n||matrix.length!==n*band||!matrix.every(Number.isFinite)) throw Error("Geçersiz bant matrisi.");
  const scale=Float64Array.from({length:n},(_,i)=>1/Math.sqrt(matrix[i*band]));
  if(!scale.every(v=>Number.isFinite(v)&&v>0)) throw Error("Sıfır rijitlik / mekanizma.");
  const L=matrix.slice(); let minPivot=Infinity;
  for(let i=0;i<n;i++) for(let d=0;d<Math.min(band,i+1);d++) L[i*band+d]*=scale[i]*scale[i-d];
  for(let i=0;i<n;i++) {
    for(let j=Math.max(0,i-band+1);j<=i;j++) {
      let v=L[i*band+i-j];
      for(let k=Math.max(0,i-band+1,j-band+1);k<j;k++) v-=L[i*band+i-k]*L[j*band+j-k];
      if(i===j) {
        if(!Number.isFinite(v)||v<=1e-12) throw Error("Kabuk mekanizması veya kötü koşullu rijitlik; sonuç üretilmedi.");
        minPivot=Math.min(minPivot,v); L[i*band]=Math.sqrt(v);
      } else L[i*band+i-j]=v/L[j*band];
    }
  }
  return {minPivot,bytes:L.byteLength+scale.byteLength,solve(rhs:Float64Array) {
    if(rhs.length!==n||!rhs.every(Number.isFinite)) throw Error("Geçersiz sağ taraf.");
    const u=Float64Array.from(rhs,(v,i)=>v*scale[i]);
    for(let i=0;i<n;i++) { for(let j=Math.max(0,i-band+1);j<i;j++) u[i]-=L[i*band+i-j]*u[j]; u[i]/=L[i*band]; }
    for(let i=n-1;i>=0;i--) { for(let j=i+1;j<Math.min(n,i+band);j++) u[i]-=L[j*band+j-i]*u[j]; u[i]/=L[i*band]; }
    for(let i=0;i<n;i++) u[i]*=scale[i];
    if(!u.every(Number.isFinite)) throw Error("Sonlu olmayan kabuk çözümü.");
    return u;
  }};
}

export function solveShell(source:ShellSource, options:{drillingFactor?:number;signal?:AbortSignal}={}) {
  const prepared=prepareShellSource(source);
  return {schema:"ARKEM-SHELL-CALCULATION/1.0" as const,...solvePreparedRectangularShell(rectangularShellPhysical(prepared.source),prepared,options),prepared};
}

/** Physical numerical kernel only. This does not grant project binding or technical approval. */
export function solveRectangularShell(physical:RectangularShellPhysical,options:{drillingFactor?:number;signal?:AbortSignal}={}) {
  const prepared=prepareRectangularShellModel(physical);
  return solvePreparedRectangularShell(physical,prepared,options);
}
function solvePreparedRectangularShell(s:RectangularShellPhysical,prepared:ReturnType<typeof prepareRectangularShellModel>,options:{drillingFactor?:number;signal?:AbortSignal}) {
  const started=performance.now(), {nodes,elements,supports}=prepared.model;
  const alpha=options.drillingFactor??1;
  const checkAbort=()=>{if(options.signal?.aborted)throw Error("Kabuk çözümü iptal edildi.");};
  checkAbort();
  const nx=s.mesh.nx, ny=s.mesh.ny, total=nodes.length*6;
  const dx=s.plate.width/nx,dy=s.plate.depth/ny;
  for(let j=0;j<=ny;j++)for(let i=0;i<=nx;i++) {
    const k=j*(nx+1)+i;
    if((i>0&&Math.abs((nodes[k].x-nodes[k-1].x)/dx-1)>1e-10)||
       (j>0&&Math.abs((nodes[k].y-nodes[k-nx-1].y)/dy-1)>1e-10))throw Error("Koordinat hassasiyeti düzenli kabuk ağı için yetersiz.");
  }
  const kernel=rectangularShellElement(s.plate.width/nx,s.plate.depth/ny,s.material.E,s.material.nu,s.plate.thickness,alpha);
  const fixed=new Uint8Array(total), index=new Int32Array(total).fill(-1);
  const nodeIndex=new Map(nodes.map((node,i)=>[node.id,i]));
  for(const support of supports) support.fixed.forEach((v,k)=>{fixed[nodeIndex.get(support.nodeId)!*6+k]=Number(v);});
  let free=0; for(let i=0;i<total;i++)if(!fixed[i])index[i]=free++;
  const elementDofs=elements.map(e=>e.nodeIds.flatMap(id=>Array.from({length:6},(_,k)=>nodeIndex.get(id)!*6+k)));
  let band=1;
  for(const ids of elementDofs) { const active=ids.map(i=>index[i]).filter(i=>i>=0); band=Math.max(band,Math.max(...active)-Math.min(...active)+1); }
  const K=new Float64Array(free*band), unitF=new Float64Array(total);
  for(const ids of elementDofs) {
    checkAbort();
    for(let i=0;i<24;i++) {
      unitF[ids[i]]+=kernel.pressure[i];
      const row=index[ids[i]]; if(row<0)continue;
      for(let j=0;j<24;j++) { const col=index[ids[j]]; if(col>=0&&row>=col)K[row*band+row-col]+=kernel.K[i*24+j]; }
    }
  }
  const factor=factorShellBand(K,free,band), factorBytes=factor.bytes+K.byteLength;
  // One unit-pressure solve, reused by linear independent cases, including exact zero load.
  const rhs=new Float64Array(free);
  for(let i=0;i<total;i++)if(index[i]>=0)rhs[index[i]]=unitF[i];
  const unitU=factor.solve(rhs);
  const displacement=new Float64Array(total);
  for(let i=0;i<total;i++) if(index[i]>=0)displacement[i]=unitU[index[i]];
  const internal=new Float64Array(total);
  for(const ids of elementDofs) for(let i=0;i<24;i++) for(let j=0;j<24;j++) internal[ids[i]]+=kernel.K[i*24+j]*displacement[ids[j]];
  const unitReaction=Float64Array.from(internal,(v,i)=>fixed[i]?v-unitF[i]:0);
  let forceResidualMax=0,momentResidualMax=0;
  for(let i=0;i<total;i++)if(!fixed[i]) {
    if(i%6<3)forceResidualMax=Math.max(forceResidualMax,Math.abs(internal[i]-unitF[i]));
    else momentResidualMax=Math.max(momentResidualMax,Math.abs(internal[i]-unitF[i]));
  }
  const length=Math.max(s.plate.width,s.plate.depth), forceNorm=Math.max(...Array.from(unitF,Math.abs));
  const freeForceResidual=forceResidualMax/Math.max(forceNorm,Number.MIN_VALUE);
  const freeMomentResidual=momentResidualMax/Math.max(forceNorm*length,Number.MIN_VALUE);
  const freeResidual=Math.max(freeForceResidual,freeMomentResidual);
  if(!Number.isFinite(freeResidual)||freeResidual>1e-8) throw Error("Kabuk serbest düğüm denge artığı sınırı aşıldı.");
  // Actual center evaluated from its enclosing cell; works for even and odd subdivisions.
  const ci=Math.min(nx-1,Math.floor(nx/2)), cj=Math.min(ny-1,Math.floor(ny/2));
  const centerIds=elementDofs[cj*nx+ci], centerShape=shape(s.plate.width/nx,s.plate.depth/ny, nx-2*ci-1,ny-2*cj-1).N;
  const centerUz=centerShape.reduce((v,N,k)=>v+N*displacement[centerIds[k*6+2]],0);
  const gauss=elements.map((e,i)=>({id:e.id,sourcePlateId:e.sourcePlateId,points:SHELL_GAUSS.map(([xi,eta])=>{
    const sample=kernel.sample(elementDofs[i].map(d=>displacement[d]),xi,eta);
    return {xi,eta,...sample};
  })}));
  const balance=(F:Float64Array,R:Float64Array) => {
    const force=[0,0,0],moment=[0,0,0]; let fNorm=0,mNorm=0;
    for(let n=0;n<nodes.length;n++) {
      const p=nodes[n],arm=[p.x-s.plate.origin[0],p.y-s.plate.origin[1],p.z-s.plate.origin[2]];
      const v=Array.from({length:6},(_,k)=>F[6*n+k]+R[6*n+k]);
      for(let k=0;k<3;k++){force[k]+=v[k];moment[k]+=v[k+3];fNorm+=Math.abs(F[6*n+k]);mNorm+=Math.abs(F[6*n+k+3]);}
      moment[0]+=arm[1]*v[2]-arm[2]*v[1]; moment[1]+=arm[2]*v[0]-arm[0]*v[2];moment[2]+=arm[0]*v[1]-arm[1]*v[0];
    }
    const forceResidual=Math.hypot(...force)/Math.max(fNorm,Number.MIN_VALUE);
    const momentResidual=Math.hypot(...moment)/Math.max(mNorm+length*fNorm,Number.MIN_VALUE);
    return {force,moment,forceResidual,momentResidual};
  };
  const cases=prepared.model.loadCases.map(c=>{
    checkAbort(); const q=c.areaLoad, F=Float64Array.from(unitF,v=>v*q), R=Float64Array.from(unitReaction,v=>v*q), U=Float64Array.from(displacement,v=>v*q);
    const appliedVertical=nodes.reduce((v,_,i)=>v+F[6*i+2],0);
    if(q>0&&(appliedVertical===0||Math.abs(appliedVertical/c.totalVerticalForce-1)>1e-10||U.every(v=>v===0)))throw Error("Kabuk yükü veya deplasmanı sayısal alt taşmaya uğradı.");
    const equilibrium=balance(F,R);
    if(![...U,...R,...F,centerUz*q,...equilibrium.force,...equilibrium.moment].every(Number.isFinite)||equilibrium.forceResidual>1e-8||equilibrium.momentResidual>1e-8) throw Error("Kabuk sonuçları veya global dengesi geçersiz.");
    return {id:c.id,componentIds:c.componentIds,areaLoad:q,centerUz:centerUz*q,maxAbsUz:Math.max(...nodes.map((_,i)=>Math.abs(U[i*6+2]))),
      nodes:nodes.map((node,i)=>({id:node.id,displacements:Array.from(U.slice(i*6,i*6+6)),reactions:Array.from(R.slice(i*6,i*6+6)),appliedLoad:Array.from(F.slice(i*6,i*6+6))})),
      elements:gauss.map(e=>({...e,points:e.points.map(p=>({...p,strain:p.strain.map(v=>v*q),resultants:p.resultants.map(v=>v*q),drillingStrain:p.drillingStrain*q}))})),
      equilibrium,freeResidual:q===0?0:freeResidual,freeForceResidual:q===0?0:freeForceResidual,freeMomentResidual:q===0?0:freeMomentResidual,
    };
  });
  return {engine:SHELL_ENGINE,formulation:{...SHELL_FORMULATION,units:{...SHELL_FORMULATION.units},resultants:[...SHELL_FORMULATION.resultants],drillingFactor:alpha},cases,
    diagnostics:{freeDofs:free,bandWidth:band,factorStorageBytes:factorBytes,minScaledPivot:factor.minPivot,elapsedMs:performance.now()-started},
    status:"solved-pilot-awaiting-independent-validation" as const,fullBuildingAnalysis:false as const,technicalApproval:false as const};
}

export async function recordShellCalculation(source:ShellSource,drillingFactor=1) {
  const result=solveShell(source,{drillingFactor});
  const {diagnostics,...deterministic}=result;
  const sha256=await traceSha256(traceJson(deterministic));
  return {schema:"ARKEM-SHELL-CALCULATION-RECORD/1.0" as const,id:"SHELL-CALC-"+sha256,sha256,content:deterministic,diagnostics};
}

export type ShellCalculationRecord = Awaited<ReturnType<typeof recordShellCalculation>>;
export async function verifyShellCalculation(record:ShellCalculationRecord,currentSource:ShellSource) {
  try {
    const sha=await traceSha256(traceJson(record.content));
    if(record.schema!=="ARKEM-SHELL-CALCULATION-RECORD/1.0"||record.id!=="SHELL-CALC-"+sha||record.sha256!==sha)return false;
    const recomputed=await recordShellCalculation(currentSource,record.content.formulation.drillingFactor);
    return recomputed.sha256===sha;
  } catch { return false; }
}
