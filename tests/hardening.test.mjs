import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { readBoundedJsonObject, readBoundedFormData, requestInputFailure } from "../app/lib/request-input.ts";
import { positiveArea, rectangularEnvelope } from "../app/lib/readiness-input.ts";
import { withResponseSecurity } from "../app/lib/response-security.ts";
import { isKernelProject } from "../app/lib/project-validation.ts";
import { evidenceBytesMatch } from "../app/lib/project-evidence-integrity.ts";
import { encodeProjectEnvelope, decodeProjectEnvelope, saveProjectToStorage, PROJECT_STORAGE_KEY, PROJECT_BACKUP_KEY } from "../app/lib/project-storage.ts";
import { calculateStructuralConcept } from "../app/lib/engineering.ts";
import { createCorporateTechnicalPdf } from "../app/lib/technical-sheet.ts";

const fixture = () => ({ schema: "ARKEM-PROJECT/1.0", id: "ARK-TEST", name: "Test", revision: "P01", phase: "Ön fizibilite", updatedAt: "2026-10-01T12:00:00.000Z", modules: {}, events: [] });
const source = (file) => fs.readFileSync(new URL("../" + file, import.meta.url), "utf8");

test("ground-storey load accumulates floors and records unmodelled roof snow", () => {
  const input = { system: "concrete", usage: "residential", width: 18, depth: 24, floors: 1, floorHeight: 3, baysX: 3, baysY: 4, columnSize: .4, beamDepth: .6, slabThickness: .15, superDeadLoad: 2, liveLoad: 2, roofSnowLoad: 1, basicWindSpeed: 28, sds: 1, sd1: .4, importance: 1, behaviorFactor: 7, concreteStrength: 30, steelYield: 420 };
  const single = calculateStructuralConcept(input);
  const four = calculateStructuralConcept({ ...input, floors: 4 });
  assert.equal(four.loads.tributaryColumn, single.loads.tributaryColumn * 4);
  const snow = four.checks.find((item) => item.id === "roof-snow");
  assert.equal(snow.state, "review"); assert.match(snow.note, /uygulanmaz/);
});

test("PDF asset failure does not poison a subsequent retry", async () => {
  const originalFetch = globalThis.fetch;
  let fail = true; let calls = 0;
  globalThis.fetch = async (url) => {
    calls += 1;
    if (fail && String(url).includes("Regular")) return new Response("unavailable", { status: 503 });
    return new Response(fs.readFileSync(new URL("../public" + String(url), import.meta.url)));
  };
  const input = { projectName: "Test", projectCode: "ARK-TEST", module: "Test", drawingTitle: "Retry", polylines: [], notes: ["Kavramsal taslak"] };
  try {
    await assert.rejects(createCorporateTechnicalPdf(input));
    fail = false;
    const pdf = await createCorporateTechnicalPdf(input);
    assert.match(Buffer.from(pdf.subarray(0, 16)).toString("latin1"), /^%PDF-/);
    assert.equal(calls, 6);
  } finally { globalThis.fetch = originalFetch; }
});

test("bounded JSON accepts objects and rejects non-object bodies", async () => {
  assert.deepEqual(await readBoundedJsonObject(new Request("http://local", { method: "POST", body: '{"name":"ARKEM"}' })), { name: "ARKEM" });
  for (const body of ["null", "[]", "4", '"text"']) await assert.rejects(readBoundedJsonObject(new Request("http://local", { method: "POST", body })), { status: 400 });
});

test("actual streamed bytes cannot bypass JSON limit using a false declared length", async () => {
  let cancelled = false;
  const body = new ReadableStream({ pull(controller) { controller.enqueue(new Uint8Array(100).fill(32)); }, cancel() { cancelled = true; } });
  await assert.rejects(readBoundedJsonObject(new Request("http://local", { method: "POST", body, duplex: "half", headers: { "content-length": "1" } }), 150), { status: 413 });
  assert.equal(cancelled, true);
});

test("multipart input without declared length still enforces actual body limit", async () => {
  const small = new FormData(); small.set("name", "ARKEM");
  assert.equal((await readBoundedFormData(new Request("http://local", { method: "POST", body: small }), 1000)).get("name"), "ARKEM");
  const large = new FormData(); large.set("name", "a".repeat(2000));
  const encoded = new Response(large);
  const body = await encoded.arrayBuffer();
  await assert.rejects(readBoundedFormData(new Request("http://local", { method: "POST", body, headers: { "content-type": encoded.headers.get("content-type") } }), 500), { status: 413 });
});

test("declared oversize requests are rejected and unknown exceptions are not leaked", async () => {
  await assert.rejects(readBoundedJsonObject(new Request("http://local", { method: "POST", body: "{}", headers: { "content-length": "999" } }), 20), { status: 413 });
  const response = requestInputFailure(new Error("private internals"), "Geçersiz istek");
  assert.equal(response.status, 400); assert.deepEqual(await response.json(), { error: "Geçersiz istek" });
});

test("private API responses including errors prohibit caching", () => {
  for (const status of [200, 401, 403, 409, 503]) {
    const response = withResponseSecurity(new Request("http://local/api/project-evidence"), new Response("data", { status }));
    assert.equal(response.headers.get("cache-control"), "private, no-store");
    assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  }
  assert.equal(withResponseSecurity(new Request("http://local/"), new Response("public")).headers.get("referrer-policy"), "strict-origin-when-cross-origin");
});

test("impossible or non-finite parcel envelopes never fabricate buildable area", () => {
  for (const args of [[18,24,15], [18,24,9], [30,30,15], [NaN,24,1], [Infinity,24,1], [-5,24,1]]) {
    const result = rectangularEnvelope(...args); assert.equal(result.valid, false); assert.equal(result.envelope, 0);
  }
  assert.deepEqual(rectangularEnvelope(46,72,5), { valid: true, plot: 3312, envelope: 2232 });
});

test("readiness area requires a positive finite numeric value", () => {
  for (const value of ["", "abc", "-5", "0", "Infinity", "450m²", "1e999"]) assert.equal(positiveArea(value), null);
  assert.equal(positiveArea("450"), 450); assert.equal(positiveArea("450,5"), 450.5);
});

test("device restore validates the full kernel boundary", () => {
  assert.equal(isKernelProject(fixture()), true);
  for (const patch of [{ id: {} }, { name: {} }, { modules: [] }, { phase: "unknown" }, { events: [{}] }, { experience: [] }]) assert.equal(isKernelProject({ ...fixture(), ...patch }), false);
});

test("saving after a corrupt primary record preserves the sound backup", () => {
  const backup = encodeProjectEnvelope(fixture());
  const values = new Map([[PROJECT_STORAGE_KEY, "{broken"], [PROJECT_BACKUP_KEY, backup]]);
  const storage = { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
  assert.equal(saveProjectToStorage(storage, { ...fixture(), name: "Updated" }).backupAvailable, true);
  assert.equal(values.get(PROJECT_BACKUP_KEY), backup);
  assert.equal(decodeProjectEnvelope(values.get(PROJECT_STORAGE_KEY)).value.name, "Updated");
});

test("evidence hash checks actual bytes including same-length corruption", async () => {
  const bytes = new TextEncoder().encode("original").buffer;
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  const fileSha256 = Buffer.from(digest).toString("hex");
  assert.equal(await evidenceBytesMatch(bytes, { fileSize: 8, fileSha256 }), true);
  assert.equal(await evidenceBytesMatch(new TextEncoder().encode("modified").buffer, { fileSize: 8, fileSha256 }), false);
  assert.equal(await evidenceBytesMatch(bytes, { fileSize: 7, fileSha256 }), false);
});

test("GIS source contract rejects unsupported CRS and silent geometry truncation", () => {
  const geo = source("app/components/GeoParcelStudio.tsx");
  assert.doesNotMatch(geo, /points\.slice\(0,\s*(?:200|400)\)/);
  assert.equal(geo.includes('sourceCrs !== "EPSG:4326 / WGS84"'), true);
  assert.doesNotMatch(geo, /setPreferredProvinceId\("54"\)/);
});

test("intake source contract requires explicit stage and request selection", () => {
  const brief = source("app/components/ProjectBriefForm.tsx");
  assert.match(brief, /name="stage" required defaultValue=\{prefill\?\.stage \?\? ""\}/);
  assert.match(brief, /name="requestType" required defaultValue=\{prefill\?\.requestType \?\? ""\}/);
  assert.match(brief, /randevu teyidi, teknik onay veya iş kabulü değildir/);
});

test("safety source contract distinguishes declaration, file evidence and actual approval", () => {
  assert.match(source("app/components/DemolitionDecisionStudio.tsx"), /complete: false/);
  assert.doesNotMatch(source("app/components/DemolitionDecisionStudio.tsx"), /DOĞRULANDI/);
  const room = source("app/components/ClientTechnicalProjectRoom.tsx");
  assert.doesNotMatch(room, /bytes:\s*1[, }]/); assert.match(room, /DOSYA KANITI YOK/);
  assert.match(source("app/lib/bim-coordination.ts"), /coordinateVerified = false/);
});
