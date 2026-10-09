import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { registerHooks } from 'node:module';
import { chromium } from 'playwright';
import { PDFDocument, PDFName, PDFDict, PDFArray, PDFRawStream, decodePDFRawStream } from 'pdf-lib';
registerHooks({ resolve(s, c, next) { if (s.startsWith('.') && !path.extname(s)) { const u = new URL(s + '.ts', c.parentURL); if (fs.existsSync(fileURLToPath(u))) return next(u.href, c); } return next(s, c); } });
const { encodeProjectEnvelope } = await import('../app/lib/project-storage.ts');
const { createG05ReviewFixture } = await import('./fixtures/g05-review-project.mjs');
const { planGeometrySnapshot } = await import('../app/lib/source-reference-integrity.ts');
const { traceSha256 } = await import('../app/lib/structural-traceability.ts');
const { verifyFloorStudyDocument } = await import('../app/lib/floor-plate-study.ts');
const root = process.env.ARKEMX_E2E_BASE_URL ?? 'http://127.0.0.1:5187';
const out = path.resolve(process.env.ARKEMX_G05_EVIDENCE_DIR ?? 'test-artifacts/g05');
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: process.env.ARKEMX_E2E_BROWSER });
const reports = [];
async function stored(page) { return page.evaluate(() => JSON.parse(localStorage.getItem('arkem-project-kernel-v2')).payload); }
async function seed(page, p) {
  await page.goto(root);
  await page.evaluate(raw => { localStorage.clear(); sessionStorage.clear(); localStorage.setItem('arkem-project-kernel-v2', raw); }, encodeProjectEnvelope(p));
  await page.goto(root + '/tasiyici-on-tasarim');
}
async function check(name, fn) {
  const context = await browser.newContext(), page = await context.newPage(), errors = [];
  page.setDefaultTimeout(15000);
  page.on('pageerror', e => errors.push(String(e)));
  try { await fn(page); assert.deepEqual(errors, []); reports.push({ name, pass: true }); }
  catch (error) { reports.push({ name, pass: false, error: String(error), pageErrors: errors, body: await page.locator('body').innerText() }); await page.screenshot({ path: path.join(out, `b06-failure-${reports.length}.png`), fullPage: true }); }
  finally { await context.close(); }
}
async function ready(page) { await page.getByRole('button', { name: 'Kat bazlı ön çalışmayı indir (JSON)', exact: true }).waitFor(); await page.waitForFunction(() => document.querySelector('[aria-label="Kat bazlı ön çalışmayı indir (JSON)"]')?.disabled === false); }
async function download(page, name, format) {
  const event = page.waitForEvent('download'); await page.getByRole('button', { name, exact: true }).click();
  const file = await event, bytes = fs.readFileSync(await file.path()); fs.writeFileSync(path.join(out, file.suggestedFilename()), bytes);
  const hash = await traceSha256(bytes);
  await page.waitForFunction(hash => !!JSON.parse(localStorage.getItem('arkem-project-kernel-v2')).payload.modules['structural-concept'].floorDocumentRegistry?.['FLOOR-DOC-' + hash], hash);
  const p = await stored(page), m = p.modules['structural-concept'], doc = m.floorDocumentRegistry['FLOOR-DOC-' + hash], record = m.floorStudyRegistry[doc.manifest.studyId];
  assert.equal(doc.manifest.format, format);
  assert.equal(await verifyFloorStudyDocument(doc, m.floorStudyRegistry, p, record.content.input, bytes), true);
  return { p, doc, record, bytes };
}
try {
  await check('B06 actual per-floor areas and JSON/CSV/PDF/DXF drawings stay independent from whole-building results', async page => {
    await seed(page, createG05ReviewFixture()); await ready(page);
    assert.equal(await page.getByTestId('floor-study-total-area').innerText(), '300 m²');
    assert.match(await page.getByTestId('floor-study-row-1').innerText(), /10 × 10.*100/s);
    assert.match(await page.getByTestId('floor-study-row-2').innerText(), /20 × 10.*200/s);
    await page.getByLabel('Çizim katı').selectOption('2');
    const svg = page.getByRole('img', { name: 'K2 bağımsız plaka şeması: 20 × 10 metre' });
    const rect = svg.locator('rect'); assert.equal(Number(await rect.getAttribute('width')) / Number(await rect.getAttribute('height')), 2);
    const json = await download(page, 'Kat bazlı ön çalışmayı indir (JSON)', 'JSON');
    const payload = JSON.parse(json.bytes.toString()); assert.equal(payload.studyRecord.content.totals.grossArea, 300);
    const csv = await download(page, 'Kat yük tablosunu indir (CSV)', 'CSV');
    assert.ok(csv.bytes.toString().includes(json.record.id)); assert.ok(csv.bytes.toString().includes(csv.doc.manifest.identity.reference));
    const dxf = await download(page, 'Seçili kat çizimini indir (DXF)', 'DXF');
    const dxfTrace = JSON.parse(dxf.bytes.toString().split('\n')[1].slice('ARKEMX_TRACEABILITY '.length));
    assert.equal(dxfTrace.documentManifest.level, 2);
    const drawing = dxf.bytes.toString().replace(/\r\n/g, '\n');
    const corners = [...drawing.matchAll(/0\nVERTEX\n8\nON_YAPI\n10\n([^\n]+)\n20\n([^\n]+)\n/g)].map(match => [Number(match[1]), Number(match[2])]);
    assert.deepEqual(corners, [[0, 0], [20, 0], [20, 10], [0, 10]]);
    const pdf = await download(page, 'Seçili kat paftasını indir (PDF)', 'PDF');
    const pdfDoc = await PDFDocument.load(pdf.bytes); assert.ok(pdfDoc.getTitle().includes('K2'));
    const names = pdfDoc.catalog.lookup(PDFName.of('Names'), PDFDict).lookup(PDFName.of('EmbeddedFiles'), PDFDict).lookup(PDFName.of('Names'), PDFArray);
    const stream = names.lookup(1, PDFDict).lookup(PDFName.of('EF'), PDFDict).lookup(PDFName.of('F'), PDFRawStream);
    const attachment = JSON.parse(new TextDecoder().decode(decodePDFRawStream(stream).decode()));
    assert.equal(attachment.documentManifest.level, 2); assert.equal(attachment.studyRecord.id, json.record.id);
    const m = (await stored(page)).modules['structural-concept'];
    assert.equal(m.result, null); assert.equal(m.structuralStudio, null); assert.equal(m.calculationId, null);
    assert.equal(m.geometrySupport.fullBuildingAnalysis, false); assert.equal(Object.keys(m.floorDocumentRegistry).length, 4);
    assert.equal((await stored(page)).modules['arkem-x'], undefined);
    await page.screenshot({ path: path.join(out, 'b06-floor-study.png'), fullPage: true });
    await page.reload(); await ready(page);
    assert.equal((await stored(page)).modules['structural-concept'].floorStudyId, json.record.id);
    assert.equal(Object.keys((await stored(page)).modules['structural-concept'].floorDocumentRegistry).length, 4);
  });
  await check('B06 source changes create a new study and preserve earlier study/documents', async page => {
    const fixture = createG05ReviewFixture(); fixture.experience.autoHandoff = false;
    await seed(page, fixture); await ready(page);
    const old = await download(page, 'Kat bazlı ön çalışmayı indir (JSON)', 'JSON');
    const next = await stored(page), plan = next.modules['plan-editor'], structure = next.modules['structural-concept'];
    plan.floorPlates[1].width = 25; plan.floorPlates[1].grossArea = 250;
    structure.modelContext.floorPlates = structuredClone(plan.floorPlates); structure.inputGeometrySnapshot = planGeometrySnapshot(plan); structure.input.width = 25;
    await page.evaluate(raw => localStorage.setItem('arkem-project-kernel-v2', raw), encodeProjectEnvelope(next));
    await page.reload(); await ready(page);
    assert.equal(await page.getByTestId('floor-study-total-area').innerText(), '350 m²');
    const current = await download(page, 'Kat bazlı ön çalışmayı indir (JSON)', 'JSON');
    assert.notEqual(current.record.id, old.record.id);
    const m = current.p.modules['structural-concept'];
    assert.deepEqual(m.floorStudyRegistry[old.record.id], old.record); assert.deepEqual(m.floorDocumentRegistry[old.doc.id], old.doc);
    assert.equal(await verifyFloorStudyDocument(old.doc, m.floorStudyRegistry, current.p, current.record.content.input, old.bytes), false);
  });
  await check('B06 incomplete floor list and stale source do not expose floor results or exports', async page => {
    for (const kind of ['incomplete', 'stale']) {
      const p = createG05ReviewFixture();
      if (kind === 'incomplete') { p.modules['plan-editor'].floorPlates.shift(); p.modules['structural-concept'].modelContext.floorPlates = structuredClone(p.modules['plan-editor'].floorPlates); p.modules['structural-concept'].inputGeometrySnapshot = planGeometrySnapshot(p.modules['plan-editor']); }
      else p.modules['structural-concept'].sourceRevision = 'P01';
      await seed(page, p); await page.getByTestId('floor-plate-study-unavailable').waitFor();
      assert.equal(await page.getByTestId('floor-plate-study').count(), 0);
      assert.equal(await page.getByRole('button', { name: 'Kat bazlı ön çalışmayı indir (JSON)', exact: true }).count(), 0);
    }
  });
} finally { await browser.close(); fs.writeFileSync(path.join(out, 'b06-floor-study-result.json'), JSON.stringify({ executedAt: new Date().toISOString(), fixture: 'synthetic', reports, technicalApproval: false }, null, 2)); }
console.log(JSON.stringify({ suite: 'b06-floor-study', pass: reports.filter(r => r.pass).length, fail: reports.filter(r => !r.pass).length }));
if (reports.some(r => !r.pass)) process.exitCode = 1;
