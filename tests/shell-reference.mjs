import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';import {registerHooks} from 'node:module';import {spawnSync} from 'node:child_process';
registerHooks({resolve(s,c,next){if(s.startsWith('.')&&!path.extname(s)){const u=new URL(s+'.ts',c.parentURL);if(fs.existsSync(fileURLToPath(u)))return next(u.href,c);}return next(s,c);}});
const {createShellExamples}=await import('../app/lib/shell-example.ts');
const {solveShell,recordShellCalculation}=await import('../app/lib/shell-solver.ts');
const {recordProjectShellCalculation}=await import('../app/lib/project-shell-calculation.ts');
const {createProjectShellFixture,createProjectShellFixtureSource}=await import('./fixtures/project-shell-project.mjs');
const {navierCenter,interiorMoments,membranePatch}=await import('./fixtures/shell-numerics.mjs');
const out=path.resolve(process.env.ARKEMX_G05_EVIDENCE_DIR??'test-artifacts/g05');fs.mkdirSync(out,{recursive:true});
function reference(source,pressure=1,patch){
 const child=spawnSync(process.env.ARKEMX_SHELL_PYTHON??'python',['tests/shell-reference.py'],{input:JSON.stringify({source,pressure,patch}),encoding:'utf8',timeout:60000,maxBuffer:32e6});
 assert.equal(child.status,0,child.stderr);const r=JSON.parse(child.stdout);assert.equal(r.version,'3.7.1');return r;
}
// Component-wise full-field error. Near-zero components use the component's field norm and dimensional absolute tolerance.
function compare(actual,ref) {
 const metrics={displacement:[],reaction:[],resultants:[]};
 const check=(errors,norms,rel,abs,label)=>errors.forEach((error,k)=>assert.ok(error<=abs[k]+rel*norms[k],`${label}[${k}]: ${error} > ${abs[k]+rel*norms[k]}`));
 const ud=Array(6).fill(0),un=ud.slice(),rd=ud.slice(),rn=ud.slice(),sd=Array(8).fill(0),sn=sd.slice();
 actual.nodes.forEach((n,i)=>{for(let k=0;k<6;k++){ud[k]=Math.max(ud[k],Math.abs(n.displacements[k]-ref.nodes[i].displacements[k]));un[k]=Math.max(un[k],Math.abs(ref.nodes[i].displacements[k]));rd[k]=Math.max(rd[k],Math.abs(n.reactions[k]-ref.nodes[i].reactions[k]));rn[k]=Math.max(rn[k],Math.abs(ref.nodes[i].reactions[k]));}});
 actual.elements.forEach((e,i)=>e.points.forEach((p,g)=>p.resultants.forEach((v,k)=>{sd[k]=Math.max(sd[k],Math.abs(v-ref.elements[i].stresses[8*g+k]));sn[k]=Math.max(sn[k],Math.abs(ref.elements[i].stresses[8*g+k]));})));
 check(ud,un,.01,Array(6).fill(1e-8),'displacement');check(rd,rn,.01,Array(6).fill(1e-6),'reaction');check(sd,sn,.05,Array(8).fill(1e-6),'section');
 metrics.displacement=ud.map((error,k)=>({error,norm:un[k]}));metrics.reaction=rd.map((error,k)=>({error,norm:rn[k]}));metrics.resultants=sd.map((error,k)=>({error,norm:sn[k]}));return metrics;
}
const reports=[],convergence=[],calculationFiles=[],rawReferenceDir=path.join(out,'shell-oracle');fs.mkdirSync(rawReferenceDir,{recursive:true});
for(const preset of ['SS-H','CL'])for(let plate=0;plate<2;plate++) {
 const meshes=[];
 for(const density of ['coarse','medium','fine','refined']) {
  const source=createShellExamples(preset,density)[plate],result=solveShell(source),actual=result.cases.find(c=>c.id==='BENCH'),oracle=reference(source);
  const metrics=compare(actual,oracle),name=`${source.plate.id}-${preset}-${density}`;
  fs.writeFileSync(path.join(rawReferenceDir,name+'.json'),JSON.stringify({source,reference:oracle}));
  for(const c of result.cases)assert.ok(c.equilibrium.forceResidual<=1e-8&&c.equilibrium.momentResidual<=1e-8);
  reports.push({name,pass:true,reference:oracle.engine,version:oracle.version,metrics,diagnostics:result.diagnostics,centerUz:actual.centerUz});
  const moments=[];for(const x of [.25,.5,.75])for(const y of [.25,.5,.75])moments.push({x,y,values:interiorMoments(actual,source,x,y)});
  meshes.push({density,source,centerUz:actual.centerUz,moments});
  if(density==='refined'){
   const record=await recordShellCalculation(source),file=name+'-calculation.json';fs.writeFileSync(path.join(out,file),JSON.stringify(record));
   calculationFiles.push({name,file,id:record.id,sourceSchema:source.schema});
  }
 }
 const last=meshes.at(-1),previous=meshes.at(-2),early=meshes[1],coarse=meshes[0];
 const centerDiff=Math.abs((last.centerUz-previous.centerUz)/last.centerUz);
 let momentError=0,momentNorm=0;for(let i=0;i<last.moments.length;i++)for(let k=0;k<3;k++){momentError=Math.max(momentError,Math.abs(last.moments[i].values[k]-previous.moments[i].values[k]));momentNorm=Math.max(momentNorm,Math.abs(last.moments[i].values[k]));}
 const analytic=preset==='SS-H'?navierCenter(last.source):null,analyticError=analytic===null?null:Math.abs((last.centerUz-analytic)/analytic);
 assert.ok(centerDiff<=.01);assert.ok(momentError<=1e-6+.03*momentNorm);if(analyticError!==null)assert.ok(analyticError<=.01);
 assert.ok(Math.abs(last.centerUz-previous.centerUz)<Math.abs(previous.centerUz-early.centerUz));
 convergence.push({plate:last.source.plate.id,preset,meshes,centerDiff,momentError,momentNorm,momentRelativeError:momentError/momentNorm,analytic,analyticError,pass:true,
  originalThreeMeshCenterDiff:Math.abs((previous.centerUz-early.centerUz)/previous.centerUz),originalCoarseUz:coarse.centerUz});
}
// Actual loaded cases at the default medium mesh (not merely scaled reference fields).
for(const preset of ['SS-H','CL'])for(const source of createShellExamples(preset)){
 const result=solveShell(source);
 for(const c of result.cases.filter(c=>c.id!=='BENCH')){
  const oracle=reference(source,c.areaLoad);reports.push({name:`${source.plate.id}-${preset}-${c.id}`,pass:true,metrics:compare(c,oracle),reference:oracle.engine,version:oracle.version});
 }
}
for(const kind of ['MEM-X','MEM-XY'])for(const cells of [1,4]){
 const source=createShellExamples()[0];source.mesh={nx:cells,ny:cells};
 const actual=membranePatch(source,kind),oracle=reference(source,0,kind),metrics=compare(actual,oracle);
 reports.push({name:`${kind}-${cells}x${cells}`,pass:true,metrics,reference:oracle.engine,version:oracle.version});
 fs.writeFileSync(path.join(rawReferenceDir,`${kind}-${cells}x${cells}.json`),JSON.stringify({source,reference:oracle}));
}
const thinSource=createShellExamples('SS-H','fine')[0];thinSource.plate.thickness=.016;
const thin=solveShell(thinSource).cases.find(c=>c.id==='BENCH'),thinRef=reference(thinSource),thinAnalytic=navierCenter(thinSource,101,true);
assert.ok(Math.abs((thin.centerUz-thinAnalytic)/thinAnalytic)<=.01);
reports.push({name:'thin-plate-limit',pass:true,metrics:compare(thin,thinRef),reference:thinRef.engine,version:thinRef.version,centerUz:thin.centerUz,analytic:thinAnalytic,analyticError:Math.abs((thin.centerUz-thinAnalytic)/thinAnalytic)});
const base=createShellExamples()[0],sensitivity=[.01,1,100].map(drillingFactor=>{const r=solveShell(base,{drillingFactor});return {drillingFactor,centerUz:r.cases.find(c=>c.id==='BENCH').centerUz,minPivot:r.diagnostics.minScaledPivot};});
assert.ok(sensitivity.every(s=>Math.abs(s.centerUz-sensitivity[1].centerUz)<=1e-8));
for(const preset of ['SS-H','CL'])for(const level of [1,2]){
 const project=createProjectShellFixture(),source=createProjectShellFixtureSource(project,level);source.supports.preset=preset;
 const record=await recordProjectShellCalculation(project,source),actual=record.content.cases.find(c=>c.id==='BENCH'),oracle=reference(source),name=`project-K${level}-${preset}`;
 reports.push({name,pass:true,metrics:compare(actual,oracle),reference:oracle.engine,version:oracle.version,projectId:project.id,sourcePlateId:source.sourcePlateId,calculationId:record.id});
 fs.writeFileSync(path.join(rawReferenceDir,name+'.json'),JSON.stringify({project,source,reference:oracle}));
 fs.writeFileSync(path.join(out,name+'-calculation.json'),JSON.stringify(record));
}
const report={schema:'ARKEM-SHELL-VALIDATION/1.0',executedAt:new Date().toISOString(),fixture:'synthetic',engine:'ARKEM-RECT-MITC4/1.0',reports,convergence,sensitivity,calculationFiles,
 thresholds:{equilibrium:1e-8,referenceDisplacement:.01,referenceReaction:.01,referenceResultants:.05,analytic:.01,meshCenter:.01,meshMoment:.03},
 pass:true,fullBuildingAnalysis:false,technicalApproval:false};
fs.writeFileSync(path.join(out,'shell-reference-result.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({suite:'shell-reference',pass:reports.length,fail:0,convergence:convergence.length,technicalApproval:false}));
