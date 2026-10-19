import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("accepted WGS84 lookup aligns source identity, CRS and status key in source (not runtime acceptance)", () => {
  const source = readFileSync(new URL("../app/components/GeoParcelStudio.tsx", import.meta.url), "utf8");
  assert.match(source, /const nextSourceCrs = "EPSG:4326 \/ WGS84";/);
  assert.match(source, /setSourceCrs\(nextSourceCrs\)/);
  assert.match(source, /identity: nextIdentity/);
  assert.match(source, /setLookupState\(\{ key: `\$\{parcelIdentityKey\(nextIdentity\)\}\|\$\{nextSourceCrs\}`, status: "found" \}\)/);
});

test("legacy labels cannot promote saved geometry to an official source in source (not runtime acceptance)", () => {
  const source = readFileSync(new URL("../app/components/GeoParcelStudio.tsx", import.meta.url), "utf8");
  const start = source.indexOf('const savedStatus = saved.dataStatus');
  const end = source.indexOf('if (saved.province)', start);
  assert.ok(start >= 0 && end > start);
  const legacyBranch = source.slice(start, end);
  assert.match(legacyBranch, /const kind: ParcelSourceKind = "user-file"/);
  assert.match(legacyBranch, /authority: "Önceki ARKEMX proje kaydı"/);
  assert.doesNotMatch(legacyBranch, /kind === "tkgm-open-service"/);
});
