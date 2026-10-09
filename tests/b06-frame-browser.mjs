import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { registerHooks } from 'node:module';
import { chromium } from 'playwright';
import { PDFDocument, PDFName, PDFDict, PDFArray, PDFRawStream, decodePDFRawStream } from 'pdf-lib';
registerHooks({resolve(s,c,next){if(s.startsWith('.')&&!path.extname(s)){const u=new URL(s+'.ts',c.parentURL);if(fs.existsSync(fileURLToPath(u)))return next(u.href,c);}return next(s,c);}});
const {createB06FrameFixture}=await import('./fixtures/b06-frame-project.mjs');
const {refreshCoordinationSource}=await import('./fixtures/b06-coordination-project.mjs');
const {encodeProjectEnvelope}=await import('../app/lib/project-storage.ts');
const {verifyFrameDocument}=await import('../app/lib/frame-documents.ts');
const root=process.env.ARKEMX_E2E_BASE_URL??'http://127.0.0.1:5187';
const out=path.resolve(process.env.ARKEMX_G05_EVIDENCE_DIR??'test-artifacts/g05');fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.ARKEMX_E2E_BROWSER}),reports=[];
async function stored(page){return page.evaluate(()=>JSON.parse(localStorage.getItem('arkem-project-kernel-v2')).payload);}
async function seed(page,p,url){await page.goto(root);await page.evaluate(raw=>{localStorage.clear();sessionStorage.clear();localStorage.setItem('arkem-project-kernel-v2',raw);},encodeProjectEnvelope(p));await page.goto(root+url);}
async function download(page,format){const event=page.waitForEvent('download');await page.getByRole('button',{name:`Ortak kat ve eleman paketini indir (${format})`,exact:true}).click();const file=await event,bytes=fs.readFileSync(await file.path());fs.writeFileSync(path.join(out,'b06-common-frame.'+format.toLowerCase()),bytes);return bytes;}
async function check(name,fn){const context=await browser.newContext(),page=await context.newPage(),errors=[];page.setDefaultTimeout(20000);page.on('pageerror',e=>errors.push(String(e)));try{await fn(page);assert.deepEqual(errors,[]);reports.push({name,pass:true});}catch(error){reports.push({name,pass:false,error:String(error),pageErrors:errors,body:await page.locator('body').innerText()});await page.screenshot({path:path.join(out,'b06-frame-failure-'+reports.length+'.png'),fullPage:true});}finally{await context.close();}}
try{
await check('B06 blank source is explicit; valid imported source survives reload',async page=>{
 const p=createB06FrameFixture(),source=p.modules['plan-editor'].floorFrame;delete p.modules['plan-editor'].floorFrame;refreshCoordinationSource(p);
 await seed(page,p,'/plan-ve-aks');await page.getByTestId('frame-model-editor').waitFor();
 await page.getByRole('button',{name:'Kaynaklardan boş eleman taslağı oluştur',exact:true}).click();
 const draft=JSON.parse(await page.getByLabel('3B eleman modeli (JSON)',{exact:true}).inputValue());assert.equal(draft.model.materials[0].E,null);assert.equal(draft.model.supports.length,0);
 await page.getByRole('button',{name:'Eleman modelini doğrula ve kaydet',exact:true}).click();await page.getByTestId('frame-model-editor').getByRole('alert').waitFor();assert.equal((await stored(page)).modules['plan-editor'].floorFrame,undefined);
 await page.getByLabel('3B eleman modeli (JSON)',{exact:true}).fill(JSON.stringify(source));await page.getByRole('button',{name:'Eleman modelini doğrula ve kaydet',exact:true}).click();
 await page.getByRole('img',{name:'Kaynak elemanların 3B şematik görünümü'}).waitFor();assert.deepEqual((await stored(page)).modules['plan-editor'].floorFrame,source);
 await page.reload();await page.getByRole('img',{name:'Kaynak elemanların 3B şematik görünümü'}).waitFor();assert.deepEqual((await stored(page)).modules['plan-editor'].floorFrame,source);
});
await check('B06 solves actual floor loads, downloads byte-bound common PDF DXF JSON and retains history',async page=>{
 await seed(page,createB06FrameFixture(),'/tasiyici-on-tasarim');await page.getByRole('button',{name:'Lineer 3B modeli çöz',exact:true}).click();await page.getByTestId('frame-results').waitFor();
 const p=await stored(page),registry=p.modules['structural-concept'].frameRegistry,r=Object.values(registry)[0];assert.deepEqual(r.content.result.cases.map(c=>c.id),['G','Q','S','H']);assert.equal(r.content.source.floorStudy.totals.grossArea,300);assert.equal(r.content.technicalApproval,false);
 const input=r.content.source.floorStudy.input;
 for(const format of ['JSON','DXF','PDF']){const bytes=await download(page,format),next=await stored(page),doc=Object.values(next.modules['structural-concept'].frameDocumentRegistry).find(d=>d.manifest.format===format);assert.ok(doc,format);assert.equal(await verifyFrameDocument(doc,next,input,registry,bytes),true);if(format==='JSON')assert.equal(JSON.parse(bytes).calculationId,r.id);if(format==='DXF')assert.match(bytes.toString(),/30\r\n-3\.40000000/);if(format==='PDF'){
   const pdf=await PDFDocument.load(bytes);assert.ok(pdf.getPageCount()>0);
   const names=pdf.catalog.lookup(PDFName.of('Names'),PDFDict).lookup(PDFName.of('EmbeddedFiles'),PDFDict).lookup(PDFName.of('Names'),PDFArray);
   const stream=names.lookup(1,PDFDict).lookup(PDFName.of('EF'),PDFDict).lookup(PDFName.of('F'),PDFRawStream);
   const attachment=JSON.parse(new TextDecoder().decode(decodePDFRawStream(stream).decode()));assert.equal(attachment.calculationId,r.id);assert.deepEqual(attachment.content.calculation,r);
 }}
 const history=await stored(page);assert.equal(Object.keys(history.modules['structural-concept'].frameDocumentRegistry).length,3);assert.equal(history.modules['structural-concept'].result,null);assert.equal(history.modules['arkem-x'],undefined);
 await page.screenshot({path:path.join(out,'b06-frame-results.png'),fullPage:true});await page.reload();await page.getByTestId('frame-source-status').waitFor();assert.equal(await page.getByTestId('frame-results').count(),0);assert.equal(Object.keys((await stored(page)).modules['structural-concept'].frameRegistry).length,1);
});
await check('B06 changed source invalidates model and stale analysis; geometry-only export is explicit',async page=>{
 const p=createB06FrameFixture();p.modules['plan-editor'].floorCoordination.placements[1].x=1;refreshCoordinationSource(p);
 await seed(page,p,'/tasiyici-on-tasarim');await page.getByTestId('frame-source-status').waitFor();assert.match(await page.getByTestId('frame-source-status').innerText(),/doğrulanacak/);assert.equal(await page.getByRole('button',{name:'Lineer 3B modeli çöz',exact:true}).isDisabled(),true);
 const manifest=JSON.parse(await download(page,'JSON'));assert.equal(manifest.scope,'geometry-only');assert.equal(manifest.calculationId,null);assert.equal(manifest.technicalApproval,false);assert.equal(manifest.content.coordination.geometry.floors[1].x,1);
});
}finally{await browser.close();fs.writeFileSync(path.join(out,'b06-frame-result.json'),JSON.stringify({executedAt:new Date().toISOString(),fixture:'synthetic',reports,technicalApproval:false},null,2));}
console.log(JSON.stringify({suite:'b06-frame',pass:reports.filter(r=>r.pass).length,fail:reports.filter(r=>!r.pass).length}));if(reports.some(r=>!r.pass))process.exitCode=1;
