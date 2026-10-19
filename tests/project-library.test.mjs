import test from "node:test";
import assert from "node:assert/strict";
import { loadProjectLibrary, saveLibraryProject, PROJECT_LIBRARY_KEY, PROJECT_LIBRARY_BACKUP_KEY } from "../app/lib/project-library.ts";
import { createDemoProject } from "../app/lib/demo.ts";
import { restoreBriefDraft } from "../app/lib/brief-draft.ts";
const memory = () => { const values = new Map(); return { values, getItem: k => values.get(k) ?? null, setItem: (k,v) => values.set(k,v) }; };
const project = (id, time = "2026-10-19T08:00:00.000Z") => ({ ...createDemoProject(), id, updatedAt: time });
test("multiple projects remain distinct and an update does not create a duplicate", () => {
 const storage = memory(); const a = project("A"), b = project("B");
 saveLibraryProject(storage,a); saveLibraryProject(storage,b);
 saveLibraryProject(storage,{ ...a, name:"A edited", updatedAt:"2026-10-19T09:00:00.000Z" });
 assert.equal(loadProjectLibrary(storage).length,2);
 assert.equal(loadProjectLibrary(storage)[0].name,"A edited");
 assert.equal(loadProjectLibrary(storage)[1].id,"B");
 saveLibraryProject(storage,a); assert.equal(loadProjectLibrary(storage)[0].name,"A edited");
});
test("a valid library backup recovers a corrupt primary without losing the backup", () => {
 const storage = memory(); saveLibraryProject(storage,project("A")); saveLibraryProject(storage,project("B"));
 const backup=storage.getItem(PROJECT_LIBRARY_BACKUP_KEY); storage.setItem(PROJECT_LIBRARY_KEY,"corrupt");
 assert.deepEqual(loadProjectLibrary(storage).map(p=>p.id),["A"]);
 saveLibraryProject(storage,project("C")); assert.equal(storage.getItem(PROJECT_LIBRARY_BACKUP_KEY),backup);
 assert.deepEqual(new Set(loadProjectLibrary(storage).map(p=>p.id)),new Set(["A","C"]));
});
test("unrecoverable data is reported and never replaced with an empty library", () => {
 const storage=memory(); storage.setItem(PROJECT_LIBRARY_KEY,"corrupt");storage.setItem(PROJECT_LIBRARY_BACKUP_KEY,"bad backup");
 assert.throws(()=>saveLibraryProject(storage,project("C")));
 assert.equal(storage.getItem(PROJECT_LIBRARY_KEY),"corrupt");
});
test("quota errors preserve the existing primary and do not claim a save", () => {
 const storage=memory();saveLibraryProject(storage,project("A"));const raw=storage.getItem(PROJECT_LIBRARY_KEY);
 const limited={...storage,setItem:(key,value)=>{if(key===PROJECT_LIBRARY_KEY)throw new Error("QuotaExceeded");storage.setItem(key,value);}};
 assert.throws(()=>saveLibraryProject(limited,project("B")));
 assert.equal(storage.getItem(PROJECT_LIBRARY_KEY),raw);
});
test("normal projects and the active snapshot are separate from the library", () => {
 const storage=memory(); storage.setItem("arkem-project-kernel-v2","normal");storage.setItem("arkem-demo-v177-project","active");
 saveLibraryProject(storage,project("A"));assert.equal(storage.getItem("arkem-project-kernel-v2"),"normal");assert.equal(storage.getItem("arkem-demo-v177-project"),"active");
 assert.throws(()=>saveLibraryProject(storage,{...project("B"),schema:"wrong"}));
});
test("brief fields round trip between projects and invalid stored options are filtered", () => {
 const a={goal:"konut",stage:"fikir",system:"hafif-celik",location:"Kastamonu Merkez",area:"450,5",documents:["arsa","mimari"],priorities:["sure","butce"]};
 assert.deepEqual(restoreBriefDraft(a),a);
 const b=restoreBriefDraft({goal:"injected",system:"bad",documents:["arsa","arsa","not-valid"],priorities:"sure",area:Infinity});
 assert.equal(b.goal,"");assert.equal(b.system,"kararsiz");assert.deepEqual(b.documents,["arsa"]);assert.deepEqual(b.priorities,[]);assert.equal(b.area,"");
 assert.equal(restoreBriefDraft(null).location,"");
});

test("in-memory optional undefined fields do not block a JSON-persistable project", () => {
  const storage=memory();
  const draft=project("OPTIONAL");
  draft.modules["geo-parcel"]={ ...draft.modules["geo-parcel"], optionalNote:undefined, nested:{ recorded:undefined, status:"pending" }, items:[{ elevation:undefined, label:"P1" }] };
  saveLibraryProject(storage,draft);
  const stored=loadProjectLibrary(storage)[0];
  assert.equal(stored.id,"OPTIONAL");
  assert.equal(Object.hasOwn(stored.modules["geo-parcel"],"optionalNote"),false);
  assert.deepEqual(stored.modules["geo-parcel"].nested,{status:"pending"});
  assert.deepEqual(stored.modules["geo-parcel"].items,[{label:"P1"}]);
  assert.equal(Object.hasOwn(draft.modules["geo-parcel"],"optionalNote"),true,"input is not mutated");
});
test("invalid project numbers or module provenance fail closed and preserve existing records", () => {
  const storage=memory();
  saveLibraryProject(storage,project("SAFE"));
  const original=storage.getItem(PROJECT_LIBRARY_KEY);
  const invalidNumber=project("INVALID");
  invalidNumber.modules["geo-parcel"].metrics={area:Infinity};
  assert.throws(()=>saveLibraryProject(storage,invalidNumber),/JSON/);
  const wrongStamp=project("WRONG-STAMP");
  wrongStamp.modules["geo-parcel"]._kernel={
    schema:"ARKEM-MODULE-LINK/1.0",projectId:"UNRELATED",projectRevision:"P01",
    sourceModule:"geo-parcel",recordedAt:"2026-10-19T09:00:00.000Z",action:"updated"
  };
  assert.throws(()=>saveLibraryProject(storage,wrongStamp),/geçerli değil/);
  assert.equal(storage.getItem(PROJECT_LIBRARY_KEY),original);
});

test("switching between six-module projects retains the saved module payloads", () => {
  const storage=memory();
  const current=project("CURRENT");
  current.modules["geo-parcel"].optionalLabel=undefined;
  current.modules["quick-site-scenario"]={status:"taslak"};
  current.modules["system-comparison"]={ranking:[{id:"steel",score:65}]};
  current.modules["project-os"]={tasks:[{id:"task-1",complete:false}]};
  saveLibraryProject(storage,current);
  const created=project("NEW");
  saveLibraryProject(storage,created);
  const opened=loadProjectLibrary(storage).find(p=>p.id==="CURRENT");
  assert.ok(opened);
  assert.equal(Object.keys(opened.modules).length,6);
  assert.deepEqual(opened.modules["system-comparison"].ranking,[{id:"steel",score:65}]);
  assert.deepEqual(opened.modules["project-os"].tasks,[{id:"task-1",complete:false}]);
  assert.equal(loadProjectLibrary(storage).length,2);
});
