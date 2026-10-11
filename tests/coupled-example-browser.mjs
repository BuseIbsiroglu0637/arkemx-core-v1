import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {chromium} from 'playwright';
import {registerHooks} from 'node:module';
import {fileURLToPath} from 'node:url';
registerHooks({resolve(s,c,next){if(s.startsWith('.')&&!path.extname(s)){const u=new URL(s+'.ts',c.parentURL);if(fs.existsSync(fileURLToPath(u)))return next(u.href,c);}return next(s,c);}});
const {encodeProjectEnvelope}=await import('../app/lib/project-storage.ts');
const {createProjectShellFixture}=await import('./fixtures/project-shell-project.mjs');
const out=path.resolve(process.env.ARKEMX_G05_EVIDENCE_DIR??'test-artifacts/g05');fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true,...(process.env.ARKEMX_E2E_BROWSER?{executablePath:process.env.ARKEMX_E2E_BROWSER}:{})});
const page=await browser.newPage(),errors=[],checks=[];page.on('pageerror',e=>errors.push(String(e)));
try {
  const project=createProjectShellFixture();
  await page.addInitScript(raw=>localStorage.setItem('arkem-project-kernel-v2',raw),encodeProjectEnvelope(project));
  await page.goto((process.env.ARKEMX_E2E_BASE_URL??'http://127.0.0.1:5187')+'/ornek-kabuk-modeli');
  const panel=page.getByTestId('coupled-example');await panel.waitFor();
  const before=await page.evaluate(()=>JSON.parse(localStorage.getItem('arkem-project-kernel-v2')).payload);
  await panel.getByRole('button',{name:'Ortak modeli çöz',exact:true}).click();
  await panel.getByTestId('coupled-summary').waitFor();assert.match(await panel.getByTestId('coupled-summary').innerText(),/60\.0000 kN/);checks.push('one-floor load reaches column bases');
  await panel.getByLabel('Ortak model kat düzeni').selectOption('two');assert.equal(await panel.getByTestId('coupled-summary').count(),0);checks.push('source edit clears stale solution');
  await panel.getByRole('button',{name:'Ortak modeli çöz',exact:true}).click();await panel.getByTestId('coupled-summary').waitFor();assert.match(await panel.getByTestId('coupled-summary').innerText(),/90\.0000 kN/);checks.push('two distinct floors preserve total load');
  await panel.getByLabel('Ortak model yük durumu').selectOption('Q');assert.match(await panel.getByTestId('coupled-summary').innerText(),/36\.0000 kN/);checks.push('load selector uses independent case');
  const event=page.waitForEvent('download');await panel.getByRole('button',{name:'Ortak model ve sonuç JSON indir'}).click();const download=await event;const file=path.join(out,'coupled-example-download.json');await download.saveAs(file);const json=JSON.parse(fs.readFileSync(file,'utf8'));
  assert.equal(json.fixture,'synthetic');assert.equal(json.result.fullBuildingAnalysis,false);assert.equal(json.result.technicalApproval,false);assert.equal(json.model.shells.length,6);assert.equal(json.result.cases.length,6);checks.push('real JSON download contains inputs, fields and acceptance boundaries');
  assert.deepEqual(await page.evaluate(()=>JSON.parse(localStorage.getItem('arkem-project-kernel-v2')).payload),before);checks.push('synthetic example does not overwrite existing project');
  await page.screenshot({path:path.join(out,'coupled-example.png'),fullPage:true});
  await page.reload();await page.getByTestId('coupled-example').waitFor();assert.equal(await page.getByTestId('coupled-summary').count(),0);checks.push('reload clears example results');assert.deepEqual(errors,[]);
}catch(e){await page.screenshot({path:path.join(out,'coupled-browser-failure.png'),fullPage:true});fs.writeFileSync(path.join(out,'coupled-browser-failure.json'),JSON.stringify({error:String(e),body:await page.locator('body').innerText(),checks,errors},null,2));throw e;}
finally{await browser.close();fs.writeFileSync(path.join(out,'coupled-browser-result.json'),JSON.stringify({executedAt:new Date().toISOString(),checks,errors,technicalApproval:false},null,2));}
console.log(JSON.stringify({suite:'coupled-example-browser',pass:checks.length,fail:0}));
