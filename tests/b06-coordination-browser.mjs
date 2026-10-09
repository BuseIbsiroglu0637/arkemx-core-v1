import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { registerHooks } from 'node:module';
import { chromium } from 'playwright';
registerHooks({resolve(s,c,next){if(s.startsWith('.')&&!path.extname(s)){const u=new URL(s+'.ts',c.parentURL);if(fs.existsSync(fileURLToPath(u)))return next(u.href,c);}return next(s,c);}});
const {createB06CoordinationFixture,refreshCoordinationSource}=await import('./fixtures/b06-coordination-project.mjs');
const {encodeProjectEnvelope}=await import('../app/lib/project-storage.ts');
const root=process.env.ARKEMX_E2E_BASE_URL??'http://127.0.0.1:5187';
const out=path.resolve(process.env.ARKEMX_G05_EVIDENCE_DIR??'test-artifacts/g05');fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.ARKEMX_E2E_BROWSER}),reports=[];
async function stored(page){return page.evaluate(()=>JSON.parse(localStorage.getItem('arkem-project-kernel-v2')).payload);}
async function seed(page,p,url){await page.goto(root);await page.evaluate(raw=>{localStorage.clear();sessionStorage.clear();localStorage.setItem('arkem-project-kernel-v2',raw);},encodeProjectEnvelope(p));await page.goto(root+url);}
async function check(name,fn){const context=await browser.newContext(),page=await context.newPage(),errors=[];page.setDefaultTimeout(15000);page.on('pageerror',e=>errors.push(String(e)));try{await fn(page);assert.deepEqual(errors,[]);reports.push({name,pass:true});}catch(error){reports.push({name,pass:false,error:String(error),pageErrors:errors,body:await page.locator('body').innerText()});await page.screenshot({path:path.join(out,'b06-coordination-failure-'+reports.length+'.png'),fullPage:true});}finally{await context.close();}}
try{
await check('B06 users explicitly save shared floor coordinates and real-column beams; reload and H03 preserve sources',async page=>{
  const p=createB06CoordinationFixture({saved:false});p.experience.autoHandoff=true;
  await seed(page,p,'/plan-ve-aks');await page.getByTestId('floor-coordination-editor').waitFor();
  await page.getByRole('button',{name:'Kat konumlarını ve kirişleri kaydet',exact:true}).click();
  assert.match(await page.getByTestId('floor-coordination-editor').getByRole('alert').innerText(),/boş alan 0 kabul edilmez/);
  for(const [level,x,y,z] of [[1,0,0,0],[2,0,0,3.4]])for(const [label,value] of [['X',x],['Y',y],['kot Z',z]])await page.getByLabel(`K${level} ${label} (m)`,{exact:true}).fill(String(value));
  for(const [start,end] of [['L-A','L-B'],['U-A','U-B']]){await page.getByLabel('Başlangıç kolonu',{exact:true}).selectOption(start);await page.getByLabel('Bitiş kolonu',{exact:true}).selectOption(end);await page.getByRole('button',{name:'Kirişi taslağa ekle',exact:true}).click();}
  await page.getByRole('button',{name:'Kat konumlarını ve kirişleri kaydet',exact:true}).click();
  await page.getByRole('img',{name:'Katların ortak koordinatlarda üstten görünümü'}).waitFor();
  const saved=await stored(page);assert.equal(saved.modules['plan-editor'].floorCoordination.beams.length,2);
  assert.deepEqual(saved.modules['structural-concept'].inputGeometrySnapshot.floorCoordination,saved.modules['plan-editor'].floorCoordination);
  await page.reload();await page.getByRole('img',{name:'Katların ortak koordinatlarda üstten görünümü'}).waitFor();
  assert.deepEqual((await stored(page)).modules['plan-editor'].floorCoordination,saved.modules['plan-editor'].floorCoordination);
  await page.goto(root+'/tasiyici-on-tasarim');await page.getByTestId('column-continuity-results').waitFor();
  assert.match(await page.getByTestId('column-continuity-results').innerText(),/U-B: Geometrik eşleşme adayı.*L-B/s);
  assert.match(await page.getByTestId('beam-continuity-results').innerText(),/Geometrik eşleşme adayı/);
  const button=page.getByRole('button',{name:'Kat bazlı ön çalışmayı indir (JSON)',exact:true});await button.waitFor();await page.waitForFunction(()=>document.querySelector('[aria-label="Kat bazlı ön çalışmayı indir (JSON)"]')?.disabled===false);
  const event=page.waitForEvent('download');await button.click();const file=await event,bytes=fs.readFileSync(await file.path());fs.writeFileSync(path.join(out,'b06-common-coordination.json'),bytes);
  const exported=JSON.parse(bytes.toString());assert.equal(exported.studyRecord.content.coordination.geometry.columns.find(c=>c.id==='U-B').x,5);
  assert.equal(exported.studyRecord.content.coordination.technicalApproval,false);assert.equal(exported.studyRecord.content.fullBuildingAnalysis,false);
  const s=(await stored(page)).modules['structural-concept'];assert.equal(s.result,null);assert.equal(s.calculationId,null);assert.equal((await stored(page)).modules['arkem-x'],undefined);
  await page.screenshot({path:path.join(out,'b06-common-coordination.png'),fullPage:true});
});
await check('B06 shared offsets flag support conflicts; changed geometry cannot reuse saved coordination',async page=>{
  const p=createB06CoordinationFixture();p.modules['plan-editor'].floorCoordination.placements[1].x=7;refreshCoordinationSource(p);
  await seed(page,p,'/tasiyici-on-tasarim');await page.getByTestId('column-continuity-results').waitFor();
  assert.match(await page.getByTestId('column-continuity-results').innerText(),/Alt katta destek kaynağı yok/);
  const next=await stored(page);next.modules['plan-editor'].floorPlates[1].width=25;next.modules['plan-editor'].floorPlates[1].grossArea=250;refreshCoordinationSource(next);
  await seed(page,next,'/tasiyici-on-tasarim');await page.getByTestId('floor-coordination-status').waitFor();
  assert.match(await page.getByTestId('floor-coordination-status').innerText(),/doğrulanacak/);
  assert.equal(await page.getByRole('img',{name:'Katların ortak koordinatlarda üstten görünümü'}).count(),0);
  assert.equal(await page.getByTestId('column-continuity-results').count(),0);
  assert.equal((await stored(page)).modules['plan-editor'].floorCoordination.basis,next.modules['plan-editor'].floorCoordination.basis);
});
await check('B06 identical shifted plates still block the uniform whole-building engine',async page=>{
  const p=createB06CoordinationFixture(),plan=p.modules['plan-editor'];plan.floorPlates[1]={...plan.floorPlates[0],level:2};plan.floorCoordination.placements[1].x=4;
  const {floorCoordinationBasis}=await import('../app/lib/floor-coordination.ts');plan.floorCoordination.basis=floorCoordinationBasis(plan);refreshCoordinationSource(p);
  p.modules['structural-concept'].geometrySupport={status:'uniform-concept-only',fullBuildingAnalysis:false,technicalApproval:false};
  await seed(page,p,'/tasiyici-on-tasarim');await page.getByTestId('nonuniform-floor-warning').waitFor();
  await page.getByTestId('floor-coordination-status').waitFor();assert.equal((await stored(page)).modules['structural-concept'].result,null);
});
}finally{await browser.close();fs.writeFileSync(path.join(out,'b06-coordination-result.json'),JSON.stringify({executedAt:new Date().toISOString(),fixture:'synthetic',reports,technicalApproval:false},null,2));}
console.log(JSON.stringify({suite:'b06-coordination',pass:reports.filter(r=>r.pass).length,fail:reports.filter(r=>!r.pass).length}));if(reports.some(r=>!r.pass))process.exitCode=1;
