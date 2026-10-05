/** ARKEMX v152: isolated project-to-GIS-to-architecture-to-MCDA handoff test.
 * Run against a local dev server. Uses a fresh browser context, no customer account.
 * Validates data flow; it does not verify official parcel data or structural safety.
 */
import assert from "node:assert/strict";
import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const base = (process.env.ARKEMX_BASE_URL || "http://127.0.0.1:5173").replace(/\/$/, "");
const outDir = path.resolve("arkemx-browser-results");
const name = "ARKEMX MODULLER ARASI TEST";
const checks = [];
await mkdir(outDir, { recursive: true });

let browser;
let page;
const check = async (title, action) => {
  await action();
  checks.push(title);
  console.log("BASARILI " + title);
};
const savedProject = async () => page.evaluate(() => {
  const raw = localStorage.getItem("arkem-project-kernel-v2");
  if (!raw) return null;
  const parsed = JSON.parse(raw);
  return parsed?.schema === "ARKEM-STORAGE/2.0" ? parsed.payload : parsed;
});
const labelInput = (section, text) => page.locator(section + " label")
  .filter({ hasText: text }).locator("input").first();
const waitForSaved = async predicate => page.waitForFunction(
  predicate, undefined, { timeout: 12000, polling: 200 },
);
try {
  browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  page = await context.newPage();
  page.setDefaultTimeout(15000);

  const home = await page.goto(base + "/proje-baslat", {
    waitUntil: "domcontentloaded", timeout: 45000,
  });
  assert.equal(home?.status(), 200, "Proje başlat HTTP 200 vermeli");
  await page.locator('[data-testid="project-start-studio"]').waitFor();
  const next = page.locator(".project-start-actions button.primary");

  await check("Yeni test projesi olusturuldu", async () => {
    const input = page.getByPlaceholder("Örn. Arifiye üretim tesisi");
    await input.fill(name);
    if (!(await next.isEnabled())) {
      await page.waitForTimeout(1200);
      await input.fill("");
      await input.fill(name);
    }
    await page.waitForFunction(() => {
      const button = document.querySelector(".project-start-actions button.primary");
      return button && !button.disabled;
    });
    await next.click();

    await page.getByPlaceholder("İl / ilçe veya bilinen mevki").fill("Ankara / Cankaya");
    await next.click();
    await page.locator(".start-number-grid").waitFor();
    await labelInput(".start-number-grid", "Hedef brüt alan").fill("2400");
    await labelInput(".start-number-grid", "Kat adedi").fill("2");
    await next.click();
    await page.locator(".start-decision-grid").waitFor();
    await next.click();
    await page.locator(".start-review").waitFor();
    await page.locator(".project-start-actions button.primary").click();
    await page.locator(".start-success h2").waitFor();
    assert.equal((await page.locator(".start-success h2").innerText()).trim(), name);
    await waitForSaved(() => {
      try {
        const value = JSON.parse(localStorage.getItem("arkem-project-kernel-v2") || "null")?.payload;
        return value?.name === "ARKEMX MODULLER ARASI TEST" &&
          value?.modules?.["geo-parcel"]?.floors === 2 &&
          value?.modules?.["architectural-program"]?.input?.targetGross === 2400;
      } catch { return false; }
    });
  });

  await check("Konum ve kat bilgisi arsa modulune kaydedildi", async () => {
    const project = await savedProject();
    assert.equal(project?.modules?.["geo-parcel"]?.reference, "Ankara / Cankaya");
    assert.equal(project.modules["geo-parcel"].floors, 2);
    const { buildingWidth, buildingDepth } = project.modules["geo-parcel"];
    assert.ok(Math.abs(buildingWidth * buildingDepth - 1200) < 0.2,
      "2400 m² ve 2 kat için beklenen kavramsal taban 1200 m²");
    const response = await page.goto(base + "/arsa-fizibilite-studyosu", {
      waitUntil: "domcontentloaded", timeout: 45000,
    });
    assert.equal(response?.status(), 200);
    await page.locator(".geo-workspace").waitFor();
  });

  await check("Mimari program proje alanini ve kat sayisini aldi", async () => {
    const response = await page.goto(base + "/mimari-program-studyosu", {
      waitUntil: "domcontentloaded", timeout: 45000,
    });
    assert.equal(response?.status(), 200);
    await page.locator('[data-testid="architectural-program-studio"]').waitFor();
    const area = labelInput(".architect-input-grid", "Hedef brüt");
    const floors = page.locator(".architect-input-grid label")
      .filter({ hasText: /^Kat$/ }).locator("input");
    try {
      await page.waitForFunction(() => {
        const labels = [...document.querySelectorAll(".architect-input-grid label")];
        const area = labels.find(x => x.textContent?.includes("Hedef brüt"))?.querySelector("input");
        const floors = labels.find(x => x.textContent?.trim() === "Kat")?.querySelector("input");
        return area?.value === "2400" && floors?.value === "2";
      }, undefined, { timeout: 12000 });
    } catch {
      const snapshot = await page.evaluate(() => {
        const labels = [...document.querySelectorAll(".architect-input-grid label")];
        const area = labels.find(x => x.textContent?.includes("Hedef brüt"))?.querySelector("input");
        const floors = labels.find(x => x.textContent?.trim() === "Kat")?.querySelector("input");
        const raw = localStorage.getItem("arkem-project-kernel-v2");
        const modules = raw ? JSON.parse(raw)?.payload?.modules : null;
        const source = modules?.["architectural-program"];
        return {
          displayed: { targetGross: area?.value ?? null, floors: floors?.value ?? null },
          storedArchitectureInput: {
            targetGross: source?.input?.targetGross ?? null,
            floors: source?.input?.floors ?? null,
          },
          storedGeo: {
            reference: modules?.["geo-parcel"]?.reference ?? null,
            floors: modules?.["geo-parcel"]?.floors ?? null,
          },
          architectureStatus: document.querySelector(".architect-status b")?.textContent ?? null,
        };
      });
      console.error("TANI (yalnizca test proje verileri): " + JSON.stringify(snapshot));
      throw new Error("Mimari aktarim 12 saniyede 2400 m² / 2 kat degerlerine ulasmadi.");
    }
    assert.equal(await area.inputValue(), "2400");
    assert.equal(await floors.inputValue(), "2");
  });

  await check("Mimari degisiklik ortak proje kasasina kaydedildi", async () => {
    await labelInput(".architect-input-grid", "Hedef brüt").fill("3000");
    await page.locator(".architect-input-grid label")
      .filter({ hasText: /^Kat$/ }).locator("input").fill("3");
    await waitForSaved(() => {
      try {
        const data = JSON.parse(localStorage.getItem("arkem-project-kernel-v2") || "null")?.payload;
        const input = data?.modules?.["architectural-program"]?.input;
        return input?.targetGross === 3000 && input?.floors === 3;
      } catch { return false; }
    });
  });

  await check("Mimari veriler sayfa yenileyince korundu", async () => {
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.locator('[data-testid="architectural-program-studio"]').waitFor();
    await page.waitForFunction(() => {
      const labels = [...document.querySelectorAll(".architect-input-grid label")];
      const area = labels.find(x => x.textContent?.includes("Hedef brüt"))?.querySelector("input");
      const floors = labels.find(x => x.textContent?.trim() === "Kat")?.querySelector("input");
      return area?.value === "3000" && floors?.value === "3";
    }, undefined, { timeout: 12000 });
  });

  await check("Mimari veriler sistem karsilastirmaya aktarildi", async () => {
    const upstream = await savedProject();
    const result = upstream?.modules?.["architectural-program"]?.result;
    const expectedArea = Math.round(result?.grossDemand > 0 ? result.grossDemand : 3000);
    const response = await page.goto(base + "/yapi-sistemi-karsilastirma", {
      waitUntil: "domcontentloaded", timeout: 45000,
    });
    assert.equal(response?.status(), 200);
    await page.locator('[data-testid="system-comparison-tool"]').waitFor();
    // SSR renders the button before React hydration. The saved MCDA input does not
    // include span; seeing a persisted span confirms initial state was restored and
    // the component's first guarded write has reached the shared project vault.
    await page.waitForFunction(() => {
      try {
        const value = JSON.parse(localStorage.getItem("arkem-project-kernel-v2") || "null")?.payload;
        return typeof value?.modules?.["system-comparison"]?.input?.span === "number";
      } catch { return false; }
    }, undefined, { timeout: 12000 });
    await page.getByRole("button", { name: /Parsel \/ mimari \/ aks verisini aktar/ }).click();
    try {
      await page.waitForFunction(expected => {
        const labels = [...document.querySelectorAll(".mcda-number-grid label")];
        const floors = labels.find(x => x.textContent?.trim() === "Kat")?.querySelector("input");
        const area = labels.find(x => x.textContent?.includes("Brüt alan"))?.querySelector("input");
        return floors?.value === "3" && Number(area?.value) === expected;
      }, expectedArea, { timeout: 12000 });
    } catch {
      const snapshot = await page.evaluate(() => {
        const labels = [...document.querySelectorAll(".mcda-number-grid label")];
        const floors = labels.find(x => x.textContent?.trim() === "Kat")?.querySelector("input");
        const area = labels.find(x => x.textContent?.includes("Brüt alan"))?.querySelector("input");
        const raw = localStorage.getItem("arkem-project-kernel-v2");
        const modules = raw ? JSON.parse(raw)?.payload?.modules : {};
        return {
          displayed: { floors: floors?.value ?? null, area: area?.value ?? null },
          savedArchitecture: {
            targetGross: modules?.["architectural-program"]?.input?.targetGross ?? null,
            floors: modules?.["architectural-program"]?.input?.floors ?? null,
            grossDemand: modules?.["architectural-program"]?.result?.grossDemand ?? null,
          },
          savedMCDA: {
            floors: modules?.["system-comparison"]?.input?.floors ?? null,
            area: modules?.["system-comparison"]?.input?.area ?? null,
            span: modules?.["system-comparison"]?.input?.span ?? null,
          },
        };
      });
      console.error("TANI MCDA (yalnizca test proje verileri): " + JSON.stringify({ expectedArea, ...snapshot }));
      throw new Error("Yapi sistemi veri aktarimi hedef kat/alan degerlerine 12 saniyede ulasmadi.");
    }
    await waitForSaved(() => {
      try {
        const data = JSON.parse(localStorage.getItem("arkem-project-kernel-v2") || "null")?.payload;
        const input = data?.modules?.["system-comparison"]?.input;
        const grossDemand = data?.modules?.["architectural-program"]?.result?.grossDemand;
        const sourceArea = Math.round(grossDemand > 0 ? grossDemand : 3000);
        return input?.floors === 3 && input?.area === sourceArea;
      } catch { return false; }
    });
    console.log("BILGI: Sistem karşılaştırma alanı, yazılımın mevcut kuralına göre mimari PROGRAM BRÜTÜ değerinden türetilir; hedef brüt 3000 m² ile aynı olmak zorunda değildir.");
  });

  console.log("\nSONUC: " + checks.length + "/6 moduller arasi fonksiyonel kontrol basarili.");
  console.log("Not: Resmi parsel/imar verileri veya nihai mühendislik hesapları doğrulanmadı.");
} catch (error) {
  console.error("\nHATA: " + error.message);
  if (page) {
    try {
      const screenshot = path.join(outDir, "handoff-test-failure.png");
      await page.screenshot({ path: screenshot, fullPage: true, animations: "disabled", caret: "initial" });
      console.error("Hata ekran görüntüsü: " + screenshot);
    } catch { /* Browser may have closed. */ }
  }
  console.error("Başarılı kontrol: " + checks.length + "/6");
  process.exitCode = 1;
} finally {
  await browser?.close();
}
