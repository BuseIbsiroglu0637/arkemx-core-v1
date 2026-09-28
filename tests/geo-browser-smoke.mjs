/**
 * Browser integration smoke test for the synthetic Budamis-area parcel flow.
 * Does NOT contact or verify official TKGM, zoning, survey, or deployment services.
 * In terminal 1: npm run demo:local -- --no-browser
 * In terminal 2: npm run test:geo:e2e
 * If Chromium is missing: npx playwright install chromium
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { chromium } from "playwright";

const baseUrl = process.env.ARKEMX_E2E_URL ?? "http://127.0.0.1:5173";
const fixture = {
  type: "FeatureCollection",
  features: [{
    type: "Feature",
    properties: { source: "SYNTHETIC TEST FIXTURE — NOT CADASTRE" },
    geometry: {
      type: "Polygon",
      coordinates: [[
        [33.7640000, 41.3450000],
        [33.7644800, 41.3450000],
        [33.7644800, 41.3453600],
        [33.7640000, 41.3453600],
        [33.7640000, 41.3450000],
      ]],
    },
  }],
};

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ acceptDownloads: true });
const checks = [];
const browserErrors = [];
page.on("pageerror", (error) => browserErrors.push(`pageerror: ${error.stack || error.message}`));
page.on("console", (message) => {
  if (message.type() === "error") browserErrors.push(`console: ${message.text()}`);
});
page.on("response", (response) => {
  if (response.status() >= 400 && response.url().startsWith(baseUrl)) {
    browserErrors.push(`HTTP ${response.status()}: ${response.url()}`);
  }
});
async function waitForInteractiveApp() {
  // The page SSR markup can be clicked before React hydration attaches handlers.
  // The basic "Dosya yükle" navigation is visible in simple mode; other
  // navigation controls (including source details) are initially collapsed.
  const importButton = page.getByRole("button", { name: "Dosya yükle", exact: true });
  const locateButton = page.getByRole("button", { name: "Parsel bul", exact: true });
  const importHeading = page.getByRole("heading", { name: "Sınırı kaynağı ve statüsüyle içe alın." });
  const locateHeading = page.getByRole("heading", { name: "Resmî sorgudaki sırayla konumu seçin." });
  for (let attempt = 1; attempt <= 8; attempt++) {
    await importButton.click({ timeout: 5000 });
    try {
      await importHeading.waitFor({ timeout: 1500 });
      await locateButton.click();
      await locateHeading.waitFor({ timeout: 3000 });
      return;
    } catch {
      if (attempt === 8) {
        throw new Error(`GeoParcelStudio hydration not confirmed after 8 attempts. Browser errors: ${browserErrors.slice(0, 12).join(" | ") || "none observed"}`);
      }
    }
  }
}
async function check(label, action) {
  await action();
  checks.push(label);
  console.log("PASS", label);
}
async function downloadFrom(label) {
  const [download] = await Promise.all([
    page.waitForEvent("download", { timeout: 20_000 }),
    page.locator(".geo-export-list button").filter({ hasText: label }).click(),
  ]);
  return { name: download.suggestedFilename(), bytes: await readFile(await download.path()) };
}

try {
  await check("Arazi ve Parsel sayfası yükleniyor", async () => {
    const response = await page.goto(`${baseUrl}/arsa-fizibilite-studyosu`, { waitUntil: "domcontentloaded", timeout: 60_000 });
    assert.equal(response?.status(), 200);
    await page.getByRole("heading", { name: "Arazi ve parsel" }).waitFor();
    await page.locator(".geo-leaflet-map").waitFor();
    await waitForInteractiveApp();
  });

  await check("Uydu, hibrit ve sokak harita modları değişiyor", async () => {
    const switcher = page.getByRole("group", { name: "Harita altlığı" });
    // Start with a genuine state transition (the initial basemap is Uydu).
    // A Playwright click can finish before React has committed aria-pressed.
    for (const mode of ["Sokak", "Hibrit", "Uydu"]) {
      const button = switcher.getByRole("button", { name: mode, exact: true });
      await button.click();
      await page.waitForFunction((label) => {
        const buttons = Array.from(document.querySelectorAll(".geo-basemap-switch button"));
        return buttons.some((item) =>
          item.textContent?.trim() === label && item.getAttribute("aria-pressed") === "true");
      }, mode, { timeout: 10_000 });
      assert.equal(await button.getAttribute("aria-pressed"), "true", mode);
    }
    // External tile availability is intentionally not asserted.
  });

  await check("Sentetik GeoJSON dosyası yükleniyor", async () => {
    await page.getByRole("button", { name: "Dosya yükle", exact: true }).click();
    await page.locator('input[type="file"][accept*=".geojson"]').setInputFiles({
      name: "sentetik-budamis-test.geojson",
      mimeType: "application/geo+json",
      buffer: Buffer.from(JSON.stringify(fixture)),
    });
    await page.getByText("sınır noktası içe alındı", { exact: false }).waitFor({ timeout: 15_000 });
  });

  await check("3B arazi geçişi hata vermiyor", async () => {
    await page.getByRole("button", { name: "3B Arazi", exact: true }).first().click();
    // Browser may not have WebGL; a graceful fallback is acceptable here.
    await page.getByRole("button", { name: "2B Harita", exact: true }).click();
    await page.locator(".geo-leaflet-map").waitFor();
  });

  await check("Diğer araçlar menüsünden teknik çıktılar açılıyor", async () => {
    // The simplified parcel page places this action inside a native <details>
    // menu. Playwright correctly refuses to click its hidden contents.
    const extraTools = page.locator("details.arx-geo-extra");
    if (!(await extraTools.evaluate((details) => details.open))) {
      await extraTools.locator("summary").click();
    }
    await extraTools.getByRole("button", { name: "Teknik çıktılar", exact: true }).click();
    await page.locator(".geo-export-list").waitFor({ state: "visible" });
  });
  await check("Resmî teslim kilidi görünür ve çıktılar etkin", async () => {
    await page.getByText("Resmî teslim onayı yoktur.", { exact: false }).first().waitFor();
    const manifestButton = page.locator(".geo-export-list button").filter({ hasText: "MAN" });
    assert.equal(await manifestButton.isDisabled(), false);
  });

  const manifest = await downloadFrom("MAN");
  await check("Manifestin inceleme statüsü ve kaynak bilgisi tutarlı", async () => {
    const payload = JSON.parse(manifest.bytes.toString("utf8"));
    assert.equal(payload.schema, "ARKEM-GEO-MANIFEST/2.4");
    assert.equal(payload.officialReleaseEligible, false);
    assert.equal(payload.exportReview.officialReleaseEligible, false);
    assert.equal(payload.exportReview.status, "review-required");
    assert.equal(payload.counts.parcelVertices, 4);
    assert.equal(payload.verification.officialCadastre, false);
  });

  const geojson = await downloadFrom("GJSON");
  await check("GeoJSON, manifestle aynı inceleme statüsünü taşıyor", async () => {
    const payload = JSON.parse(geojson.bytes.toString("utf8"));
    assert.equal(payload.metadata.exportReview.status, "review-required");
    assert.equal(payload.metadata.exportReview.officialReleaseEligible, false);
    assert.equal(payload.features[0].geometry.type, "Polygon");
  });

  const kml = await downloadFrom("KML");
  await check("KML, resmî teslim kilidini içeriyor", async () => {
    const xml = kml.bytes.toString("utf8");
    assert.match(xml, /<kml xmlns="http:\/\/www.opengis.net\/kml\/2.2">/);
    assert.match(xml, /<Data name="reviewStatus"><value>review-required<\/value><\/Data>/);
    assert.match(xml, /<Data name="officialReleaseEligible"><value>false<\/value><\/Data>/);
  });

  const dxf = await downloadFrom("CAD");
  await check("DXF dosyasında uyarı katmanı bulunuyor", async () => {
    const text = dxf.bytes.toString("utf8");
    assert.match(text, /ARKEM_UYARI/);
    assert.match(text, /RESMI TESLIM/);
    assert.match(text, /EOF\s*$/);
  });

  const pdf = await downloadFrom("PDF");
  await check("PDF çıktı oluşturuluyor", async () => {
    assert.equal(pdf.bytes.subarray(0, 5).toString("ascii"), "%PDF-");
    assert.ok(pdf.bytes.byteLength > 2000);
  });

  const csv = await downloadFrom("CSV");
  await check("CSV, dört sentetik sınır noktasını içeriyor", async () => {
    const lines = csv.bytes.toString("utf8").trim().split(/\r?\n/);
    assert.equal(lines[0], "point,latitude,longitude,elevation_m");
    assert.equal(lines.length, 5);
  });
  console.log(`SUCCESS: ${checks.length} browser checks. No official cadastre/zoning approval inferred.`);
} catch (error) {
  console.error(`FAIL after ${checks.length} checks:`, error);
  console.error("Browser diagnostics:", browserErrors.slice(0, 15));
  try {
    const states = await page.locator(".geo-basemap-switch button").evaluateAll((buttons) =>
      buttons.map((button) => ({
        name: button.textContent?.trim(),
        pressed: button.getAttribute("aria-pressed"),
      })),
    );
    console.error("Basemap button states:", states);
    console.error("Page URL:", page.url());
    console.error("Page title:", await page.title());
  } catch (diagnosticError) {
    console.error("Diagnostics unavailable:", diagnosticError);
  }
  process.exitCode = 1;
} finally {
  await browser.close();
}
