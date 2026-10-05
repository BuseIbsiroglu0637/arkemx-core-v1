/** ARKEMX: synthetic GeoJSON parcel -> geo design -> architecture integration.
 * A fresh Playwright context keeps test data off user accounts and live sites.
 * Geometry is artificial, user-supplied and NEVER official cadastral evidence.
 */
import assert from "node:assert/strict";
import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const base = (process.env.ARKEMX_BASE_URL || "http://127.0.0.1:5173").replace(/\/$/, "");
const name = "ARKEMX SENTETIK PARSEL TESTI";
const fixtureName = "arkemx-synthetic-parcel.geojson";
const outDir = path.resolve("arkemx-browser-results");
const passed = [];
const syntheticParcel = {
  type: "FeatureCollection",
  features: [{
    type: "Feature",
    properties: { source: "ARTIFICIAL TEST ONLY", officialCadastre: false },
    geometry: {
      type: "Polygon",
      coordinates: [[
        [32.8500, 39.9200], [32.8512, 39.9200],
        [32.8512, 39.9211], [32.8500, 39.9211],
        [32.8500, 39.9200],
      ]],
    },
  }],
};

await mkdir(outDir, { recursive: true });
let browser;
let page;
const check = async (title, action) => {
  await action();
  passed.push(title);
  console.log("BASARILI " + title);
};
const readProject = async () => page.evaluate(() => {
  const raw = localStorage.getItem("arkem-project-kernel-v2");
  if (!raw) return null;
  const value = JSON.parse(raw);
  return value?.schema === "ARKEM-STORAGE/2.0" ? value.payload : value;
});
const waitForStored = predicate => page.waitForFunction(predicate, undefined, {
  timeout: 16000, polling: 200,
});
const field = label => page.locator(".start-number-grid label")
  .filter({ hasText: label }).locator("input").first();
const setRange = async (label, value) => {
  const control = page.locator(".geo-controls label")
    .filter({ hasText: label }).locator('input[type="range"]').first();
  await control.evaluate((input, next) => {
    // React tracks input.value. Use the native setter to produce a real onChange.
    const descriptor = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype, "value"
    );
    descriptor.set.call(input, String(next));
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }, value);
  await page.waitForFunction(({ label, value }) => {
    const item = [...document.querySelectorAll(".geo-controls label")]
      .find(node => node.textContent?.includes(label));
    return Number(item?.querySelector('input[type="range"]')?.value) === value
      && item?.textContent?.includes(value.toFixed(1) + " m");
  }, { label, value }, { timeout: 8000 });
};

try {
  browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  page = await context.newPage();
  page.setDefaultTimeout(15000);

  const start = await page.goto(base + "/proje-baslat", {
    waitUntil: "domcontentloaded", timeout: 45000,
  });
  assert.equal(start?.status(), 200);
  await page.locator('[data-testid="project-start-studio"]').waitFor();

  await check("Sentetik parsel icin ayri test projesi olusturuldu", async () => {
    const next = page.locator(".project-start-actions button.primary");
    const input = page.getByPlaceholder("Örn. Arifiye üretim tesisi");
    await input.fill(name);
    if (!(await next.isEnabled())) {
      await page.waitForTimeout(1200);
      await input.fill("");
      await input.fill(name);
    }
    await next.waitFor({ state: "visible" });
    await page.waitForFunction(() => {
      const button = document.querySelector(".project-start-actions button.primary");
      return button && !button.disabled;
    }, undefined, { timeout: 8000 });
    await next.click();
    await page.getByPlaceholder("İl / ilçe veya bilinen mevki")
      .fill("Ankara / Cankaya");
    await next.click();
    await page.locator(".start-number-grid").waitFor();
    await field("Hedef brüt alan").fill("2400");
    await field("Kat adedi").fill("2");
    await next.click();
    await page.locator(".start-decision-grid").waitFor();
    await next.click();
    await page.locator(".start-review").waitFor();
    await page.locator(".project-start-actions button.primary").click();
    await page.locator(".start-success h2").waitFor();
    await waitForStored(() => {
      const raw = localStorage.getItem("arkem-project-kernel-v2");
      if (!raw) return false;
      const p = JSON.parse(raw)?.payload;
      return p?.name === "ARKEMX SENTETIK PARSEL TESTI"
        && p?.modules?.["architectural-program"]?.input?.targetGross === 2400;
    });
  });

  await check("Ornek sinir resmî veya aktif proje geometrisi sayilmadi", async () => {
    const response = await page.goto(base + "/arsa-fizibilite-studyosu", {
      waitUntil: "domcontentloaded", timeout: 45000,
    });
    assert.equal(response?.status(), 200);
    await page.locator(".v109-parcel-center").waitFor();
    await page.locator('.geo-parcel-studio [data-testid="project-kernel-bar"] .kernel-identity button').filter({ hasText: name }).waitFor();
    const preview = page.locator(".v109-parcel-center");
    assert.equal(await preview.getAttribute("data-record-state"), "preview");
    assert.equal(
      await preview.locator("aside").getAttribute("data-eligible"), "false"
    );
    const project = await readProject();
    assert.equal(project?.modules?.["geo-parcel"]?.parcel?.length ?? 0, 0);
  });

  await check("Yapay GeoJSON yuklendi ve kullanici dosyasi olarak etiketlendi", async () => {
    await page.locator(".geo-workflow button")
      .filter({ hasText: "Veriyi al" }).click();
    await page.locator('.geo-file-drop input[type="file"]')
      .first().setInputFiles({
        name: fixtureName,
        mimeType: "application/geo+json",
        buffer: Buffer.from(JSON.stringify(syntheticParcel)),
      });
    await waitForStored(() => {
      try {
        const p = JSON.parse(localStorage.getItem("arkem-project-kernel-v2"))?.payload;
        const geo = p?.modules?.["geo-parcel"];
        return geo?.parcelRecord?.evidence?.sourceKind === "user-file"
          && geo?.parcelRecord?.projectEligible === true
          && geo?.parcelRecord?.evidence?.officialCadastre === false
          && geo?.parcelRecord?.geometry?.vertexCount === 4
          && geo?.metrics?.area > 100;
      } catch { return false; }
    });
    const geo = (await readProject()).modules["geo-parcel"];
    assert.equal(geo.parcelRecord.evidence.label, fixtureName);
    assert.equal(geo.parcelRecord.evidence.trust, "declared");
    assert.equal(await page.locator(".v109-parcel-center")
      .getAttribute("data-record-state"), "user-supplied");
    console.log("BILGI: GeoJSON yalnizca YAPAY TEST verisidir; kadastro kaniti degildir.");
  });

  await check("Kullanici menusunden resmî imar statüsü atanamadi", async () => {
    await page.locator(".geo-workflow button")
      .filter({ hasText: "İmarı doğrula" }).click();
    const status = page.locator(".geo-zoning-control select").first();
    const values = await status.locator("option").evaluateAll(
      options => options.map(option => option.value)
    );
    assert.equal(values.includes("approved-plan"), false);
    assert.equal(values.includes("certified-document"), false);
    // Playwright's isDisabled() does not reliably reflect <option disabled>
    // in every browser version. Inspect the native DOM option property.
    const pendingOption = status.locator('option[value="document-pending-review"]');
    const pendingState = await pendingOption.evaluate(option => ({
      disabled: option.disabled,
      hasDisabledAttribute: option.hasAttribute("disabled"),
      text: option.textContent,
    }));
    if (!pendingState.disabled) {
      const saved = await readProject();
      console.error("TANI IMAR SECENEGI: " + JSON.stringify({
        pendingState,
        savedSourceDocument: saved?.modules?.["geo-parcel"]?.zoning?.sourceDocument ?? null,
        savedVerification: saved?.modules?.["geo-parcel"]?.zoning?.verification ?? null,
        selectedStatus: await status.inputValue(),
      }));
    }
    assert.equal(
      pendingState.disabled,
      true,
      "Belge olmadan inceleme bekliyor secilememeli"
    );
    await status.selectOption("municipal-viewer");
    await waitForStored(() => {
      try {
        const geo = JSON.parse(localStorage.getItem("arkem-project-kernel-v2"))
          ?.payload?.modules?.["geo-parcel"];
        return geo?.zoning?.verification === "municipal-viewer"
          && geo?.zoningProvenance?.authoritative === false
          && geo?.massingModel?.source?.authoritative === false;
      } catch { return false; }
    });
    await status.selectOption("user-declared");
    await waitForStored(() => {
      try {
        const geo = JSON.parse(localStorage.getItem("arkem-project-kernel-v2"))
          ?.payload?.modules?.["geo-parcel"];
        return geo?.zoning?.verification === "user-declared";
      } catch { return false; }
    });
  });

  await check("Belge yuklemek onayli imar statüsü olusturmadi", async () => {
    await page.locator(".geo-workflow button")
      .filter({ hasText: "İmarı doğrula" }).click();
    await page.locator('.geo-zoning-control input[type="file"]')
      .setInputFiles({
        name: "SAHTE-TEST-IMAR-BELGESI.pdf",
        mimeType: "application/pdf",
        buffer: Buffer.from("%PDF-1.4\n% SYNTHETIC TEST FILE ONLY\n"),
      });
    await waitForStored(() => {
      try {
        const geo = JSON.parse(localStorage.getItem("arkem-project-kernel-v2"))
          ?.payload?.modules?.["geo-parcel"];
        return geo?.zoning?.sourceDocument === "SAHTE-TEST-IMAR-BELGESI.pdf"
          && geo?.zoning?.verification === "document-pending-review"
          && geo?.zoningProvenance?.authoritative === false
          && geo?.massingModel?.source?.authoritative === false;
      } catch { return false; }
    });
    assert.equal(
      await page.locator(".geo-zoning-status").getAttribute("data-state"),
      "document-pending-review"
    );
    console.log("BILGI: Yalnizca PDF dosya adi saklandi; icerik/onay dogrulanmadi.");
  });

  await check("TAKS KAKS Hmax ve on cekme kosullari kaynakli taslaga islendi", async () => {
    const zoning = page.locator(".geo-zoning-control");
    const change = async (label, value) => {
      await zoning.locator("label").filter({ hasText: label })
        .locator('input[type="number"]').first().fill(value);
    };
    await change("TAKS", "0.15");
    await change("KAKS / Emsal", "0.35");
    await change("Hmax / Yençok", "14");
    await change("Ön bahçe", "8");
    await waitForStored(() => {
      try {
        const geo = JSON.parse(localStorage.getItem("arkem-project-kernel-v2"))
          ?.payload?.modules?.["geo-parcel"];
        const model = geo?.massingModel;
        const area = geo?.metrics?.area;
        return geo?.zoning?.verification === "document-pending-review"
          && geo?.zoning?.taks === 0.15
          && geo?.zoning?.kaks === 0.35
          && geo?.zoning?.hmax === 14
          && geo?.zoning?.frontSetback === 8
          && geo?.planning?.maxCoverage === 15
          && geo?.planning?.maxFar === 0.35
          && geo?.planning?.maxHeight === 14
          && geo?.planning?.requiredSetback === 8
          && Math.abs(model?.limits?.allowedFootprint - area * 0.15) < 1
          && Math.abs(model?.limits?.allowedGrossArea - area * 0.35) < 1
          && model?.envelope?.setbacks?.front === 8
          && model?.source?.authoritative === false;
      } catch { return false; }
    });
  });

  await check("30 x 40 m ve 3 kat geometri proje kasasina ve mimariye akti", async () => {
    await page.locator(".geo-workflow button")
      .filter({ hasText: "Yapıyı yerleştir" }).click();
    await setRange("Yapı genişliği", 30);
    await setRange("Yapı derinliği", 40);
    const floors = page.locator(".geo-planning-grid label")
      .filter({ hasText: "Kat adedi" }).locator("input");
    await floors.fill("3");

    await waitForStored(() => {
      try {
        const p = JSON.parse(localStorage.getItem("arkem-project-kernel-v2"))?.payload;
        const geo = p?.modules?.["geo-parcel"];
        const arch = p?.modules?.["architectural-program"];
        return geo?.buildingWidth === 30
          && geo?.buildingDepth === 40 && geo?.floors === 3
          && Math.abs(geo?.metrics?.gross - 3600) < 1
          && arch?.input?.targetGross === 3600
          && arch?.input?.floors === 3;
      } catch { return false; }
    });
    const p = await readProject();
    assert.equal(p.modules["geo-parcel"].parcelRecord.evidence.officialCadastre, false);
    console.log("BILGI: 3600 m2, TEST taslak geometrisinden hesaplandi; imar hakki degildir.");
  });

  await check("Parsel ve taslak olculer yenilemeden sonra korundu", async () => {
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.locator(".v109-parcel-center").waitFor();
    await page.waitForFunction(() => {
      const panel = document.querySelector(".v109-parcel-center");
      return panel?.getAttribute("data-record-state") === "user-supplied"
        && panel?.querySelector("aside")?.getAttribute("data-eligible") === "true";
    }, undefined, { timeout: 16000 });
    await waitForStored(() => {
      try {
        const geo = JSON.parse(localStorage.getItem("arkem-project-kernel-v2"))
          ?.payload?.modules?.["geo-parcel"];
        return geo?.buildingWidth === 30 && geo?.buildingDepth === 40
          && geo?.floors === 3
          && geo?.parcelRecord?.evidence?.sourceKind === "user-file"
          && geo?.parcelRecord?.evidence?.officialCadastre === false
          && geo?.zoning?.verification === "document-pending-review"
          && geo?.zoning?.sourceDocument === "SAHTE-TEST-IMAR-BELGESI.pdf"
          && geo?.zoning?.taks === 0.15
          && geo?.zoning?.kaks === 0.35
          && geo?.zoning?.hmax === 14
          && geo?.zoning?.frontSetback === 8;
      } catch { return false; }
    });
  });

  await check("Mimari program 3600 m2 ve 3 kati kaynagi ile aldi", async () => {
    const response = await page.goto(base + "/mimari-program-studyosu", {
      waitUntil: "domcontentloaded", timeout: 45000,
    });
    assert.equal(response?.status(), 200);
    await page.locator('[data-testid="architectural-program-studio"]').waitFor();
    await page.waitForFunction(() => {
      const items = [...document.querySelectorAll(".architect-input-grid label")];
      const area = items.find(x => x.textContent?.includes("Hedef brüt"))
        ?.querySelector("input");
      const floors = items.find(x => x.textContent?.trim() === "Kat")
        ?.querySelector("input");
      return area?.value === "3600" && floors?.value === "3";
    }, undefined, { timeout: 16000 });
    const p = await readProject();
    assert.equal(p.modules["geo-parcel"].parcelRecord.evidence.officialCadastre, false);
    assert.equal(p.modules["geo-parcel"].zoning.verification, "document-pending-review");
    assert.equal(
      p.modules["architectural-program"]?.input?.siteContext?.massingModel?.source?.authoritative,
      false,
      "Insan onayi olmayan belge mimari kütleye onayli kaynak olarak aktarılamaz"
    );
    assert.notEqual(
      await page.locator(".v113-source-band").getAttribute("data-state"),
      "verified",
      "Yapay kullanici dosyasi onayli imar kutlesi gibi gosterilemez"
    );
  });

  console.log("\nSONUC: " + passed.length + "/9 GeoJSON -> Arsa -> Mimari testi basarili.");
  console.log("SINIR: Test verisi sentetiktir. Resmî kadastro, imar ve statik hesap dogrulanmadi.");
} catch (error) {
  console.error("\nHATA: " + error.message);
  if (page) {
    try {
      const p = await readProject();
      const geo = p?.modules?.["geo-parcel"];
      const arch = p?.modules?.["architectural-program"];
      console.error("TANI (yalnizca test verisi): " + JSON.stringify({
        url: page.url(),
        completed: passed.length,
        geo: {
          sourceKind: geo?.parcelRecord?.evidence?.sourceKind ?? null,
          officialCadastre: geo?.parcelRecord?.evidence?.officialCadastre ?? null,
          vertices: geo?.parcelRecord?.geometry?.vertexCount ?? null,
          width: geo?.buildingWidth ?? null,
          depth: geo?.buildingDepth ?? null,
          floors: geo?.floors ?? null,
          gross: geo?.metrics?.gross ?? null,
        },
        architecture: {
          targetGross: arch?.input?.targetGross ?? null,
          floors: arch?.input?.floors ?? null,
        },
      }));
      const screenshot = path.join(outDir, "synthetic-geo-handoff-failure.png");
      await page.screenshot({
        path: screenshot, fullPage: true,
        animations: "disabled", caret: "initial",
      });
      console.error("Hata ekran goruntusu: " + screenshot);
    } catch { /* Capture is best-effort. */ }
  }
  process.exitCode = 1;
} finally {
  await browser?.close();
}
