import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium} from 'playwright';
import {encodeProjectEnvelope} from '../app/lib/project-storage.ts';
import {stampProjectModule} from '../app/lib/project-core.ts';
const base=process.env.ARKEMX_E2E_BASE_URL??'http://127.0.0.1:5199';
const stamp=(id,key,value)=>stampProjectModule(value,{projectId:id,projectRevision:'P01',sourceModule:key,recordedAt:new Date().toISOString(),action:'created'});
function project(id,old=false){
 const modules={};
 if(old)modules['plan-editor']=stamp(id,'plan-editor',{units:{schema:'ARKEM-UNITS/1.0',length:'m',area:'m2',force:'kN',surfaceLoad:'kN/m2',coordinates:'grid-bay'},level:1,floorCount:1,baysX:2,baysY:2,spanX:5,spanY:5,floorPlates:[{id:'PLATE:A',level:1,width:10,depth:10,netArea:50,grossArea:100}],elements:[{id:'OLD-ROOM',type:'space',level:1,x:0,y:0,label:'OLD PROJECT ROOM',orientation:'x',load:2,fire:'test',section:'test',provenance:'manual'}]});
 if(old)modules['project-os']=stamp(id,'project-os',{trackingDataStatus:'project-record',documents:[{code:'REAL-A',title:'Document A',status:'İncelemede',rev:'R01'}],week:2,decisions:[],handover:[true,false,false,false,false,false]});
 return {schema:'ARKEM-PROJECT/1.0',id,name:id,revision:'P01',phase:'Ön fizibilite',coordinateReference:'WGS84 / EPSG:4326',updatedAt:new Date().toISOString(),experience:{mode:'guided',autoHandoff:false,lastSynchronizedAt:''},modules,events:[]};
}
const browser=await chromium.launch({headless:true,executablePath:process.env.ARKEMX_E2E_BROWSER});
const ctx=await browser.newContext();const page=await ctx.newPage();const writer=await ctx.newPage();const errors=[],checks=[];page.on('pageerror',e=>errors.push(String(e)));
const stored=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('arkem-project-kernel-v2')).payload);
try{
 await page.addInitScript(raw=>{if(!localStorage.getItem('arkem-project-kernel-v2'))localStorage.setItem('arkem-project-kernel-v2',raw);},encodeProjectEnvelope(project('FIXTURE-A',true)));
 await page.goto(base+'/plan-ve-aks');await page.getByText('OLD PROJECT ROOM',{exact:true}).first().waitFor({state:'attached'});
 await writer.goto(base+'/robots.txt');
 const switchTo=async p=>{await writer.evaluate(raw=>localStorage.setItem('arkem-project-kernel-v2',raw),encodeProjectEnvelope(p));await page.getByRole('button',{name:p.name,exact:true}).waitFor();};
 await switchTo(project('FIXTURE-B'));await page.waitForFunction(()=>JSON.parse(localStorage.getItem('arkem-project-kernel-v2')).payload.modules['plan-editor']?.floorPlates?.length>0);
 let saved=await stored();assert.equal(saved.id,'FIXTURE-B');assert.equal(saved.modules['plan-editor'].elements.some(e=>e.id==='OLD-ROOM'),false);assert.equal(saved.modules['plan-editor'].floorPlates.some(p=>p.id==='PLATE:A'),false);checks.push('live project switch resets plan elements and plate identities');
 await page.goto(base+'/proje-takibi');await page.getByTestId('project-operating-system').waitFor();await page.waitForFunction(()=>JSON.parse(localStorage.getItem('arkem-project-kernel-v2')).payload.modules['project-os']?.trackingDataStatus==='project-record');
 saved=await stored();assert.deepEqual(saved.modules['project-os'].documents,[]);assert.deepEqual(saved.modules['project-os'].handover,Array(6).fill(false));assert.equal(saved.modules['project-os'].earnedValue,null);assert.equal(saved.modules['project-os'].week,0);assert.deepEqual(saved.modules['project-os'].workItems,[]);checks.push('new project has no illustrative progress, documents, tasks or approvals');
 await switchTo(project('FIXTURE-A',true));await page.waitForFunction(()=>JSON.parse(localStorage.getItem('arkem-project-kernel-v2')).payload.modules['project-os']?.documents?.[0]?.code==='REAL-A');
 await switchTo(project('FIXTURE-C'));await page.waitForFunction(()=>JSON.parse(localStorage.getItem('arkem-project-kernel-v2')).payload.modules['project-os']?.trackingDataStatus==='project-record');saved=await stored();assert.deepEqual(saved.modules['project-os'].documents,[]);assert.deepEqual(saved.modules['project-os'].handover,Array(6).fill(false));checks.push('tracking component resets while mounted on identity change');
 await page.reload();await page.getByTestId('project-operating-system').waitFor();assert.equal((await stored()).id,'FIXTURE-C');assert.deepEqual((await stored()).modules['project-os'].documents,[]);checks.push('reload preserves clean active project');
 const legacy=project('FIXTURE-LEGACY');legacy.modules['project-os']=stamp(legacy.id,'project-os',{week:17,documents:[{code:'DEMO',status:'Onaylı'}],handover:[true,true,true,false,false,false],earnedValue:{actual:43}});await switchTo(legacy);await page.getByTestId('legacy-tracking').waitFor();saved=await stored();assert.deepEqual(saved.modules['project-os'].documents,[]);assert.equal(saved.modules['project-os'].legacyTrackingSnapshot.documents[0].code,'DEMO');checks.push('legacy data archived without claiming approval');
 const before=JSON.stringify((await stored()).modules['project-os']);await page.goto(base+'/proje-os');await page.getByText('Örnek gösterim — bu veriler aktif proje kaydına yazılmaz.',{exact:true}).waitFor();assert.equal(JSON.stringify((await stored()).modules['project-os']),before);checks.push('demo view does not write example data to current project');
 assert.deepEqual(errors,[]);fs.writeFileSync('test-artifacts/workflow-fixes-browser.json',JSON.stringify({passed:true,checks,errors},null,2));console.log(JSON.stringify({passed:true,checks},null,2));
}finally{await browser.close();}
