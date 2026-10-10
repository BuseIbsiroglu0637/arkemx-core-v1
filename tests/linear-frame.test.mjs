import assert from 'node:assert/strict';
import test from 'node:test';
import {solveLinearFrame,frameSelfWeightLoads} from '../app/lib/linear-frame.ts';
const close=(a,b,tol=1e-8)=>assert.ok(Math.abs(a-b)<=tol*Math.max(1,Math.abs(b)),`${a} != ${b}`);
export function cantilever(){return {nodes:[{id:'A',x:0,y:0,z:0},{id:'B',x:4,y:0,z:0}],materials:[{id:'M',name:'synthetic steel',E:200e6,G:80e6}],sections:[{id:'S',name:'synthetic prismatic',A:.02,Iy:.0002,Iz:.0004,J:.0001}],members:[{id:'AB',sourceId:'SOURCE',kind:'beam',start:'A',end:'B',materialId:'M',sectionId:'S',localZ:[0,0,1]}],supports:[{nodeId:'A',fixed:[true,true,true,true,true,true]}],cases:[{id:'LOAD',loads:[{nodeId:'B',values:[100,50,-30,12,0,0]}]}]};}

test('Uniform cantilever load matches axial and both bending closed forms, including fixed-end moments',()=>{
 const m=cantilever();m.cases=[{id:'U',loads:[],memberLoads:[{memberId:'AB',values:[10,20,-30]}]}];
 const r=solveLinearFrame(m).cases[0],tip=r.nodes[1].displacements,base=r.nodes[0].reactions;
 close(tip[0],10*4**2/(2*200e6*.02));close(tip[1],20*4**4/(8*200e6*.0004));close(tip[2],-30*4**4/(8*200e6*.0002));
 close(base[0],-40);close(base[1],-80);close(base[2],120);close(base[4],-240);close(base[5],-160);
 r.members[0].localEndForces.slice(6).forEach(v=>close(v,0));r.globalBalance.forEach(v=>close(v,0));
});
test('Self weight requires explicit density and projects global gravity correctly for inclined members',()=>{
 const m=cantilever();assert.throws(()=>frameSelfWeightLoads(m),/birim ağırlığı/);
 m.materials[0].unitWeight=25;m.nodes[1]={id:'B',x:3,y:0,z:4};
 const loads=frameSelfWeightLoads(m);m.cases=[{id:'G',loads:[],memberLoads:loads}];
 const r=solveLinearFrame(m).cases[0];close(r.nodes[0].reactions[2],25*.02*5);close(r.nodes[0].reactions[4],-25*.02*5*1.5);
 close(r.nodes[0].reactions[0],0);r.globalBalance.forEach(v=>close(v,0));
 m.materials[0].unitWeight=NaN;assert.throws(()=>solveLinearFrame(m),/birim ağırlık/);
});
test('3D frame cantilever matches independent axial, two bending and torsion closed forms',()=>{
 const m=cantilever(),r=solveLinearFrame(m),tip=r.cases[0].nodes[1],d=tip.displacements;
 close(d[0],100*4/(200e6*.02));close(d[1],50*4**3/(3*200e6*.0004));close(d[2],-30*4**3/(3*200e6*.0002));close(d[3],12*4/(80e6*.0001));close(d[4],30*4**2/(2*200e6*.0002));close(d[5],50*4**2/(2*200e6*.0004));
 assert.ok(r.cases[0].relativeResidual<1e-10);for(const v of r.cases[0].globalBalance)close(v,0);
 assert.equal(r.fullBuildingAnalysis,false);assert.equal(r.technicalApproval,false);
});
test('3D frame vertical member uses declared local axes and correct global forces',()=>{
 const m=cantilever();m.nodes[1]={id:'B',x:0,y:0,z:4};m.members[0].kind='column';m.members[0].localZ=[0,1,0];m.cases[0].loads[0].values=[50,0,-100,0,0,0];
 const r=solveLinearFrame(m).cases[0];close(r.nodes[1].displacements[0],50*4**3/(3*200e6*.0004));close(r.nodes[1].displacements[2],-100*4/(200e6*.02));close(r.nodes[0].reactions[0],-50);close(r.nodes[0].reactions[2],100);close(r.nodes[0].reactions[4],-200);
});
test('3D segmented transfer beam matches simply-supported center-load displacement and reactions',()=>{
 const m=cantilever();m.nodes=[{id:'A',x:0,y:0,z:0},{id:'C',x:2,y:0,z:0},{id:'B',x:4,y:0,z:0}];m.members=[{...m.members[0],id:'AC',end:'C'},{...m.members[0],id:'CB',start:'C'}];m.supports=[{nodeId:'A',fixed:[true,true,true,true,false,false]},{nodeId:'B',fixed:[false,true,true,false,false,false]}];m.cases[0].loads=[{nodeId:'C',values:[0,0,-100,0,0,0]}];
 const r=solveLinearFrame(m).cases[0];close(r.nodes.find(n=>n.id==='C').displacements[2],-100*4**3/(48*200e6*.0002));close(r.nodes[0].reactions[2],50);close(r.nodes[2].reactions[2],50);
});
test('3D frame model reorder preserves source-specific displacements and end forces',()=>{
 const a=cantilever(),b=structuredClone(a);b.nodes.reverse();b.sections.reverse();const ra=solveLinearFrame(a).cases[0],rb=solveLinearFrame(b).cases[0];
 for(const n of ra.nodes)for(let i=0;i<6;i++)close(rb.nodes.find(x=>x.id===n.id).displacements[i],n.displacements[i]);
 for(let i=0;i<12;i++)close(ra.members[0].localEndForces[i],rb.members[0].localEndForces[i]);
});
test('3D frame superposition and positive stiffness scaling obey linear theory',()=>{
 const m=cantilever(),a=solveLinearFrame(m).cases[0].nodes[1].displacements;m.cases[0].loads[0].values=m.cases[0].loads[0].values.map(v=>2*v);const b=solveLinearFrame(m).cases[0].nodes[1].displacements;for(let i=0;i<6;i++)close(b[i],2*a[i]);m.materials[0].E*=2;m.materials[0].G*=2;const c=solveLinearFrame(m).cases[0].nodes[1].displacements;for(let i=0;i<6;i++)close(c[i],a[i]);
});
test('3D frame rejects mechanisms, no supports, disconnected parts and unsupported releases',()=>{
 for(const mutate of [m=>m.shells=[],m=>m.supports=[],m=>m.supports[0].fixed=[true,true,true,false,false,false],m=>m.members[0].release='pinned',m=>m.nodes.push({id:'C',x:10,y:0,z:0})]){const m=cantilever();mutate(m);assert.throws(()=>solveLinearFrame(m));}
});
test('3D frame rejects invalid identities, properties, coincident nodes, axes and nonfinite loads',()=>{
 for(const mutate of [m=>m.nodes[1].id='A',m=>m.nodes[1].x=0,m=>m.materials[0].E=0,m=>m.sections[0].J=0,m=>m.members[0].localZ=[1,0,0],m=>m.cases[0].loads[0].values[0]=Infinity,m=>m.supports[0].fixed[0]='true',m=>m.members.push({...m.members[0],id:'DUP'})]){const m=cantilever();mutate(m);assert.throws(()=>solveLinearFrame(m));}
});
