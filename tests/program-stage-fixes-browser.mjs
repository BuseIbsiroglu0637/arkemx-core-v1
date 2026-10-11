import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium} from 'playwright';
const base=process.env.ARKEMX_E2E_BASE_URL??'http://127.0.0.1:5199';
const browser=await chromium.launch({headless:true,executablePath:process.env.ARKEMX_E2E_BROWSER});
const ctx=await browser.newContext();const page=await ctx.newPage();const errors=[];page.on('pageerror',e=>errors.push(String(e)));
const saved=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('arkem-project-kernel-v2')).payload);
try {
 await page.goto(base+'/proje-baslat?new=1');
 await page.waitForFunction(()=>localStorage.getItem('arkem-project-kernel-v2'));
 await page.getByRole('textbox',{name:'Projeye verilecek çalışma adı'}).fill('AREA FLOW FIX TEST');
 await page.getByRole('button',{name:'Sonraki adım →'}).click();
 await page.getByRole('textbox',{name:'İlk konum bilgisi'}).fill('Ankara sentetik test');
 await page.getByRole('button',{name:'Sonraki adım →'}).click();
 await page.getByRole('combobox',{name:'Yapı kullanımı'}).selectOption({label:'Konut / villa'});
 await page.getByRole('spinbutton',{name:'Hedef brüt alan m²'}).fill('800');
 await page.getByRole('spinbutton',{name:'Kat adedi kat'}).fill('2');
 await page.getByRole('spinbutton',{name:'Hedef kat yüksekliği m'}).fill('3.2');
 await page.getByRole('button',{name:'Sonraki adım →'}).click();await page.getByRole('button',{name:'Sonraki adım →'}).click();
 await page.getByRole('button',{name:'ARKEMX projesini başlat →'}).click();
 await page.getByRole('heading',{name:'AREA FLOW FIX TEST',exact:true}).waitFor();
 await page.getByRole('link',{name:'Mimari ihtiyaç programı çalışma alanını açın'}).click();
 await page.getByRole('button',{name:'Taslak dağılımı hedefe ölçekle'}).click();
 await page.waitForFunction(()=>{const p=JSON.parse(localStorage.getItem('arkem-project-kernel-v2')).payload;const a=p.modules['architectural-program'];const plan=p.modules['plan-editor'];return plan?.elements?.filter(e=>e.type==='space').every(e=>a.spaces.some(s=>s.id===e.sourceSpaceId&&Math.abs(s.unitArea-e.sourceUnitArea)<.01));});
 const project=await saved(), plan=project.modules['plan-editor'];
 assert.ok(plan.elements.length>0);
 for(const e of plan.elements.filter(e=>e.type==='space')) {
  const plate=plan.floorPlates.find(p=>p.level===e.level);
  const area=e.widthBays*plate.width/plan.baysX*e.heightBays*plate.depth/plan.baysY;
  assert.ok(Math.abs(area-e.sourceUnitArea)/e.sourceUnitArea<.03,`${e.id}: ${area}/${e.sourceUnitArea}`);
 }
 await page.getByRole('link',{name:'Proje Çalışma Alanı',exact:true}).click();
 await page.getByRole('link',{name:'Sistem Henüz başlanmadı',exact:true}).waitFor();
 await page.reload();await page.getByRole('link',{name:'Sistem Henüz başlanmadı',exact:true}).waitFor();
 await page.goto(base+'/proje-takibi');await page.getByTestId('project-operating-system').waitFor();
 await page.getByRole('link',{name:'Proje merkezi',exact:true}).click();
 await page.getByRole('link',{name:'Sistem Eksik kontrol var',exact:true}).waitFor();
 assert.deepEqual(errors,[]);fs.writeFileSync('test-artifacts/program-stage-fixes-browser.json',JSON.stringify({passed:true,projectId:project.id,checks:['scaled program metadata and geometric areas match for every generated room','unvisited System stage remains not started','reload preserves unvisited System stage'],errors},null,2));
} finally {await browser.close();}
