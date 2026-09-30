import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import { blogPosts } from "../app/data/blog.ts";
import { v3Projects as projectRecords } from "../app/data/projects-v3.ts";
import { referenceRecords } from "../app/data/references.ts";
import { services } from "../app/data/services.ts";
import { structuralSystems } from "../app/data/structural-systems.ts";
import { createLayeredDxf } from "../app/lib/engineering.ts";
import { createCorporateTechnicalPdf } from "../app/lib/technical-sheet.ts";
import { deriveGuidedProjectRoadmap } from "../app/lib/guided-project.ts";
import { deriveProjectCore, stampProjectModule } from "../app/lib/project-core.ts";
import { PROJECT_MODULES, deriveProjectThread } from "../app/lib/project-graph.ts";
import {
  resolveAccountProjectWritePrecondition,
  resolveProjectRecord,
  validateAccountProjectPayload,
} from "../app/lib/customer-portal.ts";
import {
  CUSTOMER_PROJECT_INSERT_SQL,
  CUSTOMER_PROJECT_UPDATE_SQL,
} from "../app/lib/customer-workspace-write.ts";
import { PDFDocument } from "pdf-lib";


const developmentPreviewMeta =
  /<meta(?=[^>]*\bname=["']codex-preview["'])(?=[^>]*\bcontent=["']development["'])[^>]*>/i;

async function render(path = "/", requestInit = {}, runtimeEnv = {}) {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}-${path}`);
  const { default: worker } = await import(workerUrl.href);
  const requestHeaders = new Headers(requestInit.headers);
  if (!requestHeaders.has("accept")) requestHeaders.set("accept", "text/html");
  return worker.fetch(
    new Request(`http://localhost${path}`, { ...requestInit, headers: requestHeaders }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) }, ...runtimeEnv },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

const hostedManifestPath = new URL("../.openai/hosting.json", import.meta.url);

// Keep deployment-specific checks separate from source-level tests: GitHub
// checkouts do not contain the private hosted deployment manifest.
test("hosted deployment declares the expected DB and BUCKET bindings", {
  skip: fs.existsSync(hostedManifestPath) ? false : "Private hosting manifest is unavailable in this checkout",
}, () => {
  const hosting = JSON.parse(fs.readFileSync(hostedManifestPath, "utf8"));
  assert.equal(hosting.d1, "DB");
  assert.equal(hosting.r2, "BUCKET");
});

test("local Cloudflare type generation declares DB and BUCKET binding names", () => {
  const typesConfig = fs.readFileSync(new URL("../wrangler.types.jsonc", import.meta.url), "utf8");
  assert.match(typesConfig, /"binding"\s*:\s*"DB"/);
  assert.match(typesConfig, /"binding"\s*:\s*"BUCKET"/);
});

test("V4.3 declares permanent Turkish canonical redirects for legacy Wix project routes", () => {
  const listing = fs.readFileSync(new URL("../app/projects/page.tsx", import.meta.url), "utf8");
  const detail = fs.readFileSync(new URL("../app/projects/[slug]/page.tsx", import.meta.url), "utf8");
  assert.match(listing, /permanentRedirect\("\/projeler"\)/);
  for (const target of ["viakasta", "cihan-tat", "yapikur-plaza", "devrekani-bosb"]) {
    assert.match(detail, new RegExp(`\\"${target}\\"`));
  }
  assert.match(detail, /permanentRedirect\(canonicalSlug \? `\/projeler\/\$\{canonicalSlug\}` : "\/projeler"\)/);
});

test("renders development preview metadata", async () => {
  const response = await render();

  assert.equal(response.status, 200);
  assert.match(
    response.headers.get("content-type") ?? "",
    /^text\/html\b/i,
  );
  assert.match(await response.text(), developmentPreviewMeta);
});

test("keeps hero copy spacing isolated from hero data rails", () => {
  const auditedSheets = ["v26.css", "v42.css", "v43.css", "globals.css"];
  for (const sheet of auditedSheets) {
    const source = fs.readFileSync(new URL(`../app/${sheet}`, import.meta.url), "utf8");
    assert.doesNotMatch(source, />\s*\.shell:not\(\.site-nav\)/, sheet);
  }

  const contract = fs.readFileSync(new URL("../app/v44.css", import.meta.url), "utf8");
  for (const rail of [
    "thread-hero-strip",
    "architecture-hero-strip",
    "coordination-hero-strip",
    "geo-hero-flow",
    "os-hero-strip",
    "design-studio-index",
    "digital-hero-index",
    "media-hero-index",
    "model-library-index",
    "technical-hero-index",
  ]) {
    assert.match(contract, new RegExp(`\\.${rail}\\b`), rail);
  }
  assert.match(contract, />\s*\.site-nav\s*\+\s*\.shell/);
});

test("keeps hero menus compact and corporate principles minimal", () => {
  const contract = fs.readFileSync(new URL("../app/v45.css", import.meta.url), "utf8");
  for (const rail of [
    "geo-hero-flow",
    "technical-hero-index",
    "arkem-x-signal",
    "thread-hero-strip",
    "media-hero-index",
  ]) {
    assert.match(contract, new RegExp(`\\.${rail}\\b`), rail);
  }
  assert.doesNotMatch(contract, /:where\(/, "hero correction selectors must keep enough specificity to override legacy route styles");
  assert.match(contract, /:is\([\s\S]*?\.thread-hero-strip/);
  assert.match(contract, /position:relative!important/);
  assert.match(contract, /inset:auto!important/);
  assert.match(contract, /transform:none!important/);
  assert.match(contract, /width:min\(1480px,calc\(100% - 160px\)\)!important/);
  assert.match(contract, /height:58px!important/);
  assert.match(contract, /\.corporate-principles \.principle-grid/);
  assert.match(contract, /grid-template-columns:repeat\(4,minmax\(0,1fr\)\)!important/);
});

test("keeps the shared header borderless and every hero rail inside the viewport", () => {
  const contract = fs.readFileSync(new URL("../app/v46.css", import.meta.url), "utf8");
  assert.match(contract, /\.site-nav::after/);
  assert.match(contract, /content:none!important/);
  assert.match(contract, /display:none!important/);
  assert.doesNotMatch(contract, /left:266px/);
  assert.match(contract, /\.site-nav \.official-logo/);
  assert.match(contract, /width:calc\(100% - 160px\)!important/);
  assert.match(contract, /max-width:1320px!important/);
  assert.match(contract, /left:auto!important/);
  assert.match(contract, /transform:none!important/);
  for (const rail of ["thread-hero-strip", "model-library-index", "technical-hero-index", "arkem-x-signal"]) {
    assert.match(contract, new RegExp(`\\.${rail}\\b`), rail);
  }
});

test("renders the project and contact hero journeys as separated compact steps", () => {
  const contract = fs.readFileSync(new URL("../app/v46.css", import.meta.url), "utf8");
  assert.match(contract, /\.project-start-hero-flow\{/);
  assert.match(contract, /grid-template-columns:repeat\(6,minmax\(0,1fr\)\)!important/);
  assert.match(contract, /\.project-start-hero-flow small\{[\s\S]*?display:none!important/);
  assert.match(contract, /\.contact-hero-v27 \.premium-hero-trust\{/);
  assert.match(contract, /gap:9px!important/);
  assert.match(contract, /border:0!important/);
});

test("renders the new technical platform routes", async () => {
  const routes = [
    ["/arsa-fizibilite-studyosu", "CANLI TEKNİK ÖZET"],
    ["/3b-model-kutuphanesi", "ROMON 3D"],
    ["/teknik-altyapi", "Teknik Veri Sözlüğü"],
    ["/site-haritasi", "ARKEM YAPI SİSTEMLERİ"],
  ];
  for (const [path, expected] of routes) {
    const response = await render(path);
    assert.equal(response.status, 200, path);
    assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i, path);
    assert.match(await response.text(), new RegExp(expected, "i"), path);
  }
});

test("renders the V25 professional engineering application contracts", async () => {
  const routes = [
    ["/tasarim-calismalari", ["ARKEM PROJECT KERNEL", "PARAMETRIC PLAN AUTHORING", "STRUCTURAL CONCEPT ENGINE"]],
    ["/arkemx", ["FARKLI SİSTEMLER", "ORTAK PROJE VERİSİ", "GELİŞİM YOL HARİTASI"]],
    ["/arsa-fizibilite-studyosu", ["GEO·BIM WORKSPACE", "TAKS / girdi", "VERİ DOĞRULAMA ZİNCİRİ"]],
    ["/yapi-sistemi-karsilastirma", ["Çok Ölçütlü Karar Motoru", "STRUCTURAL SYSTEM MCDA"]],
    ["/proje-os", ["PROJECT DELIVERY OS", "PROGRAM / MALİYET", "SPI / CPI"]],
    ["/yikim-karar-studyosu", ["DEMOLITION RISK ENGINE", "5×5 risk kaydı", "Güvenlik ve yetki sınırı"]],
    ["/dijital-donusum", ["Projeniz hangi aşamada", "Yedi ürün", "Metraj ve Maliyet"]],
    ["/3b-model-kutuphanesi", ["3D MODEL REVIEW", "TEKNİK İNCELEME KAYDI"]],
  ];
  for (const [path, expectedValues] of routes) {
    const response = await render(path);
    assert.equal(response.status, 200, path);
    const html = await response.text();
    for (const expected of expectedValues) assert.match(html, new RegExp(expected, "i"), `${path}: ${expected}`);
  }
});

test("renders the V26 federated architectural and engineering contracts", async () => {
  const routes = [
    ["/dijital-proje-merkezi", ["Proje Çalışma Alanı", "Projenize devam edin", "Proje JSON yükle"]],
    ["/mimari-program-studyosu", ["Mimari program", "Hedef alanı", "kavramsal plan şemasını"]],
    ["/muhendislik-koordinasyon", ["INTEGRATED COORDINATION ENGINE", "FEDERE MODEL KATMANLARI", "OTOMATİK KURAL SETİ"]],
    ["/tasarim-calismalari", ["MİMARİ PROGRAM", "Üst veriyi aktar", "Plan / program verisini aktar"]],
    ["/dijital-donusum", ["Yeni proje başlat", "Arsa Fizibilitesi", "Proje Kontrolü"]],
  ];
  for (const [path, expectedValues] of routes) {
    const response = await render(path);
    assert.equal(response.status, 200, path);
    const html = await response.text();
    for (const expected of expectedValues) assert.match(html, new RegExp(expected, "i"), `${path}: ${expected}`);
  }
});

test("renders the V27 premium customer journey contracts", async () => {
  const routes = [
    ["/", ["Araçlar", "Yeni proje", "Proje Çalışma Alanı"]],
    ["/referanslar", ["PROJE ARŞİVİ", "Teknik kayıt standardı", "kaynaklı kayıt"]],
    ["/iletisim", ["teknik başlangıç kaydı", "PROJE ÖN DEĞERLENDİRME", "Proje Dosyalarını Yükle"]],
  ];
  for (const [path, expectedValues] of routes) {
    const response = await render(path);
    assert.equal(response.status, 200, path);
    const html = await response.text();
    for (const expected of expectedValues) assert.match(html, new RegExp(expected, "i"), `${path}: ${expected}`);
  }
});

test("renders the current ARKEMX tools landing experience", async () => {
  const response = await render("/");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /<h1 id="arx-tools-title">Araçlar<\/h1>/);
  assert.match(html, /href="\/proje-baslat"/);
  assert.match(html, /href="\/arsa-fizibilite-studyosu"/);
  assert.match(html, /href="\/bim-koordinasyon"/);
  assert.match(html, /href="\/proje-takibi"/);
  assert.match(html, /name="robots" content="noindex, nofollow"/);
});

test("renders the V29 guided workflow and corrected module contracts", async () => {
  const routes = [
    ["/yikim-karar-studyosu", ["TEK PROJE", "HESAP MOTORU ÖNERİSİ", "ÖNERİLEN İNCELEME", "Mesafe arttıkça komşu kütleler"]],
    ["/arsa-fizibilite-studyosu", ["TEK PROJE", "MEGSİS", "Resmî Parsel Sorgu’da doğrula"]],
    ["/", ["Araçlar", "Yapı sistemi", "Proje Çalışma Alanı"]],
  ];
  for (const [path, expectedValues] of routes) {
    const response = await render(path);
    assert.equal(response.status, 200, path);
    const html = await response.text();
    for (const expected of expectedValues) assert.match(html, new RegExp(expected, "i"), `${path}: ${expected}`);
  }
});

test("renders the V32 continuous project handoff on every design stage", async () => {
  const legacyStages = [
    "/arsa-fizibilite-studyosu",
    "/mimari-program-studyosu",
    "/tasarim-calismalari",
    "/yapi-sistemi-karsilastirma",
    "/muhendislik-koordinasyon",
    "/proje-os",
  ];
  for (const route of legacyStages) {
    const response = await render(route);
    assert.equal(response.status, 200, route);
    const html = await response.text();
    assert.match(html, /Her modül önceki adımın verisini kullanır/i, route);
    assert.match(html, /Aktarılan proje verileri/i, route);
    assert.match(html, /href="\/arsa-fizibilite-studyosu"/i, `${route}: parcel route`);
    assert.match(html, /href="\/mimari-program-studyosu"/i, `${route}: architecture route`);
  }

  const centerResponse = await render("/dijital-proje-merkezi");
  assert.equal(centerResponse.status, 200);
  const centerHtml = await centerResponse.text();
  assert.match(centerHtml, /data-testid="digital-project-hub"/);
  assert.match(centerHtml, /Proje kontrol özeti/);
  assert.match(centerHtml, /Proje adımları/);
  assert.match(centerHtml, /href="\/mimari-program-studyosu"/i);
});

test("renders the V37 knowledge, editorial and ARKEMX accessibility contracts", async () => {
  const routes = [
    ["/dokumanlar", ["57", "Dijital Teslim &amp; BIM", "Zemin &amp; Deprem", "IFC Açık Model Standardı"]],
    ["/blog", ["Teknik Yayın Merkezi", "Teknik konuda arayın", "Dijital Yapı Pasaportu", "Betonarme Prefabrik"]],
    ["/arkemx", ["13 PROJE MÜHENDİSLİĞİ MODÜLÜ", "DOĞRULAMA VE İZLENEBİLİRLİK", "GELİŞİM YOL HARİTASI"]],
    ["/", ["Araçlar", "Mimari program", "Dijital teslim"]],
  ];
  for (const [path, expectedValues] of routes) {
    const response = await render(path);
    assert.equal(response.status, 200, path);
    const html = await response.text();
    for (const expected of expectedValues) assert.match(html, new RegExp(expected, "i"), `${path}: ${expected}`);
  }
});

test("renders the V38 guided project platform contract", async () => {
  const routes = [
    ["/proje-baslat", ["Yeni proje oluştur", "Proje bilgilerinizi adım adım girin", "bu cihazda taslak"]],
    ["/dijital-proje-merkezi", ["Proje Çalışma Alanı", "Yerel çalışma", "Ayrıntılı proje kontrolleri"]],
    ["/", ["Yeni proje", "Arazi ve parsel", "Dijital teslim"]],
  ];
  for (const [path, expectedValues] of routes) {
    const response = await render(path);
    assert.equal(response.status, 200, path);
    const html = await response.text();
    for (const expected of expectedValues) assert.match(html, new RegExp(expected, "i"), `${path}: ${expected}`);
  }
});

test("renders the V54 continuous parcel-to-structure contract and updated portrait", async () => {
  const routes = [
    ["/arsa-fizibilite-studyosu", ["VERİ DEVAMLILIĞI", "MİMARİ / PLAN"]],
    ["/mimari-program-studyosu", ["Mimari program", "Proje Çalışma Alanına Dön"]],
    ["/tasarim-calismalari", ["VERİ DEVAMLILIĞI", "plan-editor"]],
  ];
  for (const [path, expectedValues] of routes) {
    const response = await render(path);
    assert.equal(response.status, 200, path);
    const html = await response.text();
    for (const expected of expectedValues) assert.match(html, new RegExp(expected, "i"), `${path}: ${expected}`);
  }

  const kernelSource = fs.readFileSync(new URL("../app/components/ProjectKernel.tsx", import.meta.url), "utf8");
  for (const expected of ["siteContext", "programPlanElements", "modelContext", "mergeModuleValue", "synchronizeProject", "/plan-ve-aks", "/tasiyici-on-tasarim"]) {
    assert.match(kernelSource, new RegExp(expected), expected);
  }
  const portrait = fs.statSync(new URL("../public/ozenc-ozturk.webp", import.meta.url));
  assert.ok(portrait.size > 50_000 && portrait.size < 250_000, `Unexpected portrait size: ${portrait.size}`);
});

test("renders Turkish-first publishing while the English locale remains a hidden staging route", async () => {
  const response = await render("/");
  assert.equal(response.status, 200);
  const html = await response.text();
  for (const expected of ["hrefLang=\"tr-TR\"", "google.*notranslate"]) {
    assert.match(html, new RegExp(expected, "i"), expected);
  }
  assert.doesNotMatch(html, /data-locale-mode="single"|class="v4-language-static"|id="v4-language-menu"/i);
  assert.doesNotMatch(html, /hrefLang="en-US"|>English<|Azərbaycanca|Русский|Italiano|Deutsch|Français|flags\//i);
  const englishResponse = await render("/en");
  assert.equal(englishResponse.status, 200);
  const englishHtml = await englishResponse.text();
  assert.match(englishHtml, /ENGINEERING[\s\S]*TO THE SITE/i);
  assert.match(englishHtml, /v4-language-static is-link[\s\S]{0,240}>TR<\/a>/i);
  assert.match(englishHtml, /name="robots" content="noindex, nofollow"/i);

  const translations = JSON.parse(fs.readFileSync(new URL("../app/data/i18n-auto.json", import.meta.url), "utf8"));
  const azerbaijani = JSON.parse(fs.readFileSync(new URL("../app/data/i18n-az.json", import.meta.url), "utf8"));
  const russian = JSON.parse(fs.readFileSync(new URL("../app/data/i18n-ru.json", import.meta.url), "utf8"));
  const italian = JSON.parse(fs.readFileSync(new URL("../app/data/i18n-it.json", import.meta.url), "utf8"));
  const german = JSON.parse(fs.readFileSync(new URL("../app/data/i18n-de.json", import.meta.url), "utf8"));
  const french = JSON.parse(fs.readFileSync(new URL("../app/data/i18n-fr.json", import.meta.url), "utf8"));
  assert.ok(Object.keys(translations).length >= 3_800, "public-copy translation catalogue is incomplete");
  assert.ok(Object.keys(azerbaijani).length >= 4_000, "Azerbaijani public-copy catalogue is incomplete");
  assert.ok(Object.keys(russian).length >= 4_000, "Russian public-copy catalogue is incomplete");
  assert.ok(Object.keys(italian).length >= 4_000, "Italian public-copy catalogue is incomplete");
  assert.ok(Object.keys(german).length >= 4_000, "German public-copy catalogue is incomplete");
  assert.ok(Object.keys(french).length >= 4_000, "French public-copy catalogue is incomplete");
  assert.equal(translations["Yıkım mühendisliği"].toLowerCase(), "demolition engineering");
  assert.match(azerbaijani["Mühendislik Koordinasyon"], /Mühəndislik/i);
  assert.match(russian["Mühendislik Koordinasyon"], /Инженер/i);
  assert.equal(italian["Uygulama projesi"], "Progettazione esecutiva");
  assert.equal(german["Taşıyıcı sistem"], "Tragwerk");
  assert.equal(french["Betonarme prefabrik"], "Béton armé préfabriqué");
  assert.match(translations["Mimari, statik, MEP, geoteknik ve çatı drenaj verilerini federatif modelde karşılaştıran; çakışma ve issue kaydı üreten Arkem koordinasyon stüdyosu."], /architectural.*static.*MEP/i);

  const languageSource = fs.readFileSync(new URL("../app/data/i18n.ts", import.meta.url), "utf8");
  for (const locale of ["az", "ru", "it", "de", "fr"]) {
    assert.match(languageSource, new RegExp(`import\\(\"\\.\\/i18n-${locale}\\.json\"\\)`), `${locale} catalogue must be loaded on demand`);
  }
  assert.doesNotMatch(languageSource, /^import .*i18n-(?:az|ru|it|de|fr)\.json/m, "localized catalogues must not enter the initial bundle");
});

test("keeps every technical choice control clickable and readable in V58", () => {
  const contract = fs.readFileSync(new URL("../app/v58.css", import.meta.url), "utf8");
  assert.match(contract, /pointer-events:\s*auto\s*!important/);
  assert.match(contract, /appearance:\s*auto\s*!important/);
  assert.match(contract, /-webkit-appearance:\s*menulist\s*!important/);
  assert.match(contract, /select option/);
  assert.match(contract, /--v58-control-height:\s*46px/);
  assert.match(contract, /@media \(max-width:\s*760px\)/);
  assert.match(contract, /--v58-control-font:\s*16px/);
});

test("renders the V58 project control center and administrative fallback choices", async () => {
  const projectCenter = await render("/dijital-proje-merkezi");
  assert.equal(projectCenter.status, 200);
  const projectCenterHtml = await projectCenter.text();
  for (const expected of [
    "Ayrıntılı proje kontrolleri",
    "Proje kontrol özeti",
    "Proje adımları",
    "Teslim hazırlığı ve teknik çıktılar",
    "Proje paketini indir",
  ]) assert.match(projectCenterHtml, new RegExp(expected, "i"), expected);
  assert.doesNotMatch(projectCenterHtml, /Proje kontrol merkezi/i);

  const geoSource = fs.readFileSync(new URL("../app/components/GeoParcelStudio.tsx", import.meta.url), "utf8");
  assert.match(geoSource, /FALLBACK_PROVINCE_NAMES/);
  assert.match(geoSource, /Sakarya:[\s\S]*?Serdivan/);
  assert.match(geoSource, /Kastamonu:[\s\S]*?Araç/);
  assert.match(geoSource, /provinceId/);
  assert.match(geoSource, /districtId/);
  assert.match(geoSource, /neighborhoodId/);
  assert.match(geoSource, /Çevrimdışı seçim listesi açık/);
});

test("renders the V40 compact corporate and ARKEMX contracts", async () => {
  const routes = [
    ["/", ["arx-simple-home", "Araçlar", "Proje Çalışma Alanı"]],
    ["/kurumsal", ["MESLEKİ YAKLAŞIM", "Uygulama gerçekleriyle birlikte gelişen", "id=\"ozenc-ozturk\""]],
    ["/dokumanlar", ["id=\"bilgi-bankasi\"", "id=\"kaynak-3194-sayili-imar-kanunu\""]],
  ];
  for (const [path, expectedValues] of routes) {
    const response = await render(path);
    assert.equal(response.status, 200, path);
    const html = await response.text();
    for (const expected of expectedValues) assert.match(html, new RegExp(expected, "i"), `${path}: ${expected}`);
  }

  const searchSource = fs.readFileSync(new URL("../app/components/PremiumExperience.tsx", import.meta.url), "utf8");
  for (const expected of ["indexedRecords", "blogPosts.map", "resources.map", "referenceRecords.map", "structuralSystems.map", "Özenç Öztürk"]) {
    assert.match(searchSource, new RegExp(expected.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"), `search index: ${expected}`);
  }
});

test("renders every public route and keeps internal navigation resolvable", async () => {
  const routes = [
    "/",
    "/3b-model-kutuphanesi",
    "/arkem",
    "/arkem-x",
    "/arkemx",
    "/arsa-fizibilite-studyosu",
    "/blog",
    "/dijital-donusum",
    "/dijital-proje-merkezi",
    "/dokumanlar",
    "/egitimler",
    "/giris",
    "/hesap-kurulum",
    "/hesabim",
    "/hazir-projeler",
    "/hizmetler",
    "/iletisim",
    "/imar-entegrasyon-merkezi",
    "/kurumsal",
    "/kayit",
    "/medya",
    "/mimari-program-studyosu",
    "/muhendislik",
    "/muhendislik-koordinasyon",
    "/musteri-proje-portali",
    "/musteri-proje-portali/teknik-oda",
    "/proje-baslat",
    "/proje-zekasi",
    "/proje-karar-asistani",
    "/proje-os",
    "/plan-ve-aks",
    "/tasiyici-on-tasarim",
    "/sistem-karsilastirma",
    "/bim-koordinasyon",
    "/proje-takibi",
    "/projeler",
    "/referanslar",
    "/site-haritasi",
    "/tasarim-calismalari",
    "/teknik-altyapi",
    "/uyelik",
    "/yapi-sistemi-karsilastirma",
    "/yapi-sistemleri",
    "/yapilmis-isler",
    "/yikim-karar-studyosu",
    ...services.map((service) => `/hizmetler/${service.slug}`),
    ...blogPosts.map((post) => `/blog/${post.slug}`),
    ...projectRecords.map((project) => `/projeler/${project.slug}`),
    ...referenceRecords.map((record) => `/referanslar/${record.slug}`),
    ...structuralSystems.map((system) => `/yapi-sistemleri/${system.slug}`),
  ];

  const routeSet = new Set(routes);
  const discovered = new Set();
  for (const path of routeSet) {
    const response = await render(path);
    assert.ok(response.status === 200 || (["/uyelik", "/kayit", "/arkem-x"].includes(path) && response.status === 307), path);
    if (response.status !== 200) continue;
    const html = await response.text();
    for (const match of html.matchAll(/\bhref="(\/[^"]*)"/g)) {
      const target = match[1].split(/[?#]/, 1)[0] || "/";
      if (!/\.[a-z0-9]{2,5}$/i.test(target) && !target.startsWith("/api/") && !["/signin-with-chatgpt", "/signout-with-chatgpt", "/callback"].includes(target)) discovered.add(target);
    }
  }
  for (const path of discovered) assert.ok(routeSet.has(path), `Unresolved internal route: ${path}`);
});

test("renders the V60 customer decision and delivery portal", async () => {
  const response = await render("/musteri-proje-portali/teknik-oda");
  assert.equal(response.status, 200);
  const html = await response.text();
  for (const expected of [
    "MÜŞTERİ PROJE PORTALI",
    "client-portal",
    "Teknik veriyi",
  ]) assert.match(html, new RegExp(expected, "i"), expected);

  const source = fs.readFileSync(new URL("../app/components/ClientTechnicalProjectRoom.tsx", import.meta.url), "utf8");
  for (const expected of [
    "createCorporateTechnicalPdf",
    "teslim-manifestosu.json",
    "teslim-indeksi.csv",
    "API / lisans",
    "TKGM kadastro servisi",
    "Güvenli entegrasyon sınırı",
  ]) assert.match(source, new RegExp(expected.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"), expected);
});

test("keeps V61 project snapshots recoverable on the customer device", () => {
  const source = fs.readFileSync(new URL("../app/components/ClientTechnicalProjectRoom.tsx", import.meta.url), "utf8");
  for (const expected of [
    "arkem-project-vault-v1",
    "saveSnapshot",
    "restoreSnapshot",
    "deleteSnapshot",
    "Revizyon geri dönüş noktaları",
  ]) assert.match(source, new RegExp(expected.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"), expected);
});

test("renders V62 guided cross-discipline quality gates", () => {
  const source = fs.readFileSync(new URL("../app/components/ClientTechnicalProjectRoom.tsx", import.meta.url), "utf8");
  for (const expected of [
    "V62 / YÖNLENDİRMELİ KALİTE KAPILARI",
    "G01",
    "G06",
    "thread.canonical.site.geometryValid",
    "Kritik issue kapanışı",
  ]) assert.match(source, new RegExp(expected.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"), expected);
});

test("renders V63 parcel-to-architecture handoff diagnostics", () => {
  const source = fs.readFileSync(new URL("../app/components/ClientTechnicalProjectRoom.tsx", import.meta.url), "utf8");
  for (const expected of [
    "V63 / PARSEL → MİMARİ DEVİR KONTROLÜ",
    "applyHandoff(\"H-01\")",
    "thread.canonical.site.parcelArea",
    "TKGM: kurumsal protokol gerektirir",
  ]) assert.match(source, new RegExp(expected.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"), expected);
});

test("renders V64 architectural performance review", () => {
  const source = fs.readFileSync(new URL("../app/components/ClientTechnicalProjectRoom.tsx", import.meta.url), "utf8");
  for (const expected of [
    "V64 / MİMARİ KARAR PANELİ",
    "daylightCoverage",
    "travelDistance",
    "grossArea",
    "Mimari programı geliştirin",
  ]) assert.match(source, new RegExp(expected.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"), expected);
});

test("renders V65 structural concept review", () => {
  const source = fs.readFileSync(new URL("../app/components/ClientTechnicalProjectRoom.tsx", import.meta.url), "utf8");
  for (const expected of [
    "V65 / TAŞIYICI SİSTEM ÖN KONTROLÜ",
    "factoredGravity",
    "concreteVolume",
    "steelTonnage",
    "reinforcementTonnage",
  ]) assert.match(source, new RegExp(expected.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"), expected);
});

test("renders V66 controlled-demolition safety gate", () => {
  const source = fs.readFileSync(new URL("../app/components/ClientTechnicalProjectRoom.tsx", import.meta.url), "utf8");
  for (const expected of [
    "V66 / KONTROLLÜ YIKIM GÜVENLİK KAPISI",
    "demolition-screening",
    "recommendedMethod",
    "Patlayıcı miktarı",
    "5×5 ön risk matrisi",
  ]) assert.match(source, new RegExp(expected.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"), expected);
});

test("renders V67 discipline clash triage", () => {
  const source = fs.readFileSync(new URL("../app/components/ClientTechnicalProjectRoom.tsx", import.meta.url), "utf8");
  for (const expected of [
    "V67 / DİSİPLİN ÇAKIŞMA RADARI",
    "thread.issues.slice",
    "bearingUtilization",
    "clearHeight",
    "Koordinasyon motorunu açın",
  ]) assert.match(source, new RegExp(expected.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"), expected);
});

test("renders V68 branded delivery quality center", () => {
  const source = fs.readFileSync(new URL("../app/components/ClientTechnicalProjectRoom.tsx", import.meta.url), "utf8");
  for (const expected of [
    "V68 / KURUMSAL TESLİM KALİTE MERKEZİ",
    "PDF / A3",
    "Unicode font",
    "UTF-8 BOM",
    "Gerçek DWG için lisanslı dönüştürücü gerekir",
  ]) assert.match(source, new RegExp(expected.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"), expected);
});

test("renders V69 stakeholder decision register", () => {
  const source = fs.readFileSync(new URL("../app/components/ClientTechnicalProjectRoom.tsx", import.meta.url), "utf8");
  for (const expected of [
    "V69 / PAYDAŞ KARAR DEFTERİ",
    "addDecision",
    "toggleDecision",
    "Müşteri karar kaydı etkin",
    "sunucu tabanlı CDE değildir",
  ]) assert.match(source, new RegExp(expected.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"), expected);
});

test("renders V70 integrated 4D and 5D executive summary", () => {
  const source = fs.readFileSync(new URL("../app/components/ClientTechnicalProjectRoom.tsx", import.meta.url), "utf8");
  for (const expected of [
    "V70 / 4B–5B YÖNETİCİ ÖZETİ",
    "earnedValue.spi",
    "earnedValue.cpi",
    "earnedValue.eac",
    "Temsili Proje OS veri seti",
  ]) assert.match(source, new RegExp(expected.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"), expected);
});

test("renders V71 evidence-bound project assistant", () => {
  const source = fs.readFileSync(new URL("../app/components/ClientTechnicalProjectRoom.tsx", import.meta.url), "utf8");
  for (const expected of [
    "V71 / KANITA BAĞLI PROJE ASİSTANI",
    "Sırada ne var?",
    "Yanıt dayanağı",
    "harici karar servisine veri göndermez",
    "Teknik bilgi bankası",
  ]) assert.match(source, new RegExp(expected.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"), expected);
});

test("renders V72 contextual engineering knowledge routing", () => {
  const source = fs.readFileSync(new URL("../app/components/ClientTechnicalProjectRoom.tsx", import.meta.url), "utf8");
  for (const expected of [
    "V72 / BAĞLAMSAL TEKNİK BİLGİ BANKASI",
    "TBDY 2018",
    "TS 498",
    "ISO 19650",
    "yürürlük durumu",
  ]) assert.match(source, new RegExp(expected.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"), expected);
});

test("renders the V55 integrated project decision and command-map contract", async () => {
  const routes = [
    ["/arkemx", ["ARKEM DİJİTAL MÜHENDİSLİK PLATFORMU", "ORTAK PROJE OMURGASI", "13 PROJE MÜHENDİSLİĞİ MODÜLÜ"]],
    ["/proje-zekasi", ["PROJE KARAR VE VERİ HAZIRLIĞI", "Karar netleşsin", "Kurumsal çıktı", "data-testid=\"project-intelligence\""]],
  ];
  for (const [path, expectedValues] of routes) {
    const response = await render(path);
    assert.equal(response.status, 200, path);
    const html = await response.text();
    for (const expected of expectedValues) assert.match(html, new RegExp(expected, "i"), `${path}: ${expected}`);
  }

  const languageSource = fs.readFileSync(new URL("../app/components/LanguageSystem.tsx", import.meta.url), "utf8");
  assert.match(languageSource, /localeEquivalent/);
  assert.match(languageSource, /v4-language-trigger/);
  assert.match(languageSource, /English/);
  assert.doesNotMatch(languageSource, /localStorage|flags\//);

  const intelligenceSource = fs.readFileSync(new URL("../app/components/ProjectIntelligenceCenter.tsx", import.meta.url), "utf8");
  assert.match(intelligenceSource, /KURUMSAL KARAR DOSYASI/);
  assert.match(intelligenceSource, /Kurumsal PDF karar dosyasını indirin/);

  const stylesheet = fs.readFileSync(new URL("../app/v55.css", import.meta.url), "utf8");
  for (const expected of ["ecosystem-command-map", "project-intelligence", "language-menu-panel"]) {
    assert.match(stylesheet, new RegExp(expected), `V55 style: ${expected}`);
  }
});

test("keeps the V57 enterprise navigation and ARKEMX data spine isolated from legacy styles", () => {
  const commandMapSource = fs.readFileSync(new URL("../app/components/EcosystemCommandMap.tsx", import.meta.url), "utf8");
  for (const expected of ["ecosystem-spine-title", "ecosystem-spine-flow", "Ortak proje veri omurgası"]) {
    assert.match(commandMapSource, new RegExp(expected), `command map: ${expected}`);
  }

  const languageSource = fs.readFileSync(new URL("../app/components/LanguageSystem.tsx", import.meta.url), "utf8");
  for (const expected of ["v4-language-trigger", "localeEquivalent", "routeLocale"]) assert.match(languageSource, new RegExp(expected), `V4 locale routing: ${expected}`);
  assert.doesNotMatch(languageSource, /language-option-flag|language-option-label|language-option-code/);

  const stylesheet = fs.readFileSync(new URL("../app/v57.css", import.meta.url), "utf8");
  for (const expected of [
    "language-switcher.language-menu",
    "ecosystem-command-map > .ecosystem-command-spine",
    "intelligence-page .intelligence-page-copy",
    "site-nav .nav-cta",
  ]) {
    assert.match(stylesheet, new RegExp(expected.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), `V57 style: ${expected}`);
  }
  assert.match(stylesheet, /width:\s*100%\s*!important/);
  assert.match(stylesheet, /grid-template-columns:\s*190px minmax\(0,\s*1fr\) auto\s*!important/);
});

test("keeps the V59 visual system readable, compact and free of legacy kernel clipping", () => {
  const layoutSource = fs.readFileSync(new URL("../app/layout.tsx", import.meta.url), "utf8");
  assert.match(layoutSource, /import "\.\/v59\.css"/);

  const kernelSource = fs.readFileSync(new URL("../app/components/ProjectKernel.tsx", import.meta.url), "utf8");
  for (const expected of ["data-system=\"ARKEM PROJECT KERNEL\"", "Dijital proje merkezi", "Mimari program", "Taşıyıcı ön tasarım"]) {
    assert.match(kernelSource, new RegExp(expected, "i"), `V59 kernel: ${expected}`);
  }

  const stylesheet = fs.readFileSync(new URL("../app/v59.css", import.meta.url), "utf8");
  for (const expected of [
    "project-kernel-bar",
    "project-guided-journey",
    "language-menu-panel",
    "ecosystem-command-stage",
    "floating-contact",
    "overflow-x: clip",
  ]) {
    assert.match(stylesheet, new RegExp(expected), `V59 style: ${expected}`);
  }
  assert.match(stylesheet, /\.kernel-actions\s*\{[^}]*display:\s*grid\s*!important/s);
  assert.match(stylesheet, /\.site-nav::after[\s\S]*content:\s*none\s*!important/s);
});

test("keeps dynamic bilingual labels and the Sketchfab fallback source valid", () => {
  const i18nSource = fs.readFileSync(new URL("../app/data/i18n.ts", import.meta.url), "utf8");
  assert.match(i18nSource, /modules connected/);
  assert.match(i18nSource, /mod\[üÜ\]l/);
  const modelSource = fs.readFileSync(new URL("../app/components/SketchfabModelLibrary.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(modelSource, /sketchfab\.com\/3d-models\/none-/);
  assert.match(modelSource, /sketchfab\.com\/3d-models\/romon-3d-/);
});

test("creates a visible, layered AutoCAD R12 drawing", () => {
  const dxf = createLayeredDxf({
    title: "ARKEM QA PARSEL PAFTASI",
    width: 30,
    depth: 20,
    grid: { baysX: 5, baysY: 4 },
    polylines: [
      { layer: "PARSEL", points: [{ x: 0, y: 0 }, { x: 30, y: 0 }, { x: 30, y: 20 }, { x: 0, y: 20 }] },
      { layer: "ON_YAPI", points: [{ x: 5, y: 4 }, { x: 25, y: 4 }, { x: 25, y: 16 }, { x: 5, y: 16 }] },
    ],
    sheet: {
      projectName: "Arkem QA Projesi",
      projectCode: "ARK-QA-001",
      module: "GEO",
      drawingTitle: "Parsel ve Ön Yapı Yerleşimi",
      drawingNo: "GEO-001",
      revision: "P01",
    },
  });
  assert.ok(dxf.length > 6_000, `DXF unexpectedly short: ${dxf.length}`);
  assert.match(dxf, /\r\nAC1009\r\n/);
  assert.match(dxf, /\r\nPARSEL\r\n/);
  assert.match(dxf, /\r\nON_YAPI\r\n/);
  assert.match(dxf, /\r\nAKS_BALON\r\n/);
  assert.match(dxf, /\r\nPAFTA_YAZI\r\n/);
  assert.match(dxf, /\r\nARKEM_CERCEVE\r\n/);
  assert.match(dxf, /\r\nARKEM_ANTET\r\n/);
  assert.match(dxf, /\r\nARKEM_REVIZYON\r\n/);
  assert.match(dxf, /\r\nARKEM_SANS\r\n/);
  assert.match(dxf, /\r\nARKEM_SANS_BOLD\r\n/);
  assert.match(dxf, /\r\nArial\.ttf\r\n/);
  assert.match(dxf, /\r\nArialbd\.ttf\r\n/);
  assert.match(dxf, /\r\n\$TEXTSTYLE\r\n7\r\nARKEM_SANS\r\n/);
  assert.match(dxf, /\r\nEOF\r\n$/);
});

test("creates a branded, Unicode-safe A3 corporate technical PDF sheet", async () => {
  const pdf = await createCorporateTechnicalPdf({
    projectName: "Arkem QA Projesi",
    projectCode: "ARK-QA-001",
    module: "ARKEMX / GEO",
    drawingTitle: "Parsel ve Ön Yapı Yerleşim Paftası",
    sheetNo: "GEO-001",
    revision: "P01",
    polylines: [
      { role: "secondary", points: [{ x: 0, y: 0 }, { x: 30, y: 0 }, { x: 30, y: 20 }, { x: 0, y: 20 }] },
      { role: "primary", points: [{ x: 5, y: 4 }, { x: 25, y: 4 }, { x: 25, y: 16 }, { x: 5, y: 16 }] },
    ],
    metrics: [["Parsel alanı", "600 m²"], ["Yapı tabanı", "240 m²"]],
    notes: ["Kavramsal karar ve koordinasyon paftasıdır."],
  }, {
    regularFont: fs.readFileSync(new URL("../public/fonts/ArkemSans-Regular.ttf", import.meta.url)),
    boldFont: fs.readFileSync(new URL("../public/fonts/ArkemSans-Bold.ttf", import.meta.url)),
    logo: fs.readFileSync(new URL("../public/brand/arkem-a-mark.png", import.meta.url)),
  });
  assert.ok(pdf.length > 30_000, `PDF unexpectedly short: ${pdf.length}`);
  assert.match(Buffer.from(pdf.subarray(0, 16)).toString("latin1"), /^%PDF-1\.[4-7]/);
  const parsed = await PDFDocument.load(pdf);
  assert.equal(parsed.getPageCount(), 1);
  const size = parsed.getPage(0).getSize();
  assert.ok(Math.abs(size.width - 1190.55) < .1);
  assert.ok(Math.abs(size.height - 841.89) < .1);
  assert.equal(parsed.getAuthor(), "Arkem Yapı Sistemleri");
  assert.equal(parsed.getTitle(), "ARK-QA-001 - Parsel ve Ön Yapı Yerleşim Paftası");
});

test("moves the first TKGM parcel response directly into the visible map stage", () => {
  const source = fs.readFileSync(new URL("../app/components/GeoParcelStudio.tsx", import.meta.url), "utf8");
  assert.match(source, /const nextParcel = points\.slice\(0, 400\)/);
  assert.match(source, /setParcel\(nextParcel\)/);
  assert.match(source, /fitMapToPoints\(nextParcel, 120\)/);
  assert.doesNotMatch(source, /setTimeout\(fitToParcel,\s*120\)/);
});

test("V73 exposes a truthful digital building passport and twin-readiness matrix", () => {
  const source = fs.readFileSync(new URL("../app/components/ClientTechnicalProjectRoom.tsx", import.meta.url), "utf8");
  for (const expected of [
    "V73 / DİJİTAL YAPI PASAPORTU & İKİZ HAZIRLIĞI",
    "DİJİTAL İKİZ OLGUNLUK KAPILARI",
    "As-built BIM / IFC",
    "Sensör / IoT",
    "BMS / enerji",
    "Canlı sensör, BMS ve enerji verisi olmadan",
  ]) {
    assert.match(source, new RegExp(expected.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"), `V73 portal: ${expected}`);
  }
  const stylesheet = fs.readFileSync(new URL("../app/v60.css", import.meta.url), "utf8");
  assert.match(stylesheet, /\.twin-readiness\s*\{/);
  assert.match(stylesheet, /\.twin-readiness article\.ready/);
});

test("V74 renders a secure XR and seven-language project review room", () => {
  const source = fs.readFileSync(new URL("../app/components/ClientTechnicalProjectRoom.tsx", import.meta.url), "utf8");
  for (const expected of [
    "V74 / XR & ULUSLARARASI PROJE İNCELEME ODASI",
    "Masaüstü 3B",
    "VR gözlük",
    "AR yerleştirme",
    "Azərbaycan dili",
    "ARKEM-XR-REVIEW/1.0",
    "uyumlu cihaz, yayınlanmış model ve rol tabanlı erişim",
  ]) {
    assert.match(source, new RegExp(expected.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"), `V74 review room: ${expected}`);
  }
  const stylesheet = fs.readFileSync(new URL("../app/v60.css", import.meta.url), "utf8");
  assert.match(stylesheet, /\.xr-review-room\s*\{/);
  assert.match(stylesheet, /\.xr-controls\s*\{/);
  assert.match(stylesheet, /\.xr-workflow\s*\{/);
});

test("V75 renders an evidence-based investment-readiness dossier", () => {
  const source = fs.readFileSync(new URL("../app/components/ClientTechnicalProjectRoom.tsx", import.meta.url), "utf8");
  for (const expected of [
    "V75 / YATIRIM KARARI & TEKNİK GÖRÜŞME DOSYASI",
    "ARKEM-PROJECT-READINESS/1.0",
    "Proje verisi",
    "Mühendislik kanıtı",
    "Karar yetkisi",
    "Dijital teslim",
    "Karar desteği, resmi onay değil",
  ]) {
    assert.match(source, new RegExp(expected.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"), `V75 dossier: ${expected}`);
  }
  assert.equal((source.match(/view === "deliverables"/g) || []).length, 1, "the delivery view must not render twice");
  const stylesheet = fs.readFileSync(new URL("../app/v60.css", import.meta.url), "utf8");
  assert.match(stylesheet, /\.readiness-dossier\s*\{/);
  assert.match(stylesheet, /\.readiness-pillars\s*\{/);
  assert.match(stylesheet, /\.readiness-actions\s*\{/);
});

test("V76 applies cross-site visual containment and mobile guardrails", () => {
  const layout = fs.readFileSync(new URL("../app/layout.tsx", import.meta.url), "utf8");
  assert.match(layout, /import "\.\/v76\.css"/);
  const stylesheet = fs.readFileSync(new URL("../app/v76.css", import.meta.url), "utf8");
  for (const expected of [
    "overflow-x: clip",
    "--arkem-page-gutter",
    "max-height: calc(100dvh - 112px)",
    "grid-template-columns: minmax(180px, 1fr)",
    "@media (max-width: 760px)",
    "prefers-reduced-motion",
  ]) {
    assert.match(stylesheet, new RegExp(expected.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"), `V76 style: ${expected}`);
  }
});

test("V77 centralizes the corporate component design system", () => {
  const layout = fs.readFileSync(new URL("../app/layout.tsx", import.meta.url), "utf8");
  assert.match(layout, /import "\.\/v77\.css"/);
  const stylesheet = fs.readFileSync(new URL("../app/v77.css", import.meta.url), "utf8");
  for (const expected of [
    "--arkem-section-space",
    "--arkem-accent-strong",
    "[role=\"tablist\"]",
    "font-variant-numeric: tabular-nums",
    ".status-chip",
    "@media (hover: hover)",
  ]) {
    assert.match(stylesheet, new RegExp(expected.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"), `V77 style: ${expected}`);
  }
});

test("V4 keeps real locale routing and the portal mobile drawer accessible", () => {
  const language = [
    fs.readFileSync(new URL("../app/components/LanguageSystem.tsx", import.meta.url), "utf8"),
    fs.readFileSync(new URL("../app/data/locale-routes.ts", import.meta.url), "utf8"),
  ].join("\n");
  assert.match(language, /v4-language-trigger/);
  assert.match(language, /\/en\/projects/);
  assert.doesNotMatch(language, /localStorage|flags\//);
  const chrome = fs.readFileSync(new URL("../app/components/SiteChrome.tsx", import.meta.url), "utf8");
  assert.match(chrome, /createPortal/);
  assert.match(chrome, /role="dialog" aria-modal="true"/);
  assert.match(chrome, /Mobil navigasyon/);
  assert.match(chrome, /closeOnEscape/);
  assert.match(chrome, /closeButton\.current\?\.focus/);
  const stylesheet = fs.readFileSync(new URL("../app/v78.css", import.meta.url), "utf8");
  assert.match(stylesheet, /:focus-visible/);
  assert.match(stylesheet, /@media \(forced-colors: active\)/);
});

test("V79 applies a bounded rendering and media performance budget", () => {
  const chrome = fs.readFileSync(new URL("../app/components/SiteChrome.tsx", import.meta.url), "utf8");
  assert.match(chrome, /fetchPriority=\{footer \? "auto" : "high"\}/);
  assert.match(chrome, /loading=\{footer \? "lazy" : "eager"\}/);
  const language = [
    fs.readFileSync(new URL("../app/components/LanguageSystem.tsx", import.meta.url), "utf8"),
    fs.readFileSync(new URL("../app/data/locale-routes.ts", import.meta.url), "utf8"),
  ].join("\n");
  assert.doesNotMatch(language, /<img|flags\//);
  assert.match(language, /v4-language-trigger/);
  const stylesheet = fs.readFileSync(new URL("../app/v79.css", import.meta.url), "utf8");
  assert.match(stylesheet, /content-visibility: auto/);
  assert.match(stylesheet, /contain-intrinsic-size: auto 820px/);
  assert.match(stylesheet, /prefers-reduced-data: reduce/);
});

test("V80 stores projects in a checksummed local vault with backup recovery", () => {
  const storage = fs.readFileSync(new URL("../app/lib/project-storage.ts", import.meta.url), "utf8");
  for (const expected of [
    "ARKEM-STORAGE/2.0",
    "PROJECT_BACKUP_KEY",
    "hashText",
    "source: \"backup\"",
    "saveProjectToStorage",
  ]) assert.match(storage, new RegExp(expected.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  const kernel = fs.readFileSync(new URL("../app/components/ProjectKernel.tsx", import.meta.url), "utf8");
  assert.match(kernel, /loadProjectFromStorage/);
  assert.match(kernel, /Bulut bağlantısı bekliyor/);
  assert.match(kernel, /Yedekten kurtarıldı/);
});

test("V81 records GIS provenance and never disguises credential-bound connectors", () => {
  const integration = fs.readFileSync(new URL("../app/lib/geo-integration.ts", import.meta.url), "utf8");
  for (const expected of [
    "ARKEM-GEO-PROVENANCE/1.0",
    "protocol-required",
    "credential-required",
    "officialCadastre: false",
    "Tapu/kadastro kaydı değildir",
  ]) assert.match(integration, new RegExp(expected.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  const studio = fs.readFileSync(new URL("../app/components/GeoParcelStudio.tsx", import.meta.url), "utf8");
  assert.match(studio, /V81 \/ VERİ KAYNAĞI HARİTASI/);
  assert.match(studio, /ARKEM-GEO-MANIFEST\/2\.0/);
  assert.match(studio, /createGeoProvenance/);
});

test("V82 adds contour geometry and a bounded terrain performance screen", () => {
  const analysis = fs.readFileSync(new URL("../app/lib/terrain-analysis.ts", import.meta.url), "utf8");
  for (const expected of [
    "ARKEM-TERRAIN-SCREEN/1.0",
    "buildingLevelDifference",
    "indicativeEarthwork",
    "conceptual",
  ]) assert.match(analysis, new RegExp(expected));
  const viewer = fs.readFileSync(new URL("../app/components/GeoTerrainViewer.tsx", import.meta.url), "utf8");
  assert.match(viewer, /V82 \/ ARAZİ PERFORMANS TARAMASI/);
  assert.match(viewer, /Kavramsal gösterge · zemin etüdü ve plankote değildir/);
  assert.match(viewer, /createTerrainContours/);
  assert.match(viewer, /THREE\.LineSegments/);
});

test("V83 compares architectural strategies and exposes an adjacency matrix", () => {
  const studio = fs.readFileSync(new URL("../app/components/ArchitecturalProgramStudio.tsx", import.meta.url), "utf8");
  for (const expected of [
    "ARKEM-ARCH-PROGRAM/2.0",
    "V83 / MİMARİ KARAR MATRİSİ",
    "Kompakt çekirdek",
    "Günışığı odaklı",
    "architect-adjacency-matrix",
    "Matris ilk 8 mahal türünü gösterir",
  ]) assert.match(studio, new RegExp(expected.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
});

test("V84 compares four structural concepts without claiming a certified design", () => {
  const alternatives = fs.readFileSync(new URL("../app/lib/structural-alternatives.ts", import.meta.url), "utf8");
  assert.match(alternatives, /"concrete", "steel", "light", "hybrid"/);
  assert.match(alternatives, /embodiedCarbonProxy/);
  const designer = fs.readFileSync(new URL("../app/components/StructuralDesigner.tsx", import.meta.url), "utf8");
  for (const expected of [
    "ARKEM-STRUCTURAL-CONCEPT/2.0",
    "V84 / TAŞIYICI SİSTEM KARŞILAŞTIRMASI",
    "Ön eleme · nihai sistem kararı değildir",
    "sertifikalı LCA sonucu değildir",
  ]) assert.match(designer, new RegExp(expected.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
});

test("V85 exports traceable MEP coordination issues without claiming native BCF", () => {
  const pack = fs.readFileSync(new URL("../app/lib/coordination-package.ts", import.meta.url), "utf8");
  for (const expected of ["ARKEM-COORDINATION/2.0", "BCF-compatible issue manifest", "nativeBcfZip: false", "HVAC", "Fire"]) {
    assert.match(pack, new RegExp(expected.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  const studio = fs.readFileSync(new URL("../app/components/EngineeringCoordinationStudio.tsx", import.meta.url), "utf8");
  assert.match(studio, /createCoordinationPackage/);
  assert.match(studio, /ARKEM-COORDINATION\/2\.0/);
});

test("V86 rejects empty or contextless technical delivery files", () => {
  const validator = fs.readFileSync(new URL("../app/lib/delivery-package.ts", import.meta.url), "utf8");
  for (const expected of ["ARKEM-DELIVERY-PACKAGE/2.0", "Dosya boş veya henüz üretilmedi", "Koordinat referansı eksik", "nativeDwgRequiresLicensedConverter"]) {
    assert.match(validator, new RegExp(expected.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  const portal = fs.readFileSync(new URL("../app/components/ClientTechnicalProjectRoom.tsx", import.meta.url), "utf8");
  assert.match(portal, /V86 \/ DOSYA DOĞRULAMA ZİNCİRİ/);
});

test("V87 gives every corporate PDF a deterministic document identity", () => {
  const identity = fs.readFileSync(new URL("../app/lib/document-identity.ts", import.meta.url), "utf8");
  assert.match(identity, /ARKEM-DOCUMENT-IDENTITY\/2\.0/);
  assert.match(identity, /documentFingerprint/);
  const sheet = fs.readFileSync(new URL("../app/lib/technical-sheet.ts", import.meta.url), "utf8");
  assert.match(sheet, /createDocumentIdentity/);
  assert.match(sheet, /ARKEM-TS \/ 3\.0/);
  assert.match(sheet, /identity\.reference/);
});

test("V88 preserves a truthful device-local collaboration audit", () => {
  const audit = fs.readFileSync(new URL("../app/lib/collaboration-audit.ts", import.meta.url), "utf8");
  for (const expected of ["ARKEM-COLLABORATION-AUDIT/1.0", "device-local", "cloudCdeConnected: false", "traceable"]) {
    assert.match(audit, new RegExp(expected.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  const portal = fs.readFileSync(new URL("../app/components/ClientTechnicalProjectRoom.tsx", import.meta.url), "utf8");
  assert.match(portal, /createCollaborationAudit/);
  assert.match(portal, /ARKEM-DELIVERY\/2\.0/);
});

test("V89 expands full-site discovery across all seven supported languages", () => {
  const search = fs.readFileSync(new URL("../app/lib/multilingual-search.ts", import.meta.url), "utf8");
  for (const expected of ["SEARCH_LANGUAGES", "\"tr\", \"en\", \"az\", \"ru\", \"it\", \"de\", \"fr\"", "участок", "architettura", "grundstück"]) {
    assert.match(search, new RegExp(expected.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  const experience = fs.readFileSync(new URL("../app/components/PremiumExperience.tsx", import.meta.url), "utf8");
  assert.match(experience, /expandMultilingualQuery/);
  assert.match(experience, /indexedRecords/);
});

test("V90 exposes a secret-free health contract and explicit integration boundaries", () => {
  const security = fs.readFileSync(new URL("../app/lib/integration-security.ts", import.meta.url), "utf8");
  for (const expected of ["ARKEM-INTEGRATION-SECURITY/1.0", "secretsInClientBundle: false", "externalWritesWithoutConsent: false", "protocol-required", "credential-required"]) {
    assert.match(security, new RegExp(expected.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  const health = fs.readFileSync(new URL("../app/api/health/route.ts", import.meta.url), "utf8");
  assert.match(health, /release: "V90"/);
  assert.match(health, /Cache-Control/);
  assert.match(health, /Permissions-Policy/);
});

test("V91 connects mobile guardrails to parcel-based zoning provenance", () => {
  const zoning = fs.readFileSync(new URL("../app/lib/zoning.ts", import.meta.url), "utf8");
  for (const expected of [
    "ARKEM-ZONING-PROVENANCE/1.0",
    "e-Plan Otomasyon",
    "Ulusal Coğrafi Bilgi Platformu",
    "certified-document",
    "buildingOrder",
  ]) assert.match(zoning, new RegExp(expected.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  const studio = fs.readFileSync(new URL("../app/components/GeoParcelStudio.tsx", import.meta.url), "utf8");
  assert.match(studio, /04 \/ PARSEL BAZLI İMAR/);
  assert.match(studio, /TAKS · KAKS · Hmax · nizam/);
  assert.match(studio, /createZoningProvenance/);
  const mobile = fs.readFileSync(new URL("../app/v91.css", import.meta.url), "utf8");
  assert.match(mobile, /font-size:16px!important/);
  assert.match(mobile, /viewport-inset-bottom|safe-area-inset-bottom/);
  assert.match(mobile, /\.geo-workspace\{display:grid!important;grid-template-columns:1fr!important\}/);
});

test("V92 corrects the Diyanet reference and adds a durable authenticated customer workspace", async () => {
  const references = fs.readFileSync(new URL("../app/data/references.ts", import.meta.url), "utf8");
  assert.match(references, /DİYANET Taşıyıcı Sistem Modeli/);
  assert.doesNotMatch(references, /title: "DİYAMET/);
  const api = fs.readFileSync(new URL("../app/api/customer-workspace/route.ts", import.meta.url), "utf8");
  for (const expected of ["customer_projects", "customer_meetings", "getArkemAccountUser", "owner_email = ?"]) assert.match(api, new RegExp(expected));
  const response = await render("/giris?return_to=%2Fbim-koordinasyon");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /ARKEMX’e giriş/);
  assert.match(html, /Güvenli giriş yap/);
  assert.match(html, /action="\/hesap-baglantisi"/);
  assert.match(html, /name="return_to" value="\/bim-koordinasyon"/);
  assert.match(html, /href="\/hesap-kurulum\?return_to=%2Fbim-koordinasyon&amp;entry=first-use"/);
  assert.doesNotMatch(html, /ChatGPT/i);
  assert.doesNotMatch(html, /class="v4-mobile-site-header/);

  const authBridge = fs.readFileSync(new URL("../app/hesap-baglantisi/route.ts", import.meta.url), "utf8");
  assert.match(authBridge, /returnTargetFromReferer/);
  assert.match(authBridge, /setupReturn/);
  const authSource = fs.readFileSync(new URL("../app/chatgpt-auth.ts", import.meta.url), "utf8");
  assert.match(authSource, /accountReturnPath/);
  assert.match(authSource, /fallback = "\/dijital-proje-merkezi"/);
  const sessionRoute = fs.readFileSync(new URL("../app/api/account-session/route.ts", import.meta.url), "utf8");
  assert.match(sessionRoute, /getArkemAccountSession/);
  assert.match(sessionRoute, /identitySource:\s*session\.identitySource/);
  assert.doesNotMatch(sessionRoute, /cloudflare:workers|customer_profiles|env\.DB/);

  assert.match(authSource, /ARKEMX_PROTOTYPE_DEMO_AUTH/);
  assert.match(authSource, /prototype-demo/);
  assert.match(authSource, /arkemx_prototype_session/);

  const demoExit = fs.readFileSync(new URL("../app/demo-cikis/route.ts", import.meta.url), "utf8");
  assert.match(demoExit, /Max-Age=0/);
  const setupGate = fs.readFileSync(new URL("../app/components/AccountSetupGate.tsx", import.meta.url), "utf8");
  assert.match(setupGate, /body\.profile/);
  assert.match(setupGate, /showExistingAccountChoice/);
  assert.match(setupGate, /Hesabınız zaten kurulu/);
  assert.match(setupGate, /Hesabımı aç/);
  assert.match(setupGate, /Aktif projeye devam et/);
  assert.match(setupGate, /hasActiveProject/);
  assert.match(setupGate, /Object\.keys\(project\.modules\)\.length > 0/);
  assert.doesNotMatch(setupGate, /Proje Çalışma Alanıne devam et/);
  assert.match(setupGate, /window\.location\.replace\(returnTo\)/);
  const projectCenter = fs.readFileSync(new URL("../app/components/SimpleProjectCenter.tsx", import.meta.url), "utf8");
  assert.match(projectCenter, /Aktif projeyi sil/);
  assert.match(projectCenter, /Bu tarayıcıdaki çalışma kaydını sil/);
  assert.match(projectCenter, /Projeyi her yerden sil/);
  assert.match(projectCenter, /clearLocalProject\(\)/);
  assert.match(projectCenter, /Hesabınıza kaydedilmiş proje etkilenmez/);
  assert.match(projectCenter, /Hem bu tarayıcıdaki çalışma hem de hesabınızdaki proje kaydı silinir/);
  assert.match(projectCenter, /resource=project/);
  const storageSource = fs.readFileSync(new URL("../app/lib/project-storage.ts", import.meta.url), "utf8");
  assert.match(storageSource, /clearProjectStorage/);
  assert.match(storageSource, /PROJECT_STORAGE_KEY/);
  assert.match(storageSource, /PROJECT_BACKUP_KEY/);
  assert.match(storageSource, /removeItem/);

  const projectCenterPageSource = fs.readFileSync(new URL("../app/dijital-proje-merkezi/page.tsx", import.meta.url), "utf8");
  assert.match(projectCenterPageSource, /AccountHeaderLink/);
  const accountHeaderLink = fs.readFileSync(new URL("../app/components/AccountHeaderLink.tsx", import.meta.url), "utf8");
  assert.match(accountHeaderLink, /getArkemAccountUser/);
  assert.match(accountHeaderLink, /user \? "\/hesabim" : "\/giris\?return_to=%2Fhesabim"/);

  const accountSettings = fs.readFileSync(new URL("../app/components/ClientAccountSettings.tsx", import.meta.url), "utf8");
  assert.match(accountSettings, /Görüşmeler ve İşlem Geçmişi/);
  assert.match(accountSettings, /summarizeActivities/);
  assert.match(accountSettings, /hasActiveProject = Object\.keys\(project\.modules\)\.length > 0/);
  assert.match(accountSettings, /hasActiveProject \? project\.revision : "—"/);
  assert.match(accountSettings, /hasActiveProject \? `%\$\{thread\.metrics\.readiness\}` : "—"/);
  assert.match(accountSettings, /normalized\.eventType === "project" \|\| normalized\.eventType === "profile"/);
  assert.match(accountSettings, /previous\.title === normalized\.title/);
  assert.match(accountSettings, /kez güncellendi/);
  assert.match(accountSettings, /Proje hesaba kaydedildi/);
  assert.doesNotMatch(accountSettings, /Henüz buluta kaydedilmiş proje yok/);
  const workspaceWrite = fs.readFileSync(new URL("../app/lib/customer-workspace-write.ts", import.meta.url), "utf8");
  assert.match(workspaceWrite, /Proje hesaba kaydedildi/);
  assert.doesNotMatch(workspaceWrite, /Proje buluta kaydedildi/);

  const focusedAccount = fs.readFileSync(new URL("../app/hesabim/page.tsx", import.meta.url), "utf8");
  assert.match(focusedAccount, /ClientAccountSettings[\s\S]*simple/);
  assert.match(focusedAccount, /Oturum gerekli/);
  assert.match(focusedAccount, /href="\/giris\?return_to=%2Fhesabim"/);
});

test("V93 routes every province through an explicit zoning authority chain", async () => {
  const source = fs.readFileSync(new URL("../app/data/zoning-authorities.ts", import.meta.url), "utf8");
  assert.match(source, /ZONING_AUTHORITY_ROUTES/);
  assert.match(source, /TAKS, KAKS\/emsal, Hmax\/Yençok ve nizam/);
  const response = await render("/imar-entegrasyon-merkezi");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /İMAR ÇALIŞMA ALANI/);
  assert.match(html, /Parsel kimliğini projeye kaydet/);
  assert.match(html, /Kesintiye dayanıklı seçim açık/);
  assert.match(html, /e-Plan/);
});

test("V94 extracts zoning conditions with evidence and an explicit human-review boundary", () => {
  const parser = fs.readFileSync(new URL("../app/lib/zoning-document-parser.ts", import.meta.url), "utf8");
  for (const expected of ["ARKEM-ZONING-DOCUMENT/1.0", "TAKS", "KAKS / Emsal", "Hmax / Yençok", "requiresHumanReview: true"]) assert.match(parser, new RegExp(expected.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  const center = fs.readFileSync(new URL("../app/components/ZoningIntegrationCenter.tsx", import.meta.url), "utf8");
  assert.match(center, /BELGE DESTEKLİ GİRİŞ/);
  assert.match(center, /Koşulları tara/);
});

test("V95 evaluates zoning limits while retaining special-plan review", () => {
  const rules = fs.readFileSync(new URL("../app/lib/zoning-rule-engine.ts", import.meta.url), "utf8");
  for (const expected of ["ARKEM-ZONING-RULES/1.0", "allowedFootprint", "allowedGrossArea", "Köşe parsel", "erken ön kontroldür"]) assert.match(rules, new RegExp(expected));
});

test("V96 creates a bounded 3D zoning envelope from TAKS KAKS Hmax and setbacks", () => {
  const source = fs.readFileSync(new URL("../app/lib/zoning-envelope.ts", import.meta.url), "utf8");
  for (const expected of ["ARKEM-ZONING-ENVELOPE/1.0", "buildableWidth", "setbackFootprint", "typicalFloorHeight", "Kavramsal 3B yapı zarfıdır"]) assert.match(source, new RegExp(expected));
});

test("V97 distinguishes road frontage and corner parcel decisions", () => {
  const source = fs.readFileSync(new URL("../app/lib/parcel-edge-analysis.ts", import.meta.url), "utf8");
  for (const expected of ["ARKEM-PARCEL-EDGE/1.0", "cornerParcel", "primaryRoad", "yol cephesi", "aplikasyon"]) assert.match(source, new RegExp(expected, "i"));
});

test("V98 hands zoning identity and envelope to four downstream disciplines", () => {
  const source = fs.readFileSync(new URL("../app/lib/zoning-handoff.ts", import.meta.url), "utf8");
  for (const expected of ["ARKEM-ZONING-HANDOFF/1.0", "Mimari Program", "Taşıyıcı Ön Tasarım", "Koordinasyon", "Proje OS"]) assert.match(source, new RegExp(expected));
  const center = fs.readFileSync(new URL("../app/components/ZoningIntegrationCenter.tsx", import.meta.url), "utf8");
  assert.match(center, /patchModule\("zoning-integration"/);
});

test("V99 produces a branded zoning report index plus PDF and layered DXF actions", () => {
  const report = fs.readFileSync(new URL("../app/lib/zoning-report.ts", import.meta.url), "utf8");
  for (const expected of ["ARKEM-ZONING-REPORT/1.0", "IMR-001", "PDF", "DXF", "JSON"]) assert.match(report, new RegExp(expected));
  const center = fs.readFileSync(new URL("../app/components/ZoningIntegrationCenter.tsx", import.meta.url), "utf8");
  assert.match(center, /createCorporateTechnicalPdf/);
  assert.match(center, /createLayeredDxf/);
});

test("V100 closes mobile QA and reports the complete customer-to-delivery chain", () => {
  const mobile = fs.readFileSync(new URL("../app/lib/mobile-quality.ts", import.meta.url), "utf8");
  for (const expected of [
    "ARKEM-MOBILE-QUALITY/1.0",
    "320, 360, 390, 430, 768",
    "minimumTouchTarget: 44",
    "Customer identity",
    "Corporate PDF, DXF and JSON delivery",
  ]) assert.match(mobile, new RegExp(expected.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  const css = fs.readFileSync(new URL("../app/v100.css", import.meta.url), "utf8");
  assert.match(css, /font-size:16px!important/);
  assert.match(css, /prefers-reduced-motion:reduce/);
  assert.match(css, /\.zic-coverage>div/);
  const health = fs.readFileSync(new URL("../app/api/health/route.ts", import.meta.url), "utf8");
  assert.match(health, /release: "V116"/);
  assert.match(health, /customerWorkspace: "authenticated-durable"/);
});

test("V101 replaces the hardcoded zoning showcase with live project inputs and branded account routes", async () => {
  const center = fs.readFileSync(new URL("../app/components/ZoningIntegrationCenter.tsx", import.meta.url), "utf8");
  for (const expected of [
    'fetchTkgm("idariYapi/ilListe")',
    "Parseli bul ve projeye al",
    "requestedFootprint",
    "zoning.taks",
    'patchModule("geo-parcel"',
    'patchModule("zoning-integration"',
  ]) assert.match(center, new RegExp(expected.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.doesNotMatch(center, /evaluateZoningRules\(\{\s*parcelArea:\s*1000/);
  const stylesheet = fs.readFileSync(new URL("../app/v101.css", import.meta.url), "utf8");
  for (const expected of [".zoning-workbench", ".account-shell", "overflow-x:clip!important", "@media(max-width:520px)"]) assert.match(stylesheet, new RegExp(expected.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  for (const path of ["/giris", "/hesap-kurulum", "/imar-entegrasyon-merkezi"]) {
    const response = await render(path);
    assert.equal(response.status, 200, path);
    const html = await response.text();
    assert.doesNotMatch(html, /ChatGPT/i, path);
  }
});

test("V102 keeps navigation on one row and discovers the parcel zoning evidence chain automatically", () => {
  const stylesheet = fs.readFileSync(new URL("../app/v102.css", import.meta.url), "utf8");
  for (const expected of [
    "grid-template-columns:minmax(190px,1fr) auto auto auto auto auto!important",
    ".site-nav>.nav-cta{grid-column:6!important",
    ".mobile-menu>.mobile-menu-panel",
    ".zoning-auto-discovery",
    "@media(max-width:560px)",
  ]) assert.match(stylesheet, new RegExp(expected.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));

  const center = fs.readFileSync(new URL("../app/components/ZoningIntegrationCenter.tsx", import.meta.url), "utf8");
  for (const expected of [
    "OTOMATİK İMAR DURUMU BULUCU",
    "resolveZoningPortal",
    "Parselin imar kanıt zinciri hazır.",
    "Açık servis sunulmayan belediyelerde yapılaşma hakkı tahmin edilmez.",
    "hasVerifiedConditions",
  ]) assert.match(center, new RegExp(expected.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));

  const authorities = fs.readFileSync(new URL("../app/data/zoning-authorities.ts", import.meta.url), "utf8");
  assert.match(authorities, /VERIFIED_ZONING_PORTALS/);
  assert.match(authorities, /https:\/\/keos\.serdivan\.bel\.tr\/imardurumu\//);
  assert.match(authorities, /https:\/\/eplan\.ibb\.istanbul\/sorgu\//);
});

test("V4 isolates the layered mobile navigation in a viewport-rooted accessible drawer", async () => {
  const stylesheet = ["../app/v32-acceptance.css", "../app/v37-corporate.css", "../app/v4.css"]
    .map((file) => fs.readFileSync(new URL(file, import.meta.url), "utf8"))
    .join("\n");
  for (const expected of [
    ".v4-mobile-nav-root",
    "position: fixed",
    ".v4-mobile-nav",
    ".v4-mobile-nav-groups",
    ".v4-mobile-project-cta",
  ]) assert.match(stylesheet, new RegExp(expected.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));

  const chrome = fs.readFileSync(new URL("../app/components/SiteChrome.tsx", import.meta.url), "utf8");
  assert.match(chrome, /createPortal/);
  assert.doesNotMatch(chrome, /useSyncExternalStore/);
  assert.match(chrome, /className="v4-mobile-nav-trigger"/);
  assert.match(chrome, /className="v4-mobile-nav"/);
  assert.match(chrome, /openMobileGroup === item\.label/);
  assert.doesNotMatch(chrome, /<details className="mobile-menu"/);

  // Corporate routes keep the corporate header; the focused sign-in entry does not.
  const response = await render("/arkem");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /class="v4-mobile-nav-trigger"/);
  assert.match(html, /aria-expanded="false"/);
  assert.doesNotMatch(html, /class="v4-language-static"|id="v4-language-menu"/);
  assert.doesNotMatch(html, /hrefLang="en-US"/);
});

test("V117 keeps five customer-first navigation destinations explicit", () => {
  const siteData = fs.readFileSync(new URL("../app/data/site.ts", import.meta.url), "utf8");
  for (const title of ["HİZMETLER", "DİJİTAL ARAÇLAR", "PROJELER", "ARKEM", "İLETİŞİM"]) {
    assert.match(siteData, new RegExp(`label: "${title}"`), title);
  }
  assert.doesNotMatch(siteData.match(/export const mainNavigation[\s\S]*?as const;/)?.[0] ?? "", /YAPI SİSTEMLERİ|MÜHENDİSLİK|ARKEMX/);
  assert.match(siteData.match(/export const mainNavigation[\s\S]*?as const;/)?.[0] ?? "", /İLETİŞİM/);

  const chrome = fs.readFileSync(new URL("../app/components/SiteChrome.tsx", import.meta.url), "utf8");
  assert.match(chrome, /navigationTree\.map/);
  assert.match(chrome, /YENİ PROJE BAŞLAT/i);
  assert.match(chrome, /PROJEME DEVAM ET/i);
});

test("V103 keeps the full design studio out of the V2.1 homepage", async () => {
  const home = [
    fs.readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8"),
    fs.readFileSync(new URL("../app/components/HomeV4.tsx", import.meta.url), "utf8"),
    fs.readFileSync(new URL("../app/components/HeroProjectStage.tsx", import.meta.url), "utf8"),
  ].join("\n");
  assert.doesNotMatch(home, /<StructuralDesignerPreview\/>/);
  assert.doesNotMatch(home, /<StructuralDesigner home/);
  assert.match(home, /\/muhendislik/);
  assert.match(home, /heroProject/);

  const preview = fs.readFileSync(new URL("../app/components/StructuralDesignerPreview.tsx", import.meta.url), "utf8");
  for (const expected of [
    "aria-pressed={systemId === item.id}",
    'src="/visuals/arkem-x-design-v2.webp"',
    "Ayrıntılı taşıyıcı stüdyosunu açın",
  ]) assert.match(preview, new RegExp(expected.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));

  const response = await render("/");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /<h1 id="arx-tools-title">Araçlar<\/h1>/);
  assert.match(html, /href="\/plan-ve-aks"/);
  assert.match(html, /href="\/tasiyici-on-tasarim"/);
  assert.doesNotMatch(html, /class="design-studio-hero"/);
});

test("V105 applies one readable responsive design contract across shared surfaces", () => {
  const layout = fs.readFileSync(new URL("../app/layout.tsx", import.meta.url), "utf8");
  assert.match(layout, /import "\.\/v105\.css";/);

  const stylesheet = fs.readFileSync(new URL("../app/v105.css", import.meta.url), "utf8");
  for (const expected of [
    "--v105-control-height: 46px",
    ".project-guided-journey",
    "grid-template-columns: repeat(7, minmax(154px, 1fr))",
    ".arkem-mobile-nav-panel",
    ".language-menu-panel",
    "width: 312px",
    ".geo-workspace",
    "font-size: 16px",
    ".client-portal",
    ".resource-library-v2",
    "grid-template-columns: repeat(3, minmax(0, 1fr))",
    "grid-template-columns: repeat(4, minmax(54px, 1fr))",
    "@media (max-width: 760px)",
    "@media (prefers-reduced-motion: reduce)",
  ]) {
    assert.match(
      stylesheet,
      new RegExp(expected.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
      expected,
    );
  }

  assert.doesNotMatch(stylesheet, /font-size:\s*[0-8]px\b/);
  const braces = [...stylesheet.replace(/\/\*[\s\S]*?\*\//g, "")]
    .reduce((depth, token) => depth + (token === "{" ? 1 : token === "}" ? -1 : 0), 0);
  assert.equal(braces, 0);
});

test("V106 gives every module one traceable project core and source-aware field registry", async () => {
  const response = await render("/dijital-proje-merkezi");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /data-testid="digital-project-hub"/);
  assert.match(html, /Proje kontrol özeti/);
  assert.match(html, /Proje adımları/);

  const core = fs.readFileSync(new URL("../app/lib/project-core.ts", import.meta.url), "utf8");
  for (const expected of [
    "ARKEM-PROJECT-CORE/1.0",
    "verified",
    "declared",
    "derived",
    "missing",
    "deriveProjectCore",
    "projectId",
    "projectRevision",
  ]) assert.match(core, new RegExp(expected));

  const kernel = fs.readFileSync(new URL("../app/components/ProjectKernel.tsx", import.meta.url), "utf8");
  assert.match(kernel, /stampProjectModule/);
  assert.match(kernel, /core: ProjectCoreSnapshot/);

  const layout = fs.readFileSync(new URL("../app/layout.tsx", import.meta.url), "utf8");
  assert.match(layout, /import "\.\/v106\.css";/);

  const health = fs.readFileSync(new URL("../app/api/health/route.ts", import.meta.url), "utf8");
  assert.match(health, /release: "V116"/);
  assert.match(health, /fieldLevelProvenance/);
});

test("V106 classifies project fields and stamps module writes without losing payload", () => {
  const timestamp = "2026-07-28T12:00:00.000Z";
  const modules = {
    "geo-parcel": stampProjectModule({
      reference: "Sakarya / Serdivan / 115 / 46",
      province: "Sakarya",
      district: "Serdivan",
      block: "115",
      parcelNo: "46",
      parcel: [{ lat: 40.1, lng: 30.2 }, { lat: 40.1, lng: 30.3 }, { lat: 40.2, lng: 30.3 }],
      metrics: { area: 2400, geometryValid: true },
      dataStatus: "TKGM MEGSİS geometrisi bulundu · tapu/ruhsat belgesi değildir",
    }, {
      projectId: "ARK-26-TEST",
      projectRevision: "P02",
      sourceModule: "geo-parcel",
      recordedAt: timestamp,
      action: "updated",
    }),
    "architectural-program": {
      input: { use: "industrial", targetGross: 1800, floors: 2, floorHeight: 5.5 },
      result: { grossDemand: 1840 },
    },
  };
  const project = {
    id: "ARK-26-TEST",
    name: "Üretim Yapısı",
    revision: "P02",
    phase: "Ön fizibilite",
    updatedAt: timestamp,
    modules,
  };
  const core = deriveProjectCore(project, deriveProjectThread(modules));
  assert.equal(core.schema, "ARKEM-PROJECT-CORE/1.0");
  assert.equal(core.projectId, "ARK-26-TEST");
  assert.equal(core.fields.find((field) => field.id === "parcel-id")?.trust, "verified");
  assert.equal(core.fields.find((field) => field.id === "program")?.trust, "derived");
  assert.equal(core.fields.find((field) => field.id === "structure")?.trust, "missing");
  assert.equal(modules["geo-parcel"].reference, "Sakarya / Serdivan / 115 / 46");
  assert.equal(modules["geo-parcel"]._kernel.projectRevision, "P02");
  const primitive = stampProjectModule(["legacy", "payload"], {
    projectId: "ARK-26-TEST",
    projectRevision: "P02",
    sourceModule: "legacy-module",
    recordedAt: timestamp,
    action: "imported",
  });
  assert.deepEqual(primitive._payload, ["legacy", "payload"]);
  const kernel = fs.readFileSync(new URL("../app/components/ProjectKernel.tsx", import.meta.url), "utf8");
  assert.match(kernel, /createProjectCode/);
  assert.match(kernel, /createActiveProject/);
  const translations = fs.readFileSync(new URL("../app/data/i18n.ts", import.meta.url), "utf8");
  for (const expected of [
    "Field-level source and trust status",
    "Sahə üzrə mənbə və etibar vəziyyəti",
    "Источники и уровень доверия по каждому полю",
    "Fonte e livello di affidabilità per campo",
    "Quelle und Vertrauensstatus je Datenfeld",
    "Source et niveau de confiance par champ",
  ]) assert.match(translations, new RegExp(expected.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
});

test("V107 turns project intake into a personal, source-aware customer journey", async () => {
  const roadmap = deriveGuidedProjectRoadmap({
    name: "Serdivan Hafif Çelik Villa",
    projectType: "new",
    usage: "residential",
    location: "Sakarya / Serdivan",
    parcelStatus: "identified",
    targetArea: 280,
    floors: 2,
    floorHeight: 3.1,
    system: "light",
    priorities: ["safety", "time"],
    budget: "undecided",
    timeline: "six-months",
    documents: ["title-deed", "parcel-id"],
    experienceMode: "guided",
  });
  assert.equal(roadmap.schema, "ARKEM-GUIDED-JOURNEY/1.0");
  assert.equal(roadmap.nextAction.route, "/imar-entegrasyon-merkezi");
  assert.equal(roadmap.gates.find((gate) => gate.id === "zoning")?.status, "official-review");
  assert.equal(roadmap.gates.find((gate) => gate.id === "budget")?.status, "client-decision");
  assert.ok(roadmap.missingDocuments.includes("İmar durumu / plan notu"));

  const start = fs.readFileSync(new URL("../app/components/ProjectStartStudio.tsx", import.meta.url), "utf8");
  for (const expected of [
    "Müşteri görünümü",
    "Uzman görünümü",
    "Kişisel proje yol haritanız",
    "Projeyi hesabıma kaydet",
    "Taslak cihazda ve oturum açıksa hesabınızda otomatik kaydedilir",
    "start-roadmap-gates",
  ]) assert.match(start, new RegExp(expected));
  assert.ok(start.includes("key={cloudState}"));

  const kernel = fs.readFileSync(new URL("../app/components/ProjectKernel.tsx", import.meta.url), "utf8");
  assert.match(kernel, /deriveGuidedProjectRoadmap/);
  assert.match(kernel, /guidedJourney/);

  const stylesheet = fs.readFileSync(new URL("../app/v107.css", import.meta.url), "utf8");
  for (const expected of [
    ".start-mode-switch",
    ".start-roadmap-gates",
    ".start-document-grid",
    "@media (max-width: 720px)",
  ]) assert.match(stylesheet, new RegExp(expected.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));

  const layout = fs.readFileSync(new URL("../app/layout.tsx", import.meta.url), "utf8");
  assert.match(layout, /import "\.\/v107\.css";/);
  const health = fs.readFileSync(new URL("../app/api/health/route.ts", import.meta.url), "utf8");
  assert.match(health, /release: "V116"/);
  assert.match(health, /guidedCustomerJourney/);

  const response = await render("/proje-baslat");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /Müşteri görünümü/);
  assert.match(html, /Teknik bilgi gerekmez/);
});

test("V108 reduces the customer portal to today, project, decisions and files with explicit record states", async () => {
  const response = await render("/musteri-proje-portali");
  assert.equal(response.status, 200);
  const html = await response.text();
  for (const expected of [
    "Bugün",
    "Projem",
    "Kararlar ve Dosyalar",
    "Hesap ve cihaz kayıtları",
    "Yükleniyor",
  ]) assert.match(html, new RegExp(expected, "i"), expected);

  const deviceProject = {
    schema: "ARKEM-PROJECT/1.0",
    id: "ARK-26-V108",
    name: "Serdivan Konut Projesi",
    revision: "P02",
    phase: "Ön fizibilite",
    updatedAt: "2026-07-29T08:00:00.000Z",
    modules: { "decision-assistant": { status: "Brief hazır" } },
    events: [],
  };
  const deviceOnly = resolveProjectRecord(deviceProject, [], "signed-out");
  assert.equal(deviceOnly.state, "device-only");
  assert.equal(deviceOnly.label, "Bu cihazdaki taslak");
  const aligned = {
    id: deviceProject.id,
    name: deviceProject.name,
    phase: deviceProject.phase,
    revision: deviceProject.revision,
    status: "Kaydedildi",
    updatedAt: deviceProject.updatedAt,
    payload: deviceProject,
  };
  assert.equal(resolveProjectRecord(deviceProject, [aligned], "ready").state, "aligned");
  const conflicting = {
    ...aligned,
    payload: { ...deviceProject, revision: "P01" },
  };
  const conflict = resolveProjectRecord(deviceProject, [conflicting], "ready");
  assert.equal(conflict.state, "conflict");
  assert.equal(conflict.label, "Kayıt çakışması");
  assert.equal(validateAccountProjectPayload(deviceProject.id, deviceProject).ok, true);
  assert.equal(validateAccountProjectPayload("ARK-OTHER", deviceProject).ok, false);
  assert.equal(resolveAccountProjectWritePrecondition(null, null).ok, true);
  assert.equal(resolveAccountProjectWritePrecondition(aligned.updatedAt, aligned.updatedAt).ok, true);
  const staleWrite = resolveAccountProjectWritePrecondition(
    aligned.updatedAt,
    "2026-07-29T09:00:00.000Z",
  );
  assert.equal(staleWrite.ok, false);
  assert.equal(staleWrite.status, 409);
  assert.equal(resolveAccountProjectWritePrecondition(undefined, null).status, 400);

  const portal = fs.readFileSync(new URL("../app/components/ClientProjectPortal.tsx", import.meta.url), "utf8");
  for (const expected of [
    "SIRADAKİ DOĞRU ADIM",
    "Cihaz sürümünü hesabıma kaydet",
    "Hesap sürümünü bu cihazda aç",
  ]) assert.match(portal, new RegExp(expected, "i"), expected);

  const api = fs.readFileSync(new URL("../app/api/customer-workspace/route.ts", import.meta.url), "utf8");
  assert.match(api, /payload/);
  assert.match(api, /safeProjectPayload/);
  assert.match(api, /expectedAccountUpdatedAt/);
  assert.match(api, /CUSTOMER_PROJECT_INSERT_SQL/);
  assert.match(api, /CUSTOMER_PROJECT_UPDATE_SQL/);
  assert.match(api, /saved\.meta\.changes !== 1/);
  assert.match(api, /status: 409/);

  const settings = fs.readFileSync(new URL("../app/components/ClientAccountSettings.tsx", import.meta.url), "utf8");
  for (const expected of ["ClientAccountSettings", "saveProfile", "saveMeeting", "İŞLEM GEÇMİŞİ"]) {
    assert.match(settings, new RegExp(expected), expected);
  }
  assert.match(settings, /expectedAccountUpdatedAt/);
  const projectStart = fs.readFileSync(new URL("../app/components/ProjectStartStudio.tsx", import.meta.url), "utf8");
  assert.match(projectStart, /expectedAccountUpdatedAt:\s*null/);
  const protectedSettings = await render("/uyelik/ayarlar");
  assert.equal(protectedSettings.status, 307);

  const stylesheet = fs.readFileSync(new URL("../app/v108.css", import.meta.url), "utf8");
  for (const expected of [
    ".v108-portal",
    ".v108-primary-nav",
    ".v108-record-state",
    "@media (max-width: 720px)",
  ]) assert.match(stylesheet, new RegExp(expected.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));

  const layout = fs.readFileSync(new URL("../app/layout.tsx", import.meta.url), "utf8");
  assert.match(layout, /import "\.\/v108\.css";/);
  const health = fs.readFileSync(new URL("../app/api/health/route.ts", import.meta.url), "utf8");
  assert.match(health, /release: "V116"/);
  assert.match(health, /customerPortal/);
});

test("V108 rejects a stale second-device account write without replacing the newer project", () => {
  const database = new DatabaseSync(":memory:");
  database.exec(`CREATE TABLE customer_projects (
    id TEXT PRIMARY KEY,
    owner_email TEXT NOT NULL,
    name TEXT NOT NULL,
    phase TEXT NOT NULL,
    revision TEXT NOT NULL,
    status TEXT NOT NULL,
    payload TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`);
  const insert = database.prepare(CUSTOMER_PROJECT_INSERT_SQL);
  const update = database.prepare(CUSTOMER_PROJECT_UPDATE_SQL);
  const created = insert.run(
    "ARK-26-V108",
    "owner@example.com",
    "Serdivan Konut Projesi",
    "Ön fizibilite",
    "P01",
    '{"revision":"P01"}',
    "2026-07-29T08:00:00.000Z",
    "2026-07-29T08:00:00.000Z",
  );
  const firstDevice = update.run(
    "Serdivan Konut Projesi",
    "Ön fizibilite",
    "P02",
    '{"revision":"P02"}',
    "2026-07-29T09:00:00.000Z",
    "ARK-26-V108",
    "owner@example.com",
    "2026-07-29T08:00:00.000Z",
    '{"revision":"P01"}',
  );
  const staleSecondDevice = update.run(
    "Serdivan Konut Projesi",
    "Ön fizibilite",
    "P03",
    '{"revision":"STALE"}',
    "2026-07-29T10:00:00.000Z",
    "ARK-26-V108",
    "owner@example.com",
    "2026-07-29T08:00:00.000Z",
    '{"revision":"P01"}',
  );
  const persisted = database.prepare(
    "SELECT revision, payload, updated_at AS updatedAt FROM customer_projects WHERE id = ?",
  ).get("ARK-26-V108");

  assert.equal(created.changes, 1);
  assert.equal(firstDevice.changes, 1);
  assert.equal(staleSecondDevice.changes, 0);
  assert.equal(persisted.revision, "P02");
  assert.equal(persisted.payload, '{"revision":"P02"}');
  assert.equal(persisted.updatedAt, "2026-07-29T09:00:00.000Z");

  const deletedRaceCreated = insert.run(
    "ARK-DELETE-RACE",
    "owner@example.com",
    "Silme Yarışı",
    "Başlangıç",
    "P01",
    '{"revision":"P01"}',
    "2026-07-29T08:00:00.000Z",
    "2026-07-29T08:00:00.000Z",
  );
  database.prepare("DELETE FROM customer_projects WHERE id = ?").run("ARK-DELETE-RACE");
  const updateAfterDelete = update.run(
    "Silme Yarışı",
    "Başlangıç",
    "P02",
    '{"revision":"P02"}',
    "2026-07-29T09:00:00.000Z",
    "ARK-DELETE-RACE",
    "owner@example.com",
    "2026-07-29T08:00:00.000Z",
    '{"revision":"P01"}',
  );
  const deletedProject = database.prepare(
    "SELECT id FROM customer_projects WHERE id = ?",
  ).get("ARK-DELETE-RACE");
  database.close();

  assert.equal(deletedRaceCreated.changes, 1);
  assert.equal(updateAfterDelete.changes, 0);
  assert.equal(deletedProject, undefined);
});

test("V109 keeps preview geometry out of the project and records parcel evidence at its real source", async () => {
  const {
    createParcelRecord,
    resolveParcelSourceNetwork,
  } = await import("../app/lib/parcel-record.ts");

  const preview = createParcelRecord({
    identity: {
      province: "Sakarya",
      district: "Serdivan",
      neighborhood: "",
      block: "",
      parcelNo: "",
    },
    geometry: [
      { lat: 40.76, lng: 30.36 },
      { lat: 40.76, lng: 30.37 },
      { lat: 40.77, lng: 30.37 },
    ],
    source: {
      kind: "sample",
      authority: "ARKEMX",
      label: "Temsili başlangıç geometrisi",
      capturedAt: "2026-07-29T10:00:00.000Z",
      url: "",
    },
  });
  assert.equal(preview.state, "preview");
  assert.equal(preview.projectEligible, false);
  assert.equal(preview.evidence.trust, "derived");

  const coordinatePreview = createParcelRecord({
    identity: {
      province: "Sakarya",
      district: "Serdivan",
      neighborhood: "Bahçelievler",
      block: "115",
      parcelNo: "46",
    },
    geometry: [
      { lat: 40.76, lng: 30.36 },
      { lat: 40.76, lng: 30.361 },
      { lat: 40.761, lng: 30.361 },
    ],
    source: {
      kind: "coordinate",
      authority: "ARKEMX",
      label: "Koordinat çevresinde üretilen temsili geometri",
      capturedAt: "2026-07-29T10:02:00.000Z",
      url: "",
    },
  });
  assert.equal(coordinatePreview.state, "needs-review");
  assert.equal(coordinatePreview.projectEligible, false);

  const official = createParcelRecord({
    identity: {
      province: "Sakarya",
      district: "Serdivan",
      neighborhood: "Bahçelievler",
      block: "115",
      parcelNo: "46",
    },
    geometry: [
      { lat: 40.76, lng: 30.36 },
      { lat: 40.76, lng: 30.361 },
      { lat: 40.761, lng: 30.361 },
    ],
    source: {
      kind: "tkgm-open-service",
      authority: "Tapu ve Kadastro Genel Müdürlüğü",
      label: "TKGM MEGSİS açık servis yanıtı",
      capturedAt: "2026-07-29T10:05:00.000Z",
      url: "https://parselsorgu.tkgm.gov.tr/",
      reportedArea: 9380,
    },
  });
  assert.equal(official.schema, "ARKEM-PARCEL-RECORD/1.0");
  assert.equal(official.reference, "Sakarya / Serdivan / Bahçelievler / 115 / 46");
  assert.equal(official.state, "identified");
  assert.equal(official.projectEligible, true);
  assert.equal(official.evidence.trust, "verified");
  assert.equal(official.evidence.officialCadastre, false);
  assert.equal(official.geometry.vertexCount, 3);
  assert.equal(official.geometry.valid, true);

  const sourceNetwork = resolveParcelSourceNetwork("Sakarya", "Serdivan");
  assert.equal(sourceNetwork.schema, "ARKEM-PARCEL-SOURCE-NETWORK/1.0");
  assert.equal(sourceNetwork.coverage, "81-province-routing");
  assert.ok(sourceNetwork.sources.some((source) => source.id === "tkgm-parcel"));
  assert.ok(sourceNetwork.sources.some((source) => source.id === "e-plan"));
  assert.ok(sourceNetwork.sources.some((source) => source.id === "serdivan-keos"));

  const studio = fs.readFileSync(new URL("../app/components/GeoParcelStudio.tsx", import.meta.url), "utf8");
  for (const expected of [
    "PARSEL VERİ MERKEZİ",
    "Kaynak ve kanıt",
    "Aktif projeye bağlı",
    "parcelRecord",
    "resolveParcelSourceNetwork",
    "useMemo<ParcelRecord>",
    "resmî sorgu zamanı yok",
  ]) assert.match(studio, new RegExp(expected, "i"), expected);
  assert.match(studio, /kind:\s*"sample"/);

  const layout = fs.readFileSync(new URL("../app/layout.tsx", import.meta.url), "utf8");
  assert.match(layout, /import "\.\/v109\.css";/);
  const stylesheet = fs.readFileSync(new URL("../app/v109.css", import.meta.url), "utf8");
  for (const expected of [
    ".v109-parcel-center",
    ".v109-source-network",
    "@media (max-width: 430px)",
    "min-width: 0",
  ]) assert.match(stylesheet, new RegExp(expected.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));

  const health = fs.readFileSync(new URL("../app/api/health/route.ts", import.meta.url), "utf8");
  assert.match(health, /release: "V116"/);
  assert.match(health, /parcelDataCenter/);
});

test("V109 validates the complete project envelope and records activity only for the winning write", async () => {
  const validProject = {
    schema: "ARKEM-PROJECT/1.0",
    id: "ARK-26-V109",
    name: "Serdivan Parsel Projesi",
    revision: "P01",
    phase: "Ön fizibilite",
    updatedAt: "2026-07-29T10:00:00.000Z",
    modules: {
      "geo-parcel": {
        _kernel: {
          schema: "ARKEM-MODULE-LINK/1.0",
          projectId: "ARK-26-V109",
          projectRevision: "P01",
          sourceModule: "geo-parcel",
          recordedAt: "2026-07-29T10:00:00.000Z",
          action: "updated",
        },
      },
    },
    events: [],
  };
  assert.equal(validateAccountProjectPayload(validProject.id, validProject).ok, true);
  assert.equal(validateAccountProjectPayload(validProject.id, {
    ...validProject,
    revision: "P02",
  }).ok, true);
  assert.equal(validateAccountProjectPayload(validProject.id, {
    ...validProject,
    modules: {
      "geo-parcel": {
        _kernel: {
          ...validProject.modules["geo-parcel"]._kernel,
          projectRevision: "",
        },
      },
    },
  }).ok, false);
  assert.equal(validateAccountProjectPayload(validProject.id, {
    ...validProject,
    modules: {
      "architectural-program": {
        _kernel: {
          ...validProject.modules["geo-parcel"]._kernel,
          sourceModule: "geo-parcel",
          action: "handoff",
        },
      },
    },
  }).ok, true);
  assert.equal(validateAccountProjectPayload(validProject.id, {
    ...validProject,
    modules: {
      "architectural-program": {
        _kernel: {
          ...validProject.modules["geo-parcel"]._kernel,
          sourceModule: "geo-parcel",
          action: "updated",
        },
      },
    },
  }).ok, false);
  assert.equal(validateAccountProjectPayload(validProject.id, { ...validProject, phase: undefined }).ok, false);
  assert.equal(validateAccountProjectPayload(validProject.id, { ...validProject, updatedAt: "not-a-date" }).ok, false);
  assert.equal(validateAccountProjectPayload(validProject.id, { ...validProject, events: {} }).ok, false);
  assert.equal(validateAccountProjectPayload(validProject.id, {
    ...validProject,
    modules: {
      "geo-parcel": {
        _kernel: {
          ...validProject.modules["geo-parcel"]._kernel,
          projectId: "ARK-OTHER",
        },
      },
    },
  }).ok, false);

  const {
    CUSTOMER_PROJECT_ACTIVITY_SQL,
  } = await import("../app/lib/customer-workspace-write.ts");
  const database = new DatabaseSync(":memory:");
  database.exec(`CREATE TABLE customer_projects (
    id TEXT PRIMARY KEY,
    owner_email TEXT NOT NULL,
    name TEXT NOT NULL,
    phase TEXT NOT NULL,
    revision TEXT NOT NULL,
    status TEXT NOT NULL,
    payload TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`);
  database.exec(`CREATE TABLE customer_activities (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    owner_email TEXT NOT NULL,
    event_type TEXT NOT NULL,
    title TEXT NOT NULL,
    detail TEXT NOT NULL,
    created_at TEXT NOT NULL
  )`);
  const insert = database.prepare(CUSTOMER_PROJECT_INSERT_SQL);
  const update = database.prepare(CUSTOMER_PROJECT_UPDATE_SQL);
  const activity = database.prepare(CUSTOMER_PROJECT_ACTIVITY_SQL);
  insert.run(
    validProject.id,
    "owner@example.com",
    validProject.name,
    validProject.phase,
    validProject.revision,
    JSON.stringify(validProject),
    validProject.updatedAt,
    validProject.updatedAt,
  );
  activity.run(
    "owner@example.com",
    `${validProject.id} · ${validProject.name}`,
    validProject.updatedAt,
    validProject.id,
    "owner@example.com",
    validProject.updatedAt,
    JSON.stringify(validProject),
  );
  const stalePayload = JSON.stringify({ ...validProject, revision: "P02" });
  const staleWrite = update.run(
    validProject.name,
    validProject.phase,
    "P02",
    stalePayload,
    "2026-07-29T11:00:00.000Z",
    validProject.id,
    "owner@example.com",
    "2026-07-29T09:00:00.000Z",
    JSON.stringify(validProject),
  );
  activity.run(
    "owner@example.com",
    `${validProject.id} · ${validProject.name}`,
    "2026-07-29T11:00:00.000Z",
    validProject.id,
    "owner@example.com",
    "2026-07-29T11:00:00.000Z",
    stalePayload,
  );
  const activityCount = database.prepare("SELECT COUNT(*) AS count FROM customer_activities").get().count;
  database.close();

  assert.equal(staleWrite.changes, 0);
  assert.equal(activityCount, 1);
  const api = fs.readFileSync(new URL("../app/api/customer-workspace/route.ts", import.meta.url), "utf8");
  assert.match(api, /db\.batch\(\[projectWrite, projectActivity\]\)/);
});

test("V109.1 keeps the connected project journey and system comparison readable on phones", () => {
  const stylesheet = fs.readFileSync(new URL("../app/responsive.css", import.meta.url), "utf8");
  assert.match(stylesheet, /V109\.2 — canonical responsive contract/);
  for (const expected of [
    ".mcda-results > header nav",
    ".mcda-ranking article",
    ".mcda-rank",
    ".mcda-system",
    ".project-guided-journey > header",
    ".project-guided-journey > div > a",
    ".project-live-handoff",
    "overflow-wrap: normal !important",
    "min-width: 100% !important",
  ]) assert.match(stylesheet, new RegExp(expected.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), expected);

  const kernel = fs.readFileSync(new URL("../app/components/ProjectKernel.tsx", import.meta.url), "utf8");
  assert.match(kernel, /journeyScrollerRef/);
  assert.match(kernel, /activeJourneyIndex/);
  assert.match(kernel, /scrollLeft\s*=/);
  assert.match(kernel, /aria-current=\{index === activeJourneyIndex \? "step"/);
});

test("V109.2 gives shared technical surfaces one final responsive contract", () => {
  const layout = fs.readFileSync(new URL("../app/layout.tsx", import.meta.url), "utf8");
  const responsive = fs.readFileSync(new URL("../app/responsive.css", import.meta.url), "utf8");
  const v109 = fs.readFileSync(new URL("../app/v109.css", import.meta.url), "utf8");

  assert.match(layout, /import "\.\/v109\.css";[\s\S]*import "\.\/responsive\.css";/);
  assert.match(layout, /import "\.\/responsive\.css";[\s\S]*import "\.\/v37-corporate\.css";\s*import "\.\/v4\.css";/);
  assert.ok(layout.indexOf('import "./responsive.css";') > layout.indexOf('import "./v109.css";'));
  assert.match(responsive, /V109\.2 — canonical responsive contract/);
  assert.match(responsive, /container-type:\s*inline-size/);
  assert.match(responsive, /@media \(max-width:\s*760px\)/);
  assert.match(responsive, /@media \(max-width:\s*430px\)/);
  assert.match(responsive, /@media \(max-width:\s*390px\)/);
  assert.match(responsive, /@media \(max-width:\s*360px\)/);
  assert.match(responsive, /min-height:\s*44px/);
  assert.match(responsive, /:focus-visible/);
  assert.match(responsive, /prefers-reduced-motion:\s*reduce/);
  assert.doesNotMatch(responsive, /word-break:\s*break-all/);
  assert.doesNotMatch(v109, /V109\.1 — mobile reflow contract/);
});

test("V109.2 optimizes the highest-traffic local imagery", () => {
  for (const relativePath of [
    "../app/components/SiteChrome.tsx",
    "../app/components/TechnologyMatrix.tsx",
    "../app/components/StructuralDesignerPreview.tsx",
    "../app/tasarim-calismalari/page.tsx",
  ]) {
    const source = fs.readFileSync(new URL(relativePath, import.meta.url), "utf8");
    assert.match(source, /from "next\/image"/, `${relativePath} should use the image pipeline`);
    assert.doesNotMatch(source, /<img\b/, `${relativePath} should not bypass the image pipeline`);
  }
  const home = [
    fs.readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8"),
    fs.readFileSync(new URL("../app/components/HomeV4.tsx", import.meta.url), "utf8"),
    fs.readFileSync(new URL("../app/components/HeroProjectStage.tsx", import.meta.url), "utf8"),
  ].join("\n");
  assert.match(home, /from "next\/image"/);
  assert.doesNotMatch(home, /<img\b/);
});

test("V110.1 serves public imagery without the unavailable production optimizer", async () => {
  const layout = fs.readFileSync(new URL("../app/layout.tsx", import.meta.url), "utf8");
  const globals = fs.readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
  for (const importPath of ["leaflet/dist/leaflet.css", "maplibre-gl/dist/maplibre-gl.css"]) {
    const importStatement = `import "${importPath}";`;
    assert.ok(layout.includes(importStatement), `Missing CSS import: ${importPath}`);
    assert.ok(layout.indexOf(importStatement) < layout.indexOf('import "./globals.css";'),
      `${importPath} must be loaded before application styles`);
  }
  assert.doesNotMatch(globals, /@import\s+["']leaflet\/dist\/leaflet\.css["']/);

  for (const relativePath of [
    "../app/page.tsx",
    "../app/components/SiteChrome.tsx",
    "../app/components/TechnologyMatrix.tsx",
    "../app/components/StructuralDesignerPreview.tsx",
    "../app/tasarim-calismalari/page.tsx",
  ]) {
    const source = fs.readFileSync(new URL(relativePath, import.meta.url), "utf8");
    for (const imageTag of source.matchAll(/<Image\b[^>]*>/g)) {
      assert.match(imageTag[0], /\bunoptimized\b/, `${relativePath} must emit a direct image URL`);
    }
  }

  for (const service of services) {
    const publicAsset = new URL(`../public${service.image}`, import.meta.url);
    assert.ok(fs.existsSync(publicAsset), `Missing service image: ${service.image}`);
    assert.ok(fs.statSync(publicAsset).size > 0, `Empty service image: ${service.image}`);
  }

  const appDirectory = new URL("../app/", import.meta.url);
  for (const stylesheet of fs.readdirSync(appDirectory).filter((name) => name.endsWith(".css"))) {
    const source = fs.readFileSync(new URL(stylesheet, appDirectory), "utf8");
    for (const match of source.matchAll(/url\(["']?(\/[^)'"?#]+)["']?\)/g)) {
      const publicAsset = new URL(`../public${match[1]}`, import.meta.url);
      assert.ok(fs.existsSync(publicAsset), `${stylesheet} references a missing public asset: ${match[1]}`);
    }
  }

  // The tools and sign-in entries intentionally avoid corporate hero imagery.
  // Check a corporate route for the official logo asset contract.
  const response = await render("/arkem");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /\/brand\/arkem-logo-master\.svg(?:#|%23)(?:on-light|on-dark)/);
  assert.doesNotMatch(html, /\/_vinext\/image\?/);
});

test("V110 keeps every zoning value attached to dated evidence and never hides a conflict", async () => {
  const {
    createZoningEvidenceBundle,
    createZoningEvidenceRecord,
  } = await import("../app/lib/zoning-evidence.ts");

  const municipal = createZoningEvidenceRecord({
    id: "municipal-viewer",
    label: "Serdivan Belediyesi İmar Durumu",
    authority: "T.C. Serdivan Belediyesi",
    sourceType: "municipal-viewer",
    queriedAt: "2026-07-28T09:00:00.000Z",
    validUntil: null,
    url: "https://keos.serdivan.bel.tr/imardurumu/",
    documentReference: "Ada 115 / Parsel 46",
    verification: "screen-record",
    conditions: { taks: 0.4, kaks: 1.2, hmax: 15.5, buildingOrder: "Ayrık nizam" },
  });
  const approvedDocument = createZoningEvidenceRecord({
    id: "approved-document",
    label: "Onaylı imar durumu belgesi",
    authority: "T.C. Serdivan Belediyesi",
    sourceType: "certified-document",
    queriedAt: "2026-07-29T10:00:00.000Z",
    validUntil: "2099-12-31T23:59:59.000Z",
    url: null,
    documentReference: "IMD-2026-184",
    verification: "document-reviewed",
    conditions: { taks: 0.35, kaks: 1.2, hmax: 15.5, buildingOrder: "Ayrık nizam" },
  });
  const bundle = createZoningEvidenceBundle({
    parcelReference: "Sakarya / Serdivan / Bahçelievler / 115 / 46",
    generatedAt: "2026-08-01T10:00:00.000Z",
    records: [municipal, approvedDocument],
  });

  assert.equal(bundle.schema, "ARKEM-ZONING-EVIDENCE/1.0");
  assert.equal(bundle.status, "conflict");
  assert.equal(bundle.conditions.taks.status, "conflict");
  assert.equal(bundle.conditions.taks.value, null);
  assert.deepEqual(bundle.conditions.taks.candidates.map((item) => item.value), [0.4, 0.35]);
  assert.match(bundle.nextAction, /uzman incelemesi/i);
  assert.equal(approvedDocument.freshness, "current");
  assert.equal(municipal.freshness, "undated");
  const unsafe = createZoningEvidenceRecord({
    ...municipal,
    id: "unsafe-link",
    url: "javascript:alert(1)",
  });
  assert.equal(unsafe.url, null);
  const extracted = createZoningEvidenceRecord({
    id: "document-extraction",
    label: "Yüklenen belge metni",
    authority: "Kullanıcı belgesi",
    sourceType: "user-document",
    queriedAt: "2026-08-01T10:00:00.000Z",
    validUntil: null,
    url: null,
    documentReference: "imar.txt",
    verification: "text-extraction",
    conditions: { taks: 0.4 },
  });
  assert.equal(extracted.trust, "declared");
});

test("V110 renders the parcel zoning evidence center and transfers its manifest", () => {
  const center = fs.readFileSync(new URL("../app/components/ZoningIntegrationCenter.tsx", import.meta.url), "utf8");
  for (const expected of [
    "V110 / PARSEL VE İMAR KANIT MERKEZİ",
    "Kaynak sicili",
    "Alan bazlı kanıt",
    "Kaynak çatışması",
    "zoningEvidenceBundle",
    "createZoningEvidenceBundle",
  ]) assert.match(center, new RegExp(expected, "i"), expected);

  const layout = fs.readFileSync(new URL("../app/layout.tsx", import.meta.url), "utf8");
  assert.match(layout, /import "\.\/v110\.css";\s*import "\.\/v111\.css";\s*import "\.\/v112\.css";\s*import "\.\/v113\.css";\s*import "\.\/v114\.css";\s*import "\.\/v115\.css";\s*import "\.\/v116\.css";\s*import "\.\/responsive\.css";/);
  const featureStyles = fs.readFileSync(new URL("../app/v110.css", import.meta.url), "utf8");
  assert.match(featureStyles, /\.v110-evidence-center/);
  const responsive = fs.readFileSync(new URL("../app/responsive.css", import.meta.url), "utf8");
  assert.match(responsive, /\.v110-evidence-condition-grid/);

  const health = fs.readFileSync(new URL("../app/api/health/route.ts", import.meta.url), "utf8");
  assert.match(health, /release: "V116"/);
  assert.match(health, /zoningEvidenceCenter/);
});

test("V111 unifies parcel, elevation, contours and 3D terrain in one source-aware model", async () => {
  const {
    DEFAULT_TERRAIN_LAYERS,
    createTerrainContours,
    createTerrainModel,
  } = await import("../app/lib/terrain-model.ts");

  const measuredParcel = [
    { lat: 40.7605, lng: 30.3672, alt: 101.2 },
    { lat: 40.7605, lng: 30.3678, alt: 102.1 },
    { lat: 40.7610, lng: 30.3678, alt: 104.4 },
    { lat: 40.7610, lng: 30.3672, alt: 103.0 },
  ];
  const measured = createTerrainModel({
    reference: "SAKARYA-SERDIVAN-115-46",
    parcel: measuredParcel,
    slope: 4,
    exaggeration: 1.5,
    sourceCrs: "EPSG:4326 / WGS84",
    dataStatus: "Kullanıcı ölçüm dosyası · kontrol gerekli",
    source: {
      kind: "user-file",
      authority: "Kullanıcı tarafından sağlanan mekânsal dosya",
      label: "plankote.csv",
      capturedAt: "2026-08-01T10:00:00.000Z",
    },
    projectEligible: true,
    layers: DEFAULT_TERRAIN_LAYERS,
    generatedAt: "2026-08-01T10:05:00.000Z",
  });
  assert.equal(measured.schema, "ARKEM-TERRAIN-MODEL/1.0");
  assert.equal(measured.basis, "measured-z");
  assert.equal(measured.samples.measured, 4);
  assert.equal(measured.elevation.range, 3.2);
  assert.equal(measured.trust, "declared");
  assert.equal(measured.officialTerrain, false);
  assert.ok(createTerrainContours(measuredParcel, 4).length > 0);

  const conceptual = createTerrainModel({
    reference: "ONIZLEME",
    parcel: measuredParcel.map((point) => ({ lat: point.lat, lng: point.lng })),
    slope: 6,
    exaggeration: 2,
    sourceCrs: "EPSG:4326 / WGS84",
    dataStatus: "Kavramsal / doğrulanmamış",
    source: {
      kind: "sample",
      authority: "ARKEMX",
      label: "Temsili başlangıç geometrisi",
      capturedAt: "1970-01-01T00:00:00.000Z",
    },
    projectEligible: false,
    layers: DEFAULT_TERRAIN_LAYERS,
    generatedAt: "2026-08-01T10:05:00.000Z",
  });
  assert.equal(conceptual.basis, "parametric-slope");
  assert.equal(conceptual.trust, "conceptual");
  assert.equal(conceptual.projectEligible, false);
  assert.match(conceptual.limitations.join(" "), /plankote değildir/i);

  const studio = fs.readFileSync(new URL("../app/components/GeoParcelStudio.tsx", import.meta.url), "utf8");
  for (const expected of [
    "V111 / ORTAK HARİTA + 3B KATMANLARI",
    "terrainModel",
    "terrainLayers",
    "createTerrainContours",
    "layers={terrainLayers}",
    "ESYUKSELTI",
    "LandXML yüzeyi için en az üç kaynaklı Z kotu gerekir",
  ]) assert.match(studio, new RegExp(expected.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), expected);

  const viewer = fs.readFileSync(new URL("../app/components/GeoTerrainViewer.tsx", import.meta.url), "utf8");
  assert.match(viewer, /createTerrainElevationSampler/);
  assert.match(viewer, /V111 \/ BÜTÜNLEŞİK ARAZİ MODELİ/);

  const layout = fs.readFileSync(new URL("../app/layout.tsx", import.meta.url), "utf8");
  assert.match(layout, /import "\.\/v111\.css";\s*import "\.\/v112\.css";\s*import "\.\/v113\.css";\s*import "\.\/v114\.css";\s*import "\.\/v115\.css";\s*import "\.\/v116\.css";\s*import "\.\/responsive\.css";/);
  const featureStyles = fs.readFileSync(new URL("../app/v111.css", import.meta.url), "utf8");
  assert.match(featureStyles, /\.v111-layer-dock/);
  assert.match(featureStyles, /grid-template-columns:\s*repeat\(6, minmax\(0, 1fr\)\)/);
  assert.match(featureStyles, /@media \(max-width: 430px\)/);
  assert.doesNotMatch(featureStyles, /word-break:\s*break-all/);
  const health = fs.readFileSync(new URL("../app/api/health/route.ts", import.meta.url), "utf8");
  assert.match(health, /release: "V116"/);
  assert.match(health, /unifiedTerrainModel/);
});

test("V112 generates source-aware zoning envelopes and comparable massing alternatives", async () => {
  const { createZoningMassingModel } = await import("../app/lib/zoning-massing.ts");
  const parcel = [
    { lat: 40.7605, lng: 30.3672 },
    { lat: 40.7605, lng: 30.3682 },
    { lat: 40.7613, lng: 30.3682 },
    { lat: 40.7613, lng: 30.3672 },
  ];
  const model = createZoningMassingModel({
    reference: "SAKARYA-SERDIVAN-115-46",
    parcel,
    zoning: {
      taks: 0.4,
      kaks: 1.2,
      hmax: 15.5,
      frontSetback: 5,
      sideSetback: 3,
      rearSetback: 3,
      buildingOrder: "Ayrık nizam",
      verification: "approved-plan",
    },
    frontEdge: "north",
    floorHeight: 3.2,
    generatedAt: "2026-08-01T11:00:00.000Z",
  });

  assert.equal(model.schema, "ARKEM-ZONING-MASSING/1.0");
  assert.equal(model.envelope.frontEdge, "north");
  assert.equal(model.source.authoritative, true);
  assert.equal(model.alternatives.length, 3);
  assert.deepEqual(model.alternatives.map((item) => item.id), ["maximum-footprint", "balanced", "compact"]);
  for (const alternative of model.alternatives) {
    assert.ok(alternative.footprint <= model.limits.allowedFootprint + 0.01);
    assert.ok(alternative.grossArea <= model.limits.allowedGrossArea + 0.01);
    assert.ok(alternative.height <= model.limits.allowedHeight + 0.01);
    assert.equal(alternative.checks.every((check) => check.pass), alternative.status === "fits");
  }

  const conceptual = createZoningMassingModel({
    reference: "ONIZLEME",
    parcel,
    zoning: {
      taks: 0.4,
      kaks: 1.2,
      hmax: 15.5,
      frontSetback: 5,
      sideSetback: 3,
      rearSetback: 3,
      buildingOrder: "Plan notuna göre",
      verification: "user-declared",
    },
    frontEdge: "east",
    floorHeight: 3.2,
  });
  assert.equal(conceptual.source.authoritative, false);
  assert.match(conceptual.limitations.join(" "), /ruhsat|resmî/i);

  const studio = fs.readFileSync(new URL("../app/components/GeoParcelStudio.tsx", import.meta.url), "utf8");
  for (const expected of [
    "V112 / İMAR UYUMLU KÜTLE MOTORU",
    "createZoningMassingModel",
    "massingModel",
    "applyMassingAlternative",
    "Ön cephe yönü",
  ]) assert.match(studio, new RegExp(expected.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), expected);

  const projectKernel = fs.readFileSync(new URL("../app/components/ProjectKernel.tsx", import.meta.url), "utf8");
  assert.match(projectKernel, /massingModel:\s*geo\.massingModel/);
  assert.match(projectKernel, /yapı zarfı/);

  const layout = fs.readFileSync(new URL("../app/layout.tsx", import.meta.url), "utf8");
  assert.match(layout, /import "\.\/v112\.css";\s*import "\.\/v113\.css";\s*import "\.\/v114\.css";\s*import "\.\/v115\.css";\s*import "\.\/v116\.css";\s*import "\.\/responsive\.css";/);
  const featureStyles = fs.readFileSync(new URL("../app/v112.css", import.meta.url), "utf8");
  assert.match(featureStyles, /\.v112-massing-engine/);
  assert.match(featureStyles, /\.geo-integration-map\s*>\s*\.geo-zoning-connector-row\s*\{[\s\S]*grid-column:\s*1\s*\/\s*-1/);
  assert.match(featureStyles, /@media \(max-width: 430px\)/);
  assert.doesNotMatch(featureStyles, /word-break:\s*break-all/);

  const health = fs.readFileSync(new URL("../app/api/health/route.ts", import.meta.url), "utf8");
  assert.match(health, /release: "V116"/);
  assert.match(health, /zoningMassingEngine/);
});

test("V113 turns the V112 massing envelope into a traceable architectural scheme", async () => {
  const { createArchitecturalScheme } = await import("../app/lib/architectural-scheme.ts");
  const scheme = createArchitecturalScheme({
    reference: "ARK-26-V113",
    use: "industrial",
    targetGross: 3600,
    netRatio: 78,
    floors: 2,
    floorHeight: 4.5,
    aspect: 1.55,
    corridorWidth: 1.8,
    targetTravel: 30,
    stairs: 2,
    elevators: 1,
    coreStrategy: "split",
    spaces: [
      { id: "IND-01", code: "A-101", name: "Üretim holü", zone: "Üretim", count: 1, unitArea: 1450, density: 20, daylight: true, accessible: true },
      { id: "IND-02", code: "A-102", name: "Hammadde deposu", zone: "Lojistik", count: 1, unitArea: 420, density: 40, daylight: false, accessible: true },
      { id: "IND-03", code: "A-103", name: "Sevkiyat alanı", zone: "Lojistik", count: 1, unitArea: 320, density: 30, daylight: true, accessible: true },
      { id: "IND-04", code: "A-201", name: "Ofis", zone: "Yönetim", count: 1, unitArea: 210, density: 10, daylight: true, accessible: true },
    ],
    relationships: [
      { id: "R-01", from: "Hammadde deposu", to: "Üretim holü", priority: "Zorunlu", confirmed: true },
      { id: "R-02", from: "Üretim holü", to: "Sevkiyat alanı", priority: "Zorunlu", confirmed: true },
    ],
    selectedMassingId: "balanced",
    massingModel: {
      schema: "ARKEM-ZONING-MASSING/1.0",
      source: { authoritative: true, trust: "verified" },
      envelope: { width: 64, depth: 52, area: 3328 },
      alternatives: [
        { id: "balanced", label: "Dengeli kütle", status: "fits", width: 52, depth: 38, footprint: 1976, floors: 2, grossArea: 3952 },
      ],
      recommendedAlternativeId: "balanced",
    },
    generatedAt: "2026-08-01T13:00:00.000Z",
  });

  assert.equal(scheme.schema, "ARKEM-ARCH-SCHEME/3.0");
  assert.equal(scheme.source.massingConnected, true);
  assert.equal(scheme.source.authoritativeMassing, true);
  assert.equal(scheme.source.selectedMassingId, "balanced");
  assert.ok(scheme.plate.width <= 52.01);
  assert.ok(scheme.plate.depth <= 38.01);
  assert.equal(scheme.nodes.length, 4);
  assert.equal(scheme.cores.length, 2);
  assert.equal(scheme.relationships.items.length, 2);
  assert.ok(scheme.circulation.maximumTravelDistance > 0);
  assert.ok(scheme.daylight.requiredArea > 0);
  assert.deepEqual(scheme.checks.map((item) => item.code), ["ARC-113-01", "ARC-113-02", "ARC-113-03", "ARC-113-04", "ARC-113-05", "ARC-113-06"]);
  assert.match(scheme.limitations.join(" "), /avan|ruhsat|yangın/i);

  const studio = fs.readFileSync(new URL("../app/components/ArchitecturalProgramStudio.tsx", import.meta.url), "utf8");
  for (const expected of [
    "V113 / MEKÂNSAL ŞEMA MOTORU",
    "createArchitecturalScheme",
    "architecturalScheme",
    "Çekirdek yerleşimi",
    "Plan şeması",
  ]) assert.match(studio, new RegExp(expected.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), expected);

  const kernel = fs.readFileSync(new URL("../app/components/ProjectKernel.tsx", import.meta.url), "utf8");
  assert.match(kernel, /architecturalScheme:\s*architecture\.architecturalScheme/);
  assert.match(kernel, /dolaşım/);
  assert.match(kernel, /günışığı/);

  const core = fs.readFileSync(new URL("../app/lib/project-core.ts", import.meta.url), "utf8");
  assert.match(core, /Mekânsal şema/);
  assert.match(core, /ARKEM-ARCH-SCHEME\/3\.0/);

  const layout = fs.readFileSync(new URL("../app/layout.tsx", import.meta.url), "utf8");
  assert.match(layout, /import "\.\/v113\.css";\s*import "\.\/v114\.css";\s*import "\.\/v115\.css";\s*import "\.\/v116\.css";\s*import "\.\/responsive\.css";/);
  const styles = fs.readFileSync(new URL("../app/v113.css", import.meta.url), "utf8");
  assert.match(styles, /\.v113-scheme-engine/);
  assert.match(styles, /@media \(max-width: 430px\)/);
  assert.doesNotMatch(styles, /word-break:\s*break-all/);

  const health = fs.readFileSync(new URL("../app/api/health/route.ts", import.meta.url), "utf8");
  assert.match(health, /release: "V116"/);
  assert.match(health, /architecturalSchemeEngine/);
});

test("V114 compares five structural systems from the V113 architectural scheme", async () => {
  const { createStructuralStudio } = await import("../app/lib/structural-studio.ts");
  const studio = createStructuralStudio({
    reference: "ARK-26-V114",
    input: {
      system: "precast",
      usage: "industrial",
      width: 40,
      depth: 30,
      floors: 2,
      floorHeight: 4.5,
      baysX: 5,
      baysY: 4,
      columnSize: .5,
      beamDepth: .7,
      slabThickness: .16,
      superDeadLoad: 2.2,
      liveLoad: 5,
      roofSnowLoad: .75,
      basicWindSpeed: 30,
      sds: 1,
      sd1: .45,
      importance: 1,
      behaviorFactor: 6,
      concreteStrength: 40,
      steelYield: 355,
    },
    architecturalScheme: {
      schema: "ARKEM-ARCH-SCHEME/3.0",
      source: { authoritativeMassing: true, massingConnected: true, selectedMassingId: "balanced" },
      plate: { width: 52, depth: 38, area: 1976, floors: 2, floorHeight: 4.5, grossCapacity: 3952 },
      core: { strategy: "split", totalArea: 64, ratio: 3.2, stairs: 2, elevators: 1 },
      circulation: { maximumTravelDistance: 27.4 },
      program: { use: "industrial", occupants: 168 },
      nodes: [{ id: "IND-01" }, { id: "IND-02" }, { id: "IND-03" }, { id: "IND-04" }],
    },
    repetition: 80,
    transportDistance: 120,
    fireRating: 90,
    generatedAt: "2026-08-01T15:00:00.000Z",
  });

  assert.equal(studio.schema, "ARKEM-STRUCTURAL-STUDIO/3.0");
  assert.equal(studio.source.architecturalSchemeConnected, true);
  assert.equal(studio.source.authoritativeGeometry, true);
  assert.equal(studio.geometry.width, 52);
  assert.equal(studio.geometry.depth, 38);
  assert.equal(studio.geometry.floors, 2);
  assert.deepEqual(studio.alternatives.map((item) => item.system), ["concrete", "precast", "steel", "light", "hybrid"]);
  assert.ok(studio.alternatives.every((item) => item.preliminary.column && item.preliminary.beam && item.preliminary.floor));
  assert.ok(studio.alternatives.every((item) => Number.isFinite(item.indices.relativeCost) && item.indices.durationWeeks > 0 && item.indices.factoryShare >= 0));
  assert.ok(studio.alternatives.some((item) => item.system === studio.recommendation.system));
  assert.deepEqual(studio.checks.map((item) => item.code), ["STR-114-01", "STR-114-02", "STR-114-03", "STR-114-04", "STR-114-05", "STR-114-06"]);
  assert.match(studio.limitations.join(" "), /ön boyutlandırma|statik analiz|teklif|uygulama/i);

  const designer = fs.readFileSync(new URL("../app/components/StructuralDesigner.tsx", import.meta.url), "utf8");
  for (const expected of [
    "V114 / TAŞIYICI SİSTEM STÜDYOSU 2.0",
    "createStructuralStudio",
    "Betonarme Prefabrik",
    "Ön boyutlandırma",
    "V113 mekânsal şeması",
  ]) assert.match(designer, new RegExp(expected.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), expected);

  const kernel = fs.readFileSync(new URL("../app/components/ProjectKernel.tsx", import.meta.url), "utf8");
  assert.match(kernel, /architecturalScheme:\s*architecture\.architecturalScheme/);
  assert.match(kernel, /ön boyutlandırma/);

  const core = fs.readFileSync(new URL("../app/lib/project-core.ts", import.meta.url), "utf8");
  assert.match(core, /ARKEM-STRUCTURAL-STUDIO\/3\.0/);
  assert.match(core, /Taşıyıcı ön boyutlandırma/);

  const layout = fs.readFileSync(new URL("../app/layout.tsx", import.meta.url), "utf8");
  assert.match(layout, /import "\.\/v113\.css";\s*import "\.\/v114\.css";\s*import "\.\/v115\.css";\s*import "\.\/v116\.css";\s*import "\.\/responsive\.css";/);
  const styles = fs.readFileSync(new URL("../app/v114.css", import.meta.url), "utf8");
  assert.match(styles, /\.v114-source-band/);
  assert.match(styles, /@media \(max-width: 430px\)/);
  assert.doesNotMatch(styles, /word-break:\s*break-all/);

  const health = fs.readFileSync(new URL("../app/api/health/route.ts", import.meta.url), "utf8");
  assert.match(health, /release: "V116"/);
  assert.match(health, /structuralSystemStudio/);
});

test("V115 federates V113 architecture and V114 structure into traceable BIM coordination", async () => {
  const { createBimCoordinationModel } = await import("../app/lib/bim-coordination.ts");
  const model = createBimCoordinationModel({
    projectId: "ARK-26-V115",
    projectRevision: "P03",
    coordinateReference: "EPSG:5254 · PROJECT ORIGIN 0,0,0",
    architecturalScheme: {
      schema: "ARKEM-ARCH-SCHEME/3.0",
      source: { authoritativeMassing: true, selectedMassingId: "balanced" },
      plate: { width: 52, depth: 38, area: 1976, floors: 2, floorHeight: 4.5 },
      program: { occupants: 168 },
      cores: [{ id: "CORE-1", area: 32, position: { x: 50, y: 50 } }],
    },
    structuralStudio: {
      schema: "ARKEM-STRUCTURAL-STUDIO/3.0",
      source: { architectureTrust: "verified" },
      geometry: { width: 52, depth: 38, floors: 2, floorHeight: 4.5, baysX: 6, baysY: 5, maximumSpan: 8.8, totalArea: 3952 },
      recommendation: { system: "precast", label: "Betonarme Prefabrik", score: 81.4 },
      alternatives: [{
        system: "precast",
        label: "Betonarme Prefabrik",
        preliminary: { column: "45×45 cm", beam: "35×90 cm", floor: "25 cm boşluklu döşeme", numeric: { beamDepth: .9, slabThickness: .25 } },
        indices: { relativeCost: 108, durationWeeks: 15.2, embodiedCarbonProxy: 412000, factoryShare: 78 },
        quantities: { concreteVolume: 820, reinforcementTonnage: 92, steelTonnage: 18 },
      }],
    },
    serviceZone: 1.1,
    ceilingBuildUp: .2,
    raisedFloor: .1,
    shaftArea: 15,
    plantArea: 110,
    factoredGravity: 32400,
    soilBearing: 200,
    rainfallIntensity: 80,
    outletCapacity: 4,
    sprinkler: false,
    facadeTolerance: 20,
    generatedAt: "2026-08-01T16:00:00.000Z",
  });

  assert.equal(model.schema, "ARKEM-BIM-COORDINATION/3.0");
  assert.equal(model.source.architectureConnected, true);
  assert.equal(model.source.structureConnected, true);
  assert.equal(model.source.authoritativeGeometry, true);
  assert.equal(model.coordinateSystem.reference, "EPSG:5254 · PROJECT ORIGIN 0,0,0");
  assert.equal(model.spatial.levels.length, 3);
  assert.equal(model.spatial.axes.x.length, 7);
  assert.equal(model.spatial.axes.y.length, 6);
  assert.deepEqual(model.federation.layers.map((item) => item.code), ["ARC", "STR", "MEP", "FIRE", "GEO", "CDE"]);
  assert.ok(model.clashes.length >= 2);
  assert.ok(model.clashes.some((item) => item.type === "hard" && item.severity === "critical"));
  assert.ok(model.clashes.every((item) => item.guid && item.disciplines.length >= 2 && item.location && item.evidence && item.assignee && item.sourceRefs.length));
  assert.equal(model.quantities.linkedToStructuralAlternative, true);
  assert.ok(model.quantities.structural.concreteVolumeM3 > 0);
  assert.ok(model.carbon.structuralKgCO2e > 0 && model.carbon.intensityKgCO2eM2 > 0);
  assert.ok(model.schedule4D.phases.length >= 4 && model.schedule4D.totalWeeks > 0);
  assert.equal(model.cost5D.linkedQuantities, true);
  assert.ok(model.cost5D.relativeStructuralCost > 0);
  assert.deepEqual(model.checks.map((item) => item.code), ["BIM-115-01", "BIM-115-02", "BIM-115-03", "BIM-115-04", "BIM-115-05", "BIM-115-06"]);
  assert.equal(model.interoperability.nativeIfcModel, false);
  assert.equal(model.interoperability.nativeBcfZip, false);
  assert.match(model.limitations.join(" "), /IFC|BCF|4B|5B|metraj|LCA|uygulama/i);

  const studio = fs.readFileSync(new URL("../app/components/EngineeringCoordinationStudio.tsx", import.meta.url), "utf8");
  for (const expected of [
    "V115 / BIM VE DİSİPLİN KOORDİNASYONU",
    "createBimCoordinationModel",
    "IFC4 hazırlık manifestosu",
    "BCF uyumlu issue",
    "4B / 5B",
  ]) assert.match(studio, new RegExp(expected.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), expected);

  const pack = fs.readFileSync(new URL("../app/lib/coordination-package.ts", import.meta.url), "utf8");
  assert.match(pack, /ARKEM-COORDINATION\/3\.0/);
  assert.match(pack, /previousSchema: "ARKEM-COORDINATION\/2\.0"/);
  assert.match(pack, /nativeIfcModel: false/);
  assert.match(pack, /nativeBcfZip: false/);

  const kernel = fs.readFileSync(new URL("../app/components/ProjectKernel.tsx", import.meta.url), "utf8");
  assert.match(kernel, /bimCoordination/);
  assert.match(kernel, /4B/);
  assert.match(kernel, /5B/);

  const core = fs.readFileSync(new URL("../app/lib/project-core.ts", import.meta.url), "utf8");
  assert.match(core, /ARKEM-BIM-COORDINATION\/3\.0/);
  assert.match(core, /BIM koordinasyonu/);

  const layout = fs.readFileSync(new URL("../app/layout.tsx", import.meta.url), "utf8");
  assert.match(layout, /import "\.\/v114\.css";\s*import "\.\/v115\.css";\s*import "\.\/v116\.css";\s*import "\.\/responsive\.css";/);
  const styles = fs.readFileSync(new URL("../app/v115.css", import.meta.url), "utf8");
  assert.match(styles, /\.v115-source-band/);
  assert.match(styles, /\.v115-clash-board/);
  assert.match(styles, /@media \(max-width: 430px\)/);
  assert.doesNotMatch(styles, /word-break:\s*break-all/);

  const health = fs.readFileSync(new URL("../app/api/health/route.ts", import.meta.url), "utf8");
  assert.match(health, /release: "V116"/);
  assert.match(health, /bimDisciplineCoordination/);
});

test("V116 turns coordination issues into accountable project controls and restores readable navigation", async () => {
  const { createProjectOperatingModel } = await import("../app/lib/project-os-2.ts");
  const model = createProjectOperatingModel({
    projectId: "ARK-26-V116",
    projectRevision: "P04",
    generatedAt: "2026-08-01T18:00:00.000Z",
    bimCoordination: {
      schema: "ARKEM-BIM-COORDINATION/3.0",
      clashes: [{
        guid: "BCF-STR-MEP-007",
        title: "Yangın hattı / ana kiriş çakışması",
        severity: "critical",
        disciplines: ["STR", "FIRE"],
        location: "Aks C-07 / +4.50",
        assignee: "MEP Koordinatörü",
        sourceRefs: ["STR-R05", "FIRE-R02"],
      }],
      schedule4D: { totalWeeks: 36, phases: [{ id: "PH-04", label: "Montaj", start: 14, end: 25 }] },
      cost5D: { linkedQuantities: true, relativeStructuralCost: 108 },
    },
  });

  assert.equal(model.schema, "ARKEM-PROJECT-OS/2.0");
  assert.equal(model.source.coordinationConnected, true);
  assert.ok(model.workItems.some((item) => item.sourceGuid === "BCF-STR-MEP-007"));
  assert.ok(model.workItems.every((item) => item.owner && item.dueDate && item.revision && item.source));
  assert.ok(model.healthGates.some((gate) => gate.code === "OS-116-OWNER-DUE"));
  assert.ok(model.revisions.some((item) => item.status === "current"));
  assert.ok(model.revisions.some((item) => item.status === "obsolete"));
  assert.equal(model.links.schedule4D.connected, true);
  assert.equal(model.links.cost5D.connected, true);
  assert.deepEqual(Object.keys(model.views), ["customer", "manager", "discipline", "field"]);
  assert.match(model.limitations.join(" "), /CDE|onaylı iş programı|maliyet|sunucu/i);

  const component = fs.readFileSync(new URL("../app/components/ProjectOperatingSystem.tsx", import.meta.url), "utf8");
  for (const expected of [
    "V116 / PROJECT OS 2.0",
    "createProjectOperatingModel",
    "Koordinasyondan gelen işler",
    "Sorumlu ve hedef tarih",
    "Revizyon kaydı",
    "ARKEM-PROJECT-OS/2.0",
  ]) assert.match(component, new RegExp(expected.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), expected);

  const resources = fs.readFileSync(new URL("../app/components/ResourceLibrary.tsx", import.meta.url), "utf8");
  assert.match(resources, /Proje Kontrolü/);
  assert.match(resources, /ISO 21502/);
  assert.match(resources, /Değişiklik ve RFI/);

  const blog = fs.readFileSync(new URL("../app/data/blog.ts", import.meta.url), "utf8");
  assert.match(blog, /rfi-karar-degisiklik-yonetimi/);
  assert.match(blog, /ortak-veri-ortami-revizyon-durumlari/);
  assert.match(blog, /saha-kalite-kaniti-ncr-kapatma/);

  const layout = fs.readFileSync(new URL("../app/layout.tsx", import.meta.url), "utf8");
  assert.match(layout, /import "\.\/v115\.css";\s*import "\.\/v116\.css";\s*import "\.\/responsive\.css";/);
  const styles = fs.readFileSync(new URL("../app/v116.css", import.meta.url), "utf8");
  assert.match(styles, /\.mega-panel-sections/);
  assert.match(styles, /\.project-guided-journey/);
  assert.match(styles, /\.v116-work-board/);
  assert.doesNotMatch(styles, /word-break:\s*break-all/);

  const health = fs.readFileSync(new URL("../app/api/health/route.ts", import.meta.url), "utf8");
  assert.match(health, /release: "V116"/);
  assert.match(health, /projectOperatingSystem2/);
});

test("Web V3.1 keeps the brand, navigation, conversion and technical-record foundations intact", async () => {
  const siteData = fs.readFileSync(new URL("../app/data/site.ts", import.meta.url), "utf8");
  for (const [label, href] of [
    ["HİZMETLER", "/hizmetler"],
    ["DİJİTAL ARAÇLAR", "/dijital-donusum"],
    ["PROJELER", "/projeler"],
    ["ARKEM", "/arkem"],
    ["İLETİŞİM", "/iletisim"],
  ]) {
    assert.match(siteData, new RegExp(`label: "${label}"[\\s\\S]{0,80}href: "${href}"`));
  }

  const home = [
    fs.readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8"),
    fs.readFileSync(new URL("../app/components/HomeV4.tsx", import.meta.url), "utf8"),
  ].join("\n");
  const projectData = fs.readFileSync(new URL("../app/data/projects-v3.ts", import.meta.url), "utf8");
  assert.match(home, /MÜHENDİSLİKTEN/);
  assert.match(home, /SAHAYA/);
  assert.match(home, /getPublicV3Projects\(\)/);
  assert.match(home, /\.filter\(\(project\) => project\.homepageFeatured\)/);
  assert.match(projectData, /Viakasta Entegre Orman Ürünleri/);
  assert.match(projectData, /Cihan Tat Gıda/);
  assert.match(projectData, /Yapıkur Plaza/);
  assert.match(projectData, /Devrekani BOSB/);
  assert.match(home, /"\/dijital-donusum"/);
  assert.doesNotMatch(home, /AI powered|YAPAY ZEKÂ DESTEKLİ/i);

  const arkemx = fs.readFileSync(new URL("../app/arkemx/page.tsx", import.meta.url), "utf8");
  assert.match(arkemx, /FARKLI SİSTEMLER/);
  assert.match(arkemx, /ORTAK PROJE VERİSİ/);
  assert.match(arkemx, /13 PROJE MÜHENDİSLİĞİ MODÜLÜ/i);
  assert.match(arkemx, /ANALİZDEN SAHAYA/);
  assert.doesNotMatch(arkemx, /AI powered|İnovasyon ve Performans Laboratuvarı|13 Teknoloji Yetkinliği/i);

  const legacyRoute = fs.readFileSync(new URL("../app/arkem-x/page.tsx", import.meta.url), "utf8");
  assert.match(legacyRoute, /redirect\("\/arkemx"\)/);

  const health = fs.readFileSync(new URL("../app/api/health/route.ts", import.meta.url), "utf8");
  assert.match(health, /service: "ARKEMX"/);
  assert.match(health, /websiteMaster: "arkem-web-v3\.4-template-zero"/);
  assert.match(health, /analyticsContract: "privacy-safe-data-layer-ready-provider-not-configured"/);

  const analytics = fs.readFileSync(new URL("../app/components/V21Analytics.tsx", import.meta.url), "utf8");
  for (const event of ["arkemx_page_view", "arkemx_module_open", "arkem:analytics", "arkem:track", "dataLayer"]) {
    assert.match(analytics, new RegExp(event.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  assert.doesNotMatch(analytics, /FormData|querySelector[^\n]*(?:input|textarea)|\.value\b/i);

  const brief = fs.readFileSync(new URL("../app/components/ProjectBriefForm.tsx", import.meta.url), "utf8");
  assert.match(brief, /accept="\.pdf,\.dwg,\.dxf,\.ifc,\.xlsx,\.jpg,\.jpeg,\.png,\.zip"/);
  assert.match(brief, /fetch\("\/api\/project-intake"/);
  assert.match(brief, /TEKNİK DEĞERLENDİRMEYE GÖNDER/);

  const blog = fs.readFileSync(new URL("../app/data/blog.ts", import.meta.url), "utf8");
  for (const slug of [
    "arkemx-ortak-proje-modeli",
    "prefabrik-hesaptan-uretime-veri-zinciri",
    "hibrit-yapi-sistemlerinde-koordinasyon",
    "model-degisikligi-metraj-uretim-saha-etkisi",
  ]) assert.match(blog, new RegExp(slug));
  assert.match(blog, /imageNote/);

  const styles = fs.readFileSync(new URL("../app/v21.css", import.meta.url), "utf8");
  assert.match(styles, /\.v21-home/);
  assert.match(styles, /\.v21-arkemx/);
  assert.match(styles, /@media \(max-width: 430px\)/);
  assert.match(styles, /content:none!important;display:none!important/);
  assert.match(styles, /\.site-nav \.mega-panel-sections a\{[^}]*background:#fff!important[^}]*color:#08293c!important/);
  assert.match(styles, /\.site-nav \.mega-panel-sections a:hover,[\s\S]*?background:#b96134!important;[\s\S]*?color:#fff!important/);
  assert.doesNotMatch(styles, /word-break:\s*break-all/);
});

test("Web V4 presents thirteen active and developing project modules with controlled homepage density", async () => {
  const home = fs.readFileSync(new URL("../app/components/HomeV4.tsx", import.meta.url), "utf8");
  const orderedSections = [
    "v4-hero",
    "v4-section v4-projects",
    "v4-section v4-systems",
    "v4-section v4-engineering",
    "v4-section v4-arkemx",
    "v4-section v4-methodology",
    "v4-section v4-outputs",
    "v4-section v4-about",
    "v4-section v4-contact",
  ];
  let cursor = -1;
  for (const section of orderedSections) {
    const next = home.indexOf(section);
    assert.ok(next > cursor, `${section} ana sayfada doğru sırada olmalı`);
    cursor = next;
  }
  assert.match(home, /DİJİTAL PROJE ARAÇLARI/i);
  assert.match(home, /YÖNLENDİRMELİ BAŞLA/i);
  assert.match(home, /MÜŞTERİ PROJE PORTALI/i);
  assert.match(home, /ARKEMX’in 13 mühendislik modülü/i);
  assert.doesNotMatch(home, /arkemXProjectModules/);

  const { arkemXCoreFamilies, arkemXValidationRecords } = await import("../app/data/arkemx-v22.ts");
  assert.deepEqual(arkemXCoreFamilies.map((family) => family.code), ["Core", "Concrete", "Precast", "Steel", "LightSteel", "Hybrid"]);
  assert.ok(arkemXCoreFamilies.every((family) => family.role && family.evidence && family.status));
  assert.deepEqual(arkemXValidationRecords.map((record) => record.result), ["55/55", "85/85", "38/38", "97/97"]);

  for (const principle of ["ANALİZ", "SİSTEM", "DETAY", "METRAJ", "SAHA"]) assert.match(home, new RegExp(principle, "i"));

  const arkemx = fs.readFileSync(new URL("../app/arkemx/page.tsx", import.meta.url), "utf8");
  for (const expected of [
    "AKTİF · SÜREKLİ GELİŞTİRİLİYOR",
    "FARKLI SİSTEMLER",
    "ORTAK PROJE VERİSİ",
    "13 PROJE MÜHENDİSLİĞİ MODÜLÜ",
    "DOĞRULAMA VE İZLENEBİLİRLİK",
    "ANALİZDEN SAHAYA",
    "Çalışanı koru",
    "DOĞRULANIYOR",
    "GELİŞİM YOL HARİTASI",
  ]) assert.match(arkemx, new RegExp(expected, "i"), expected);
  const registryExplorer = fs.readFileSync(new URL("../app/components/ArkemXRegistryExplorer.tsx", import.meta.url), "utf8");
  assert.match(registryExplorer, /ORTAK PROJE OMURGASI/i);
  assert.match(arkemx, /13 PROJE MÜHENDİSLİĞİ MODÜLÜ/i);
  assert.doesNotMatch(arkemx, /13 MODÜLÜMÜZ|AI powered|YAPAY ZEKÂ DESTEKLİ/i);
  assert.doesNotMatch(arkemx, /ARKEM projelerinde ARKEMX ile tüm statik hesapları|ARKEMX ile ruhsat projeleri|sahada aktif kullanılan/i);

  const siteData = fs.readFileSync(new URL("../app/data/site.ts", import.meta.url), "utf8");
  assert.match(siteData, /Ürün adı aramanıza gerek kalmadan/);
  assert.match(siteData, /Yeni proje başlat/);
  assert.match(siteData, /Mevcut projeme devam et/);

  const footer = fs.readFileSync(new URL("../app/components/SiteChrome.tsx", import.meta.url), "utf8");
  assert.match(footer, /© 2026/);
  assert.match(footer, /corporateRegistry\.legalEntity\.relationshipStatement/);
  assert.doesNotMatch(footer, /© 2025/i);

  const robots = fs.readFileSync(new URL("../app/robots.ts", import.meta.url), "utf8");
  const sitemap = fs.readFileSync(new URL("../app/sitemap.ts", import.meta.url), "utf8");
  assert.match(robots, /site\.domain/);
  assert.match(sitemap, /site\.domain/);

  const health = fs.readFileSync(new URL("../app/api/health/route.ts", import.meta.url), "utf8");
  assert.match(health, /websiteMaster: "arkem-web-v3\.4-template-zero"/);
  assert.match(health, /engineeringPreview: "active-continuous-development-with-explicit-boundaries"/);

  const v22Styles = fs.readFileSync(new URL("../app/v22.css", import.meta.url), "utf8");
  assert.match(v22Styles, /mega-panel-sections a\{[^}]*background:#fff!important[^}]*color:#102d3f!important/);
  assert.match(v22Styles, /mega-panel-sections a:hover,[^}]*background:#b96134!important[^}]*color:#fff!important/);
  assert.match(v22Styles, /language-menu-panel>button[^}]*background:rgba\(255,255,255,\.055\)!important[^}]*color:#fff!important/);
  assert.doesNotMatch(v22Styles, /word-break:\s*break-all/);

  for (const relativePath of [
    "../app/dijital-proje-merkezi/page.tsx",
    "../app/dijital-donusum/page.tsx",
    "../app/proje-zekasi/page.tsx",
    "../app/components/DigitalProjectHub.tsx",
    "../app/components/ProjectStartStudio.tsx",
    "../app/components/ProjectIntelligenceCenter.tsx",
    "../app/components/PremiumExperience.tsx",
    "../app/components/SocialContentFeed.tsx",
  ]) {
    const source = fs.readFileSync(new URL(relativePath, import.meta.url), "utf8");
    assert.doesNotMatch(source, /13\s*(?:modül|bağlı)|on üç (?:uygulama|modül)|yapay zekâ destekli/i, relativePath);
  }
});

test("Web V3.1 freezes thirteen customer-facing engineering modules in one central registry", async () => {
  const {
    arkemXProjectCategories,
    arkemXProjectModules,
    arkemXIntegrationLayers,
    arkemXSharedServices,
    arkemXValidationPublication,
  } = await import("../app/data/arkemx-v3.ts");

  assert.equal(arkemXProjectCategories.length, 5);
  assert.equal(arkemXProjectModules.length, 13);
  assert.deepEqual(
    arkemXProjectModules.map((module) => module.code),
    Array.from({ length: 13 }, (_, index) => String(index + 1).padStart(2, "0")),
  );
  assert.deepEqual(
    arkemXProjectModules.map((module) => module.title),
    [
      "Proje Modeli",
      "Yapısal Analiz",
      "Deprem Mühendisliği",
      "Betonarme",
      "Prefabrik Betonarme",
      "Yapısal Çelik",
      "Hafif Çelik",
      "Hibrit Sistemler",
      "Temel ve Zemin Etkileşimi",
      "Detay ve İmalat",
      "Metraj ve Maliyet",
      "Doğrulama ve İzlenebilirlik",
      "Yapım Aşaması ve Saha",
    ],
  );
  assert.ok(arkemXProjectModules.every((module) =>
    module.problem &&
    module.inputs.length &&
    module.process.length &&
    module.connections.length &&
    module.outputs.length &&
    module.status &&
    module.boundary
  ));
  assert.deepEqual(arkemXIntegrationLayers.map((item) => item.title), ["BIM ve Veri Bağlantıları"]);
  assert.deepEqual(arkemXSharedServices.map((item) => item.title), ["Raporlama ve Dokümantasyon"]);
  assert.equal(arkemXValidationPublication.publishExactCounts, false);
  assert.equal(arkemXValidationPublication.verifiedOn, null);
  assert.match(arkemXValidationPublication.sourceStatus, /manifestosu bekleniyor/i);

  const arkemx = fs.readFileSync(new URL("../app/arkemx/page.tsx", import.meta.url), "utf8");
  for (const expected of [
    "02 / 13 PROJE MÜHENDİSLİĞİ MODÜLÜ",
    "03 / ÇALIŞAN PROJE AKIŞI",
    "04 / KARARIN ZİNCİRLEME ETKİSİ",
    "05 / ANALİZDEN SAHAYA",
    "06 / DOĞRULAMA VE İZLENEBİLİRLİK",
    "07 / GELİŞİM GÜNLÜĞÜ",
    "08 / GELİŞİM YOL HARİTASI",
    "ArkemXRegistryExplorer",
    "AKTİF · SÜREKLİ GELİŞTİRİLİYOR",
  ]) assert.match(arkemx, new RegExp(expected, "i"), expected);
  const explorer = fs.readFileSync(new URL("../app/components/ArkemXRegistryExplorer.tsx", import.meta.url), "utf8");
  assert.match(explorer, /ORTAK PROJE OMURGASI/i);
  for (const expected of ["NEYİ ÇÖZER?", "GİRDİLER", "BAĞLI MODÜLLER", "ÇIKTILAR", "TEKNİK DOĞRULAMA", "SON GELİŞTİRMELER"]) {
    assert.match(explorer, new RegExp(expected, "i"), expected);
  }
  assert.match(arkemx, /13 PROJE MÜHENDİSLİĞİ MODÜLÜ/i);
  assert.match(arkemx, /kaynak kodundaki klasör veya teknik bileşen sayısı değildir/i);
  assert.doesNotMatch(arkemx, /\{record\.result\}/);
  assert.doesNotMatch(arkemx, /tüm projelerimizde kullanılmaktadır|ruhsat projesi hazırlıyoruz|sahada aktif kullanılan/i);

  const home = fs.readFileSync(new URL("../app/components/HomeV4.tsx", import.meta.url), "utf8");
  assert.match(home, /ARKEMX’in 13 mühendislik modülü/);
  assert.match(home, /teknik platform görünümünde korunur/);
  assert.doesNotMatch(home, /arkemXProjectModules/);

  const layout = fs.readFileSync(new URL("../app/layout.tsx", import.meta.url), "utf8");
  assert.match(layout, /import "\.\/v22\.css";\s*import "\.\/v3\.css";/);

  const styles = fs.readFileSync(new URL("../app/v3.css", import.meta.url), "utf8");
  assert.match(styles, /\.arkem-mobile-nav-groups > section > button b\s*\{[^}]*color:\s*#102d3f\s*!important[^}]*opacity:\s*1\s*!important[^}]*visibility:\s*visible\s*!important/s);
  assert.match(styles, /\.arkem-mobile-nav-groups > section\.is-open > button\s*\{[^}]*background:\s*#12394c\s*!important[^}]*color:\s*#fff\s*!important/s);
  assert.match(styles, /\.arkem-mobile-nav-groups > section > button:hover,[\s\S]*?box-shadow:\s*inset 5px 0 #bd6738\s*!important/);
  assert.match(styles, /\.site-nav \.mega-panel-sections a:hover,[\s\S]*?background:\s*#a9512b\s*!important[\s\S]*?color:\s*#fff\s*!important/);
  assert.match(styles, /\.arkem-mobile-nav-groups > section > div > section > a:hover,[\s\S]*?background:\s*#a9512b\s*!important[\s\S]*?color:\s*#fff\s*!important/);
  assert.match(styles, /@media \(max-width: 430px\)/);
  assert.doesNotMatch(styles, /word-break:\s*break-all/);
});

test("Web V3.1 keeps working ARKEMX modules accessible while clearly marking active development", async () => {
  assert.equal(PROJECT_MODULES.length, 13);
  const { arkemXModuleRegistry } = await import("../app/data/arkemx-module-registry.ts");

  const arkemx = fs.readFileSync(new URL("../app/arkemx/page.tsx", import.meta.url), "utf8");
  for (const expected of [
    "ArkemXRegistryExplorer",
    "ÇALIŞAN PROJE AKIŞI",
    "AKTİF · GELİŞTİRİLİYOR",
    "PROJE MÜHENDİSLİĞİ MODÜLÜ",
    "DOĞRULANIYOR",
  ]) assert.match(arkemx, new RegExp(expected, "i"), expected);
  assert.doesNotMatch(arkemx, /EcosystemCommandMap|ArkemXLab|id="laboratuvar"/);

  const explorer = fs.readFileSync(new URL("../app/components/ArkemXRegistryExplorer.tsx", import.meta.url), "utf8");
  assert.match(explorer, /selectedGroupId[\s\S]*?null/);
  assert.match(explorer, /selectedModuleId[\s\S]*?null/);
  assert.match(explorer, /createPortal/);
  assert.match(explorer, /role="dialog"/);

  const { v3Translations } = await import("../app/data/i18n-v3.ts");
  const { v3fTranslationSources } = await import("../app/data/i18n-v3f.ts");
  for (const language of ["en", "az", "ru", "it", "de", "fr"]) {
    assert.ok(v3fTranslationSources.every((phrase) => v3Translations[language][phrase]
      && v3Translations[language][phrase] !== phrase), `${language}: çalışan modül metinlerinin tamamı yerelleştirilmeli`);
  }

  for (const projectModule of arkemXModuleRegistry) {
    const [pathname, anchor] = projectModule.workingRoute.split("#");
    const page = new URL(`../app${pathname}/page.tsx`, import.meta.url);
    assert.ok(fs.existsSync(page), `${projectModule.code}: ${pathname} sayfası bulunmalı`);
    if (anchor) {
      const source = fs.readFileSync(page, "utf8");
      assert.match(source, new RegExp(`id=["']${anchor}["']`), `${projectModule.code}: #${anchor} hedefi bulunmalı`);
    }
  }

  const response = await render("/arkemx");
  assert.equal(response.status, 200);
  const html = await response.text();
  for (const expected of [
    "ÇALIŞAN PROJE AKIŞI",
    "AKTİF · GELİŞTİRİLİYOR",
    "13 PROJE MÜHENDİSLİĞİ MODÜLÜ",
  ]) assert.match(html, new RegExp(expected, "i"), expected);
  assert.doesNotMatch(html, /data-testid="ecosystem-command-map"|data-testid="arkem-x-lab"/i);
});

test("Web V3.0 localizes its critical ARKEMX product contract in every supported language", async () => {
  const { v3CriticalPhrases, v3Translations } = await import("../app/data/i18n-v3.ts");
  const languages = ["en", "az", "ru", "it", "de", "fr"];
  const criticalPhrases = [
    "FARKLI SİSTEMLER.",
    "ORTAK PROJE VERİSİ.",
    "GELİŞTİRME ÖNİZLEMESİ",
    "13 Proje Mühendisliği Modülü",
    "Modelleme ve Analiz",
    "Yapı Sistemleri",
    "Proje ve Üretim",
    "Doğrulama",
    "Yapım ve Saha",
    "Proje Modeli",
    "Analiz Motoru",
    "Deprem Mühendisliği",
    "Betonarme",
    "Prefabrik Betonarme",
    "Yapısal Çelik",
    "Hafif Çelik",
    "Hibrit Sistemler",
    "Temel ve Zemin Etkileşimi",
    "Detay ve İmalat",
    "Metraj ve Maliyet Bağlantısı",
    "Doğrulama ve İzlenebilirlik",
    "Yapım Aşaması ve Saha",
    "Ortak proje verisi",
    "Ortak Proje Verisi",
    "Teknik çekirdek",
    "Teknik Çekirdek",
    "Platform ve proje verisi",
    "Doğrulama ve gelişim",
    "Kararın zincirleme etkisi",
    "Kararın Zincirleme Etkisi",
    "Yapım aşamaları",
    "Yapım Aşamaları",
    "Doğrulama kültürü",
    "Doğrulama Kültürü",
    "Gelişim yol haritası",
    "Gelişim Yol Haritası",
    "Mühendislik Ar-Ge Platformu",
    "NEYİ ÇÖZER?",
    "GELİŞTİRME DURUMU",
    "ENTEGRASYON",
    "DOĞRULAMA",
    "İZLENEBİLİRLİK",
    "YAPIM GERÇEKLİĞİ",
    "DOĞRULAMA ALANI",
    "DOĞRULAMA KAYNAK DURUMU",
    "Kaynak manifestosu bekleniyor",
    "DOĞRULAMA TARİHİ · YAYIN İÇİN DOĞRULANMADI",
    "Güncel sürüm, tarih ve kaynak manifestosu bağlanmadan kesin test sayıları yayımlanmaz.",
    "Teknik paket adı: ARKEMX ENGINEERING PREVIEW v0.1.0 · Nihai üretim yazılımı değildir.",
    "Ortak proje modeli geliştirme önizlemesidir; yetkili uygulama modeli değildir.",
    "Genel uçtan uca yerel proje çözümü henüz üretim kullanımına açık değildir.",
    "Yönetmelik kapsamı ve doğrulama seti tamamlanmadan proje güvenlik kararı vermez.",
    "Betonarme ürün ailesi üretim projesi veya ruhsat hesabı olarak kullanılamaz.",
    "Prefabrik bağlantı ve yapım aşaması çalışmaları geliştirme doğrulamasıdır; üretim onayı değildir.",
    "Çelik ürün ailesi üretim kullanımı veya yetkili birleşim tasarımı için açık değildir.",
    "Hafif çelik doğrulamaları tanımlı geliştirme senaryolarıyla sınırlıdır.",
    "Hibrit sistem yaklaşımı ürün mimarisi hedefidir; genel proje çözümü tamamlanmamıştır.",
    "Geoteknik tasarım kapsamı yalnız doğrulanmış implementasyon seviyesinde açılır.",
    "Üretilen teknik veri yetkili imalat paftası değildir; uzman kontrolü gerektirir.",
    "Birim fiyat ve ARKEM Cost bağlantısı ürün olgunluğu doğrulanana kadar aktif ürün özelliği değildir.",
    "Doğrulanan geliştirme altyapısı, tek başına gerçek proje sonucunun doğrulandığı anlamına gelmez.",
    "Saha ve yapım aşaması verisi uygulama talimatı veya güvenlik kararı yerine geçmez.",
    "MÜHENDİSLİK AR-GE PLATFORMU · GELİŞTİRME ÖNİZLEMESİ",
    "00 / ARKEMX NEDİR?",
    "01 / NEDEN GELİŞTİRİYORUZ?",
    "02 / ORTAK PROJE VERİSİ",
    "03 / TEKNİK ÇEKİRDEK",
    "04 / YAPI SİSTEMLERİ",
    "05 / 13 PROJE MODÜLÜ",
    "06 / KARARIN ZİNCİRLEME ETKİSİ",
    "07 / YAPIM AŞAMALARI",
    "08 / DOĞRULAMA KÜLTÜRÜ",
    "09 / SAHADAN DOĞAN MÜHENDİSLİK",
    "10 / GELİŞİM YOL HARİTASI",
    "MÜŞTERİYE DÖNÜK ÜRÜN MİMARİSİ",
    "MODÜLLERİ AÇ",
    "GİRDİLERİ",
    "MÜHENDİSLİK İŞLEMİ",
    "BAĞLI MODÜLLER",
    "ÇIKTILARI",
    "GELİŞTİRME SINIRI",
    "ENTEGRASYON KATMANI",
    "ORTAK PLATFORM SERVİSİ",
    "DOĞRULAMA SINIRI",
    "İZLENEBİLİRLİK HEDEFİ",
    "ÜRÜN KULLANIM SINIRI",
    "ÜRETİM GÜVENLİK PRENSİBİ",
    "ARKEMX v1.8 doğrulama özeti",
    "ARŞİV DOĞRULAMASI",
    "KISMİ DOĞRULAMA",
    "PROJE KAYDI",
    "VAKA ÇALIŞMASI",
    "KANIT MANİFESTOSU",
    "KAPSAM SINIRI",
    "MEDYA DURUMU",
    "GEREKLİ KANIT",
    "LOKASYON",
    "YAPI TÜRÜ",
    "SİSTEM",
    "İhtiyaç",
    "Kısıt",
    "Sistem Kararı",
    "Mühendislik",
    "Detay",
    "Üretim",
    "Uygulama",
    "Sonuç",
    "Kanıt dosyasını inceleyin",
    "Gerçek proje medyası bekleniyor.",
    "Bilmediğimizi tamamlamıyoruz.",
    "YAYIN GÜVENLİĞİ",
  ];

  assert.ok(criticalPhrases.every((phrase) => v3CriticalPhrases.includes(phrase)));

  for (const language of languages) {
    const catalogue = v3Translations[language];
    for (const phrase of criticalPhrases) {
      assert.ok(catalogue[phrase], `${language}: missing ${phrase}`);
      assert.notEqual(catalogue[phrase], phrase, `${language}: ${phrase}`);
    }
  }

  const i18n = fs.readFileSync(new URL("../app/data/i18n.ts", import.meta.url), "utf8");
  assert.match(i18n, /import \{ v3Translations \} from "\.\/i18n-v3\.ts"/);
  assert.match(i18n, /v3Translations\.en\[source\]/);
  assert.match(i18n, /v3Translations\[language\]\[source\]/);
});

test("Web V3.1 publishes four source-aware project records from one honest data contract", async () => {
  const { v3Projects } = await import("../app/data/projects-v3.ts");

  assert.equal(v3Projects.length, 4);
  assert.deepEqual(
    v3Projects.map((project) => project.slug),
    ["viakasta", "cihan-tat", "yapikur-plaza", "devrekani-bosb"],
  );
  assert.equal(new Set(v3Projects.map((project) => project.code)).size, 4);
  assert.ok(v3Projects.every((project) => project.archiveVisible));
  assert.equal(v3Projects.filter((project) => project.homepageFeatured).length, 3);
  assert.equal(v3Projects.filter((project) => project.heroFeatured).length, 1);
  assert.ok(v3Projects.every((project) => project.caseStudy.length === 7));
  assert.deepEqual(
    v3Projects[0].caseStudy.map((stage) => stage.title),
    ["Proje İhtiyacı", "Teknik Kısıtlar", "Sistem Kararı", "Mühendislik Yaklaşımı", "Detay / Üretim", "Saha", "Sonuç"],
  );
  assert.ok(v3Projects.every((project) =>
    Object.values(project.facts).every((fact) => fact.value && fact.status && fact.source)
  ));
  assert.ok(v3Projects.every((project) => project.media.status === "doğrulandı"));
  assert.ok(v3Projects.every((project) => project.media.items.length > 0));
  assert.ok(v3Projects.every((project) => project.archiveMedia.length > 0));
  assert.doesNotMatch(JSON.stringify(v3Projects), /ARKEMX ile tasarlandı|ARKEMX kullanıldı/i);

  const listing = fs.readFileSync(new URL("../app/projeler/page.tsx", import.meta.url), "utf8");
  const archiveExplorer = fs.readFileSync(new URL("../app/components/ProjectArchiveExplorer.tsx", import.meta.url), "utf8");
  assert.match(listing, /import \{ getPublicV3Projects \} from "\.\.\/lib\/public-projects"/);
  assert.match(listing, /const projects = \(await getPublicV3Projects\(\)\)\.filter\(\(project\) => project\.archiveVisible\)/);
  assert.match(listing, /ProjectArchiveExplorer projects=\{projects\}/);
  assert.match(archiveExplorer, /href=\{`\/projeler\/\$\{project\.slug\}`\}/);
  assert.doesNotMatch(listing, /const projects\s*=\s*\[/);

  const detail = fs.readFileSync(new URL("../app/projeler/[slug]/page.tsx", import.meta.url), "utf8");
  assert.match(detail, /generateStaticParams/);
  assert.match(detail, /PROJE KÜNYESİ/);
  assert.match(detail, /KAPSAM SINIRI/);
  assert.match(detail, /TEKNİK KAYIT/);
  assert.match(detail, /KAYNAK KONTROLÜ/);
  assert.match(detail, /project\.caseStudy\.map/);

  const home = fs.readFileSync(new URL("../app/components/HomeV4.tsx", import.meta.url), "utf8");
  assert.match(home, /import \{ getPublicV3Projects \} from "\.\.\/lib\/public-projects"/);
  assert.doesNotMatch(home, /const selectedProjects\s*=\s*\[/);

  const navigation = fs.readFileSync(new URL("../app/data/site.ts", import.meta.url), "utf8");
  assert.doesNotMatch(navigation, /projects-v3|selectedProjectNavigation/);
  assert.match(navigation, /label: "PROJELER"[\s\S]*?href: "\/projeler"[\s\S]*?sections: \[\]/);

  const sitemap = fs.readFileSync(new URL("../app/sitemap.ts", import.meta.url), "utf8");
  assert.match(sitemap, /v3Projects\.map\(\(project\) => \[`\/projeler\/\$\{project\.slug\}`/);

  const styles = fs.readFileSync(new URL("../app/v3.css", import.meta.url), "utf8");
  assert.match(styles, /\.v3-project-case li\s*\{[^}]*grid-template-columns:\s*70px minmax\(0, 1fr\) minmax\(250px, \.55fr\)/s);
  assert.match(styles, /@media \(max-width: 430px\)[\s\S]*?\.v3-project-case li\s*\{[^}]*grid-template-columns:\s*28px minmax\(0, 1fr\)/s);
  assert.doesNotMatch(styles, /word-break:\s*break-all/);

  for (const project of v3Projects) {
    const response = await render(`/projeler/${project.slug}`);
    assert.equal(response.status, 200, project.slug);
    const html = await response.text();
    assert.match(html, new RegExp(project.shortTitle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), project.slug);
    assert.match(html, /PROJE KÜNYESİ/);
    assert.match(html, /TEKNİK KAYIT/);
    assert.match(html, /KAYNAK KONTROLÜ/);
    assert.doesNotMatch(html, /ARKEMX ile tasarlandı|ARKEMX kullanıldı/i);
    const schemas = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)]
      .map((match) => JSON.parse(match[1]));
    const projectPageSchema = schemas.find((schema) => schema["@type"] === "WebPage" && schema.url?.endsWith(`/projeler/${project.slug}`));
    assert.ok(projectPageSchema, `${project.slug}: WebPage schema`);
    assert.equal(projectPageSchema.publisher?.name, "ARKEM Yapı Sistemleri");
    assert.ok(!("creator" in projectPageSchema), `${project.slug}: creator must wait for role evidence`);
    assert.ok(!("provider" in projectPageSchema), `${project.slug}: provider must wait for role evidence`);
    assert.ok(!("contractor" in projectPageSchema), `${project.slug}: contractor must wait for role evidence`);
  }
});

test("Web V3.0-C keeps project evidence private until the verified publication gate", async () => {
  const {
    applyPublishedProjectEvidence,
    canPublishProjectEvidence,
    resolveProjectEvidenceTransition,
  } = await import("../app/lib/project-evidence.ts");
  const {
    isCmsEditorEmail,
    parseProjectCmsEditors,
    resolveCmsEditorAccess,
  } = await import("../app/lib/project-cms-policy.ts");

  assert.equal(resolveProjectEvidenceTransition("received", "start_review"), "in_review");
  assert.equal(resolveProjectEvidenceTransition("in_review", "verify"), "verified");
  assert.equal(resolveProjectEvidenceTransition("verified", "publish"), "published");
  assert.equal(resolveProjectEvidenceTransition("published", "withdraw"), "verified");
  assert.throws(() => resolveProjectEvidenceTransition("received", "publish"), /geçiş/i);

  assert.equal(canPublishProjectEvidence({
    status: "verified",
    targetType: "fact",
    targetKey: "year",
    claimValue: "Betonarme prefabrik",
    sourceLabel: "Onaylı statik uygulama paftası",
    fileKey: "project-evidence/cihan-tat/evidence.pdf",
  }), true);
  assert.equal(canPublishProjectEvidence({
    status: "received",
    targetType: "fact",
    targetKey: "system",
    claimValue: "Betonarme prefabrik",
    sourceLabel: "Onaylı statik uygulama paftası",
    fileKey: "project-evidence/cihan-tat/evidence.pdf",
  }), false);

  const base = projectRecords.find((project) => project.slug === "cihan-tat");
  assert.ok(base);
  const unpublished = applyPublishedProjectEvidence(base, [{
    id: "EVD-001",
    projectSlug: "cihan-tat",
    targetType: "fact",
    targetKey: "system",
    claimValue: "Yayımlanmamalı",
    sourceLabel: "İç kayıt",
    status: "verified",
    fileName: null,
    contentType: null,
  }]);
  assert.equal(unpublished.facts.year.value, "Yıl bilgisi yayın kaydında açıklanmadı");
  const published = applyPublishedProjectEvidence(base, [{
    id: "EVD-002",
    projectSlug: "cihan-tat",
    targetType: "fact",
    targetKey: "year",
    claimValue: "2026",
    sourceLabel: "Onaylı statik uygulama paftası",
    status: "published",
    fileName: "statik-proje.pdf",
    contentType: "application/pdf",
  }]);
  assert.equal(published.facts.year.value, "2026");
  assert.equal(published.facts.year.status, "doğrulandı");
  assert.equal(published.sourceManifest.find((item) => item.label === "Yıl")?.value, "2026");

  assert.deepEqual(parseProjectCmsEditors("editor@arkem.test, EDITOR@arkem.test, second@arkem.test"), [
    "editor@arkem.test",
    "second@arkem.test",
  ]);
  assert.equal(isCmsEditorEmail("EDITOR@arkem.test", "editor@arkem.test"), true);
  assert.equal(isCmsEditorEmail("visitor@arkem.test", "editor@arkem.test"), false);
  assert.equal(isCmsEditorEmail("editor@arkem.test", undefined), false);
  assert.equal(resolveCmsEditorAccess(null, "editor@arkem.test"), "unauthenticated");
  assert.equal(resolveCmsEditorAccess("visitor@arkem.test", "editor@arkem.test"), "forbidden");
  assert.equal(resolveCmsEditorAccess("editor@arkem.test", "editor@arkem.test"), "authorized");


  const schema = fs.readFileSync(new URL("../db/schema.ts", import.meta.url), "utf8");
  assert.match(schema, /project_evidence_items/);
  assert.match(schema, /project_evidence_events/);
  assert.match(schema, /file_sha256/);
  assert.match(schema, /published_at/);

  const api = fs.readFileSync(new URL("../app/api/project-evidence/route.ts", import.meta.url), "utf8");
  assert.match(api, /MAX_EVIDENCE_FILE_BYTES/);
  assert.match(api, /projectEvidenceBucket/);
  assert.match(api, /bucket\.put/);
  assert.match(api, /resolveProjectEvidenceTransition/);
  assert.match(api, /expectedStatus/);
  assert.match(api, /fileSha256/);
  assert.match(api, /content-length/);
  assert.match(api, /contentTypesByExtension\[extension\]/);
  assert.doesNotMatch(api, /const contentType = file\.type/);

  const cms = fs.readFileSync(new URL("../app/uyelik/proje-kanitlari/page.tsx", import.meta.url), "utf8");
  assert.match(cms, /getProjectCmsAuthorization/);
  assert.match(cms, /ProjectEvidenceCenter/);

  const detail = fs.readFileSync(new URL("../app/projeler/[slug]/page.tsx", import.meta.url), "utf8");
  assert.match(detail, /getPublishedProjectEvidence/);
  assert.match(detail, /applyPublishedProjectEvidence/);

  const anonymousApiResponse = await render("/api/project-evidence");
  assert.equal(anonymousApiResponse.status, 401);
  assert.deepEqual(await anonymousApiResponse.json(), { error: "Oturum açmanız gerekiyor." });

  const health = fs.readFileSync(new URL("../app/api/health/route.ts", import.meta.url), "utf8");
  assert.match(health, /websiteRelease: "V3\.4"/);
  assert.match(health, /verified-publication-gate/);
  assert.match(health, /getProjectEvidenceRuntimeStatus/);
});

test("Web V3.0-C keeps one active public claim and recovers safely from withdrawal or network failure", async () => {
  const evidenceDb = new DatabaseSync(":memory:");
  const migrations = fs.readdirSync(new URL("../drizzle", import.meta.url))
    .filter((name) => /^000[123]_.+\.sql$/.test(name))
    .sort();
  assert.equal(migrations.length, 3, "The evidence runtime requires schema, concurrency hardening and capability publication migrations");
  for (const migration of migrations) evidenceDb.exec(fs.readFileSync(new URL(`../drizzle/${migration}`, import.meta.url), "utf8"));

  const insert = evidenceDb.prepare(`INSERT INTO project_evidence_items (
    id, project_slug, target_type, target_key, claim_value, source_label, status,
    created_by, created_at, updated_at, transition_token
  ) VALUES (?, 'cihan-tat', ?, ?, 'değer', 'kaynak', 'published', 'editor@arkem.test', '2026-08-09', '2026-08-09', ?)`);
  insert.run("EVD-FACT-1", "fact", "system", "TOKEN-1");
  assert.throws(() => insert.run("EVD-FACT-2", "fact", "system", "TOKEN-2"), /unique/i);
  insert.run("EVD-MEDIA-1", "media", "media", "TOKEN-3");
  insert.run("EVD-MEDIA-2", "media", "media", "TOKEN-4");

  const api = fs.readFileSync(new URL("../app/api/project-evidence/route.ts", import.meta.url), "utf8");
  assert.match(api, /transitionToken/);
  assert.match(api, /NOT EXISTS/);
  assert.match(api, /bucket\.head\(current\.fileKey\)/);
  assert.match(api, /projectEvidenceObjectMatchesRecord/);
  const hardeningMigration = fs.readFileSync(new URL(`../drizzle/${migrations[1]}`, import.meta.url), "utf8");
  assert.match(hardeningMigration, /project_evidence_single_published_idx/);

  const store = fs.readFileSync(new URL("../app/lib/project-evidence-store.ts", import.meta.url), "utf8");
  assert.doesNotMatch(store, /CREATE TABLE IF NOT EXISTS/);
  assert.match(store, /PRAGMA table_info\(project_evidence_items\)/);
  assert.match(store, /PRAGMA index_list\(project_evidence_items\)/);
  assert.match(store, /bucket\.list\(\{ limit: 1 \}\)/);

  const {
    projectEvidenceObjectMatchesRecord,
    projectEvidenceSchemaIsReady,
    resolveProjectEvidenceHealthStatus,
  } = await import("../app/lib/project-evidence-store.ts");
  const expectedObject = { fileSize: 128, fileSha256: "abc123" };
  assert.equal(projectEvidenceObjectMatchesRecord(null, expectedObject), false);
  assert.equal(projectEvidenceObjectMatchesRecord({ size: 127, customMetadata: { fileSha256: "abc123" } }, expectedObject), false);
  assert.equal(projectEvidenceObjectMatchesRecord({ size: 128, customMetadata: { fileSha256: "wrong" } }, expectedObject), false);
  assert.equal(projectEvidenceObjectMatchesRecord({ size: 128, customMetadata: { fileSha256: "abc123" } }, expectedObject), true);

  const schemaSnapshot = (database) => ({
    tables: database.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name IN ('project_evidence_items', 'project_evidence_events')").all().map((row) => row.name),
    itemColumns: database.prepare("PRAGMA table_info(project_evidence_items)").all().map((row) => row.name),
    eventColumns: database.prepare("PRAGMA table_info(project_evidence_events)").all().map((row) => row.name),
    itemIndexes: database.prepare("PRAGMA index_list(project_evidence_items)").all().map((row) => row.name),
    eventIndexes: database.prepare("PRAGMA index_list(project_evidence_events)").all().map((row) => row.name),
    singlePublishedIndexSql: database.prepare("SELECT sql FROM sqlite_master WHERE type = 'index' AND name = 'project_evidence_single_published_idx'").get()?.sql || "",
  });
  assert.equal(projectEvidenceSchemaIsReady(schemaSnapshot(evidenceDb)), true);
  const outdatedEvidenceDb = new DatabaseSync(":memory:");
  outdatedEvidenceDb.exec(fs.readFileSync(new URL(`../drizzle/${migrations[0]}`, import.meta.url), "utf8"));
  assert.equal(projectEvidenceSchemaIsReady(schemaSnapshot(outdatedEvidenceDb)), false);

  assert.equal(resolveProjectEvidenceHealthStatus({ database: "ready", storage: "ready" }), "ok");
  assert.equal(resolveProjectEvidenceHealthStatus({ database: "outdated", storage: "ready" }), "degraded");
  assert.equal(resolveProjectEvidenceHealthStatus({ database: "ready", storage: "unavailable" }), "degraded");

  const health = fs.readFileSync(new URL("../app/api/health/route.ts", import.meta.url), "utf8");
  assert.match(health, /resolveProjectEvidenceHealthStatus/);
  assert.match(health, /status: resolveProjectEvidenceHealthStatus\(projectEvidenceRuntime\)/);

  const fileRoute = fs.readFileSync(new URL("../app/api/project-evidence/file/[id]/route.ts", import.meta.url), "utf8");
  assert.match(fileRoute, /"Cache-Control": "no-store"/);

  const center = fs.readFileSync(new URL("../app/components/ProjectEvidenceCenter.tsx", import.meta.url), "utf8");
  assert.match(center, /finally/);

  const home = [
    fs.readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8"),
    fs.readFileSync(new URL("../app/components/HomeV4.tsx", import.meta.url), "utf8"),
  ].join("\n");
  const index = fs.readFileSync(new URL("../app/projeler/page.tsx", import.meta.url), "utf8");
  assert.match(home, /getPublicV3Projects/);
  assert.match(index, /getPublicV3Projects/);

  const { evidenceFileMatchesExtension } = await import("../app/lib/project-evidence-file.ts");
  const bytes = (value) => new TextEncoder().encode(value);
  assert.equal(evidenceFileMatchesExtension("pdf", bytes("%PDF-1.7\n")), true);
  assert.equal(evidenceFileMatchesExtension("pdf", bytes("<html><script>alert(1)</script>")), false);
  assert.equal(evidenceFileMatchesExtension("ifc", bytes("ISO-10303-21;\nHEADER;")), true);
  assert.equal(evidenceFileMatchesExtension("ifc", bytes("<html>not an IFC model</html>")), false);
  assert.equal(evidenceFileMatchesExtension("zip", Uint8Array.from([0x50, 0x4b, 0x03, 0x04, 0x00])), true);
});

test("Web V3.0-D turns system and engineering pages into evidence-led technical records", async () => {
  const {
    matchesStructuralSystemEvidence,
    primaryStructuralSystems,
    structuralSystems,
  } = await import("../app/data/structural-systems.ts");
  const {
    engineeringCapabilities,
  } = await import("../app/data/engineering-v3.ts");
  const { v3Translations } = await import("../app/data/i18n-v3.ts");
  const { v3dTranslationSources } = await import("../app/data/i18n-v3d.ts");

  assert.deepEqual(primaryStructuralSystems.map((system) => system.id), ["precast", "steel", "light", "hybrid"]);
  assert.equal(structuralSystems.length, 5, "The supporting reinforced-concrete guide remains addressable");
  const verifiedPrecast = { label: "Taşıyıcı sistem", value: "Betonarme prefabrik", status: "doğrulandı", source: "Onaylı pafta" };
  const pendingPrecast = { ...verifiedPrecast, status: "arşiv doğrulaması" };
  assert.equal(matchesStructuralSystemEvidence(primaryStructuralSystems[0], verifiedPrecast), true);
  assert.equal(matchesStructuralSystemEvidence(primaryStructuralSystems[0], pendingPrecast), false);
  assert.equal(matchesStructuralSystemEvidence(primaryStructuralSystems[1], { ...verifiedPrecast, value: "Hafif çelik" }), false);

  assert.equal(engineeringCapabilities.length, 8);
  assert.ok(engineeringCapabilities.every((capability) => capability.input && capability.decision && capability.output && capability.evidenceNeeded));
  const capabilityPhrases = engineeringCapabilities.flatMap((capability) => [
    capability.title,
    capability.summary,
    capability.input,
    capability.decision,
    capability.output,
    capability.evidenceNeeded,
  ]);
  assert.ok(capabilityPhrases.every((phrase) => v3dTranslationSources.includes(phrase)));
  const interfacePhrases = [
    "Yapı Sistemleri | Prefabrik, Çelik, Hafif Çelik ve Hibrit",
    "Yapı Sistemleri | Prefabrik, Çelik, Hafif Çelik ve Hibrit | ARKEM Yapı Sistemleri",
    "Betonarme prefabrik, yapısal çelik, hafif çelik ve hibrit sistemleri kullanım alanları, avantajları, sınırları ve teknik yaklaşımlarıyla inceleyin. Betonarme rehberine ayrıca ulaşın.",
    "Dört ana taşıyıcı sistemi teknik karar başlıklarıyla karşılaştırın; destekleyici betonarme rehberini ayrıca inceleyin.",
    "DÖRT ANA YAPI SİSTEMİ",
    "Betonarme prefabrik, yapısal çelik, hafif çelik ve hibrit sistemleri; kullanım alanı, avantaj, sınır ve teknik yaklaşım başlıklarıyla inceleyin.",
    "✓ 4 ana sistem",
    "✓ Açık avantaj ve sınırlar",
    "✓ Kanıta bağlı proje eşlemesi",
    "Betonarme; temel, çekirdek, yerinde dökme bölümler ve hibrit sistem arayüzlerinde ayrıca değerlendirilir. Ana dört sistem hiyerarşisini bozmadan teknik rehberi erişilebilir tutuyoruz.",
    "Betonarme rehberini açın",
    "SINIRLAR VE KRİTİK BAŞLIKLAR",
    "BAĞLI PROJE KANITI",
    "Doğrulanmış sistem eşlemesi bekleniyor",
    "Proje kanıtı bekleniyor",
    "Doğrulandı ↗",
    "Proje kayıtlarını inceleyin",
    "Mühendislik",
    "Mühendislik | ARKEM Yapı Sistemleri",
    "Taşıyıcı sistem tasarımı, statik analiz, deprem mühendisliği, uygulama ve imalat projeleri, BIM koordinasyonu, değer ve saha mühendisliği.",
    "UZMANLIK KANITI BEKLENİYOR",
    "DOĞRULANMIŞ VAKA AŞAMASI",
    "Statik model, BIM modeli ve teknik çizimlerin birlikte geliştirildiği temsili mühendislik çalışması",
    "Temsili teknik çalışma · doğrulanmış proje kanıtı değildir",
    "Taşıyıcı sistemi yalnızca hesaplamıyoruz; girdiyi, mühendislik kararını, çıktıyı ve bu kararı kanıtlayan kaydı aynı teknik zincirde gösteriyoruz.",
    "Her mühendislik alanını dört açık soruyla sunuyoruz: girdi nedir, hangi teknik karar verilir, hangi çıktı oluşur ve bu kapsam hangi belgeyle doğrulanır? Proje kayıtları yalnız yayımlanmış kanıtlarla eşleşir.",
  ];
  assert.ok(interfacePhrases.every((phrase) => v3dTranslationSources.includes(phrase)));
  for (const language of ["en", "az", "ru", "it", "de", "fr"]) {
    assert.ok([...capabilityPhrases, ...interfacePhrases].every((phrase) => v3Translations[language][phrase] && v3Translations[language][phrase] !== phrase), `${language} must localize every V3.0-D capability and critical interface field`);
  }

  const hubResponse = await render("/yapi-sistemleri");
  assert.equal(hubResponse.status, 200);
  const hub = await hubResponse.text();
  assert.match(hub, /DÖRT ANA YAPI SİSTEMİ/);
  assert.match(hub, /Betonarme Prefabrik/);
  assert.match(hub, /Yapısal Çelik/);
  assert.match(hub, /Hafif Çelik/);
  assert.match(hub, /Hibrit/);
  assert.match(hub, /Destekleyici sistem rehberi/);
  const hubSource = fs.readFileSync(new URL("../app/yapi-sistemleri/page.tsx", import.meta.url), "utf8");
  assert.match(hubSource, /String\(index \+ 1\)\.padStart\(2, "0"\)/);
  assert.doesNotMatch(hubSource, /<span>\{system\.no\}<\/span>/);

  const detailResponse = await render("/yapi-sistemleri/betonarme-prefabrik");
  assert.equal(detailResponse.status, 200);
  const detail = await detailResponse.text();
  assert.match(detail, /AVANTAJLAR/);
  assert.match(detail, /SINIRLAR VE KRİTİK BAŞLIKLAR/);
  assert.match(detail, /TEKNİK YAKLAŞIM/);
  assert.match(detail, /BAĞLI PROJE KAYDI/);
  assert.match(detail, /Cihan Tat Gıda|Yapıkur Plaza|100 Baş Hayvancılık Tesisi/);
  assert.doesNotMatch(detail, /ARKEMX ile tasarlandı|ARKEMX kullanıldı/i);

  const engineeringResponse = await render("/muhendislik");
  assert.equal(engineeringResponse.status, 200);
  const engineering = await engineeringResponse.text();
  assert.match(engineering, /Deprem Mühendisliği/);
  assert.match(engineering, /GİRDİ/);
  assert.match(engineering, /MÜHENDİSLİK KARARI/);
  assert.match(engineering, /ÇIKTI/);
  assert.match(engineering, /GEREKLİ TEKNİK KAYIT/);
  assert.match(engineering, /PROJE KAYIT DURUMU/);
  assert.match(engineering, /GERÇEK PROJE KAYITLARI/);
  assert.match(engineering, /Cihan Tat Gıda/);
  assert.match(engineering, /gerçek taşıyıcı sistem ve saha kaydı/i);
  assert.doesNotMatch(engineering, /Temsili teknik çalışma · tamamlanmış proje kaydı değildir/);
  assert.match(engineering, /Genel vaka aşamaları yalnız proje düzeyi sayaçlarda görünür/);

  const engineeringSource = fs.readFileSync(new URL("../app/muhendislik/page.tsx", import.meta.url), "utf8");
  const systemDetailSource = fs.readFileSync(new URL("../app/yapi-sistemleri/[slug]/page.tsx", import.meta.url), "utf8");
  assert.match(engineeringSource, /TEKNİK KAYIT BEKLENİYOR/);
  assert.match(engineeringSource, /DOĞRULANMIŞ VAKA AŞAMASI/);
  assert.doesNotMatch(engineeringSource, /getEngineeringEvidenceStatus/);
  assert.match(engineeringSource, /getPublicV3Projects/);
  assert.match(systemDetailSource, /getPublicV3Projects/);
  assert.match(systemDetailSource, /matchesStructuralSystemEvidence/);

  const styles = fs.readFileSync(new URL("../app/v3d.css", import.meta.url), "utf8");
  assert.match(styles, /@media \(max-width: 430px\)/);
  assert.match(styles, /minmax\(0,\s*1fr\)/);
  assert.doesNotMatch(styles, /word-break:\s*break-all/);
});

test("Web V3.0-E publishes engineering capability evidence only through an explicit CMS target", async () => {
  const {
    PROJECT_EVIDENCE_TARGET_TYPES,
    applyPublishedProjectEvidence,
    isProjectEvidenceTarget,
  } = await import("../app/lib/project-evidence.ts");
  const { engineeringCapabilities } = await import("../app/data/engineering-v3.ts");
  const { v3Projects } = await import("../app/data/projects-v3.ts");
  const { v3Translations } = await import("../app/data/i18n-v3.ts");
  const { v3eTranslationSources } = await import("../app/data/i18n-v3e.ts");

  assert.ok(PROJECT_EVIDENCE_TARGET_TYPES.includes("capability"));
  assert.equal(isProjectEvidenceTarget("capability", "statik-analiz"), true);
  assert.equal(isProjectEvidenceTarget("capability", "uydurma-uzmanlik"), false);

  const evidence = {
    id: "EVD-CAPABILITY-001",
    projectSlug: v3Projects[0].slug,
    targetType: "capability",
    targetKey: "statik-analiz",
    claimValue: "Taşıyıcı sistem analizi ve kontrol kapsamı imzalı hesap raporuyla doğrulandı.",
    sourceLabel: "İmzalı statik hesap raporu",
    status: "published",
    fileName: "statik-hesap-raporu.pdf",
    contentType: "application/pdf",
  };
  const published = applyPublishedProjectEvidence(v3Projects[0], [evidence]);
  assert.equal(published.engineeringEvidence.length, 1);
  assert.equal(published.engineeringEvidence[0].capabilityId, "statik-analiz");
  assert.equal(published.engineeringEvidence[0].summary, evidence.claimValue);

  const genericStage = applyPublishedProjectEvidence(v3Projects[0], [{ ...evidence, targetType: "stage", targetKey: "04" }]);
  assert.equal(genericStage.engineeringEvidence.length, 0, "a generic case-study stage must not verify an engineering capability");

  const capabilityIds = engineeringCapabilities.map((capability) => capability.id);
  assert.ok(capabilityIds.includes(published.engineeringEvidence[0].capabilityId));

  const consoleSource = fs.readFileSync(new URL("../app/components/ProjectEvidenceCenter.tsx", import.meta.url), "utf8");
  const apiSource = fs.readFileSync(new URL("../app/api/project-evidence/route.ts", import.meta.url), "utf8");
  const engineeringSource = fs.readFileSync(new URL("../app/muhendislik/page.tsx", import.meta.url), "utf8");
  const projectSource = fs.readFileSync(new URL("../app/projeler/[slug]/page.tsx", import.meta.url), "utf8");
  const publicProjectsSource = fs.readFileSync(new URL("../app/lib/public-projects.ts", import.meta.url), "utf8");
  const schema = fs.readFileSync(new URL("../db/schema.ts", import.meta.url), "utf8");
  assert.match(consoleSource, /option value="capability">Mühendislik uzmanlığı/);
  assert.match(consoleSource, /ENGINEERING_CAPABILITY_IDS/);
  assert.doesNotMatch(consoleSource, /`Mühendislik \/ \$\{/);
  assert.match(consoleSource, /<span>Mühendislik<\/span><i aria-hidden="true"> \/ <\/i><span>/);
  assert.match(apiSource, /ProjectEvidenceTargetType/);
  assert.match(engineeringSource, /engineeringEvidence/);
  assert.match(engineeringSource, /DOĞRULANMIŞ PROJE KAYDI/);
  assert.match(projectSource, /MÜHENDİSLİK KAYITLARI/);
  assert.match(projectSource, /Teknik dosyayı inceleyin/);
  assert.match(publicProjectsSource, /Promise<readonly V3PublishedProjectRecord\[\]>/);
  assert.match(schema, /'fact', 'stage', 'capability'/);

  const v3eStyles = fs.readFileSync(new URL("../app/v3e.css", import.meta.url), "utf8");
  assert.match(v3eStyles, /\.v3c-evidence-list article>p\{overflow-wrap:anywhere\}/);

  const interfacePhrases = [
    "DOĞRULANMIŞ PROJE KANITI",
    "KANIT BAĞLI PROJELER",
    "Kaydı inceleyin ↗",
    "Genel vaka aşamaları yalnız proje düzeyi sayaçlarda görünür ve tek başına bir uzmanlığı doğrulamaz. Uzmanlık sayacı, Proje Kanıt Merkezi’nde doğrudan ilgili mühendislik alanına bağlanıp yayımlanan kaynak dosyalarından oluşur.",
    "UZMANLIK KANITLARI",
    "Mühendislik kapsamı,",
    "doğrudan kaynağına bağlı.",
    "Bu kayıtlar genel vaka aşamasından üretilmez; Proje Kanıt Merkezi’nde ilgili uzmanlık alanına açıkça bağlanıp yayımlanır.",
    "Kanıt dosyasını inceleyin ↗",
    "Mühendislik uzmanlığı",
    "Proje kaydına açık kaynak bağlayın.",
    "V3.0‑E / PROJE KANIT MERKEZİ",
  ];
  assert.ok(interfacePhrases.every((phrase) => v3eTranslationSources.includes(phrase)));
  for (const language of ["en", "az", "ru", "it", "de", "fr"]) {
    assert.ok(interfacePhrases.every((phrase) => v3Translations[language][phrase]
      && v3Translations[language][phrase] !== phrase), `${language} must localize every V3.0-E evidence interface field`);
  }

  const migrationFiles = fs.readdirSync(new URL("../drizzle", import.meta.url))
    .filter((name) => /^0003_.*\.sql$/.test(name));
  assert.equal(migrationFiles.length, 1);
  const migration = fs.readFileSync(new URL(`../drizzle/${migrationFiles[0]}`, import.meta.url), "utf8");
  assert.match(migration, /DROP INDEX.*project_evidence_single_published_idx/i);
  assert.match(migration, /'fact', 'stage', 'capability'/);

  const evidenceDb = new DatabaseSync(":memory:");
  const allMigrations = fs.readdirSync(new URL("../drizzle", import.meta.url))
    .filter((name) => /^000[0-3]_.+\.sql$/.test(name))
    .sort();
  for (const file of allMigrations) evidenceDb.exec(fs.readFileSync(new URL(`../drizzle/${file}`, import.meta.url), "utf8"));
  const insert = evidenceDb.prepare(`INSERT INTO project_evidence_items (
    id, project_slug, target_type, target_key, claim_value, source_label, status,
    created_by, created_at, updated_at, transition_token
  ) VALUES (?, 'viakasta', 'capability', ?, 'kapsam', 'imzalı rapor', 'published', 'editor@arkem.test', '2026-08-09', '2026-08-09', ?)`);
  insert.run("EVD-CAP-1", "statik-analiz", "CAP-TOKEN-1");
  assert.throws(() => insert.run("EVD-CAP-2", "statik-analiz", "CAP-TOKEN-2"), /unique/i);
  insert.run("EVD-CAP-3", "deprem-muhendisligi", "CAP-TOKEN-3");
});

test("Web V3.1 keeps one corporate truth, one ARKEMX registry and a calm Turkish project-first experience", async () => {
  const { corporateRegistry } = await import("../app/data/corporate-registry.ts");
  const {
    ARKEMX_MODULE_STATUSES,
    arkemXModuleGroups,
    arkemXModuleRegistry,
  } = await import("../app/data/arkemx-module-registry.ts");

  assert.equal(corporateRegistry.brand.name, "ARKEM Yapı Sistemleri");
  assert.equal(corporateRegistry.legalEntity.name, null);
  assert.equal(corporateRegistry.legalEntity.relationshipStatement, null);
  assert.equal(corporateRegistry.legalEntity.verificationStatus, "DOĞRULANMADI");
  assert.equal(corporateRegistry.primaryLanguage, "tr");
  assert.equal(corporateRegistry.arkemx.status, "AKTİF GELİŞTİRME");

  assert.deepEqual(ARKEMX_MODULE_STATUSES, [
    "AKTİF",
    "AKTİF · GELİŞTİRİLİYOR",
    "DOĞRULANIYOR",
    "GELİŞTİRME PROGRAMINDA",
  ]);
  assert.equal(arkemXModuleGroups.length, 5);
  assert.equal(arkemXModuleRegistry.length, 13);
  assert.deepEqual(
    arkemXModuleRegistry.map((module) => module.title),
    [
      "Proje Modeli",
      "Yapısal Analiz",
      "Deprem Mühendisliği",
      "Betonarme",
      "Prefabrik Betonarme",
      "Yapısal Çelik",
      "Hafif Çelik",
      "Hibrit Sistemler",
      "Temel ve Zemin Etkileşimi",
      "Detay ve İmalat",
      "Metraj ve Maliyet",
      "Doğrulama ve İzlenebilirlik",
      "Yapım Aşaması ve Saha",
    ],
  );
  assert.ok(arkemXModuleRegistry.every((module) =>
    module.id && module.version && module.status && module.description &&
    module.capabilities.length && module.lastUpdated && module.validationStatus &&
    module.inputs.length && module.process.length && module.connections.length &&
    module.outputs.length && module.recentUpdates.length
  ));
  assert.ok(arkemXModuleRegistry.every((module) => ARKEMX_MODULE_STATUSES.includes(module.status)));
  assert.ok(arkemXModuleRegistry.every((module) => module.workingRoute), "çalışan modüller menüden pasif edilmemeli");

  const home = [
    fs.readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8"),
    fs.readFileSync(new URL("../app/components/HomeV4.tsx", import.meta.url), "utf8"),
    fs.readFileSync(new URL("../app/components/HeroProjectStage.tsx", import.meta.url), "utf8"),
  ].join("\n");
  const orderedSections = [
    "v4-hero",
    "v4-section v4-projects",
    "v4-section v4-systems",
    "v4-section v4-engineering",
    "v4-section v4-arkemx",
    "v4-section v4-methodology",
    "v4-section v4-outputs",
    "v4-section v4-about",
    "v4-section v4-contact",
  ];
  let cursor = -1;
  for (const section of orderedSections) {
    const next = home.indexOf(section);
    assert.ok(next > cursor, `${section} ana sayfada doğru sırada olmalı`);
    cursor = next;
  }
  for (const expected of [
    "Her proje,",
    "uygulamadaki karşılığıdır.",
    "DİJİTAL PROJE ARAÇLARI",
    "MÜŞTERİ PROJE PORTALI",
    "YÖNLENDİRMELİ BAŞLA",
    "MÜHENDİSLİKTEN SAHAYA.",
    "SAHA DENEYİMİNDEN TEKNOLOJİYE.",
  ]) assert.match(home, new RegExp(expected.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"), expected);
  assert.match(home, /HeroProjectStage/);
  assert.match(home, /cihan-tamamlanan\.webp/);
  assert.doesNotMatch(home, /İddia değil|Proje kanıtı|TEKNİK KANIT|DAHA AZ İDDİA|DAHA FAZLA KANIT/i);

  const arkemx = fs.readFileSync(new URL("../app/arkemx/page.tsx", import.meta.url), "utf8");
  const explorer = fs.readFileSync(new URL("../app/components/ArkemXRegistryExplorer.tsx", import.meta.url), "utf8");
  for (const expected of [
    "ArkemXRegistryExplorer",
    "13 PROJE MÜHENDİSLİĞİ MODÜLÜ",
    "GELİŞİM GÜNLÜĞÜ",
    "ŞİMDİ",
    "SONRAKİ GELİŞİM",
    "UZUN VADELİ",
    "çalışan fonksiyonlar korunurken doğrulama, kapsam ve entegrasyon sürekli genişletilmektedir",
  ]) assert.match(arkemx, new RegExp(expected, "i"), expected);
  assert.match(explorer, /ORTAK PROJE OMURGASI/i);
  for (const expected of ["NEYİ ÇÖZER?", "GİRDİLER", "BAĞLI MODÜLLER", "ÇIKTILAR", "TEKNİK DOĞRULAMA", "SON GELİŞTİRMELER"]) {
    assert.match(explorer, new RegExp(expected, "i"), expected);
  }
  assert.doesNotMatch(`${arkemx}\n${explorer}`, /\bBETA\b|EXPERIMENTAL|UNDER CONSTRUCTION|AKTİF WEB PROTOTİPİ/i);

  const projects = fs.readFileSync(new URL("../app/projeler/page.tsx", import.meta.url), "utf8");
  const projectDetail = fs.readFileSync(new URL("../app/projeler/[slug]/page.tsx", import.meta.url), "utf8");
  assert.match(projects, /PROJE ARŞİVİ/);
  assert.match(projectDetail, /PROJE KÜNYESİ/);
  assert.match(projectDetail, /TEKNİK KAYIT/);
  assert.doesNotMatch(`${projects}\n${projectDetail}`, /GERÇEK KANIT|KANIT DOSYASI|KANIT MANİFESTOSU|Her iddianın/i);

  const chrome = fs.readFileSync(new URL("../app/components/SiteChrome.tsx", import.meta.url), "utf8");
  assert.match(chrome, /corporateRegistry\.legalEntity\.relationshipStatement/);
  assert.match(chrome, /© 2026[^\n]*corporateRegistry\.brand\.name/);

  const form = fs.readFileSync(new URL("../app/components/ProjectBriefForm.tsx", import.meta.url), "utf8");
  for (const field of ["buildingType", "stage", "location", "area", "projectFiles", "requestType"]) assert.match(form, new RegExp(`name=["']${field}["']`));
  for (const stage of ["Fikir aşaması", "Mimari proje hazır", "Statik proje gerekiyor", "Teklif / ihale aşaması", "Uygulama aşaması", "Mevcut proje revizyonu"]) assert.match(form, new RegExp(stage));
  assert.match(form, /\.xlsx/);

  const analytics = fs.readFileSync(new URL("../app/components/V21Analytics.tsx", import.meta.url), "utf8");
  for (const event of ["hero_cta", "project_open", "system_open", "engineering_open", "arkemx_open", "arkemx_module_open", "project_file_prepare", "project_brief_submit", "phone_click", "email_click", "whatsapp_click", "language_change"]) {
    assert.match(analytics, new RegExp(event), event);
  }

  const layout = fs.readFileSync(new URL("../app/layout.tsx", import.meta.url), "utf8");
  assert.match(layout, /import "\.\/v31\.css";/);
  assert.match(layout, /import "\.\/v32-acceptance\.css";/);
  const sitemap = fs.readFileSync(new URL("../app/sitemap.ts", import.meta.url), "utf8");
  assert.match(sitemap, /alternates:\s*\{\s*languages:/);

  // The private ARKEMX workspace has replaced the old corporate homepage.
  // Check each public contract at its current route rather than treating "/" as corporate.
  const workspaceResponse = await render("/");
  assert.equal(workspaceResponse.status, 200);
  const workspaceHtml = await workspaceResponse.text();
  assert.match(workspaceHtml, /<h1 id="arx-tools-title">Araçlar<\/h1>/);
  assert.match(workspaceHtml, /href="\/proje-baslat"/);
  assert.doesNotMatch(workspaceHtml, /Öztürk İnşaat Mühendislik|bünyesinde faaliyet göstermektedir/i);

  const corporateResponse = await render("/arkem");
  assert.equal(corporateResponse.status, 200);
  const corporateHtml = await corporateResponse.text();
  assert.match(corporateHtml, /MÜHENDİSLİĞİNİ ÇÖZER/);
  assert.match(corporateHtml, /SAHAYA TAŞIR/);

  const moduleResponse = await render("/arkemx");
  assert.equal(moduleResponse.status, 200);
  const moduleHtml = await moduleResponse.text();
  assert.match(moduleHtml, /application\/ld\+json/);
  assert.match(moduleHtml, /ORTAK PROJE VERİSİ/);
});

test("Web V3.2 publishes real project records, honest ARKEMX states and crawlable Turkish HTML", async () => {
  const { arkemXModuleRegistry } = await import("../app/data/arkemx-module-registry.ts");
  const active = arkemXModuleRegistry.filter((module) => module.status.startsWith("AKTİF"));
  const validating = arkemXModuleRegistry.filter((module) => module.status === "DOĞRULANIYOR");
  const development = arkemXModuleRegistry.filter((module) => module.status === "GELİŞTİRME PROGRAMINDA");

  assert.equal(active.length, 3);
  assert.equal(validating.length, 10);
  assert.equal(development.length, 0);
  assert.ok(arkemXModuleRegistry.every((module) => module.webVisible));
  assert.ok(arkemXModuleRegistry.every((module) => module.developmentNote.length > 30));
  assert.ok(arkemXModuleRegistry.every((module) => {
    const acceptance = module.runtimeAcceptance;
    return acceptance.routeOpens
      && acceptance.criticalErrorFree
      && acceptance.evidence.length > 20;
  }));
  const acceptedCoreCodes = new Set(arkemXModuleRegistry.map((module) => module.code));
  const acceptedCore = arkemXModuleRegistry.filter((module) => acceptedCoreCodes.has(module.code));
  const pendingCore = arkemXModuleRegistry.filter((module) => !acceptedCoreCodes.has(module.code));
  assert.ok(acceptedCore.every((module) => {
    const acceptance = module.runtimeAcceptance;
    return acceptance.acceptsCoreInput
      && acceptance.runsCoreProcess
      && acceptance.producesMeaningfulOutput
      && acceptance.minimumRegression;
  }));
  assert.equal(pendingCore.length, 0);
  assert.ok(validating.every((module) => module.runtimeAcceptance.engineeringValidation === "kısmi"));
  assert.ok(development.every((module) => {
    const acceptance = module.runtimeAcceptance;
    return !acceptance.acceptsCoreInput
      && !acceptance.runsCoreProcess
      && !acceptance.producesMeaningfulOutput
      && !acceptance.minimumRegression
      && acceptance.engineeringValidation === "planlanıyor";
  }));
  for (const route of new Set(arkemXModuleRegistry.map((module) => module.workingRoute.split("#")[0]))) {
    const response = await render(route);
    assert.equal(response.status, 200, `ARKEMX çalışma rotası: ${route}`);
  }

  assert.ok(projectRecords.every((project) => project.archiveMedia.length > 0));
  for (const project of projectRecords) {
    for (const media of project.archiveMedia) {
      const publicFile = new URL(`../public${media.href}`, import.meta.url);
      assert.ok(fs.existsSync(publicFile), `${project.code}: ${media.href}`);
      assert.equal(media.contentType, "image/webp");
    }
  }

  const archiveExplorer = fs.readFileSync(new URL("../app/components/ProjectArchiveExplorer.tsx", import.meta.url), "utf8");
  for (const filter of ["Tümü", "Endüstriyel", "Ticari", "Tarımsal", "Betonarme Prefabrik", "Çelik", "Hafif Çelik"]) {
    assert.match(archiveExplorer, new RegExp(`label: ["']${filter}["']`));
  }
  assert.doesNotMatch(archiveExplorer, /label: ["']Mühendislik["']|label: ["']Uygulama["']/);

  // The tools workspace is private/noindex. Public Turkish project records
  // and brand content remain on their own crawlable corporate routes.
  const workspaceResponse = await render("/");
  assert.equal(workspaceResponse.status, 200);
  const workspaceHtml = await workspaceResponse.text();
  assert.match(workspaceHtml, /<h1 id="arx-tools-title">Araçlar<\/h1>/);
  assert.match(workspaceHtml, /name="robots" content="noindex, nofollow"/);
  assert.doesNotMatch(workspaceHtml, /<iframe\b/i);

  const corporateResponse = await render("/arkem");
  assert.equal(corporateResponse.status, 200);
  const corporateHtml = await corporateResponse.text();
  assert.match(corporateHtml, /ARKEM/);
  assert.match(corporateHtml, /MÜHENDİSLİĞİNİ ÇÖZER/);
  assert.doesNotMatch(corporateHtml, /© 2025 by Öztürk İnşaat/i);
  assert.match(corporateHtml, /© 2026/i);

  const projectsResponse = await render("/projeler");
  assert.equal(projectsResponse.status, 200);
  const projectsHtml = await projectsResponse.text();
  const title = projectsHtml.match(/<title>(.*?)<\/title>/i)?.[1] ?? "";
  assert.equal(title, "Projeler | Yapısal ve Endüstriyel Proje Arşivi | ARKEM");
  assert.match(projectsHtml, /P-001/);
  assert.match(projectsHtml, /PROJE KAYDI/);
  assert.doesNotMatch(projectsHtml, /KAYIT GÜNCELLENİYOR|Kaynak ve yayın hakkı eşleşmesi bekleniyor/i);

  const sitemapResponse = await render("/sitemap.xml");
  assert.equal(sitemapResponse.status, 200);
  const sitemapXml = await sitemapResponse.text();
  assert.match(sitemapXml, /hreflang=["']tr-TR["']/i);
  assert.match(sitemapXml, /hreflang=["']x-default["']/i);
  assert.doesNotMatch(sitemapXml, /\?lang=(en|az|ru|it|de|fr)/i);
});

test("Web V3.6 proves the five closing ARKEMX workflows at public calculation seams", async () => {
  const { calculateStructuralConcept } = await import("../app/lib/engineering.ts");
  const { createStructuralStudio } = await import("../app/lib/structural-studio.ts");
  const { createBimCoordinationModel } = await import("../app/lib/bim-coordination.ts");

  const baseInput = {
    system: "concrete",
    usage: "industrial",
    width: 48,
    depth: 36,
    floors: 3,
    floorHeight: 4.5,
    baysX: 6,
    baysY: 4,
    columnSize: .5,
    beamDepth: .7,
    slabThickness: .18,
    superDeadLoad: 2.5,
    liveLoad: 5,
    roofSnowLoad: .75,
    basicWindSpeed: 30,
    sds: .6,
    sd1: 1.2,
    importance: 1,
    behaviorFactor: 6,
    concreteStrength: 40,
    steelYield: 355,
  };

  const lowerSeismicDemand = calculateStructuralConcept(baseInput);
  const higherSeismicDemand = calculateStructuralConcept({ ...baseInput, sds: 1.2 });
  assert.ok(lowerSeismicDemand.dynamics.baseShearProxy > 0);
  assert.ok(higherSeismicDemand.dynamics.baseShearProxy > lowerSeismicDemand.dynamics.baseShearProxy);
  assert.ok(higherSeismicDemand.trace.some((row) => row.code === "V*" && /kN/.test(row.result)));

  const studio = createStructuralStudio({
    reference: "ARKEMX-V36-ACCEPTANCE",
    input: baseInput,
    repetition: 65,
    transportDistance: 120,
    fireRating: 90,
    generatedAt: "2026-08-11T16:30:00.000Z",
  });
  const concrete = studio.alternatives.find((item) => item.system === "concrete");
  const steel = studio.alternatives.find((item) => item.system === "steel");
  const hybrid = studio.alternatives.find((item) => item.system === "hybrid");
  assert.ok(concrete?.preliminary.column && concrete.quantities.concreteVolume > 0 && concrete.quantities.reinforcementTonnage > 0);
  assert.ok(steel?.preliminary.beam && steel.quantities.steelTonnage > 0 && Number.isFinite(steel.score));
  assert.ok(hybrid?.preliminary.lateral && hybrid.quantities.concreteVolume > 0 && hybrid.quantities.steelTonnage > 0);
  assert.ok(hybrid?.risks.some((risk) => /arayüz|yapım sırası|rijitlik/i.test(risk)));

  const foundationInput = {
    projectId: "ARKEMX-V36-FOUNDATION",
    projectRevision: "P01",
    coordinateReference: "EPSG:5254",
    architecturalScheme: {
      schema: "ARKEM-ARCH-SCHEME/3.0",
      source: { authoritativeMassing: true, selectedMassingId: "verified" },
      plate: { width: 48, depth: 36, area: 1728, floors: 3, floorHeight: 4.5 },
      program: { occupants: 100 },
      cores: [],
    },
    structuralStudio: {
      schema: "ARKEM-STRUCTURAL-STUDIO/3.0",
      source: { architectureTrust: "verified" },
      geometry: { width: 48, depth: 36, floors: 3, floorHeight: 4.5, baysX: 6, baysY: 4, maximumSpan: 9, totalArea: 5184 },
      recommendation: { system: "concrete", label: "Betonarme", score: 78 },
      alternatives: [{
        system: "concrete",
        label: "Betonarme",
        preliminary: { column: "50×50 cm", beam: "35×70 cm", floor: "18 cm", numeric: { beamDepth: .7, slabThickness: .18 } },
        indices: { relativeCost: 100, durationWeeks: 24, embodiedCarbonProxy: 500000, factoryShare: 12 },
        quantities: { concreteVolume: 1100, reinforcementTonnage: 126, steelTonnage: 0 },
      }],
    },
    serviceZone: .8,
    ceilingBuildUp: .2,
    raisedFloor: 0,
    shaftArea: 10,
    plantArea: 80,
    factoredGravity: 240000,
    soilBearing: 200,
    rainfallIntensity: 80,
    outletCapacity: 4,
    sprinkler: true,
    facadeTolerance: 20,
    generatedAt: "2026-08-11T16:30:00.000Z",
  };
  const foundation = createBimCoordinationModel(foundationInput);
  const strongerSoil = createBimCoordinationModel({ ...foundationInput, soilBearing: 400 });
  assert.ok(foundation.coordination.bearingPressureKNM2 > 0);
  assert.ok(foundation.coordination.bearingUtilizationPct > 0);
  assert.equal(strongerSoil.coordination.bearingPressureKNM2, foundation.coordination.bearingPressureKNM2);
  assert.equal(strongerSoil.coordination.bearingUtilizationPct, foundation.coordination.bearingUtilizationPct / 2);
});

test("Web V3.4 enforces Template Zero, Turkish publishing and a durable technical intake", async () => {
  const registry = fs.readFileSync(new URL("../app/data/corporate-registry.ts", import.meta.url), "utf8");
  const layout = fs.readFileSync(new URL("../app/layout.tsx", import.meta.url), "utf8");
  const chrome = fs.readFileSync(new URL("../app/components/SiteChrome.tsx", import.meta.url), "utf8");
  const language = fs.readFileSync(new URL("../app/components/LanguageSystem.tsx", import.meta.url), "utf8");
  const intake = fs.readFileSync(new URL("../app/api/project-intake/route.ts", import.meta.url), "utf8");
  const form = fs.readFileSync(new URL("../app/components/ProjectBriefForm.tsx", import.meta.url), "utf8");
  const explorer = fs.readFileSync(new URL("../app/components/ArkemXRegistryExplorer.tsx", import.meta.url), "utf8");
  const migration = fs.readFileSync(new URL("../drizzle/0004_nostalgic_yellowjacket.sql", import.meta.url), "utf8");

  assert.match(registry, /email: null as string \| null/);
  assert.doesNotMatch(`${layout}\n${chrome}\n${form}`, /arkemyapisistemleri@gmail\.com|mailto:/i);
  assert.match(layout, /ARKEM Yapı Sistemleri \| Prefabrik, Çelik, Hafif Çelik ve Yapısal Mühendislik/);
  assert.match(layout, /\.\.\.\(site\.email \? \{ email: site\.email \} : \{\}\)/);
  assert.doesNotMatch(layout, /SiteCommandCenter|ProjectThreadDock|SocialRail|SiteScrollProgress/);
  assert.match(language, /routeLocale/);
  assert.match(language, /localeEquivalent/);
  assert.match(language, /English/);
  assert.doesNotMatch(language, /localStorage|\?lang|flags\//i);

  for (const field of ["name", "company", "email", "phone", "location", "buildingType", "area", "stage", "requestType", "message", "projectFiles", "consent"]) {
    assert.match(form, new RegExp(`name=["']${field}["']`), field);
  }
  assert.match(form, /multipart\/form-data/);
  assert.match(form, /TEKNİK DEĞERLENDİRMEYE GÖNDER/);
  assert.match(intake, /MAX_FILE_BYTES = 20_000_000/);
  assert.match(intake, /MAX_TOTAL_BYTES = 50_000_000/);
  assert.match(intake, /"ifc"/);
  assert.match(form, /\.ifc/);
  assert.match(form, /project-intake-section/);
  assert.match(form, /PROJE BİLGİSİ/);
  assert.match(form, /DOSYA VE AÇIKLAMA/);
  assert.match(intake, /evidenceFileMatchesExtension/);
  assert.match(intake, /crypto\.subtle\.digest/);
  assert.match(intake, /bucket\.put/);
  assert.match(intake, /db\.batch/);
  assert.match(migration, /CREATE TABLE `project_intakes`/);
  assert.match(migration, /CREATE TABLE `project_intake_files`/);

  assert.match(explorer, /useState<PublicArkemXModuleGroupId>\("modelleme-analiz"\)/);
  assert.match(explorer, /useState\("proje-modeli"\)/);
  assert.match(explorer, /createPortal/);
  assert.match(explorer, /v34-module-drawer/);
  assert.doesNotMatch(explorer, /initialModule|initialGroup/);

  const home = await render("/");
  const homeHtml = await home.text();
  assert.equal(home.status, 200);
  assert.match(homeHtml, /ARKEM Yapı Sistemleri \| Prefabrik, Çelik, Hafif Çelik ve Yapısal Mühendislik/);
  assert.doesNotMatch(homeHtml, /arkemyapisistemleri@gmail\.com|mailto:|<iframe\b/i);

  const contact = await render("/iletisim");
  const contactHtml = await contact.text();
  assert.equal(contact.status, 200);
  assert.match(contactHtml, /Proje Dosyalarını Yükle/i);
  assert.match(contactHtml, /TEKNİK DEĞERLENDİRMEYE GÖNDER/i);
  assert.doesNotMatch(contactHtml, /arkemyapisistemleri@gmail\.com|mailto:/i);
});

test("Web V5.0 publishes an explicit ARKEMX projection without internal registry fields", async () => {
  const { arkemXModuleRegistry } = await import("../app/data/arkemx-module-registry.ts");
  const { publicArkemXNavigation } = await import("../app/data/arkemx-public-navigation.ts");
  const explorer = fs.readFileSync(new URL("../app/components/ArkemXRegistryExplorer.tsx", import.meta.url), "utf8");
  const chrome = fs.readFileSync(new URL("../app/components/SiteChrome.tsx", import.meta.url), "utf8");
  const api = fs.readFileSync(new URL("../app/api/arkemx-modules/route.ts", import.meta.url), "utf8");

  const response = await render("/api/arkemx-modules", { headers: { accept: "application/json" } });
  assert.equal(response.status, 200);
  const publicResponse = await response.json();
  const publicArkemXModules = publicResponse.modules;
  assert.equal(publicArkemXModules.length, 13);
  assert.deepEqual(
    publicArkemXNavigation,
    arkemXModuleRegistry.map(({ id, code, title, status }) => ({ id, code, title, status })),
  );
  const publicPayload = JSON.stringify(publicArkemXModules);
  for (const internalField of ["developmentNote", "runtimeAcceptance", "dependencies", "boundary", "workingRoute", "process", "capabilities"]) {
    assert.doesNotMatch(publicPayload, new RegExp(`"${internalField}"`), internalField);
  }
  assert.ok(publicArkemXModules.every((module) => module.version === null || /^v\d/.test(module.version)));
  assert.doesNotMatch(explorer, /from "\.\.\/data\/arkemx-module-registry"/);
  assert.doesNotMatch(chrome, /from "\.\.\/data\/arkemx-module-registry"/);
  assert.match(api, /publicArkemXModules/);
  assert.doesNotMatch(api, /modules:\s*arkemXModuleRegistry/);
});

test("Web V4 restores working layered navigation and controlled corporate density", async () => {
  const chrome = fs.readFileSync(new URL("../app/components/SiteChrome.tsx", import.meta.url), "utf8");
  const siteData = fs.readFileSync(new URL("../app/data/site.ts", import.meta.url), "utf8");
  const home = fs.readFileSync(new URL("../app/components/HomeV4.tsx", import.meta.url), "utf8");
  const layout = fs.readFileSync(new URL("../app/layout.tsx", import.meta.url), "utf8");
  const styles = fs.readFileSync(new URL("../app/v4.css", import.meta.url), "utf8");

  assert.match(siteData.match(/export const mainNavigation[\s\S]*?as const;/)?.[0] ?? "", /İLETİŞİM/);
  assert.match(chrome, /navigationTree\.map/);
  assert.match(chrome, /className="v4-nav-group/);
  assert.match(chrome, /aria-expanded=\{activeDesktopMenu === item\.label\}/);
  assert.match(chrome, /className="v4-mobile-nav-groups"/);
  assert.match(chrome, /openMobileGroup === item\.label/);
  assert.doesNotMatch(chrome, /useSyncExternalStore/);
  assert.match(chrome, /createPortal/);

  for (const expected of [
    "v4-home",
    "v4-capability-band",
    "PROJE DENEYİMİ",
    "TEKNİK ÇIKTILAR",
    "v4-output-mosaic",
    "v4-method-flow",
    "KAPSAM",
    "ANALİZ",
  ]) assert.match(home, new RegExp(expected, "i"), expected);

  assert.match(layout, /import "\.\/v37-corporate\.css"/);
  assert.match(styles, /\.v4-section\s*\{[^}]*padding:/);
  assert.match(styles, /overflow-x:\s*clip/);
  assert.match(styles, /@media \(max-width:\s*900px\)/);
  assert.match(styles, /\.v4-mobile-nav/);
  assert.match(styles, /\.v4-project-editorial/);
  assert.match(styles, /grid-template-columns:\s*repeat\(12,minmax\(0,1fr\)\)/);

  // HomeV4 is now mounted on the public English homepage; the Turkish root is the private tools workspace.
  const response = await render("/en");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /TECHNICAL OUTPUTS/);
  assert.match(html, /PROJECT EXPERIENCE/);
  assert.match(html, /aria-label="Open menu"/);
});

test("Web V4 carries the content with working navigation, real locale routes and responsive ARKEMX discovery", () => {
  const home = [
    fs.readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8"),
    fs.readFileSync(new URL("../app/components/HomeV4.tsx", import.meta.url), "utf8"),
    fs.readFileSync(new URL("../app/components/HeroProjectStage.tsx", import.meta.url), "utf8"),
  ].join("\n");
  const chrome = fs.readFileSync(new URL("../app/components/SiteChrome.tsx", import.meta.url), "utf8");
  const language = [
    fs.readFileSync(new URL("../app/components/LanguageSystem.tsx", import.meta.url), "utf8"),
    fs.readFileSync(new URL("../app/data/locale-routes.ts", import.meta.url), "utf8"),
  ].join("\n");
  const explorer = fs.readFileSync(new URL("../app/components/ArkemXRegistryExplorer.tsx", import.meta.url), "utf8");
  const layout = fs.readFileSync(new URL("../app/layout.tsx", import.meta.url), "utf8");
  const styles = fs.readFileSync(new URL("../app/v4.css", import.meta.url), "utf8");

  for (const expected of [
    "v4-home",
    "00 / ARKEM",
    "YENİ PROJE BAŞLAT",
    "NE YAPMAK İSTİYORSUNUZ",
    "PROJE DENEYİMİ",
    "YAPI SİSTEMLERİ",
    "MÜHENDİSLİK",
    "ARKEMX",
    "PROJEDEN SAHAYA",
    "TEKNİK ÇIKTILAR",
    "PROJE ÖN DEĞERLENDİRME",
  ]) assert.match(home, new RegExp(expected, "i"), expected);
  assert.doesNotMatch(home, /ANA GÖRSEL|64 saniyelik|40°45|30°23/i);
  assert.match(home, /v4-hero-stage/);
  assert.match(home, /project\.code/);

  assert.match(chrome, /createPortal/);
  assert.match(chrome, /v4-mobile-nav/);
  assert.match(chrome, /setActiveDesktopMenu\(item\.label\)/);
  assert.match(chrome, /v117-mobile-priority/);
  assert.match(chrome, /v117-mobile-direct/);
  assert.doesNotMatch(chrome, /v4-mobile-module-shortcuts/);
  assert.match(chrome, /v4-footer-accordion/);

  assert.match(language, /\/en\/projects/);
  assert.match(language, /\/en\/engineering/);
  assert.match(language, /\/en\/arkemx/);
  assert.match(language, /\/en\/contact/);
  assert.match(language, /English/);
  for (const route of [
    "../app/en/page.tsx",
    "../app/en/projects/page.tsx",
    "../app/en/engineering/page.tsx",
    "../app/en/arkemx/page.tsx",
    "../app/en/contact/page.tsx",
  ]) assert.equal(fs.existsSync(new URL(route, import.meta.url)), true, `${route} gerçek bir İngilizce rota olmalı`);

  assert.match(explorer, /history\.replaceState/);
  assert.match(explorer, /Önceki Modül/);
  assert.match(explorer, /Sonraki Modül/);
  assert.match(explorer, /v4-module-matrix/);
  assert.match(explorer, /v4-related-module/);

  assert.match(layout, /import "\.\/v4\.css"/);
  assert.match(styles, /@media \(max-width:\s*1366px\)/);
  assert.match(styles, /@media \(max-width:\s*900px\)/);
  assert.match(styles, /@media \(max-width:\s*600px\)/);
  assert.match(styles, /overflow-x:\s*clip/);
  assert.match(styles, /min-height:\s*48px/);
});

test("Web V4 language switching preserves the current route in both locales", async () => {
  const { localeEquivalent } = await import("../app/data/locale-routes.ts");
  assert.equal(localeEquivalent("/", "tr"), "/");
  assert.equal(localeEquivalent("/", "en"), "/en");
  assert.equal(localeEquivalent("/en", "en"), "/en");
  assert.equal(localeEquivalent("/en", "tr"), "/");
  assert.equal(localeEquivalent("/projeler/cihan-tat-gida", "en"), "/en/projects/cihan-tat-gida");
  assert.equal(localeEquivalent("/en/projects/cihan-tat-gida", "tr"), "/projeler/cihan-tat-gida");
});

test("Web V4.1 exposes only visible Wix locales and closes the mobile interaction acceptance gates", async () => {
  const { localePublicationRegistry, visibleLocaleRecords } = await import("../app/data/locale-routes.ts");
  assert.deepEqual(visibleLocaleRecords.map((locale) => locale.id), ["tr"]);
  assert.equal(localePublicationRegistry.find((locale) => locale.id === "en")?.visibility, "HIDDEN");

  const language = fs.readFileSync(new URL("../app/components/LanguageSystem.tsx", import.meta.url), "utf8");
  const chrome = fs.readFileSync(new URL("../app/components/SiteChrome.tsx", import.meta.url), "utf8");
  const explorer = fs.readFileSync(new URL("../app/components/ArkemXRegistryExplorer.tsx", import.meta.url), "utf8");
  const styles = [
    fs.readFileSync(new URL("../app/v4.css", import.meta.url), "utf8"),
    fs.readFileSync(new URL("../app/v117.css", import.meta.url), "utf8"),
  ].join("\n");

  for (const expected of ["visibleLocaleRecords", "available.length < 2", "isLocaleVisible", "return null"]) {
    assert.match(language, new RegExp(expected));
  }
  for (const expected of [
    "aria-controls=\"v4-mobile-navigation\"",
    "aria-haspopup=\"dialog\"",
    "v117-mobile-priority",
    "v117-mobile-direct",
    "querySelectorAll<HTMLElement>",
    "data-mobile-visible",
  ]) assert.match(chrome, new RegExp(expected));
  for (const expected of ["v4-module-back", "05 / 13", "v4-module-pagination", "history.replaceState"]) {
    assert.match(explorer, new RegExp(expected.replace("05 / 13", "\\{module\\.code\\} / 13")));
  }
  assert.doesNotMatch(chrome, /<a key=\{module\.id\}|v4-mobile-module-shortcuts/);
  assert.match(chrome, /const hasSections = item\.sections\.length > 0/);
  assert.match(explorer, /deferredHashSync/);
  assert.match(explorer, /document\.addEventListener\("click", syncSamePageLink, true\)/);
  for (const expected of [
    "safe-area-inset-top",
    "safe-area-inset-bottom",
    "min-height:100svh",
    "v4-mobile-module-shortcuts",
    "v117-mobile-priority",
    "grid-template-columns:190px minmax(0,1fr)",
    "font-size:clamp(38px,9.85vw,58px)",
  ]) assert.match(styles, new RegExp(expected.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));

  const response = await render("/");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.doesNotMatch(html, /data-locale-mode="single"|class="v4-language-static"/);
  assert.doesNotMatch(html, /id="v4-language-menu"/);
});

test("V118 establishes one design system and a compact, state-aware navigation contract", () => {
  const layout = fs.readFileSync(new URL("../app/layout.tsx", import.meta.url), "utf8");
  const styles = fs.readFileSync(new URL("../app/v118-system.css", import.meta.url), "utf8");
  const chrome = fs.readFileSync(new URL("../app/components/SiteChrome.tsx", import.meta.url), "utf8");

  assert.match(layout, /import "\.\/v117\.css";[\s\S]*import "\.\/v118-system\.css";/);
  for (const expected of [
    "--ds-container: 1280px",
    "--ds-section: clamp(76px,7.4vw,112px)",
    "height: 76px !important",
    "width: min(980px,calc(100vw - 64px))",
    ".v118-menu-backdrop",
    "overflow-x: clip",
    "@media (max-width: 960px)",
  ]) assert.match(styles, new RegExp(expected.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.doesNotMatch(styles, /word-break:\s*break-all/);
  assert.match(chrome, /usePathname/);
  assert.match(chrome, /aria-haspopup="true"/);
  assert.match(chrome, /data-current=\{itemActive \? "true" : undefined\}/);
  assert.match(chrome, /current === item\.label \? null : item\.label/);
});

test("Web V4.2 isolates the mobile header and prevents the narrow hero title regression", async () => {
  const chrome = fs.readFileSync(new URL("../app/components/SiteChrome.tsx", import.meta.url), "utf8");
  const home = fs.readFileSync(new URL("../app/components/HomeV4.tsx", import.meta.url), "utf8");
  const styles = fs.readFileSync(new URL("../app/v4.css", import.meta.url), "utf8");

  assert.match(chrome, /function MobileSiteHeader/);
  assert.match(chrome, /className=\{`v4-mobile-site-header/);
  assert.match(chrome, /document\.documentElement\.style\.overflow = "hidden"/);
  assert.match(chrome, /setMobileOpen\(false\)/);
  assert.match(home, /<span>MÜHENDİSLİKTEN<\/span><em>SAHAYA\.<\/em>/);
  assert.match(styles, /html body \.v4-desktop-site-header\{display:none!important\}/);
  assert.match(styles, /grid-template-columns:minmax\(0,1fr\) 48px 48px/);
  assert.match(styles, /@media \(max-width:380px\)[\s\S]*?\.v4-hero-copy h1\{font-size:37px/);

  // The corporate mobile header lives on corporate routes, not the tools or sign-in entries.
  const response = await render("/arkem");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /class="v4-mobile-site-header is-dark"/);
  assert.match(html, /aria-label="Menüyü aç"/);
});

test("Web V4.3 strengthens the corporate hero and closes the page with a complete footer", async () => {
  const stage = fs.readFileSync(new URL("../app/components/HeroProjectStage.tsx", import.meta.url), "utf8");
  const home = fs.readFileSync(new URL("../app/components/HomeV4.tsx", import.meta.url), "utf8");
  const chrome = fs.readFileSync(new URL("../app/components/SiteChrome.tsx", import.meta.url), "utf8");
  const styles = fs.readFileSync(new URL("../app/v4.css", import.meta.url), "utf8");

  assert.match(stage, /HeroProjectStageProject/);
  assert.match(stage, /setInterval\([\s\S]*?9000/);
  assert.match(home, /İLETİŞİME GEÇİN/);
  assert.match(chrome, /arkem-logo-master\.svg/);
  assert.match(chrome, /#\$\{variant\}/);
  assert.doesNotMatch(chrome, /official-logo-copper/);
  assert.match(chrome, /v4-footer-statement/);
  for (const group of ["Projeler", "Yapı Sistemleri", "Mühendislik", "Dijital Araçlar", "Kurumsal", "İletişim"]) {
    assert.match(chrome, new RegExp(group, "i"));
  }
  assert.doesNotMatch(chrome, /mailto:|arkemyapisistemleri@gmail\.com/i);
  assert.match(styles, /\.v4-hero-stage-media img\.v4-stage-image,\.v4-hero-stage-media video\.v4-stage-video/);
  assert.match(styles, /\.v4-contact-actions/);
  assert.match(styles, /\.v4-footer-statement/);

  const response = await render("/en");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /CALL ARKEM/);
  assert.match(html, /Engineering is the chain/);
  assert.doesNotMatch(html, /mailto:|arkemyapisistemleri@gmail\.com/i);
});

test("Web V4.4 keeps the hero copy inside a bounded editorial grid and uses the single master logo asset", async () => {
  const stage = fs.readFileSync(new URL("../app/components/HeroProjectStage.tsx", import.meta.url), "utf8");
  const home = fs.readFileSync(new URL("../app/components/HomeV4.tsx", import.meta.url), "utf8");
  const chrome = fs.readFileSync(new URL("../app/components/SiteChrome.tsx", import.meta.url), "utf8");
  const styles = fs.readFileSync(new URL("../app/v4.css", import.meta.url), "utf8");

  assert.match(home, /className="v4-hero-process"/);
  for (const step of ["Proje", "Analiz", "Detay", "Üretim", "Saha"]) assert.match(home, new RegExp(step));
  assert.match(stage, /data-project-code=\{project\.code\}/);
  assert.match(stage, /project\.facts|project\.location/);
  assert.doesNotMatch(stage, /v4-hero-stage-grid/);
  assert.match(styles, /grid-template-columns:repeat\(12,minmax\(0,1fr\)\)/);
  assert.match(styles, /grid-column:1 \/ span 5/);
  assert.match(styles, /grid-column:7 \/ -1/);
  assert.match(styles, /--v4-container:1480px/);
  assert.match(styles, /\.v4-hero-copy h1\{max-width:100%/);
  assert.match(styles, /transform:scale\(1\.08\)/);
  assert.doesNotMatch(styles, /official-logo-copper|scale\(2\.02\)/);
  assert.match(chrome, /const desktopNavigation = navigationTree/);
  assert.match(chrome, /const source = `\/brand\/arkem-logo-master\.svg#\$\{variant\}`/);
  assert.equal(fs.existsSync(new URL("../public/brand/arkem-logo-master.svg", import.meta.url)), true);
  assert.match(chrome, /\/brand\/arkem-logo-master\.svg#/);

  const response = await render("/en");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /ARKEM project process/);
  assert.match(html, /Completed precast concrete industrial building/);
});

test("Web V4.7 locks the direct production domain and the final design-system contract", async () => {
  const registry = fs.readFileSync(new URL("../app/data/corporate-registry.ts", import.meta.url), "utf8");
  const layout = fs.readFileSync(new URL("../app/layout.tsx", import.meta.url), "utf8");
  const sitemap = fs.readFileSync(new URL("../app/sitemap.ts", import.meta.url), "utf8");
  const styles = fs.readFileSync(new URL("../app/v4.css", import.meta.url), "utf8");

  assert.match(registry, /canonical: "https:\/\/arkemyapisistemleri\.com"/);
  assert.doesNotMatch(layout, /codex-preview/);
  assert.match(sitemap, /2026-09-02/);
  assert.match(styles, /--v4-copper:#bf6f27/);
  assert.match(styles, /\.v4-home \.shell[\s\S]*?--v4-container/);
  assert.match(styles, /\.v4-hero-grid\{display:grid;grid-template-columns:repeat\(12,minmax\(0,1fr\)\)/);
  assert.match(styles, /\.v4-hero-copy\{grid-column:1 \/ span 5/);
  assert.match(styles, /\.v4-hero-stage\{position:relative;grid-column:7 \/ -1/);
});

test("Web V4.5 binds the editorial hero and ARKEMX relationships to their registries", async () => {
  const projects = fs.readFileSync(new URL("../app/data/projects-v3.ts", import.meta.url), "utf8");
  const home = fs.readFileSync(new URL("../app/components/HomeV4.tsx", import.meta.url), "utf8");
  const stage = fs.readFileSync(new URL("../app/components/HeroProjectStage.tsx", import.meta.url), "utf8");
  const chrome = fs.readFileSync(new URL("../app/components/SiteChrome.tsx", import.meta.url), "utf8");
  const explorer = fs.readFileSync(new URL("../app/components/ArkemXRegistryExplorer.tsx", import.meta.url), "utf8");

  assert.match(projects, /heroFeatured\?: boolean/);
  assert.match(projects, /homepageFeatured\?: boolean/);
  assert.match(projects, /homepagePriority\?: number/);
  assert.match(projects, /heroPriority\?: number/);
  assert.match(projects, /heroMediaOrder\?: readonly string\[\]/);
  assert.match(projects, /code: "P-002"[\s\S]*?heroFeatured: true[\s\S]*?heroPriority: 1[\s\S]*?heroMediaOrder: \["cihan-archive-02", "cihan-archive-01"\]/);
  const moduleRegistry = fs.readFileSync(new URL("../app/data/arkemx-module-registry.ts", import.meta.url), "utf8");
  assert.match(moduleRegistry, /connectedModules: readonly string\[\]/);
  assert.match(moduleRegistry, /id: "proje-modeli"[\s\S]*?connectedModules: \["02", "03", "04", "05", "06", "07", "08", "09", "10", "11", "12", "13"\]/);
  assert.match(home, /filter\(\(project\) => project\.heroFeatured\)/);
  assert.match(home, /filter\(\(project\) => project\.homepageFeatured\)/);
  assert.match(home, /contentType\.startsWith\("image\/"\)[\s\S]*?contentType\.startsWith\("video\/"\)/);
  assert.match(stage, /<video className="v4-stage-video"[\s\S]*?autoPlay muted loop playsInline/);
  assert.doesNotMatch(stage, /v4-stage-switch|v4-stage-identity/);
  assert.doesNotMatch(chrome, /item\.label === "ARKEMX" \? <small/);
  assert.match(explorer, /relatedModules/);
  assert.match(explorer, /v4-module-network/);
  assert.match(explorer, /getRelatedCodes\(selectedModule\)/);

  const response = await render("/en");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /data-project-code="P-002"/);
  assert.match(html, /REAL PROJECT RECORD · P-002/);
});

test("Web V4.9 separates project publishing roles and keeps ARKEMX status metadata consistent", async () => {
  const { v3Projects } = await import("../app/data/projects-v3.ts");
  const { arkemXModuleRegistry } = await import("../app/data/arkemx-module-registry.ts");
  const explorer = fs.readFileSync(new URL("../app/components/ArkemXRegistryExplorer.tsx", import.meta.url), "utf8");

  const heroProjects = v3Projects.filter((project) => project.heroFeatured);
  const homepageProjects = v3Projects
    .filter((project) => project.homepageFeatured)
    .sort((left, right) => (left.homepagePriority ?? 999) - (right.homepagePriority ?? 999));
  assert.deepEqual(heroProjects.map((project) => project.code), ["P-002"]);
  assert.deepEqual(homepageProjects.map((project) => project.code), ["P-002", "P-003", "P-004"]);
  assert.ok(v3Projects.every((project) => project.archiveVisible));
  assert.equal(v3Projects[0].facts.location.status, "arşiv doğrulaması");
  assert.equal(v3Projects[0].homepageFeatured, undefined);

  const structuralSteel = arkemXModuleRegistry.find((module) => module.id === "yapisal-celik");
  assert.ok(structuralSteel);
  assert.equal(structuralSteel.status, "DOĞRULANIYOR");
  assert.match(structuralSteel.seoDescription, /doğrulanmaktadır/i);
  assert.doesNotMatch(structuralSteel.seoDescription, /geliştirme program/i);
  assert.match(explorer, /module\.version \?/);

  const homeResponse = await render("/en");
  assert.equal(homeResponse.status, 200);
  const homeHtml = await homeResponse.text();
  assert.match(homeHtml, /P-002/);
  assert.match(homeHtml, /P-003/);
  assert.match(homeHtml, /P-004/);
  assert.doesNotMatch(homeHtml, /P-001/);

  const arkemxResponse = await render("/arkemx");
  assert.equal(arkemxResponse.status, 200);
  const arkemxHtml = await arkemxResponse.text();
  assert.match(arkemxHtml, /ARKEMX Yapısal Çelik modülü/);
  assert.match(arkemxHtml, /https:\/\/arkemyapisistemleri\.com\/arkemx#yapisal-celik/);
});
