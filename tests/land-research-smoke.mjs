// Synthetic HTTP fixtures test the real UI and persistence, not live advertisements.
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {chromium} from 'playwright';
import {encodeProjectEnvelope,PROJECT_STORAGE_KEY} from '../app/lib/project-storage.ts';
import {landCriteriaKey} from '../app/lib/land-research.ts';
const root=process.env.ARKEMX_E2E_URL || 'http://127.0.0.1:5173';
const project={schema:'ARKEM-PROJECT/1.0',id:'ARK-LAND-TEST',name:'Sentetik agent testi',revision:'P01',phase:'Ön fizibilite',coordinateReference:'WGS84 / EPSG:4326',updatedAt:new Date().toISOString(),experience:{mode:'guided',autoHandoff:false,lastSynchronizedAt:''},events:[],modules:{'decision-assistant':{input:{name:'Sentetik agent testi',projectType:'new',usage:'industrial',location:'Kastamonu Merkez',parcelStatus:'unknown',targetArea:1200,floors:2,floorHeight:4,system:'undecided',priorities:['cost'],budget:'undecided',timeline:'flexible',documents:[],experienceMode:'guided'}}}};
const url='https://www.sahibinden.com/ilan/emlak-arsa-satilik-sentetik-test-123456789/detay';
const candidate={id:url,url,title:'Sentetik arsa test adayı',source:'Sentetik test kaynağı',province:'Kastamonu',district:'Merkez',tenure:'sale',areaM2:3000,priceTRY:9000000,use:'industrial',description:'Yalnız otomatik test verisi',retrievedAt:new Date().toISOString(),basis:'ai-search'};
const browser=await chromium.launch();
const context=await browser.newContext({viewport:{width:1366,height:900}});
await context.addCookies([{name:'arkemx_prototype_session',value:'1',url:root}]);
await context.addInitScript(({key,envelope})=>{if(!sessionStorage.getItem('land-test-seeded')){localStorage.clear();localStorage.setItem(key,envelope);sessionStorage.setItem('land-test-seeded','1');}}, {key:PROJECT_STORAGE_KEY,envelope:encodeProjectEnvelope(project)});
const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
let ready=true,mode='result';
await page.route('**/api/land-candidates',async route=>{
 if(route.request().method()==='GET') return route.fulfill({json:{ready,provider:ready?'AI web araştırması':null}});
 const criteria=route.request().postDataJSON();
 if(mode==='error') return route.fulfill({status:502,json:{error:'Sentetik bağlantı hatası'}});
 if(mode==='delayed') await new Promise(resolve=>setTimeout(resolve,800));
 try {await route.fulfill({json:{schema:'ARKEM-LAND-SEARCH/1.0',criteriaKey:landCriteriaKey(criteria),searchedAt:new Date().toISOString(),provider:'Test',candidates:mode==='empty'?[]:[candidate]}});} catch { /* The UI may abort a stale request. */ }
});
const research=()=>page.locator('[data-testid="land-research-studio"]');
const shortlist=()=>page.getByRole('region',{name:'Kaydedilen kısa liste'});
async function open(){await page.goto(root+'/arsa-arastirma');await research().getByRole('button',{name:'Adayları getir',exact:true}).waitFor();}
async function search(){const button=research().getByRole('button',{name:'Adayları getir',exact:true});await page.waitForFunction(()=>!document.querySelector('.land-criteria button[type=submit]')?.disabled);await button.click();}
async function saved(){await page.waitForFunction(key=>JSON.parse(localStorage.getItem(key))?.payload?.modules?.['decision-assistant']?.landResearch?.shortlist?.length===1,PROJECT_STORAGE_KEY);}
try {
 await page.goto(root+'/dijital-proje-merkezi');await page.locator('a[href="/arsa-arastirma"]').first().waitFor();console.log('PASS unknown land starts research');
 await open();assert.equal(await research().getByLabel('İl',{exact:true}).inputValue(),'Kastamonu');
 await research().getByLabel('En az arsa alanı').fill('2000');await research().getByLabel('En fazla arsa alanı').fill('5000');await research().getByLabel('Arsa satın alma bütçesi').fill('10000000');
 await search();await research().getByRole('button',{name:'Kısa listeye al',exact:true}).click();await saved();
 await shortlist().getByRole('button',{name:'İncelemeye al',exact:true}).click();await research().getByRole('link',{name:'Parsel incelemesine geç'}).waitFor();
 await page.reload();await shortlist().getByText('Sentetik arsa test adayı',{exact:false}).first().waitFor();await research().getByRole('link',{name:'Parsel incelemesine geç'}).waitFor();console.log('PASS shortlist and selection survive reload');
 await research().getByRole('link',{name:'Parsel incelemesine geç'}).click();await page.getByRole('complementary',{name:'İncelemeye alınan arsa adayı'}).waitFor();console.log('PASS candidate remains unverified on parcel screen');
 await open();await research().getByLabel('Arsa satın alma bütçesi').fill('1000');await research().getByRole('button',{name:'Kriterleri kaydet'}).click();assert.equal(await research().getByRole('link',{name:'Parsel incelemesine geç'}).count(),0);assert.equal(await shortlist().getByRole('button',{name:'İncelemeye al'}).isDisabled(),true);
 await page.goto(root+'/dijital-proje-merkezi');await page.locator('a[href="/arsa-arastirma"]').first().waitFor();console.log('PASS conflicting criteria return project to research');
 await open();await research().getByLabel('Arsa satın alma bütçesi').fill('10000000');mode='empty';await search();await research().getByText('Bu aramada gösterilecek aday bulunamadı.').waitFor();assert.equal(await shortlist().locator('article').count(),1);
 mode='error';await search();await research().getByText('Sentetik bağlantı hatası',{exact:true}).waitFor();assert.equal(await shortlist().locator('article').count(),1);console.log('PASS empty/error responses preserve shortlist');
 mode='delayed';await search();await research().getByLabel('İl',{exact:true}).fill('Ankara');await page.waitForTimeout(1000);assert.equal(await page.locator('.land-results article').count(),0);console.log('PASS stale searches do not populate revised criteria');
 ready=false;await page.reload();await research().getByRole('heading',{name:'Canlı araştırma bağlantısı bekleniyor'}).waitFor();assert.equal(await research().getByRole('button',{name:'Adayları getir',exact:true}).isDisabled(),true);assert.equal(await shortlist().locator('article').count(),1);console.log('PASS missing API access is explicit');
 await mkdir('test-artifacts',{recursive:true});
 for(const width of [1366,390]){await page.setViewportSize({width,height:900});for(const theme of ['light','dark']){await page.evaluate(theme=>{document.documentElement.dataset.theme=theme;},theme);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'horizontal overflow');await page.screenshot({path:`test-artifacts/land-${width}-${theme}.png`,fullPage:true});}}
 console.log('PASS mobile/desktop widths');assert.deepEqual(errors,[]);
}finally{await browser.close();}
