/** V152: untrusted UI and legacy device records cannot self-certify zoning. */
import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import {
  DEFAULT_ZONING,
  createZoningProvenance,
  normalizeUntrustedZoningVerification,
} from "../app/lib/zoning.ts";

test("untrusted zoning selector never produces an authoritative status", () => {
  assert.equal(normalizeUntrustedZoningVerification("approved-plan", true), "document-pending-review");
  assert.equal(normalizeUntrustedZoningVerification("certified-document", true), "document-pending-review");
  assert.equal(normalizeUntrustedZoningVerification("certified-document", false), "user-declared");
  assert.equal(normalizeUntrustedZoningVerification("approved-plan", false), "user-declared");
  assert.equal(normalizeUntrustedZoningVerification("document-pending-review", false), "user-declared");
  assert.equal(normalizeUntrustedZoningVerification("document-pending-review", true), "document-pending-review");
  assert.equal(normalizeUntrustedZoningVerification("municipal-viewer", false), "municipal-viewer");
  assert.equal(normalizeUntrustedZoningVerification("__tampered__", true), "user-declared");

  for (const selection of ["approved-plan", "certified-document", "municipal-viewer"]) {
    const verification = normalizeUntrustedZoningVerification(selection, true);
    const provenance = createZoningProvenance({
      ...DEFAULT_ZONING,
      sourceDocument: "unreviewed-file.pdf",
      verification,
    }, "SYNTHETIC-TEST");
    assert.equal(provenance.authoritative, false);
  }

  const studio = fs.readFileSync(
    new URL("../app/components/GeoParcelStudio.tsx", import.meta.url), "utf8"
  );
  assert.doesNotMatch(studio, /<option value="(?:approved-plan|certified-document)"/);
  assert.match(studio, /normalizeUntrustedZoningVerification\(saved\.zoning/);
  assert.match(studio, /disabled=\{!zoning\.sourceDocument\}/);
});
