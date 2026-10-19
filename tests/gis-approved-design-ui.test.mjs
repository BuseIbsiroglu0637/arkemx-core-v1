import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const src = (name) => readFileSync(new URL("../" + name, import.meta.url), "utf8");
const page = src("app/arsa-fizibilite-studyosu/page.tsx");
const workspace = src("app/components/DemoParcelWorkspace.tsx");
const studio = src("app/components/GeoParcelStudio.tsx");
const viewer = src("app/components/GeoTerrainViewer.tsx");
const outcomes = src("app/components/ParcelOutcomePanel.tsx");
const location = src("app/components/ParcelLocationStep.tsx");
const basemaps = src("app/lib/parcel-basemaps.ts");
const styles = src("app/gis-approved-design.css");
const layout = src("app/layout.tsx");

test("GIS approved header and project strip are isolated to GIS", () => {
 assert.ok(page.includes("Parsel ve arazi incelemesi"));
 assert.ok(page.includes("ARKEM / ARSA REHBERİ"));
 assert.ok(workspace.includes('className="demo-project-summary"'));
 assert.ok(workspace.includes('mode === "owned" && <GeoParcelStudio />'));
 assert.ok(layout.includes('import "./gis-approved-design.css"'));
 assert.ok(styles.includes(".demo-gis-page .demo-brief-heading"));
 assert.ok(styles.includes(".geo-parcel-studio>.geo-studio-top"));
});
test("step-by-step GIS workflow retains parcel lookup and file import", () => {
 assert.ok(studio.includes('onSearch={locateOfficialParcel}'));
 assert.ok(studio.includes("assertParcelResponseIdentity(properties, lookup.resolvedIds)"));
 assert.ok(studio.includes("parcelJourneyGate(index, identityReady, parcelRecord.projectEligible)"));
 assert.ok(location.includes("KML / GeoJSON içe aktar"));
 assert.ok(location.includes("onClick={props.onImport}"));
 assert.ok(studio.includes("setParcelLookup(\"loading\")"));
});
test("three display basemaps are genuine display layers, not survey truth", () => {
 for(const label of ["osm","satellite","topographic"]) assert.ok(basemaps.includes(label + ":"),label);
 assert.ok(basemaps.includes("World_Imagery"));
 assert.ok(basemaps.includes("World_Topo_Map"));
 assert.ok(studio.includes('className="parcel-basemap-choices"'));
 assert.ok(studio.includes('setBasemapMode(mode.id)'));
 assert.ok(studio.includes('setBasemapNotice("")'));
 assert.ok(studio.includes('PARCEL_BASEMAPS[basemapMode].label'));
 assert.ok(studio.includes("Altlık harita yüklenemedi"));
});
test("terrain without a building never invents massing or earthwork", () => {
 assert.ok(studio.includes("terrainPreviewReady = parcelRecord.projectEligible && metrics.geometryValid && parcel.length >= 3"));
 assert.ok(studio.includes('hasBuilding={hasPlacedModel}'));
 assert.ok(studio.includes("3B arazi için geçerli parsel sınırı gerekli"));
 assert.ok(viewer.includes('if (hasBuilding && layers["building-mass"])'));
 assert.ok(viewer.includes("const analysis = hasBuilding ?"));
 assert.ok(viewer.includes("Hesaplanmadı"));
 assert.ok(viewer.includes("Yapı yok"));
});
test("technical source information remains accessible without crowding the guide",()=>{
 assert.ok(studio.includes('className="gis-source-disclosure"'));
 assert.ok(studio.includes('className="gis-layers-disclosure"'));
 assert.ok(studio.includes('className="gis-expert-disclosure"'));
 assert.ok(studio.includes('className="gis-map-facts"'));
 assert.ok(styles.includes("@media(max-width:740px)"));
 assert.ok(styles.includes("@media(max-width:470px)"));
});
test("approved output labels still use actual GIS export actions",()=>{
 for (const label of ["Teknik çıktılar","Sonraki adımlar","A3 teknik pafta","A4 özet rapor","DXF dışa aktar","KML indir"]) assert.ok(outcomes.includes(label),label);
 for (const property of ['onPdf={exportPdf}','onSummary={exportSummaryPdf}','onDxf={exportDxf}','onKml={exportKml}']) assert.ok(studio.includes(property),property);
 assert.ok(outcomes.includes("disabled={p.disabled}"));
 assert.ok(outcomes.includes("Ön çalışma çıktısıdır; ruhsat, aplikasyon"));
});
