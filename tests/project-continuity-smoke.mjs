/**
 * Project continuity smoke test: local save -> project center -> JSON backup
 * -> page reload -> parcel reopening -> JSON import -> second reload.
 * Uses a synthetic WGS84 polygon. Does NOT verify cadastre, zoning,
 * server/cloud synchronization, cross-device backup, or production hosting.
 *
 * Terminal 1: npm run demo:local -- --no-browser
 * Terminal 2: npm run test:project:e2e
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { chromium } from "playwright";

const root = process.env.ARKEMX_E2E_URL ?? "http://127.0.0.1:5173";
const STORAGE_KEY = "arkem-project-kernel-v2";
const polygon = [
  [33.7640000, 41.3450000],
  [33.7644800, 41.3450000],
  [33.7644800, 41.3453600],
  [33.7640000, 41.3453600],
  [33.7640000, 41.3450000],
];
const syntheticFile = {
  name: "sentetik-proje-sureklilik.geojson",
  mimeType: "application/geo+json",
  buffer: Buffer.from(JSON.stringify({
    type: "FeatureCollection",
    features: [{
      type: "Feature",
      properties: { authority: "SYNTHETIC TEST DATA — NOT CADASTRE" },
      geometry: { type: "Polygon", coordinates: [polygon] },
    }],
  })),
};

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ acceptDownloads: true });
const page = await context.newPage();
const checks = [];
const diagnostics = [];
page.on("pageerror", (error) => diagnostics.push(error.stack ?? error.message));
page.on("response", (response) => {
  if (response.url().startsWith(root) && response.status() >= 400) {
    diagnostics.push(`HTTP ${response.status()} ${response.url()}`);
  }
});
async function check(label, fn) {
  await fn();
  checks.push(label);
  console.log("PASS", label);
}
async function readStoredProject() {
  return page.evaluate((key) => {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  }, STORAGE_KEY);
}
async function waitForSavedGeo(expectedProjectId = null) {
  await page.waitForFunction(({ key, id }) => {
    const raw = localStorage.getItem(key);
    if (!raw) return false;
    try {
      const project = JSON.parse(raw)?.payload;
      const geo = project?.modules?.["geo-parcel"];
      return (!id || project.id === id)
        && geo?.parcel?.length === 4
        && geo?.parcelRecord?.evidence?.sourceKind === "user-file"
        && geo?.parcelRecord?.evidence?.officialCadastre === false;
    } catch { return false; }
  }, { key: STORAGE_KEY, id: expectedProjectId }, { timeout: 20_000 });
  const envelope = await readStoredProject();
  assert.equal(envelope.schema, "ARKEM-STORAGE/2.0");
  assert.ok(envelope.checksum);
  assert.equal(envelope.payload.modules["geo-parcel"].parcel.length, 4);
  return envelope.payload;
}
async function waitForHydratedGeo() {
  // Page HTML alone is not evidence that React hydration has completed.
  const uploadButton = page.getByRole("button", { name: "Dosya yükle", exact: true });
  const uploadHeading = page.getByRole("heading", { name: "Sınırı kaynağı ve statüsüyle içe alın." });
  for (let attempt = 0; attempt < 8; attempt++) {
    await uploadButton.click();
    try {
      await uploadHeading.waitFor({ timeout: 2000 });
      return;
    } catch {
      if (attempt === 7) throw new Error("Parsel çalışma alanı etkileşimli hâle gelmedi.");
    }
  }
}

try {
  await check("Proje merkezi temiz tarayıcı oturumunda açılıyor", async () => {
    const response = await page.goto(`${root}/dijital-proje-merkezi`, { waitUntil: "domcontentloaded" });
    assert.equal(response?.status(), 200);
    await page.getByRole("heading", { name: "Proje Çalışma Alanı", exact: true }).waitFor();
    await page.waitForFunction((key) => Boolean(localStorage.getItem(key)), STORAGE_KEY, { timeout: 20_000 });
  });

  await check("Sentetik parsel aktif projeye kaydediliyor", async () => {
    await page.goto(`${root}/arsa-fizibilite-studyosu`, { waitUntil: "domcontentloaded" });
    await waitForHydratedGeo();
    await page.locator('input[type="file"][accept*=".geojson"]').setInputFiles(syntheticFile);
    await page.getByText("sınır noktası içe alındı", { exact: false }).waitFor();
    const saved = await waitForSavedGeo();
    assert.equal(saved.schema, "ARKEM-PROJECT/1.0");
    assert.equal(saved.modules["geo-parcel"].parcelRecord.projectEligible, true);
    assert.equal(saved.modules["geo-parcel"].parcelRecord.evidence.officialCadastre, false);
  });

  const original = (await readStoredProject()).payload;
  let backup;
  await check("Proje merkezinde aynı kimlik ve proje yedeği görünüyor", async () => {
    await page.goto(`${root}/dijital-proje-merkezi`, { waitUntil: "domcontentloaded" });
    await page.locator(".arx-center-project-heading").getByText(original.id, { exact: false }).waitFor();
    const [download] = await Promise.all([
      page.waitForEvent("download", { timeout: 20_000 }),
      page.getByRole("button", { name: "Proje yedeğini indir" }).click(),
    ]);
    backup = JSON.parse((await readFile(await download.path())).toString("utf8"));
    assert.equal(backup.schema, "ARKEM-PROJECT/1.0");
    assert.equal(backup.id, original.id);
    assert.deepEqual(backup.modules["geo-parcel"].parcel, original.modules["geo-parcel"].parcel);
  });

  await check("Sayfa yenilendiğinde proje ve parsel verisi korunuyor", async () => {
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.locator(".arx-center-project-heading").getByText(original.id, { exact: false }).waitFor();
    const recovered = await waitForSavedGeo(original.id);
    assert.deepEqual(recovered.modules["geo-parcel"].parcel, original.modules["geo-parcel"].parcel);
  });

  await check("Parsel stüdyosu kayıtlı dört köşeyi ve kaynağı geri yüklüyor", async () => {
    await page.goto(`${root}/arsa-fizibilite-studyosu`, { waitUntil: "domcontentloaded" });
    await page.getByText("Kayıtlı parsel, yapı yerleşimi ve planlama verileri otomatik açıldı").waitFor({ timeout: 20_000 });
    await page.locator(".v109-parcel-center[data-record-state='user-supplied']").waitFor();
    await page.locator(".v109-parcel-center [data-eligible='true']").waitFor();
    const restored = await waitForSavedGeo(original.id);
    assert.deepEqual(restored.modules["geo-parcel"].parcel, original.modules["geo-parcel"].parcel);
    assert.equal(restored.modules["geo-parcel"].parcelRecord.evidence.officialCadastre, false);
  });

  await check("İndirilen tam proje yedeği içe aktarılabiliyor", async () => {
    await page.goto(`${root}/dijital-proje-merkezi`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(
      () => Boolean(document.documentElement.dataset.arkemMode),
      null,
      { timeout: 20_000 },
    );
    await page.locator(".arx-center-project-heading")
      .getByText(original.id, { exact: false })
      .waitFor();
    await page.getByLabel("ARKEMX proje JSON dosyası seç").setInputFiles({
      name: `${original.id}-test-restore.arkem.json`,
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(backup)),
    });
    await page.getByText("Proje yüklendi. Proje adı ve bağlı veri alanlarını kontrol edin.").waitFor();
    const reimported = await waitForSavedGeo(original.id);
    assert.equal(reimported.id, backup.id);
    assert.deepEqual(reimported.modules["geo-parcel"].parcel, backup.modules["geo-parcel"].parcel);
  });

  await check("İçe aktarılan yedek ikinci yenilemeden sonra da mevcut", async () => {
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.locator(".arx-center-project-heading").getByText(original.id, { exact: false }).waitFor();
    const restored = await waitForSavedGeo(original.id);
    assert.deepEqual(restored.modules["geo-parcel"].parcel, backup.modules["geo-parcel"].parcel);
    assert.equal(restored.modules["geo-parcel"].parcelRecord.evidence.officialCadastre, false);
  });

  console.log(`SUCCESS: ${checks.length} project continuity checks; local-device storage and JSON import only.`);
} catch (error) {
  console.error(`FAIL after ${checks.length} checks:`, error);
  console.error("Browser diagnostics:", diagnostics.slice(0, 15));
  console.error("Page URL:", page.url());
  process.exitCode = 1;
} finally {
  await browser.close();
}
