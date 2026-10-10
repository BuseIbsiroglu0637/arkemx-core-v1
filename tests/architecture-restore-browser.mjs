// Isolated synthetic projects: a draft transfer must not overwrite later edits on reload.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import { encodeProjectEnvelope, PROJECT_STORAGE_KEY } from '../app/lib/project-storage.ts';
import { stampProjectModule } from '../app/lib/project-core.ts';
import { createG05ReviewFixture } from './fixtures/g05-review-project.mjs';

const root = process.env.ARKEMX_E2E_BASE_URL ?? 'http://127.0.0.1:5187';
const out = path.resolve(process.env.ARKEMX_G05_EVIDENCE_DIR ?? 'test-artifacts/g05');
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: process.env.ARKEMX_E2E_BROWSER });
const reports = [];
try {
  for (const blockedStorage of [false, true]) {
    const context = await browser.newContext();
    const page = await context.newPage();
    page.setDefaultTimeout(15000);
    const errors = [];
    page.on('pageerror', error => errors.push(String(error)));
    try {
      const fixture = createG05ReviewFixture();
      fixture.experience = { ...fixture.experience, mode: 'guided', autoHandoff: false };
      fixture.modules = {};
      const stamp = (key, value) => stampProjectModule(value, { projectId: fixture.id, projectRevision: fixture.revision, sourceModule: key, recordedAt: fixture.updatedAt, action: 'created' });
      fixture.modules['decision-assistant'] = stamp('decision-assistant', { input: { name: fixture.name, projectType: 'new', usage: 'industrial', location: '', parcelStatus: 'unknown', targetArea: 1296, floors: 3, floorHeight: 3.2, experienceMode: 'guided' } });
      fixture.modules['geo-parcel'] = stamp('geo-parcel', { buildingWidth: 18, buildingDepth: 24, floors: 3, floorHeight: 3.2, usage: 'Tarımsal Yapı' });
      await page.goto(root);
      await page.evaluate(({ key, raw }) => {
        localStorage.clear(); sessionStorage.clear(); localStorage.setItem(key, raw);
      }, { key: PROJECT_STORAGE_KEY, raw: encodeProjectEnvelope(fixture) });
      if (blockedStorage) await context.addInitScript(() => {
        const original = Storage.prototype.setItem;
        Storage.prototype.setItem = function (key, value) {
          if (this === window.sessionStorage && key.startsWith('arkemx-architecture-draft-transfer:')) throw new Error('Synthetic unavailable transfer storage');
          return original.call(this, key, value);
        };
      });
      const waitGross = value => page.waitForFunction(({ key, value }) => {
        const input = document.querySelector('.arx-architect-fields input[type="number"]');
        const saved = JSON.parse(localStorage.getItem(key))?.payload?.modules?.['architectural-program'];
        return input?.value === String(value) && saved?.input?.targetGross === value;
      }, { key: PROJECT_STORAGE_KEY, value });
      const transfer = async width => {
        await page.goto(root + '/arsa-fizibilite-studyosu?stage=design');
        const draft = page.getByRole('region', { name: 'Taslak yapı bilgileri' });
        await draft.waitFor();
        const field = draft.getByLabel('Yapı genişliği (m)', { exact: true });
        await field.fill(String(width)); await field.press('Tab');
        await page.waitForFunction(({ key, width }) => JSON.parse(localStorage.getItem(key))?.payload?.modules?.['geo-parcel']?.buildingWidth === width, { key: PROJECT_STORAGE_KEY, width });
        await page.getByRole('link', { name: 'Taslak olarak mimariye devam et →', exact: true }).click();
        await page.getByTestId('architectural-program-studio').waitFor();
        await waitGross(width * 24 * 3);
      };
      await transfer(18);
      const target = page.getByLabel('Hedef brüt alan (m²)', { exact: true });
      await target.fill('1400'); await target.press('Tab'); await waitGross(1400);
      await page.reload(); await waitGross(1400);
      assert.equal(new URL(page.url()).searchParams.has('from'), false);
      // A deliberate new transfer must still replace the saved program, including the Kernel fallback.
      await transfer(20);
      await page.reload(); await waitGross(1440);
      const modules = await page.evaluate(key => JSON.parse(localStorage.getItem(key)).payload.modules, PROJECT_STORAGE_KEY);
      assert.equal(modules['architectural-program'].siteReview.status, 'pending');
      assert.equal(modules['architectural-program'].architecturalScheme.source.authoritativeMassing, false);
      assert.equal(modules['geo-parcel'].buildingWidth, 20);
      assert.deepEqual(errors, []);
      reports.push({ blockedStorage, pass: true, editedGrossAfterReload: 1400, freshTransferGrossAfterReload: 1440 });
    } catch (error) {
      reports.push({ blockedStorage, pass: false, error: String(error), pageErrors: errors });
      await page.screenshot({ path: path.join(out, `architecture-restore-${blockedStorage}.png`), fullPage: true });
    } finally { await context.close(); }
  }
} finally { await browser.close(); }
const result = { suite: 'architecture-restore-browser', technicalApproval: false, pass: reports.filter(x => x.pass).length, fail: reports.filter(x => !x.pass).length, reports };
fs.writeFileSync(path.join(out, 'architecture-restore-browser.json'), JSON.stringify(result, null, 2));
console.log(JSON.stringify(result));
if (result.fail) process.exitCode = 1;
