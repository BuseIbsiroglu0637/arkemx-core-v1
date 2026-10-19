import test from "node:test";
import assert from "node:assert/strict";
import { parseGeoCsv } from "../app/lib/geo-csv.ts";
import { createSafeCsv } from "../app/lib/safe-csv.ts";
import { createParcelRecord, parcelIdentityKey } from "../app/lib/parcel-record.ts";
import { localReviewKey } from "../app/lib/local-review.ts";
import { restoreParcelGeometry } from "../app/lib/parcel-geometry-restore.ts";
import fs from "node:fs";
import { DEFAULT_ZONING, createZoningProvenance } from "../app/lib/zoning.ts";
import { createZoningMassingModel } from "../app/lib/zoning-massing.ts";
import { createBimCoordinationModel } from "../app/lib/bim-coordination.ts";
import { deriveProjectCore } from "../app/lib/project-core.ts";
import { derivePortalProjectSections } from "../app/lib/customer-portal.ts";
import { createArchitecturalScheme } from "../app/lib/architectural-scheme.ts";
import { createStructuralStudio } from "../app/lib/structural-studio.ts";
import { structuralDraftRanges } from "../app/lib/structural-draft.ts";

test("reopening quarantined parcel geometry restores the original source, not a sample", () => {
  const original=[{lat:40.76,lng:30.36},{lat:40.761,lng:30.36},{lat:40.761,lng:30.361}];
  const source={parcel:[],previewParcel:original};
  assert.deepEqual(restoreParcelGeometry(source), original);
  const restored=restoreParcelGeometry(source);
  assert.deepEqual(restoreParcelGeometry({parcel:[],previewParcel:restored}),original);
  assert.equal(restoreParcelGeometry({parcel:[{lat:NaN,lng:30}, ...original]}),null);
  assert.equal(restoreParcelGeometry({parcel:[],previewParcel:Array(401).fill(original[0])}),null);
  const studio=fs.readFileSync(new URL("../app/components/GeoParcelStudio.tsx",import.meta.url),"utf8");
  assert.match(studio,/geoCentroid\(restoredGeometry\)/);
  assert.doesNotMatch(studio,/geoCentroid\(saved\.parcel\)/);
  assert.doesNotMatch(studio,/belgesiyle doğrulandı/);
  assert.match(studio,/zoningVerificationLabel\("certified-document"\)/);
});

test("document category and changed target parcel cannot certify zoning or its derived massing", () => {
  const parcel=[{lat:40.7605,lng:30.3672},{lat:40.7605,lng:30.3682},{lat:40.7613,lng:30.3682},{lat:40.7613,lng:30.3672}];
  for(const verification of ["user-declared","municipal-viewer","approved-plan","certified-document"]) {
    const zoning={...DEFAULT_ZONING,verification,sourceDocument:"A-plan.pdf"};
    for(const reference of ["PARCEL-A","PARCEL-B"]) {
      const provenance=createZoningProvenance(zoning,reference);
      assert.equal(provenance.targetParcelReference,reference);
      assert.equal(provenance.parcelReference,null);
      assert.equal(provenance.sourceParcelReference,null);
      assert.equal(provenance.parcelIdentityVerified,false);
      assert.equal(provenance.authoritative,false);
      assert.equal(provenance.needsReview,true);
      const model=createZoningMassingModel({reference,parcel,netPlotArea:6000,zoning,frontEdge:"north",floorHeight:3.2});
      assert.equal(model.source.authoritative,false);
      assert.equal(model.source.trust,"declared");
      assert.equal(model.source.needsReview,true);
    }
  }
});
test("legacy zoning and massing authority flags do not promote customer records to verified", () => {
  const project={id:"A",name:"Project",revision:"R1",phase:"brief",updatedAt:"2026-10-03",modules:{
    "geo-parcel":{zoning:{...DEFAULT_ZONING,verification:"certified-document"},massingModel:{schema:"ARKEM-ZONING-MASSING/1.0",source:{authoritative:true},envelope:{width:20,depth:30},limits:{allowedGrossArea:1200}}},
    "architectural-program":{architecturalScheme:{schema:"ARKEM-ARCH-SCHEME/3.0",source:{authoritativeMassing:true},plate:{width:20,depth:30},nodes:[]}}
  }};
  const thread={canonical:{site:{reference:"",dataStatus:"",parcelArea:0,geometryValid:false,allowedFootprint:0,allowedGross:0,maxHeight:0},architecture:{use:"",floors:0,floorHeight:0,grossArea:0},structure:{system:""},coordination:{openIssues:0}},metrics:{activeCount:0,totalCount:1}};
  const core=deriveProjectCore(project,thread);
  assert.equal(core.fields.find(f=>f.id==="zoning").trust,"declared");
  assert.equal(core.fields.find(f=>f.id==="massing-model").trust,"derived");
  assert.equal(core.fields.find(f=>f.id==="architectural-scheme").trust,"derived");
  const mixed={...core,fields:core.fields.map(f=>f.id==="parcel-id"?{...f,value:"TKGM identifier",trust:"verified"}:f)};
  assert.notEqual(derivePortalProjectSections(mixed).find(s=>s.id==="parcel").trust,"verified");
});
const bimInput={projectId:"A",projectRevision:"R1",coordinateReference:"Local",serviceZone:.3,ceilingBuildUp:.1,raisedFloor:0,shaftArea:5,plantArea:10,factoredGravity:500,soilBearing:200,rainfallIntensity:50,outletCapacity:5,sprinkler:true,facadeTolerance:20};
const validGeometry={width:24,depth:18,floors:4,floorHeight:3.4};
test("legacy approval flags cannot flow through architecture, structure and BIM as a new technical approval", () => {
  const scheme=createArchitecturalScheme({reference:"A",use:"office",targetGross:1728,netRatio:75,floors:4,floorHeight:3.4,aspect:1.3,corridorWidth:1.8,targetTravel:30,stairs:2,elevators:1,coreStrategy:"split",spaces:[],relationships:[],massingModel:{schema:"ARKEM-ZONING-MASSING/1.0",source:{authoritative:true,trust:"verified"},envelope:{width:24,depth:18},alternatives:[]}});
  assert.equal(scheme.source.authoritativeMassing,false);assert.equal(scheme.source.massingTrust,"derived");assert.equal(scheme.source.needsReview,true);
  const legacyScheme={...scheme,source:{...scheme.source,authoritativeMassing:true,massingTrust:"verified"}};
  const input=Object.fromEntries(Object.entries(structuralDraftRanges).map(([key,[min]])=>[key,min]));
  Object.assign(input,{system:"steel",usage:"office",...validGeometry,concreteStrength:35,steelYield:355});
  const structure=createStructuralStudio({reference:"A",input,architecturalScheme:legacyScheme,repetition:70,transportDistance:120,fireRating:90});
  assert.equal(structure.source.authoritativeGeometry,false);assert.equal(structure.source.architectureTrust,"derived");assert.equal(structure.source.needsReview,true);
  const legacyStructure={...structure,source:{...structure.source,authoritativeGeometry:true,architectureTrust:"verified"}};
  const bim=createBimCoordinationModel({...bimInput,architecturalScheme:legacyScheme,structuralStudio:legacyStructure});
  assert.equal(bim.source.authoritativeGeometry,false);assert.equal(bim.source.needsReview,true);
});
test("schema-only, missing, non-finite, negative and oversized BIM dimensions never pass connection or geometry matching", () => {
  const invalid=[{}, {...validGeometry,width:undefined},{...validGeometry,width:0},{...validGeometry,depth:-2},{...validGeometry,floorHeight:NaN},{...validGeometry,floors:1.2},{...validGeometry,floors:1e9},{...validGeometry,width:1e9}];
  for(const geometry of invalid) {
    const model=createBimCoordinationModel({...bimInput,architecturalScheme:{schema:"ARKEM-ARCH-SCHEME/3.0",plate:geometry},structuralStudio:{schema:"ARKEM-STRUCTURAL-STUDIO/3.0",geometry}});
    assert.equal(model.source.architectureConnected,false);assert.equal(model.source.structureConnected,false);assert.equal(model.source.geometryMatches,false);
    assert.notEqual(model.checks.find(c=>c.code==="BIM-115-04").state,"pass");
    assert.ok(model.spatial.levels.length<=201);
  }
  const valid=createBimCoordinationModel({...bimInput,architecturalScheme:{schema:"ARKEM-ARCH-SCHEME/3.0",plate:validGeometry},structuralStudio:{schema:"ARKEM-STRUCTURAL-STUDIO/3.0",geometry:validGeometry}});
  assert.equal(valid.source.geometryMatches,true);
  assert.equal(valid.source.gridAndSourceRevisionsVerified,false);
});
test("untrusted BIM axis counts cannot allocate unbounded arrays", () => {
  for(const count of [1e9,Infinity,NaN,-1,0,1.2]) {
    const model=createBimCoordinationModel({...bimInput,structuralStudio:{schema:"ARKEM-STRUCTURAL-STUDIO/3.0",geometry:{...validGeometry,baysX:count,baysY:count}}});
    assert.equal(model.spatial.axes.x.length,2);assert.equal(model.spatial.axes.y.length,2);
    assert.equal(model.source.gridAndSourceRevisionsVerified,false);
  }
});
test("coordinate CSV round-trip ignores point ids and retains headered latitude/longitude positions", () => {
  const points = [{lat:40.7607,lng:30.3675,alt:115.2},{lat:40.761,lng:30.368,alt:116}];
  const csv = "point,latitude,longitude,altitude\n" + points.map((p,i)=>[i+1,p.lat,p.lng,p.alt].join(",")).join("\n");
  assert.deepEqual(parseGeoCsv(csv),points);
  assert.deepEqual(parseGeoCsv("id;boylam;enlem;kot\n7;30,3675;40,7607;115,2"),[points[0]]);
  assert.deepEqual(parseGeoCsv("longitude,extra,latitude\n30.3,99,40.7"),[{lat:40.7,lng:30.3}]);
});
test("missing, blank, non-finite and incomplete coordinate columns fail rather than shifting axes", () => {
  for(const csv of ["longitude,id\n30,2", "latitude,id,longitude\n,2,30", "latitude,longitude\nNaN,30", "latitude,longitude\n95,30"]) assert.throws(()=>parseGeoCsv(csv));
});
test("changed parcel identity cannot relabel the former source geometry as eligible project geometry", () => {
  const identity={province:"Sakarya",district:"Serdivan",neighborhood:"A",block:"12",parcelNo:"34"};
  const geometry=[{lat:40.76,lng:30.36},{lat:40.7605,lng:30.36},{lat:40.7605,lng:30.3605}];
  const source={kind:"tkgm-open-service",authority:"TKGM",label:"service response",capturedAt:"2026-10-03T00:00:00Z",url:"",identity};
  assert.equal(createParcelRecord({identity,geometry,source}).projectEligible,true);
  const changed=createParcelRecord({identity:{...identity,parcelNo:"35"},geometry,source});
  assert.equal(changed.projectEligible,false);assert.equal(changed.state,"needs-review");assert.equal(changed.evidence.identityMatches,false);
  assert.equal(parcelIdentityKey(identity),parcelIdentityKey({...identity,province:" Sakarya "}));
});
test("local review markers are content and project scoped and cannot survive changed source geometry", () => {
  const issue={id:"ISS-1",title:"Check",evidence:"3.2 m"};
  const key=localReviewKey("A",issue,{height:3.2});
  assert.notEqual(key,localReviewKey("B",issue,{height:3.2}));
  assert.notEqual(key,localReviewKey("A",{...issue,evidence:"3.0 m"},{height:3.2}));
  assert.notEqual(key,localReviewKey("A",issue,{height:3.0}));
});
test("CSV preserves quotes, separators and lines while neutralising customer-authored spreadsheet formulas", () => {
  const csv=createSafeCsv([['a,"b"\nc','=HYPERLINK("x")'," @SUM(A1:A2)",-2]]);
  assert.ok(csv.startsWith("\uFEFF"));
  assert.ok(csv.includes('"a,""b""\nc"'));assert.ok(csv.includes('"\'=HYPERLINK(""x"")"'));assert.ok(csv.includes('"\' @SUM(A1:A2)"'));assert.ok(csv.endsWith('"-2"'));
});
