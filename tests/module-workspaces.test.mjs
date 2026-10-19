import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { parseStructuralDraft, structuralDraftRanges } from "../app/lib/structural-draft.ts";
import { createStructuralStudio } from "../app/lib/structural-studio.ts";
const read = file => fs.readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
const routes = ["arsa-fizibilite-studyosu", "mimari-program-studyosu", "muhendislik-koordinasyon", "yikim-karar-studyosu", "proje-os", "yapi-sistemi-karsilastirma", "proje-karar-asistani", "tasarim-calismalari", "3b-model-kutuphanesi"];
async function render(route) {
  const { default: worker } = await import("../dist/server/index.js");
  return worker.fetch(new Request(`https://example.test/${route}`, { headers: { accept: "text/html" } }), { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } }, { waitUntil() {}, passThroughOnException() {} });
}
test("all reviewed module routes render a compact, labelled entry and direct working-area link", async () => {
  for (const route of routes) {
    const response = await render(route); assert.equal(response.status, 200, route);
    const html = await response.text();
    if (route === '3b-model-kutuphanesi') {
      assert.match(html, /ref-library-heading/); assert.match(html, /id="model-kutuphanesi"/);
      assert.match(html, /Projeye farklı/); assert.match(html, /href="\/projeler\/isil-kilic-hafif-celik-villa"/);
      assert.equal((html.match(/<h1\b/g) || []).length, 1, route); continue;
    }
    if (route === "proje-karar-asistani") {
      assert.match(html, /Yatırım briefi/); assert.match(html, /id="karar-motoru"/);
      assert.match(html, /Örnek briefi doldur/); assert.doesNotMatch(html, /Özeti WhatsApp ile gönder/);
      assert.equal((html.match(/<h1\b/g) || []).length, 1, route); continue;
    }
    assert.match(html, /module-workspace-intro/, route);
    assert.match(html, /Çalışma alanına geç/, route); assert.match(html, /Nereden başlayacağım/, route);
    assert.equal((html.match(/<h1\b/g) || []).length, 1, route);
  }
});
test("working surfaces precede explanatory blocks and scenario-only panels are explicit", () => {
  for (const [route, tool, intro] of [["arsa-fizibilite-studyosu", "GeoParcelStudio/", "tool-page-intro"], ["mimari-program-studyosu", "ArchitecturalProgramStudio/", "architecture-intro"], ["muhendislik-koordinasyon", "EngineeringCoordinationStudio/", "coordination-intro"], ["proje-os", "ProjectOperatingSystem/", "os-capability-section"], ["tasarim-calismalari", "AdvancedPlanEditor/", "ThreeModelViewer/"]]) {
    const source = read(`app/${route}/page.tsx`); assert.ok(source.indexOf(tool) < source.indexOf(intro), route);
  }
  for (const component of ["ProjectOperatingSystem", "DemolitionDecisionStudio"]) assert.match(read(`app/components/${component}.tsx`), /exampleOnly: true/);
  assert.doesNotMatch(read("app/components/SystemComparisonTool.tsx"), /needsReview: false/);
  assert.match(read("app/components/SystemComparisonTool.tsx"), /!inputsConfirmed/);
});
test("recorded structural drafts retain every load and material field and reject invalid imports", () => {
  const input = Object.fromEntries(Object.entries(structuralDraftRanges).map(([key, [min]]) => [key, min]));
  Object.assign(input, { system: "steel", usage: "office", concreteStrength: 35, steelYield: 460, roofSnowLoad: 1.25, sds: 1.2, sd1: .65, behaviorFactor: 4 });
  assert.deepEqual(parseStructuralDraft(input), input);
  for (const field of Object.keys(structuralDraftRanges)) {
    const missing = { ...input }; delete missing[field]; assert.equal(parseStructuralDraft(missing), null, field);
    assert.equal(parseStructuralDraft({ ...input, [field]: Infinity }), null, field);
  }
  assert.equal(parseStructuralDraft({ ...input, floors: 1.5 }), null);
  assert.equal(parseStructuralDraft({ ...input, concreteStrength: 33 }), null);
});
test("interactive calculation and alternatives use the same explicit form geometry despite a differing linked scheme", () => {
  const input = Object.fromEntries(Object.entries(structuralDraftRanges).map(([key, [min]]) => [key, min]));
  Object.assign(input, { system: "steel", usage: "office", width: 24, depth: 18, floors: 4, floorHeight: 3.4, concreteStrength: 35, steelYield: 355 });
  const studio = createStructuralStudio({ reference: "TEST", input, geometryMode: "input", architecturalScheme: { schema: "ARKEM-ARCH-SCHEME/3.0", plate: { width: 40, depth: 30, floors: 6, floorHeight: 4 }, source: { authoritativeMassing: true } }, repetition: 70, transportDistance: 120, fireRating: 90 });
  assert.equal(studio.geometry.width, 24); assert.equal(studio.geometry.depth, 18); assert.equal(studio.geometry.floors, 4); assert.equal(studio.geometry.totalArea, 1728);
  assert.equal(studio.source.geometryOrigin, "form-input"); assert.equal(studio.source.authoritativeGeometry, false);
});
test("customer guide uses an active-project submission guard and the legacy assistant cannot replace guided inputs", () => {
  const guide = read("app/components/CustomerProjectGuide.tsx");
  assert.match(guide, /activeProjectId\.current !== project\.id/); assert.match(guide, /onProjectSubmitted=\{recordSubmission\}/);
  assert.match(guide, /key=\{`\$\{project\.id\}-\$\{progress\.summary\}`\}/);
  const legacy = read("app/components/ProjectDecisionAssistant.tsx");
  assert.match(legacy, /readinessScreening:/); assert.doesNotMatch(legacy, /patchModule\("decision-assistant", \{ input:/);
});
test("mobile, readability, focus and reduced-motion protections are module-scoped", () => {
  const css = read("app/module-workspaces.css");
  for (const marker of [".module-workspace-page", "@media(max-width:640px)", ".digital-goals{grid-template-columns:1fr}", ":focus-visible", "prefers-reduced-motion", "min-height:44px", "overflow-wrap:anywhere"]) assert.ok(css.includes(marker), marker);
  const layout = read("app/layout.tsx"); assert.ok(layout.indexOf('./module-workspaces.css') < layout.indexOf('./home-experience.css'));
});
