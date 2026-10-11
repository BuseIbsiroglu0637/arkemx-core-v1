import assert from 'node:assert/strict';
import {test} from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {registerHooks} from 'node:module';
registerHooks({resolve(s,c,next){if(s.startsWith('.')&&!path.extname(s)){const u=new URL(s+'.ts',c.parentURL);if(fs.existsSync(fileURLToPath(u)))return next(u.href,c);}return next(s,c);}});
const {solveCoupledFrameShell}=await import('../app/lib/coupled-frame-shell.ts');
import {createCoupledFixture} from './fixtures/coupled-frame-shell.mjs';

test('pressure reaches column bases through shared plate/frame DOFs',()=>{
  const m=createCoupledFixture(),r=solveCoupledFrameShell(m),g=r.cases[0];
  assert.ok(Math.abs(g.nodes.reduce((s,n)=>s+n.reactions[2],0)-60)<1e-7);
  for(const n of g.nodes.filter(n=>n.id.startsWith('BASE')))assert.ok(Math.abs(n.reactions[2]-15)<1e-7);
  assert.ok(g.members.some(m=>m.id.startsWith('C')&&Math.abs(m.localEndForces[0])>1));
  assert.ok(g.nodes.find(n=>n.id==='L1-1-1').displacements[2]<0);
  for(const c of r.cases)assert.ok(c.globalBalance.every(v=>Math.abs(v)<1e-7));
  assert.equal(r.fullBuildingAnalysis,false);assert.equal(r.technicalApproval,false);
});
test('distinct floor plates share the declared frame, without filling absent area',()=>{
  const r=solveCoupledFrameShell(createCoupledFixture(2,true));
  assert.ok(Math.abs(r.cases[0].nodes.reduce((s,n)=>s+n.reactions[2],0)-90)<1e-7);
});
test('elastic cases scale and zero pressure returns zero fields',()=>{
  const r=solveCoupledFrameShell(createCoupledFixture());
  r.cases[0].nodes.forEach((n,i)=>n.displacements.forEach((v,k)=>assert.ok(Math.abs(r.cases[1].nodes[i].displacements[k]-.4*v)<1e-12)));
  for(const n of r.cases.find(c=>c.id==='ZERO').nodes)assert.ok([...n.displacements,...n.reactions].every(v=>v===0));
});
test('mixed pressure, node and distributed member loads satisfy superposition without double counting',()=>{
  const r=solveCoupledFrameShell(createCoupledFixture()),parts=r.cases.filter(c=>['G','Q','H','MEMBER'].includes(c.id)),mixed=r.cases.find(c=>c.id==='MIXED');
  for(let i=0;i<mixed.nodes.length;i++)for(let k=0;k<6;k++)for(const field of ['displacements','reactions'])assert.ok(Math.abs(mixed.nodes[i][field][k]-parts.reduce((s,c)=>s+c.nodes[i][field][k],0))<1e-7);
});
test('node and element ordering do not alter source-specific results',()=>{
  const m=createCoupledFixture(2,true),a=solveCoupledFrameShell(m);m.nodes.reverse();m.members.reverse();m.shells.reverse();const b=solveCoupledFrameShell(m);
  a.cases.forEach((c,i)=>c.nodes.forEach(n=>{const other=b.cases[i].nodes.find(x=>x.id===n.id);n.displacements.forEach((v,k)=>assert.ok(Math.abs(v-other.displacements[k])<1e-10));n.reactions.forEach((v,k)=>assert.ok(Math.abs(v-other.reactions[k])<1e-7));}));
});
test('beam stiffness affects the shared solution, rather than transferring independent reactions',()=>{
  const m=createCoupledFixture(),a=solveCoupledFrameShell(m).cases[0];m.sections[0].Iy*=10;m.sections[0].Iz*=10;
  const b=solveCoupledFrameShell(m).cases[0];assert.ok(Math.abs(b.nodes.find(n=>n.id==='L1-1-1').displacements[2])<Math.abs(a.nodes.find(n=>n.id==='L1-1-1').displacements[2]));
});
const invalid=[
  ['coincident independent node IDs',m=>m.nodes.push({...m.nodes[0],id:'DUP'})],
  ['duplicate shell stiffness/pressure',m=>m.shells.push({...m.shells[0],id:'DUP'})],
  ['clockwise or skew shell',m=>m.shells[0].nodeIds.reverse()],
  ['missing physical connection',m=>{m.members=m.members.filter(x=>x.kind==='column');m.nodes=m.nodes.filter(n=>n.id.startsWith('BASE')||!n.id.startsWith('L1'));}],
  ['implicit beam intermediate attachment',m=>{m.members=m.members.filter(x=>!x.id.startsWith('BX1-'));m.members.push({...m.members.find(x=>x.kind==='beam'),id:'UNSPLIT',start:'L1-0-0',end:'L1-2-0'});}],
  ['mechanism',m=>m.supports.forEach(s=>s.fixed=[false,false,true,false,false,false])],
  ['unsupported auto self weight',m=>m.cases[0].selfWeight=true],
  ['duplicate pressure',m=>m.cases[0].shellPressures.push({...m.cases[0].shellPressures[0]})],
  ['invalid load reference',m=>m.cases[0].shellPressures[0].shellId='UNKNOWN'],
  ['nonfinite load',m=>m.cases[0].shellPressures[0].pressure=NaN],
  ['pressure underflow',m=>{const s=m.shells[0];m.cases=[{id:'TINY',loads:[],shellPressures:[{shellId:s.id,pressure:Number.MIN_VALUE}]}];}],
  ['pressure overflow',m=>m.cases[0].shellPressures.forEach(p=>p.pressure=Number.MAX_VALUE)],
  ['empty case',m=>m.cases[0].shellPressures=[]],
  ['nonconforming shell edge',m=>m.nodes.push({id:'HANGING',x:1,y:0,z:3})],
  ['all constrained model',m=>{m.supports=m.nodes.map(n=>({nodeId:n.id,fixed:[true,true,true,true,true,true]}));}],
  ['separately supported shell without frame connection',m=>{const original=m.nodes.filter(n=>n.id.startsWith('L1'));for(const n of original)m.nodes.push({...n,id:'DETACHED-'+n.id,z:n.z+10});m.shells.forEach(s=>s.nodeIds=s.nodeIds.map(id=>'DETACHED-'+id));original.forEach(n=>m.supports.push({nodeId:'DETACHED-'+n.id,fixed:[true,true,true,true,true,true]}));m.nodes=m.nodes.filter(n=>n.id!=='L1-1-1');}],
];
for(const [name,change] of invalid)test('rejects '+name,()=>{const m=createCoupledFixture();change(m);assert.throws(()=>solveCoupledFrameShell(m));});
