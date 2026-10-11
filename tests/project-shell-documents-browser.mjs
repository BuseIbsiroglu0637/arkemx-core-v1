import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';import {registerHooks} from 'node:module';import {chromium} from 'playwright';
registerHooks({resolve(s,c,next){if(s.startsWith('.')&&!path.extname(s)){const u=new URL(s+'.ts',c.parentURL);if(fs.existsSync(fileURLToPath(u)))return next(u.href,c);}return next(s,c);}});
const {createProjectShellFixture,createProjectShellFixtureSource}=await import('./fixtures/project-shell-project.mjs'),{encodeProjectEnvelope}=await import('../app/lib/project-storage.ts');
const base=process.env.ARKEMX_E2E_BASE_URL??'http://127.0.0.1:5187',out=path.resolve(process.env.ARKEMX_G05_EVIDENCE_DIR??'test-artifacts/g05');fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.ARKEMX_E2E_BROWSER}),reports=[];
async function check(name,fn){const context=await browser.newContext({acceptDownloads:true}),page=await context.newPage(),errors=[];page.setDefaultTimeout(30000);page.on('pageerror',e=>errors.push(String(e)));try{await fn(page);assert.deepEqual(errors,[]);reports.push({name,pass:true});}catch(e){reports.push({name,pass:false,error:String(e),pageErrors:errors,body:await page.locator('body').innerText()});await page.screenshot({path:path.join(out,'project-shell-documents-failure-'+reports.length+'.png'),fullPage:true});}finally{await context.close();}}
async function seed(page){const p=createProjectShellFixture();p.modules['plan-editor'].projectShellSources=Object.fromEntries([1,2].map(l=>{const s=createProjectShellFixtureSource(p,l);return[s.sourcePlateId,s];}));await page.goto(base);await page.evaluate(raw=>{localStorage.clear();sessionStorage.clear();localStorage.setItem('arkem-project-kernel-v2',raw);},encodeProjectEnvelope(p));await page.goto(base+'/plan-ve-aks');await page.getByTestId('project-shell-calculation').waitFor();return p;}
async function calculate(page){await page.getByRole('button',{name:'Proje döşemesinin kabuk hesabını çalıştır',exact:true}).click();await page.getByTestId('project-shell-calculation-id').waitFor();await page.getByTestId('project-shell-documents').waitFor();return page.getByTestId('project-shell-calculation-id').innerText();}
async function download(page,format,name){const pending=page.waitForEvent('download');await page.getByRole('button',{name:'Proje kabuk '+format+' indir',exact:true}).click();const d=await pending;const file=path.join(out,name+'.'+format.toLowerCase());await d.saveAs(file);await page.getByRole('button',{name:'Proje kabuk '+format+' indir',exact:true}).waitFor({state:'visible'});return file;}
let portable;
try {
await check('A04 two floors export real worker JSON/PDF/DXF with same source identities and raw Gauss screen',async page=>{
 const p=await seed(page),ids=[];
 for(const [i,s] of Object.values(p.modules['plan-editor'].projectShellSources).entries()){
  await page.getByLabel('Kabuk kaynak döşemesi',{exact:true}).selectOption(s.sourcePlateId);ids.push(await calculate(page));
  await page.getByLabel('Proje kabuk yük durumu').selectOption('Q');await page.getByLabel('Proje kabuk sonuç alanı').selectOption('Myy');
  const file=await download(page,'JSON','project-shell-browser-floor-'+(i+1));if(i===0)portable=file;
  const pkg=JSON.parse(fs.readFileSync(file,'utf8'));assert.equal(pkg.manifest.sourcePlateId,s.sourcePlateId);assert.equal(pkg.manifest.view.caseId,'Q');assert.equal(pkg.manifest.view.field,'Myy');assert.equal(pkg.calculation.content.cases.length,5);assert.equal(pkg.technicalApproval,false);
  if(i===1){for(const format of ['PDF','DXF']){const file=await download(page,format,'project-shell-browser-floor-2');assert.ok(fs.statSync(file).size>1000);}await page.getByTestId('project-shell-documents').screenshot({path:path.join(out,'project-shell-documents-screen.png')});}
 }
 assert.notEqual(ids[0],ids[1]);
});
await check('A04 clean browser reads preview without mutation, explicitly restores project and calculation, survives reload',async page=>{
 assert.ok(portable);await page.goto(base+'/plan-ve-aks');await page.getByLabel('Proje kabuk yedeği',{exact:true}).waitFor();await page.waitForFunction(()=>{const raw=localStorage.getItem('arkem-project-kernel-v2');if(!raw)return false;if(window.__baseline!==raw){window.__baseline=raw;window.__baselineTime=Date.now();}return Date.now()-window.__baselineTime>600;});const before=await page.evaluate(()=>localStorage.getItem('arkem-project-kernel-v2'));
 await page.getByLabel('Proje kabuk yedeği',{exact:true}).setInputFiles(portable);await page.getByTestId('project-shell-package-preview').waitFor();assert.equal(await page.evaluate(()=>localStorage.getItem('arkem-project-kernel-v2')),before);
 await page.getByRole('button',{name:'Paketin projesini ve hesabını aç',exact:true}).click();await page.getByTestId('project-shell-calculation-id').waitFor();const pkg=JSON.parse(fs.readFileSync(portable,'utf8'));
 assert.match(await page.getByTestId('project-shell-calculation-id').innerText(),new RegExp(pkg.calculation.id));await page.reload();await page.getByTestId('project-shell-calculation-id').waitFor();assert.match(await page.getByTestId('project-shell-calculation-id').innerText(),new RegExp(pkg.calculation.id));
});
await check('A04 fabricated package does not replace current project or committed calculation',async page=>{
 await seed(page);const id=await calculate(page),before=await page.evaluate(()=>localStorage.getItem('arkem-project-kernel-v2'));
 const pkg=JSON.parse(fs.readFileSync(portable,'utf8'));pkg.calculation.content.cases[0].centerUz=123;
 await page.getByLabel('Proje kabuk yedeği',{exact:true}).setInputFiles({name:'forged.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(pkg))});
 await page.getByTestId('project-shell-package-status').filter({hasText:'eşleşmiyor'}).waitFor();assert.equal(await page.getByTestId('project-shell-package-preview').count(),0);assert.equal(await page.getByTestId('project-shell-calculation-id').innerText(),id);assert.equal(await page.evaluate(()=>localStorage.getItem('arkem-project-kernel-v2')),before);
});
await check('A04 failed storage during restore preserves current project and previous committed record',async page=>{
 await seed(page);const id=await calculate(page),before=await page.evaluate(()=>localStorage.getItem('arkem-project-kernel-v2'));
 await page.getByLabel('Proje kabuk yedeği',{exact:true}).setInputFiles(portable);await page.getByTestId('project-shell-package-preview').waitFor();
 await page.evaluate(()=>{const old=IDBObjectStore.prototype.put;IDBObjectStore.prototype.put=function(...args){if(this.name==='records')throw new DOMException('Fixture quota exceeded','QuotaExceededError');return old.apply(this,args);};});
 await page.getByRole('button',{name:'Paketin projesini ve hesabını aç',exact:true}).click();await page.getByTestId('project-shell-package-status').filter({hasText:'Fixture quota'}).waitFor();assert.equal(await page.evaluate(()=>localStorage.getItem('arkem-project-kernel-v2')),before);assert.equal(await page.getByTestId('project-shell-calculation-id').innerText(),id);
 await page.reload();await page.getByTestId('project-shell-calculation-id').waitFor();assert.equal(await page.getByTestId('project-shell-calculation-id').innerText(),id);
});
await check('A04 canceled preflight cannot publish stale preview or change active project',async page=>{
 await seed(page);const before=await page.evaluate(()=>localStorage.getItem('arkem-project-kernel-v2'));
 await page.evaluate(()=>{const old=Worker.prototype.postMessage;Worker.prototype.postMessage=function(data,...args){if(data.operation==='project-package')setTimeout(()=>{try{old.call(this,data,...args);}catch{}},500);else old.call(this,data,...args);};});
 await page.getByLabel('Proje kabuk yedeği',{exact:true}).setInputFiles(portable);await page.getByRole('button',{name:'Proje kabuk yedeğini iptal et',exact:true}).click();await page.waitForTimeout(700);
 assert.equal(await page.getByTestId('project-shell-package-preview').count(),0);assert.equal(await page.evaluate(()=>localStorage.getItem('arkem-project-kernel-v2')),before);
});
}finally{await browser.close();fs.writeFileSync(path.join(out,'project-shell-documents-browser.json'),JSON.stringify({date:new Date().toISOString(),reports,fullBuildingAnalysis:false,technicalApproval:false},null,2));}
console.log(JSON.stringify(reports,null,2));assert.ok(reports.every(r=>r.pass),'Project shell document browser checks failed');
