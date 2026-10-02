import assert from "node:assert/strict";
import test from "node:test";
import { deriveProjectThread, PROJECT_MODULES } from "../app/lib/project-graph.ts";
import { createZoningProvenance, DEFAULT_ZONING } from "../app/lib/zoning.ts";
import { buildMcdaProjectSnapshot, mcdaSourceKey, mcdaUsageFromProject } from "../app/lib/mcda-source.ts";

function geoModule(zoningProvenance = {}) {
  return {
    reference: "Kastamonu / Merkez / Budamış / 210 / 15",
    metrics: {
      geometryValid: true,
      area: 1597.8,
      footprint: 373.5,
      gross: 747,
      allowedFootprint: 479.34,
      allowedGross: 1438.02,
      buildingHeight: 6.8,
      buildingFits: true,
      setbackPass: true,
    },
    planning: { maxHeight: 9.5 },
    system: "Karar Bekleniyor",
    parcelRecord: {
      projectEligible: true,
      geometry: { valid: true },
    },
    zoningProvenance,
  };
}

const conditions = {
  landUse: "Konut",
  buildingOrder: "Ayrık nizam",
  taks: 0.3,
  kaks: 0.9,
  hmax: 9.5,
  setbacks: { front: 5, side: 3, rear: 3 },
};

const plan = {
  name: "Uygulama imar planı",
  scale: "1/1000 Uygulama İmar Planı",
  planId: "TEST-PLAN-001",
};

test("valid parcel with missing zoning conditions points to zoning entry", () => {
  const thread = deriveProjectThread({
    "decision-assistant": { status: "Brief tamamlandı" },
    "geo-parcel": geoModule({
      authoritative: false,
      plan: {},
      conditions: {},
      source: {},
    }),
  });

  assert.equal(thread.nextAction.label, "İmar koşullarını gir");
  assert.equal(thread.nodes.find(node => node.id === "geo-parcel")?.readiness, 70);
});

test("entered zoning conditions without source points to source evidence", () => {
  const thread = deriveProjectThread({
    "decision-assistant": { status: "Brief tamamlandı" },
    "geo-parcel": geoModule({
      authoritative: false,
      plan,
      conditions,
      source: {},
    }),
  });

  assert.equal(thread.nextAction.label, "İmar kaynağını ekle");
  assert.equal(thread.nodes.find(node => node.id === "geo-parcel")?.readiness, 85);
});

test("documented but unverified zoning source permits workflow continuation with review issue", () => {
  const thread = deriveProjectThread({
    "decision-assistant": { status: "Brief tamamlandı" },
    "geo-parcel": geoModule({
      authoritative: false,
      verification: "user-declared",
      plan,
      conditions,
      source: {
        type: "Kullanıcı beyanı",
        date: "2026-10-01",
        document: null,
        url: null,
        note: "Kaynak bilgisi kullanıcı tarafından kaydedildi.",
      },
    }),
  });

  assert.notEqual(thread.nextAction.label, "İmar koşullarını gir");
  assert.notEqual(thread.nextAction.label, "İmar kaynağını ekle");
  assert.equal(thread.nodes.find(node => node.id === "geo-parcel")?.readiness, 95);
  const review = thread.issues.find(issue => issue.id === "PLN-010");
  assert.equal(review?.severity, "review");
  assert.match(review?.title ?? "", /uzman doğrulaması/i);
  assert.equal(review?.route, "/arsa-fizibilite-studyosu?stage=zoning&focus=source#geo-studyo");
});

test("completed expert review clears PLN-010 without claiming authoritative zoning", () => {
  const provenance = createZoningProvenance({
    ...DEFAULT_ZONING,
    landUse: "Konut",
    buildingOrder: "Ayrık nizam",
    taks: 0.3,
    kaks: 0.9,
    hmax: 9.5,
    frontSetback: 5,
    sideSetback: 3,
    rearSetback: 3,
    planName: "Uygulama imar planı",
    planScale: "1/1000 Uygulama İmar Planı",
    planId: "TEST-PLAN-001",
    sourceType: "Kullanıcı beyanı",
    sourceDate: "2026-10-01",
    sourceNote: "Teknik geliştirme testi için kullanıcı tarafından girilmiş kaynak kaydı.",
    expertReviewStatus: "reviewed-consistent",
    expertReviewer: "Test Uzmanı",
    expertReviewerRole: "Şehir plancısı",
    expertReviewDate: "2026-10-01",
    expertReviewBasis: "TEST-PLAN-001 ve kayıtlı plan notları",
    expertReviewNote: "Proje içi kaynak/koşul karşılaştırması tamamlandı.",
  }, "KASTAMONU-MERKEZ-210-15");

  assert.equal(provenance.expertReviewed, true);
  assert.equal(provenance.authoritative, false);

  const thread = deriveProjectThread({
    "decision-assistant": { status: "Brief tamamlandı" },
    "geo-parcel": geoModule(provenance),
  });

  // Expert review closes PLN-010, but user-declared zoning is still not
  // authoritative; parcel readiness therefore remains 95 rather than 100.
  assert.equal(thread.nodes.find(node => node.id === "geo-parcel")?.readiness, 95);
  assert.equal(thread.issues.some(issue => issue.id === "PLN-010"), false);
  const completed = thread.completedControls.find(control => control.code === "PLN-010");
  assert.ok(completed);
  assert.equal(completed?.title, "İmar kaynağı uzman incelemesi");
  assert.match(completed?.summary ?? "", /resmî onay değildir/);
});

test("authoritative zoning provenance clears the zoning review gate", () => {
  const thread = deriveProjectThread({
    "decision-assistant": { status: "Brief tamamlandı" },
    "geo-parcel": geoModule({
      authoritative: true,
      verification: "certified-document",
      plan,
      conditions,
      source: {
        type: "Belediye imar durumu",
        date: "2026-10-01",
        document: "imar-durumu.pdf",
        url: null,
        note: null,
      },
    }),
  });

  assert.equal(thread.nodes.find(node => node.id === "geo-parcel")?.readiness, 100);
  assert.equal(thread.issues.some(issue => issue.id === "PLN-010"), false);
});


test("completed placement is inferred and does not send the project back to quick site scenario", () => {
  const thread = deriveProjectThread({
    "decision-assistant": { status: "Brief tamamlandı" },
    "geo-parcel": geoModule({
      authoritative: false,
      verification: "user-declared",
      plan,
      conditions,
      source: {
        type: "Kullanıcı beyanı",
        date: "2026-10-01",
        note: "Kaynak bilgisi kullanıcı tarafından kaydedildi.",
      },
    }),
    "architectural-program": { input: { targetGross: 1200, floors: 3, floorHeight: 3.4 } },
    "system-comparison": { input: { preferredSystem: "undecided" }, ranking: [] },
  });

  assert.equal(thread.nodes.find(node => node.id === "quick-site-scenario")?.active, true);
  assert.notEqual(thread.nextAction.label, "Hızlı yerleşim");
  assert.equal(thread.nextAction.label, "Sistemi ve yöntemi seç");
});

test("resolved structural system advances beyond the system decision gate", () => {
  const geo = geoModule({
    authoritative: false,
    verification: "user-declared",
    plan,
    conditions,
    source: {
      type: "Kullanıcı beyanı",
      date: "2026-10-01",
      note: "Kaynak bilgisi kullanıcı tarafından kaydedildi.",
    },
  });
  geo.system = "Yapısal Çelik";
  const thread = deriveProjectThread({
    "decision-assistant": { status: "Brief tamamlandı" },
    "geo-parcel": geo,
    "architectural-program": { input: { targetGross: 1200, floors: 3, floorHeight: 3.4 } },
    "system-comparison": { input: { preferredSystem: "steel" }, ranking: [] },
  });

  assert.equal(thread.nodes.find(node => node.id === "quick-site-scenario")?.active, true);
  assert.notEqual(thread.nextAction.label, "Hızlı yerleşim");
  assert.notEqual(thread.nextAction.label, "Sistemi ve yöntemi seç");
});


test("TAKS issue routes to the actual footprint data owner", () => {
  const geo = geoModule({
    authoritative: false,
    verification: "user-declared",
    plan,
    conditions,
    source: {
      type: "Kullanıcı beyanı",
      date: "2026-10-01",
      note: "Kaynak bilgisi kullanıcı tarafından kaydedildi.",
    },
  });
  geo.metrics.footprint = 567;
  geo.metrics.allowedFootprint = 479.3;

  const thread = deriveProjectThread({
    "decision-assistant": { status: "Brief tamamlandı" },
    "geo-parcel": geo,
  });

  const issue = thread.issues.find(item => item.id === "PLN-011");
  assert.ok(issue);
  assert.equal(issue?.route, "/arsa-fizibilite-studyosu?stage=design#geo-studyo");
  assert.equal(issue?.routeLabel, "Kütleyi düzelt");
  assert.equal(issue?.secondaryRoute, "/arsa-fizibilite-studyosu?stage=zoning&focus=taks#geo-studyo");
  assert.equal(issue?.secondaryRouteLabel, "TAKS girdisini incele");
  assert.match(issue?.action ?? "", /en az 87\.7 m² azaltın/);

  const planOwnedThread = deriveProjectThread({
    "decision-assistant": { status: "Brief tamamlandı" },
    "geo-parcel": geo,
    "plan-editor": {
      metrics: { floorArea: 567 },
      floorCount: 2,
    },
  });
  const planOwnedIssue = planOwnedThread.issues.find(item => item.id === "PLN-011");
  assert.ok(planOwnedIssue);
  assert.match(planOwnedIssue?.evidence ?? "", /Plan & aks modeli/);
  assert.equal(planOwnedIssue?.route, "/tasarim-calismalari/plan-duzeltme");
  assert.equal(planOwnedIssue?.routeLabel, "Plan tabanını düzelt");
  assert.equal(planOwnedIssue?.secondaryRoute, "/arsa-fizibilite-studyosu?stage=zoning&focus=taks#geo-studyo");
});

test("invalid parcel geometry opens the boundary editing stage directly", () => {
  const geo = geoModule({
    authoritative: false,
    plan: {},
    conditions: {},
    source: {},
  });
  geo.metrics.geometryValid = false;
  geo.parcelRecord.projectEligible = false;
  geo.parcelRecord.geometry.valid = false;

  const thread = deriveProjectThread({
    "geo-parcel": geo,
  });

  const issue = thread.issues.find(item => item.id === "GIS-001");
  assert.ok(issue);
  assert.equal(issue?.route, "/arsa-fizibilite-studyosu?stage=draw#geo-studyo");
});


test("KAKS and Hmax issues expose design and zoning resolution paths", () => {
  const geo = geoModule({
    authoritative: false,
    verification: "user-declared",
    plan,
    conditions,
    source: {
      type: "Kullanıcı beyanı",
      date: "2026-10-01",
      note: "Kaynak bilgisi kullanıcı tarafından kaydedildi.",
    },
  });
  geo.metrics.gross = 1600;
  geo.metrics.allowedGross = 1438;

  const thread = deriveProjectThread({
    "decision-assistant": { status: "Brief tamamlandı" },
    "geo-parcel": geo,
    "architectural-program": { input: { targetGross: 1600, floors: 3, floorHeight: 3.4 } },
  });

  const kaks = thread.issues.find(item => item.id === "PLN-012");
  assert.ok(kaks);
  assert.equal(kaks?.route, "/mimari-program-studyosu/kaks-duzeltme");
  assert.equal(kaks?.routeLabel, "Programı düzelt");
  assert.equal(kaks?.secondaryRoute, "/arsa-fizibilite-studyosu?stage=zoning&focus=kaks#geo-studyo");
  assert.equal(kaks?.secondaryRouteLabel, "KAKS girdisini incele");
  assert.match(kaks?.action ?? "", /en az 162\.0 m² azaltın/);

  const hmax = thread.issues.find(item => item.id === "PLN-013");
  assert.ok(hmax);
  assert.equal(hmax?.route, "/tasarim-calismalari/yukseklik-duzeltme");
  assert.equal(hmax?.routeLabel, "Kat adedini düzelt");
  assert.equal(hmax?.secondaryRoute, "/arsa-fizibilite-studyosu?stage=zoning&focus=hmax#geo-studyo");
  assert.equal(hmax?.secondaryRouteLabel, "Hmax girdisini incele");
  assert.match(hmax?.action ?? "", /en az 0\.70 m azaltın/);
});


test("resolved TAKS and KAKS controls move from open issues into completed controls", () => {
  const zoning = geoModule({
    authoritative: false,
    verification: "user-declared",
    plan,
    conditions,
    source: {
      type: "Kullanıcı beyanı",
      date: "2026-10-01",
      note: "Kaynak bilgisi kullanıcı tarafından kaydedildi.",
    },
  });

  const open = deriveProjectThread({
    "geo-parcel": zoning,
    "plan-editor": {
      metrics: { floorArea: 567 },
      floorCount: 2,
    },
    "architectural-program": {
      input: { targetGross: 1600, floors: 2, floorHeight: 3.4 },
      result: { grossDemand: 1600 },
    },
  });

  assert.equal(open.issues.some(issue => issue.id === "PLN-011"), true);
  assert.equal(open.completedControls.some(control => control.code === "PLN-011"), false);
  assert.equal(open.issues.some(issue => issue.id === "PLN-012"), true);
  assert.equal(open.completedControls.some(control => control.code === "PLN-012"), false);

  const resolved = deriveProjectThread({
    "geo-parcel": zoning,
    "plan-editor": {
      metrics: { floorArea: 476.9 },
      floorCount: 2,
    },
    "architectural-program": {
      input: { targetGross: 1430.8, floors: 2, floorHeight: 3.4 },
      result: { grossDemand: 1430.8 },
    },
  });

  assert.equal(resolved.issues.some(issue => issue.id === "PLN-011"), false);
  assert.equal(resolved.issues.some(issue => issue.id === "PLN-012"), false);

  const taks = resolved.completedControls.find(control => control.code === "PLN-011");
  assert.ok(taks);
  assert.equal(taks?.title, "TAKS ön kontrolü");
  assert.match(taks?.summary ?? "", /Plan tabanı: 476,9 \/ 479,3 m²/);
  assert.equal(taks?.route, "/tasarim-calismalari/plan-duzeltme");

  const kaks = resolved.completedControls.find(control => control.code === "PLN-012");
  assert.ok(kaks);
  assert.equal(kaks?.title, "KAKS ön kontrolü");
  assert.match(kaks?.summary ?? "", /Program brütü: 1\.430,8 \/ 1\.438 m²/);
  assert.equal(kaks?.route, "/mimari-program-studyosu/kaks-duzeltme");
});


test("structural geometry conflicts route to the focused model synchronization workspace", () => {
  const zoning = geoModule({
    authoritative: false,
    verification: "user-declared",
    plan,
    conditions,
    source: {
      type: "Kullanıcı beyanı",
      date: "2026-10-01",
      note: "Kaynak bilgisi kullanıcı tarafından kaydedildi.",
    },
  });

  const thread = deriveProjectThread({
    "geo-parcel": zoning,
    "plan-editor": {
      floorCount: 2,
      baysX: 6,
      baysY: 5,
      spanX: 7.071,
      spanY: 3.862,
      metrics: { floorArea: 476.9 },
    },
    "structural-concept": {
      input: {
        floors: 4,
        width: 24,
        depth: 18,
        baysX: 5,
        baysY: 4,
        floorHeight: 3.4,
      },
    },
  });

  for (const id of ["STR-031", "STR-032", "STR-033"]) {
    const issue = thread.issues.find(item => item.id === id);
    assert.ok(issue, `${id} should be present`);
    assert.equal(issue?.route, "/tasarim-calismalari/model-senkronizasyonu");
    assert.equal(issue?.routeLabel, "Modelleri senkronize et");
  }
});


test("ARC-021 moves to completed history when program and plan gross areas are coordinated", () => {
  const open = deriveProjectThread({
    "plan-editor": {
      floorCount: 2,
      baysX: 6,
      baysY: 5,
      spanX: 4.127,
      spanY: 3.852,
      metrics: { floorArea: 476.9 },
    },
    "architectural-program": {
      input: { targetGross: 1430.8, floors: 2, floorHeight: 3.4, netRatio: 72 },
      result: { grossDemand: 1430.8 },
    },
  });

  const issue = open.issues.find(item => item.id === "ARC-021");
  assert.ok(issue);
  assert.equal(issue?.route, "/mimari-program-studyosu/plan-koordinasyonu");
  assert.equal(issue?.routeLabel, "Program ve planı koordine et");
  assert.equal(open.completedControls.some(control => control.code === "ARC-021"), false);

  const resolved = deriveProjectThread({
    "plan-editor": {
      floorCount: 2,
      baysX: 6,
      baysY: 5,
      spanX: 4.127,
      spanY: 3.852,
      metrics: { floorArea: 476.9 },
    },
    "architectural-program": {
      input: { targetGross: 953.8, floors: 2, floorHeight: 3.4, netRatio: 72 },
      result: { grossDemand: 953.8 },
    },
  });

  assert.equal(resolved.issues.some(item => item.id === "ARC-021"), false);
  const completed = resolved.completedControls.find(control => control.code === "ARC-021");
  assert.ok(completed);
  assert.equal(completed?.title, "Program / plan alan koordinasyonu");
  assert.equal(completed?.route, "/mimari-program-studyosu/plan-koordinasyonu");
  assert.match(completed?.summary ?? "", /Program: 953,8 m² · Plan: 953,8 m²/);
});


test("BIM-053 moves to completed history when mass and rigidity source objects exist", () => {
  const open = deriveProjectThread({
    "plan-editor": {
      floorCount: 2,
      baysX: 6,
      baysY: 5,
      spanX: 4.127,
      spanY: 3.852,
      metrics: {
        floorArea: 476.9,
        massPointCount: 0,
        rigidityPointCount: 0,
        eccentricityEvaluable: false,
        eccentricityRatio: 0,
      },
    },
  });

  const issue = open.issues.find(item => item.id === "BIM-053");
  assert.ok(issue);
  assert.equal(issue?.route, "/tasarim-calismalari/km-kr-kaynaklari");
  assert.equal(issue?.routeLabel, "KM/KR kaynaklarını tamamla");
  assert.equal(open.completedControls.some(control => control.code === "BIM-053"), false);

  const resolved = deriveProjectThread({
    "plan-editor": {
      floorCount: 2,
      baysX: 6,
      baysY: 5,
      spanX: 4.127,
      spanY: 3.852,
      metrics: {
        floorArea: 476.9,
        massPointCount: 4,
        rigidityPointCount: 4,
        eccentricityEvaluable: true,
        eccentricity: 0.35,
        eccentricityRatio: 1.4,
      },
    },
  });

  assert.equal(resolved.issues.some(item => item.id === "BIM-053"), false);
  const completed = resolved.completedControls.find(control => control.code === "BIM-053");
  assert.ok(completed);
  assert.equal(completed?.title, "KM–KR kaynak yeterliliği");
  assert.equal(completed?.route, "/tasarim-calismalari/km-kr-kaynaklari");
  assert.match(completed?.summary ?? "", /Kütle: 4 · Rijitlik: 4 kaynak/);
});


test("SYS-041 closes only when the current MCDA/model divergence has a matching decision record", () => {
  const base = {
    "system-comparison": {
      ranking: [
        { id: "steel", name: "Yapısal Çelik", score: 82.5 },
        { id: "concrete", name: "Betonarme", score: 76.2 },
      ],
    },
    "structural-concept": {
      input: { system: "concrete" },
    },
  };

  const open = deriveProjectThread(base);
  const issue = open.issues.find(item => item.id === "SYS-041");
  assert.ok(issue);
  assert.equal(issue?.route, "/yapi-sistemi-karsilastirma/sistem-karari");
  assert.equal(issue?.routeLabel, "Sistem kararını kaydet");
  assert.equal(open.completedControls.some(control => control.code === "SYS-041"), false);

  const justified = deriveProjectThread({
    ...base,
    "system-comparison": {
      ...base["system-comparison"],
      decision: {
        status: "recorded",
        decisionType: "retain-modeled-system",
        selectedSystem: "concrete",
        recommendedSystem: "steel",
        rationale: "Yerel uygulayıcı kapasitesi ve proje teslim stratejisi nedeniyle betonarme model korunuyor.",
        decidedBy: "TEST EKİP",
        role: "Kavramsal koordinasyon",
        date: "2026-10-01",
      },
    },
  });

  assert.equal(justified.issues.some(item => item.id === "SYS-041"), false);
  const completed = justified.completedControls.find(control => control.code === "SYS-041");
  assert.ok(completed);
  assert.equal(completed?.title, "Taşıyıcı sistem karar koordinasyonu");
  assert.match(completed?.summary ?? "", /farklı seçim gerekçelendirildi/);

  const stale = deriveProjectThread({
    ...base,
    "system-comparison": {
      ...base["system-comparison"],
      ranking: [
        { id: "precast", name: "Betonarme Prefabrik", score: 84.1 },
        { id: "steel", name: "Yapısal Çelik", score: 82.5 },
      ],
      decision: {
        status: "recorded",
        selectedSystem: "concrete",
        recommendedSystem: "steel",
        rationale: "Önceki öneriye göre verilmiş karar kaydı artık güncel değildir.",
        decidedBy: "TEST EKİP",
        role: "Kavramsal koordinasyon",
        date: "2026-10-01",
      },
    },
  });
  assert.equal(stale.issues.some(item => item.id === "SYS-041"), true);

  const aligned = deriveProjectThread({
    "system-comparison": base["system-comparison"],
    "structural-concept": { input: { system: "steel" } },
  });
  assert.equal(aligned.issues.some(item => item.id === "SYS-041"), false);
  assert.match(aligned.completedControls.find(control => control.code === "SYS-041")?.summary ?? "", /model eşleşiyor/);
});


test("MCDA source mapping preserves architectural program usage ids", () => {
  assert.equal(mcdaUsageFromProject("residential"), "residential");
  assert.equal(mcdaUsageFromProject("Konut / karma yaşam"), "residential");
  assert.equal(mcdaUsageFromProject("storage"), "storage");
  assert.equal(mcdaUsageFromProject("Ofis / ticari"), "commercial");

  const snapshot = buildMcdaProjectSnapshot({
    use: "residential",
    floors: 2,
    grossArea: 953.7,
    spanX: 5.474,
    spanY: 4.2,
  });
  assert.deepEqual(snapshot, {
    usage: "residential",
    floors: 2,
    span: 5.474,
    area: 953.7,
  });
  assert.equal(mcdaSourceKey(snapshot), "residential|2|5.474|953.7");
});

test("stale MCDA inputs open SYS-040 and suppress the old system recommendation until resynced", () => {
  const common = {
    "architectural-program": {
      input: { use: "residential", floors: 2, targetGross: 953.7 },
      result: { grossDemand: 953.7 },
    },
    "plan-editor": {
      floorCount: 2,
      baysX: 6,
      baysY: 5,
      spanX: 5.474,
      spanY: 4.2,
      metrics: { floorArea: 476.9 },
    },
    "structural-concept": {
      input: { system: "light", floors: 2 },
    },
  };

  const stale = deriveProjectThread({
    ...common,
    "system-comparison": {
      input: { usage: "residential", floors: 2, span: 5.474, area: 747, repetition: 70, transport: 180, fireRating: 90 },
      ranking: [{ id: "light", name: "Hafif Çelik", score: 82 }],
    },
  });

  const issue = stale.issues.find(item => item.id === "SYS-040");
  assert.ok(issue);
  assert.equal(issue?.route, "/yapi-sistemi-karsilastirma/mcda");
  assert.equal(issue?.routeLabel, "MCDA verisini güncelle");
  assert.match(issue?.evidence ?? "", /747\.0 m²/);
  assert.match(issue?.evidence ?? "", /953\.7 m²/);
  assert.equal(stale.canonical.structure.recommendedSystem, "");
  assert.equal(stale.completedControls.some(control => control.code === "SYS-041"), false);

  const sourceSnapshot = {
    usage: "residential",
    floors: 2,
    span: 5.474,
    area: 953.7,
  };
  const synced = deriveProjectThread({
    ...common,
    "system-comparison": {
      input: { ...sourceSnapshot, repetition: 70, transport: 180, fireRating: 90 },
      sourceSnapshot,
      sourceKey: mcdaSourceKey(sourceSnapshot),
      sourceStatus: "current",
      ranking: [{ id: "light", name: "Hafif Çelik", score: 82 }],
    },
  });

  assert.equal(synced.issues.some(item => item.id === "SYS-040"), false);
  assert.equal(synced.canonical.structure.recommendedSystem, "Hafif Çelik");
  assert.ok(synced.completedControls.find(control => control.code === "SYS-040"));
  assert.ok(synced.completedControls.find(control => control.code === "SYS-041"));
});


test("SYS-041 decision record is bound to the current MCDA source key", () => {
  const sourceSnapshot = {
    usage: "residential",
    floors: 2,
    span: 5.474,
    area: 953.7,
  };
  const currentKey = mcdaSourceKey(sourceSnapshot);
  const modules = {
    "architectural-program": {
      input: { use: "residential", floors: 2, targetGross: 953.7 },
      result: { grossDemand: 953.7 },
    },
    "plan-editor": {
      floorCount: 2,
      baysX: 6,
      baysY: 5,
      spanX: 5.474,
      spanY: 4.2,
      metrics: { floorArea: 476.9 },
    },
    "structural-concept": {
      input: { system: "concrete", floors: 2 },
    },
    "system-comparison": {
      input: { ...sourceSnapshot, repetition: 70, transport: 180, fireRating: 90 },
      sourceSnapshot,
      sourceKey: currentKey,
      ranking: [{ id: "steel", name: "Yapısal Çelik", score: 82 }],
    },
  };

  const staleDecision = deriveProjectThread({
    ...modules,
    "system-comparison": {
      ...modules["system-comparison"],
      decision: {
        status: "recorded",
        selectedSystem: "concrete",
        recommendedSystem: "steel",
        mcdaSourceKey: "residential|2|5.474|747.0",
        rationale: "Önceki veri sürümünde verilen sistem kararı artık güncel değildir.",
        decidedBy: "TEST EKİP",
        role: "Kavramsal koordinasyon",
        date: "2026-10-01",
      },
    },
  });
  assert.equal(staleDecision.issues.some(item => item.id === "SYS-041"), true);

  const currentDecision = deriveProjectThread({
    ...modules,
    "system-comparison": {
      ...modules["system-comparison"],
      decision: {
        status: "recorded",
        selectedSystem: "concrete",
        recommendedSystem: "steel",
        mcdaSourceKey: currentKey,
        rationale: "Güncel MCDA verisi üzerinde yerel tedarik ve uygulama stratejisi nedeniyle betonarme korunuyor.",
        decidedBy: "TEST EKİP",
        role: "Kavramsal koordinasyon",
        date: "2026-10-01",
      },
    },
  });
  assert.equal(currentDecision.issues.some(item => item.id === "SYS-041"), false);
  assert.match(currentDecision.completedControls.find(control => control.code === "SYS-041")?.summary ?? "", /farklı seçim gerekçelendirildi/);
});


test("BIM-052 moves to completed history when conceptual KM-KR eccentricity falls below the alert threshold", () => {
  const open = deriveProjectThread({
    "plan-editor": {
      floorCount: 2,
      baysX: 6,
      baysY: 5,
      spanX: 4.127,
      spanY: 3.2,
      metrics: {
        floorArea: 396.2,
        massPointCount: 4,
        rigidityPointCount: 4,
        eccentricityEvaluable: true,
        eccentricity: 3.1,
        eccentricityRatio: 12.5,
      },
    },
  });

  assert.ok(open.issues.find(item => item.id === "BIM-052"));
  assert.equal(open.completedControls.some(control => control.code === "BIM-052"), false);

  const resolved = deriveProjectThread({
    "plan-editor": {
      floorCount: 2,
      baysX: 6,
      baysY: 5,
      spanX: 4.127,
      spanY: 3.2,
      metrics: {
        floorArea: 396.2,
        massPointCount: 4,
        rigidityPointCount: 4,
        eccentricityEvaluable: true,
        eccentricity: 0.2,
        eccentricityRatio: 0.8,
      },
    },
  });

  assert.equal(resolved.issues.some(item => item.id === "BIM-052"), false);
  const completed = resolved.completedControls.find(control => control.code === "BIM-052");
  assert.ok(completed);
  assert.equal(completed?.title, "KM–KR yerleşim ön kontrolü");
  assert.match(completed?.summary ?? "", /%0\.8/);
});


test("resolved PLN-013 moves into completed controls with the final Hmax equation", () => {
  const zoning = {
    ...geoModule({
      authoritative: false,
      verification: "user-declared",
      plan,
      conditions,
      source: {
        type: "Kullanıcı beyanı",
        date: "2026-10-01",
        note: "Kaynak bilgisi kullanıcı tarafından kaydedildi.",
      },
    }),
    floorHeight: 3.4,
  };

  const open = deriveProjectThread({
    "geo-parcel": zoning,
    "plan-editor": {
      floorCount: 3,
      metrics: { floorArea: 400 },
    },
  });

  assert.equal(open.issues.some(issue => issue.id === "PLN-013"), true);
  assert.equal(open.completedControls.some(control => control.code === "PLN-013"), false);

  const resolved = deriveProjectThread({
    "geo-parcel": zoning,
    "plan-editor": {
      floorCount: 2,
      metrics: { floorArea: 400 },
    },
  });

  assert.equal(resolved.issues.some(issue => issue.id === "PLN-013"), false);
  const height = resolved.completedControls.find(control => control.code === "PLN-013");
  assert.ok(height);
  assert.equal(height?.title, "Hmax / yapı yüksekliği ön kontrolü");
  assert.match(height?.summary ?? "", /2 kat × 3,40 m = 6,80 m \/ Hmax 9,50 m/);
  assert.equal(height?.route, "/tasarim-calismalari/yukseklik-duzeltme");
});

test("project graph coverage is explicitly based on the 13 project modules", () => {
  assert.equal(PROJECT_MODULES.length, 13);
  assert.deepEqual(PROJECT_MODULES.map(module => module.id), [
    "decision-assistant",
    "geo-parcel",
    "quick-site-scenario",
    "architectural-program",
    "plan-editor",
    "system-comparison",
    "structural-concept",
    "engineering-coordination",
    "digital-delivery-scope",
    "arkem-x",
    "project-os",
    "model-library-review",
    "demolition-screening",
  ]);

  const thread = deriveProjectThread({});
  assert.equal(thread.metrics.totalCount, 13);
  assert.equal(thread.metrics.activeCount, 0);
});

test("project graph counts all 13 declared project modules as active when present", () => {
  const modules = Object.fromEntries(
    PROJECT_MODULES.map((module) => [module.id, {}])
  );

  const thread = deriveProjectThread(modules);

  assert.equal(thread.metrics.totalCount, 13);
  assert.equal(thread.metrics.activeCount, 13);
  assert.equal(thread.metrics.readiness, 100);

  assert.deepEqual(
    thread.nodes.filter((node) => node.active).map((node) => node.id),
    PROJECT_MODULES.map((module) => module.id)
  );
});
