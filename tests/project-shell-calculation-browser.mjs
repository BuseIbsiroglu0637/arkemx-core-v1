import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';import {registerHooks} from 'node:module';import {chromium} from 'playwright';
registerHooks({resolve(s,c,next){if(s.startsWith('.')&&!path.extname(s)){const u=new URL(s+'.ts',c.parentURL);if(fs.existsSync(fileURLToPath(u)))return next(u.href,c);}return next(s,c);}});
const {createProjectShellFixture,createProjectShellFixtureSource}=await import('./fixtures/project-shell-project.mjs');
const {encodeProjectEnvelope}=await import('../app/lib/project-storage.ts');
const base=process.env.ARKEMX_E2E_BASE_URL??'http://127.0.0.1:5187',out=path.resolve(process.env.ARKEMX_G05_EVIDENCE_DIR??'test-artifacts/g05');fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.ARKEMX_E2E_BROWSER}),reports=[];
async function seed(page){const p=createProjectShellFixture();p.modules['plan-editor'].projectShellSources=Object.fromEntries([1,2].map(l=>{const s=createProjectShellFixtureSource(p,l);return[s.sourcePlateId,s];}));await page.goto(base);await page.evaluate(raw=>{localStorage.clear();sessionStorage.clear();localStorage.setItem('arkem-project-kernel-v2',raw);},encodeProjectEnvelope(p));await page.goto(base+'/plan-ve-aks');await page.getByTestId('project-shell-calculation').waitFor();return p;}
async function check(name,fn){const context=await browser.newContext(),page=await context.newPage(),errors=[];page.setDefaultTimeout(20000);page.on('pageerror',e=>errors.push(String(e)));try{await fn(page);assert.deepEqual(errors,[]);reports.push({name,pass:true});}catch(e){reports.push({name,pass:false,error:String(e),pageErrors:errors,body:await page.locator('body').innerText()});await page.screenshot({path:path.join(out,'project-shell-calculation-failure-'+reports.length+'.png'),fullPage:true});}finally{await context.close();}}
try{
await check('S4-A02/A03 UI solves each selected plate and restores verified results without writing raw data to project storage',async page=>{
 const p=await seed(page),sources=p.modules['plan-editor'].projectShellSources,ids=[];
 for(const source of Object.values(sources)){
  await page.getByLabel('Kabuk kaynak döşemesi',{exact:true}).selectOption(source.sourcePlateId);
  await page.getByRole('button',{name:'Proje döşemesinin kabuk hesabını çalıştır',exact:true}).click();
  await page.getByTestId('project-shell-calculation-id').waitFor();
  await page.waitForFunction(()=>document.querySelector('[data-testid="project-shell-storage-status"]')?.textContent.includes('Cihaza kaydedildi'));
  const id=await page.getByTestId('project-shell-calculation-id').innerText();ids.push(id);assert.ok(id.includes(source.sourcePlateId)&&id.includes('PROJECT-SHELL-CALC-')&&id.includes('PROJECT-SHELL-SOURCE-'));
  assert.match(await page.getByTestId('project-shell-calculation').innerText(),new RegExp(`Alan: ${source.plate.width*source.plate.depth} m²`));
  await page.getByTestId('project-shell-calculation').screenshot({path:path.join(out,`project-shell-calculation-K${source.plate.sourceLevel}.png`)});
 }
 assert.notEqual(ids[0],ids[1]);
 const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('arkem-project-kernel-v2')).payload);
 assert.deepEqual(saved.modules['plan-editor'].projectShellSources,sources);assert.equal(saved.modules['plan-editor'].projectShellCalculations,undefined);assert.equal(saved.modules['structural-concept'].result,null);
 await page.reload();await page.getByTestId('project-shell-calculation-id').waitFor();
 assert.ok(ids.includes(await page.getByTestId('project-shell-calculation-id').innerText()));
 await page.getByRole('button',{name:'Proje döşemesinin kabuk hesabını çalıştır',exact:true}).click();await page.getByTestId('project-shell-calculation-id').waitFor();
 await page.getByLabel('X açıklığı').first().fill('11');
 await page.waitForFunction(()=>!document.querySelector('[data-testid="project-shell-calculation"]'));
 assert.match(await page.getByTestId('project-shell-status').innerText(),/güncel değil/);
});
await check('S4-A02 real worker emits an intact project source record and recomputation refuses rehashed forged results',async page=>{
 await seed(page);
 const result=await page.evaluate(async()=>{
  const {calculateProjectShellInWorker}=await import('/app/lib/project-shell-worker-client.ts');const {verifyProjectShellCalculation}=await import('/app/lib/project-shell-calculation.ts');const {traceJson,traceSha256}=await import('/app/lib/structural-traceability.ts');
  const p=JSON.parse(localStorage.getItem('arkem-project-kernel-v2')).payload,s=Object.values(p.modules['plan-editor'].projectShellSources)[0];const r=await calculateProjectShellInWorker(p,s);
  const valid=await verifyProjectShellCalculation(r,p,s),forged=structuredClone(r);forged.content.cases[0].centerUz=123;forged.sha256=await traceSha256(traceJson(forged.content));forged.id='PROJECT-SHELL-CALC-'+forged.sha256;
  return{record:r,valid,forgedAccepted:await verifyProjectShellCalculation(forged,p,s),schema:r.content.sourceRecord.content.source.schema,fixture:r.content.sourceRecord.content.source.fixture??null};
 });
 assert.equal(result.valid,true);assert.equal(result.forgedAccepted,false);assert.equal(result.schema,'ARKEM-PROJECT-SHELL-SOURCE/1.0');assert.equal(result.fixture,null);assert.equal(result.record.content.technicalApproval,false);assert.equal(result.record.content.fullBuildingAnalysis,false);
 fs.writeFileSync(path.join(out,'project-shell-worker-calculation.json'),JSON.stringify(result));
});
await check('S4-A02 bounded maximum mesh remains responsive and abort/error/source edits never attach a result',async page=>{
 await seed(page);
 const result=await page.evaluate(async()=>{
  const {calculateProjectShellInWorker}=await import('/app/lib/project-shell-worker-client.ts');
  const p=JSON.parse(localStorage.getItem('arkem-project-kernel-v2')).payload,s=Object.values(p.modules['plan-editor'].projectShellSources)[1];s.mesh={nx:64,ny:32};let ticks=0;const timer=setInterval(()=>ticks++,10);
  try{
   const r=await calculateProjectShellInWorker(p,s),ac=new AbortController(),pending=calculateProjectShellInWorker(p,s,{signal:ac.signal});setTimeout(()=>ac.abort(),100);let aborted='unexpected result';try{await pending;}catch(e){aborted=e.name;}
   let invalid='unexpected result';try{await calculateProjectShellInWorker(p,{...s,projectId:'FOREIGN'});}catch(e){invalid=e.message;}
   return{ticks,mesh:r.content.sourceRecord.content.meshCounts,aborted,invalid,caseCount:r.content.cases.length,approval:r.content.technicalApproval};
  }finally{clearInterval(timer);}
 });
 assert.ok(result.ticks>2);assert.deepEqual(result.mesh,{nodes:2145,elements:2048});assert.equal(result.aborted,'AbortError');assert.match(result.invalid,/Proje/);assert.equal(result.caseCount,5);assert.equal(result.approval,false);
 const text=await page.getByLabel('Proje kabuk kaynağı JSON',{exact:true});const p=JSON.parse(await page.evaluate(()=>localStorage.getItem('arkem-project-kernel-v2'))).payload,s=Object.values(p.modules['plan-editor'].projectShellSources)[0];s.mesh={nx:64,ny:32};await text.fill(JSON.stringify(s));await page.getByRole('button',{name:'Kabuk kaynağını doğrula ve kaydet',exact:true}).click();
 await page.getByRole('button',{name:'Proje döşemesinin kabuk hesabını çalıştır',exact:true}).click();
 await page.getByRole('button',{name:'Proje kabuk hesabını iptal et',exact:true}).click();
 await page.waitForFunction(()=>document.querySelector('[data-testid="project-shell-calculation-status"]')?.textContent.includes('geçerli proje kabuk hesabı yok'));
 assert.equal(await page.getByTestId('project-shell-calculation-id').count(),0);
 await page.getByRole('button',{name:'Proje döşemesinin kabuk hesabını çalıştır',exact:true}).click();
 await page.getByLabel('Kabuk kaynak döşemesi',{exact:true}).selectOption(p.modules['plan-editor'].floorPlates[1].id);
 assert.equal(await page.getByTestId('project-shell-calculation-id').count(),0);
 await page.waitForFunction(()=>document.querySelector('[data-testid="project-shell-calculation-status"]')?.textContent.includes('geçerli proje kabuk hesabı yok'));
});
}finally{await browser.close();fs.writeFileSync(path.join(out,'project-shell-calculation-result.json'),JSON.stringify({executedAt:new Date().toISOString(),fixture:'synthetic-project',reports,technicalApproval:false,fullBuildingAnalysis:false},null,2));}
console.log(JSON.stringify({suite:'project-shell-calculation',pass:reports.filter(r=>r.pass).length,fail:reports.filter(r=>!r.pass).length}));if(reports.some(r=>!r.pass))process.exitCode=1;
