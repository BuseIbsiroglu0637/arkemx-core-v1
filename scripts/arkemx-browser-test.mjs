/** ARKEMX v152: seven public module browser smoke tests.
 * Start dev server on 5173; then npm install -D playwright
 * and npx playwright install chromium before running this file.
 * Does not bypass authentication or certify engineering outputs.
 */
import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const base = (process.env.ARKEMX_BASE_URL || "http://127.0.0.1:5173").replace(/\/$/, "");
const outDir = path.resolve("arkemx-browser-results");
const modules = [
  ["Proje Başlat", "/proje-baslat"],
  ["Arsa Fizibilite", "/arsa-fizibilite-studyosu"],
  ["Mimari Program", "/mimari-program-studyosu"],
  ["Sistem Karşılaştırma", "/yapi-sistemi-karsilastirma"],
  ["Mühendislik Koordinasyon", "/muhendislik-koordinasyon"],
  ["Proje OS", "/proje-os"],
  ["Dijital Proje Merkezi", "/dijital-proje-merkezi"],
];
const csv = value => `"${String(value ?? "").replaceAll('"', '""').replaceAll(/\r?\n/g, " ")}"`;
await mkdir(outDir, { recursive: true });
await writeFile(path.join(outDir, ".gitignore"), "*\n!.gitignore\n");
let browser;
const rows = [];
try {
  browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
  for (let i = 0; i < modules.length; i++) {
    const [name, route] = modules[i];
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const pageErrors = [];
    const consoleErrors = [];
    page.on("pageerror", error => pageErrors.push(error.message));
    page.on("console", message => {
      if (message.type() === "error") consoleErrors.push(message.text());
    });
    const row = {
      name, route, http: null, finalUrl: "", heading: "", title: "",
      status: "INCELENECEK", pageErrors, consoleErrors, error: "",
      screenshot: `${String(i + 1).padStart(2, "0")}-${route.slice(1)}.png`,
    };
    try {
      const response = await page.goto(`${base}${route}`, {
        waitUntil: "domcontentloaded", timeout: 45000,
      });
      await page.waitForTimeout(1300);
      row.http = response?.status() ?? null;
      row.finalUrl = page.url();
      row.title = await page.title();
      row.heading = (await page.locator("h1").allTextContents())
        .map(text => text.trim()).filter(Boolean).join(" | ").slice(0, 200);
      await page.screenshot({
        path: path.join(outDir, row.screenshot), fullPage: true,
        animations: "disabled",
      });
      if (!row.http || row.http >= 400) row.status = "HATA";
      else if (!row.finalUrl.startsWith(`${base}${route}`) || pageErrors.length || !row.heading) {
        row.status = "INCELENECEK";
      } else row.status = "HTTP+TARAYICI ACILDI";
    } catch (error) {
      row.error = error.message;
      row.status = "HATA";
      try {
        await page.screenshot({ path: path.join(outDir, row.screenshot), fullPage: true });
      } catch { /* Browser may already be disconnected. */ }
    } finally {
      rows.push(row);
      console.log(`${row.status.padEnd(24)} ${String(row.http ?? "---").padEnd(4)} ${route}`);
      await page.close();
    }
  }
} catch (error) {
  console.error("Chromium acilamadi. Deneyin: npx playwright install chromium");
  throw error;
} finally {
  await browser?.close();
  await writeFile(path.join(outDir, "results.json"), JSON.stringify({
    testedAt: new Date().toISOString(), baseUrl: base,
    note: "A page opening does not establish functional or engineering correctness.",
    results: rows,
  }, null, 2));
  const fields = [
    "name", "route", "http", "status", "finalUrl", "heading", "title",
    "screenshot", "pageErrors", "consoleErrors", "error",
  ];
  const lines = [fields.map(csv).join(",")].concat(rows.map(row =>
    fields.map(key => csv(Array.isArray(row[key])
      ? row[key].join(" | ") : row[key])).join(",")));
  await writeFile(path.join(outDir, "results.csv"), lines.join("\n") + "\n");
  console.log(`\nSonuclar: ${outDir}/results.csv ve ekran goruntuleri`);
  console.log("Not: Korunan ekranlar ve dinamik rotalar bu testte yok.");
}
if (rows.some(row => row.status === "HATA")) process.exitCode = 1;
