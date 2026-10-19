import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { customerBriefSignature, customerSubmissionText, deriveCustomerJourney, intakeStepError, normalizeCustomerIntake } from "../app/lib/customer-journey.ts";

const intake = { name: "Örnek konut", projectType: "new", usage: "residential", location: "Sakarya / Arifiye", parcelStatus: "unknown", targetArea: 250, floors: 2, floorHeight: 3, system: "undecided", priorities: ["safety", "cost"], budget: "undecided", timeline: "flexible", documents: [], experienceMode: "guided" };
const fixture = () => ({ id: "ARK-TEST", name: intake.name, modules: { "decision-assistant": { input: { ...intake } }, "geo-parcel": { metrics: {} }, "architectural-program": { input: { targetGross: 250 }, result: {} }, "system-comparison": { ranking: [] } } });

test("empty and seeded modules do not fabricate customer completion", () => {
  assert.equal(deriveCustomerJourney({ id: "new", name: "Yeni proje", modules: {} }).count, 0);
  const progress = deriveCustomerJourney(fixture());
  assert.equal(progress.count, 1);
  assert.equal(progress.next, 1);
});
test("unknown land and system are explicit valid customer choices", () => {
  const project = fixture();
  const signature = customerBriefSignature(project.modules);
  project.modules["customer-journey"] = { systemDecision: "undecided", confirmations: { land: signature, system: signature, budget: signature } };
  assert.deepEqual(deriveCustomerJourney(project).complete, [true, true, false, true, true, false]);
});
test("changed brief invalidates prior review acknowledgements", () => {
  const project = fixture();
  project.modules["customer-journey"] = { confirmations: { land: customerBriefSignature(project.modules) } };
  project.modules["decision-assistant"].input.location = "Bursa";
  assert.equal(deriveCustomerJourney(project).complete[1], false);
});
test("spaces must be valid and explicitly confirmed", () => {
  const project = fixture();
  const spaces = [{ name: "Salon", count: 1, unitArea: 30 }];
  project.modules["architectural-program"].spaces = spaces;
  assert.equal(deriveCustomerJourney(project).complete[2], false);
  project.modules["customer-journey"] = { confirmations: { spaces: JSON.stringify(spaces) } };
  assert.equal(deriveCustomerJourney(project).complete[2], true);
  spaces[0].count = 1.5;
  assert.equal(deriveCustomerJourney(project).complete[2], false);
});
test("a receipt applies only to the submitted project snapshot", () => {
  const project = fixture();
  project.modules["customer-journey"] = { submission: { reference: "TEST-REF", signature: customerSubmissionText(project) } };
  assert.equal(deriveCustomerJourney(project).complete[5], true);
  project.modules["decision-assistant"].input.projectType = "demolition";
  assert.equal(deriveCustomerJourney(project).complete[5], false);
});
test("malformed drafts cannot inject invalid options or bypass all-step validation", () => {
  const safe = normalizeCustomerIntake({ usage: "unknown", documents: "soil", priorities: {}, floors: Infinity, targetArea: -1 }, intake);
  assert.equal(safe.usage, "residential");
  assert.deepEqual(safe.documents, []);
  assert.equal(safe.floors, 2);
  for (const bad of [{ targetArea: 0 }, { floors: 1.5 }, { floorHeight: 0 }]) assert.ok(intakeStepError({ ...intake, ...bad }, 2));
  assert.ok(intakeStepError({ ...intake, name: "" }, 0));
});
test("restoration precedes autosave and stale modules cannot transfer", () => {
  for (const file of ["ArchitecturalProgramStudio", "SystemComparisonTool"]) {
    const source = fs.readFileSync(new URL(`../app/components/${file}.tsx`, import.meta.url), "utf8");
    assert.match(source, /if \(!hydrated \|\| moduleReady !== project.id(?: \|\| !inputsConfirmed)?\) return/);
    assert.match(source, /setModuleReady\(project.id\)/);
  }
  const kernel = fs.readFileSync(new URL("../app/components/ProjectKernel.tsx", import.meta.url), "utf8");
  assert.match(kernel, /record\(modules\[contract.source\]\).needsReview === true/);
  assert.match(kernel, /if \(updateExisting\)/);
});
