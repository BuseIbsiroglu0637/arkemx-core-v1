import assert from 'node:assert/strict';import test from 'node:test';import fs from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';import {registerHooks} from 'node:module';
registerHooks({resolve(s,c,next){if(s.startsWith('.')&&!path.extname(s)){const u=new URL(s+'.ts',c.parentURL);if(fs.existsSync(fileURLToPath(u)))return next(u.href,c);}return next(s,c);}});
const {createShellExamples}=await import('../app/lib/shell-example.ts');
const {solveShell,rectangularShellElement,factorShellBand,recordShellCalculation,verifyShellCalculation,SHELL_GAUSS}=await import('../app/lib/shell-solver.ts');
const {navierCenter,interiorMoments,membranePatch}=await import('./fixtures/shell-numerics.mjs');
const {traceJson,traceSha256}=await import('../app/lib/structural-traceability.ts');
const near=(a,b,tol=1e-8)=>assert.ok(Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a-b)<=tol, `${a} differs from ${b}`);
test('S2 element symmetry, six rigid body motions, constant shear and bending fields',()=>{
 const a=2,b=3,E=30e6,nu=.2,h=.16,k=rectangularShellElement(a,b,E,nu,h),coords=[[0,0],[a,0],[a,b],[0,b]];
 for(let i=0;i<24;i++)for(let j=0;j<24;j++)near(k.K[i*24+j],k.K[j*24+i],0);
 for(let mode=0;mode<6;mode++){
  const u=coords.flatMap(([x,y])=>mode<3?Array.from({length:6},(_,i)=>+(i===mode)):
    [mode===5?-y:0,mode===5?x:0,mode===3?y:mode===4?-x:0,+(mode===3),+(mode===4),+(mode===5)]);
  for(let i=0;i<24;i++){let f=0,norm=0;for(let j=0;j<24;j++){f+=k.K[i*24+j]*u[j];norm+=Math.abs(k.K[i*24+j]*u[j]);}assert.ok(Math.abs(f)<=1e-8*Math.max(1,norm));}
 }
 for(const [x,y] of SHELL_GAUSS){
  const shear=k.sample(coords.flatMap(([x,y])=>[0,0,.001*x+.002*y,0,0,0]),x,y);
  near(shear.resultants[6],5/6*E/(2*(1+nu))*h*.001);near(shear.resultants[7],5/6*E/(2*(1+nu))*h*.002);
  const bend=k.sample(coords.flatMap(([x,y])=>[0,0,0,.004*y,-.003*x,0]),x,y);
  const D=E*h**3/(12*(1-nu**2));near(bend.resultants[3],-D*(.003+nu*.004));near(bend.resultants[4],-D*(.004+nu*.003));near(bend.resultants[5],0);
 }
});
test('S2 exact consistent pressure force and first moments',()=>{
 const k=rectangularShellElement(2,3,30e6,.2,.16),f=k.pressure;near(f.reduce((v,x)=>v+x,0),-6);
 for(let n=0;n<4;n++)near(f[n*6+2],-1.5);near(f[2]+f[8]+f[14]+f[20],-6);
});
test('S2 membrane traction benchmarks reproduce analytic strains on single and multi element patches',()=>{
 for(const kind of ['MEM-X','MEM-XY'])for(const size of [1,4]){
  const s=createShellExamples()[0];s.mesh={nx:size,ny:size};const r=membranePatch(s,kind),{E,nu}=s.material,h=s.plate.thickness,G=E/(2*(1+nu));
  const strains=kind==='MEM-X'?[1/(E*h),-nu/(E*h),0]:[0,0,1/(G*h)],forces=kind==='MEM-X'?[1,0,0]:[0,0,1];
  for(const e of r.elements)for(const p of e.points){for(let i=0;i<3;i++){near(p.strain[i],strains[i],1e-14);near(p.resultants[i],forces[i],1e-8);}near(p.drillingStrain,0,1e-14);}
 }
});
test('S2 both plates and supports balance forces and moments, preserve exact fixed DOFs and symmetry',()=>{
 for(const preset of ['SS-H','CL'])for(const s of createShellExamples(preset)){
  const r=solveShell(s);assert.equal(r.engine,'ARKEM-RECT-MITC4/1.0');assert.equal(r.technicalApproval,false);assert.equal(r.fullBuildingAnalysis,false);
  for(const c of r.cases){assert.ok(c.equilibrium.forceResidual<1e-8);assert.ok(c.equilibrium.momentResidual<1e-8);assert.ok(c.freeForceResidual<1e-8);assert.ok(c.freeMomentResidual<1e-8);
   const applied=c.nodes.reduce((v,n)=>v+n.appliedLoad[2],0);near(applied,-s.plate.width*s.plate.depth*c.areaLoad);near(c.nodes.reduce((v,n)=>v+n.reactions[2],0),-applied,1e-6);
   for(const support of r.prepared.model.supports){const n=c.nodes.find(n=>n.id===support.nodeId);support.fixed.forEach((fixed,i)=>{if(fixed)near(n.displacements[i],0,0);});}
   for(let j=0;j<=s.mesh.ny;j++)for(let i=0;i<=s.mesh.nx;i++){const n=c.nodes[j*(s.mesh.nx+1)+i],mirror=c.nodes[j*(s.mesh.nx+1)+s.mesh.nx-i];near(n.displacements[2],mirror.displacements[2],1e-10);}
  }
 }
});
test('S2 zero pressure, 2x pressure and G_SW+G_SUP linear superposition',()=>{
 const s=createShellExamples()[0],r=solveShell(s),g=r.cases.find(c=>c.id==='G'),sw=r.cases.find(c=>c.id==='G_SW'),sup=r.cases.find(c=>c.id==='G_SUP');
 for(let n=0;n<g.nodes.length;n++)for(let k=0;k<6;k++){near(g.nodes[n].displacements[k],sw.nodes[n].displacements[k]+sup.nodes[n].displacements[k],1e-13);}
 const twice=structuredClone(s);twice.loads.benchmarkLoad=2;const c=solveShell(twice).cases.find(c=>c.id==='BENCH'),one=r.cases.find(c=>c.id==='BENCH');near(c.centerUz,2*one.centerUz,1e-14);
 const zero=structuredClone(s);zero.loads={slabSelfWeight:false,superDeadLoad:0,liveLoad:0,benchmarkLoad:0};
 for(const c of solveShell(zero).cases){assert.equal(c.maxAbsUz,0);assert.equal(c.equilibrium.forceResidual,0);assert.equal(c.equilibrium.momentResidual,0);for(const n of c.nodes)assert.ok([...n.displacements,...n.reactions,...n.appliedLoad].every(v=>v===0));}
});
test('S2 Navier analytic deflection and four-mesh deflection/moment convergence without changing tolerances',()=>{
 for(const preset of ['SS-H','CL'])for(let plate=0;plate<2;plate++){
  const results=['coarse','medium','fine','refined'].map(d=>{const s=createShellExamples(preset,d)[plate],c=solveShell(s).cases.find(c=>c.id==='BENCH');return {s,c};});
  const [,coarse,medium,fine]=results;
  assert.ok(Math.abs((fine.c.centerUz-medium.c.centerUz)/fine.c.centerUz)<.01);
  assert.ok(Math.abs(fine.c.centerUz-medium.c.centerUz)<Math.abs(medium.c.centerUz-coarse.c.centerUz));
  if(preset==='SS-H')assert.ok(Math.abs((fine.c.centerUz-navierCenter(fine.s))/navierCenter(fine.s))<.01);
  let error=0,norm=0;for(const x of [.25,.5,.75])for(const y of [.25,.5,.75]){const a=interiorMoments(medium.c,medium.s,x,y),b=interiorMoments(fine.c,fine.s,x,y);for(let k=0;k<3;k++){error=Math.max(error,Math.abs(a[k]-b[k]));norm=Math.max(norm,Math.abs(b[k]));}}
  assert.ok(error<=1e-6+.03*norm,`${preset} ${plate} moment convergence ${error/norm}`);
 }
});
test('S2 thin-plate limit has no severe shear locking and drilling sensitivity is explicit',()=>{
 const s=createShellExamples('SS-H','fine')[0];s.plate.thickness=.016;
 const r=solveShell(s),c=r.cases.find(c=>c.id==='BENCH');assert.ok(Math.abs((c.centerUz-navierCenter(s,101,true))/navierCenter(s,101,true))<.01);
 const base=createShellExamples()[0],ref=solveShell(base).cases.find(c=>c.id==='BENCH');
 for(const alpha of [.01,100]){const c=solveShell(base,{drillingFactor:alpha}).cases.find(c=>c.id==='BENCH');near(c.centerUz,ref.centerUz,1e-10);}
});
test('S2 rejects unknown source, bad kernel, numerical failure and singular band, supports pre-abort',()=>{
 assert.throws(()=>solveShell(null));assert.throws(()=>solveShell({...createShellExamples()[0],supports:{preset:'point'}}));
 assert.throws(()=>rectangularShellElement(0,1,1,.2,.1));assert.throws(()=>rectangularShellElement(1,1,1,.5,.1));assert.throws(()=>rectangularShellElement(1,1,1e308,.2,1e308));assert.throws(()=>rectangularShellElement(1,1,1,.2,Number.MIN_VALUE));
 assert.throws(()=>solveShell(createShellExamples()[0],{drillingFactor:0}));
 assert.throws(()=>factorShellBand(new Float64Array([1,0,1,1]),2,2));assert.throws(()=>factorShellBand(new Float64Array([0]),1,1));
 const ac=new AbortController();ac.abort();assert.throws(()=>solveShell(createShellExamples()[0],{signal:ac.signal}),/iptal/);
 const bad=structuredClone(createShellExamples()[0]);bad.result={uz:1};assert.throws(()=>solveShell(bad));
});
test('S2 deterministic calculation identity rejects source changes and rehashed forged results',async()=>{
 const s=createShellExamples('CL','coarse')[0],r=await recordShellCalculation(s),again=await recordShellCalculation(JSON.parse(JSON.stringify(s)));
 assert.equal(r.id,again.id);assert.ok(await verifyShellCalculation(r,s));
 const change=structuredClone(s);change.loads.liveLoad+=1;assert.equal(await verifyShellCalculation(r,change),false);
 const forged=structuredClone(r);forged.content.cases[0].nodes[0].reactions[2]+=1;
 forged.sha256=await traceSha256(traceJson(forged.content));forged.id='SHELL-CALC-'+forged.sha256;assert.equal(await verifyShellCalculation(forged,s),false);
});
test('S2 versioned refinement preserves 1.0 defaults, limits the 1.1 mesh and refuses precision loss',()=>{
 const old=createShellExamples()[1],refined=createShellExamples('CL','refined')[1];
 assert.equal(old.schema,'ARKEM-SHELL-SOURCE/1.0');assert.equal(refined.schema,'ARKEM-SHELL-SOURCE/1.1');
 assert.deepEqual(refined.mesh,{nx:64,ny:32});
 const excess=structuredClone(refined);excess.mesh.ny=64;assert.throws(()=>solveShell(excess));
 const invalidOld=structuredClone(refined);invalidOld.schema='ARKEM-SHELL-SOURCE/1.0';assert.throws(()=>solveShell(invalidOld));
 const imprecise=structuredClone(old);imprecise.plate.origin[0]=1e15;imprecise.mesh.nx=31;assert.throws(()=>solveShell(imprecise),/hassasiyet/);
 const translated=structuredClone(old);translated.plate.origin=[123,-42,87];near(solveShell(translated).cases[0].centerUz,solveShell(old).cases[0].centerUz,1e-12);
 const sparse=structuredClone(old);sparse.mesh={nx:3,ny:3};const odd=solveShell(sparse);assert.ok(odd.cases[0].centerUz<0);
 const tiny=structuredClone(old);tiny.loads.benchmarkLoad=Number.MIN_VALUE;assert.throws(()=>solveShell(tiny),/alt taşma/);
});
