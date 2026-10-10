import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {registerHooks} from 'node:module';
import {chromium} from 'playwright';
import {PDFDocument,PDFName,PDFDict,PDFArray,PDFRawStream,decodePDFRawStream} from 'pdf-lib';
registerHooks({resolve(s,c,next){if(s.startsWith('.')&&!path.extname(s)){const u=new URL(s+'.ts',c.parentURL);if(fs.existsSync(fileURLToPath(u)))return next(u.href,c);}return next(s,c);}});
const {verifyShellCalculation}=await import('../app/lib/shell-solver.ts');
const {verifyShellDocument}=await import('../app/lib/shell-documents.ts');
const {createB06FrameFixture}=await import('./fixtures/b06-frame-project.mjs');
const {encodeProjectEnvelope}=await import('../app/lib/project-storage.ts');
const root=process.env.ARKEMX_E2E_BASE_URL??'http://127.0.0.1:5187';
const out=path.resolve(process.env.ARKEMX_G05_EVIDENCE_DIR??'test-artifacts/g05');
fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.ARKEMX_E2E_BROWSER}),reports=[];
async function check(name,fn){
 const context=await browser.newContext(),page=await context.newPage(),errors=[];page.setDefaultTimeout(45000);page.on('pageerror',e=>errors.push(String(e)));
 try{await fn(page);assert.deepEqual(errors,[]);reports.push({name,pass:true});}
 catch(error){reports.push({name,pass:false,error:String(error),pageErrors:errors,body:await page.locator('body').innerText()});await page.screenshot({path:path.join(out,'shell-example-failure-'+reports.length+'.png'),fullPage:true});}
 finally{await context.close();}
}
async function open(page){await page.goto(root+'/ornek-kabuk-modeli');await page.waitForFunction(()=>Array.from(document.querySelectorAll('button')).some(b=>b.textContent==='Kabuk modelini çöz'&&!b.disabled));}
const solve=async page=>{await page.getByRole('button',{name:'Kabuk modelini çöz',exact:true}).click();await page.getByTestId('shell-results').waitFor();};
const button=(page,format)=>page.getByRole('button',{name:`Kabuk sonuçlarını indir (${format})`,exact:true});
async function download(page,format,prefix='b06-shell-example'){
 const pending=page.waitForEvent('download');await button(page,format).click();const file=await pending,bytes=fs.readFileSync(await file.path());fs.writeFileSync(path.join(out,prefix+'.'+format.toLowerCase()),bytes);return bytes;
}
async function proof(page,format,prefix='b06-shell-example'){
 await page.getByTestId('shell-documents').locator('summary').click();const pending=page.waitForEvent('download');await page.getByRole('button',{name:'Belge kanıtını indir: '+format,exact:true}).click();const file=await pending,bytes=fs.readFileSync(await file.path());fs.writeFileSync(path.join(out,prefix+'.'+format.toLowerCase()+'.proof.json'),bytes);await page.getByTestId('shell-documents').locator('summary').click();return JSON.parse(bytes);
}
const embedded=pdf=>{
 const names=pdf.catalog.lookup(PDFName.of('Names'),PDFDict).lookup(PDFName.of('EmbeddedFiles'),PDFDict).lookup(PDFName.of('Names'),PDFArray);
 const stream=names.lookup(1,PDFDict).lookup(PDFName.of('EF'),PDFDict).lookup(PDFName.of('F'),PDFRawStream);
 return JSON.parse(new TextDecoder().decode(decodePDFRawStream(stream).decode()));
};
function dxfManifest(bytes){let inside=false,s='';const pairs=bytes.toString().split('\r\n');for(let i=0;i<pairs.length-1;i+=2){if(pairs[i]!=='999')continue;const v=pairs[i+1];if(v==='ARKEMX_SHELL_TRACE_BEGIN')inside=true;else if(v==='ARKEMX_SHELL_TRACE_END')inside=false;else if(inside)s+=v;}return JSON.parse(s);}
try{
 await check('Default refined shell exports actual JSON PDF DXF with the same calculation and verified byte proofs, without editing project storage',async page=>{
  await page.goto(root);await page.evaluate(raw=>{localStorage.clear();sessionStorage.clear();localStorage.setItem('arkem-project-kernel-v2',raw);},encodeProjectEnvelope(createB06FrameFixture()));
  await page.goto(root+'/ornek-kat-modeli');await page.waitForFunction(()=>Array.from(document.querySelectorAll('button')).some(b=>b.textContent==='Lineer 3B modeli çöz'&&!b.disabled));
  const before=await page.evaluate(()=>JSON.parse(localStorage.getItem('arkem-project-kernel-v2')).payload);
  await page.getByRole('link',{name:'Döşeme kabuk örneği',exact:true}).click();
  await solve(page);await page.getByLabel('Kabuk sonuç alanı',{exact:true}).selectOption('Mxx');
  const bytes=await download(page,'JSON'),pkg=JSON.parse(bytes),source=pkg.manifest.source,record=pkg.calculation;
  assert.equal(source.mesh.nx,32);assert.equal(source.schema,'ARKEM-SHELL-SOURCE/1.1');assert.equal(pkg.technicalApproval,false);assert.equal(pkg.fullBuildingAnalysis,false);
  assert.equal(await verifyShellCalculation(record,source),true);
  assert.equal(await verifyShellDocument(await proof(page,'JSON'),source,record,bytes),true);
  const pdfBytes=await download(page,'PDF'),pdf=await PDFDocument.load(pdfBytes),pdfPackage=embedded(pdf);
  assert.ok(pdf.getPageCount()>=6);assert.deepEqual(pdfPackage.calculation.content,record.content);assert.equal(pdfPackage.manifest.view.field,'Mxx');
  assert.equal(await verifyShellDocument(await proof(page,'PDF'),source,record,pdfBytes),true);
  const dxfBytes=await download(page,'DXF'),manifest=dxfManifest(dxfBytes);assert.equal(manifest.calculationId,record.id);assert.deepEqual(manifest.view,pkg.manifest.view);
  assert.equal(await verifyShellDocument(await proof(page,'DXF'),source,record,dxfBytes),true);
  assert.deepEqual(await page.evaluate(()=>JSON.parse(localStorage.getItem('arkem-project-kernel-v2')).payload),before);
  await page.screenshot({path:path.join(out,'b06-shell-example-desktop.png'),fullPage:true});
  await page.reload();await page.waitForFunction(()=>Array.from(document.querySelectorAll('button')).some(b=>b.textContent==='Kabuk modelini çöz'&&!b.disabled));assert.equal(await page.getByTestId('shell-results').count(),0);assert.deepEqual(await page.evaluate(()=>JSON.parse(localStorage.getItem('arkem-project-kernel-v2')).payload),before);
 });
 await check('Changed source immediately invalidates results and every export; blank input is refused and recomputation has a fresh ID',async page=>{
  await open(page);await page.getByLabel('Kabuk ağı',{exact:true}).selectOption('coarse');await solve(page);const old=JSON.parse(await download(page,'JSON','shell-before-edit'));
  await page.getByLabel('Hareketli yük Q (kN/m²)',{exact:true}).fill('7');assert.equal(await page.getByTestId('shell-results').count(),0);for(const f of ['JSON','PDF','DXF'])assert.equal(await button(page,f).isDisabled(),true);
  await page.getByLabel('Kalınlık h (m)',{exact:true}).fill('');assert.equal(await page.getByRole('button',{name:'Kabuk modelini çöz',exact:true}).isDisabled(),true);assert.match(await page.getByRole('alert').innerText(),/Boş alan sıfır değildir/);
  await page.getByLabel('Kalınlık h (m)',{exact:true}).fill('0.16');await solve(page);const fresh=JSON.parse(await download(page,'JSON','shell-after-edit'));assert.notEqual(fresh.calculation.id,old.calculation.id);assert.equal(fresh.manifest.source.loads.liveLoad,7);
  await page.getByLabel('Deformasyon büyütmesi',{exact:true}).fill('');for(const f of ['JSON','PDF','DXF'])assert.equal(await button(page,f).isDisabled(),true);
 });
 await check('P2 true elevation and selected load/field/scale reach PDF and DXF; mobile page has no horizontal overflow',async page=>{
  await page.setViewportSize({width:390,height:844});await open(page);await page.getByLabel('Örnek plaka',{exact:true}).selectOption('1');await page.getByLabel('Kabuk ağı',{exact:true}).selectOption('coarse');await solve(page);
  await page.getByLabel('Kabuk yük durumu',{exact:true}).selectOption('Q');await page.getByLabel('Kabuk sonuç alanı',{exact:true}).selectOption('Myy');await page.getByLabel('Deformasyon büyütmesi',{exact:true}).fill('250');
  const dxf=await download(page,'DXF','b06-shell-p2'),meta=dxfManifest(dxf);assert.deepEqual(meta.view,{caseId:'Q',field:'Myy',magnification:250,elementId:'P2:Q:0:0'});assert.match(dxf.toString(),/30\r\n3\.4000000000/);assert.match(dxf.toString(),/\$INSUNITS\r\n70\r\n6/);
  const pdf=await PDFDocument.load(await download(page,'PDF','b06-shell-p2'));assert.deepEqual(embedded(pdf).manifest.view,meta.view);assert.equal(embedded(pdf).manifest.source.plate.origin[2],3.4);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);await page.screenshot({path:path.join(out,'b06-shell-example-mobile.png'),fullPage:true});
 });
 await check('Source edit and explicit cancellation terminate pending solves; invalidated export produces no download',async page=>{
  await open(page);await page.getByLabel('Örnek plaka',{exact:true}).selectOption('1');await page.getByRole('button',{name:'Kabuk modelini çöz',exact:true}).click();await page.getByLabel('Hareketli yük Q (kN/m²)',{exact:true}).fill('8');
  await page.waitForTimeout(1500);assert.equal(await page.getByTestId('shell-results').count(),0);assert.match(await page.getByTestId('shell-status').innerText(),/Güncel kabuk çözümü yok/);
  await page.getByRole('button',{name:'Kabuk modelini çöz',exact:true}).click();await page.getByRole('button',{name:'İşlemi iptal et',exact:true}).click();assert.match(await page.getByTestId('shell-error').innerText(),/iptal edildi/);assert.equal(await page.getByTestId('shell-results').count(),0);
  await page.getByLabel('Kabuk ağı',{exact:true}).selectOption('coarse');await solve(page);let downloads=0;page.on('download',()=>downloads++);await button(page,'PDF').click();await page.getByLabel('Hareketli yük Q (kN/m²)',{exact:true}).fill('9');await page.waitForTimeout(1500);assert.equal(downloads,0);assert.equal(await page.getByTestId('shell-results').count(),0);
 });
}finally{await browser.close();fs.writeFileSync(path.join(out,'shell-example-result.json'),JSON.stringify({executedAt:new Date().toISOString(),fixture:'synthetic',reports,technicalApproval:false,fullBuildingAnalysis:false},null,2));}
console.log(JSON.stringify({suite:'shell-example',pass:reports.filter(r=>r.pass).length,fail:reports.filter(r=>!r.pass).length}));if(reports.some(r=>!r.pass))process.exitCode=1;
