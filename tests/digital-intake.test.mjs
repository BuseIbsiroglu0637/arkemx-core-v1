import test, { after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createHash } from "node:crypto";
import { registerHooks } from "node:module";
import { DatabaseSync } from "node:sqlite";

// Execute the real handler against isolated SQLite/R2 doubles. No HTTP or production writes.
const hooks = registerHooks({
  resolve(specifier, context, next) {
    if (specifier === "cloudflare:workers") return { url: "arkem-test:env", shortCircuit: true };
    if (specifier.startsWith(".") && context.parentURL?.startsWith("file:")) {
      const candidate = new URL(specifier + ".ts", context.parentURL);
      if (fs.existsSync(candidate)) return { url: candidate.href, shortCircuit: true };
    }
    return next(specifier, context);
  },
  load(url, context, next) {
    if (url === "arkem-test:env") return { format: "module", source: "export const env = new Proxy({}, {get: (_, key) => globalThis.__arkemIntakeTestEnv?.[key]});", shortCircuit: true };
    return next(url, context);
  },
});
const { POST } = await import("../app/api/project-intake/route.ts");
const { intakePayloadDigest, resolveIntakeAttempt, INTAKE_ATTEMPT_MAX_AGE_MS } = await import("../app/lib/intake-attempt.ts");
after(() => { hooks.deregister(); delete globalThis.__arkemIntakeTestEnv; });
function fixture(options = {}) {
  const sql = new DatabaseSync(":memory:");
  sql.exec(`CREATE TABLE project_intakes (id TEXT PRIMARY KEY, reference_code TEXT UNIQUE NOT NULL, name TEXT, company TEXT, email TEXT, phone TEXT, location TEXT, building_type TEXT, area TEXT, stage TEXT, request_type TEXT, message TEXT, status TEXT, created_at TEXT);
    CREATE TABLE project_intake_files (id TEXT PRIMARY KEY, intake_id TEXT, object_key TEXT, file_name TEXT, content_type TEXT, file_size INTEGER, file_sha256 TEXT, created_at TEXT);`);
  const objects = new Map(); const removed = []; let putCount = 0; let committed = false;
  const db = {
    prepare(query) {
      return { query, args: [], bind(...args) { this.args = args; return this; }, async first() { if (committed && options.failReconcile) throw new Error("read unavailable"); return sql.prepare(this.query).get(...this.args) || null; }, async all() { if (committed && options.failReconcile) throw new Error("read unavailable"); return { results: sql.prepare(this.query).all(...this.args) }; } };
    },
    async batch(statements) {
      if (options.failDatabase) throw new Error("isolated database unavailable");
      sql.exec("BEGIN");
      try { for (const s of statements) sql.prepare(s.query).run(...s.args); sql.exec("COMMIT"); }
      catch (e) { sql.exec("ROLLBACK"); throw e; }
      committed = true;
      if (options.failAfterCommit) throw new Error("commit acknowledgement lost");
    },
  };
  const bucket = { async put(key, bytes) { putCount++; if (options.failUpload || (options.failUploadAfter && putCount > options.failUploadAfter)) throw new Error("isolated upload failure"); objects.set(key, new Uint8Array(bytes)); if (options.failAfterWrite) throw new Error("isolated acknowledgement loss"); }, async delete(key) { removed.push(key); objects.delete(key); } };
  globalThis.__arkemIntakeTestEnv = options.noStorage ? {} : { DB: db, BUCKET: bucket };
  return { sql, objects, removed, get putCount() { return putCount; }, rows: () => sql.prepare("SELECT * FROM project_intakes").all(), files: () => sql.prepare("SELECT * FROM project_intake_files").all() };
}
const key = "12345678-1234-4123-8123-123456789abc";
const pdfFixture = "%PDF-1.7\nTest fixture\n%%EOF";
function assertStoredPdf(f) {
  const file = f.files()[0];
  assert.ok(file);
  const expected = new TextEncoder().encode(pdfFixture);
  assert.deepEqual(f.objects.get(file.object_key), expected);
  assert.equal(file.file_sha256, createHash("sha256").update(expected).digest("hex"));
  assert.equal(file.file_size, expected.byteLength);
}
test("client retry identity survives remount while persisting only digest, UUID and timestamp", async () => {
  const form = await request().formData(); const fingerprint = await intakePayloadDigest(form);
  const attempt = resolveIntakeAttempt(null, fingerprint, 1000, () => key);
  assert.deepEqual(Object.keys(attempt).sort(), ["createdAt", "key", "payloadDigest", "schema"]);
  assert.equal(resolveIntakeAttempt(JSON.parse(JSON.stringify(attempt)), fingerprint, 2000).key, key);
  assert.doesNotMatch(JSON.stringify(attempt), /Test müşteri|example.test|test.pdf/);
  assert.notEqual(resolveIntakeAttempt(attempt, fingerprint, 1000 + INTAKE_ATTEMPT_MAX_AGE_MS + 1).key, key);
  assert.notEqual(resolveIntakeAttempt({ ...attempt, createdAt: 70000 }, fingerprint, 1000).key, key);
});
test("same file metadata with changed bytes changes client retry identity; reordering identical files does not", async () => {
  const first = await request().formData(); const second = await request({}, "%PDF-1.7\nOther fixture\n%%EOF").formData();
  const a = await intakePayloadDigest(first); const b = await intakePayloadDigest(second);
  assert.notEqual(a, b);
  const attempt = resolveIntakeAttempt(null, a, 1000, () => key);
  assert.notEqual(resolveIntakeAttempt(attempt, b, 2000).key, key);
  first.append("projectFiles", new File(["%PDF-1.7\nsecond"], "second.pdf"));
  const reversed = new FormData(); for (const [k, v] of first.entries()) if (k !== "projectFiles") reversed.append(k, v);
  for (const file of first.getAll("projectFiles").reverse()) reversed.append("projectFiles", file);
  assert.equal(await intakePayloadDigest(first), await intakePayloadDigest(reversed));
});
function request(changes = {}, file = "%PDF-1.7\nTest fixture\n%%EOF") {
  const form = new FormData();
  const fields = { requestKey: key, name: "Test müşteri", company: "Test kuruluş", email: "client@example.test", phone: "0000000000", location: "Test il / ilçe", buildingType: "Diğer", area: "Uzmanla belirlenecek", stage: "Fikir aşaması", requestType: "Teknik danışmanlık", message: "Test ön görüşme açıklaması", consent: "accepted", ...changes };
  for (const [k, v] of Object.entries(fields)) form.set(k, v);
  if (file !== null) form.set("projectFiles", new File([file], "test.pdf", { type: "application/pdf" }));
  return new Request("https://example.test/api/project-intake", { method: "POST", body: form });
}
test("real intake stores one record and SHA-256 file; lost-response retry replays the same receipt", async () => {
  const f = fixture(); try {
    const first = await POST(request()); assert.equal(first.status, 201); const firstBody = await first.json();
    const second = await POST(request()); assert.equal(second.status, 201); const secondBody = await second.json();
    assert.equal(secondBody.referenceCode, firstBody.referenceCode); assert.equal(secondBody.replayed, true);
    assert.equal(f.rows().length, 1); assert.equal(f.files().length, 1); assert.equal(f.objects.size, 1); assert.equal(f.putCount, 1);
    assertStoredPdf(f);
  } finally { f.sql.close(); }
});
test("concurrent same-key requests preserve the winner's blob and one database record", async () => {
  const f = fixture(); try {
    const responses = await Promise.all([POST(request()), POST(request())]);
    const bodies = await Promise.all(responses.map(r => { assert.equal(r.status, 201); return r.json(); }));
    assert.equal(bodies[0].referenceCode, bodies[1].referenceCode); assert.equal(f.rows().length, 1);
    assert.equal(f.files().length, 1); assert.equal(f.objects.size, 1);
    assertStoredPdf(f);
  } finally { f.sql.close(); }
});
test("same retry key with edited text or different file bytes returns conflict without a second record", async () => {
  const f = fixture(); try {
    assert.equal((await POST(request())).status, 201);
    assert.equal((await POST(request({ message: "Edited request" }))).status, 409);
    assert.equal((await POST(request({}, "%PDF-1.7\nDifferent bytes\n%%EOF"))).status, 409);
    assert.equal(f.rows().length, 1); assert.equal(f.objects.size, 1);
  } finally { f.sql.close(); }
});
test("invalid identity, missing consent and file extension mismatch create no records", async () => {
  const f = fixture(); try {
    assert.equal((await POST(request({ requestKey: "not-a-uuid" }))).status, 400);
    assert.equal((await POST(request({ consent: "" }))).status, 400);
    assert.equal((await POST(request({}, "This is not PDF"))).status, 415);
    assert.equal((await POST(request({ website: "automated entry" }))).status, 400);
    const crossOrigin = request(); crossOrigin.headers.set("origin", "https://unrelated.example.test");
    assert.equal((await POST(crossOrigin)).status, 403);
    assert.equal(f.rows().length, 0); assert.equal(f.objects.size, 0);
  } finally { f.sql.close(); }
});
test("real multipart rejects a file above 6 MB without trusting declared length", async () => {
  const f = fixture(); try {
    assert.equal((await POST(request({}, new Uint8Array(6_000_001)))).status, 413);
    assert.equal(f.rows().length, 0); assert.equal(f.objects.size, 0);
  } finally { f.sql.close(); }
});
test("uncertain database failure preserves uploads instead of risking deletion of committed files", async () => {
  const f = fixture({ failDatabase: true }); try {
    assert.equal((await POST(request())).status, 503); assert.equal(f.rows().length, 0);
    assert.equal(f.objects.size, 1); assert.equal(f.removed.length, 0);
  } finally { f.sql.close(); }
});
test("lost commit acknowledgement reconciles the receipt without deleting its persisted file", async () => {
  const f = fixture({ failAfterCommit: true }); try {
    const response = await POST(request()); assert.equal(response.status, 201);
    assert.equal((await response.json()).replayed, true);
    assert.equal(f.rows().length, 1); assert.equal(f.files().length, 1); assert.equal(f.objects.size, 1);
    assertStoredPdf(f); assert.equal(f.removed.length, 0);
  } finally { f.sql.close(); }
});
test("commit plus unavailable reconciliation returns retryable failure and preserves file bytes", async () => {
  const options = { failAfterCommit: true, failReconcile: true };
  const f = fixture(options); try {
    assert.equal((await POST(request())).status, 503);
    assert.equal(f.rows().length, 1); assertStoredPdf(f); assert.equal(f.removed.length, 0);
    options.failReconcile = false;
    assert.equal((await POST(request())).status, 201); assert.equal(f.putCount, 1); assert.equal(f.rows().length, 1);
    assertStoredPdf(f);
  } finally { f.sql.close(); }
});
test("missing storage or failed upload is not acknowledged as a successful intake", async () => {
  for (const options of [{ noStorage: true }, { failUpload: true }]) {
    const f = fixture(options); try { assert.equal((await POST(request())).status, 503); assert.equal(f.rows().length, 0); } finally { f.sql.close(); }
  }
});
test("a later upload failure cleans files already uploaded by this attempt", async () => {
  const f = fixture({ failUploadAfter: 1 }); try {
    const initial = request(); const form = await initial.formData();
    form.append("projectFiles", new File(["%PDF-1.7\nSecond file\n%%EOF"], "second.pdf", { type: "application/pdf" }));
    assert.equal((await POST(new Request(initial.url, { method: "POST", body: form }))).status, 503);
    assert.equal(f.rows().length, 0); assert.equal(f.objects.size, 0); assert.equal(f.removed.length, 2);
  } finally { f.sql.close(); }
});
test("write followed by lost storage acknowledgement cleans the uniquely owned object", async () => {
  const f = fixture({ failAfterWrite: true }); try {
    assert.equal((await POST(request())).status, 503); assert.equal(f.rows().length, 0);
    assert.equal(f.objects.size, 0); assert.equal(f.removed.length, 1);
  } finally { f.sql.close(); }
});
