import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import {pathToFileURL,fileURLToPath} from "node:url";
import {registerHooks} from "node:module";
registerHooks({resolve(s,c,next){if(s.startsWith(".")&&!path.extname(s)){const u=new URL(s+".ts",c.parentURL);if(fs.existsSync(fileURLToPath(u)))return next(u.href,c);}return next(s,c);}});
const {stampProjectModule,ensureProjectModuleStamps} = await import("../app/lib/project-core.ts");
const {isPortalProject,validateAccountProjectPayload} = await import("../app/lib/customer-portal.ts");
const {createCoordinationPackage} = await import("../app/lib/coordination-package.ts");
const {expandProgramSpaces,buildProgramPlanElements} = await import("../app/lib/plan-program.ts");
const operating = await import("../app/lib/project-os-2.ts");
const {createDocumentIdentity} = await import("../app/lib/document-identity.ts");
const root=fileURLToPath(new URL("../",import.meta.url));
const kernel=fs.readFileSync(path.join(root,"app/components/ProjectKernel.tsx"),"utf8");
const helpers=kernel.slice(kernel.indexOf("type UnknownRecord ="),kernel.indexOf("const ProjectKernelContext ="));
const imports=[
["project-graph","deriveProjectThread"],["project-core","stampProjectModule"],
["plan-program","buildProgramPlanElements, deriveProgramFloorPlates"],
];
// Preserve the actual Kernel helper block. New source imports are detected rather than stubbed.
for(const m of kernel.matchAll(/^import \{ ([^\n]+) \} from "\.\.\/lib\/([^"]+)";$/gm)){
if(!imports.some(([name])=>name===m[2])&&!m[1].includes("type ")&&m[2]!=="module-navigation")imports.push([m[2],m[1]]);
}
const generated=path.join(fs.mkdtempSync(path.join(os.tmpdir(),"arkemx-g05-")),"helpers.ts");
fs.writeFileSync(generated,imports.map(([name,ids])=>'import { '+ids+' } from '+JSON.stringify(pathToFileURL(path.join(root,"app/lib",name+".ts")).href)+';').join("\n")+"\n"+helpers+"\nexport { synchronizeModules };\n");
const {synchronizeModules}=await import(pathToFileURL(generated).href);
const time="2026-10-08T09:00:00.000Z";
const units={schema:"ARKEM-UNITS/1.0",length:"m",area:"m2",force:"kN",surfaceLoad:"kN/m2",coordinates:"grid-bay"};
const stamp=(key,value)=>stampProjectModule(value,{projectId:"TEST",projectRevision:"P02",sourceModule:key,recordedAt:time,action:"updated"});
function project(){return {schema:"ARKEM-PROJECT/1.0",id:"TEST",name:"Test",revision:"P02",phase:"Ön fizibilite",updatedAt:time,events:[],modules:{"plan-editor":stamp("plan-editor",{units,level:2,floorCount:2,baysX:2,baysY:2,spanX:5,spanY:5,elements:[{id:"E-A",level:2,type:"load",load:3.5,provenance:"manual"}],floorPlates:[{level:1,width:10,depth:10},{level:2,width:20,depth:10}]})}};}
test("B01 stale revision rejected and never relabelled",()=>{const p=project();p.modules["plan-editor"]._kernel.projectRevision="P01";const out=ensureProjectModuleStamps(p.modules,{projectId:p.id,projectRevision:p.revision,recordedAt:time});assert.equal(out["plan-editor"]._kernel.projectRevision,"P01");assert.equal(isPortalProject({...p,modules:out}),false);});
test("B01 matching revision accepted",()=>assert.equal(isPortalProject(project()),true));
test("B02 export carries P02 and rejects conflicting BIM revision",()=>{const input={projectId:"TEST",projectRevision:"P02",coordinateReference:"LOCAL",serviceZone:.35,shaftArea:5,floorPlate:100,topics:[]};assert.equal(createCoordinationPackage(input).identity.revision,"P02");assert.throws(()=>createCoordinationPackage({...input,bimCoordination:{projectRevision:"P01"}}),/revision/i);});
test("B02 missing source revision is not replaced with P01",()=>assert.throws(()=>createCoordinationPackage({projectId:"TEST",coordinateReference:"LOCAL",topics:[]}),/revision/i));
test("B03 reject missing, mm and inconsistent dimensional units",()=>{for(const u of [undefined,"mm",{...units,length:"mm"},{...units,surfaceLoad:"N/mm2"}]){const p=project();p.modules["plan-editor"].units=u;if(u===undefined)delete p.modules["plan-editor"].units;assert.equal(isPortalProject(p),false);}});
test("B04 document does not invent calculation/element references",()=>{const d=createDocumentIdentity({projectCode:"TEST",module:"STR",revision:"P02"});assert.equal(d.references.status,"unsupported");assert.equal(d.references.calculationIds,null);assert.equal(d.references.elementIds,null);});
test("B04 H03 preserves real IDs/revision and marks computation pending",()=>{const p=project();const out=synchronizeModules(p.modules,["H-03"]).modules["structural-concept"];assert.deepEqual(out.inputElementIds,["E-A"]);assert.equal(out.sourceRevision,"P02");assert.equal(out.calculationId,null);assert.equal(out.referenceStatus,"pending-calculation");});
test("B05 missing provenance is rejected, ensure never manufactures it",()=>{const p=project();delete p.modules["plan-editor"]._kernel;const m=ensureProjectModuleStamps(p.modules,{projectId:p.id,projectRevision:p.revision,recordedAt:time});assert.equal(m["plan-editor"]._kernel,undefined);assert.equal(validateAccountProjectPayload("TEST",{...p,modules:m}).ok,false);});
test("B06 current floor geometry is used and all plates survive JSON reload",()=>{const p=JSON.parse(JSON.stringify(project()));const out=synchronizeModules(p.modules,["H-03"]).modules["structural-concept"];assert.equal(out.input.width,20);assert.equal(out.input.depth,10);assert.equal(out.modelContext.selectedLevel,2);assert.deepEqual(out.modelContext.floorPlates,p.modules["plan-editor"].floorPlates);p.modules["plan-editor"].floorPlates.reverse();assert.equal(synchronizeModules(p.modules,["H-03"]).modules["structural-concept"].input.width,20);});
test("B06 missing/duplicate selected floor must not use another floor",()=>{for(const plates of [[{level:1,width:10,depth:10}],[{level:2,width:20,depth:10},{level:2,width:15,depth:10}]]){const p=project();p.modules["plan-editor"].floorPlates=plates;assert.throws(()=>synchronizeModules(p.modules,["H-03"]),/floor|kat/i);}});
test("B07 missing or duplicate source IDs are explicitly rejected",()=>{assert.throws(()=>expandProgramSpaces([{name:"A"},{name:"B"}]),/identity|kimlik/i);assert.throws(()=>expandProgramSpaces([{id:"A"},{id:"A"}]),/identity|kimlik/i);});
test("B07 source and instance identities survive reorder and JSON reload",()=>{const rows=[{id:"A",name:"A",count:2,unitArea:20},{id:"B",name:"B",count:1,unitArea:30}];const keys=x=>expandProgramSpaces(x).map(r=>r.key).sort();assert.deepEqual(keys(rows),keys(JSON.parse(JSON.stringify([...rows].reverse()))));const seed=x=>buildProgramPlanElements(x,2,2,2,3.5,5,5).map(e=>e.id).sort();assert.deepEqual(seed(rows),seed(JSON.parse(JSON.stringify([...rows].reverse()))));});
test("B08 RFI source identity survives reorder and JSON reload",()=>{const input={projectId:"TEST",projectRevision:"P02",generatedAt:time};const clashes=[{guid:"A",title:"A"},{guid:"B",title:"B"}];const items=x=>operating.createProjectOperatingModel({...input,bimCoordination:{clashes:x}}).workItems.filter(i=>i.type==="rfi");const a=items(clashes),b=items(JSON.parse(JSON.stringify([...clashes].reverse())));for(const item of a)assert.equal(b.find(x=>x.sourceGuid===item.sourceGuid).id,item.id);});
test("B08 missing and duplicate clash GUIDs are rejected",()=>{for(const clashes of [[{title:"A"}],[{guid:"A"},{guid:"A"}]])assert.throws(()=>operating.createProjectOperatingModel({projectId:"TEST",projectRevision:"P02",bimCoordination:{clashes}}),/identity|kimlik/i);});
test("B08 legacy saved RFI state migrates by source GUID, mismatches do not transfer",()=>{const items=operating.createProjectOperatingModel({projectId:"TEST",projectRevision:"P02",bimCoordination:{clashes:[{guid:"B"},{guid:"A"}]}}).workItems;const restored=operating.restoreOperatingWorkStates([{id:"RFI-041",sourceGuid:"A",status:"closed"},{id:"RFI-042",sourceGuid:"MISSING",status:"closed"}],items);assert.equal(restored[items.find(i=>i.sourceGuid==="A").id],"closed");assert.equal(restored[items.find(i=>i.sourceGuid==="B").id],undefined);});
test("B01/B03/B05 handoff cannot relabel stale, unitless or unstamped sources",()=>{for(const mutate of [p=>p.modules["plan-editor"]._kernel.projectRevision="P01",p=>delete p.modules["plan-editor"].units,p=>delete p.modules["plan-editor"]._kernel]){const p=project();mutate(p);const out=synchronizeModules(p.modules,["H-03"],p);assert.deepEqual(out.applied,[]);assert.equal(out.modules["structural-concept"],undefined);}});
test("B06 invalid selected plate dimensions are rejected instead of grid fallback",()=>{const p=project();delete p.modules["plan-editor"].floorPlates[1].width;assert.throws(()=>synchronizeModules(p.modules,["H-03"]),/floor/i);assert.equal(isPortalProject(p),false);});
test("B08 ambiguous and old-revision saved states never transfer",()=>{const items=operating.createProjectOperatingModel({projectId:"TEST",projectRevision:"P02",bimCoordination:{clashes:[{guid:"A"}]}}).workItems;const a=items.find(i=>i.sourceGuid==="A");for(const rows of [[{sourceGuid:"A",status:"closed"},{sourceGuid:"A",status:"open"}],[{sourceGuid:"A",revision:"P01",status:"closed"}],[{id:a.id,status:"closed"}]])assert.equal(operating.restoreOperatingWorkStates(rows,items)[a.id],undefined);});
test("B02 conflicting federation revision is rejected",()=>assert.throws(()=>createCoordinationPackage({projectId:"TEST",projectRevision:"P02",bimCoordination:{federation:{commonRevision:"P01"}},topics:[]}),/revision/i));
test("B04 invalid declared references remain unsupported",()=>{const doc=createDocumentIdentity({projectCode:"TEST",module:"STR",revision:"P02",sourceRevision:"P01",elementIds:["E-A","E-A"],calculationIds:[""]});assert.equal(doc.references.status,"unsupported");assert.equal(doc.references.elementIds,null);assert.equal(doc.references.calculationIds,null);});
