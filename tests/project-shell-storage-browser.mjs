import assert from 'node:assert/strict';
import fs from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';import {registerHooks} from 'node:module';import {chromium} from 'playwright';
registerHooks({resolve(s,c,next){if(s.startsWith('.')&&!path.extname(s)){const u=new URL(s+'.ts',c.parentURL);if(fs.existsSync(fileURLToPath(u)))return next(u.href,c);}return next(s,c);}});
const {createProjectShellFixture,createProjectShellFixtureSource}=await import('./fixtures/project-shell-project.mjs');
const {encodeProjectEnvelope}=await import('../app/lib/project-storage.ts');
const base=process.env.ARKEMX_E2E_BASE_URL??'http://127.0.0.1:5187',out=path.resolve(process.env.ARKEMX_G05_EVIDENCE_DIR??'test-artifacts/g05');fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.ARKEMX_E2E_BROWSER}),reports=[];
async function seed(page){const p=createProjectShellFixture();p.modules['plan-editor'].projectShellSources=Object.fromEntries([1,2].map(l=>{const s=createProjectShellFixtureSource(p,l);return[s.sourcePlateId,s];}));await page.goto(base);await page.evaluate(raw=>{localStorage.clear();sessionStorage.clear();localStorage.setItem('arkem-project-kernel-v2',raw);},encodeProjectEnvelope(p));await page.goto(base+'/plan-ve-aks');await page.getByTestId('project-shell-calculation').waitFor();return p;}
async function check(name,fn){const context=await browser.newContext(),page=await context.newPage(),errors=[];page.setDefaultTimeout(30000);page.on('pageerror',e=>errors.push(String(e)));try{await fn(page);assert.deepEqual(errors,[]);reports.push({name,pass:true});}catch(e){reports.push({name,pass:false,error:String(e),pageErrors:errors,body:await page.locator('body').innerText()});await page.screenshot({path:path.join(out,'project-shell-storage-failure-'+reports.length+'.png'),fullPage:true});}finally{await context.close();}}
async function calculated(page){await page.getByRole('button',{name:'Proje döşemesinin kabuk hesabını çalıştır',exact:true}).click();await page.waitForFunction(()=>document.querySelector('[data-testid="project-shell-storage-status"]')?.textContent.includes('Cihaza kaydedildi'));return page.getByTestId('project-shell-calculation-id').innerText();}
try{
await check('S4-A03 each floor survives reload and source changes select a separate calculation key',async page=>{
 const p=await seed(page),ids=[];
 for(const s of Object.values(p.modules['plan-editor'].projectShellSources)){
  await page.getByLabel('Kabuk kaynak döşemesi',{exact:true}).selectOption(s.sourcePlateId);ids.push(await calculated(page));
  await page.reload();await page.getByLabel('Kabuk kaynak döşemesi',{exact:true}).selectOption(s.sourcePlateId);await page.getByTestId('project-shell-calculation-id').waitFor();assert.equal(await page.getByTestId('project-shell-calculation-id').innerText(),ids.at(-1));
 }
 assert.notEqual(ids[0],ids[1]);
 const r=await page.evaluate(async()=>{const m=await import('/app/lib/project-shell-storage.ts');const p=JSON.parse(localStorage.getItem('arkem-project-kernel-v2')).payload,s=Object.values(p.modules['plan-editor'].projectShellSources)[0];const old=await m.readProjectShellStorage(p,s),fresh=await m.readProjectShellStorage(p,{...s,loads:{...s.loads,superDeadLoad:2}});return{old:!!old.stored,fresh:!!fresh.stored,separate:old.session.key!==fresh.session.key};});
 assert.deepEqual(r,{old:true,fresh:false,separate:true});await page.getByTestId('project-shell-calculation').screenshot({path:path.join(out,'project-shell-storage-restored.png')});
});
await check('S4-A03 maximum 2145-node record is stored outside localStorage and restored with full worker verification',async page=>{
 await seed(page);
 const r=await page.evaluate(async()=>{
  const m=await import('/app/lib/project-shell-storage.ts'),w=await import('/app/lib/project-shell-worker-client.ts');const p=JSON.parse(localStorage.getItem('arkem-project-kernel-v2')).payload,s=Object.values(p.modules['plan-editor'].projectShellSources)[1];s.mesh={nx:64,ny:32};
  const {session}=await m.readProjectShellStorage(p,s),record=await w.calculateProjectShellInWorker(p,s);const bytes=new TextEncoder().encode(JSON.stringify(record)).byteLength;await m.saveProjectShellStorage(session,record);const stored=(await m.readProjectShellStorage(p,s)).stored;
  let ticks=0;const timer=setInterval(()=>ticks++,10);try{return{bytes,id:record.id,restoredId:stored.record.id,verified:await w.verifyProjectShellInWorker(p,s,stored.record),ticks,localBytes:localStorage.getItem('arkem-project-kernel-v2').length};}finally{clearInterval(timer);}
 });
 assert.ok(r.bytes>5*1024*1024);assert.equal(r.id,r.restoredId);assert.equal(r.verified,true);assert.ok(r.ticks>2);assert.ok(r.localBytes<100000);fs.writeFileSync(path.join(out,'project-shell-storage-large.json'),JSON.stringify(r,null,2));
});
await check('S4-A03 rehashed fabricated result never appears after reload and fresh calculation repairs it',async page=>{
 await seed(page);const id=await calculated(page);
 await page.evaluate(async()=>{
  const m=await import('/app/lib/project-shell-storage.ts'),t=await import('/app/lib/structural-traceability.ts');const p=JSON.parse(localStorage.getItem('arkem-project-kernel-v2')).payload,s=Object.values(p.modules['plan-editor'].projectShellSources)[0],r=await m.readProjectShellStorage(p,s);r.stored.record.content.cases[0].centerUz=123;r.stored.record.sha256=await t.traceSha256(t.traceJson(r.stored.record.content));r.stored.record.id='PROJECT-SHELL-CALC-'+r.stored.record.sha256;await m.saveProjectShellStorage(r.session,r.stored.record);
 });
 await page.reload();await page.getByRole('alert').filter({hasText:'yeniden hesaplanan'}).waitFor();assert.equal(await page.getByTestId('project-shell-calculation-id').count(),0);assert.equal(await calculated(page),id);
});
await check('S4-A03 malformed and future record schemas are rejected without deleting the stored evidence',async page=>{
 await seed(page);await calculated(page);
 for(const mutation of ['json','schema']){
  await page.evaluate(async mutation=>{const {PROJECT_SHELL_DB}=await import('/app/lib/project-shell-storage.ts');await new Promise((resolve,reject)=>{const op=indexedDB.open(PROJECT_SHELL_DB,1);op.onerror=()=>reject(op.error);op.onsuccess=()=>{const db=op.result,tx=db.transaction('records','readwrite'),q=tx.objectStore('records').openCursor();q.onsuccess=()=>{const c=q.result;if(c){const e=c.value;if(mutation==='json')e.json='{broken';else e.schema='ARKEM-PROJECT-SHELL-STORAGE/99.0';c.update(e);}};tx.oncomplete=()=>{db.close();resolve();};tx.onabort=()=>reject(tx.error);};});},mutation);
  await page.reload();await page.getByTestId('project-shell-calculation').getByRole('alert').waitFor();assert.equal(await page.getByTestId('project-shell-calculation-id').count(),0);await calculated(page);
 }
});
await check('S4-A03 quota and transaction abort preserve the previous committed record; canceled/stale writes cannot commit',async page=>{
 await seed(page);await calculated(page);
 const r=await page.evaluate(async()=>{
  const m=await import('/app/lib/project-shell-storage.ts');const p=JSON.parse(localStorage.getItem('arkem-project-kernel-v2')).payload,s=Object.values(p.modules['plan-editor'].projectShellSources)[0],old=await m.readProjectShellStorage(p,s),before=old.stored.savedAt,original=IDBObjectStore.prototype.put,errors=[];
  for(const kind of ['quota','abort']){IDBObjectStore.prototype.put=function(...args){if(this.name==='records'){if(kind==='quota')throw new DOMException('Fixture quota exceeded','QuotaExceededError');const q=original.apply(this,args);this.transaction.abort();return q;}return original.apply(this,args);};try{await m.saveProjectShellStorage(old.session,old.stored.record);errors.push('accepted');}catch(e){errors.push(e.name);}finally{IDBObjectStore.prototype.put=original;}}
  const after=(await m.readProjectShellStorage(p,s)).stored.savedAt,ac=new AbortController();ac.abort();let canceled;try{await m.saveProjectShellStorage(old.session,old.stored.record,ac.signal);}catch(e){canceled=e.name;}
  let foreign;try{await m.saveProjectShellStorage({...old.session,key:'foreign'},old.stored.record);}catch(e){foreign=e.message;}
  await m.clearProjectShellStorage(p.id);let late;try{await m.saveProjectShellStorage(old.session,old.stored.record);}catch(e){late=e.message;}
  return{errors,before,after,canceled,foreign,late,cleared:!(await m.readProjectShellStorage(p,s)).stored};
 });
 assert.deepEqual(r.errors,['QuotaExceededError','AbortError']);assert.equal(r.before,r.after);assert.equal(r.canceled,'AbortError');assert.match(r.foreign,/eşleşmiyor/);assert.match(r.late,/silindi/);assert.equal(r.cleared,true);
});
await check('S4-A03 unavailable storage keeps valid session result and reports that it was not saved',async page=>{
 await seed(page);await page.evaluate(()=>{const original=IDBFactory.prototype.open;window.__storageOpen=original;IDBFactory.prototype.open=function(){throw new DOMException('Fixture unavailable','SecurityError');};});
 await page.getByRole('button',{name:'Proje döşemesinin kabuk hesabını çalıştır',exact:true}).click();await page.getByTestId('project-shell-calculation-id').waitFor();await page.getByRole('alert').filter({hasText:'cihaza kaydedilemedi'}).waitFor();assert.match(await page.getByTestId('project-shell-storage-status').innerText(),/yalnız bu oturumda/);
});
await check('S4-A03 concurrent sessions commit atomic complete records and deleting one project preserves others',async page=>{
 await seed(page);await calculated(page);
 const r=await page.evaluate(async()=>{
  const m=await import('/app/lib/project-shell-storage.ts'),p=JSON.parse(localStorage.getItem('arkem-project-kernel-v2')).payload,s=Object.values(p.modules['plan-editor'].projectShellSources)[0],a=await m.readProjectShellStorage(p,s),b=await m.readProjectShellStorage(p,s);
  await Promise.all([m.saveProjectShellStorage(a.session,a.stored.record),m.saveProjectShellStorage(b.session,b.stored.record)]);
  const intact=(await m.readProjectShellStorage(p,s)).stored.record.id===a.stored.record.id;
  const foreign={schema:m.PROJECT_SHELL_STORAGE_SCHEMA,key:'foreign-project-record',projectId:'OTHER',savedAt:new Date().toISOString(),json:JSON.stringify(a.stored.record)};
  const raw=async(write)=>new Promise((resolve,reject)=>{const op=indexedDB.open(m.PROJECT_SHELL_DB,1);op.onsuccess=()=>{const db=op.result,tx=db.transaction('records',write?'readwrite':'readonly'),q=write?tx.objectStore('records').put(foreign):tx.objectStore('records').get(foreign.key);tx.oncomplete=()=>{db.close();resolve(q.result);};tx.onabort=()=>reject(tx.error);};op.onerror=()=>reject(op.error);});
  await raw(true);await m.clearProjectShellStorage(p.id);return{intact,other:!!await raw(false),own:!!(await m.readProjectShellStorage(p,s)).stored};
 });assert.deepEqual(r,{intact:true,other:true,own:false});
});
await check('S4-A03 future database version is refused without destructive migration',async page=>{
 await page.goto(base);await page.evaluate(async()=>{await new Promise((resolve,reject)=>{const q=indexedDB.open('arkem-project-shell-calculations-v1',2);q.onupgradeneeded=()=>q.result.createObjectStore('future');q.onsuccess=()=>{q.result.close();resolve();};q.onerror=()=>reject(q.error);});});
 await seed(page);await page.getByTestId('project-shell-calculation').getByRole('alert').waitFor();assert.equal(await page.getByTestId('project-shell-calculation-id').count(),0);
 const version=await page.evaluate(async()=>new Promise(resolve=>{const q=indexedDB.open('arkem-project-shell-calculations-v1');q.onsuccess=()=>{resolve(q.result.version);q.result.close();};}));assert.equal(version,2);
});
await check('S4-A03 actual project centre local deletion waits for calculation removal before claiming success',async page=>{
 const p=await seed(page);await calculated(page);await page.goto(base+'/dijital-proje-merkezi');
 await page.getByRole('button',{name:'Proje işlemleri',exact:true}).click();await page.getByRole('button',{name:'Aktif projeyi sil',exact:true}).click();
 await page.getByRole('button',{name:'Yalnız bu cihazdaki kaydı sil',exact:true}).click();await page.getByRole('status').filter({hasText:'çalışma ve kabuk hesap kayıtları silindi'}).waitFor();
 const missing=await page.evaluate(async p=>{const m=await import('/app/lib/project-shell-storage.ts');const s=Object.values(p.modules['plan-editor'].projectShellSources)[0];return!(await m.readProjectShellStorage(p,s)).stored;},p);assert.equal(missing,true);
});
await check('S4-A03 failed calculation deletion preserves the active project and shows no deletion success',async page=>{
 const p=await seed(page);await calculated(page);await page.goto(base+'/dijital-proje-merkezi');
 await page.evaluate(()=>{IDBFactory.prototype.open=function(){throw new DOMException('Fixture deletion failure','SecurityError');};});
 await page.getByRole('button',{name:'Proje işlemleri',exact:true}).click();await page.getByRole('button',{name:'Aktif projeyi sil',exact:true}).click();
 await page.getByRole('button',{name:'Yalnız bu cihazdaki kaydı sil',exact:true}).click();await page.getByRole('status').filter({hasText:'Yerel kayıt silinemedi'}).waitFor();
 assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('arkem-project-kernel-v2')).payload.id),p.id);
 assert.equal(await page.getByRole('status').filter({hasText:'hesap kayıtları silindi'}).count(),0);
});
}finally{await browser.close();fs.writeFileSync(path.join(out,'project-shell-storage-result.json'),JSON.stringify({executedAt:new Date().toISOString(),fixture:'synthetic-project',reports,technicalApproval:false,fullBuildingAnalysis:false},null,2));}
console.log(JSON.stringify({suite:'project-shell-storage',pass:reports.filter(r=>r.pass).length,fail:reports.filter(r=>!r.pass).length}));if(reports.some(r=>!r.pass))process.exitCode=1;
