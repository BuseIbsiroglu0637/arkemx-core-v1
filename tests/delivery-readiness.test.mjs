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
    threadIssues: [],
  });
  assert.equal(gate.state, "review-required");
  assert.equal(gate.criticalIssueCount, 0);
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
