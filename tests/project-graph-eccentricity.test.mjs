import assert from "node:assert/strict";
import test from "node:test";
import { deriveProjectThread } from "../app/lib/project-graph.ts";

function threadFor(metrics) {
  return deriveProjectThread({
    "architectural-program": {
      input: { use: "industrial", targetGross: 3000, floors: 3, floorHeight: 6 },
    },
    "plan-editor": {
      floorCount: 3,
      baysX: 8,
      baysY: 5,
      spanX: 5,
      spanY: 5,
      metrics: { floorArea: 1000, ...metrics },
    },
  });
}

test("automatic room-only plan does not fabricate a critical rigidity-center warning", () => {
  const thread = threadFor({
    rooms: 8, columns: 0, walls: 0,
    eccentricityRatio: 21.5,
    massPointCount: 8, rigidityPointCount: 0,
    eccentricityEvaluable: false,
  });
  assert.equal(thread.issues.some(issue => issue.id === "BIM-052"), false);
  const missing = thread.issues.find(issue => issue.id === "BIM-053");
  assert.equal(missing?.severity, "review");
  assert.match(missing?.evidence ?? "", /gerçek rijitlik merkezi değildir/);
  assert.equal(thread.metrics.critical, 0);
});

test("large eccentricity remains critical after representative mass and stiffness objects exist", () => {
  const thread = threadFor({
    rooms: 8, columns: 12, walls: 1,
    eccentricityRatio: 21.5,
    massPointCount: 8, rigidityPointCount: 13,
    eccentricityEvaluable: true,
  });
  assert.equal(thread.issues.find(issue => issue.id === "BIM-052")?.severity, "critical");
  assert.equal(thread.issues.some(issue => issue.id === "BIM-053"), false);
});

test("legacy snapshots require both source types before applying a KM-KR critical rule", () => {
  const incomplete = threadFor({ rooms: 8, columns: 0, walls: 0, eccentricityRatio: 24 });
  const complete = threadFor({ rooms: 8, columns: 12, walls: 1, eccentricityRatio: 24 });
  assert.equal(incomplete.issues.some(issue => issue.id === "BIM-052"), false);
  assert.equal(complete.issues.find(issue => issue.id === "BIM-052")?.severity, "critical");
});

test("columns alone without a mass model are not treated as a valid KM-KR result", () => {
  const thread = threadFor({
    rooms: 0, columns: 12, walls: 1,
    eccentricityRatio: 30,
    massPointCount: 0, rigidityPointCount: 13,
    eccentricityEvaluable: false,
  });
  assert.equal(thread.issues.some(issue => issue.id === "BIM-052"), false);
  assert.equal(thread.issues.find(issue => issue.id === "BIM-053")?.severity, "review");
});
