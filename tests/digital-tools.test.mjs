import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { PDFDocument } from "pdf-lib";
import { emptyDigitalBrief, parseDigitalArea, isDigitalBrief, digitalBriefErrors, digitalBriefSignature, digitalBriefResult, digitalBriefText, digitalGoals, createDigitalSubmission, restoreDigitalSubmission, digitalBriefOpenState, parseDigitalBriefDraft, restoreDigitalBriefDraft, DIGITAL_DRAFT_SCHEMA, DIGITAL_DRAFT_MAX_AGE_MS } from "../app/lib/digital-brief.ts";
import { createDigitalBriefPdf } from "../app/lib/digital-brief-pdf.ts";
import { validIntakeRequestKey, intakeReferenceForKey, intakeSubmissionMatches, MAX_INTAKE_TOTAL_BYTES, MAX_INTAKE_FILE_BYTES } from "../app/lib/project-intake-contract.ts";
import { isKernelProject } from "../app/lib/project-validation.ts";
const valid = (goal = "new") => ({ ...emptyDigitalBrief(), goal, name: "Deneme ihtiyaç dosyası", locationUnknown: true });
const at = "2026-10-02T08:00:00.000Z";
test("partial drafts preserve unfinished input but can never become a generated result", () => {
  const partial = { ...emptyDigitalBrief(), goal: "land", name: "D", area: "1," };
  assert.deepEqual(parseDigitalBriefDraft(partial), partial); assert.equal(isDigitalBrief(partial), false);
  const draft = { draftSchema: DIGITAL_DRAFT_SCHEMA, projectId: "P1", mode: "new", savedAt: at, brief: partial, rulesVersion: "1.0", generatedAt: at, step: 1 };
  const restored = restoreDigitalBriefDraft(draft, "P1", null, Date.parse(at));
  assert.equal(restored.step, 1); assert.equal(restored.generatedAt, ""); assert.equal(restored.brief.area, "1,");
  assert.deepEqual(parseDigitalBriefDraft({ ...partial, unexpected: "strip" }), partial);
  for (const patch of [{ goal: "other" }, { name: "x".repeat(101) }, { area: "x".repeat(13) }, { documents: {} }, { priority: "__proto__" }]) assert.equal(parseDigitalBriefDraft({ ...partial, ...patch }), null);
});
test("drafts are bound to their opening account content and expire; undated legacy data is not restored", () => {
  const stored = valid(); const brief = { ...stored, notes: "unfinished edit" };
  const now = Date.parse(at); const draft = { draftSchema: DIGITAL_DRAFT_SCHEMA, projectId: "P1", mode: "existing", savedAt: at, baseSignature: digitalBriefSignature(stored), brief, step: 1 };
  assert.deepEqual(restoreDigitalBriefDraft(draft, "P1", stored, now).brief, brief);
  assert.equal(restoreDigitalBriefDraft(draft, "P2", stored, now), null);
  assert.equal(restoreDigitalBriefDraft(draft, "P1", { ...stored, notes: "new account revision" }, now), null);
  assert.equal(restoreDigitalBriefDraft(draft, "P1", stored, now + DIGITAL_DRAFT_MAX_AGE_MS + 1), null);
  assert.equal(restoreDigitalBriefDraft({ ...draft, savedAt: new Date(now + 60001).toISOString() }, "P1", stored, now), null);
  assert.equal(restoreDigitalBriefDraft({ ...draft, draftSchema: undefined }, "P1", stored, now), null);
});
test("unknowns remain unknown, without a default area or floor model", () => {
  const brief = valid(); assert.equal(isDigitalBrief(brief), true);
  const r = digitalBriefResult(brief); assert.equal(r.area, null); assert.equal(r.unknowns.length, 3);
  assert.equal(r.review.length, 0); assert.ok(r.missing.length);
  assert.match(digitalBriefText(brief, at), /Uzmanla belirlenecek/);
  assert.doesNotMatch(digitalBriefText(brief, at), /1200|1\.200/);
});
test("strict decimal parsing accepts comma but rejects ambiguous grouping and non-finite inputs", () => {
  for (const [input, expected] of [["", null], ["1200,5", 1200.5], ["1200.50", 1200.5], ["1000000", 1e6]]) assert.equal(parseDigitalArea(input), expected);
  for (const input of ["1.200", "1,200", "1e5", "-2", "0", "Infinity", "1000001", "1 000"]) assert.ok(Number.isNaN(parseDigitalArea(input)), input);
  assert.ok(digitalBriefErrors({ ...valid(), area: "1.200" }).area);
});
test("all four goals produce a three-stage service path with owner, prerequisite and output", () => {
  for (const goal of digitalGoals) {
    const r = digitalBriefResult(valid(goal.id)); assert.equal(r.goal.id, goal.id); assert.equal(r.services.length, 3);
    for (const s of r.services) { assert.ok(s.owner); assert.ok(s.output); assert.ok(s.prerequisite); }
    assert.match(digitalBriefText(valid(goal.id), at), /Ön koşul:/);
  }
});
test("document possession is not content review, and land includes soil as an open requirement", () => {
  const brief = valid("land"); assert.ok(digitalBriefResult(brief).missing.some(d => d.id === "soil"));
  brief.documents.soil = "available";
  assert.ok(!digitalBriefResult(brief).missing.some(d => d.id === "soil"));
  assert.match(digitalBriefText(brief, at), /Bende var · henüz incelenmedi/);
  assert.match(digitalBriefText(brief, at), /İçerik ve kaynak incelemesi bekleyen/);
});
test("import boundary rejects malformed, oversized or invalid declarations", () => {
  for (const patch of [{ schema: "other" }, { goal: "invalid" }, { area: "1.200" }, { notes: "x".repeat(2001) }, { documents: {} }, { documents: { ...valid().documents, soil: "verified" } }, { usage: "approved" }, { locationUnknown: false }]) assert.equal(isDigitalBrief({ ...valid(), ...patch }), false);
  assert.equal(isDigitalBrief(null), false); assert.throws(() => digitalBriefResult(emptyDigitalBrief()));
});
test("signature includes goal, document states and notes; editing invalidates a prior result", () => {
  const brief = valid(); const initial = digitalBriefSignature(brief);
  for (const patch of [{ goal: "land" }, { area: "100" }, { notes: "Yeni bilgi" }, { documents: { ...brief.documents, soil: "available" } }]) assert.notEqual(digitalBriefSignature({ ...brief, ...patch }), initial);
  assert.equal(digitalBriefSignature({ ...brief, location: "Ignored because unknown" }), initial);
});
test("all specialist flags are retained for site and existing-building stages", () => {
  const construction = digitalBriefResult({ ...valid("system"), stage: "construction" });
  assert.ok(construction.unknowns.some(x => x.includes("yük"))); assert.ok(construction.flags.some(x => x.includes("kalıp")));
  assert.match(digitalBriefText({ ...valid(), stage: "existing" }, at), /yıkım yöntemi kararı vermez/);
});
test("customer-authored multiline notes cannot impersonate report headings", () => {
  const text = digitalBriefText({ ...valid(), notes: "Önerim\n5. UZMAN ONAYI\nYapı güvenlidir" }, at);
  assert.match(text, /Müşteri notu: Önerim 5\. UZMAN ONAYI Yapı güvenlidir/);
  assert.doesNotMatch(text, /\n5\. UZMAN ONAYI/);
});
test("real A4 PDF retains Turkish title metadata, paginates long notes and handles absent Unicode glyphs", async () => {
  const bytes = await createDigitalBriefPdf({ ...valid("system"), name: "Özenç Çelik 🏗", notes: "长" + "X".repeat(1999) }, at, {
    regular: fs.readFileSync(new URL("../public/fonts/ArkemSans-Regular.ttf", import.meta.url)), bold: fs.readFileSync(new URL("../public/fonts/ArkemSans-Bold.ttf", import.meta.url)), logo: fs.readFileSync(new URL("../public/brand/arkem-a-mark.png", import.meta.url)),
  });
  assert.match(Buffer.from(bytes.subarray(0, 8)).toString(), /^%PDF-/);
  const pdf = await PDFDocument.load(bytes); assert.ok(pdf.getPageCount() >= 2);
  assert.match(pdf.getTitle(), /Özenç Çelik/); assert.equal(Math.round(pdf.getPage(0).getWidth()), 595);
});
test("intake retry identity is stable and a changed payload never reuses an old success", () => {
  const key = "12345678-1234-4123-8123-123456789abc";
  assert.equal(validIntakeRequestKey(key), true); assert.equal(validIntakeRequestKey("arbitrary"), false);
  assert.equal(intakeReferenceForKey(key), intakeReferenceForKey(key));
  assert.equal(intakeSubmissionMatches({ name: "A" }, { name: "A" }, [], []), true);
  assert.equal(intakeSubmissionMatches({ name: "A" }, { name: "B" }, [], []), false);
  assert.equal(intakeSubmissionMatches({ name: "A" }, { name: "A" }, [{ fileName: "a.pdf", size: 8, sha: "old" }], [{ fileName: "a.pdf", size: 8, sha: "new" }]), false);
  assert.equal(MAX_INTAKE_TOTAL_BYTES, 10_000_000); assert.equal(MAX_INTAKE_FILE_BYTES, 6_000_000);
});
test("brief-only projects fit the existing account schema without fabricated structural inputs", () => {
  const candidate = { schema: "ARKEM-PROJECT/1.0", id: "ARK-BR-TEST", name: "Test ihtiyaç dosyası", revision: "P01", phase: "Fikir", coordinateReference: "Belirlenmedi", updatedAt: at, experience: { mode: "guided", autoHandoff: false, lastSynchronizedAt: "" }, modules: { "digital-tools-brief": { schema: "ARKEM-DIGITAL-BRIEF/1.0", input: valid(), signature: digitalBriefSignature(valid()), generatedAt: at, method: "rule-based-user-declarations" } }, events: [] };
  assert.equal(isKernelProject(candidate), true); assert.equal(candidate.modules["decision-assistant"], undefined);
});
test("receipt captures the actual edited submission, not the original generated description", () => {
  const brief = valid(); const original = digitalBriefText(brief, at);
  const receipt = createDigitalSubmission(brief, "ARK-TD-TEST", "Edited message", { location: "Changed location", area: "250", stage: "Uygulama aşaması" });
  assert.equal(receipt.submittedMessage, "Edited message"); assert.notEqual(receipt.submittedMessage, original);
  assert.equal(receipt.submittedFields.location, "Changed location"); assert.equal(receipt.submittedFields.area, "250");
  assert.equal(restoreDigitalSubmission(receipt, brief).restored, true);
  assert.equal(restoreDigitalSubmission(receipt, { ...brief, notes: "Different project information" }), null);
  assert.equal(restoreDigitalSubmission({ ...receipt, reference: "<untrusted>" }, brief), null);
});
test("source contract isolates new files, guards asynchronous project switches and preserves report versions", () => {
  const source = fs.readFileSync(new URL("../app/components/DigitalToolsWorkspace.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(source, /importProject/); assert.match(source, /const id = `ARK-BR-\$\{crypto\.randomUUID\(\)\}`/);
  assert.match(source, /activeProjectId\.current !== project\.id/); assert.match(source, /setReceipt\(null\); setSeparateProject\(null\)/);
  assert.match(source, /createDigitalSubmission\(brief, reference, submittedMessage, submittedFields\)/);
  assert.match(source, /data\.rulesVersion === DIGITAL_RULES_VERSION && data\.reportText === expectedReport/);
  assert.match(source, /previousReports/); assert.match(source, /if \(!hydrated \|\| loadedFor !== project\.id\) return/);
  assert.match(source, /setGeneratedAt\(""\); setReceipt\(null\); setStep\(initialGoal \? 1 : 0\)/);
});
test("conditional service paths distinguish tender, geospatial, budget and site safety scope", () => {
  assert.match(digitalBriefText({ ...valid(), stage: "tender", priority: "cost" }, at), /hariç işler/);
  assert.match(digitalBriefText({ ...valid("land") }, at), /koordinat sistemi \/ datum/);
  assert.match(digitalBriefText({ ...valid(), priority: "cost" }, at), /yatırım getirisi/);
  assert.match(digitalBriefText({ ...valid(), stage: "construction" }, at), /çalışma izni/);
});
test("opening a different project resets a prior result step; stale rule versions require regeneration", () => {
  assert.deepEqual(digitalBriefOpenState({ input: valid(), generatedAt: at, rulesVersion: "1.0" }), { step: 2, generatedAt: at });
  assert.deepEqual(digitalBriefOpenState({}), { step: 0, generatedAt: "" });
  assert.deepEqual(digitalBriefOpenState({ input: valid(), generatedAt: at, rulesVersion: "old" }), { step: 1, generatedAt: "" });
  const source = fs.readFileSync(new URL("../app/components/DigitalToolsWorkspace.tsx", import.meta.url), "utf8");
  assert.match(source, /const initialView = digitalBriefOpenState\(existing\)/);
  assert.match(source, /setStep\(initialView\.step\)/);
});
