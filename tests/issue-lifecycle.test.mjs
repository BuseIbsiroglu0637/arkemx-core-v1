import assert from "node:assert/strict";
import test from "node:test";
import { restoreReviewedIds, summarizeIssueLifecycle } from "../app/lib/issue-lifecycle.ts";

test("active critical issues remain blocked after being reviewed", () => {
  const issues = [
    { id: "critical-01", severity: "critical" },
    { id: "review-02", severity: "review" },
  ];
  const lifecycle = summarizeIssueLifecycle(issues, ["critical-01"]);
  assert.equal(lifecycle.blocked, true);
  assert.equal(lifecycle.activeCriticalCount, 1);
  assert.equal(lifecycle.reviewedCriticalCount, 1);
  assert.equal(lifecycle.status, "critical-open");
  assert.equal(lifecycle.modelClearedIds.length, 0);
});

test("rule remediation clears model conflict, never grants technical approval", () => {
  const lifecycle = summarizeIssueLifecycle([], ["critical-01"]);
  assert.equal(lifecycle.blocked, false);
  assert.deepEqual(lifecycle.modelClearedIds, ["critical-01"]);
  assert.equal(lifecycle.status, "conceptual-clear");
  assert.match(lifecycle.limitation, /yetkili mühendis onayı değildir/);
});

test("legacy resolved IDs migrate to review instead of technical closure", () => {
  assert.deepEqual(restoreReviewedIds(undefined, ["x", "x", "y"]), ["x", "y"]);
  assert.deepEqual(restoreReviewedIds(["a"], ["x"]), ["a"]);
});

test("Project OS cannot mark source-linked critical BIM issues closed", async () => {
  const fs = await import("node:fs");
  const os = fs.readFileSync(new URL("../app/components/ProjectOperatingSystem.tsx", import.meta.url), "utf8");
  assert.match(os, /item\.sourceGuid && item\.priority === "critical"/);
  assert.match(os, /"blocked" as const/);
  assert.match(os, /"in-review" as const/);
  assert.match(os, /project-os-issue-gate/);
  assert.match(os, /kapatt?ılamaz|kapatılamaz/);
});
