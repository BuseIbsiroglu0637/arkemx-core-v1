// Synthetic regression fixtures; no cadastral or engineering approval evidence.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { registerHooks } from "node:module";
import { chromium } from "playwright";
import { encodeProjectEnvelope } from "../app/lib/project-storage.ts";
import { stampProjectModule } from "../app/lib/project-core.ts";
import { buildProgramPlanElements } from "../app/lib/plan-program.ts";
registerHooks({resolve(s,c,next){if(s.startsWith(".")&&!path.extname(s)){const u=new URL(s+".ts",c.parentURL);if(fs.existsSync(fileURLToPath(u)))return next(u.href,c);}return next(s,c);}});
const { declaredModuleUnits } = await import("../app/lib/project-integrity.ts");
const out = path.resolve(process.env.ARKEMX_G05_EVIDENCE_DIR ?? "test-artifacts/g05");
fs.mkdirSync(out, { recursive: true });
const root = process.env.ARKEMX_E2E_BASE_URL ?? "http://127.0.0.1:5173", checks = [], errors = [];
const time = new Date().toISOString();
const stamp = (key,value) => stampProjectModule({...value,...(declaredModuleUnits(key)?{units:declaredModuleUnits(key)}:{})},{projectId:"G05-BROWSER",projectRevision:"P02",sourceModule:key,recordedAt:time,action:"updated"});
const spaces=[{id:"A",code:"A-1",name:"SYNTHETIC-A",count:2,unitArea:20,liveLoad:3.5},{id:"B",code:"B-1",name:"SYNTHETIC-B",count:1,unitArea:30,liveLoad:3.5}];
const plates=[{level:1,width:10,depth:10,grossArea:100,netArea:40},{level:2,width:20,depth:10,grossArea:200,netArea:30}];
const p={schema:"ARKEM-PROJECT/1.0",id:"G05-BROWSER",name:"G05 SENTETİK REGRESYON",revision:"P02",phase:"Ön fizibilite",coordinateReference:"LOCAL TEST ONLY",updatedAt:time,experience:{mode:"technical",autoHandoff:true,lastSynchronizedAt:""},events:[],modules:{
 "architectural-program":stamp("architectural-program",{input:{floors:2,targetGross:300,netRatio:78,aspect:1},result:{liveLoad:3.5,grossDemand:300},spaces,relationships:[]}),
 "plan-editor":stamp("plan-editor",{level:2,floorCount:2,baysX:2,baysY:2,spanX:5,spanY:5,floorPlates:plates,elements:buildProgramPlanElements(spaces,2,2,2,3.5,5,5,[],plates)}),
 "project-os":stamp("project-os",{coordination:{bimCoordination:{schema:"ARKEM-BIM-COORDINATION/3.0",clashes:[{guid:"A",title:"SYNTHETIC-RFI-A",severity:"high"},{guid:"B",title:"SYNTHETIC-RFI-B",severity:"high"}]}},workItems:[]})
}};
const browser=await chromium.launch({headless:true, ...(process.env.ARKEMX_E2E_BROWSER ? { executablePath: process.env.ARKEMX_E2E_BROWSER } : {})});
const context=await browser.newContext();const page=await context.newPage();page.on("pageerror",e=>errors.push(String(e)));
async function stored(){return page.evaluate(()=>JSON.parse(localStorage.getItem("arkem-project-kernel-v2"))?.payload);}
async function seed(project,url){await page.goto(root);await page.evaluate(raw=>{localStorage.clear();sessionStorage.clear();localStorage.setItem("arkem-project-kernel-v2",raw);},encodeProjectEnvelope(project));await page.goto(root+url);}
async function saved(){await page.waitForFunction(()=>JSON.parse(localStorage.getItem("arkem-project-kernel-v2"))?.payload?.modules?.["structural-concept"]?.modelContext?.selectedLevel===2,{},{timeout:60000});}
try {
 await seed(p,"/plan-ve-aks");await page.getByTestId("advanced-plan-editor").waitFor();await saved();
 let current=await stored();assert.equal(current.modules["structural-concept"].input.width,20);assert.equal(current.modules["structural-concept"].input.depth,10);assert.deepEqual(current.modules["plan-editor"].floorPlates,plates);checks.push("B06 rendered plan -> H03: K2 20x10, K1 10x10 preserved");
 const ids=current.modules["plan-editor"].elements.filter(e=>e.type==="space").map(e=>e.id).sort();
 current.modules["architectural-program"].spaces.reverse();current.modules["plan-editor"].floorPlates.reverse();await seed(current,"/plan-ve-aks");await saved();await page.reload();await saved();current=await stored();
 assert.equal(current.modules["structural-concept"].input.width,20);assert.deepEqual(current.modules["plan-editor"].elements.filter(e=>e.type==="space").map(e=>e.id).sort(),ids);checks.push("B06/B07 reorder + real page reload retain selected geometry and source element IDs");
 await page.screenshot({path:path.join(out,"B06-B07-browser.png"),fullPage:true});
 await page.goto(root+"/proje-takibi");await page.getByTestId("project-operating-system").waitFor();
 const cardA=page.locator(".arx-track-item").filter({has:page.getByRole("heading",{name:"SYNTHETIC-RFI-A",exact:true})});await cardA.getByRole("button",{name:"İncele",exact:true}).click();
 await page.waitForFunction(()=>JSON.parse(localStorage.getItem("arkem-project-kernel-v2"))?.payload?.modules?.["project-os"]?.workItems?.some(i=>i.sourceGuid==="A"&&i.status==="in-review"));
 current=await stored();const prior=current.modules["project-os"].workItems.filter(i=>i.sourceGuid);current.modules["project-os"].coordination.bimCoordination.clashes.reverse();await seed(current,"/proje-takibi");await page.reload();await page.getByTestId("project-operating-system").waitFor();
 await page.waitForFunction(()=>JSON.parse(localStorage.getItem("arkem-project-kernel-v2"))?.payload?.modules?.["project-os"]?.workItems?.[0]?.sourceGuid==="B");
 current=await stored();const after=current.modules["project-os"].workItems.filter(i=>i.sourceGuid);for(const item of prior)assert.equal(after.find(i=>i.sourceGuid===item.sourceGuid).id,item.id);assert.equal(after.find(i=>i.sourceGuid==="A").status,"in-review");assert.equal(after.find(i=>i.sourceGuid==="B").status,"open");
 await cardA.getByRole("button",{name:"Kapat",exact:true}).waitFor();checks.push("B08 real UI state change, source reorder and page reload preserve RFI ID and status without leakage");await page.screenshot({path:path.join(out,"B08-browser.png"),fullPage:true});assert.deepEqual(errors,[]);
 const finalProject=current;
 await seed(finalProject,"/tasiyici-on-tasarim");await page.getByTestId("nonuniform-floor-warning").waitFor();await page.waitForFunction(()=>{const s=JSON.parse(localStorage.getItem("arkem-project-kernel-v2"))?.payload?.modules?.["structural-concept"];return s?.geometrySupport?.status==="unsupported-nonuniform-floor-analysis"&&s?.result===null;});const structural=(await stored()).modules["structural-concept"];assert.equal(structural.input.width,20);assert.equal(structural.input.depth,10);assert.equal(structural.modelContext.floorPlates.length,2);checks.push("B06 structural UI retains selected geometry, flags unsupported nonuniform analysis and blocks result transfer");await page.screenshot({path:path.join(out,"B06-unsupported-analysis.png"),fullPage:true});
 assert.deepEqual(structural.alternatives,[]);assert.equal(structural.structuralStudio,null);assert.equal(await page.getByRole("button",{name:/A3 kurumsal teknik pafta|Ön boyutlandırma tablosu/}).count(),0);assert.equal(await page.getByText("400 m²",{exact:true}).count(),0);
 const downloadEvent=page.waitForEvent("download");await page.getByRole("button",{name:"Girdileri ve analiz sınırını indir",exact:true}).click();const download=await downloadEvent;const exported=JSON.parse(fs.readFileSync(await download.path(),"utf8"));assert.equal(exported.result,null);assert.equal(exported.structuralStudio,null);assert.equal(exported.geometrySupport.fullBuildingAnalysis,false);assert.equal(exported.sourceReferenceValidation.status,"consistent");assert.equal(exported.documentIdentity.references.status,"unsupported");assert.equal(exported.documentIdentity.references.calculationIds,null);assert.deepEqual(exported.documentIdentity.references.elementIds.slice().sort(),finalProject.modules["plan-editor"].elements.map(e=>e.id).sort());fs.writeFileSync(path.join(out,"B04-B06-actual-download.json"),JSON.stringify(exported,null,2));
 await page.reload();await page.getByTestId("nonuniform-floor-warning").waitFor();assert.equal((await stored()).modules["structural-concept"].result,null);checks.push("B04/B06 actual JSON download preserves real element refs, unavailable calculations and blocked nonuniform results after reload");
 const stale=structuredClone(current);stale.modules["plan-editor"]._kernel.projectRevision="P01";await seed(stale,"/plan-ve-aks");await page.getByTestId("project-integrity-warning").waitFor();assert.equal((await stored()).modules["plan-editor"]._kernel.projectRevision,"P01");checks.push("B01 UI reload warns and preserves stale P01 source instead of stamping P02");
 const invalid=structuredClone(current);delete invalid.modules["project-os"].coordination.bimCoordination.clashes[0].guid;await seed(invalid,"/proje-takibi");await page.getByText(/Koordinasyon aktarımı reddedildi:/).waitFor();assert.equal((await stored()).modules["project-os"].coordination.bimCoordination.clashes[0].guid,undefined);checks.push("B08 malformed source explicitly rejected in UI and preserved without fabricated GUID");assert.deepEqual(errors,[]);
 fs.writeFileSync(path.join(out,"browser_result.json"),JSON.stringify({executedAt:new Date().toISOString(),fixture:"synthetic",checks,errors,finalProject,technicalApproval:false},null,2));console.log(JSON.stringify({pass:checks.length,checks}));
} catch(e){await page.screenshot({path:path.join(out,"browser-failure.png"),fullPage:true});fs.writeFileSync(path.join(out,"browser_result.json"),JSON.stringify({executedAt:new Date().toISOString(),checks,errors,error:String(e),status:"FAILED",stored:await stored(),body:await page.locator("body").innerText()},null,2));throw e;}finally{await browser.close();}
