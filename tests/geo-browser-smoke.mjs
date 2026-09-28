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
  });

  await check("Uydu, hibrit ve sokak harita modları değişiyor", async () => {
    const switcher = page.getByRole("group", { name: "Harita altlığı" });
    for (const mode of ["Uydu", "Hibrit", "Sokak"]) {
      const button = switcher.getByRole("button", { name: mode });
      await button.click();
      assert.equal(await button.getAttribute("aria-pressed"), "true");
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

  await page.getByRole("button", { name: "Teknik çıktılar", exact: true }).click();
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
  process.exitCode = 1;
} finally {
  await browser.close();
}
