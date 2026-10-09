// Synthetic UI regression only; isolated from the user's active browser/project.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import { encodeProjectEnvelope } from '../app/lib/project-storage.ts';
import { PROJECT_MODULES } from '../app/lib/project-graph.ts';
import { createG05ReviewFixture } from './fixtures/g05-review-project.mjs';

const root = process.env.ARKEMX_E2E_BASE_URL ?? 'http://127.0.0.1:5187';
const out = path.resolve(process.env.ARKEMX_G05_EVIDENCE_DIR ?? 'test-artifacts/g05');
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: process.env.ARKEMX_E2E_BROWSER });
const reports = [];
async function check(name, fn) {
  const context = await browser.newContext();
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(String(error)));
  try {
    const fixture = createG05ReviewFixture();
    fixture.experience.autoHandoff = false;
    await page.goto(root);
    await page.evaluate(raw => {
      localStorage.clear(); sessionStorage.clear();
      localStorage.setItem('arkem-project-kernel-v2', raw);
    }, encodeProjectEnvelope(fixture));
    await fn(page);
    assert.deepEqual(errors, []);
    reports.push({ name, pass: true });
  } catch (error) {
    reports.push({ name, pass: false, error: String(error), pageErrors: errors, body: await page.locator('body').innerText() });
    await page.screenshot({ path: path.join(out, `ui-contract-failure-${reports.length}.png`), fullPage: true });
  } finally { await context.close(); }
}
async function stored(page) {
  return page.evaluate(() => JSON.parse(localStorage.getItem('arkem-project-kernel-v2')).payload);
}
try {
  await check('Project centre renders seven journey stages separately from the module catalogue', async page => {
    await page.goto(root + '/dijital-proje-merkezi');
    await page.locator('.arx-center-step-card').first().waitFor();
    assert.equal(await page.locator('.arx-center-journey-track > a').count(), 7);
    assert.equal(await page.locator('.arx-center-step-card').count(), 7);
    assert.match(await page.locator('.arx-center-journey').innerText(), /\/ 7 ana aşama tamamlandı/);
    assert.ok((await page.locator('.arx-center-journey').innerText()).includes(`${PROJECT_MODULES.length} teknik modül`));
    assert.ok((await page.locator('.arx-center-step-section').innerText()).includes(`${PROJECT_MODULES.length} teknik modül`));
  });
  await check('Mounted project change marks MCDA stale; explicit refresh recalculates and persists it', async page => {
    await page.goto(root + '/sistem-karsilastirma');
    await page.locator('.arx-mcda-source-status.is-current').waitFor();
    await page.waitForFunction(() => JSON.parse(localStorage.getItem('arkem-project-kernel-v2')).payload.modules['system-comparison']?.sourceStatus === 'current');
    const before = (await stored(page)).modules['system-comparison'];
    assert.equal(before.input.area, 300);
    assert.equal(before.input.span, 5);
    const next = await stored(page);
    next.modules['architectural-program'].input.targetGross = 600;
    next.modules['architectural-program'].result.grossDemand = 600;
    next.modules['plan-editor'].spanX = 20;
    await page.evaluate(raw => {
      localStorage.setItem('arkem-project-kernel-v2', raw);
      window.dispatchEvent(new StorageEvent('storage', { key: 'arkem-project-kernel-v2', storageArea: localStorage, newValue: raw }));
    }, encodeProjectEnvelope(next));
    const alert = page.locator('.arx-mcda-source-status.is-stale[role="alert"]');
    await alert.waitFor();
    assert.match(await alert.innerText(), /300.*600/s);
    assert.equal(await page.getByLabel('Brüt alan (m²)', { exact: true }).inputValue(), '300');
    assert.equal(await page.getByLabel('En büyük açıklık (m)', { exact: true }).inputValue(), '5');
    await page.waitForFunction(() => JSON.parse(localStorage.getItem('arkem-project-kernel-v2')).payload.modules['system-comparison'].sourceStatus === 'stale');
    await alert.getByRole('button').click();
    await page.locator('.arx-mcda-source-status.is-current').waitFor();
    await page.waitForFunction(() => {
      const m = JSON.parse(localStorage.getItem('arkem-project-kernel-v2')).payload.modules['system-comparison'];
      return m.sourceStatus === 'current' && m.input.area === 600 && m.input.span === 20 && m.sourceSnapshot.area === 600 && m.sourceSnapshot.span === 20;
    });
    assert.equal(await alert.count(), 0);
    const refreshed = (await stored(page)).modules['system-comparison'];
    assert.notEqual(refreshed.ranking.find(x => x.id === 'light').score, before.ranking.find(x => x.id === 'light').score);
    assert.equal(await page.getByLabel('Brüt alan (m²)', { exact: true }).inputValue(), '600');
    assert.equal(await page.getByLabel('En büyük açıklık (m)', { exact: true }).inputValue(), '20');
    await page.reload();
    await page.locator('.arx-mcda-source-status.is-current').waitFor();
    assert.equal(await page.getByLabel('Brüt alan (m²)', { exact: true }).inputValue(), '600');
    assert.equal(await page.getByLabel('En büyük açıklık (m)', { exact: true }).inputValue(), '20');
  });
} finally {
  await browser.close();
  fs.writeFileSync(path.join(out, 'ui-contracts-result.json'), JSON.stringify({ executedAt: new Date().toISOString(), fixture: 'synthetic', reports, technicalApproval: false }, null, 2));
}
console.log(JSON.stringify({ suite: 'ui-contracts', pass: reports.filter(r => r.pass).length, fail: reports.filter(r => !r.pass).length }));
if (reports.some(r => !r.pass)) process.exitCode = 1;
