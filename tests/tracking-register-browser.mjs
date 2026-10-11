import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium} from 'playwright';
import {encodeProjectEnvelope} from '../app/lib/project-storage.ts';
const base=process.env.ARKEMX_E2E_BASE_URL??'http://127.0.0.1:5199';
const browser=await chromium.launch({headless:true,executablePath:process.env.ARKEMX_E2E_BROWSER});
const ctx=await browser.newContext();const page=await ctx.newPage();const errors=[],checks=[];page.on('pageerror',e=>errors.push(String(e)));
const fixture={schema:'ARKEM-PROJECT/1.0',id:'REGISTER-FIXTURE',name:'REGISTER FIXTURE',revision:'P01',phase:'Ön fizibilite',coordinateReference:'WGS84 / EPSG:4326',updatedAt:new Date().toISOString(),experience:{mode:'guided',autoHandoff:false,lastSynchronizedAt:''},modules:{},events:[]};
page.setDefaultTimeout(20000);page.setDefaultNavigationTimeout(30000);
const stored=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('arkem-project-kernel-v2')).payload);
const fill=async(form,values)=>{for(const [name,value] of Object.entries(values))await form.locator(`[name="${name}"]`).fill(String(value));};
const action=async()=>{const form=page.getByRole('form',{name:'İşlem dayanağı'});await fill(form,{actor:'Sentetik test kullanıcısı',reason:'Test incelemesi tamamlandı',evidence:'TEST-PAFTA-01'});await form.getByRole('button',{name:'İşlemi kaydet'}).click();};
try{
 await page.addInitScript(raw=>{if(!localStorage.getItem('arkem-project-kernel-v2'))localStorage.setItem('arkem-project-kernel-v2',raw);},encodeProjectEnvelope(fixture));
 await page.goto(base+'/proje-takibi');await page.locator('[data-testid="project-operating-system"][data-ready="true"]').waitFor();
 await page.waitForFunction(()=>JSON.parse(localStorage.getItem('arkem-project-kernel-v2')).payload.modules['project-os']?.trackingDataStatus==='project-record');
 await page.goto(base+'/musteri-proje-portali/teknik-oda');
 await page.getByText('Gerçekleşen Veri yok',{exact:true}).waitFor();
 await page.getByText('Plan Veri yok',{exact:true}).waitFor();
 checks.push('technical room distinguishes missing progress');
 await page.goto(base+'/proje-takibi');await page.locator('[data-testid="project-operating-system"][data-ready="true"]').waitFor();
 await page.getByText('Görev ekle',{exact:true}).click();const workForm=page.locator('form').filter({has:page.getByRole('button',{name:'Görev kaydet',exact:true})});
 for(let n=1;n<=6;n++){await fill(workForm,{title:`Görev ${n}`,owner:'Test ekibi',due:'2026-10-20',revision:'P01',source:'TEST-01'});await workForm.getByRole('button',{name:'Görev kaydet'}).click();}
 await page.getByRole('heading',{name:'Görev 6',exact:true}).waitFor();checks.push('sixth task accessible');console.log('six tasks added');
 const row=page.locator('article.arx-track-item').filter({has:page.getByRole('heading',{name:'Görev 6',exact:true})});
 await row.getByRole('button',{name:'İncele',exact:true}).click();await row.getByRole('button',{name:'Kapat',exact:true}).click();
 await page.getByRole('form',{name:'İşlem dayanağı'}).getByRole('button',{name:'İşlemi kaydet'}).click();assert.equal((await stored()).modules['project-os'].workItems.find(w=>w.title==='Görev 6').status,'in-review');
 await action();await page.getByRole('checkbox',{name:'Kapalı işleri de göster'}).check();await row.getByText('Kapalı',{exact:false}).waitFor();
 await page.getByText('Dokümanlar (0)',{exact:true}).click();await page.getByText('Belge ekle',{exact:true}).click();const docForm=page.locator('form').filter({has:page.getByRole('button',{name:'Belge kaydet',exact:true})});
 for(let n=1;n<=6;n++){await fill(docForm,{title:`Belge ${n}`,code:`DOC-${n}`,discipline:'Mimari',due:'2026-10-11',revision:'R01',source:'TEST-PAFTA'});await docForm.getByRole('button',{name:'Belge kaydet'}).click();}
 const docRow=page.locator('article.arx-track-doc').filter({has:page.getByText('Belge 6',{exact:true})});await docRow.getByRole('button',{name:'Onayla',exact:true}).click();await action();checks.push('sixth document accessible and evidence required for approval');
 await page.getByText('Kararlar ve RFI (0 açık)',{exact:true}).click();await page.getByText('Karar ekle',{exact:true}).click();const decisionForm=page.locator('form').filter({has:page.getByRole('button',{name:'Karar kaydet',exact:true})});await fill(decisionForm,{title:'Test kararı',owner:'Test sahibi',due:'2026-10-20',revision:'P01',source:'TEST-TUTANAK'});await decisionForm.getByRole('button',{name:'Karar kaydet'}).click();await page.getByRole('button',{name:'Kararı kapat',exact:true}).click();await action();
 await page.getByText('İlerleme ve maliyet kaydı',{exact:true}).click();const progressForm=page.locator('form').filter({has:page.getByRole('button',{name:'İlerleme kaydet',exact:true})});await fill(progressForm,{actual:0,planned:0,budget:10,actualCost:0,week:0,actor:'Test',reason:'Başlangıç',source:'TEST-PROGRAM'});await progressForm.getByRole('button',{name:'İlerleme kaydet'}).click();
 await page.getByText('4B program özeti · veri bekleniyor',{exact:true}).click();await page.getByText('Program aktivitesi ekle',{exact:true}).click();const phaseForm=page.locator('form').filter({has:page.getByRole('button',{name:'Aktivite kaydet',exact:true})});await fill(phaseForm,{name:'Test aktivitesi',owner:'Test',start:'2026-10-11',end:'2026-10-20',progress:0,source:'TEST-PROGRAM'});await phaseForm.getByRole('button',{name:'Aktivite kaydet'}).click();
 await page.waitForFunction(()=>JSON.parse(localStorage.getItem('arkem-project-kernel-v2')).payload.modules['project-os']?.phases?.length===1);
 console.log('entries completed');const before=(await stored()).modules['project-os'];assert.equal(before.earnedValue.actual,0);assert.equal(before.earnedValue.spi,null);assert.equal(before.earnedValue.cpi,null);assert.equal(before.progressHistory.length,1);assert.equal(before.documents[5].approval.evidence,'TEST-PAFTA-01');assert.equal(before.decisions[0].resolution.actor,'Sentetik test kullanıcısı');
 await page.reload();await page.locator('[data-testid="project-operating-system"][data-ready="true"]').waitFor();await page.waitForFunction(()=>document.querySelectorAll('.arx-track-item').length===5,{},{timeout:20000});
 const after=(await stored()).modules['project-os'];assert.equal(after.workItems.find(w=>w.title==='Görev 6').status,'closed');assert.equal(after.workItems.find(w=>w.title==='Görev 6').closure.evidence,'TEST-PAFTA-01');assert.deepEqual(after.documents,before.documents);assert.deepEqual(after.decisions,before.decisions);assert.deepEqual(after.phases,before.phases);assert.deepEqual(after.progress,before.progress);checks.push('task closure, document approval, decision result, schedule and zero progress survive reload');
 await page.getByRole('checkbox',{name:'Kapalı işleri de göster'}).check();await page.getByRole('heading',{name:'Görev 6',exact:true}).waitFor();checks.push('closed tasks remain accessible');
 await page.goto(base+'/musteri-proje-portali/teknik-oda');await page.getByText('Gerçekleşen %0',{exact:true}).waitFor();await page.getByText('Plan %0',{exact:true}).waitFor();checks.push('technical room preserves explicitly recorded zero');await page.goto(base+'/proje-takibi');await page.locator('[data-testid="project-operating-system"][data-ready="true"]').waitFor();
 assert.deepEqual(errors,[]);fs.mkdirSync('test-artifacts',{recursive:true});fs.writeFileSync('test-artifacts/tracking-register-browser.json',JSON.stringify({passed:true,checks,errors},null,2));await page.screenshot({path:'test-artifacts/tracking-register-browser.png',fullPage:true});console.log(JSON.stringify({passed:true,checks},null,2));
}catch(error){console.log(await page.locator('body').innerText());await page.screenshot({path:'test-artifacts/tracking-register-failure.png',fullPage:true});throw error;}finally{await browser.close();}
