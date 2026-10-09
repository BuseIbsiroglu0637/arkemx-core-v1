import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { PROJECT_MODULES } from '../app/lib/project-graph.ts';
import { encodeProjectEnvelope, PROJECT_STORAGE_KEY } from '../app/lib/project-storage.ts';
const root=process.env.ARKEMX_E2E_URL||'http://127.0.0.1:5173';
const base={schema:'ARKEM-PROJECT/1.0',id:'MODULE-AUDIT',name:'Sentetik modül kontrolü',revision:'P01',phase:'Ön fizibilite',coordinateReference:'WGS84 / EPSG:4326',updatedAt:'2026-10-05T12:00:00Z',experience:{mode:'guided',autoHandoff:false,lastSynchronizedAt:''},events:[],modules:{}};
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const context=await browser.newContext();
await context.route('https://api.sketchfab.com/**',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({results:[]})}));
await context.route('https://sketchfab.com/**',route=>route.abort());
const page=await context.newPage();
const errors=[];page.on('pageerror',error=>errors.push(error.message));
page.setDefaultTimeout(15000);
const saved=async()=>page.evaluate(key=>JSON.parse(localStorage.getItem(key))?.payload?.modules,PROJECT_STORAGE_KEY);
async function seed(modules) {
 await page.goto(root+'/araclar');
 await page.evaluate(({key,value})=>localStorage.setItem(key,value),{key:PROJECT_STORAGE_KEY,value:encodeProjectEnvelope({...base,modules})});
}
async function open(route) {
 const response=await page.goto(root+route,{waitUntil:'domcontentloaded'});
 assert.equal(response.status(),200,route);
 await page.locator('main').first().waitFor();
}
try {
 for (const moduleEntry of PROJECT_MODULES) {
   await seed({});
   await open(moduleEntry.route);
   await page.waitForFunction(key=>Boolean(localStorage.getItem(key)),PROJECT_STORAGE_KEY);
   assert.ok((await page.locator('main').first().innerText()).length>80,moduleEntry.label);
   console.log('PASS module route '+moduleEntry.code+' '+moduleEntry.label);
 }
 const cases=[
 {key:'decision-assistant',route:'/proje-karar-asistani',module:{input:{goal:'konut',stage:'on-proje',system:'celik',location:'Kastamonu / Merkez',area:'1777',documents:['arsa'],priorities:['butce']}},selector:'.decision-fields input[placeholder="Örn. 450 m²"]',value:'1777',field:'area'},
 {key:'digital-delivery-scope',route:'/bilgi-teslim-plani',module:{input:{type:'konut',area:1700,priority:'cost',phase:'Yapım',modelDetail:'LOD 350 / arayüzler',capabilities:{gis:false,bim:true,schedule:false,cost:true,reality:false,asset:false}}},selector:'.innovation-controls input[type="number"]',value:'1700',field:'area'},
 {key:'arkem-x',route:'/performans-laboratuvari',module:{input:{area:1800,type:'Depo / Lojistik',priority:'Yatırım maliyeti',system:'Yapısal Çelik',transport:270,recycled:0,assetChecks:Array(8).fill(false)}},selector:'.xlab-controls input[type="number"]',value:'1800',field:'area'},
 {key:'demolition-screening',route:'/yikim-karar-studyosu',module:{input:{height:61,floors:17,neighbor:46},selectedMethod:'mechanical',gates:Array.from({length:8},()=>({complete:false}))},selector:'.demolition-controls input[type="number"][min="3"]',value:'61',field:'height'},
 {key:'model-library-review',route:'/3b-model-kutuphanesi',module:{selected:{uid:'saved-model-test',name:'Kaydedilmiş model'},reviewNote:'Revizyon B incelenecek',reviewStatus:'Revizyon gerekli',modelPurpose:'As-built karşılaştırma'},selector:'.sketchfab-review textarea',value:'Revizyon B incelenecek',field:null},
 ];
 for (const item of cases) {
   await seed({[item.key]:item.module});
   await open(item.route);
   await page.waitForFunction(({selector,value})=>document.querySelector(selector)?.value===value,{selector:item.selector,value:item.value});
   assert.equal(await page.locator(item.selector).first().inputValue(),item.value);
   await page.reload();
   await page.waitForFunction(({selector,value})=>document.querySelector(selector)?.value===value,{selector:item.selector,value:item.value});
   const snapshot=(await saved())[item.key];
   if(item.field) assert.equal(String(snapshot.input[item.field]),item.value);
   else assert.equal(snapshot.reviewNote,item.value);
   if(item.key==='digital-delivery-scope') assert.equal(snapshot.input.capabilities.gis,false);
   if(item.key==='arkem-x') {assert.equal(snapshot.input.transport,270);assert.equal(snapshot.input.recycled,0);assert.deepEqual(snapshot.input.assetChecks,Array(8).fill(false));}
   if(item.key==='demolition-screening') assert.ok(snapshot.gates.every(gate=>gate.complete===false));
   console.log('PASS saved draft survives reopening '+item.key);
 }
 await seed({'project-os':{week:29,documents:[],decisions:[],qualityOpen:[false,false,false,false],handover:[false,false,false,false,false,false]}});
 await open('/proje-takibi');
 await page.getByTestId('project-operating-system').waitFor();
 await page.getByText('4B program özeti · hafta 29',{exact:true}).waitFor();
 await page.waitForFunction(key=>JSON.parse(localStorage.getItem(key))?.payload?.modules?.['project-os']?.status==='v116-project-os-2',PROJECT_STORAGE_KEY);
 let os=(await saved())['project-os'];assert.equal(os.week,29);assert.deepEqual(os.documents,[]);assert.deepEqual(os.handover,Array(6).fill(false));
 await page.reload();await page.getByTestId('project-operating-system').waitFor();
 await page.getByText('4B program özeti · hafta 29',{exact:true}).waitFor();
 await page.waitForFunction(key=>JSON.parse(localStorage.getItem(key))?.payload?.modules?.['project-os']?.status==='v116-project-os-2',PROJECT_STORAGE_KEY);
 os=(await saved())['project-os'];assert.equal(os.week,29);assert.deepEqual(os.handover,Array(6).fill(false));
 assert.deepEqual(errors,[]);
 console.log('PASS all module routes and saved drafts; no browser runtime errors');
} finally {await browser.close();}
