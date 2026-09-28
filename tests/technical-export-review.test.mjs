import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { assessExportReview, escapeXml } from "../app/lib/export-review.ts";

const baseline = {
  geometryValid: true, buildingFits: true, setbackPass: true,
  coverage: 30, maxCoverage: 40, far: .75, maxFar: 1.2,
  buildingHeight: 9, maxHeight: 15.5,
  zoningAuthoritative: false, officialCadastre: false,
  licensedSurvey: false, measuredTerrain: false,
};

test("Budamis 210/15: failing building placement and TAKS block release in every output", () => {
  const result = assessExportReview({
    ...baseline, buildingFits: false, setbackPass: false,
    coverage: 57.07745938487731, maxCoverage: 40,
    far: 1.141549187697546,
  });
  assert.equal(result.status, "review-required");
  assert.equal(result.officialReleaseEligible, false);
  assert.equal(result.checks.parcelContainment, false);
  assert.equal(result.checks.taks, false);
  assert.equal(result.checks.kaks, true);
  assert.ok(result.reasons.some((reason) => reason.includes("TAKS")));
});

test("passing dimensional checks never self-authorize official release", () => {
  const result = assessExportReview({
    ...baseline,
    zoningAuthoritative: true, officialCadastre: true,
    licensedSurvey: true, measuredTerrain: true,
  });
  assert.equal(result.status, "preliminary-check-pass");
  assert.equal(result.officialReleaseEligible, false);
  assert.deepEqual(result.reasons, []);
});

test("missing measured land and unverified zoning require review even when mass fits", () => {
  const result = assessExportReview(baseline);
  assert.equal(result.status, "review-required");
  assert.equal(result.checks.geometry, true);
  assert.equal(result.checks.zoningSource, false);
  assert.equal(result.checks.measuredTerrain, false);
});

test("NaN and missing numeric data cannot pass preliminary review", () => {
  const result = assessExportReview({ ...baseline, coverage: NaN });
  assert.equal(result.checks.taks, false);
  assert.equal(result.checks.kaks, false);
  assert.equal(result.status, "review-required");
});

test("KML review text is XML escaped", () => {
  assert.equal(escapeXml('A & B <C> "D"'), "A &amp; B &lt;C&gt; &quot;D&quot;");
});

test("exports and drawings consume the same review status", () => {
  const studio = fs.readFileSync(new URL("../app/components/GeoParcelStudio.tsx", import.meta.url), "utf8");
  const sheet = fs.readFileSync(new URL("../app/lib/technical-sheet.ts", import.meta.url), "utf8");
  const cad = fs.readFileSync(new URL("../app/lib/engineering.ts", import.meta.url), "utf8");
  assert.match(studio, /reviewStatus: exportReview.status/);
  assert.match(studio, /<Data name="reviewStatus">/);
  assert.match(studio, /reviewBanner: exportReview.status/);
  assert.match(studio, /warningNotes:/);
  assert.match(studio, /dataStatus, exportReview, officialReleaseEligible: false/);
  assert.match(sheet, /if \(input.reviewBanner\)/);
  assert.match(cad, /\["ARKEM_UYARI", 1\]/);
});
