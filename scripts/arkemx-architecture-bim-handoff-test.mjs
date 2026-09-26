/** Synthetic ARKEMX project: architectural program -> plan -> structural -> BIM.
 * This validates device-local data continuity, not licensed engineering design.
 */
import assert from "node:assert/strict";
import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const base = (process.env.ARKEMX_BASE_URL || "http://127.0.0.1:5173").replace(/\/$/, "");
const outDir = path.resolve("arkemx-browser-results");
const name = "ARKEMX MIMARI STATIK BIM TEST";
const passed = [];
await mkdir(outDir, { recursive: true });
let browser, page;
const check = async (label, fn) => {
  await fn();
  passed.push(label);
  console.log("BASARILI " + label);
};
const project = async () => page.evaluate(() => {
  const raw = localStorage.getItem("arkem-project-kernel-v2");
  if (!raw) return null;
  const value = JSON.parse(raw);
  return value?.schema === "ARKEM-STORAGE/2.0" ? value.payload : value;
});
const wait = (predicate, arg) => page.waitForFunction(predicate, arg, {
  timeout: 18000, polling: 200,
});
const open = async (route, selector) => {
  const response = await page.goto(base + route, {
    waitUntil: "domcontentloaded", timeout: 45000,
  });
  assert.equal(response?.status(), 200, route + " HTTP 200 vermeli");
  await page.locator(selector).first().waitFor();
};
const startField = label => page.locator(".start-number-grid label")
  .filter({ hasText: label }).locator("input").first();

try {
  browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  page = await context.newPage();
  page.setDefaultTimeout(15000);

  await open("/proje-baslat", '[data-testid="project-start-studio"]');
  await check("Bagimsiz taslak proje olusturuldu", async () => {
    const next = page.locator(".project-start-actions button.primary");
    const field = page.getByPlaceholder("Örn. Arifiye üretim tesisi");
    await field.fill(name);
    if (!(await next.isEnabled())) {
      await page.waitForTimeout(1200);
      await field.fill("");
      await field.fill(name);
    }
    await wait(() => {
      const button = document.querySelector(".project-start-actions button.primary");
      return button && !button.disabled;
    });
    await next.click();
    await page.getByPlaceholder("İl / ilçe veya bilinen mevki").fill("Ankara / Test");
    await next.click();
    await page.locator(".start-number-grid").waitFor();
    await startField("Hedef brüt alan").fill("2400");
    await startField("Kat adedi").fill("2");
    await next.click();
    await page.locator(".start-decision-grid").waitFor();
    await next.click();
    await page.locator(".start-review").waitFor();
    await page.locator(".project-start-actions button.primary").click();
    await page.locator(".start-success h2").waitFor();
    await wait(() => {
      const raw = localStorage.getItem("arkem-project-kernel-v2");
      const value = raw ? JSON.parse(raw)?.payload : null;
      return value?.name === "ARKEMX MIMARI STATIK BIM TEST"
        && value?.modules?.["architectural-program"]?.input?.targetGross === 2400;
    });
  });

  await check("Mimari alan ve kat revizyonu kaydedildi", async () => {
    await open("/mimari-program-studyosu", '[data-testid="architectural-program-studio"]');
    const controls = page.locator(".architect-input-grid");
    await wait(() => [...document.querySelectorAll(".architect-input-grid label")]
      .some(item => item.textContent?.includes("Hedef brüt")
        && item.querySelector("input")?.value === "2400"));
    await controls.locator("label").filter({ hasText: "Hedef brüt" })
      .locator("input").fill("3000");
    await controls.locator("label").filter({ hasText: /^Kat$/ })
      .locator("input").fill("3");
    await wait(() => {
      const p = JSON.parse(localStorage.getItem("arkem-project-kernel-v2"))?.payload;
      const a = p?.modules?.["architectural-program"];
      return a?.input?.targetGross === 3000
        && a?.input?.floors === 3
        && a?.architecturalScheme?.plate?.width > 0
        && a?.architecturalScheme?.plate?.depth > 0
        && a?.architecturalScheme?.plate?.floors === 3;
    });
  });

  await check("Mimari sema plan aks modeline aktarildi", async () => {
    await open("/tasarim-calismalari", '[data-testid="advanced-plan-editor"]');
    await wait(() => {
      const p = JSON.parse(localStorage.getItem("arkem-project-kernel-v2"))?.payload;
      const a = p?.modules?.["architectural-program"];
      const plan = p?.modules?.["plan-editor"];
      return a?.architecturalScheme?.plate?.floors === 3
        && plan?.floorCount === 3
        && plan?.baysX >= 2 && plan?.baysY >= 2
        && plan?.spanX > 0 && plan?.spanY > 0
        && plan?.programContext?.architecturalScheme?.schema === "ARKEM-ARCH-SCHEME/3.0";
    });
  });

  await check("Aks ve mimari geometri tasiyici on tasarima aktarildi", async () => {
    await page.locator('[data-testid="structural-designer"]').first().waitFor();
    await page.locator('[data-testid="structural-designer"]')
      .first().getByRole("button", { name: /V113 \/ Plan \/ program verisini aktar/ }).click();
    await wait(() => {
      const p = JSON.parse(localStorage.getItem("arkem-project-kernel-v2"))?.payload;
      const structure = p?.modules?.["structural-concept"];
      const plan = p?.modules?.["plan-editor"];
      const scheme = p?.modules?.["architectural-program"]?.architecturalScheme;
      return structure?.input?.floors === 3
        && structure?.input?.width > 0
        && structure?.input?.depth > 0
        && structure?.structuralStudio?.source?.architecturalSchemeConnected === true
        && structure?.architectureContext?.architecturalScheme?.schema === "ARKEM-ARCH-SCHEME/3.0"
        && plan?.baysX > 0 && plan?.baysY > 0
        && scheme?.plate?.floors === 3;
    });
    const p = await project();
    assert.equal(
      p.modules["structural-concept"].structuralStudio.source.authoritativeGeometry,
      false,
      "Kavramsal mimari veri yetkili statik onayi sayilmamali"
    );
  });

  await check("Mimari ve tasiyici kaynaklari BIM koordinasyonuna baglandi", async () => {
    await open("/muhendislik-koordinasyon",
      '[data-testid="engineering-coordination-studio"]');
    await page.getByRole("button", { name: /V113 \+ V114 modelini yenile/ })
      .click();
    await wait(() => {
      const p = JSON.parse(localStorage.getItem("arkem-project-kernel-v2"))?.payload;
      const coordination = p?.modules?.["engineering-coordination"];
      const bim = coordination?.bimCoordination;
      return bim?.source?.architectureConnected === true
        && bim?.source?.structureConnected === true
        && bim?.spatial?.levels?.length >= 3
        && coordination?.input?.floorHeight > 0
        && coordination?.issues?.length >= 0;
    });
    const p = await project();
    const bim = p.modules["engineering-coordination"].bimCoordination;
    console.log("BILGI BIM: " + JSON.stringify({
      architectureConnected: bim.source.architectureConnected,
      structureConnected: bim.source.structureConnected,
      geometryMatches: bim.source.geometryMatches,
      levels: bim.spatial.levels.length,
      clashCount: bim.clashes.length,
    }));
  });

  await check("BIM kaydi yenileme sonrasi korundu", async () => {
    const before = (await project()).modules["engineering-coordination"];
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.locator('[data-testid="engineering-coordination-studio"]').waitFor();
    await wait(() => {
      const p = JSON.parse(localStorage.getItem("arkem-project-kernel-v2"))?.payload;
      const bim = p?.modules?.["engineering-coordination"]?.bimCoordination;
      return bim?.source?.architectureConnected === true
        && bim?.source?.structureConnected === true;
    });
    const after = (await project()).modules["engineering-coordination"];
    assert.equal(after.bimCoordination.spatial.levels.length,
      before.bimCoordination.spatial.levels.length);
  });


  await check("Kritik MEP yukseklik cakismasi gercekten yakalandi", async () => {
    const mep = page.locator(".coordination-input-grid label")
      .filter({ hasText: "MEP servis zonu" }).locator("input").first();
    await mep.fill("2");
    await wait(() => {
      const p = JSON.parse(localStorage.getItem("arkem-project-kernel-v2"))?.payload;
      const coordination = p?.modules?.["engineering-coordination"];
      const bim = coordination?.bimCoordination;
      return coordination?.input?.serviceZone === 2
        && bim?.coordination?.clearHeightM < 2.4
        && bim?.clashes?.some(issue =>
          issue.title.includes("net kullanım yüksekliğini ihlal")
          && issue.severity === "critical"
          && issue.nativeViewpoint === false
          && issue.sourceRefs?.includes("ARC:LEVELS")
        );
    });
    const bim = (await project()).modules["engineering-coordination"].bimCoordination;
    console.log("BILGI KASITLI TEST CAKISMASI: " + JSON.stringify({
      clearHeightM: bim.coordination.clearHeightM,
      critical: bim.clashes.filter(issue => issue.severity === "critical").length,
      total: bim.clashes.length,
    }));
  });

  await check("Cakisma kaydi incelendi durumuyla saklandi", async () => {
    await page.locator(".coordination-main nav button")
      .filter({ hasText: /Çakışmalar/ }).click();
    const issue = page.locator(".v115-clash-board article")
      .filter({ hasText: "net kullanım yüksekliğini ihlal" }).first();
    await issue.waitFor();
    await issue.getByRole("button", { name: "İncelendi / kapat" }).click();
    const before = (await project()).modules["engineering-coordination"];
    const clash = before.bimCoordination.clashes.find(item =>
      item.title.includes("net kullanım yüksekliğini ihlal")
    );
    assert.ok(clash?.guid);
    await wait(expectedGuid => {
      const p = JSON.parse(localStorage.getItem("arkem-project-kernel-v2"))?.payload;
      const coordination = p?.modules?.["engineering-coordination"];
      return coordination?.resolved?.includes(expectedGuid)
        && coordination?.bimCoordination?.clashes?.some(item => item.guid === expectedGuid);
    }, clash.guid);
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.locator('[data-testid="engineering-coordination-studio"]').waitFor();
    await wait(expectedGuid => {
      const p = JSON.parse(localStorage.getItem("arkem-project-kernel-v2"))?.payload;
      const coordination = p?.modules?.["engineering-coordination"];
      return coordination?.input?.serviceZone === 2
        && coordination?.resolved?.includes(expectedGuid)
        && coordination?.bimCoordination?.clashes?.some(item => item.guid === expectedGuid);
    }, clash.guid);
    console.log("BILGI: Isaretlenen issue silinmedi; inceleme durumu yenilemede korundu.");
  });

  console.log("\nSONUC: " + passed.length + "/8 Mimari -> Plan -> Tasiyici -> BIM testi basarili.");
  console.log("SINIR: Taslak geometri kullanildi; ruhsat, statik emniyet, onayli IFC/BCF ve imar hakki dogrulanmadi.");
} catch (error) {
  console.error("\nHATA: " + error.message);
  if (page) {
    try {
      const p = await project();
      const arch = p?.modules?.["architectural-program"];
      const plan = p?.modules?.["plan-editor"];
      const str = p?.modules?.["structural-concept"];
      const bim = p?.modules?.["engineering-coordination"]?.bimCoordination;
      console.error("TANI (yalnizca sentetik test verileri): " + JSON.stringify({
        url: page.url(), passed: passed.length,
        architecture: {
          targetGross: arch?.input?.targetGross ?? null,
          floors: arch?.input?.floors ?? null,
          scheme: arch?.architecturalScheme?.schema ?? null,
        },
        plan: {
          floorCount: plan?.floorCount ?? null,
          baysX: plan?.baysX ?? null,
          baysY: plan?.baysY ?? null,
          hasScheme: Boolean(plan?.programContext?.architecturalScheme),
        },
        structural: {
          floors: str?.input?.floors ?? null,
          width: str?.input?.width ?? null,
          depth: str?.input?.depth ?? null,
          schemeConnected: str?.structuralStudio?.source?.architecturalSchemeConnected ?? null,
        },
        bim: {
          architectureConnected: bim?.source?.architectureConnected ?? null,
          structureConnected: bim?.source?.structureConnected ?? null,
          geometryMatches: bim?.source?.geometryMatches ?? null,
          clearHeightM: bim?.coordination?.clearHeightM ?? null,
          clashCount: bim?.clashes?.length ?? null,
          resolved: p?.modules?.["engineering-coordination"]?.resolved ?? [],
        },
      }));
      const file = path.join(outDir, "architecture-bim-handoff-failure.png");
      await page.screenshot({ path: file, fullPage: true, animations: "disabled" });
      console.error("Hata ekran goruntusu: " + file);
    } catch { /* Best effort only. */ }
  }
  process.exitCode = 1;
} finally {
  await browser?.close();
}
