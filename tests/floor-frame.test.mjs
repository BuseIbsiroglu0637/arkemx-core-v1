import assert from 'node:assert/strict';import test from 'node:test';import fs from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';import {registerHooks} from 'node:module';
registerHooks({resolve(s,c,next){if(s.startsWith('.')&&!path.extname(s)){const u=new URL(s+'.ts',c.parentURL);if(fs.existsSync(fileURLToPath(u)))return next(u.href,c);}return next(s,c);}});
const {createB06FrameFixture,frameInput}=await import('./fixtures/b06-frame-project.mjs');
const {refreshCoordinationSource}=await import('./fixtures/b06-coordination-project.mjs');
const {inspectFloorFrame,prepareFloorFrame,recordFloorFrame,verifyFloorFrame,frameDraft}=await import('../app/lib/floor-frame.ts');
const {prepareFrameDocument,commonFrameDxf,sealFrameDocument,verifyFrameDocument}=await import('../app/lib/frame-documents.ts');
test('B06 transfer column connects through a declared split beam with no gaps or overlaps',async()=>{
 const {floorCoordinationBasis}=await import('../app/lib/floor-coordination.ts'),{floorFrameBasis}=await import('../app/lib/floor-frame.ts');
 const p=createB06FrameFixture(),plan=p.modules['plan-editor'],frame=plan.floorFrame,model=frame.model;
 plan.elements.find(e=>e.id==='U-A').x=.25;plan.floorCoordination.basis=floorCoordinationBasis(plan);
 model.nodes.find(n=>n.id==='A2').x=2.5;model.nodes.push({id:'T',x:2.5,y:0,z:0});model.members.find(m=>m.sourceId==='U-A').start='T';
 const beam=model.members.find(m=>m.sourceId==='B-L');beam.end='T';model.members.push({...beam,id:'MEM-B-L-2',start:'T',end:'B1'});
 frame.basis=floorFrameBasis(plan);refreshCoordinationSource(p);const good=prepareFloorFrame(p,frameInput(p));assert.deepEqual(good.issues,[]);assert.ok(good.content.result.cases[0].members.find(m=>m.sourceId==='B-L').localEndForces.some(v=>Math.abs(v)>1));
 const bad=structuredClone(plan);bad.floorFrame.model.members.find(m=>m.id==='MEM-B-L-2').start='A1';assert.equal(inspectFloorFrame(bad).model,null);
});
test('B06 frame uses 100+200 floor areas, explicit floor shares and supported source paths',()=>{
 const p=createB06FrameFixture(),r=prepareFloorFrame(p,frameInput(p));assert.deepEqual(r.issues,[]);assert.equal(r.content.source.floorStudy.totals.grossArea,300);assert.deepEqual(r.content.result.cases.map(c=>c.id),['G','Q','S','H']);
 for(const [id,total] of [['G',2205],['Q',1050],['S',150]]){const c=r.content.result.cases.find(c=>c.id===id);assert.ok(Math.abs(c.nodes.reduce((s,n)=>s+n.reactions[2],0)-total)<1e-8);assert.ok(c.relativeResidual<1e-8);}
 assert.equal(r.content.fullBuildingAnalysis,false);assert.equal(r.content.technicalApproval,false);
});
test('B06 blank draft preserves missing fields and cannot masquerade as a real model',()=>{
 const p=createB06FrameFixture();delete p.modules['plan-editor'].floorFrame;const draft=frameDraft(p.modules['plan-editor']);assert.equal(draft.model.materials[0].E,null);assert.equal(draft.model.nodes[1].z,null);assert.equal(draft.model.supports.length,0);assert.equal(inspectFloorFrame({...p.modules['plan-editor'],floorFrame:draft}).model,null);
});
test('B06 source binding rejects missing members, wrong top elevations, incomplete shares and old source',()=>{
 for(const mutate of [p=>p.floorFrame.model.members.pop(),p=>p.floorFrame.model.nodes.find(n=>n.id==='A2').z=4,p=>p.floorFrame.floorShares[0].fraction=.4,p=>p.floorFrame.floorShares[0].nodeId='A0',p=>p.floorCoordination.placements[1].x=1]){const p=createB06FrameFixture();mutate(p.modules['plan-editor']);assert.equal(inspectFloorFrame(p.modules['plan-editor']).model,null);}
});
test('B06 disconnected or unstable model produces no saved engineering result',()=>{
 const p=createB06FrameFixture();p.modules['plan-editor'].floorFrame.model.supports.forEach(s=>s.fixed=[true,true,true,false,false,false]);p.modules['plan-editor'].floorFrame.model.members=p.modules['plan-editor'].floorFrame.model.members.filter(m=>m.kind==='column');assert.equal(prepareFloorFrame(p,frameInput(p)).content,null);
});
test('B06 actual frame calculation rejects rehashed fabricated results and changed loads',async()=>{
 const p=createB06FrameFixture(),input=frameInput(p),r=await recordFloorFrame(prepareFloorFrame(p,input).content);assert.equal(await verifyFloorFrame(r,p,input),true);const fake=structuredClone(r.content);fake.result.cases[0].nodes[0].reactions[2]=999;assert.equal(await verifyFloorFrame(await recordFloorFrame(fake),p,input),false);assert.equal(await verifyFloorFrame(r,p,{...input,superDeadLoad:3}),false);
});
test('B06 common DXF uses real XY/Z coordinates and actual frame source/calculation manifest',async()=>{
 const p=createB06FrameFixture(),input=frameInput(p),r=await recordFloorFrame(prepareFloorFrame(p,input).content),manifest=await prepareFrameDocument(p,input,r,'DXF'),dxf=commonFrameDxf(manifest).replaceAll('\r\n','\n');
 assert.equal(manifest.scope,'linear-frame-study');assert.ok(dxf.includes('10\n20.00000000\n20\n10.00000000\n30\n3.40000000'));assert.ok(dxf.includes('30\n-3.40000000'));assert.ok(dxf.includes(r.id));assert.ok(dxf.includes('$INSUNITS\n70\n6'));
});
test('B06 common documents reject altered files, missing calculation, stale source and false approval',async()=>{
 const p=createB06FrameFixture(),input=frameInput(p),r=await recordFloorFrame(prepareFloorFrame(p,input).content),m=await prepareFrameDocument(p,input,r,'DXF'),bytes=commonFrameDxf(m),doc=await sealFrameDocument(m,'common.dxf',bytes),registry={[r.id]:r};
 assert.equal(await verifyFrameDocument(doc,p,input,registry,bytes),true);assert.equal(await verifyFrameDocument(doc,p,input,{},bytes),false);assert.equal(await verifyFrameDocument(doc,p,input,registry,bytes+'X'),false);assert.equal(await verifyFrameDocument({...doc,technicalApproval:true},p,input,registry,bytes),false);p.modules['plan-editor'].floorFrame.model.materials[0].E*=2;refreshCoordinationSource(p);assert.equal(await verifyFrameDocument(doc,p,input,registry,bytes),false);
});
test('B06 common geometry export works without claiming any calculation',async()=>{
 const p=createB06FrameFixture();delete p.modules['plan-editor'].floorFrame;refreshCoordinationSource(p);const m=await prepareFrameDocument(p,undefined,null,'PDF');assert.equal(m.scope,'geometry-only');assert.equal(m.calculationId,null);assert.equal(m.technicalApproval,false);
});
