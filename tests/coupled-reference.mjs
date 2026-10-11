import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {registerHooks} from 'node:module';
import {spawnSync} from 'node:child_process';
import {createCoupledFixture} from './fixtures/coupled-frame-shell.mjs';
registerHooks({resolve(s,c,next){if(s.startsWith('.')&&!path.extname(s)){const u=new URL(s+'.ts',c.parentURL);if(fs.existsSync(fileURLToPath(u)))return next(u.href,c);}return next(s,c);}});
const {solveCoupledFrameShell}=await import('../app/lib/coupled-frame-shell.ts');
const {rectangularShellElement}=await import('../app/lib/shell-solver.ts');
const out=path.resolve(process.env.ARKEMX_G05_EVIDENCE_DIR??'test-artifacts/g05');fs.mkdirSync(out,{recursive:true});
// Fixed before running: shell formulation comparisons retain the existing
// 1% displacement/reaction and 5% section tolerances. No engineering acceptance.
const reports=[],refinement=[];
for(const [mesh,twoFloors] of [[1,false],[2,false],[4,false],[6,false],[8,false],[10,false],[2,true],[4,true],[6,true],[8,true]]) {
  const model=createCoupledFixture(mesh,twoFloors),actual=solveCoupledFrameShell(model);
  const child=spawnSync(process.env.ARKEMX_FRAME_PYTHON??'python',['tests/coupled-reference.py'],{input:JSON.stringify(model),encoding:'utf8',timeout:60000,maxBuffer:32e6});
  assert.equal(child.status,0,child.stderr);const reference=JSON.parse(child.stdout);assert.equal(reference.version,'3.7.1');
  const name=`${twoFloors?'two':'one'}-floor-${mesh}`;
  fs.writeFileSync(path.join(out,`coupled-${name}.json`),JSON.stringify({model,actual,reference}));
  for(const c of actual.cases){
    const r=reference.cases.find(x=>x.id===c.id),metrics=[];
    function compare(label,pairs,rel,abs){
      const count=pairs[0][0].length,norm=Array(count).fill(0),error=norm.slice();
      for(const [a,b] of pairs)for(let k=0;k<count;k++){error[k]=Math.max(error[k],Math.abs(a[k]-b[k]));norm[k]=Math.max(norm[k],Math.abs(b[k]));}
      for(let k=0;k<count;k++)assert.ok(error[k]<=abs+rel*norm[k],`${name}/${c.id}/${label}[${k}]: ${error[k]} > ${abs+rel*norm[k]}`);
      metrics.push({label,error,norm,relativeTolerance:rel,absoluteTolerance:abs});
    }
    compare('displacement',c.nodes.map((n,i)=>[n.displacements,r.nodes[i].displacements]),.01,1e-8);
    compare('reaction',c.nodes.map((n,i)=>[n.reactions,r.nodes[i].reactions]),.01,1e-6);
    compare('member-local-force',c.members.map((m,i)=>[m.localEndForces,r.members[i].localEndForces]),.01,1e-6);
    compare('shell-resultant',c.elements.flatMap((e,i)=>e.points.map((p,g)=>[p.resultants,r.elements[i].stresses.slice(8*g,8*g+8)])),.05,1e-6);
    reports.push({model:name,case:c.id,pass:true,metrics});
  }
  const moments=[];
  for(const level of twoFloors?[1,2]:[1])for(const rx of [.25,.5,.75])for(const ry of [.25,.5,.75]){
    const x=rx*(level===2?2:4),y=ry*3,z=level*3,values=[];
    for(const s of model.shells){const [a,b,,d]=s.nodeIds.map(id=>model.nodes.find(n=>n.id===id));
      if(a.z!==z||x<a.x-1e-9||x>b.x+1e-9||y<a.y-1e-9||y>d.y+1e-9)continue;
      const kernel=rectangularShellElement(b.x-a.x,d.y-a.y,s.E,s.nu,s.thickness);
      const u=s.nodeIds.flatMap(id=>actual.cases[0].nodes.find(n=>n.id===id).displacements);
      values.push(kernel.sample(u,Math.max(-1,Math.min(1,2*(x-a.x)/(b.x-a.x)-1)),Math.max(-1,Math.min(1,2*(y-a.y)/(d.y-a.y)-1))).resultants.slice(3,6));
    }
    assert.ok(values.length);moments.push({level,rx,ry,values:[0,1,2].map(k=>values.reduce((sum,v)=>sum+v[k],0)/values.length)});
  }
  refinement.push({model:name,nodes:model.nodes.length,maxAbsUz:Math.max(...actual.cases[0].nodes.map(n=>Math.abs(n.displacements[2]))),moments});
}
const convergence=[];
for(const prefix of ['one-floor','two-floor']){
  const rows=refinement.filter(r=>r.model.startsWith(prefix)),a=rows.at(-2),b=rows.at(-1);
  const displacementChange=Math.abs(a.maxAbsUz-b.maxAbsUz)/b.maxAbsUz;let error=0,norm=0;
  b.moments.forEach((p,i)=>p.values.forEach((v,k)=>{error=Math.max(error,Math.abs(v-a.moments[i].values[k]));norm=Math.max(norm,Math.abs(v));}));
  const momentChange=error/norm,pass=displacementChange<=.01&&momentChange<=.03;
  convergence.push({model:prefix,from:a.model,to:b.model,displacementChange,momentChange,thresholds:{displacement:.01,moment:.03},pass});
}
const report={executedAt:new Date().toISOString(),fixture:'synthetic',reference:'OpenSees 3.7.1',reports,refinement,
  convergence,refinementAcceptance:convergence.every(c=>c.pass),fullBuildingAnalysis:false,technicalApproval:false};
fs.writeFileSync(path.join(out,'coupled-reference-result.json'),JSON.stringify(report,null,2));
console.log(JSON.stringify({suite:'coupled-reference',pass:reports.length,fail:0,convergence,technicalApproval:false}));
