/** ARKEMX v152: isolated functional browser test for the five-step project intake.
 * Prerequisites: local Vite/vinext server at 5173 and installed Playwright Chromium.
 * A fresh browser context keeps this test separate from real browser/account data.
 * Tests user interactions and project handoff, not certified engineering calculations.
 */
import assert from "node:assert/strict";
import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const base = (process.env.ARKEMX_BASE_URL || "http://127.0.0.1:5173").replace(/\/$/, "");
const outDir = path.resolve("arkemx-browser-results");
const projectName = "ARKEMX OTOMATIK TEST PROJESI";
const checkpoints = [];
await mkdir(outDir, { recursive: true });
let browser;
let page;
const check = async (name, action) => {
  await action();
  checkpoints.push(name);
  console.log(`BASARILI  ${name}`);
};
try {
  browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
  const context = await browser.newContext({ acceptDownloads: true });
  page = await context.newPage();
  page.setDefaultTimeout(15000);
  const response = await page.goto(`${base}/proje-baslat`, { waitUntil: "domcontentloaded", timeout: 45000 });
  assert.equal(response?.status(), 200, "Proje başlat sayfası HTTP 200 dönmeli");
  await page.locator('[data-testid="project-start-studio"]').waitFor();

  const next = page.locator(".project-start-actions button.primary");

  await check("Zorunlu proje adi bosken devam edilemiyor", async () => {
    assert.equal(await next.isDisabled(), true);
  });

  await check("Proje adi ve konum ile ilk iki adim tamamlandi", async () => {
    await page.getByPlaceholder("Örn. Arifiye üretim tesisi").fill(projectName);
    assert.equal(await next.isEnabled(), true);
    await next.click();
    await page.getByPlaceholder("İl / ilçe veya bilinen mevki").fill("Ankara / Cankaya");
    await next.click();
    await page.locator(".start-number-grid").waitFor();
  });

  await check("2400 metrekare ve 2 kat girisi 1200 metrekare/kat hesapliyor", async () => {
    await page.locator(".start-number-grid label").filter({ hasText: "Hedef brüt alan" }).locator("input").fill("2400");
    await page.locator(".start-number-grid label").filter({ hasText: "Kat adedi" }).locator("input").fill("2");
    const metric = (await page.locator(".start-live-metric b").innerText()).replace(/\s/g, "");
    assert.match(metric, /1[.,]?200m²/, `Hesap beklenenle eslesmedi: ${metric}`);
  });

  await check("Yarim kalan proje taslagi yenileme sonrasinda geri geliyor", async () => {
    await page.waitForFunction(() => {
      try {
        const saved = JSON.parse(localStorage.getItem("arkem-guided-project-draft-v107") || "null");
        return saved?.step === 2 && saved?.intake?.targetArea === 2400 &&
          saved?.intake?.floors === 2;
      } catch { return false; }
    });
    await page.reload({ waitUntil: "domcontentloaded" });
    const area = page.locator(".start-number-grid label").filter({ hasText: "Hedef brüt alan" }).locator("input");
    await area.waitFor();
    assert.equal(await area.inputValue(), "2400");
    const floors = page.locator(".start-number-grid label").filter({ hasText: "Kat adedi" }).locator("input");
    assert.equal(await floors.inputValue(), "2");
  });

  await check("Bes adimlik akistan yeni proje olusturuldu", async () => {
    await next.click();
    await page.locator(".start-decision-grid").waitFor();
    assert.equal(await next.isDisabled(), false, "En az bir karar onceligi secili olmali");
    await next.click();
    await page.locator(".start-review").waitFor();
    assert.match(await page.locator(".start-review").innerText(), /2\.400 m² · 2 kat/);
    await page.locator(".project-start-actions button.primary").click();
    await page.locator(".start-success h2").waitFor();
    assert.equal((await page.locator(".start-success h2").innerText()).trim(), projectName);
  });

  await check("Proje kimligi dijital proje merkezine aktarildi", async () => {
    await page.getByRole("link", { name: /Proje kontrol merkezini açın/ }).click();
    await page.waitForURL(/\/dijital-proje-merkezi(?:\?|$)/, { timeout: 30000 });
    await page.locator('[data-testid="digital-project-hub"]').waitFor();
    const identity = page.locator('[data-testid="project-kernel-bar"] .kernel-identity button');
    await identity.filter({ hasText: projectName }).waitFor({ timeout: 15000 });
    assert.equal((await identity.innerText()).trim(), projectName);
  });

  console.log(`\nSONUC: ${checkpoints.length}/6 fonksiyonel kontrol basarili.`);
  console.log("Not: Resmi imar verisi, muhendislik hesabı ve canli hesap yetkisi test edilmedi.");
} catch (error) {
  console.error(`\nHATA: ${error.message}`);
  if (page) {
    try {
      const screenshot = path.join(outDir, "functional-test-failure.png");
      await page.screenshot({ path: screenshot, fullPage: true, animations: "disabled", caret: "initial" });
      console.error(`Hata ekran goruntusu: ${screenshot}`);
    } catch { /* Navigation or browser may be unavailable. */ }
  }
  console.error(`Basarili kontrol sayisi: ${checkpoints.length}/6`);
  process.exitCode = 1;
} finally {
  await browser?.close();
}
