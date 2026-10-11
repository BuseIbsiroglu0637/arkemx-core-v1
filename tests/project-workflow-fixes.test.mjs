import assert from 'node:assert/strict';
import test from 'node:test';
import {registerHooks} from 'node:module';
import fs from 'node:fs';
import ts from 'typescript';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
registerHooks({resolve(s,c,next){if(s.startsWith('.')&&!path.extname(s)){const u=new URL(s+'.ts',c.parentURL);if(fs.existsSync(fileURLToPath(u)))return next(u.href,c);}return next(s,c);}});
const {restoreProjectTracking}=await import('../app/lib/project-tracking.ts');
const {createProjectOperatingModel,operatingHealthGates}=await import('../app/lib/project-os-2.ts');
const {deriveProjectThread}=await import('../app/lib/project-graph.ts');
const {mcdaInputMatchesSource}=await import('../app/lib/mcda-source.ts');
test('new tracking has no invented completion, documents, week or progress',()=>{
 const t=restoreProjectTracking({});assert.equal(t.week,0);assert.deepEqual(t.documents,[]);assert.deepEqual(t.decisions,[]);assert.deepEqual(t.handover,Array(6).fill(false));assert.equal(t.legacyTrackingSnapshot,null);
 const m=createProjectOperatingModel({projectId:'NEW',projectRevision:'P01'});assert.deepEqual(m.workItems,[]);assert.equal(m.revisions.length,1);assert.equal(m.revisions[0].code,'P01');assert.equal(m.source.dataStatus,'missing');
});
test('legacy mixed data is preserved separately instead of treated as current approval',()=>{
 const saved={week:17,documents:[{status:'Onaylı'}],handover:[true,true,true,false,false,false],earnedValue:{actual:43}};
 const t=restoreProjectTracking(saved);assert.deepEqual(t.legacyTrackingSnapshot,saved);assert.equal(t.week,0);assert.deepEqual(t.documents,[]);assert.deepEqual(t.handover,Array(6).fill(false));assert.deepEqual(saved.handover,[true,true,true,false,false,false]);
});
test('explicit current tracking survives reload including legacy evidence',()=>{
 const saved={trackingDataStatus:'project-record',week:2,documents:[{code:'REAL'}],handover:[false,true,false,false,false,false],legacyTrackingSnapshot:{week:17}};
 const t=restoreProjectTracking(saved);assert.equal(t.week,2);assert.deepEqual(t.documents,saved.documents);assert.deepEqual(t.handover,saved.handover);assert.deepEqual(t.legacyTrackingSnapshot,saved.legacyTrackingSnapshot);
});
test('health gates count displayed restored states, not original template states',()=>{
 const m=createProjectOperatingModel({projectId:'P',projectRevision:'P01',bimCoordination:{schema:'ARKEM-BIM-COORDINATION/3.0',clashes:[{guid:'A',severity:'critical'},{guid:'B',severity:'critical'}]}});
 const rows=m.workItems.map((i,n)=>({...i,status:n?'closed':'in-review'}));assert.equal(operatingHealthGates(rows,true).find(g=>g.code==='OS-116-CRITICAL').count,1);
});
test('variable floor area sum avoids repeating the active floor',()=>{
 const modules={'plan-editor':{floorCount:3,metrics:{floorArea:1300.78},floorPlates:[{level:1,width:44.902,depth:28.969},{level:2,width:33.388,depth:21.541},{level:3,width:33.316,depth:21.494}]},'architectural-program':{input:{targetGross:2736.069},result:{grossDemand:2736.069}}};
 assert.equal(deriveProjectThread(modules).issues.some(i=>i.id==='ARC-021'),false);
 modules['plan-editor'].floorPlates[1].width=60;assert.equal(deriveProjectThread(modules).issues.some(i=>i.id==='ARC-021'),true);
});
test('project and architectural check use the same declared route measure',()=>{
 const m={'architectural-program':{input:{targetTravel:30},result:{travelDistance:39.6},architecturalScheme:{circulation:{maximumTravelDistance:27}}}};
 assert.equal(deriveProjectThread(m).canonical.architecture.travelDistance,27);assert.equal(deriveProjectThread(m).issues.some(i=>i.id==='FIR-061'),false);
 m['architectural-program'].architecturalScheme.circulation.maximumTravelDistance=35;assert.equal(deriveProjectThread(m).issues.some(i=>i.id==='FIR-061'),true);
});
test('MCDA permits rounding noise but detects material source changes',()=>{
 const s={usage:'residential',floors:2,span:5.4,area:599.8};assert.equal(mcdaInputMatchesSource({...s,area:600},s),true);assert.equal(mcdaInputMatchesSource({...s,area:630},s),false);assert.equal(mcdaInputMatchesSource({...s,floors:3},s),false);
});
test('coordination height override is visible as an open source discrepancy',()=>{
 const m={'architectural-program':{input:{floorHeight:3}},'engineering-coordination':{input:{floorHeight:3.2},result:{clearHeight:2.5}}};assert.equal(deriveProjectThread(m).issues.some(i=>i.id==='MEP-072'),true);
 m['engineering-coordination'].input.floorHeight=3;assert.equal(deriveProjectThread(m).issues.some(i=>i.id==='MEP-072'),false);
});

test('worked coordination and tracking are visible despite upstream gates, seeded keys are not',()=>{
 const src=fs.readFileSync(new URL('../app/components/ProjectKernel.tsx',import.meta.url),'utf8');
 const fn=src.slice(src.indexOf('export function deriveProjectJourneyState'),src.indexOf('const createDefaultProject')).replace('export function','function').replace('thread: ProjectThread','thread');
 const steps=[{short:'Brief',projectKeys:['decision-assistant']},{short:'Arazi',projectKeys:['geo-parcel']},{short:'Mimari',projectKeys:['architectural-program','plan-editor']},{short:'Sistem',projectKeys:['system-comparison']},{short:'Koordinasyon',projectKeys:['engineering-coordination']},{short:'Planlama',projectKeys:['project-os']},{short:'Teslim',projectKeys:['digital-delivery-scope']}];
 const javascript=ts.transpileModule(fn,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
 const derive=new Function('PROJECT_JOURNEY',javascript+';return deriveProjectJourneyState;')(steps);
 const thread={canonical:{structure:{system:''}},nodes:[{id:'decision-assistant',active:true},{id:'engineering-coordination',active:true,worked:true},{id:'project-os',active:true,worked:true}]};
 const worked=derive(thread);assert.equal(worked.workingIndex,5);assert.equal(worked.achieved[4],true);assert.equal(worked.achieved[5],true);assert.equal(worked.completed[4],false);assert.equal(worked.completed[5],false);
 thread.nodes[1].worked=false;thread.nodes[2].worked=false;assert.equal(derive(thread).workingIndex,1);
});
