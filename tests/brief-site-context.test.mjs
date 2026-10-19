import test from "node:test";
import assert from "node:assert/strict";
import { briefSiteContext, briefSitePatch, landSearchError } from "../app/lib/brief-site-context.ts";
const input={goal:"konut",stage:"fikir",system:"hafif-celik",location:"Kastamonu Merkez",area:"450,5",documents:["arsa"],priorities:["sure"]};
const modules = value => ({"decision-assistant":{readinessScreening:{input:value}}});
test("brief passes declared location, use and building target without cadastral claims",()=>{
 const c=briefSiteContext("P1",modules(input));assert.equal(c.projectId,"P1");assert.equal(c.targetGrossArea,450.5);assert.equal(c.usage,"Konut / Villa");assert.equal(c.system,"Hafif Çelik");assert.equal(c.province,"Kastamonu");assert.equal(c.district,"Merkez");
 const patch=briefSitePatch(c,{});assert.equal(patch.province,"Kastamonu");assert.equal(patch.system,"Hafif Çelik");assert.equal(patch.parcel,undefined);assert.equal(patch.provinceId,undefined);assert.equal(patch.metrics,undefined);assert.equal(patch.zoning,undefined);
});
test("existing cadastral geometry, identity and design are not replaced by brief",()=>{
 const c=briefSiteContext("P1",modules(input));const geo={parcel:[{lat:1,lng:1},{lat:1,lng:2},{lat:2,lng:2}],province:"Ankara",system:"Betonarme",planning:{maxFar:1}};
 assert.deepEqual(Object.keys(briefSitePatch(c,geo)),["briefContext"]);
 assert.deepEqual(Object.keys(briefSitePatch(c,{parcelRecord:{projectEligible:true}})),["briefContext"]);
});
test("empty or incomplete brief cannot create a ready handoff; undecided stays undecided",()=>{
 assert.equal(briefSiteContext("P",{}),null);assert.equal(briefSiteContext("P",modules({...input,goal:""})),null);
 const c=briefSiteContext("P",modules({...input,system:"kararsiz",area:"-10",location:"Ankara / Çankaya"}));assert.equal(c.system,"Karar Bekleniyor");assert.equal(c.targetGrossArea,null);assert.equal(c.province,"Ankara");assert.equal(c.district,"Çankaya");
 assert.notEqual(c.signature,briefSiteContext("P",modules(input)).signature);
});
test("search criteria validate independently from building target",()=>{
 assert.equal(landSearchError({region:"Kastamonu",minArea:"",maxArea:"",budget:""}),"");
 assert.ok(landSearchError({region:"",minArea:"",maxArea:"",budget:""}));
 assert.ok(landSearchError({region:"Kastamonu",minArea:"900",maxArea:"700",budget:"1"}));
 assert.ok(landSearchError({region:"Kastamonu",minArea:"0",maxArea:"",budget:""}));
 assert.equal(landSearchError({region:"Kastamonu",minArea:"700,5",maxArea:"900",budget:"2000000"}),"");
});
