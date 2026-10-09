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
const { traceSha256, verifyStructuralDocument } = await import('../app/lib/structural-traceability.ts');
const root = process.env.ARKEMX_E2E_BASE_URL ?? 'http://127.0.0.1:5187';
const out = path.resolve(process.env.ARKEMX_G05_EVIDENCE_DIR ?? 'test-artifacts/g05');
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: process.env.ARKEMX_E2E_BROWSER });
const reports = [];
async function stored(page) { return page.evaluate(() => JSON.parse(localStorage.getItem('arkem-project-kernel-v2')).payload); }
async function check(name, fn) {
  const context = await browser.newContext(), page = await context.newPage(), errors = [];
  page.setDefaultTimeout(15000);
  page.on('pageerror', e => errors.push(String(e)));
  try {
    const p = createG05ReviewFixture(); p.experience.autoHandoff = false;
    const plan = p.modules['plan-editor'], structure = p.modules['structural-concept'];
    plan.floorPlates = [{ level: 1, width: 10, depth: 10 }, { level: 2, width: 10, depth: 10 }];
    structure.modelContext.floorPlates = structuredClone(plan.floorPlates);
    structure.inputGeometrySnapshot = planGeometrySnapshot(plan);
    structure.input.width = 10;
    structure.geometrySupport.status = 'uniform-concept-only';
    await page.goto(root);
    await page.evaluate(raw => { localStorage.clear(); sessionStorage.clear(); localStorage.setItem('arkem-project-kernel-v2', raw); }, encodeProjectEnvelope(p));
    await page.goto(root + '/tasiyici-on-tasarim');
    await page.waitForFunction(() => JSON.parse(localStorage.getItem('arkem-project-kernel-v2')).payload.modules['structural-concept'].calculationId?.startsWith('CALC-'));
    await fn(page);
    assert.deepEqual(errors, []);
    reports.push({ name, pass: true });
  } catch (error) {
    reports.push({ name, pass: false, error: String(error), pageErrors: errors, body: await page.locator('body').innerText() });
    await page.screenshot({ path: path.join(out, `b04-failure-${reports.length}.png`), fullPage: true });
  } finally { await context.close(); }
}
async function download(page, button, format) {
  const event = page.waitForEvent('download'); await page.getByRole('button', { name: button }).click();
  const downloaded = await event;
  const bytes = fs.readFileSync(await downloaded.path());
  fs.writeFileSync(path.join(out, downloaded.suggestedFilename()), bytes);
  const digest = await traceSha256(bytes);
  await page.waitForFunction(digest => !!JSON.parse(localStorage.getItem('arkem-project-kernel-v2')).payload.modules['structural-concept'].documentRegistry?.['DOC-' + digest], digest);
  const p = await stored(page), m = p.modules['structural-concept'], document = m.documentRegistry['DOC-' + digest];
  assert.equal(document.manifest.format, format);
  const calc = m.calculationRegistry[document.manifest.calculationId];
  assert.equal(await verifyStructuralDocument(document, m.calculationRegistry, p, m.input, calc.content.options, bytes), true);
  return { bytes, p, document, calc };
}
try {
  await check('B04 real JSON/PDF/DXF/CSV downloads carry the same versioned calculation and verified file hashes', async page => {
    const before = await stored(page), calcId = before.modules['structural-concept'].calculationId;
    await page.getByRole('button', { name: 'Miktar / çıktı', exact: true }).click();
    const json = await download(page, /Tüm girdiler.*izlenebilir sonuç/, 'JSON');
    const payload = JSON.parse(json.bytes.toString());
    assert.equal(payload.documentIdentity.references.status, 'declared');
    assert.equal(payload.traceability.calculationRecord.id, calcId);
    assert.deepEqual(payload.result, json.calc.content.result);
    assert.deepEqual(payload.documentIdentity.references.elementIds.slice().sort(), before.modules['plan-editor'].elements.map(e => e.id).sort());
    const dxf = await download(page, /DWG uyumlu katmanlı DXF/, 'DXF');
    assert.equal(JSON.parse(dxf.bytes.toString().split('\n')[1].slice('ARKEMX_TRACEABILITY '.length)).calculationRecord.id, calcId);
    const csv = await download(page, /Ön boyutlandırma tablosu/, 'CSV');
    assert.ok(csv.bytes.toString().includes(calcId));
    assert.ok(csv.bytes.toString().includes(csv.document.manifest.identity.reference));
    const pdf = await download(page, /A3 kurumsal teknik pafta/, 'PDF');
    const pdfDoc = await PDFDocument.load(pdf.bytes);
    assert.ok(pdfDoc.getKeywords().includes(calcId));
    assert.ok(pdfDoc.getKeywords().includes(pdf.document.manifest.identity.reference));
    const names = pdfDoc.catalog.lookup(PDFName.of('Names'), PDFDict).lookup(PDFName.of('EmbeddedFiles'), PDFDict).lookup(PDFName.of('Names'), PDFArray);
    assert.equal(names.lookup(0).decodeText(), 'arkemx-traceability.json');
    const stream = names.lookup(1, PDFDict).lookup(PDFName.of('EF'), PDFDict).lookup(PDFName.of('F'), PDFRawStream);
    const attachment = JSON.parse(new TextDecoder().decode(decodePDFRawStream(stream).decode()));
    assert.equal(attachment.calculationRecord.id, calcId);
    assert.deepEqual(attachment.documentManifest, pdf.document.manifest);
    const after = await stored(page);
    assert.equal(Object.keys(after.modules['structural-concept'].documentRegistry).length, 4);
    await page.reload();
    await page.waitForFunction(id => JSON.parse(localStorage.getItem('arkem-project-kernel-v2')).payload.modules['structural-concept'].calculationId === id, calcId);
    assert.equal(Object.keys((await stored(page)).modules['structural-concept'].documentRegistry).length, 4);
  });
  await check('B04 changed load creates a new calculation without overwriting historical document/source records', async page => {
    await page.getByRole('button', { name: 'Miktar / çıktı', exact: true }).click();
    const old = await download(page, /Tüm girdiler.*izlenebilir sonuç/, 'JSON');
    const load = page.locator('label').filter({ hasText: /^Hareketli yük/ }).locator('input');
    await load.fill('8'); await load.blur();
    await page.waitForFunction(id => { const m = JSON.parse(localStorage.getItem('arkem-project-kernel-v2')).payload.modules['structural-concept']; return m.input.liveLoad === 8 && m.calculationId?.startsWith('CALC-') && m.calculationId !== id; }, old.calc.id);
    const next = await download(page, /Tüm girdiler.*izlenebilir sonuç/, 'JSON');
    assert.notEqual(next.calc.id, old.calc.id);
    const m = next.p.modules['structural-concept'];
    assert.deepEqual(m.calculationRegistry[old.calc.id], old.calc);
    assert.deepEqual(m.documentRegistry[old.document.id], old.document);
    assert.equal(await verifyStructuralDocument(old.document, m.calculationRegistry, next.p, m.input, next.calc.content.options, old.bytes), false);
    await page.reload();
    await page.waitForFunction(id => JSON.parse(localStorage.getItem('arkem-project-kernel-v2')).payload.modules['structural-concept'].calculationId === id, next.calc.id);
    assert.deepEqual((await stored(page)).modules['structural-concept'].calculationRegistry[old.calc.id], old.calc);
  });
  await check('B04 corrupt saved calculation is preserved for review and cannot produce a linked download', async page => {
    const p = await stored(page), m = p.modules['structural-concept'], id = m.calculationId;
    m.calculationRegistry[id].content.result.geometry.totalArea = 999;
    await page.evaluate(raw => localStorage.setItem('arkem-project-kernel-v2', raw), encodeProjectEnvelope(p));
    await page.reload();
    await page.getByRole('alert').filter({ hasText: 'Hesap kaynak kaydı oluşturulamadı' }).waitFor();
    await page.getByRole('button', { name: 'Miktar / çıktı', exact: true }).click();
    const downloadEvent = page.waitForEvent('download', { timeout: 1500 }).then(() => true, () => false);
    await page.getByRole('button', { name: /Tüm girdiler.*izlenebilir sonuç/ }).click();
    await page.getByRole('alert').filter({ hasText: 'JSON kaynak zinciri doğrulanamadı' }).waitFor();
    assert.equal(await downloadEvent, false);
    assert.equal((await stored(page)).modules['structural-concept'].calculationRegistry[id].content.result.geometry.totalArea, 999);
    assert.equal((await stored(page)).modules['structural-concept'].calculationId, null);
  });
} finally {
  await browser.close();
  fs.writeFileSync(path.join(out, 'b04-traceability-result.json'), JSON.stringify({ executedAt: new Date().toISOString(), fixture: 'synthetic', reports, technicalApproval: false }, null, 2));
}
console.log(JSON.stringify({ suite: 'b04-traceability', pass: reports.filter(r => r.pass).length, fail: reports.filter(r => !r.pass).length }));
if (reports.some(r => !r.pass)) process.exitCode = 1;
