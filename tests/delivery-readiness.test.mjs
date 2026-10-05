import assert from "node:assert/strict";
import test from "node:test";
import { createDeliveryReadiness, createWorkingDeliveryManifest } from "../app/lib/delivery-readiness.ts";

function baseModules() {
  return {
    "geo-parcel": {
      zoning: {
        taks: .4,
        kaks: 1.2,
        hmax: 12,
        buildingOrder: "ayrık",
        sourceDocument: "sahte-belge.pdf",
        verification: "certified-document",
      },
      zoningProvenance: { authoritative: true },
    },
    "architectural-program": {
      architecturalScheme: { schema: "ARKEM-ARCH-SCHEME/3.0" },
    },
    "structural-concept": {
      structuralStudio: { schema: "ARKEM-STRUCTURAL-STUDIO/3.0" },
    },
    "engineering-coordination": {
      bimCoordination: {
        schema: "ARKEM-BIM-COORDINATION/3.0",
        clashes: [],
      },
      reviewed: [],
    },
    "project-os": {
      operatingModel: { schema: "ARKEM-PROJECT-OS/2.0" },
      coordination: {
        bimCoordination: { schema: "ARKEM-BIM-COORDINATION/3.0", clashes: [] },
        issueGate: { technicalApproval: true },
      },
    },
  };
}

test("client-stored authority claims never unlock official delivery", () => {
  const gate = createDeliveryReadiness({
    projectId: "TEST-01",
    projectRevision: "P01",
    modules: baseModules(),
    threadIssues: [],
  });
  assert.equal(gate.officialReleaseEligible, false);
  assert.equal(gate.workingExportEligible, true);
  assert.equal(gate.checks.find((check) => check.code === "DEL-01")?.evidence.authorityVerified, false);
  assert.equal(gate.checks.find((check) => check.code === "DEL-05")?.evidence.storedApprovalIgnored, true);
  assert.ok(gate.reasons.includes("AUTHENTICATED_DELIVERY_APPROVAL_NOT_CONFIGURED"));
});

test("reviewed critical BIM issue remains delivery-blocking", () => {
  const modules = baseModules();
  modules["engineering-coordination"] = {
    bimCoordination: {
      schema: "ARKEM-BIM-COORDINATION/3.0",
      clashes: [{ guid: "CLASH-1", title: "Kritik test", severity: "critical", evidence: "sentetik" }],
    },
    reviewed: ["CLASH-1"],
  };
  const gate = createDeliveryReadiness({
    projectId: "TEST-02",
    projectRevision: "P01",
    modules,
    threadIssues: [],
  });
  assert.equal(gate.state, "critical-blocked");
  assert.equal(gate.criticalIssueCount, 1);
  assert.deepEqual(gate.blockingIssues.map(issue => [issue.source, issue.id]), [["CURRENT_BIM", "CLASH-1"]]);
  const bim = gate.checks.find((check) => check.code === "DEL-04");
  assert.equal(bim?.status, "blocked");
  assert.equal(bim?.evidence.reviewedCritical, 1);
  assert.equal(gate.officialReleaseEligible, false);
});

test("cleared parametric rules still require review and never imply technical approval", () => {
  const gate = createDeliveryReadiness({
    projectId: "TEST-03",
    projectRevision: "P02",
    modules: baseModules(),
    threadIssues: [{ id: "BIM-053", title: "KM–KR ön kontrolü için kaynak nesneler eksik", severity: "review" }],
  });
  assert.equal(gate.state, "review-required");
  assert.equal(gate.criticalIssueCount, 0);
  assert.equal(gate.reviewIssueCount, 1);
  assert.deepEqual(gate.reviewIssues.map(issue => issue.id), ["BIM-053"]);
  assert.equal(gate.officialReleaseEligible, false);
  assert.ok(gate.checks.every((check) => check.status !== "blocked"));
});

test("working manifest is explicitly non-approved", () => {
  const manifest = createWorkingDeliveryManifest({
    projectId: "TEST-04",
    projectRevision: "P01",
    modules: baseModules(),
    threadIssues: [],
  });
  assert.equal(manifest.status, "WORKING_DRAFT_NOT_APPROVED");
  assert.equal(manifest.officialReleaseEligible, false);
  assert.equal(manifest.electronicSignatureVerified, false);
  assert.equal(manifest.nativeIfcAttached, false);
  assert.equal(manifest.nativeBcfZipAttached, false);
  assert.match(manifest.boundary, /resmî dijital teslim değildir/);
});


test("reviewed noncritical BIM issue remains visible as delivery review work", () => {
  const modules = baseModules();
  modules["engineering-coordination"] = {
    bimCoordination: {
      schema: "ARKEM-BIM-COORDINATION/3.0",
      clashes: [{
        guid: "BIM-REVIEW-1",
        title: "Net kullanım yüksekliği inceleme bandında",
        severity: "review",
        evidence: "2.45 m net yükseklik",
      }],
    },
    reviewed: ["BIM-REVIEW-1"],
  };

  const gate = createDeliveryReadiness({
    projectId: "TEST-05",
    projectRevision: "P01",
    modules,
    threadIssues: [],
  });

  assert.equal(gate.criticalIssueCount, 0);
  assert.equal(gate.reviewIssueCount, 1);
  assert.deepEqual(gate.reviewIssues.map(issue => [issue.source, issue.id, issue.status]), [
    ["CURRENT_BIM", "BIM-REVIEW-1", "REVIEWED_STILL_OPEN"],
  ]);
  assert.ok(gate.reasons.includes("REVIEW_ISSUES_OPEN"));

  const bim = gate.checks.find((check) => check.code === "DEL-04");
  assert.equal(bim?.status, "review");
  assert.equal(bim?.evidence.reviewClashes, 1);
  assert.equal(bim?.evidence.reviewedReviewClashes, 1);
  assert.match(bim?.detail ?? "", /1 inceleme konusu açık/);

  const manifest = createWorkingDeliveryManifest({
    projectId: "TEST-05",
    projectRevision: "P01",
    modules,
    threadIssues: [],
  });
  assert.equal(manifest.gate.reviewIssueCount, 1);
  assert.equal(manifest.issues[0]?.status, "REVIEWED_STILL_OPEN");
  assert.equal(manifest.issues[0]?.technicalClosureVerified, false);
});

test("unknown BIM severity fails closed as delivery review work", () => {
  const modules = baseModules();

  modules["engineering-coordination"] = {
    bimCoordination: {
      schema: "ARKEM-BIM-COORDINATION/3.0",
      clashes: [{
        guid: "BIM-UNKNOWN-1",
        title: "Severity değeri tanınmayan koordinasyon konusu",
        severity: "unknown",
        evidence: "sentetik bozuk severity",
      }],
    },
    reviewed: [],
  };

  const gate = createDeliveryReadiness({
    projectId: "TEST-FC-03",
    projectRevision: "P01",
    modules,
    threadIssues: [],
  });

  assert.equal(gate.criticalIssueCount, 0);
  assert.equal(gate.reviewIssueCount, 1);
  assert.deepEqual(
    gate.reviewIssues.map(issue => [issue.source, issue.id, issue.status]),
    [["CURRENT_BIM", "BIM-UNKNOWN-1", "REVIEW_REQUIRED"]],
  );
  assert.ok(gate.reasons.includes("REVIEW_ISSUES_OPEN"));

  const bim = gate.checks.find((check) => check.code === "DEL-04");
  assert.equal(bim?.status, "review");
});

test("missing upstream delivery modules remain explicitly missing", () => {
  const gate = createDeliveryReadiness({
    projectId: "TEST-FC-04",
    projectRevision: "P01",
    modules: {},
    threadIssues: [],
  });

  const statusByCode = Object.fromEntries(
    gate.checks.map((check) => [check.code, check.status]),
  );

  assert.equal(gate.state, "review-required");
  assert.equal(gate.officialReleaseEligible, false);
  assert.equal(statusByCode["DEL-02"], "missing");
  assert.equal(statusByCode["DEL-03"], "missing");
  assert.equal(statusByCode["DEL-04"], "missing");
  assert.equal(statusByCode["DEL-05"], "missing");

  assert.ok(gate.reasons.includes("ARCHITECTURE_MISSING"));
  assert.ok(gate.reasons.includes("STRUCTURAL_MODEL_MISSING"));
  assert.ok(gate.reasons.includes("BIM_COORDINATION_MISSING"));
  assert.ok(gate.reasons.includes("PROJECT_OS_HANDOFF_NOT_CURRENT"));
});

test("stale Project OS critical snapshot still blocks when current BIM is missing", () => {
  const modules = baseModules();

  delete modules["engineering-coordination"];

  modules["project-os"] = {
    operatingModel: { schema: "ARKEM-PROJECT-OS/2.0" },
    coordination: {
      bimCoordination: {
        schema: "ARKEM-BIM-COORDINATION/3.0",
        clashes: [{
          guid: "STALE-CRITICAL-1",
          title: "Eski snapshot kritik koordinasyon konusu",
          severity: "critical",
          evidence: "sentetik eski snapshot",
        }],
      },
      issueGate: { technicalApproval: true },
    },
  };

  const gate = createDeliveryReadiness({
    projectId: "TEST-FC-05",
    projectRevision: "P01",
    modules,
    threadIssues: [],
  });

  assert.equal(gate.state, "critical-blocked");
  assert.equal(gate.criticalIssueCount, 1);
  assert.deepEqual(
    gate.blockingIssues.map(issue => [issue.source, issue.id]),
    [["OS_SNAPSHOT_FALLBACK", "STALE-CRITICAL-1"]],
  );

  assert.ok(gate.reasons.includes("BIM_COORDINATION_MISSING"));
  assert.ok(gate.reasons.includes("CRITICAL_ISSUES_OPEN"));

  const os = gate.checks.find((check) => check.code === "DEL-05");
  assert.equal(os?.status, "blocked");
});
