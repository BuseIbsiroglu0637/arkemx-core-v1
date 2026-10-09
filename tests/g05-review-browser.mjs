// Synthetic behavioral review; no engineering or project approval evidence.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {chromium} from 'playwright';
import {encodeProjectEnvelope} from '../app/lib/project-storage.ts';
const out=path.resolve(process.env.ARKEMX_G05_EVIDENCE_DIR);
const fixture=JSON.parse(fs.readFileSync('../../output/G05_Kalan_Isler_2026-10-09/browser_result.json')).finalProject;
const browser=await chromium.launch({headless:true,executablePath:process.env.ARKEMX_E2E_BROWSER});
const context=await browser.newContext(), page=await context.newPage();
const reports=[], errors=[]; page.on('pageerror',error=>errors.push(String(error)));
const root='http://127.0.0.1:5173';
async function seed(p,url){await page.goto(root);await page.evaluate(raw=>{localStorage.clear();sessionStorage.clear();localStorage.setItem('arkem-project-kernel-v2',raw);},encodeProjectEnvelope(p));await page.goto(root+url);}
async function stored(){return page.evaluate(()=>JSON.parse(localStorage.getItem('arkem-project-kernel-v2')).payload);}
async function check(name,fn){errors.length=0;try{await fn();assert.deepEqual(errors,[]);reports.push({name,pass:true});}catch(error){reports.push({name,pass:false,error:String(error),pageErrors:errors.slice(),body:await page.locator('body').innerText()});await page.screenshot({path:path.join(out,'review-failure-'+reports.length+'.png'),fullPage:true});}}
try{
 await check('Malformed structural floor collection stays unsupported without crashing',async()=>{
  const p=structuredClone(fixture);p.modules['structural-concept'].modelContext.floorPlates={bad:true};await seed(p,'/tasiyici-on-tasarim');
  await page.getByTestId('nonuniform-floor-warning').waitFor({timeout:5000});
  const event=page.waitForEvent('download');await page.getByRole('button',{name:'Girdileri ve analiz sınırını indir',exact:true}).click();
  const exported=JSON.parse(fs.readFileSync(await (await event).path(),'utf8'));assert.equal(exported.result,null);assert.equal(exported.structuralStudio,null);assert.match(exported.geometrySupport.status,/unsupported/);
  assert.deepEqual((await stored()).modules['structural-concept'].modelContext.floorPlates,{bad:true});
 });
 await check('Unsupported dimensional units block analysis and positive exports',async()=>{
  const p=structuredClone(fixture), structure=structuredClone(p.modules['structural-concept']);
  structure.units.length='mm';delete structure.sourceRevision;delete structure.inputElementIds;delete structure.inputElementSnapshot;delete structure.inputGeometrySnapshot;delete structure.modelContext;delete structure.geometrySupport;
  p.modules={'structural-concept':structure};await seed(p,'/tasiyici-on-tasarim');await page.getByTestId('nonuniform-floor-warning').waitFor({timeout:5000});
  assert.equal(await page.getByRole('button',{name:/A3 kurumsal teknik pafta|Ön boyutlandırma tablosu/}).count(),0);
  const event=page.waitForEvent('download');await page.getByRole('button',{name:'Girdileri ve analiz sınırını indir',exact:true}).click();
  const exported=JSON.parse(fs.readFileSync(await (await event).path(),'utf8'));assert.equal(exported.result,null);assert.equal(exported.structuralStudio,null);assert.equal(exported.units.length,'mm');assert.equal((await stored()).modules['structural-concept'].units.length,'mm');
 });
 await check('Valid native standalone study still calculates and exports the declared geometry',async()=>{
  const p=structuredClone(fixture), structure=structuredClone(p.modules['structural-concept']);
  delete structure.sourceRevision;delete structure.inputElementIds;delete structure.inputElementSnapshot;delete structure.inputGeometrySnapshot;delete structure.modelContext;delete structure.geometrySupport;
  delete structure.handoff;p.id='G05-NATIVE-CONTROL';structure._kernel={...structure._kernel,projectId:p.id,sourceModule:'structural-concept'};
  structure.input={...structure.input,width:20,depth:10,floors:2,floorHeight:3.4};p.modules={'structural-concept':structure};
  await seed(p,'/tasiyici-on-tasarim');
  await page.waitForFunction(()=>{const p=JSON.parse(localStorage.getItem('arkem-project-kernel-v2')).payload;return p.id==='G05-NATIVE-CONTROL'&&p.modules['structural-concept'].result?.geometry?.totalArea===400&&p.modules['structural-concept'].geometrySupport?.status==='uniform-concept-only';});
  await page.getByRole('button',{name:'Miktar / çıktı',exact:true}).click();
  const [download]=await Promise.all([page.waitForEvent('download',{timeout:10000}),page.getByRole('button',{name:/Tüm girdiler.*izlenebilir sonuç/}).click({timeout:10000})]);
  const exported=JSON.parse(fs.readFileSync(await download.path(),'utf8'));assert.equal(exported.result.geometry.totalArea,400);assert.equal(exported.units.length,'m');assert.equal(exported.geometrySupport.status,'uniform-concept-only');assert.equal(exported.documentIdentity.references.calculationIds,null);
 });
 await check('Mounted RFI revision change retains identity but resets prior revision review',async()=>{
  const p=structuredClone(fixture);p.modules['project-os'].workItems=[];await seed(p,'/proje-takibi');await page.getByTestId('project-operating-system').waitFor();
  const card=page.locator('.arx-track-item').filter({has:page.getByRole('heading',{name:'SYNTHETIC-RFI-A',exact:true})});
  await card.getByRole('button',{name:'İncele',exact:true}).click();await card.getByRole('button',{name:'Kapat',exact:true}).waitFor();
  const next=await stored(), priorId=next.modules['project-os'].workItems.find(i=>i.sourceGuid==='A').id;
  next.revision='P03';next.updatedAt=new Date().toISOString();for(const sourceModule of Object.values(next.modules))if(sourceModule._kernel)sourceModule._kernel.projectRevision='P03';if(next.modules['structural-concept'].sourceRevision)next.modules['structural-concept'].sourceRevision='P03';
  await page.evaluate(raw=>{localStorage.setItem('arkem-project-kernel-v2',raw);window.dispatchEvent(new StorageEvent('storage',{key:'arkem-project-kernel-v2',storageArea:localStorage,newValue:raw}));},encodeProjectEnvelope(next));
  await card.getByRole('button',{name:'İncele',exact:true}).waitFor({timeout:5000});
  await page.waitForFunction(()=>JSON.parse(localStorage.getItem('arkem-project-kernel-v2')).payload.modules['project-os'].workItems.some(i=>i.sourceGuid==='A'&&i.revision==='P03'&&i.status==='open'));
  assert.equal((await stored()).modules['project-os'].workItems.find(i=>i.sourceGuid==='A').id,priorId);
 });
}finally{await browser.close();fs.writeFileSync(path.join(out,'review-browser-result.json'),JSON.stringify({clientDate:'2026-10-09',fixture:'synthetic',reports,technicalApproval:false},null,2));}
console.log(JSON.stringify({pass:reports.filter(r=>r.pass).length,fail:reports.filter(r=>!r.pass).length}));
if(reports.some(r=>!r.pass))process.exitCode=1;
