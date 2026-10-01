import assert from "node:assert/strict";
import test from "node:test";
import { deriveProjectThread } from "../app/lib/project-graph.ts";

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
  assert.equal(review?.route, "/arsa-fizibilite-studyosu?stage=zoning#geo-studyo");
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


test("TAKS issue opens the placement stage directly", () => {
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
  assert.equal(issue?.secondaryRoute, "/arsa-fizibilite-studyosu?stage=zoning#geo-studyo");
  assert.equal(issue?.secondaryRouteLabel, "TAKS girdisini incele");
  assert.match(issue?.action ?? "", /en az 87\.7 m² azaltın/);
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
  assert.equal(kaks?.routeLabel, "Programı düzelt");
  assert.equal(kaks?.secondaryRoute, "/arsa-fizibilite-studyosu?stage=zoning#geo-studyo");
  assert.equal(kaks?.secondaryRouteLabel, "KAKS girdisini incele");
  assert.match(kaks?.action ?? "", /en az 162\.0 m² azaltın/);

  const hmax = thread.issues.find(item => item.id === "PLN-013");
  assert.ok(hmax);
  assert.equal(hmax?.routeLabel, "Kat / yüksekliği düzelt");
  assert.equal(hmax?.secondaryRoute, "/arsa-fizibilite-studyosu?stage=zoning#geo-studyo");
  assert.equal(hmax?.secondaryRouteLabel, "Hmax girdisini incele");
  assert.match(hmax?.action ?? "", /en az 0\.70 m azaltın/);
});
