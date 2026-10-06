import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const workerUrl = new URL("../dist/server/index.js", import.meta.url);

async function render(pathname, requestHeaders = {}) {
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(
    new Request(`http://localhost${pathname}`, {
      headers: { accept: "text/html", ...requestHeaders },
    }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("local build sends unauthenticated root entry to ARKEMX sign-in", async () => {
  const response = await render("/");
  assert.ok(response.status === 307 || response.status === 308);
  assert.match(response.headers.get("location") ?? "", /\/giris\?return_to=%2Fdijital-proje-merkezi$/);
});

test("local build renders the ARKEMX tools catalogue on its dedicated route", async () => {
  const response = await render("/araclar");
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);
  const html = await response.text();
  assert.match(html, /<h1 id="arx-tools-title">Araçlar<\/h1>/);
  assert.match(html, /href="\/proje-baslat"/);
  assert.match(html, /href="\/arsa-fizibilite-studyosu\?stage=zoning/);
  assert.match(html, /href="\/mimari-program-studyosu"/);
  assert.match(html, /href="\/plan-ve-aks"/);
  assert.match(html, /href="\/tasiyici-on-tasarim"/);
  assert.match(html, /href="\/sistem-karsilastirma"/);
  assert.match(html, /href="\/bim-koordinasyon"/);
  assert.match(html, /href="\/proje-takibi"/);
  assert.match(html, /href="\/dijital-proje-merkezi#canli-proje-grafigi"/);
  assert.match(html, /href="\/giris\?return_to=%2Fhesabim"/);
  assert.match(html, /name="robots" content="noindex, nofollow"/);
});

test("ARKEMX workspace subroutes do not render the public WhatsApp contact widget", () => {
  const chrome = fs.readFileSync(new URL("../app/components/SiteChrome.tsx", import.meta.url), "utf8");

  assert.match(chrome, /arkemxWorkspaceRoots/);
  assert.match(chrome, /"\/mimari-program-studyosu"/);
  assert.match(chrome, /"\/tasarim-calismalari"/);
  assert.match(chrome, /pathname\?\.startsWith/);
  assert.match(chrome, /return null/);
});


test("KAKS program correction opens a focused architectural workspace", () => {
  const page = fs.readFileSync(new URL("../app/mimari-program-studyosu/kaks-duzeltme/page.tsx", import.meta.url), "utf8");
  const studio = fs.readFileSync(new URL("../app/components/ArchitecturalProgramStudio.tsx", import.meta.url), "utf8");
  const css = fs.readFileSync(new URL("../app/mimari-program-studyosu/kaks-duzeltme/kaks-duzeltme.css", import.meta.url), "utf8");
  const graph = fs.readFileSync(new URL("../app/lib/project-graph.ts", import.meta.url), "utf8");

  assert.match(page, /className="arx-kaks-page-intro"/);
  assert.match(page, /KONTROL · PLN-012/);
  assert.match(page, /Program brütünü düzelt/);
  assert.match(page, /stage=zoning&focus=kaks#geo-studyo/);
  assert.match(page, /ArchitecturalProgramStudio issueFocus="kaks"/);
  assert.match(studio, /arx-kaks-project-strip/);
  assert.match(studio, /PROGRAM \/ KULLANIM UYUMSUZLUĞU/);
  assert.match(studio, /programUseMismatch/);
  assert.match(studio, /şablonuna geçir/);
  assert.match(studio, /architectural-program-kaks-focus/);
  assert.match(studio, /KAKS'A GÖRE AZAMİ/);
  assert.match(studio, /KAKS sınırı geçti/);
  assert.match(studio, /Program dağılımını koruyarak sınır içine indir/);
  assert.match(studio, /arx-kaks-space-columns/);
  assert.match(studio, /setSpaces\(\(current\) => current\.map/);
  assert.match(css, /KAKS correction UI v4/);
  assert.match(graph, /\/mimari-program-studyosu\/kaks-duzeltme/);
});


test("PLN-010 expert review is explicit, non-authoritative and invalidated by zoning changes", () => {
  const geo = fs.readFileSync(new URL("../app/components/GeoParcelStudio.tsx", import.meta.url), "utf8");
  const zoning = fs.readFileSync(new URL("../app/lib/zoning.ts", import.meta.url), "utf8");
  const graph = fs.readFileSync(new URL("../app/lib/project-graph.ts", import.meta.url), "utf8");
  const css = fs.readFileSync(new URL("../app/arsa-fizibilite-studyosu/sade-arazi.css", import.meta.url), "utf8");

  assert.match(zoning, /expertReviewStatus/);
  assert.match(zoning, /expertReviewed: expertReviewComplete/);
  assert.match(zoning, /authoritative:/);
  assert.match(zoning, /zoning\.verification === "certified-document"/);

  assert.match(geo, /Uzman incelemesi/);
  assert.match(geo, /PLN-010 için gerekli/);
  assert.match(geo, /Kaynak ile girilen imar koşulları uyumlu/);
  assert.match(geo, /İnceleyen \/ uzman adı/);
  assert.match(geo, /Rol \/ uzmanlık/);
  assert.match(geo, /Dayanak \/ referans/);
  assert.match(geo, /PLN-010 kapanmaya hazır/);
  assert.match(geo, /expertReviewStatus: "not-reviewed"/);
  assert.match(geo, /resmî onay değildir/);

  assert.match(graph, /zoningAuthoritative \|\| geoZoningProvenance\.expertReviewed === true/);
  assert.match(css, /04 \/ İmar · uzman inceleme kaydı/);
  assert.match(css, /geo-expert-review-result/);
});


test("project centre shows completed controls and zoning review links preserve field focus", () => {
  const hub = fs.readFileSync(new URL("../app/components/DigitalProjectHub.tsx", import.meta.url), "utf8");
  const graph = fs.readFileSync(new URL("../app/lib/project-graph.ts", import.meta.url), "utf8");
  const geo = fs.readFileSync(new URL("../app/components/GeoParcelStudio.tsx", import.meta.url), "utf8");
  const css = fs.readFileSync(new URL("../app/arsa-fizibilite-studyosu/sade-arazi.css", import.meta.url), "utf8");

  assert.match(graph, /export type CompletedControl/);
  assert.match(graph, /completedControls/);
  assert.match(graph, /code: "PLN-011"/);
  assert.match(graph, /code: "PLN-012"/);
  assert.match(graph, /focus=kaks/);

  assert.match(hub, /Tamamlanan kontroller \/ düzeltmeler/);
  assert.match(hub, /thread\.completedControls/);
  assert.match(hub, /arx-completed-control-list/);

  assert.match(geo, /const \[zoningFocus, setZoningFocus\]/);
  assert.match(geo, /requestedFocus === "kaks"/);
  assert.match(geo, /PLN-012 · KAKS GİRDİSİ/);
  assert.match(geo, /geo-zoning-focus-target/);
  assert.match(geo, /geo-zoning-source-focus/);
  assert.match(css, /Sade Arazi\/Parsel UI v8/);
});


test("STR-031 opens a focused structural sync workspace and preserves synchronized geometry on full-studio hydration", () => {
  const page = fs.readFileSync(new URL("../app/tasarim-calismalari/model-senkronizasyonu/page.tsx", import.meta.url), "utf8");
  const studio = fs.readFileSync(new URL("../app/components/StructuralSyncStudio.tsx", import.meta.url), "utf8");
  const structural = fs.readFileSync(new URL("../app/components/StructuralDesigner.tsx", import.meta.url), "utf8");
  const graph = fs.readFileSync(new URL("../app/lib/project-graph.ts", import.meta.url), "utf8");
  const css = fs.readFileSync(new URL("../app/tasarim-calismalari/model-senkronizasyonu/model-senkronizasyonu.css", import.meta.url), "utf8");

  assert.match(page, /KONTROL · STR-031 \/ STR-032 \/ STR-033/);
  assert.match(page, /Plan ile taşıyıcı modeli senkronize et/);
  assert.match(page, /StructuralSyncStudio/);

  assert.match(studio, /H-03 · PLAN → TAŞIYICI MODEL/);
  assert.match(studio, /Plan verisini taşıyıcı modele aktar/);
  assert.match(studio, /SENKRON TAMAMLANDI/);
  assert.match(studio, /Geometri eşleşiyor/);
  assert.match(studio, /SENKRONİZE EDİLEN ALANLAR/);
  assert.match(studio, /patchModule\("structural-concept"/);
  assert.match(studio, /floors: planFloors/);
  assert.match(studio, /width: Number\(planWidth\.toFixed\(3\)\)/);
  assert.match(studio, /depth: Number\(planDepth\.toFixed\(3\)\)/);
  assert.match(studio, /fields: \["floors", "width", "depth", "baysX", "baysY"\]/);

  assert.match(structural, /const \[modelHydrated, setModelHydrated\] = useState\(false\)/);
  assert.match(structural, /if \(!hydrated \|\| !modelHydrated\) return/);
  assert.match(structural, /setModelHydrated\(true\)/);

  assert.match(graph, /STR-031/);
  assert.match(graph, /\/tasarim-calismalari\/model-senkronizasyonu/);
  assert.match(css, /arx-struct-sync-page/);
  assert.match(css, /Structural sync UX v2/);
  assert.match(css, /arx-struct-sync-complete/);
});


test("ARC-021 can preserve the program by expanding plan footprint when TAKS permits", () => {
  const page = fs.readFileSync(new URL("../app/tasarim-calismalari/program-plan-alani/page.tsx", import.meta.url), "utf8");
  const studio = fs.readFileSync(new URL("../app/components/ArchitecturalProgramStudio.tsx", import.meta.url), "utf8");
  const editor = fs.readFileSync(new URL("../app/components/AdvancedPlanEditor.tsx", import.meta.url), "utf8");

  assert.match(page, /KONTROL · ARC-021/);
  assert.match(page, /Plan tabanını programa göre koordine et/);
  assert.match(page, /AdvancedPlanEditor issueFocus="program-area"/);

  assert.match(studio, /canExpandPlanToProgram/);
  assert.match(studio, /programTargetFootprint/);
  assert.match(studio, /Plan tabanını programa göre düzenle/);
  assert.match(studio, /href="\/tasarim-calismalari\/program-plan-alani"/);
  assert.match(studio, /Programı mevcut plana küçült/);

  assert.match(editor, /issueFocus\?: "taks" \| "kmkr" \| "program-area" \| false/);
  assert.match(editor, /programFootprintTarget/);
  assert.match(editor, /programFootprintFeasible/);
  assert.match(editor, /applyProgramFootprintSuggestion/);
  assert.match(editor, /Plan tabanını program kapasitesine getir/);
  assert.match(editor, /Kat adedi ve imar girdileri burada değiştirilmez/);
});


test("ARC-021 uses a focused program-plan coordination workspace", () => {
  const page = fs.readFileSync(new URL("../app/mimari-program-studyosu/plan-koordinasyonu/page.tsx", import.meta.url), "utf8");
  const studio = fs.readFileSync(new URL("../app/components/ArchitecturalProgramStudio.tsx", import.meta.url), "utf8");
  const graph = fs.readFileSync(new URL("../app/lib/project-graph.ts", import.meta.url), "utf8");
  const css = fs.readFileSync(new URL("../app/mimari-program-studyosu/plan-koordinasyonu/plan-koordinasyonu.css", import.meta.url), "utf8");

  assert.match(page, /KONTROL · ARC-021/);
  assert.match(page, /Program ile plan alanını koordine et/);
  assert.match(page, /ArchitecturalProgramStudio issueFocus="plan-sync"/);

  assert.match(studio, /architectural-program-plan-sync/);
  assert.match(studio, /ARC-021 · PROGRAM ↔ PLAN ALAN KOORDİNASYONU/);
  assert.match(studio, /Programı mevcut plan kapasitesine ölçekle/);
  assert.match(studio, /applyPlanCoordinationSuggestion/);
  assert.match(studio, /setTargetGross\(Math\.max\(100, Number\(planGross\.toFixed\(1\)\)\)\)/);
  assert.match(studio, /if \(planFloorCount > 0\) setFloors\(planFloorCount\)/);
  assert.match(studio, /ÖNCE PROGRAM KULLANIMINI DÜZELTİN/);

  assert.match(graph, /ARC-021/);
  assert.match(graph, /\/mimari-program-studyosu\/plan-koordinasyonu/);
  assert.match(graph, /Program \/ plan alan koordinasyonu/);
  assert.match(css, /arx-plan-sync-page/);
});


test("SYS-041 uses a focused decision workspace instead of forcing the MCDA winner", () => {
  const page = fs.readFileSync(new URL("../app/yapi-sistemi-karsilastirma/sistem-karari/page.tsx", import.meta.url), "utf8");
  const studio = fs.readFileSync(new URL("../app/components/SystemDecisionStudio.tsx", import.meta.url), "utf8");
  const graph = fs.readFileSync(new URL("../app/lib/project-graph.ts", import.meta.url), "utf8");
  const css = fs.readFileSync(new URL("../app/yapi-sistemi-karsilastirma/sistem-karari/sistem-karari.css", import.meta.url), "utf8");

  assert.match(page, /KONTROL · SYS-041/);
  assert.match(page, /Taşıyıcı sistem kararını gerekçesiyle bağla/);
  assert.match(page, /SystemDecisionStudio/);
  assert.match(page, /href="\/yapi-sistemi-karsilastirma\/mcda"/);
  assert.match(page, /href="\/tasiyici-on-tasarim"/);
  assert.doesNotMatch(page, /yapi-sistemi-karsilastirma#sistem-karsilastirma/);
  assert.doesNotMatch(page, /tasarim-calismalari#tasiyici-on-tasarim/);

  assert.match(studio, /MCDA önerisini modele uygula/);
  assert.match(studio, /Mevcut sistemi gerekçeli olarak koru/);
  assert.match(studio, /decisionType: "retain-modeled-system"/);
  assert.match(studio, /decisionType: "aligned-with-mcda"/);
  assert.match(studio, /mcdaSourceKey: currentSourceKey/);
  assert.match(studio, /MCDA güncel değil/);
  assert.match(studio, /Sistem kararı geçici olarak kilitlendi/);
  assert.match(studio, /href="\/yapi-sistemi-karsilastirma\/mcda"/);
  assert.match(studio, /patchModule\("structural-concept", \{ input: \{ system: recommendedId \} \}\)/);
  assert.match(studio, /patchModule\("system-comparison"/);
  assert.match(studio, /MCDA sonucu nihai mühendislik kararı değildir/);
  assert.match(studio, /nihai statik sistem onayı değildir/);

  assert.match(graph, /SYS-040/);
  assert.match(graph, /MCDA girdileri güncel proje verisiyle eşleşmiyor/);
  assert.match(graph, /systemDecisionRecorded/);
  assert.match(graph, /\/yapi-sistemi-karsilastirma\/sistem-karari/);
  assert.match(graph, /Taşıyıcı sistem karar koordinasyonu/);
  assert.match(css, /arx-system-decision-page/);
});


test("project MCDA link opens a focused workspace instead of the public comparison page", () => {
  const page = fs.readFileSync(new URL("../app/yapi-sistemi-karsilastirma/mcda/page.tsx", import.meta.url), "utf8");
  const tool = fs.readFileSync(new URL("../app/components/SystemComparisonTool.tsx", import.meta.url), "utf8");
  const css = fs.readFileSync(new URL("../app/yapi-sistemi-karsilastirma/mcda/mcda.css", import.meta.url), "utf8");

  assert.match(page, /Taşıyıcı sistemleri proje verisiyle karşılaştır/);
  assert.match(page, /SystemComparisonTool simple/);
  assert.match(page, /href="\/yapi-sistemi-karsilastirma\/sistem-karari"/);
  assert.match(page, /href="\/tasiyici-on-tasarim"/);
  assert.doesNotMatch(page, /SiteHeader/);
  assert.doesNotMatch(page, /SiteFooter/);

  assert.match(tool, /if \(simple\)/);
  assert.match(tool, /arx-system-context/);
  assert.match(tool, /MÜHENDİSLİK \/ SİSTEM SEÇİMİ/);
  assert.doesNotMatch(tool.match(/if \(simple\)[\s\S]*?return <section className="system-comparison-tool/)?.[0] ?? "", /ProjectKernelBar module="STRUCTURAL SYSTEM MCDA"/);
  assert.match(tool, /Proje verilerini yenile/);
  assert.match(tool, /PROJE VERİSİ GÜNCELLENDİ/);
  assert.match(tool, /Karşılaştırma girdileri aktif proje verisinden farklı/);
  assert.match(tool, /Proje verilerini yenile ve puanları güncelle/);
  assert.match(tool, /Persist the canonical project source immediately/);
  assert.match(tool, /sourceKey: mcdaSourceKey\(currentProjectSource\)/);
  assert.match(tool, /sourceStatus: "current"/);
  assert.match(tool, /sourceSnapshot/);
  assert.match(tool, /sourceStatus: sourceStale/);
  assert.match(tool, /buildMcdaProjectSnapshot/);
  assert.match(tool, /Sistem ön değerlendirmesi/);
  assert.match(tool, /Kısa listeden çıkar/);
  assert.match(tool, /Listeyi temizle/);
  assert.match(tool, /href="\/tasiyici-on-tasarim"/);
  assert.match(css, /arx-mcda-page/);
  assert.match(css, /arx-system-context/);
  assert.match(css, /arx-mcda-source-status\.is-stale/);
});


test("BIM-052 safely recenters only fully conceptual KM-KR source sets", () => {
  const page = fs.readFileSync(new URL("../app/tasarim-calismalari/km-kr-kaynaklari/page.tsx", import.meta.url), "utf8");
  const editor = fs.readFileSync(new URL("../app/components/AdvancedPlanEditor.tsx", import.meta.url), "utf8");

  assert.match(page, /KONTROL · BIM-052 \/ BIM-053/);
  assert.match(page, /KM–KR ön kontrolünü düzenle/);

  assert.match(editor, /const highX = Math\.max\(0, baysX - 1 - lowX\)/);
  assert.match(editor, /const highY = Math\.max\(0, baysY - 1 - lowY\)/);
  assert.match(editor, /manualMassPointCount/);
  assert.match(editor, /manualRigidityPointCount/);
  assert.match(editor, /canRecenterConceptualKmKr/);
  assert.match(editor, /metrics\.manualMassPointCount === 0/);
  assert.match(editor, /metrics\.manualRigidityPointCount === 0/);
  assert.match(editor, /Temsilî kaynakları yeniden merkezle/);
  assert.match(editor, /Aks dışı kütle kaynaklarını güncel plana uyarla/);
  assert.match(editor, /outOfGridMassPointCount/);
  assert.match(editor, /canRemapManualMassSources/);
  assert.match(editor, /remapManualMassSourcesToCurrentGrid/);
  assert.match(editor, /sourceBaysX/);
  assert.match(editor, /sourceBaysY/);
  assert.match(editor, /canAlignConceptualRigidityToMass/);
  assert.match(editor, /alignConceptualRigidityToMass/);
  assert.match(editor, /nearestBracket/);
  assert.match(editor, /Temsilî rijitlik setini KM çevresine yerleştir/);
  assert.match(editor, /manuel kütle verisi korunurken temsilî rijitlik seti KM çevresindeki akslara taşınabilir/);
  assert.match(editor, /Dışmerkezlik göstergesi yüksek/);
});


test("BIM-053 uses a focused KM-KR source workspace with explicit conceptual provenance", () => {
  const page = fs.readFileSync(new URL("../app/tasarim-calismalari/km-kr-kaynaklari/page.tsx", import.meta.url), "utf8");
  const editor = fs.readFileSync(new URL("../app/components/AdvancedPlanEditor.tsx", import.meta.url), "utf8");
  const graph = fs.readFileSync(new URL("../app/lib/project-graph.ts", import.meta.url), "utf8");
  const css = fs.readFileSync(new URL("../app/tasarim-calismalari/km-kr-kaynaklari/km-kr-kaynaklari.css", import.meta.url), "utf8");

  assert.match(page, /KONTROL · BIM-052 \/ BIM-053/);
  assert.match(page, /KM–KR ön kontrolünü düzenle/);
  assert.match(page, /AdvancedPlanEditor issueFocus="kmkr"/);

  assert.match(editor, /issueFocus\?: "taks" \| "kmkr" \| "program-area" \| false/);
  assert.match(editor, /Temsilî kaynak seti oluştur/);
  assert.match(editor, /provenance: "conceptual-seed"/);
  assert.match(editor, /conceptualMassPointCount/);
  assert.match(editor, /conceptualRigidityPointCount/);
  assert.match(editor, /KM\/KR ön kontrolü hesaplanabilir/);
  assert.match(editor, /Geometrik plaka merkezi KR kabul edilmez/);
  assert.match(editor, /deprem düzensizlik hesabı değildir/);

  assert.match(graph, /BIM-053/);
  assert.match(graph, /\/tasarim-calismalari\/km-kr-kaynaklari/);
  assert.match(graph, /KM–KR kaynak yeterliliği/);
  assert.match(css, /arx-kmkr-page/);
});


test("PLN-013 opens a focused Hmax workspace and edits the real floor-count owner", () => {
  const page = fs.readFileSync(new URL("../app/tasarim-calismalari/yukseklik-duzeltme/page.tsx", import.meta.url), "utf8");
  const studio = fs.readFileSync(new URL("../app/components/HeightCorrectionStudio.tsx", import.meta.url), "utf8");
  const graph = fs.readFileSync(new URL("../app/lib/project-graph.ts", import.meta.url), "utf8");
  const css = fs.readFileSync(new URL("../app/tasarim-calismalari/yukseklik-duzeltme/yukseklik-duzeltme.css", import.meta.url), "utf8");

  assert.match(page, /KONTROL · PLN-013/);
  assert.match(page, /Yapı yüksekliğini düzelt/);
  assert.match(page, /stage=zoning&focus=hmax#geo-studyo/);
  assert.match(page, /HeightCorrectionStudio/);

  assert.match(studio, /Plan & aks modeli/);
  assert.match(studio, /Taşıyıcı ön tasarım/);
  assert.match(studio, /Kat adedini \{maxFloorsAtCurrentHeight\} yap/);
  assert.match(studio, /DÜZELTME UYGULANDI/);
  assert.match(studio, /fromFloors/);
  assert.match(studio, /toFloors/);
  assert.match(studio, /Hmax sınırı içinde/);
  assert.match(studio, /patchModule\("plan-editor", \{ floorCount: safe \}\)/);
  assert.match(studio, /patchModule\("architectural-program", \{ input: \{ floors: safe \} \}\)/);
  assert.match(studio, /patchModule\("geo-parcel", \{ floors: safe \}\)/);
  assert.match(studio, /MODEL KOORDİNASYONU/);
  assert.match(studio, /Hmax sınırı içinde/);

  assert.match(graph, /code: "PLN-013"/);
  assert.match(graph, /Hmax \/ yapı yüksekliği ön kontrolü/);
  assert.match(graph, /\/tasarim-calismalari\/yukseklik-duzeltme/);
  assert.match(css, /arx-height-fix-page/);
  assert.match(css, /Hmax correction UX v2/);
  assert.match(css, /background:#fff !important/);
  assert.match(css, /arx-height-change-summary/);
});


test("TAKS plan correction preserves saved geometry before writes and uses the focused shell", () => {
  const page = fs.readFileSync(new URL("../app/tasarim-calismalari/plan-duzeltme/page.tsx", import.meta.url), "utf8");
  const editor = fs.readFileSync(new URL("../app/components/AdvancedPlanEditor.tsx", import.meta.url), "utf8");
  const css = fs.readFileSync(new URL("../app/tasarim-calismalari/plan-duzeltme/plan-duzeltme.css", import.meta.url), "utf8");
  const graph = fs.readFileSync(new URL("../app/lib/project-graph.ts", import.meta.url), "utf8");

  assert.match(page, /KONTROL · PLN-011/);
  assert.match(page, /Plan tabanını düzelt/);
  assert.match(page, /stage=zoning&focus=taks#geo-studyo/);
  assert.match(page, /AdvancedPlanEditor issueFocus/);
  assert.doesNotMatch(page, /SiteHeader/);

  assert.match(editor, /const \[modelHydrated, setModelHydrated\] = useState\(false\)/);
  assert.match(editor, /setModelHydrated\(true\)/);
  assert.match(editor, /if \(!hydrated \|\| !modelHydrated\) return/);
  assert.match(editor, /cad-issue-project-strip/);
  assert.match(editor, /PLN-011 yalnız taban geometrisini düzenler/);
  assert.match(editor, /TAKS sınırı geçti/);
  assert.match(editor, /TAKS'A GÖRE AZAMİ/);
  assert.match(editor, /Oranı koruyarak önerilen ölçüleri uygula/);
  assert.match(css, /arx-plan-fix-page/);
  assert.match(css, /cad-issue-project-strip/);
  assert.match(graph, /\/tasarim-calismalari\/plan-duzeltme/);
});


test("project centre next action follows the first incomplete guided journey step", () => {
  const kernel = fs.readFileSync(new URL("../app/components/ProjectKernel.tsx", import.meta.url), "utf8");
  const center = fs.readFileSync(new URL("../app/components/SimpleProjectCenter.tsx", import.meta.url), "utf8");
  const hub = fs.readFileSync(new URL("../app/components/DigitalProjectHub.tsx", import.meta.url), "utf8");

  assert.match(kernel, /export function deriveProjectJourneyState/);
  assert.match(kernel, /firstIncompleteIndex/);
  assert.match(kernel, /nextStep = PROJECT_JOURNEY\[currentIndex\]/);
  assert.match(center, /deriveProjectJourneyState\(thread\)/);
  assert.match(center, /journeyNextAction\.label/);
  assert.match(center, /journeyNextAction\.route/);
  assert.match(hub, /deriveProjectJourneyState\(thread\)/);
  assert.match(hub, /journeyNextAction\.label/);
  assert.match(hub, /journeyNextAction\.route/);
  assert.match(center, /currentJourneyStep\.short === "Arazi"/);
});

test("project centre clearly distinguishes seven journey stages from technical modules", () => {
  const center = fs.readFileSync(new URL("../app/components/SimpleProjectCenter.tsx", import.meta.url), "utf8");
  const graph = fs.readFileSync(new URL("../app/lib/project-graph.ts", import.meta.url), "utf8");
  const moduleCount = (graph.match(/\{ id: "/g) || []).length;
  assert.equal(moduleCount, 13);
  assert.match(center, /PROJECT_MODULES\.length/);
  assert.match(center, /ana aşama tamamlandı/);
  assert.match(center, /teknik modül/);
});

test("parcel workspace refreshes listing-sourced identity when the selected land candidate changes", () => {
  const geo = fs.readFileSync(new URL("../app/components/GeoParcelStudio.tsx", import.meta.url), "utf8");
  assert.match(geo, /const selectedCandidateId = selectedCandidate\?\.id \?\? ""/);
  assert.match(geo, /listingIdentitySource\.sourceUrl === selectedCandidateId/);
  assert.match(geo, /setNeighborhoodId\(""/);
  assert.match(geo, /setListingIdentitySource\(null\)/);
  assert.match(geo, /Önceki ilandan otomatik taşınan mahalle\/köy, ada, parsel/);
  assert.match(geo, /currentZoning\.current\.sourceType === "İlan beyanı"/);
});

test("parcel workflow resets the shared viewport to map context and keeps brief usage synchronized", () => {
  const geo = fs.readFileSync(new URL("../app/components/GeoParcelStudio.tsx", import.meta.url), "utf8");
  const start = fs.readFileSync(new URL("../app/components/ProjectStartStudio.tsx", import.meta.url), "utf8");
  assert.match(geo, /setViewMode\(stage === "terrain" \? "terrain" : "map"\)/);
  assert.match(start, /const geoUsageLabels: Record<ProjectIntake\["usage"\], string>/);
  assert.match(start, /usage: geoUsageLabels\[intake\.usage\]/);
});

test("parcel draft numeric inputs can be cleared before a replacement value is committed", () => {
  const geo = fs.readFileSync(new URL("../app/components/GeoParcelStudio.tsx", import.meta.url), "utf8");
  assert.match(geo, /const \[draftBuildingInputs, setDraftBuildingInputs\]/);
  assert.match(geo, /onBlur=\{\(\) => commitDraftBuildingInput\("width"\)\}/);
  assert.match(geo, /onBlur=\{\(\) => commitDraftBuildingInput\("depth"\)\}/);
  assert.match(geo, /onBlur=\{\(\) => commitDraftBuildingInput\("floors"\)\}/);
  assert.match(geo, /onBlur=\{\(\) => commitDraftBuildingInput\("floorHeight"\)\}/);
  assert.match(geo, /onBlur=\{\(\) => commitDraftBuildingInput\("parking"\)\}/);
  assert.doesNotMatch(geo, /setBuildingWidth\(normalizeMassingDimension\(Math\.max\(6, Math\.min\(70, Number\(event\.target\.value\)\)\)\)\)/);
});

test("draft architecture transfer uses the current geo draft and a matching use template", () => {
  const geo = fs.readFileSync(new URL("../app/components/GeoParcelStudio.tsx", import.meta.url), "utf8");
  const architect = fs.readFileSync(new URL("../app/components/ArchitecturalProgramStudio.tsx", import.meta.url), "utf8");
  assert.match(geo, /mimari-program-studyosu\?from=geo-draft/);
  assert.match(architect, /new URLSearchParams\(window\.location\.search\)\.get\("from"\) === "geo-draft"/);
  assert.match(architect, /Math\.round\(width \* depth \* nextFloors\)/);
  assert.match(architect, /setSpaces\(templates\[nextUse\]\.spaces/);
  assert.match(architect, /setRelationships\(templates\[nextUse\]\.relationships/);
  assert.match(architect, /Eski kullanım şablonu uyuşmazlığı düzeltildi/);
});

test("architectural program detects stale area/floor data and can resync directly from geo draft", () => {
  const architect = fs.readFileSync(new URL("../app/components/ArchitecturalProgramStudio.tsx", import.meta.url), "utf8");
  assert.match(architect, /const geoDraftMismatch = geoDraftAvailable/);
  assert.match(architect, /Math\.round\(geoDraftWidth \* geoDraftDepth \* geoDraftFloors\)/);
  assert.match(architect, /Arazi taslağını yeniden aktar/);
  assert.match(architect, /if \(geoDraftAvailable\) \{\s*syncFromGeoDraft\(\)/);
  assert.match(architect, /Plan & Aks'a geçmeden önce aynı kaynağa bağlayın/);
});

test("geo to architecture navigation snapshots the visible draft before route change", () => {
  const geo = fs.readFileSync(new URL("../app/components/GeoParcelStudio.tsx", import.meta.url), "utf8");
  const architect = fs.readFileSync(new URL("../app/components/ArchitecturalProgramStudio.tsx", import.meta.url), "utf8");
  assert.match(geo, /ARKEM-GEO-ARCH-TRANSFER\/1\.0/);
  assert.match(geo, /width: normalizeMassingDimension\(buildingWidth\)/);
  assert.match(geo, /floors,\s*floorHeight/);
  assert.match(geo, /onClick=\{prepareDraftArchitectureTransfer\}/);
  assert.match(architect, /arkemx-architecture-draft-transfer:/);
  assert.match(architect, /const transferSource = Object\.keys\(explicitTransfer\)\.length \? explicitTransfer : geo/);
  assert.match(architect, /Yapı Yerleşimi ekranındaki güncel taslak doğrudan aktarıldı/);
});


test("project centre separates project type and does not count undecided structure as ready", () => {
  const kernel = fs.readFileSync(new URL("../app/components/ProjectKernel.tsx", import.meta.url), "utf8");
  const center = fs.readFileSync(new URL("../app/components/SimpleProjectCenter.tsx", import.meta.url), "utf8");
  const hub = fs.readFileSync(new URL("../app/components/DigitalProjectHub.tsx", import.meta.url), "utf8");
  const graph = fs.readFileSync(new URL("../app/lib/project-graph.ts", import.meta.url), "utf8");

  assert.match(kernel, /normalizeProjectName/);
  assert.match(kernel, /Proje\\s\+türü/);
  assert.match(center, /arx-center-project-type">\{projectType\}/);
  assert.match(kernel, /step\.short === "Sistem"/);
  assert.match(kernel, /systemDecisionReady/);
  assert.match(hub, /journeyState\.systemDecisionReady/);
  assert.match(hub, /ready: systemDecisionReady/);
  assert.match(graph, /quickSiteScenarioReady/);
  assert.match(graph, /label: "Sistemi ve yöntemi seç"/);
});


test("local build renders the simplified, device-scoped project centre", async () => {
  const response = await render("/dijital-proje-merkezi");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /<h1>Proje Çalışma Alanı<\/h1>/);
  assert.match(html, /Yeni Proje Başlat/);
  assert.match(html, /Henüz aktif projeniz yok/);
  assert.match(html, /Proje Yedeği Yükle/);
  assert.match(html, /Hesabımdaki Projeleri Aç/);
  assert.match(html, /href="\/hesabim"/);
  assert.match(html, /Proje Kontrolleri/);
  assert.match(html, /Proje kontrol özeti/);
  assert.match(html, /Aktif proje seçildikten sonra kontroller/);
  assert.match(html, /Teslim hazırlığı ve teknik çıktılar/);
  assert.match(html, /data-testid="digital-project-hub"/);
  assert.doesNotMatch(html, /Bağlı çalışma alanları\./);
  assert.doesNotMatch(html, /Proje kontrol merkezi/);
});

test("local build opens the dedicated plan and grid workspace", async () => {
  const response = await render("/plan-ve-aks");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /<h1>Plan ve aks<\/h1>/);
  assert.match(html, /data-testid="advanced-plan-editor"/);
  assert.match(html, /href="\/dijital-proje-merkezi"/);
  assert.match(html, /name="robots" content="noindex, nofollow"/);
  assert.doesNotMatch(html, /class="design-studio-hero"/);
  assert.doesNotMatch(html, /class="v4-mobile-site-header/);
});

test("local build opens the dedicated structural concept workspace", async () => {
  const response = await render("/tasiyici-on-tasarim");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /<h1>Taşıyıcı ön tasarım<\/h1>/);
  assert.match(html, /data-testid="structural-designer"/);
  assert.match(html, /href="\/sistem-karsilastirma"/);
  assert.match(html, /name="robots" content="noindex, nofollow"/);
  assert.doesNotMatch(html, /class="design-studio-hero"/);
});

test("local build renders the focused system comparison with working navigation", async () => {
  const response = await render("/sistem-karsilastirma");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /<h1>Yapı sistemi karşılaştırma<\/h1>/);
  assert.match(html, /data-testid="system-comparison-tool"/);
  assert.match(html, /Proje girdileri/);
  assert.match(html, /Sistem ön değerlendirmesi/);
  assert.match(html, /Kriter öncelikleri ve ağırlıkları/);
  assert.match(html, /href="\/tasiyici-on-tasarim"/);
  assert.match(html, /name="robots" content="noindex, nofollow"/);
  assert.doesNotMatch(html, /class="comparison-hero/);
  assert.doesNotMatch(html, /class="project-guided-journey/);
});

test("final system comparison exposes project KPIs, readable scores and an actionable shortlist", () => {
  const tool = fs.readFileSync(new URL("../app/components/SystemComparisonTool.tsx", import.meta.url), "utf8");
  const css = fs.readFileSync(new URL("../app/sistem-karsilastirma/sade-sistem.css", import.meta.url), "utf8");
  assert.match(tool, /formatSpan/);
  assert.match(tool, /formatScore/);
  assert.match(tool, /arx-system-context-kpis/);
  assert.match(tool, /KISA LİSTE · \{shortlist\.length\}/);
  assert.match(tool, /Listeyi temizle/);
  assert.match(tool, /Önce sistem seçin/);
  assert.match(tool, /The project advanced after this MCDA record was saved/);
  assert.match(tool, /setArea\(Number\(currentProjectSource\.area\.toFixed\(1\)\)\)/);
  assert.match(tool, /setSpan\(Number\(currentProjectSource\.span\.toFixed\(2\)\)\)/);
  assert.match(css, /Prototype final polish — system selection/);
  assert.match(css, /arx-system-result-title/);
  assert.match(css, /arx-system-next/);
});

test("system comparison has a complete dark-theme surface instead of light cards on black", () => {
  const css = fs.readFileSync(new URL("../app/sistem-karsilastirma/sade-sistem.css", import.meta.url), "utf8");
  assert.match(css, /Final dark theme — focused system comparison/);
  assert.match(css, /html\[data-theme="dark"\] \.arx-system-page \.arx-system-panel/);
  assert.match(css, /html\[data-theme="dark"\] \.arx-system-page \.arx-system-fields input/);
  assert.match(css, /html\[data-theme="dark"\] \.arx-system-page \.arx-system-result\.is-selected/);
  assert.match(css, /html\[data-theme="dark"\] \.arx-system-page \.arx-system-shortlist/);
  assert.match(css, /html\[data-theme="dark"\] \.arx-system-page \.arx-mcda-source-status\.is-current/);
});

test("local build renders the focused BIM coordination workspace", async () => {
  const response = await render("/bim-koordinasyon");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /<h1>BIM koordinasyon<\/h1>/);
  assert.match(html, /data-testid="engineering-coordination-studio"/);
  assert.match(html, /Koordinasyon girdileri/);
  assert.match(html, /Koordinasyon özeti/);
  assert.match(html, /Öncelikli açık konular/);
  assert.match(html, /href="\/proje-takibi"/);
  assert.match(html, /name="robots" content="noindex, nofollow"/);
  assert.doesNotMatch(html, /class="coordination-page-hero/);
  assert.doesNotMatch(html, /class="project-guided-journey/);
});

test("local build renders the focused project tracking workspace", async () => {
  const response = await render("/proje-takibi");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /<h1>Proje takibi<\/h1>/);
  assert.match(html, /data-testid="project-operating-system"/);
  assert.match(html, /Proje durumu ve açık işler/);
  assert.match(html, /Teslim hazırlığı/);
  assert.match(html, /Kararlar ve RFI/);
  assert.match(html, /href="\/dijital-proje-merkezi"/);
  assert.match(html, /name="robots" content="noindex, nofollow"/);
  assert.doesNotMatch(html, /class="os-page-hero/);
  assert.doesNotMatch(html, /class="project-guided-journey/);
});

test("local build renders the focused ARKEMX sign-in entry", async () => {
  const response = await render("/giris?return_to=%2Fbim-koordinasyon");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /<h1 id="arx-auth-title">ARKEMX’e Giriş<\/h1>/);
  assert.match(html, /Giriş Yap/);
  assert.match(html, /action="\/hesap-baglantisi"/);
  assert.match(html, /name="return_to" value="\/bim-koordinasyon"/);
  assert.match(html, /href="\/hesap-kurulum\?return_to=%2Fbim-koordinasyon&amp;entry=first-use"/);
  assert.match(html, /İlk kurulumu başlat/);
  assert.match(html, /name="robots" content="noindex, nofollow"/);
  assert.doesNotMatch(html, /class="v4-mobile-site-header/);
  assert.doesNotMatch(html, /class="account-story/);
});

test("local build renders the first-use account setup entry", async () => {
  const response = await render("/hesap-kurulum?return_to=%2Fdijital-proje-merkezi&entry=first-use");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /<h1 id="arx-setup-title">ARKEMX hesabınızı hazırlayın<\/h1>/);
  assert.match(html, /Güvenli oturumunuzu açın/);
  assert.match(html, /action="\/hesap-baglantisi"/);
  assert.match(html, /entry=first-use/);
  assert.match(html, /name="robots" content="noindex, nofollow"/);
  assert.doesNotMatch(html, /class="v4-mobile-site-header/);
});

test("anonymous focused account page renders a stable sign-in handoff", async () => {
  const response = await render("/hesabim");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /<h1 id="arx-account-login-title">Oturum gerekli<\/h1>/);
  assert.match(html, /href="\/giris\?return_to=%2Fhesabim"/);
  assert.doesNotMatch(html, /class="v4-mobile-site-header/);
});

test("authenticated prototype headers open the account directly", async () => {
  const cookie = { cookie: "arkemx_prototype_session=1" };

  const homeResponse = await render("/", cookie);
  assert.ok(homeResponse.status === 307 || homeResponse.status === 308);
  assert.match(
    homeResponse.headers.get("location") ?? "",
    /\/hesap-kurulum\?return_to=%2Fdijital-proje-merkezi$/,
  );

  const centerResponse = await render("/dijital-proje-merkezi", cookie);
  assert.equal(centerResponse.status, 200);
  const centerHtml = await centerResponse.text();
  assert.match(centerHtml, /href="\/hesabim">Hesabım<\/a>/);
  assert.doesNotMatch(centerHtml, /href="\/giris\?return_to=%2Fhesabim">Hesabım<\/a>/);
});

test("local account session diagnostic reports unauthenticated state without D1", async () => {
  const response = await render("/api/account-session");
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.authenticated, false);
  assert.equal(body.user, null);
  assert.equal(body.identitySource, null);
  assert.match(response.headers.get("cache-control") ?? "", /no-store/);
});

test("prototype demo sign-in reopens the requested account directly", async () => {
  const response = await render("/hesap-baglantisi?return_to=%2Fhesabim");
  assert.equal(response.status, 302);
  assert.equal(response.headers.get("location"), "/hesabim");
  assert.match(response.headers.get("set-cookie") ?? "", /arkemx_prototype_session=1/);
});

test("explicit first-use setup stays on setup after prototype session creation", async () => {
  const response = await render("/hesap-baglantisi?return_to=%2Fdijital-proje-merkezi", {
    referer: "http://localhost/hesap-kurulum?return_to=%2Fdijital-proje-merkezi&entry=first-use",
  });
  assert.equal(response.status, 302);
  assert.equal(response.headers.get("location"), "/hesap-kurulum?return_to=%2Fdijital-proje-merkezi&entry=first-use");
  assert.match(response.headers.get("set-cookie") ?? "", /arkemx_prototype_session=1/);
});

test("prototype demo session is visible to account diagnostics and account page", async () => {
  const cookie = { cookie: "arkemx_prototype_session=1" };

  const sessionResponse = await render("/api/account-session", cookie);
  assert.equal(sessionResponse.status, 200);
  const body = await sessionResponse.json();
  assert.equal(body.authenticated, true);
  assert.equal(body.identitySource, "prototype-demo");
  assert.equal(body.user.email, "demo@arkemx.local");
  assert.equal(body.user.displayName, "Buse İbşiroğlu");

  const accountResponse = await render("/hesabim", cookie);
  assert.equal(accountResponse.status, 200);
  const html = await accountResponse.text();
  assert.match(html, /<h1>Hesabım<\/h1>/);
  assert.match(html, /demo@arkemx\.local/);
  assert.match(html, /Görüşmeler ve İşlem Geçmişi/);
  assert.match(html, /href="\/demo-cikis\?return_to=%2Fgiris"/);
});

test("prototype demo sign-out clears the local session", async () => {
  const response = await render("/demo-cikis?return_to=%2Fgiris", {
    cookie: "arkemx_prototype_session=1",
  });
  assert.equal(response.status, 302);
  assert.equal(response.headers.get("location"), "/giris");
  assert.match(response.headers.get("set-cookie") ?? "", /arkemx_prototype_session=;/);
  assert.match(response.headers.get("set-cookie") ?? "", /Max-Age=0/);
});


test("project start numeric fields allow temporary empty edits", () => {
  const source = fs.readFileSync(new URL("../app/components/ProjectStartStudio.tsx", import.meta.url), "utf8");
  assert.match(source, /const \[numericDrafts, setNumericDrafts\]/);
  assert.match(source, /if \(rawValue\.trim\(\) === ""\) return;/);
  assert.match(source, /value=\{numericDrafts\.targetArea\}/);
  assert.match(source, /value=\{numericDrafts\.floors\}/);
  assert.match(source, /value=\{numericDrafts\.floorHeight\}/);
  assert.match(source, /onBlur=\{\(\) => commitNumericDraft\("targetArea", 20, 1_000_000\)\}/);
  assert.match(source, /onBlur=\{\(\) => commitNumericDraft\("floorHeight", 2\.4, 30\)\}/);
});


test("guided drafts sync to the account and remain portable between preview origins", () => {
  const startSource = fs.readFileSync(new URL("../app/components/ProjectStartStudio.tsx", import.meta.url), "utf8");
  const draftApi = fs.readFileSync(new URL("../app/api/project-draft/route.ts", import.meta.url), "utf8");
  const accountSource = fs.readFileSync(new URL("../app/components/ClientAccountSettings.tsx", import.meta.url), "utf8");

  assert.match(startSource, /fetch\("\/api\/project-draft", \{ cache: "no-store" \}\)/);
  assert.match(startSource, /method: "POST"/);
  assert.match(startSource, /method: "DELETE"/);
  assert.match(startSource, /Taslağı indir/);
  assert.match(startSource, /Taslak yükle/);
  assert.match(draftApi, /customer_project_drafts/);
  assert.match(draftApi, /owner_email TEXT PRIMARY KEY/);
  assert.match(accountSource, /Devam eden proje taslağı/);
  assert.match(accountSource, /href="\/proje-baslat"/);
});


test("fresh prototype databases recover the stable demo profile automatically", () => {
  const authSource = fs.readFileSync(new URL("../app/chatgpt-auth.ts", import.meta.url), "utf8");
  const workspaceSource = fs.readFileSync(new URL("../app/api/customer-workspace/route.ts", import.meta.url), "utf8");

  assert.match(authSource, /ARKEMX_PROTOTYPE_DEMO_NAME/);
  assert.match(authSource, /Buse İbşiroğlu/);
  assert.match(authSource, /ARKEMX_PROTOTYPE_DEMO_COMPANY/);
  assert.match(workspaceSource, /identitySource === "prototype-demo"/);
  assert.match(workspaceSource, /prototypeDemoProfileDefaults\(\)/);
  assert.match(workspaceSource, /ON CONFLICT\(email\) DO NOTHING/);
});


test("project roadmap labels readiness and user declarations truthfully", () => {
  const startSource = fs.readFileSync(new URL("../app/components/ProjectStartStudio.tsx", import.meta.url), "utf8");
  const guidedSource = fs.readFileSync(new URL("../app/lib/guided-project.ts", import.meta.url), "utf8");

  assert.match(startSource, /BAŞLANGIÇ VERİ HAZIRLIĞI/);
  assert.match(startSource, /EKSİK \/ DOĞRULANACAK VERİLER VE BELGELER/);
  assert.match(startSource, /Kullanıcı beyanı: ada\/parsel hazır/);
  assert.match(guidedSource, /verificationItems/);
  assert.match(guidedSource, /başlangıç formunda henüz girilmedi/);
  assert.match(guidedSource, /status: parcelKnown \? "official-review" : "missing"/);
});


test("active projects do not reopen as a blank new-project form", () => {
  const startSource = fs.readFileSync(new URL("../app/components/ProjectStartStudio.tsx", import.meta.url), "utf8");
  const graphSource = fs.readFileSync(new URL("../app/lib/project-graph.ts", import.meta.url), "utf8");
  const coreSource = fs.readFileSync(new URL("../app/lib/project-core.ts", import.meta.url), "utf8");

  assert.match(startSource, /editingActiveProject/);
  assert.match(startSource, /Aktif projenin başlangıç bilgileri yüklendi/);
  assert.match(startSource, /newProjectMode/);
  assert.match(graphSource, /Parsel kimliğini ve sınırını doğrula/);
  assert.match(graphSource, /\/arsa-fizibilite-studyosu\?stage=locate#geo-studyo/);
  assert.match(coreSource, /bekleniyor", "kullanıcı beyanı", "doğrulanmamış", "önizleme"/);
});


test("completed projects are saved before their recovery draft is cleared", () => {
  const startSource = fs.readFileSync(new URL("../app/components/ProjectStartStudio.tsx", import.meta.url), "utf8");
  const accountSource = fs.readFileSync(new URL("../app/components/ClientAccountSettings.tsx", import.meta.url), "utf8");

  assert.match(startSource, /draftHasMeaningfulInput/);
  assert.match(startSource, /persistProjectToAccount/);
  assert.match(startSource, /await clearCompletedDraft\(\)/);
  assert.match(startSource, /if \(!completed \|\| !project\.id/);
  const finishStart = startSource.indexOf("const finish = () => {");
  const cleanupStart = startSource.indexOf("const clearCompletedDraft = async", finishStart);
  assert.ok(finishStart >= 0 && cleanupStart > finishStart);
  const finishBlock = startSource.slice(finishStart, cleanupStart);
  assert.doesNotMatch(finishBlock, /localStorage\.removeItem\(DRAFT_KEY\)/);
  assert.match(accountSource, /meaningfulDraft/);
  assert.match(accountSource, /openAccountProject/);
  assert.match(accountSource, /importProject\(item\.payload\)/);
  assert.match(accountSource, /onClick=\{\(\) => \{ void openAccountProject\(item\); \}\}/);
});


test("parcel workspace can return to the persistent project start summary", () => {
  const parcelPage = fs.readFileSync(new URL("../app/arsa-fizibilite-studyosu/page.tsx", import.meta.url), "utf8");
  const startPage = fs.readFileSync(new URL("../app/proje-baslat/page.tsx", import.meta.url), "utf8");
  const startStudio = fs.readFileSync(new URL("../app/components/ProjectStartStudio.tsx", import.meta.url), "utf8");

  assert.match(parcelPage, /href="\/proje-baslat\?view=summary"/);
  assert.match(parcelPage, /Önceki adıma dön/);
  assert.match(startPage, /summaryMode/);
  assert.match(startStudio, /Proje başlangıç özeti/);
  assert.match(startStudio, /intakeFromProjectModule/);
  assert.match(startStudio, /summaryReady/);
  assert.match(startStudio, /if \(completed \|\| summaryReady\)/);
});


test("account automatically reconciles an active local project missing from account storage", () => {
  const accountSource = fs.readFileSync(new URL("../app/components/ClientAccountSettings.tsx", import.meta.url), "utf8");
  assert.match(accountSource, /accountHasActiveProject/);
  assert.match(accountSource, /Aktif proje hesabınızla eşitleniyor/);
  assert.match(
    accountSource,
    /expectedAccountUpdatedAt: accountActiveProject\?\.updatedAt \?\? null/,
  );
  assert.match(accountSource, /arx-account-local-project/);
  assert.match(accountSource, /Şimdi kaydet/);
});


test("account keeps draft continuation clear without a redundant project-header action", () => {
  const accountSource = fs.readFileSync(new URL("../app/components/ClientAccountSettings.tsx", import.meta.url), "utf8");
  assert.match(accountSource, /Taslağa Devam Et/);
  assert.match(accountSource, /arx-account-draft-actions/);
  assert.match(accountSource, /<Link href="\/dijital-proje-merkezi">Proje Çalışma Alanına Git/);
  assert.doesNotMatch(accountSource, /<header>[\s\S]{0,300}Projeye Devam Et<\/Link>[\s\S]{0,50}<\/header>/);
});


test("account and delete flows use clearer project continuation and close controls", () => {
  const accountSource = fs.readFileSync(new URL("../app/components/ClientAccountSettings.tsx", import.meta.url), "utf8");
  const centerSource = fs.readFileSync(new URL("../app/components/SimpleProjectCenter.tsx", import.meta.url), "utf8");
  assert.match(accountSource, /Proje Çalışma Alanına Git/);
  assert.doesNotMatch(centerSource, />Vazgeç<\/button>/);
  assert.match(centerSource, /aria-label="Silme panelini kapat"/);
  assert.match(centerSource, /<X size=\{17\}/);
});


test("every guided project stage exposes a previous-step action", () => {
  const pages = [
    ["../app/arsa-fizibilite-studyosu/page.tsx", "/proje-baslat?view=summary"],
    ["../app/mimari-program-studyosu/page.tsx", "/arsa-fizibilite-studyosu?stage=design#geo-studyo", "Yapı Yerleşimine Dön"],
    ["../app/plan-ve-aks/page.tsx", "/mimari-program-studyosu"],
    ["../app/tasiyici-on-tasarim/page.tsx", "/sistem-karsilastirma"],
    ["../app/sistem-karsilastirma/page.tsx", "/plan-ve-aks"],
    ["../app/bim-koordinasyon/page.tsx", "/tasiyici-on-tasarim"],
    ["../app/proje-takibi/page.tsx", "/bim-koordinasyon"],
  ];
  for (const [relativePath, previousHref, previousLabel = "Önceki adıma dön"] of pages) {
    const source = fs.readFileSync(new URL(relativePath, import.meta.url), "utf8");
    assert.ok(source.includes(previousLabel));
    assert.ok(source.includes(`href="${previousHref}"`));
  }

  const kernelSource = fs.readFileSync(new URL("../app/components/ProjectKernel.tsx", import.meta.url), "utf8");
  assert.match(kernelSource, /previousJourneyStep/);
  assert.match(kernelSource, /← Önceki adım/);
});


test("parcel workspace starts clean, inherits project location and updates device location dynamically", () => {
  const studio = fs.readFileSync(new URL("../app/components/GeoParcelStudio.tsx", import.meta.url), "utf8");
  const kernel = fs.readFileSync(new URL("../app/components/ProjectKernel.tsx", import.meta.url), "utf8");
  const geocode = fs.readFileSync(new URL("../app/api/geocode/route.ts", import.meta.url), "utf8");

  assert.match(studio, /useState<GeoPoint\[\]>\(\[\]\)/);
  assert.doesNotMatch(studio, /useState<GeoPoint\[\]>\(\(\) => sampleParcel\(defaultCenter\)\)/);
  assert.match(studio, /parseDeclaredLocation/);
  assert.match(studio, /Başlangıç konumu \/ kullanıcı beyanı/);
  assert.match(studio, /fetchGeocode\(\{ q: declaredLocation \}\)/);
  assert.match(studio, /fetchGeocode\(\{ lat: point\.lat, lng: point\.lng \}\)/);
  assert.match(studio, /setProvince\(result\.province \?\? ""\)/);
  assert.match(studio, /setDistrict\(result\.district \?\? ""\)/);
  assert.match(studio, /Ada \/ parsel seçimi bekleniyor/);
  assert.match(studio, /disabled=\{!parcel\.length\}/);
  assert.match(studio, /!simple && <button className="geo-wide-action" onClick=\{loadSample\}/);
  assert.doesNotMatch(studio, /normalizeAdministrativeName\("Sakarya"\)/);

  assert.match(kernel, /const locationParts = intake\.location\.includes\("\/"\)/);
  assert.match(geocode, /nominatim\.openstreetmap\.org\/search/);
  assert.match(geocode, /nominatim\.openstreetmap\.org\/reverse/);
  assert.match(geocode, /countrycodes/);
});


test("active project summary cannot be overwritten by a separate unfinished draft", () => {
  const start = fs.readFileSync(new URL("../app/components/ProjectStartStudio.tsx", import.meta.url), "utf8");
  const account = fs.readFileSync(new URL("../app/components/ClientAccountSettings.tsx", import.meta.url), "utf8");

  assert.match(start, /if \(summaryMode \|\| \(hasActiveProject && !newProjectMode\)\) \{/);
  assert.match(start, /if \(summaryMode\) setDraftReady\(true\)/);
  assert.match(start, /if \(summaryMode \|\| !draftReady/);
  assert.match(start, /Başlangıç kararları proje çekirdeğinden yeniden yüklendi/);

  assert.match(account, /Yeni proje taslağı · kayıtlı projelerden ayrıdır/);
  assert.match(account, /const removeDraft = async \(\) =>/);
  assert.match(account, /fetch\("\/api\/project-draft", \{ method: "DELETE" \}\)/);
  assert.match(account, /window\.localStorage\.removeItem\(GUIDED_DRAFT_KEY\)/);
});


test("TKGM parcel boundaries stay read-only until an editable copy is created", () => {
  const studio = fs.readFileSync(new URL("../app/components/GeoParcelStudio.tsx", import.meta.url), "utf8");

  assert.match(studio, /officialBoundaryLocked/);
  assert.match(studio, /officialBoundaryLockedRef/);
  assert.match(studio, /Düzenlenebilir Kopya Oluştur/);
  assert.match(studio, /Orijinal TKGM Sınırına Dön/);
  assert.match(studio, /TKGM sınırı salt okunurdur/);
  assert.match(studio, /officialBoundaryEvidence/);
  assert.match(studio, /TKGM kaynaklı kullanıcı kopyası · uzman doğrulaması gerekli/);
  assert.match(studio, /if \(officialBoundaryLockedRef\.current\)/);
  assert.match(studio, /setOfficialBoundaryEvidence\(\{/);
  assert.match(studio, /officialBoundaryEvidence,/);
});


test("3D terrain opens without massing and labels preliminary calculations", () => {
  const studio = fs.readFileSync(new URL("../app/components/GeoParcelStudio.tsx", import.meta.url), "utf8");
  const viewer = fs.readFileSync(new URL("../app/components/GeoTerrainViewer.tsx", import.meta.url), "utf8");
  assert.ok(studio.includes("showTerrainMassing"));
  assert.ok(studio.includes("Temsili kütleyi göster"));
  assert.ok(studio.includes("Temsili Ön Kütle"));
  assert.ok(studio.includes("\"building-mass\": showTerrainMassing"));
  assert.ok(viewer.includes("Temsili Ön Kütle"));
  assert.ok(viewer.includes("Parametrik ön hesap"));
  assert.ok(viewer.includes("Ölçülmüş veri değildir"));
});


test("3D terrain hides building-dependent metrics until conceptual massing is enabled", () => {
  const viewer = fs.readFileSync(new URL("../app/components/GeoTerrainViewer.tsx", import.meta.url), "utf8");
  assert.ok(viewer.includes('layers["building-mass"] && <>'));
  assert.ok(viewer.includes('geo-terrain-analysis'));
  assert.ok(viewer.includes('terrain-only'));
  assert.ok(viewer.includes('YAPI ALTI Δ'));
  assert.ok(viewer.includes('ÖN HAFRİYAT'));
});


test("coordinate data view distinguishes parametric terrain values from measured data", () => {
  const studio = fs.readFileSync(new URL("../app/components/GeoParcelStudio.tsx", import.meta.url), "utf8");
  assert.ok(studio.includes("PARAMETRİK KOT FARKI"));
  assert.ok(studio.includes("Ölçülmüş Z verisi yok"));
  assert.ok(studio.includes("TEMSİLİ EŞ YÜKSELTİ"));
  assert.ok(studio.includes("Parametrik yüzeyden üretildi"));
  assert.ok(studio.includes("Yerel ENU başlangıcı"));
  assert.ok(studio.includes("Parsel merkezi (0,0) kabul edilir"));
  assert.ok(studio.includes("resmî pafta koordinatı değil"));
});


test("zoning form starts empty and does not invent planning rights", () => {
  const zoning = fs.readFileSync(new URL("../app/lib/zoning.ts", import.meta.url), "utf8");
  const studio = fs.readFileSync(new URL("../app/components/GeoParcelStudio.tsx", import.meta.url), "utf8");

  assert.ok(zoning.includes('planScale: ""'));
  assert.ok(zoning.includes('buildingOrder: ""'));
  assert.ok(zoning.includes('taks: -1'));
  assert.ok(zoning.includes('kaks: -1'));
  assert.ok(zoning.includes('hmax: -1'));
  assert.ok(zoning.includes('frontSetback: -1'));
  assert.ok(zoning.includes('sourceType: ""'));
  assert.ok(zoning.includes('sourceDate: ""'));
  assert.ok(zoning.includes('sourceNote: ""'));
  assert.ok(studio.includes("İmar girdileri bekleniyor"));
  assert.ok(studio.includes("tamamlanmadan yapı zarfı hesabı üretilmez"));
  assert.ok(studio.includes("Plan ölçeğini seçin"));
  assert.ok(studio.includes("Yapı nizamını seçin"));
  assert.ok(studio.includes("TAKS girin"));
  assert.ok(studio.includes("KAKS / emsal girin"));
  assert.ok(studio.includes("looksLikeLegacyPlaceholder"));
  assert.ok(studio.includes("zoningFormReady"));
  assert.ok(studio.includes("Onaylı kaynak statüsü, yetkili doğrulama süreci kurulana kadar kullanıcı arayüzünden atanamaz"));
});


test("unverified zoning massing uses qualified language and flags manual Hmax conflicts", () => {
  const studio = fs.readFileSync(new URL("../app/components/GeoParcelStudio.tsx", import.meta.url), "utf8");
  assert.ok(studio.includes("Girilen imar koşullarında ön kütleyi sınayın."));
  assert.ok(studio.includes("GİRDİYE GÖRE AZAMİ TABAN"));
  assert.ok(studio.includes("GİRDİYE GÖRE AZAMİ EMSAL ALAN"));
  assert.ok(studio.includes("GİRDİYE GÖRE YÜKSEKLİK / KAT SINIRI"));
  assert.ok(studio.includes("GİRDİLERLE ÖN UYUMLU"));
  assert.ok(studio.includes("Doğrulanmamış kullanıcı imar girdilerine göre hesaplanmıştır."));
  assert.ok(studio.includes("manualHeightExceedsZoning"));
  assert.ok(studio.includes("Yükseklik sınırı aşılıyor."));
});


test("unverified massing terminology avoids implying official zoning rights", () => {
  const studio = fs.readFileSync(new URL("../app/components/GeoParcelStudio.tsx", import.meta.url), "utf8");
  assert.ok(studio.includes("V112 / İMAR GİRDİLİ KÜTLE ÖN KONTROLÜ"));
  assert.ok(studio.includes("Girdi kullanımı"));
  assert.ok(studio.includes('massingModel.source.authoritative ? "V112 / İMAR UYUMLU KÜTLE MOTORU"'));
  assert.ok(studio.includes('massingModel.source.authoritative ? "Hak kullanımı" : "Girdi kullanımı"'));
});


test("2D map distinguishes TKGM boundary, conceptual setback envelope and read-only points", () => {
  const studio = fs.readFileSync(new URL("../app/components/GeoParcelStudio.tsx", import.meta.url), "utf8");
  assert.ok(studio.includes("setbackEnvelopeLayerRef"));
  assert.ok(studio.includes("Kavramsal çekme zarfı · ön kontrol"));
  assert.ok(studio.includes("Temsili Ön Kütle"));
  assert.ok(studio.includes("TKGM parsel sınırı"));
  assert.ok(studio.includes("TKGM sınır noktası · salt okunur"));
  assert.ok(studio.includes('dashArray: "7 6"'));
});


test("2D conceptual massing visibility is independent from 3D massing toggle", () => {
  const studio = fs.readFileSync(new URL("../app/components/GeoParcelStudio.tsx", import.meta.url), "utf8");
  assert.ok(studio.includes("showConceptualOverlays && zoningFormReady && parcel.length >= 3"));
  assert.ok(!studio.includes('showConceptualOverlays && terrainLayers["building-mass"] && parcel.length >= 3'));
  assert.ok(studio.includes("Temsili Ön Kütle<br>"));
});


test("2D map warns when conceptual massing breaches parcel or setback pre-check", () => {
  const studio = fs.readFileSync(new URL("../app/components/GeoParcelStudio.tsx", import.meta.url), "utf8");
  assert.ok(studio.includes("geo-map-placement-warning"));
  assert.ok(studio.includes("Yerleşim ön kontrolü uyarısı."));
  assert.ok(studio.includes("Temsili Ön Kütle parsel sınırını aşıyor veya sınırla kesişiyor."));
  assert.ok(studio.includes("KENAR BAZLI ÇEKME UYARISI"));
  assert.ok(studio.includes('color: placementWarning ? "#e27b42" : "#ffffff"'));
});


test("north-relative rotation control supports negative angles", () => {
  const studio = fs.readFileSync(new URL("../app/components/GeoParcelStudio.tsx", import.meta.url), "utf8");
  assert.ok(studio.includes('min="-180" max="180" step="5"'));
  assert.ok(studio.includes("normalizeSignedRotation"));
  assert.ok(studio.includes("setRotation(normalizeSignedRotation(saved.rotation))"));
});


test("manual placement uses edge-specific front side rear setbacks", () => {
  const studio = fs.readFileSync(new URL("../app/components/GeoParcelStudio.tsx", import.meta.url), "utf8");
  assert.ok(studio.includes("assessParcelEdgeSetbacks"));
  assert.ok(studio.includes("setbackRoleLabel"));
  assert.ok(studio.includes("Ön/yan/arka çekmeler kenar bazında ayrı kontrol edilir"));
  assert.ok(studio.includes("en kritik"));
});


test("live massing precheck surfaces TAKS KAKS and Hmax violations", () => {
  const studio = fs.readFileSync(new URL("../app/components/GeoParcelStudio.tsx", import.meta.url), "utf8");
  assert.ok(studio.includes("const taksExceeded"));
  assert.ok(studio.includes("const kaksExceeded"));
  assert.ok(studio.includes("const hmaxExceeded"));
  assert.ok(studio.includes("İmar ön kontrolü uyarısı."));
  assert.ok(studio.includes("TAKS ÖN KONTROL UYARISI"));
  assert.ok(studio.includes("KAKS ÖN KONTROL UYARISI"));
  assert.ok(studio.includes("HMAX ÖN KONTROL UYARISI"));
  assert.ok(studio.includes("İmar oranı ön kontrolü aşılıyor."));
  assert.ok(studio.includes("placementPrecheckWarning"));
});


test("manual massing area uses the same one-decimal dimensions shown in UI", () => {
  const studio = fs.readFileSync(new URL("../app/components/GeoParcelStudio.tsx", import.meta.url), "utf8");
  assert.ok(studio.includes("normalizeMassingDimension"));
  assert.ok(studio.includes("const canonicalWidth = normalizeMassingDimension(buildingWidth)"));
  assert.ok(studio.includes("const canonicalDepth = normalizeMassingDimension(buildingDepth)"));
  assert.ok(studio.includes("const footprint = canonicalWidth * canonicalDepth"));
  assert.ok(studio.includes("const gross = footprint * floors"));
  assert.ok(studio.includes('calculationBasis: "displayed-rectangular-dimensions-0.1m"'));
  assert.equal(Number((22.5 * 16.6).toFixed(2)), 373.5);
  assert.equal(Number((22.5 * 16.6 * 4).toFixed(2)), 1494);
  assert.equal(Number((30 * 16.6).toFixed(2)), 498);
});


test("TAKS and KAKS thresholds use displayed allowed areas at dimension-step precision", () => {
  const studio = fs.readFileSync(new URL("../app/components/GeoParcelStudio.tsx", import.meta.url), "utf8");
  assert.ok(studio.includes("metrics.footprint > metrics.allowedFootprint + .01"));
  assert.ok(studio.includes("metrics.gross > metrics.allowedGross + .01"));
  assert.ok(studio.includes('!taksExceeded && !kaksExceeded && !hmaxExceeded, "İmar girdileriyle ön uyum"'));
  assert.equal(Number((22.5 * 21.3).toFixed(2)), 479.25);
  assert.equal(Number((22.5 * 21.4).toFixed(2)), 481.5);
});


test("placement decision summary combines zoning limits, setbacks and source trust", () => {
  const studio = fs.readFileSync(new URL("../app/components/GeoParcelStudio.tsx", import.meta.url), "utf8");
  assert.ok(studio.includes("YERLEŞİM ÖN KONTROLÜ"));
  assert.ok(studio.includes("Parametrik ön kontrolde açık ihlal bulunmadı"));
  assert.ok(studio.includes("Kaynak bilgisi kayıtlı · uzman doğrulaması gerekli"));
  assert.ok(studio.includes("setbackDecision.front"));
  assert.ok(studio.includes("setbackDecision.side"));
  assert.ok(studio.includes("setbackDecision.rear"));
  assert.ok(studio.includes("Bu sonuç parametrik ön kontroldür; imar uygunluğu, aplikasyon, ruhsat veya resmî onay değildir."));
});


test("simple parcel workspace keeps project kernel compact and splits long zoning and placement controls", () => {
  const studio = fs.readFileSync(new URL("../app/components/GeoParcelStudio.tsx", import.meta.url), "utf8");
  assert.ok(studio.includes('compact /> : <ProjectKernelBar'));
  assert.ok(studio.includes('className="geo-collapsible-block"'));
  assert.ok(studio.includes(">Plan ve kaynak<"));
  assert.ok(studio.includes(">Belge ve notlar<"));
  assert.ok(studio.includes('className="geo-design-tabs"'));
  assert.ok(studio.includes('designPanel === "summary"'));
  assert.ok(studio.includes('designPanel === "massing"'));
  assert.ok(studio.includes('designPanel === "adjust"'));
});


test("simple parcel workspace keeps placement summary and qualified calculation limits", () => {
  const studio = fs.readFileSync(new URL("../app/components/GeoParcelStudio.tsx", import.meta.url), "utf8");
  assert.ok(studio.includes('if (stage === "design") setDesignPanel("summary")'));
  assert.ok(studio.includes('Bu sonuç parametrik ön kontroldür; imar uygunluğu, aplikasyon, ruhsat veya resmî onay değildir.'));
  assert.ok(studio.includes('Hukuki ve teknik sınır'));
  assert.ok(studio.includes('!simple ? <footer className="geo-studio-foot"')); 
});


test("parking demand result is visible beside inputs and in technical summary", () => {
  const studio = fs.readFileSync(new URL("../app/components/GeoParcelStudio.tsx", import.meta.url), "utf8");
  assert.ok(studio.includes("const parkingDemand = gross / 100 * parkingPer100"));
  assert.ok(studio.includes("const parkingNeed = Math.ceil(parkingDemand)"));
  assert.ok(studio.includes("Hesaplanan park ihtiyacı"));
  assert.ok(studio.includes("→ yukarı yuvarlandı"));
  assert.ok(studio.includes("<small>Park ihtiyacı</small><b>{metrics.parkingNeed} araç</b>"));
});


test("application exposes persistent light and dark theme controls", () => {
  const theme = fs.readFileSync(new URL("../app/components/ThemeSystem.tsx", import.meta.url), "utf8");
  const layout = fs.readFileSync(new URL("../app/layout.tsx", import.meta.url), "utf8");
  const globals = fs.readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
  assert.ok(theme.includes('type ArkemTheme = "light" | "dark"'));
  assert.ok(theme.includes('localStorage.setItem(STORAGE_KEY, next)'));
  assert.ok(theme.includes('aria-label="Tema seçimi"'));
  assert.ok(theme.includes('Açık'));
  assert.ok(theme.includes('Koyu'));
  assert.ok(layout.includes("<ThemeControl/>"));
  assert.ok(layout.includes('localStorage.getItem("arkemx-theme")'));
  assert.ok(globals.includes('html[data-theme="dark"]'));
});


test("dark theme uses true black surfaces and high-contrast parcel UI", () => {
  const theme = fs.readFileSync(new URL("../app/components/ThemeSystem.tsx", import.meta.url), "utf8");
  const globals = fs.readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
  const geo = fs.readFileSync(new URL("../app/arsa-fizibilite-studyosu/sade-arazi.css", import.meta.url), "utf8");
  assert.ok(theme.includes('theme === "dark" ? "#000000"'));
  assert.ok(globals.includes("/* ARKEMX true-black dark pass */"));
  assert.ok(globals.includes("background: #000000 !important"));
  assert.ok(geo.includes("/* ARKEMX geo true-black contrast pass */"));
  assert.ok(geo.includes("color: #ffffff !important"));
  assert.ok(geo.includes("Keep satellite/terrain imagery natural"));
});


test("geo parcel state survives reloads and can recover from project backup", () => {
  const studio = fs.readFileSync(new URL("../app/components/GeoParcelStudio.tsx", import.meta.url), "utf8");
  assert.ok(studio.includes("arkemx-geo-draft:"));
  assert.ok(studio.includes("PROJECT_BACKUP_KEY"));
  assert.ok(studio.includes("decodeProjectEnvelope"));
  assert.ok(!studio.includes("if (!Object.keys(project.modules).length) return"));
  assert.ok(studio.includes('setNeighborhood(saved.neighborhood ?? "")'));
  assert.ok(studio.includes('setBlock(saved.block ?? "")'));
  assert.ok(studio.includes('setParcelNo(saved.parcelNo ?? "")'));
  assert.ok(studio.includes("if (!hydrated || !transferApplied.current) return"));
  assert.ok(studio.includes("window.localStorage.setItem(geoDraftKey(project.id)"));
  assert.ok(studio.includes('patchModule("geo-parcel", moduleSnapshot)'));
});

test("account navigation stays inside the Next app so project kernel remains mounted", () => {
  const accountLink = fs.readFileSync(new URL("../app/components/AccountHeaderLink.tsx", import.meta.url), "utf8");
  assert.ok(accountLink.includes('import Link from "next/link"'));
  assert.ok(accountLink.includes("return <Link href={href}>{label}</Link>"));
  assert.ok(!accountLink.includes("return <a href={href}>{label}</a>"));
});


test("project geocoding cannot erase a restored parcel identity", () => {
  const studio = fs.readFileSync(new URL("../app/components/GeoParcelStudio.tsx", import.meta.url), "utf8");
  assert.ok(studio.includes("const hasExplicitParcelIdentity = Boolean("));
  assert.ok(studio.includes("saved?.previewParcel?.length"));
  assert.ok(studio.includes("|| neighborhood"));
  assert.ok(studio.includes("|| block"));
  assert.ok(studio.includes("|| parcelNo"));
  assert.ok(studio.includes("if (result.province && !province) setProvince(result.province)"));
  assert.ok(studio.includes("if (result.district && !district) setDistrict(result.district)"));
  const geocodeEffectStart = studio.indexOf("const hasExplicitParcelIdentity = Boolean(");
  const geocodeEffectEnd = studio.indexOf("const coordinateCenter = useMemo", geocodeEffectStart);
  const geocodeEffect = studio.slice(geocodeEffectStart, geocodeEffectEnd);
  assert.ok(!geocodeEffect.includes('setNeighborhood("")'));
  assert.ok(!geocodeEffect.includes('setBlock("")'));
  assert.ok(!geocodeEffect.includes('setParcelNo("")'));
});




test("restored parcel identity stays visible while TKGM lists reload", () => {
  const studio = fs.readFileSync(new URL("../app/components/GeoParcelStudio.tsx", import.meta.url), "utf8");
  assert.ok(studio.includes("function keepSelectedAdministrativeOption("));
  assert.ok(studio.includes("const visibleProvinceOptions = useMemo("));
  assert.ok(studio.includes("const visibleDistrictOptions = useMemo("));
  assert.ok(studio.includes("const visibleNeighborhoodOptions = useMemo("));
  assert.ok(studio.includes('setParcelLookup(hasSavedBoundary || hasSavedPreviewBoundary ? "found" : "idle")'));
  assert.ok(studio.includes('"parcel-boundary": restoredParcel.length >= 3 ? true'));
  assert.ok(studio.includes("visibleNeighborhoodOptions.map((item) => <option"));
});


test("account project open preserves newer local state and avoids full reload", () => {
  const account = fs.readFileSync(new URL("../app/components/ClientAccountSettings.tsx", import.meta.url), "utf8");
  assert.ok(account.includes('import { useRouter } from "next/navigation"'));
  assert.ok(account.includes("const accountCopyNeedsUpdate = hasActiveProject"));
  assert.ok(account.includes("localProjectUpdatedAt > accountPayloadUpdatedAt"));
  assert.ok(account.includes("expectedAccountUpdatedAt: accountActiveProject?.updatedAt ?? null"));
  assert.ok(account.includes("const openingCurrentLocalProject = hasActiveProject"));
  assert.ok(account.includes("localProjectUpdatedAt >= payloadUpdatedAt(item.payload)"));
  assert.ok(account.includes('router.push("/dijital-proje-merkezi")'));
  assert.ok(!account.includes('window.location.assign("/dijital-proje-merkezi")'));
});


test("zoning source metadata is explicit, persistent and never treated as approval", () => {
  const zoning = fs.readFileSync(new URL("../app/lib/zoning.ts", import.meta.url), "utf8");
  const studio = fs.readFileSync(new URL("../app/components/GeoParcelStudio.tsx", import.meta.url), "utf8");
  assert.ok(zoning.includes("sourceType: string"));
  assert.ok(zoning.includes("sourceDate: string"));
  assert.ok(zoning.includes("sourceNote: string"));
  assert.ok(zoning.includes("type: zoning.sourceType || null"));
  assert.ok(zoning.includes("date: zoning.sourceDate || null"));
  assert.ok(studio.includes("Kaynak türünü seçin"));
  assert.ok(studio.includes("Belge / kaynak tarihi"));
  assert.ok(studio.includes("Kaynak açıklaması"));
  assert.ok(studio.includes("Kaynak bilgisi eklendi · uzman doğrulaması gerekli"));
  assert.ok(studio.includes("Kaynak bilgisi eksik"));
  assert.ok(studio.includes("zoningSourceReferenceReady"));
  assert.ok(studio.includes('zoning.sourceType === "Kullanıcı beyanı" && zoning.sourceNote.trim()'));
  assert.ok(studio.includes("zoningSourceReady"));
});


test("project next-action links can open the exact parcel workflow stage", () => {
  const studio = fs.readFileSync(new URL("../app/components/GeoParcelStudio.tsx", import.meta.url), "utf8");
  const graph = fs.readFileSync(new URL("../app/lib/project-graph.ts", import.meta.url), "utf8");
  assert.ok(studio.includes("const search = new URLSearchParams(window.location.search)"));
  assert.ok(studio.includes('const requestedStage = search.get("stage")'));
  assert.ok(studio.includes("stages.some((stage) => stage.id === requestedStage)"));
  assert.ok(graph.includes('/arsa-fizibilite-studyosu?stage=locate#geo-studyo'));
  assert.ok(graph.includes('/arsa-fizibilite-studyosu?stage=zoning#geo-studyo'));
  assert.ok(studio.includes('[zoningSourceReady, "İmar kaynak bilgisi kayıtlı"]'));
});


test("simple project center distinguishes working package readiness from official release", () => {
  const hub = fs.readFileSync(new URL("../app/components/DigitalProjectHub.tsx", import.meta.url), "utf8");
  assert.match(hub, /Resmî teslim için uygun değil/);
  assert.match(hub, /Ön fizibilite \/ çalışma paketi hazır · manifest üretilebilir/);
  assert.match(hub, /Teknik kapanışı bekleyen inceleme kayıtları/);
  assert.match(hub, /data-testid="delivery-review-issues"/);
});


test("BIM coordination exposes explicit beam-MEP section strategy", () => {
  const studio = fs.readFileSync(new URL("../app/components/EngineeringCoordinationStudio.tsx", import.meta.url), "utf8");
  const engine = fs.readFileSync(new URL("../app/lib/bim-coordination.ts", import.meta.url), "utf8");
  assert.match(studio, /Kiriş–MEP düşey ilişkisi/);
  assert.match(studio, /Ayrık · kiriş \+ MEP toplanır/);
  assert.match(studio, /Entegre · ortak servis bandı/);
  assert.match(studio, /sectionStrategy/);
  assert.match(engine, /calculateConceptualClearHeight/);
  assert.match(engine, /Math\.max\(beamDepth, serviceZone\)/);
  assert.match(engine, /sectionStrategy/);
});


test("project center labels 10-of-13 as module coverage rather than data errors", () => {
  const hub = fs.readFileSync(new URL("../app/components/DigitalProjectHub.tsx", import.meta.url), "utf8");
  assert.match(hub, /MODÜL BAĞLANTISI/);
  assert.match(hub, /çalışma modülü bağlı/);
  assert.match(hub, /Çalışma modülleri/);
  assert.match(hub, /Bu sayı teknik hata sayısı değildir/);
  assert.match(hub, /data-testid="module-coverage-detail"/);
  assert.match(hub, /Henüz bağlı değil/);
  assert.doesNotMatch(hub, /<span>VERİ HAZIRLIĞI<\/span><b>%\{thread\.metrics\.readiness\}/);
});

