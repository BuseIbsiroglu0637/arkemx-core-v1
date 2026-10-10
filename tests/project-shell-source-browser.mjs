import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { registerHooks } from 'node:module';
import { chromium } from 'playwright';
registerHooks({resolve(s,c,next){if(s.startsWith('.')&&!path.extname(s)){const u=new URL(s+'.ts',c.parentURL);if(fs.existsSync(fileURLToPath(u)))return next(u.href,c);}return next(s,c);}});
const {createProjectShellFixture,createProjectShellFixtureSource}=await import('./fixtures/project-shell-project.mjs');
const {encodeProjectEnvelope}=await import('../app/lib/project-storage.ts');
const root=process.env.ARKEMX_E2E_BASE_URL??'http://127.0.0.1:5187';
const out=path.resolve(process.env.ARKEMX_G05_EVIDENCE_DIR??'test-artifacts/g05');fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.ARKEMX_E2E_BROWSER}),reports=[];
async function stored(page){return page.evaluate(()=>JSON.parse(localStorage.getItem('arkem-project-kernel-v2')).payload);}
async function seed(page,p){await page.goto(root);await page.evaluate(raw=>{localStorage.clear();sessionStorage.clear();localStorage.setItem('arkem-project-kernel-v2',raw);},encodeProjectEnvelope(p));await page.goto(root+'/plan-ve-aks');await page.getByTestId('project-shell-source').waitFor();}
async function saveSource(page,s,{file=false}={}){
  await page.getByLabel('Kabuk kaynak döşemesi',{exact:true}).selectOption(s.sourcePlateId);
  if(file)await page.getByLabel('Proje kabuk kaynağı dosyası',{exact:true}).setInputFiles({name:'source.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(s))});
  else await page.getByLabel('Proje kabuk kaynağı JSON',{exact:true}).fill(JSON.stringify(s));
  await page.getByRole('button',{name:'Kabuk kaynağını doğrula ve kaydet',exact:true}).click();
}
async function check(name,fn){const context=await browser.newContext(),page=await context.newPage(),errors=[];page.setDefaultTimeout(20000);page.on('pageerror',e=>errors.push(String(e)));try{await fn(page);assert.deepEqual(errors,[]);reports.push({name,pass:true});}catch(error){reports.push({name,pass:false,error:String(error),pageErrors:errors,body:await page.locator('body').innerText()});await page.screenshot({path:path.join(out,'project-shell-source-failure-'+reports.length+'.png'),fullPage:true});}finally{await context.close();}}
try{
await check('S4-A01 restoring an automatic legacy plan does not replay its historical handoff; a deliberate rebuild creates stable IDs',async page=>{
  const p=createProjectShellFixture({legacy:true}),plan=p.modules['plan-editor'];
  p.experience.autoHandoff=true;plan.handoff={id:'H-02',source:'architectural-program',target:'plan-editor',synchronizedAt:p.updatedAt,state:'synchronized'};
  const before=structuredClone(plan.floorPlates);
  await seed(page,p);assert.deepEqual((await stored(page)).modules['plan-editor'].floorPlates,before);
  await page.reload();await page.getByTestId('project-shell-source').waitFor();assert.deepEqual((await stored(page)).modules['plan-editor'].floorPlates,before);
  await page.getByRole('button',{name:'Kat plakalarını programa göre dağıt',exact:true}).click();
  await page.waitForFunction(()=>JSON.parse(localStorage.getItem('arkem-project-kernel-v2')).payload.modules['plan-editor'].floorPlates.every(p=>p.id));
  const rebuilt=(await stored(page)).modules['plan-editor'].floorPlates;
  assert.ok(rebuilt.every(p=>p.id.startsWith('PLATE:')));assert.equal(new Set(rebuilt.map(p=>p.id)).size,2);
  await page.getByRole('button',{name:'Kat plakalarını programa göre dağıt',exact:true}).click();
  assert.deepEqual((await stored(page)).modules['plan-editor'].floorPlates,rebuilt);
  await page.reload();await page.getByTestId('project-shell-source').waitFor();assert.deepEqual((await stored(page)).modules['plan-editor'].floorPlates,rebuilt);
});
await check('S4-A01 explicitly migrates legacy floor identities, rechecks coordination, stores two sources and preserves them on reload',async page=>{
  const p=createProjectShellFixture({legacy:true}), geometry=structuredClone(p.modules['plan-editor'].floorPlates);
  await seed(page,p);assert.ok((await stored(page)).modules['plan-editor'].floorPlates.every(p=>p.id===undefined));
  await page.getByRole('button',{name:'Eski döşemelere kalıcı kimlik ver',exact:true}).click();
  await page.waitForFunction(()=>JSON.parse(localStorage.getItem('arkem-project-kernel-v2')).payload.modules['plan-editor'].floorPlates.every(p=>p.id));
  const migrated=(await stored(page)).modules['plan-editor'].floorPlates;
  assert.deepEqual(migrated.map(({id,...p})=>{void id;return p;}),geometry);
  assert.match(await page.getByTestId('floor-coordination-status').innerText(),/doğrulanacak/);
  await page.getByRole('button',{name:'Kat konumlarını ve kirişleri kaydet',exact:true}).click();
  await page.getByRole('img',{name:'Katların ortak koordinatlarda üstten görünümü'}).waitFor();
  for(const level of [1,2]){
    const s=createProjectShellFixtureSource(await stored(page),level);await saveSource(page,s,{file:level===2});
    await page.waitForFunction(id=>!!JSON.parse(localStorage.getItem('arkem-project-kernel-v2')).payload.modules['plan-editor'].projectShellSources?.[id],s.sourcePlateId);
    assert.match(await page.getByTestId('project-shell-status').innerText(),/güncel ve doğrulandı/);
  }
  const saved=await stored(page), sources=saved.modules['plan-editor'].projectShellSources;
  assert.equal(Object.keys(sources).length,2);
  for(const source of Object.values(sources)){assert.equal(source.technicalApproval,false);assert.equal(source.fullBuildingAnalysis,false);assert.equal(source.calculation,undefined);}
  assert.equal(saved.modules['structural-concept'].result,null);assert.equal(saved.modules['structural-concept'].calculationId,null);
  assert.equal(saved.modules['plan-editor'].shellRegistry,undefined);
  await page.reload();await page.getByTestId('project-shell-source').waitFor();
  assert.deepEqual((await stored(page)).modules['plan-editor'].floorPlates,migrated);
  assert.deepEqual((await stored(page)).modules['plan-editor'].projectShellSources,sources);
  for(const plate of migrated){await page.getByLabel('Kabuk kaynak döşemesi',{exact:true}).selectOption(plate.id);assert.match(await page.getByTestId('project-shell-status').innerText(),/güncel ve doğrulandı/);}
  await page.getByTestId('project-shell-source').screenshot({path:path.join(out,'project-shell-source-validated.png')});
  fs.writeFileSync(path.join(out,'project-shell-source-saved-project.json'),JSON.stringify(await stored(page),null,2));
});
await check('S4-A01 resizing preserves identity and blocks stale source; a blank draft never silently rebinds physical values',async page=>{
  const p=createProjectShellFixture(),plan=p.modules['plan-editor'],s=createProjectShellFixtureSource(p,2);plan.projectShellSources={[s.sourcePlateId]:s};
  await seed(page,p);await page.getByLabel('Kabuk kaynak döşemesi',{exact:true}).selectOption(s.sourcePlateId);
  await page.getByLabel('X açıklığı').first().fill('11');
  await page.waitForFunction(()=>JSON.parse(localStorage.getItem('arkem-project-kernel-v2')).payload.modules['plan-editor'].floorPlates.find(p=>p.level===2).width===22);
  assert.equal((await stored(page)).modules['plan-editor'].floorPlates.find(p=>p.level===2).id,s.sourcePlateId);
  assert.match(await page.getByTestId('project-shell-status').innerText(),/güncel değil/);
  assert.deepEqual((await stored(page)).modules['plan-editor'].projectShellSources[s.sourcePlateId],s);
  await page.getByRole('button',{name:'Kat konumlarını ve kirişleri kaydet',exact:true}).click();
  await page.getByRole('button',{name:'Boş proje kabuk kaynağı oluştur',exact:true}).click();
  const draft=JSON.parse(await page.getByLabel('Proje kabuk kaynağı JSON',{exact:true}).inputValue());
  assert.equal(draft.plate.width,22);assert.equal(draft.material.E,null);assert.equal(draft.midSurfaceReference.offsetZ,null);assert.equal(draft.supports.preset,null);
  await page.getByRole('button',{name:'Kabuk kaynağını doğrula ve kaydet',exact:true}).click();
  assert.match(await page.getByTestId('project-shell-message').innerText(),/köken/);
  assert.deepEqual((await stored(page)).modules['plan-editor'].projectShellSources[s.sourcePlateId],s);
  await page.getByTestId('project-shell-source').screenshot({path:path.join(out,'project-shell-source-stale.png')});
});
await check('S4-A01 invalid imported JSON and foreign plate/project references cannot replace a validated source',async page=>{
  const p=createProjectShellFixture(),s=createProjectShellFixtureSource(p);p.modules['plan-editor'].projectShellSources={[s.sourcePlateId]:s};
  await seed(page,p);
  for(const bad of [{...s,projectId:'FOREIGN'},createProjectShellFixtureSource(p,2),{...s,technicalApproval:true}]){
    await page.getByLabel('Proje kabuk kaynağı JSON',{exact:true}).fill(JSON.stringify(bad));
    await page.getByRole('button',{name:'Kabuk kaynağını doğrula ve kaydet',exact:true}).click();
    assert.ok(await page.getByTestId('project-shell-message').innerText());
    assert.deepEqual((await stored(page)).modules['plan-editor'].projectShellSources,{[s.sourcePlateId]:s});
  }
  await page.getByLabel('Proje kabuk kaynağı JSON',{exact:true}).fill('{broken');
  await page.getByRole('button',{name:'Kabuk kaynağını doğrula ve kaydet',exact:true}).click();
  assert.deepEqual((await stored(page)).modules['plan-editor'].projectShellSources,{[s.sourcePlateId]:s});
  assert.match(await page.getByTestId('project-shell-status').innerText(),/güncel ve doğrulandı/);
});
}finally{await browser.close();fs.writeFileSync(path.join(out,'project-shell-source-result.json'),JSON.stringify({executedAt:new Date().toISOString(),fixture:'synthetic-project',reports,calculation:null,technicalApproval:false,fullBuildingAnalysis:false},null,2));}
console.log(JSON.stringify({suite:'project-shell-source',pass:reports.filter(r=>r.pass).length,fail:reports.filter(r=>!r.pass).length}));if(reports.some(r=>!r.pass))process.exitCode=1;
