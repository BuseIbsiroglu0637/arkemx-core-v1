// Synthetic HTTP fixtures test the real UI and persistence, not live advertisements.
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {chromium} from 'playwright';
import {encodeProjectEnvelope,PROJECT_STORAGE_KEY} from '../app/lib/project-storage.ts';
import {landCriteriaKey} from '../app/lib/land-research.ts';
const root=process.env.ARKEMX_E2E_URL || 'http://127.0.0.1:5173';
const project={schema:'ARKEM-PROJECT/1.0',id:'ARK-LAND-TEST',name:'Sentetik agent testi',revision:'P01',phase:'Ön fizibilite',coordinateReference:'WGS84 / EPSG:4326',updatedAt:new Date().toISOString(),experience:{mode:'guided',autoHandoff:false,lastSynchronizedAt:''},events:[],modules:{'decision-assistant':{input:{name:'Sentetik agent testi',projectType:'new',usage:'industrial',location:'Kastamonu Merkez',parcelStatus:'unknown',targetArea:1200,floors:2,floorHeight:4,system:'undecided',priorities:['cost'],budget:'undecided',timeline:'flexible',documents:[],experienceMode:'guided'}}}};
const url='https://www.emlakjet.com/ilan/sentetik-arsa-12345678';
const candidate={id:url,url,title:'Sentetik arsa test adayı',source:'Sentetik test kaynağı',province:'Kastamonu',district:'Merkez',tenure:'sale',areaM2:3000,priceTRY:9000000,use:'industrial',description:'Yalnız otomatik test verisi',retrievedAt:new Date().toISOString(),basis:'browser-listing'};
const browser=await chromium.launch();
const context=await browser.newContext({viewport:{width:1366,height:900}});
await context.addCookies([{name:'arkemx_prototype_session',value:'1',url:root}]);
await context.addInitScript(({key,envelope})=>{if(!sessionStorage.getItem('land-test-seeded')){localStorage.clear();localStorage.setItem(key,envelope);sessionStorage.setItem('land-test-seeded','1');}}, {key:PROJECT_STORAGE_KEY,envelope:encodeProjectEnvelope(project)});
const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
let ready=true,mode='result';
await page.route('**/api/land-candidates',async route=>{
 if(route.request().method()==='GET') return route.fulfill({json:{ready,provider:ready?'Hepsiemlak tarayıcı denemesi':null,mode:'local-browser'}});
 const criteria=route.request().postDataJSON();
 if(mode==='error') return route.fulfill({status:502,json:{code:'source-blocked',error:'Sentetik bağlantı hatası',sources:[{name:'Hepsiemlak',status:'blocked',readCount:0,totalCount:null}]}});
 if(mode==='delayed') await new Promise(resolve=>setTimeout(resolve,800));
 try {await route.fulfill({json:{schema:'ARKEM-LAND-SEARCH/1.0',criteriaKey:landCriteriaKey(criteria),searchedAt:new Date().toISOString(),provider:'Test',sources:[{name:'Hepsiemlak',status:'completed',readCount:1,totalCount:131}],candidates:mode==='empty'?[]:[candidate]}});} catch { /* The UI may abort a stale request. */ }
});
let detailCalls=0;
await page.route('**/api/land-candidate-detail', route => {
 detailCalls++;
 return route.fulfill({json:{detailVersion:2,zoningDeclaration:{province:'Kastamonu',district:'Merkez',neighborhood:'Kuzyaka Köyü',taks:0.4,kaks:0.8,hmax:7.5,landUse:'Konut İmarlı',sourceUrl:url,retrievedAt:new Date().toISOString(),evidence:'Sentetik açık TAKS/KAKS/Hmax bilgileri',basis:'listing-declaration'},schema:'ARKEM-LAND-PARCEL-DETAIL/1.0',url,status:'found',parcelIdentity:{province:'Kastamonu',district:'Merkez',neighborhood:'Kuzyaka Köyü',block:'143',parcelNo:'11',sourceUrl:url,retrievedAt:new Date().toISOString(),basis:'listing-declaration'}}});
});
let officialMode='not-found',officialCalls=0;
await page.route('**/api/zoning-conditions',route=>{
 officialCalls++;
 const identity=route.request().postDataJSON();
 return route.fulfill({json:{schema:'ARKEM-OFFICIAL-ZONING/1.0',identity,retrievedAt:new Date().toISOString(),status:officialMode,message:officialMode==='found'?'Sentetik resmî servis kaydı okundu; doğrulama bekliyor.':'Bu parsel için kaynakta konut imar kaydı bulunamadı.',
 ...(officialMode==='found'?{conditions:{taks:.25,kaks:.75,hmax:9.5,frontSetback:5,sideSetback:3,buildingOrder:'Ayrık',landUse:'Konut Alanı'},source:{url:'https://e-imar.kastamonuozelidare.gov.tr/arcgis/rest/services/IDARE_PUBLIC/IMAR_PUBLIC/FeatureServer/1826',authority:'Kastamonu İl Özel İdaresi',planId:'UIP-TEST',planName:'Sentetik uygulama planı',planScale:'1/1000 Uygulama İmar Planı',approvalDate:'2025-01-01',planStatus:'Onaylandi',featureId:42}}:{})}});
});
await page.route('**/api/tkgm?*',route=>{
 const path=new URL(route.request().url()).searchParams.get('path');
 const properties=path==='idariYapi/ilListe'?{id:37,text:'Kastamonu'}:path==='idariYapi/ilceListe/37'?{id:1,text:'Merkez'}:{id:2,text:'Kuzyaka Köyü'};
 return route.fulfill({json:{features:[{properties}]}});
});
const research=()=>page.locator('[data-testid="land-research-studio"]');
const shortlist=()=>page.getByRole('region',{name:'Kaydedilen kısa liste'});
async function open(){await page.goto(root+'/arsa-arastirma');await research().getByRole('button',{name:'Adayları getir',exact:true}).waitFor();}
async function search(){assert.equal(await research().locator('form').evaluate(f=>f.checkValidity()),true,'research form defaults and constraints must allow submission');const button=research().getByRole('button',{name:'Adayları getir',exact:true});await page.waitForFunction(()=>!document.querySelector('.land-criteria button[type=submit]')?.disabled);await button.click();}
async function saved(){await page.waitForFunction(key=>JSON.parse(localStorage.getItem(key))?.payload?.modules?.['decision-assistant']?.landResearch?.shortlist?.length===1,PROJECT_STORAGE_KEY);}
try {
 await page.goto(root+'/dijital-proje-merkezi');await page.locator('a[href="/arsa-arastirma"]').first().waitFor();console.log('PASS unknown land starts research');
 await open();assert.equal(await research().getByLabel('İl',{exact:true}).inputValue(),'Kastamonu');
 assert.equal(await research().getByLabel('En az arsa alanı').inputValue(),'2000'); console.log('PASS minimum land area defaults from project gross area and floors');
 await research().getByLabel('En az arsa alanı').fill('2000');await research().getByLabel('En fazla arsa alanı').fill('5000');await research().getByLabel('Arsa satın alma bütçesi').fill('10000000');
 await search();await research().getByText('Tarayıcıda okunan ilan kartı',{exact:true}).waitFor();await research().getByText('Hepsiemlak: Arama tamamlandı',{exact:true}).waitFor();assert.equal(await research().locator('option[value="rent"]').evaluate(option=>option.disabled),true);await research().getByRole('button',{name:'Kısa listeye al',exact:true}).click();await saved();
 await shortlist().getByRole('button',{name:'İncelemeye al',exact:true}).click();await research().getByRole('link',{name:'Parsel incelemesine geç'}).waitFor();
 await page.reload();await shortlist().getByText('Sentetik arsa test adayı',{exact:false}).first().waitFor();await research().getByRole('link',{name:'Parsel incelemesine geç'}).waitFor();console.log('PASS shortlist and selection survive reload');
 await research().getByRole('link',{name:'Parsel incelemesine geç'}).click();await page.getByRole('complementary',{name:'İncelemeye alınan arsa adayı'}).waitFor();console.log('PASS candidate remains unverified on parcel screen');
 await page.waitForFunction(()=>document.querySelector('input[placeholder="Ada numarası"]')?.value==='143');
 assert.equal(await page.getByPlaceholder('Parsel numarası',{exact:true}).inputValue(),'11');
 await page.waitForFunction(()=>document.querySelector('.geo-cascade-fields select')?.value==='37');
 await page.waitForFunction(key=>JSON.parse(localStorage.getItem(key))?.payload?.modules?.['geo-parcel']?.block==='143',PROJECT_STORAGE_KEY);
 const geo=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)).payload.modules['geo-parcel'],PROJECT_STORAGE_KEY);
 assert.equal(geo.neighborhood,'Kuzyaka Köyü'); assert.equal(geo.parcel.length,0); assert.equal(geo.metrics.area,0); assert.equal(geo.parcelRecord.projectEligible,false);
 await page.reload(); await page.waitForFunction(()=>document.querySelector('input[placeholder="Ada numarası"]')?.value==='143');
 assert.equal(detailCalls,1); assert.equal(await page.getByPlaceholder('Parsel numarası',{exact:true}).inputValue(),'11');
 console.log('PASS automatic ada/parsel prefill persists, keeps listing area out of engineering calculations');
 await page.waitForFunction(key=>JSON.parse(localStorage.getItem(key)).payload.modules['geo-parcel']?.zoning?.taks===0.4,PROJECT_STORAGE_KEY);
 const transferred=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)).payload.modules['geo-parcel'].zoning,PROJECT_STORAGE_KEY);
 assert.equal(transferred.kaks,0.8);assert.equal(transferred.hmax,7.5);assert.equal(transferred.sourceUrl,url);assert.equal(transferred.verification,'user-declared');assert.equal(transferred.expertReviewStatus,'not-reviewed');
 await page.getByRole('button',{name:/^03 İmar bilgileri/}).click();
 assert.equal(await page.getByPlaceholder('TAKS girin',{exact:true}).inputValue(),'0.4');assert.equal(await page.getByPlaceholder('KAKS / emsal girin',{exact:true}).inputValue(),'0.8');assert.equal(await page.getByPlaceholder('Hmax girin',{exact:true}).inputValue(),'7.5');
 console.log('PASS explicit listing zoning fields auto-transfer and differ from land search assumptions');
 await page.getByLabel('Resmî imar sorgusu').getByText('Bu parsel için kaynakta konut imar kaydı bulunamadı.',{exact:true}).waitFor();
 assert.ok(officialCalls>0);officialMode='found';
 await page.getByRole('button',{name:'Resmî imar kaynağını yeniden sorgula',exact:true}).click();
 await page.waitForFunction(()=>document.querySelector('input[placeholder="TAKS girin"]')?.value==='0.25');
 assert.equal(await page.getByPlaceholder('KAKS / emsal girin',{exact:true}).inputValue(),'0.75');
 assert.equal(await page.getByPlaceholder('Hmax girin',{exact:true}).inputValue(),'9.5');
 await page.waitForFunction(key=>JSON.parse(localStorage.getItem(key)).payload.modules['geo-parcel']?.zoning?.sourceType==='Resmî e-İmar servisi',PROJECT_STORAGE_KEY);
 const official=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)).payload.modules['geo-parcel'].zoning,PROJECT_STORAGE_KEY);
 assert.equal(official.verification,'municipal-viewer');assert.equal(official.expertReviewStatus,'not-reviewed');assert.equal(official.planId,'UIP-TEST');assert.equal(official.rearSetback,-1);
 const callsBeforeReload=officialCalls;await page.reload();
 await page.waitForFunction(key=>JSON.parse(localStorage.getItem(key)).payload.modules['geo-parcel']?.zoning?.taks===0.25,PROJECT_STORAGE_KEY);
 await page.getByRole('button',{name:/^03 İmar bilgileri/}).click();
 await page.getByPlaceholder('TAKS girin',{exact:true}).waitFor();assert.equal(await page.getByPlaceholder('TAKS girin',{exact:true}).inputValue(),'0.25');assert.equal(officialCalls,callsBeforeReload);
 console.log('PASS automatic official zoning query, source-bound transfer and cache survive reload without approved rights');



 await open();await research().getByLabel('Arsa satın alma bütçesi').fill('1000');await research().getByRole('button',{name:'Kriterleri kaydet'}).click();assert.equal(await research().getByRole('link',{name:'Parsel incelemesine geç'}).count(),0);assert.equal(await shortlist().getByRole('button',{name:'İncelemeye al'}).isDisabled(),true);
 await page.goto(root+'/dijital-proje-merkezi');await page.locator('a[href="/arsa-arastirma"]').first().waitFor();console.log('PASS conflicting criteria return project to research');
 await open();await research().getByLabel('Arsa satın alma bütçesi').fill('10000000');mode='empty';await search();await research().getByText('Bu aramada gösterilecek aday bulunamadı.').waitFor();assert.equal(await shortlist().locator('article').count(),1);
 mode='error';await search();await research().getByText('Sentetik bağlantı hatası',{exact:true}).waitFor();await research().getByText('Hepsiemlak: Erişim engellendi',{exact:true}).waitFor();await research().getByText('Araştırma tamamlanamadığı için ilanlar okunamadı.',{exact:true}).waitFor();assert.equal(await shortlist().locator('article').count(),1);console.log('PASS empty/error responses preserve shortlist');
 mode='delayed';await search();await research().getByLabel('İl',{exact:true}).fill('Ankara');await page.waitForTimeout(1000);assert.equal(await page.locator('.land-results article').count(),0);console.log('PASS stale searches do not populate revised criteria');
 ready=false;await page.reload();await research().getByRole('heading',{name:'Canlı araştırma bağlantısı bekleniyor'}).waitFor();assert.equal(await research().getByRole('button',{name:'Adayları getir',exact:true}).isDisabled(),true);assert.equal(await shortlist().locator('article').count(),1);console.log('PASS missing API access is explicit');
 await mkdir('test-artifacts',{recursive:true});
 for(const width of [1366,390]){await page.setViewportSize({width,height:900});for(const theme of ['light','dark']){await page.evaluate(theme=>{document.documentElement.dataset.theme=theme;},theme);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'horizontal overflow');await page.screenshot({path:`test-artifacts/land-${width}-${theme}.png`,fullPage:true});}}
 console.log('PASS mobile/desktop widths');
 const other={...project,id:'ARK-LAND-OTHER',name:'İkinci sentetik proje',updatedAt:new Date().toISOString()};
 await page.evaluate(({key,envelope})=>{localStorage.clear();localStorage.setItem(key,envelope);},{key:PROJECT_STORAGE_KEY,envelope:encodeProjectEnvelope(other)});
 await page.reload();await research().getByText('İkinci sentetik proje',{exact:true}).waitFor();assert.equal(await shortlist().locator('article').count(),0);console.log('PASS projects keep separate shortlists');
 const sizingProject={...other,modules:{'decision-assistant':{input:{...other.modules['decision-assistant'].input,targetArea:1000,floors:10}}}};
 await page.evaluate(({key,envelope})=>{localStorage.clear();localStorage.setItem(key,envelope);},{key:PROJECT_STORAGE_KEY,envelope:encodeProjectEnvelope(sizingProject)});
 await page.reload(); await research().getByText('700 m²',{exact:true}).waitFor();
 assert.equal(await research().getByLabel('En az arsa alanı').inputValue(),'700');
 await research().getByLabel('En az arsa alanı').fill('900');await research().getByRole('button',{name:'Kriterleri kaydet'}).click();
 await page.waitForFunction(key=>JSON.parse(localStorage.getItem(key)).payload.modules['decision-assistant'].landResearch?.areaSizing?.mode==='manual',PROJECT_STORAGE_KEY);
 const revised=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)).payload,PROJECT_STORAGE_KEY);
 revised.modules['decision-assistant'].input.targetArea=2000;
 await page.evaluate(({key,envelope})=>localStorage.setItem(key,envelope),{key:PROJECT_STORAGE_KEY,envelope:encodeProjectEnvelope(revised)});
 await page.reload();await research().getByText('1.350 m²',{exact:true}).waitFor();
 assert.equal(await research().getByLabel('En az arsa alanı').inputValue(),'900');
 await research().getByRole('button',{name:'Önerilen alt sınırı kullan',exact:true}).click();
 assert.equal(await research().getByLabel('En az arsa alanı').inputValue(),'1350');
 await research().getByRole('button',{name:'Kriterleri kaydet'}).click();
 await page.waitForFunction(key=>JSON.parse(localStorage.getItem(key)).payload.modules['decision-assistant'].landResearch?.areaSizing?.mode==='auto',PROJECT_STORAGE_KEY);
 const enlarged=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)).payload,PROJECT_STORAGE_KEY);
 enlarged.modules['decision-assistant'].input.targetArea=3000;
 await page.evaluate(({key,envelope})=>localStorage.setItem(key,envelope),{key:PROJECT_STORAGE_KEY,envelope:encodeProjectEnvelope(enlarged)});
 await page.reload();await research().getByText('2.000 m²',{exact:true}).waitFor();
 assert.equal(await research().getByLabel('En az arsa alanı').inputValue(),'2000');
 await research().getByText('Arsa hesabı varsayımlarını düzenle',{exact:true}).click();
 await research().getByLabel('Varsayılan emsal',{exact:true}).fill('1');
 assert.equal(await research().getByLabel('En az arsa alanı').inputValue(),'3000');
 console.log('PASS sizing auto-updates after brief revisions, preserves manual limits and accepts changed assumptions');
 assert.deepEqual(errors,[]);
}catch(error){console.error('UI DIAGNOSTIC',JSON.stringify({errors,text:await research().innerText().catch(()=>''),forms:await page.locator('.land-criteria input').evaluateAll(es=>es.map(e=>({label:e.closest('label')?.textContent,value:e.value})))},null,2));throw error;}finally{await browser.close();}

